import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyShowScheduleCore,
  planShowScheduleCore,
  unscheduleShowCore,
} from '../../src/lib/admin/show-schedule.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const SE1 = id('c')
const E1 = id('e', 1)
const E2 = id('e', 2)
const E3 = id('e', 3)
const E4 = id('e', 4)

// Monday 12:00 Dubai. Weekly Monday 21:00 Dubai slots are 17:00Z each Monday.
const NOW = new Date('2026-08-10T08:00:00Z')
const SLOTS = [
  '2026-08-10T17:00:00.000Z',
  '2026-08-17T17:00:00.000Z',
  '2026-08-24T17:00:00.000Z',
  '2026-08-31T17:00:00.000Z',
]
const OLD_PUBLISH = '2026-01-05T10:00:00.000Z'

const ep = (eid: string, num: number, extra: Row = {}): Row => ({
  id: eid,
  show_id: S1,
  season_id: SE1,
  title: `Episode ${num}`,
  episode_number: num,
  status: 'draft',
  publish_at: null,
  archived: false,
  // Unique per row: episodes.youtube_video_id is unique catalog-wide (06-01).
  youtube_video_id: `yt-${eid}`,
  ...extra,
})

// Fidelity note: the fake has no DB defaults or FK cascades; every column the
// core reads or filters on is seeded explicitly here.
function world(episodes: Row[] = [
  ep(E1, 1, { status: 'coming-soon', publish_at: OLD_PUBLISH }),
  ep(E2, 2),
  ep(E3, 3),
  ep(E4, 4),
]) {
  return createFakeSupabase({
    shows: [
      {
        id: S1,
        title: 'Show 1',
        broadcast_day: ['Monday'],
        broadcast_time: '21:00:00',
      },
    ],
    seasons: [{ id: SE1, show_id: S1, season_number: 1 }],
    episodes,
  })
}
type World = ReturnType<typeof world>

const deps = (f: World, extra: Record<string, unknown> = {}) => ({
  audit: f.auditWriter,
  adminUserId: 'admin-1',
  now: NOW,
  ...extra,
})
const epRow = (f: World, eid: string) =>
  f.snapshot().episodes!.find((r) => r.id === eid)!
const epSnap = (f: World) => f.snapshot({ exclude: ['admin_audit_log'] })
const updates = (f: World) =>
  f.calls.filter((c) => c.table === 'episodes' && c.op === 'update')
const lastAudit = (f: World) => f.auditRows().at(-1)!

// ---- apply ----

test('apply: invalid show id is refused with no writes', async () => {
  const f = world()
  const r = await applyShowScheduleCore(f.client, deps(f), 'x')
  assert.equal(r.success, false)
  assert.equal(r.error, 'Invalid show id.')
  assert.equal(r.wrote, false)
  assert.equal(updates(f).length, 0)
  assert.equal(f.auditRows().length, 0)
})

test('apply: plan orders by episode number and uses the broadcast slots', async () => {
  const f = world()
  const r = await planShowScheduleCore(f.client, S1, NOW)
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.deepEqual(
      r.plan.map((p) => [p.episodeId, p.publishAt]),
      [E1, E2, E3, E4].map((e, i) => [e, SLOTS[i]])
    )
  }
})

test('apply: forced failure on the 3rd episode update leaves every episode as before', async () => {
  const f = world()
  const before = epSnap(f)
  f.failOn({ table: 'episodes', op: 'update', nth: 3 })
  const r = await applyShowScheduleCore(f.client, deps(f), S1)
  assert.equal(r.success, false)
  assert.ok(r.error)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.deepEqual(epSnap(f), before)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].diff.outcome, 'failed')
})

