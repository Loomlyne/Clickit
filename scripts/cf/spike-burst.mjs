// Spike (b), (d), (e) and D-66, plan 02.1-01. THROWAWAY: deleted in plan 02.1-06.
// Read-only request bursts against a base URL (local preview or workers.dev).
// Every request is a GET (pageview: a headless browser, every non-GET request
// the page tries is aborted and logged as blocked). Redirects are not followed
// (except by the browser in pageview mode). No cookies are sent.
//
// Modes:
//   render    interleaved list of routes, each URL with a unique ?spike_b=<run><n>
//             (the deployed prototype bypasses its cache on any other query, so
//             every sample is a full render); --count per route
//   isr       the same URL (--routes, first entry) repeated --count times
//   cache     the scripted probe sequence for (e) under /spike-probe/cache/:
//             plain x2, plain?v=2, r307 x2, r308 x2, cookie x2, burn x2, then
//             burn + gwburn x30, each of the 30 with its own ?k= so every one misses
//             (A3: is the CPU limit per invocation or summed?)
//   hits      --count GETs of one URL (--url)
//   asset     --count GETs of one /_next/static/... file taken from the HTML of --url
//   pageview  Playwright chromium: --count loads of --url, each in a fresh context
//             (a cold first view, the upper bound), waits for network idle and
//             records every request: URL, method, type and class (document,
//             rsc, static, media, same-origin-other, third-party)
//
// Each request is logged (UTC start and end, URL, status, x-spike-*, cf-cache-status,
// x-opennext-cache, x-nextjs-cache, location) to the --out JSON file (outside the
// repo; default /Users/koss/clickit-phase021-logs/burst-<mode>-<time>.json). No
// request header is logged. stdout gets one JSON summary with the UTC window
// (first start, last end) of the whole burst.
//
// Exit 1 when a request fails at the network level, or (cache mode) when an
// expectation fails; expectations are spike findings, the log has every request.
//
// Usage:
//   node scripts/cf/spike-burst.mjs --mode render --base https://clickit.clickitstory.workers.dev \
//        --routes /en/portfolio,/en/about --count 30 --interval-ms 1000
//   node scripts/cf/spike-burst.mjs --mode cache --base ... [--burn 4000000 --gwburn 4000000]
//   node scripts/cf/spike-burst.mjs --mode hits --base ... --url /spike-probe/cache/plain --count 50
//   node scripts/cf/spike-burst.mjs --mode pageview --base ... --url /en/portfolio --count 10

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MODES = Object.freeze(['render', 'isr', 'cache', 'hits', 'asset', 'pageview'])
export const DEFAULT_LOG_DIR = '/Users/koss/clickit-phase021-logs'
export const DEFAULT_MEDIA_ORIGINS = Object.freeze(['https://media.clickitstory.ae'])
/** Response headers copied into the log (besides every x-spike-*). Values hold no secrets. */
export const LOGGED_HEADERS = Object.freeze(['cf-cache-status', 'x-opennext-cache', 'x-nextjs-cache', 'location'])

export const USAGE = `spike-burst: read-only request bursts (GET only; pageview aborts any non-GET)
  --mode <mode>          required: ${MODES.join(' | ')}
  --base <url>           required, e.g. https://clickit.clickitstory.workers.dev
  --routes <list>        render: comma-separated paths; isr: the first path is repeated
  --url <path>           hits, asset (page whose HTML names the static file), pageview
  --count <n>            render: per route (default 30); isr/hits/asset/pageview: total
                         (defaults 30/50/50/10); cache: ignored (fixed sequence)
  --interval-ms <ms>     pause between requests (default 1000; pageview: between views)
  --burn <n>             cache: SpikeProbe burn iterations (default 4000000)
  --gwburn <n>           cache: gateway burn iterations on the 30 A3 samples (default 4000000)
  --media-origins <list> pageview: origins counted as media (default ${DEFAULT_MEDIA_ORIGINS.join(',')})
  --timeout-ms <ms>      per-request timeout (default 60000; a hung request is logged as an error)
  --out <file>           request log (default ${DEFAULT_LOG_DIR}/burst-<mode>-<time>.json)
  --help`

const DEFAULT_COUNT = { render: 30, isr: 30, hits: 50, asset: 50, pageview: 10, cache: 0 }

