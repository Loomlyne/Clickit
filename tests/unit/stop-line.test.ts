import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CONFLICT_SENTENCE,
  EXPECTED_RESULT,
  GotrueBudget,
  KINDS,
  PASSES,
  REQUIRED_SENTENCE,
  Refusal,
  STALE_UPDATED_AT,
  SilenceWatch,
  TailWatcher,
  buildRequest,
  burstRequest,
  checkProofObject,
  classifyReply,
  classifyTry,
  computeVerdict,
  countIpShapes,
  countTokenShapes,
  countUnredactedHeaders,
  countsSql,
  fixtureMatches,
  joinCheck,
  leakCount,
  main,
  makeTag,
  nextStartMs,
  parseFlightResult,
  prepareRun,
  renderReport,
  runPass,
  scanTailEvent,
  splitTry,
} from '../../scripts/cf/stop-line.mjs'
import {
  diffRows,
  diffStats,
  intersectMoves,
  isLoopback,
  parseStatLines,
  relativeLocation,
  replyFixture,
  signinLinkFormFrom,
} from '../../scripts/cf/stop-line-local-proof.mjs'

const BASE = 'http://127.0.0.1:8796'
const REMOTE = 'https://clickit.clickitstory.workers.dev'
const ID = (c: string) => c.repeat(42)
const IDS = {
  signInAction: ID('a'),
  signUpAction: ID('b'),
  submitSupportMessage: ID('c'),
  updateFeatureFlags: ID('d'),
}
const FLAGS = { showGenresGrid: true, showCtaBanner: false, showFaq: true, comingSoonMode: false }
const SHOW = '11111111-2222-3333-4444-555555555555'
const dir = () => mkdtempSync(join(tmpdir(), 'sl-'))

function adminCookie(expSeconds: number) {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const token = `${enc({ alg: 'none' })}.${enc({ exp: expSeconds })}.sig`
  return `sb-127-auth-token=base64-${enc({ access_token: token, refresh_token: 'refresh-secret-value-long-enough' })}`
}
const COOKIE = adminCookie(4_000_000_000)
const ctx = (over = {}) => ({ base: BASE, tag: 'r1-ap-1', ids: IDS, flags: FLAGS, showId: SHOW, adminCookie: COOKIE, rscParam: 'abc', ...over })
const flight = (value: unknown) => `0:{"a":"$@1","f":"","b":"build"}\n1:${JSON.stringify(value)}\n`
const actionReply = (value: unknown, over = {}) => ({ status: 200, contentType: 'text/x-component', body: flight(value), ...over })

// ---------- requests ----------

test('only admin kinds carry the admin cookie', () => {
  for (const kind of KINDS) {
    const request = buildRequest(kind, ctx())
    const cookie = request.headers.cookie ?? ''
    if (kind === 'admin-page' || kind === 'admin-save') assert.equal(cookie, COOKIE, kind)
    else assert.ok(!cookie.includes('sb-127-auth-token='), kind)
  }
})

test('the contact token is always the empty string', () => {
  const body = JSON.parse(buildRequest('contact', ctx()).body)
  assert.equal(body.length, 2)
  assert.equal(body[1], '')
})

test('the signup-validation password is always under 8 characters', () => {
  const [, password] = JSON.parse(buildRequest('signup-validation', ctx()).body)
  assert.ok(password.length < 8)
  assert.equal(password.length, 5)
})

test('the admin-save second argument is always the stale stamp and flags are the four booleans', () => {
  const [flags, stamp] = JSON.parse(buildRequest('admin-save', ctx({ flags: { ...FLAGS, extra: 'x' } })).body)
  assert.equal(stamp, STALE_UPDATED_AT)
  assert.equal(stamp, '2000-01-01T00:00:00.000Z')
  assert.deepEqual(flags, FLAGS)
})

test('contact and sign-in addresses end in @example.invalid', () => {
  assert.match(JSON.parse(buildRequest('contact', ctx()).body)[0].email, /@example\.invalid$/)
  assert.match(JSON.parse(buildRequest('signin-action', ctx()).body)[0], /@example\.invalid$/)
  assert.match(JSON.parse(buildRequest('signup-validation', ctx()).body)[0], /@example\.invalid$/)
})

test('the sl tag is under 16 characters with no hex run longer than 4', () => {
  for (const code of ['ap', 'as', 'li', 'co', 'si', 'su', 'bu']) {
    const tag = makeTag('r1', code, 9999)
    assert.ok(tag.length < 16, tag)
    assert.doesNotMatch(tag, /[0-9a-f]{5}/)
  }
  assert.throws(() => makeTag('deadbeef', 'ap', 1), Refusal)
  assert.throws(() => makeTag('r1', 'ap', 12345), Refusal)
})

test('action requests send the action headers, a matching Origin and JSON text', () => {
  const request = buildRequest('signin-action', ctx({ tag: 'r1-si-3' }))
  assert.equal(request.method, 'POST')
  assert.equal(request.url, `${BASE}/en/auth?sl=r1-si-3`)
  assert.equal(request.headers['next-action'], IDS.signInAction)
  assert.equal(request.headers['content-type'], 'text/plain;charset=UTF-8')
  assert.equal(request.headers.accept, 'text/x-component')
  assert.equal(request.headers.origin, BASE)
})

test('admin-page rotates the five pages and one RSC GET', () => {
  const requests = [0, 1, 2, 3, 4, 5, 6].map((adminIndex) => buildRequest('admin-page', ctx({ adminIndex })))
  assert.deepEqual(requests.slice(0, 6).map((r) => new URL(r.url).pathname), [
    '/en/admin', '/en/admin/settings', `/en/admin/shows/${SHOW}`, '/en/admin/inbox', '/en/admin/archive', '/en/admin/settings',
  ])
  assert.equal(requests[5].headers.rsc, '1')
  assert.equal(new URL(requests[5].url).searchParams.get('_rsc'), 'abc')
  assert.equal(requests[6].url.split('?')[0], requests[0].url.split('?')[0])
})

test('signin-link uses a random code and a forged verifier cookie under the project ref of its base', () => {
  const live = buildRequest('signin-link', ctx({ base: REMOTE, uuid: 'u-1' }))
  assert.equal(new URL(live.url).pathname, '/auth/callback')
  assert.equal(new URL(live.url).searchParams.get('code'), 'u-1')
  assert.equal(new URL(live.url).searchParams.get('next'), '/watch')
  assert.match(live.headers.cookie, /^sb-lajguozmtissnnfccmej-auth-token-code-verifier=/)
  assert.match(buildRequest('signin-link', ctx()).headers.cookie, /^sb-127-auth-token-code-verifier=/)
  assert.notEqual(new URL(buildRequest('signin-link', ctx()).url).searchParams.get('code'), new URL(buildRequest('signin-link', ctx()).url).searchParams.get('code'))
})

