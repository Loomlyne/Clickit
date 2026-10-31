// D-75 and D-79 stop line (plan 02.1-01): paced test requests against the test Worker, exact-reply
// stop rules, and a per-group report whose result comes from tail `outcome`, not from the client.
// More than 1 in 100 failing in any counted group is a FAIL.
//
// workers.dev talks to the LIVE database, so `run` refuses any request kind the local proof did
// not show to be write-free, and any reply other than the exact expected one stops the run.
// Response bodies are discarded after matching: logs hold tag, kind, status, size, result class
// and times only.
//
// Exit: 0 done; 1 a check found something; 2 usage or refused, nothing sent; 3 stopped by a stop
// rule; 4 need-cookie, repeat the cookie step and continue with --resume.
//
// Subcommands: run, report, counts-sql, scan-logs, check-tail-headers, check-report, check-proof.

import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { appendFileSync, existsSync, closeSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isIPv4, isIPv6 } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALLOWED_NAMES, ALLOWED_REMOTE_BASE, isAllowedBase, isValidTag } from './action-ids.mjs'
import { isInsideGitWorkTree, parseCookieLine, sessionExpiry } from './make-session-cookie.mjs'
import { parseTailLines, percentile } from './tail-summary.mjs'

export const TARGET_COMMIT = '787ca3a'
export const REQUIRED_SENTENCE = "this verdict holds at this pacing and is not proven under the spike's load"
export const THRESHOLD_LINE = 'more than 1 in 100 failing in any counted group is a FAIL'
export const LOG_DIR_DEFAULT = '/Users/koss/clickit-phase021-logs/stop-line'
export const STALE_UPDATED_AT = '2000-01-01T00:00:00.000Z'
export const CONFLICT_SENTENCE = 'This item changed while you were saving. Reload and try again.'
export const SIGNIN_EMAIL = 'stop-line-no-user@example.invalid'
export const SIGNIN_PASSWORD = 'stop-line-wrong-password'
export const SIGNUP_PASSWORD = 'short'
export const CONTACT_FIELDS = Object.freeze({
  name: 'Stop Line',
  email: 'stop-line-contact@example.invalid',
  phone: '',
  subject: 'Stop line test',
  message: 'Stop line test message, refused before it is stored.',
  terms: true,
})
export const FORGED_VERIFIER = 'stop-line-forged-verifier-with-no-flow-state-behind-it'
export const LIVE_PROJECT_REF = 'lajguozmtissnnfccmej'
export const SIGNIN_LINK_ERROR = 'Could not verify your identity'
export const GOTRUE_LIMIT = 25
export const GOTRUE_WINDOW_MS = 300_000
export const NEED_COOKIE_S = 300
export const REQUEST_TIMEOUT_MS = 30_000
export const SILENCE_MS = 120_000
export const IDLE_BEFORE_PASS_MS = 180_000
export const CANARY_GAP_MS = 15_000
export const CANARY_RETRIES = 5
export const BURST_SIZE = 30
export const BURST_INTERVAL_MS = 1000
export const BURST_PATH = '/en/portfolio'
export const PAUSE_OVER_MS = 60_000
export const AFTER_PAUSE_MS = 180_000
export const TARGET_TRIES = 100
export const CAPPED_MIN_JOINED = 10
export const FLAG_NAMES = Object.freeze(['showGenresGrid', 'showCtaBanner', 'showFaq', 'comingSoonMode'])

export const KIND_INFO = Object.freeze({
  'admin-page': { code: 'ap', group: 'admin pages', admin: true, get: true, gotrue: false },
  'admin-save': { code: 'as', group: 'admin saves', admin: true, action: 'updateFeatureFlags', page: '/en/admin/settings', gotrue: false },
  'signin-link': { code: 'li', group: 'sign-in links', admin: false, get: true, gotrue: true },
  contact: { code: 'co', group: 'contact form', admin: false, action: 'submitSupportMessage', page: '/en/support', gotrue: false },
  'signin-action': { code: 'si', group: 'sign-in actions', admin: false, action: 'signInAction', page: '/en/auth', gotrue: true },
  'signup-validation': { code: 'su', group: 'sign-in actions validation', admin: false, action: 'signUpAction', page: '/en/auth', gotrue: false },
})
export const KINDS = Object.freeze(Object.keys(KIND_INFO))
const GET_KINDS = KINDS.filter((kind) => KIND_INFO[kind].get)
const KIND_BY_CODE = Object.fromEntries(KINDS.map((kind) => [KIND_INFO[kind].code, kind]))
const BURST_CODE = 'bu'

export const PASSES = Object.freeze({
  canary: { order: ['signup-validation', 'admin-page', 'signin-link', 'admin-save', 'contact', 'signin-action'] },
  slow: { rotation: ['admin-page', 'signin-link', 'admin-save', 'contact', 'signin-action'], intervalMs: 10_000, extras: [] },
  fast: { rotation: ['admin-page', 'admin-save', 'contact', 'signup-validation'], intervalMs: 1000, extras: ['signin-link', 'signin-action'], extraGapMs: 12_000 },
})

export const EXPECTED_RESULT = Object.freeze({
  contact: { ok: false, code: 'unknown', message: 'Security check failed. Please try again.' },
  'signin-action': { ok: false, error: 'Invalid login credentials' },
  'signup-validation': { ok: false, error: 'passwordMin' },
  'admin-save': { success: false, error: CONFLICT_SENTENCE },
})

export const FIXED_GAPS = Object.freeze([
  'The conflict save skips the update, the audit write and the follow-up refresh, so a real save costs 2 live invocations.',
  'The blank-token contact path skips the siteverify hop, the limiter, the insert and the email.',
  'The callback and the sign-in action skip their success paths.',
  'signin-link and signInAction never ran 100 times at 1/s, because of the auth limit.',
  'The stop-line load is about 1.4 s of burst CPU, not the spike\'s about 33-55 s. The media proxy behind that figure leaves the Worker in the final design (controller decision).',
  '7222dcee predates Phase 5, and D-75 still needs a run on the final build before gate 0a.',
  'One network location.',
])

export class Refusal extends Error {}

// ---------- requests ----------

export function makeTag(run, code, n) {
  const tag = `${run}-${code}-${n}`
  if (!isValidTag(tag)) throw new Refusal(`invalid sl tag for run ${run}`)
  return tag
}

export function projectRefFor(base) {
  return new URL(base).origin === ALLOWED_REMOTE_BASE ? LIVE_PROJECT_REF : '127'
}

export function adminPageList(showId) {
  return [
    { path: '/en/admin' },
    { path: '/en/admin/settings' },
    { path: `/en/admin/shows/${showId}` },
    { path: '/en/admin/inbox' },
    { path: '/en/admin/archive' },
    { path: '/en/admin/settings', rsc: true },
  ]
}

const require = createRequire(import.meta.url)

/** The _rsc value Next expects for a plain RSC GET (no prefetch, no state tree, no next-url). */
export async function rscSearchParam() {
  const { computeCacheBustingSearchParam } = require('next/dist/shared/lib/router/utils/cache-busting-search-param.js')
  return computeCacheBustingSearchParam(undefined, undefined, undefined, undefined)
}

