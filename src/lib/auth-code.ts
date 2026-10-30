// D-07, D-10, Q5: one code normaliser and one set of timing constants for
// client screens and server actions (the server re-normalises, never trusts
// the client). AUTH_LINK_MINUTES must equal the Supabase Email OTP expiration
// (900 s, owner step 05-35); templates and copy read this constant.

// m:ss resend countdown. Phase 6's formatClock is on this branch, so reuse it
// under the name the auth screens use (UI-SPEC Typography, numbers and digits).
export { formatClock as formatCountdown } from './i18n-format.ts'

export const CODE_LENGTH = 6
export const AUTH_LINK_MINUTES = 15
export const RESEND_WAIT_SECONDS = 60

// Whitespace, hyphen and bidi controls (U+200E, U+200F, U+202A-202E,
// U+2066-2069) that pasted codes pick up in Arabic (RTL) contexts.
const STRIP = /[\s\-‎‏‪-‮⁦-⁩]/g

function toAsciiDigit(ch: string): string {
  const cp = ch.charCodeAt(0)
  if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660)
  if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0)
  return ch
}

export function normalizeCode(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(STRIP, '')
    .replace(/[٠-٩۰-۹]/g, toAsciiDigit)
    .replace(/[^0-9]/g, '')
    .slice(0, CODE_LENGTH)
}

export function resendRemaining(sentAtMs: number, nowMs: number): number {
  return Math.max(
    0,
    Math.ceil((sentAtMs + RESEND_WAIT_SECONDS * 1000 - nowMs) / 1000)
  )
}
