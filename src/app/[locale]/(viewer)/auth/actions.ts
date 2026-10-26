'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { CODE_LENGTH, normalizeCode } from '@/lib/auth-code'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { afterSignIn, type SignedInUser } from '@/server/auth/after-sign-in'
import { isPwned } from '@/server/auth/hibp'
import {
  buildEmailRedirect,
  destinationAfterSignIn,
  emailSubject,
  isLockedOut,
  mapAuthErrorKey,
  passwordPolicyCheck,
  pickEmailOrigin,
  type AuthErrorKey,
  type AuthLocale,
  type SignInMethod,
} from '@/server/auth/sign-in-core'
import { clientIpFrom } from '@/server/client-ip'
import { readCaptchaToken } from '@/server/form-guard'
import { decideRateLimit, type RateLimitStore } from '@/server/rate-limit-policy'
import { createRateLimitStore } from '@/server/rate-limit-store-service'

/**
 * Server side of signing in and joining (05-21; AUTH-02, AUTH-03, MAIL-03;
 * D-04, D-06, D-07, D-09, D-11, D-14, D-15, D-30, D-37).
 *
 * - The Turnstile token goes to Supabase as `captchaToken` and is never spent
 *   by siteverify first (the public-form guard is not used here; research
 *   Anti-Patterns).
 *   While Supabase CAPTCHA is off the value is ignored, so local and the
 *   current live sign-in keep working (Pitfall 10).
 * - Clickit's own limiter (rate_limits ledger, CF-Connecting-IP) wraps every
 *   action that makes Supabase send an email; it fails closed.
 * - Email links use an origin from the site URL or an allow-listed host only,
 *   never an arbitrary Host header (T-05-21-04).
 * - Logs carry the tag, the step and the Supabase error code only.
 * - No action reads the legacy single-admin config: admins come from
 *   public.admins (after-sign-in.ts).
 */

export type SendCodeResult = { ok: true; sentAt: number } | { ok: false; error: AuthErrorKey }
export type SignInResult = { ok: true; destination: string } | { ok: false; error: AuthErrorKey }
export type SignUpResult =
  | { ok: true; state: 'check_email' }
  | { ok: true; state: 'signed_in'; destination: string }
  | { ok: false; error: AuthErrorKey }
export type ResetRequestResult = { ok: true } | { ok: false; error: AuthErrorKey }

type CaptchaInput = string | FormData | null | undefined

const TEN_MINUTES = 10 * 60 * 1000
const FIFTEEN_MINUTES = 15 * 60 * 1000

/** Per-IP and per-email limits for each action that sends an email (T-05-21-02). */
const SEND_LIMITS = {
  code: { ip: { key: 'auth_code_ip', limit: 10 }, email: { key: 'auth_code_email', limit: 3 } },
  signup: { ip: { key: 'auth_signup_ip', limit: 10 }, email: { key: 'auth_signup_email', limit: 3 } },
  reset: { ip: { key: 'auth_reset_ip', limit: 10 }, email: { key: 'auth_reset_email', limit: 3 } },
} as const

const VERIFY_FAIL = { key: 'auth_verify_fail', limit: 5, windowMs: FIFTEEN_MINUTES } as const

const commonSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  locale: z.enum(['en', 'ar']),
  next: z.string().max(512).nullish(),
})

type Common = { email: string; locale: AuthLocale; next: string | null }

function parseCommon(input: unknown): Common | { error: AuthErrorKey } {
  const parsed = commonSchema.safeParse(input)
  if (parsed.success) {
    return { email: parsed.data.email, locale: parsed.data.locale, next: parsed.data.next ?? null }
  }
  const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
  return { error: emailIssue ? 'emailInvalid' : 'authGeneric' }
}

function errorCodeOf(err: unknown): string {
  if (err && typeof err === 'object') {
    const { code, status } = err as { code?: unknown; status?: unknown }
    if (typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)) return code
    if (typeof status === 'number') return `status_${status}`
  }
  return 'unknown'
}

/** Tag, step and a Supabase error code; never an address, a code, a password or a token. */
function logAuth(tag: '[auth/otp]' | '[auth/password]' | '[auth/reset]', step: string, err?: unknown) {
  const reason = err === undefined ? '' : errorCodeOf(err)
  console.warn(tag, step, reason)
}

