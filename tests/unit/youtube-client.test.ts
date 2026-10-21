// YouTube Data API v3 client: fixtures are hand-written in the documented
// shapes (not recorded); no live API call is ever made.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  YOUTUBE_API_ERROR_CODES,
  YouTubeApiError,
  createYouTubeClient,
} from '../../src/server/youtube/client.ts'

const FIXTURE_DIR = new URL('./fixtures/youtube/', import.meta.url)

// Fixtures are untyped JSON documents; one loose alias keeps the tests readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any

function fixture(name: string): Doc {
  return JSON.parse(readFileSync(new URL(name, FIXTURE_DIR), 'utf8'))
}

type RecordedCall = {
  url: string
  path: string
  query: URLSearchParams
  headers: Record<string, string>
  init: RequestInit
}

type FakeReply = { status?: number; body?: unknown } | Error

// Fake fetch: records URL, headers and init of every call and serves replies
// chosen by the handler from the request path and query.
function makeFakeFetch(handler: (call: RecordedCall) => FakeReply) {
  const calls: RecordedCall[] = []
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const parsed = new URL(url)
    const headers: Record<string, string> = {}
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>
    for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = v
    const call: RecordedCall = {
      url,
      path: parsed.pathname.replace('/youtube/v3/', ''),
      query: parsed.searchParams,
      headers,
      init: init ?? {},
    }
    calls.push(call)
    const reply = handler(call)
    if (reply instanceof Error) throw reply
    const status = reply.status ?? 200
    return new Response(JSON.stringify(reply.body ?? {}), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { fetchImpl, calls }
}

// Serves the documented fixtures by path and page token.
function fixtureHandler(call: RecordedCall): FakeReply {
  if (call.path === 'playlists') return { body: fixture('playlists-ok.json') }
  if (call.path === 'playlistItems') {
    return {
      body: call.query.get('pageToken')
        ? fixture('playlist-items-page2.json')
        : fixture('playlist-items-page1.json'),
    }
  }
  if (call.path === 'videos') return { body: fixture('videos-mixed.json') }
  return { status: 404, body: {} }
}

const FIXTURES = [
  'playlists-ok.json',
  'playlist-items-page1.json',
  'playlist-items-page2.json',
  'videos-mixed.json',
  'error-quota.json',
  'error-key-invalid.json',
]

test('every fixture parses and is marked as a documented shape', () => {
  for (const name of FIXTURES) {
    assert.equal(
      fixture(name)._source,
      'documented shape, not recorded',
      name
    )
  }
})

test('playlist item pages: 50 items with a token, then a shorter last page', () => {
  const page1 = fixture('playlist-items-page1.json')
  const page2 = fixture('playlist-items-page2.json')
  assert.equal(page1.items.length, 50)
  assert.ok(page1.nextPageToken)
  assert.ok(page2.items.length < 50)
  assert.equal(page2.nextPageToken, undefined)
  const missing = page1.items.filter((i: Doc) => !i.contentDetails?.videoId)
  assert.equal(missing.length, 1)
})

test('videos-mixed covers each status case once and omits one requested id', () => {
  const body = fixture('videos-mixed.json')
  const byId = new Map<string, Doc>(body.items.map((v: Doc) => [v.id, v]))
  assert.equal(byId.get('okPublic001').status.privacyStatus, 'public')
  assert.equal(byId.get('okUnlisted1').status.privacyStatus, 'unlisted')
  assert.equal(byId.get('privateVid1').status.privacyStatus, 'private')
  assert.equal(byId.get('processing1').status.uploadStatus, 'uploaded')
  const premiere = byId.get('premiere001')
  assert.equal(premiere.snippet.liveBroadcastContent, 'upcoming')
  assert.ok(premiere.liveStreamingDetails.scheduledStartTime)
  assert.equal(byId.get('noEmbed0001').status.embeddable, false)
  assert.ok(byId.get('blockedAE01').contentDetails.regionRestriction.blocked.includes('AE'))
  const allowed = byId.get('allowedNoAE').contentDetails.regionRestriction.allowed
  assert.ok(Array.isArray(allowed) && !allowed.includes('AE'))
  assert.match(byId.get('arabicTitle').snippet.title, /[؀-ۿ]/)
  const removed = body._requestedIds.filter((id: string) => !byId.has(id))
  assert.deepEqual(removed, ['removedVid1'])
})

test('error fixtures have the documented error body shape', () => {
  const quota = fixture('error-quota.json')
  assert.equal(quota.error.code, 403)
  assert.equal(quota.error.errors[0].reason, 'quotaExceeded')
  const bad = fixture('error-key-invalid.json')
  assert.equal(bad.error.code, 400)
  assert.match(bad.error.message, /API key not valid/)
})

test('fake fetch records the call and serves fixtures by path and query', async () => {
  const { fetchImpl, calls } = makeFakeFetch(fixtureHandler)
  const res = await fetchImpl(
    'https://www.googleapis.com/youtube/v3/playlistItems?playlistId=PL1&pageToken=CDIQAA',
    { headers: { 'x-goog-api-key': 'K' }, cache: 'no-store' }
  )
  assert.equal((await res.json()).items.length, 20)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, 'playlistItems')
  assert.equal(calls[0].query.get('pageToken'), 'CDIQAA')
  assert.equal(calls[0].headers['x-goog-api-key'], 'K')
})

