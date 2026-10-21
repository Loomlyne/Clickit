import assert from 'node:assert/strict'
import test from 'node:test'
import {
  archiveEpisodeCore,
  deleteEpisodePermanentlyCore,
  reorderEpisodeCore,
  restoreEpisodeCore,
} from '../../src/lib/admin/episode-lifecycle.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'
import { emulateReorderEpisode } from './helpers/reorder-episode-emulator.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const S2 = id('b')
const SE1 = id('c')
const E1 = id('e', 1) // visible #1
const E2 = id('e', 2) // archived #2
const E3 = id('e', 3) // visible #3
const E4 = id('e', 4) // visible #4

const ep = (eid: string, num: number, archived = false): Row => ({
  id: eid,
  show_id: S1,
  season_id: SE1,
  title: `Episode ${num}`,
  episode_number: num,
  status: 'published',
  archived,
})

// Fidelity note: the fake has no FK cascade (watch progress, likes), so tests
// assert only the episode row and the counts, never cascaded children.
function world(episodes: Row[] = [ep(E1, 1), ep(E2, 2, true), ep(E3, 3), ep(E4, 4)]) {
  const f = createFakeSupabase({
    shows: [
      { id: S1, title: 'Show 1', season_count: 1, episode_count: 99 },
      { id: S2, title: 'Show 2', season_count: 1, episode_count: 0 },
    ],
    seasons: [{ id: SE1, show_id: S1, title: 'Season 1', season_number: 1, episode_count: 99 }],
    episodes,
  })
  f.registerRpc('reorder_episode', emulateReorderEpisode)
  return f
}
type World = ReturnType<typeof world>

const deps = (f: World) => ({ audit: f.auditWriter, adminUserId: 'admin-1' })
const db = (f: World) => f.client
const num = (f: World, eid: string) =>
  f.snapshot().episodes!.find((r) => r.id === eid)?.episode_number
const calls = (f: World, table: string, op: string) =>
  f.calls.filter((c) => c.table === table && c.op === op)
const auditFor = (f: World, eid: string) =>
  f.auditRows().filter((r) => r.entity_id === eid)

// ---- deleteEpisodePermanentlyCore ----

test('delete: non-archived episode is refused, nothing deleted, no audit row', async () => {
  const f = world()
  const before = f.snapshot()
  const r = await deleteEpisodePermanentlyCore(db(f), deps(f), E1)
  assert.equal(r.success, false)
  assert.equal(r.error, 'Archive this episode before deleting it permanently.')
  assert.deepEqual(f.snapshot(), before)
  assert.equal(f.auditRows().length, 0)
})

test('delete: missing id and malformed id', async () => {
  const f = world()
  const missing = await deleteEpisodePermanentlyCore(db(f), deps(f), id('9', 9))
  assert.equal(missing.error, 'Episode not found.')
  const bad = await deleteEpisodePermanentlyCore(db(f), deps(f), 'x')
  assert.equal(bad.error, 'Invalid episode id.')
  assert.equal(f.auditRows().length, 0)
})

test('delete: success writes pending then committed with one attempt_id, pending before delete', async () => {
  const f = world()
  const r = await deleteEpisodePermanentlyCore(db(f), deps(f), E2)
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.equal(f.snapshot().episodes!.some((e) => e.id === E2), false)
  const rows = auditFor(f, E2)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.diff.outcome, 'pending')
  assert.equal(rows[1]!.diff.outcome, 'committed')
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  for (const row of rows) {
    assert.equal(row.action_type, 'delete')
    assert.equal(row.diff.id, E2)
    assert.equal(row.diff.title, 'Episode 2')
    assert.equal(row.diff.show_id, S1)
    assert.equal(row.diff.season_id, SE1)
  }
  const order = f.calls.map((c) => `${c.table}:${c.op}`)
  const pendingIdx = order.indexOf('admin_audit_log:insert')
  const deleteIdx = order.indexOf('episodes:delete')
  assert.ok(pendingIdx >= 0 && pendingIdx < deleteIdx)
  const snap = f.snapshot()
  assert.equal(snap.seasons![0]!.episode_count, 3)
  assert.equal(snap.shows![0]!.episode_count, 3)
})

test('delete: pending audit insert failure deletes nothing', async () => {
  const f = world()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await deleteEpisodePermanentlyCore(db(f), deps(f), E2)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.ok(f.snapshot().episodes!.some((e) => e.id === E2))
  assert.equal(calls(f, 'episodes', 'delete').length, 0)
})

