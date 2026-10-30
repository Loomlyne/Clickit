import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PUBLIC_EXACT,
  PUBLIC_PREFIXES,
  isPublicPath,
} from '../../src/server/auth/wall.ts'

function assertAll(paths: string[], expected: boolean) {
  for (const p of paths) {
    assert.equal(isPublicPath(p), expected, `${JSON.stringify(p)} should be ${expected ? 'open' : 'walled'}`)
  }
}

test('landing and portfolio paths are open', () => {
  assertAll(['/', '/portfolio', '/portfolio/x'], true)
})

test('legal pages are open', () => {
  assertAll(['/privacy', '/terms', '/legal', '/legal/cookies'], true)
})

test('auth pages are open', () => {
  assertAll(
    ['/auth', '/auth/confirm', '/auth/mfa', '/auth/welcome', '/auth/reset-password'],
    true
  )
})

test('support and coming-soon are open', () => {
  assertAll(['/support', '/coming-soon'], true)
})

test('the two public email pages are open', () => {
  assertAll(['/unsubscribe', '/newsletter/confirm'], true)
})

test('/about is walled (Q2=A)', () => {
  assertAll(['/about'], false)
})

test('viewer, account and admin paths are walled', () => {
  assertAll(
    [
      '/browse',
      '/series/x',
      '/watch/e1',
      '/my-list',
      '/profile',
      '/updates',
      '/admin',
      '/admin/shows',
      '/design-system',
    ],
    false
  )
})

test('/newsletter alone is walled; only /newsletter/confirm is open', () => {
  assertAll(['/newsletter'], false)
  assertAll(['/newsletter/confirm'], true)
})

test('look-alike paths are walled (prefix needs a slash boundary)', () => {
  assertAll(['/authx', '/supportx', '/portfoliox', '/legalese'], false)
})

test("exact '/' does not open sub-paths", () => {
  assertAll(['/browse', '/x', '//'], false)
})

test('empty and non-string input is walled', () => {
  assert.equal(isPublicPath(''), false)
  assert.equal(isPublicPath(undefined as unknown as string), false)
  assert.equal(isPublicPath(null as unknown as string), false)
  assert.equal(isPublicPath(42 as unknown as string), false)
})

test('exported tables are the D-01 list', () => {
  assert.deepEqual([...PUBLIC_EXACT], ['/', '/portfolio', '/newsletter/confirm', '/unsubscribe'])
  assert.deepEqual(
    [...PUBLIC_PREFIXES],
    ['/portfolio', '/privacy', '/terms', '/legal', '/auth', '/support', '/coming-soon']
  )
})
