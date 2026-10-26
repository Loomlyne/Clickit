'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { finalizeImageUploadCore, type ImageUploadPorts } from '@/lib/admin/image-upload'
import { CODE_LENGTH, normalizeCode } from '@/lib/auth-code'
import { siteUrl } from '@/lib/site-url'
import { getPublicMediaOrigin } from '@/lib/supabase-media'
import { requireSignedInUser } from '@/server/auth-guards'
import { isPwned } from '@/server/auth/hibp'
import { passwordUpdateOutcome, shouldMirrorLocale } from '@/server/auth/profile-core'
import {
  buildEmailRedirect,
  mapAuthErrorKey,
  passwordPolicyCheck,
  pickEmailOrigin,
} from '@/server/auth/sign-in-core'
import { getWorkerEnv } from '@/server/cloudflare'
import { MEDIA_SAVE_CONFLICT, readMediaReferenceUrls, type ReferenceDb } from '@/server/media-references'
import { decideRateLimit } from '@/server/rate-limit-policy'
import { createRateLimitStore } from '@/server/rate-limit-store-service'
import { liveKeysForUrl, r2KeysForUrl } from '@/server/r2-keys'
import { finalizeUploadedObject, type FinalizeBucket } from '@/server/upload-finalize'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/* ── Account changes (05-26; UI-SPEC 6.7; D-09, D-11, D-13, D-15, D-34) ──
 *
 * Every password and email change runs here, never through the browser auth
 * client. Logs carry a tag, a step and a Supabase error code only: never an
 * address, a password, a code or a user id (T-05-26-04).
 */

export type ProfileErrorKey =
  | 'notSignedIn'
  | 'passwordMin'
  | 'passwordMismatch'
  | 'pwLeaked'
  | 'samePassword'
  | 'codeWrong'
  | 'tooManyTries'
  | 'emailInvalid'
  | 'authEmailTaken'
  | 'authGeneric'

export type SavePasswordResult =
  | { ok: true; wasSet: boolean }
  | { ok: false; state: 'needs_nonce' }
  | { ok: false; error: ProfileErrorKey }

export type ChangeEmailResult =
  | { ok: true; pendingEmail: string | null; sentAt: number | null }
  | { ok: false; error: ProfileErrorKey }

export type ResendEmailChangeResult =
  | { ok: true; sent: boolean; sentAt: number | null }
  | { ok: false; error: ProfileErrorKey }

export type NotifyResult = { ok: true; on: boolean } | { ok: false; error: ProfileErrorKey }

const TEN_MINUTES = 10 * 60 * 1000

/** Per-account limits on the profile actions that make Supabase send an email. */
const PROFILE_LIMITS = {
  reauth: { key: 'profile_reauth', limit: 5 },
  emailChange: { key: 'profile_email_change', limit: 3 },
} as const

const localeSchema = z.enum(['en', 'ar'])

function errorCodeOf(err: unknown): string {
  if (err && typeof err === 'object') {
    const { code, status } = err as { code?: unknown; status?: unknown }
    if (typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)) return code
    if (typeof status === 'number') return `status_${status}`
  }
  return 'unknown'
}

function logProfile(
  tag: '[profile/password]' | '[profile/email]' | '[profile/notify]' | '[profile/locale]',
  step: string,
  err?: unknown
) {
  console.warn(tag, step, err === undefined ? '' : errorCodeOf(err))
}

/** Origin for email links: same rule as the sign-in actions (05-21, T-05-21-04). */
async function emailOrigin(): Promise<string | null> {
  try {
    const h = await headers()
    return pickEmailOrigin(siteUrl(), h.get('host'))
  } catch {
    return null
  }
}

/** Per-account limit; fails closed (no store, store error). */
async function accountLimit(
  limit: (typeof PROFILE_LIMITS)[keyof typeof PROFILE_LIMITS],
  userId: string
): Promise<ProfileErrorKey | null> {
  let store
  try {
    store = createRateLimitStore()
  } catch {
    return 'authGeneric'
  }
  const decision = await decideRateLimit({
    ip: userId,
    key: limit.key,
    limit: limit.limit,
    windowMs: TEN_MINUTES,
    store,
  })
  if (decision.allowed) return null
  return decision.reason === 'limited' ? 'tooManyTries' : 'authGeneric'
}

