// Playlist preview (read-only) and import commit (server re-fetch, one insert,
// compensation, audit). A hand-written fake YouTube client stands in for the
// API: no live call, no key.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  IMPORT_MAX_ITEMS,
  commitImportCore,
  previewPlaylistPageCore,
} from '../../src/lib/admin/youtube-import.ts'
import {
  YouTubeApiError,
  type YouTubeClientLike,
  type YouTubePlaylistItem,
  type YouTubeVideoResource,
} from '../../src/server/youtube/client.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) => `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const S2 = id('b')
const SE1 = id('c')
const SE2 = id('d')
const NOW = new Date('2026-10-20T12:00:00.000Z')
const PLAYLIST = 'PLseason2abc'
const URL0 = `https://www.youtube.com/playlist?list=${PLAYLIST}`

// 11-character video ids
const OK1 = 'okVideo0001'
const OK2 = 'okVideo0002'
const OK3 = 'okVideo0003'
const AR1 = 'arabicVid01'
const PRIV = 'privVid0001'
const GONE = 'removedVid1'
const PREM = 'premiere001'
const NOEMB = 'noEmbed0001'
const ON_CLICKIT = 'onClickit01'

function video(vid: string, over: Partial<YouTubeVideoResource> & { title?: string } = {}): YouTubeVideoResource {
  const { title, ...rest } = over
  return {
    id: vid,
    snippet: {
      title: title ?? `Video ${vid}`,
      description: `About ${vid}`,
      liveBroadcastContent: 'none',
      thumbnails: {
        default: { url: `https://i.ytimg.com/vi/${vid}/default.jpg` },
        medium: { url: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` },
        high: { url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` },
      },
    },
    contentDetails: { duration: 'PT12M' },
    status: { privacyStatus: 'unlisted', uploadStatus: 'processed', embeddable: true },
    ...rest,
  }
}

function catalog(): Record<string, YouTubeVideoResource> {
  return {
    [OK1]: video(OK1),
    [OK2]: video(OK2, { status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true } }),
    [OK3]: video(OK3),
    [AR1]: video(AR1, { title: 'الحلقة الأولى' }),
    [PRIV]: video(PRIV, { status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true } }),
    [PREM]: video(PREM, {
      snippet: { title: 'Premiere', description: '', liveBroadcastContent: 'upcoming' },
      contentDetails: { duration: 'P0D' },
      liveStreamingDetails: { scheduledStartTime: '2026-11-01T18:00:00Z' },
    }),
    [NOEMB]: video(NOEMB, { status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false } }),
    [ON_CLICKIT]: video(ON_CLICKIT),
    // GONE is absent: videos.list leaves it out
  }
}

type Call = [string, ...unknown[]]

function fakeYouTube(opts: {
  pages?: YouTubePlaylistItem[][]
  videos?: Record<string, YouTubeVideoResource>
  fail?: { method: 'getPlaylist' | 'listPlaylistItemsPage' | 'getVideos'; error: Error }
} = {}) {
  const calls: Call[] = []
  const videos = opts.videos ?? catalog()
  const pages = opts.pages ?? [
    [OK1, OK2, AR1, PRIV, GONE, PREM, NOEMB, ON_CLICKIT].map((v, i) => ({ videoId: v, position: i })),
  ]
  const maybeFail = (method: string) => {
    if (opts.fail?.method === method) throw opts.fail.error
  }
  const client: YouTubeClientLike = {
    async getPlaylist(pid) {
      calls.push(['getPlaylist', pid])
      maybeFail('getPlaylist')
      return { id: pid, title: 'Season 2 on YouTube', privacyStatus: 'unlisted', itemCount: pages.flat().length }
    },
    async listPlaylistItemsPage(pid, token) {
      calls.push(['listPlaylistItemsPage', pid, token])
      maybeFail('listPlaylistItemsPage')
      const n = token ? Number(token.slice(1)) : 0
      return {
        items: pages[n] ?? [],
        nextPageToken: n + 1 < pages.length ? `p${n + 1}` : null,
        totalResults: pages.flat().length,
      }
    },
    async getVideos(ids) {
      calls.push(['getVideos', ids])
      maybeFail('getVideos')
      const out = new Map<string, YouTubeVideoResource>()
      for (const v of ids) if (videos[v]) out.set(v, structuredClone(videos[v]))
      return out
    },
  }
  return { client, calls, videos }
}

