import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { LOCALE_COOKIE } from '@/lib/locale'

/**
 * Root email-link target (05-23; D-12). Supabase may fall back to the Site URL
 * when an email's RedirectTo is not allowed; this route catches that case and
 * only forwards to the locale confirm page with the same query. It never
 * verifies anything: GET must not spend the token (link scanners prefetch).
 */
function resolveLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && (routing.locales as readonly string[]).includes(cookie)) {
    return cookie
  }
  return routing.defaultLocale
}

export async function GET(request: NextRequest) {
  const locale = resolveLocale(request)
  const target = new URL(`/${locale}/auth/confirm${request.nextUrl.search}`, request.nextUrl.origin)
  const response = NextResponse.redirect(target, 303)
  // The query carries the token hash: keep it out of Referer and caches.
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'no-store')
  return response
}
