/**
 * Episode scheduling helpers.
 *
 * Shared by the admin form (client), the public queries (server), and the
 * auto-publish cron. Pure functions only — safe to import from both client and
 * server bundles (no `server-only`, no next/headers).
 *
 * Timezone: scheduled times are authored in UAE / Gulf Standard Time. The Gulf
 * never observes DST, so the offset is a fixed +04:00 — we convert with a string
 * offset instead of pulling in a timezone library.
 */

export const DUBAI_OFFSET = '+04:00'

export type EpisodeStatus = 'draft' | 'coming-soon' | 'published'

/**
 * The single source of truth for "can a viewer watch this episode right now".
 *
 * A `published` episode is always live. A `coming-soon` episode becomes live the
 * instant its scheduled `publish_at` passes — evaluated at read time so the
 * episode flips on at the exact minute, before the daily cron persists the
 * status change.
 */
export function isEpisodeLive(
  status: string,
  publishAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (status === 'published') return true
  if (status === 'coming-soon' && publishAt) {
    return new Date(publishAt).getTime() <= now.getTime()
  }
  return false
}

/**
 * Convert a `<input type="datetime-local">` value (Dubai wall-clock, e.g.
 * "2026-06-10T19:00") into a UTC ISO string for storage.
 * Returns null for empty input.
 */
export function dubaiLocalToUtcIso(local: string | null | undefined): string | null {
  if (!local) return null
  // datetime-local gives "YYYY-MM-DDTHH:mm" (no seconds). Normalise then pin the
  // fixed Gulf offset so the Date is interpreted as Dubai time, not the server's.
  const withSeconds = local.length === 16 ? `${local}:00` : local
  const d = new Date(`${withSeconds}${DUBAI_OFFSET}`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/**
 * Weekday names as stored in `shows.broadcast_day`, indexed to match
 * Date#getUTCDay() (0 = Sunday).
 */
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const DAY_MS = 24 * 60 * 60 * 1000
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000

/**
 * Build the next `count` broadcast slots for a show, as UTC ISO strings.
 *
 * Given the show's broadcast days (e.g. ['Monday', 'Friday']) and time
 * ('21:00:00'), walks forward from `from` and returns each matching weekday at
 * that Dubai wall-clock time. A show airing twice a week yields two slots per
 * week, in calendar order.
 *
 * Slots at or before `from` are skipped, so scheduling on a Friday afternoon for
 * a Friday show starts next Friday rather than silently publishing an episode
 * into the past.
 */
export function nextBroadcastSlots(
  days: string[] | null | undefined,
  time: string | null | undefined,
  count: number,
  from: Date = new Date()
): string[] {
  const wanted = new Set(days ?? [])
  if (wanted.size === 0 || !time || count <= 0) return []

  // '21:00:00' and '21:00' both mean the same wall-clock time.
  const hhmm = time.slice(0, 5)
  const slots: string[] = []

  // Read Dubai calendar dates by shifting into the fixed +04:00 offset and then
  // using the UTC field getters — the Gulf never observes DST, so this holds.
  const cursor = new Date(from.getTime() + DUBAI_OFFSET_MS)
  cursor.setUTCHours(0, 0, 0, 0)

  // One slot per matching weekday; scanning count*7 days plus a week of slack is
  // always enough, even when only a single day is selected.
  const horizon = count * 7 + 14
  for (let i = 0; i < horizon && slots.length < count; i++) {
    const day = new Date(cursor.getTime() + i * DAY_MS)
    if (!wanted.has(WEEKDAY_NAMES[day.getUTCDay()])) continue

    const iso = dubaiLocalToUtcIso(`${day.toISOString().slice(0, 10)}T${hhmm}`)
    if (iso && new Date(iso).getTime() > from.getTime()) slots.push(iso)
  }

  return slots
}

/**
 * Convert a stored UTC ISO timestamp into a Dubai wall-clock string suitable for
 * a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm").
 * Returns '' for null/empty so it can seed a controlled input.
 */
export function utcIsoToDubaiLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // Shift by +4h then read the UTC fields — gives Dubai wall-clock (no DST).
  const shifted = new Date(d.getTime() + 4 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}