test('an action kind with no id read refuses to build', () => {
  assert.throws(() => buildRequest('contact', ctx({ ids: {} })), Refusal)
})

// ---------- replies, one fixture per reply ----------

const outcome = (kind: string, reply: object) => classifyReply(kind, reply, BASE).outcome

test('flight rows give the action result', () => {
  assert.deepEqual(parseFlightResult(flight({ ok: false })), { found: true, value: { ok: false } })
  assert.equal(parseFlightResult('<html>').found, false)
  assert.equal(parseFlightResult('0:{"a":"$@9"}\n').found, false)
})

test('contact: the exact object passes', () => assert.equal(outcome('contact', actionReply(EXPECTED_RESULT.contact)), 'pass'))
test('contact: Too many requests as 200 stops', () => {
  assert.equal(outcome('contact', actionReply({ ok: false, code: 'unknown', message: 'Too many requests. Please try again in a little while.' })), 'stop')
})
test('contact: temporarily unavailable as 200 stops', () => {
  assert.equal(outcome('contact', actionReply({ ok: false, code: 'unknown', message: 'This service is temporarily unavailable. Please try again later.' })), 'stop')
})
test('contact: ok true stops', () => assert.equal(outcome('contact', actionReply({ ok: true, status: 'sent' })), 'stop'))

test('signin-action: exact Invalid login credentials passes', () => assert.equal(outcome('signin-action', actionReply({ ok: false, error: 'Invalid login credentials' })), 'pass'))
test('signin-action: a rate-limit text as 200 stops', () => assert.equal(outcome('signin-action', actionReply({ ok: false, error: 'Request rate limit reached' })), 'stop'))
test('signin-action: a captcha text as 200 stops', () => assert.equal(outcome('signin-action', actionReply({ ok: false, error: 'captcha protection: request disallowed' })), 'stop'))
test('signin-action: any other error as 200 stops', () => assert.equal(outcome('signin-action', actionReply({ ok: false, error: 'Email not confirmed' })), 'stop'))

test('signup-validation: exact passwordMin passes', () => assert.equal(outcome('signup-validation', actionReply({ ok: false, error: 'passwordMin' })), 'pass'))
test('signup-validation: anything else stops', () => {
  assert.equal(outcome('signup-validation', actionReply({ ok: true, userId: 'x', isAdmin: false })), 'stop')
  assert.equal(outcome('signup-validation', actionReply({ ok: false, error: 'User already registered' })), 'stop')
})

test('admin-save: the exact conflict sentence passes', () => assert.equal(outcome('admin-save', actionReply({ success: false, error: CONFLICT_SENTENCE })), 'pass'))
test('admin-save: Unauthorized as 200 stops', () => {
  const verdict = classifyReply('admin-save', actionReply({ success: false, error: 'Unauthorized' }), BASE)
  assert.deepEqual(verdict, { outcome: 'stop', resultClass: 'session-lost' })
})
test('admin-save: success true stops', () => assert.equal(outcome('admin-save', actionReply({ success: true, updatedAt: 'x' })), 'stop'))

test('signin-link: 307 to the error page passes in either encoding', () => {
  assert.equal(outcome('signin-link', { status: 307, location: '/en/auth?error=Could%20not%20verify%20your%20identity' }), 'pass')
  assert.equal(outcome('signin-link', { status: 307, location: `${BASE}/en/auth?error=Could not verify your identity` }), 'pass')
})
test('signin-link: a redirect elsewhere stops', () => {
  assert.equal(outcome('signin-link', { status: 307, location: '/en/watch' }), 'stop')
  assert.equal(outcome('signin-link', { status: 307, location: 'https://evil.test/en/auth?error=Could%20not%20verify%20your%20identity' }), 'stop')
  assert.equal(outcome('signin-link', { status: 302, location: '/en/auth?error=Could%20not%20verify%20your%20identity' }), 'stop')
})

test('admin-page: 200 with the right content type passes', () => {
  assert.equal(outcome('admin-page', { status: 200, contentType: 'text/html; charset=utf-8' }), 'pass')
  assert.equal(outcome('admin-page', { status: 200, contentType: 'text/x-component', rsc: true }), 'pass')
  assert.equal(outcome('admin-page', { status: 200, contentType: 'text/html', rsc: true }), 'stop')
})
test('admin-page: any 3xx stops as session-lost', () => {
  for (const status of [301, 302, 303, 307, 308]) {
    assert.deepEqual(classifyReply('admin-page', { status, location: '/en/auth' }, BASE), { outcome: 'stop', resultClass: 'session-lost' })
  }
})
test('admin-page: a 404 stops', () => assert.equal(outcome('admin-page', { status: 404, contentType: 'text/html' }), 'stop'))

for (const kind of KINDS) {
  test(`${kind}: 429 stops, action-not-found stops, 5xx and a timeout are counted failures`, () => {
    assert.equal(outcome(kind, { status: 429 }), 'stop')
    assert.equal(outcome(kind, { status: 404, actionNotFound: true }), 'stop')
    assert.equal(outcome(kind, { status: 500, actionNotFound: true }), 'stop')
    assert.deepEqual(classifyReply(kind, { status: 503 }, BASE), { outcome: 'failure', resultClass: '5xx' })
    assert.deepEqual(classifyReply(kind, { timedOut: true, status: null }, BASE), { outcome: 'failure', resultClass: 'timeout' })
  })
}

// ---------- tail scanner and allowlist ----------

const tailEvent = (over: { args?: unknown[]; status?: number | null; outcome?: string; tag?: string; cpuTime?: number } = {}) => ({
  outcome: over.outcome ?? 'ok',
  cpuTime: over.cpuTime ?? 1,
  scriptVersion: { id: '7222dcee-f901' },
  logs: over.args ? [{ message: over.args, level: 'log', timestamp: 1 }] : [],
  exceptions: [],
  event: {
    request: { url: `${REMOTE}/x?sl=${over.tag ?? 'r1-ap-1'}`, headers: {} },
    response: over.status === null ? undefined : { status: over.status ?? 200 },
  },
})

test('rate-limit words in any log argument stop, case-insensitive', () => {
  for (const text of ['Rate Limit reached', 'hit rate_limit', 'code over_request_rate_limit', 'Too Many Requests']) {
    assert.ok(scanTailEvent(tailEvent({ args: ['x', text] })), text)
  }
  assert.ok(scanTailEvent(tailEvent({ args: [{ code: 'over_request_rate_limit' }] })))
})

