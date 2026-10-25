// Per-batch CPU harness of the pre-rendered email consumer path (Phase 5, plan 05-19,
// Task 3; controller condition 4 of the 05-11 revision). A measurement tool, not a test.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/email-batch-cpu.mjs <label>
//
// Runs the real processBatch with the real buildEmailDeps (claim/finish RPC requests,
// Resend mailer request, renderAppEmail fill with signed links, HMAC unsubscribe URL)
// against the canned in-process fetch of src/server/email/cpu-probe.ts, which answers
// only claim, finish and Resend and throws on any other URL, so nothing reaches the
// network. The fixtures are the same five rows the workers.dev probe uses (mixed EN/AR,
// two digests). Only `log` is replaced (no-op). Fixed fake key strings; never reads
// .dev.vars or real secrets (T-05-19-05).
//
// Each run is two fresh processes:
//   1. this process, which first warms up the platform built-ins a Worker already has
//      (Response, Headers, fetch; nothing of ours: no own modules, templates or deps).
//      workerd ships these natively and preloaded, while Node lazy-loads undici the
//      first time one is touched (about 9 ms on the Mac), a cost a Worker never pays
//      inside a queue invocation. These numbers gate (controller decision 2026-10-25).
//   2. a child with --no-warmup, printed as *_nowarm, kept for the record.
// Each process times one cold batch (the first in the process) and the mean of 50 warm
// batches. buildEmailDeps runs inside every timed batch, as in the Worker's queue(), so
// the figures are a slight upper bound. Node on the Mac is not Worker CPU; the real gate
// is the workers.dev cpuTime (handover 05-19-workersdev-cpu.md).

import { spawnSync } from 'node:child_process'
import { loadavg } from 'node:os'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const label = process.argv[2] ?? 'X'
const warm = !process.argv.includes('--no-warmup')
const suffix = warm ? '' : '_nowarm'
const say = (name, value) => console.log(`run${label} ${name}${suffix}: ${value}`)

if (warm) {
  // Platform built-ins only (see header). data: URLs never touch the network.
  const t = performance.now()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  await new Response(JSON.stringify({ warm: true }), { status: 200, headers }).json()
  await (await fetch('data:application/json,{"warm":true}')).json()
  say('warmup_ms', (performance.now() - t).toFixed(2))
}

const t0 = performance.now()
const { processBatch } = await import('../src/server/email/consumer.ts')
const { buildEmailDeps } = await import('../src/server/email/deps.ts')
say('module_load_ms', (performance.now() - t0).toFixed(2))

// Fixtures and the canned fetch (imported after the timed load; consumer and deps are cached).
const { PROBE_ENV, PROBE_FIXTURES, makeProbeFetch, probeRow } = await import('../src/server/email/cpu-probe.ts')

const rows = new Map()
const counter = { sends: 0 }
const fetchStub = makeProbeFetch(rows, counter)
const noop = () => {}

function makeBatch() {
  let acked = 0
  let retried = 0
  const messages = PROBE_FIXTURES.map((_, i) => {
    const id = crypto.randomUUID()
    rows.set(id, probeRow(id, i))
    return {
      body: { outboxId: id },
      attempts: 1,
      ack() {
        acked += 1
      },
      retry() {
        retried += 1
      },
    }
  })
  return { batch: { messages }, counts: () => ({ acked, retried }) }
}

async function runBatch() {
  const { batch, counts } = makeBatch()
  const before = counter.sends
  const start = performance.now()
  await processBatch(batch, { ...buildEmailDeps(PROBE_ENV, fetchStub), log: noop })
  const ms = performance.now() - start
  const sends = counter.sends - before
  const { acked, retried } = counts()
  for (const m of batch.messages) rows.delete(m.body.outboxId)
  if (sends !== 5 || acked !== 5 || retried !== 0) {
    say('error', `sends=${sends} acked=${acked} retried=${retried}`)
    process.exit(1)
  }
  return ms
}

const cold = await runBatch()
say('batch_fill_ms_cold', cold.toFixed(2))

const WARM = 50
let total = 0
for (let i = 0; i < WARM; i++) total += await runBatch()
say('batch_fill_ms_mean', (total / WARM).toFixed(2))

if (warm) {
  // The no-warm-up figure from a fresh child process, after this process measured.
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url), label, '--no-warmup'],
    { encoding: 'utf8' },
  )
  process.stdout.write(child.stdout ?? '')
  if (child.status !== 0) {
    process.stderr.write(child.stderr ?? '')
    say('error', `no-warmup child exit ${child.status}`)
    process.exit(1)
  }
  say('loadavg', loadavg()[0].toFixed(2))
}