async function requestContext(): Promise<{ ip: string | null; origin: string | null }> {
  try {
    const h = await headers()
    return {
      ip: clientIpFrom(h, { allowLocalOverride: process.env.LOCAL_DEV === '1' }),
      origin: pickEmailOrigin(siteUrl(), h.get('host')),
    }
  } catch {
    return { ip: null, origin: null }
  }
}

function openStore(): RateLimitStore | null {
  try {
    return createRateLimitStore()
  } catch {
    return null
  }
}

/** Both limits pass, or the refusal key. Fails closed (no ip, no store, store error). */
async function checkSendLimits(
  kind: keyof typeof SEND_LIMITS,
  ip: string | null,
  subject: string
): Promise<AuthErrorKey | null> {
  const store = openStore()
  if (!store) return 'authGeneric'
  const limits = SEND_LIMITS[kind]
  const byIp = await decideRateLimit({ ip, key: limits.ip.key, limit: limits.ip.limit, windowMs: TEN_MINUTES, store })
  if (!byIp.allowed) return byIp.reason === 'limited' ? 'tooManyTries' : 'authGeneric'
  const byEmail = await decideRateLimit({
    ip: subject,
    key: limits.email.key,
    limit: limits.email.limit,
    windowMs: TEN_MINUTES,
    store,
  })
  if (!byEmail.allowed) return byEmail.reason === 'limited' ? 'tooManyTries' : 'authGeneric'
  return null
}

/** afterSignIn never fails a sign-in that Supabase accepted. */
async function finishSignIn(
  user: SignedInUser,
  options: { locale: AuthLocale; method: SignInMethod; next: string | null },
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  try {
    return await afterSignIn(user, { ...options, supabase })
  } catch {
    console.error('[auth/after-sign-in] failed, default destination used')
    return destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next: options.next })
  }
}

// ------------------------------------------------------------------ code sign-in (D-06)

/**
 * Sends the 6-digit code. Same answer for new and existing emails
 * (shouldCreateUser true; T-05-21-03).
 */
export async function sendCode(input: {
  email: string
  locale: AuthLocale
  next?: string | null
  captchaToken?: CaptchaInput
}): Promise<SendCodeResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }
  const captchaToken = readCaptchaToken(input.captchaToken)

  const { ip, origin } = await requestContext()
  if (!origin) return { ok: false, error: 'codeSendFailed' }
  const refused = await checkSendLimits('code', ip, await emailSubject(common.email))
  if (refused) {
    logAuth('[auth/otp]', 'send refused by limiter')
    return { ok: false, error: refused === 'authGeneric' ? 'codeSendFailed' : refused }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: common.email,
    options: {
      shouldCreateUser: true,
      data: { locale: common.locale },
      captchaToken: captchaToken || undefined,
      emailRedirectTo: buildEmailRedirect(origin, common.locale, common.next),
    },
  })
  if (error) {
    logAuth('[auth/otp]', 'send failed', error)
    return { ok: false, error: mapAuthErrorKey(error, 'codeSendFailed') }
  }
  return { ok: true, sentAt: Date.now() }
}

/**
 * Verifies the code (re-normalised here, D-07). An email's verification locks
 * after 5 wrong codes in 15 minutes (T-05-21-01).
 */
export async function verifyCode(input: {
  email: string
  code: string
  locale: AuthLocale
  next?: string | null
}): Promise<SignInResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }
  const token = normalizeCode(input.code)
  if (token.length !== CODE_LENGTH) return { ok: false, error: 'codeWrong' }

  const store = openStore()
  if (!store) return { ok: false, error: 'authGeneric' }
  const subject = await emailSubject(common.email)
  if (await isLockedOut({ store, subject, key: VERIFY_FAIL.key, limit: VERIFY_FAIL.limit, windowMs: VERIFY_FAIL.windowMs })) {
    logAuth('[auth/otp]', 'verify locked')
    return { ok: false, error: 'tooManyTries' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email: common.email, token, type: 'email' })
  if (error || !data.user) {
    const key = error ? mapAuthErrorKey(error, 'codeWrong') : 'codeWrong'
    if (key !== 'tooManyTries') {
      try {
        await store.record(subject, VERIFY_FAIL.key)
      } catch {
        logAuth('[auth/otp]', 'failure record failed')
      }
    }
    logAuth('[auth/otp]', 'verify failed', error ?? undefined)
    return { ok: false, error: key }
  }

  const destination = await finishSignIn(
    data.user,
    { locale: common.locale, method: 'otp', next: common.next },
    supabase
  )
  return { ok: true, destination }
}