test('delete: forced delete failure leaves the episode and writes pending then failed', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'delete', nth: 1 })
  const r = await deleteEpisodePermanentlyCore(db(f), deps(f), E2)
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.ok(f.snapshot().episodes!.some((e) => e.id === E2))
  const rows = auditFor(f, E2)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.diff.outcome, 'pending')
  assert.equal(rows[1]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  assert.equal(rows[1]!.diff.failed_step, 'delete-episode')
  assert.equal(rows[1]!.diff.error, 'forced failure')
  assert.deepEqual(rows[1]!.diff.undone, [])
  assert.deepEqual(rows[1]!.diff.left_in_place, [])
})

test('delete: count recompute failure after the delete is reported and recorded', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const r = await deleteEpisodePermanentlyCore(db(f), deps(f), E2)
  assert.equal(r.success, false)
  assert.equal(r.error, 'Episode deleted, but counts could not be updated: forced failure')
  assert.equal(r.wrote, true)
  const rows = auditFor(f, E2)
  assert.equal(rows.length, 2)
  assert.equal(rows[1]!.diff.outcome, 'failed')
  assert.equal(rows[1]!.diff.failed_step, 'recompute-counts')
  assert.deepEqual(rows[1]!.diff.left_in_place, [
    { step: 'delete-episode', error: 'no undo defined' },
  ])
})

// ---- reorderEpisodeCore ----

test('reorder: invalid direction and invalid id never call the rpc', async () => {
  const f = world()
  const a = await reorderEpisodeCore(db(f), deps(f), E3, 'sideways')
  assert.equal(a.error, 'Invalid direction.')
  const b = await reorderEpisodeCore(db(f), deps(f), 'x', 'up')
  assert.equal(b.error, 'Invalid episode id.')
  assert.equal(calls(f, 'reorder_episode', 'rpc').length, 0)
})

test('reorder: archived current episode is refused before any write', async () => {
  const f = world()
  const before = f.snapshot()
  const r = await reorderEpisodeCore(db(f), deps(f), E2, 'up')
  assert.equal(r.success, false)
  assert.equal(r.error, 'Archived episodes cannot be reordered.')
  assert.equal(calls(f, 'reorder_episode', 'rpc').length, 0)
  assert.deepEqual(f.snapshot(), before)
  assert.equal(f.auditRows().length, 0)
})

test('reorder: skips an archived neighbour and audits the swap', async () => {
  const f = world()
  const r = await reorderEpisodeCore(db(f), deps(f), E3, 'up')
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.equal(num(f, E3), 1)
  assert.equal(num(f, E1), 3)
  assert.equal(num(f, E2), 2)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'update')
  assert.equal(rows[0]!.entity_type, 'episode')
  assert.equal(rows[0]!.entity_id, E3)
  assert.deepEqual(rows[0]!.diff, {
    kind: 'reorder',
    direction: 'up',
    swapped_with: E1,
    from: 3,
    to: 1,
  })
})

test('reorder: no visible neighbour gives today\'s message, no audit row', async () => {
  const f = world()
  const before = f.snapshot()
  const r = await reorderEpisodeCore(db(f), deps(f), E1, 'up')
  assert.equal(r.success, false)
  assert.equal(r.error, 'No adjacent episode to swap with')
  assert.deepEqual(f.snapshot(), before)
  assert.equal(f.auditRows().length, 0)
})

test('reorder: forced rpc failure leaves data unchanged and writes a failed audit row', async () => {
  const f = world()
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  f.failOn({ rpc: 'reorder_episode', nth: 1 })
  const r = await reorderEpisodeCore(db(f), deps(f), E3, 'up')
  assert.equal(r.success, false)
  assert.ok(r.error)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.failed_step, 'swap')
})

test('reorder: missing database function names the migration and never swaps in app code', async () => {
  const f = createFakeSupabase({
    shows: [{ id: S1, title: 'Show 1' }],
    seasons: [{ id: SE1, show_id: S1, season_number: 1 }],
    episodes: [ep(E1, 1), ep(E3, 3)],
  })
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  const r = await reorderEpisodeCore(f.client, deps(f as unknown as World), E3, 'up')
  assert.equal(r.success, false)
  assert.match(r.error ?? '', /20260724115941/)
  assert.match(r.error ?? '', /public\.reorder_episode/)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  assert.equal(calls(f as unknown as World, 'episodes', 'update').length, 0)
})

test('reorder: audit failure reverses the swap through the opposite direction', async () => {
  const f = world()
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await reorderEpisodeCore(db(f), deps(f), E3, 'up')
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  const rpcs = calls(f, 'reorder_episode', 'rpc')
  assert.equal(rpcs.length, 2)
  assert.equal(rpcs[0]!.patch.p_direction, 'up')
  assert.equal(rpcs[1]!.patch.p_direction, 'down')
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.failed_step, 'audit')
  assert.deepEqual(rows[0]!.diff.undone, ['swap'])
})