function positiveInt(flag, value, { min = 0, max = 1_000_000_000 } = {}) {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} must be a whole number`)
  const n = Number(value)
  if (n < min || n > max) throw new Error(`${flag} must be between ${min} and ${max}`)
  return n
}

export function parseArgs(argv) {
  const out = {
    mode: null,
    base: null,
    routes: [],
    url: null,
    count: null,
    intervalMs: 1000,
    burn: 4_000_000,
    gwburn: 4_000_000,
    mediaOrigins: [...DEFAULT_MEDIA_ORIGINS],
    out: null,
    timeoutMs: 60_000,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--mode') {
      out.mode = next()
      if (!MODES.includes(out.mode)) throw new Error(`--mode must be one of ${MODES.join(', ')}`)
    } else if (a === '--base') {
      const u = new URL(next())
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('--base must be http or https')
      out.base = u.origin
    } else if (a === '--routes') out.routes = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--url') out.url = next()
    else if (a === '--count') out.count = positiveInt(a, next(), { min: 1, max: 1000 })
    else if (a === '--interval-ms') out.intervalMs = positiveInt(a, next(), { max: 600_000 })
    else if (a === '--burn') out.burn = positiveInt(a, next(), { max: 200_000_000 })
    else if (a === '--gwburn') out.gwburn = positiveInt(a, next(), { max: 200_000_000 })
    else if (a === '--media-origins') out.mediaOrigins = next().split(',').map((s) => new URL(s.trim()).origin)
    else if (a === '--timeout-ms') out.timeoutMs = positiveInt(a, next(), { min: 1000, max: 600_000 })
    else if (a === '--out') out.out = next()
    else throw new Error(`unknown argument ${a}`)
  }
  if (out.mode && out.count === null) out.count = DEFAULT_COUNT[out.mode]
  return out
}

/** A short run tag, [a-z0-9], so query tokens and cache keys of one run never collide with another. */
export function runTag(now = Date.now()) {
  return `r${now.toString(36)}`
}

/** Interleaved render URLs: route order repeats `count` times, each with a unique spike_b. */
export function renderPlan(routes, count, tag) {
  const plan = []
  let n = 0
  for (let round = 0; round < count; round++) {
    for (const route of routes) plan.push({ label: route, path: withQuery(route, { spike_b: `${tag}${n++}` }) })
  }
  return plan
}

/**
 * The fixed (e) sequence. Every key carries the run tag (`?k=`), so a rerun starts
 * cold; `plain?v=2` keeps the same k, so it must share the plain entry (the query
 * outside k is not in the key). The 30 A3 samples each get their own k.
 */
export function cachePlan(tag, { burn, gwburn }) {
  const c = (name, query) => withQuery(`/spike-probe/cache/${name}`, query)
  const plan = [
    { label: 'plain#1', path: c('plain', { k: tag }) },
    { label: 'plain#2', path: c('plain', { k: tag }) },
    { label: 'plain?v=2', path: c('plain', { k: tag, v: '2' }) },
    { label: 'r307#1', path: c('r307', { k: tag }) },
    { label: 'r307#2', path: c('r307', { k: tag }) },
    { label: 'r308#1', path: c('r308', { k: tag }) },
    { label: 'r308#2', path: c('r308', { k: tag }) },
    { label: 'cookie#1', path: c('cookie', { k: tag }) },
    { label: 'cookie#2', path: c('cookie', { k: tag }) },
    { label: 'burn#1', path: c('burn', { k: tag, burn: String(burn) }) },
    { label: 'burn#2', path: c('burn', { k: tag, burn: String(burn) }) },
  ]
  for (let i = 0; i < 30; i++) {
    plan.push({ label: `burn+gwburn#${i + 1}`, path: c('burn', { k: `${tag}-${i}`, burn: String(burn), gwburn: String(gwburn) }) })
  }
  return plan
}

export function withQuery(path, query) {
  const [p, existing] = path.split('?')
  const params = new URLSearchParams(existing ?? '')
  for (const [k, v] of Object.entries(query)) params.set(k, v)
  const qs = params.toString()
  return qs ? `${p}?${qs}` : p
}

/** The logged subset of response headers: every x-spike-* plus LOGGED_HEADERS. */
export function pickHeaders(headers) {
  const out = {}
  const entries = typeof headers?.entries === 'function' ? [...headers.entries()] : Object.entries(headers ?? {})
  for (const [rawName, value] of entries) {
    const name = rawName.toLowerCase()
    if (name.startsWith('x-spike-') || LOGGED_HEADERS.includes(name)) out[name] = value
  }
  return out
}

