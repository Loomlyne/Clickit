// Pure state rules for the import side sheet (06-17, UI-SPEC 1.3-1.5, 1.8):
// mapping the server's PreviewRow onto the table row, which rows start ticked,
// the summary counts, the numbering note, which banner an error code gets, and
// when the Import button is live. No alias or framework imports; runtime
// relative imports carry the .ts extension so `node --test` can load this file.
import type { YouTubeErrorCode } from '../youtube-errors.ts'
import { YOUTUBE_ERROR_MESSAGE_KEYS } from '../youtube-errors.ts'
import type { ImportTableRow } from './import-row-view.ts'
import type { PreviewRow } from './youtube-import.ts'

/** The server row mapped onto the table row (same field names). */
export function toTableRow(row: PreviewRow): ImportTableRow {
  return {
    videoId: row.videoId,
    position: row.position,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds,
    status: row.status,
    privacy: row.privacy,
    arabicTitle: row.arabicTitle,
    premieresAt: row.premieresAt,
    existing: row.existing,
  }
}

/** Ready rows start ticked; every other status stays unticked. */
export function initialTicks(rows: ImportTableRow[]): Set<string> {
  return new Set(rows.filter((r) => r.status === 'ok').map((r) => r.videoId))
}

/**
 * The ticked Ready ids in playlist order (D-03), whatever order they were
 * ticked in. A tick on a row that is not Ready (or not in the list) is dropped.
 */
export function tickedInPlaylistOrder(rows: ImportTableRow[], ticked: Set<string>): string[] {
  return rows
    .filter((r) => r.status === 'ok' && ticked.has(r.videoId))
    .sort((a, b) => a.position - b.position)
    .map((r) => r.videoId)
}

export type SummaryTarget =
  | { kind: 'new' }
  | { kind: 'existing'; lastEpisodeNumber: number }

export type TickSummary = {
  /** Ready rows (ticked or not). */
  ready: number
  /** Private, Removed, Not embeddable, Blocked in UAE and Not ready. */
  cantPlay: number
  /** Already on Clickit. */
  already: number
  /** Ticked Ready rows: what Import will add. */
  tickedCount: number
  /** Episode number of the first imported video. */
  firstNumber: number
  /** Episode number of the last imported video (below firstNumber when none). */
  lastNumber: number
}

export function summarizeTicks(
  rows: ImportTableRow[],
  ticked: Set<string>,
  target: SummaryTarget
): TickSummary {
  let ready = 0
  let cantPlay = 0
  let already = 0
  let tickedCount = 0
  for (const r of rows) {
    if (r.status === 'ok') {
      ready += 1
      if (ticked.has(r.videoId)) tickedCount += 1
    } else if (r.status === 'already') {
      already += 1
    } else {
      cantPlay += 1
    }
  }
  const base = target.kind === 'existing' ? target.lastEpisodeNumber : 0
  return {
    ready,
    cantPlay,
    already,
    tickedCount,
    firstNumber: base + 1,
    lastNumber: base + tickedCount,
  }
}

export type BannerAction = 'settings' | 'retry' | null

export type BannerSpec = {
  /** Leaf key under admin.youtubeErrors. */
  messageKey: string
  action: BannerAction
  /** The message has a {time} param (the quota reset, Dubai time). */
  needsTime: boolean
  /** The link field is disabled while this shows. */
  disableLink: boolean
  /** 'dashed' is the empty-playlist panel; everything else is the red banner. */
  panel: 'banner' | 'dashed'
}

/** Which message, action and panel an error code gets in the sheet (UI-SPEC 1.8). */
export function bannerForCode(code: YouTubeErrorCode): BannerSpec {
  const messageKey = YOUTUBE_ERROR_MESSAGE_KEYS[code]
  switch (code) {
    case 'quota':
      return { messageKey, action: null, needsTime: true, disableLink: false, panel: 'banner' }
    case 'key_missing':
      return { messageKey, action: 'settings', needsTime: false, disableLink: true, panel: 'banner' }
    case 'key_rejected':
    case 'api_not_allowed':
      return { messageKey, action: 'settings', needsTime: false, disableLink: false, panel: 'banner' }
    case 'network':
      return { messageKey, action: 'retry', needsTime: false, disableLink: false, panel: 'banner' }
    case 'empty_playlist':
      return { messageKey, action: null, needsTime: false, disableLink: false, panel: 'dashed' }
    default:
      // playlist_private and every other refusal: message only, the link keeps its value.
      return { messageKey, action: null, needsTime: false, disableLink: false, panel: 'banner' }
  }
}

export type CanImportInput = {
  tickedCount: number
  target: { kind: 'new' } | { kind: 'existing' }
  seasonTitle: string
  reading: boolean
  importing: boolean
  /** True while a quota or key refusal makes the preview unusable. */
  blocked?: boolean
}

/** Whether the Import button is live. */
export function canImport(input: CanImportInput): boolean {
  if (input.reading || input.importing || input.blocked) return false
  if (input.tickedCount < 1) return false
  if (input.target.kind === 'new' && input.seasonTitle.trim().length === 0) return false
  return true
}
