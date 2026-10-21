// Rate-limit seam for Phase 6 admin writes and viewer reports, on the shared
// rate_limits ledger: decideRateLimit (src/server/rate-limit-policy.ts) over
// supabaseRateLimitStore (src/server/rate-limit-store.ts). Pure: the caller
// passes the service-role client. Fail closed on every uncertain path: a ledger
// read or write error, a bad count, a bad limit or an empty subject refuses.
//
// The store writes rows as `<scope>:<subject>`, so the caller's full key is split
// at its last colon and the row key stays exactly the caller's key (the viewer
// report count reads rows by that prefix).

import type { AdminDb } from '../../lib/admin/ports'
import { decideRateLimit } from '../rate-limit-policy.ts'
import { supabaseRateLimitStore } from '../rate-limit-store.ts'

export type RateLimitOptions = {
  key: string
  max: number
  windowSec: number
  now?: Date
  /** Always false: the shared limiter fails closed. Kept so call sites state it. */
  failOpen: false
}

export async function withinRateLimitCore(
  db: AdminDb,
  { key, max, windowSec, now = new Date() }: RateLimitOptions
): Promise<boolean> {
  const cut = key.lastIndexOf(':')
  if (cut <= 0) return false
  const decision = await decideRateLimit({
    ip: key.slice(cut + 1),
    key: key.slice(0, cut),
    limit: max,
    windowMs: windowSec * 1000,
    store: supabaseRateLimitStore(db),
    now: () => now.getTime(),
  })
  return decision.allowed
}

// Per-admin limits on the four admin YouTube calls (PR #27 review, finding 2),
// so a loop cannot burn the 10,000-unit daily quota. Keyed per admin user and
// action. Fail closed like every other limiter: a ledger failure refuses the call
// (the admin sees the rate-limited message and retries).
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
    failOpen: false,
  })
}
