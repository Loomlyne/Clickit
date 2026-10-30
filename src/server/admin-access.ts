// AUTH-06 / D-19 / Q8: fail closed; any unknown claim shape needs a code.
// Admin TOTP freshness decision from JWT claims (aal, amr). Pure: no imports and
// no server-side-only marker, so node:test and src/proxy.ts can both import it.
// resolveAdminAccess (plan 05-15, below) is the full admin resolution (session, admins row, factor).

export const ADMIN_MFA_MAX_AGE_HOURS = 12

// Age in seconds of the newest totp amr entry, or null when there is none.
// `amr` is [{ method, timestamp }]; method is 'totp' (GoTrue) or 'mfa/totp' (auth-js types).
// A string[] amr (no timestamps) or non-finite timestamps yield null.
export function totpAgeSeconds(amr: unknown, nowSec: number): number | null {
  if (!Array.isArray(amr)) return null
  let newest: number | null = null
  for (const entry of amr as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown }
    if (method !== 'totp' && method !== 'mfa/totp') continue
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue
    newest = newest === null ? timestamp : Math.max(newest, timestamp)
  }
  return newest === null ? null : nowSec - newest
}

export function decideAdminMfa(
  claims: { aal?: unknown; amr?: unknown },
  nowSec: number,
  maxAgeHours = ADMIN_MFA_MAX_AGE_HOURS,
): 'ok' | 'needs_code' {
  if (claims.aal !== 'aal2') return 'needs_code'
  const age = totpAgeSeconds(claims.amr, nowSec)
  // age >= 0: a timestamp in the future never counts as fresh.
  return age !== null && age >= 0 && age <= maxAgeHours * 3600 ? 'ok' : 'needs_code'
}

// ---------------------------------------------------------------------------
// D-17 / Phase 6 contract item 1: the one admin decision. Order (RESEARCH
// Pattern 1): claims -> getUser (network; catches revoked sessions) -> admins
// row (every call, no cached flag) -> MFA freshness -> factor check only when
// the MFA decision is not ok. Port errors from findAdmin / hasVerifiedTotp
// propagate (fail closed: the caller never gets ok).

export type AdminAccessCode = 'not_signed_in' | 'not_admin' | 'needs_enrol' | 'needs_code'

export type AdminIdentity = { id: string; email: string | null; displayName: string }

export type AdminAccessResult =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; code: AdminAccessCode }

export type AdminAccessPorts = {
  getClaims(): Promise<{ sub?: string; aal?: unknown; amr?: unknown } | null>
  getUser(): Promise<{ id: string; email: string | null } | null>
  findAdmin(userId: string): Promise<{ displayName: string } | null>
  hasVerifiedTotp(): Promise<boolean>
  nowSec(): number
}

export async function resolveAdminAccess(ports: AdminAccessPorts): Promise<AdminAccessResult> {
  const claims = await ports.getClaims()
  if (!claims || typeof claims.sub !== 'string' || claims.sub === '') {
    return { ok: false, code: 'not_signed_in' }
  }

  let user: { id: string; email: string | null } | null
  try {
    user = await ports.getUser()
  } catch {
    return { ok: false, code: 'not_signed_in' }
  }
  if (!user || user.id !== claims.sub) return { ok: false, code: 'not_signed_in' }

  const row = await ports.findAdmin(user.id)
  if (!row) return { ok: false, code: 'not_admin' }

  if (decideAdminMfa(claims, ports.nowSec()) === 'ok') {
    return { ok: true, admin: { id: user.id, email: user.email, displayName: row.displayName } }
  }

  return { ok: false, code: (await ports.hasVerifiedTotp()) ? 'needs_code' : 'needs_enrol' }
}
