import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  passwordLabelState,
  passwordUpdateOutcome,
  shouldMirrorLocale,
} from '../../src/server/auth/profile-core.ts'

// ---------------------------------------------------------------- passwordUpdateOutcome

test('no error means the password was saved', () => {
  assert.equal(passwordUpdateOutcome({ error: null }), 'saved')
  assert.equal(passwordUpdateOutcome({ error: undefined }), 'saved')
})

test('reauthentication_needed asks for the emailed code (nonce)', () => {
  assert.equal(passwordUpdateOutcome({ error: { code: 'reauthentication_needed' } }), 'needs_nonce')
})

test('Supabase refusals map to the profile error keys', () => {
  assert.equal(passwordUpdateOutcome({ error: { code: 'weak_password' } }), 'passwordMin')
  assert.equal(passwordUpdateOutcome({ error: { code: 'same_password' } }), 'samePassword')
  assert.equal(passwordUpdateOutcome({ error: { code: 'reauthentication_not_valid' } }), 'codeWrong')
})

test('rate limits map to tooManyTries', () => {
  assert.equal(passwordUpdateOutcome({ error: { code: 'over_request_rate_limit' } }), 'tooManyTries')
  assert.equal(passwordUpdateOutcome({ error: { code: 'over_email_send_rate_limit' } }), 'tooManyTries')
  assert.equal(passwordUpdateOutcome({ error: { status: 429 } }), 'tooManyTries')
})

test('anything else is authGeneric', () => {
  assert.equal(passwordUpdateOutcome({ error: { code: 'unexpected_failure' } }), 'authGeneric')
  assert.equal(passwordUpdateOutcome({ error: { message: 'boom' } }), 'authGeneric')
  assert.equal(passwordUpdateOutcome({ error: 'boom' }), 'authGeneric')
  assert.equal(passwordUpdateOutcome({ error: {} }), 'authGeneric')
})

// ---------------------------------------------------------------- passwordLabelState

test('no password_set_at offers Set; a date offers Change', () => {
  assert.equal(passwordLabelState(null), 'set')
  assert.equal(passwordLabelState(undefined), 'set')
  assert.equal(passwordLabelState(''), 'set')
  assert.equal(passwordLabelState('2026-10-26T10:00:00.000Z'), 'change')
})

// ---------------------------------------------------------------- shouldMirrorLocale

test('everything already in the current locale writes nothing', () => {
  assert.deepEqual(shouldMirrorLocale({ profileLocale: 'ar', metaLocale: 'ar', locale: 'ar' }), {
    profile: false,
    meta: false,
  })
})

test('only what differs is flagged', () => {
  assert.deepEqual(shouldMirrorLocale({ profileLocale: 'en', metaLocale: 'ar', locale: 'ar' }), {
    profile: true,
    meta: false,
  })
  assert.deepEqual(shouldMirrorLocale({ profileLocale: 'ar', metaLocale: 'en', locale: 'ar' }), {
    profile: false,
    meta: true,
  })
  assert.deepEqual(shouldMirrorLocale({ profileLocale: 'en', metaLocale: 'en', locale: 'ar' }), {
    profile: true,
    meta: true,
  })
})

test('missing stored values count as different', () => {
  assert.deepEqual(shouldMirrorLocale({ profileLocale: null, metaLocale: undefined, locale: 'en' }), {
    profile: true,
    meta: true,
  })
})

test('an invalid locale is a no-op', () => {
  for (const locale of ['fr', '', null, undefined, 'AR', 42]) {
    assert.deepEqual(shouldMirrorLocale({ profileLocale: 'en', metaLocale: 'en', locale }), {
      profile: false,
      meta: false,
    })
  }
})
