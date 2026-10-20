// Import planner (RESEARCH Pattern 12, D-03, D-04). Pure: turns the videos an
// admin ticked into insert-ready episode rows. Playlist order sets the numbers,
// text goes to the field matching its script, as written on YouTube.
import { parseIsoDuration, secondsToMinutes } from './duration.ts'
import { needsEnglishTitle, routeYouTubeText } from './script.ts'
import { classifyVideo, type VideoItem, type YouTubeStatus } from './status.ts'

export type PlanVideo = {
  id: string
  /** Playlist position; only the order matters. */
  position: number
  item: VideoItem | undefined
}

export type ImportRow = {
  episode_number: number
  title: string
  title_ar: string | null
  description: string
  description_ar: string | null
  duration: number
  youtube_video_id: string
  youtube_duration_seconds: number
  status: 'draft'
  youtube_status: 'ok'
  youtube_checked_at: string
}

export type ImportPlan = { rows: ImportRow[]; needsEnglishCount: number }

/** Length in seconds when it is a usable positive value, else null. */
function lengthSeconds(item: VideoItem | undefined): number | null {
  const s = parseIsoDuration(item?.contentDetails?.duration ?? '')
  return s !== null && s > 0 ? s : null
}

/**
 * classifyVideo, plus: an ok video with no usable length (PT0S, missing or
 * malformed) is not_ready. Live and upcoming broadcasts report PT0S.
 */
export function importStatus(item: VideoItem | undefined, region = 'AE'): YouTubeStatus {
  const status = classifyVideo(item, region)
  if (status === 'ok' && lengthSeconds(item) === null) return 'not_ready'
  return status
}

export function buildImportPlan(input: {
  videos: PlanVideo[]
  /** Highest episode number in the target season, archived rows included; 0 for a new season. */
  startNumber: number
  showDefaults: { description: string | null; description_ar: string | null }
  now: Date
}): ImportPlan {
  const checkedAt = input.now.toISOString()
  const ordered = [...input.videos].sort((a, b) => a.position - b.position)
  const rows: ImportRow[] = []
  let next = input.startNumber

  for (const v of ordered) {
    if (importStatus(v.item) !== 'ok') continue
    const seconds = lengthSeconds(v.item) as number
    const text = routeYouTubeText({
      title: v.item?.snippet?.title ?? '',
      description: v.item?.snippet?.description ?? '',
    })
    const ownDescription = text.description !== ''
    const ownDescriptionAr = text.description_ar !== null
    next += 1
    rows.push({
      episode_number: next,
      title: text.title,
      title_ar: text.title_ar,
      description: ownDescription ? text.description : (input.showDefaults.description ?? ''),
      description_ar:
        ownDescriptionAr || ownDescription ? text.description_ar : input.showDefaults.description_ar,
      duration: secondsToMinutes(seconds),
      youtube_video_id: v.id,
      youtube_duration_seconds: seconds,
      status: 'draft',
      youtube_status: 'ok',
      youtube_checked_at: checkedAt,
    })
  }

  const needsEnglishCount = rows.filter((r) =>
    needsEnglishTitle({ title: r.title, title_ar: r.title_ar })
  ).length
  return { rows, needsEnglishCount }
}
