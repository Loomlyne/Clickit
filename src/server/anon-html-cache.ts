// Anonymous HTML cache in front of OpenNext (debug cpu-en-home, 2026-10-21).
//
// Workers Free allows 10 ms CPU per request. A signed-out render of a public
// page costs about 35 ms warm and 300-950 ms in a fresh isolate (lazy load of
// the Next server bundle plus cold JIT), so every public page went over. The
// public landing pages render the same HTML for every signed-out visitor, so
// the Worker entry serves them from a short-lived copy and never loads the
// proxy or the Next server on a hit.
//
// Tiers: the Cache API (per data centre; functional on custom domains) first,
// then the R2 bucket that already holds the OpenNext incremental cache (works
// on workers.dev too). A miss renders through OpenNext as before and stores the
// result. Pure module: the Worker passes the stores, clock and renderer in.
//
// What the shared copy may depend on, and so what the key holds: build,
// path (locale included) and device class (the landing hero renders one media
// variant from User-Agent / Sec-CH-UA-Mobile, src/lib/device.ts). Footer, FAQ
// and the viewer layout read the locale from the NEXT_LOCALE cookie
// (src/lib/locale-server.ts), so only a render whose cookie locale was the URL
// locale is stored.

import { isMobileFromHeaders } from '../lib/device-class.ts'

export const ANON_HTML_TTL_SECONDS = 120

/** Paths after the locale prefix that are served from the anonymous cache. */
export const ANON_HTML_PATHS: readonly string[] = Object.freeze([
  '', // locale root: the proxy's 308 to /<locale>/portfolio
  '/portfolio',
  '/about',
  '/support',
  '/privacy',
  '/terms',
])

type CacheLocale = 'en' | 'ar'

/** Query parameters that do not change the page: campaign and click ids. */
const IGNORED_PARAM = /^(utm_[a-z_]+|fbclid|gclid|msclkid)$/i

/** Next.js client-router and Server Action requests: never from the HTML cache. */
const ROUTER_HEADERS = [
  'rsc',
  'next-router-prefetch',
  'next-router-state-tree',
  'next-router-segment-prefetch',
  'next-action',
]

const LOCALE_COOKIE = 'NEXT_LOCALE'
/** src/lib/locale.ts DEFAULT_LOCALE: what the cookie read falls back to. */
const DEFAULT_LOCALE: CacheLocale = 'en'
export const CACHE_STATUS_HEADER = 'x-clickit-cache'
const META_HEADER = 'x-clickit-cache-meta'
const R2_PREFIX = 'anon-html'

export type CacheTarget = {
  /** Cache API key: same origin, a path no route serves. */
  edgeKey: string
  /** R2 object key in the incremental-cache bucket. */
  r2Key: string
  locale: CacheLocale
}

type StoredMeta = { status: number; headers: [string, string][]; storedAt: number }

export type EdgeCacheLike = {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

export type R2ObjectLike = { text(): Promise<string> }
export type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>
  put(key: string, value: string): Promise<unknown>
}

export type AnonCacheDeps = {
  edge?: EdgeCacheLike | null
  r2?: R2BucketLike | null
  /** Changes with every build so a deploy never serves HTML that points at old chunks. */
  version: string
  now: () => number
  waitUntil: (promise: Promise<unknown>) => void
}

function cookieNames(header: string | null): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=')
    const name = (eq === -1 ? part : part.slice(0, eq)).trim()
    if (name) out.set(name, eq === -1 ? '' : part.slice(eq + 1).trim())
  }
  return out
}

/**
 * Decide whether a request may be answered from the anonymous HTML cache.
 * Returns null (render as usual) for anything but a plain signed-out GET of a
 * listed public page.
 */
export function anonCacheTarget(request: Request, version: string): CacheTarget | null {
  if (request.method !== 'GET') return null
  if (!version) return null
  for (const name of ROUTER_HEADERS) if (request.headers.has(name)) return null

  // Any Supabase auth cookie (sb-<ref>-auth-token, chunked .0/.1) means the
  // page may differ for this visitor.
  const cookies = cookieNames(request.headers.get('cookie'))
  for (const name of cookies.keys()) if (name.startsWith('sb-')) return null

  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return null
  }
  for (const name of url.searchParams.keys()) if (!IGNORED_PARAM.test(name)) return null

  const match = /^\/(en|ar)(\/[a-z-]+)?$/.exec(url.pathname)
  if (!match) return null
  const locale = match[1] as CacheLocale
  const rest = match[2] ?? ''
  if (!ANON_HTML_PATHS.includes(rest)) return null

  const path = `/${locale}${rest}`
  const device = isMobileFromHeaders(request.headers) ? 'mobile' : 'desktop'
  return {
    edgeKey: `${url.origin}/__anon-html/${encodeURIComponent(version)}/${device}${path}`,
    r2Key: `${R2_PREFIX}/${version}/${device}${path}`,
    locale,
  }
}