function actionArgs(kind, ctx) {
  if (kind === 'admin-save') return [flagsOnly(ctx.flags), ctx.expectedUpdatedAt ?? STALE_UPDATED_AT]
  if (kind === 'contact') return [{ ...CONTACT_FIELDS }, '']
  if (kind === 'signin-action') return [SIGNIN_EMAIL, SIGNIN_PASSWORD]
  if (kind === 'signup-validation') return [SIGNIN_EMAIL, SIGNUP_PASSWORD, 'Stop Line']
  throw new Refusal(`${kind} is not an action kind`)
}

function flagsOnly(flags) {
  const out = {}
  for (const name of FLAG_NAMES) {
    if (typeof flags?.[name] !== 'boolean') throw new Refusal(`flags lack the boolean ${name}`)
    out[name] = flags[name]
  }
  return out
}

/**
 * buildRequest(kind, { base, tag, ids, flags, showId, adminCookie, adminIndex, rscParam, uuid })
 * -> { method, url, headers, body?, rsc? }. Only admin kinds ever carry the admin cookie.
 */
export function buildRequest(kind, ctx) {
  const info = KIND_INFO[kind]
  const origin = new URL(ctx.base).origin
  const headers = {}
  if (info.admin) headers.cookie = ctx.adminCookie
  if (kind === 'admin-page') {
    const pages = adminPageList(ctx.showId)
    const page = pages[(ctx.adminIndex ?? 0) % pages.length]
    const url = new URL(page.path, origin)
    if (page.rsc) {
      url.searchParams.set('_rsc', ctx.rscParam)
      headers.rsc = '1'
    }
    url.searchParams.set('sl', ctx.tag)
    return { method: 'GET', url: url.toString(), headers, rsc: page.rsc === true }
  }
  if (kind === 'signin-link') {
    const url = new URL('/auth/callback', origin)
    url.searchParams.set('code', ctx.uuid ?? randomUUID())
    url.searchParams.set('next', '/watch')
    url.searchParams.set('sl', ctx.tag)
    headers.cookie = `sb-${projectRefFor(ctx.base)}-auth-token-code-verifier=${FORGED_VERIFIER}`
    return { method: 'GET', url: url.toString(), headers }
  }
  const id = ctx.ids?.[info.action]
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{40,44}$/.test(id)) throw new Refusal(`no id read for ${info.action}`)
  const url = new URL(info.page, origin)
  url.searchParams.set('sl', ctx.tag)
  Object.assign(headers, {
    'next-action': id,
    'content-type': 'text/plain;charset=UTF-8',
    accept: 'text/x-component',
    origin,
  })
  return { method: 'POST', url: url.toString(), headers, body: JSON.stringify(actionArgs(kind, ctx)) }
}

export function burstRequest(base, tag) {
  const url = new URL(BURST_PATH, new URL(base).origin)
  url.searchParams.set('sl', tag)
  return { method: 'GET', url: url.toString(), headers: {} }
}

// ---------- replies ----------

/** The action result inside a flight reply: row 0 holds { a: "$@N" } or the value itself. */
export function parseFlightResult(text) {
  const rows = new Map()
  for (const line of String(text).split('\n')) {
    const match = /^([0-9a-f]+):(.*)$/.exec(line)
    if (match) rows.set(match[1], match[2])
  }
  const parse = (raw) => {
    try {
      return { found: true, value: JSON.parse(raw) }
    } catch {
      return { found: false }
    }
  }
  if (!rows.has('0')) return { found: false }
  const root = parse(rows.get('0'))
  if (!root.found || typeof root.value !== 'object' || root.value === null || !('a' in root.value)) return { found: false }
  const action = root.value.a
  if (typeof action === 'string' && action.startsWith('$@')) {
    const row = action.slice(2)
    return rows.has(row) ? parse(rows.get(row)) : { found: false }
  }
  return { found: true, value: action }
}

function stop(resultClass) {
  return { outcome: 'stop', resultClass }
}

export function isExpectedLocation(location, base) {
  if (typeof location !== 'string') return false
  let url
  try {
    url = new URL(location, base)
  } catch {
    return false
  }
  if (url.origin !== new URL(base).origin || url.pathname !== '/en/auth') return false
  const params = [...url.searchParams.keys()]
  return params.length === 1 && url.searchParams.get('error') === SIGNIN_LINK_ERROR
}

/**
 * classifyReply(kind | 'burst', { status, contentType, location, body, actionNotFound, timedOut, rsc }, base)
 * -> { outcome: 'pass' | 'failure' | 'stop', resultClass }
 * A 5xx or a timeout is a counted failure and the run continues; every other reply that is not
 * exactly the expected one stops the run, including replies that arrive as HTTP 200.
 */
export function classifyReply(kind, reply, base) {
  if (reply.timedOut) return { outcome: 'failure', resultClass: 'timeout' }
  if (reply.status === 429) return stop('http-429')
  if (reply.actionNotFound) return stop('action-not-found')
  if (reply.status >= 500) return { outcome: 'failure', resultClass: '5xx' }
  if (kind === 'burst') {
    return reply.status === 200 && /^text\/html/.test(reply.contentType ?? '') ? { outcome: 'pass', resultClass: 'expected' } : stop('unexpected-burst-reply')
  }
  if (kind === 'admin-page') {
    if (reply.status >= 300 && reply.status < 400) return stop('session-lost')
    if (reply.status === 404) return stop('admin-page-404')
    const type = reply.rsc ? /^text\/x-component/ : /^text\/html/
    return reply.status === 200 && type.test(reply.contentType ?? '') ? { outcome: 'pass', resultClass: 'expected' } : stop('unexpected-admin-page-reply')
  }
  if (kind === 'signin-link') {
    return reply.status === 307 && isExpectedLocation(reply.location, base) ? { outcome: 'pass', resultClass: 'expected' } : stop('unexpected-redirect')
  }
  if (reply.status !== 200) return stop('unexpected-status')
  const parsed = parseFlightResult(reply.body)
  if (!parsed.found) return stop('unreadable-action-reply')
  if (!isDeepStrictEqual(parsed.value, EXPECTED_RESULT[kind])) {
    if (kind === 'admin-save' && parsed.value?.error === 'Unauthorized') return stop('session-lost')
    return stop('unexpected-action-reply')
  }
  return { outcome: 'pass', resultClass: 'expected' }
}

// ---------- tail ----------

function serialized(arg) {
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg) ?? ''
  } catch {
    return ''
  }
}

function logArgs(event) {
  const logs = Array.isArray(event?.logs) ? event.logs : []
  const args = logs.flatMap((log) => (Array.isArray(log?.message) ? log.message : [log?.message]))
  const exceptions = Array.isArray(event?.exceptions) ? event.exceptions : []
  return [...args, ...exceptions.map((e) => `${e?.name ?? ''} ${e?.message ?? ''}`)]
}