const KEY = 'TEST_KEY_123'

function clientWith(handler: (call: RecordedCall) => FakeReply) {
  const fake = makeFakeFetch(handler)
  return {
    client: createYouTubeClient({ apiKey: KEY, fetchImpl: fake.fetchImpl }),
    calls: fake.calls,
  }
}

async function caught(fn: () => Promise<unknown>): Promise<YouTubeApiError> {
  try {
    await fn()
  } catch (err) {
    assert.ok(err instanceof YouTubeApiError, `expected YouTubeApiError, got ${String(err)}`)
    return err
  }
  assert.fail('expected the call to throw')
}

function errorBody(code: number, reason: string, message = 'x') {
  return { error: { code, message, errors: [{ message, domain: 'global', reason }] } }
}

test('YOUTUBE_API_ERROR_CODES lists the five client codes', () => {
  assert.deepEqual(
    [...YOUTUBE_API_ERROR_CODES],
    ['playlist_private', 'key_rejected', 'api_not_allowed', 'quota', 'network']
  )
})

test('getPlaylist returns id, title, privacyStatus and itemCount', async () => {
  const { client, calls } = clientWith(fixtureHandler)
  assert.deepEqual(await client.getPlaylist('PL1'), {
    id: 'PL1',
    title: 'Season One',
    privacyStatus: 'unlisted',
    itemCount: 70,
  })
  assert.equal(calls[0].path, 'playlists')
  assert.equal(calls[0].query.get('id'), 'PL1')
  assert.equal(calls[0].query.get('part'), 'snippet,status,contentDetails')
})

test('getPlaylist with no items throws playlist_private', async () => {
  const { client } = clientWith(() => ({ body: { items: [] } }))
  const err = await caught(() => client.getPlaylist('PL1'))
  assert.equal(err.code, 'playlist_private')
})

test('listPlaylistItemsPage returns items, token and total; passes the page token', async () => {
  const { client, calls } = clientWith(fixtureHandler)
  const page1 = await client.listPlaylistItemsPage('PL1')
  assert.equal(page1.items.length, 50)
  assert.equal(page1.nextPageToken, 'CDIQAA')
  assert.equal(page1.totalResults, 70)
  assert.deepEqual(page1.items[0], { videoId: 'vid00000000', position: 0 })
  assert.deepEqual(page1.items[49], { videoId: null, position: 49 })
  assert.equal(calls[0].query.get('playlistId'), 'PL1')
  assert.equal(calls[0].query.get('maxResults'), '50')
  assert.equal(calls[0].query.get('part'), 'contentDetails,snippet,status')
  assert.equal(calls[0].query.get('pageToken'), null)

  const page2 = await client.listPlaylistItemsPage('PL1', 'CDIQAA')
  assert.equal(calls[1].query.get('pageToken'), 'CDIQAA')
  assert.equal(page2.items.length, 20)
  assert.equal(page2.nextPageToken, null)
  assert.equal(page2.items[0].position, 50)
})

