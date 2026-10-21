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

/** Plan 02-03 name for the same allowlist (never contains a private bucket). */
export const MEDIA_BUCKETS: ReadonlySet<string> = PUBLIC_MEDIA_BUCKETS

/**
 * Pre-optimised variant widths. Variants live in the same R2 bucket at
 * `_v/<width>/<avif|webp>/<bucket>/<key>` (contract shared with the copy
 * script and browser uploads). They are only ever read from R2.
 */
export const VARIANT_WIDTHS: readonly number[] = [640, 1280, 1920]
const VARIANT_FORMATS = [
  { format: 'avif', mime: 'image/avif' },
  { format: 'webp', mime: 'image/webp' },
] as const

// Images are rendered as images; SVG opened directly cannot run script.
export const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

export const VERSIONED_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const UNVERSIONED_CACHE_CONTROL = 'public, max-age=3600'
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

/**
 * Only a non-empty `?v=` (admin cache-bust stamp) is immutable for a year; every
 * other response, variants included, gets one hour. A variant key is re-written
 * when its original is replaced under the same key, so without a stamp it must
 * not be pinned. Stored R2 cacheControl is ignored on purpose: the app has written
 * invalid values (a bare '31536000'), so the policy is decided here.
 */
export function cacheControlFor(url: URL) {
  if (url.searchParams.get('v')) return VERSIONED_CACHE_CONTROL
  return UNVERSIONED_CACHE_CONTROL
}

/** The requested variant width when `?w=` is an allowed width, else null. */
export function variantWidth(url: URL): number | null {
  const raw = url.searchParams.get('w')
  if (!raw || !/^\d+$/.test(raw)) return null
  const width = Number(raw)
  return VARIANT_WIDTHS.includes(width) ? width : null
}

function acceptsType(accept: string, mime: string) {
  for (const part of accept.split(',')) {
    const [type, ...params] = part.trim().toLowerCase().split(';')
    if (type.trim() !== mime) continue
    const q = params
      .map((param) => param.trim())
      .find((param) => param.startsWith('q='))
    if (q && !(Number(q.slice(2)) > 0)) continue
    return true
  }
  return false
}

/**
 * Ordered R2 keys to try for `<bucket>/<key>`: AVIF variant, WebP variant,
 * then the original (always the last candidate).
 */
export function variantCandidates(
  objectKey: string,
  width: number,
  accept: string
): string[] {
  const candidates: string[] = []
  if (VARIANT_WIDTHS.includes(width)) {
    for (const { format, mime } of VARIANT_FORMATS) {
      if (acceptsType(accept, mime)) {
        candidates.push(`_v/${width}/${format}/${objectKey}`)
      }
    }
  }
  candidates.push(objectKey)
  return candidates
}

function isSvg(contentType: string | null | undefined) {
  return !!contentType && contentType.toLowerCase().startsWith('image/svg+xml')
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
    length = Math.min(range.length ?? object.size - offset, object.size - offset)
  }
  if (length <= 0) return null
  return { offset, length, header: `bytes ${offset}-${offset + length - 1}/${object.size}` }
}

function stripWeak(tag: string) {
  return tag.trim().replace(/^W\//, '')
}

/** True when If-Match / If-Unmodified-Since really fail for this object. */
export function failsWritePrecondition(headers: Headers, object: MediaObject) {
  const ifMatch = headers.get('if-match')
  if (ifMatch !== null) {
    const tags = ifMatch.split(',').map(stripWeak)
    const current = stripWeak(object.httpEtag)
    if (!tags.includes('*') && !tags.includes(current)) return true
  }

  const ifUnmodifiedSince = headers.get('if-unmodified-since')
  if (ifUnmodifiedSince !== null) {
    const since = Date.parse(ifUnmodifiedSince)
    // Compare at HTTP-date (whole second) precision.
    const uploaded = Math.floor(object.uploaded.getTime() / 1000) * 1000
    if (!Number.isNaN(since) && uploaded > since) return true
  }

  return false
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
  const contentType =
    object.httpMetadata?.contentType || guessContentType(objectKey)
  headers.set('Content-Type', contentType)
  if (isSvg(contentType)) headers.set('Content-Disposition', 'inline')
  headers.set('Cache-Control', cacheControlFor(url))
  headers.set('ETag', object.httpEtag)
  headers.set('Last-Modified', object.uploaded.toUTCString())
  headers.set('Accept-Ranges', 'bytes')
  headers.set('X-Media-Source', 'r2')

  if (isHead) {
    headers.set('Content-Length', String(object.size))
    return new Response(null, { status: 200, headers })
  }

  // `onlyIf` failed: R2 returns metadata without a body.
  if (!object.body) {
    return new Response(null, {
      status: failsWritePrecondition(request.headers, object) ? 412 : 304,
      headers,
    })
  }

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
  // Only the cache-busting `v` reaches the origin (and the edge cache key).
  const version = url.searchParams.get('v')
  const search = version === null ? '' : `?v=${encodeURIComponent(version)}`
  const target = `${origin.origin}/storage/v1/object/public/${encodeURIComponent(path.bucket)}/${encodeKey(path.key)}${search}`

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
      cf: {
        cacheEverything: true,
        // Supabase answers a missing object with 400. -1 = never store.
        cacheTtlByStatus: {
          '200-299': 86400,
          '300-399': -1,
          '400': 60,
          '401-403': -1,
          '404': 60,
          '405-599': -1,
        },
      },
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
  // The runtime decodes a compressed body, so its encoded length would be wrong.
  const encoded = upstream.headers.has('content-encoding')
  for (const name of PASSTHROUGH_HEADERS) {
    if (encoded && name === 'content-length') continue
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const upstreamType = upstream.headers.get('content-type')
  if (!upstreamType || upstreamType.startsWith('application/octet-stream')) {
    headers.set('Content-Type', guessContentType(path.key))
  }
  if (isSvg(headers.get('Content-Type'))) {
    headers.set('Content-Disposition', 'inline')
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

async function serve(
  request: Request,
  env: MediaEnv,
  fetchImpl: MediaFetch,
  url: URL,
  path: MediaPath,
  width: number | null
): Promise<Response> {
  if (env.MEDIA_BUCKET) {
    const objectKey = `${path.bucket}/${path.key}`
    const candidates =
      width === null
        ? [objectKey]
        : variantCandidates(
            objectKey,
            width,
            request.headers.get('accept') ?? ''
          )
    try {
      for (const candidate of candidates) {
        const hit = await fromR2(env.MEDIA_BUCKET, candidate, request, url)
        if (hit) return hit
      }
    } catch {
      // R2 unavailable: fall through to the Supabase original.
    }
  }

  // Variants exist only in R2; the permanent fallback is the original.
  return fromSupabase(env, path, request, url, fetchImpl)
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

  const width = variantWidth(url)
  const response = await serve(request, env, fetchImpl, url, path, width)
  // Every answer to an allowed ?w= depends on Accept (variant or original).
  if (width !== null) response.headers.append('Vary', 'Accept')
  return response
}
