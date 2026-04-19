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

  // IMPORTANT: DO NOT use getSession() here.
  // getUser() validates the JWT against Supabase's signing keys.
  // getSession() does NOT validate the JWT and can return stale/tampered data.
  const { data: { user } } = await supabase.auth.getUser()

  const checkIsAdmin = async (): Promise<boolean> => {
    if (!user) return false
    const { data: config } = await supabase
      .from('app_config')
      .select('admin_user_id')
      .eq('id', 1)
      .single()
    return config?.admin_user_id === user.id
  }

  return { response: supabaseResponse, userId: user?.id ?? null, checkIsAdmin }
}
