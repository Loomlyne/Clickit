// Spike (a), plan 02.1-01, D-03a. THROWAWAY: deleted in plan 02.1-06.
// Are the HTML, RSC, prefetch and per-segment payloads of a static route
// byte-identical across the router headers a client may send? If they are, a
// cache keyed on the path (plus the kind) can serve them without Vary.
//
// For each route and each kind (html, rsc, prefetch, one per segment path in the
// route's prerender .meta) it sends one GET per header variant (no state tree,
// the state tree of /spike-probe/a, of /spike-probe/a/b, next-url /spike-probe,
// next-url /, plus a repeat of the first) and compares the bodies byte for byte.
// RSC requests carry the `_rsc` value computed with Next's own function, as the
// client does; one extra RSC GET per route goes without `_rsc` to record whether
// Next answers 307 (finding F2). GET only, redirect manual, no cookies.
//
// Usage:
//   node scripts/cf/spike-rsc-diff.mjs --base http://127.0.0.1:8787 \
//        --routes /spike-probe/a,/spike-probe/a/b [--next-dir .next]
// Prints one JSON summary. Exit 1 when any (route, kind) differs or answers non-2xx.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

export const USAGE = `spike-rsc-diff: byte diff of HTML/RSC/prefetch/segment payloads across router headers (GET only)
  --base <url>        required, e.g. http://127.0.0.1:8787
  --routes <list>     required, comma-separated paths, e.g. /spike-probe/a,/spike-probe/a/b
  --next-dir <dir>    Next build dir holding server/app/<route>.meta (default .next)
  --help`

export function parseArgs(argv) {
  const out = { base: null, routes: [], nextDir: '.next', help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--base') out.base = new URL(next()).origin
    else if (a === '--routes') out.routes = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--next-dir') out.nextDir = next()
    else throw new Error(`unknown argument ${a}`)
  }
  return out
}

/**
 * Flight router state for a path, as the client strips it before sending
 * (prepareFlightRouterStateForRequest keeps [segment, parallelRoutes] and adds
 * [2]/[3] only for a refresh marker and [4] only as a number of prefetch hints).
 * Next 16's flightRouterStateSchema rejects a boolean at [4], so none is sent.
 */
export function stateTreeFor(path) {
  const segments = path.split('/').filter(Boolean)
  let node = ['__PAGE__', {}]
  for (let i = segments.length - 1; i >= 0; i--) node = [segments[i], { children: node }]
  const tree = ['', { children: node }]
  return encodeURIComponent(JSON.stringify(tree))
}

export const VARIANTS = Object.freeze([
  { name: 'none', headers: {} },
  { name: 'tree:/spike-probe/a', headers: { 'next-router-state-tree': stateTreeFor('/spike-probe/a') } },
  { name: 'tree:/spike-probe/a/b', headers: { 'next-router-state-tree': stateTreeFor('/spike-probe/a/b') } },
  { name: 'next-url:/spike-probe', headers: { 'next-url': '/spike-probe' } },
  { name: 'next-url:/', headers: { 'next-url': '/' } },
  { name: 'none-repeat', headers: {} },
])

export function sha(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

/** First differing byte offset of two buffers, or -1 when identical. */
export function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

export function readSegmentPaths(nextDir, route) {
  const file = join(nextDir, 'server', 'app', `${route.replace(/^\//, '')}.meta`)
  try {
    const meta = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(meta.segmentPaths) ? meta.segmentPaths : []
  } catch {
    return null
  }
}

async function rscParam(headers) {
  const { computeCacheBustingSearchParam } = require('next/dist/shared/lib/router/utils/cache-busting-search-param.js')
  return computeCacheBustingSearchParam(
    headers['next-router-prefetch'],
    headers['next-router-segment-prefetch'],
    headers['next-router-state-tree'],
    headers['next-url'],
  )
}

async function get(base, path, headers, withRsc) {
  const url = new URL(path, base)
  if (withRsc) {
    const hash = await rscParam(headers)
    url.search = hash ? `?_rsc=${hash}` : '?_rsc'
  }
  const res = await fetch(url, { headers, redirect: 'manual' })
  const body = Buffer.from(await res.arrayBuffer())
  return {
    status: res.status,
    location: res.headers.get('location'),
    contentType: res.headers.get('content-type'),
    body,
  }
}

function kindsFor(segmentPaths) {
  const kinds = [
    { kind: 'html', headers: {}, rsc: false },
    { kind: 'rsc', headers: { rsc: '1' }, rsc: true },
    { kind: 'prefetch', headers: { rsc: '1', 'next-router-prefetch': '1' }, rsc: true },
  ]
  for (const seg of segmentPaths ?? []) {
    kinds.push({
      kind: `segment:${seg}`,
      headers: { rsc: '1', 'next-router-prefetch': '1', 'next-router-segment-prefetch': seg },
      rsc: true,
    })
  }
  return kinds
}

export async function diffRoute(base, route, nextDir) {
  const segmentPaths = readSegmentPaths(nextDir, route)
  const kinds = []
  for (const k of kindsFor(segmentPaths)) {
    const samples = []
    for (const v of VARIANTS) {
      const headers = { ...k.headers, ...v.headers }
      const r = await get(base, route, headers, k.rsc)
      samples.push({ variant: v.name, ...r })
    }
    const ref = samples[0]
    const diffs = []
    for (const s of samples.slice(1)) {
      const offset = firstDiff(ref.body, s.body)
      if (offset !== -1 || s.status !== ref.status) {
        diffs.push({ variant: s.variant, offset, sha: sha(s.body), len: s.body.length, status: s.status })
      }
    }
    const ok2xx = samples.every((s) => s.status >= 200 && s.status < 300)
    kinds.push({
      kind: k.kind,
      identical: diffs.length === 0,
      status: [...new Set(samples.map((s) => s.status))],
      contentType: ref.contentType,
      len: ref.body.length,
      sha: sha(ref.body),
      ok2xx,
      redirects: samples.filter((s) => s.location).map((s) => ({ variant: s.variant, status: s.status, location: s.location })),
      diffs,
    })
  }
  // F2: an RSC request without `_rsc`.
  const bare = await get(base, route, { rsc: '1' }, false)
  return {
    route,
    segmentPaths: segmentPaths ?? 'meta-missing',
    kinds,
    rscWithoutParam: { status: bare.status, location: bare.location },
  }
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
  if (!args.base || args.routes.length === 0) {
    process.stderr.write(`--base and --routes are required\n${USAGE}\n`)
    return 2
  }
  const startedAt = new Date().toISOString()
  const routes = []
  for (const route of args.routes) routes.push(await diffRoute(args.base, route, args.nextDir))
  const failures = routes.flatMap((r) =>
    r.kinds.filter((k) => !k.identical || !k.ok2xx).map((k) => `${r.route} ${k.kind}`),
  )
  const metaMissing = routes.filter((r) => r.segmentPaths === 'meta-missing').map((r) => r.route)
  const summary = {
    script: 'spike-rsc-diff',
    base: args.base,
    startedAt,
    endedAt: new Date().toISOString(),
    variants: VARIANTS.map((v) => v.name),
    allIdentical: failures.length === 0,
    failures,
    metaMissing,
    routes,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  return failures.length === 0 && metaMissing.length === 0 ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      process.stderr.write(`spike-rsc-diff failed: ${error.message}\n`)
      process.exitCode = 2
    },
  )
}
