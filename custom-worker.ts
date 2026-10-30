// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (npm run cf:build)
import { default as handler } from './.open-next/worker.js'
import { withRuntimeHeader } from './src/server/runtime-header.ts'
import { runCron } from './src/server/scheduled.ts'
import { processBatch } from './src/server/email/consumer.ts'
import { buildEmailDeps } from './src/server/email/deps.ts'
import { takeEmailCpuProbe } from './src/server/email/cpu-probe.ts'

// @ts-ignore generated at build time (npm run cf:build)
export { DOQueueHandler } from './.open-next/worker.js'

type ScheduledEventLike = { cron: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }
type CronEnv = { CRON_SECRET?: string }
// Same shapes as the handler's own fetch signature; the handler is generated at build time.
type FetchEnv = Record<string, unknown>
// Structural Queue shapes (Cloudflare MessageBatch / Message), like the Scheduled types.
type MessageLike = {
  body: unknown
  attempts?: number
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}
type MessageBatchLike = { queue?: string; messages: MessageLike[] }
type EmailEnv = Parameters<typeof buildEmailDeps>[0] & { EMAIL_CPU_PROBE?: string }

export default {
  // Every response carries x-clickit-runtime: workers (DNS-02 proof: tells a
  // Worker answer from a proxied answer of the old host). Pure copy, streams kept.
  async fetch(request: Request, env: FetchEnv, ctx: ExecutionContextLike) {
    return withRuntimeHeader(await handler.fetch(request, env, ctx))
  },

  // Email queue consumer (D-28, D-38): queue clickit-email, batches of 5. Messages
  // carry only { outboxId }; processBatch claims the rows, fills the pre-rendered
  // templates (05-11, no React), sends through Resend and writes every outcome
  // before acking. Errors propagate on purpose: a throw from claim or finish fails
  // the invocation, nothing is acked, and the queue redelivers the batch.
  // Messages tagged as CPU probes (05-19 workers.dev measurement) are taken out first:
  // acked and dropped unless EMAIL_CPU_PROBE holds a short until: window, and even
  // then answered in-process (no DB, no network, no email). See cpu-probe.ts.
  async queue(batch: MessageBatchLike, env: EmailEnv) {
    const rest = await takeEmailCpuProbe(batch, env.EMAIL_CPU_PROBE)
    if (rest.messages.length === 0) return
    await processBatch(rest, buildEmailDeps({ ...env, CLICKIT_RUNTIME: 'workers' }))
  },

  // Cron Triggers are OFF until the Phase 3 cutover (wrangler.jsonc keeps
  // "crons": []). The handler is live so `wrangler dev --test-scheduled` and
  // the cutover only need the trigger list. The call stays in-process: the
  // mapped /api/cron/* route authenticates with CRON_SECRET like any request.
  // runCron is awaited (no waitUntil): it rejects on no route, a non-OK status
  // or a throw, so the invocation fails and the cron status shows it.
  async scheduled(event: ScheduledEventLike, env: CronEnv, ctx: ExecutionContextLike) {
    await runCron(event.cron, env.CRON_SECRET, (request) => handler.fetch(request, env, ctx))
  },
}
