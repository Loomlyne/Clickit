// AUTH-06 / D-18..D-20: pure decisions for the admin authenticator page
// (/{locale}/auth/mfa). No imports and no server-only marker, so node:test
// covers it. The server actions in src/app/[locale]/(viewer)/auth/mfa/actions.ts
// wire these to supabase.auth.mfa.* . Nothing here sees or returns a TOTP
// secret except formatManualKey, which only regroups it for display.

export type MfaStep = 'enrol' | 'verify'

/** An admin with no verified TOTP factor enrols; one or more -> enter a code. */
export function mfaStep({ verifiedTotp }: { verifiedTotp: number }): MfaStep {
  return Number.isFinite(verifiedTotp) && verifiedTotp > 0 ? 'verify' : 'enrol'
}

/** D-20: a first authenticator plus at most one second one. */
export const MAX_ADMIN_TOTP = 2

/**
 * May this admin session start an enrolment? The first factor only while
 * enrolment is due (no verified factor); a second one only right after a fresh
 * code (aal2, MFA ok) and below MAX_ADMIN_TOTP. A session that still owes a
 * code (needs_code) never adds a factor: that would sidestep the code.
 */
export function enrolAllowed({
  mfa,
  verifiedTotp,
}: {
  mfa: 'ok' | 'needs_enrol' | 'needs_code' | null
  verifiedTotp: number
}): boolean {
  if (mfa === 'needs_enrol') return verifiedTotp === 0
  if (mfa === 'ok') return verifiedTotp >= 1 && verifiedTotp < MAX_ADMIN_TOTP
  return false
}

/** 'JBSWY3DPEHPK3PXP' -> 'JBSW Y3DP EHPK 3PXP' (display only; copy the ungrouped key). */
export function formatManualKey(secret: string): string {
  const compact = secret.replace(/\s+/g, '').toUpperCase()
  return (compact.match(/.{1,4}/g) ?? []).join(' ')
}

const NAME_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const NAME_LENGTH = 4
const NAME_SPACE = NAME_ALPHABET.length ** NAME_LENGTH
const RANDOM_TRIES = 16

function nameAt(index: number): string {
  let n = index
  let out = ''
  for (let i = 0; i < NAME_LENGTH; i++) {
    out = NAME_ALPHABET[n % NAME_ALPHABET.length] + out
    n = Math.floor(n / NAME_ALPHABET.length)
  }
  return `Authenticator ${out}`
}

function randomIndex(random: () => number): number {
  const r = random()
  const unit = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1 - Number.EPSILON) : 0
  return Math.floor(unit * NAME_SPACE)
}

/**
 * A friendly name no existing factor of the user has (Supabase refuses a
 * duplicate with mfa_factor_name_conflict). Random first; if random keeps
 * colliding, walk forward from the last candidate so the result is always new.
 */
export function friendlyNameFor(existingNames: readonly string[], random: () => number): string {
  const taken = new Set(existingNames)
  let index = 0
  for (let i = 0; i < RANDOM_TRIES; i++) {
    index = randomIndex(random)
    const name = nameAt(index)
    if (!taken.has(name)) return name
  }
  for (let step = 1; step < NAME_SPACE; step++) {
    const name = nameAt((index + step) % NAME_SPACE)
    if (!taken.has(name)) return name
  }
  // 1.6 million names taken: impossible with Supabase's factor limit.
  throw new Error('[mfa] no free authenticator name')
}

export type VerifyOneResult = 'ok' | 'wrong' | 'rate_limited'

export type MfaErrorKey = 'mfaCodeWrong' | 'mfaTooMany'

export type VerifyAcrossResult =
  | { ok: true; factorId: string }
  | { ok: false; error: MfaErrorKey }

/**
 * With two authenticators a code from either is accepted (D-20). Tries the
 * factors in the given order (the caller passes newest first) and stops at the
 * first success. A rate-limit answer stops at once: trying the next factor
 * would only spend more of the 15/min verify budget. A thrown verifyOne counts
 * as a failure for that factor only.
 */
export async function verifyAcrossFactors(
  factorIds: readonly string[],
  code: string,
  verifyOne: (factorId: string, code: string) => Promise<VerifyOneResult>,
): Promise<VerifyAcrossResult> {
  if (!/^[0-9]{6}$/.test(code)) return { ok: false, error: 'mfaCodeWrong' }
  for (const factorId of factorIds) {
    let result: VerifyOneResult
    try {
      result = await verifyOne(factorId, code)
    } catch {
      result = 'wrong'
    }
    if (result === 'ok') return { ok: true, factorId }
    if (result === 'rate_limited') return { ok: false, error: 'mfaTooMany' }
  }
  return { ok: false, error: 'mfaCodeWrong' }
}
