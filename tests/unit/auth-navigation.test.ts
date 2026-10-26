import assert from 'node:assert/strict'
import { test } from 'node:test'

import { authInitialMode, getSafeAuthNextPath } from '../../src/lib/auth-navigation.ts'

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

// 05-22: /auth keeps the validated next for every show and episode (D-03, D-04).
test('safe next keeps show and episode paths', () => {
  assert.equal(getSafeAuthNextPath('/series/sample-show'), '/series/sample-show')
  const episode = '/watch/7f9c2a4e-3b1d-4c8e-9a6f-2d5b8e1c0a47'
  assert.equal(getSafeAuthNextPath(episode), episode)
  assert.equal(getSafeAuthNextPath('/ar/series/sample-show'), '/series/sample-show')
})

test('safe next refuses protocol-relative, absolute and backslash tricks', () => {
  assert.equal(getSafeAuthNextPath('//evil.com/series/x', ''), '')
  assert.equal(getSafeAuthNextPath('https://evil.com', ''), '')
  assert.equal(getSafeAuthNextPath('/\\evil.com', ''), '')
  assert.equal(getSafeAuthNextPath('/\\evil.com'), '/watch')
})

test('authInitialMode maps the mode search param to the first screen', () => {
  assert.equal(authInitialMode('forgot'), 'forgot')
  assert.equal(authInitialMode('password'), 'password')
  assert.equal(authInitialMode('signup'), 'signup-password')
  assert.equal(authInitialMode('x'), 'email')
  assert.equal(authInitialMode(undefined), 'email')
  assert.equal(authInitialMode(null), 'email')
  assert.equal(authInitialMode(['forgot']), 'email')
})
