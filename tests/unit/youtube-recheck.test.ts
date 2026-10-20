// Daily re-check core (D-17, RESEARCH Pattern 11): one read, ceil(n/50)
// videos.list calls, one record_youtube_checks write. Fake fetch and a fake
// client only; no live call, no key.
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

function setup(episodes: Row[]) {
  const fake = createFakeSupabase({ episodes })
  fake.registerRpc('record_youtube_checks', emulateRecordYouTubeChecks)
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
  assert.deepEqual(res, { ok: true, checked: 120, notOk: 0 })
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
  assert.deepEqual(res, { ok: true, checked: 2, notOk: 0 })
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
  assert.deepEqual(res, { ok: true, checked: 6, notOk: 5 })
  const rows = new Map(
    (rpcCalls(fake)[0]!.patch.p_rows as Row[]).map((r) => [r.id, r])
  )
  assert.deepEqual(rows.get(uuid(1)), { id: uuid(1), status: 'ok', duration_seconds: 90123 })
  assert.deepEqual(rows.get(uuid(2)), { id: uuid(2), status: 'private', duration_seconds: 1500 })
  assert.deepEqual(rows.get(uuid(3)), { id: uuid(3), status: 'removed', duration_seconds: null })
  assert.deepEqual(rows.get(uuid(4)), { id: uuid(4), status: 'not_embeddable', duration_seconds: 1500 })
  assert.deepEqual(rows.get(uuid(5)), { id: uuid(5), status: 'not_ready', duration_seconds: 0 })
  assert.deepEqual(rows.get(uuid(6)), { id: uuid(6), status: 'blocked_ae', duration_seconds: 180 })
})

test('write rules: text kept, admin duration kept, derived duration follows, errors cleared only on ok', async () => {
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
  assert.deepEqual(res, { ok: true, checked: 0, notOk: 0 })
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

test('read error: read_failed, no YouTube call, no write', async () => {
  const { fake, db } = setup([episode(1)])
  fake.failOn({ table: 'episodes', op: 'select', nth: 1 })
  const yt = fakeYouTube({})
  const res = await recheckVideosCore(db, yt.client, NOW)
  assert.deepEqual(res, { ok: false, reason: 'read_failed', detail: 'forced failure' })
  assert.equal(yt.calls.length, 0)
  assert.equal(rpcCalls(fake).length, 0)
})
