const LOCALE_PREFIX_RE = /^\/(en|ar)(?=\/|$)/
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/

export function getSafeAuthNextPath(
  raw: string | null | undefined,
  fallback = '/watch'
) {
  if (!raw) return fallback

  const next = raw.trim()
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (CONTROL_CHAR_RE.test(next)) return fallback

  const withoutLocale = next.replace(LOCALE_PREFIX_RE, '') || '/'
  if (
    withoutLocale === '/auth' ||
    withoutLocale.startsWith('/auth?') ||
    withoutLocale.startsWith('/auth/')
  ) {
    return fallback
  }

  return withoutLocale
}

/** First screen of the unified sign-in form (05-22, UI-SPEC 6.1). */
export type AuthInitialMode = 'email' | 'password' | 'signup-password' | 'forgot'

/**
 * `?mode=` on /auth -> the first screen. Links from the expired-link pages and
 * Profile use `forgot` and `password`; anything else is the code-first screen.
 */
export function authInitialMode(raw: unknown): AuthInitialMode {
  if (raw === 'forgot') return 'forgot'
  if (raw === 'password') return 'password'
  if (raw === 'signup') return 'signup-password'
  return 'email'
}
