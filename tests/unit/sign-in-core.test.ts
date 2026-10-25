import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildEmailRedirect,
  destinationAfterSignIn,
  emailSubject,
  isLockedOut,
  mapAuthErrorKey,
  passwordPolicyCheck,
  pickEmailOrigin,
} from '../../src/server/auth/sign-in-core.ts'
import type { RateLimitStore } from '../../src/server/rate-limit-policy.ts'

// ---------------------------------------------------------------- mapAuthErrorKey

test('rate limits map to tooManyTries', () => {
  assert.equal(mapAuthErrorKey({ code: 'over_request_rate_limit' }), 'tooManyTries')
  assert.equal(mapAuthErrorKey({ code: 'over_email_send_rate_limit' }), 'tooManyTries')
  assert.equal(mapAuthErrorKey({ status: 429 }), 'tooManyTries')
  assert.equal(mapAuthErrorKey({ status: 429, code: 'something_new' }), 'tooManyTries')
})

test('expired or invalid code maps to codeWrong', () => {
  assert.equal(mapAuthErrorKey({ code: 'otp_expired' }), 'codeWrong')
  assert.equal(mapAuthErrorKey({ message: 'Token has expired or is invalid', status: 403 }), 'codeWrong')
  assert.equal(mapAuthErrorKey({ message: 'Invalid OTP' }), 'codeWrong')
})

test('named Supabase codes map to their keys', () => {
  assert.equal(mapAuthErrorKey({ code: 'captcha_failed' }), 'captcha')
  assert.equal(mapAuthErrorKey({ code: 'invalid_credentials' }), 'authInvalidCredentials')
  assert.equal(mapAuthErrorKey({ code: 'email_not_confirmed' }), 'authEmailNotConfirmed')
  assert.equal(mapAuthErrorKey({ code: 'weak_password' }), 'passwordMin')
  assert.equal(mapAuthErrorKey({ code: 'user_already_exists' }), 'authEmailTaken')
})

test('unknown, empty and non-object errors map to authGeneric', () => {
  assert.equal(mapAuthErrorKey({ code: 'unexpected_failure', status: 500 }), 'authGeneric')
  assert.equal(mapAuthErrorKey({}), 'authGeneric')
  assert.equal(mapAuthErrorKey(null), 'authGeneric')
  assert.equal(mapAuthErrorKey('boom'), 'authGeneric')
})

test('a caller-supplied fallback replaces authGeneric only', () => {
  assert.equal(mapAuthErrorKey({ code: 'unexpected_failure' }, 'codeSendFailed'), 'codeSendFailed')
  assert.equal(mapAuthErrorKey({ code: 'over_request_rate_limit' }, 'codeSendFailed'), 'tooManyTries')
})

// ---------------------------------------------------------------- buildEmailRedirect

test('buildEmailRedirect builds the locale confirm page with an encoded next', () => {
  assert.equal(
    buildEmailRedirect('https://www.clickitstory.ae', 'ar', '/series/x'),
    'https://www.clickitstory.ae/ar/auth/confirm?next=%2Fseries%2Fx'
  )
  assert.equal(
    buildEmailRedirect('http://localhost:3000/', 'en', '/watch/abc?t=1'),
    'http://localhost:3000/en/auth/confirm?next=%2Fwatch%2Fabc%3Ft%3D1'
  )
})

test('buildEmailRedirect turns an unsafe or missing next into /browse', () => {
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'evil', '', null, undefined]) {
    assert.equal(
      buildEmailRedirect('https://www.clickitstory.ae', 'en', bad),
      'https://www.clickitstory.ae/en/auth/confirm?next=%2Fbrowse',
      String(bad)
    )
  }
})

// ---------------------------------------------------------------- pickEmailOrigin

const SITE = 'https://www.clickitstory.ae'

test('pickEmailOrigin uses the site URL when the request host matches it', () => {
  assert.equal(pickEmailOrigin(SITE, 'www.clickitstory.ae'), SITE)
  assert.equal(pickEmailOrigin(SITE, 'WWW.CLICKITSTORY.AE'), SITE)
})

test('pickEmailOrigin allows only localhost, 127.0.0.1 and workers.dev request hosts', () => {
  assert.equal(pickEmailOrigin(SITE, 'localhost:3000'), 'http://localhost:3000')
  assert.equal(pickEmailOrigin(SITE, '127.0.0.1:8787'), 'http://127.0.0.1:8787')
  assert.equal(pickEmailOrigin(SITE, 'clickit.loomlyne.workers.dev'), 'https://clickit.loomlyne.workers.dev')
})

test('pickEmailOrigin never echoes an arbitrary host', () => {
  assert.equal(pickEmailOrigin(SITE, 'evil.com'), SITE)
  assert.equal(pickEmailOrigin(SITE, 'workers.dev.evil.com'), SITE)
  assert.equal(pickEmailOrigin(SITE, 'localhost.evil.com'), SITE)
  assert.equal(pickEmailOrigin(SITE, 'evil.com/x'), SITE)
  assert.equal(pickEmailOrigin(SITE, 'evil.com@localhost'), SITE)
  assert.equal(pickEmailOrigin(SITE, ''), SITE)
  assert.equal(pickEmailOrigin(SITE, null), SITE)
})

