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
