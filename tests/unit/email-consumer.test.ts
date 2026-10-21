import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ATTEMPTS,
  STALE_AFTER_HOURS,
  backoffSeconds,
  processBatch,
} from '../../src/server/email/consumer.ts'
import { emailWorld } from './helpers/email-world.ts'

const HOUR = 60 * 60 * 1000

test('backoffSeconds doubles from 60 s and caps at 3600 s', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(backoffSeconds), [60, 120, 240, 480, 960, 1920, 3600, 3600])
  assert.equal(backoffSeconds(0), 60)
  assert.equal(MAX_ATTEMPTS, 5)
  assert.equal(STALE_AFTER_HOURS, 23)
})

test('success: one send with the idempotency key, row sent with provider id, message acked, one finish call', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'welcome', reply_to: 'help@example.test' })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 1)
  assert.equal(w.sentMessages[0].idempotencyKey, row.idempotency_key)
  assert.equal(w.sentMessages[0].to, 'viewer@example.test')
  assert.equal(w.sentMessages[0].replyTo, 'help@example.test')
  assert.equal(w.outbox.get(row.id)?.status, 'sent')
  assert.equal(w.outbox.get(row.id)?.provider_id, 're_1')
  assert.equal(msg.acks, 1)
  assert.equal(msg.retries.length, 0)
  assert.equal(w.finishCalls.length, 1)
  assert.equal(w.claimCalls.length, 1)
})

test('a batch claims all ids in one call and finishes all outcomes in one call', async () => {
  const w = emailWorld()
  const a = w.addRow()
  const b = w.addRow()
  const c = w.addRow()
  const msgs = [a, b, c].map((r) => w.message(r.id))
  await processBatch({ messages: msgs }, w.deps())
  assert.equal(w.claimCalls.length, 1)
  assert.deepEqual(w.claimCalls[0].sort(), [a.id, b.id, c.id].sort())
  assert.equal(w.finishCalls.length, 1)
  assert.equal(w.finishCalls[0].length, 3)
  assert.equal(w.sends, 3)
  assert.ok(msgs.every((m) => m.acks === 1))
})

test('the same outboxId twice in one batch sends once and acks both messages', async () => {
  const w = emailWorld()
  const row = w.addRow()
  const m1 = w.message(row.id)
  const m2 = w.message(row.id)
  await processBatch({ messages: [m1, m2] }, w.deps())
  assert.equal(w.sends, 1)
  assert.deepEqual(w.claimCalls[0], [row.id])
  assert.equal(m1.acks, 1)
  assert.equal(m2.acks, 1)
})

test('a later redelivery after success sends nothing and acks', async () => {
  const w = emailWorld()
  const row = w.addRow()
  await processBatch({ messages: [w.message(row.id)] }, w.deps())
  const again = w.message(row.id)
  await processBatch({ messages: [again] }, w.deps())
  assert.equal(w.sends, 1)
  assert.equal(again.acks, 1)
  assert.equal(w.outbox.get(row.id)?.status, 'sent')
})

test('crash after send: finishOutbox throws, redelivery re-sends with the same key and Resend returns the first id', async () => {
  const w = emailWorld({ finishFails: 1 })
  const row = w.addRow()
  const first = w.message(row.id)
  await assert.rejects(processBatch({ messages: [first] }, w.deps()))
  assert.equal(first.acks, 0)
  assert.equal(first.retries.length, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'sending')

  // The lease expires, the queue redelivers.
  w.advance(6 * 60 * 1000)
  const second = w.message(row.id)
  await processBatch({ messages: [second] }, w.deps())
  assert.equal(w.sends, 2)
  assert.equal(w.sentMessages[0].idempotencyKey, w.sentMessages[1].idempotencyKey)
  assert.equal(w.distinctProviderSends, 1)
  assert.equal(w.outbox.get(row.id)?.status, 'sent')
  assert.equal(w.outbox.get(row.id)?.provider_id, 're_1')
  assert.equal(second.acks, 1)
})

test('429 with retry-after 30: row retrying, message.retry({ delaySeconds: 30 })', async () => {
  const w = emailWorld({ failNext: [{ status: 429, retryAfter: 30 }] })
  const row = w.addRow()
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.status, 'retrying')
  assert.deepEqual(msg.retries, [{ delaySeconds: 30 }])
  assert.equal(msg.acks, 0)
  const entry = w.finishCalls[0][0]
  assert.equal(entry.status, 'retrying')
  assert.equal(entry.error, 'rate_limited')
  assert.equal(entry.next_attempt_at, new Date(w.now() + 30_000).toISOString())
})

