import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decideRoute } from '../../src/server/auth/gate.ts'

const NOW = 1_800_000_000
const USER = '00000000-0000-4000-8000-000000000001'

function lazy(value: boolean) {
  let calls = 0
  const fn = async () => {
    calls += 1
    return value
  }
  return { fn, calls: () => calls }
}

function run(
  pathWithoutLocale: string,
  opts: {
    userId?: string | null
    claims?: { aal?: unknown; amr?: unknown } | null
    isAdmin?: () => Promise<boolean>
  } = {},
) {
  return decideRoute({
    pathWithoutLocale,
    userId: opts.userId ?? null,
    claims: opts.claims ?? null,
    isAdmin: opts.isAdmin ?? (async () => false),
    nowSec: NOW,
  })
}

const freshAal2 = { aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - 60 }] }
const staleAal2 = { aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - 13 * 3600 }] }
const aal1 = { aal: 'aal1', amr: [{ method: 'password', timestamp: NOW - 60 }] }

test('signed out: walled pages go to auth with the raw path as next', async () => {
  assert.deepEqual(await run('/browse'), { action: 'auth', next: '/browse' })
  assert.deepEqual(await run('/series/a b'), { action: 'auth', next: '/series/a b' })
  assert.deepEqual(await run('/about'), { action: 'auth', next: '/about' })
  assert.deepEqual(await run('/watch'), { action: 'auth', next: '/watch' })
})

test('signed out: public pages pass', async () => {
  for (const p of ['/', '/privacy', '/unsubscribe', '/newsletter/confirm', '/auth', '/auth/mfa', '/portfolio']) {
    assert.deepEqual(await run(p), { action: 'pass' }, p)
  }
})

test('signed out: unknown or empty path fails closed', async () => {
  assert.deepEqual(await run('/anything-new'), { action: 'auth', next: '/anything-new' })
  assert.deepEqual(await run(''), { action: 'auth', next: '' })
})

test('signed in: walled pages pass', async () => {
  assert.deepEqual(await run('/browse', { userId: USER, claims: aal1 }), { action: 'pass' })
  assert.deepEqual(await run('/about', { userId: USER, claims: aal1 }), { action: 'pass' })
})

test('isAdmin is not called for non-admin paths', async () => {
  const a = lazy(true)
  await run('/browse', { userId: USER, claims: aal1, isAdmin: a.fn })
  await run('/browse', { isAdmin: a.fn })
  await run('/privacy', { userId: USER, claims: aal1, isAdmin: a.fn })
  await run('/administrator', { userId: USER, claims: aal1, isAdmin: a.fn })
  assert.equal(a.calls(), 0)
})

test('admin path signed out goes to auth without an admin lookup', async () => {
  const a = lazy(true)
  assert.deepEqual(await run('/admin/shows', { isAdmin: a.fn }), { action: 'auth', next: '/admin/shows' })
  assert.deepEqual(await run('/admin', { isAdmin: a.fn }), { action: 'auth', next: '/admin' })
  assert.equal(a.calls(), 0)
})

test('admin path signed in without an admins row goes to watch', async () => {
  const a = lazy(false)
  assert.deepEqual(await run('/admin/shows', { userId: USER, claims: freshAal2, isAdmin: a.fn }), { action: 'watch' })
  assert.equal(a.calls(), 1)
})

test('admin with aal1 goes to mfa', async () => {
  assert.deepEqual(
    await run('/admin/shows', { userId: USER, claims: aal1, isAdmin: async () => true }),
    { action: 'mfa', next: '/admin/shows' },
  )
})

test('admin with fresh aal2 passes', async () => {
  assert.deepEqual(
    await run('/admin/shows', { userId: USER, claims: freshAal2, isAdmin: async () => true }),
    { action: 'pass' },
  )
  assert.deepEqual(
    await run('/admin', { userId: USER, claims: freshAal2, isAdmin: async () => true }),
    { action: 'pass' },
  )
})

test('admin with 13 h old totp goes to mfa', async () => {
  assert.deepEqual(
    await run('/admin/shows', { userId: USER, claims: staleAal2, isAdmin: async () => true }),
    { action: 'mfa', next: '/admin/shows' },
  )
})

test('admin with null claims goes to mfa (fails closed)', async () => {
  assert.deepEqual(
    await run('/admin', { userId: USER, claims: null, isAdmin: async () => true }),
    { action: 'mfa', next: '/admin' },
  )
})

test('isAdmin rejecting fails closed to watch', async () => {
  assert.deepEqual(
    await run('/admin', {
      userId: USER,
      claims: freshAal2,
      isAdmin: async () => {
        throw new Error('boom')
      },
    }),
    { action: 'watch' },
  )
})