test('reorder: audit failure and failed undo report the swap as left in place', async () => {
  const f = world()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  f.failOn({ rpc: 'reorder_episode', nth: 2 })
  const r = await reorderEpisodeCore(db(f), deps(f), E3, 'up')
  assert.equal(r.success, false)
  assert.match(r.error ?? '', /left in place/i)
  assert.equal(num(f, E3), 1)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.left_in_place[0].step, 'swap')
})

test('reorder: swaps with the nearest active episode whatever the gap (1, 2, 4)', async () => {
  const G1 = id('f', 1)
  const G2 = id('f', 2)
  const G4 = id('f', 4)
  const f = world([ep(G1, 1), ep(G2, 2), ep(G4, 4)])
  const r = await reorderEpisodeCore(db(f), deps(f), G4, 'up')
  assert.equal(r.success, true)
  assert.equal(num(f, G4), 2)
  assert.equal(num(f, G2), 4)
  assert.equal(num(f, G1), 1)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0]!.diff, {
    kind: 'reorder',
    direction: 'up',
    swapped_with: G2,
    from: 4,
    to: 2,
  })
})

// ---- archiveEpisodeCore / restoreEpisodeCore ----

test('archive: a showId that does not own the episode is refused', async () => {
  const f = world()
  const before = f.snapshot()
  const r = await archiveEpisodeCore(db(f), deps(f), E1, S2)
  assert.equal(r.success, false)
  assert.deepEqual(f.snapshot(), before)
})

test('archive: success updates season and show counts and audits', async () => {
  const f = world()
  const r = await archiveEpisodeCore(db(f), deps(f), E1, S1)
  assert.equal(r.success, true)
  assert.equal(r.data?.showId, S1)
  const snap = f.snapshot()
  assert.equal(snap.episodes!.find((e) => e.id === E1)!.archived, true)
  assert.equal(snap.seasons![0]!.episode_count, 2)
  assert.equal(snap.shows![0]!.episode_count, 2)
  const rows = auditFor(f, E1)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'archive')
  assert.equal(rows[0]!.entity_type, 'episode')
})

test('archive: count failure un-archives the episode and reports it', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const r = await archiveEpisodeCore(db(f), deps(f), E1, S1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.equal(f.snapshot().episodes!.find((e) => e.id === E1)!.archived, false)
})

test('restore: malformed id is refused', async () => {
  const f = world()
  const r = await restoreEpisodeCore(db(f), deps(f), 'x')
  assert.equal(r.error, 'Invalid episode id.')
})

test('restore: an active episode is refused, no write, no audit row', async () => {
  const f = world()
  const before = f.snapshot()
  const r = await restoreEpisodeCore(db(f), deps(f), E1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, 'Episode is not archived.')
  assert.deepEqual(f.snapshot(), before)
  assert.equal(auditFor(f, E1).length, 0)
})

test('restore: success recomputes the season count too and audits', async () => {
  const f = world()
  const r = await restoreEpisodeCore(db(f), deps(f), E2)
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  const snap = f.snapshot()
  assert.equal(snap.episodes!.find((e) => e.id === E2)!.archived, false)
  assert.equal(snap.seasons![0]!.episode_count, 4)
  assert.equal(snap.shows![0]!.episode_count, 4)
  assert.equal(auditFor(f, E2)[0]!.action_type, 'restore')
})

test('reorder: success moves down and returns wrote with showId', async () => {
  const f = world()
  const r = await reorderEpisodeCore(db(f), deps(f), E3, 'down')
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.equal(num(f, E3), 4)
  assert.equal(num(f, E4), 3)
  assert.equal(f.auditRows().length, 1)
})

test('reorder: a missing episode is refused before the rpc', async () => {
  const f = world()
  const r = await reorderEpisodeCore(db(f), deps(f), id('9', 9), 'up')
  assert.equal(r.error, 'Episode not found.')
  assert.equal(calls(f, 'reorder_episode', 'rpc').length, 0)
})

test('emulator: mirrors the SQL function errors', () => {
  const tables = { episodes: [ep(E1, 1), ep(E2, 2, true)] }
  assert.equal(emulateReorderEpisode({ p_episode_id: E1, p_direction: 'x' }, tables).error.code, '22023')
  assert.equal(emulateReorderEpisode({ p_episode_id: id('9', 9), p_direction: 'up' }, tables).error.code, 'P0002')
  assert.equal(emulateReorderEpisode({ p_episode_id: E2, p_direction: 'up' }, tables).error.code, 'P0001')
  assert.match(emulateReorderEpisode({ p_episode_id: E1, p_direction: 'down' }, tables).error.message, /No adjacent active/)
})
