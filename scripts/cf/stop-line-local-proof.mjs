// Local write-free proof for the stop line (plan 02.1-01, Task 3). Loopback only: it refuses any
// other base or Supabase URL. It runs each request kind against a local preview of 787ca3a's code
// on the local stack, around pg_stat_user_tables and row-count snapshots, and writes local-proof.json.
//
// A positive control comes first: a real save must move the detector, or the proof is invalid.
// A kind is write-free only if its replies equal the expected object and no insert, update or
// delete count moved. An unexplained delta marks it dropped; it never gets argued away.
//
// Keys come from the environment (SB_URL, SB_ANON, SB_SERVICE) and are never printed.
// Exit: 0 written; 1 the proof is invalid or a step failed; 2 refused.
//
// The preview answers on http://localhost:<port> and builds its redirects from that host, so that
// is the base to call. It keeps worker logs in its local observability store rather than printing
// them, so log evidence is read from there, per try, by each request's sl tag.
//
// Usage: node scripts/cf/stop-line-local-proof.mjs --base http://localhost:8796 --env-file <f>
//          --manifest <.next/server/server-reference-manifest.json>
//          --work-dir <dir outside the repo> --out <local-proof.json>

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { readActionIds } from './action-ids.mjs'
import {
  EXPECTED_RESULT,
  FLAG_NAMES,
  KINDS,
  KIND_INFO,
  TARGET_COMMIT,
  adminPageList,
  buildRequest,
  classifyReply,
  fixtureMatches,
  makeTag,
  parseFlightResult,
  rscSearchParam,
  sendHttp,
} from './stop-line.mjs'

const DB_CONTAINER = 'supabase_db_Clickit'
const THROWAWAY_EMAIL = 'stop-line-local-admin@example.test'
const DEFAULT_SETTLE_MS = 15_000
const COOKIE_SCRIPT = fileURLToPath(new URL('./make-session-cookie.mjs', import.meta.url))
export const ROW_TABLES = Object.freeze([
  'auth.users',
  'auth.sessions',
  'auth.refresh_tokens',
  'auth.flow_state',
  'auth.mfa_amr_claims',
  'auth.audit_log_entries',
  'public.support_messages',
  'public.rate_limits',
  'public.admin_audit_log',
])
export const FLOW_STATE_TERM = /flow[_ ]state/i
export const LOCAL_GAPS = Object.freeze([
  "The local stack's schema is newer than live (Phase 5 migrations).",
  'Local log forms come from the preview log store; the live tail form is compared at the canary.',
  'The save path stops at the conflict.',
  'The local GoTrue version and limits may differ from live.',
])

export function isLoopback(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  } catch {
    return false
  }
}

/** "schema.table|ins|upd|del" lines -> Map. */
export function parseStatLines(text) {
  const out = new Map()
  for (const line of String(text).split('\n')) {
    const [table, ins, upd, del] = line.split('|')
    if (table && del !== undefined) out.set(table, { ins: Number(ins), upd: Number(upd), del: Number(del) })
  }
  return out
}

/** Tables whose counters moved between two snapshots, as [{ table, ins, upd, del }]. */
export function diffStats(before, after) {
  const moved = []
  for (const [table, end] of after) {
    const start = before.get(table) ?? { ins: 0, upd: 0, del: 0 }
    const delta = { table, ins: end.ins - start.ins, upd: end.upd - start.upd, del: end.del - start.del }
    if (delta.ins !== 0 || delta.upd !== 0 || delta.del !== 0) moved.push(delta)
  }
  return moved.sort((a, b) => a.table.localeCompare(b.table))
}

export function diffRows(before, after) {
  const moved = {}
  for (const table of Object.keys(after)) {
    const delta = after[table] - (before[table] ?? 0)
    if (delta !== 0) moved[table] = delta
  }
  return moved
}

/** Keep only what moved in both tries, for a stack another session may have touched. */
export function intersectMoves(first, second) {
  const tables = new Set(second.map((d) => d.table))
  return first.filter((d) => tables.has(d.table))
}

