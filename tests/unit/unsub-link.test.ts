import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  LINK_KINDS,
  NEWSLETTER_CONFIRM_TTL_DAYS,
  signLinkToken,
  verifyLinkToken,
} from '../../src/server/email/links.ts'

const SECRET = 'test-secret-not-real-0123456789abcdef'
const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f'
const NOW = 1_800_000_000

test('constants', () => {
  assert.deepEqual([...LINK_KINDS], ['unsub_digest', 'newsletter_confirm'])
  assert.equal(NEWSLETTER_CONFIRM_TTL_DAYS, 7)
})

test('unsub token round-trips and never expires', async () => {
  const token = await signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: SECRET })
  assert.deepEqual(await verifyLinkToken(token, 'unsub_digest', SECRET, NOW), { ok: true, id: ID })
  const tenYears = NOW + 10 * 365 * 86400
  assert.deepEqual(await verifyLinkToken(token, 'unsub_digest', SECRET, tenYears), {
    ok: true,
    id: ID,
  })
})

test('confirm token valid before expiry, expired one second after', async () => {
  const exp = NOW + NEWSLETTER_CONFIRM_TTL_DAYS * 86400
  const token = await signLinkToken({
    kind: 'newsletter_confirm',
    id: ID,
    expSec: exp,
    secret: SECRET,
  })
  assert.deepEqual(await verifyLinkToken(token, 'newsletter_confirm', SECRET, NOW), {
    ok: true,
    id: ID,
  })
  assert.deepEqual(await verifyLinkToken(token, 'newsletter_confirm', SECRET, exp), {
    ok: true,
    id: ID,
  })
  assert.deepEqual(await verifyLinkToken(token, 'newsletter_confirm', SECRET, exp + 1), {
    ok: false,
    reason: 'expired',
  })
})

test('a token of one kind never verifies as the other kind', async () => {
  const confirm = await signLinkToken({
    kind: 'newsletter_confirm',
    id: ID,
    expSec: NOW + 100,
    secret: SECRET,
  })
  assert.deepEqual(await verifyLinkToken(confirm, 'unsub_digest', SECRET, NOW), {
    ok: false,
    reason: 'invalid',
  })
  const unsub = await signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: SECRET })
  assert.deepEqual(await verifyLinkToken(unsub, 'newsletter_confirm', SECRET, NOW), {
    ok: false,
    reason: 'invalid',
  })
})

function flip(ch: string): string {
  return ch === 'A' ? 'B' : 'A'
}

test('one flipped character in payload or signature -> invalid', async () => {
  const token = await signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: SECRET })
  const dot = token.indexOf('.')
  assert.ok(dot > 0)
  for (const i of [0, 5, dot - 1, dot + 1, dot + 10, token.length - 1]) {
    const bad = token.slice(0, i) + flip(token[i]) + token.slice(i + 1)
    const result = await verifyLinkToken(bad, 'unsub_digest', SECRET, NOW)
    assert.equal(result.ok, false, `index ${i}`)
  }
})

test('wrong secret, junk and malformed tokens -> invalid', async () => {
  const token = await signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: SECRET })
  assert.deepEqual(await verifyLinkToken(token, 'unsub_digest', 'other-secret', NOW), {
    ok: false,
    reason: 'invalid',
  })
  for (const junk of ['', '.', 'abc', 'a.b.c', `${token}.extra`, '....', '%%%.%%%']) {
    assert.deepEqual(await verifyLinkToken(junk, 'unsub_digest', SECRET, NOW), {
      ok: false,
      reason: 'invalid',
    })
  }
})

test('non-UUID id is rejected on sign and on verify', async () => {
  await assert.rejects(
    signLinkToken({ kind: 'unsub_digest', id: 'not-a-uuid', expSec: null, secret: SECRET }),
  )
  // A correctly signed token whose id is not a UUID must still be invalid.
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const b64 = (buf: ArrayBuffer | Uint8Array) =>
    Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64url')
  const payload = b64(new TextEncoder().encode('unsub_digest.not-a-uuid.0'))
  const sig = b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  assert.deepEqual(await verifyLinkToken(`${payload}.${sig}`, 'unsub_digest', SECRET, NOW), {
    ok: false,
    reason: 'invalid',
  })
})

test('missing or empty secret: sign throws, verify -> unavailable', async () => {
  await assert.rejects(
    signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: '' }),
  )
  await assert.rejects(
    signLinkToken({
      kind: 'unsub_digest',
      id: ID,
      expSec: null,
      secret: undefined as unknown as string,
    }),
  )
  const token = await signLinkToken({ kind: 'unsub_digest', id: ID, expSec: null, secret: SECRET })
  for (const secret of ['', '   ', undefined]) {
    assert.deepEqual(
      await verifyLinkToken(token, 'unsub_digest', secret as unknown as string, NOW),
      { ok: false, reason: 'unavailable' },
    )
  }
})

test('token is URL-safe, no = or +', async () => {
  for (let i = 0; i < 20; i++) {
    const id = crypto.randomUUID()
    const token = await signLinkToken({
      kind: i % 2 ? 'unsub_digest' : 'newsletter_confirm',
      id,
      expSec: i % 2 ? null : NOW + i,
      secret: SECRET,
    })
    assert.match(token, /^[A-Za-z0-9_.-]+$/)
    assert.ok(!token.includes('=') && !token.includes('+'))
  }
})
