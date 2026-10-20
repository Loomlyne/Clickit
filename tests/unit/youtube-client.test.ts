// YouTube Data API v3 client: fixtures are hand-written in the documented
// shapes (not recorded); no live API call is ever made.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

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