/** The part of a request's logs a sign-in link failure wrote, cut to a short line. */
export function signinLinkFormFrom(logText) {
  const at = logText.indexOf('exchangeCodeForSession failed')
  if (at === -1) return null
  const form = logText.slice(at, at + 400).split('\n').slice(0, 8).join(' ').replace(/\s+/g, ' ').trim()
  const match = FLOW_STATE_TERM.exec(form)
  return { form, term: match ? match[0] : null }
}

/** A same-origin redirect is stored relative; any other host stays absolute and fails the check. */
export function relativeLocation(location, base) {
  if (typeof location !== 'string') return null
  const origin = new URL(base).origin
  return location.startsWith(`${origin}/`) ? location.slice(origin.length) : location
}

export function replyFixture(kind, reply, base) {
  if (KIND_INFO[kind].action) return { status: reply.status, result: parseFlightResult(reply.body).value ?? null }
  if (kind === 'signin-link') return { status: reply.status, location: relativeLocation(reply.location, base) }
  return { status: reply.status, contentType: reply.contentType ?? null, rsc: reply.rsc === true }
}

function psql(sql) {
  const res = spawnSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
  if (res.status !== 0) throw new Error(`psql failed (${res.status})`)
  return res.stdout.trim()
}

function statSnapshot() {
  return parseStatLines(psql("select schemaname||'.'||relname, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_user_tables order by 1"))
}

function rowSnapshot() {
  const out = {}
  for (const table of ROW_TABLES) out[table] = Number(psql(`select count(*) from ${table}`))
  return out
}

function snapshot() {
  return { stats: statSnapshot(), rows: rowSnapshot() }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function progress(line) {
  process.stdout.write(`${new Date().toISOString()} ${line}\n`)
}

function parseArgs(argv) {
  const map = { '--base': 'base', '--env-file': 'envFile', '--manifest': 'manifest', '--work-dir': 'workDir', '--out': 'out', '--settle-ms': 'settleMs' }
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = map[argv[i]]
    if (!key || argv[i + 1] === undefined) throw new Error(`bad argument ${argv[i]}`)
    out[key] = argv[i + 1]
  }
  return out
}

function cookieScript(args, { password } = {}) {
  const res = spawnSync(process.execPath, [COOKIE_SCRIPT, ...args], { encoding: 'utf8', input: password === undefined ? undefined : `${password}\n` })
  return { code: res.status, stdout: res.stdout.trim(), stderr: res.stderr.trim() }
}

