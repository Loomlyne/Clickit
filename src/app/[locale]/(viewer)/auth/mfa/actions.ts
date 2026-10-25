'use server'

// AUTH-06 / D-18..D-20 / D-23: server actions behind /{locale}/auth/mfa.
// - Every action re-checks the admin with getAdminStatus() (admins row on every
//   call) and refuses anyone else (T-05-25-01).
// - challenge + verify run here, on the session client, so Supabase writes the
//   aal2 session cookies itself (fresh totp amr entry).
// - The TOTP secret and QR go back to the enrolling admin's browser once and
//   are never logged, stored or audited (T-05-25-02). Codes are never logged.
// - Enrol, leftover-factor removal and failed codes write admin_auth audit
//   rows naming the admin (D-23, T-05-25-05).

import { logAudit } from '@/lib/audit'
import { normalizeCode } from '@/lib/auth-code'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminStatus } from '@/server/auth-guards'
import {
  enrolAllowed,
  formatManualKey,
  friendlyNameFor,
  verifyAcrossFactors,
  type VerifyOneResult,
} from '@/server/auth/mfa-core'

export type MfaActionError = 'mfaCodeWrong' | 'mfaTooMany' | 'mfaEnrolFailed' | 'unauthorized'

export type StartEnrolResult =
  | { ok: true; factorId: string; qr: string; manualKey: string }
  | { ok: false; error: MfaActionError }

export type VerifyEnrolResult = { ok: true } | { ok: false; error: MfaActionError }

export type VerifyAdminCodeResult =
  | { ok: true; destination: string }
  | { ok: false; error: MfaActionError }

type SessionClient = Awaited<ReturnType<typeof createClient>>
type AuthErrorLike = { status?: number; code?: string } | null | undefined

function isRateLimited(error: AuthErrorLike): boolean {
  return error?.status === 429 || error?.code === 'over_request_rate_limit'
}

/** Status and Supabase error name only; never request values. */
function authErrorTag(error: AuthErrorLike): string {
  return `${error?.status ?? '-'}:${error?.code ?? '-'}`
}

/** The admin's own user id, or null (signed out between page load and action). */
async function currentUserId(supabase: SessionClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function listTotp(supabase: SessionClient) {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return null
  return data.all.filter((f) => f.factor_type === 'totp')
}

/** One TOTP check: challenge, then verify (Supabase sets the aal2 cookies on success). */
async function challengeAndVerify(
  supabase: SessionClient,
  factorId: string,
  code: string,
): Promise<VerifyOneResult> {
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error || !challenge.data) {
    return isRateLimited(challenge.error) ? 'rate_limited' : 'wrong'
  }
  const verified = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  })
  if (verified.error) return isRateLimited(verified.error) ? 'rate_limited' : 'wrong'
  return 'ok'
}

async function auditFailure(adminUserId: string, reason: string): Promise<void> {
  // At least the first failure is always written; GoTrue's verify limit
  // (15/min per IP) bounds how many rows a guessing run can add.
  await logAudit({
    adminUserId,
    action: 'mfa_failed',
    entity: 'admin_auth',
    entityId: adminUserId,
    diff: { reason },
  })
}

/**
 * Starts a TOTP enrolment: removes the admin's leftover unverified TOTP
 * factors (a reloaded half-finished setup), then enrols one with a unique
 * friendly name. Returns the QR and the grouped key to this browser only.
 */
