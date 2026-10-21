// Per-user limit on presigned upload URLs (review item 2). Pure: no next/* or
// '@/' imports, so node --test loads it. The store is the shared rate_limits
// ledger (src/server/rate-limit-store.ts); decideRateLimit fails closed, and a
// store factory that throws (no service-role key) refuses too.
import { decideRateLimit, type RateLimitDecision, type RateLimitStore } from './rate-limit-policy.ts'

/** rate_limits key: rows are `media-presign:user:<userId>`. */
export const MEDIA_PRESIGN_RATE_KEY = 'media-presign'
/** At most this many requestMediaUpload calls (each up to 1 + 3 URLs) per user per window. */
export const MEDIA_PRESIGN_RATE_LIMIT = 30
export const MEDIA_PRESIGN_RATE_WINDOW_MS = 10 * 60 * 1000

export const mediaPresignRateIp = (userId: string) => `user:${userId}`

export async function allowMediaPresign(deps: {
  userId: string | null | undefined
  getStore: () => RateLimitStore
  now?: () => number
}): Promise<RateLimitDecision> {
  if (typeof deps.userId !== 'string' || deps.userId === '') return { allowed: false, reason: 'no-ip' }
  let store: RateLimitStore
  try {
    store = deps.getStore()
  } catch {
    return { allowed: false, reason: 'store-error' }
  }
  return decideRateLimit({
    ip: mediaPresignRateIp(deps.userId),
    key: MEDIA_PRESIGN_RATE_KEY,
    limit: MEDIA_PRESIGN_RATE_LIMIT,
    windowMs: MEDIA_PRESIGN_RATE_WINDOW_MS,
    store,
    now: deps.now,
  })
}
