import createMiddleware from 'next-intl/middleware'
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
 * - /admin is the editor — admin needs to be able to turn the flag off
 * - /auth is the login screen — admin must be able to log in
 * - /support stays reachable for locked-out users
 *
 * /api/* is also allowed, but it is matched against the full (non-stripped)
 * path because API routes do NOT have locale prefixes.
 */
const COMING_SOON_ALLOWLIST = [
  '/coming-soon',
  '/admin',
  '/auth',
  '/support',
]

const handleI18nRouting = createMiddleware(routing)

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
  const { response: supabaseResponse, checkIsAdmin } = await updateSession(request)

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

  const isAllowlisted = COMING_SOON_ALLOWLIST.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  )

  if (!isAllowlisted) {
    // getAppConfig() is cached (15min) — no DB hit per request in the steady
    // state. The cache tag 'site-config' is bumped when the admin saves
    // feature flags, so the toggle takes effect within one revalidation cycle.
    const { flags } = await getAppConfig()
    if (flags.comingSoonMode) {
      // Only consult app_config.admin_user_id when the gate is ACTUALLY
      // active. 99% of requests skip this query entirely, saving ~100ms TTFB.
      const isAdmin = await checkIsAdmin()
      if (!isAdmin) {
        const url = request.nextUrl.clone()
        // Pitfall #5 (RTE-07): preserve the incoming locale prefix so the
        // redirect lands on /en/coming-soon or /ar/coming-soon, never bare
        // /coming-soon. When the incoming URL had no prefix, stripLocale
        // returned routing.defaultLocale — redirect there.
        url.pathname = `/${locale}/coming-soon`
        url.search = ''
        // Copy the merged cookies onto the coming-soon redirect — keeps the
        // admin's session refresh alive even when they get gated.
        const redirect = NextResponse.redirect(url)
        intlResponse.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie.name, cookie.value, cookie)
        })
        return redirect
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
     * - Static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .mp4, .webm, .mov, .m4v)
     * /api/* and /auth/callback are NOT excluded here — proxy.ts handles them
     * inline so Supabase session cookies refresh on API + OAuth boundaries.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|m4v)$).*)',
  ],
}