// ------------------------------------------------------------------ password paths

export async function signInWithPasswordAction(input: {
  email: string
  password: string
  locale: AuthLocale
  next?: string | null
  captchaToken?: CaptchaInput
}): Promise<SignInResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }
  // Sign-in only checks "not empty": older accounts may predate the minimum.
  if (typeof input.password !== 'string' || input.password === '' || input.password.length > 1024) {
    return { ok: false, error: 'authInvalidCredentials' }
  }
  const captchaToken = readCaptchaToken(input.captchaToken)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: common.email,
    password: input.password,
    options: { captchaToken: captchaToken || undefined },
  })
  if (error || !data.user) {
    logAuth('[auth/password]', 'sign-in failed', error ?? undefined)
    return { ok: false, error: error ? mapAuthErrorKey(error) : 'authGeneric' }
  }

  const destination = await finishSignIn(
    data.user,
    { locale: common.locale, method: 'password', next: common.next },
    supabase
  )
  return { ok: true, destination }
}

/**
 * Password sign-up (D-05, D-11, D-14): min 8 and HIBP before Supabase; Confirm
 * email is on, so the answer is "check your email", the same whether or not
 * the address already had an account (Supabase returns an obfuscated user).
 */
export async function signUpWithPasswordAction(input: {
  email: string
  password: string
  locale: AuthLocale
  next?: string | null
  captchaToken?: CaptchaInput
}): Promise<SignUpResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }

  const policy = await passwordPolicyCheck(input.password, (candidate) => isPwned(candidate))
  if (policy !== 'ok') return { ok: false, error: policy }
  const captchaToken = readCaptchaToken(input.captchaToken)

  const { ip, origin } = await requestContext()
  if (!origin) return { ok: false, error: 'authGeneric' }
  const refused = await checkSendLimits('signup', ip, await emailSubject(common.email))
  if (refused) {
    logAuth('[auth/password]', 'sign-up refused by limiter')
    return { ok: false, error: refused }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: common.email,
    password: input.password as string,
    options: {
      captchaToken: captchaToken || undefined,
      data: { locale: common.locale },
      emailRedirectTo: buildEmailRedirect(origin, common.locale, common.next),
    },
  })
  if (error) {
    logAuth('[auth/password]', 'sign-up failed', error)
    return { ok: false, error: mapAuthErrorKey(error) }
  }

  // An obfuscated user (address already registered) has no identities: write
  // nothing for it, answer the same.
  const user = data.user
  const realUser = Boolean(user && Array.isArray(user.identities) && user.identities.length > 0)
  if (user && realUser) {
    try {
      const { error: profileError } = await createAdminClient()
        .from('profiles')
        .upsert(
          { id: user.id, locale: common.locale, password_set_at: new Date().toISOString() },
          { onConflict: 'id' }
        )
      if (profileError) logAuth('[auth/password]', 'password_set_at write failed', profileError)
    } catch {
      logAuth('[auth/password]', 'password_set_at write failed')
    }
  }

  // Only when Confirm email is off (never on live, D-14) does sign-up return a session.
  if (user && realUser && data.session) {
    const destination = await finishSignIn(
      user,
      { locale: common.locale, method: 'password', next: common.next },
      supabase
    )
    return { ok: true, state: 'signed_in', destination }
  }
  return { ok: true, state: 'check_email' }
}

/**
 * "Resend the link" on the check-your-email panel after a password sign-up
 * (05-22, UI-SPEC 6.1 state 4). Same limits as sign-up; always ok for any
 * address (T-05-21-03) except a limiter or captcha refusal.
 */