const ep = (eid: string, num: number, over: Row = {}): Row => ({
  id: eid,
  show_id: S1,
  season_id: SE1,
  title: `Episode ${num}`,
  title_ar: null,
  description: `Description ${num}`,
  description_ar: null,
  episode_number: num,
  youtube_video_id: null,
  duration: 10,
  status: 'published',
  publish_at: null,
  archived: false,
  ...over,
})

// Counts are consistent with recompute (seasons all, episodes non-archived).
function world() {
  return createFakeSupabase({
    shows: [
      { id: S1, title: 'Show 1', description: 'Show one description', description_ar: 'وصف', season_count: 1, episode_count: 3 },
      { id: S2, title: 'Other show', description: 'Other', description_ar: null, season_count: 1, episode_count: 0 },
    ],
    seasons: [
      { id: SE1, show_id: S1, title: 'Season 1', title_ar: null, season_number: 1, episode_count: 3 },
      { id: SE2, show_id: S2, title: 'Other S2', title_ar: null, season_number: 2, episode_count: 0 },
    ],
    episodes: [
      ep(id('e', 1), 1),
      ep(id('e', 2), 2),
      ep(id('e', 3), 3),
      ep(id('e', 4), 4, { archived: true }),
      // Archived episode on another show holds ON_CLICKIT
      ep(id('e', 5), 7, { show_id: S2, season_id: SE2, archived: true, youtube_video_id: ON_CLICKIT }),
    ],
  })
}

const deps = (f: ReturnType<typeof world>, yt: YouTubeClientLike | null) => ({
  audit: f.auditWriter,
  adminUserId: 'admin-1',
  youtube: yt,
  now: NOW,
})

const writes = (f: ReturnType<typeof world>) =>
  f.calls.filter((c) => c.op !== 'select')
const noAudit = (f: ReturnType<typeof world>) => f.snapshot({ exclude: ['admin_audit_log'] })
const episodesOf = (f: ReturnType<typeof world>, seasonId: string) =>
  f.snapshot().episodes!.filter((e) => e.season_id === seasonId)

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

test('IMPORT_MAX_ITEMS is 200', () => assert.equal(IMPORT_MAX_ITEMS, 200))

test('preview page 0: playlist, rows in order, statuses, and nothing written', async () => {
  const f = world()
  const yt = fakeYouTube()
  const res = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url: URL0, page: 0 })
  assert.equal(res.success, true)
  const page = res.data!
  assert.deepEqual(page.playlist, { id: PLAYLIST, title: 'Season 2 on YouTube', privacyStatus: 'unlisted', itemCount: 8 })
  assert.equal(page.page, 0)
  assert.equal(page.nextPageToken, null)
  assert.equal(page.capped, false)
  assert.deepEqual(
    page.rows.map((r) => [r.videoId, r.position, r.status]),
    [
      [OK1, 1, 'ok'],
      [OK2, 2, 'ok'],
      [AR1, 3, 'ok'],
      [PRIV, 4, 'private'],
      [GONE, 5, 'removed'],
      [PREM, 6, 'not_ready'],
      [NOEMB, 7, 'not_embeddable'],
      [ON_CLICKIT, 8, 'already'],
    ]
  )
  assert.deepEqual(writes(f), [])
  assert.equal(f.calls.some((c) => c.op === 'rpc'), false)
  assert.deepEqual(yt.calls.map((c) => c[0]), ['getPlaylist', 'listPlaylistItemsPage', 'getVideos'])
})