test('a log argument equal to 429 or holding 429 as a whole number stops', () => {
  assert.ok(scanTailEvent(tailEvent({ args: [429] })))
  assert.ok(scanTailEvent(tailEvent({ args: ['[auth] signIn failed:', 'Nope', 429] })))
  assert.ok(scanTailEvent(tailEvent({ args: ['status 429 from upstream'] })))
  assert.ok(scanTailEvent(tailEvent({ args: [{ status: 429 }] })))
  assert.equal(scanTailEvent(tailEvent({ args: ['id abc4290 and 14295'] })), null)
})

test('a response status of 429 stops; a cpuTime of 429 does not', () => {
  assert.ok(scanTailEvent(tailEvent({ status: 429 })))
  assert.equal(scanTailEvent(tailEvent({ cpuTime: 429 })), null)
})

test('contact needs missing-token, signin-action needs Invalid login credentials', () => {
  assert.equal(scanTailEvent(tailEvent({ tag: 'r1-co-1', args: ['[contact]', 'support', 'refused', 'captcha', 'missing-token'] })), null)
  assert.ok(scanTailEvent(tailEvent({ tag: 'r1-co-1', args: ['[contact]', 'support', 'refused', 'captcha', 'verify-threw'] })))
  assert.equal(scanTailEvent(tailEvent({ tag: 'r1-si-1', args: ['[auth] signIn failed:', 'Invalid login credentials', 400] })), null)
  assert.ok(scanTailEvent(tailEvent({ tag: 'r1-si-1', args: ['[auth] signIn failed:', 'Email not confirmed', 400] })))
})

test('signin-link must match the flow-state family on any serialized form', () => {
  const link = (args: unknown[]) => scanTailEvent(tailEvent({ tag: 'r1-li-1', status: 307, args }))
  assert.equal(link(['failed', 'AuthApiError: invalid flow state, no valid flow state found']), null)
  assert.equal(link(['failed', { code: 'flow_state_not_found' }]), null)
  assert.ok(link(['failed', {}]))
  assert.ok(link(['failed', 'AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage']))
  assert.equal(link(['failed', { code: 'over_request_rate_limit' }]), 'tail-rate-limit-text')
})

test('the log allowlist applies only to a non-5xx reply', () => {
  assert.equal(scanTailEvent(tailEvent({ tag: 'r1-co-1', status: 503 })), null)
  assert.equal(scanTailEvent(tailEvent({ tag: 'r1-co-1', status: null, outcome: 'exceededCpu' })), null)
})

test('TailWatcher reads only new whole events from pretty-printed output', () => {
  const file = join(dir(), 'tail.jsonl')
  writeFileSync(file, '')
  const watcher = new TailWatcher(file)
  assert.deepEqual(watcher.poll(), { bytes: 0, events: [] })
  const pretty = JSON.stringify({ outcome: 'ok', a: 1 }, null, 4)
  const half = pretty.indexOf('"a"')
  appendFileSync(file, pretty.slice(0, half))
  assert.equal(watcher.poll().events.length, 0)
  appendFileSync(file, `${pretty.slice(half)}\n${JSON.stringify({ outcome: 'ok', a: 2 })}\n`)
  assert.deepEqual(watcher.poll().events.map((e: { a: number }) => e.a), [1, 2])
  assert.equal(watcher.poll().bytes, 0)
})

// ---------- budget, cookie, pacing, silence ----------

test('the GoTrue budget never exceeds 25 calls in any rolling 300 s', () => {
  const budget = new GotrueBudget()
  for (let i = 0; i < 25; i++) {
    assert.equal(budget.canSend(i * 1000), true)
    budget.record(i * 1000)
  }
  assert.equal(budget.canSend(25_000), false)
  assert.equal(budget.canSend(299_999), false)
  assert.equal(budget.canSend(300_001), true)
})

function fakeDeps(replyFor: (req: { url: string; method: string; body?: string }, n: number) => object, options: { tail?: object | null; start?: number } = {}) {
  const state = { t: options.start ?? 1_000_000, sent: [] as { url: string; method: string; body?: string; at: number; headers: Record<string, string> }[], records: [] as { type: string; [k: string]: unknown }[] }
  return {
    state,
    deps: {
      now: () => state.t,
      sleep: async (ms: number) => {
        state.t += ms
      },
      log: (record: { type: string }) => state.records.push(record),
      tail: options.tail ?? null,
      send: async (request: { url: string; method: string; body?: string; headers: Record<string, string> }) => {
        state.sent.push({ ...request, at: state.t })
        const reply = replyFor(request, state.sent.length) as { hangMs?: number }
        if (reply.hangMs) state.t += reply.hangMs
        return reply
      },
    },
  }
}

const goodReply = (request: { url: string; rsc?: boolean; headers?: Record<string, string> }) => {
  const url = new URL(request.url)
  const code = (url.searchParams.get('sl') ?? '').split('-')[1]
  const results: Record<string, unknown> = { as: EXPECTED_RESULT['admin-save'], co: EXPECTED_RESULT.contact, si: EXPECTED_RESULT['signin-action'], su: EXPECTED_RESULT['signup-validation'] }
  if (results[code]) return actionReply(results[code])
  if (code === 'li') return { status: 307, location: '/en/auth?error=Could%20not%20verify%20your%20identity' }
  return { status: 200, contentType: request.headers?.rsc ? 'text/x-component' : 'text/html', rsc: Boolean(request.headers?.rsc) }
}

const cfgFor = (pass: string, over = {}) => ({
  pass,
  run: 'r1',
  base: BASE,
  kinds: [...(PASSES as Record<string, { order?: string[]; rotation?: string[]; extras?: string[] }>)[pass].order ?? [], ...((PASSES as Record<string, { rotation?: string[] }>)[pass].rotation ?? []), ...((PASSES as Record<string, { extras?: string[] }>)[pass].extras ?? [])],
  ids: IDS,
  flags: FLAGS,
  showId: SHOW,
  adminCookie: COOKIE,
  rscParam: 'abc',
  prior: [] as object[],
  ...over,
})

test('an admin cookie under 300 s to exp gives need-cookie before any admin request is sent', async () => {
  const start = Date.parse('2026-10-31T12:00:00Z')
  const { state, deps } = fakeDeps(goodReply, { start })
  const result = await runPass(cfgFor('canary', { adminCookie: adminCookie(start / 1000 + 299), kinds: ['admin-page'] }), deps)
  assert.equal(result.exitCode, 4)
  assert.equal(result.reason, 'need-cookie')
  assert.equal(state.sent.length, 0)
})