/** sl tag and kind of a tail event, when it carries one. */
export function tagOfEvent(event) {
  const raw = event?.event?.request?.url
  if (typeof raw !== 'string') return null
  try {
    return new URL(raw).searchParams.get('sl')
  } catch {
    return null
  }
}

export function kindOfTag(tag) {
  const code = String(tag ?? '').split('-')[1]
  if (code === BURST_CODE) return 'burst'
  return KIND_BY_CODE[code] ?? null
}

const RATE_LIMIT_TEXT = /rate limit|rate_limit|over_request|too many requests/i
const WHOLE_429 = /(?<![\w.])429(?![\w.])/
const FLOW_STATE = /flow[_ ]state/i

/**
 * The stop reason a parsed tail event gives, or null. Rate-limit text or 429 in any log argument
 * stops every kind; after that, the kinds with a known log line must show exactly that line on
 * a non-5xx reply.
 */
export function scanTailEvent(event, kind = kindOfTag(tagOfEvent(event))) {
  const texts = logArgs(event).map(serialized)
  if (texts.some((text) => RATE_LIMIT_TEXT.test(text))) return 'tail-rate-limit-text'
  if (texts.some((text) => WHOLE_429.test(text))) return 'tail-429-in-log'
  const status = event?.event?.response?.status
  if (status === 429) return 'tail-response-429'
  if (typeof status !== 'number' || status >= 500 || event?.outcome !== 'ok') return null
  if (kind === 'contact' && !texts.some((text) => text.includes('missing-token'))) return 'tail-contact-without-missing-token'
  if (kind === 'signin-action' && !texts.some((text) => text.includes('Invalid login credentials'))) return 'tail-signin-other-error'
  if (kind === 'signin-link' && !texts.some((text) => FLOW_STATE.test(text))) return 'tail-signin-link-other-error'
  return null
}

/** Reads new whole events from a growing `wrangler tail --format json` file. */
export class TailWatcher {
  constructor(file, { readFrom = readFileTail } = {}) {
    this.file = file
    this.readFrom = readFrom
    this.offset = 0
    this.partial = ''
    this.block = null
  }

  /** -> { bytes, events } for what arrived since the last poll. */
  poll() {
    const chunk = this.readFrom(this.file, this.offset)
    if (chunk.length === 0) return { bytes: 0, events: [] }
    this.offset += chunk.length
    const text = this.partial + chunk.toString('utf8')
    const lastNewline = text.lastIndexOf('\n')
    this.partial = lastNewline === -1 ? text : text.slice(lastNewline + 1)
    const lines = lastNewline === -1 ? [] : text.slice(0, lastNewline).split('\n')
    const whole = []
    for (const line of lines) {
      if (this.block !== null) {
        this.block.push(line)
        if (line === '}') {
          whole.push(this.block.join('\n'))
          this.block = null
        }
      } else if (line === '{') {
        this.block = [line]
      } else if (line.trim() !== '') {
        whole.push(line)
      }
    }
    return { bytes: chunk.length, events: parseTailLines(whole).events }
  }
}

function readFileTail(file, offset) {
  if (!existsSync(file)) return Buffer.alloc(0)
  const size = statSync(file).size
  if (size <= offset) return Buffer.alloc(0)
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(size - offset)
    readSync(fd, buffer, 0, buffer.length, offset)
    return buffer
  } finally {
    closeSync(fd)
  }
}

/**
 * No new tail bytes for 120 s after a finished try stops the run. Planned idle and need-cookie
 * pauses do not count: paused() clears the clock.
 */
export class SilenceWatch {
  constructor(limitMs = SILENCE_MS) {
    this.limitMs = limitMs
    this.waitingSince = null
  }

  bytes() {
    this.waitingSince = null
  }

  tryFinished(nowMs) {
    if (this.waitingSince === null) this.waitingSince = nowMs
  }

  paused() {
    this.waitingSince = null
  }

  isSilent(nowMs) {
    return this.waitingSince !== null && nowMs - this.waitingSince >= this.limitMs
  }
}

// ---------- budget, cookie, pacing ----------

/** signin-link plus signin-action never exceed 25 calls in any rolling 300 s. */
export class GotrueBudget {
  constructor(limit = GOTRUE_LIMIT, windowMs = GOTRUE_WINDOW_MS) {
    this.limit = limit
    this.windowMs = windowMs
    this.calls = []
  }

  canSend(nowMs) {
    this.calls = this.calls.filter((at) => at > nowMs - this.windowMs)
    return this.calls.length < this.limit
  }

  record(nowMs) {
    this.calls.push(nowMs)
  }
}

export function cookieSecondsLeft(cookieLine, nowMs) {
  const exp = sessionExpiry(parseCookieLine(cookieLine).session)
  return exp === null ? -1 : exp - nowMs / 1000
}

/** Closed loop: one request in flight, and a hang moves every later slot along with it. */
export function nextStartMs(previousStartMs, previousFinishMs, intervalMs) {
  return Math.max(previousStartMs + intervalMs, previousFinishMs)
}

// ---------- proof ----------

function nonZeroDelta(deltas) {
  const entries = Array.isArray(deltas?.tables) ? deltas.tables : []
  if (entries.some((d) => d.ins !== 0 || d.upd !== 0 || d.del !== 0)) return true
  return Object.values(deltas?.rows ?? {}).some((value) => value !== 0)
}

export function fixtureMatches(kind, fixture, base = 'http://127.0.0.1:8796') {
  if (KIND_INFO[kind].action) return fixture?.status === 200 && isDeepStrictEqual(fixture.result, EXPECTED_RESULT[kind])
  if (kind === 'signin-link') return fixture?.status === 307 && isExpectedLocation(fixture.location, base)
  const type = fixture?.rsc ? /^text\/x-component/ : /^text\/html/
  return fixture?.status === 200 && type.test(fixture.contentType ?? '')
}

/**
 * Load a local proof and re-check it: the verdict field alone is never trusted. Throws a Refusal
 * for a wrong commit, a missing kind, or a write-free kind with a delta or an unexpected reply.
 */
export function checkProofObject(proof) {
  if (proof?.commit !== TARGET_COMMIT) throw new Refusal(`proof commit is not ${TARGET_COMMIT}`)
  const kinds = new Map((Array.isArray(proof.kinds) ? proof.kinds : []).map((k) => [k.kind, k]))
  for (const kind of KINDS) {
    const entry = kinds.get(kind)
    if (!entry) throw new Refusal(`proof lacks the kind ${kind}`)
    if (entry.verdict !== 'write-free') continue
    if (!entry.deltas || nonZeroDelta(entry.deltas)) throw new Refusal(`proof shows a write for ${kind}`)
    if (!Array.isArray(entry.replies) || entry.replies.length === 0) throw new Refusal(`proof holds no reply for ${kind}`)
    if (!entry.replies.every((fixture) => fixtureMatches(kind, fixture))) throw new Refusal(`proof holds an unexpected reply for ${kind}`)
  }
  return { writeFree: KINDS.filter((kind) => kinds.get(kind).verdict === 'write-free'), dropped: KINDS.filter((kind) => kinds.get(kind).verdict !== 'write-free') }
}

