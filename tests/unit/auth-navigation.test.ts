import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getSafeAuthNextPath } from '../../src/lib/auth-navigation.ts'

test('auth success replaces /auth with default viewer route', () => {
  const history = ['/en/portfolio', '/en/auth']
  history[history.length - 1] = getSafeAuthNextPath(null)

  assert.deepEqual(history, ['/en/portfolio', '/watch'])
  assert.notEqual(history.at(-2), '/en/auth')
})

test('auth success preserves a safe next route without keeping auth in history', () => {
  const history = ['/en/portfolio', '/en/auth?next=/my-list']
  history[history.length - 1] = getSafeAuthNextPath('/my-list')

  assert.deepEqual(history, ['/en/portfolio', '/my-list'])
  assert.notEqual(history.at(-1), '/auth')
})

test('safe next strips locale prefixes for next-intl navigation', () => {
  assert.equal(getSafeAuthNextPath('/en/my-list'), '/my-list')
  assert.equal(
    getSafeAuthNextPath('/ar/watch?category=featured'),
    '/watch?category=featured'
  )
})

test('safe next rejects external and auth-loop paths', () => {
  assert.equal(getSafeAuthNextPath('https://evil.test'), '/watch')
  assert.equal(getSafeAuthNextPath('//evil.test'), '/watch')
  assert.equal(getSafeAuthNextPath('/\\evil.test'), '/watch')
  assert.equal(getSafeAuthNextPath('/auth?next=/my-list'), '/watch')
  assert.equal(getSafeAuthNextPath('/en/auth'), '/watch')
})

test('sign-out replace removes protected profile from the immediate back stack', () => {
  const history = ['/en/watch', '/en/profile']
  history[history.length - 1] = getSafeAuthNextPath(null)

  assert.deepEqual(history, ['/en/watch', '/watch'])
  assert.notEqual(history.at(-1), '/en/profile')
})