test('preview row fields: thumbnail medium first, length, privacy, Arabic flag, premiere time', async () => {
  const f = world()
  const videos = catalog()
  delete videos[OK2]!.snippet!.thumbnails!.medium
  delete videos[OK3]!.snippet!.thumbnails!.medium
  delete videos[OK3]!.snippet!.thumbnails!.high
  const yt = fakeYouTube({
    videos,
    pages: [[OK1, OK2, OK3, AR1, PREM, GONE].map((v, i) => ({ videoId: v, position: i }))],
  })
  const res = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url: URL0, page: 0 })
  const rows = new Map(res.data!.rows.map((r) => [r.videoId, r]))
  assert.equal(rows.get(OK1)!.thumbnailUrl, `https://i.ytimg.com/vi/${OK1}/mqdefault.jpg`)
  assert.equal(rows.get(OK2)!.thumbnailUrl, `https://i.ytimg.com/vi/${OK2}/hqdefault.jpg`)
  assert.equal(rows.get(OK3)!.thumbnailUrl, `https://i.ytimg.com/vi/${OK3}/default.jpg`)
  assert.equal(rows.get(OK1)!.durationSeconds, 720)
  assert.equal(rows.get(OK1)!.privacy, 'unlisted')
  assert.equal(rows.get(OK2)!.privacy, 'public')
  assert.equal(rows.get(OK1)!.arabicTitle, false)
  assert.equal(rows.get(AR1)!.arabicTitle, true)
  assert.equal(rows.get(AR1)!.title, 'الحلقة الأولى')
  assert.equal(rows.get(PREM)!.premieresAt, '2026-11-01T18:00:00Z')
  assert.equal(rows.get(OK1)!.premieresAt, undefined)
  assert.equal(rows.get(GONE)!.thumbnailUrl, null)
  assert.equal(rows.get(GONE)!.privacy, null)
  assert.equal(rows.get(GONE)!.durationSeconds, null)
})

test('preview: a video already on Clickit (archived, other show) shows where it is', async () => {
  const f = world()
  const res = await previewPlaylistPageCore(f.client, fakeYouTube().client, { showId: S1, url: URL0, page: 0 })
  const row = res.data!.rows.find((r) => r.videoId === ON_CLICKIT)!
  assert.equal(row.status, 'already')
  assert.deepEqual(row.existing, { showTitle: 'Other show', seasonNumber: 2, episodeNumber: 7 })
  assert.equal(res.data!.rows.find((r) => r.videoId === OK1)!.existing, undefined)
})

test('preview page 1 with a page token skips getPlaylist and keeps global 1-based positions', async () => {
  const f = world()
  const page0 = Array.from({ length: 50 }, (_, i) => ({ videoId: `p0Video${String(i).padStart(4, '0')}`, position: i }))
  const page1 = [
    { videoId: OK1, position: 50 },
    { videoId: OK2, position: 51 },
  ]
  const yt = fakeYouTube({ pages: [page0, page1] })
  const res = await previewPlaylistPageCore(f.client, yt.client, {
    showId: S1,
    playlistId: PLAYLIST,
    pageToken: 'p1',
    page: 1,
  })
  assert.equal(res.success, true)
  assert.equal(res.data!.playlist, null)
  assert.deepEqual(res.data!.rows.map((r) => [r.videoId, r.position]), [
    [OK1, 51],
    [OK2, 52],
  ])
  assert.equal(yt.calls.some((c) => c[0] === 'getPlaylist'), false)
  assert.deepEqual(writes(f), [])
})

test('preview page 1 without a page token or playlist id is refused before any fetch', async () => {
  const f = world()
  const yt = fakeYouTube()
  const a = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, playlistId: PLAYLIST, page: 1 })
  const b = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, pageToken: 'p1', page: 1 })
  assert.equal(a.success, false)
  assert.equal(b.success, false)
  assert.equal(yt.calls.length, 0)
})

