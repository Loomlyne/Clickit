import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MEDIA_BUCKETS,
  MEDIA_CSP,
  PUBLIC_MEDIA_BUCKETS,
  UNVERSIONED_CACHE_CONTROL,
  VARIANT_WIDTHS,
  VERSIONED_CACHE_CONTROL,
  cacheControlFor,
  handleMediaRequest,
  parseMediaPath,
  variantCandidates,
  type MediaBucket,
  type MediaFetch,
  type MediaObject,
} from '../../workers/media/src/handler.ts'

const SUPABASE_URL = 'https://example.supabase.co'
const BASE = 'https://media.clickitstory.ae'

type FetchCall = { input: string; init?: RequestInit }

function stream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function recordingFetch(response: () => Response) {
  const calls: FetchCall[] = []
  const fetchImpl: MediaFetch = async (input, init) => {
    calls.push({ input, init })
    return response()
  }
  return { calls, fetchImpl }
}

function failingFetch(): MediaFetch {
  return async () => {
    throw new Error('origin must not be called')
  }
}

function r2Object(
  bytes: Uint8Array,
  extra: Partial<MediaObject> = {}
): MediaObject {
  return {
    size: bytes.byteLength,
    etag: 'abc',
    httpEtag: '"abc"',
    uploaded: new Date('2026-10-01T00:00:00Z'),
    httpMetadata: { contentType: 'image/png' },
    body: stream(bytes),
    ...extra,
  }
}

function bucketWith(objects: Record<string, MediaObject>) {
  const calls: { method: string; key: string; range?: string | null }[] = []
  const bucket: MediaBucket = {
    async head(key) {
      calls.push({ method: 'head', key })
      const object = objects[key]
      return object ? { ...object, body: undefined } : null
    },
    async get(key, options) {
      calls.push({ method: 'get', key, range: options?.range?.get('range') })
      return objects[key] ?? null
    },
  }
  return { bucket, calls }
}

test('parseMediaPath accepts allow-listed buckets and nested keys', () => {
  assert.deepEqual(
    parseMediaPath('/site-assets/settings/social-icons/1784201845725.png'),
    { bucket: 'site-assets', key: 'settings/social-icons/1784201845725.png' }
  )
  assert.deepEqual(parseMediaPath('/show-artwork/a%20b.jpg'), {
    bucket: 'show-artwork',
    key: 'a b.jpg',
  })
})

test('parseMediaPath rejects unknown buckets, traversal and empty keys', () => {
  for (const path of [
    '/',
    '/site-assets',
    '/site-assets/',
    '/private/x.png',
    '/site-assets/../avatars/x.png',
    '/site-assets/%2e%2e/x.png',
    '/site-assets/a%2Fb.png',
    '/site-assets//x.png',
    '/site-assets/%E0%A4%A.png',
  ]) {
    assert.equal(parseMediaPath(path), null, path)
  }
})