test('pacing is closed-loop: one in flight, and a 30 s hang advances the schedule', async () => {
  assert.equal(nextStartMs(0, 2000, 10_000), 10_000)
  assert.equal(nextStartMs(0, 30_000, 10_000), 30_000)
  const { state, deps } = fakeDeps((request, n) => (n === 3 ? { hangMs: 30_000, timedOut: true, status: null } : goodReply(request as never)))
  const stopAfter = 8
  const cfg = cfgFor('slow')
  const originalSend = deps.send
  deps.send = async (request) => {
    if (state.sent.length >= stopAfter) throw new Error('enough')
    return originalSend(request)
  }
  await assert.rejects(runPass(cfg, deps), /enough/)
  const gaps = state.sent.slice(1).map((s, i) => s.at - state.sent[i].at)
  assert.deepEqual(gaps.slice(0, 5), [10_000, 10_000, 30_000, 10_000, 10_000])
})

test('silence stop: no new tail bytes for 120 s after a finished try; planned pauses do not count', () => {
  const watch = new SilenceWatch()
  assert.equal(watch.isSilent(1_000_000), false)
  watch.tryFinished(0)
  assert.equal(watch.isSilent(119_999), false)
  assert.equal(watch.isSilent(120_000), true)
  watch.bytes()
  assert.equal(watch.isSilent(500_000), false)
  watch.tryFinished(500_000)
  watch.paused()
  assert.equal(watch.isSilent(900_000), false)
})

test('a silent tail stops the run', async () => {
  const { deps } = fakeDeps(goodReply, { tail: { poll: () => ({ bytes: 0, events: [] }) } })
  const result = await runPass(cfgFor('slow'), deps)
  assert.equal(result.exitCode, 3)
  assert.equal(result.reason, 'tail-silent')
})

test('a stop-worthy tail event stops the run', async () => {
  const { state, deps } = fakeDeps(goodReply, { tail: { poll: () => ({ bytes: 10, events: [tailEvent({ args: ['too many requests'] })] }) } })
  const result = await runPass(cfgFor('slow'), deps)
  assert.equal(result.exitCode, 3)
  assert.equal(result.reason, 'tail-rate-limit-text')
  assert.equal(state.sent.length, 1)
})

// ---------- canary ----------

const sentKinds = (state: { sent: { url: string }[] }) => state.sent.map((s) => new URL(s.url).searchParams.get('sl')!.split('-')[1])

test('canary: signup-validation runs first, its passwordMin unlocks the action kinds, 15 s apart', async () => {
  const { state, deps } = fakeDeps(goodReply)
  const result = await runPass(cfgFor('canary'), deps)
  assert.equal(result.exitCode, 0)
  assert.equal(result.proven, true)
  assert.deepEqual(sentKinds(state), ['su', 'ap', 'li', 'as', 'co', 'si'])
  const gaps = state.sent.slice(1).map((s, i) => s.at - state.sent[i].at)
  assert.deepEqual([...new Set(gaps)], [15_000])
})

test('canary: a 5xx is retried up to 5 times, 15 s apart, so a single 1102 does not read as a wrong id', async () => {
  const { state, deps } = fakeDeps((request, n) => (n === 1 ? { status: 503 } : goodReply(request as never)))
  const result = await runPass(cfgFor('canary'), deps)
  assert.equal(result.proven, true)
  assert.deepEqual(sentKinds(state).slice(0, 3), ['su', 'su', 'ap'])
})

test('canary: if the signup proof never passes, only GET kinds are sent', async () => {
  const { state, deps } = fakeDeps((request) => (new URL(request.url).searchParams.get('sl')!.includes('-su-') ? { status: 503 } : goodReply(request as never)))
  const result = await runPass(cfgFor('canary'), deps)
  assert.equal(result.proven, false)
  const kinds = sentKinds(state)
  assert.deepEqual(kinds, ['su', 'su', 'su', 'su', 'su', 'su', 'ap', 'li'])
  assert.deepEqual(state.records.filter((r) => r.type === 'not-sent').map((r) => r.kind), ['admin-save', 'contact', 'signin-action'])
})

test('canary: a --get-only run is exempt from the proof and sends no action kind', async () => {
  const { state, deps } = fakeDeps(goodReply)
  const result = await runPass(cfgFor('canary', { getOnly: true, ids: null, kinds: ['admin-page', 'signin-link'] }), deps)
  assert.equal(result.exitCode, 0)
  assert.deepEqual(sentKinds(state), ['ap', 'li'])
  assert.ok(state.sent.every((s) => s.method === 'GET'))
})

test('canary: an unexpected reply stops at once', async () => {
  const { state, deps } = fakeDeps((request) => (new URL(request.url).searchParams.get('sl')!.includes('-su-') ? actionReply({ ok: true, userId: 'x', isAdmin: false }) : goodReply(request as never)))
  const result = await runPass(cfgFor('canary'), deps)
  assert.equal(result.exitCode, 3)
  assert.equal(state.sent.length, 1)
})

// ---------- paced passes ----------

test('slow: each rotating kind reaches 100, 10 s apart, after a 180 s idle, burst of 30 at the midpoint', async () => {
  const { state, deps } = fakeDeps(goodReply)
  const result = await runPass(cfgFor('slow'), deps)
  assert.equal(result.exitCode, 0)
  const kinds = sentKinds(state)
  for (const code of ['ap', 'li', 'as', 'co', 'si']) assert.equal(kinds.filter((k) => k === code).length, 100, code)
  assert.equal(kinds.filter((k) => k === 'bu').length, 30)
  assert.equal(kinds.indexOf('bu'), 250)
  assert.equal(state.sent[0].at, 1_000_000 + 180_000)
  const burst = state.sent.filter((s) => s.url.includes('-bu-'))
  assert.equal(new URL(burst[0].url).pathname, '/en/portfolio')
  assert.equal(burst[1].at - burst[0].at, 1000)
  assert.ok(state.records.some((r) => r.type === 'burst-end'))
})

test('fast: counted kinds reach 100 at 1/s, GoTrue kinds only as the budget allows, never over 25 in 300 s', async () => {
  const { state, deps } = fakeDeps(goodReply)
  const result = await runPass(cfgFor('fast'), deps)
  assert.equal(result.exitCode, 0)
  const kinds = sentKinds(state)
  for (const code of ['ap', 'as', 'co', 'su']) assert.equal(kinds.filter((k) => k === code).length, 100, code)
  const gotrue = state.sent.filter((s) => /-(li|si)-/.test(s.url))
  assert.ok(gotrue.length >= 30 && gotrue.length <= 45, String(gotrue.length))
  assert.ok(Math.abs(kinds.filter((k) => k === 'li').length - kinds.filter((k) => k === 'si').length) <= 1)
  for (const call of gotrue) {
    assert.ok(gotrue.filter((c) => c.at <= call.at && c.at > call.at - 300_000).length <= 25)
  }
})

