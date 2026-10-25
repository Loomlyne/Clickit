// Test-only producer for the workers.dev email CPU probe (Phase 5, plan 05-19,
// controller condition 2; runbook .planning/handovers/05-19-workersdev-cpu.md).
// The controller runs it; it refuses without --confirm-workersdev-probe.
//
//   HOME=/Users/koss/.clickit-cloudflare node --experimental-strip-types \
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/email-cpu-probe-send.mjs --confirm-workersdev-probe [--run <id>]
//
// Pushes ONE batch of five probe messages ({ probe, run, fixture, outboxId }, random ids
// that exist in no database) to queue clickit-email through the Cloudflare Queues HTTP
// push API (POST /accounts/:id/queues/:queue_id/messages/batch). The OAuth token comes
// from `wrangler auth token --json` under the pinned ClickitStory login and stays in
// memory: it is never printed, logged or written. Output is status codes and counts only.
// The Worker answers probe messages in-process (src/server/email/cpu-probe.ts): no DB,
// no network, no email; with EMAIL_CPU_PROBE unset they are acked and dropped.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { CLICKIT_ACCOUNT_ID, CLICKIT_HOME, checkEnv, wranglerChildEnv } from './cf/wrangler-guard.mjs'
import { PROBE_FIXTURES, PROBE_TAG } from '../src/server/email/cpu-probe.ts'

export const PROBE_QUEUE = 'clickit-email'
export const CONFIRM_FLAG = '--confirm-workersdev-probe'
const API = `https://api.cloudflare.com/client/v4/accounts/${CLICKIT_ACCOUNT_ID}`
const RUN_RE = /^[A-Za-z0-9-]{1,40}$/

/**
 * Names only in the reasons, never values.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, reasons: string[], run: string }}
 */
export function checkSendArgs(argv, env, now = Date.now()) {
  const reasons = []
  if (!argv.includes(CONFIRM_FLAG)) reasons.push(`${CONFIRM_FLAG} missing`)
  if (env.HOME !== CLICKIT_HOME) reasons.push(`HOME must be ${CLICKIT_HOME}`)
  const envCheck = checkEnv(env, 'remote')
  if (!envCheck.ok) reasons.push(envCheck.reason)
  const i = argv.indexOf('--run')
  const run = i >= 0 ? (argv[i + 1] ?? '') : `p${now.toString(36)}`
  if (!RUN_RE.test(run)) reasons.push('--run must be 1-40 letters, digits or dashes')
  return { ok: reasons.length === 0, reasons, run }
}

/** One message per fixture, JSON content type, fresh random ids. */
export function buildProbeMessages(run, uuid = () => crypto.randomUUID()) {
  return PROBE_FIXTURES.map((_, fixture) => ({
    body: { probe: PROBE_TAG, run, fixture, outboxId: uuid() },
    content_type: 'json',
  }))
}

function oauthToken() {
  const res = spawnSync('npx', ['wrangler@4', 'auth', 'token', '--json'], {
    env: wranglerChildEnv(process.env),
    encoding: 'utf8',
  })
  if (res.status !== 0) throw new Error(`wrangler auth token failed (exit ${res.status})`)
  let parsed
  try {
    parsed = JSON.parse(res.stdout)
  } catch {
    // Never echo the output: it may hold the token.
    throw new Error('wrangler auth token output is not JSON')
  }
  if (parsed?.type !== 'oauth' || typeof parsed.token !== 'string') throw new Error('no OAuth token from the pinned login')
  return parsed.token
}

async function api(token, path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success !== true) {
    const codes = Array.isArray(body?.errors) ? body.errors.map((e) => e?.code).join(',') : '-'
    throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]}: http ${response.status} codes=${codes}`)
  }
  return body.result
}

async function main(argv) {
  const check = checkSendArgs(argv, process.env)
  if (!check.ok) {
    for (const reason of check.reasons) console.error(`refused: ${reason}`)
    return 1
  }
  const token = oauthToken()
  const queues = await api(token, '/queues?per_page=100')
  const queue = Array.isArray(queues) ? queues.find((q) => q?.queue_name === PROBE_QUEUE) : undefined
  if (!queue?.queue_id) {
    console.error(`refused: queue ${PROBE_QUEUE} not found (create it first, 05-35)`)
    return 1
  }
  const messages = buildProbeMessages(check.run)
  await api(token, `/queues/${queue.queue_id}/messages/batch`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
  console.log(`sent probe batch queue=${PROBE_QUEUE} run=${check.run} n=${messages.length} at=${new Date().toISOString()}`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      process.exit(1)
    },
  )
}
