// Test-only producer for the workers.dev email CPU probe (05-19, controller condition 2):
// refuses without the explicit flag and the pinned login env; builds one batch the
// Worker's probe accepts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIRM_FLAG, buildProbeMessages, checkSendArgs } from '../../scripts/email-cpu-probe-send.mjs'
import { PROBE_TAG, takeEmailCpuProbe } from '../../src/server/email/cpu-probe.ts'

const HOME = '/Users/koss/.clickit-cloudflare'
const NOW = Date.parse('2026-10-25T22:00:00Z')

test('refuses without the confirm flag, with the wrong HOME, a token env or a bad run id', () => {
  assert.deepEqual(checkSendArgs([], { HOME }, NOW).reasons, [`${CONFIRM_FLAG} missing`])
  assert.ok(checkSendArgs([CONFIRM_FLAG], { HOME: '/Users/koss' }, NOW).reasons.some((r) => r.startsWith('HOME must be')))
  const withToken = checkSendArgs([CONFIRM_FLAG], { HOME, CLOUDFLARE_API_TOKEN: 'x' }, NOW)
  assert.equal(withToken.ok, false)
  assert.ok(withToken.reasons.some((r) => r.includes('CLOUDFLARE_API_TOKEN')))
  assert.ok(!withToken.reasons.join(' ').includes(' x'), 'never prints a value')
  assert.equal(checkSendArgs([CONFIRM_FLAG, '--run', 'bad run'], { HOME }, NOW).ok, false)
  assert.equal(checkSendArgs([CONFIRM_FLAG, '--run'], { HOME }, NOW).ok, false)
})

test('accepts the flag with the pinned HOME; run id defaults to a time-based id', () => {
  const ok = checkSendArgs([CONFIRM_FLAG], { HOME }, NOW)
  assert.equal(ok.ok, true)
  assert.match(ok.run, /^p[0-9a-z]+$/)
  assert.equal(checkSendArgs([CONFIRM_FLAG, '--run', 'cold-1'], { HOME }, NOW).run, 'cold-1')
})

test('one batch of five tagged JSON messages, fixtures 0..4, fresh ids', () => {
  const msgs = buildProbeMessages('cold-1')
  assert.equal(msgs.length, 5)
  assert.deepEqual(msgs.map((m) => m.body.fixture), [0, 1, 2, 3, 4])
  for (const m of msgs) {
    assert.equal(m.content_type, 'json')
    assert.equal(m.body.probe, PROBE_TAG)
    assert.equal(m.body.run, 'cold-1')
  }
  assert.equal(new Set(msgs.map((m) => m.body.outboxId)).size, 5)
})

test('the Worker probe accepts exactly these bodies (5 inert sends when on)', async () => {
  const messages = buildProbeMessages('cold-1').map((m) => ({ body: m.body, ack() {}, retry() {} }))
  const lines: string[] = []
  await takeEmailCpuProbe({ messages }, 'until:2026-10-26T06:00:00Z', NOW, (l) => lines.push(l))
  assert.deepEqual(lines, ['[email/cpu-probe] run=cold-1 n=5 bad=0 sends=5'])
})
