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
