import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getEmailQueue } from '@/server/email/queue'
import {
  afterSignInCore,
  type AuthLocale,
  type SignInMethod,
} from '@/server/auth/sign-in-core'

type SessionClient = Awaited<ReturnType<typeof createClient>>

export type SignedInUser = {
  id: string
  user_metadata?: { locale?: unknown } | null
}

/**
 * Server wrapper of afterSignInCore (05-21; D-08, D-09, D-15, D-30). Call it
 * once after any successful sign-in: code (verifyOtp), password, or a confirm
 * link (05-23). It never throws for a step failure (the core logs and skips);
 * it returns the destination path without the locale prefix.
 *
 * `supabase` should be the same session client that just signed the user in:
 * it holds the new session in memory, so the user_metadata mirror does not
 * depend on the freshly written cookies being readable in this request.
 */
export async function afterSignIn(
  user: SignedInUser,
  options: {
    locale: AuthLocale
    method: SignInMethod
    next: string | null | undefined
    supabase?: SessionClient
  }
): Promise<string> {
  const { locale, method, next } = options
  const admin = createAdminClient()
  const session = options.supabase ?? (await createClient())

  return afterSignInCore(
    { user, locale, method, next },
    {
      async ensureProfile(userId) {
        const { error } = await admin
          .from('profiles')
          .upsert({ id: userId, locale }, { onConflict: 'id', ignoreDuplicates: true })
        if (error) throw new Error('profiles insert failed')
      },
      async getProfile(userId) {
        const { data, error } = await admin
          .from('profiles')
          .select('display_name, onboarded_at, password_set_at, locale')
          .eq('id', userId)
          .maybeSingle()
        if (error) throw new Error('profiles read failed')
        return data
      },
      async setLocale(userId, value) {
        const { error } = await admin.from('profiles').update({ locale: value }).eq('id', userId)
        if (error) throw new Error('profiles locale update failed')
      },
      async mirrorMetadata(value) {
        // Research F3: signInWithOtp applies options.data only when it creates
        // the user, so existing users get the locale here.
        const { error } = await session.auth.updateUser({ data: { locale: value } })
        if (error) throw new Error('user_metadata update failed')
      },
      async setPasswordSetAt(userId) {
        const { error } = await admin
          .from('profiles')
          .update({ password_set_at: new Date().toISOString() })
          .eq('id', userId)
          .is('password_set_at', null)
        if (error) throw new Error('password_set_at update failed')
      },
      async claimWelcome(userId, value) {
        const { data, error } = await admin.rpc('claim_welcome', { p_user: userId, p_locale: value })
        if (error) throw new Error('claim_welcome failed')
        return typeof data === 'string' && data !== '' ? data : null
      },
      queue: {
        async sendBatch(messages) {
          await (await getEmailQueue()).sendBatch(messages)
        },
      },
      async isAdmin(userId) {
        // Destination hint only (admins without next land on /admin); the admin
        // area itself still runs requireAdmin() with aal2. Looked up by the id
        // Supabase just returned, not through the request cookies.
        const { data, error } = await admin
          .from('admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw new Error('admins lookup failed')
        return Boolean(data)
      },
      log: {
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
    }
  )
}