test('preview: capped is true when page 3 still has a next page token', async () => {
  const f = world()
  const pages = Array.from({ length: 5 }, (_, p) =>
    Array.from({ length: 50 }, (_, i) => ({
      videoId: `pg${p}Vid${String(i).padStart(4, '0')}`,
      position: p * 50 + i,
    }))
  )
  const yt = fakeYouTube({ pages })
  const res = await previewPlaylistPageCore(f.client, yt.client, {
    showId: S1,
    playlistId: PLAYLIST,
    pageToken: 'p3',
    page: 3,
  })
  assert.equal(res.success, true)
  assert.equal(res.data!.capped, true)
  assert.equal(res.data!.nextPageToken, null)
  assert.equal(res.data!.rows.at(-1)!.position, 200)

  const res2 = await previewPlaylistPageCore(f.client, yt.client, {
    showId: S1,
    playlistId: PLAYLIST,
    pageToken: 'p2',
    page: 2,
  })
  assert.equal(res2.data!.capped, false)
  assert.equal(res2.data!.nextPageToken, 'p3')
})

test('preview: bad links are refused with their code and no fetch or DB call', async () => {
  const cases: Array<[string, string]> = [
    ['not a link', 'not_a_playlist_link'],
    ['https://evil.com/playlist?list=PLabc', 'not_a_playlist_link'],
    ['https://youtu.be/okVideo0001', 'video_link_in_import'],
    ['x'.repeat(3000), 'not_a_playlist_link'],
  ]
  for (const [url, code] of cases) {
    const f = world()
    const yt = fakeYouTube()
    const res = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url, page: 0 })
    assert.equal(res.success, false, url)
    assert.equal(res.code, code, url)
    assert.equal(yt.calls.length, 0, url)
    assert.equal(f.calls.length, 0, url)
  }
  const f = world()
  const yt = fakeYouTube()
  const missing = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, page: 0 })
  assert.equal(missing.code, 'not_a_playlist_link')
  assert.equal(yt.calls.length, 0)
})

test('preview: a bad show id or unknown key is refused before any fetch', async () => {
  const f = world()
  const yt = fakeYouTube()
  const a = await previewPlaylistPageCore(f.client, yt.client, { showId: 'nope', url: URL0, page: 0 })
  const b = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url: URL0, page: 0, rows: [] })
  assert.equal(a.success, false)
  assert.equal(b.success, false)
  assert.equal(yt.calls.length, 0)
})

test('preview: an empty playlist returns empty_playlist', async () => {
  const f = world()
  const res = await previewPlaylistPageCore(f.client, fakeYouTube({ pages: [[]] }).client, {
    showId: S1,
    url: URL0,
    page: 0,
  })
  assert.equal(res.success, false)
  assert.equal(res.code, 'empty_playlist')
})

test('preview: YouTubeApiError codes pass through and the error never carries a key', async () => {
  for (const [method, code] of [
    ['getPlaylist', 'playlist_private'],
    ['listPlaylistItemsPage', 'quota'],
    ['getVideos', 'key_rejected'],
    ['getVideos', 'network'],
  ] as const) {
    const f = world()
    const yt = fakeYouTube({ fail: { method, error: new YouTubeApiError(code, 403, null) } })
    const res = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url: URL0, page: 0 })
    assert.equal(res.success, false)
    assert.equal(res.code, code)
    assert.doesNotMatch(JSON.stringify(res), /AIza|googleapis/)
  }
})

test('preview: a thrown non-API error is network; a null client is key_missing', async () => {
  const f = world()
  const yt = fakeYouTube({ fail: { method: 'getVideos', error: new Error('boom AIzaSecret') } })
  const res = await previewPlaylistPageCore(f.client, yt.client, { showId: S1, url: URL0, page: 0 })
  assert.equal(res.code, 'network')
  assert.doesNotMatch(JSON.stringify(res), /AIza|boom/)
  const res2 = await previewPlaylistPageCore(f.client, null, { showId: S1, url: URL0, page: 0 })
  assert.equal(res2.code, 'key_missing')
})

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