/** Every log message of the invocation that carried this sl tag. */
async function logsForTag(base, tag) {
  if (!/^[a-z0-9-]+$/.test(tag)) throw new Error('bad tag')
  const sql = `select message from logs where trace_id in (select trace_id from logs where message like '%sl=${tag}"%') order by ts_ms, seq`
  const res = await fetch(`${base}/cdn-cgi/local/explorer/api/local/observability/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sql }),
  })
  if (!res.ok) throw new Error(`log store read failed: ${res.status}`)
  const { result } = await res.json()
  return result.rows.map((row) => row[0]).join('\n')
}

async function restJson(url, serviceKey) {
  const res = await fetch(url, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } })
  if (!res.ok) throw new Error(`REST read failed: ${res.status}`)
  return res.json()
}

export async function runProof(opts, env) {
  const settleMs = Number(opts.settleMs ?? DEFAULT_SETTLE_MS)
  const { SB_URL: sbUrl, SB_SERVICE: serviceKey } = env
  const admin = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }
  const cookie1 = join(opts.workDir, 'local-admin-1.cookie')
  const cookie2 = join(opts.workDir, 'local-admin-2.cookie')
  const password = randomBytes(18).toString('base64url')
  const run = 'lp'
  let tagN = 0
  const nextTag = (code) => makeTag(run, code, ++tagN)

  const measure = async (action) => {
    const before = snapshot()
    const result = await action()
    await sleep(settleMs)
    const after = snapshot()
    return { result, tables: diffStats(before.stats, after.stats), rows: diffRows(before.rows, after.rows) }
  }

  const savedAdmin = psql('select admin_user_id from public.app_config where id = 1')
  const proof = { commit: TARGET_COMMIT, generatedAt: null, kinds: [], gaps: [...LOCAL_GAPS] }
  let userId = null

  try {
    // Step 2: a throwaway admin, restored in finally.
    const created = await fetch(`${sbUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ email: THROWAWAY_EMAIL, password, email_confirm: true }),
    })
    const user = await created.json().catch(() => ({}))
    if (!created.ok || !user.id) throw new Error(`admin user create failed: ${created.status}`)
    userId = user.id
    psql(`update public.app_config set admin_user_id = '${userId}' where id = 1`)
    progress('throwaway admin ready')

    // Control: what moves when nothing is sent. Table stats arrive late, so the setup writes above
    // settle first; otherwise they land in this window.
    await sleep(settleMs)
    const idle = await measure(async () => null)
    proof.idleControl = { tables: idle.tables, rows: idle.rows }
    progress(`idle control: ${idle.tables.length} tables moved`)
    const appTable = (table) => table.startsWith('public.') || table.startsWith('auth.')
    const movedApp = idle.tables.filter((d) => appTable(d.table))
    if (movedApp.length > 0) throw new Error(`the stack is not quiet: ${JSON.stringify(movedApp)} moved with nothing sent`)
    const noise = new Set(idle.tables.map((d) => d.table))
    const withoutNoise = (tables) => tables.filter((d) => !noise.has(d.table))

    // Step 3: sign-in writes.
    const signIn = (out) => cookieScript(['--env-file', opts.envFile, '--email', THROWAWAY_EMAIL, '--out', out, '--password-stdin'], { password })
    const signInMeasure = await measure(async () => signIn(cookie1))
    if (signInMeasure.result.code !== 0) throw new Error(`sign-in failed: ${signInMeasure.result.stderr}`)
    if (!/admin: yes$/.test(signInMeasure.result.stdout)) throw new Error('sign-in did not report admin: yes')
    proof.signIn = { output: signInMeasure.result.stdout.replace(/\(\d+ bytes, /, '(N bytes, ') }
    proof.signInWrites = withoutNoise(signInMeasure.tables)
    proof.signInRowDeltas = signInMeasure.rows
    const check = cookieScript(['--check', cookie1])
    if (!/^mode 600,/.test(check.stdout)) throw new Error(`--check did not show mode 600: ${check.stdout}`)
    proof.signIn.check = 'mode 600'
    const adminCookie = readFileSync(cookie1, 'utf8').trim()
    const withCookie = await sendHttp({ method: 'GET', url: `${opts.base}/en/admin`, headers: { cookie: adminCookie } })
    const withoutCookie = await sendHttp({ method: 'GET', url: `${opts.base}/en/admin`, headers: {} })
    proof.adminGate = { withCookie: withCookie.status, withoutCookie: withoutCookie.status }
    if (withCookie.status !== 200 || withoutCookie.status < 300 || withoutCookie.status >= 400) {
      throw new Error(`admin gate: with cookie ${withCookie.status}, without ${withoutCookie.status}`)
    }
    progress(`sign-in measured: ${proof.signInWrites.map((d) => d.table).join(' ')}`)

    // Step 4: action ids from the chunks, compared with the same build's manifest.
    const read = await readActionIds({ base: opts.base, pages: ['/en/auth', '/en/support'], adminPages: ['/en/admin/settings'], adminCookie, runTag: 'lpid' })
    if (read.exitCode !== 0) throw new Error(`NEEDS CONTROLLER: action ids not readable (exit ${read.exitCode})`)
    const manifest = JSON.parse(readFileSync(opts.manifest, 'utf8'))
    const entries = { ...(manifest.node ?? {}), ...(manifest.edge ?? {}) }
    const ids = {}
    proof.actionPages = {}
    for (const [name, entry] of Object.entries(read.names)) {
      const inManifest = entries[entry.id]
      if (!inManifest) throw new Error(`NEEDS CONTROLLER: ${name} id from the chunks is not in the manifest`)
      if (inManifest.exportedName && inManifest.exportedName !== name) throw new Error(`NEEDS CONTROLLER: ${name} id is bound to another name in the manifest`)
      ids[name] = entry.id
      proof.actionPages[name] = Object.keys(inManifest.workers ?? {})
    }
    progress('action ids match the manifest')

    const [configRow] = await restJson(`${sbUrl}/rest/v1/app_config?id=eq.1&select=updated_at,feature_flags`, serviceKey)
    const flags = Object.fromEntries(FLAG_NAMES.map((name) => [name, configRow.feature_flags?.[name] === true]))
    proof.localComingSoon = flags.comingSoonMode
    const showId = psql('select id from public.shows where archived is not true limit 1')
    if (!showId) throw new Error('no local show row for the admin show page')
    const rscParam = await rscSearchParam()
    const base = { base: opts.base, ids, flags, showId, adminCookie, rscParam }

    // Step 5: positive control. A real save with the row's real updated_at must move the detector.
    const control = await measure(async () => {
      const request = buildRequest('admin-save', { ...base, tag: nextTag('as'), expectedUpdatedAt: configRow.updated_at })
      return sendHttp(request)
    })
    const controlResult = parseFlightResult(control.result.body ?? '').value
    const moved = (table, field) => control.tables.find((d) => d.table === table)?.[field] ?? 0
    proof.positiveControl = {
      replySuccess: controlResult?.success === true,
      appConfigUpdates: moved('public.app_config', 'upd'),
      auditInserts: moved('public.admin_audit_log', 'ins'),
    }
    proof.positiveControl.moved = proof.positiveControl.replySuccess && proof.positiveControl.appConfigUpdates >= 1 && proof.positiveControl.auditInserts >= 1
    if (!proof.positiveControl.moved) throw new Error(`the detector did not move: ${JSON.stringify(proof.positiveControl)}`)
    progress(`positive control moved: ${JSON.stringify(proof.positiveControl)}`)

    // Step 6: each kind, 5 tries (admin-page 6, to cover every page in its rotation).
    for (const kind of KINDS) {
      const tries = kind === 'admin-page' ? adminPageList(showId).length : 5
      const once = async () => {
        const tags = []
        const measured = await measure(async () => {
          const fixtures = []
          let allExpected = true
          for (let i = 0; i < tries; i++) {
            const tag = nextTag(KIND_INFO[kind].code)
            tags.push(tag)
            const request = buildRequest(kind, { ...base, tag, adminIndex: i })
            const reply = await sendHttp(request)
            fixtures.push(replyFixture(kind, reply, opts.base))
            if (classifyReply(kind, reply, opts.base).outcome !== 'pass') allExpected = false
          }
          return { fixtures, allExpected }
        })
        const logs = []
        for (const tag of tags) logs.push(await logsForTag(opts.base, tag))
        return { ...measured, logs }
      }
      let attempt = await once()
      let tables = withoutNoise(attempt.tables)
      let rows = attempt.rows
      let repeated = false
      if (tables.length > 0 || Object.keys(rows).length > 0) {
        repeated = true
        const second = await once()
        tables = intersectMoves(tables, withoutNoise(second.tables))
        rows = Object.fromEntries(Object.entries(rows).filter(([table]) => table in second.rows))
        attempt = second
      }
      const entry = { kind, tries, repeated, deltas: { tables, rows }, replies: attempt.result.fixtures }
      const reasons = []
      if (tables.length > 0 || Object.keys(rows).length > 0) reasons.push('a write moved')
      if (!attempt.result.allExpected) reasons.push('a reply was not the expected one')
      if (!attempt.result.fixtures.every((fixture) => fixtureMatches(kind, fixture, opts.base))) reasons.push('a recorded reply differs')
      if (kind === 'contact') {
        entry.triesWithMissingToken = attempt.logs.filter((log) => log.includes('missing-token')).length
        if (entry.triesWithMissingToken < tries) reasons.push('the log does not show missing-token for every try')
      }
      if (kind === 'signin-action') {
        entry.triesWithInvalidCredentials = attempt.logs.filter((log) => log.includes('Invalid login credentials')).length
        if (entry.triesWithInvalidCredentials < tries) reasons.push('the log does not show Invalid login credentials for every try')
      }
      if (kind === 'signin-link') {
        const forms = attempt.logs.map(signinLinkFormFrom)
        entry.triesWithFlowState = forms.filter((form) => form?.term).length
        proof.signinLinkForm = forms.find((form) => form) ?? null
        if (entry.triesWithFlowState < tries) reasons.push('the log form is not the flow-state family on every try')
      }
      entry.verdict = reasons.length === 0 ? 'write-free' : 'dropped'
      if (reasons.length > 0) entry.dropReasons = reasons
      proof.kinds.push(entry)
      progress(`${kind}: ${entry.verdict}${reasons.length ? ` (${reasons.join('; ')})` : ''}`)
    }

    // Step 7: sign-out writes, plain and through the refresh path.
    const sessions = () => Number(psql(`select count(*) from auth.sessions where user_id = '${userId}'`))
    const signOut = await measure(async () => cookieScript(['--env-file', opts.envFile, '--sign-out', cookie1]))
    if (signOut.result.code !== 0 || signOut.result.stdout !== 'signed out') throw new Error(`sign-out: ${signOut.result.stdout}`)
    proof.signOutWrites = withoutNoise(signOut.tables)
    proof.signOutRowDeltas = signOut.rows
    const sessionsAfterSignOut = sessions()
    const second = signIn(cookie2)
    if (second.code !== 0) throw new Error(`second sign-in failed: ${second.stderr}`)
    await sleep(settleMs)
    const refreshed = await measure(async () => cookieScript(['--env-file', opts.envFile, '--sign-out', cookie2, '--force-refresh-first']))
    if (refreshed.result.code !== 0 || refreshed.result.stdout !== 'signed out (refreshed first)') throw new Error(`refresh sign-out: ${refreshed.result.stdout}`)
    proof.signOutExpiredWrites = withoutNoise(refreshed.tables)
    proof.signOutExpiredRowDeltas = refreshed.rows
    proof.sessionsAfterSignOut = { plain: sessionsAfterSignOut, refreshed: sessions() }
    if (proof.sessionsAfterSignOut.plain !== 0 || proof.sessionsAfterSignOut.refreshed !== 0) throw new Error('a local session row survived sign-out')
    progress('sign-out measured')

    proof.expected = EXPECTED_RESULT
    proof.generatedAt = new Date().toISOString()
    writeFileSync(opts.out, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 })
    progress(`proof written: ${proof.kinds.map((k) => `${k.kind}:${k.verdict}`).join(' ')}`)
    return 0
  } finally {
    if (savedAdmin) psql(`update public.app_config set admin_user_id = '${savedAdmin}' where id = 1`)
    else psql('update public.app_config set admin_user_id = null where id = 1')
    if (userId) {
      const res = await fetch(`${sbUrl}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })
      progress(`throwaway user delete: ${res.status}`)
    }
    rmSync(cookie1, { force: true })
    rmSync(cookie2, { force: true })
    progress(`restored admin_user_id: ${psql('select admin_user_id from public.app_config where id = 1') === savedAdmin}`)
  }
}

async function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    return 2
  }
  const env = { SB_URL: process.env.SB_URL, SB_SERVICE: process.env.SB_SERVICE }
  if (!isLoopback(opts.base) || !isLoopback(env.SB_URL)) {
    process.stderr.write('refused: this proof runs on loopback only\n')
    return 2
  }
  if (!env.SB_SERVICE || !opts.envFile || !opts.manifest || !opts.workDir || !opts.out) {
    process.stderr.write('refused: missing an argument or SB_SERVICE\n')
    return 2
  }
  try {
    return await runProof(opts, env)
  } catch (error) {
    process.stdout.write(`proof failed: ${error?.message ?? error?.name}\n`)
    return 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2))
}
