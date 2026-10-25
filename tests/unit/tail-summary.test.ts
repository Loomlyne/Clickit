import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  percentile,
  routeLabel,
  summarizeTail,
  parseArgs,
  renderTable,
} from '../../scripts/cf/tail-summary.mjs'

type Ev = {
  cpuTime?: number
  outcome?: string
  entrypoint?: string
  scriptVersion?: { id: string }
  eventTimestamp?: number
  url?: string
}

function line(ev: Ev): string {
  const out: Record<string, unknown> = {
    cpuTime: ev.cpuTime ?? 1,
    wallTime: 10,
    outcome: ev.outcome ?? 'ok',
    scriptVersion: ev.scriptVersion ?? { id: 'v1' },
    eventTimestamp: ev.eventTimestamp ?? Date.parse('2026-10-21T15:00:00Z'),
    event: ev.url ? { request: { url: ev.url, method: 'GET', headers: {} }, response: { status: 200 } } : {},
    logs: [],
    exceptions: [],
  }
  if (ev.entrypoint) out.entrypoint = ev.entrypoint
  return JSON.stringify(out)
}

test('percentile is nearest rank; empty input gives null', () => {
  const xs = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  assert.equal(percentile(xs, 50), 5)
  assert.equal(percentile(xs, 95), 10)
  assert.equal(percentile(xs, 100), 10)
  assert.equal(percentile([7], 50), 7)
  assert.equal(percentile([], 50), null)
})

test('route labels normalise ids and drop the query', () => {
  assert.equal(routeLabel('https://x.dev/en/series/the-show?spike_b=3'), '/en/series/<slug>')
  assert.equal(routeLabel('https://x.dev/ar/watch/123e4567-e89b?x=1'), '/ar/watch/<id>')
  assert.equal(routeLabel('https://x.dev/en/portfolio?spike_b=1'), '/en/portfolio')
  assert.equal(routeLabel('https://x.dev/spike-probe/cache/burn?k=abc&burn=5'), '/spike-probe/cache/burn')
  assert.equal(routeLabel(undefined), '(no request)')
})

test('summarizeTail groups by route and entrypoint; percentiles over ok only; exceededCpu counted apart', () => {
  const lines = [
    line({ url: 'https://x.dev/en/portfolio?spike_b=1', cpuTime: 4 }),
    line({ url: 'https://x.dev/en/portfolio?spike_b=2', cpuTime: 8 }),
    line({ url: 'https://x.dev/en/portfolio?spike_b=3', cpuTime: 6 }),
    line({ url: 'https://x.dev/en/portfolio?spike_b=4', cpuTime: 11, outcome: 'exceededCpu' }),
    line({ url: 'https://x.dev/en/series/a', cpuTime: 2 }),
    line({ url: 'https://x.dev/en/series/b', cpuTime: 3 }),
    line({ url: 'https://x.dev/spike-probe/cache/burn?k=1', cpuTime: 1, entrypoint: 'default' }),
    line({ url: 'https://x.dev/spike-probe/cache/burn?k=1', cpuTime: 9, entrypoint: 'SpikeProbe' }),
  ]
  const { groups, malformed, total } = summarizeTail(lines)
  assert.equal(malformed, 0)
  assert.equal(total, 8)
  const portfolio = groups.find((g: { group: string }) => g.group === '/en/portfolio')
  assert.deepEqual(portfolio, {
    group: '/en/portfolio',
    entrypoint: '-',
    n: 4,
    ok: 3,
    exceededCpu: 1,
    cpuP50: 6,
    cpuP95: 8,
    cpuMax: 8,
  })
  const series = groups.find((g: { group: string }) => g.group === '/en/series/<slug>')
  assert.equal(series.n, 2)
  const burn = groups.filter((g: { group: string }) => g.group === '/spike-probe/cache/burn')
  assert.equal(burn.length, 2)
  assert.deepEqual(
    burn.map((g: { entrypoint: string; cpuMax: number }) => [g.entrypoint, g.cpuMax]).sort(),
    [
      ['SpikeProbe', 9],
      ['default', 1],
    ],
  )
})

test('malformed lines are counted and skipped, not fatal', () => {
  const lines = ['{not json', '', '   ', 'null', '42', line({ url: 'https://x.dev/en/about', cpuTime: 5 })]
  const { groups, malformed, total } = summarizeTail(lines)
  assert.equal(malformed, 3)
  assert.equal(total, 1)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].cpuP50, 5)
})

test('pretty-printed multi-line events (wrangler prints JSON with a 4-space indent) are read', () => {
  const pretty = (ev: Ev) => JSON.stringify(JSON.parse(line(ev)), null, 4)
  const text = [
    pretty({ url: 'https://x.dev/en/about', cpuTime: 3 }),
    '{broken',
    pretty({ url: 'https://x.dev/en/about', cpuTime: 9, outcome: 'exceededCpu' }),
  ].join('\n')
  const { groups, malformed, total } = summarizeTail(text)
  assert.equal(total, 2)
  assert.equal(malformed, 1)
  assert.equal(groups[0].ok, 1)
  assert.equal(groups[0].exceededCpu, 1)
  assert.equal(groups[0].cpuP50, 3)
})

test('filters: version and since/until window', () => {
  const t0 = Date.parse('2026-10-21T15:00:00Z')
  const lines = [
    line({ url: 'https://x.dev/en/about', cpuTime: 5, scriptVersion: { id: 'keep' }, eventTimestamp: t0 }),
    line({ url: 'https://x.dev/en/about', cpuTime: 7, scriptVersion: { id: 'other' }, eventTimestamp: t0 }),
    line({ url: 'https://x.dev/en/about', cpuTime: 9, scriptVersion: { id: 'keep' }, eventTimestamp: t0 + 3_600_000 }),
  ]
  const { groups } = summarizeTail(lines, { version: 'keep', since: t0 - 1, until: t0 + 1000 })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].n, 1)
  assert.equal(groups[0].cpuMax, 5)
})

test('a group with only exceededCpu has null percentiles', () => {
  const { groups } = summarizeTail([line({ url: 'https://x.dev/en/auth', cpuTime: 12, outcome: 'exceededCpu' })])
  assert.equal(groups[0].ok, 0)
  assert.equal(groups[0].cpuP50, null)
})

test('parseArgs and renderTable', () => {
  const args = parseArgs(['t.jsonl', '--since', '2026-10-21T15:00:00Z', '--version', 'abc'])
  assert.equal(args.file, 't.jsonl')
  assert.equal(args.since, Date.parse('2026-10-21T15:00:00Z'))
  assert.equal(args.version, 'abc')
  assert.throws(() => parseArgs(['--since', 'not-a-date', 'f']))
  const table = renderTable(summarizeTail([line({ url: 'https://x.dev/en/about', cpuTime: 5 }), '{bad']))
  assert.match(table, /^\| group \| entrypoint \| n \| ok \| exceededCpu \| cpu p50 \| cpu p95 \| cpu max \|/)
  assert.match(table, /\| \/en\/about \| - \| 1 \| 1 \| 0 \| 5 \| 5 \| 5 \|/)
  assert.match(table, /malformed lines: 1/)
})