test('rejects other methods with 405', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/x.png`, { method: 'POST' }),
    { SUPABASE_URL },
    failingFetch()
  )
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('allow'), 'GET, HEAD')
})

test('unknown bucket is 404 without touching the origin', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/secrets/x.png`),
    { SUPABASE_URL },
    failingFetch()
  )
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('serves from R2 first with security and cache headers', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  const { bucket, calls } = bucketWith({
    'site-assets/settings/favicon.png': r2Object(bytes),
  })

  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/settings/favicon.png?v=1780693451111`),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )

  assert.equal(response.status, 200)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  assert.equal(calls[0].key, 'site-assets/settings/favicon.png')
  assert.equal(response.headers.get('x-media-source'), 'r2')
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('content-length'), '4')
  assert.equal(response.headers.get('cache-control'), VERSIONED_CACHE_CONTROL)
  assert.equal(response.headers.get('content-security-policy'), MEDIA_CSP)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('etag'), '"abc"')
})

test('R2 range request returns 206 with Content-Range', async () => {
  const { bucket, calls } = bucketWith({
    'show-artwork/hero.mp4': r2Object(new Uint8Array(10), {
      size: 100,
      range: { offset: 10, length: 10 },
      httpMetadata: { contentType: 'video/mp4' },
    }),
  })

  const response = await handleMediaRequest(
    new Request(`${BASE}/show-artwork/hero.mp4`, {
      headers: { range: 'bytes=10-19' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )

  assert.equal(response.status, 206)
  assert.equal(calls[0].range, 'bytes=10-19')
  assert.equal(response.headers.get('content-range'), 'bytes 10-19/100')
  assert.equal(response.headers.get('content-length'), '10')
  assert.equal(response.headers.get('cache-control'), UNVERSIONED_CACHE_CONTROL)
})

test('R2 suffix range maps to the object tail', async () => {
  const { bucket } = bucketWith({
    'show-artwork/hero.mp4': r2Object(new Uint8Array(5), {
      size: 100,
      range: { suffix: 5 },
    }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/show-artwork/hero.mp4`, {
      headers: { range: 'bytes=-5' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 95-99/100')
})

test('R2 HEAD uses head() and returns no body', async () => {
  const { bucket, calls } = bucketWith({
    'avatars/u/1.webp': r2Object(new Uint8Array(7), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'max-age=5' },
    }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/avatars/u/1.webp`, { method: 'HEAD' }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 200)
  assert.equal(calls[0].method, 'head')
  assert.equal(response.body, null)
  assert.equal(response.headers.get('content-length'), '7')
  // Stored R2 cacheControl is ignored (the app has written invalid values).
  assert.equal(response.headers.get('cache-control'), UNVERSIONED_CACHE_CONTROL)
})

test('R2 precondition hit returns 304', async () => {
  const { bucket } = bucketWith({
    'site-assets/a.png': r2Object(new Uint8Array(3), { body: null }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { 'if-none-match': '"abc"' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 304)
})

test('R2 miss falls back to the Supabase original', async () => {
  const { bucket } = bucketWith({})
  const { calls, fetchImpl } = recordingFetch(
    () =>
      new Response(new Uint8Array([9, 9]), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '2',
          'cache-control': 'no-cache',
          etag: '"s1"',
          'set-cookie': 'x=1',
        },
      })
  )

  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/settings/og.png?v=1780693919681`),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    fetchImpl
  )

  assert.equal(response.status, 200)
  assert.equal(
    calls[0].input,
    `${SUPABASE_URL}/storage/v1/object/public/site-assets/settings/og.png?v=1780693919681`
  )
  assert.equal(response.headers.get('x-media-source'), 'supabase')
  assert.equal(response.headers.get('cache-control'), VERSIONED_CACHE_CONTROL)
  assert.equal(response.headers.get('etag'), '"s1"')
  assert.equal(response.headers.get('set-cookie'), null)
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([9, 9])
  )
})

test('works with no R2 binding and forwards Range to Supabase', async () => {
  const { calls, fetchImpl } = recordingFetch(
    () =>
      new Response(new Uint8Array(10), {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-range': 'bytes 0-9/4096',
          'content-length': '10',
        },
      })
  )

  const response = await handleMediaRequest(
    new Request(`${BASE}/show-artwork/a%20b/hero.mp4`, {
      headers: { range: 'bytes=0-9', cookie: 'session=secret' },
    }),
    { SUPABASE_URL },
    fetchImpl
  )

  assert.equal(response.status, 206)
  assert.equal(
    calls[0].input,
    `${SUPABASE_URL}/storage/v1/object/public/show-artwork/a%20b/hero.mp4`
  )
  const forwarded = new Headers(calls[0].init?.headers)
  assert.equal(forwarded.get('range'), 'bytes=0-9')
  assert.equal(forwarded.get('cookie'), null)
  assert.equal(response.headers.get('content-range'), 'bytes 0-9/4096')
})

test('R2 errors fall back to Supabase instead of failing', async () => {
  const bucket: MediaBucket = {
    async head() {
      throw new Error('r2 down')
    },
    async get() {
      throw new Error('r2 down')
    },
  }
  const { fetchImpl } = recordingFetch(
    () => new Response('x', { status: 200, headers: { 'content-type': 'image/png' } })
  )
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    fetchImpl
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-media-source'), 'supabase')
})