test('apply: an episode published after planning aborts and undoes the whole apply', async () => {
  const f = world()
  const planned = await planShowScheduleCore(f.client, S1, NOW)
  assert.ok(planned.ok)
  if (!planned.ok) return
  // The cron publishes E3 between planning and writing.
  f.tables.episodes.find((r) => r.id === E3)!.status = 'published'
  const before = epSnap(f)
  const r = await applyShowScheduleCore(
    f.client,
    deps(f, { planOverride: planned.plan }),
    S1
  )
  assert.equal(r.success, false)
  assert.equal(r.error, 'An episode changed while scheduling; nothing was applied.')
  assert.equal(epRow(f, E3).status, 'published')
  assert.deepEqual(epSnap(f), before)
  assert.equal(lastAudit(f).diff.outcome, 'failed')
})

test('apply: success writes a bulk_schedule audit row with every slot', async () => {
  const f = world()
  const r = await applyShowScheduleCore(f.client, deps(f), S1)
  assert.deepEqual(r, {
    success: true,
    wrote: true,
    data: { showId: S1, scheduled: 4 },
  })
  const diff = lastAudit(f).diff
  assert.equal(diff.kind, 'bulk_schedule')
  assert.equal(diff.outcome, 'committed')
  assert.deepEqual(diff.slots, [
    { episodeId: E1, previous_status: 'coming-soon', previous_publish_at: OLD_PUBLISH, publish_at: SLOTS[0] },
    { episodeId: E2, previous_status: 'draft', previous_publish_at: null, publish_at: SLOTS[1] },
    { episodeId: E3, previous_status: 'draft', previous_publish_at: null, publish_at: SLOTS[2] },
    { episodeId: E4, previous_status: 'draft', previous_publish_at: null, publish_at: SLOTS[3] },
  ])
  assert.equal(epRow(f, E2).status, 'coming-soon')
  assert.equal(epRow(f, E2).publish_at, SLOTS[1])
})

// ---- unschedule ----

test('unschedule: slot equality, only untouched scheduler slots revert', async () => {
  const f = world()
  await applyShowScheduleCore(f.client, deps(f), S1)
  const e = f.tables.episodes
  e.find((r) => r.id === E2)!.publish_at = '2026-09-01T10:00:00.000Z' // hand-edited
  e.find((r) => r.id === E3)!.status = 'published' // cron
  e.find((r) => r.id === E4)!.archived = true
  const before2 = epRow(f, E2)
  const before3 = epRow(f, E3)
  const before4 = epRow(f, E4)

  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, true)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.cleared, 1)
  assert.equal(epRow(f, E1).status, 'coming-soon')
  assert.equal(epRow(f, E1).publish_at, OLD_PUBLISH)
  assert.deepEqual(epRow(f, E2), before2)
  assert.deepEqual(epRow(f, E3), before3)
  assert.deepEqual(epRow(f, E4), before4)
  const diff = lastAudit(f).diff
  assert.equal(diff.kind, 'bulk_unschedule')
  assert.equal(diff.source, 'record')
  assert.deepEqual(diff.reverted, [
    {
      episodeId: E1,
      from: { status: 'coming-soon', publish_at: SLOTS[0] },
      to: { status: 'coming-soon', publish_at: OLD_PUBLISH },
    },
  ])
  assert.deepEqual(diff.skipped, [
    { episodeId: E2, reason: 'publish_at changed' },
    { episodeId: E3, reason: 'status changed' },
    { episodeId: E4, reason: 'archived' },
  ])
})

test('unschedule: instant comparison ignores string format (Z versus +00:00)', async () => {
  const f = world()
  await applyShowScheduleCore(f.client, deps(f), S1)
  f.tables.episodes.find((r) => r.id === E2)!.publish_at = '2026-08-17T17:00:00+00:00'
  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, true)
  assert.equal(epRow(f, E2).status, 'draft')
  assert.equal(epRow(f, E2).publish_at, null)
  assert.equal(r.data?.cleared, 4)
})

async function seedRecord(f: World, diff: Record<string, unknown>) {
  await f.auditWriter({
    adminUserId: 'admin-1',
    action: 'update',
    entity: 'show',
    entityId: S1,
    diff,
  })
  return f.auditRows().at(-1)!.id as string
}

