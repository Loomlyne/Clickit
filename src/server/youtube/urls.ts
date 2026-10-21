// Strict YouTube link parsing (T-06-12). Every server check uses these, never
// the permissive substring regex in src/lib/youtube.ts. Pure: no env, no
// network. Downstream URLs are built from the returned ids only.
import type { YouTubeErrorCode } from '../../lib/youtube-errors'

export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
export const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/

const MAX_INPUT_LENGTH = 2048

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'music.youtube.com',
])

export type ParseResult =
  | { ok: true; id: string }
  | { ok: false; code: YouTubeErrorCode }

/** A parsed http(s) URL on an allow-listed host, or null. */
function parseYouTubeUrl(input: string): URL | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null
  return url
}

/** The video id a YouTube URL points at, or null. */
function videoIdFromUrl(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean)
  let candidate: string | null = null
  if (url.hostname.toLowerCase() === 'youtu.be') {
    candidate = segments[0] ?? null
  } else if (segments[0] === 'watch') {
    candidate = url.searchParams.get('v')
  } else if (
    segments.length >= 2 &&
    (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live')
  ) {
    candidate = segments[1]
  }
  return candidate !== null && VIDEO_ID_RE.test(candidate) ? candidate : null
}

/**
 * The playlist id of a playlist link (`/playlist?list=` or
 * `watch?v=...&list=...`). A single-video link with no list= is told apart
 * from junk so the sheet can point the admin to Add episode.
 */
export function parsePlaylistId(input: string): ParseResult {
  const fail = (code: YouTubeErrorCode): ParseResult => ({ ok: false, code })
  if (typeof input !== 'string' || input.length > MAX_INPUT_LENGTH) {
    return fail('not_a_playlist_link')
  }
  const url = parseYouTubeUrl(input.trim())
  if (!url) return fail('not_a_playlist_link')

  const list = url.searchParams.get('list')
  if (list !== null) {
    return PLAYLIST_ID_RE.test(list)
      ? { ok: true, id: list }
      : fail('not_a_playlist_link')
  }
  return videoIdFromUrl(url) !== null
    ? fail('video_link_in_import')
    : fail('not_a_playlist_link')
}

/**
 * The 11-character id of a bare id or a video link (youtu.be/<id>,
 * watch?v=<id>, /embed/, /shorts/, /live/). A playlist-only link is refused
 * with its own code so the form can point to Import season.
 */
export function parseVideoIdStrict(input: string): ParseResult {
  const fail = (code: YouTubeErrorCode): ParseResult => ({ ok: false, code })
  if (typeof input !== 'string' || input.length > MAX_INPUT_LENGTH) {
    return fail('not_a_video_link')
  }
  const text = input.trim()
  if (VIDEO_ID_RE.test(text)) return { ok: true, id: text }

  const url = parseYouTubeUrl(text)
  if (!url) return fail('not_a_video_link')

  const id = videoIdFromUrl(url)
  if (id !== null) return { ok: true, id }

  const list = url.searchParams.get('list')
  if (list !== null && PLAYLIST_ID_RE.test(list)) {
    return fail('playlist_link_in_form')
  }
  return fail('not_a_video_link')
}
