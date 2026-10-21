/**
 * Resolve the canonical site URL at runtime.
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL: explicit override (workers.dev now, the www host
 *      at cutover). Must start with http:// or https://; anything else is
 *      refused and falls through to the default.
 *   2. production default: https://www.clickitstory.ae
 *   3. development default: http://127.0.0.1:3000 (the repo binds 127.0.0.1)
 *
 * Returns a URL WITHOUT a trailing slash so callers can concat paths safely.
 */
const PRODUCTION_DEFAULT = 'https://www.clickitstory.ae'
const DEVELOPMENT_DEFAULT = 'http://127.0.0.1:3000'

export function siteUrl(): string {
  const fallback =
    process.env.NODE_ENV === 'production' ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return fallback

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback
    if (!parsed.hostname) return fallback
  } catch {
    return fallback
  }

  return raw.replace(/\/+$/, '')
}
