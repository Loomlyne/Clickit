/**
 * Resolve the canonical site URL at runtime.
 *
 * Priority (first non-empty wins):
 *   1. NEXT_PUBLIC_SITE_URL  — explicit production override
 *   2. VERCEL_PROJECT_PRODUCTION_URL — set by Vercel on production deploys
 *   3. VERCEL_URL — set by Vercel on every preview deploy
 *   4. http://localhost:3000 — dev fallback
 *
 * Returns a URL WITHOUT a trailing slash so callers can concat paths safely.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  if (!raw) return 'http://localhost:3000'

  // Vercel env vars omit the protocol (e.g. "clickit-cit.vercel.app").
  const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`

  return withProto.replace(/\/$/, '')
}
