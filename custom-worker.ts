// Worker entry. Source: opennext.js.org/cloudflare/howtos/custom-worker
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore generated at build time (scripts/cf/build-target.mjs); unique per build
import buildStamp from './.open-next/clickit-build-stamp.json'
// @ts-ignore generated at build time (scripts/cf/build-target.mjs); public values only
import gatewayConfig from './.open-next/clickit-gateway-config.json'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { runCron } from './src/server/scheduled.ts'
import { serveWithAnonHtmlCache, type EdgeCacheLike, type R2BucketLike } from './src/server/anon-html-cache.ts'
import { createSessionVerifier, type Jwks, type SessionVerdict } from './src/server/gateway/session.ts'
import {
  SPIKE_TAG,
  burnCpu,
  parseIterations,
  parseProbePath,
  probeCacheKey,
  probeCacheResponse,
  rewriteForProbe,
  stripForProbe,
} from './src/server/spike-probe.ts'

// Same class OpenNext's worker.js re-exports; imported from its own file so this
// entry does not pull worker.js (and the proxy bundle) in at startup.
// @ts-ignore generated at build time (npm run cf:build)
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js'

type ScheduledEventLike = { cron: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }
type CronEnv = { CRON_SECRET?: string }
type FetchEnv = { NEXT_INC_CACHE_R2_BUCKET?: R2BucketLike; CLICKIT_SPIKE?: string }

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

// ---------------------------------------------------------------------------
// Phase 02.1 spike probes (plan 02.1-01, D-03 a-e, D-66). THROWAWAY: plan
// 02.1-06 deletes SpikeProbe, spikeProbeFetch and the CLICKIT_SPIKE var. They
// answer only under /spike-probe/* and only when CLICKIT_SPIKE is exactly
// "on"; every other path keeps the prototype path below unchanged.
// ---------------------------------------------------------------------------

type SpikeCacheResult = { success?: boolean; errors?: unknown[] } | undefined
type SpikeCacheContext = {
  invalidate(opts: { tags: string[] }): Promise<SpikeCacheResult>
  purge(opts: { tags: string[] }): Promise<SpikeCacheResult>
}
type SpikeProbeStub = { fetch(request: Request, init?: { cf?: { cacheKey?: string } }): Promise<Response> }
type SpikeCtx = ExecutionContextLike & { exports?: { SpikeProbe?: SpikeProbeStub } }
type GatewayConfig = { supabaseUrl: string; authCookieName: string; jwksUrl: string }

const gateway = (gatewayConfig ?? {}) as GatewayConfig

async function fetchJwks(url: string): Promise<Jwks> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`jwks ${res.status}`)
  return (await res.json()) as Jwks
}

// One verifier per isolate: the JWKS and imported keys are cached across requests.
const sessionVerifier = createSessionVerifier({ jwksUrl: gateway.jwksUrl, fetchJwks })

function spikeTagsOk(opts: { tags?: unknown } | undefined): boolean {
  return Array.isArray(opts?.tags) && opts.tags.length === 1 && opts.tags[0] === SPIKE_TAG
}

/** Plain JSON copy so the RPC result is always structured-cloneable. */
function plain(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value))
}

/**
 * Cached probe entrypoint (Workers Cache on, wrangler.jsonc exports). Reached
 * only through ctx.exports from the default entrypoint: a non-default
 * entrypoint has no public route. RPC methods are never cached and run here,
 * which scopes ctx.cache to this entrypoint's entries (research F1).
 */
