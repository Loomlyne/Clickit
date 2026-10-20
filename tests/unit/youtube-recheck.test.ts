// Daily re-check core (D-17, RESEARCH Pattern 11): one paged read of episodes
// and of shorts, ceil(n/50) videos.list calls, one record_youtube_checks and
// one record_short_checks write. Text: refresh unless edited (PR #27 review
// item 7, Koss 2026-10-20). Fake fetch and a fake client only; no live call,
// no key.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { recheckVideosCore } from '../../src/lib/admin/youtube-check.ts'
import {
  createYouTubeClient,
  YouTubeApiError,
  type YouTubeClientLike,
  type YouTubeVideoResource,
} from '../../src/server/youtube/client.ts'
import type { AdminDb } from '../../src/lib/admin/ports'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'
import { emulateRecordYouTubeChecks } from './helpers/record-youtube-checks-emulator.ts'
import { emulateRecordShortChecks } from './helpers/record-short-checks-emulator.ts'

const FAKE_KEY = 'AIza' + 'B'.repeat(35)
const NOW = new Date('2026-10-20T01:30:00.000Z')
const SHOW = 'aaaaaaaa-0000-4000-8000-000000000001'
const SEASON = 'cccccccc-0000-4000-8000-000000000001'

const uuid = (n: number) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, '0')}`
const vid = (n: number) => `vid${String(n).padStart(8, '0')}`

function episode(n: number, over: Row = {}): Row {
  return {
    id: uuid(n),
    show_id: SHOW,
    season_id: SEASON,
    episode_number: n,
    title: `Episode ${n}`,
    title_ar: `حلقة ${n}`,
    description: `About episode ${n}`,
    description_ar: `عن الحلقة ${n}`,
    duration: 25,
    archived: false,
    status: 'published',
    youtube_video_id: vid(n),
    youtube_status: null,
    youtube_checked_at: null,
    youtube_text_baseline_at: null,
    youtube_duration_seconds: null,
    player_error_code: null,
    player_error_at: null,
    ...over,
  }
}

function okVideo(id: string, over: Partial<YouTubeVideoResource> = {}): YouTubeVideoResource {
  return {
    id,
    snippet: { title: 'YouTube title', description: 'YouTube text', liveBroadcastContent: 'none' },
    contentDetails: { duration: 'PT25M0S' },
    status: { privacyStatus: 'unlisted', uploadStatus: 'processed', embeddable: true },
    ...over,
  }
}

function fakeYouTube(videos: Record<string, YouTubeVideoResource>, fail?: Error) {
  const calls: string[][] = []
  const client: YouTubeClientLike = {
    async getPlaylist() {
      throw new Error('not used')
    },
    async listPlaylistItemsPage() {
      throw new Error('not used')
    },
    async getVideos(ids) {
      calls.push(ids)
      if (fail) throw fail
      const out = new Map<string, YouTubeVideoResource>()
      for (const v of ids) if (videos[v]) out.set(v, videos[v]!)
      return out
    },
  }
  return { client, calls }
}

function setup(episodes: Row[], shorts: Row[] = []) {
  const fake = createFakeSupabase({ episodes, shorts })
  fake.registerRpc('record_youtube_checks', emulateRecordYouTubeChecks)
  fake.registerRpc('record_short_checks', emulateRecordShortChecks)
  return { fake, db: fake.client as AdminDb }
}

const rpcCalls = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.calls.filter((c) => c.op === 'rpc')

test('120 episodes (archived included): one read, 3 videos.list calls, one write of 120 rows', async () => {
  const eps = Array.from({ length: 120 }, (_, i) => episode(i + 1, { archived: i % 10 === 0 }))
  const { fake, db } = setup(eps)

  const fetchUrls: string[] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    fetchUrls.push(url.pathname)
    const ids = (url.searchParams.get('id') ?? '').split(',')
    return new Response(JSON.stringify({ items: ids.map((id) => okVideo(id)) }), { status: 200 })
  }) as typeof fetch
  const real = createYouTubeClient({ apiKey: FAKE_KEY, fetchImpl })
  const seen: string[][] = []
  const client: YouTubeClientLike = {
    ...real,
    getVideos: (ids) => {
      seen.push(ids)
      return real.getVideos(ids)
    },
  }

  const res = await recheckVideosCore(db, client, NOW)
  assert.deepEqual(res, { ok: true, checked: 120, notOk: 0, shortsChecked: 0, checkedAt: NOW.toISOString() })
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.length, 120)
  assert.equal(fetchUrls.length, 3)
  assert.ok(fetchUrls.every((p) => p.endsWith('/videos')))

  const rpcs = rpcCalls(fake)
  assert.equal(rpcs.length, 1)
  assert.equal(rpcs[0]!.table, 'record_youtube_checks')
  assert.equal(rpcs[0]!.patch.p_rows.length, 120)
  assert.equal(fake.calls.filter((c) => c.table === 'episodes' && c.op === 'select').length, 1)
  assert.equal(fake.calls.filter((c) => c.op === 'update' || c.op === 'insert' || c.op === 'delete').length, 0)
  // Archived rows were checked too.
  assert.ok(fake.tables.episodes!.filter((e) => e.archived).every((e) => e.youtube_status === 'ok'))
})

test('episodes with a null or empty video id are skipped', async () => {
  const { fake, db } = setup([
    episode(1),
    episode(2, { youtube_video_id: null }),
    episode(3, { youtube_video_id: '' }),
    episode(4),
  ])
  const yt = fakeYouTube({ [vid(1)]: okVideo(vid(1)), [vid(4)]: okVideo(vid(4)) })
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: true, checked: 2, notOk: 0, shortsChecked: 0, checkedAt: NOW.toISOString() })
  assert.deepEqual(yt.calls, [[vid(1), vid(4)]])
  const rows = rpcCalls(fake)[0]!.patch.p_rows as Row[]
  assert.deepEqual(rows.map((r) => r.id).sort(), [uuid(1), uuid(4)])
})

test('each row carries classifyVideo status and parseIsoDuration seconds (0 for PT0S)', async () => {
  const { fake, db } = setup([1, 2, 3, 4, 5, 6].map((n) => episode(n)))
  const yt = fakeYouTube({
    [vid(1)]: okVideo(vid(1), { contentDetails: { duration: 'P1DT1H2M3S' } }),
    [vid(2)]: okVideo(vid(2), {
      status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true },
    }),
    // vid(3) is absent from the response: removed.
    [vid(4)]: okVideo(vid(4), {
      status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false },
    }),
    [vid(5)]: okVideo(vid(5), {
      snippet: { liveBroadcastContent: 'upcoming' },
      contentDetails: { duration: 'PT0S' },
    }),
    [vid(6)]: okVideo(vid(6), {
      contentDetails: { duration: 'PT3M', regionRestriction: { blocked: ['AE'] } },
    }),
  })
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: true, checked: 6, notOk: 5, shortsChecked: 0, checkedAt: NOW.toISOString() })
  const rows = new Map(
    (rpcCalls(fake)[0]!.patch.p_rows as Row[]).map((r) => [r.id, r])
  )
  const pick = (r: Row | undefined) => r && { id: r.id, status: r.status, duration_seconds: r.duration_seconds }
  assert.deepEqual(pick(rows.get(uuid(1))), { id: uuid(1), status: 'ok', duration_seconds: 90123 })
  assert.deepEqual(pick(rows.get(uuid(2))), { id: uuid(2), status: 'private', duration_seconds: 1500 })
  assert.deepEqual(pick(rows.get(uuid(3))), { id: uuid(3), status: 'removed', duration_seconds: null })
  assert.deepEqual(pick(rows.get(uuid(4))), { id: uuid(4), status: 'not_embeddable', duration_seconds: 1500 })
  assert.deepEqual(pick(rows.get(uuid(5))), { id: uuid(5), status: 'not_ready', duration_seconds: 0 })
  assert.deepEqual(pick(rows.get(uuid(6))), { id: uuid(6), status: 'blocked_ae', duration_seconds: 180 })
  // The absent video carries no text, so no text can change.
  assert.deepEqual(rows.get(uuid(3)), {
    id: uuid(3),
    status: 'removed',
    duration_seconds: null,
    title: null,
    title_ar: null,
    description: null,
    description_ar: null,
  })
})

test('write rules on a first check: text kept (baseline), admin duration kept, derived duration follows, errors cleared only on ok', async () => {
  const reported = '2026-10-19T10:00:00.000Z'
  const { fake, db } = setup([
    // Derived duration (25 min from 1500 s): follows the new length.
    episode(1, { youtube_duration_seconds: 1500, duration: 25 }),
    // Admin edited the minutes (40, not 25): kept.
    episode(2, { youtube_duration_seconds: 1500, duration: 40 }),
    // Never checked (no stored seconds): minutes kept, seconds set.
    episode(3, { youtube_duration_seconds: null, duration: 12 }),
    // Viewer report, video fine now: report cleared.
    episode(4, { player_error_code: 150, player_error_at: reported }),
    // Viewer report, video private: report kept.
    episode(5, { player_error_code: 100, player_error_at: reported }),
    // Good length stored, video back as PT0S not_ready: length kept.
    episode(6, { youtube_duration_seconds: 1500, duration: 25 }),
  ])
  const before = structuredClone(fake.tables.episodes!)
  const yt = fakeYouTube({
    [vid(1)]: okVideo(vid(1), { contentDetails: { duration: 'PT30M' } }),
    [vid(2)]: okVideo(vid(2), { contentDetails: { duration: 'PT30M' } }),
    [vid(3)]: okVideo(vid(3), { contentDetails: { duration: 'PT10M' } }),
    [vid(4)]: okVideo(vid(4)),
    [vid(5)]: okVideo(vid(5), {
      status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true },
    }),
    [vid(6)]: okVideo(vid(6), {
      snippet: { liveBroadcastContent: 'upcoming' },
      contentDetails: { duration: 'PT0S' },
    }),
  })
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.equal(res.ok, true)

  const after = new Map(fake.tables.episodes!.map((e) => [e.id, e]))
  for (const b of before) {
    const a = after.get(b.id)!
    for (const col of ['title', 'title_ar', 'description', 'description_ar', 'status', 'archived'])
      assert.equal(a[col], b[col], `${col} unchanged on ${b.id}`)
    assert.ok(a.youtube_checked_at, 'checked-at set')
  }
  assert.equal(after.get(uuid(1))!.duration, 30)
  assert.equal(after.get(uuid(1))!.youtube_duration_seconds, 1800)
  assert.equal(after.get(uuid(2))!.duration, 40)
  assert.equal(after.get(uuid(2))!.youtube_duration_seconds, 1800)
  assert.equal(after.get(uuid(3))!.duration, 12)
  assert.equal(after.get(uuid(3))!.youtube_duration_seconds, 600)
  assert.equal(after.get(uuid(4))!.player_error_code, null)
  assert.equal(after.get(uuid(4))!.player_error_at, null)
  assert.equal(after.get(uuid(5))!.player_error_code, 100)
  assert.equal(after.get(uuid(5))!.player_error_at, reported)
  assert.equal(after.get(uuid(5))!.youtube_status, 'private')
  assert.equal(after.get(uuid(6))!.youtube_status, 'not_ready')
  assert.equal(after.get(uuid(6))!.youtube_duration_seconds, 1500)
  assert.equal(after.get(uuid(6))!.duration, 25)
})

test('quota error: returns quota and writes nothing', async () => {
  const { fake, db } = setup([episode(1)])
  const before = fake.snapshot()
  const yt = fakeYouTube({}, new YouTubeApiError('quota', 403, 'quotaExceeded'))
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'quota' })
  assert.equal(rpcCalls(fake).length, 0)
  assert.deepEqual(fake.snapshot(), before)
})

test('key and API errors pass through as reasons; any other throw is network', async () => {
  for (const code of ['key_rejected', 'api_not_allowed', 'network'] as const) {
    const { fake, db } = setup([episode(1)])
    const res = await recheckVideosCore(db, fakeYouTube({}, new YouTubeApiError(code, 403, null)).client, NOW)
    assert.deepEqual(res, { ok: false, reason: code })
    assert.equal(rpcCalls(fake).length, 0)
  }
  const { fake, db } = setup([episode(1)])
  const res = await recheckVideosCore(db, fakeYouTube({}, new Error(`boom ${FAKE_KEY}`)).client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'network' })
  assert.ok(!JSON.stringify(res).includes('AIza'))
  assert.equal(rpcCalls(fake).length, 0)
})

test('zero episodes: ok with checked 0, no YouTube call, no write', async () => {
  const { fake, db } = setup([episode(1, { youtube_video_id: null })])
  const yt = fakeYouTube({})
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: true, checked: 0, notOk: 0, shortsChecked: 0, checkedAt: NOW.toISOString() })
  assert.equal(yt.calls.length, 0)
  assert.equal(rpcCalls(fake).length, 0)
})

test('rpc error: write_failed with the database message for the caller to log, never the key', async () => {
  const { fake, db } = setup([episode(1)])
  fake.failOn({ rpc: 'record_youtube_checks', nth: 1 })
  const res = await recheckVideosCore(db, fakeYouTube({ [vid(1)]: okVideo(vid(1)) }).client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'write_failed', detail: 'forced failure' })
  assert.ok(!JSON.stringify(res).includes('AIza'))
})

test('rpc throw: write_failed', async () => {
  const { fake, db } = setup([episode(1)])
  fake.throwOn({ rpc: 'record_youtube_checks', nth: 1 })
  const res = await recheckVideosCore(db, fakeYouTube({ [vid(1)]: okVideo(vid(1)) }).client, NOW)
  assert.equal(res.ok, false)
  assert.equal(!res.ok && res.reason, 'write_failed')
})

test('2,345 episodes: the read is paged in id order and every one is checked and written', async () => {
  const eps = Array.from({ length: 2345 }, (_, i) => episode(i + 1))
  const { fake, db } = setup(eps)
  const videos = Object.fromEntries(eps.map((e) => [e.youtube_video_id as string, okVideo(e.youtube_video_id as string)]))
  const yt = fakeYouTube(videos)
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: true, checked: 2345, notOk: 0, shortsChecked: 0, checkedAt: NOW.toISOString() })
  assert.equal(fake.calls.filter((c) => c.table === 'episodes' && c.op === 'select').length, 3)
  assert.equal(yt.calls[0]!.length, 2345)
  const rpcs = rpcCalls(fake)
  assert.equal(rpcs.length, 1)
  assert.equal(new Set(rpcs[0]!.patch.p_rows.map((r: { id: string }) => r.id)).size, 2345)
})

test('a failed second page: read_failed, no YouTube call, no write', async () => {
  const { fake, db } = setup(Array.from({ length: 1500 }, (_, i) => episode(i + 1)))
  fake.failOn({ table: 'episodes', op: 'select', nth: 2 })
  const yt = fakeYouTube({})
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'read_failed', detail: 'forced failure' })
  assert.equal(yt.calls.length, 0)
  assert.equal(rpcCalls(fake).length, 0)
})

test('read error: read_failed, no YouTube call, no write', async () => {
  const { fake, db } = setup([episode(1)])
  fake.failOn({ table: 'episodes', op: 'select', nth: 1 })
  const yt = fakeYouTube({})
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'read_failed', detail: 'forced failure' })
  assert.equal(yt.calls.length, 0)
  assert.equal(rpcCalls(fake).length, 0)
})

// ---------------------------------------------------------------------------
// Refresh unless edited (PR #27 review item 7, Koss 2026-10-20)
// ---------------------------------------------------------------------------

const CHECKED = '2026-10-19T01:30:00.000Z'
const TEXT = ['title', 'title_ar', 'description', 'description_ar'] as const

/** An episode the check has seen before (no baseline step). */
const seen = (n: number, over: Row = {}) =>
  episode(n, { youtube_checked_at: CHECKED, youtube_text_baseline_at: CHECKED, ...over })

function short(n: number, over: Row = {}): Row {
  return {
    id: `55555555-0000-4000-8000-${String(n).padStart(12, '0')}`,
    youtube_video_id: `sht${String(n).padStart(8, '0')}`,
    title: `Short ${n}`,
    channel_name: 'Old channel',
    thumbnail_url: 'https://i.ytimg.com/vi/old/hqdefault.jpg',
    archived: false,
    youtube_checked_at: CHECKED,
    ...over,
  }
}

function shortVideo(id: string, over: Partial<NonNullable<YouTubeVideoResource['snippet']>> = {}) {
  return okVideo(id, {
    snippet: {
      title: 'New short title',
      description: '',
      liveBroadcastContent: 'none',
      thumbnails: {
        high: { url: 'https://i.ytimg.com/vi/new/hqdefault.jpg' },
        maxres: { url: 'https://i.ytimg.com/vi/new/maxresdefault.jpg' },
      },
      ...over,
      // channelTitle is read through the verify core's narrow type.
      ...({ channelTitle: 'New channel' } as object),
    },
  })
}

const epById = (fake: ReturnType<typeof createFakeSupabase>, id: string) =>
  fake.tables.episodes!.find((e) => e.id === id)!
const shortById = (fake: ReturnType<typeof createFakeSupabase>, id: string) =>
  fake.tables.shorts!.find((s) => s.id === id)!

test('episodes: each unedited field is refreshed from YouTube, each edited field is kept', async () => {
  // Episode 1: nothing edited. Episodes 2..5: exactly one field edited.
  const eps = [seen(1), ...TEXT.map((f, i) => seen(i + 2, { [`${f}_edited`]: true }))]
  const { fake, db } = setup(eps)
  const videos: Record<string, YouTubeVideoResource> = {}
  for (const e of eps) {
    videos[e.youtube_video_id] = okVideo(e.youtube_video_id, {
      snippet: { title: '  Fresh title  ', description: 'Fresh text', liveBroadcastContent: 'none' },
    })
  }
  const res = await recheckVideosCore(db, fakeYouTube(videos).client, NOW)
  assert.equal(res.ok, true)

  const one = epById(fake, uuid(1))
  assert.equal(one.title, 'Fresh title')
  assert.equal(one.description, 'Fresh text')
  // English YouTube text has no Arabic part: the stored Arabic is kept, never emptied.
  assert.equal(one.title_ar, 'حلقة 1')
  assert.equal(one.description_ar, 'عن الحلقة 1')
  for (const f of TEXT) assert.equal(one[`${f}_edited`], false, `${f} flag stays false`)

  const kept: Record<(typeof TEXT)[number], string> = {
    title: 'Episode 2',
    title_ar: 'حلقة 3',
    description: 'About episode 4',
    description_ar: 'عن الحلقة 5',
  }
  TEXT.forEach((f, i) => {
    const e = epById(fake, uuid(i + 2))
    assert.equal(e[f], kept[f], `edited ${f} kept`)
    assert.equal(e[`${f}_edited`], true)
    // The other English fields still follow YouTube.
    if (f !== 'title') assert.equal(e.title, 'Fresh title')
    if (f !== 'description') assert.equal(e.description, 'Fresh text')
  })

  // Every Arabic field is also refreshed when YouTube's text is Arabic.
  const ar = setup([seen(1)])
  await recheckVideosCore(
    ar.db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), {
        snippet: { title: 'عنوان جديد', description: 'وصف جديد', liveBroadcastContent: 'none' },
      }),
    }).client,
    NOW
  )
  const a = epById(ar.fake, uuid(1))
  assert.equal(a.title_ar, 'عنوان جديد')
  assert.equal(a.description_ar, 'وصف جديد')
  // An Arabic description routes to description_ar only: the English one is kept.
  assert.equal(a.description, 'About episode 1')
})

test('script routing on refresh matches the import; the Arabic mirror lands in title only while title is unedited', async () => {
  const { buildImportPlan } = await import('../../src/server/youtube/plan.ts')
  const arabic = okVideo(vid(1), {
    snippet: { title: 'الحلقة الأولى', description: 'نص عربي', liveBroadcastContent: 'none' },
  })
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 0, item: arabic }],
    startNumber: 0,
    showDefaults: { description: 'Show default', description_ar: null },
    now: NOW,
  }).rows[0]!

  const { fake, db } = setup([seen(1), seen(2, { youtube_video_id: vid(1).replace('vid', 'vie'), title: 'English name', title_edited: true })])
  const videos = { [vid(1)]: arabic, [vid(1).replace('vid', 'vie')]: { ...arabic, id: vid(1).replace('vid', 'vie') } }
  const res = await recheckVideosCore(db, fakeYouTube(videos).client, NOW)
  assert.equal(res.ok, true)

  const sent = rpcCalls(fake)[0]!.patch.p_rows.find((r: Row) => r.id === uuid(1))
  assert.equal(sent.title, plan.title)
  assert.equal(sent.title_ar, plan.title_ar)
  assert.equal(sent.description_ar, plan.description_ar)
  // The import puts '' (then the show default) in the English description; the check sends none.
  assert.equal(plan.description, 'Show default')
  assert.equal(sent.description, null)

  // Unedited title: the Arabic text is mirrored in, so "Needs English title" shows.
  const unedited = epById(fake, uuid(1))
  assert.equal(unedited.title, 'الحلقة الأولى')
  assert.equal(unedited.title_ar, 'الحلقة الأولى')
  assert.equal(unedited.description, 'About episode 1')
  // Edited English title: kept; only the Arabic title follows YouTube.
  const edited = epById(fake, uuid(2))
  assert.equal(edited.title, 'English name')
  assert.equal(edited.title_ar, 'الحلقة الأولى')
})

test('a video missing from the YouTube response changes no text', async () => {
  const { fake, db } = setup([seen(1), episode(2)], [short(1)])
  const before = structuredClone(fake.tables)
  const res = await recheckVideosCore(db, fakeYouTube({}).client, NOW)
  assert.deepEqual(res, { ok: true, checked: 2, notOk: 2, shortsChecked: 0, checkedAt: NOW.toISOString() })
  for (const b of before.episodes!) {
    const a = epById(fake, b.id)
    for (const f of TEXT) assert.equal(a[f], b[f], `${f} unchanged`)
    assert.equal(a.youtube_status, 'removed')
  }
  // No row is sent for the short, so nothing about it changes.
  assert.equal(rpcCalls(fake).filter((c) => c.table === 'record_short_checks').length, 0)
  assert.deepEqual(fake.tables.shorts, before.shorts)
})

test('empty YouTube text never empties a stored field or the required English title', async () => {
  const { fake, db } = setup([seen(1)])
  const res = await recheckVideosCore(
    db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), { snippet: { title: '   ', description: '', liveBroadcastContent: 'none' } }),
    }).client,
    NOW
  )
  assert.equal(res.ok, true)
  const e = epById(fake, uuid(1))
  assert.equal(e.title, 'Episode 1')
  assert.equal(e.description, 'About episode 1')
  assert.equal(e.title_ar, 'حلقة 1')
  assert.equal(e.description_ar, 'عن الحلقة 1')
})

test('first check (never checked): no text is written; fields that differ from YouTube are marked edited', async () => {
  const { fake, db } = setup([
    // Same as YouTube: stays unedited, so later checks refresh it.
    episode(1, { title: 'YouTube title', description: 'YouTube text', title_ar: null, description_ar: null }),
    // Typed before the flags existed: protected from now on.
    episode(2),
  ])
  const videos = { [vid(1)]: okVideo(vid(1)), [vid(2)]: okVideo(vid(2)) }
  await recheckVideosCore(db, fakeYouTube(videos).client, NOW)
  const one = epById(fake, uuid(1))
  for (const f of TEXT) assert.equal(one[`${f}_edited`], false, `${f} matches YouTube`)
  assert.ok(one.youtube_text_baseline_at, 'baseline done')
  const two = epById(fake, uuid(2))
  assert.equal(two.title, 'Episode 2')
  assert.equal(two.title_edited, true, 'title differs from YouTube')
  assert.equal(two.description_edited, true, 'description differs from YouTube')
  // English YouTube text has no Arabic part: empty YouTube text sets no flag.
  assert.equal(two.title_ar_edited, false)
  assert.equal(two.description_ar_edited, false)
  assert.equal(two.title_ar, 'حلقة 2')
  assert.equal(two.description_ar, 'عن الحلقة 2')

  // Second run: the matching row now follows YouTube, the typed one is kept.
  videos[vid(1)] = okVideo(vid(1), { snippet: { title: 'Renamed on YouTube', description: 'YouTube text' } })
  videos[vid(2)] = okVideo(vid(2), { snippet: { title: 'Renamed on YouTube', description: 'YouTube text' } })
  await recheckVideosCore(db, fakeYouTube(videos).client, NOW)
  assert.equal(epById(fake, uuid(1)).title, 'Renamed on YouTube')
  assert.equal(epById(fake, uuid(2)).title, 'Episode 2')
})

// PR #27 re-review, note 1: the baseline never sticks a flag on missing or
// empty YouTube text, and it waits until YouTube returns the video.

test('baseline: a video missing at the first check sets no flag and leaves the baseline pending', async () => {
  const { fake, db } = setup([episode(1)])
  const res = await recheckVideosCore(db, fakeYouTube({}).client, NOW)
  assert.equal(res.ok, true)
  const e = epById(fake, uuid(1))
  assert.equal(e.youtube_status, 'removed')
  assert.ok(e.youtube_checked_at, 'checked-at set')
  assert.equal(e.youtube_text_baseline_at, null, 'baseline still pending')
  for (const f of TEXT) assert.equal(e[`${f}_edited`], false, `${f} flag not set`)
  assert.equal(e.title, 'Episode 1')

  // Later run: YouTube returns the video, so the baseline runs then.
  await recheckVideosCore(
    db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), {
        snippet: { title: 'Episode 1', description: 'Different on YouTube', liveBroadcastContent: 'none' },
      }),
    }).client,
    NOW
  )
  const later = epById(fake, uuid(1))
  assert.equal(later.youtube_status, 'ok')
  assert.ok(later.youtube_text_baseline_at, 'baseline done')
  assert.equal(later.title_edited, false, 'same title as YouTube')
  assert.equal(later.description_edited, true, 'stored description differs')
  assert.equal(later.description, 'About episode 1', 'baseline run writes no text')
  assert.equal(later.title_ar_edited, false)
  assert.equal(later.description_ar_edited, false)

  // Third run: unedited fields follow YouTube, the flagged one is kept.
  await recheckVideosCore(
    db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), {
        snippet: { title: 'Renamed', description: 'Newer on YouTube', liveBroadcastContent: 'none' },
      }),
    }).client,
    NOW
  )
  assert.equal(epById(fake, uuid(1)).title, 'Renamed')
  assert.equal(epById(fake, uuid(1)).description, 'About episode 1')
})

test('baseline: a private video at the first check keeps the baseline pending', async () => {
  const { fake, db } = setup([episode(1)])
  await recheckVideosCore(
    db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), {
        status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true },
      }),
    }).client,
    NOW
  )
  const e = epById(fake, uuid(1))
  assert.equal(e.youtube_status, 'private')
  assert.ok(e.youtube_checked_at)
  assert.equal(e.youtube_text_baseline_at, null)
  for (const f of TEXT) assert.equal(e[f], episode(1)[f], `${f} unchanged`)
})

test('baseline: an empty YouTube description sets no flag; non-empty different text does', async () => {
  const { fake, db } = setup([episode(1)])
  await recheckVideosCore(
    db,
    fakeYouTube({
      [vid(1)]: okVideo(vid(1), { snippet: { title: 'Other title', description: '  ', liveBroadcastContent: 'none' } }),
    }).client,
    NOW
  )
  const e = epById(fake, uuid(1))
  assert.ok(e.youtube_text_baseline_at)
  assert.equal(e.description_edited, false, 'empty YouTube description: no flag')
  assert.equal(e.description, 'About episode 1', 'and the stored text is kept')
  assert.equal(e.title_edited, true, 'non-empty different title: flag')
  assert.equal(e.title, 'Episode 1')
})

test('baseline: the emulator rule matches the SQL for every stored/YouTube pair', async () => {
  const { applyRefreshUnlessEdited } = await import('./helpers/record-youtube-checks-emulator.ts')
  const cases: Array<[unknown, unknown, boolean]> = [
    ['Stored', 'YouTube', true],
    ['Stored', '  Stored ', false],
    ['Stored', '', false],
    ['Stored', null, false],
    ['Stored', '   ', false],
    [null, 'YouTube', true],
    ['', 'YouTube', true],
    [null, null, false],
    ['', '  ', false],
  ]
  for (const [stored, yt, flag] of cases) {
    const target: Row = { title: stored, title_edited: false }
    applyRefreshUnlessEdited(target, { ...target }, { title: yt }, 'title', true)
    assert.equal(target.title_edited, flag, `${String(stored)} / ${String(yt)}`)
    assert.equal(target.title, stored, 'baseline writes no text')
  }
})

test('shorts: unedited title and channel refreshed, edited ones kept, thumbnail always refreshed (https only)', async () => {
  const shorts = [
    short(1),
    short(2, { title_edited: true }),
    short(3, { channel_name_edited: true }),
  ]
  const { fake, db } = setup([], shorts)
  const videos = Object.fromEntries(shorts.map((s) => [s.youtube_video_id, shortVideo(s.youtube_video_id)]))
  const res = await recheckVideosCore(db, fakeYouTube(videos).client, NOW)
  assert.deepEqual(res, { ok: true, checked: 0, notOk: 0, shortsChecked: 3, checkedAt: NOW.toISOString() })
  assert.equal(rpcCalls(fake).filter((c) => c.table === 'record_youtube_checks').length, 0)

  const s1 = shortById(fake, shorts[0]!.id)
  assert.equal(s1.title, 'New short title')
  assert.equal(s1.channel_name, 'New channel')
  const s2 = shortById(fake, shorts[1]!.id)
  assert.equal(s2.title, 'Short 2')
  assert.equal(s2.channel_name, 'New channel')
  const s3 = shortById(fake, shorts[2]!.id)
  assert.equal(s3.title, 'New short title')
  assert.equal(s3.channel_name, 'Old channel')
  // Same thumbnail choice as the shorts form's Fetch (maxres first).
  for (const s of [s1, s2, s3]) assert.equal(s.thumbnail_url, 'https://i.ytimg.com/vi/new/maxresdefault.jpg')

  // A non-https thumbnail is never sent.
  const plain = setup([], [short(9)])
  await recheckVideosCore(
    plain.db,
    fakeYouTube({
      [short(9).youtube_video_id]: shortVideo(short(9).youtube_video_id, {
        thumbnails: { high: { url: 'http://example.com/x.jpg' } },
      }),
    }).client,
    NOW
  )
  assert.equal(shortById(plain.fake, short(9).id).thumbnail_url, 'https://i.ytimg.com/vi/old/hqdefault.jpg')
})

test('shorts first check: no title or channel written; a differing title is marked edited', async () => {
  const s = short(1, { youtube_checked_at: null, channel_name: 'New channel' })
  const { fake, db } = setup([], [s])
  await recheckVideosCore(db, fakeYouTube({ [s.youtube_video_id]: shortVideo(s.youtube_video_id) }).client, NOW)
  const after = shortById(fake, s.id)
  assert.equal(after.title, 'Short 1')
  assert.equal(after.title_edited, true)
  assert.equal(after.channel_name_edited, false)
  assert.ok(after.youtube_checked_at)
})

test('shorts first check: an empty YouTube channel name sets no flag', async () => {
  const s = short(1, { youtube_checked_at: null, title: 'New short title' })
  const { fake, db } = setup([], [s])
  const video = shortVideo(s.youtube_video_id)
  ;(video.snippet as Record<string, unknown>).channelTitle = '  '
  await recheckVideosCore(db, fakeYouTube({ [s.youtube_video_id]: video }).client, NOW)
  const after = shortById(fake, s.id)
  assert.equal(after.channel_name, 'Old channel')
  assert.equal(after.channel_name_edited, false)
  assert.equal(after.title_edited, false)
  assert.ok(after.youtube_checked_at)
})

test('episodes and shorts share one getVideos call with deduped ids (batches of 50 in the client)', async () => {
  const eps = Array.from({ length: 40 }, (_, i) => seen(i + 1))
  const shorts = [
    ...Array.from({ length: 30 }, (_, i) => short(i + 1)),
    // A short on an episode's video: asked once.
    short(99, { youtube_video_id: vid(1) }),
  ]
  const { fake, db } = setup(eps, shorts)
  const fetchIds: string[][] = []
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const ids = (url.searchParams.get('id') ?? '').split(',')
    fetchIds.push(ids)
    return new Response(JSON.stringify({ items: ids.map((id) => okVideo(id)) }), { status: 200 })
  }) as typeof fetch
  const client = createYouTubeClient({ apiKey: FAKE_KEY, fetchImpl })
  const res = await recheckVideosCore(db, client, NOW)
  assert.deepEqual(res, { ok: true, checked: 40, notOk: 0, shortsChecked: 31, checkedAt: NOW.toISOString() })
  assert.equal(fetchIds.length, 2)
  assert.ok(fetchIds.every((ids) => ids.length <= 50))
  assert.equal(new Set(fetchIds.flat()).size, 70)
  assert.equal(fetchIds.flat().length, 70)
  const names = rpcCalls(fake).map((c) => c.table)
  assert.deepEqual(names, ['record_youtube_checks', 'record_short_checks'])
})

test('shorts read error: read_failed, no YouTube call, no write', async () => {
  const { fake, db } = setup([seen(1)], [short(1)])
  fake.failOn({ table: 'shorts', op: 'select', nth: 1 })
  const yt = fakeYouTube({})
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'read_failed', detail: 'forced failure' })
  assert.equal(yt.calls.length, 0)
  assert.equal(rpcCalls(fake).length, 0)
})

test('record_short_checks error: write_failed with the database message', async () => {
  const { fake, db } = setup([seen(1)], [short(1)])
  fake.failOn({ rpc: 'record_short_checks', nth: 1 })
  const s = short(1).youtube_video_id
  const res = await recheckVideosCore(
    db,
    fakeYouTube({ [vid(1)]: okVideo(vid(1)), [s]: shortVideo(s) }).client,
    NOW
  )
  assert.deepEqual(res, { ok: false, reason: 'write_failed', detail: 'forced failure' })
})

test('source guard: the core writes text only through the two check functions, never a table directly', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync('src/lib/admin/youtube-check.ts', 'utf8')
  const code = src.replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /\.(update|insert|upsert|delete)\(/)
  const rpcNames = [...code.matchAll(/'(record_\w+)'/g)].map((m) => m[1])
  assert.deepEqual([...new Set(rpcNames)].sort(), ['record_short_checks', 'record_youtube_checks'])
  // Episode text is routed by the import's own function (no copy of the rules).
  assert.match(code, /import \{ episodeTextFromYouTube, shortTextFromYouTube \} from '\.\/youtube-text-edits\.ts'/)
  const helper = readFileSync('src/lib/admin/youtube-text-edits.ts', 'utf8')
  assert.match(helper, /import \{ routeYouTubeText \} from '\.\.\/\.\.\/server\/youtube\/script\.ts'/)
  assert.doesNotMatch(code, /dominantScript|containsArabicScript/)
})
