// Public-form guard (PLAT-05, PLAT-07; T-02-41, T-02-42, T-02-43).
// Order is fixed: Turnstile siteverify first, then the fail-closed limiter.
// A request that fails the Turnstile check never reaches the limiter, so bots
// cannot fill the rate_limits table (T-02-43). Every uncertain path refuses:
// missing or blank secret, missing token, verifier error, no client IP, store
// error, limit reached. Dependencies are injected so this file stays pure.

import { decideRateLimit, type RateLimitStore } from './rate-limit-policy.ts'
import type { TurnstileResult } from './turnstile.ts'

// Name of the widget's hidden input; plan 02-13 submits the token under it.
export const TURNSTILE_FIELD = 'cf-turnstile-response'

export type GuardError = 'captcha' | 'unavailable' | 'rate_limited'
export type GuardResult = { ok: true } | { ok: false; error: GuardError; reason?: string }

type VerifyFn = (input: {
  token: string | null | undefined
  secret: string | null | undefined
  ip?: string | null
}) => Promise<TurnstileResult>

export async function guardPublicForm(input: {
  token: string | null | undefined
  secret: string | null | undefined
  ip: string | null
  verify: VerifyFn
  rateLimit: {
    key: string
    limit: number
    windowMs: number
    store: RateLimitStore
    now?: () => number
  }
}): Promise<GuardResult> {
  const secret = typeof input.secret === 'string' ? input.secret.trim() : ''
  if (secret === '') return { ok: false, error: 'captcha', reason: 'missing-secret' }

  const token = typeof input.token === 'string' ? input.token.trim() : ''
  if (token === '') return { ok: false, error: 'captcha', reason: 'missing-token' }

  let verdict: TurnstileResult
  try {
    verdict = await input.verify({ token, secret, ip: input.ip })
  } catch {
    return { ok: false, error: 'captcha', reason: 'verify-threw' }
  }
  if (!verdict.ok) return { ok: false, error: 'captcha', reason: verdict.reason }

  const decision = await decideRateLimit({
    ip: input.ip,
    key: input.rateLimit.key,
    limit: input.rateLimit.limit,
    windowMs: input.rateLimit.windowMs,
    store: input.rateLimit.store,
    now: input.rateLimit.now,
  })
  if (decision.allowed) return { ok: true }
  if (decision.reason === 'limited') return { ok: false, error: 'rate_limited', reason: 'limited' }
  return { ok: false, error: 'unavailable', reason: decision.reason }
}

// The token reaches a server action either as a plain string argument or as a
// FormData carrying the widget's hidden input. Anything else is "no token".
export function readCaptchaToken(source: unknown): string {
  if (typeof source === 'string') return source
  if (typeof FormData !== 'undefined' && source instanceof FormData) {
    const value = source.get(TURNSTILE_FIELD)
    return typeof value === 'string' ? value : ''
  }
  return ''
}
