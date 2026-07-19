import { NextRequest, NextResponse } from 'next/server'
import {
  getSupabaseProjectHost,
  isAllowedSupabasePublicUrl,
} from '@/lib/supabase-media'
import { proxyStorageObject } from '@/lib/storage-range-proxy'

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

  return proxyStorageObject({
    target,
    range: request.headers.get('range'),
  })
}
