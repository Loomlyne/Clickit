import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  formatManualKey,
  friendlyNameFor,
  mfaStep,
  verifyAcrossFactors,
  type VerifyOneResult,
} from '../../src/server/auth/mfa-core.ts'

test('mfaStep: no verified TOTP factor -> enrol; one or two -> verify', () => {
  assert.equal(mfaStep({ verifiedTotp: 0 }), 'enrol')
  assert.equal(mfaStep({ verifiedTotp: 1 }), 'verify')
  assert.equal(mfaStep({ verifiedTotp: 2 }), 'verify')
})

test('mfaStep fails towards enrol only for zero; odd counts are treated as zero', () => {
  assert.equal(mfaStep({ verifiedTotp: -1 }), 'enrol')
  assert.equal(mfaStep({ verifiedTotp: Number.NaN }), 'enrol')
})

test('formatManualKey groups the secret in fours', () => {
  assert.equal(formatManualKey('JBSWY3DPEHPK3PXP'), 'JBSW Y3DP EHPK 3PXP')
  assert.equal(formatManualKey('ABCDEF'), 'ABCD EF')
  assert.equal(formatManualKey(' jbsw y3dp '), 'JBSW Y3DP')
  assert.equal(formatManualKey(''), '')
})

const NAME_RE = /^Authenticator [A-Z0-9]{4}$/

test('friendlyNameFor matches the pattern', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(friendlyNameFor([], Math.random), NAME_RE)
  }
})

test('friendlyNameFor never returns an existing name, even when random repeats', () => {
  const stuck = () => 0 // always the same first candidate
  const first = friendlyNameFor([], stuck)
  assert.match(first, NAME_RE)
  const second = friendlyNameFor([first], stuck)
  assert.match(second, NAME_RE)
  assert.notEqual(second, first)
  const third = friendlyNameFor([first, second], stuck)
  assert.ok(![first, second].includes(third))
  assert.match(third, NAME_RE)
})

test('friendlyNameFor tolerates random() returning 1 or out-of-range values', () => {
  assert.match(friendlyNameFor([], () => 1), NAME_RE)
  assert.match(friendlyNameFor([], () => -5), NAME_RE)
  assert.match(friendlyNameFor([], () => Number.NaN), NAME_RE)
})

test('verifyAcrossFactors tries factors in order and stops at the first success', async () => {
  const calls: string[] = []
  const verifyOne = async (id: string, code: string): Promise<VerifyOneResult> => {
    calls.push(`${id}:${code}`)
    return id === 'f1' ? 'ok' : 'wrong'
  }
  const result = await verifyAcrossFactors(['f2', 'f1'], '123456', verifyOne)
  assert.deepEqual(result, { ok: true, factorId: 'f1' })
  assert.deepEqual(calls, ['f2:123456', 'f1:123456'])
})

test('verifyAcrossFactors does not try later factors after a success', async () => {
  const calls: string[] = []
  const result = await verifyAcrossFactors(['f2', 'f1'], '123456', async (id) => {
    calls.push(id)
    return 'ok'
  })
  assert.deepEqual(result, { ok: true, factorId: 'f2' })
  assert.deepEqual(calls, ['f2'])
})

test('verifyAcrossFactors: all fail -> mfaCodeWrong', async () => {
  const result = await verifyAcrossFactors(['f2', 'f1'], '123456', async () => 'wrong')
  assert.deepEqual(result, { ok: false, error: 'mfaCodeWrong' })
})

test('verifyAcrossFactors: rate limit stops at once with mfaTooMany', async () => {
  const calls: string[] = []
  const result = await verifyAcrossFactors(['f2', 'f1'], '123456', async (id) => {
    calls.push(id)
    return 'rate_limited'
  })
  assert.deepEqual(result, { ok: false, error: 'mfaTooMany' })
  assert.deepEqual(calls, ['f2'])
})

test('verifyAcrossFactors: no factors or a short code never calls verifyOne', async () => {
  let called = 0
  const verifyOne = async (): Promise<VerifyOneResult> => {
    called++
    return 'ok'
  }
  assert.deepEqual(await verifyAcrossFactors([], '123456', verifyOne), {
    ok: false,
    error: 'mfaCodeWrong',
  })
  assert.deepEqual(await verifyAcrossFactors(['f1'], '12345', verifyOne), {
    ok: false,
    error: 'mfaCodeWrong',
  })
  assert.equal(called, 0)
})

test('verifyAcrossFactors: a thrown verifyOne counts as a failure for that factor', async () => {
  const result = await verifyAcrossFactors(['f2', 'f1'], '123456', async (id) => {
    if (id === 'f2') throw new Error('network')
    return 'ok'
  })
  assert.deepEqual(result, { ok: true, factorId: 'f1' })
})

test('audit.ts names the admin_auth entity and the three MFA actions', () => {
  const src = readFileSync(new URL('../../src/lib/audit.ts', import.meta.url), 'utf8')
  assert.match(src, /'admin_auth'/)
  for (const a of ['mfa_enrol', 'mfa_unenrol', 'mfa_failed']) {
    assert.match(src, new RegExp(`'${a}'`))
  }
  assert.match(src, /admin_auth\s*->\s*\{ factor_friendly_name/)
})
