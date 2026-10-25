import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  enrolAllowed,
  MAX_ADMIN_TOTP,
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

test('enrolAllowed: first factor only while enrolment is due; second only after a fresh code', () => {
  assert.equal(MAX_ADMIN_TOTP, 2)
  assert.equal(enrolAllowed({ mfa: 'needs_enrol', verifiedTotp: 0 }), true)
  assert.equal(enrolAllowed({ mfa: 'ok', verifiedTotp: 1 }), true)
  // A session that still owes a code must never add a factor (it would bypass the code).
  assert.equal(enrolAllowed({ mfa: 'needs_code', verifiedTotp: 1 }), false)
  assert.equal(enrolAllowed({ mfa: 'needs_code', verifiedTotp: 0 }), false)
  assert.equal(enrolAllowed({ mfa: 'ok', verifiedTotp: 2 }), false)
  assert.equal(enrolAllowed({ mfa: 'ok', verifiedTotp: 0 }), false)
  assert.equal(enrolAllowed({ mfa: 'needs_enrol', verifiedTotp: 1 }), false)
  assert.equal(enrolAllowed({ mfa: null, verifiedTotp: 0 }), false)
})

// Source invariants for the server wiring (actions and page are not importable
// under node:test: server-only, Next and Supabase imports).
const ACTIONS = new URL('../../src/app/[locale]/(viewer)/auth/mfa/actions.ts', import.meta.url)
const PAGE = new URL('../../src/app/[locale]/(viewer)/auth/mfa/page.tsx', import.meta.url)

function exportedBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} is exported`)
  const nextExport = src.indexOf('\nexport ', start + 1)
  return src.slice(start, nextExport === -1 ? undefined : nextExport)
}

test('every MFA action re-checks the admin first and uses challenge + verify on the server', () => {
  const src = readFileSync(ACTIONS, 'utf8')
  assert.match(src, /^'use server'/)
  for (const name of ['startEnrol', 'verifyEnrol', 'verifyAdminCode']) {
    const body = exportedBody(src, name)
    assert.match(body, /await getAdminStatus\(\)/, `${name} calls getAdminStatus`)
    assert.match(body, /return \{ ok: false, error: 'unauthorized' \}/, `${name} refuses non-admins`)
  }
  assert.match(src, /mfa\.enroll\(/)
  assert.match(src, /mfa\.challenge\(/)
  assert.match(src, /mfa\.verify\(/)
  assert.match(exportedBody(src, 'startEnrol'), /enrolAllowed\(/)
  assert.match(exportedBody(src, 'startEnrol'), /mfa\.unenroll\(/)
})

test('MFA actions never log or audit a secret, QR, URI or code', () => {
  const src = readFileSync(ACTIONS, 'utf8')
  for (const line of src.split('\n').filter((l) => /console\.(log|warn|error|info|debug)\(/.test(l))) {
    assert.doesNotMatch(line, /secret|qr|uri|code/i, line)
  }
  // Audit diffs: only the friendly name, a count or a reason.
  const diffs = src.match(/diff: \{[^}]*\}/g) ?? []
  assert.ok(diffs.length >= 3)
  for (const d of diffs) assert.doesNotMatch(d, /secret|qr|uri|code\b/i, d)
  for (const a of ["'mfa_enrol'", "'mfa_unenrol'", "'mfa_failed'"]) assert.ok(src.includes(a), a)
  assert.match(src, /entity: 'admin_auth'/)
})

test('/auth/mfa page: signed out -> /auth, non-admin -> /watch, ok -> next; noindex; not under /admin', () => {
  const src = readFileSync(PAGE, 'utf8')
  assert.match(src, /getAdminStatus\(\)/)
  assert.match(src, /getSafeAuthNextPath\(rawNext, '\/admin'\)/)
  assert.match(src, /!status\.signedIn[\s\S]*pathname: '\/auth'/)
  assert.match(src, /!status\.isAdmin\) return redirect\(\{ href: '\/watch'/)
  assert.match(src, /status\.mfa === 'ok'\) return redirect\(\{ href: next/)
  assert.match(src, /robots: \{ index: false/)
  assert.throws(() =>
    readFileSync(new URL('../../src/app/[locale]/admin/mfa/page.tsx', import.meta.url)),
  )
})