test('500 retries with backoff 60, 120, 240 across attempts', async () => {
  const w = emailWorld({ failNext: [500, 500, 500] })
  const row = w.addRow()
  const delays: Array<number | undefined> = []
  for (let i = 0; i < 3; i++) {
    const msg = w.message(row.id)
    await processBatch({ messages: [msg] }, w.deps())
    delays.push(msg.retries[0]?.delaySeconds)
    assert.equal(w.outbox.get(row.id)?.status, 'retrying')
    w.advance(6 * 60 * 1000)
  }
  assert.deepEqual(delays, [60, 120, 240])
  assert.equal(w.outbox.get(row.id)?.attempts, 3)
})

test('network error from the mailer retries and does not poison the rest of the batch', async () => {
  const w = emailWorld({ failNext: ['throw'] })
  const a = w.addRow()
  const b = w.addRow()
  const ma = w.message(a.id)
  const mb = w.message(b.id)
  await processBatch({ messages: [ma, mb] }, w.deps())
  assert.equal(w.outbox.get(a.id)?.status, 'retrying')
  assert.equal(w.outbox.get(b.id)?.status, 'sent')
  assert.deepEqual(ma.retries, [{ delaySeconds: 60 }])
  assert.equal(mb.acks, 1)
})

test('409 concurrent retries', async () => {
  const w = emailWorld({ failNext: ['409-concurrent'] })
  const row = w.addRow()
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.status, 'retrying')
  assert.deepEqual(msg.retries, [{ delaySeconds: 60 }])
})

test('409 invalid_idempotent_request counts as sent with a null provider id and logs "already sent"', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'welcome' })
  // Same key already used for a different payload at Resend.
  await w.mailer.send({
    to: 'viewer@example.test',
    subject: 'older body',
    html: '<p>older</p>',
    text: 'older',
    idempotencyKey: row.idempotency_key,
  })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.status, 'sent')
  assert.equal(w.outbox.get(row.id)?.provider_id, null)
  assert.equal(msg.acks, 1)
  assert.ok(w.logs.some((l) => l.includes('already sent')))
})

test('400 is permanent: failed once, acked, never retried', async () => {
  const w = emailWorld({ failNext: [400] })
  const row = w.addRow()
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.status, 'failed')
  assert.equal(w.outbox.get(row.id)?.last_error, 'http_400')
  assert.equal(msg.acks, 1)
  assert.equal(msg.retries.length, 0)
  assert.equal(w.sends, 1)
})

test('a transient error on the fifth attempt becomes failed and acked', async () => {
  const w = emailWorld({ failNext: [500] })
  const row = w.addRow({ attempts: MAX_ATTEMPTS - 1, first_attempt_at: new Date(w.now()).toISOString() })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.attempts, MAX_ATTEMPTS)
  assert.equal(w.outbox.get(row.id)?.status, 'failed')
  assert.equal(msg.acks, 1)
  assert.equal(msg.retries.length, 0)
})

test('first attempt older than 23 h: no send, failed stale_over_23h, acked', async () => {
  const w = emailWorld()
  const row = w.addRow({ status: 'retrying', attempts: 2, first_attempt_at: w.isoAgo(23 * HOUR + 1000) })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 0)
  assert.equal(w.renderCalls.length, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'failed')
  assert.equal(w.outbox.get(row.id)?.last_error, 'stale_over_23h')
  assert.equal(msg.acks, 1)
})

test('first attempt just under 23 h is still sent', async () => {
  const w = emailWorld()
  const row = w.addRow({ status: 'retrying', attempts: 2, first_attempt_at: w.isoAgo(23 * HOUR - 60_000) })
  await processBatch({ messages: [w.message(row.id)] }, w.deps())
  assert.equal(w.sends, 1)
  assert.equal(w.outbox.get(row.id)?.status, 'sent')
})

test('a row leased by another consumer is acked without a send', async () => {
  const w = emailWorld()
  const row = w.addRow({ status: 'sending', attempts: 1, lease_until: w.now() + 60_000 })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 0)
  assert.equal(msg.acks, 1)
  assert.equal(w.outbox.get(row.id)?.status, 'sending')
})

test('a missing row is acked without a send', async () => {
  const w = emailWorld()
  const msg = w.message('11111111-1111-4111-8111-111111111111')
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 0)
  assert.equal(msg.acks, 1)
})

test('no confirmed address: skipped no_confirmed_address, acked, no send', async () => {
  const w = emailWorld()
  const row = w.addRow({ to_address: null })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'skipped')
  assert.equal(w.outbox.get(row.id)?.last_error, 'no_confirmed_address')
  assert.equal(msg.acks, 1)
})

