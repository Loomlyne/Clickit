// Server check of a short's YouTube link (PR #27 review, finding 3): strict
// parse, verifyVideoCore with checkDuplicate false, key missing fails closed,
// bare 11-character id stored. Fake YouTube client; no live call.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkShortVideoCore } from '../../src/lib/admin/short-video.ts'
import {
  YouTubeApiError,
  type YouTubeClientLike,
  type YouTubeVideoResource,
} from '../../src/server/youtube/client.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const OK = 'okVideo0001'
const USED = 'usedVideo01'

function video(vid: string, over: Partial<YouTubeVideoResource> = {}): YouTubeVideoResource {
  return {
    id: vid,
    snippet: { title: `Title ${vid}`, description: '', liveBroadcastContent: 'none' },
    contentDetails: { duration: 'PT45S' },
    status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true },
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

// An episode already uses USED: a short may still use it (no duplicate rule).
const world = () =>
  createFakeSupabase({
    episodes: [{ id: 'e1', season_id: 's1', episode_number: 1, youtube_video_id: USED, archived: false }],
  })

function getter(client: YouTubeClientLike | null) {
  let reads = 0
  return {
    get: async () => {
      reads += 1
      return client
    },
    reads: () => reads,
  }
}

test('a full link is checked once and stored as the bare 11-character id', async () => {
  const yt = fakeYouTube({ [OK]: video(OK) })
  const g = getter(yt.client)
  const res = await checkShortVideoCore(world().client, g.get, `https://www.youtube.com/shorts/${OK}`)
  assert.deepEqual(res, { ok: true, videoId: OK })
  assert.deepEqual(yt.calls, [[OK]])
  assert.equal(g.reads(), 1)
})

test('a bad link is refused before any key read or YouTube call', async () => {
  const yt = fakeYouTube({ [OK]: video(OK) })
  const g = getter(yt.client)
  for (const raw of ['not a link', '', 'https://www.youtube.com/playlist?list=PLabc123', 42, `${OK}x`]) {
    const res = await checkShortVideoCore(world().client, g.get, raw)
    assert.equal(res.ok, false, String(raw))
    if (!res.ok) {
      assert.ok(['not_a_video_link', 'playlist_link_in_form'].includes(res.code), `${String(raw)} -> ${res.code}`)
      assert.ok(res.error.length > 0)
    }
  }
  assert.equal(g.reads(), 0)
  assert.deepEqual(yt.calls, [])
})

test('no key saved: key_missing, nothing fetched', async () => {
  const g = getter(null)
  const res = await checkShortVideoCore(world().client, g.get, OK)
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.code, 'key_missing')
})

test('the same refusal codes as an episode save', async () => {
  const yt = fakeYouTube({
    privVideo01: video('privVideo01', {
      status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true },
    }),
    noEmbed0001: video('noEmbed0001', {
      status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false },
    }),
    blockedAE01: video('blockedAE01', {
      contentDetails: { duration: 'PT5M', regionRestriction: { blocked: ['AE'] } },
    }),
  })
  const g = getter(yt.client)
  const cases: Array<[string, string]> = [
    ['privVideo01', 'video_private'],
    ['noEmbed0001', 'video_not_embeddable'],
    ['blockedAE01', 'video_blocked_uae'],
    ['missing0001', 'video_not_found'],
  ]
  for (const [vid, code] of cases) {
    const res = await checkShortVideoCore(world().client, g.get, vid)
    assert.equal(res.ok, false, vid)
    if (!res.ok) assert.equal(res.code, code, vid)
  }
  for (const code of ['quota', 'key_rejected', 'api_not_allowed'] as const) {
    const failing = fakeYouTube({}, new YouTubeApiError(code, 403, null))
    const res = await checkShortVideoCore(world().client, getter(failing.client).get, OK)
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.code, code)
  }
})

test('a video already used by an episode is fine for a short (checkDuplicate false)', async () => {
  const yt = fakeYouTube({ [USED]: video(USED) })
  const fake = world()
  const res = await checkShortVideoCore(fake.client, getter(yt.client).get, USED)
  assert.deepEqual(res, { ok: true, videoId: USED })
  assert.equal(fake.calls.filter((c) => c.table === 'episodes').length, 0)
})

test('edit: the stored video in any link form is not re-checked, so a title edit saves without a key', async () => {
  const g = getter(null)
  const res = await checkShortVideoCore(world().client, g.get, `https://youtu.be/${OK}`, OK)
  assert.deepEqual(res, { ok: true, videoId: OK })
  assert.equal(g.reads(), 0)
})

test('edit: a changed video is checked', async () => {
  const yt = fakeYouTube({ [USED]: video(USED) })
  const g = getter(yt.client)
  const res = await checkShortVideoCore(world().client, g.get, USED, OK)
  assert.deepEqual(res, { ok: true, videoId: USED })
  assert.deepEqual(yt.calls, [[USED]])
  const missing = await checkShortVideoCore(world().client, getter(null).get, USED, OK)
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.code, 'key_missing')
})