test('Supabase 400 (missing object) becomes 404, 5xx becomes 502', async () => {
  const missing = await handleMediaRequest(
    new Request(`${BASE}/site-assets/nope.png`),
    { SUPABASE_URL },
    recordingFetch(() => new Response('{}', { status: 400 })).fetchImpl
  )
  assert.equal(missing.status, 404)

  const broken = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`),
    { SUPABASE_URL },
    recordingFetch(() => new Response('x', { status: 503 })).fetchImpl
  )
  assert.equal(broken.status, 502)
})

test('SVG from Supabase keeps image/svg+xml under the sandbox CSP', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/logo.svg`),
    { SUPABASE_URL },
    recordingFetch(
      () =>
        new Response('<svg/>', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        })
    ).fetchImpl
  )
  assert.equal(response.headers.get('content-type'), 'image/svg+xml')
  assert.match(response.headers.get('content-security-policy') ?? '', /sandbox/)
})

test('HEAD fallback returns no body', async () => {
  const { calls, fetchImpl } = recordingFetch(
    () =>
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '812985' },
      })
  )
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/settings/favicon.png`, { method: 'HEAD' }),
    { SUPABASE_URL },
    fetchImpl
  )
  assert.equal(calls[0].init?.method, 'HEAD')
  assert.equal(response.status, 200)
  assert.equal(response.body, null)
  assert.equal(response.headers.get('content-length'), '812985')
})

test('healthz answers ok', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/healthz`),
    { SUPABASE_URL },
    failingFetch()
  )
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'ok')
})

test('stored R2 cacheControl is ignored on GET too', async () => {
  const { bucket } = bucketWith({
    'avatars/u/2.png': r2Object(new Uint8Array(2), {
      httpMetadata: { contentType: 'image/png', cacheControl: '31536000' },
    }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/avatars/u/2.png?v=9`),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.headers.get('cache-control'), VERSIONED_CACHE_CONTROL)
})

test('R2 failed If-Match returns 412, not 304', async () => {
  const { bucket } = bucketWith({
    'site-assets/a.png': r2Object(new Uint8Array(3), { body: null }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { 'if-match': '"other"' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 412)
})

test('matching If-None-Match with a passing If-Match stays 304', async () => {
  const { bucket } = bucketWith({
    'site-assets/a.png': r2Object(new Uint8Array(3), { body: null }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { 'if-match': '"abc"', 'if-none-match': '"abc"' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 304)
})

test('If-Unmodified-Since before the upload returns 412; after it 304', async () => {
  const { bucket } = bucketWith({
    'site-assets/a.png': r2Object(new Uint8Array(3), { body: null }),
  })
  const before = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { 'if-unmodified-since': 'Tue, 01 Sep 2026 00:00:00 GMT' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(before.status, 412)

  const after = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: {
        'if-unmodified-since': 'Thu, 01 Oct 2026 00:00:00 GMT',
        'if-none-match': '"abc"',
      },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(after.status, 304)
})

test('R2 range length is capped at the object end', async () => {
  const { bucket } = bucketWith({
    'show-artwork/hero.mp4': r2Object(new Uint8Array(10), {
      size: 100,
      range: { offset: 95, length: 50 },
    }),
  })
  const response = await handleMediaRequest(
    new Request(`${BASE}/show-artwork/hero.mp4`, {
      headers: { range: 'bytes=95-144' },
    }),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    failingFetch()
  )
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 95-99/100')
  assert.equal(response.headers.get('content-length'), '5')
})

test('only the v query param reaches Supabase; errors are not edge-cached', async () => {
  const { calls, fetchImpl } = recordingFetch(
    () => new Response('x', { status: 200, headers: { 'content-type': 'image/png' } })
  )
  await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png?utm=1&v=7&x=2`),
    { SUPABASE_URL },
    fetchImpl
  )
  await handleMediaRequest(
    new Request(`${BASE}/site-assets/b.png?utm=1`),
    { SUPABASE_URL },
    fetchImpl
  )
  assert.equal(
    calls[0].input,
    `${SUPABASE_URL}/storage/v1/object/public/site-assets/a.png?v=7`
  )
  assert.equal(
    calls[1].input,
    `${SUPABASE_URL}/storage/v1/object/public/site-assets/b.png`
  )
  const cf = (calls[0].init as { cf?: Record<string, unknown> }).cf
  assert.deepEqual(cf?.cacheTtlByStatus, {
    '200-299': 86400,
    '300-399': -1,
    '400': 60,
    '401-403': -1,
    '404': 60,
    '405-599': -1,
  })
  assert.equal(cf?.cacheTtl, undefined)
})

test('cookies and auth headers are not forwarded or passed back', async () => {
  const { calls, fetchImpl } = recordingFetch(
    () =>
      new Response('x', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'set-cookie': 'sb=1',
          'www-authenticate': 'Bearer',
        },
      })
  )
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { authorization: 'Bearer secret', cookie: 'a=b' },
    }),
    { SUPABASE_URL },
    fetchImpl
  )
  const forwarded = new Headers(calls[0].init?.headers)
  assert.equal(forwarded.get('authorization'), null)
  assert.equal(forwarded.get('cookie'), null)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('www-authenticate'), null)
})

