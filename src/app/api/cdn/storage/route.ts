import { NextRequest, NextResponse } from 'next/server'
import {
  getSupabaseProjectHost,
  isAllowedSupabasePublicUrl,
} from '@/lib/supabase-media'

/** Revalidate upstream fetch every 30 days — assets are immutable by path. */
export const revalidate = 2_592_000

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

  const upstream = await fetch(target.toString(), {
    next: { revalidate },
  })

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'Upstream fetch failed' },
      { status: upstream.status }
    )
  }

  const contentType =
    upstream.headers.get('content-type') ?? 'application/octet-stream'

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control':
        'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400',
    },
  })
}
