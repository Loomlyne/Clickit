import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type SessionResult = {
  response: NextResponse
  userId: string | null
  isAdmin: boolean
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({ request })

  // Gracefully skip session refresh when Supabase env vars are not configured
  // (e.g., preview deployments without env vars set)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { response: supabaseResponse, userId: null, isAdmin: false }
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  let isAdmin = false
  if (user) {
    const { data: config } = await supabase
      .from('app_config')
      .select('admin_user_id')
      .eq('id', 1)
      .single()
    isAdmin = config?.admin_user_id === user.id
  }

  return { response: supabaseResponse, userId: user?.id ?? null, isAdmin }
}
