import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type SessionResult = {
  response: NextResponse
  userId: string | null
  /**
   * Lazy admin check. Runs the app_config admin_user_id query only when called.
   *
   * Previously the middleware ran this query on EVERY request, including
   * unauthenticated viewer page loads — adding ~100ms TTFB per page to a
   * feature that only matters for the coming-soon bypass and /admin routes.
   * Now callers invoke checkIsAdmin() only when the isAdmin answer is
   * actually load-bearing (see src/middleware.ts coming-soon gate).
   */
  checkIsAdmin: () => Promise<boolean>
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({ request })

  // Gracefully skip session refresh when Supabase env vars are not configured
  // (e.g., preview deployments without env vars set)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: supabaseResponse,
      userId: null,
      checkIsAdmin: async () => false,
    }
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() verifies the JWT LOCALLY against the project's ES256 asymmetric
  // signing key (JWKS fetched once, then cached in-process). Unlike getUser(),
  // it does NOT round-trip to the Supabase auth server. This proxy runs on
  // EVERY request — including the RSC fetch behind each client-side navigation —
  // so cutting that ~100-300ms network call is paid back on every click.
  //
  // Security: getClaims() cryptographically validates the signature, so the
  // returned sub/email are trustworthy (the same guarantee getUser() gave us;
  // getSession() would NOT validate and must never be used here). Cookie refresh
  // still happens via the setAll() callback above when the token is rotated.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  const checkIsAdmin = async (): Promise<boolean> => {
    if (!userId) return false
    const { data: config } = await supabase
      .from('app_config')
      .select('admin_user_id')
      .eq('id', 1)
      .single()
    return config?.admin_user_id === userId
  }

  return { response: supabaseResponse, userId, checkIsAdmin }
}
