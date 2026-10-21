// When the YouTube Data API daily quota resets (RESEARCH Pitfall 3): midnight
// America/Los_Angeles. Feeds `{time}` in admin.youtubeErrors.quota and
// admin.settings.testReason.quota ("It resets at {time} UAE time"). Pure: Intl
// only, no date library; DST-safe because the offset is looked up per instant.
import { localeTag } from './i18n-format.ts'

const LA = 'America/Los_Angeles'
const DUBAI = 'Asia/Dubai'

const laParts = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

function partsAt(ms: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of laParts.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out
}

/** Los Angeles offset from UTC at an instant, in ms (negative: behind UTC). */
function laOffsetMs(ms: number): number {
  const p = partsAt(ms)
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wallAsUtc - Math.floor(ms / 1000) * 1000
}

/** UTC instant of 00:00 Los Angeles time on the given calendar day. */
function laMidnightUtc(year: number, month: number, day: number): number {
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0)
  let utc = wall - laOffsetMs(wall)
  // The first guess used the offset at the wall time read as UTC; settle on the
  // offset at the real instant. Midnight never falls in the 02:00 DST gap.
  const settled = wall - laOffsetMs(utc)
  if (settled !== utc) utc = settled
  return utc
}

/** The next midnight in Los Angeles strictly after `now`. */
export function nextQuotaReset(now: Date): Date {
  const p = partsAt(now.getTime())
  // Today's Los Angeles date is p; the next midnight is the start of tomorrow.
  return new Date(laMidnightUtc(p.year, p.month, p.day + 1))
}

/** Dubai wall time of the reset, e.g. "11:00" (hour and minute only). */
export function formatQuotaReset(instant: Date, locale: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DUBAI,
  }).format(instant)
}
