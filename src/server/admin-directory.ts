import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Read-only admin directory (D-22, D-23). Service role: public.admins has RLS
 * on with no policies and public.list_admins() is executable by service_role
 * only. Call these only after requireAdmin() has passed. Nothing here writes:
 * admins are added or removed only by the owner's reviewed SQL step (D-22).
 */

export type AdminDirectoryRow = {
  userId: string
  displayName: string
  email: string | null
  hasTotp: boolean
  lastSignInAt: string | null
}

/** Every admin with email, verified-TOTP yes/no and last sign-in. Throws on error. */
export async function listAdmins(): Promise<AdminDirectoryRow[]> {
  const { data, error } = await createAdminClient().rpc('list_admins')
  if (error)
    throw new Error(`[listAdmins] list_admins failed: ${error.message}`)
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email ?? null,
    hasTotp: row.has_totp === true,
    lastSignInAt: row.last_sign_in_at ?? null,
  }))
}

/** user_id -> display_name for the audit log. Throws on error (the caller decides the fallback). */
export async function adminNameMap(): Promise<Map<string, string>> {
  const { data, error } = await createAdminClient()
    .from('admins')
    .select('user_id, display_name')
  if (error)
    throw new Error(`[adminNameMap] admins lookup failed: ${error.message}`)
  return new Map((data ?? []).map((row) => [row.user_id, row.display_name]))
}
