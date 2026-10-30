import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type SessionClaims = { sub: string; aal?: unknown; amr?: unknown }

export type SessionResult = {
  response: NextResponse
  userId: string | null
  /**
   * The claims getClaims() already verified locally (JWKS, no network call):
   * sub, aal, amr. null when signed out or Supabase is not configured. The
   * proxy feeds aal/amr to decideAdminMfa on /admin paths (05-18, Pitfall 6).
   */
  claims: SessionClaims | null
  /**
   * Lazy admin routing hint: one `rpc('am_i_admin')` call, made only when the
   * caller invokes it (the proxy does so only on /admin paths, never on normal
   * page loads). Errors resolve to false and are logged. Not an authorisation
   * decision: the admin layout and actions re-check via requireAdmin().
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
      claims: null,
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
  const raw = claimsData?.claims
  const userId = typeof raw?.sub === 'string' && raw.sub !== '' ? raw.sub : null
  const claims: SessionClaims | null = userId
    ? { sub: userId, aal: raw?.aal, amr: raw?.amr }
    : null

  const checkIsAdmin = async (): Promise<boolean> => {
    if (!userId) return false
    try {
      const { data, error } = await supabase.rpc('am_i_admin')
      if (error) {
        console.error('[proxy] am_i_admin failed', error.message)
        return false
      }
      return data === true
    } catch (err) {
      console.error('[proxy] am_i_admin failed', err instanceof Error ? err.message : String(err))
      return false
    }
  }

  return { response: supabaseResponse, userId, claims, checkIsAdmin }
}