test('--resume continues where a need-cookie pause left off, with no second idle or burst', async () => {
  const start = Date.parse('2026-10-31T12:00:00Z')
  const first = fakeDeps(goodReply, { start })
  const firstResult = await runPass(cfgFor('slow', { adminCookie: adminCookie(start / 1000 + 180 + 300 + 2600) }), first.deps)
  assert.equal(firstResult.exitCode, 4)
  const sentBefore = first.state.sent.length
  assert.ok(sentBefore > 250)
  const second = fakeDeps(goodReply, { start: first.state.t + 600_000 })
  const resumed = await runPass(cfgFor('slow', { resume: true, prior: first.state.records }), second.deps)
  assert.equal(resumed.exitCode, 0)
  const all = [...sentKinds(first.state), ...sentKinds(second.state)]
  for (const code of ['ap', 'li', 'as', 'co', 'si']) assert.equal(all.filter((k) => k === code).length, 100, code)
  assert.equal(all.filter((k) => k === 'bu').length, 30)
  assert.equal(second.state.sent[0].at, first.state.t + 600_000)
  const tags = [...first.state.sent, ...second.state.sent].map((s) => new URL(s.url).searchParams.get('sl'))
  assert.equal(new Set(tags).size, tags.length)
})

// ---------- refusals ----------

const zero = { tables: [], rows: {} }
const replyFixtures: Record<string, object[]> = {
  'admin-page': [{ status: 200, contentType: 'text/html', rsc: false }],
  'admin-save': [{ status: 200, result: EXPECTED_RESULT['admin-save'] }],
  'signin-link': [{ status: 307, location: '/en/auth?error=Could%20not%20verify%20your%20identity' }],
  contact: [{ status: 200, result: EXPECTED_RESULT.contact }],
  'signin-action': [{ status: 200, result: EXPECTED_RESULT['signin-action'] }],
  'signup-validation': [{ status: 200, result: EXPECTED_RESULT['signup-validation'] }],
}
const goodProof = (): { commit: string; kinds: { kind: string; verdict: string; deltas: object; replies: object[] }[] } => ({
  commit: '787ca3a',
  kinds: KINDS.map((kind: string) => ({ kind, verdict: 'write-free', deltas: zero, replies: replyFixtures[kind] })),
})

function runFiles(proof: object = goodProof()) {
  const root = dir()
  const files = { proof: join(root, 'proof.json'), ids: join(root, 'ids.json'), flags: join(root, 'flags.json'), cookie: join(root, 'c.cookie'), root }
  writeFileSync(files.proof, JSON.stringify(proof))
  writeFileSync(files.ids, JSON.stringify({ names: Object.fromEntries(Object.entries(IDS).map(([n, id]) => [n, { status: 'found', id }])) }))
  writeFileSync(files.flags, JSON.stringify(FLAGS))
  writeFileSync(files.cookie, `${COOKIE}\n`)
  return files
}

const args = (files: ReturnType<typeof runFiles>, over = {}) => ({
  base: BASE,
  pass: 'canary',
  run: 'r1',
  proof: files.proof,
  ids: files.ids,
  flagsFile: files.flags,
  adminCookieFile: files.cookie,
  showId: SHOW,
  ...over,
})

test('prepareRun accepts a good set of inputs', () => {
  const prepared = prepareRun(args(runFiles()))
  assert.equal(prepared.kinds.length, 6)
  assert.equal(prepared.ids.signInAction, IDS.signInAction)
})

test('refused: a base other than loopback or the exact Worker', () => {
  const files = runFiles()
  for (const base of ['https://www.clickitstory.ae', 'https://clickitstory.ae', 'https://clickit.clickitstory.workers.dev.evil.test', 'http://clickit.clickitstory.workers.dev']) {
    assert.throws(() => prepareRun(args(files, { base })), /--base/, base)
  }
})

test('refused: missing --proof', () => assert.throws(() => prepareRun(args(runFiles(), { proof: undefined })), /--proof/))
test('refused: missing --ids without --get-only, allowed with it', () => {
  const files = runFiles()
  assert.throws(() => prepareRun(args(files, { ids: undefined })), /--ids/)
  const prepared = prepareRun(args(files, { ids: undefined, getOnly: true }))
  assert.deepEqual(prepared.kinds.sort(), ['admin-page', 'signin-link'])
  assert.equal(prepared.ids, null)
})
test('refused: a kind not write-free in the proof, unless left out by --kinds', () => {
  const proof = goodProof()
  proof.kinds.find((k) => k.kind === 'contact')!.verdict = 'dropped'
  const files = runFiles(proof)
  assert.throws(() => prepareRun(args(files)), /contact is not write-free/)
  assert.ok(!prepareRun(args(files, { kinds: ['admin-page', 'signup-validation'] })).kinds.includes('contact'))
})
test('refused: a proof whose commit is not 787ca3a', () => {
  assert.throws(() => prepareRun(args(runFiles({ ...goodProof(), commit: 'abc1234' }))), /commit/)
})
test('refused: a proof missing any of the six kinds', () => {
  for (const kind of KINDS) {
    const proof = goodProof()
    proof.kinds = proof.kinds.filter((k) => k.kind !== kind)
    assert.throws(() => prepareRun(args(runFiles(proof))), /lacks/, kind)
  }
})
test('refused: a write-free kind with any non-zero delta', () => {
  for (const deltas of [{ tables: [{ table: 'auth.users', ins: 0, upd: 1, del: 0 }], rows: {} }, { tables: [], rows: { 'public.rate_limits': 1 } }]) {
    const proof = goodProof()
    proof.kinds[0].deltas = deltas
    assert.throws(() => prepareRun(args(runFiles(proof))), /shows a write/)
  }
})
test('refused: a write-free kind with a recorded reply differing from the expected object', () => {
  const proof = goodProof()
  proof.kinds.find((k) => k.kind === 'contact')!.replies = [{ status: 200, result: { ok: true, status: 'sent' } }]
  assert.throws(() => prepareRun(args(runFiles(proof))), /unexpected reply/)
})
test('refused: on workers.dev without --tail-file; flags that are not the four booleans', () => {
  const files = runFiles()
  assert.throws(() => prepareRun(args(files, { base: REMOTE })), /--tail-file/)
  writeFileSync(files.flags, JSON.stringify({ showFaq: true }))
  assert.throws(() => prepareRun(args(files)), /flags lack/)
})
test('refused: a cookie file with no session', () => {
  const files = runFiles()
  writeFileSync(files.cookie, 'nonsense\n')
  assert.throws(() => prepareRun(args(files)), /no session/)
})

