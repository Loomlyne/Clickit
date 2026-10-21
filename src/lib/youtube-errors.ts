// Typed YouTube error codes shared by the import sheet, the single-link add,
// the Test key action and the daily re-check. Pure and safe to import from
// client code: no server or framework imports, no path-alias imports.
import type { YouTubeStatus } from '../server/youtube/status'

export type YouTubeErrorCode =
  | 'not_a_playlist_link'
  | 'video_link_in_import'
  | 'not_a_video_link'
  | 'playlist_link_in_form'
  | 'playlist_private'
  | 'empty_playlist'
  | 'video_not_found'
  | 'video_private'
  | 'video_not_embeddable'
  | 'video_blocked_uae'
  | 'video_not_ready'
  | 'video_duplicate'
  | 'key_missing'
  | 'key_rejected'
  | 'api_not_allowed'
  | 'quota'
  | 'network'
  | 'rate_limited'
  | 'season_changed'

/** Every member of YouTubeErrorCode, in the same order as the type. */
export const YOUTUBE_ERROR_CODES = [
  'not_a_playlist_link',
  'video_link_in_import',
  'not_a_video_link',
  'playlist_link_in_form',
  'playlist_private',
  'empty_playlist',
  'video_not_found',
  'video_private',
  'video_not_embeddable',
  'video_blocked_uae',
  'video_not_ready',
  'video_duplicate',
  'key_missing',
  'key_rejected',
  'api_not_allowed',
  'quota',
  'network',
  'rate_limited',
  'season_changed',
] as const satisfies readonly YouTubeErrorCode[]

/** Code -> key under `admin.youtubeErrors` (UI-SPEC message table). */
export const YOUTUBE_ERROR_MESSAGE_KEYS: Record<YouTubeErrorCode, string> = {
  not_a_playlist_link: 'notAPlaylistLink',
  video_link_in_import: 'videoLinkInImport',
  not_a_video_link: 'notAVideoLink',
  playlist_link_in_form: 'playlistLinkInForm',
  playlist_private: 'playlistPrivate',
  empty_playlist: 'emptyPlaylist',
  video_not_found: 'videoNotFound',
  video_private: 'videoPrivate',
  video_not_embeddable: 'videoNotEmbeddable',
  video_blocked_uae: 'videoBlockedUae',
  video_not_ready: 'videoNotReady',
  video_duplicate: 'videoDuplicate',
  key_missing: 'keyMissing',
  key_rejected: 'keyRejected',
  // The key is valid but the API is off or the key is restricted away from
  // this caller: the admin fixes it in the same place as a rejected key.
  api_not_allowed: 'keyRejected',
  quota: 'quota',
  network: 'network',
  // Too many admin YouTube calls in a short time (per-admin limit).
  rate_limited: 'rateLimited',
  // An import collided with a renumber or reorder of the same season.
  season_changed: 'seasonChanged',
}

/** The error shown for a video that cannot play; null when it can. */
export function statusToVideoError(status: YouTubeStatus): YouTubeErrorCode | null {
  switch (status) {
    case 'ok':
      return null
    case 'removed':
      return 'video_not_found'
    case 'private':
      return 'video_private'
    case 'not_embeddable':
      return 'video_not_embeddable'
    case 'blocked_ae':
      return 'video_blocked_uae'
    case 'not_ready':
      return 'video_not_ready'
  }
}