const commitInput = (over: Record<string, unknown> = {}) => ({
  showId: S1,
  playlistId: PLAYLIST,
  videoIds: [OK1, OK2, AR1],
  target: { kind: 'new', seasonTitle: 'Season 2' },
  ...over,
})

test('commit new season: season max+1, one episodes insert of drafts, counts, one audit row', async () => {
  const f = world()
  const yt = fakeYouTube()
  const res = await commitImportCore(f.client, deps(f, yt.client), commitInput())
  assert.equal(res.success, true, res.error)
  assert.equal(res.wrote, true)
  const { seasonId, episodeIds, needsEnglishCount, showId } = res.data!
  assert.equal(showId, S1)
  assert.equal(needsEnglishCount, 1)

  const season = f.snapshot().seasons!.find((s) => s.id === seasonId)!
  assert.equal(season.show_id, S1)
  assert.equal(season.season_number, 2)
  assert.equal(season.title, 'Season 2')
  assert.equal(season.title_ar, null)
  assert.equal(season.episode_count, 3)

  const inserts = f.calls.filter((c) => c.table === 'episodes' && c.op === 'insert')
  assert.equal(inserts.length, 1)
  assert.equal((inserts[0]!.patch as Row[]).length, 3)

  const eps = episodesOf(f, seasonId).sort((a, b) => a.episode_number - b.episode_number)
  assert.deepEqual(eps.map((e) => e.id).sort(), [...episodeIds].sort())
  assert.deepEqual(
    eps.map((e) => [e.youtube_video_id, e.episode_number, e.status, e.youtube_status, e.archived]),
    [
      [OK1, 1, 'draft', 'ok', false],
      [OK2, 2, 'draft', 'ok', false],
      [AR1, 3, 'draft', 'ok', false],
    ]
  )
  // Review item 7: imported text is YouTube's own, so every edited flag is false.
  for (const e of eps) {
    for (const f of ['title', 'title_ar', 'description', 'description_ar']) {
      assert.equal(e[`${f}_edited`], false, `${f}_edited on ${e.youtube_video_id}`)
    }
  }
  assert.equal(eps[0]!.show_id, S1)
  assert.equal(eps[0]!.duration, 12)
  assert.equal(eps[0]!.youtube_duration_seconds, 720)
  assert.equal(eps[0]!.youtube_checked_at, NOW.toISOString())
  // Imported rows start past the daily check's text baseline (PR #27 re-review, note 1).
  for (const e of eps) assert.equal(e.youtube_text_baseline_at, NOW.toISOString())
  assert.equal(eps[2]!.title_ar, 'الحلقة الأولى')

  const show = f.snapshot().shows!.find((s) => s.id === S1)!
  assert.equal(show.season_count, 2)
  assert.equal(show.episode_count, 6)

  const audits = f.auditRows()
  assert.equal(audits.length, 1)
  assert.equal(audits[0]!.action_type, 'create')
  assert.equal(audits[0]!.entity_type, 'season')
  assert.equal(audits[0]!.entity_id, seasonId)
  assert.equal(audits[0]!.admin_user_id, 'admin-1')
  assert.deepEqual(audits[0]!.diff, {
    kind: 'youtube_import',
    playlist_id: PLAYLIST,
    episode_count: 3,
    season_id: seasonId,
    target: 'new',
    episode_ids: episodeIds,
  })
})

test('commit: client order is playlist order; YouTube text is re-fetched, not taken from the client', async () => {
  const f = world()
  const yt = fakeYouTube()
  const res = await commitImportCore(f.client, deps(f, yt.client), commitInput({ videoIds: [OK2, OK1] }))
  assert.equal(res.success, true, res.error)
  const eps = episodesOf(f, res.data!.seasonId).sort((a, b) => a.episode_number - b.episode_number)
  assert.deepEqual(eps.map((e) => e.youtube_video_id), [OK2, OK1])
  assert.equal(eps[0]!.title, `Video ${OK2}`)
  assert.deepEqual(yt.calls.filter((c) => c[0] === 'getVideos').map((c) => c[1]), [[OK2, OK1]])
})