test('main run: every refusal exits non-zero and sends nothing', async () => {
  const files = runFiles()
  const sends: object[] = []
  const send = async (request: object) => {
    sends.push(request)
    return {}
  }
  for (const argv of [
    ['run', '--base', 'https://www.clickitstory.ae', '--pass', 'canary'],
    ['run', '--base', 'http://127.0.0.1:1', '--pass', 'canary'],
    ['run', '--base', BASE, '--pass', 'canary', '--proof', files.proof],
    ['run', '--base', BASE, '--pass', 'slow', '--proof', files.proof, '--ids', files.ids, '--flags-file', files.flags, '--admin-cookie-file', files.cookie, '--show-id', SHOW, '--log-dir', files.root],
  ]) {
    assert.notEqual(await main(argv, { send }), 0, argv.join(' '))
  }
  assert.equal(sends.length, 0)
})

test('check-proof exits 1 on a bad proof and 0 on a good one, through the same loader', async () => {
  const good = runFiles()
  assert.equal(await main(['check-proof', good.proof]), 0)
  const bad = runFiles({ ...goodProof(), commit: 'nope' })
  assert.equal(await main(['check-proof', bad.proof]), 1)
  assert.throws(() => checkProofObject({}), Refusal)
})

// ---------- overall verdict ----------

type Cell = { ok?: number; exceededCpu?: number; other?: number; ok5xx?: number; timeout?: number; missing?: number; budgetCapped?: boolean }
function row(cell: Cell) {
  const columns = { ok: 0, exceededCpu: 0, other: 0, ok5xx: 0, timeout: 0, missing: 0, ...cell }
  const n = columns.ok + columns.exceededCpu + columns.other + columns.ok5xx + columns.timeout + columns.missing
  return { pass: 'slow', group: 'x', kind: 'contact', budgetCapped: false, cpu: [], ...columns, n }
}
const passing = row({ ok: 100 })
const verdictOf = (rows: object[], opts = {}) => computeVerdict(rows, opts).verdict

test('all counted cells pass gives PASS', () => assert.equal(verdictOf([passing, row({ ok: 99, missing: 1 })]), 'PASS'))
test('98 ok plus 2 exceededCpu gives FAIL', () => assert.equal(verdictOf([passing, row({ ok: 98, exceededCpu: 2 })]), 'FAIL'))
test('99 ok plus 1 passes', () => assert.equal(verdictOf([row({ ok: 99, exceededCpu: 1 })]), 'PASS'))
test('98 ok plus 2 missing gives FAIL', () => assert.equal(verdictOf([row({ ok: 98, missing: 2 })]), 'FAIL'))
test('98 ok plus 2 timeouts gives FAIL', () => assert.equal(verdictOf([row({ ok: 98, timeout: 2 })]), 'FAIL'))
test('98 ok plus 2 other gives FAIL', () => assert.equal(verdictOf([row({ ok: 98, other: 2 })]), 'FAIL'))
test('98 ok plus 2 ok5xx gives FAIL with the not-CPU line printed', () => {
  const result = computeVerdict([row({ ok: 98, ok5xx: 2 })])
  assert.equal(result.verdict, 'FAIL')
  assert.equal(result.ok5xx, 2)
  const records = [
    ...Array.from({ length: 100 }, (_, i) => ({ type: 'try', pass: 'slow', tag: `r1-co-${i}`, kind: 'contact', startMs: i, endMs: i, status: i < 2 ? 503 : 200, resultClass: i < 2 ? '5xx' : 'expected' })),
  ]
  const events = records.map((r) => tailEvent({ tag: r.tag, status: r.status }))
  const { text } = renderReport({ records, events, version: '7222dcee' })
  assert.match(text.split('\n')[0], /^NOT CPU: 2 tries/)
})
test('a counted cell at n 40 with no failure gives INCOMPLETE', () => assert.equal(verdictOf([passing, row({ ok: 40 })]), 'INCOMPLETE'))
test('a failure rate above the line is FAIL at any n', () => assert.equal(verdictOf([row({ ok: 39, exceededCpu: 1 })]), 'FAIL'))

const capped = (cell: Cell) => row({ ...cell, budgetCapped: true })
test('a budget-capped row with 10+ joined tries and no failure does not change the verdict', () => assert.equal(verdictOf([passing, capped({ ok: 16 })]), 'PASS'))
test('a budget-capped row with 1 failure does not change the verdict and is named', () => {
  const result = computeVerdict([passing, capped({ ok: 15, exceededCpu: 1 })])
  assert.equal(result.verdict, 'PASS')
  assert.equal(result.named.length, 1)
})
test('a budget-capped row with 2 failures gives FAIL', () => assert.equal(verdictOf([passing, capped({ ok: 14, exceededCpu: 2 })]), 'FAIL'))
test('a budget-capped row under 10 joined tries gives INCOMPLETE', () => assert.equal(verdictOf([passing, capped({ ok: 9 })]), 'INCOMPLETE'))
test('a dropped or unread kind gives INCOMPLETE', () => {
  assert.equal(verdictOf([passing], { dropped: ['contact'] }), 'INCOMPLETE')
  assert.equal(verdictOf([passing, row({})]), 'INCOMPLETE')
})
test('a stop reason gives INCOMPLETE unless a cell already FAILed', () => {
  assert.equal(verdictOf([passing], { stopReasons: ['slow: session-lost'] }), 'INCOMPLETE')
  assert.equal(verdictOf([row({ ok: 90, exceededCpu: 10 })], { stopReasons: ['slow: session-lost'] }), 'FAIL')
})

test('each try counts once, in one column, from tail outcome', () => {
  const ok = { status: 200, resultClass: 'expected' }
  assert.equal(classifyTry(ok, tailEvent({})), 'ok')
  assert.equal(classifyTry(ok, tailEvent({ outcome: 'exceededCpu' })), 'exceededCpu')
  assert.equal(classifyTry(ok, tailEvent({ outcome: 'canceled' })), 'other')
  assert.equal(classifyTry(ok, tailEvent({ outcome: 'exceededMemory' })), 'other')
  assert.equal(classifyTry({ status: 503, resultClass: '5xx' }, tailEvent({ status: 503 })), 'ok5xx')
  assert.equal(classifyTry({ status: null, resultClass: 'timeout' }, tailEvent({})), 'timeout')
  assert.equal(classifyTry({ status: null, resultClass: 'timeout' }, null), 'timeout')
  assert.equal(classifyTry(ok, null), 'missing')
})

