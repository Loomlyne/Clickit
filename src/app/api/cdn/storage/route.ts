import { NextRequest, NextResponse } from 'next/server'
import {
  getSupabaseProjectHost,
  isAllowedSupabasePublicUrl,
} from '@/lib/supabase-media'

/** Revalidate full-file upstream fetches every 30 days — assets are immutable by path. */
export const revalidate = 2_592_000

/**
 * Proxy Supabase public storage through Vercel’s edge cache.
 *
 * Must forward Range requests and return 206 + Content-Range. iOS Safari / Brave
 * refuse to play progressive MP4s without byte-range support — without it the
 * hero renders a black frame while desktop Chrome still plays.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  const host = getSupabaseProjectHost()
  if (
    !host ||
    target.host !== host ||
    !target.pathname.startsWith('/storage/v1/object/public/')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isAllowedSupabasePublicUrl(target)) {
    return NextResponse.json({ error: 'Forbidden bucket' }, { status: 403 })
  }

  const range = request.headers.get('range')
  const upstreamHeaders: HeadersInit = {}
  if (range) {
    upstreamHeaders.Range = range
  }

  // Ranged responses must not be served from Next’s full-body data cache.
  const upstream = await fetch(target.toString(), {
    headers: upstreamHeaders,
    ...(range
      ? { cache: 'no-store' as const }
      : { next: { revalidate } }),
  })

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: 'Upstream fetch failed' },
      { status: upstream.status }
    )
  }

  const headers = new Headers()
  headers.set(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/octet-stream'
  )
  headers.set(
    'Cache-Control',
    'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400'
  )
  headers.set('Accept-Ranges', 'bytes')

  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)

  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers.set('Content-Range', contentRange)

  const etag = upstream.headers.get('etag')
  if (etag) headers.set('ETag', etag)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  })
}