test('upstream redirect becomes 502', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`),
    { SUPABASE_URL },
    recordingFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/x.png' },
        })
    ).fetchImpl
  )
  assert.equal(response.status, 502)
  assert.equal(response.headers.get('location'), null)
})

test('upstream 416 passes through with a short cache', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/a.png`, {
      headers: { range: 'bytes=999999-' },
    }),
    { SUPABASE_URL },
    recordingFetch(
      () =>
        new Response(null, {
          status: 416,
          headers: { 'content-range': 'bytes */10' },
        })
    ).fetchImpl
  )
  assert.equal(response.status, 416)
  assert.equal(response.headers.get('content-range'), 'bytes */10')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60')
})

test('content-length is dropped when upstream body was content-encoded', async () => {
  const response = await handleMediaRequest(
    new Request(`${BASE}/site-assets/logo.svg`),
    { SUPABASE_URL },
    recordingFetch(
      () =>
        new Response('<svg/>', {
          status: 200,
          headers: {
            'content-type': 'image/svg+xml',
            'content-encoding': 'gzip',
            'content-length': '3',
          },
        })
    ).fetchImpl
  )
  assert.equal(response.headers.get('content-length'), null)
  assert.equal(response.headers.get('content-encoding'), null)
})

test('double-encoded dots stay a literal key; encoded backslash is rejected', async () => {
  assert.deepEqual(parseMediaPath('/site-assets/%252e%252e/x.png'), {
    bucket: 'site-assets',
    key: '%2e%2e/x.png',
  })
  const { calls, fetchImpl } = recordingFetch(
    () => new Response('x', { status: 200, headers: { 'content-type': 'image/png' } })
  )
  await handleMediaRequest(
    new Request(`${BASE}/site-assets/%252e%252e/x.png`),
    { SUPABASE_URL },
    fetchImpl
  )
  assert.equal(
    calls[0].input,
    `${SUPABASE_URL}/storage/v1/object/public/site-assets/%252e%252e/x.png`
  )
  assert.equal(parseMediaPath('/site-assets/a%5Cb.png'), null)
  assert.equal(parseMediaPath('/site-assets/%5C..%5Cx.png'), null)
})

test('media-health extracts direct and /_next/image-wrapped media URLs', async () => {
  const { extractMediaUrls, rewriteOrigin, supabaseOriginalUrl } = await import(
    '../../scripts/media-health.mjs'
  )
  const html = [
    '<link rel="icon" href="https://media.clickitstory.ae/site-assets/settings/favicon.png?v=1"/>',
    '<img src="/_next/image?url=https%3A%2F%2Fmedia.clickitstory.ae%2Fshow-artwork%2Fa%2Fb.jpg%3Fv%3D2&amp;w=640&amp;q=75"/>',
    '"https://media.clickitstory.ae/site-assets/settings/social-icons/1.png\\"',
    '<img src="https://media.clickitstory.ae/private/x.png"/>',
  ].join('\n')

  assert.deepEqual(extractMediaUrls(html).sort(), [
    'https://media.clickitstory.ae/show-artwork/a/b.jpg?v=2',
    'https://media.clickitstory.ae/site-assets/settings/favicon.png?v=1',
    'https://media.clickitstory.ae/site-assets/settings/social-icons/1.png',
  ])
  assert.equal(
    rewriteOrigin(
      'https://media.clickitstory.ae/site-assets/a.png?v=1',
      'https://clickit-media.example.workers.dev'
    ),
    'https://clickit-media.example.workers.dev/site-assets/a.png?v=1'
  )
  assert.equal(
    supabaseOriginalUrl('https://media.clickitstory.ae/site-assets/a.png?v=1'),
    'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/a.png'
  )
})

