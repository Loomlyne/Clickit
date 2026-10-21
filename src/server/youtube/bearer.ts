// Constant-time Bearer check for the YouTube re-check cron route (PR #27
// review, finding 1). Both sides are hashed with SHA-256 first, so
// timingSafeEqual always compares two 32-byte digests: no length leak and no
// early exit on the first differing character. Missing secret or header: false.
// Phase 2 replaces this with cronAuthOk from src/server/cron-auth.ts.

import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

export function bearerMatches(
  header: string | null | undefined,
  secret: string | null | undefined
): boolean {
  const trimmed = secret?.trim()
  if (!trimmed || !header) return false
  return timingSafeEqual(digest(header), digest(`Bearer ${trimmed}`))
}