test('commit: an Arabic-dominant new season title goes to title_ar too', async () => {
  const f = world()
  const res = await commitImportCore(
    f.client,
    deps(f, fakeYouTube().client),
    commitInput({ target: { kind: 'new', seasonTitle: 'الموسم الثاني' } })
  )
  assert.equal(res.success, true, res.error)
  const season = f.snapshot().seasons!.find((s) => s.id === res.data!.seasonId)!
  assert.equal(season.title, 'الموسم الثاني')
  assert.equal(season.title_ar, 'الموسم الثاني')
})

test('commit existing season: numbers continue after the max including archived (5, 6, 7)', async () => {
  const f = world()
  const res = await commitImportCore(
    f.client,
    deps(f, fakeYouTube().client),
    commitInput({ videoIds: [OK1, OK2, OK3], target: { kind: 'existing', seasonId: SE1 } })
  )
  assert.equal(res.success, true, res.error)
  assert.equal(res.data!.seasonId, SE1)
  const fresh = episodesOf(f, SE1).filter((e) => res.data!.episodeIds.includes(e.id))
  assert.deepEqual(fresh.map((e) => e.episode_number).sort(), [5, 6, 7])
  assert.equal(f.snapshot().seasons!.length, 2)
  assert.equal(f.snapshot().seasons!.find((s) => s.id === SE1)!.episode_count, 6)
  assert.equal(f.snapshot().shows!.find((s) => s.id === S1)!.episode_count, 6)
  assert.equal(f.auditRows()[0]!.diff.target, 'existing')
})

test('commit existing season of another show is refused with no write', async () => {
  const f = world()
  const yt = fakeYouTube()
  const res = await commitImportCore(
    f.client,
    deps(f, yt.client),
    commitInput({ target: { kind: 'existing', seasonId: SE2 } })
  )
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.error, 'Season belongs to a different show.')
  assert.deepEqual(writes(f), [])
  assert.equal(yt.calls.length, 0)
})

test('commit: unknown show or season is refused with no write', async () => {
  const f = world()
  const a = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput({ showId: id('f') }))
  assert.equal(a.success, false)
  assert.equal(a.error, 'Show not found.')
  const b = await commitImportCore(
    f.client,
    deps(f, fakeYouTube().client),
    commitInput({ target: { kind: 'existing', seasonId: id('f', 9) } })
  )
  assert.equal(b.error, 'Season not found.')
  assert.deepEqual(writes(f), [])
})

test('commit: a tampered payload is refused by the schema with no call at all', async () => {
  const f = world()
  const yt = fakeYouTube()
  for (const over of [
    { videoIds: ['short'] },
    { videoIds: [OK1, OK1] },
    { rows: [{ title: 'x' }] },
    { target: { kind: 'new', seasonTitle: '' } },
  ]) {
    const res = await commitImportCore(f.client, deps(f, yt.client), commitInput(over))
    assert.equal(res.success, false)
    assert.equal(res.wrote, false)
  }
  assert.equal(f.calls.length, 0)
  assert.equal(yt.calls.length, 0)
})

test('commit: re-import of ids already on Clickit is refused with zero writes (D-05)', async () => {
  const f = world()
  const first = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput())
  assert.equal(first.success, true)
  const before = f.snapshot()
  const writesBefore = writes(f).length
  const again = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput())
  assert.equal(again.success, false)
  assert.equal(again.wrote, false)
  assert.equal(again.error, 'Some videos changed on YouTube since the preview. Paste the link again.')
  assert.equal(writes(f).length, writesBefore)
  assert.deepEqual(f.snapshot(), before)

  const archivedElsewhere = await commitImportCore(
    f.client,
    deps(f, fakeYouTube().client),
    commitInput({ videoIds: [OK3, ON_CLICKIT] })
  )
  assert.equal(archivedElsewhere.success, false)
  assert.equal(writes(f).length, writesBefore)
})