async function signedInClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * Set or change the password (D-09, D-11, F15). Min 8 and HIBP run here
 * before Supabase. When Supabase "Secure password change" answers
 * reauthentication_needed, the Reauthentication code is emailed to the
 * account address and the form asks for it; the second call carries it as
 * `nonce`. Calling again without a nonce sends a new code (Resend).
 */
export async function savePassword(input: {
  password: string
  confirm: string
  nonce?: string | null
}): Promise<SavePasswordResult> {
  const { supabase, user } = await signedInClient()
  if (!user) return { ok: false, error: 'notSignedIn' }

  const password = input?.password
  if (typeof password !== 'string' || typeof input?.confirm !== 'string') {
    return { ok: false, error: 'authGeneric' }
  }
  if (password !== input.confirm) return { ok: false, error: 'passwordMismatch' }

  const policy = await passwordPolicyCheck(password, (candidate) => isPwned(candidate))
  if (policy !== 'ok') return { ok: false, error: policy }

  let nonce: string | undefined
  if (typeof input.nonce === 'string' && input.nonce !== '') {
    const normalized = normalizeCode(input.nonce)
    if (normalized.length !== CODE_LENGTH) return { ok: false, error: 'codeWrong' }
    nonce = normalized
  }

  const { data: before } = await supabase
    .from('profiles')
    .select('password_set_at')
    .eq('id', user.id)
    .maybeSingle()
  const wasSet = Boolean(before?.password_set_at)

  const { error } = await supabase.auth.updateUser(nonce ? { password, nonce } : { password })
  const outcome = passwordUpdateOutcome({ error })

  if (outcome === 'needs_nonce') {
    const refused = await accountLimit(PROFILE_LIMITS.reauth, user.id)
    if (refused) {
      logProfile('[profile/password]', 'reauth refused by limiter')
      return { ok: false, error: refused }
    }
    const { error: reauthError } = await supabase.auth.reauthenticate()
    if (reauthError) {
      logProfile('[profile/password]', 'reauthenticate failed', reauthError)
      const key = passwordUpdateOutcome({ error: reauthError })
      return { ok: false, error: key === 'tooManyTries' ? 'tooManyTries' : 'authGeneric' }
    }
    return { ok: false, state: 'needs_nonce' }
  }
  if (outcome !== 'saved') {
    logProfile('[profile/password]', 'update failed', error)
    return { ok: false, error: outcome }
  }

  // password_set_at is a system column (only service_role may write it, M1a trigger).
  try {
    const { error: setError } = await createAdminClient()
      .from('profiles')
      .update({ password_set_at: new Date().toISOString() })
      .eq('id', user.id)
    if (setError) logProfile('[profile/password]', 'password_set_at write failed', setError)
  } catch {
    logProfile('[profile/password]', 'password_set_at write failed')
  }

  return { ok: true, wasSet }
}

const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  locale: localeSchema,
})

function emailErrorKey(err: unknown): ProfileErrorKey {
  if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'email_address_invalid') {
    return 'emailInvalid'
  }
  const key = mapAuthErrorKey(err)
  return key === 'authEmailTaken' || key === 'tooManyTries' ? key : 'authGeneric'
}

/**
 * Email change (D-13, AUTH-04). Supabase "Secure email change" mails both
 * addresses; the links open /{locale}/auth/confirm and come back to Profile.
 */
