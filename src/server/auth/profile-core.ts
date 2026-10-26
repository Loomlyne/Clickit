// Profile account decisions (05-26; D-09, D-11, D-15, research F3, F15). Pure:
// no imports, so node --test covers it and the client bundle can import its
// types without pulling server code. The server wrapper is
// src/app/[locale]/(viewer)/profile/actions.ts.
//
// Nothing here logs anything.

export type ProfileLocale = 'en' | 'ar'

/**
 * What a `supabase.auth.updateUser({ password, nonce? })` answer means for the
 * Profile password form. `needs_nonce`: Supabase "Secure password change" wants
 * the Reauthentication code (session older than 24 h); the caller sends it with
 * `auth.reauthenticate()` and asks for it in place.
 */
export type PasswordUpdateOutcome =
  | 'saved'
  | 'needs_nonce'
  | 'passwordMin'
  | 'samePassword'
  | 'codeWrong'
  | 'tooManyTries'
  | 'authGeneric'

const RATE_LIMIT_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
])

const CODE_TO_OUTCOME: Record<string, PasswordUpdateOutcome> = {
  reauthentication_needed: 'needs_nonce',
  reauthentication_not_valid: 'codeWrong',
  weak_password: 'passwordMin',
  same_password: 'samePassword',
}

export function passwordUpdateOutcome(result: { error: unknown }): PasswordUpdateOutcome {
  const { error } = result
  if (error === null || error === undefined) return 'saved'
  if (typeof error !== 'object') return 'authGeneric'
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (status === 429) return 'tooManyTries'
  if (typeof code === 'string') {
    if (RATE_LIMIT_CODES.has(code)) return 'tooManyTries'
    const outcome = CODE_TO_OUTCOME[code]
    if (outcome) return outcome
  }
  return 'authGeneric'
}

/** D-09: 'set' when the account has no password on record, else 'change'. */
export function passwordLabelState(passwordSetAt: string | null | undefined): 'set' | 'change' {
  return typeof passwordSetAt === 'string' && passwordSetAt !== '' ? 'change' : 'set'
}

export function isProfileLocale(value: unknown): value is ProfileLocale {
  return value === 'en' || value === 'ar'
}

/**
 * D-15 / Q6 = A: which stored copies of the viewer's language differ from the
 * one in use now (profiles.locale for app emails, user_metadata.locale for the
 * auth templates). An invalid locale writes nothing.
 */
export function shouldMirrorLocale(input: {
  profileLocale: unknown
  metaLocale: unknown
  locale: unknown
}): { profile: boolean; meta: boolean } {
  if (!isProfileLocale(input.locale)) return { profile: false, meta: false }
  return {
    profile: input.profileLocale !== input.locale,
    meta: input.metaLocale !== input.locale,
  }
}
