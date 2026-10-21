// Per-admin Arabic auto-fill for admin saves (pure: no next/* or '@/' imports).
// Strict: a failed, refused or rate-limited translation is null (the field stays
// empty), never English. Every AI call first passes the per-admin rate limit;
// the limiter fails closed. missing() counts the fields that could not be filled
// so the save can tell the admin.
import { decideRateLimit, type RateLimitStore } from '../../server/rate-limit-policy.ts'
import { translateBatchStrictCore, type AiBinding } from '../arabic-text.ts'
import type { ArabicFill } from './ports'

/** rate_limits key: rows are `translate-ar:admin:<userId>`. */
export const ARABIC_FILL_RATE_KEY = 'translate-ar'
/** At most this many Workers AI calls per admin per window. */
export const ARABIC_FILL_RATE_LIMIT = 60
export const ARABIC_FILL_RATE_WINDOW_MS = 10 * 60 * 1000

export const arabicFillRateIp = (userId: string) => `admin:${userId}`

export type ArabicFiller = {
  /** Existing Arabic wins; otherwise translate the English; null on any failure. */
  fill: ArabicFill
  /**
   * One slot per input; blank inputs are null and not sent. `maxLengths[i]`: slot i's field
   * max; a longer translation is null and counted missing.
   */
  fillBatch: (texts: string[], maxLengths?: Array<number | undefined>) => Promise<(string | null)[]>
  /** Non-blank English fields left without Arabic so far. */
  missing: () => number
}

export function createArabicFillerCore(deps: {
  userId: string | null | undefined
  getAi: () => Promise<AiBinding | undefined>
  getStore: () => RateLimitStore
  now?: () => number
}): ArabicFiller {
  let missing = 0
  let store: RateLimitStore | null = null

  const allow = async (): Promise<boolean> => {
    if (typeof deps.userId !== 'string' || deps.userId === '') return false
    try {
      store ??= deps.getStore()
    } catch {
      return false
    }
    const decision = await decideRateLimit({
      ip: arabicFillRateIp(deps.userId),
      key: ARABIC_FILL_RATE_KEY,
      limit: ARABIC_FILL_RATE_LIMIT,
      windowMs: ARABIC_FILL_RATE_WINDOW_MS,
      store,
      now: deps.now,
    })
    return decision.allowed
  }

  const getAi = async (): Promise<AiBinding | undefined> => {
    try {
      return await deps.getAi()
    } catch {
      return undefined
    }
  }

  const fillBatch = async (
    texts: string[],
    maxLengths: Array<number | undefined> = []
  ): Promise<(string | null)[]> => {
    if (texts.length === 0) return []
    const ai = await getAi()
    const out = await translateBatchStrictCore(texts, { ai, allow })
    texts.forEach((t, i) => {
      const max = maxLengths[i]
      // Over the field's schema max: dropped, the field stays empty (review item 7, PR #29).
      if (out[i] && typeof max === 'number' && out[i]!.length > max) out[i] = null
      if (t.trim() && !out[i]) missing += 1
    })
    return out
  }

  const fill: ArabicFill = async (en, ar, maxLength) => {
    if (ar?.trim()) return ar.trim()
    if (!en?.trim()) return null
    const [result] = await fillBatch([en], [maxLength])
    return result ?? null
  }

  return { fill, fillBatch, missing: () => missing }
}
