import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getAppConfig } from '@/lib/config'

// Paths that remain accessible to everyone even when coming-soon mode is on.
// /coming-soon is the splash target, /admin is the editor, /auth is the login
// screen (needed so the admin can log in to turn the flag back off),
// /api/* is internal, and /support stays reachable so locked-out users can
// contact the team.
const COMING_SOON_ALLOWLIST = [
  '/coming-soon',
  '/admin',
  '/auth',
  '/api',
  '/support',
]

export async function middleware(request: NextRequest) {
  const { response, isAdmin } = await updateSession(request)

  // Coming-soon hard gate — redirect every public route to /coming-soon when
  // the admin flag is on, except for allowlisted prefixes. Admin stays in
  // full control of the site.
  const { pathname } = request.nextUrl
  const isAllowlisted = COMING_SOON_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (!isAllowlisted && !isAdmin) {
    // getAppConfig() is cached (15min) — this doesn't hit the DB on every
    // request. The cache tag 'site-config' is bumped whenever the admin saves
    // feature flags, so the toggle takes effect within one revalidation cycle.
    const { flags } = await getAppConfig()
    if (flags.comingSoonMode) {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}

// Node.js runtime — required because updateSession/getAppConfig pull in the
// Supabase server client, which uses next/headers (cookies) + a Node-only
// postgres client. Fluid Compute runs middleware on Node.js natively and
// fixes the "referencing unsupported modules" error that the Edge runtime
// throws for @/lib/supabase/middleware + @/lib/config imports. Vercel
// projects created after Fluid Compute GA need this opt-in explicit on
// middleware; clickit-cit had it already because it predates the change.
export const runtime = 'nodejs'

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
