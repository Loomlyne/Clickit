import assert from 'node:assert/strict'
import { test } from 'node:test'

import { signLinkToken } from '../../src/server/email/links.ts'
import {
  newsletterConfirmRequest,
  previewNewsletterConfirm,
  type NewsletterStore,
} from '../../src/server/email/public-links-core.ts'

const SECRET = 'test-secret-not-real'
const USER = '00000000-0000-4000-8000-000000000001'
const SUB = '00000000-0000-4000-8000-000000000002'
const NOW = 1_800_000_000
const DAY = 86400

// A tiny in-memory subscriber: confirm() flips once, then reports 'already'.
function store(opts: { confirmed?: boolean; fail?: boolean } = {}) {
  let confirmed = opts.confirmed ?? false
  const calls: string[] = []
  const s: NewsletterStore = {
    async confirm(subId) {
      if (opts.fail) throw new Error('db down')
      calls.push(subId)
      if (confirmed) return 'already'
      confirmed = true
      return 'confirmed'
    },
    async isConfirmed() {
      if (opts.fail) throw new Error('db down')
      return confirmed
    },
  }
  return { s, calls }
}

const confirmToken = (expSec = NOW + 7 * DAY) =>
  signLinkToken({ kind: 'newsletter_confirm', id: SUB, expSec, secret: SECRET })

test('valid token confirms the subscriber', async () => {
  const { s, calls } = store()
  const res = await newsletterConfirmRequest({ token: await confirmToken(), secret: SECRET, now: NOW, store: s })
  assert.equal(res, 'confirmed')
  assert.deepEqual(calls, [SUB])
})

test('a replayed token after success is already (idempotent)', async () => {
  const { s } = store()
  const token = await confirmToken()
  assert.equal(await newsletterConfirmRequest({ token, secret: SECRET, now: NOW, store: s }), 'confirmed')
  assert.equal(await newsletterConfirmRequest({ token, secret: SECRET, now: NOW + 1, store: s }), 'already')
})

test('expired token (8 days after sending) is expired with no store call', async () => {
  const { s, calls } = store()
  const token = await confirmToken(NOW + 7 * DAY)
  const res = await newsletterConfirmRequest({ token, secret: SECRET, now: NOW + 8 * DAY, store: s })
  assert.equal(res, 'expired')
  assert.equal(calls.length, 0)
})

test('an unsubscribe token can never confirm, forged and malformed tokens are invalid', async () => {
  const unsub = await signLinkToken({ kind: 'unsub_digest', id: USER, expSec: null, secret: SECRET })
  const forged = await signLinkToken({
    kind: 'newsletter_confirm',
    id: SUB,
    expSec: NOW + DAY,
    secret: 'other-secret',
  })
  for (const token of [unsub, forged, '', 'abc', 'a.b']) {
    const { s, calls } = store()
    assert.equal(await newsletterConfirmRequest({ token, secret: SECRET, now: NOW, store: s }), 'invalid')
    assert.equal(calls.length, 0)
  }
})

test('missing secret is unavailable with no store call', async () => {
  for (const secret of [null, undefined, '', '  ']) {
    const { s, calls } = store()
    assert.equal(
      await newsletterConfirmRequest({ token: await confirmToken(), secret, now: NOW, store: s }),
      'unavailable',
    )
    assert.equal(calls.length, 0)
  }
})

test('a store failure is error', async () => {
  const { s } = store({ fail: true })
  assert.equal(
    await newsletterConfirmRequest({ token: await confirmToken(), secret: SECRET, now: NOW, store: s }),
    'error',
  )
})

test('preview: ready, already, expired, invalid, unavailable; never writes', async () => {
  const token = await confirmToken()
  const fresh = store()
  assert.equal(await previewNewsletterConfirm({ token, secret: SECRET, now: NOW, store: fresh.s }), 'ready')
  const done = store({ confirmed: true })
  assert.equal(await previewNewsletterConfirm({ token, secret: SECRET, now: NOW, store: done.s }), 'already')
  assert.equal(
    await previewNewsletterConfirm({ token, secret: SECRET, now: NOW + 8 * DAY, store: fresh.s }),
    'expired',
  )
  assert.equal(await previewNewsletterConfirm({ token: 'x.y', secret: SECRET, now: NOW, store: fresh.s }), 'invalid')
  assert.equal(await previewNewsletterConfirm({ token, secret: null, now: NOW, store: fresh.s }), 'unavailable')
  assert.equal(fresh.calls.length + done.calls.length, 0)
})
