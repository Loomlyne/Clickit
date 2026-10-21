import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enqueueEmailCore } from '../../src/server/email/enqueue-core.ts'
import type { EnqueueInput, EnqueuePorts } from '../../src/server/email/enqueue-core.ts'

const USER = '11111111-1111-4111-8111-111111111111'

type World = {
  rpcCalls: Record<string, unknown>[]
  sends: { body: { outboxId: string } }[][]
  logs: string[]
  ports: EnqueuePorts
}

function world(options: {
  rows?: { id: string | null; outcome: string }[]
  rpcThrows?: boolean
  queueThrows?: boolean
} = {}): World {
  const w: World = {
    rpcCalls: [],
    sends: [],
    logs: [],
    ports: {
      async rpc(args) {
        w.rpcCalls.push(args)
        if (options.rpcThrows) throw new Error('rpc down')
        return (options.rows ?? [{ id: 'a', outcome: 'queued' }]) as { id: string; outcome: string }[]
      },
      queue: {
        async sendBatch(msgs) {
          w.sends.push(msgs)
          if (options.queueThrows) throw new Error('queue down')
        },
      },
      log: {
        warn: (m: string) => void w.logs.push(m),
        error: (m: string) => void w.logs.push(m),
      },
    },
  }
  return w
}

const base: EnqueueInput = {
  kind: 'welcome',
  idempotencyKey: 'welcome:abc',
  to: { userId: USER },
  data: { name: 'Sam' },
}

test('queued: one sendBatch with the outbox id only, outcome queued', async () => {
  const w = world()
  const result = await enqueueEmailCore(base, w.ports)
  assert.deepEqual(result, { outcome: 'queued', ids: ['a'] })
  assert.deepEqual(w.sends, [[{ body: { outboxId: 'a' } }]])
  assert.equal(w.rpcCalls.length, 1)
})

test('rpc args map the target, payload and default locale', async () => {
  const w = world()
  await enqueueEmailCore(base, w.ports)
  const args = w.rpcCalls[0]
  assert.equal(args.p_kind, 'welcome')
  assert.equal(args.p_key, 'welcome:abc')
  assert.equal(args.p_to_user, USER)
  assert.equal(args.p_admin_all, false)
  assert.deepEqual(args.p_payload, { name: 'Sam' })
  assert.equal(args.p_locale, 'en')
  assert.equal('p_to_email' in args && args.p_to_email !== undefined, false)
})

test('email target carries the address and locale; adminAll sets p_admin_all', async () => {
  const w1 = world()
  await enqueueEmailCore(
    { ...base, kind: 'newsletter_confirm', to: { email: ' Fan@Example.test ', locale: 'ar' } },
    w1.ports,
  )
  assert.equal(w1.rpcCalls[0].p_to_email, 'Fan@Example.test')
  assert.equal(w1.rpcCalls[0].p_locale, 'ar')
  assert.equal(w1.rpcCalls[0].p_admin_all, false)
  const w2 = world()
  await enqueueEmailCore({ ...base, kind: 'support_admin', to: { adminAll: true } }, w2.ports)
  assert.equal(w2.rpcCalls[0].p_admin_all, true)
  assert.equal(w2.rpcCalls[0].p_to_user, undefined)
})

test('duplicate and capped never touch the queue', async () => {
  for (const outcome of ['duplicate', 'capped'] as const) {
    const w = world({ rows: [{ id: null, outcome }] })
    const result = await enqueueEmailCore(base, w.ports)
    assert.deepEqual(result, { outcome, ids: [] })
    assert.equal(w.sends.length, 0)
  }
})

test('adminAll with two queued ids sends one batch of two messages', async () => {
  const w = world({
    rows: [
      { id: 'a', outcome: 'queued' },
      { id: 'b', outcome: 'queued' },
    ],
  })
  const result = await enqueueEmailCore({ ...base, kind: 'support_admin', to: { adminAll: true } }, w.ports)
  assert.deepEqual(result, { outcome: 'queued', ids: ['a', 'b'] })
  assert.equal(w.sends.length, 1)
  assert.deepEqual(w.sends[0], [{ body: { outboxId: 'a' } }, { body: { outboxId: 'b' } }])
})