test('unschedule: unreadable record (slots missing) is refused with no writes', async () => {
  const f = world()
  const recordId = await seedRecord(f, { kind: 'bulk_schedule', outcome: 'committed' })
  const before = epSnap(f)
  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, false)
  assert.equal(r.error, 'The last bulk schedule record is unreadable; nothing was changed.')
  assert.equal(r.wrote, false)
  assert.deepEqual(epSnap(f), before)
  assert.equal(updates(f).length, 0)
  const rows = f.auditRows()
  assert.equal(rows.length, 2)
  const diff = rows[1].diff
  assert.equal(diff.kind, 'bulk_unschedule')
  assert.equal(diff.outcome, 'failed')
  assert.equal(diff.reason, 'unreadable record')
  assert.equal(diff.record_id, recordId)
})

const goodSlot = {
  episodeId: E1,
  previous_status: 'draft',
  previous_publish_at: null,
  publish_at: SLOTS[0],
}

for (const [name, bad] of [
  ['previous_status missing', { episodeId: E1, previous_publish_at: null, publish_at: SLOTS[0] }],
  ['non-uuid episodeId', { ...goodSlot, episodeId: 'nope' }],
  ['non-ISO publish_at', { ...goodSlot, publish_at: 'tomorrow' }],
] as const) {
  test(`unschedule: truncated record (${name}) is refused with no writes`, async () => {
    const f = world()
    await seedRecord(f, {
      kind: 'bulk_schedule',
      outcome: 'committed',
      slots: [goodSlot, bad],
    })
    const before = epSnap(f)
    const r = await unscheduleShowCore(f.client, deps(f), S1)
    assert.equal(r.success, false)
    assert.equal(r.wrote, false)
    assert.deepEqual(epSnap(f), before)
    assert.equal(updates(f).length, 0)
    assert.equal(lastAudit(f).diff.outcome, 'failed')
  })
}

test('unschedule: a malformed newest record never falls back to an older valid one', async () => {
  const f = world()
  await applyShowScheduleCore(f.client, deps(f), S1) // valid older record
  await seedRecord(f, { kind: 'bulk_schedule', outcome: 'committed', slots: 'oops' })
  const before = epSnap(f)
  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, false)
  assert.deepEqual(epSnap(f), before)
  assert.equal(lastAudit(f).diff.reason, 'unreadable record')
})

test('unschedule: no bulk record at all uses the legacy reset, fully audited', async () => {
  const f = world([
    ep(E1, 1, { status: 'coming-soon', publish_at: SLOTS[0] }),
    ep(E2, 2, { status: 'coming-soon', publish_at: SLOTS[1] }),
    ep(E3, 3),
  ])
  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, true)
  assert.equal(r.data?.cleared, 2)
  assert.equal(epRow(f, E1).status, 'draft')
  assert.equal(epRow(f, E1).publish_at, null)
  const diff = lastAudit(f).diff
  assert.equal(diff.kind, 'bulk_unschedule')
  assert.equal(diff.source, 'legacy')
  assert.deepEqual(
    diff.reverted.map((x: Row) => x.episodeId).sort(),
    [E1, E2]
  )
  assert.deepEqual(diff.reverted.find((x: Row) => x.episodeId === E1).from, {
    status: 'coming-soon',
    publish_at: SLOTS[0],
  })
})

test('unschedule: forced failure on the 2nd episode update puts reverted rows back', async () => {
  const f = world()
  await applyShowScheduleCore(f.client, deps(f), S1)
  const before = epSnap(f)
  // apply used 4 updates; the unschedule's 1st and 2nd are the next two.
  f.failOn({ table: 'episodes', op: 'update', nth: 6 })
  const r = await unscheduleShowCore(f.client, deps(f), S1)
  assert.equal(r.success, false)
  assert.equal(r.wrote, true)
  assert.equal(r.data?.showId, S1)
  assert.deepEqual(epSnap(f), before)
  assert.equal(lastAudit(f).diff.outcome, 'failed')
})