// ---------------------------------------------------------------------------
// Plan 02-03: spec behaviors layered on the existing media Worker (one Worker).
// The fake bucket below applies Range and onlyIf like R2 does.
// ---------------------------------------------------------------------------

type Stored = { bytes: Uint8Array; contentType: string; etag?: string }

function fakeR2(store: Record<string, Stored>) {
  const calls: { method: string; key: string }[] = []

  function build(key: string, withBody: boolean, options?: { range?: Headers; onlyIf?: Headers }) {
    const item = store[key]
    if (!item) return null
    const etag = item.etag ?? 'e1'
    const object: MediaObject = {
      size: item.bytes.byteLength,
      etag,
      httpEtag: `"${etag}"`,
      uploaded: new Date('2026-10-01T00:00:00Z'),
      httpMetadata: { contentType: item.contentType },
    }
    if (!withBody) return object

    const onlyIf = options?.onlyIf
    const inm = onlyIf?.get('if-none-match')
    const im = onlyIf?.get('if-match')
    if ((inm && inm === object.httpEtag) || (im && im !== object.httpEtag)) {
      return { ...object, body: undefined }
    }

    let bytes = item.bytes
    const rangeHeader = options?.range?.get('range')
    const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader) : null
    if (match) {
      if (match[1] === '') {
        const suffix = Number(match[2])
        bytes = item.bytes.slice(Math.max(0, item.bytes.byteLength - suffix))
        object.range = { suffix }
      } else {
        const offset = Number(match[1])
        const end = match[2] === '' ? item.bytes.byteLength - 1 : Number(match[2])
        bytes = item.bytes.slice(offset, end + 1)
        object.range = { offset, length: bytes.byteLength }
      }
    }
    object.body = stream(bytes)
    return object
  }

  const bucket: MediaBucket = {
    async head(key) {
      calls.push({ method: 'head', key })
      return build(key, false)
    },
    async get(key, options) {
      calls.push({ method: 'get', key })
      return build(key, true, options)
    },
  }
  return { bucket, calls }
}

function bigBytes(size: number) {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = i % 251
  return bytes
}

async function call(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
  bucket?: MediaBucket,
  fetchImpl: MediaFetch = failingFetch()
) {
  return handleMediaRequest(
    new Request(`${BASE}${path}`, init),
    { SUPABASE_URL, MEDIA_BUCKET: bucket },
    fetchImpl
  )
}

test('02-03 MEDIA_BUCKETS is the exact public bucket allowlist', () => {
  assert.deepEqual([...MEDIA_BUCKETS].sort(), ['avatars', 'show-artwork', 'site-assets'])
  assert.equal(MEDIA_BUCKETS, PUBLIC_MEDIA_BUCKETS)
  assert.deepEqual([...VARIANT_WIDTHS], [640, 1280, 1920])
})

test('02-03 405 with Allow: GET, HEAD for POST, PUT and DELETE', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await call('/show-artwork/a.jpg', { method })
    assert.equal(response.status, 405, method)
    assert.equal(response.headers.get('allow'), 'GET, HEAD', method)
  }
})

test('02-03 404 for root, unknown bucket, empty key, traversal and direct variant paths', async () => {
  const { bucket, calls } = fakeR2({
    'show-artwork/a.jpg': { bytes: bigBytes(10), contentType: 'image/jpeg' },
    '_v/640/webp/show-artwork/a.jpg': { bytes: bigBytes(10), contentType: 'image/webp' },
  })
  for (const path of [
    '/',
    '/unknown-bucket/a.jpg',
    '/show-artwork/',
    '/show-artwork/../x',
    '/show-artwork/a//b.jpg',
    '/show-artwork/%2e%2e/x',
    '/show-artwork/%2E%2E/x',
    '/_v/640/webp/show-artwork/a.jpg',
  ]) {
    const response = await call(path, {}, bucket)
    assert.equal(response.status, 404, path)
  }
  assert.equal(calls.length, 0, 'no bucket read for rejected paths')
})

