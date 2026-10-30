// Email consumer CPU probe (Phase 5, plan 05-19, controller condition 2): off by
// default, refuses unless EMAIL_CPU_PROBE is a valid short window, never reaches the
// network, and never touches non-probe messages.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROBE_FIXTURES,
  PROBE_MAX_WINDOW_MS,
  PROBE_TAG,
  isProbeBody,
  makeProbeFetch,
  probeEnabled,
  takeEmailCpuProbe,
} from '../../src/server/email/cpu-probe.ts'

const NOW = Date.parse('2026-10-25T22:00:00Z')
const ON = 'until:2026-10-26T06:00:00Z'

type Spy = { body: unknown; attempts: number; acked: number; retried: number; ack(): void; retry(): void }
function msg(body: unknown): Spy {
  return {
    body,
    attempts: 1,
    acked: 0,
    retried: 0,
    ack() {
      this.acked += 1
    },
    retry() {
      this.retried += 1
    },
  }
}
function probeMsgs(run = 'r1'): Spy[] {
  return PROBE_FIXTURES.map((_, i) => msg({ probe: PROBE_TAG, run, fixture: i, outboxId: crypto.randomUUID() }))
}

test('probeEnabled is off unless the flag is a future until: time at most 24 h ahead', () => {
  for (const flag of [undefined, '', 'on', 'true', '1', 'until:', 'until:tomorrow', 'until:2026-10-26 06:00Z']) {
    assert.equal(probeEnabled(flag, NOW), false, String(flag))
  }
  assert.equal(probeEnabled(ON, NOW), true)
  assert.equal(probeEnabled('until:2026-10-25T21:59:59Z', NOW), false, 'past')
  assert.equal(probeEnabled('until:2026-10-25T22:00:00Z', NOW), false, 'now')
  const tooFar = new Date(NOW + PROBE_MAX_WINDOW_MS + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  assert.equal(probeEnabled(`until:${tooFar}`, NOW), false, 'over 24 h')
})

test('isProbeBody matches only the exact tag', () => {
  assert.equal(isProbeBody({ probe: PROBE_TAG }), true)
  for (const body of [null, 'x', [], { probe: 'email-cpu-v2' }, { outboxId: 'x' }]) {
    assert.equal(isProbeBody(body), false)
  }
})

test('a batch without probe messages is returned unchanged and nothing is logged', async () => {
  const batch = { messages: [msg({ outboxId: crypto.randomUUID() })] }
  const lines: string[] = []
  const out = await takeEmailCpuProbe(batch, ON, NOW, (l) => lines.push(l))
  assert.equal(out, batch)
  assert.deepEqual(lines, [])
  assert.equal(batch.messages[0]!.acked, 0)
})

test('flag off: probe messages are acked and dropped, real messages are left alone', async () => {
  const probes = probeMsgs()
  const real = msg({ outboxId: crypto.randomUUID() })
  const lines: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error('network used')
  }) as typeof fetch
  try {
    const out = await takeEmailCpuProbe({ messages: [...probes, real] }, undefined, NOW, (l) => lines.push(l))
    assert.deepEqual(out.messages, [real])
  } finally {
    globalThis.fetch = realFetch
  }
  for (const p of probes) assert.equal(p.acked, 1)
  assert.equal(real.acked, 0)
  assert.deepEqual(lines, ['[email/cpu-probe] refused n=5'])
})

test('flag on: five fixtures run through the real consumer with 5 inert sends and 5 acks, no network', async () => {
  const probes = probeMsgs('run-7')
  const real = msg({ outboxId: crypto.randomUUID() })
  const lines: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error('network used')
  }) as typeof fetch
  try {
    const out = await takeEmailCpuProbe({ messages: [real, ...probes] }, ON, NOW, (l) => lines.push(l))
    assert.deepEqual(out.messages, [real])
  } finally {
    globalThis.fetch = realFetch
  }
  for (const p of probes) {
    assert.equal(p.acked, 1)
    assert.equal(p.retried, 0)
  }
  assert.equal(real.acked, 0)
  assert.deepEqual(lines, ['[email/cpu-probe] run=run-7 n=5 bad=0 sends=5'])
})

test('flag on: malformed probe bodies are acked and not sent', async () => {
  const bad = [
    msg({ probe: PROBE_TAG, run: 'r', fixture: 9, outboxId: crypto.randomUUID() }),
    msg({ probe: PROBE_TAG, run: 'r', fixture: 0, outboxId: 'not-a-uuid' }),
    msg({ probe: PROBE_TAG, run: 'bad run!', fixture: 0, outboxId: crypto.randomUUID() }),
  ]
  const lines: string[] = []
  const out = await takeEmailCpuProbe({ messages: bad }, ON, NOW, (l) => lines.push(l))
  assert.deepEqual(out.messages, [])
  for (const b of bad) assert.equal(b.acked, 1)
  assert.deepEqual(lines, ['[email/cpu-probe] run=- n=0 bad=3 sends=0'])
})

test('the probe fetch answers only claim, finish and Resend', async () => {
  const counter = { sends: 0 }
  const f = makeProbeFetch(new Map(), counter)
  await assert.rejects(f('https://lajguozmtissnnfccmej.supabase.co/rest/v1/rpc/claim_outbox', { method: 'POST' }), /unexpected fetch/)
  await assert.rejects(f('https://api.resend.com/emails', { method: 'GET' }), /unexpected fetch/)
  const r = await f('https://api.resend.com/emails', { method: 'POST', body: '{}' })
  assert.deepEqual(await r.json(), { id: 'probe-1' })
  assert.equal(counter.sends, 1)
})
