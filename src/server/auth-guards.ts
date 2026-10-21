import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin check shared by the direct-to-R2 upload actions. Same logic and the same
 * error text as `assertAdmin` in src/app/[locale]/admin/actions.ts (plan 02-15
 * switches that file to this guard): the caller must be signed in AND be the
 * `admin_user_id` of app_config row 1. Returns the user id or throws.
 */
export async function requireAdminUser(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Always scope to id=1. Without .eq('id', 1) a hypothetical second row in
  // app_config would make .single() throw, locking every admin action.
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()

  if (config?.admin_user_id !== user.id) throw new Error('Unauthorized')
  return user.id
}

/** Any signed-in user (own avatar). Returns the user id or throws. */
export async function requireSignedInUser(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}
