// Fail-closed rate-limit decision (PLAT-07, T-02-15). Pure: no imports.
// Every uncertain path refuses: no IP, a store error, a bad count, a bad config,
// or a count at or over the limit. The store is injected (the Supabase
// rate_limits table in plan 02-11).

export type RateLimitStore = {
  count(ip: string, key: string, sinceIso: string): Promise<number>
  record(ip: string, key: string): Promise<void>
}

export type RateLimitReason = 'ok' | 'no-ip' | 'store-error' | 'limited'
export type RateLimitDecision = { allowed: boolean; reason: RateLimitReason }

export async function decideRateLimit(input: {
  ip: string | null
  key: string
  limit: number
  windowMs: number
  store: RateLimitStore
  now?: () => number
}): Promise<RateLimitDecision> {
  const { ip, key, limit, windowMs, store } = input
  if (typeof ip !== 'string' || ip === '') return { allowed: false, reason: 'no-ip' }
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(windowMs) || windowMs <= 0) {
    return { allowed: false, reason: 'store-error' }
  }
  try {
    const nowMs = (input.now ?? Date.now)()
    const sinceIso = new Date(nowMs - windowMs).toISOString()
    const count = await store.count(ip, key, sinceIso)
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      return { allowed: false, reason: 'store-error' }
    }
    if (count >= limit) return { allowed: false, reason: 'limited' }
    await store.record(ip, key)
    return { allowed: true, reason: 'ok' }
  } catch {
    return { allowed: false, reason: 'store-error' }
  }
}
