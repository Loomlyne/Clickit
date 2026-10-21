import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runAdminAction, type AdminActionEnv } from '../../src/lib/admin/action-runner.ts'
import {
  deleteSeasonCore,
  updateEpisodeCore,
} from '../../src/lib/admin/season-episode-writes.ts'
import {
  deleteEpisodePermanentlyCore,
  reorderEpisodeCore,
} from '../../src/lib/admin/episode-lifecycle.ts'
import {
  applyShowScheduleCore,
  unscheduleShowCore,
} from '../../src/lib/admin/show-schedule.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'
import { emulateReorderEpisode } from './helpers/reorder-episode-emulator.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const SE1 = id('c')
const E1 = id('e', 1)
const E2 = id('e', 2)
const E3 = id('e', 3) // archived, holds number 3
// updated_at as PostgREST returns it; every season/episode update call passes it (item 8).
const V0 = '2026-10-20T10:00:00.000001+00:00'
const NOW = new Date('2026-08-10T08:00:00Z')

const ep = (eid: string, num: number, archived = false): Row => ({
  id: eid,
  show_id: S1,
  season_id: SE1,
  title: `Episode ${num}`,
  title_ar: `حلقة ${num}`,
  description: `Description ${num}`,
  description_ar: `وصف ${num}`,
  episode_number: num,
  youtube_video_id: 'abc',
  duration: 600,
  status: 'draft',
  publish_at: null,
  archived,
  updated_at: V0,
})

type Fake = ReturnType<typeof world>

function world(withRpc = true, archiveAll = false) {
  const f = createFakeSupabase({
    shows: [
      {
        id: S1,
        title: 'Show 1',
        season_count: 1,
        episode_count: 2,
        broadcast_day: ['Monday'],
        broadcast_time: '21:00:00',
      },
    ],
    seasons: [
      { id: SE1, show_id: S1, title: 'Season 1', title_ar: 'الموسم 1', season_number: 1, episode_count: 2, updated_at: V0 },
    ],
    episodes: [ep(E1, 1, archiveAll), ep(E2, 2, archiveAll), ep(E3, 3, true)],
  })
  if (withRpc) f.registerRpc('reorder_episode', emulateReorderEpisode)
  return f
}

function env(f: Fake, admin = true): AdminActionEnv {
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

const snap = (f: Fake) => f.snapshot({ exclude: ['admin_audit_log'] })
const fill = async (en: string | null | undefined, ar: string | null | undefined) =>
  (ar ?? '').trim() ? (ar as string) : `ar-${en}`
const writes = (f: Fake) => f.calls.filter((c) => c.op !== 'select' && c.op !== 'rpc')

test('deleteSeason path with a forced delete failure: pending and failed rows, revalidated once', async () => {
  const f = world(true, true)
  f.failOn({ table: 'seasons', op: 'delete', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      deleteSeasonCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: fill }, SE1, S1),
    { fallbackError: 'Failed to delete season', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  const rows = f.auditRows().filter((r) => r.entity_type === 'season')
  assert.deepEqual(rows.map((r) => r.diff.outcome), ['pending', 'failed'])
  assert.equal(spy.calls.length, 1)
})

test('deleteSeason path with a counts failure after the delete: truthful error, still revalidated', async () => {
  const f = world(true, true)
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      deleteSeasonCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: fill }, SE1, S1),
    { fallbackError: 'Failed to delete season', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.match((res as { error: string }).error, /Season deleted, but the show counts could not be updated/)
  assert.equal(spy.calls.length, 1)
})

test('updateEpisode path with archived:true in the payload: refused, no write, no revalidate', async () => {
  const f = world()
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      updateEpisodeCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: fill }, E1, {
        archived: true,
      }, V0),
    { fallbackError: 'Failed to update episode', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 0)
  assert.equal(writes(f).length, 0)
})

test('updateEpisode path with a failure on the second update: wrote true, revalidated once', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 2 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      updateEpisodeCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: fill }, E1, {
        episode_number: 3,
      }, V0),
    { fallbackError: 'Failed to update episode', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal((res as { wrote?: boolean }).wrote, true)
  assert.equal(spy.calls.length, 1)
})