export function loadProof(path) {
  let proof
  try {
    proof = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Refusal('the proof file is not readable JSON')
  }
  return { proof, ...checkProofObject(proof) }
}

// ---------- run ----------

export function loadRunLog(logPath) {
  if (!existsSync(logPath)) return []
  return readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

/** Send one request and keep only what the classifier needs; the body is dropped by the caller. */
export async function sendHttp(request, { timeoutMs = REQUEST_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = await res.text()
    return {
      status: res.status,
      contentType: res.headers.get('content-type'),
      location: res.headers.get('location'),
      actionNotFound: res.headers.get('x-nextjs-action-not-found') !== null,
      body,
      size: body.length,
      rsc: request.rsc === true,
    }
  } catch {
    return { timedOut: true, status: null, size: 0, rsc: request.rsc === true }
  }
}

class RunStop extends Error {
  constructor(reason) {
    super(reason)
    this.reason = reason
  }
}
class NeedCookie extends Error {}

/**
 * runPass(cfg, deps). cfg: { pass, run, base, kinds, getOnly, ids, flags, showId, adminCookie,
 * rscParam, resume, prior }. deps: { send, now, sleep, log, tail } where tail is null or a
 * TailWatcher-shaped object. Returns { exitCode, reason?, proven }.
 */
export async function runPass(cfg, deps) {
  const prior = cfg.prior ?? []
  const priorTries = prior.filter((r) => r.type === 'try')
  let tagN = priorTries.length
  const budget = new GotrueBudget()
  for (const t of priorTries) if (KIND_INFO[t.kind]?.gotrue) budget.record(t.startMs)
  const silence = new SilenceWatch()
  let adminIndex = priorTries.filter((t) => t.kind === 'admin-page').length
  let proven = prior.some((r) => r.type === 'canary-proof')

  const pollTail = () => {
    if (!deps.tail) return
    const { bytes, events } = deps.tail.poll()
    if (bytes > 0) silence.bytes()
    for (const event of events) {
      const reason = scanTailEvent(event)
      if (reason) throw new RunStop(reason)
    }
    if (silence.isSilent(deps.now())) throw new RunStop('tail-silent')
  }

  const sendTry = async (kind) => {
    const info = KIND_INFO[kind]
    if (info?.admin && cookieSecondsLeft(cfg.adminCookie, deps.now()) < NEED_COOKIE_S) throw new NeedCookie()
    if (info?.gotrue && !budget.canSend(deps.now())) throw new RunStop('gotrue-budget')
    tagN++
    const tag = makeTag(cfg.run, kind === 'burst' ? BURST_CODE : info.code, tagN)
    const request =
      kind === 'burst'
        ? burstRequest(cfg.base, tag)
        : buildRequest(kind, { ...cfg, tag, adminIndex })
    if (kind === 'admin-page') adminIndex++
    const startMs = deps.now()
    if (info?.gotrue) budget.record(startMs)
    const reply = await deps.send(request)
    const endMs = deps.now()
    const verdict = classifyReply(kind, reply, cfg.base)
    deps.log({ type: 'try', pass: cfg.pass, tag, kind, startMs, endMs, status: reply.status ?? null, size: reply.size ?? 0, resultClass: verdict.resultClass, outcome: verdict.outcome })
    silence.tryFinished(endMs)
    if (verdict.outcome === 'stop') throw new RunStop(verdict.resultClass)
    pollTail()
    return { verdict, startMs, endMs }
  }

  const idle = async (ms, label) => {
    const fromMs = deps.now()
    silence.paused()
    await deps.sleep(ms)
    silence.paused()
    deps.log({ type: 'pause', pass: cfg.pass, label, fromMs, toMs: deps.now() })
  }

  const drain = async () => {
    if (!deps.tail) return
    await deps.sleep(30_000)
    silence.paused()
    pollTail()
  }

  const canary = async () => {
    const allowed = new Set(cfg.kinds)
    let first = true
    for (const kind of PASSES.canary.order) {
      if (!allowed.has(kind)) continue
      const isAction = Boolean(KIND_INFO[kind].action)
      if (isAction && (cfg.getOnly || (!proven && kind !== 'signup-validation'))) {
        deps.log({ type: 'not-sent', pass: 'canary', kind, reason: cfg.getOnly ? 'get-only' : 'no-signup-proof' })
        continue
      }
      if (!first) await deps.sleep(CANARY_GAP_MS)
      first = false
      let result = await sendTry(kind)
      for (let retry = 0; retry < CANARY_RETRIES && result.verdict.outcome === 'failure'; retry++) {
        await deps.sleep(CANARY_GAP_MS)
        result = await sendTry(kind)
      }
      if (kind === 'signup-validation' && result.verdict.outcome === 'pass') {
        proven = true
        deps.log({ type: 'canary-proof', tag: `${cfg.run}` })
      }
    }
  }

  const paced = async () => {
    const def = PASSES[cfg.pass]
    const allowed = new Set(cfg.kinds)
    const counts = Object.fromEntries(KINDS.map((k) => [k, 0]))
    const inPass = priorTries.filter((t) => t.pass === cfg.pass)
    for (const t of inPass) if (t.kind !== 'burst') counts[t.kind]++
    const rotation = def.rotation.filter((k) => allowed.has(k))
    const extras = def.extras.filter((k) => allowed.has(k))
    let burstLeft = BURST_SIZE - inPass.filter((t) => t.kind === 'burst').length
    let turn = rotation.reduce((sum, k) => sum + counts[k], 0)
    const total = rotation.length * TARGET_TRIES
    let extraTurn = extras.reduce((sum, k) => sum + counts[k], 0)
    let lastExtraMs = -Infinity
    let previous = null
    if (!cfg.resume) await idle(IDLE_BEFORE_PASS_MS, 'before-pass')

    const nextKind = () => {
      const left = rotation.filter((k) => counts[k] < TARGET_TRIES)
      if (left.length === 0) return null
      const now = deps.now()
      if (extras.length > 0 && now - lastExtraMs >= def.extraGapMs && budget.canSend(now)) {
        lastExtraMs = now
        return extras[extraTurn++ % extras.length]
      }
      for (let i = 0; i < rotation.length; i++) {
        const kind = rotation[turn++ % rotation.length]
        if (counts[kind] >= TARGET_TRIES) continue
        if (KIND_INFO[kind].gotrue && !budget.canSend(now)) continue
        return kind
      }
      return 'wait'
    }

    const pace = async (intervalMs) => {
      if (previous) {
        const at = nextStartMs(previous.startMs, previous.endMs, intervalMs)
        const wait = at - deps.now()
        if (wait > 0) await deps.sleep(wait)
      }
    }

    for (;;) {
      const sentRotation = rotation.reduce((sum, k) => sum + counts[k], 0)
      if (burstLeft > 0 && sentRotation >= Math.floor(total / 2)) {
        while (burstLeft > 0) {
          await pace(BURST_INTERVAL_MS)
          previous = await sendTry('burst')
          burstLeft--
        }
        deps.log({ type: 'burst-end', pass: cfg.pass, atMs: deps.now() })
        continue
      }
      await pace(def.intervalMs)
      const kind = nextKind()
      if (kind === null) break
      if (kind === 'wait') {
        await deps.sleep(def.intervalMs)
        silence.paused()
        pollTail()
        continue
      }
      previous = await sendTry(kind)
      counts[kind]++
    }
  }

  try {
    if (cfg.pass === 'canary') await canary()
    else await paced()
    await drain()
    return { exitCode: 0, proven }
  } catch (error) {
    if (error instanceof NeedCookie) {
      deps.log({ type: 'need-cookie', pass: cfg.pass, atMs: deps.now() })
      return { exitCode: 4, reason: 'need-cookie', proven }
    }
    if (error instanceof RunStop) {
      deps.log({ type: 'stop', pass: cfg.pass, reason: error.reason, atMs: deps.now() })
      return { exitCode: 3, reason: error.reason, proven }
    }
    throw error
  }
}

/** Every refusal happens here, before anything is sent. */
export function prepareRun(args, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  if (!args.base || !isAllowedBase(args.base)) throw new Refusal(`refused: --base must be loopback or exactly ${ALLOWED_REMOTE_BASE}`)
  if (!Object.hasOwn(PASSES, args.pass ?? '')) throw new Refusal('refused: --pass must be canary, slow or fast')
  if (!args.proof) throw new Refusal('refused: --proof is required')
  if (!args.getOnly && !args.ids) throw new Refusal('refused: --ids is required without --get-only')
  const { writeFree } = loadProof(args.proof)
  const passKinds = args.pass === 'canary' ? PASSES.canary.order : [...PASSES[args.pass].rotation, ...PASSES[args.pass].extras]
  let kinds = args.kinds ?? passKinds
  if (args.getOnly) kinds = kinds.filter((kind) => GET_KINDS.includes(kind))
  for (const kind of kinds) {
    if (!KINDS.includes(kind)) throw new Refusal(`refused: unknown kind ${kind}`)
    if (!writeFree.includes(kind)) throw new Refusal(`refused: ${kind} is not write-free in the proof`)
  }
  const remote = new URL(args.base).origin === ALLOWED_REMOTE_BASE
  if (remote && !args.tailFile) throw new Refusal('refused: --tail-file is required on workers.dev')
  if (!isValidTag(makeTag(args.run, 'ap', 9999))) throw new Refusal('refused: bad --run')

  let ids = null
  if (!args.getOnly) {
    let names
    try {
      names = JSON.parse(readFile(args.ids)).names
    } catch {
      throw new Refusal('refused: the --ids file is not readable JSON')
    }
    ids = {}
    for (const name of ALLOWED_NAMES) {
      if (names?.[name]?.status === 'found') ids[name] = names[name].id
    }
    for (const kind of kinds) {
      const action = KIND_INFO[kind].action
      if (action && !ids[action]) throw new Refusal(`refused: no id read for ${action}`)
    }
  }
  const needsAdmin = kinds.some((kind) => KIND_INFO[kind].admin)
  const adminCookie = needsAdmin ? readRequired(args.adminCookieFile, '--admin-cookie-file', readFile).trim() : null
  if (adminCookie) {
    try {
      parseCookieLine(adminCookie)
    } catch {
      throw new Refusal('refused: --admin-cookie-file holds no session')
    }
  }
  const flags = kinds.includes('admin-save') ? JSON.parse(readRequired(args.flagsFile, '--flags-file', readFile)) : null
  if (flags) flagsOnly(flags)
  if (kinds.includes('admin-page') && !/^[0-9a-f-]{36}$/.test(args.showId ?? '')) throw new Refusal('refused: --show-id must be a show id')
  return { kinds, ids, flags, adminCookie, showId: args.showId ?? null, remote }
}

function readRequired(path, flag, readFile) {
  if (!path) throw new Refusal(`refused: ${flag} is required for these kinds`)
  try {
    return readFile(path)
  } catch {
    throw new Refusal(`refused: ${flag} is not readable`)
  }
}

// ---------- report ----------

/** Each try counts once, in one column; everything but ok counts against the line. */
export function classifyTry(tryRecord, event) {
  if (!event) return tryRecord.resultClass === 'timeout' ? 'timeout' : 'missing'
  if (event.outcome === 'exceededCpu') return 'exceededCpu'
  if (event.outcome !== 'ok') return 'other'
  if (tryRecord.status >= 500 || event?.event?.response?.status >= 500) return 'ok5xx'
  if (tryRecord.resultClass === 'timeout') return 'timeout'
  return 'ok'
}

export function joinTries(tries, events, version) {
  const byTag = new Map()
  let otherVersion = 0
  let untagged = 0
  for (const event of events) {
    const tag = tagOfEvent(event)
    if (!tag) {
      untagged++
      continue
    }
    const id = event?.scriptVersion?.id
    if (version && !(typeof id === 'string' && id.startsWith(version))) {
      otherVersion++
      continue
    }
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag).push(event)
  }
  const joined = tries.map((record) => ({ record, events: byTag.get(record.tag) ?? [] }))
  const tryTags = new Set(tries.map((t) => t.tag))
  return {
    joined,
    unmatched: joined.filter((j) => j.events.length === 0).length,
    duplicates: joined.filter((j) => j.events.length > 1).length,
    otherVersion,
    untagged,
    extraTagged: [...byTag.keys()].filter((tag) => !tryTags.has(tag)).length,
    eventCount: events.length,
  }
}