test('commit: one id gone private since the preview refuses the whole import, zero writes', async () => {
  const f = world()
  const yt = fakeYouTube()
  yt.videos[OK2]!.status = { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true }
  const res = await commitImportCore(f.client, deps(f, yt.client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.error, 'Some videos changed on YouTube since the preview. Paste the link again.')
  assert.deepEqual(writes(f), [])

  const gone = await commitImportCore(f.client, deps(f, yt.client), commitInput({ videoIds: [OK1, GONE] }))
  assert.equal(gone.success, false)
  assert.deepEqual(writes(f), [])
})

test('commit: YouTube errors pass through as codes; null client is key_missing; nothing written', async () => {
  const f = world()
  const quota = await commitImportCore(
    f.client,
    deps(f, fakeYouTube({ fail: { method: 'getVideos', error: new YouTubeApiError('quota', 403, 'quotaExceeded') } }).client),
    commitInput()
  )
  assert.equal(quota.success, false)
  assert.equal(quota.code, 'quota')
  const missing = await commitImportCore(f.client, deps(f, null), commitInput())
  assert.equal(missing.code, 'key_missing')
  assert.deepEqual(writes(f), [])
})

test('commit: episodes insert fails -> new season removed, counts unchanged, one failure audit row', async () => {
  const f = world()
  const before = noAudit(f)
  f.failOn({ table: 'episodes', op: 'insert', nth: 1 })
  const res = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.match(res.error!, /forced failure/)
  assert.deepEqual(noAudit(f), before)
  const audits = f.auditRows()
  assert.equal(audits.length, 1)
  assert.equal(audits[0]!.diff.outcome, 'failed')
  assert.equal(audits[0]!.diff.failed_step, 'insert-episodes')
  assert.equal(audits[0]!.diff.kind, 'youtube_import')
  assert.deepEqual(audits[0]!.diff.undone, ['insert-season'])
})

test('commit: counts recompute fails -> episodes and season removed, counts restored', async () => {
  const f = world()
  const before = noAudit(f)
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const res = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.deepEqual(noAudit(f), before)
  assert.equal(f.auditRows().length, 1)
  assert.equal(f.auditRows()[0]!.diff.failed_step, 'recompute-counts')
})

test('commit: the audit row failing undoes the import (D-07: never swallowed)', async () => {
  const f = world()
  const before = noAudit(f)
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const res = await commitImportCore(f.client, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.deepEqual(noAudit(f), before)
})

test('commit: a youtube_video_id unique violation during insert fails the whole insert', async () => {
  const f = world()
  const before = noAudit(f)
  // Another admin saves OK2 between the dedupe read and the insert (race).
  const racing = {
    ...f.client,
    from(table: string) {
      const b = f.client.from(table)
      if (table === 'episodes') {
        const insert = b.insert.bind(b)
        b.insert = (rows: Row[]) => {
          f.tables.episodes!.push(ep(id('e', 99), 50, { show_id: S2, season_id: SE2, youtube_video_id: OK2, archived: true }))
          return insert(rows)
        }
      }
      return b
    },
  }
  const res = await commitImportCore(racing, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.error, 'One or more of these videos is already on Clickit. Paste the link again.')
  const after = noAudit(f)
  after.episodes = after.episodes!.filter((e) => e.id !== id('e', 99))
  assert.deepEqual(after, before)
})

/** A client where a renumber of SE1 lands between the max-number read and the insert. */
function renumberRace(f: ReturnType<typeof world>, number: number) {
  return {
    ...f.client,
    from(table: string) {
      const b = f.client.from(table)
      if (table === 'episodes') {
        const insert = b.insert.bind(b)
        b.insert = (rows: Row[]) => {
          f.tables.episodes!.push(ep(id('e', 98), number, { archived: true }))
          return insert(rows)
        }
      }
      return b
    },
  }
}

test('commit: a season-number collision with a concurrent renumber returns season_changed, nothing kept', async () => {
  const f = world()
  const before = noAudit(f)
  const res = await commitImportCore(
    renumberRace(f, 5),
    deps(f, fakeYouTube().client),
    commitInput({ videoIds: [OK1, OK2, OK3], target: { kind: 'existing', seasonId: SE1 } })
  )
  assert.equal(res.success, false)
  assert.equal(res.code, 'season_changed')
  assert.equal(res.error, 'Season changed while you were importing. Try again.')
  const after = noAudit(f)
  after.episodes = after.episodes!.filter((e) => e.id !== id('e', 98))
  assert.deepEqual(after, before)
  const audits = f.auditRows()
  assert.equal(audits.length, 1)
  assert.equal(audits[0]!.diff.outcome, 'failed')
  assert.equal(audits[0]!.diff.failed_step, 'insert-episodes')
})

test('commit: a new-season import that hits the collision rolls the season back and returns season_changed', async () => {
  const f = world()
  const before = noAudit(f)
  // The new season gets its id on insert; the race row is added to whatever season the insert targets.
  const racing = {
    ...f.client,
    from(table: string) {
      const b = f.client.from(table)
      if (table === 'episodes') {
        const insert = b.insert.bind(b)
        b.insert = (rows: Row[]) => {
          f.tables.episodes!.push(ep(id('e', 97), 1, { season_id: rows[0]!.season_id, archived: true }))
          return insert(rows)
        }
      }
      return b
    },
  }
  const res = await commitImportCore(racing, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.code, 'season_changed')
  const after = noAudit(f)
  after.episodes = after.episodes!.filter((e) => e.id !== id('e', 97))
  assert.deepEqual(after, before)
  assert.deepEqual(f.auditRows()[0]!.diff.undone, ['insert-season'])
})

test('commit: season_changed is not returned when the rollback left something in place', async () => {
  const f = world()
  f.failOn({ table: 'seasons', op: 'delete', nth: 1 })
  const racing = {
    ...f.client,
    from(table: string) {
      const b = f.client.from(table)
      if (table === 'episodes') {
        const insert = b.insert.bind(b)
        b.insert = (rows: Row[]) => {
          f.tables.episodes!.push(ep(id('e', 96), 1, { season_id: rows[0]!.season_id, archived: true }))
          return insert(rows)
        }
      }
      return b
    },
  }
  const res = await commitImportCore(racing, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.code, undefined)
  assert.match(res.error!, /could not undo: insert-season/)
})

test('commit: a duplicate-video violation stays distinct from season_changed', async () => {
  const f = world()
  const racing = {
    ...f.client,
    from(table: string) {
      const b = f.client.from(table)
      if (table === 'episodes') {
        const insert = b.insert.bind(b)
        b.insert = (rows: Row[]) => {
          f.tables.episodes!.push(ep(id('e', 95), 60, { show_id: S2, season_id: SE2, youtube_video_id: OK1, archived: true }))
          return insert(rows)
        }
      }
      return b
    },
  }
  const res = await commitImportCore(racing, deps(f, fakeYouTube().client), commitInput())
  assert.equal(res.success, false)
  assert.equal(res.code, undefined)
  assert.equal(res.error, 'One or more of these videos is already on Clickit. Paste the link again.')
})

test('fake: youtube_video_id is unique catalog-wide; null and empty string never collide', async () => {
  const f = world()
  const dup = await f.client
    .from('episodes')
    .insert(ep(id('e', 70), 70, { youtube_video_id: ON_CLICKIT }))
  assert.equal(dup.error.code, '23505')
  assert.match(dup.error.message, /episodes_youtube_video_id_key/)
  const blanks = await f.client.from('episodes').insert([
    ep(id('e', 71), 71, { youtube_video_id: '' }),
    ep(id('e', 72), 72, { youtube_video_id: '' }),
    ep(id('e', 73), 73, { youtube_video_id: null }),
  ])
  assert.equal(blanks.error, null)
})