export async function changeEmail(input: { email: string; locale: string }): Promise<ChangeEmailResult> {
  const parsed = changeEmailSchema.safeParse(input)
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
    return { ok: false, error: emailIssue ? 'emailInvalid' : 'authGeneric' }
  }
  const { email, locale } = parsed.data

  const { supabase, user } = await signedInClient()
  if (!user) return { ok: false, error: 'notSignedIn' }
  if ((user.email ?? '').toLowerCase() === email) {
    return { ok: true, pendingEmail: user.new_email ?? null, sentAt: null }
  }

  const origin = await emailOrigin()
  if (!origin) return { ok: false, error: 'authGeneric' }
  const refused = await accountLimit(PROFILE_LIMITS.emailChange, user.id)
  if (refused) {
    logProfile('[profile/email]', 'change refused by limiter')
    return { ok: false, error: refused }
  }

  const { data, error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: buildEmailRedirect(origin, locale, '/profile') }
  )
  if (error) {
    logProfile('[profile/email]', 'change failed', error)
    return { ok: false, error: emailErrorKey(error) }
  }
  return { ok: true, pendingEmail: data.user?.new_email ?? email, sentAt: Date.now() }
}

/** "Resend links" on the pending card: both mails again. No-op without a pending new_email. */
export async function resendEmailChange(input: { locale: string }): Promise<ResendEmailChangeResult> {
  const locale = localeSchema.safeParse(input?.locale)
  if (!locale.success) return { ok: false, error: 'authGeneric' }

  const { supabase, user } = await signedInClient()
  if (!user) return { ok: false, error: 'notSignedIn' }
  if (!user.new_email) return { ok: true, sent: false, sentAt: null }

  const origin = await emailOrigin()
  if (!origin) return { ok: false, error: 'authGeneric' }
  const refused = await accountLimit(PROFILE_LIMITS.emailChange, user.id)
  if (refused) {
    logProfile('[profile/email]', 'resend refused by limiter')
    return { ok: false, error: refused }
  }

  const { error } = await supabase.auth.resend({
    type: 'email_change',
    email: user.new_email,
    options: { emailRedirectTo: buildEmailRedirect(origin, locale.data, '/profile') },
  })
  if (error) {
    logProfile('[profile/email]', 'resend failed', error)
    return { ok: false, error: emailErrorKey(error) }
  }
  return { ok: true, sent: true, sentAt: Date.now() }
}

/** D-34 / D-35: the "New episode emails" switch, own row only. */
export async function setNotifyNewEpisodes(on: boolean): Promise<NotifyResult> {
  if (typeof on !== 'boolean') return { ok: false, error: 'authGeneric' }
  const { supabase, user } = await signedInClient()
  if (!user) return { ok: false, error: 'notSignedIn' }

  const { data, error } = await supabase
    .from('profiles')
    .update({ notify_new_episodes: on })
    .eq('id', user.id)
    .select('notify_new_episodes')
  if (error || !Array.isArray(data) || data.length === 0) {
    logProfile('[profile/notify]', 'update failed', error ?? undefined)
    return { ok: false, error: 'authGeneric' }
  }
  return { ok: true, on: Boolean(data[0]?.notify_new_episodes) }
}

/**
 * D-15 / Q6 = A: the site language the viewer last used becomes the email
 * language (profiles.locale for app emails, user_metadata.locale for the auth
 * templates). Silent: no toast, no revalidation. No-op when signed out or the
 * locale is invalid (returns ok false so the caller retries next time).
 */
export async function syncLocale(locale: string): Promise<{ ok: boolean }> {
  const parsed = localeSchema.safeParse(locale)
  if (!parsed.success) return { ok: false }
  const { supabase, user } = await signedInClient()
  if (!user) return { ok: false }

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', user.id)
    .maybeSingle()
  if (readError) {
    logProfile('[profile/locale]', 'read failed', readError)
    return { ok: false }
  }

  const mirror = shouldMirrorLocale({
    profileLocale: profile?.locale ?? null,
    metaLocale: user.user_metadata?.locale,
    locale: parsed.data,
  })

  const [profileOk, metaOk] = await Promise.all([
    mirror.profile
      ? supabase
          .from('profiles')
          .update({ locale: parsed.data })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) logProfile('[profile/locale]', 'profile write failed', error)
            return !error
          })
      : Promise.resolve(true),
    mirror.meta
      ? supabase.auth.updateUser({ data: { locale: parsed.data } }).then(({ error }) => {
          if (error) logProfile('[profile/locale]', 'metadata write failed', error)
          return !error
        })
      : Promise.resolve(true),
  ])
  return { ok: profileOk && metaOk }
}

