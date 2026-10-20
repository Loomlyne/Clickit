import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import { archiveShowCore, restoreShowCore } from '../../src/lib/admin/show-archive.ts'
import { deleteShowCore, updateShowCore } from '../../src/lib/admin/show-writes.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = id('a')
const D = id('d')
const SA = id('c')
const E = (n: number) => id('e', n)
const CAT2 = id('2', 2)

type Fake = ReturnType<typeof createFakeSupabase>

function world(): Fake {
  const ep = (n: number, archived: boolean): Row => ({
    id: E(n),
    show_id: A,
    season_id: SA,
    episode_number: n,
    title: `Ep ${n}`,
    archived,
  })
  return createFakeSupabase({
    shows: [
      { id: A, title: 'Show A', title_ar: null, slug: 'show-a', description: 'd', status: 'published', genre: 'Drama', sort_order: 0, archived: false, created_at: '2025-01-01T00:00:00.000Z' },
      { id: D, title: 'Show D', title_ar: null, slug: 'show-d', description: 'd', status: 'published', genre: 'Drama', sort_order: 1, archived: true, created_at: '2025-01-02T00:00:00.000Z' },
    ],
    seasons: [{ id: SA, show_id: A, season_number: 1 }],
    episodes: [ep(1, false), ep(2, false)],
  })
}

function env(f: Fake, admin: boolean): AdminActionEnv {
  return {
    assertAdmin: async () => {
      if (!admin) throw new Error('Unauthorized')
      return { id: 'admin-1' }
    },
    createDb: () => f.client,
    audit: f.auditWriter,
    logError: () => {},
  }
}

function revalSpy() {
  const calls: unknown[] = []
  return { calls, revalidate: (r: unknown) => void calls.push(r) }
}

test('archive path, not admin: no db calls, no audit row', async () => {
  const f = world()
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, false),
    (ctx) => archiveShowCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, A),
    { fallbackError: 'Failed to archive show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.auditRows().length, 0)
  assert.equal(spy.calls.length, 0)
})

test('archive path with episodes update failure: failed, revalidated once, data restored', async () => {
  const f = world()
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, true),
    (ctx) => archiveShowCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, A),
    { fallbackError: 'Failed to archive show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 1)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
})

const media = {
  async stage() {
    return [{ commit: async () => true, rollback: async () => {} }]
  },
}

test('delete path on a non-archived show: refused, no revalidate, no audit row', async () => {
  const f = world()
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, true),
    (ctx) => deleteShowCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, media }, A),
    { fallbackError: 'Failed to delete show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 0)
  assert.equal(f.auditRows().length, 0)
})

test('delete path with the delete forced to fail: pending and failed rows, revalidated once', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'delete', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, true),
    (ctx) => deleteShowCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, media }, D),
    { fallbackError: 'Failed to delete show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 1)
  const rows = f.auditRows().filter((r) => r.entity_id === D)
  assert.deepEqual(rows.map((r) => r.diff.outcome), ['pending', 'failed'])
})

test('restore path with episode fixes succeeds and revalidates', async () => {
  const f = world()
  // archive first so there is something to restore
  await archiveShowCore(f.client, { audit: f.auditWriter, adminUserId: 'admin-1' }, A)
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, true),
    (ctx) =>
      restoreShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: async () => null },
        { showId: A, rename: {}, fixes: [{ episodeId: E(2), newEpisodeNumber: 20 }] }
      ),
    { fallbackError: 'Failed to restore show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(spy.calls.length, 1)
})

test('update path with a forced category step failure: wrote true, revalidated', async () => {
  const f = world()
  f.failOn({ table: 'show_categories', op: 'insert', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, true),
    (ctx) =>
      updateShowCore(
        ctx.db,
        { audit: ctx.audit, adminUserId: ctx.adminUserId },
        { id: A, updateData: { title: 'Show A2', slug: 'show-a2' } as never, categoryIds: [CAT2] }
      ),
    { fallbackError: 'Failed to update show', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal((res as { wrote?: boolean }).wrote, true)
  assert.equal(spy.calls.length, 1)
})

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} export missing`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

const CORES: Array<[string, string]> = [
  ['archiveShow', 'archiveShowCore'],
  ['restoreShow', 'restoreShowCore'],
  ['resolveConflictsAndRestore', 'restoreShowCore'],
  ['resolveRestoreConflictsAndRestore', 'restoreShowCore'],
  ['createShow', 'createShowCore'],
  ['updateShow', 'updateShowCore'],
  ['deleteShowPermanently', 'deleteShowCore'],
  ['reorderShow', 'reorderShowCore'],
]
for (const [name, core] of CORES) {
  test(`source scan: ${name} runs ${core} through runAdminAction`, () => {
    const body = bodyOf(name)
    assert.ok(body.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(body.includes(`${core}(`), `${name} lacks ${core}(`)
  })
}

test('source scan: replaced helpers are gone', () => {
  assert.ok(!src.includes('async function _restoreShow'))
  assert.ok(!src.includes('function syncShowCategories'))
})