// ---------- split rows and report ----------

test('a try after the burst lands in after-burst', () => {
  assert.equal(splitTry({ startMs: 100 }, { burstEndMs: 200 }).burst, 'before-burst')
  assert.equal(splitTry({ startMs: 300 }, { burstEndMs: 200 }).burst, 'after-burst')
  assert.equal(splitTry({ startMs: 300 }, {}).burst, 'before-burst')
})

test('a try within 180 s after a pause over 60 s is marked after-pause', () => {
  const pauses = [{ fromMs: 0, toMs: 100_000 }]
  assert.equal(splitTry({ startMs: 100_000 + 180_000 }, { pauses }).afterPause, true)
  assert.equal(splitTry({ startMs: 100_000 + 180_001 }, { pauses }).afterPause, false)
  assert.equal(splitTry({ startMs: 50_000 }, { pauses }).afterPause, false)
  assert.equal(splitTry({ startMs: 200_000 }, { pauses: [{ fromMs: 0, toMs: 60_000 }] }).afterPause, false)
})

function fullRun() {
  const records: { type: string; [k: string]: unknown }[] = []
  const events: object[] = []
  let n = 0
  const add = (pass: string, kind: string, code: string, count: number, startAt: number) => {
    for (let i = 0; i < count; i++) {
      n++
      const tag = `r1-${code}-${n}`
      records.push({ type: 'try', pass, tag, kind, startMs: startAt + i, endMs: startAt + i, status: 200, resultClass: 'expected' })
      events.push({ ...tailEvent({ tag, cpuTime: 5 }) })
    }
  }
  for (const [kind, code] of [['admin-page', 'ap'], ['admin-save', 'as'], ['signin-link', 'li'], ['contact', 'co'], ['signin-action', 'si']]) add('slow', kind, code, 100, 1000)
  for (const [kind, code] of [['admin-page', 'ap'], ['admin-save', 'as'], ['contact', 'co'], ['signup-validation', 'su']]) add('fast', kind, code, 100, 5000)
  for (const [kind, code] of [['signin-link', 'li'], ['signin-action', 'si']]) add('fast', kind, code, 16, 5000)
  for (const pass of ['slow', 'fast']) add(pass, 'burst', 'bu', 30, 2000)
  return { records, events }
}

test('the report has the required sentence, the verdict line, every group and the burst CPU beside the spike', () => {
  const { records, events } = fullRun()
  const { text, verdict } = renderReport({ records, events, version: '7222dcee' })
  assert.equal(verdict, 'PASS')
  assert.ok(text.includes(REQUIRED_SENTENCE))
  assert.ok(text.includes("this verdict holds at this pacing and is not proven under the spike's load"))
  assert.match(text, /^STOP-LINE VERDICT: PASS$/m)
  for (const group of ['admin pages', 'admin saves', 'sign-in links', 'contact form', 'sign-in actions']) assert.ok(text.includes(`| ${group} |`) || text.includes(`| ${group} (`), group)
  assert.match(text, /budget-capped, failure rate only, excluded from n/)
  assert.match(text, /Burst \(slow\): 30 \/en\/portfolio GETs, tail CPU total 150 ms/)
  assert.match(text, /33-55 s of media-proxy CPU/)
  assert.match(text, /after-pause/)
  assert.match(text, /n \| ok \| exceededCpu \| other \| ok5xx \| timeout \| missing \| CPU p50 \| CPU p95 \| verdict/)
})

test('an after-burst sub-row above 1% is named in the first lines and does not change the verdict', () => {
  const { records, events } = fullRun()
  records.push({ type: 'burst-end', pass: 'slow', atMs: 1050 })
  const target = records.find((r) => r.pass === 'slow' && r.kind === 'contact' && (r.startMs as number) >= 1050)!
  const event = events.find((e) => (e as { event: { request: { url: string } } }).event.request.url.includes(`sl=${target.tag}`)) as { outcome: string }
  event.outcome = 'exceededCpu'
  const { text, verdict } = renderReport({ records, events, version: '7222dcee' })
  assert.equal(verdict, 'PASS')
  assert.match(text.split('\n')[0], /^NAMED: slow contact form after-burst: 1 of 50 failed/)
})

test('join check: every try joins exactly one event of the named version', () => {
  const records = [{ type: 'try', tag: 'r1-co-1' }, { type: 'try', tag: 'r1-co-2' }]
  const one = tailEvent({ tag: 'r1-co-1' })
  const two = tailEvent({ tag: 'r1-co-2' })
  assert.equal(joinCheck(records, [one, two], '7222dcee').ok, true)
  assert.equal(joinCheck(records, [one], '7222dcee').ok, false)
  assert.equal(joinCheck(records, [one, two, two], '7222dcee').ok, false)
  assert.equal(joinCheck(records, [one, { ...two, scriptVersion: { id: 'other' } }], '7222dcee').ok, false)
})

// ---------- counts SQL ----------

test('counts-sql starts with SELECT, changes nothing and selects no key column', () => {
  const sql = countsSql({ since: '2026-10-31T12:00:00.000Z', clientIp: '203.0.113.7' })
  assert.match(sql, /^SELECT/)
  assert.doesNotMatch(sql, /\b(insert|update|delete|drop|alter|create|truncate)\b/i)
  assert.doesNotMatch(sql, /SELECT\s+(\S+\.)?key\b/i)
  assert.doesNotMatch(sql, /,\s*(\S+\.)?key\b/i)
  for (const table of ['auth.users', 'auth.sessions', 'auth.refresh_tokens', 'auth.flow_state', 'auth.mfa_amr_claims', 'auth.audit_log_entries', 'public.support_messages', 'public.rate_limits', 'public.admin_audit_log']) {
    assert.ok(sql.includes(table), table)
  }
  assert.ok(sql.includes('feature_flags'))
  assert.ok(sql.includes("'support:203.0.113.7'"))
})

test('counts-sql refuses values it cannot quote safely', () => {
  assert.throws(() => countsSql({ since: "x'; drop table y", clientIp: '203.0.113.7' }), Refusal)
  assert.throws(() => countsSql({ since: '2026-10-31T12:00:00.000Z', clientIp: "1.1.1.1'" }), Refusal)
})

// ---------- scans ----------

test('scan-logs counts eyJ token shapes and auth cookie names, printing only counts', () => {
  const jwt = `eyJ${'a'.repeat(20)}`
  assert.deepEqual(countTokenShapes(`x ${jwt} y sb-abc-auth-token=1; sb-abc-auth-token.0=2`), { tokens: 1, authCookies: 2 })
  assert.deepEqual(countTokenShapes('clean log line sl=r1-co-1'), { tokens: 0, authCookies: 0 })
})

