const FULL_OBJECT_REVALIDATE_SECONDS = 2_592_000
const FULL_OBJECT_CACHE_CONTROL =
  'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400'
const PARTIAL_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

type NextFetchInit = RequestInit & {
  next?: { revalidate: number }
}

export type StorageFetch = (
  input: string | URL | Request,
  init?: NextFetchInit
) => Promise<Response>

interface ProxyStorageObjectOptions {
  target: URL
  range: string | null
  fetchImpl?: StorageFetch
}

type RequestedRange =
  | { kind: 'closed'; start: number; end: number }
  | { kind: 'open'; start: number }
  | { kind: 'suffix'; length: number }

function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function parseRequestedRange(value: string): RequestedRange | null {
  if (value.includes(',')) return null

  const match = /^bytes=(?:(\d+)-(\d*)|-(\d+))$/i.exec(value)
  if (!match) return null

  if (match[3]) {
    const length = Number(match[3])
    return Number.isSafeInteger(length) && length > 0
      ? { kind: 'suffix', length }
      : null
  }

  const start = Number(match[1])
  if (!Number.isSafeInteger(start)) return null

  if (match[2] === '') return { kind: 'open', start }

  const end = Number(match[2])
  if (!Number.isSafeInteger(end) || end < start) return null
  return { kind: 'closed', start, end }
}

function parseContentRange(value: string | null) {
  if (!value) return null
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(value)
  if (!match) return null

  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    end < start ||
    total <= end
  ) {
    return null
  }

  return { start, end, total }
}

function matchesRequestedRange(
  requested: RequestedRange,
  returned: { start: number; end: number; total: number }
) {
  if (requested.kind === 'closed') {
    return (
      returned.start === requested.start &&
      returned.end === Math.min(requested.end, returned.total - 1)
    )
  }

  if (requested.kind === 'open') {
    return (
      returned.start === requested.start && returned.end === returned.total - 1
    )
  }

  return (
    returned.start === Math.max(returned.total - requested.length, 0) &&
    returned.end === returned.total - 1
  )
}

async function cancelBody(response: Response) {
  if (!response.body) return
  try {
    await response.body.cancel()
  } catch {
    // The response is discarded either way.
  }
}

function copyEntityHeaders(upstream: Response, headers: Headers) {
  for (const name of [
    'Content-Type',
    'Content-Length',
    'Content-Range',
    'ETag',
    'Last-Modified',
    'Accept-Ranges',
  ]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/octet-stream')
  }
  headers.set('Accept-Ranges', 'bytes')
}

function streamingResponse(upstream: Response, isPartial: boolean) {
  const headers = new Headers()
  copyEntityHeaders(upstream, headers)

  if (isPartial) {
    headers.set('Cache-Control', PARTIAL_CACHE_CONTROL)
    headers.set('Vary', 'Range')
    headers.set('Vercel-CDN-Cache-Control', 'no-store')
  } else {
    headers.set('Cache-Control', FULL_OBJECT_CACHE_CONTROL)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

export async function proxyStorageObject({
  target,
  range,
  fetchImpl = fetch as StorageFetch,
}: ProxyStorageObjectOptions): Promise<Response> {
  const requestedRange = range ? parseRequestedRange(range) : null
  if (range && !requestedRange) {
    return errorResponse(416, 'Invalid range')
  }

  let upstream: Response
  try {
    upstream = await fetchImpl(
      target,
      range
        ? {
            headers: {
              Range: range,
              'Accept-Encoding': 'identity',
            },
            cache: 'no-store',
          }
        : { next: { revalidate: FULL_OBJECT_REVALIDATE_SECONDS } }
    )
  } catch {
    return errorResponse(502, 'Upstream fetch failed')
  }

  if (!range) {
    if (upstream.status !== 200) {
      await cancelBody(upstream)
      return errorResponse(upstream.status, 'Upstream fetch failed')
    }
    return streamingResponse(upstream, false)
  }

  if (upstream.status === 416) {
    const contentRange = upstream.headers.get('Content-Range')
    await cancelBody(upstream)
    return errorResponse(
      416,
      'Range not satisfiable',
      contentRange ? { 'Content-Range': contentRange } : undefined
    )
  }

  const contentRange = parseContentRange(upstream.headers.get('Content-Range'))
  const contentLength = Number(upstream.headers.get('Content-Length'))
  const expectedLength = contentRange
    ? contentRange.end - contentRange.start + 1
    : null
  const validPartial =
    upstream.status === 206 &&
    upstream.body !== null &&
    contentRange !== null &&
    requestedRange !== null &&
    matchesRequestedRange(requestedRange, contentRange) &&
    Number.isSafeInteger(contentLength) &&
    contentLength === expectedLength

  if (!validPartial) {
    await cancelBody(upstream)
    return errorResponse(502, 'Invalid upstream range response')
  }

  return streamingResponse(upstream, true)
}