export async function updateProfile(data: { display_name: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: data.display_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/profile')
  return { success: true }
}

const finalizeAvatarSchema = z.object({
  key: z.string().min(1).max(300),
  variantKeys: z.array(z.string().max(400)).max(3).default([]),
})

/**
 * Direct-to-R2 avatar finalize (plan 02-15). The browser has PUT the object; this
 * takes only the key. The signed-in user's own id is the owner: finalize refuses a
 * key that is not under avatars/<that id>/, and only that user's profile row is
 * written. No admin audit row (a user's own avatar). The old FormData uploadAvatar was
 * removed in plan 02-19.
 */
export async function finalizeAvatarUpload(
  input: z.input<typeof finalizeAvatarSchema>
): Promise<{ success: boolean; error?: string; data?: string; mediaCleanupFailed?: boolean }> {
  try {
    const userId = await requireSignedInUser()
    const parsed = finalizeAvatarSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'Invalid upload' }
    const supabase = await createClient()
    const bucket = (await getWorkerEnv()).MEDIA as unknown as FinalizeBucket
    const mediaOrigin = getPublicMediaOrigin()

    // Compare-and-swap (deferred item 23): only while avatar_url still holds what was read
    // (two tabs saving at once); 0 rows is a conflict and nothing that was live is deleted.
    const writeAvatar = async (url: string | null, expected: string | null) => {
      const q = supabase
        .from('profiles')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', userId)
      const { data, error } = await (expected === null
        ? q.is('avatar_url', null)
        : q.eq('avatar_url', expected)
      ).select('id')
      if (error) return error.message
      return Array.isArray(data) && data.length > 0 ? null : MEDIA_SAVE_CONFLICT
    }

    const ports: ImageUploadPorts = {
      finalize: (i) =>
        finalizeUploadedObject({
          kind: 'avatar',
          userId: i.userId,
          key: i.key,
          variantKeys: i.variantKeys,
          liveKeys: i.liveKeys,
          bucket,
        }),
      db: {
        // The only place this user's avatar is live (Phase 01.1 review guard).
        readLive: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
          if (error || !data) return { urls: [], error: error?.message ?? 'Could not load profile' }
          return { urls: [data.avatar_url ?? null], error: null }
        },
        readCurrent: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
          if (error || !data) return { url: null, error: error?.message ?? 'Could not load profile' }
          return { url: data.avatar_url ?? null, error: null }
        },
        write: (_target, url, expected) => writeAvatar(url, expected),
        restore: (_target, previous, expected) => writeAvatar(previous, expected),
      },
      media: { delete: (keys) => bucket.delete(keys) },
      audit: null,
      mediaOrigin,
      previousR2Keys: (url) => r2KeysForUrl(url, mediaOrigin),
      liveKeys: (url) => liveKeysForUrl(url, mediaOrigin),
      // Read-only, service client: an avatar file may also be used by a show or the site, and
      // only the service client sees every row. Nothing is written with it; created lazily so
      // a failure counts as an unreadable reference (fail closed: nothing deleted).
      references: async () => readMediaReferenceUrls(createAdminClient() as unknown as ReferenceDb),
    }

    const result = await finalizeImageUploadCore(ports, {
      kind: 'avatar',
      slot: null,
      showId: null,
      key: parsed.data.key,
      variantKeys: parsed.data.variantKeys,
      userId,
      target: { type: 'profile', userId },
      live: { type: 'profile', userId },
    })
    if (result.success || result.wrote) {
      revalidatePath('/profile')
      revalidatePath('/', 'layout') // refresh navbar avatar
    }
    return result
  } catch (err) {
    console.error('[finalizeAvatarUpload] failed', err)
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}
