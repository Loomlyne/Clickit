import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  callRenumberSeasonRpc,
  renumberSeasonCore,
} from '../../src/lib/admin/episode-lifecycle.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'
import { emulateRenumberSeason } from './helpers/renumber-season-emulator.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const S2 = id('b')
const SE1 = id('c')
const SE_OTHER = id('d')
const E = (n: number) => id('e', n)

const ep = (eid: string, num: number, archived = false, seasonId = SE1): Row => ({
  id: eid,
  show_id: seasonId === SE_OTHER ? S2 : S1,
  season_id: seasonId,
  title: `Episode ${num}`,
  episode_number: num,
  status: 'draft',
  archived,
})

// Active 1, 2, 4, 7 and archived 3.
const gapEpisodes = () => [ep(E(1), 1), ep(E(2), 2), ep(E(3), 3, true), ep(E(4), 4), ep(E(7), 7)]

function world(episodes: Row[] = gapEpisodes()) {
  const f = createFakeSupabase({
    shows: [
      { id: S1, title: 'Show 1' },
      { id: S2, title: 'Show 2' },
    ],
    seasons: [
      { id: SE1, show_id: S1, season_number: 1 },
      { id: SE_OTHER, show_id: S2, season_number: 1 },
    ],
    episodes,
  })
  f.registerRpc('renumber_season', emulateRenumberSeason)
  return f
}
type World = ReturnType<typeof world>

const deps = (f: World) => ({ audit: f.auditWriter, adminUserId: 'admin-1' })
const num = (f: World, eid: string) =>
  f.snapshot().episodes!.find((r) => r.id === eid)?.episode_number
const rpcCalls = (f: World) =>
  f.calls.filter((c) => c.table === 'renumber_season' && c.op === 'rpc')

test('renumber: closes gaps in order and moves archived after N, map lists changed rows only', async () => {
  const f = world()
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE1)
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.equal(num(f, E(1)), 1)
  assert.equal(num(f, E(2)), 2)
  assert.equal(num(f, E(4)), 3)
  assert.equal(num(f, E(7)), 4)
  assert.equal(num(f, E(3)), 5)
  const expected = [
    { episode_id: E(4), old_number: 4, new_number: 3 },
    { episode_id: E(7), old_number: 7, new_number: 4 },
    { episode_id: E(3), old_number: 3, new_number: 5 },
  ]
  assert.deepEqual(r.data?.map, expected)
  // never a duplicate
  const nums = f.snapshot().episodes!.map((e) => e.episode_number)
  assert.equal(new Set(nums).size, nums.length)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.action_type, 'update')
  assert.equal(rows[0]!.entity_type, 'season')
  assert.equal(rows[0]!.entity_id, SE1)
  assert.deepEqual(rows[0]!.diff, { kind: 'renumber', map: expected })
})

test('renumber: already 1..N is refused, nothing written, no audit row', async () => {
  const f = world([ep(E(1), 1), ep(E(2), 2), ep(E(3), 3, true)])
  const before = f.snapshot()
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE1)
  assert.equal(r.success, false)
  assert.equal(r.error, 'Already numbered 1 to N.')
  assert.equal(r.wrote, false)
  assert.deepEqual(f.snapshot(), before)
  assert.equal(f.auditRows().length, 0)
})

test('renumber: season of another show is refused without an rpc call', async () => {
  const f = world([...gapEpisodes(), ep(E(20), 5, false, SE_OTHER)])
  const before = f.snapshot()
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE_OTHER)
  assert.equal(r.success, false)
  assert.equal(r.error, 'Season does not belong to this show.')
  assert.equal(rpcCalls(f).length, 0)
  assert.deepEqual(f.snapshot(), before)
})

test('renumber: unknown season is refused without an rpc call', async () => {
  const f = world()
  const r = await renumberSeasonCore(f.client, deps(f), S1, id('9', 9))
  assert.equal(r.success, false)
  assert.equal(r.error, 'Season not found.')
  assert.equal(rpcCalls(f).length, 0)
})

test('renumber: non-uuid ids are refused before any read', async () => {
  const f = world()
  const a = await renumberSeasonCore(f.client, deps(f), 'x', SE1)
  assert.equal(a.error, 'Invalid show id.')
  const b = await renumberSeasonCore(f.client, deps(f), S1, 'x')
  assert.equal(b.error, 'Invalid season id.')
  assert.equal(f.calls.length, 0)
})

test('renumber: forced rpc failure leaves numbers unchanged and returns the error', async () => {
  const f = world()
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  f.failOn({ rpc: 'renumber_season', nth: 1 })
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.equal(r.error, 'forced failure')
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.failed_step, 'renumber')
})

test('renumber: missing database function names the Phase 6 migration', async () => {
  const f = createFakeSupabase({
    shows: [{ id: S1, title: 'Show 1' }],
    seasons: [{ id: SE1, show_id: S1, season_number: 1 }],
    episodes: gapEpisodes(),
  })
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  const r = await renumberSeasonCore(f.client, deps(f as unknown as World), S1, SE1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.match(r.error ?? '', /Phase 6 database migration/)
  assert.match(r.error ?? '', /public\.renumber_season/)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
})

test('renumber: audit failure after a successful rpc reports the renumber as left in place', async () => {
  const f = world()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.match(r.error ?? '', /left in place/i)
  assert.equal(num(f, E(4)), 3)
  assert.equal(rpcCalls(f).length, 1)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
  assert.equal(rows[0]!.diff.failed_step, 'audit')
  assert.equal(rows[0]!.diff.left_in_place[0].step, 'renumber')
})

test('callRenumberSeasonRpc maps P0002 and P0001 codes', async () => {
  const f = world()
  const missing = await callRenumberSeasonRpc(f.client, id('9', 9))
  assert.equal(missing.error?.message, 'Season not found.')
  assert.equal(missing.error?.refusal, true)
  const empty = await callRenumberSeasonRpc(f.client, SE_OTHER)
  assert.equal(empty.error?.message, 'Season not found.')
})

test('emulator: a season of only archived episodes is a no-op refusal (as in the SQL)', async () => {
  const f = world([ep(E(1), 3, true), ep(E(2), 5, true)])
  const r = await renumberSeasonCore(f.client, deps(f), S1, SE1)
  assert.equal(r.error, 'Already numbered 1 to N.')
})

test("the 'renumber' step has no undo key", () => {
  const src = readFileSync(
    new URL('../../src/lib/admin/episode-lifecycle.ts', import.meta.url),
    'utf8'
  )
  const start = src.indexOf('export async function renumberSeasonCore')
  assert.ok(start > 0)
  const next = src.indexOf('\nexport ', start + 10)
  const block = src.slice(start, next === -1 ? undefined : next)
  const at = block.indexOf("name: 'renumber'")
  assert.ok(at > 0)
  const stepEnd = block.indexOf("name: 'audit'", at)
  assert.ok(stepEnd > at)
  assert.equal(/\bundo\s*:/.test(block.slice(at, stepEnd)), false)
})