export class SpikeProbe extends WorkerEntrypoint {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const probe = parseProbePath(url.pathname)
    const name = probe.kind === 'cache' ? probe.rest : ''
    return probeCacheResponse(name, {
      stamp: new Date().toISOString(),
      burnIterations: parseIterations(url.searchParams.get('burn')),
    })
  }

  async invalidate(opts: { tags: string[] }) {
    return this.cacheCall('invalidate', opts)
  }

  async purge(opts: { tags: string[] }) {
    return this.cacheCall('purge', opts)
  }

  private async cacheCall(kind: 'invalidate' | 'purge', opts: { tags: string[] }) {
    if (!spikeTagsOk(opts)) return { available: false, result: { refused: `only the tag ${SPIKE_TAG}` } }
    // Local workerd has no ctx.cache: report it instead of throwing.
    const cache = (this.ctx as unknown as { cache?: SpikeCacheContext }).cache
    if (!cache || typeof cache[kind] !== 'function') return { available: false, result: null }
    try {
      return { available: true, result: plain(await cache[kind]({ tags: [SPIKE_TAG] })) }
    } catch (error) {
      return { available: true, result: { threw: error instanceof Error ? error.message : String(error) } }
    }
  }
}

async function spikeProbeFetch(request: Request, env: FetchEnv, ctx: SpikeCtx, url: URL): Promise<Response> {
  const probe = parseProbePath(url.pathname)

  if (probe.kind === 'cache') {
    // Optional gateway-side burn (assumption A3: per-invocation or summed CPU limit).
    const gwIterations = parseIterations(url.searchParams.get('gwburn'))
    const gwResult = gwIterations > 0 ? burnCpu(gwIterations) : 0
    if (!ctx.exports?.SpikeProbe) {
      return new Response('ctx.exports.SpikeProbe unavailable', { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    // Query not in the key: plain?v=2 must share the plain entry. ?k=<token> gives its own entry.
    const cacheKey = probeCacheKey(probe.rest, url.searchParams.get('k'))
    const res = await ctx.exports.SpikeProbe.fetch(request, { cf: { cacheKey } })
    const out = new Response(res.body, res)
    out.headers.set('x-spike-cache-status', res.headers.get('cf-cache-status') ?? 'absent')
    out.headers.set('x-spike-cache-key', cacheKey)
    if (gwIterations > 0) out.headers.set('x-spike-gwburn', `${gwIterations}:${gwResult}`)
    return out
  }

  if (probe.kind === 'gw') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('GET or HEAD only', { status: 405, headers: { 'Cache-Control': 'no-store' } })
    }
    // x-spike-now (ms) may replace the clock for the expired-token case only;
    // it gets its own verifier so the isolate's shared clock is never changed.
    const nowHeader = request.headers.get('x-spike-now')
    const fixedNow = nowHeader && /^\d{1,15}$/.test(nowHeader) ? Number(nowHeader) : null
    const verifier =
      fixedNow === null ? sessionVerifier : createSessionVerifier({ jwksUrl: gateway.jwksUrl, fetchJwks, now: () => fixedNow })
    let verdict: SessionVerdict
    if (!gateway.authCookieName || !gateway.jwksUrl) verdict = { cls: 'bypass', reason: 'no-gateway-config' }
    else verdict = await verifier.classify(request.headers.get('cookie'), gateway.authCookieName)
    const forwarded = verdict.cls === 'bypass' ? rewriteForProbe(request) : stripForProbe(request)
    const res = await (await loadOpenNext()).fetch(forwarded, env, ctx)
    const out = new Response(res.body, res)
    out.headers.set('x-spike-class', verdict.cls)
    out.headers.set('x-spike-reason', verdict.reason)
    return out
  }

  // The Next probe pages: straight to OpenNext, skipping the prototype.
  return (await loadOpenNext()).fetch(request, env, ctx)
}

export default {
  // Signed-out GETs of the public landing pages come from the anonymous HTML
  // cache (src/server/anon-html-cache.ts): a hit never loads the proxy or the
  // Next server, which is what costs CPU on Workers Free. Everything else, and
  // every miss, goes to OpenNext unchanged.
  fetch(request: Request, env: FetchEnv, ctx: ExecutionContextLike) {
    if (env.CLICKIT_SPIKE === 'on') {
      const url = new URL(request.url)
      // The real ctx (not a wrapper) reaches OpenNext, so getCloudflareContext().ctx.exports works in server actions.
      if (url.pathname.startsWith('/spike-probe/')) return spikeProbeFetch(request, env, ctx as SpikeCtx, url)
    }
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
