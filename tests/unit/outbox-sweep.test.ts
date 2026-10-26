import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  runEmailCron,
  isDigestEnabled,
  QUEUE_BATCH_MAX,
} from '../../src/server/email/cron-core.ts'
import type { EmailCronPorts } from '../../src/server/email/cron-core.ts'

type Sent = { body: { outboxId: string } }[]

function ids(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`)
}

function makePorts(over: Partial<EmailCronPorts> = {}) {
  const calls = { sweep: 0, buildDigest: 0, batches: [] as Sent, logs: [] as string[], errors: [] as string[] }
  const sentBatches: Sent[] = []
  const ports: EmailCronPorts = {
    digestEnabled: false,
    async sweep() {
      calls.sweep += 1
      return []
    },
    async buildDigest() {
      calls.buildDigest += 1
      return []
    },
    async sendBatch(msgs) {
      sentBatches.push(msgs)
    },
    log: {
      log: (m: string) => calls.logs.push(m),
      error: (m: string) => calls.errors.push(m),
    },
    ...over,
  }
  return { ports, calls, sentBatches }
}

test('digest disabled: sweep once, buildDigest never, swept ids sent, digest "disabled"', async () => {
  let built = 0
  const { ports, calls, sentBatches } = makePorts({
    digestEnabled: false,
    async sweep() {
      calls.sweep += 1
      return ['a', 'b', 'c']
    },
    async buildDigest() {
      built += 1
      return ['x']
    },
  })
  const res = await runEmailCron(ports)
  assert.equal(calls.sweep, 1)
  assert.equal(built, 0)
  assert.deepEqual(res, { swept: 3, digest: 'disabled', queueErrors: 0 })
  assert.equal(sentBatches.length, 1)
  assert.deepEqual(sentBatches[0], [
    { body: { outboxId: 'a' } },
    { body: { outboxId: 'b' } },
    { body: { outboxId: 'c' } },
  ])
})

test('nothing swept and digest disabled: no sendBatch call', async () => {
  const { ports, sentBatches } = makePorts()
  const res = await runEmailCron(ports)
  assert.deepEqual(res, { swept: 0, digest: 'disabled', queueErrors: 0 })
  assert.equal(sentBatches.length, 0)
})

test('digest enabled: buildDigest once; swept + digest ids go out in chunks of at most 100', async () => {
  let built = 0
  const { ports, sentBatches } = makePorts({
    digestEnabled: true,
    async sweep() {
      return ids('s', 150)
    },
    async buildDigest() {
      built += 1
      return ids('d', 100)
    },
  })
  const res = await runEmailCron(ports)
  assert.equal(built, 1)
  assert.deepEqual(res, { swept: 150, digest: 100, queueErrors: 0 })
  assert.equal(QUEUE_BATCH_MAX, 100)
  assert.equal(sentBatches.length, 3)
  assert.deepEqual(
    sentBatches.map((b) => b.length),
    [100, 100, 50],
  )
  const all = sentBatches.flat().map((m) => m.body.outboxId)
  assert.deepEqual(all, [...ids('s', 150), ...ids('d', 100)])
})

test('an id returned by both sweep and digest is sent once', async () => {
  const { ports, sentBatches } = makePorts({
    digestEnabled: true,
    async sweep() {
      return ['a', 'b']
    },
    async buildDigest() {
      return ['b', 'c']
    },
  })
  const res = await runEmailCron(ports)
  assert.deepEqual(res, { swept: 2, digest: 2, queueErrors: 0 })
  assert.deepEqual(
    sentBatches.flat().map((m) => m.body.outboxId),
    ['a', 'b', 'c'],
  )
})

test('digest enabled with no new episodes: digest 0, no email ids', async () => {
  const { ports, sentBatches } = makePorts({ digestEnabled: true })
  const res = await runEmailCron(ports)
  assert.deepEqual(res, { swept: 0, digest: 0, queueErrors: 0 })
  assert.equal(sentBatches.length, 0)
})

test('sweep throws: runEmailCron rethrows and sends nothing', async () => {
  let built = 0
  const { ports, sentBatches } = makePorts({
    digestEnabled: true,
    async sweep() {
      throw new Error('sweep_outbox 500')
    },
    async buildDigest() {
      built += 1
      return ['x']
    },
  })
  await assert.rejects(runEmailCron(ports), /sweep_outbox 500/)
  assert.equal(built, 0)
  assert.equal(sentBatches.length, 0)
})

test('buildDigest throws: swept ids are still sent, then the error is rethrown', async () => {
  const { ports, sentBatches } = makePorts({
    digestEnabled: true,
    async sweep() {
      return ['a']
    },
    async buildDigest() {
      throw new Error('build_digest 500')
    },
  })
  await assert.rejects(runEmailCron(ports), /build_digest 500/)
  assert.deepEqual(
    sentBatches.flat().map((m) => m.body.outboxId),
    ['a'],
  )
})

test('queue send throws: counts still returned with queueErrors 1 (rows stay pending)', async () => {
  const { ports, calls } = makePorts({
    async sweep() {
      return ['a', 'b']
    },
    async sendBatch() {
      throw new Error('queue down to someone@example.com')
    },
  })
  const res = await runEmailCron(ports)
  assert.deepEqual(res, { swept: 2, digest: 'disabled', queueErrors: 1 })
  assert.equal(calls.errors.length, 1)
  assert.match(calls.errors[0], /^\[cron\/email-digest\] queue send failed/)
  assert.doesNotMatch(calls.errors[0], /@/)
})

test('one failing chunk does not stop the next chunks', async () => {
  let call = 0
  const delivered: string[] = []
  const { ports } = makePorts({
    async sweep() {
      return ids('s', 250)
    },
    async sendBatch(msgs) {
      call += 1
      if (call === 2) throw new Error('boom')
      delivered.push(...msgs.map((m) => m.body.outboxId))
    },
  })
  const res = await runEmailCron(ports)
  assert.equal(call, 3)
  assert.deepEqual(res, { swept: 250, digest: 'disabled', queueErrors: 1 })
  assert.equal(delivered.length, 150)
})

test('logs carry counts only, never ids', async () => {
  const { ports, calls } = makePorts({
    digestEnabled: true,
    async sweep() {
      return ['11111111-1111-1111-1111-111111111111']
    },
    async buildDigest() {
      return ['22222222-2222-2222-2222-222222222222']
    },
  })
  await runEmailCron(ports)
  const all = [...calls.logs, ...calls.errors].join('\n')
  assert.match(all, /\[cron\/email-digest\] swept=1 digest=1 queueErrors=0/)
  assert.doesNotMatch(all, /1111|2222/)
})

test('isDigestEnabled is true only for exactly "on"', () => {
  assert.equal(isDigestEnabled('on'), true)
  for (const v of ['off', 'ON', 'On', ' on', 'on ', 'true', '1', 'yes', '', undefined, null]) {
    assert.equal(isDigestEnabled(v as string | undefined | null), false, String(v))
  }
})
