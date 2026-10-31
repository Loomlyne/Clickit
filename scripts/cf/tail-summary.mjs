// Minimal `wrangler tail --format json` summariser (phase 02.1 spike, D-03 b/e, D-66).
// Per route label and entrypoint: n, ok, exceededCpu, other, cpu p50/p95/max over `outcome: ok`
// only (nearest rank, the 02-CPU-REPORT method). Nothing else by design: no wall time,
// no version listing (filter with --version), no other output format.
//
// Input: the tail output file. wrangler prints each event pretty-printed (4-space
// indent), so an event spans many lines from a bare `{` to a bare `}`; single-line
// JSON events are read too. A line or block that is not a JSON object is counted
// as malformed and skipped. Header values are never printed.
//
// Usage:
//   node scripts/cf/tail-summary.mjs <tail.jsonl> [--since ISO] [--until ISO] [--version <id>]

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const USAGE = `tail-summary: per-route CPU table from wrangler tail JSON (read-only)
  <file>              tail output (wrangler tail --format json)
  --since <ISO>       keep events with eventTimestamp >= since
  --until <ISO>       keep events with eventTimestamp <= until
  --version <id>      keep events whose scriptVersion.id equals (or starts with) id
  --help`

/** Nearest-rank percentile (1..100) of a list of numbers; null for an empty list. */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1]
}

/** Path of a request URL with ids normalised; the query is dropped. */
export function routeLabel(url) {
  if (typeof url !== 'string' || url === '') return '(no request)'
  let pathname
  try {
    pathname = new URL(url).pathname
  } catch {
    return '(bad url)'
  }
  return pathname.replace(/\/series\/[^/]+/, '/series/<slug>').replace(/\/watch\/[^/]+/, '/watch/<id>')
}

/** Split tail text (or lines) into parsed objects; counts what is not a JSON object. */
export function parseTailLines(input) {
  const lines = Array.isArray(input) ? input.flatMap((l) => String(l).split('\n')) : String(input).split('\n')
  const events = []
  let malformed = 0
  let block = null
  const take = (text) => {
    let value
    try {
      value = JSON.parse(text)
    } catch {
      malformed++
      return
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) events.push(value)
    else malformed++
  }
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (block !== null) {
      block.push(line)
      if (line === '}') {
        take(block.join('\n'))
        block = null
      }
      continue
    }
    if (line.trim() === '') continue
    if (line === '{') {
      block = [line]
      continue
    }
    take(line)
  }
  if (block !== null) malformed++
  return { events, malformed }
}

function matchesVersion(ev, version) {
  if (!version) return true
  const id = ev?.scriptVersion?.id
  return typeof id === 'string' && (id === version || id.startsWith(version))
}

/**
 * summarizeTail(lines | text, { since?: ms, until?: ms, version?: string })
 * -> { groups: [{ group, entrypoint, n, ok, exceededCpu, other, cpuP50, cpuP95, cpuMax }], malformed, total }
 */
export function summarizeTail(input, filters = {}) {
  const { events, malformed } = parseTailLines(input)
  const map = new Map()
  let total = 0
  for (const ev of events) {
    if (!matchesVersion(ev, filters.version)) continue
    const ts = typeof ev.eventTimestamp === 'number' ? ev.eventTimestamp : null
    if (filters.since != null && (ts === null || ts < filters.since)) continue
    if (filters.until != null && (ts === null || ts > filters.until)) continue
    total++
    const group = routeLabel(ev?.event?.request?.url)
    const entrypoint = typeof ev.entrypoint === 'string' && ev.entrypoint !== '' ? ev.entrypoint : '-'
    const key = `${group}\u0000${entrypoint}`
    let g = map.get(key)
    if (!g) {
      g = { group, entrypoint, n: 0, ok: 0, exceededCpu: 0, cpu: [] }
      map.set(key, g)
    }
    g.n++
    if (ev.outcome === 'ok') {
      g.ok++
      if (typeof ev.cpuTime === 'number') g.cpu.push(ev.cpuTime)
    } else if (ev.outcome === 'exceededCpu') g.exceededCpu++
  }
  const groups = [...map.values()]
    .map(({ cpu, ...g }) => ({
      ...g,
      other: g.n - g.ok - g.exceededCpu,
      cpuP50: percentile(cpu, 50),
      cpuP95: percentile(cpu, 95),
      cpuMax: cpu.length ? Math.max(...cpu) : null,
    }))
    .sort((a, b) => (a.group === b.group ? a.entrypoint.localeCompare(b.entrypoint) : a.group.localeCompare(b.group)))
  return { groups, malformed, total }
}

export function renderTable(summary) {
  const cell = (v) => (v === null || v === undefined ? '-' : String(v))
  const rows = [
    '| group | entrypoint | n | ok | exceededCpu | other | cpu p50 | cpu p95 | cpu max |',
    '|---|---|---|---|---|---|---|---|---|',
    ...summary.groups.map(
      (g) =>
        `| ${g.group} | ${g.entrypoint} | ${g.n} | ${g.ok} | ${g.exceededCpu} | ${g.other} | ${cell(g.cpuP50)} | ${cell(g.cpuP95)} | ${cell(g.cpuMax)} |`,
    ),
  ]
  return `${rows.join('\n')}\n\nevents: ${summary.total}; malformed lines: ${summary.malformed}\n`
}

function isoMs(flag, value) {
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) throw new Error(`${flag} must be an ISO time`)
  return ms
}

export function parseArgs(argv) {
  const out = { file: null, since: null, until: null, version: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--since') out.since = isoMs(a, next())
    else if (a === '--until') out.until = isoMs(a, next())
    else if (a === '--version') out.version = next()
    else if (a.startsWith('--')) throw new Error(`unknown argument ${a}`)
    else if (out.file === null) out.file = a
    else throw new Error(`unexpected argument ${a}`)
  }
  return out
}

function main(argv) {
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
  if (!args.file) {
    process.stderr.write(`a tail file is required\n${USAGE}\n`)
    return 2
  }
  const text = readFileSync(args.file, 'utf8')
  process.stdout.write(renderTable(summarizeTail(text, args)))
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
