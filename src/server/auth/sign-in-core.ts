// Sign-in decisions (05-21; D-04, D-08, D-09, D-11, D-12, D-15, D-30). Pure:
// relative imports of pure modules only, every side effect is an injected port,
// so node --test covers it. The server wrappers are
// src/server/auth/after-sign-in.ts and src/app/[locale]/(viewer)/auth/actions.ts.
//
// Nothing here logs an email address, a code, a password, a token or a user id.

import { PASSWORD_MIN } from '../../components/auth/password-rules.ts'
import { getSafeAuthNextPath } from '../../lib/auth-navigation.ts'
import type { RateLimitStore } from '../rate-limit-policy.ts'

export type AuthLocale = 'en' | 'ar'
export type SignInMethod = 'otp' | 'password' | 'link'

/** Message keys the auth screens translate (UI-SPEC 6.1 error tables). */
export type AuthErrorKey =
  | 'tooManyTries'
  | 'codeWrong'
  | 'captcha'
  | 'authInvalidCredentials'
  | 'authEmailNotConfirmed'
  | 'passwordMin'
  | 'authEmailTaken'
  | 'pwLeaked'
  | 'emailInvalid'
  | 'codeSendFailed'
  | 'authGeneric'

export const DEFAULT_DESTINATION = '/browse'
export const ADMIN_DESTINATION = '/admin'

// ------------------------------------------------------------------ errors

const RATE_LIMIT_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
])

const CODE_TO_KEY: Record<string, AuthErrorKey> = {
  otp_expired: 'codeWrong',
  captcha_failed: 'captcha',
  invalid_credentials: 'authInvalidCredentials',
  email_not_confirmed: 'authEmailNotConfirmed',
  weak_password: 'passwordMin',
  user_already_exists: 'authEmailTaken',
  email_exists: 'authEmailTaken',
}

/**
 * Supabase AuthError (or anything) -> a message key. Reads `code`, `status`
 * and, for the OTP case only, `message`. Unknown -> `fallback` (default
 * 'authGeneric').
 */
export function mapAuthErrorKey(error: unknown, fallback: AuthErrorKey = 'authGeneric'): AuthErrorKey {
  if (!error || typeof error !== 'object') return fallback
  const { code, status, message } = error as { code?: unknown; status?: unknown; message?: unknown }
  if (status === 429) return 'tooManyTries'
  if (typeof code === 'string') {
    if (RATE_LIMIT_CODES.has(code)) return 'tooManyTries'
    const key = CODE_TO_KEY[code]
    if (key) return key
  }
  if (typeof message === 'string' && /token has expired or is invalid|invalid otp/i.test(message)) {
    return 'codeWrong'
  }
  return fallback
}

// ------------------------------------------------------------------ next / origin

/** A safe in-app path or null (never an outside URL, never back into /auth). */
function safeNextOrNull(next: string | null | undefined): string | null {
  const safe = getSafeAuthNextPath(next, '')
  return safe === '' ? null : safe
}

/**
 * The emailRedirectTo for every auth email (D-12): the locale confirm page with
 * a safe next. `{{ .RedirectTo }}&token_hash=...` is appended by the template.
 */
export function buildEmailRedirect(origin: string, locale: AuthLocale, next: string | null | undefined): string {
  const base = origin.replace(/\/+$/, '')
  const path = safeNextOrNull(next) ?? DEFAULT_DESTINATION
  return `${base}/${locale}/auth/confirm?next=${encodeURIComponent(path)}`
}

const HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/