export async function startEnrol(): Promise<StartEnrolResult> {
  const status = await getAdminStatus()
  if (!status.isAdmin) return { ok: false, error: 'unauthorized' }

  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, error: 'unauthorized' }

  const factors = await listTotp(supabase)
  if (!factors) return { ok: false, error: 'mfaEnrolFailed' }
  const verified = factors.filter((f) => f.status === 'verified')
  if (!enrolAllowed({ mfa: status.mfa, verifiedTotp: verified.length })) {
    return { ok: false, error: 'unauthorized' }
  }

  const leftovers = factors.filter((f) => f.status !== 'verified')
  let removed = 0
  for (const f of leftovers) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) {
      console.error('[mfa] unenrol refused', authErrorTag(error))
      return { ok: false, error: isRateLimited(error) ? 'mfaTooMany' : 'mfaEnrolFailed' }
    }
    removed++
  }
  if (removed > 0) {
    await logAudit({
      adminUserId: userId,
      action: 'mfa_unenrol',
      entity: 'admin_auth',
      entityId: userId,
      diff: { count: removed, status: 'unverified', by: 'enrol restart' },
    })
  }

  const friendlyName = friendlyNameFor(
    verified.map((f) => f.friendly_name ?? '').filter(Boolean),
    () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
  )
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
    issuer: 'Clickit Story',
  })
  if (error || !data) {
    console.error('[mfa] enrol refused', authErrorTag(error))
    return { ok: false, error: isRateLimited(error) ? 'mfaTooMany' : 'mfaEnrolFailed' }
  }

  return {
    ok: true,
    factorId: data.id,
    qr: data.totp.qr_code,
    manualKey: formatManualKey(data.totp.secret),
  }
}

/** Verifies the code for the factor just enrolled; the session becomes aal2. */
export async function verifyEnrol(input: { factorId: string; code: string }): Promise<VerifyEnrolResult> {
  const status = await getAdminStatus()
  if (!status.isAdmin || (status.mfa !== 'needs_enrol' && status.mfa !== 'ok')) {
    return { ok: false, error: 'unauthorized' }
  }

  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, error: 'unauthorized' }

  const factorId = typeof input?.factorId === 'string' ? input.factorId : ''
  const normalized = normalizeCode(input?.code)

  // Only the admin's own unverified TOTP factor (never a verified one: that is
  // the code page's job, with its own checks).
  const factors = await listTotp(supabase)
  if (!factors) return { ok: false, error: 'mfaEnrolFailed' }
  const factor = factors.find((f) => f.id === factorId && f.status !== 'verified')
  if (!factor) return { ok: false, error: 'mfaEnrolFailed' }

  const result = await verifyAcrossFactors([factor.id], normalized, (id, c) =>
    challengeAndVerify(supabase, id, c),
  )
  if (!result.ok) {
    await auditFailure(userId, result.error === 'mfaTooMany' ? 'too_many' : 'wrong_code_enrol')
    return { ok: false, error: result.error }
  }

  await logAudit({
    adminUserId: userId,
    action: 'mfa_enrol',
    entity: 'admin_auth',
    entityId: userId,
    diff: { factor_friendly_name: factor.friendly_name ?? null },
  })
  return { ok: true }
}

/**
 * The admin code page: tries the code against the admin's verified TOTP
 * factors, newest first (a code from either authenticator is accepted).
 * Success returns the safe destination (next, else /admin).
 */
export async function verifyAdminCode(input: { code: string; next?: string | null }): Promise<VerifyAdminCodeResult> {
  const destination = getSafeAuthNextPath(input?.next ?? null, '/admin')
  const status = await getAdminStatus()
  if (!status.isAdmin) return { ok: false, error: 'unauthorized' }
  if (status.mfa === 'ok') return { ok: true, destination }
  if (status.mfa !== 'needs_code') return { ok: false, error: 'unauthorized' }

  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return { ok: false, error: 'unauthorized' }

  const factors = await listTotp(supabase)
  if (!factors) return { ok: false, error: 'mfaCodeWrong' }
  const verifiedNewestFirst = factors
    .filter((f) => f.status === 'verified')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((f) => f.id)

  const result = await verifyAcrossFactors(verifiedNewestFirst, normalizeCode(input?.code), (id, c) =>
    challengeAndVerify(supabase, id, c),
  )
  if (!result.ok) {
    await auditFailure(userId, result.error === 'mfaTooMany' ? 'too_many' : 'wrong_code')
    return { ok: false, error: result.error }
  }
  return { ok: true, destination }
}
