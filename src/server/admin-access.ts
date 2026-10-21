// AUTH-06 / D-19 / Q8: fail closed; any unknown claim shape needs a code.
// Admin TOTP freshness decision from JWT claims (aal, amr). Pure: no imports and
// no server-side-only marker, so node:test and src/proxy.ts can both import it. Plan 05-15
// extends this file with the full admin resolution (session, admins row, factor).

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