test('getVideos batches 120 ids as 50, 50 and 20 and returns a Map', async () => {
  const { client, calls } = clientWith((call) => {
    const ids = (call.query.get('id') ?? '').split(',')
    return {
      body: {
        items: ids
          .filter((id) => id !== 'gone0000001')
          .map((id) => ({ id, snippet: { title: id } })),
      },
    }
  })
  const ids = Array.from({ length: 120 }, (_, i) => `vid${String(i).padStart(8, '0')}`)
  ids[7] = 'gone0000001'
  const map = await client.getVideos(ids)
  assert.equal(calls.length, 3)
  assert.deepEqual(
    calls.map((c) => c.query.get('id')!.split(',').length),
    [50, 50, 20]
  )
  assert.equal(calls[0].query.get('part'), 'snippet,contentDetails,status,liveStreamingDetails')
  assert.equal(map.size, 119)
  assert.equal(map.has('gone0000001'), false)
  assert.ok(map.has('vid00000119'))
})

test('getVideos with no ids makes no call', async () => {
  const { client, calls } = clientWith(fixtureHandler)
  const map = await client.getVideos([])
  assert.equal(map.size, 0)
  assert.equal(calls.length, 0)
})

test('getVideos omits the id the mixed fixture leaves out', async () => {
  const { client } = clientWith(fixtureHandler)
  const body = fixture('videos-mixed.json')
  const map = await client.getVideos(body._requestedIds)
  assert.equal(map.size, 9)
  assert.equal(map.has('removedVid1'), false)
})

test('getVideos treats a 404 videoNotFound as no items', async () => {
  const { client } = clientWith(() => ({ status: 404, body: errorBody(404, 'videoNotFound') }))
  const map = await client.getVideos(['abcdefghijk'])
  assert.equal(map.size, 0)
})

test('requests use the header only: no key in the URL, no-store cache, v3 base', async () => {
  const { client, calls } = clientWith(fixtureHandler)
  await client.getPlaylist('PL1')
  await client.listPlaylistItemsPage('PL1', 'CDIQAA')
  await client.getVideos(['okPublic001'])
  assert.equal(calls.length, 3)
  for (const call of calls) {
    assert.ok(call.url.startsWith('https://www.googleapis.com/youtube/v3/'), call.url)
    assert.equal(call.query.has('key'), false)
    assert.equal(call.url.includes(KEY), false)
    assert.equal(call.headers['x-goog-api-key'], KEY)
    assert.equal(call.init.cache, 'no-store')
    assert.equal('next' in call.init, false)
  }
})

test('the client accepts no transport option', async () => {
  const fake = makeFakeFetch(fixtureHandler)
  const client = createYouTubeClient({
    apiKey: KEY,
    fetchImpl: fake.fetchImpl,
    // @ts-expect-error there is no keyTransport option
    keyTransport: 'query',
  })
  await client.getPlaylist('PL1')
  assert.equal(fake.calls[0].query.has('key'), false)
  assert.equal(fake.calls[0].headers['x-goog-api-key'], KEY)
})

