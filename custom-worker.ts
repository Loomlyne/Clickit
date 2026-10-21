// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (npm run cf:build)
import { default as handler } from './.open-next/worker.js'
import { runCron } from './src/server/scheduled.ts'

// @ts-ignore generated at build time (npm run cf:build)
export { DOQueueHandler } from './.open-next/worker.js'

type ScheduledEventLike = { cron: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }
type CronEnv = { CRON_SECRET?: string }

export default {
  fetch: handler.fetch,

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