function emptyRow() {
  return { n: 0, ok: 0, exceededCpu: 0, other: 0, ok5xx: 0, timeout: 0, missing: 0, cpu: [] }
}

function addToRow(row, tried) {
  row.n++
  row[tried.column]++
  if (tried.event?.outcome === 'ok' && typeof tried.event.cpuTime === 'number') row.cpu.push(tried.event.cpuTime)
}

export const failuresOf = (row) => row.exceededCpu + row.other + row.ok5xx + row.timeout + row.missing

/** before-burst or after-burst, and whether a try falls within 180 s after a pause over 60 s. */
export function splitTry(tryRecord, { burstEndMs = null, pauses = [] } = {}) {
  return {
    burst: burstEndMs !== null && tryRecord.startMs >= burstEndMs ? 'after-burst' : 'before-burst',
    afterPause: pauses.some((p) => p.toMs - p.fromMs > PAUSE_OVER_MS && tryRecord.startMs >= p.toMs && tryRecord.startMs - p.toMs <= AFTER_PAUSE_MS),
  }
}

/**
 * Overall verdict. Counted cells need n at least 100 with at most 1 in 100 failing; above that is
 * FAIL at any n. Budget-capped rows hold only a failure rate. A stop reason or a dropped kind is
 * INCOMPLETE unless a cell already FAILed.
 */
