// Email-link confirm decisions (05-23; AUTH-04; D-12, D-13; UI-SPEC 6.3). Pure:
// one relative import of a pure helper, no I/O, so node --test covers it. The
// page (GET) only parses; the server action verifies and maps the answer.
//
// Nothing here logs or returns the token hash beyond the parsed value.

import { getSafeAuthNextPath } from '../../lib/auth-navigation.ts'

/** Email link types the confirm page accepts (all valid EmailOtpType values; no invite). */
export const CONFIRM_TYPES = ['signup', 'recovery', 'email_change', 'email', 'magiclink'] as const
export type ConfirmType = (typeof CONFIRM_TYPES)[number]

export const CONFIRM_DEFAULT_NEXT = '/browse'

const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{10,200}$/
const NEXT_MAX = 512

export type ConfirmParams =
  | { ok: true; tokenHash: string; type: ConfirmType; next: string }
  | { ok: false; type: ConfirmType | null; next: string }

function isConfirmType(value: unknown): value is ConfirmType {
  return typeof value === 'string' && (CONFIRM_TYPES as readonly string[]).includes(value)
}

function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > NEXT_MAX) return CONFIRM_DEFAULT_NEXT
  return getSafeAuthNextPath(raw, CONFIRM_DEFAULT_NEXT)
}

/**
 * The link's query -> what the page may offer (T-05-23-03, T-05-23-04). A
 * repeated param (array) or anything off the whitelist / token shape is
 * invalid; an invalid link still keeps a known type so the expired card can
 * offer the right retry. next is always a safe in-app path, default /browse.
 */
export function parseConfirmParams(raw: {
  token_hash?: unknown
  type?: unknown
  next?: unknown
}): ConfirmParams {
  const type = isConfirmType(raw.type) ? raw.type : null
  const next = safeNext(raw.next)
  const tokenHash = raw.token_hash
  if (type && typeof tokenHash === 'string' && TOKEN_HASH_RE.test(tokenHash)) {
    return { ok: true, tokenHash, type, next }
  }
  return { ok: false, type, next }
}

export type ConfirmOutcome = 'signed_in' | 'recovery' | 'pending_other' | 'email_changed' | 'expired' | 'retry'

const RATE_LIMIT_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit'])

/**
 * A Supabase error that says nothing about the link itself: no answer
 * (AuthRetryableFetchError, status 0), a server fault (5xx) or a rate limit.
 * The token is not spent, so the button stays and the visitor can press again.
 */
function isRetryable(error: object): boolean {
  const { name, status, code } = error as { name?: unknown; status?: unknown; code?: unknown }
  if (name === 'AuthRetryableFetchError') return true
  if (typeof code === 'string' && RATE_LIMIT_CODES.has(code)) return true
  if (typeof status === 'number' && (status === 0 || status === 429 || status >= 500)) return true
  return false
}

/**
 * verifyOtp({ token_hash, type }) answer -> outcome (D-13). Expired, invalid
 * and already used look the same from Supabase, so they are one outcome.
 * Secure email change: the first link answers with no error and no session.
 */
export function confirmOutcome(input: { type: ConfirmType; error: unknown; session: unknown }): ConfirmOutcome {
  const { type, error, session } = input
  if (error) {
    return typeof error === 'object' && isRetryable(error) ? 'retry' : 'expired'
  }
  if (type === 'email_change') return session ? 'email_changed' : 'pending_other'
  if (!session) return 'expired'
  return type === 'recovery' ? 'recovery' : 'signed_in'
}

/**
 * The expired card's button (UI-SPEC 6.3): a recovery link opens /auth on the
 * forgot screen ("Request a new link"); any other link goes back to sign-in.
 * A next other than the default rides along.
 */
export function expiredRetryHref(type: ConfirmType | null, next: string): string {
  const params = new URLSearchParams()
  if (type === 'recovery') params.set('mode', 'forgot')
  const safe = safeNext(next)
  if (safe !== CONFIRM_DEFAULT_NEXT) params.set('next', safe)
  const query = params.toString()
  return query ? `/auth?${query}` : '/auth'
}

/** Where a recovery link sends the visitor after signing in on this device (D-13). */
export function recoveryDestination(next: string): string {
  return `/auth/reset-password?next=${encodeURIComponent(safeNext(next))}`
}
