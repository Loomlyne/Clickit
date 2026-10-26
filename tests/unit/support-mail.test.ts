import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isConfirmedSubscriber,
  newsletterKey,
  newsletterOutcome,
  stripHeaderBreaks,
  supportKeys,
  supportOutcome,
} from '../../src/server/email/contact-core.ts'

// 05-28 (MAIL-05, MAIL-06; D-31, D-32, D-39): pure decisions behind the support and
// newsletter actions. The enqueue_email RPC appends ':<admin id>' to the support_admin key.

test('supportKeys builds the ack and admin keys from the message id', () => {
  assert.deepEqual(supportKeys('m1'), {
    ack: 'support_ack:m1',
    admin: 'support_admin:m1',
  })
})

test('newsletterKey is subscriber id plus counter', () => {
  assert.equal(newsletterKey('s1', 3), 'newsletter_confirm:s1:3')
})

test('newsletterKey refuses a counter that is not a non-negative integer', () => {
  assert.throws(() => newsletterKey('s1', -1))
  assert.throws(() => newsletterKey('s1', 1.5))
  assert.throws(() => newsletterKey('s1', Number.NaN))
})

test('stripHeaderBreaks folds CR/LF into one space', () => {
  assert.equal(stripHeaderBreaks('Hi\r\nBcc: x'), 'Hi Bcc: x')
  assert.equal(stripHeaderBreaks('a\nb\rc'), 'a b c')
  assert.equal(stripHeaderBreaks('a\r\n\r\nb'), 'a b')
})

test('stripHeaderBreaks trims', () => {
  assert.equal(stripHeaderBreaks('  hello \r\n'), 'hello')
})

test('stripHeaderBreaks caps at 200 characters', () => {
  const out = stripHeaderBreaks('x'.repeat(500))
  assert.equal(out.length, 200)
  assert.equal(stripHeaderBreaks('y'.repeat(200)).length, 200)
})

test('stripHeaderBreaks has no CR or LF left, also after the cap', () => {
  const out = stripHeaderBreaks(`${'z'.repeat(199)}\r\nBcc: evil@example.com`)
  assert.equal(/[\r\n]/.test(out), false)
  assert.ok(out.length <= 200)
})

test('supportOutcome: both queued -> sent', () => {
  assert.equal(supportOutcome({ ack: 'queued', admin: 'queued' }), 'sent')
})

test('supportOutcome: zero admins rows still -> sent', () => {
  assert.equal(
    supportOutcome({ ack: 'queued', admin: 'queued', adminIds: [] }),
    'sent'
  )
})

test('supportOutcome: ack capped -> sent (message saved, auto-reply skipped)', () => {
  assert.equal(supportOutcome({ ack: 'capped', admin: 'queued' }), 'sent')
})

test('supportOutcome: duplicate counts as sent', () => {
  assert.equal(supportOutcome({ ack: 'duplicate', admin: 'duplicate' }), 'sent')
})

test('supportOutcome: an enqueue that threw -> saved_email_failed', () => {
  assert.equal(supportOutcome({ ack: 'error', admin: 'queued' }), 'saved_email_failed')
  assert.equal(supportOutcome({ ack: 'queued', admin: 'error' }), 'saved_email_failed')
  assert.equal(supportOutcome({ ack: 'capped', admin: 'error' }), 'saved_email_failed')
})

test('isConfirmedSubscriber needs both confirmed_at and status active', () => {
  assert.equal(isConfirmedSubscriber(null), false)
  assert.equal(isConfirmedSubscriber({ status: 'active', confirmed_at: null }), false)
  assert.equal(
    isConfirmedSubscriber({ status: 'pending', confirmed_at: '2026-10-26T00:00:00Z' }),
    false
  )
  assert.equal(
    isConfirmedSubscriber({ status: 'active', confirmed_at: '2026-10-26T00:00:00Z' }),
    true
  )
})

test('newsletterOutcome: confirmed active row -> already_subscribed, no enqueue', () => {
  assert.equal(
    newsletterOutcome({ existing: 'active', confirmed: true }),
    'already_subscribed'
  )
  // Even if an enqueue result is passed by mistake, a confirmed row stays already_subscribed.
  assert.equal(
    newsletterOutcome({ existing: 'active', confirmed: true, enqueue: 'queued' }),
    'already_subscribed'
  )
})

test('newsletterOutcome: new or pending row + queued -> pending_confirmation', () => {
  assert.equal(
    newsletterOutcome({ existing: null, confirmed: false, enqueue: 'queued' }),
    'pending_confirmation'
  )
  assert.equal(
    newsletterOutcome({ existing: 'pending', confirmed: false, enqueue: 'queued' }),
    'pending_confirmation'
  )
  assert.equal(
    newsletterOutcome({ existing: 'active', confirmed: false, enqueue: 'duplicate' }),
    'pending_confirmation'
  )
})

test('newsletterOutcome: capped -> pending_recent', () => {
  assert.equal(
    newsletterOutcome({ existing: 'pending', confirmed: false, enqueue: 'capped' }),
    'pending_recent'
  )
})

test('newsletterOutcome: enqueue threw -> saved_email_failed', () => {
  assert.equal(
    newsletterOutcome({ existing: null, confirmed: false, enqueue: 'error' }),
    'saved_email_failed'
  )
})

test('newsletterOutcome: an unconfirmed row with no enqueue result never says subscribed', () => {
  assert.equal(
    newsletterOutcome({ existing: 'pending', confirmed: false }),
    'saved_email_failed'
  )
})