test('check-tail-headers counts cookie headers not redacted', () => {
  const event = (headers: object) => ({ event: { request: { headers } } })
  assert.equal(countUnredactedHeaders([event({ cookie: 'REDACTED' }), event({ accept: 'x' })]), 0)
  assert.equal(countUnredactedHeaders([event({ Cookie: 'sb-x=1' }), event({ authorization: 'Bearer y' })]), 2)
})

test('check-report counts IP shapes: addresses count, times and versions do not', () => {
  assert.equal(countIpShapes('from 203.0.113.7 today').v4, 1)
  assert.equal(countIpShapes('from 2a02:6b8::1 today').v6, 1)
  for (const clean of ['2026-10-31T12:00:00.000Z', '16:14-16:22', '4.151.2', '| a | b :: c |', '10:00:00']) {
    assert.deepEqual(countIpShapes(clean), { v4: 0, v6: 0 }, clean)
  }
})

test('the check subcommands exit 1 on any non-zero count and 0 on clean files', async () => {
  const root = dir()
  const clean = join(root, 'clean.md')
  const dirty = join(root, 'dirty.md')
  writeFileSync(clean, 'STOP-LINE VERDICT: PASS at 2026-10-31T12:00:00.000Z\n')
  writeFileSync(dirty, 'client 203.0.113.7\n')
  assert.equal(await main(['check-report', clean]), 0)
  assert.equal(await main(['check-report', dirty]), 1)
  const logs = join(root, 'logs')
  writeFileSync(`${logs}.txt`, `eyJ${'b'.repeat(30)}\n`)
  assert.equal(await main(['scan-logs', `${logs}.txt`]), 1)
  assert.equal(await main(['scan-logs', clean]), 0)
  const tail = join(root, 'tail.jsonl')
  writeFileSync(tail, `${JSON.stringify({ event: { request: { headers: { cookie: 'sb=1' } } } })}\n`)
  assert.equal(await main(['check-tail-headers', tail]), 1)
  writeFileSync(tail, `${JSON.stringify({ event: { request: { headers: { cookie: 'REDACTED' } } } })}\n`)
  assert.equal(await main(['check-tail-headers', tail]), 0)
})

test('the leak check counts session tokens found in logs', () => {
  const root = dir()
  const cookieDir = join(root, 'cookies')
  const logDir = join(root, 'logs')
  for (const d of [cookieDir, logDir]) mkdirSync(d)
  const line = adminCookie(4_000_000_000)
  writeFileSync(join(cookieDir, 'stop-line-admin-1.cookie'), `${line}\n`)
  writeFileSync(join(logDir, 'a.log'), 'nothing here\n')
  assert.equal(leakCount(cookieDir, [logDir]), 0)
  writeFileSync(join(logDir, 'b.log'), 'oops refresh-secret-value-long-enough\n')
  assert.equal(leakCount(cookieDir, [logDir]), 1)
})

test('burst requests are plain labelled GETs with no cookie', () => {
  const request = burstRequest(REMOTE, 'r1-bu-5')
  assert.equal(request.url, `${REMOTE}/en/portfolio?sl=r1-bu-5`)
  assert.deepEqual(request.headers, {})
})

// ---------- local proof helpers ----------

test('the local proof reads and diffs pg_stat counters, and keeps only moves seen in both tries', () => {
  const before = parseStatLines('auth.users|1|2|0\npublic.rate_limits|5|0|0\n')
  const after = parseStatLines('auth.users|1|3|0\npublic.rate_limits|5|0|0\nauth.sessions|1|0|0\n')
  const moved = diffStats(before, after)
  assert.deepEqual(moved, [
    { table: 'auth.sessions', ins: 1, upd: 0, del: 0 },
    { table: 'auth.users', ins: 0, upd: 1, del: 0 },
  ])
  assert.deepEqual(intersectMoves(moved, [{ table: 'auth.users', ins: 0, upd: 1, del: 0 }]).map((d: { table: string }) => d.table), ['auth.users'])
  assert.deepEqual(diffRows({ a: 1, b: 2 }, { a: 1, b: 3 }), { b: 1 })
})

test('the local proof refuses anything but loopback', async () => {
  assert.equal(isLoopback('http://127.0.0.1:55321'), true)
  assert.equal(isLoopback('https://lajguozmtissnnfccmej.supabase.co'), false)
  assert.equal(isLoopback('https://clickit.clickitstory.workers.dev'), false)
})

test('the sign-in link log form names the flow-state family, not a missing verifier', () => {
  const good = signinLinkFormFrom('x\n[auth/callback] exchangeCodeForSession failed AuthApiError: invalid flow state, no valid flow state found\n  code: flow_state_not_found\n')
  assert.equal(good.term, 'flow state')
  const bad = signinLinkFormFrom('[auth/callback] exchangeCodeForSession failed AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage')
  assert.equal(bad.term, null)
  assert.equal(signinLinkFormFrom('nothing here'), null)
})

test('reply fixtures hold no body', () => {
  const local = 'http://localhost:8796'
  assert.deepEqual(replyFixture('contact', { status: 200, body: flight(EXPECTED_RESULT.contact) }, local), { status: 200, result: EXPECTED_RESULT.contact })
  assert.deepEqual(replyFixture('signin-link', { status: 307, location: '/x', body: 'html' }, local), { status: 307, location: '/x' })
  assert.deepEqual(replyFixture('admin-page', { status: 200, contentType: 'text/html', body: 'secret page', rsc: false }, local), { status: 200, contentType: 'text/html', rsc: false })
})

test('a recorded redirect is relative only when same-origin; another host stays absolute and fails the proof', () => {
  const local = 'http://localhost:8796'
  const good = relativeLocation(`${local}/en/auth?error=Could%20not%20verify%20your%20identity`, local)
  assert.equal(good, '/en/auth?error=Could%20not%20verify%20your%20identity')
  assert.equal(fixtureMatches('signin-link', { status: 307, location: good }), true)
  const foreign = relativeLocation('https://evil.test/en/auth?error=Could%20not%20verify%20your%20identity', local)
  assert.equal(foreign, 'https://evil.test/en/auth?error=Could%20not%20verify%20your%20identity')
  assert.equal(fixtureMatches('signin-link', { status: 307, location: foreign }), false)
  const lookalike = relativeLocation(`${local}.evil.test/en/auth?error=Could%20not%20verify%20your%20identity`, local)
  assert.equal(fixtureMatches('signin-link', { status: 307, location: lookalike }), false)
})
