import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getYouTubeApiKey } from '@/lib/config'
import { extractYouTubeId } from '@/lib/youtube'

/**
 * GET /api/youtube-meta?url=<youtube-url>
 *
 * Admin-only endpoint. Given a YouTube URL, returns:
 *   { title, thumbnail, durationSeconds, channelTitle, publishedAt }
 *
 * Reads the YouTube Data API v3 key from the server environment. Returns 503
 * when no key is set so the client can hide the "Fetch" button.
 */
export async function GET(request: Request) {
  // Auth: must be signed-in admin.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()
  if (config?.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
  }

  const apiKey = await getYouTubeApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No YouTube API key configured' },
      { status: 503 }
    )
  }

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoId,
    key: apiKey,
  })
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    {
      // YouTube metadata rarely changes; cache for a day.
      next: { revalidate: 86400 },
    }
  )
  if (!res.ok) {
    let detail = ''
    try {
      const errBody = (await res.json()) as {
        error?: { message?: string; errors?: { reason?: string }[] }
      }
      detail =
        errBody.error?.message ??
        errBody.error?.errors?.[0]?.reason ??
        ''
    } catch {
      // ignore parse failure
    }
    console.error('[youtube-meta] Google API error', res.status, detail)
    const hint =
      res.status === 400
        ? 'Check the API key, enable YouTube Data API v3 in Google Cloud, and ensure the key allows server requests (no browser-only referrer restriction).'
        : res.status === 403
          ? 'API key may be invalid, restricted, or quota exceeded.'
          : ''
    return NextResponse.json(
      {
        error: `YouTube API error: ${res.status}${detail ? ` — ${detail}` : ''}${hint ? ` ${hint}` : ''}`,
      },
      { status: 502 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await res.json()
  const item = body?.items?.[0]
  if (!item) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json({
    videoId,
    title: item.snippet?.title ?? '',
    description: item.snippet?.description ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    publishedAt: item.snippet?.publishedAt ?? null,
    thumbnail:
      item.snippet?.thumbnails?.maxres?.url ??
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration ?? 'PT0S'),
  })
}

/**
 * Parses ISO 8601 duration (e.g. "PT4M13S") into total seconds.
 * YouTube API returns contentDetails.duration in this format.
 */
function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return 0
  const [, h, m, s] = match
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)
}
