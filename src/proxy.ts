import createMiddleware from 'next-intl/middleware'
import { localeRootTarget } from '@/server/locale-root'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'
import { getAppConfig } from '@/lib/config'

/**
 * Paths (after any locale prefix) that stay reachable even when coming-soon
 * mode is on. Matched after we strip the locale segment so /en/admin and
 * /ar/admin both pass through.
 *
 * - /coming-soon is the splash target
 * - /admin is the editor — admin manages the site while gated
 * - /auth is the login screen
 *
 * Everyone (including admin) is redirected to /coming-soon for all other routes.
 */
const COMING_SOON_ALLOWLIST = [
  '/coming-soon',
  '/admin',
  '/auth',
]

/**
 * Paths (after locale strip) reachable WITHOUT being signed in. Every other
 * route bounces a signed-out visitor to /auth.
 *
 * Kept SEPARATE from COMING_SOON_ALLOWLIST on purpose: coming-soon allows
 * /admin so the admin can log in and toggle the flag, but the auth gate must
 * NOT — /admin requires an authenticated (and admin) user.
 */
const PUBLIC_ALLOWLIST = [
  '/', // locale root = portfolio landing
  '/portfolio',
  '/auth',
  '/coming-soon',
  '/support',
  '/about',
  '/privacy',
  '/terms',
]

/**
 * Routes that ALWAYS require a signed-in user, even when "skip sign-in" is on
 * (account-specific areas). /watch is only gated when skip-sign-in is off.
 */
const SKIP_PROTECTED_ALWAYS = [
  '/my-list',
  '/profile',
  '/admin',
]

function isWatchPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === '/watch' ||
    pathWithoutLocale.startsWith('/watch/')
  )
}

/** True when anonymous users must sign in even if auth_allow_skip is enabled. */
function isAuthRequiredDespiteSkip(
  pathWithoutLocale: string,
  authAllowSkip: boolean
): boolean {
  if (
    SKIP_PROTECTED_ALWAYS.some(
      (p) =>
        pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
    )
  ) {
    return true
  }
  // Skip mode opens the catalog + player; without it, /watch needs an account.
  if (!authAllowSkip && isWatchPath(pathWithoutLocale)) {
    return true
  }
  return false
}

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
  // and break the OAuth handshake).
  if (pathname === '/auth/callback') {
    const { response } = await updateSession(request)
    return response
  }

  // Step 1: Run next-intl routing. This may return a 3xx redirect when the
  // pathname is missing a locale prefix (e.g., / → /en/).
  const intlResponse = handleI18nRouting(request)

  // Step 2: Refresh Supabase session cookies on a separate response.
  const { response: supabaseResponse, userId, checkIsAdmin } = await updateSession(request)

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
  // first. Any route not on the public allowlist requires a signed-in user;
  // /admin/* additionally requires the admin.
  const isPublic = PUBLIC_ALLOWLIST.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  )
  const isAdminRoute =
    pathWithoutLocale === '/admin' || pathWithoutLocale.startsWith('/admin/')

  if (!isPublic) {
    if (!userId) {
      const { authAllowSkip } = await getAppConfig()
      const mustAuthDespiteSkip = isAuthRequiredDespiteSkip(
        pathWithoutLocale,
        authAllowSkip
      )
      let mustAuth = true
      if (!mustAuthDespiteSkip) {
        mustAuth = !authAllowSkip
      }
      if (mustAuth) {
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/auth`
        url.search = `?next=${pathWithoutLocale}`
        return redirectWithCookies(url, intlResponse)
      }
    } else if (isAdminRoute) {
      // Signed in but not the admin → bounce to /watch. checkIsAdmin() (one DB
      // query) runs only for /admin/* requests, never on normal page loads.
      const isAdmin = await checkIsAdmin()
      if (!isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/watch`
        url.search = ''
        return redirectWithCookies(url, intlResponse)
      }
    }
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
