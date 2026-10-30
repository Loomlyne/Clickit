import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  type AdminAccessCode,
  type AdminAccessPorts,
  type AdminIdentity,
  resolveAdminAccess,
} from '@/server/admin-access'

/**
 * The one admin gate (D-17; Phase 6 contract items 1 and 7). Every admin page,
 * action and API route goes through requireAdmin(). The decision itself is the
 * pure resolveAdminAccess() in src/server/admin-access.ts (unit tested); this
 * file only wires it to the session client and the service-role client.
 *
 * - signed in: getClaims (local JWT verify) AND getUser (Auth server; catches a
 *   revoked or banned session), with matching ids
 * - admin: a public.admins row, looked up on EVERY call (removing the row takes
 *   effect on the next admin request; no cached flag)
 * - MFA: aal2 with a TOTP verification no older than ADMIN_MFA_MAX_AGE_HOURS
 * - any lookup error fails closed (throws; never returns an admin)
 *
 * The legacy single-admin id in the app config row is NOT read here: on live it
 * is a test account and must not grant admin.
 */

export class AdminAccessError extends Error {
  readonly code: AdminAccessCode

  constructor(code: AdminAccessCode) {
    // Generic messages only (T-05-15-03); the typed code drives redirects.
    super(code === 'not_signed_in' || code === 'not_admin' ? 'Unauthorized' : 'Admin verification required')
    this.name = 'AdminAccessError'
    this.code = code
  }
}

async function adminAccessPorts(): Promise<AdminAccessPorts> {
  const supabase = await createClient()
  return {
    async getClaims() {
      const { data, error } = await supabase.auth.getClaims()
      if (error || !data) return null
      const { sub, aal, amr } = data.claims
      return { sub, aal, amr }
    },
    async getUser() {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!data.user) return null
      return { id: data.user.id, email: data.user.email ?? null }
    },
    async findAdmin(userId) {
      const { data, error } = await createAdminClient()
        .from('admins')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw new Error(`[requireAdmin] admins lookup failed: ${error.message}`)
      return data ? { displayName: data.display_name } : null
    },
    async hasVerifiedTotp() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw new Error(`[requireAdmin] factor lookup failed: ${error.message}`)
      // `totp` holds verified TOTP factors only.
      return (data?.totp?.length ?? 0) > 0
    },
    nowSec: () => Math.floor(Date.now() / 1000),
  }
}

/** Returns the acting admin or throws AdminAccessError (or a lookup error: fail closed). */
export async function requireAdmin(): Promise<AdminIdentity> {
  const result = await resolveAdminAccess(await adminAccessPorts())
  if (!result.ok) throw new AdminAccessError(result.code)
  return result.admin
}

/** Admin user id (upload actions, audit actor). Same gate as requireAdmin(). */
export async function requireAdminUser(): Promise<string> {
  return (await requireAdmin()).id
}

export type AdminStatus = {
  signedIn: boolean
  isAdmin: boolean
  mfa: 'ok' | 'needs_enrol' | 'needs_code' | null
}

/**
 * Non-throwing view of the same decision, for pages deciding where to send a
 * user. Never grants anything: actions still call requireAdmin(). A lookup
 * error reports isAdmin false.
 */
export async function getAdminStatus(): Promise<AdminStatus> {
  try {
    const result = await resolveAdminAccess(await adminAccessPorts())
    if (result.ok) return { signedIn: true, isAdmin: true, mfa: 'ok' }
    switch (result.code) {
      case 'not_signed_in':
        return { signedIn: false, isAdmin: false, mfa: null }
      case 'not_admin':
        return { signedIn: true, isAdmin: false, mfa: null }
      case 'needs_enrol':
      case 'needs_code':
        return { signedIn: true, isAdmin: true, mfa: result.code }
    }
  } catch {
    // Fail closed. The session itself may be fine; only the admin part is unknown.
    return { signedIn: await isSignedIn(), isAdmin: false, mfa: null }
  }
}

async function isSignedIn(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return Boolean(data.user)
  } catch {
    return false
  }
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