/** First /_next/static/ file named in an HTML document (prefers a .js chunk). */
export function firstStaticAsset(html) {
  const all = [...html.matchAll(/["'(](\/_next\/static\/[^"'()\s?#]+)/g)].map((m) => m[1])
  return all.find((u) => u.endsWith('.js')) ?? all[0] ?? null
}

/** The render stamp of the ISR probe page, or null. */
export function isrStamp(html) {
  return /id="spike-render-stamp"[^>]*>([^<]*)</.exec(html)?.[1] ?? null
}

/** Class of a browser request for the D-66 page-view breakdown. */
export function classifyRequest({ url, resourceType, isRsc }, base, mediaOrigins) {
  let u
  try {
    u = new URL(url)
  } catch {
    return 'other'
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:') return 'inline'
  if (mediaOrigins.includes(u.origin)) return 'media'
  if (u.origin !== base) return 'third-party'
  if (resourceType === 'document') return 'document'
  if (isRsc || u.searchParams.has('_rsc')) return 'rsc'
  if (u.pathname.startsWith('/_next/static/')) return 'static'
  return 'same-origin-other'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let requestTimeoutMs = 60_000

async function timedGet(base, entry, { keepBody = false } = {}) {
  const url = new URL(entry.path, base).toString()
  const start = new Date().toISOString()
  try {
    const signal = AbortSignal.timeout(requestTimeoutMs)
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal })
    const body = await res.text()
    return {
      label: entry.label,
      url,
      start,
      end: new Date().toISOString(),
      status: res.status,
      headers: pickHeaders(res.headers),
      ...(keepBody ? { body } : {}),
    }
  } catch (error) {
    return { label: entry.label, url, start, end: new Date().toISOString(), status: null, error: String(error?.message ?? error) }
  }
}

async function runSequence(base, plan, intervalMs, opts) {
  const log = []
  for (let i = 0; i < plan.length; i++) {
    if (i > 0 && intervalMs > 0) await sleep(intervalMs)
    log.push(await timedGet(base, plan[i], opts))
  }
  return log
}

/** Expectations for the cache sequence (findings, not hidden). */
export function cacheExpectations(log) {
  const by = Object.fromEntries(log.map((r) => [r.label, r]))
  const stamp = (l) => by[l]?.headers?.['x-spike-filled-at'] ?? null
  const status = (l) => by[l]?.headers?.['x-spike-cache-status'] ?? null
  const same = (a, b) => stamp(a) !== null && stamp(a) === stamp(b)
  const a3 = log.filter((r) => r.label.startsWith('burn+gwburn#'))
  return {
    expectations: [
      { check: 'plain second call served from cache (same stamp)', pass: same('plain#1', 'plain#2') },
      { check: 'plain?v=2 shares the plain entry (cf.cacheKey sharing)', pass: same('plain#1', 'plain?v=2') },
      { check: 'cookie (Set-Cookie) never a HIT', pass: !same('cookie#1', 'cookie#2') && status('cookie#2') !== 'HIT' },
      { check: 'burn second call served from cache (same stamp)', pass: same('burn#1', 'burn#2') },
    ],
    findings: {
      A5_r307_stored: same('r307#1', 'r307#2'),
      A5_r308_stored: same('r308#1', 'r308#2'),
      A6_cache_status_seen_by_gateway: log.some((r) => r.headers?.['x-spike-cache-status'] && r.headers['x-spike-cache-status'] !== 'absent'),
      cacheStatus: Object.fromEntries(log.filter((r) => !r.label.startsWith('burn+gwburn#')).map((r) => [r.label, status(r.label)])),
      A3_samples: a3.length,
      A3_status: countBy(a3, (r) => String(r.status)),
      A3_cache_status: countBy(a3, (r) => r.headers?.['x-spike-cache-status'] ?? 'none'),
    },
  }
}

function countBy(list, fn) {
  const out = {}
  for (const x of list) out[fn(x)] = (out[fn(x)] ?? 0) + 1
  return out
}

async function runPageview(base, path, count, intervalMs, mediaOrigins) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const log = []
  const views = []
  try {
    for (let v = 0; v < count; v++) {
      if (v > 0 && intervalMs > 0) await sleep(intervalMs)
      const context = await browser.newContext()
      const page = await context.newPage()
      const requests = []
      // Read-only: anything other than GET/HEAD is aborted and logged as blocked.
      await page.route('**/*', (route) => {
        const m = route.request().method()
        return m === 'GET' || m === 'HEAD' ? route.continue() : route.abort()
      })
      page.on('request', (req) => {
        const h = req.headers()
        requests.push({
          view: v + 1,
          url: req.url(),
          method: req.method(),
          resourceType: req.resourceType(),
          isRsc: h.rsc === '1',
          start: new Date().toISOString(),
          req,
        })
      })
      const start = new Date().toISOString()
      let navError = null
      try {
        await page.goto(new URL(path, base).toString(), { waitUntil: 'networkidle', timeout: 60_000 })
      } catch (error) {
        navError = String(error?.message ?? error).split('\n')[0]
      }
      const end = new Date().toISOString()
      for (const r of requests) {
        const res = await r.req.response().catch(() => null)
        const failure = r.req.failure()
        const entry = {
          view: r.view,
          url: r.url,
          method: r.method,
          resourceType: r.resourceType,
          class: classifyRequest(r, base, mediaOrigins),
          start: r.start,
          status: res ? res.status() : null,
          headers: res ? pickHeaders(await res.allHeaders().catch(() => ({}))) : {},
          ...(r.method !== 'GET' && r.method !== 'HEAD' ? { blocked: true } : {}),
          ...(failure ? { failure: failure.errorText } : {}),
        }
        log.push(entry)
      }
      const mine = log.filter((e) => e.view === v + 1)
      views.push({ view: v + 1, start, end, navError, requests: mine.length, byClass: countBy(mine, (e) => e.class) })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  return { log, views }
}

function windowOf(log, viewsOrNull) {
  const starts = [...log.map((r) => r.start), ...(viewsOrNull ?? []).map((v) => v.start)].filter(Boolean).sort()
  const ends = [...log.map((r) => r.end ?? r.start), ...(viewsOrNull ?? []).map((v) => v.end)].filter(Boolean).sort()
  return { start: starts[0] ?? null, end: ends.at(-1) ?? null }
}

async function main(argv) {
  let args
  try {
    args = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${error.message}\n${USAGE}\n`)
    return 2
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  if (!args.mode || !args.base) {
    process.stderr.write(`--mode and --base are required\n${USAGE}\n`)
    return 2
  }
  const target = args.url ?? args.routes[0] ?? null
  if (args.mode === 'render' && args.routes.length === 0) {
    process.stderr.write(`--routes is required for render\n${USAGE}\n`)
    return 2
  }
  if (['isr', 'hits', 'asset', 'pageview'].includes(args.mode) && !target) {
    process.stderr.write(`--url (or --routes) is required for ${args.mode}\n${USAGE}\n`)
    return 2
  }
  requestTimeoutMs = args.timeoutMs
  const tag = runTag()
  const outFile = args.out ?? `${DEFAULT_LOG_DIR}/burst-${args.mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const summary = { script: 'spike-burst', mode: args.mode, base: args.base, runTag: tag, out: outFile }
  let log = []
  let views = null
  let code = 0

  if (args.mode === 'render') {
    log = await runSequence(args.base, renderPlan(args.routes, args.count, tag), args.intervalMs)
  } else if (args.mode === 'isr') {
    const plan = Array.from({ length: args.count }, (_, i) => ({ label: `isr#${i + 1}`, path: target }))
    log = (await runSequence(args.base, plan, args.intervalMs, { keepBody: true })).map(({ body, ...r }) => ({
      ...r,
      renderStamp: body ? isrStamp(body) : null,
    }))
    summary.renderStamps = [...new Set(log.map((r) => r.renderStamp))]
  } else if (args.mode === 'cache') {
    log = await runSequence(args.base, cachePlan(tag, args), args.intervalMs)
    const { expectations, findings } = cacheExpectations(log)
    summary.expectations = expectations
    summary.findings = findings
    if (expectations.some((e) => !e.pass)) code = 1
  } else if (args.mode === 'hits') {
    const plan = Array.from({ length: args.count }, (_, i) => ({ label: `hit#${i + 1}`, path: target }))
    log = await runSequence(args.base, plan, args.intervalMs)
  } else if (args.mode === 'asset') {
    const page = await timedGet(args.base, { label: 'page', path: target }, { keepBody: true })
    const asset = page.body ? firstStaticAsset(page.body) : null
    summary.page = { url: page.url, status: page.status, start: page.start, end: page.end }
    if (!asset) {
      process.stderr.write('no /_next/static/ file found in the page HTML\n')
      summary.asset = null
      code = 1
    } else {
      summary.asset = asset
      const plan = Array.from({ length: args.count }, (_, i) => ({ label: `asset#${i + 1}`, path: asset }))
      log = await runSequence(args.base, plan, args.intervalMs)
    }
  } else if (args.mode === 'pageview') {
    ;({ log, views } = await runPageview(args.base, target, args.count, args.intervalMs, args.mediaOrigins))
    summary.views = views
    summary.perViewByClass = countBy(log, (e) => e.class)
    for (const k of Object.keys(summary.perViewByClass)) summary.perViewByClass[k] = summary.perViewByClass[k] / args.count
    summary.blocked = log.filter((e) => e.blocked).length
  }

  const errors = log.filter((r) => r.error)
  if (errors.length > 0) code = 1
  summary.window = windowOf(log, views)
  summary.requests = log.length
  summary.status = countBy(log, (r) => String(r.status))
  summary.errors = errors.length
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify({ summary, log }, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  process.stderr.write(`UTC window: ${summary.window.start} .. ${summary.window.end}\n`)
  return code
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      process.stderr.write(`spike-burst failed: ${error.message}\n`)
      process.exitCode = 2
    },
  )
}
