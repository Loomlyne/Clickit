// Rate-limit seam for Phase 6 admin writes and viewer reports. Same ledger as
// src/app/actions/contact.ts: count `rate_limits` rows for `key` inside the
// window, refuse at `max`, else record one row. Pure: the caller passes the
// service-role client. `failOpen` decides the answer when the ledger fails
// (viewer reports pass false: fail closed, RESEARCH Pattern 10).

import type { AdminDb } from '../../lib/admin/ports'

export type RateLimitOptions = {
  key: string
  max: number
  windowSec: number
  now?: Date
  failOpen: boolean
}

// TODO(phase-2): replace with decideRateLimit from src/server/rate-limit-policy.ts once Phase 2 lands
export async function withinRateLimitCore(
  db: AdminDb,
  { key, max, windowSec, now = new Date(), failOpen }: RateLimitOptions
): Promise<boolean> {
  try {
    const since = new Date(now.getTime() - windowSec * 1000).toISOString()
    const { count, error } = await db
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', since)
    if (error || typeof count !== 'number') return failOpen
    if (count >= max) return false
    const inserted = await db.from('rate_limits').insert({ key })
    if (inserted.error) return failOpen
    return true
  } catch {
    return failOpen
  }
}

// Per-admin limits on the four admin YouTube calls (PR #27 review, finding 2),
// so a loop cannot burn the 10,000-unit daily quota. Keyed per admin user and
// action. Fail open: a ledger hiccup must not lock the admins out of their own
// tools; the quota itself is the hard stop.
export const YOUTUBE_ACTION_LIMITS = {
  preview: { prefix: 'yt-preview', max: 60, windowSec: 10 * 60 },
  meta: { prefix: 'yt-meta', max: 60, windowSec: 10 * 60 },
  import: { prefix: 'yt-import', max: 10, windowSec: 10 * 60 },
  keyTest: { prefix: 'yt-key-test', max: 10, windowSec: 10 * 60 },
} as const

export type YouTubeLimitedAction = keyof typeof YOUTUBE_ACTION_LIMITS

/** True when this admin may make one more call of this kind now. */
export function withinYouTubeActionLimit(
  db: AdminDb,
  action: YouTubeLimitedAction,
  adminUserId: string,
  now: Date = new Date()
): Promise<boolean> {
  const limit = YOUTUBE_ACTION_LIMITS[action]
  return withinRateLimitCore(db, {
    key: `${limit.prefix}:${adminUserId}`,
    max: limit.max,
    windowSec: limit.windowSec,
    now,
    failOpen: true,
  })
}
