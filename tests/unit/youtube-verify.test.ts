// Single-video verify (YT-03): strict parse before any fetch, one status
// precedence, catalog-wide duplicate check. Fake YouTube client; no live call.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { verifyMessage, verifyVideoCore } from '../../src/lib/admin/youtube-verify.ts'
import {
  YOUTUBE_API_ERROR_CODES,
  YouTubeApiError,
  type YouTubeClientLike,
  type YouTubeVideoResource,
} from '../../src/server/youtube/client.ts'
import { YOUTUBE_ERROR_CODES, YOUTUBE_ERROR_MESSAGE_KEYS } from '../../src/lib/youtube-errors.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) => `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const SE1 = id('c')
const E1 = id('e', 1)
const E2 = id('e', 2)

const OK = 'okVideo0001'
const USED = 'usedVideo01'
const ARCH = 'archVideo01'

function video(vid: string, over: Partial<YouTubeVideoResource> = {}): YouTubeVideoResource {
  return {
    id: vid,
    snippet: {
      title: `Title ${vid}`,
      description: `Description ${vid}`,
      liveBroadcastContent: 'none',
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } },
      // channelTitle is in the API response; the client type does not list it.
      ...({ channelTitle: 'Clickit Story' } as object),
    },
    contentDetails: { duration: 'PT25M31S' },
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

function world() {
  return createFakeSupabase({
    shows: [{ id: S1, title: 'Show 1' }],
    seasons: [{ id: SE1, show_id: S1, season_number: 3 }],
    episodes: [
      { id: E1, show_id: S1, season_id: SE1, episode_number: 4, youtube_video_id: USED, archived: false },
      { id: E2, show_id: S1, season_id: SE1, episode_number: 9, youtube_video_id: ARCH, archived: true },
    ],
  })
}

const all = () => ({
  [OK]: video(OK),
  [USED]: video(USED),
  [ARCH]: video(ARCH),
  privVideo01: video('privVideo01', { status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true } }),
  noEmbed0001: video('noEmbed0001', { status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false } }),
  blockedAE01: video('blockedAE01', { contentDetails: { duration: 'PT5M', regionRestriction: { blocked: ['AE'] } } }),
  processing1: video('processing1', { status: { privacyStatus: 'public', uploadStatus: 'uploaded', embeddable: true } }),
  upcoming001: video('upcoming001', {
    snippet: { title: 'Soon', liveBroadcastContent: 'upcoming' },
    liveStreamingDetails: { scheduledStartTime: '2026-11-01T18:00:00Z' },
  }),
})

test('bad input is refused before any fetch', async () => {
  for (const [raw, code] of [
    ['not a link', 'not_a_video_link'],
    ['https://www.youtube.com/playlist?list=PLabcdef', 'playlist_link_in_form'],
    ['abcdefghij', 'not_a_video_link'],
    [42, 'not_a_video_link'],
    [null, 'not_a_video_link'],
  ] as const) {
    const f = world()
    const yt = fakeYouTube(all())
    const res = await verifyVideoCore(f.client, yt.client, raw)
    assert.deepEqual(res, { ok: false, code }, String(raw))
    assert.equal(yt.calls.length, 0)
    assert.equal(f.calls.length, 0)
  }
})

test('a null client is key_missing, after the format check', async () => {
  const f = world()
  assert.deepEqual(await verifyVideoCore(f.client, null, OK), { ok: false, code: 'key_missing' })
  assert.deepEqual(await verifyVideoCore(f.client, null, 'junk'), { ok: false, code: 'not_a_video_link' })
})

test('status refusals use the one precedence', async () => {
  for (const [vid, code] of [
    ['missingVid1', 'video_not_found'],
    ['privVideo01', 'video_private'],
    ['noEmbed0001', 'video_not_embeddable'],
    ['blockedAE01', 'video_blocked_uae'],
    ['processing1', 'video_not_ready'],
    ['upcoming001', 'video_not_ready'],
  ] as const) {
    const f = world()
    const res = await verifyVideoCore(f.client, fakeYouTube(all()).client, vid)
    assert.deepEqual(res, { ok: false, code }, vid)
  }
})

test('a video on another episode (archived included) is a duplicate with its location', async () => {
  const f = world()
  const yt = fakeYouTube(all())
  assert.deepEqual(await verifyVideoCore(f.client, yt.client, `https://youtu.be/${USED}`), {
    ok: false,
    code: 'video_duplicate',
    params: { show: 'Show 1', season: 3, episode: 4 },
  })
  assert.deepEqual(await verifyVideoCore(f.client, yt.client, ARCH), {
    ok: false,
    code: 'video_duplicate',
    params: { show: 'Show 1', season: 3, episode: 9 },
  })
})

test('the same episode is not a duplicate of itself; checkDuplicate false skips the lookup', async () => {
  const f = world()
  const yt = fakeYouTube(all())
  const self = await verifyVideoCore(f.client, yt.client, USED, { excludeEpisodeId: E1 })
  assert.equal(self.ok, true)
  const before = f.calls.length
  const noCheck = await verifyVideoCore(f.client, yt.client, ARCH, { checkDuplicate: false })
  assert.equal(noCheck.ok, true)
  assert.equal(f.calls.length, before)
})

test('ok returns normalized meta from YouTube', async () => {
  const f = world()
  const yt = fakeYouTube(all())
  const res = await verifyVideoCore(f.client, yt.client, `https://www.youtube.com/watch?v=${OK}&t=10s`)
  assert.deepEqual(res, {
    ok: true,
    meta: {
      videoId: OK,
      title: `Title ${OK}`,
      description: `Description ${OK}`,
      channelTitle: 'Clickit Story',
      thumbnailUrl: `https://i.ytimg.com/vi/${OK}/hqdefault.jpg`,
      durationSeconds: 1531,
      durationMinutes: 26,
    },
  })
  assert.deepEqual(yt.calls, [[OK]])
})

test('every client API error code has a UI message key (codes never drift)', () => {
  for (const code of YOUTUBE_API_ERROR_CODES) {
    assert.ok(code in YOUTUBE_ERROR_MESSAGE_KEYS, code)
  }
})

test('YouTubeApiError codes pass through; an unknown throw is network; no key in results', async () => {
  for (const code of ['quota', 'key_rejected', 'network', 'api_not_allowed'] as const) {
    const f = world()
    const res = await verifyVideoCore(f.client, fakeYouTube(all(), new YouTubeApiError(code, 403, null)).client, OK)
    assert.deepEqual(res, { ok: false, code })
  }
  const f = world()
  const res = await verifyVideoCore(f.client, fakeYouTube(all(), new Error('AIzaSecret leaked')).client, OK)
  assert.deepEqual(res, { ok: false, code: 'network' })
})

test('a duplicate-lookup DB failure throws (the caller returns it, never treated as ok)', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'select', nth: 1 })
  await assert.rejects(() => verifyVideoCore(f.client, fakeYouTube(all()).client, OK))
})

test('verifyMessage: plain English for every code, with the duplicate location', () => {
  for (const code of YOUTUBE_ERROR_CODES) {
    const text = verifyMessage({ ok: false, code })
    assert.ok(text.length > 0, code)
    assert.doesNotMatch(text, /undefined/)
  }
  assert.equal(
    verifyMessage({ ok: false, code: 'video_duplicate', params: { show: 'Show 1', season: 3, episode: 4 } }),
    'This video is already on Clickit: Show 1 · Season 3 · Episode 4.'
  )
  assert.equal(verifyMessage({ ok: false, code: 'video_duplicate' }), 'This video is already on Clickit.')
})
