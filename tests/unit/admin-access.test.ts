import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { type AdminAccessPorts, resolveAdminAccess } from '../../src/server/admin-access.ts'

// AUTH-05 / AUTH-06 / D-17: the one admin decision. requireAdmin() in
// src/server/auth-guards.ts is a thin server-only wrapper over this.

const NOW = 1_800_000_000
const UID = '00000000-0000-4000-8000-000000000001'
const FRESH = { sub: UID, aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - 60 }] }

type Calls = { findAdmin: number; hasVerifiedTotp: number; getUser: number }

function ports(over: Partial<AdminAccessPorts> = {}): { p: AdminAccessPorts; calls: Calls } {
  const calls: Calls = { findAdmin: 0, hasVerifiedTotp: 0, getUser: 0 }
  const base: AdminAccessPorts = {
    getClaims: async () => FRESH,
    getUser: async () => {
      calls.getUser++
      return { id: UID, email: 'admin@example.test' }
    },
    findAdmin: async () => {
      calls.findAdmin++
      return { displayName: 'Test Admin' }
    },
    hasVerifiedTotp: async () => {
      calls.hasVerifiedTotp++
      return true
    },
    nowSec: () => NOW,
  }
  // Wrap overrides so call counters still tick.
  const p: AdminAccessPorts = {
    ...base,
    ...over,
    getUser: async () => {
      calls.getUser++
      return over.getUser ? over.getUser() : base.getUser()
    },
    findAdmin: async (id) => {
      calls.findAdmin++
      return over.findAdmin ? over.findAdmin(id) : { displayName: 'Test Admin' }
    },
    hasVerifiedTotp: async () => {
      calls.hasVerifiedTotp++
      return over.hasVerifiedTotp ? over.hasVerifiedTotp() : true
    },
  }
  return { p, calls }
}

test('no claims -> not_signed_in; getUser never called', async () => {
  const { p, calls } = ports({ getClaims: async () => null })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_signed_in' })
  assert.equal(calls.getUser, 0)
  assert.equal(calls.findAdmin, 0)
})

test('claims without sub -> not_signed_in', async () => {
  const { p } = ports({ getClaims: async () => ({ aal: 'aal2' }) })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_signed_in' })
})

test('getUser returns null -> not_signed_in', async () => {
  const { p, calls } = ports({ getUser: async () => null })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_signed_in' })
  assert.equal(calls.findAdmin, 0)
})

test('getUser error (throws) -> not_signed_in', async () => {
  const { p, calls } = ports({
    getUser: async () => {
      throw new Error('session revoked')
    },
  })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_signed_in' })
  assert.equal(calls.findAdmin, 0)
})

test('claims sub differs from getUser id -> not_signed_in', async () => {
  const { p, calls } = ports({
    getUser: async () => ({ id: '00000000-0000-4000-8000-000000000002', email: null }),
  })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_signed_in' })
  assert.equal(calls.findAdmin, 0)
})

test('user without admins row -> not_admin; MFA ports never called', async () => {
  const { p, calls } = ports({ findAdmin: async () => null })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_admin' })
  assert.equal(calls.hasVerifiedTotp, 0)
})

test('admins lookup gets the verified user id', async () => {
  let seen = ''
  const { p } = ports({
    findAdmin: async (id) => {
      seen = id
      return { displayName: 'Test Admin' }
    },
  })
  await resolveAdminAccess(p)
  assert.equal(seen, UID)
})

test('admin with fresh aal2 totp -> ok with id, email, displayName; factor check skipped', async () => {
  const { p, calls } = ports()
  assert.deepEqual(await resolveAdminAccess(p), {
    ok: true,
    admin: { id: UID, email: 'admin@example.test', displayName: 'Test Admin' },
  })
  assert.equal(calls.hasVerifiedTotp, 0)
})

test('admin at aal1 with a verified factor -> needs_code', async () => {
  const { p, calls } = ports({ getClaims: async () => ({ sub: UID, aal: 'aal1', amr: [] }) })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'needs_code' })
  assert.equal(calls.hasVerifiedTotp, 1)
})

test('admin at aal1 with no verified factor -> needs_enrol', async () => {
  const { p } = ports({
    getClaims: async () => ({ sub: UID, aal: 'aal1', amr: [] }),
    hasVerifiedTotp: async () => false,
  })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'needs_enrol' })
})

test('admin with a stale (13 h) totp -> needs_code', async () => {
  const { p } = ports({
    getClaims: async () => ({
      sub: UID,
      aal: 'aal2',
      amr: [{ method: 'totp', timestamp: NOW - 13 * 3600 }],
    }),
  })
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'needs_code' })
})

test('findAdmin throws (DB down) -> rejects, never ok', async () => {
  const { p } = ports({
    findAdmin: async () => {
      throw new Error('db down')
    },
  })
  await assert.rejects(resolveAdminAccess(p), /db down/)
})

test('hasVerifiedTotp throws -> rejects, never ok', async () => {
  const { p } = ports({
    getClaims: async () => ({ sub: UID, aal: 'aal1', amr: [] }),
    hasVerifiedTotp: async () => {
      throw new Error('factors down')
    },
  })
  await assert.rejects(resolveAdminAccess(p), /factors down/)
})

test('admins lookup runs on every call (no cached admin flag)', async () => {
  let rows: Array<{ displayName: string } | null> = [{ displayName: 'A' }, null]
  const { p } = ports({ findAdmin: async () => rows.shift() ?? null })
  assert.equal((await resolveAdminAccess(p)).ok, true)
  assert.deepEqual(await resolveAdminAccess(p), { ok: false, code: 'not_admin' })
  rows = []
})

// Source-level invariants for the server-only wrapper (it imports next/* and
// server-only, so node --test cannot run it).
const guards = readFileSync('src/server/auth-guards.ts', 'utf8')

test('auth-guards: server-only, requireAdmin wraps resolveAdminAccess, no app_config', () => {
  assert.match(guards, /^import 'server-only'/m)
  assert.match(guards, /export async function requireAdmin\(\)/)
  assert.match(guards, /resolveAdminAccess\(/)
  assert.match(guards, /from\('admins'\)/)
  assert.match(guards, /mfa\.listFactors\(\)/)
  assert.ok(!guards.includes('admin_user_id'))
  assert.ok(!guards.includes('app_config'))
})

test('auth-guards: requireAdminUser returns requireAdmin().id; typed error class exported', () => {
  assert.match(guards, /export async function requireAdminUser\(\)[\s\S]*?\(await requireAdmin\(\)\)\.id/)
  assert.match(guards, /export class AdminAccessError extends Error/)
  assert.match(guards, /export async function getAdminStatus\(\)/)
  assert.match(guards, /export async function requireSignedInUser\(\)/)
})
