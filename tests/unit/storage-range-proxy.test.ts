import assert from 'node:assert/strict'
import { test } from 'node:test'

import { proxyStorageObject } from '../../src/lib/storage-range-proxy.ts'
import { toCdnStorageUrl } from '../../src/lib/supabase-media.ts'

const TARGET = new URL(
  'https://example.supabase.co/storage/v1/object/public/show-artwork/hero.mp4'
)

function byteStream(length: number, onCancel?: () => void) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(length))
      controller.close()
    },
    cancel() {
      onCancel?.()
    },
  })
}

test('streams exactly 1,024 validated bytes for bytes=0-1023', async () => {
  let forwardedRange: string | null = null
  let forwardedEncoding: string | null = null
  let forwardedCache: RequestCache | undefined

  const response = await proxyStorageObject({
    target: TARGET,
    range: 'bytes=0-1023',
    fetchImpl: async (_input, init) => {
      const headers = new Headers(init?.headers)
      forwardedRange = headers.get('range')
      forwardedEncoding = headers.get('accept-encoding')
      forwardedCache = init?.cache
      return new Response(byteStream(1024), {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': '1024',
          'Content-Range': 'bytes 0-1023/4096',
          'Content-Type': 'video/mp4',
          ETag: '"hero-v1"',
          'Last-Modified': 'Sat, 18 Jul 2026 10:00:00 GMT',
        },
      })
    },
  })

  assert.equal(forwardedRange, 'bytes=0-1023')
  assert.equal(forwardedEncoding, 'identity')
  assert.equal(forwardedCache, 'no-store')
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 0-1023/4096')
  assert.equal(response.headers.get('content-length'), '1024')
  assert.equal(response.headers.get('accept-ranges'), 'bytes')
  assert.equal(response.headers.get('etag'), '"hero-v1"')
  assert.equal(
    response.headers.get('last-modified'),
    'Sat, 18 Jul 2026 10:00:00 GMT'
  )
  assert.equal(response.headers.get('vary'), 'Range')
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=0, must-revalidate'
  )
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store')
  assert.equal((await response.arrayBuffer()).byteLength, 1024)
})

for (const range of ['bytes=broken', 'bytes=0-10,20-30']) {
  test(`rejects ${range} before fetching upstream`, async () => {
    let fetchCount = 0
    const response = await proxyStorageObject({
      target: TARGET,
      range,
      fetchImpl: async () => {
        fetchCount += 1
        return new Response()
      },
    })

    assert.equal(response.status, 416)
    assert.equal(fetchCount, 0)
  })
}

test('preserves an upstream 416 and its unsatisfied Content-Range', async () => {
  const response = await proxyStorageObject({
    target: TARGET,
    range: 'bytes=9999-',
    fetchImpl: async () =>
      new Response(null, {
        status: 416,
        headers: { 'Content-Range': 'bytes */4096' },
      }),
  })

  assert.equal(response.status, 416)
  assert.equal(response.headers.get('content-range'), 'bytes */4096')
})

for (const upstream of [
  { name: 'ignored range', status: 200, contentRange: null, length: '4096' },
  {
    name: 'missing Content-Range',
    status: 206,
    contentRange: null,
    length: '1024',
  },
  {
    name: 'malformed Content-Range',
    status: 206,
    contentRange: 'nope',
    length: '1024',
  },
  {
    name: 'mismatched Content-Length',
    status: 206,
    contentRange: 'bytes 0-1023/4096',
    length: '4096',
  },
]) {
  test(`cancels an upstream body for ${upstream.name}`, async () => {
    let cancelled = false
    const headers = new Headers({ 'Content-Length': upstream.length })
    if (upstream.contentRange)
      headers.set('Content-Range', upstream.contentRange)

    const response = await proxyStorageObject({
      target: TARGET,
      range: 'bytes=0-1023',
      fetchImpl: async () =>
        new Response(
          byteStream(Number(upstream.length), () => {
            cancelled = true
          }),
          {
            status: upstream.status,
            headers,
          }
        ),
    })

    assert.equal(response.status, 502)
    assert.equal(cancelled, true)
  })
}

test('streams a full 200 response without buffering it', async () => {
  let revalidate: number | undefined
  const upstream = new Response(byteStream(12), {
    status: 200,
    headers: {
      'Content-Length': '12',
      'Content-Type': 'video/mp4',
    },
  })
  upstream.arrayBuffer = async () => {
    throw new Error('arrayBuffer must not be called on the upstream response')
  }
  upstream.blob = async () => {
    throw new Error('blob must not be called on the upstream response')
  }
  upstream.text = async () => {
    throw new Error('text must not be called on the upstream response')
  }

  const response = await proxyStorageObject({
    target: TARGET,
    range: null,
    fetchImpl: async (_input, init) => {
      revalidate = init?.next?.revalidate
      return upstream
    },
  })

  assert.equal(response.status, 200)
  assert.equal(revalidate, 2_592_000)
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400'
  )
  assert.equal(response.headers.get('vercel-cdn-cache-control'), null)
  assert.equal((await response.arrayBuffer()).byteLength, 12)
})

test('keeps the public CDN URL contract and avoids nested proxy URLs', () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'

  try {
    const storageUrl =
      'https://example.supabase.co/storage/v1/object/public/show-artwork/hero.mp4?v=7'
    assert.equal(
      toCdnStorageUrl(storageUrl),
      '/api/cdn/storage?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fshow-artwork%2Fhero.mp4'
    )
    assert.equal(
      toCdnStorageUrl('/api/cdn/storage?url=https%3A%2F%2Fexample.supabase.co'),
      '/api/cdn/storage?url=https%3A%2F%2Fexample.supabase.co'
    )
    assert.equal(
      toCdnStorageUrl('https://cdn.example.com/hero.mp4'),
      'https://cdn.example.com/hero.mp4'
    )
  } finally {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    }
  }
})
