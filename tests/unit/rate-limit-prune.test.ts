// Review item 9 (PR #29): rate_limits rows are pruned by the existing weekly cleanup cron,
// one bounded DELETE (created_at older than the retention), fail-soft.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { RATE_LIMIT_RETENTION_MS, pruneRateLimits } from '../../src/server/rate-limit-store.ts'
import { ARABIC_FILL_RATE_WINDOW_MS } from '../../src/lib/admin/arabic-filler.ts'
import { CRON_ROUTES } from '../../src/server/cron-schedule.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const NOW = Date.parse('2026-10-21T04:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const H = 60 * 60 * 1000

test('retention is 24 h and covers every rate-limit window in use', () => {
  assert.equal(RATE_LIMIT_RETENTION_MS, 24 * H)
  const windows: number[] = [ARABIC_FILL_RATE_WINDOW_MS]
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
    })
  for (const f of walk('src')) {
    for (const m of readFileSync(f, 'utf8').matchAll(/windowMs: ([\d_]+)/g)) windows.push(Number(m[1]!.replace(/_/g, '')))
  }
  assert.ok(windows.length >= 2, 'contact (1 h) and translate-ar (10 min) windows found')
  for (const w of windows) assert.ok(w <= RATE_LIMIT_RETENTION_MS, `window ${w} ms is longer than the retention`)
})

test('pruneRateLimits deletes only rows older than the retention, in one DELETE', async () => {
  const f = createFakeSupabase({
    rate_limits: [
      { id: 'old-1', key: 'contact:1.2.3.4', created_at: ago(25 * H) },
      { id: 'old-2', key: 'translate-ar:admin:u1', created_at: ago(8 * 24 * H) },
      { id: 'edge', key: 'contact:1.2.3.4', created_at: ago(24 * H) },
      { id: 'new-1', key: 'contact:1.2.3.4', created_at: ago(30 * 60 * 1000) },
    ],
  })
  const res = await pruneRateLimits(f.client, NOW)
  assert.equal(res.error, null)
  assert.deepEqual(f.tables.rate_limits!.map((r) => r.id).sort(), ['edge', 'new-1'])
  const deletes = f.calls.filter((c) => c.op === 'delete')
  assert.equal(deletes.length, 1)
  assert.deepEqual(deletes[0]!.filters, [{ kind: 'lt', col: 'created_at', value: ago(24 * H) }])
  assert.equal(f.calls.length, 1, 'no read before the delete')
})

test('pruneRateLimits never throws: an error or a throw comes back as { error }', async () => {
  const failing = createFakeSupabase({ rate_limits: [{ id: 'a', key: 'k', created_at: ago(48 * H) }] })
  failing.failOn({ table: 'rate_limits', op: 'delete', nth: 1 })
  const r1 = await pruneRateLimits(failing.client, NOW)
  assert.equal(typeof r1.error, 'string')
  assert.equal(failing.tables.rate_limits!.length, 1)

  const throwing = createFakeSupabase({})
  throwing.throwOn({ table: 'rate_limits', op: 'delete', nth: 1 })
  const r2 = await pruneRateLimits(throwing.client, NOW)
  assert.equal(typeof r2.error, 'string')

  const r3 = await pruneRateLimits({ from() { throw new Error('no client') } }, NOW)
  assert.equal(typeof r3.error, 'string')
})

test('cleanup-media cron prunes first, fail-soft, and reports it; no extra cron beyond the mapped three', () => {
  const route = readFileSync('src/app/api/cron/cleanup-media/route.ts', 'utf8')
  const run = route.slice(route.indexOf('async function runCleanup()'))
  const prune = run.indexOf('pruneRateLimits(admin, ')
  assert.ok(prune !== -1, 'runCleanup calls pruneRateLimits(admin, …) with the service client')
  assert.ok(prune < run.indexOf('supabaseCleanupEnabled('), 'prune runs before the originals switch returns')
  assert.ok(prune < run.indexOf("from('shows')"), 'prune runs before the media sweep can fail')
  assert.match(run, /rateLimitsPruned/, 'the JSON reports the prune result')
  assert.deepEqual(Object.keys(CRON_ROUTES).sort(), ['0 1 * * *', '0 4 * * 1', '30 1 * * *'])
})