test('02-03 200 GET has body, etag, accept-ranges, nosniff, CORP and 3600 cache', async () => {
  const bytes = bigBytes(300)
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes, contentType: 'image/jpeg' } })
  const response = await call('/show-artwork/a.jpg', {}, bucket)
  assert.equal(response.status, 200)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  assert.equal(response.headers.get('etag'), '"e1"')
  assert.equal(response.headers.get('accept-ranges'), 'bytes')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
  assert.equal(response.headers.get('vary'), null)
})

test('02-03 ?v= gives one-year immutable cache', async () => {
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes: bigBytes(5), contentType: 'image/jpeg' } })
  const response = await call('/show-artwork/a.jpg?v=123', {}, bucket)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
})

test('02-03 cacheControlFor rule', () => {
  assert.equal(cacheControlFor(new URL(`${BASE}/a/b`), false), 'public, max-age=3600')
  assert.equal(cacheControlFor(new URL(`${BASE}/a/b?v=1`), false), VERSIONED_CACHE_CONTROL)
  assert.equal(cacheControlFor(new URL(`${BASE}/a/b`), true), VERSIONED_CACHE_CONTROL)
})

test('02-03 Range bytes=0-1023 on a 5000-byte object is 206 with Content-Range', async () => {
  const bytes = bigBytes(5000)
  const { bucket } = fakeR2({ 'show-artwork/hero.mp4': { bytes, contentType: 'video/mp4' } })
  const response = await call('/show-artwork/hero.mp4', { headers: { range: 'bytes=0-1023' } }, bucket)
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 0-1023/5000')
  assert.equal(response.headers.get('content-length'), '1024')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(0, 1024))
})

test('02-03 suffix range bytes=-500 is 206 with the tail', async () => {
  const bytes = bigBytes(5000)
  const { bucket } = fakeR2({ 'show-artwork/hero.mp4': { bytes, contentType: 'video/mp4' } })
  const response = await call('/show-artwork/hero.mp4', { headers: { range: 'bytes=-500' } }, bucket)
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 4500-4999/5000')
  assert.equal(response.headers.get('content-length'), '500')
})

test('02-03 If-None-Match equal to the etag is 304, empty body, etag kept', async () => {
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes: bigBytes(20), contentType: 'image/jpeg' } })
  const response = await call('/show-artwork/a.jpg', { headers: { 'if-none-match': '"e1"' } }, bucket)
  assert.equal(response.status, 304)
  assert.equal(response.headers.get('etag'), '"e1"')
  assert.equal((await response.text()), '')
})

test('02-03 If-Match mismatch is 412', async () => {
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes: bigBytes(20), contentType: 'image/jpeg' } })
  const response = await call('/show-artwork/a.jpg', { headers: { 'if-match': '"other"' } }, bucket)
  assert.equal(response.status, 412)
})

test('02-03 HEAD returns the GET headers and a null body', async () => {
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes: bigBytes(42), contentType: 'image/jpeg' } })
  const get = await call('/show-artwork/a.jpg?v=1', {}, bucket)
  const head = await call('/show-artwork/a.jpg?v=1', { method: 'HEAD' }, bucket)
  await get.arrayBuffer()
  assert.equal(head.status, 200)
  assert.equal(head.body, null)
  assert.equal(head.headers.get('content-length'), '42')
  for (const name of [
    'etag',
    'accept-ranges',
    'cache-control',
    'content-type',
    'x-content-type-options',
    'cross-origin-resource-policy',
    'content-length',
  ]) {
    assert.equal(head.headers.get(name), get.headers.get(name), name)
  }
})

const VARIANT_STORE = (): Record<string, Stored> => ({
  'show-artwork/a.jpg': { bytes: bigBytes(100), contentType: 'image/jpeg' },
  '_v/1280/avif/show-artwork/a.jpg': { bytes: bigBytes(30), contentType: 'image/avif', etag: 'va' },
  '_v/1280/webp/show-artwork/a.jpg': { bytes: bigBytes(40), contentType: 'image/webp', etag: 'vw' },
})