export function computeVerdict(rows, { dropped = [], stopReasons = [] } = {}) {
  const reasons = []
  const named = []
  let fail = false
  let incomplete = false
  for (const row of rows) {
    const failures = failuresOf(row)
    const label = `${row.pass} ${row.group}`
    if (row.budgetCapped) {
      const joined = row.n - row.missing
      if (failures >= 2) {
        fail = true
        reasons.push(`${label}: ${failures} failures in a budget-capped row`)
      } else if (joined < CAPPED_MIN_JOINED) {
        incomplete = true
        reasons.push(`${label}: ${joined} joined tries, under ${CAPPED_MIN_JOINED}`)
      } else if (failures === 1) {
        named.push(`${label}: 1 failure in a budget-capped row`)
      }
      continue
    }
    if (failures * 100 > row.n) {
      fail = true
      reasons.push(`${label}: ${failures} of ${row.n} failed`)
    } else if (row.n < TARGET_TRIES) {
      incomplete = true
      reasons.push(`${label}: n ${row.n}, under ${TARGET_TRIES}`)
    }
  }
  for (const kind of dropped) {
    incomplete = true
    reasons.push(`${kind}: dropped or unread`)
  }
  for (const reason of stopReasons) {
    incomplete = true
    reasons.push(`stop reason: ${reason}`)
  }
  const ok5xx = rows.reduce((sum, row) => sum + row.ok5xx, 0)
  return { verdict: fail ? 'FAIL' : incomplete ? 'INCOMPLETE' : 'PASS', reasons, named, ok5xx }
}

const COUNTED_CELLS = Object.freeze({
  slow: ['admin-page', 'admin-save', 'signin-link', 'contact', 'signin-action'],
  fast: ['admin-page', 'admin-save', 'contact', 'signup-validation'],
})
const CAPPED_CELLS = Object.freeze({ slow: [], fast: ['signin-link', 'signin-action'] })

export function buildRows(records, events, version) {
  const tries = records.filter((r) => r.type === 'try')
  const { joined } = joinTries(tries, events, version)
  const tried = joined.map(({ record, events: matched }) => {
    const event = matched[0] ?? null
    return { record, event, column: classifyTry(record, event) }
  })
  const pauses = records.filter((r) => r.type === 'pause')
  const sorted = tries.slice().sort((a, b) => a.startMs - b.startMs)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMs - sorted[i - 1].endMs > PAUSE_OVER_MS) pauses.push({ fromMs: sorted[i - 1].endMs, toMs: sorted[i].startMs })
  }
  const rows = []
  const subRows = []
  const bursts = {}
  for (const pass of ['slow', 'fast']) {
    const burstEnd = records.find((r) => r.type === 'burst-end' && r.pass === pass)?.atMs ?? null
    const inPass = tried.filter((t) => t.record.pass === pass)
    const burst = inPass.filter((t) => t.record.kind === 'burst')
    bursts[pass] = {
      n: burst.length,
      cpuTotalMs: burst.reduce((sum, t) => sum + (typeof t.event?.cpuTime === 'number' ? t.event.cpuTime : 0), 0),
      failures: burst.filter((t) => t.column !== 'ok').length,
    }
    for (const [cells, budgetCapped] of [[COUNTED_CELLS[pass], false], [CAPPED_CELLS[pass], true]]) {
      for (const kind of cells) {
        const row = { pass, kind, group: KIND_INFO[kind].group, budgetCapped, ...emptyRow() }
        const subs = { 'before-burst': emptyRow(), 'after-burst': emptyRow(), 'after-pause': emptyRow() }
        for (const t of inPass.filter((x) => x.record.kind === kind)) {
          addToRow(row, t)
          const split = splitTry(t.record, { burstEndMs: burstEnd, pauses })
          addToRow(subs[split.burst], t)
          if (split.afterPause) addToRow(subs['after-pause'], t)
        }
        rows.push(row)
        for (const [split, sub] of Object.entries(subs)) subRows.push({ pass, kind, group: KIND_INFO[kind].group, split, ...sub })
      }
    }
  }
  const canary = tried.filter((t) => t.record.pass === 'canary')
  return { rows, subRows, bursts, canary, tried }
}

function renderCells(row) {
  const cell = (v) => (v === null ? '-' : String(v))
  return `${row.n} | ${row.ok} | ${row.exceededCpu} | ${row.other} | ${row.ok5xx} | ${row.timeout} | ${row.missing} | ${cell(percentile(row.cpu, 50))} | ${cell(percentile(row.cpu, 95))}`
}

function rowVerdict(row) {
  const failures = failuresOf(row)
  if (row.budgetCapped) {
    if (failures >= 2) return 'FAIL'
    return row.n - row.missing < CAPPED_MIN_JOINED ? 'INCOMPLETE' : 'failure rate only'
  }
  if (failures * 100 > row.n) return 'FAIL'
  return row.n < TARGET_TRIES ? 'INCOMPLETE' : 'PASS'
}

/** renderReport({ records, events, version, dropped, idRead, proofSummary }) -> markdown text. */
export function renderReport({ records, events, version, dropped = [], idRead = null, proofSummary = null }) {
  const { rows, subRows, bursts } = buildRows(records, events, version)
  const stopReasons = records.filter((r) => r.type === 'stop').map((r) => `${r.pass}: ${r.reason}`)
  const notSent = [...new Set(records.filter((r) => r.type === 'not-sent').map((r) => r.kind))]
  const verdict = computeVerdict(rows, { dropped: [...new Set([...dropped, ...notSent])], stopReasons })
  const first = []
  if (verdict.ok5xx > 0) first.push(`NOT CPU: ${verdict.ok5xx} tries answered 5xx with outcome ok. This is not CPU, so it does not read as a Workers Paid case.`)
  for (const line of verdict.named) first.push(`NAMED: ${line}`)
  for (const sub of subRows) {
    if (sub.split !== 'before-burst' && failuresOf(sub) * 100 > sub.n) first.push(`NAMED: ${sub.pass} ${sub.group} ${sub.split}: ${failuresOf(sub)} of ${sub.n} failed`)
  }
  for (const reason of stopReasons) first.push(`STOPPED: ${reason}`)

  const tries = records.filter((r) => r.type === 'try')
  const join = joinTries(tries, events, version)
  const lines = [...first, '', `Version ${version ?? 'any'}, commit ${TARGET_COMMIT}. The line: ${THRESHOLD_LINE}.`, '']
  for (const pass of ['slow', 'fast']) {
    lines.push(`### Pass ${pass}`, '', '| group | n | ok | exceededCpu | other | ok5xx | timeout | missing | CPU p50 | CPU p95 | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|')
    for (const row of rows.filter((r) => r.pass === pass)) {
      const label = row.budgetCapped ? `${row.group} (budget-capped, failure rate only, excluded from n)` : row.group
      lines.push(`| ${label} | ${renderCells(row)} | ${rowVerdict(row)} |`)
      for (const sub of subRows.filter((s) => s.pass === pass && s.kind === row.kind)) {
        lines.push(`| ${row.group}, ${sub.split} | ${renderCells(sub)} | sub-row |`)
      }
    }
    const burst = bursts[pass]
    lines.push('', `Burst (${pass}): ${burst.n} ${BURST_PATH} GETs, tail CPU total ${burst.cpuTotalMs} ms, ${burst.failures} not ok; beside the spike's about 33-55 s of media-proxy CPU (37 /api/cdn/storage requests at 0.9-1.5 s), expected about 1.4 s here.`, '')
  }
  if (idRead) {
    lines.push('### id-read (extras, excluded from every cell)', '', '| page | status | tries | statuses |', '|---|---|---|---|')
    for (const page of idRead.pages ?? []) lines.push(`| ${page.page} | ${page.status} | ${page.tries.length} | ${page.tries.map((t) => t.status ?? t.error).join(', ')} |`)
    lines.push('')
  }
  lines.push(`Events ${join.eventCount}: joined tries ${join.joined.length - join.unmatched}, duplicate tags ${join.duplicates}, excluded: other version ${join.otherVersion}, no sl tag ${join.untagged}, tagged but not a try ${join.extraTagged}.`, '')
  if (proofSummary) lines.push(`Local proof: write-free ${proofSummary.writeFree.join(', ') || 'none'}; dropped ${proofSummary.dropped.join(', ') || 'none'}.`, '')
  lines.push(REQUIRED_SENTENCE, '', '### Fixed gaps', '', ...FIXED_GAPS.map((gap) => `- ${gap}`), '')
  if (verdict.reasons.length > 0) lines.push('### Why', '', ...verdict.reasons.map((r) => `- ${r}`), '')
  lines.push(`STOP-LINE VERDICT: ${verdict.verdict}`, '')
  return { text: lines.join('\n'), verdict: verdict.verdict }
}