test('adminAll with zero admin rows: no queue call, queued with no ids, one no_recipients log', async () => {
  const w = world({ rows: [] })
  const result = await enqueueEmailCore(
    { ...base, kind: 'support_admin', idempotencyKey: 'support:m1', to: { adminAll: true } },
    w.ports,
  )
  assert.deepEqual(result, { outcome: 'queued', ids: [] })
  assert.equal(w.sends.length, 0)
  const lines = w.logs.filter((l) => l.startsWith('[email/outbox] no_recipients'))
  assert.equal(lines.length, 1)
  assert.match(lines[0], /support_admin/)
  assert.match(lines[0], /support:m1/)
})

test('adminAll with queued and duplicate rows sends only the queued ids', async () => {
  const w = world({
    rows: [
      { id: 'a', outcome: 'queued' },
      { id: null, outcome: 'duplicate' },
    ],
  })
  const result = await enqueueEmailCore({ ...base, kind: 'support_admin', to: { adminAll: true } }, w.ports)
  assert.deepEqual(result, { outcome: 'queued', ids: ['a'] })
  assert.deepEqual(w.sends[0], [{ body: { outboxId: 'a' } }])
})

test('queue send failure never throws: still queued, logged for the sweep', async () => {
  const w = world({ queueThrows: true })
  const result = await enqueueEmailCore(base, w.ports)
  assert.deepEqual(result, { outcome: 'queued', ids: ['a'] })
  assert.ok(w.logs.some((l) => l.includes('[email/outbox] queue send failed, sweep will retry')))
})

test('rpc failure throws so the caller decides', async () => {
  const w = world({ rpcThrows: true })
  await assert.rejects(() => enqueueEmailCore(base, w.ports), /rpc down/)
  assert.equal(w.sends.length, 0)
})

test('validation: key length, kind, exactly one target, payload object', async () => {
  const w = world()
  await assert.rejects(() => enqueueEmailCore({ ...base, idempotencyKey: '' }, w.ports), /idempotencyKey/)
  await assert.rejects(
    () => enqueueEmailCore({ ...base, idempotencyKey: 'k'.repeat(201) }, w.ports),
    /idempotencyKey/,
  )
  await enqueueEmailCore({ ...base, idempotencyKey: 'k'.repeat(200) }, w.ports)
  await assert.rejects(() => enqueueEmailCore({ ...base, kind: 'bogus' as never }, w.ports), /kind/)
  await assert.rejects(
    () => enqueueEmailCore({ ...base, to: { userId: USER, adminAll: true } as never }, w.ports),
    /target/,
  )
  await assert.rejects(() => enqueueEmailCore({ ...base, to: {} as never }, w.ports), /target/)
  await assert.rejects(() => enqueueEmailCore({ ...base, to: { userId: 'nope' } }, w.ports), /userId/)
  await assert.rejects(() => enqueueEmailCore({ ...base, data: [] as never }, w.ports), /data/)
  await assert.rejects(
    () => enqueueEmailCore({ ...base, to: { email: 'a@b.test', locale: 'fr' as never } }, w.ports),
    /locale/,
  )
  assert.equal(w.rpcCalls.length, 1) // only the valid 200-char call reached the rpc
})

test('header injection: CR/LF stripped from replyTo and email, then regex enforced', async () => {
  const w = world()
  await enqueueEmailCore({ ...base, replyTo: 'help@example.test\r\nBcc: x@y.test' }, w.ports).catch(() => {})
  // "help@example.test" + "Bcc: x@y.test" after stripping is not a simple address: rejected.
  assert.equal(w.rpcCalls.length, 0)
  await enqueueEmailCore({ ...base, replyTo: 'hel\np@example.test' }, w.ports)
  assert.equal(w.rpcCalls[0].p_reply_to, 'help@example.test')
  const w2 = world()
  await enqueueEmailCore({ ...base, to: { email: 'fa\r\nn@example.test' } }, w2.ports)
  assert.equal(w2.rpcCalls[0].p_to_email, 'fan@example.test')
  await assert.rejects(() => enqueueEmailCore({ ...base, to: { email: 'not an email' } }, w2.ports), /email/)
  await assert.rejects(() => enqueueEmailCore({ ...base, replyTo: 'no-at-sign' }, w2.ports), /replyTo/)
})

test('enqueue-core imports kinds from model.ts, never render-app.ts', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../../src/server/email/enqueue-core.ts', import.meta.url), 'utf8')
  assert.equal(/render-app/.test(src), false)
  assert.match(src, /emails\/app\/model\.ts/)
})
