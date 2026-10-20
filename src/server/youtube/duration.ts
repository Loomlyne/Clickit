// ISO 8601 duration parsing for videos.list contentDetails.duration. Pure: no
// imports. Replaces the old parseIsoDuration in api/youtube-meta, which dropped
// the day part.

const ISO_DURATION_RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/**
 * Seconds for `P#DT#H#M#S` (every part optional, at least one required).
 * `PT0S` and `P0D` are 0; empty or malformed input is null.
 */
export function parseIsoDuration(iso: string): number | null {
  if (typeof iso !== 'string' || iso === '') return null
  const m = ISO_DURATION_RE.exec(iso)
  if (!m) return null
  const [, d, h, min, s] = m
  if (d === undefined && h === undefined && min === undefined && s === undefined) {
    return null
  }
  // A "T" with no time part (e.g. "P1DT") is not valid ISO 8601.
  if (iso.endsWith('T')) return null
  return (
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0)
  )
}

/** Whole minutes for the episodes.duration_minutes column; never below 1. */
export function secondsToMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60))
}
