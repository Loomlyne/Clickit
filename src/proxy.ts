import createMiddleware from 'next-intl/middleware'
import { localeRootTarget } from '@/server/locale-root'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'
import { getAppConfig } from '@/lib/config'
import { decideRoute } from '@/server/auth/gate'

/**
 * Paths (after any locale prefix) that stay reachable even when coming-soon
 * mode is on. Matched after we strip the locale segment so /en/admin and
 * /ar/admin both pass through.
 *
 * - /coming-soon is the splash target
 * - /admin is the editor — admin manages the site while gated
 * - /auth is the login screen
 * - /unsubscribe and /newsletter (confirm) are email links; they must work in
 *   coming-soon mode too (05-18)
 *
 * Everyone (including admin) is redirected to /coming-soon for all other routes.
 * Who may see a page once past this gate is decided by decideRoute
 * (src/server/auth/gate.ts) in Step 5.
 */
const COMING_SOON_ALLOWLIST = [
  '/coming-soon',
  '/admin',
  '/auth',
  '/unsubscribe',
  '/newsletter',
]

const handleI18nRouting = createMiddleware(routing)

/**
 * Build a redirect to `url` that carries the merged Supabase session cookies
 * from `fromResponse`. Without copying the cookies, the redirect drops the
 * refreshed sb-…-auth-token and silently logs the user out.
 */
function redirectWithCookies(url: URL, fromResponse: NextResponse, status = 307): NextResponse {
  const redirect = NextResponse.redirect(url, status)
  fromResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie)
  })
  return redirect
}

/**
 * Strip a known locale prefix from a pathname.
 *   /en/admin      → /admin
 *   /ar/series/foo → /series/foo
 *   /admin         → /admin (no prefix, returned unchanged)
 *   /              → /
 */
function stripLocale(pathname: string): { locale: string; pathWithoutLocale: string } {
  for (const loc of routing.locales) {
    if (pathname === `/${loc}`) {
      return { locale: loc, pathWithoutLocale: '/' }
    }
    if (pathname.startsWith(`/${loc}/`)) {
      return { locale: loc, pathWithoutLocale: pathname.slice(`/${loc}`.length) }
    }
  }
  // No locale prefix — caller will treat this as pre-redirect state and use
  // routing.defaultLocale when building a redirect URL.
  return { locale: routing.defaultLocale, pathWithoutLocale: pathname }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /api/* is locale-agnostic and bypasses i18n entirely. We still run the
  // Supabase session refresh so API routes have valid auth cookies.
  if (pathname.startsWith('/api/')) {
    const { response } = await updateSession(request)
    return response
  }

  // /auth/callback is the OAuth callback — registered at this exact URL with
  // every OAuth provider. It MUST stay locale-agnostic. Supabase session
  // refresh runs; next-intl skips (would otherwise redirect to /en/auth/callback
  // and break the OAuth handshake). /auth/confirm is the email-link target
  // (token_hash verify) and is locale-agnostic for the same reason.
  if (pathname === '/auth/callback' || pathname === '/auth/confirm') {
    const { response } = await updateSession(request)
    return response
  }

  // Step 1: Run next-intl routing. This may return a 3xx redirect when the
  // pathname is missing a locale prefix (e.g., / → /en/).
  const intlResponse = handleI18nRouting(request)

  // Step 2: Refresh Supabase session cookies on a separate response.
  const { response: supabaseResponse, userId, claims, checkIsAdmin } = await updateSession(request)

  // Step 3: Merge Supabase cookies onto the i18n response. This is the fix
  // for Pitfall #1 (RTE-03): without this merge, the redirect from / → /en/
  // drops the sb-…-auth-token cookie and the user is silently logged out.
  //
  // For normal (non-redirect) requests, intlResponse is a rewrite/pass-through,
  // and we still need the refreshed Supabase cookies on it. For redirect
  // requests (status 3xx), intlResponse IS the outgoing redirect and the
  // Supabase cookies must ride on it or the browser never sees them.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  // If next-intl is redirecting, honor its redirect immediately — the
  // coming-soon gate applies on the resolved path, not the pre-redirect one.
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse
  }

  // Step 4: Coming-soon hard gate. Match against the path with the locale
  // prefix stripped, so /en/admin, /ar/admin both pass the allowlist.
  const { locale, pathWithoutLocale } = stripLocale(pathname)

  const { flags } = await getAppConfig()

  // /coming-soon is the gate splash only — not a public catalog route.
  if (
    pathWithoutLocale === '/coming-soon' ||
    pathWithoutLocale.startsWith('/coming-soon/')
  ) {
    if (!flags.comingSoonMode) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/watch`
      url.search = ''
      return redirectWithCookies(url, intlResponse)
    }
  }

  const isAllowlisted = COMING_SOON_ALLOWLIST.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  )

  if (!isAllowlisted) {
    if (flags.comingSoonMode) {
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/coming-soon`
      url.search = ''
      return redirectWithCookies(url, intlResponse)
    }
  }

  // Locale root: a real 308 to the portfolio landing, before any render
  // (plan 02-21 CPU work). The query string is kept.
  const rootTarget = localeRootTarget(pathWithoutLocale, locale)
  if (rootTarget) {
    const url = request.nextUrl.clone()
    url.pathname = rootTarget
    return redirectWithCookies(url, intlResponse, 308)
  }

  // Step 5: Auth gate. Runs AFTER the coming-soon gate so coming-soon wins
  // first. decideRoute (AUTH-01 wall, AUTH-06 admin MFA) uses only the claims
  // updateSession already verified, plus one am_i_admin RPC on /admin paths.
  // Pages and actions re-check (requireAdmin, page-level getUser).
  const decision = await decideRoute({
    pathWithoutLocale,
    userId,
    claims,
    isAdmin: checkIsAdmin,
    nowSec: Math.floor(Date.now() / 1000),
  })

  if (decision.action === 'auth') {
    const { next } = decision
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/auth`
    url.search = `?next=${encodeURIComponent(next)}`
    return redirectWithCookies(url, intlResponse)
  }
  if (decision.action === 'mfa') {
    const { next } = decision
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/auth/mfa`
    url.search = `?next=${encodeURIComponent(next)}`
    return redirectWithCookies(url, intlResponse)
  }
  if (decision.action === 'watch') {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/watch`
    url.search = ''
    return redirectWithCookies(url, intlResponse)
  }

  return intlResponse
}

export const config = {
  matcher: [
    // Bare root — must be listed explicitly. Without this, next-intl can't
    // redirect `/` → `/${defaultLocale}/` because the greedy pattern below
    // compiles such that bare `/` falls through (Next.js 16 matcher quirk).
    '/',
    // Locale-prefixed paths — explicit so next-intl's rewrite/redirect fires
    // deterministically for every `/en/*` and `/ar/*` request.
    '/(ar|en)/:path*',
    /*
     * Catch-all for everything else, excluding:
     * - _next/static, _next/image, favicon.ico
     * - sitemap.xml, robots.txt — generated metadata routes that live at the
     *   ROOT (no locale prefix). Without excluding them, next-intl 307s
     *   /sitemap.xml -> /en/sitemap.xml which 404s, leaving crawlers with no
     *   sitemap or robots.txt at all.
     * - Static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .mp4, .webm, .mov, .m4v)
     * /api/* and /auth/callback are NOT excluded here — proxy.ts handles them
     * inline so Supabase session cookies refresh on API + OAuth boundaries.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|m4v)$).*)',
  ],
}
