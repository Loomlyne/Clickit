import assert from 'node:assert/strict'
import { test } from 'node:test'

import { signLinkToken } from '../../src/server/email/links.ts'
import {
  previewUnsubscribe,
  unsubscribeRequest,
  type UnsubscribeStore,
} from '../../src/server/email/public-links-core.ts'

const SECRET = 'test-secret-not-real'
const USER = '00000000-0000-4000-8000-000000000001'
const SUB = '00000000-0000-4000-8000-000000000002'
const NOW = 1_800_000_000

function store(opts: { notify?: boolean | null; fail?: boolean } = {}) {
  const calls: Array<[string, boolean]> = []
  const s: UnsubscribeStore = {
    async setNotify(userId, value) {
      if (opts.fail) throw new Error('db down')
      calls.push([userId, value])
    },
    async getNotify() {
      if (opts.fail) throw new Error('db down')
      return opts.notify ?? true
    },
  }
  return { s, calls }
}

const unsubToken = () =>
  signLinkToken({ kind: 'unsub_digest', id: USER, expSec: null, secret: SECRET })

test('valid unsub token turns the digest off once for that user', async () => {
  const { s, calls } = store()
  const res = await unsubscribeRequest({ token: await unsubToken(), secret: SECRET, now: NOW, store: s })
  assert.deepEqual(res, { ok: true, userId: USER })
  assert.deepEqual(calls, [[USER, false]])
})

test('an old unsub token (ten years) still works: no expiry', async () => {
  const { s, calls } = store()
  const res = await unsubscribeRequest({
    token: await unsubToken(),
    secret: SECRET,
    now: NOW + 10 * 365 * 86400,
    store: s,
  })
  assert.equal(res.ok, true)
  assert.equal(calls.length, 1)
})

test('forged, other-kind, empty and malformed tokens are invalid with no store call', async () => {
  const confirm = await signLinkToken({
    kind: 'newsletter_confirm',
    id: SUB,
    expSec: NOW + 100,
    secret: SECRET,
  })
  const tokens = [
    confirm,
    await signLinkToken({ kind: 'unsub_digest', id: USER, expSec: null, secret: 'other-secret' }),
    '',
    'abc',
    'a.b.c',
    (await unsubToken()).slice(0, -2) + 'xx',
  ]
  for (const token of tokens) {
    const { s, calls } = store()
    const res = await unsubscribeRequest({ token, secret: SECRET, now: NOW, store: s })
    assert.deepEqual(res, { ok: false, reason: 'invalid' }, token)
    assert.equal(calls.length, 0)
  }
})

test('missing or blank secret is unavailable with no store call', async () => {
  for (const secret of [null, undefined, '', '   ']) {
    const { s, calls } = store()
    const res = await unsubscribeRequest({ token: await unsubToken(), secret, now: NOW, store: s })
    assert.deepEqual(res, { ok: false, reason: 'unavailable' })
    assert.equal(calls.length, 0)
  }
})

test('a store failure is reported as error and never leaks the cause', async () => {
  const { s } = store({ fail: true })
  const res = await unsubscribeRequest({ token: await unsubToken(), secret: SECRET, now: NOW, store: s })
  assert.deepEqual(res, { ok: false, reason: 'error' })
})

test('repeating the request is idempotent', async () => {
  const { s, calls } = store()
  const token = await unsubToken()
  const a = await unsubscribeRequest({ token, secret: SECRET, now: NOW, store: s })
  const b = await unsubscribeRequest({ token, secret: SECRET, now: NOW, store: s })
  assert.deepEqual(a, b)
  assert.deepEqual(calls, [[USER, false], [USER, false]])
})

test('preview: ready, done when already off, invalid, unavailable; never writes', async () => {
  const token = await unsubToken()
  const on = store({ notify: true })
  assert.equal(await previewUnsubscribe({ token, secret: SECRET, now: NOW, store: on.s }), 'ready')
  const off = store({ notify: false })
  assert.equal(await previewUnsubscribe({ token, secret: SECRET, now: NOW, store: off.s }), 'done')
  assert.equal(await previewUnsubscribe({ token: 'x.y', secret: SECRET, now: NOW, store: on.s }), 'invalid')
  assert.equal(await previewUnsubscribe({ token, secret: null, now: NOW, store: on.s }), 'unavailable')
  const broken = store({ fail: true })
  assert.equal(await previewUnsubscribe({ token, secret: SECRET, now: NOW, store: broken.s }), 'ready')
  assert.equal(on.calls.length + off.calls.length + broken.calls.length, 0)
})