function parseOrigin(siteUrl: string | null | undefined): URL | null {
  if (!siteUrl) return null
  try {
    const url = new URL(siteUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * Origin for links in auth emails (T-05-21-04). The site URL when the request
 * host is the site's host; the request host itself only for localhost,
 * 127.0.0.1 and *.workers.dev; otherwise the site URL again (never an
 * arbitrary Host header). Null when there is no usable origin at all.
 */
export function pickEmailOrigin(siteUrl: string | null | undefined, requestHost: string | null | undefined): string | null {
  const site = parseOrigin(siteUrl)
  const host = typeof requestHost === 'string' ? requestHost.trim().toLowerCase() : ''
  if (host && HOST_RE.test(host)) {
    if (site && site.host === host) return site.origin
    const hostname = host.replace(/:\d+$/, '')
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://${host}`
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev$/.test(hostname)) return `https://${host}`
  }
  return site ? site.origin : null
}

/**
 * Where a viewer goes after a successful sign-in (D-04, D-08): the name step
 * for a new viewer (carrying next), else next, else /admin for admins, else
 * /browse.
 */
export function destinationAfterSignIn(input: {
  needsOnboarding: boolean
  isAdmin: boolean
  next: string | null | undefined
}): string {
  const next = safeNextOrNull(input.next)
  const landing = next ?? (input.isAdmin ? ADMIN_DESTINATION : DEFAULT_DESTINATION)
  if (input.needsOnboarding) return `/auth/welcome?next=${encodeURIComponent(landing)}`
  return landing
}

// ------------------------------------------------------------------ passwords

export type PasswordPolicyResult = 'ok' | 'passwordMin' | 'pwLeaked'

/**
 * Every password set (sign-up, reset, set, change) goes through this (D-11):
 * at least PASSWORD_MIN characters, then HIBP. HIBP unknown (null) or throwing
 * fails OPEN with one warning that carries no password data.
 */
export async function passwordPolicyCheck(
  password: unknown,
  isPwned: (password: string) => Promise<boolean | null>,
  log: { warn(message: string): void } = console
): Promise<PasswordPolicyResult> {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return 'passwordMin'
  let pwned: boolean | null
  try {
    pwned = await isPwned(password)
  } catch {
    pwned = null
  }
  if (pwned === true) return 'pwLeaked'
  if (pwned === null) log.warn('[auth/hibp] unavailable, password allowed')
  return 'ok'
}

// ------------------------------------------------------------------ limiter helpers

/** Rate-limit subject for an email: SHA-256 hex of the trimmed lowercase address. */
export async function emailSubject(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Failure lock (T-05-21-01): true when `limit` failures are on record inside
 * the window. Reads only; the caller records a row on each failure. Fails
 * closed (locked) on a store error or an empty subject.
 */
export async function isLockedOut(input: {
  store: RateLimitStore
  subject: string
  key: string
  limit: number
  windowMs: number
  now?: () => number
}): Promise<boolean> {
  if (!input.subject) return true
  try {
    const sinceIso = new Date((input.now ?? Date.now)() - input.windowMs).toISOString()
    const count = await input.store.count(input.subject, input.key, sinceIso)
    if (typeof count !== 'number' || !Number.isFinite(count)) return true
    return count >= input.limit
  } catch {
    return true
  }
}

// ------------------------------------------------------------------ after sign-in

export type SignInProfile = {
  display_name: string | null
  onboarded_at: string | null
  password_set_at: string | null
  locale: string | null
}

export type AfterSignInPorts = {
  /** Insert the profile row if it is missing (on conflict do nothing). */
  ensureProfile(userId: string): Promise<void>
  getProfile(userId: string): Promise<SignInProfile | null>
  setLocale(userId: string, locale: AuthLocale): Promise<void>
  /** user_metadata.locale on the signed-in session (research F3). */
  mirrorMetadata(locale: AuthLocale): Promise<void>
  setPasswordSetAt(userId: string): Promise<void>
  /** public.claim_welcome: an outbox id the first time, null afterwards. */
  claimWelcome(userId: string, locale: AuthLocale): Promise<string | null>
  queue: { sendBatch(messages: { body: { outboxId: string } }[]): Promise<void> }
  isAdmin(userId: string): Promise<boolean>
  log: { warn(message: string): void; error(message: string): void }
}

export type AfterSignInInput = {
  user: { id: string; user_metadata?: { locale?: unknown } | null }
  locale: AuthLocale
  method: SignInMethod
  next: string | null | undefined
}

/**
 * Runs once after any successful sign-in (code, password, confirm link). The
 * sign-in itself has already succeeded, so no step here can fail it: each port
 * failure is logged (step name only) and skipped. Returns the destination.
 */
export async function afterSignInCore(input: AfterSignInInput, ports: AfterSignInPorts): Promise<string> {
  const { user, locale, method } = input
  const userId = user.id

  async function step<T>(name: string, run: () => Promise<T>, onError: T): Promise<T> {
    try {
      return await run()
    } catch {
      ports.log.error(`[auth/after-sign-in] ${name} failed`)
      return onError
    }
  }

  await step('ensure_profile', () => ports.ensureProfile(userId), undefined)

  // A failed profile read is 'unknown', not 'no row': it must not send a known
  // viewer to the name step (the name page itself re-checks onboarding).
  const [profileRead, isAdmin] = await Promise.all([
    step<{ profile: SignInProfile | null } | 'unknown'>(
      'get_profile',
      async () => ({ profile: await ports.getProfile(userId) }),
      'unknown'
    ),
    step('is_admin', () => ports.isAdmin(userId), false),
  ])
  const profile = profileRead === 'unknown' ? null : profileRead.profile

  const tasks: Promise<unknown>[] = []

  if (!profile || profile.locale !== locale) {
    tasks.push(step('set_locale', () => ports.setLocale(userId, locale), undefined))
  }

  const metaLocale = user.user_metadata?.locale
  if (metaLocale !== locale) {
    tasks.push(step('mirror_metadata', () => ports.mirrorMetadata(locale), undefined))
  }

  if (method === 'password' && profile && !profile.password_set_at) {
    tasks.push(step('password_set_at', () => ports.setPasswordSetAt(userId), undefined))
  }

  tasks.push(claimAndQueueWelcome(userId, locale, ports))

  await Promise.all(tasks)

  return destinationAfterSignIn({
    needsOnboarding: profileRead !== 'unknown' && profileNeedsOnboarding(profile),
    isAdmin,
    next: input.next,
  })
}

function profileNeedsOnboarding(profile: SignInProfile | null): boolean {
  return !profile || !profile.display_name || !profile.onboarded_at
}

async function claimAndQueueWelcome(userId: string, locale: AuthLocale, ports: AfterSignInPorts): Promise<void> {
  let outboxId: string | null
  try {
    outboxId = await ports.claimWelcome(userId, locale)
  } catch {
    ports.log.error('[auth/welcome] claim failed')
    return
  }
  if (!outboxId) return
  try {
    await ports.queue.sendBatch([{ body: { outboxId } }])
  } catch {
    // The outbox row is pending; the sweep sends it.
    ports.log.warn('[auth/welcome] queue send failed, sweep will retry')
  }
}
