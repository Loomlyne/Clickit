import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { decideRoute } from '../../src/server/auth/gate.ts'
import { viewerAccess } from '../../src/server/auth/viewer-access.ts'
import { PUBLIC_EXACT, PUBLIC_PREFIXES } from '../../src/server/auth/wall.ts'

const USER = 'u1'

const WALLED = [
  '/about',
  '/series/abc',
  '/updates',
  '/my-list',
  '/watch',
  '/watch/123',
  '/browse',
  '/profile',
]

const PUBLIC_SAMPLES = [
  ...PUBLIC_EXACT,
  ...PUBLIC_PREFIXES,
  ...PUBLIC_PREFIXES.map((p) => `${p}/x`),
  '/privacy',
  '/terms',
  '/legal/x',
  '/auth',
  '/auth/mfa',
  '/support',
  '/unsubscribe',
  '/newsletter/confirm',
  '/coming-soon',
  '/portfolio',
]

test('signed out: walled viewer pages go to auth with their own path as next', () => {
  for (const p of WALLED) {
    assert.deepEqual(viewerAccess(p, null), { action: 'auth', next: p }, p)
  }
})

test('signed in: walled viewer pages pass', () => {
  for (const p of WALLED) {
    assert.deepEqual(viewerAccess(p, USER), { action: 'pass' }, p)
  }
})

test('signed out: every public path passes (exact list and a sample under every prefix)', () => {
  for (const p of PUBLIC_SAMPLES) {
    assert.deepEqual(viewerAccess(p, null), { action: 'pass' }, p)
  }
})

test('fails closed: look-alikes, unknown and empty paths are walled when signed out', () => {
  for (const p of ['/authx', '/supportx', '/portfoliox', '/legalese', '/newsletter', '/unknown']) {
    assert.deepEqual(viewerAccess(p, null), { action: 'auth', next: p }, p)
  }
  assert.equal(viewerAccess('', null).action, 'auth')
})

test('an empty or non-string user id counts as signed out', () => {
  assert.equal(viewerAccess('/about', '').action, 'auth')
  assert.equal(viewerAccess('/about', undefined as unknown as string | null).action, 'auth')
})

test('agrees with decideRoute (05-18) for every path in the table, signed in and out', async () => {
  for (const p of [...WALLED, ...PUBLIC_SAMPLES]) {
    for (const userId of [null, USER]) {
      const route = await decideRoute({
        pathWithoutLocale: p,
        userId,
        claims: null,
        isAdmin: async () => false,
        nowSec: 1_800_000_000,
      })
      assert.deepEqual(viewerAccess(p, userId), route, `${p} ${userId}`)
    }
  }
})

test('viewer-access.ts is pure: relative imports of wall.ts only, no second wall list', () => {
  const src = readFileSync(new URL('../../src/server/auth/viewer-access.ts', import.meta.url), 'utf8')
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(imports, ['./wall.ts'])
  assert.match(src, /isPublicPath/)
  assert.doesNotMatch(src, /'\/privacy'|'\/support'|'\/auth'/)
})

test('require-viewer.ts: server-only, server-verified getUser, encoded next, locale redirect', () => {
  const src = readFileSync(new URL('../../src/server/auth/require-viewer.ts', import.meta.url), 'utf8')
  assert.match(src, /^import 'server-only'/)
  assert.match(src, /from '@\/lib\/supabase\/server'/)
  assert.match(src, /auth\.getUser\(\)/)
  assert.doesNotMatch(src, /getClaims|getSession/)
  assert.match(src, /viewerAccess\(/)
  assert.match(src, /encodeURIComponent\(/)
  assert.match(src, /from '@\/i18n\/navigation'/)
  assert.match(src, /redirect\(\{\s*href:/)
})
