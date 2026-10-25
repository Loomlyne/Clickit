// AUTH-01 / AUTH-06: the one routing decision the proxy makes per page request.
// Pure (relative imports only, no server-only marker) so node:test covers it.
// Pages and actions still re-check (requireAdmin, page-level getUser): this is
// the first fence, not the only one.
//
// Order: admin paths first (signed out -> auth; no admins row -> watch; claims
// fail decideAdminMfa -> mfa; else pass), then the public table (pass), then
// signed out -> auth; else pass. `isAdmin` is lazy and only called on admin
// paths, so normal page loads never pay for the RPC. `next` is returned raw;
// the proxy URL-encodes it.

import { decideAdminMfa } from '../admin-access.ts'
import { isPublicPath } from './wall.ts'

export type RouteInput = {
  pathWithoutLocale: string
  userId: string | null
  claims: { aal?: unknown; amr?: unknown } | null
  isAdmin: () => Promise<boolean>
  nowSec: number
}

export type RouteDecision =
  | { action: 'pass' }
  | { action: 'auth'; next: string }
  | { action: 'mfa'; next: string }
  | { action: 'watch' }

function isAdminPath(p: string): boolean {
  return p === '/admin' || p.startsWith('/admin/')
}

export async function decideRoute(input: RouteInput): Promise<RouteDecision> {
  const { pathWithoutLocale, userId, claims, isAdmin, nowSec } = input
  const signedIn = typeof userId === 'string' && userId !== ''

  if (isAdminPath(pathWithoutLocale)) {
    if (!signedIn) return { action: 'auth', next: pathWithoutLocale }
    let admin = false
    try {
      admin = (await isAdmin()) === true
    } catch {
      admin = false
    }
    if (!admin) return { action: 'watch' }
    if (decideAdminMfa(claims ?? {}, nowSec) !== 'ok') {
      return { action: 'mfa', next: pathWithoutLocale }
    }
    return { action: 'pass' }
  }

  if (isPublicPath(pathWithoutLocale)) return { action: 'pass' }
  if (!signedIn) return { action: 'auth', next: pathWithoutLocale }
  return { action: 'pass' }
}