test('deleteEpisodePermanently path on a non-archived episode: refused, no revalidate', async () => {
  const f = world()
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      deleteEpisodePermanentlyCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, E1),
    { fallbackError: 'Failed to delete episode', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(spy.calls.length, 0)
  assert.equal(f.auditRows().length, 0)
})

test('reorderEpisode path with the audit insert forced to fail: numbers restored, revalidated once', async () => {
  const f = world()
  const before = snap(f)
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      reorderEpisodeCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, E2, 'up'),
    { fallbackError: 'Failed to reorder episode', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.deepEqual(snap(f), before)
  assert.equal(spy.calls.length, 1)
})

test('reorderEpisode path with no registered function: migration message, no revalidate', async () => {
  const f = world(false)
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      reorderEpisodeCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, E2, 'up'),
    { fallbackError: 'Failed to reorder episode', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.match((res as { error: string }).error, /20260724115941/)
  assert.equal(spy.calls.length, 0)
})

test('applyShowSchedule path with the 2nd episode update failing: unchanged, revalidated once', async () => {
  const f = world()
  const before = snap(f)
  f.failOn({ table: 'episodes', op: 'update', nth: 2 })
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      applyShowScheduleCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, now: NOW }, S1),
    { fallbackError: 'Failed to schedule episodes', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.deepEqual(snap(f), before)
  assert.equal(spy.calls.length, 1)
})

test('unscheduleShowEpisodes path with a malformed record: refused, no revalidate', async () => {
  const f = world()
  await f.auditWriter({
    adminUserId: 'admin-1',
    action: 'update',
    entity: 'show',
    entityId: S1,
    diff: { kind: 'bulk_schedule', outcome: 'committed' },
  })
  const before = snap(f)
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f),
    (ctx) =>
      unscheduleShowCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, now: NOW }, S1),
    { fallbackError: 'Failed to unschedule episodes', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.deepEqual(snap(f), before)
  assert.equal(spy.calls.length, 0)
})

test('not admin on deleteSeason: no db calls, no audit row, no revalidate', async () => {
  const f = world()
  const spy = revalSpy()
  const res = await runAdminAction(
    env(f, false),
    (ctx) =>
      deleteSeasonCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId, fillArabic: fill }, SE1, S1),
    { fallbackError: 'Failed to delete season', revalidate: spy.revalidate }
  )
  assert.equal(res.success, false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.auditRows().length, 0)
  assert.equal(spy.calls.length, 0)
})

const src = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} export missing`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

const CORES: Array<[string, string]> = [
  ['createSeason', 'createSeasonCore'],
  ['updateSeason', 'updateSeasonCore'],
  ['createEpisode', 'createEpisodeCore'],
  ['updateEpisode', 'updateEpisodeCore'],
  ['archiveEpisode', 'archiveEpisodeCore'],
  ['restoreEpisode', 'restoreEpisodeCore'],
  ['deleteEpisodePermanently', 'deleteEpisodePermanentlyCore'],
  ['reorderEpisode', 'reorderEpisodeCore'],
  ['applyShowSchedule', 'applyShowScheduleCore'],
  ['unscheduleShowEpisodes', 'unscheduleShowCore'],
]
for (const [name, core] of CORES) {
  test(`source scan: ${name} runs ${core} through runAdminAction`, () => {
    const body = bodyOf(name)
    assert.ok(body.includes('runAdminAction('), `${name} lacks runAdminAction(`)
    assert.ok(body.includes(`${core}(`), `${name} lacks ${core}(`)
  })
}

test('source scan: deleteSeason is not an exported server action', () => {
  assert.equal(src.includes('export async function deleteSeason('), false)
})

test('source scan: previewShowSchedule uses planShowScheduleCore', () => {
  assert.ok(bodyOf('previewShowSchedule').includes('planShowScheduleCore('))
})

test('source scan: replaced helpers are gone', () => {
  assert.ok(!src.includes('async function planShowSchedule'))
  assert.ok(!src.includes('episode_number: -1'))
  assert.ok(!src.includes('translateToArabic('))
})
