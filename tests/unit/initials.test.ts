import { test } from 'node:test'
import assert from 'node:assert/strict'
import { viewerInitials } from '../../src/lib/initials.ts'

test('uses the profile display name first', () => {
  assert.equal(viewerInitials('Mariam Saif', 'ms@example.com'), 'MS')
  assert.equal(viewerInitials('khalid', 'x@example.com'), 'KH')
})

test('falls back to the email local part', () => {
  assert.equal(viewerInitials(null, 'omar.rashed@example.com'), 'OR')
  assert.equal(viewerInitials('  ', 'noor@example.com'), 'NO')
})

test('returns null when nothing usable exists', () => {
  assert.equal(viewerInitials(null, null), null)
  assert.equal(viewerInitials('', ''), null)
  assert.equal(viewerInitials(undefined, '@example.com'), null)
})

test('handles Arabic names', () => {
  assert.equal(viewerInitials('نور حمدان', null), 'نح')
})