test('02-03 variantCandidates orders avif, webp, original and honours q=0', () => {
  assert.deepEqual(variantCandidates('show-artwork/a.jpg', 1280, 'image/avif,image/webp,*/*'), [
    '_v/1280/avif/show-artwork/a.jpg',
    '_v/1280/webp/show-artwork/a.jpg',
    'show-artwork/a.jpg',
  ])
  assert.deepEqual(variantCandidates('show-artwork/a.jpg', 1280, 'image/webp'), [
    '_v/1280/webp/show-artwork/a.jpg',
    'show-artwork/a.jpg',
  ])
  assert.deepEqual(variantCandidates('show-artwork/a.jpg', 1280, 'image/avif;q=0, image/webp'), [
    '_v/1280/webp/show-artwork/a.jpg',
    'show-artwork/a.jpg',
  ])
  assert.deepEqual(variantCandidates('show-artwork/a.jpg', 1280, ''), ['show-artwork/a.jpg'])
  assert.deepEqual(variantCandidates('show-artwork/a.jpg', 999, 'image/avif'), ['show-artwork/a.jpg'])
})

test('02-03 ?w=1280 with avif+webp Accept serves the avif variant, Vary Accept, immutable', async () => {
  const { bucket } = fakeR2(VARIANT_STORE())
  const response = await call(
    '/show-artwork/a.jpg?w=1280',
    { headers: { accept: 'image/avif,image/webp,image/*' } },
    bucket
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/avif')
  assert.equal(response.headers.get('etag'), '"va"')
  assert.equal(response.headers.get('vary'), 'Accept')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal((await response.arrayBuffer()).byteLength, 30)
})

test('02-03 ?w=1280 with webp-only Accept serves the webp variant', async () => {
  const { bucket } = fakeR2(VARIANT_STORE())
  const response = await call('/show-artwork/a.jpg?w=1280', { headers: { accept: 'image/webp' } }, bucket)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('vary'), 'Accept')
})

test('02-03 ?w=1280 with variants missing serves the original with Vary Accept', async () => {
  const { bucket } = fakeR2({ 'show-artwork/a.jpg': { bytes: bigBytes(100), contentType: 'image/jpeg' } })
  const response = await call(
    '/show-artwork/a.jpg?w=1280',
    { headers: { accept: 'image/avif,image/webp' } },
    bucket
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.equal(response.headers.get('vary'), 'Accept')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
})

test('02-03 ?w=999 serves the original and never looks up a variant', async () => {
  const { bucket, calls } = fakeR2(VARIANT_STORE())
  const response = await call('/show-artwork/a.jpg?w=999', { headers: { accept: 'image/avif' } }, bucket)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(calls.map((c) => c.key), ['show-artwork/a.jpg'])
  assert.equal(response.headers.get('vary'), null)
})

test('02-03 variant range request is 206 from the variant bytes', async () => {
  const { bucket } = fakeR2(VARIANT_STORE())
  const response = await call(
    '/show-artwork/a.jpg?w=1280',
    { headers: { accept: 'image/avif', range: 'bytes=0-9' } },
    bucket
  )
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 0-9/30')
})

test('02-03 stored image/svg+xml gets the sandbox CSP and inline disposition', async () => {
  const { bucket } = fakeR2({
    'site-assets/logo.svg': { bytes: new TextEncoder().encode('<svg onload="x()"/>'), contentType: 'image/svg+xml' },
  })
  const response = await call('/site-assets/logo.svg', {}, bucket)
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  assert.equal(response.headers.get('content-disposition'), 'inline')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('02-03 original missing is 404 even with ?w=, variants are never read from Supabase', async () => {
  const { bucket } = fakeR2({})
  const { calls, fetchImpl } = recordingFetch(() => new Response('{}', { status: 400 }))
  const response = await call(
    '/show-artwork/gone.jpg?w=640',
    { headers: { accept: 'image/avif' } },
    bucket,
    fetchImpl
  )
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('vary'), 'Accept')
  assert.equal(calls.length, 1)
  assert.ok(!calls[0].input.includes('_v/'), calls[0].input)
})

test('02-03 original in Supabase but not R2 is still served with ?w= (permanent fallback)', async () => {
  const { bucket } = fakeR2({})
  const { fetchImpl } = recordingFetch(
    () => new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  )
  const response = await call('/show-artwork/a.jpg?w=640', { headers: { accept: 'image/webp' } }, bucket, fetchImpl)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('vary'), 'Accept')
})
