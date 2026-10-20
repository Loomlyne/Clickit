// The one status classifier behind preview, commit, single add, Test key and
// the daily re-check (RESEARCH Pattern 3). Pure: no imports, no env, no network.
// Precedence, first match wins: removed, private, not_ready, not_embeddable,
// blocked_ae, ok.

/** Same members, same order as the youtube_status check in migration 06-01. */
export const YOUTUBE_STATUSES = ['ok','private','removed','not_embeddable','blocked_ae','not_ready'] as const

export type YouTubeStatus = (typeof YOUTUBE_STATUSES)[number]

/** The videos.list fields the classifier reads (part=snippet,contentDetails,status,liveStreamingDetails). */
export type VideoItem = {
  id?: string
  snippet?: {
    title?: string
    description?: string
    liveBroadcastContent?: string
  }
  contentDetails?: {
    duration?: string
    regionRestriction?: { allowed?: string[]; blocked?: string[] }
  }
  status?: {
    privacyStatus?: string
    uploadStatus?: string
    embeddable?: boolean
  }
  liveStreamingDetails?: { scheduledStartTime?: string }
}

export type VideoReason =
  | { kind: 'premieres'; at: string }
  | { kind: 'processing' }

/**
 * `allowed` present: every country not listed is blocked, and [] means blocked
 * everywhere. `blocked` present: every country not listed can view it.
 */
function blocksRegion(
  rr: { allowed?: string[]; blocked?: string[] } | undefined,
  region: string
): boolean {
  if (!rr) return false
  if (rr.allowed) return !rr.allowed.includes(region)
  if (rr.blocked) return rr.blocked.includes(region)
  return false
}

function isLiveOrUpcoming(item: VideoItem): boolean {
  const live = item.snippet?.liveBroadcastContent
  return live === 'upcoming' || live === 'live'
}

/** `undefined` means videos.list left the id out: the video is gone. */
export function classifyVideo(
  item: VideoItem | undefined,
  region = 'AE'
): YouTubeStatus {
  if (!item) return 'removed'
  const s = item.status
  if (s?.privacyStatus === 'private') return 'private'
  if (['deleted', 'failed', 'rejected'].includes(s?.uploadStatus ?? '')) {
    return 'removed'
  }
  if (s?.uploadStatus !== 'processed') return 'not_ready'
  if (isLiveOrUpcoming(item)) return 'not_ready'
  if (s?.embeddable === false) return 'not_embeddable'
  if (blocksRegion(item.contentDetails?.regionRestriction, region)) {
    return 'blocked_ae'
  }
  return 'ok'
}

/**
 * Why a not_ready video is not ready: a premiere with a start time, or
 * still processing. Only meaningful when classifyVideo says not_ready.
 */
export function videoReason(item: VideoItem | undefined): VideoReason {
  const at = item?.liveStreamingDetails?.scheduledStartTime
  if (item && item.snippet?.liveBroadcastContent === 'upcoming' && at) {
    return { kind: 'premieres', at }
  }
  return { kind: 'processing' }
}
