// The one "Can't play" rule (D-17, RESEARCH Pattern 10) behind the episodes
// table badge (UI-SPEC 5.3) and the dashboard "YouTube check" panel (5.5,
// plan 06-18). Flag only: nothing here unpublishes or hides an episode.
// Pure and client-safe: type-only imports, no env, no network.
import type { YouTubeStatus } from '../../server/youtube/status'

/** The dashboard shows "check overdue" when the newest check is older than this. */
export const CHECK_OVERDUE_HOURS = 36

const CANT_PLAY_LIST_MAX = 5

export type CantPlayReason = Exclude<YouTubeStatus, 'ok'> | 'viewer_report'

export type CantPlayInput = {
  youtube_status: YouTubeStatus | string | null
  youtube_checked_at?: string | null
  player_error_at?: string | null
}

export type HealthRow = {
  id: string
  show_id: string
  show_title: string
  season_number: number | null
  episode_number: number
  archived: boolean
  youtube_status: YouTubeStatus | string | null
  youtube_checked_at: string | null
  player_error_at: string | null
  player_error_code: number | null
}

export type CantPlayEntry = {
  id: string
  showId: string
  showTitle: string
  seasonNumber: number | null
  episodeNumber: number
  reason: CantPlayReason
}

export type YouTubeHealthSummary = {
  lastCheckedAt: string | null
  neverChecked: boolean
  overdue: boolean
  cantPlay: CantPlayEntry[]
  cantPlayTotal: number
}

const NOT_OK = new Set<string>(['private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready'])

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * The stored status when it is not ok; otherwise "viewer_report" when a viewer
 * reported a player error after the last check (or before any check); else null.
 */
export function cantPlayReason(row: CantPlayInput): CantPlayReason | null {
  const status = row.youtube_status
  if (status && NOT_OK.has(status)) return status as CantPlayReason
  const reportedAt = ms(row.player_error_at)
  if (reportedAt === null) return null
  const checkedAt = ms(row.youtube_checked_at)
  if (checkedAt === null || reportedAt > checkedAt) return 'viewer_report'
  return null
}

function compareEntries(a: CantPlayEntry, b: CantPlayEntry): number {
  const byShow = a.showTitle.localeCompare(b.showTitle) || a.showId.localeCompare(b.showId)
  if (byShow !== 0) return byShow
  const sa = a.seasonNumber ?? Number.POSITIVE_INFINITY
  const sb = b.seasonNumber ?? Number.POSITIVE_INFINITY
  if (sa !== sb) return sa < sb ? -1 : 1
  return a.episodeNumber - b.episodeNumber
}

/**
 * Dashboard summary over the episodes admins manage (archived rows excluded;
 * published and draft both count).
 */
export function summarizeYouTubeHealth(rows: readonly HealthRow[], now: Date): YouTubeHealthSummary {
  let last: number | null = null
  let lastIso: string | null = null
  const broken: CantPlayEntry[] = []

  for (const r of rows) {
    if (r.archived) continue
    const t = ms(r.youtube_checked_at)
    if (t !== null && (last === null || t > last)) {
      last = t
      lastIso = r.youtube_checked_at
    }
    const reason = cantPlayReason(r)
    if (reason) {
      broken.push({
        id: r.id,
        showId: r.show_id,
        showTitle: r.show_title,
        seasonNumber: r.season_number,
        episodeNumber: r.episode_number,
        reason,
      })
    }
  }

  broken.sort(compareEntries)
  return {
    lastCheckedAt: lastIso,
    neverChecked: last === null,
    overdue: last !== null && now.getTime() - last > CHECK_OVERDUE_HOURS * 3_600_000,
    cantPlay: broken.slice(0, CANT_PLAY_LIST_MAX),
    cantPlayTotal: broken.length,
  }
}