const ERROR_CASES: Array<[string, number, string, string, string]> = [
  ['quotaExceeded fixture', 403, 'quotaExceeded', 'quota', 'playlists'],
  ['keyInvalid', 400, 'keyInvalid', 'key_rejected', 'playlists'],
  ['accessNotConfigured', 403, 'accessNotConfigured', 'api_not_allowed', 'videos'],
  ['forbidden', 403, 'forbidden', 'api_not_allowed', 'videos'],
  ['ipRefererBlocked', 403, 'ipRefererBlocked', 'api_not_allowed', 'videos'],
  ['playlistNotFound', 404, 'playlistNotFound', 'playlist_private', 'playlistItems'],
  ['playlistForbidden', 403, 'playlistForbidden', 'playlist_private', 'playlistItems'],
  ['playlistItemsNotAccessible', 403, 'playlistItemsNotAccessible', 'playlist_private', 'playlistItems'],
  ['playlistOperationUnsupported', 400, 'playlistOperationUnsupported', 'playlist_private', 'playlistItems'],
  ['5xx', 503, 'backendError', 'network', 'playlists'],
  ['unknown reason', 403, 'somethingNew', 'network', 'playlists'],
]

async function callFor(client: ReturnType<typeof createYouTubeClient>, path: string) {
  if (path === 'playlists') return client.getPlaylist('PL1')
  if (path === 'playlistItems') return client.listPlaylistItemsPage('PL1')
  return client.getVideos(['abcdefghijk'])
}

for (const [name, status, reason, code, path] of ERROR_CASES) {
  test(`error mapping: ${name} -> ${code}`, async () => {
    const { client } = clientWith(() => ({ status, body: errorBody(status, reason) }))
    const err = await caught(() => callFor(client, path))
    assert.equal(err.code, code)
    assert.equal(err.httpStatus, status)
  })
}

test('error mapping: the recorded quota and key-invalid fixtures', async () => {
  const quota = clientWith(() => ({ status: 403, body: fixture('error-quota.json') }))
  assert.equal((await caught(() => quota.client.getPlaylist('PL1'))).code, 'quota')
  const bad = clientWith(() => ({ status: 400, body: fixture('error-key-invalid.json') }))
  assert.equal((await caught(() => bad.client.getPlaylist('PL1'))).code, 'key_rejected')
})

test('error mapping: "API key not valid" message maps to key_rejected without a reason', async () => {
  const { client } = clientWith(() => ({
    status: 400,
    body: { error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } },
  }))
  assert.equal((await caught(() => client.getPlaylist('PL1'))).code, 'key_rejected')
})

test('error mapping: a throwing fetch and an unparseable body map to network', async () => {
  const thrown = clientWith(() => new Error(`connect failed https://www.googleapis.com/?k=${KEY}`))
  assert.equal((await caught(() => thrown.client.getPlaylist('PL1'))).code, 'network')
  const brokenFetch = (async () => new Response('not json', { status: 200 })) as typeof fetch
  const c = createYouTubeClient({ apiKey: KEY, fetchImpl: brokenFetch })
  assert.equal((await caught(() => c.getPlaylist('PL1'))).code, 'network')
})

test('no thrown error leaks the key or the host in message, string or JSON', async () => {
  const leaky = [
    clientWith(() => new Error(`boom ${KEY} https://www.googleapis.com/youtube/v3/x?key=${KEY}`)),
    clientWith(() => ({ status: 403, body: errorBody(403, 'quotaExceeded', `bad ${KEY} googleapis.com`) })),
    clientWith(() => ({ status: 400, body: errorBody(400, 'keyInvalid', `bad ${KEY} googleapis.com`) })),
    clientWith(() => ({ status: 500, body: errorBody(500, `r-${KEY}`, `bad ${KEY}`) })),
    clientWith(() => ({ status: 403, body: errorBody(403, `r-${KEY}`, `bad ${KEY}`) })),
  ]
  for (const { client } of leaky) {
    const err = await caught(() => client.getPlaylist('PL1'))
    for (const text of [err.message, String(err), JSON.stringify(err)]) {
      assert.equal(text.includes(KEY), false, text)
      assert.equal(text.includes('googleapis.com'), false, text)
    }
  }
})

test('YouTubeApiError carries a fixed plain message per code', () => {
  for (const code of YOUTUBE_API_ERROR_CODES) {
    const err = new YouTubeApiError(code, null, null)
    assert.equal(err.code, code)
    assert.ok(err.message.length > 0)
    assert.equal(err.name, 'YouTubeApiError')
  }
})
