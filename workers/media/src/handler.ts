/**
 * media.clickitstory.ae: serves public media at `/<bucket>/<key>`.
 *
 * R2 first (bucket layout `<bucket>/<key>`, binding optional so the Worker
 * also runs before R2 is enabled), then the Supabase public original.
 * Read-only: GET and HEAD only, allow-listed buckets only.
 */

export const PUBLIC_MEDIA_BUCKETS: ReadonlySet<string> = new Set([
  'show-artwork',
  'site-assets',
  'avatars',
])

// Images are rendered as images; SVG opened directly cannot run script.
export const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

export const VERSIONED_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const UNVERSIONED_CACHE_CONTROL =
  'public, max-age=86400, stale-while-revalidate=604800'
const ERROR_CACHE_CONTROL = 'public, max-age=60'

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'etag',
  'last-modified',
]

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  webm: 'video/webm',
  webp: 'image/webp',
}

/** The subset of the Workers R2 API this Worker uses. */
export interface MediaObject {
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: { contentType?: string; cacheControl?: string }
  range?: { offset?: number; length?: number; suffix?: number }
  body?: ReadableStream | null
}

export interface MediaBucket {
  head(key: string): Promise<MediaObject | null>
  get(
    key: string,
    options?: { range?: Headers; onlyIf?: Headers }
  ): Promise<MediaObject | null>
}

export interface MediaEnv {
  MEDIA_BUCKET?: MediaBucket
  SUPABASE_URL: string
}

export type MediaFetch = (
  input: string,
  init?: RequestInit & { cf?: Record<string, unknown> }
) => Promise<Response>

export type MediaPath = { bucket: string; key: string }

export function parseMediaPath(pathname: string): MediaPath | null {
  const segments = pathname.split('/').slice(1)
  if (segments.length < 2) return null

  let decoded: string[]
  try {
    decoded = segments.map((segment) => decodeURIComponent(segment))
  } catch {
    return null
  }

  if (
    decoded.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        segment.includes('\0')
    )
  ) {
    return null
  }

  const [bucket, ...keyParts] = decoded
  if (!PUBLIC_MEDIA_BUCKETS.has(bucket)) return null

  return { bucket, key: keyParts.join('/') }
}

export function guessContentType(key: string) {
  const extension = key.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

export function cacheControlFor(url: URL, stored?: string | null) {
  if (stored) return stored
  return url.searchParams.has('v')
    ? VERSIONED_CACHE_CONTROL
    : UNVERSIONED_CACHE_CONTROL
}

function securityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', MEDIA_CSP)
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Referrer-Policy', 'no-referrer')
  return headers
}

function errorResponse(status: number, extra?: HeadersInit) {
  const headers = securityHeaders(new Headers(extra))
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  headers.set('Cache-Control', status === 405 ? 'no-store' : ERROR_CACHE_CONTROL)
  return new Response(status === 404 ? 'Not found' : 'Error', {
    status,
    headers,
  })
}

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}

function r2ContentRange(object: MediaObject) {
  const range = object.range
  if (!range) return null

  let offset: number
  let length: number
  if (typeof range.suffix === 'number') {
    length = Math.min(range.suffix, object.size)
    offset = object.size - length
  } else {
    offset = range.offset ?? 0
    length = range.length ?? object.size - offset
  }
  if (length <= 0) return null
  return { offset, length, header: `bytes ${offset}-${offset + length - 1}/${object.size}` }
}

async function fromR2(
  bucket: MediaBucket,
  objectKey: string,
  request: Request,
  url: URL
): Promise<Response | null> {
  const isHead = request.method === 'HEAD'
  const object = isHead
    ? await bucket.head(objectKey)
    : await bucket.get(objectKey, {
        range: request.headers.has('range') ? request.headers : undefined,
        onlyIf: request.headers,
      })
  if (!object) return null

  const headers = securityHeaders(new Headers())
  headers.set(
    'Content-Type',
    object.httpMetadata?.contentType || guessContentType(objectKey)
  )
  headers.set(
    'Cache-Control',
    cacheControlFor(url, object.httpMetadata?.cacheControl)
  )
  headers.set('ETag', object.httpEtag)
  headers.set('Last-Modified', object.uploaded.toUTCString())
  headers.set('Accept-Ranges', 'bytes')
  headers.set('X-Media-Source', 'r2')

  if (isHead) {
    headers.set('Content-Length', String(object.size))
    return new Response(null, { status: 200, headers })
  }

  // `onlyIf` failed: R2 returns metadata without a body.
  if (!object.body) return new Response(null, { status: 304, headers })

  const range = request.headers.has('range') ? r2ContentRange(object) : null
  if (range) {
    headers.set('Content-Range', range.header)
    headers.set('Content-Length', String(range.length))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

async function fromSupabase(
  env: MediaEnv,
  path: MediaPath,
  request: Request,
  url: URL,
  fetchImpl: MediaFetch
): Promise<Response> {
  const origin = new URL(env.SUPABASE_URL)
  const target = `${origin.origin}/storage/v1/object/public/${encodeURIComponent(path.bucket)}/${encodeKey(path.key)}${url.search}`

  const forward = new Headers()
  for (const name of ['range', 'if-none-match', 'if-modified-since']) {
    const value = request.headers.get(name)
    if (value) forward.set(name, value)
  }

  let upstream: Response
  try {
    upstream = await fetchImpl(target, {
      method: request.method,
      headers: forward,
      redirect: 'manual',
      cf: { cacheEverything: true, cacheTtl: 86400 },
    })
  } catch {
    return errorResponse(502)
  }

  // Supabase answers a missing object with 400.
  if (upstream.status === 400 || upstream.status === 404) {
    return errorResponse(404, { 'X-Media-Source': 'supabase' })
  }
  if (![200, 206, 304, 416].includes(upstream.status)) {
    return errorResponse(502, { 'X-Media-Source': 'supabase' })
  }

  const headers = securityHeaders(new Headers())
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const upstreamType = upstream.headers.get('content-type')
  if (!upstreamType || upstreamType.startsWith('application/octet-stream')) {
    headers.set('Content-Type', guessContentType(path.key))
  }
  headers.set('Accept-Ranges', 'bytes')
  headers.set(
    'Cache-Control',
    upstream.status === 416 ? ERROR_CACHE_CONTROL : cacheControlFor(url)
  )
  headers.set('X-Media-Source', 'supabase')

  const body =
    request.method === 'HEAD' || upstream.status === 304 ? null : upstream.body
  return new Response(body, { status: upstream.status, headers })
}

export async function handleMediaRequest(
  request: Request,
  env: MediaEnv,
  fetchImpl: MediaFetch = fetch
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse(405, { Allow: 'GET, HEAD' })
  }

  const url = new URL(request.url)
  if (url.pathname === '/healthz') {
    return new Response(request.method === 'HEAD' ? null : 'ok', {
      headers: securityHeaders(
        new Headers({
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        })
      ),
    })
  }

  const path = parseMediaPath(url.pathname)
  if (!path) return errorResponse(404)

  if (env.MEDIA_BUCKET) {
    try {
      const hit = await fromR2(
        env.MEDIA_BUCKET,
        `${path.bucket}/${path.key}`,
        request,
        url
      )
      if (hit) return hit
    } catch {
      // R2 unavailable: fall through to the Supabase original.
    }
  }

  return fromSupabase(env, path, request, url, fetchImpl)
}
