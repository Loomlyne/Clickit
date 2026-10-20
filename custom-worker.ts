// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (npm run cf:build)
import { default as handler } from './.open-next/worker.js'
import { buildCronRequest } from './src/server/scheduled.ts'

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
  async scheduled(event: ScheduledEventLike, env: CronEnv, ctx: ExecutionContextLike) {
    const request = buildCronRequest(event.cron, env.CRON_SECRET)
    if (request === null) {
      console.error('cron: no route', event.cron)
      return
    }
    const path = new URL(request.url).pathname
    ctx.waitUntil(
      (async () => {
        try {
          const response: Response = await handler.fetch(request, env, ctx)
          if (response.ok) console.log('cron:', path, 'status', response.status)
          else console.error('cron: failed', path, 'status', response.status)
        } catch (err) {
          console.error('cron: threw', path, err instanceof Error ? err.message : 'unknown')
        }
      })(),
    )
  },
}