test('pickEmailOrigin returns null when nothing is trustworthy', () => {
  assert.equal(pickEmailOrigin(undefined, 'evil.com'), null)
  assert.equal(pickEmailOrigin('not a url', 'evil.com'), null)
  assert.equal(pickEmailOrigin(undefined, 'localhost:3000'), 'http://localhost:3000')
})

// ---------------------------------------------------------------- destinationAfterSignIn

test('a new viewer goes to the name step with next encoded', () => {
  assert.equal(
    destinationAfterSignIn({ needsOnboarding: true, isAdmin: false, next: '/series/x' }),
    '/auth/welcome?next=%2Fseries%2Fx'
  )
  assert.equal(
    destinationAfterSignIn({ needsOnboarding: true, isAdmin: false, next: null }),
    '/auth/welcome?next=%2Fbrowse'
  )
})

test('an admin with no next lands on /admin', () => {
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: true, next: null }), '/admin')
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: true, next: '//evil.com' }), '/admin')
})

test('a given safe next wins, else /browse', () => {
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: true, next: '/series/x' }), '/series/x')
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next: '/ar/my-list' }), '/my-list')
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next: null }), '/browse')
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next: 'https://evil.com' }), '/browse')
  assert.equal(destinationAfterSignIn({ needsOnboarding: false, isAdmin: false, next: '/auth?next=/x' }), '/browse')
})

// ---------------------------------------------------------------- passwordPolicyCheck

function pwnedStub(answer: boolean | null) {
  const calls: string[] = []
  const fn = async (password: string) => {
    calls.push(password)
    return answer
  }
  return { fn, calls }
}

function logStub() {
  const warns: string[] = []
  return { warns, log: { warn: (m: string) => void warns.push(m) } }
}

test('a short password is passwordMin without calling isPwned', async () => {
  const pwned = pwnedStub(false)
  assert.equal(await passwordPolicyCheck('short', pwned.fn), 'passwordMin')
  assert.equal(await passwordPolicyCheck('1234567', pwned.fn), 'passwordMin')
  assert.equal(await passwordPolicyCheck(undefined, pwned.fn), 'passwordMin')
  assert.equal(await passwordPolicyCheck(12345678, pwned.fn), 'passwordMin')
  assert.deepEqual(pwned.calls, [])
})

test('a leaked password is pwLeaked', async () => {
  const pwned = pwnedStub(true)
  assert.equal(await passwordPolicyCheck('password123', pwned.fn), 'pwLeaked')
  assert.deepEqual(pwned.calls, ['password123'])
})

test('HIBP unavailable allows with one warning and no password in the log', async () => {
  const pwned = pwnedStub(null)
  const { warns, log } = logStub()
  assert.equal(await passwordPolicyCheck('correct horse battery', pwned.fn, log), 'ok')
  assert.equal(warns.length, 1)
  assert.match(warns[0], /\[auth\/hibp\] unavailable/)
  assert.ok(!warns[0].includes('correct horse'))
})

test('HIBP throwing also fails open with a warning', async () => {
  const { warns, log } = logStub()
  const result = await passwordPolicyCheck('correct horse battery', async () => {
    throw new Error('network')
  }, log)
  assert.equal(result, 'ok')
  assert.equal(warns.length, 1)
})

test('a clean password is ok with no warning', async () => {
  const pwned = pwnedStub(false)
  const { warns, log } = logStub()
  assert.equal(await passwordPolicyCheck('correct horse battery', pwned.fn, log), 'ok')
  assert.deepEqual(warns, [])
})

// ---------------------------------------------------------------- emailSubject + isLockedOut

test('emailSubject is the SHA-256 hex of the trimmed, lowercased email', async () => {
  const a = await emailSubject('  Viewer@Example.COM ')
  const b = await emailSubject('viewer@example.com')
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.ok(!a.includes('viewer'))
})

function memoryStore(counts: Record<string, number>, opts: { fail?: boolean } = {}) {
  const records: string[] = []
  const store: RateLimitStore = {
    async count(subject, key) {
      if (opts.fail) throw new Error('down')
      return counts[`${key}:${subject}`] ?? 0
    },
    async record(subject, key) {
      records.push(`${key}:${subject}`)
    },
  }
  return { store, records }
}

test('isLockedOut is true at the failure limit and never records', async () => {
  const { store, records } = memoryStore({ 'auth_verify_fail:h': 5 })
  assert.equal(await isLockedOut({ store, subject: 'h', key: 'auth_verify_fail', limit: 5, windowMs: 900_000 }), true)
  assert.deepEqual(records, [])
})

test('isLockedOut is false under the limit', async () => {
  const { store } = memoryStore({ 'auth_verify_fail:h': 4 })
  assert.equal(await isLockedOut({ store, subject: 'h', key: 'auth_verify_fail', limit: 5, windowMs: 900_000 }), false)
})

test('isLockedOut fails closed on a store error or an empty subject', async () => {
  const { store } = memoryStore({}, { fail: true })
  assert.equal(await isLockedOut({ store, subject: 'h', key: 'auth_verify_fail', limit: 5, windowMs: 900_000 }), true)
  const ok = memoryStore({})
  assert.equal(await isLockedOut({ store: ok.store, subject: '', key: 'auth_verify_fail', limit: 5, windowMs: 900_000 }), true)
})