/** Only complete, cookie-free (apart from the locale cookie) answers are shared. */
export function isStorable(response: Response): boolean {
  if (response.status === 308) return response.headers.has('location')
  if (response.status !== 200) return false
  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('text/html')) return false
  const setCookies = response.headers.getSetCookie()
  return setCookies.every((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`))
}

/**
 * The locale the render's cookie read saw: the NEXT_LOCALE the proxy set on
 * this response (next-intl forwards it to the render), else the visitor's own
 * cookie, else the default.
 */
export function renderedCookieLocale(request: Request, response: Response): string {
  for (const c of response.headers.getSetCookie()) {
    const m = new RegExp(`^\\s*${LOCALE_COOKIE}=([^;]*)`).exec(c)
    if (m) return m[1]
  }
  return cookieNames(request.headers.get('cookie')).get(LOCALE_COOKIE) ?? DEFAULT_LOCALE
}

function isFresh(meta: StoredMeta, now: number): boolean {
  return Number.isFinite(meta.storedAt) && now - meta.storedAt < ANON_HTML_TTL_SECONDS * 1000 && now >= meta.storedAt
}

function storedHeaders(response: Response): [string, string][] {
  const out: [string, string][] = []
  response.headers.forEach((value, name) => {
    if (name === 'set-cookie' || name === 'content-length' || name === 'content-encoding') return
    out.push([name, value])
  })
  return out
}

/**
 * Rebuild the visitor's answer from a stored copy. The browser keeps the
 * original cache-control (private, no-store): only the Worker shares the copy.
 * The locale cookie follows next-intl's rule: set it when the visitor's differs.
 */
function serve(meta: StoredMeta, body: ReadableStream | string | null, request: Request, target: CacheTarget, status: string, now: number): Response {
  const headers = new Headers(meta.headers)
  headers.set(CACHE_STATUS_HEADER, status)
  headers.set('age', String(Math.max(0, Math.floor((now - meta.storedAt) / 1000))))
  if (cookieNames(request.headers.get('cookie')).get(LOCALE_COOKIE) !== target.locale) {
    headers.append('set-cookie', `${LOCALE_COOKIE}=${target.locale}; Path=/; SameSite=lax`)
  }
  return new Response(meta.status === 308 ? null : body, { status: meta.status, headers })
}

function edgeCopy(meta: StoredMeta, body: string, now: number): Response {
  const remaining = Math.max(1, ANON_HTML_TTL_SECONDS - Math.floor((now - meta.storedAt) / 1000))
  return new Response(body, {
    status: 200, // the Cache API stores 200s; the real status rides in the meta
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${remaining}`,
      [META_HEADER]: JSON.stringify(meta),
    },
  })
}

/** The edge copy's body is passed through as a stream: no decode on a hit. */
async function readEdge(edge: EdgeCacheLike, key: string): Promise<{ meta: StoredMeta; body: ReadableStream | null } | null> {
  const hit = await edge.match(key)
  if (!hit) return null
  const raw = hit.headers.get(META_HEADER)
  if (!raw) return null
  return { meta: JSON.parse(raw) as StoredMeta, body: hit.body }
}

/** R2 object = one line of JSON meta, a newline, then the body. */
async function readR2(r2: R2BucketLike, key: string): Promise<{ meta: StoredMeta; body: string } | null> {
  const obj = await r2.get(key)
  if (!obj) return null
  const text = await obj.text()
  const nl = text.indexOf('\n')
  if (nl === -1) return null
  return { meta: JSON.parse(text.slice(0, nl)) as StoredMeta, body: text.slice(nl + 1) }
}

function swallow(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch(() => undefined)
}

/**
 * Serve a signed-out public page from the anonymous cache, or render it with
 * `render` and store the result. Store errors never fail the request.
 */
export async function serveWithAnonHtmlCache(
  request: Request,
  deps: AnonCacheDeps,
  render: () => Promise<Response>,
): Promise<Response> {
  const target = anonCacheTarget(request, deps.version)
  if (!target) return render()

  const now = deps.now()
  if (deps.edge) {
    const hit = await readEdge(deps.edge, target.edgeKey).catch(() => null)
    if (hit && isFresh(hit.meta, now)) return serve(hit.meta, hit.body, request, target, 'HIT-EDGE', now)
  }
  if (deps.r2) {
    const hit = await readR2(deps.r2, target.r2Key).catch(() => null)
    if (hit && isFresh(hit.meta, now)) {
      if (deps.edge) deps.waitUntil(swallow(deps.edge.put(target.edgeKey, edgeCopy(hit.meta, hit.body, now))))
      return serve(hit.meta, hit.body, request, target, 'HIT-R2', now)
    }
  }

  const response = await render()
  if (!isStorable(response)) return response
  if (renderedCookieLocale(request, response) !== target.locale) return response

  const body = response.status === 308 ? '' : await response.text()
  const meta: StoredMeta = { status: response.status, headers: storedHeaders(response), storedAt: now }
  if (deps.edge) deps.waitUntil(swallow(deps.edge.put(target.edgeKey, edgeCopy(meta, body, now))))
  if (deps.r2) deps.waitUntil(swallow(deps.r2.put(target.r2Key, `${JSON.stringify(meta)}\n${body}`)))

  // This visitor gets the render's own answer, cookies included.
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.set(CACHE_STATUS_HEADER, 'MISS')
  return new Response(response.status === 308 ? null : body, { status: response.status, headers })
}
