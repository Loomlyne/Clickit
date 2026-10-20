// Single-video verify (YT-03, RESEARCH Pattern 2). Order: strict parse (no
// fetch on failure), key present, one videos.list call, the shared status
// precedence, then the catalog-wide duplicate lookup (archived included).
// Results carry codes and YouTube metadata only, never the key (T-06-27).
// Framework-free and alias-free so node --test loads it directly.
import { findExistingVideos, youtubeFailure } from './youtube-import.ts'
import { parseIsoDuration, secondsToMinutes } from '../../server/youtube/duration.ts'
import { classifyVideo } from '../../server/youtube/status.ts'
import { parseVideoIdStrict } from '../../server/youtube/urls.ts'
import { statusToVideoError, type YouTubeErrorCode } from '../youtube-errors.ts'
import type { YouTubeClientLike, YouTubeVideoResource } from '../../server/youtube/client'
import type { AdminDb } from './ports'

export type YouTubeMeta = {
  videoId: string
  title: string
  description: string
  channelTitle: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  durationMinutes: number | null
}

export type DuplicateParams = { show: string; season: number; episode: number }

export type VerifyOutcome =
  | { ok: true; meta: YouTubeMeta }
  | { ok: false; code: YouTubeErrorCode; params?: DuplicateParams }

export type VerifyOptions = {
  /** The episode being edited: its own id is not a duplicate. */
  excludeEpisodeId?: string
  /** Default true. The shorts metadata fetch (06-15) passes false. */
  checkDuplicate?: boolean
}

// The client type lists only what the classifiers read; videos.list also
// returns snippet.channelTitle, read through this narrow local type.
type SnippetWithChannel = { channelTitle?: unknown }

function meta(videoId: string, v: YouTubeVideoResource): YouTubeMeta {
  const t = v.snippet?.thumbnails
  const seconds = parseIsoDuration(v.contentDetails?.duration ?? '')
  const channel = (v.snippet as SnippetWithChannel | undefined)?.channelTitle
  return {
    videoId,
    title: v.snippet?.title ?? '',
    description: v.snippet?.description ?? '',
    channelTitle: typeof channel === 'string' ? channel : '',
    thumbnailUrl: t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null,
    durationSeconds: seconds,
    durationMinutes: seconds !== null && seconds > 0 ? secondsToMinutes(seconds) : null,
  }
}

/**
 * Verifies one video id or link. Throws only when the duplicate lookup cannot
 * read the database, so a failed read is never mistaken for "not a duplicate".
 */
export async function verifyVideoCore(
  db: AdminDb,
  youtube: YouTubeClientLike | null,
  raw: unknown,
  opts: VerifyOptions = {}
): Promise<VerifyOutcome> {
  const parsed = parseVideoIdStrict(typeof raw === 'string' ? raw : '')
  if (!parsed.ok) return { ok: false, code: parsed.code }
  const videoId = parsed.id
  if (!youtube) return { ok: false, code: 'key_missing' }

  let video: YouTubeVideoResource | undefined
  try {
    video = (await youtube.getVideos([videoId])).get(videoId)
  } catch (e) {
    return { ok: false, code: youtubeFailure(e).code }
  }
  const refusal = statusToVideoError(classifyVideo(video))
  if (refusal || !video) return { ok: false, code: refusal ?? 'video_not_found' }

  if (opts.checkDuplicate !== false) {
    const lookup = await findExistingVideos(db, [videoId])
    if (lookup.error) throw new Error(lookup.error)
    const hit = lookup.found.get(videoId)
    if (hit && hit.episodeId !== opts.excludeEpisodeId) {
      return {
        ok: false,
        code: 'video_duplicate',
        params: { show: hit.showTitle, season: hit.seasonNumber, episode: hit.episodeNumber },
      }
    }
  }
  return { ok: true, meta: meta(videoId, video) }
}

// Plain English for server results and logs; the UI translates the code with
// YOUTUBE_ERROR_MESSAGE_KEYS instead.
const MESSAGES: Record<YouTubeErrorCode, string> = {
  not_a_playlist_link: "This isn't a YouTube playlist link.",
  video_link_in_import: 'This link is one video, not a playlist.',
  not_a_video_link: "This isn't a YouTube video link.",
  playlist_link_in_form: 'This is a playlist link. Paste one video link.',
  playlist_private: "This playlist is private or doesn't exist.",
  empty_playlist: 'This playlist has no videos.',
  video_not_found: 'YouTube has no video at this link.',
  video_private: 'This video is private. Set it to Unlisted or Public on YouTube.',
  video_not_embeddable: "This video can't play on other sites. Turn on embedding in YouTube Studio.",
  video_blocked_uae: 'YouTube blocks this video in the UAE.',
  video_not_ready: "This video is still processing or hasn't premiered yet.",
  video_duplicate: 'This video is already on Clickit.',
  key_missing: "The YouTube key isn't set, so the video could not be checked.",
  key_rejected: 'YouTube rejected the API key.',
  api_not_allowed: 'The API key is not allowed to use the YouTube Data API.',
  quota: "YouTube's daily limit for Clickit is used up.",
  network: "YouTube didn't answer. Try again in a minute.",
}

export function verifyMessage(outcome: { ok: false; code: YouTubeErrorCode; params?: DuplicateParams }): string {
  const p = outcome.params
  if (outcome.code === 'video_duplicate' && p) {
    return `This video is already on Clickit: ${p.show} · Season ${p.season} · Episode ${p.episode}.`
  }
  return MESSAGES[outcome.code]
}
