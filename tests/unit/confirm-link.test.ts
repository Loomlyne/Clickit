import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CONFIRM_TYPES,
  confirmOutcome,
  expiredRetryHref,
  parseConfirmParams,
  recoveryDestination,
} from '../../src/server/auth/confirm-core.ts'

// 05-23 (AUTH-04; D-12, D-13; UI-SPEC 6.3): the email-link confirm page. GET
// only parses; the server action verifies and maps the answer with these.

const HASH = 'pkce_0123456789abcdefABCDEF-_xyz'

// ---------------------------------------------------------------- parseConfirmParams

test('CONFIRM_TYPES is the whitelist of email link types', () => {
  assert.deepEqual([...CONFIRM_TYPES], ['signup', 'recovery', 'email_change', 'email', 'magiclink'])
})

test('valid token_hash, type and next parse ok', () => {
  assert.deepEqual(parseConfirmParams({ token_hash: HASH, type: 'recovery', next: '/x' }), {
    ok: true,
    tokenHash: HASH,
    type: 'recovery',
    next: '/x',
  })
})

test('every whitelisted type parses', () => {
  for (const type of CONFIRM_TYPES) {
    const parsed = parseConfirmParams({ token_hash: HASH, type, next: '/browse' })
    assert.equal(parsed.ok, true, type)
  }
})

test('type outside the whitelist is invalid (invite, sms, phone_change, empty)', () => {
  for (const type of ['invite', 'sms', 'phone_change', '', 'RECOVERY']) {
    const parsed = parseConfirmParams({ token_hash: HASH, type, next: '/x' })
    assert.equal(parsed.ok, false, type)
    assert.equal(parsed.type, null, type)
  }
})

test('token_hash shape: slash, 9 chars, 201 chars, spaces and dots are invalid', () => {
  for (const tokenHash of ['abc/defghijk', 'a'.repeat(9), 'a'.repeat(201), 'abcdef ghijk', 'abcdef.ghijk']) {
    const parsed = parseConfirmParams({ token_hash: tokenHash, type: 'signup', next: '/x' })
    assert.equal(parsed.ok, false, tokenHash)
  }
})

test('token_hash length bounds 10 and 200 are valid', () => {
  assert.equal(parseConfirmParams({ token_hash: 'a'.repeat(10), type: 'email' }).ok, true)
  assert.equal(parseConfirmParams({ token_hash: 'a'.repeat(200), type: 'email' }).ok, true)
})

test('missing params are invalid', () => {
  assert.equal(parseConfirmParams({}).ok, false)
  assert.equal(parseConfirmParams({ token_hash: HASH }).ok, false)
  assert.equal(parseConfirmParams({ type: 'signup' }).ok, false)
})

test('repeated params (arrays) are invalid', () => {
  assert.equal(parseConfirmParams({ token_hash: [HASH, HASH], type: 'signup' }).ok, false)
  assert.equal(parseConfirmParams({ token_hash: HASH, type: ['signup'] }).ok, false)
})

test('invalid link with a known type keeps the type (for the right retry button)', () => {
  const parsed = parseConfirmParams({ token_hash: 'short', type: 'recovery', next: '/x' })
  assert.deepEqual(parsed, { ok: false, type: 'recovery', next: '/x' })
})

test('unsafe or missing next becomes /browse', () => {
  for (const next of [undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/auth', '/en/auth/confirm', 'x', '/a\u0000b', ['/x'], '/' + 'a'.repeat(600)]) {
    const parsed = parseConfirmParams({ token_hash: HASH, type: 'signup', next })
    assert.equal(parsed.next, '/browse', String(next))
  }
})

test('locale prefix is stripped from next', () => {
  assert.equal(parseConfirmParams({ token_hash: HASH, type: 'signup', next: '/ar/series/x' }).next, '/series/x')
})

// ---------------------------------------------------------------- confirmOutcome

const SESSION = { access_token: 'a' }

test('email_change, no error, no session -> pending_other (first of two links)', () => {
  assert.equal(confirmOutcome({ type: 'email_change', error: null, session: null }), 'pending_other')
})

test('email_change with a session -> email_changed', () => {
  assert.equal(confirmOutcome({ type: 'email_change', error: null, session: SESSION }), 'email_changed')
})

test('recovery with a session -> recovery', () => {
  assert.equal(confirmOutcome({ type: 'recovery', error: null, session: SESSION }), 'recovery')
})

test('signup, email and magiclink with a session -> signed_in', () => {
  for (const type of ['signup', 'email', 'magiclink'] as const) {
    assert.equal(confirmOutcome({ type, error: null, session: SESSION }), 'signed_in', type)
  }
})

test('expired, invalid or used link -> expired, for every type', () => {
  const errors = [
    { code: 'otp_expired', status: 403, message: 'Email link is invalid or has expired' },
    { code: 'validation_failed', status: 400 },
    { status: 403, message: 'Token has expired or is invalid' },
    { code: 'flow_state_not_found', status: 404 },
  ]
  for (const type of CONFIRM_TYPES) {
    for (const error of errors) {
      assert.equal(confirmOutcome({ type, error, session: null }), 'expired', `${type} ${JSON.stringify(error)}`)
      assert.equal(confirmOutcome({ type, error, session: SESSION }), 'expired', `${type} with session`)
    }
  }
})

test('non-email_change with no error and no session -> expired', () => {
  for (const type of ['signup', 'email', 'magiclink', 'recovery'] as const) {
    assert.equal(confirmOutcome({ type, error: null, session: null }), 'expired', type)
    assert.equal(confirmOutcome({ type, error: undefined, session: undefined }), 'expired', type)
  }
})

test('network, server or rate-limit trouble -> retry (the token is not spent)', () => {
  const errors = [
    { name: 'AuthRetryableFetchError', status: 0 },
    { status: 500 },
    { status: 503, code: 'unexpected_failure' },
    { status: 429, code: 'over_request_rate_limit' },
    { code: 'over_request_rate_limit' },
  ]
  for (const error of errors) {
    assert.equal(confirmOutcome({ type: 'signup', error, session: null }), 'retry', JSON.stringify(error))
  }
})

// ---------------------------------------------------------------- expiredRetryHref

test('expired recovery link asks for a new link on the forgot screen', () => {
  assert.equal(expiredRetryHref('recovery', '/browse'), '/auth?mode=forgot')
  assert.equal(expiredRetryHref('recovery', '/series/x'), '/auth?mode=forgot&next=%2Fseries%2Fx')
})

test('other expired links go back to sign-in, carrying a real next', () => {
  assert.equal(expiredRetryHref('signup', '/browse'), '/auth')
  assert.equal(expiredRetryHref(null, '/browse'), '/auth')
  assert.equal(expiredRetryHref('email', '/watch/abc?t=1'), '/auth?next=%2Fwatch%2Fabc%3Ft%3D1')
  assert.equal(expiredRetryHref('email_change', '/profile'), '/auth?next=%2Fprofile')
})

// ---------------------------------------------------------------- recoveryDestination

test('recovery sends the visitor to the reset page with a safe next', () => {
  assert.equal(recoveryDestination('/series/x'), '/auth/reset-password?next=%2Fseries%2Fx')
  assert.equal(recoveryDestination('//evil.test'), '/auth/reset-password?next=%2Fbrowse')
})
