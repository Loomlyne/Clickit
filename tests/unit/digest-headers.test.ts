import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processBatch, unsubscribeHeaders } from '../../src/server/email/consumer.ts'
import { signLinkToken, verifyLinkToken } from '../../src/server/email/links.ts'
import { emailWorld } from './helpers/email-world.ts'

const SECRET = 'test-link-secret'
const USER = '0b9f2a0e-1111-4222-8333-444455556666'

async function signedUrl(userId: string): Promise<string> {
  const token = await signLinkToken({ kind: 'unsub_digest', id: userId, expSec: null, secret: SECRET })
  return `https://www.clickitstory.ae/api/email/unsubscribe?u=${userId}&k=digest&t=${token}`
}

test('unsubscribeHeaders builds the RFC 8058 pair', () => {
  const url = 'https://www.clickitstory.ae/api/email/unsubscribe?u=x&k=digest&t=y'
  assert.deepEqual(unsubscribeHeaders(url), {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  })
})

test('unsubscribeHeaders refuses a url that could break out of the header', () => {
  assert.throws(() => unsubscribeHeaders('https://x.test/a>, <mailto:evil@x.test'))
  assert.throws(() => unsubscribeHeaders('https://x.test/a\r\nBcc: evil@x.test'))
  assert.throws(() => unsubscribeHeaders(''))
})

test('a digest email carries a signed https List-Unsubscribe and the one-click Post header', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'digest', to_user: USER })
  await processBatch({ messages: [w.message(row.id)] }, w.deps({ unsubscribeUrl: signedUrl }))
  assert.equal(w.sends, 1)
  const headers = w.sentMessages[0].headers
  assert.ok(headers)
  const match = /^<(https:\/\/[^>]+)>$/.exec(headers['List-Unsubscribe'])
  assert.ok(match, 'List-Unsubscribe is one angle-bracketed https url')
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  const url = new URL(match[1])
  assert.equal(url.pathname, '/api/email/unsubscribe')
  assert.equal(url.searchParams.get('u'), USER)
  const verified = await verifyLinkToken(url.searchParams.get('t') ?? '', 'unsub_digest', SECRET, 0)
  assert.deepEqual(verified, { ok: true, id: USER })
})

test('the unsubscribe url is built for the row recipient', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'digest', to_user: USER })
  const asked: string[] = []
  await processBatch(
    { messages: [w.message(row.id)] },
    w.deps({
      unsubscribeUrl: async (id: string) => {
        asked.push(id)
        return signedUrl(id)
      },
    }),
  )
  assert.deepEqual(asked, [USER])
})

test('every non-digest kind carries neither unsubscribe header', async () => {
  const w = emailWorld()
  const kinds = ['welcome', 'support_ack', 'support_admin', 'newsletter_confirm']
  const rows = kinds.map((kind) => w.addRow({ kind }))
  await processBatch({ messages: rows.map((r) => w.message(r.id)) }, w.deps({ unsubscribeUrl: signedUrl }))
  assert.equal(w.sends, kinds.length)
  for (const sent of w.sentMessages) {
    const headers = sent.headers ?? {}
    assert.equal('List-Unsubscribe' in headers, false)
    assert.equal('List-Unsubscribe-Post' in headers, false)
  }
})

test('a failing unsubscribe url builder retries the digest and sends nothing', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'digest', to_user: USER })
  const msg = w.message(row.id)
  await processBatch(
    { messages: [msg] },
    w.deps({
      unsubscribeUrl: async () => {
        throw new Error('link secret is not configured')
      },
    }),
  )
  assert.equal(w.sends, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'retrying')
  assert.equal(w.outbox.get(row.id)?.last_error, 'unsubscribe_url_failed')
  assert.equal(msg.retries.length, 1)
  assert.ok(!w.logs.join('\n').includes('secret'))
})
