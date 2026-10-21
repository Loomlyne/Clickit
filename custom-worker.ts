// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (scripts/cf/build-target.mjs); unique per build
import buildStamp from './.open-next/clickit-build-stamp.json'
import { runCron } from './src/server/scheduled.ts'
import { serveWithAnonHtmlCache, type EdgeCacheLike, type R2BucketLike } from './src/server/anon-html-cache.ts'

// Same class OpenNext's worker.js re-exports; imported from its own file so this
// entry does not pull worker.js (and the proxy bundle) in at startup.
// @ts-ignore generated at build time (npm run cf:build)
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js'

type ScheduledEventLike = { cron: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }
type CronEnv = { CRON_SECRET?: string }
type FetchEnv = { NEXT_INC_CACHE_R2_BUCKET?: R2BucketLike }

type OpenNextHandler = { fetch(request: Request, env: unknown, ctx: ExecutionContextLike): Promise<Response> }

// OpenNext's handler (proxy + Next server) loads on the first miss, not at
// startup: a cache hit in a fresh isolate never evaluates it.
let openNext: Promise<OpenNextHandler> | null = null
function loadOpenNext(): Promise<OpenNextHandler> {
  // @ts-ignore generated at build time (npm run cf:build)
  openNext ??= import('./.open-next/worker.js').then((m: { default: OpenNextHandler }) => m.default)
  return openNext
}

const stamp = (buildStamp ?? {}) as { gitSha?: string; createdAt?: string }
const BUILD_VERSION = stamp.gitSha && stamp.createdAt ? `${stamp.gitSha.slice(0, 12)}-${stamp.createdAt}` : ''

export default {
  // Signed-out GETs of the public landing pages come from the anonymous HTML
  // cache (src/server/anon-html-cache.ts): a hit never loads the proxy or the
  // Next server, which is what costs CPU on Workers Free. Everything else, and
  // every miss, goes to OpenNext unchanged.
  fetch(request: Request, env: FetchEnv, ctx: ExecutionContextLike) {
    const edge = (globalThis as { caches?: { default?: EdgeCacheLike } }).caches?.default ?? null
    return serveWithAnonHtmlCache(
      request,
      {
        edge,
        r2: env.NEXT_INC_CACHE_R2_BUCKET ?? null,
        version: BUILD_VERSION,
        now: () => Date.now(),
        waitUntil: (promise) => ctx.waitUntil(promise),
      },
      async () => (await loadOpenNext()).fetch(request, env, ctx),
    )
  },

  // Cron Triggers are OFF until the Phase 3 cutover (wrangler.jsonc keeps
  // "crons": []). The handler is live so `wrangler dev --test-scheduled` and
  // the cutover only need the trigger list. The call stays in-process: the
  // mapped /api/cron/* route authenticates with CRON_SECRET like any request.
  // runCron is awaited (no waitUntil): it rejects on no route, a non-OK status
  // or a throw, so the invocation fails and the cron status shows it.
  async scheduled(event: ScheduledEventLike, env: CronEnv, ctx: ExecutionContextLike) {
    const handler = await loadOpenNext()
    await runCron(event.cron, env.CRON_SECRET, (request) => handler.fetch(request, env, ctx))
  },
}
