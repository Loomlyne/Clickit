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
