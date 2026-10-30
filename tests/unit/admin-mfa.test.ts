import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ADMIN_MFA_MAX_AGE_HOURS,
  decideAdminMfa,
  totpAgeSeconds,
} from '../../src/server/admin-access.ts'

const NOW = 1_800_000_000
const H = 3600

test('ADMIN_MFA_MAX_AGE_HOURS is 12', () => {
  assert.equal(ADMIN_MFA_MAX_AGE_HOURS, 12)
})

test('aal2 with a fresh totp entry -> ok; stale -> needs_code; exactly 12h -> ok', () => {
  const at = (age: number) => ({ aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - age }] })
  assert.equal(decideAdminMfa(at(11 * H + 59 * 60), NOW), 'ok')
  assert.equal(decideAdminMfa(at(12 * H + 60), NOW), 'needs_code')
  assert.equal(decideAdminMfa(at(12 * H), NOW), 'ok')
  assert.equal(decideAdminMfa(at(0), NOW), 'ok')
})

test("method 'mfa/totp' is accepted", () => {
  assert.equal(
    decideAdminMfa({ aal: 'aal2', amr: [{ method: 'mfa/totp', timestamp: NOW - 60 }] }, NOW),
    'ok',
  )
})

test('a newer password entry does not refresh an old totp entry', () => {
  const amr = [
    { method: 'password', timestamp: NOW - 10 },
    { method: 'totp', timestamp: NOW - 13 * H },
  ]
  assert.equal(totpAgeSeconds(amr, NOW), 13 * H)
  assert.equal(decideAdminMfa({ aal: 'aal2', amr }, NOW), 'needs_code')
})

test('newest of several totp entries is used', () => {
  const amr = [
    { method: 'totp', timestamp: NOW - 13 * H },
    { method: 'totp', timestamp: NOW - 60 },
  ]
  assert.equal(totpAgeSeconds(amr, NOW), 60)
  assert.equal(decideAdminMfa({ aal: 'aal2', amr }, NOW), 'ok')
})

test('aal1, missing or non-string aal -> needs_code', () => {
  const amr = [{ method: 'totp', timestamp: NOW - 60 }]
  assert.equal(decideAdminMfa({ aal: 'aal1', amr }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ amr }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 2, amr }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: null, amr }, NOW), 'needs_code')
})

test('odd amr shapes -> needs_code', () => {
  assert.equal(decideAdminMfa({ aal: 'aal2', amr: ['totp'] }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 'aal2' }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 'aal2', amr: null }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 'aal2', amr: 'totp' }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 'aal2', amr: [] }, NOW), 'needs_code')
  assert.equal(decideAdminMfa({ aal: 'aal2', amr: [null, 7, 'x'] }, NOW), 'needs_code')
  assert.equal(
    decideAdminMfa({ aal: 'aal2', amr: [{ method: 'otp', timestamp: NOW - 1 }] }, NOW),
    'needs_code',
  )
  assert.equal(
    decideAdminMfa({ aal: 'aal2', amr: [{ method: 'totp', timestamp: String(NOW - 1) }] }, NOW),
    'needs_code',
  )
})

test('totp timestamp in the future -> needs_code', () => {
  assert.equal(
    decideAdminMfa({ aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW + 120 }] }, NOW),
    'needs_code',
  )
})

test('non-finite timestamps are ignored', () => {
  const amr = [
    { method: 'totp', timestamp: Number.NaN },
    { method: 'totp', timestamp: Number.POSITIVE_INFINITY },
  ]
  assert.equal(totpAgeSeconds(amr, NOW), null)
  assert.equal(decideAdminMfa({ aal: 'aal2', amr }, NOW), 'needs_code')
  // a valid entry next to junk still counts
  assert.equal(
    decideAdminMfa(
      { aal: 'aal2', amr: [...amr, { method: 'totp', timestamp: NOW - 5 }] },
      NOW,
    ),
    'ok',
  )
})

test('custom max age is honoured', () => {
  const claims = { aal: 'aal2', amr: [{ method: 'totp', timestamp: NOW - 2 * H }] }
  assert.equal(decideAdminMfa(claims, NOW, 1), 'needs_code')
  assert.equal(decideAdminMfa(claims, NOW, 3), 'ok')
})
