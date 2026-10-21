// Spike probes for phase 02.1 plan 01 (D-03 a-e, D-66). THROWAWAY: deleted in
// plan 02.1-06 together with the SpikeProbe entrypoint, the /spike-probe pages
// and the CLICKIT_SPIKE var. Pure (no Workers runtime import, no `@/` alias)
// so node:test runs it. Answers only under /spike-probe/*; nothing a viewer
// sees depends on it.

export const SPIKE_TAG = 'spike-a'
export const SPIKE_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=2592000, stale-if-error=2592000'
export const SPIKE_REDIRECT_TARGET = '/spike-probe/a'
/** Upper bound for the fixed-iteration CPU burn (`?burn=` / `?gwburn=`). */
export const MAX_BURN_ITERATIONS = 200_000_000

export const PROBE_NAMES = ['plain', 'r307', 'r308', 'cookie', 'burn'] as const
export type ProbeName = (typeof PROBE_NAMES)[number]

export type ProbePath =
  | { kind: 'gw'; rest: string }
  | { kind: 'cache'; rest: string }
  | { kind: 'other'; rest: string }

const PREFIX = '/spike-probe/'
const CACHE_NAME = /^[a-z0-9]{1,16}$/
const KEY_TOKEN = /^[A-Za-z0-9_-]{1,32}$/

/**
 * `/spike-probe/gw/<rest>` -> { kind: 'gw', rest: '/<rest>' } (the path the
 * gateway probe forwards to OpenNext); `/spike-probe/cache/<name>` ->
 * { kind: 'cache', rest: '<name>' }; anything else -> other.
 */
export function parseProbePath(pathname: string): ProbePath {
  if (pathname === '/spike-probe/gw' || pathname.startsWith('/spike-probe/gw/')) {
    const rest = pathname.slice('/spike-probe/gw'.length)
    return { kind: 'gw', rest: rest === '' ? '/' : rest }
  }
  if (pathname.startsWith(`${PREFIX}cache/`)) {
    const name = pathname.slice(`${PREFIX}cache/`.length)
    if (CACHE_NAME.test(name)) return { kind: 'cache', rest: name }
  }
  return { kind: 'other', rest: pathname }
}

/** `?burn=` / `?gwburn=` -> a bounded non-negative integer (0 when absent or bad). */
export function parseIterations(value: string | null): number {
  if (value === null || !/^\d{1,9}$/.test(value)) return 0
  return Math.min(Number(value), MAX_BURN_ITERATIONS)
}

/**
 * Cache key for a cache probe. The query is not part of the key, so
 * `plain?v=2` shares the `plain` entry (cf.cacheKey sharing check). An
 * optional `?k=<token>` gives a separate entry, so a burn probe can be made to
 * miss on every request (A3: per-invocation vs summed CPU limit).
 */
export function probeCacheKey(name: string, keyToken: string | null): string {
  return keyToken && KEY_TOKEN.test(keyToken) ? `/__spike/${name}/${keyToken}` : `/__spike/${name}`
}

/**
 * A fixed number of integer steps. Never "loop until N ms": inside a Worker
 * Date.now() does not advance during synchronous CPU work.
 */
export function burnCpu(iterations: number): number {
  let x = 0
  for (let i = 0; i < iterations; i++) x = (Math.imul(x, 31) + i) | 0
  return x
}

/** The SpikeProbe entrypoint's answer for one probe name. */
export function probeCacheResponse(name: string, opts: { stamp: string; burnIterations: number }): Response {
  const headers = new Headers({
    'Cache-Control': SPIKE_CACHE_CONTROL,
    'Cache-Tag': SPIKE_TAG,
    'x-spike-filled-at': opts.stamp,
    'x-spike-name': name,
  })
  const body = (extra: Record<string, unknown> = {}) => JSON.stringify({ probe: name, stamp: opts.stamp, ...extra })
  switch (name) {
    case 'plain':
      headers.set('Content-Type', 'application/json')
      return new Response(body(), { status: 200, headers })
    case 'r307':
    case 'r308':
      headers.set('Location', SPIKE_REDIRECT_TARGET)
      headers.set('Content-Type', 'application/json')
      return new Response(body(), { status: name === 'r307' ? 307 : 308, headers })
    case 'cookie':
      headers.set('Content-Type', 'application/json')
      headers.set('Set-Cookie', 'spike=1; Path=/spike-probe; HttpOnly; Secure; SameSite=Lax')
      return new Response(body(), { status: 200, headers })
    case 'burn': {
      const iterations = Math.min(Math.max(0, Math.floor(opts.burnIterations)), MAX_BURN_ITERATIONS)
      const result = burnCpu(iterations)
      headers.set('Content-Type', 'application/json')
      return new Response(body({ iterations, result }), { status: 200, headers })
    }
    default:
      return new Response(JSON.stringify({ error: 'unknown probe' }), {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      })
  }
}

const STRIPPED = new Set(['cookie', 'authorization', 'accept-language'])

function forwardRequest(request: Request, strip: boolean): Request {
  const url = new URL(request.url)
  const parsed = parseProbePath(url.pathname)
  if (parsed.kind === 'gw') url.pathname = parsed.rest
  const headers = new Headers()
  request.headers.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (strip && (STRIPPED.has(lower) || lower.startsWith('x-clickit-'))) return
    headers.append(name, value)
  })
  const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers, redirect: 'manual' }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body
    init.duplex = 'half'
  }
  return new Request(url.toString(), init)
}

/**
 * The anon/user forward for /spike-probe/gw/<rest>: path rewritten to /<rest>;
 * Cookie, Authorization, Accept-Language and inbound x-clickit-* removed.
 * `_rsc` (query), `rsc`, `next-router-*` and `next-url` reach Next unchanged
 * (F2: Next validates `_rsc` against them).
 */
export function stripForProbe(request: Request): Request {
  return forwardRequest(request, true)
}

/** The bypass forward: path rewritten, every header kept (the proxy refreshes or clears the cookie). */
export function rewriteForProbe(request: Request): Request {
  return forwardRequest(request, false)
}
