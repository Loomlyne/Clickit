'use server'

import { checkBotId } from 'botid/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Server Actions for sign-in / sign-up, gated by BotID.
 *
 * Why Server Actions instead of calling supabase.auth.signInWithPassword()
 * directly from the client: BotID's check runs server-side against headers
 * Vercel's edge injects on routes wrapped by withBotId(). If the client bypasses
 * our server and hits Supabase directly, BotID never sees the request.
 *
 * The client form (login-form.tsx / signup-form.tsx) calls these actions
 * instead of Supabase. On success they return the serializable result; on
 * failure they return an error string the form maps to user-friendly copy
 * via mapAuthError().
 */

type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: string }

async function gateAgainstBots(context: string): Promise<null | { ok: false; error: string }> {
  try {
    const result = await checkBotId({
      // In dev, bypass the challenge so local testing isn't blocked. In prod,
      // real humans pass normally; bots get blocked.
      developmentOptions: {
        isDevelopment: process.env.NODE_ENV !== 'production',
        bypass: process.env.NODE_ENV !== 'production' ? 'HUMAN' : undefined,
      },
    })
    if (!result.isHuman) {
      console.warn('[auth]', context, 'BotID rejected non-human request', {
        isBot: result.isBot,
        isVerifiedBot: result.isVerifiedBot,
        bypassed: result.bypassed,
      })
      return { ok: false, error: 'We could not verify your request. Please try again.' }
    }
  } catch (err) {
    // If BotID itself throws (misconfig, network), do not hard-block auth —
    // log loudly and let the request through. Availability > overly strict
    // bot gating for a single-admin media app.
    console.error('[auth]', context, 'BotID check failed (allowing through)', err)
  }
  return null
}

export async function signInAction(email: string, password: string): Promise<AuthResult> {
  const blocked = await gateAgainstBots('signIn')
  if (blocked) return blocked

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('[auth] signIn failed:', error.message, error.status)
    return { ok: false, error: error.message }
  }
  if (!data.user) return { ok: false, error: 'Sign-in returned no user' }

  // Read admin status once so the client can redirect correctly without a
  // second round trip.
  const { data: config } = await supabase.from('app_config').select('admin_user_id').eq('id', 1).single()
  const isAdmin = config?.admin_user_id === data.user.id

  return { ok: true, userId: data.user.id, isAdmin }
}

export async function signUpAction(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const blocked = await gateAgainstBots('signUp')
  if (blocked) return blocked

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

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