test('mailer not configured: retrying with backoff, still capped by MAX_ATTEMPTS', async () => {
  const w = emailWorld({ notConfigured: true })
  const row = w.addRow()
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.outbox.get(row.id)?.status, 'retrying')
  assert.equal(w.outbox.get(row.id)?.last_error, 'not_configured')
  assert.deepEqual(msg.retries, [{ delaySeconds: 60 }])

  const capped = w.addRow({ attempts: MAX_ATTEMPTS - 1, first_attempt_at: new Date(w.now()).toISOString() })
  const m2 = w.message(capped.id)
  await processBatch({ messages: [m2] }, w.deps())
  assert.equal(w.outbox.get(capped.id)?.status, 'failed')
  assert.equal(m2.acks, 1)
})

test('claimOutbox throwing rethrows and acks nothing', async () => {
  const w = emailWorld({ claimFails: 1 })
  const row = w.addRow()
  const msg = w.message(row.id)
  await assert.rejects(processBatch({ messages: [msg] }, w.deps()), /claim_outbox failed/)
  assert.equal(msg.acks, 0)
  assert.equal(msg.retries.length, 0)
  assert.equal(w.sends, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'pending')
})

test('a render failure on one row retries that row only', async () => {
  const w = emailWorld({ renderThrowsFor: ['support_ack'] })
  const bad = w.addRow({ kind: 'support_ack' })
  const good = w.addRow({ kind: 'welcome' })
  const mb = w.message(bad.id)
  const mg = w.message(good.id)
  await processBatch({ messages: [mb, mg] }, w.deps())
  assert.equal(w.outbox.get(bad.id)?.status, 'retrying')
  assert.equal(w.outbox.get(bad.id)?.last_error, 'render_failed')
  assert.equal(w.outbox.get(good.id)?.status, 'sent')
  assert.equal(mb.retries.length, 1)
  assert.equal(mg.acks, 1)
})

test('malformed bodies are acked without a claim and never reach the database', async () => {
  const w = emailWorld()
  const bodies: unknown[] = [null, 'text', 42, {}, { outboxId: 7 }, { outboxId: 'not-a-uuid' }, { outboxId: '1 or 1=1' }]
  const msgs = bodies.map((b) => w.message(b))
  await processBatch({ messages: msgs }, w.deps())
  assert.ok(msgs.every((m) => m.acks === 1))
  assert.equal(w.claimCalls.length, 0)
  assert.ok(w.logs.some((l) => l.includes('bad message')))
})

test('queue messages carry only the outbox id; the address comes from the claimed row', async () => {
  const w = emailWorld()
  const row = w.addRow({ to_address: 'only-from-claim@example.test' })
  const msg = w.message(row.id)
  assert.deepEqual(Object.keys(msg.body as object), ['outboxId'])
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sentMessages[0].to, 'only-from-claim@example.test')
})

test('log lines never contain an address, subject, body or token', async () => {
  const w = emailWorld({ failNext: [500, 400] })
  const rows = [
    w.addRow({ kind: 'welcome', to_address: 'secret-person@example.test', reply_to: 'reply-secret@example.test' }),
    w.addRow({ kind: 'digest', to_address: 'digest-person@example.test' }),
    w.addRow({ kind: 'welcome', to_address: null }),
    w.addRow({ kind: 'welcome', to_address: 'third@example.test' }),
  ]
  const old = w.addRow({ status: 'retrying', attempts: 1, first_attempt_at: w.isoAgo(30 * HOUR) })
  await processBatch({ messages: [...rows, old].map((r) => w.message(r.id)).concat([w.message({ outboxId: 'x' })]) }, w.deps())
  const all = w.logs.join('\n')
  assert.ok(w.logs.length > 0)
  assert.ok(w.logs.every((l) => l.startsWith('[email/consumer]')))
  for (const forbidden of ['@example.test', 'Subject of', 'HTML body', 'Text body', 'testtoken', 'unsubscribe?']) {
    assert.ok(!all.includes(forbidden), `log leaks ${forbidden}`)
  }
})

test('a digest row without a user is failed rather than sent without an unsubscribe link', async () => {
  const w = emailWorld()
  const row = w.addRow({ kind: 'digest', to_user: null })
  const msg = w.message(row.id)
  await processBatch({ messages: [msg] }, w.deps())
  assert.equal(w.sends, 0)
  assert.equal(w.outbox.get(row.id)?.status, 'failed')
  assert.equal(msg.acks, 1)
})