/** Every try joins exactly one tail event of the named version. */
export function joinCheck(records, events, version) {
  const join = joinTries(records.filter((r) => r.type === 'try'), events, version)
  return { ok: join.unmatched === 0 && join.duplicates === 0, tries: join.joined.length, unmatched: join.unmatched, duplicates: join.duplicates }
}

// ---------- counts SQL ----------

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

export function countsSql({ since, clientIp }) {
  if (!ISO_INSTANT.test(since ?? '')) throw new Refusal('refused: --since must be a UTC ISO time')
  if (!isIPv4(clientIp ?? '') && !isIPv6(clientIp ?? '')) throw new Refusal('refused: --client-ip must be an IP address')
  const stamp = `'${since}'::timestamptz`
  const count = (from) => `(SELECT count(*) FROM ${from})`
  const fields = {
    auth_users: count('auth.users'),
    auth_sessions: count('auth.sessions'),
    auth_refresh_tokens: count('auth.refresh_tokens'),
    auth_flow_state: count('auth.flow_state'),
    auth_mfa_amr_claims: count('auth.mfa_amr_claims'),
    auth_audit_log_entries: count('auth.audit_log_entries'),
    support_messages: count('public.support_messages'),
    rate_limits: count('public.rate_limits'),
    admin_audit_log: count('public.admin_audit_log'),
    users_stop_line_since: count(`auth.users WHERE email LIKE 'stop-line%' AND created_at >= ${stamp}`),
    support_stop_line_since: count(`public.support_messages WHERE email LIKE 'stop-line%' AND created_at >= ${stamp}`),
    support_limiter_since: count(`public.rate_limits WHERE key LIKE 'support:%' AND created_at >= ${stamp}`),
    support_limiter_this_client_since: count(`public.rate_limits WHERE key = 'support:${clientIp}' AND created_at >= ${stamp}`),
    admin_sessions: count('auth.sessions WHERE user_id = (SELECT admin_user_id FROM public.app_config WHERE id = 1)'),
    admin_audit_since: count(`public.admin_audit_log WHERE created_at >= ${stamp}`),
    app_config_updated_at: '(SELECT updated_at FROM public.app_config WHERE id = 1)',
    feature_flags: '(SELECT feature_flags FROM public.app_config WHERE id = 1)',
  }
  const body = Object.entries(fields).map(([name, sql]) => `  ${sql} AS ${name}`).join(',\n')
  return `SELECT\n${body};\n`
}

// ---------- scans ----------

const TOKEN_SHAPE = /eyJ[A-Za-z0-9_-]{10,}/g
const AUTH_COOKIE_SHAPE = /sb-[A-Za-z0-9-]*-auth-token[.\d]*=/g
const STORED_SESSION_SHAPE = /base64-[A-Za-z0-9_-]{20,}/g

export function countTokenShapes(text) {
  const s = String(text)
  return {
    tokens: (s.match(TOKEN_SHAPE) ?? []).length + (s.match(STORED_SESSION_SHAPE) ?? []).length,
    authCookies: (s.match(AUTH_COOKIE_SHAPE) ?? []).length,
  }
}

export function countIpShapes(text) {
  const s = String(text)
  let v4 = 0
  for (const match of s.matchAll(/(?<![\w.])\d{1,3}(?:\.\d{1,3}){3}(?![\w.])/g)) if (isIPv4(match[0])) v4++
  let v6 = 0
  for (const match of s.matchAll(/(?<![\w:.])[0-9a-fA-F]{0,4}(?::[0-9a-fA-F]{0,4}){2,7}(?![\w:.])/g)) {
    if (match[0] !== '::' && isIPv6(match[0])) v6++
  }
  return { v4, v6 }
}

/** Cookie and authorization headers in tail events whose value is not REDACTED. */
export function countUnredactedHeaders(events) {
  let count = 0
  for (const event of events) {
    const headers = event?.event?.request?.headers ?? {}
    for (const [name, value] of Object.entries(headers)) {
      if (/^(cookie|authorization|set-cookie)$/i.test(name) && value !== 'REDACTED') count++
    }
  }
  return count
}

function filesIn(paths) {
  const out = []
  for (const path of paths) {
    if (statSync(path).isDirectory()) out.push(...filesIn(readdirSync(path).map((name) => join(path, name))))
    else out.push(path)
  }
  return out
}

/** Tokens from every stop-line-admin-*.cookie, counted in logs and tail files. Prints a count only. */
export function leakCount(cookieDir, paths) {
  const secrets = new Set()
  for (const name of readdirSync(cookieDir).filter((n) => /^stop-line-admin-.*\.cookie$/.test(n))) {
    const line = readFileSync(join(cookieDir, name), 'utf8')
    for (const pair of line.trim().split(/;\s*/)) {
      const value = pair.slice(pair.indexOf('=') + 1)
      if (value.length >= 20) secrets.add(value)
    }
    try {
      const { session } = parseCookieLine(line)
      secrets.add(session.access_token)
      secrets.add(session.refresh_token)
    } catch {
      // A file that does not parse still had its raw values added above.
    }
  }
  let count = 0
  for (const file of filesIn(paths)) {
    const text = readFileSync(file, 'utf8')
    for (const secret of secrets) count += text.split(secret).length - 1
  }
  return count
}

// ---------- CLI ----------

