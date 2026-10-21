// Pure presentation rules for one row of the import preview table
// (UI-SPEC 1.6-1.7). The component maps this view model onto markup; the
// server's PreviewRow is mapped onto ImportTableRow in the sheet (06-17).
// Pure: no alias or framework imports. Runtime relative imports carry
// the .ts extension so `node --test` can load this file.
import { formatClock, localeTag } from '../i18n-format.ts'

export type ImportRowStatus =
  | 'ok'
  | 'private'
  | 'removed'
  | 'not_embeddable'
  | 'blocked_ae'
  | 'not_ready'
  | 'already'

export type ImportTableRow = {
  videoId: string
  /** 1-based playlist position. */
  position: number
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  status: ImportRowStatus
  privacy: 'public' | 'unlisted' | null
  arabicTitle: boolean
  premieresAt?: string
  existing?: { showTitle: string; seasonNumber: number; episodeNumber: number }
}

export type ImportChipTone = 'ok' | 'bad' | 'warn' | 'neutral'

/** Key under admin.youtubeStatus. */
export type ImportChipKey =
  | 'ready'
  | 'private'
  | 'removed'
  | 'notEmbeddable'
  | 'blockedUae'
  | 'notReady'
  | 'alreadyOnClickit'

/** Key under admin.youtubeImport. */
export type ImportSublineKey =
  | 'visibilityPublic'
  | 'visibilityUnlisted'
  | 'arabicTitle'

export type ImportReasonKey =
  | 'reason.private'
  | 'reason.removed'
  | 'reason.notEmbeddable'
  | 'reason.blockedUae'
  | 'reason.processing'
  | 'reason.premieres'
  | 'reason.alreadyOnClickit'

export type ImportRowView = {
  /** Only Ready rows can be ticked. */
  tickable: boolean
  tone: ImportChipTone
  chipKey: ImportChipKey
  /** Ready rows: visibility, plus the Arabic marker. Empty for skipped rows. */
  sublineKeys: ImportSublineKey[]
  /** Skipped rows: the reason line. */
  reasonKey?: ImportReasonKey
  /** ICU params for reasonKey. */
  params?: Record<string, string | number>
  /** Length as m:ss / h:mm:ss, or an em dash when unknown. */
  time: string
}

function premiereDate(iso: string, locale: string): string | null {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(when)
}

export function importRowView(row: ImportTableRow, locale: string): ImportRowView {
  const time =
    row.durationSeconds === null ? '—' : formatClock(row.durationSeconds, locale)
  const base = { time, sublineKeys: [] as ImportSublineKey[] }

  switch (row.status) {
    case 'ok': {
      const sublineKeys: ImportSublineKey[] = []
      if (row.privacy === 'public') sublineKeys.push('visibilityPublic')
      if (row.privacy === 'unlisted') sublineKeys.push('visibilityUnlisted')
      if (row.arabicTitle) sublineKeys.push('arabicTitle')
      return { tickable: true, tone: 'ok', chipKey: 'ready', sublineKeys, time }
    }
    case 'private':
      return { ...base, tickable: false, tone: 'bad', chipKey: 'private', reasonKey: 'reason.private' }
    case 'removed':
      return { ...base, tickable: false, tone: 'bad', chipKey: 'removed', reasonKey: 'reason.removed' }
    case 'not_embeddable':
      return {
        ...base,
        tickable: false,
        tone: 'bad',
        chipKey: 'notEmbeddable',
        reasonKey: 'reason.notEmbeddable',
      }
    case 'blocked_ae':
      return {
        ...base,
        tickable: false,
        tone: 'bad',
        chipKey: 'blockedUae',
        reasonKey: 'reason.blockedUae',
      }
    case 'not_ready': {
      const date = row.premieresAt ? premiereDate(row.premieresAt, locale) : null
      if (date) {
        return {
          ...base,
          tickable: false,
          tone: 'warn',
          chipKey: 'notReady',
          reasonKey: 'reason.premieres',
          params: { date },
        }
      }
      return {
        ...base,
        tickable: false,
        tone: 'warn',
        chipKey: 'notReady',
        reasonKey: 'reason.processing',
      }
    }
    case 'already': {
      if (row.existing) {
        return {
          ...base,
          tickable: false,
          tone: 'neutral',
          chipKey: 'alreadyOnClickit',
          reasonKey: 'reason.alreadyOnClickit',
          params: {
            show: row.existing.showTitle,
            season: row.existing.seasonNumber,
            episode: row.existing.episodeNumber,
          },
        }
      }
      return { ...base, tickable: false, tone: 'neutral', chipKey: 'alreadyOnClickit' }
    }
  }
}
