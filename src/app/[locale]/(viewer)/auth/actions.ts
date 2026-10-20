'use server'

import { createClient } from '@/lib/supabase/server'
import { readCaptchaToken } from '@/server/form-guard'

/**
 * Server Actions for sign-in / sign-up.
 *
 * The client form (login-form.tsx / signup-form.tsx) calls these actions
 * instead of Supabase. On success they return the serializable result; on
 * failure they return an error string the form maps to user-friendly copy
 * via mapAuthError().
 *
 * The Turnstile token (widget string, or FormData with cf-turnstile-response)
 * is passed to Supabase as options.captchaToken. We do NOT call siteverify
 * here: the token is single-use and must stay valid for Supabase CAPTCHA,
 * which is enabled at Phase 3 step P3-7. While CAPTCHA is off in Supabase the
 * value is ignored, so the live sign-in keeps working.
 */

type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: string }

export async function signInAction(
  email: string,
  password: string,
  turnstileToken?: string | FormData
): Promise<AuthResult> {
  const captchaToken = readCaptchaToken(turnstileToken)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken || undefined },
  })

  if (error) {
    console.error('[auth] signIn failed:', error.message, error.status)
    return { ok: false, error: error.message }
  }
  if (!data.user) return { ok: false, error: 'Sign-in returned no user' }

  // Read admin status once so the client can redirect correctly without a
  // second round trip.
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()
  const isAdmin = config?.admin_user_id === data.user.id

  return { ok: true, userId: data.user.id, isAdmin }
}

export async function signUpAction(
  email: string,
  password: string,
  displayName: string,
  turnstileToken?: string | FormData
): Promise<AuthResult> {
  const captchaToken = readCaptchaToken(turnstileToken)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken: captchaToken || undefined },
  })

  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: 'Sign-up returned no user' }

  // Best-effort profile create. If this fails we still return ok:true — the
  // user can set display_name later from the profile page.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: data.user.id, display_name: displayName })
  if (profileError) {
    console.error('[auth] signUp profile upsert failed', profileError.message)
  }

  return { ok: true, userId: data.user.id, isAdmin: false }
}