const USAGE = `stop-line: ${THRESHOLD_LINE}
  run --base <url> --pass canary|slow|fast --proof <file> (--ids <file> | --get-only) --run <tag>
      [--admin-cookie-file <f>] [--flags-file <f>] [--show-id <id>] [--tail-file <f>]
      [--log-dir <d>] [--kinds a,b] [--resume]
  report --run <tag> --tail-file <f>... [--version <id>] [--proof <f>] [--ids <f>] [--log-dir <d>]
      [--dropped a,b] [--join-check] [--leak-check --cookie-dir <d>]
  counts-sql --since <ISO> --client-ip <ip> --out <file outside the repo>
  scan-logs <path>...       check-tail-headers <file>...
  check-report <file>       check-proof <file>`

export function parseFlags(argv) {
  const out = { positional: [], tailFiles: [] }
  const value = {
    '--base': 'base',
    '--pass': 'pass',
    '--proof': 'proof',
    '--ids': 'ids',
    '--run': 'run',
    '--admin-cookie-file': 'adminCookieFile',
    '--flags-file': 'flagsFile',
    '--show-id': 'showId',
    '--log-dir': 'logDir',
    '--version': 'version',
    '--cookie-dir': 'cookieDir',
    '--since': 'since',
    '--client-ip': 'clientIp',
    '--out': 'out',
  }
  const lists = { '--kinds': 'kinds', '--dropped': 'dropped' }
  const bools = { '--get-only': 'getOnly', '--resume': 'resume', '--join-check': 'joinCheck', '--leak-check': 'leakCheck', '--help': 'help' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Refusal(`${a} needs a value`)
      return v
    }
    if (a in value) out[value[a]] = next()
    else if (a in lists) out[lists[a]] = next().split(',').filter(Boolean)
    else if (a in bools) out[bools[a]] = true
    else if (a === '--tail-file') out.tailFiles.push(next())
    else if (a.startsWith('--')) throw new Refusal(`unknown argument ${a}`)
    else out.positional.push(a)
  }
  out.tailFile = out.tailFiles[0] ?? null
  out.run ??= 'r1'
  out.logDir ??= LOG_DIR_DEFAULT
  return out
}

function runLogPath(args) {
  return join(args.logDir, `run-${args.run}.jsonl`)
}

function readEvents(files) {
  return files.flatMap((file) => parseTailLines(readFileSync(file, 'utf8')).events)
}

async function cmdRun(args, deps) {
  const prepared = prepareRun(args)
  const logPath = runLogPath(args)
  const prior = loadRunLog(logPath)
  if (args.pass !== 'canary' && !args.getOnly && !prior.some((r) => r.type === 'canary-proof')) {
    throw new Refusal('refused: no signup proof yet, run the canary first')
  }
  if (args.pass !== 'canary' && prior.some((r) => r.type === 'stop')) throw new Refusal('refused: this run already stopped')
  const before = process.umask(0o077)
  const log = (record) => appendFileSync(logPath, `${JSON.stringify(record)}\n`, { mode: 0o600 })
  try {
    const result = await runPass(
      {
        pass: args.pass,
        run: args.run,
        base: args.base,
        getOnly: args.getOnly === true,
        resume: args.resume === true,
        prior,
        rscParam: prepared.kinds.includes('admin-page') ? await rscSearchParam() : null,
        ...prepared,
      },
      {
        send: deps.send ?? ((request) => sendHttp(request)),
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log,
        tail: args.tailFile ? new TailWatcher(args.tailFile) : null,
      },
    )
    process.stdout.write(`pass ${args.pass}: exit=${result.exitCode}${result.reason ? ` reason=${result.reason}` : ''}, signup proof ${result.proven ? 'yes' : 'no'}\n`)
    return result.exitCode
  } finally {
    process.umask(before)
  }
}

function cmdReport(args) {
  const records = loadRunLog(runLogPath(args))
  const events = readEvents(args.tailFiles)
  if (args.joinCheck) {
    const check = joinCheck(records, events, args.version)
    process.stdout.write(`join-check: tries ${check.tries}, unmatched ${check.unmatched}, duplicates ${check.duplicates}\n`)
    return check.ok ? 0 : 1
  }
  if (args.leakCheck) {
    if (!args.cookieDir) throw new Refusal('--leak-check needs --cookie-dir')
    const count = leakCount(args.cookieDir, [args.logDir, ...args.tailFiles])
    process.stdout.write(`${count}\n`)
    return count === 0 ? 0 : 1
  }
  const proofSummary = args.proof ? checkProofObject(JSON.parse(readFileSync(args.proof, 'utf8'))) : null
  const idRead = args.ids ? JSON.parse(readFileSync(args.ids, 'utf8')) : null
  const dropped = [...(args.dropped ?? []), ...(proofSummary?.dropped ?? [])]
  const { text } = renderReport({ records, events, version: args.version, dropped, idRead, proofSummary })
  process.stdout.write(text)
  return 0
}

export async function main(argv, deps = {}) {
  const [command, ...rest] = argv
  try {
    const args = parseFlags(rest)
    if (!command || command === '--help' || args.help) {
      process.stdout.write(`${USAGE}\n`)
      return command ? 0 : 2
    }
    if (command === 'run') return await cmdRun(args, deps)
    if (command === 'report') return cmdReport(args)
    if (command === 'counts-sql') {
      if (!args.out) throw new Refusal('refused: --out is required')
      if (isInsideGitWorkTree(args.out)) throw new Refusal('refused: --out is inside a git work tree')
      writeFileSync(args.out, countsSql(args), { mode: 0o600 })
      return 0
    }
    if (command === 'scan-logs') {
      const counts = { tokens: 0, authCookies: 0 }
      for (const file of filesIn(args.positional)) {
        const found = countTokenShapes(readFileSync(file, 'utf8'))
        counts.tokens += found.tokens
        counts.authCookies += found.authCookies
      }
      process.stdout.write(`token shapes: ${counts.tokens}, auth cookie shapes: ${counts.authCookies}\n`)
      return counts.tokens + counts.authCookies === 0 ? 0 : 1
    }
    if (command === 'check-tail-headers') {
      const count = countUnredactedHeaders(readEvents(args.positional))
      process.stdout.write(`cookie headers not redacted: ${count}\n`)
      return count === 0 ? 0 : 1
    }
    if (command === 'check-report') {
      const text = readFileSync(args.positional[0], 'utf8')
      const ip = countIpShapes(text)
      const tokens = countTokenShapes(text)
      process.stdout.write(`IPv4 shapes: ${ip.v4}, IPv6 shapes: ${ip.v6}, token shapes: ${tokens.tokens + tokens.authCookies}\n`)
      return ip.v4 + ip.v6 + tokens.tokens + tokens.authCookies === 0 ? 0 : 1
    }
    if (command === 'check-proof') {
      const { writeFree, dropped } = loadProof(args.positional[0])
      process.stdout.write(`proof ok for ${TARGET_COMMIT}: write-free ${writeFree.join(' ') || 'none'}; dropped ${dropped.join(' ') || 'none'}\n`)
      return 0
    }
    throw new Refusal(`unknown command ${command}\n${USAGE}`)
  } catch (error) {
    if (error instanceof Refusal) {
      process.stderr.write(`${error.message}\n`)
      return command === 'check-proof' ? 1 : 2
    }
    throw error
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2))
}