export async function resendSignupLink(input: {
  email: string
  locale: AuthLocale
  next?: string | null
  captchaToken?: CaptchaInput
}): Promise<ResetRequestResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }
  const captchaToken = readCaptchaToken(input.captchaToken)

  const { ip, origin } = await requestContext()
  if (!origin) return { ok: false, error: 'authGeneric' }
  const refused = await checkSendLimits('signup', ip, await emailSubject(common.email))
  if (refused) {
    logAuth('[auth/password]', 'resend refused by limiter')
    return { ok: false, error: refused }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: common.email,
    options: {
      emailRedirectTo: buildEmailRedirect(origin, common.locale, common.next),
      captchaToken: captchaToken || undefined,
    },
  })
  if (error) {
    logAuth('[auth/password]', 'resend failed', error)
    const key = mapAuthErrorKey(error)
    if (key === 'tooManyTries' || key === 'captcha') return { ok: false, error: key }
  }
  return { ok: true }
}

/**
 * Reset link (D-12, D-13). Always ok for any address (T-05-21-03), except a
 * limiter or captcha refusal. The link opens the confirm page, which signs the
 * visitor in and sends recovery to /auth/reset-password carrying this next.
 */
export async function requestPasswordReset(input: {
  email: string
  locale: AuthLocale
  next?: string | null
  captchaToken?: CaptchaInput
}): Promise<ResetRequestResult> {
  const common = parseCommon(input)
  if ('error' in common) return { ok: false, error: common.error }
  const captchaToken = readCaptchaToken(input.captchaToken)

  const { ip, origin } = await requestContext()
  if (!origin) return { ok: false, error: 'authGeneric' }
  const refused = await checkSendLimits('reset', ip, await emailSubject(common.email))
  if (refused) {
    logAuth('[auth/reset]', 'refused by limiter')
    return { ok: false, error: refused }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(common.email, {
    redirectTo: buildEmailRedirect(origin, common.locale, common.next),
    captchaToken: captchaToken || undefined,
  })
  if (error) {
    logAuth('[auth/reset]', 'request failed', error)
    const key = mapAuthErrorKey(error)
    if (key === 'tooManyTries' || key === 'captcha') return { ok: false, error: key }
  }
  return { ok: true }
}

// ------------------------------------------------------------------ deprecated aliases

// removed in 05-22: the old login-form / signup-form still call these until the
// new /auth screen replaces them. They keep the old result shape and hand the
// old forms messages that mapAuthError() already knows.

type LegacyAuthResult = { ok: true; userId: string; isAdmin: boolean } | { ok: false; error: string }

const LEGACY_MESSAGES: Partial<Record<AuthErrorKey, string>> = {
  authInvalidCredentials: 'Invalid login credentials',
  authEmailNotConfirmed: 'Email not confirmed',
  authEmailTaken: 'User already registered',
  tooManyTries: 'Email rate limit exceeded',
  captcha: 'captcha verification failed',
  passwordMin: 'passwordMin',
  pwLeaked: 'This password appeared in a data breach. Choose another.',
  emailInvalid: 'Invalid email or password',
}

function legacyError(key: AuthErrorKey): LegacyAuthResult {
  return { ok: false, error: LEGACY_MESSAGES[key] ?? 'Something went wrong. Please try again.' }
}

// removed in 05-22
export async function signInAction(
  email: string,
  password: string,
  turnstileToken?: string | FormData
): Promise<LegacyAuthResult> {
  const result = await signInWithPasswordAction({
    email,
    password,
    locale: 'en',
    next: null,
    captchaToken: turnstileToken,
  })
  if (!result.ok) return legacyError(result.error)
  return { ok: true, userId: '', isAdmin: result.destination === '/admin' }
}

// removed in 05-22
export async function signUpAction(
  email: string,
  password: string,
  _displayName: string,
  turnstileToken?: string | FormData
): Promise<LegacyAuthResult> {
  const result = await signUpWithPasswordAction({
    email,
    password,
    locale: 'en',
    next: null,
    captchaToken: turnstileToken,
  })
  if (!result.ok) return legacyError(result.error)
  return { ok: true, userId: '', isAdmin: false }
}
