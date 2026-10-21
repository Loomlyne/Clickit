import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createShowCore,
  deleteShowCore,
  reorderShowCore,
  updateShowCore,
} from '../../src/lib/admin/show-writes.ts'
import { INVALID_UPDATED_AT, SAVE_CONFLICT } from '../../src/lib/admin/row-version.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = id('a')
const B = id('b')
const C = id('c')
const D = id('d') // archived
const CAT1 = id('1', 1)
const CAT2 = id('2', 2)

// The exact PostgREST JSON format of a timestamptz.
const STAMP = '2026-10-20T16:43:24.123456+00:00'

const show = (sid: string, title: string, sort: number, archived = false): Row => ({
  id: sid,
  updated_at: STAMP,
  title,
  slug: title.toLowerCase().replace(/ /g, '-'),
  description: `${title} description`,
  status: 'published',
  genre: 'Drama',
  sort_order: sort,
  archived,
  created_at: `2025-01-0${sort + 1}T00:00:00.000Z`,
})

function world() {
  return createFakeSupabase({
    shows: [show(A, 'Show A', 0), show(B, 'Show B', 1), show(C, 'Show C', 2), show(D, 'Show D', 3, true)],
    show_categories: [{ show_id: A, category_id: CAT1 }],
  })
}

function deps(f: ReturnType<typeof world>) {
  return { audit: f.auditWriter, adminUserId: 'admin-1' }
}

function mediaStub() {
  const state = { staged: 0, committed: 0, rolledBack: 0 }
  return {
    state,
    media: {
      async stage() {
        state.staged++
        return [
          {
            commit: async () => {
              state.committed++
              return true
            },
            rollback: async () => {
              state.rolledBack++
            },
          },
        ]
      },
    },
  }
}

const upd = (over: Record<string, unknown> = {}) => ({
  title: 'Show A2',
  slug: 'show-a2',
  description: 'new description',
  ...over,
})
const snapShowsAndCats = (f: ReturnType<typeof world>) => ({
  shows: f.snapshot().shows,
  // The fake stamps an id on re-inserted rows; the real table has none.
  show_categories: (f.snapshot().show_categories ?? []).map((r) => [r.show_id, r.category_id]),
})
const dbOps = (f: ReturnType<typeof world>, table: string, op: string) =>
  f.calls.filter((c) => c.table === table && c.op === op)

test('updateShowCore: forced category insert failure leaves show and categories as before', async () => {
  const f = world()
  const before = snapShowsAndCats(f)
  f.failOn({ table: 'show_categories', op: 'insert', nth: 1 })
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /forced failure/)
  assert.deepEqual(snapShowsAndCats(f), before)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  const diff = rows[0]!.diff
  assert.equal(diff.outcome, 'failed')
  assert.equal(diff.failed_step, 'insert-categories')
  assert.ok(diff.undone.includes('update-show'))
  assert.ok(diff.undone.includes('delete-categories'))
})

test('updateShowCore: forced category delete failure restores the show row', async () => {
  const f = world()
  const before = snapShowsAndCats(f)
  f.failOn({ table: 'show_categories', op: 'delete', nth: 1 })
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.deepEqual(snapShowsAndCats(f), before)
})

test('updateShowCore: forced shows update failure attempts no category writes', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.equal(dbOps(f, 'show_categories', 'delete').length, 0)
  assert.equal(dbOps(f, 'show_categories', 'insert').length, 0)
})

test('updateShowCore: archived show is refused unchanged', async () => {
  const f = world()
  const before = snapShowsAndCats(f)
  const res = await updateShowCore(f.client, deps(f), {
    id: D,
    updateData: upd({ slug: 'show-d2', title: 'Show D2' }) as never,
    categoryIds: [],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.equal(res.error, 'Restore this show before editing it.')
  assert.equal(res.wrote, false)
  assert.deepEqual(snapShowsAndCats(f), before)
})

test('updateShowCore: invalid id is refused with no db calls', async () => {
  const f = world()
  const res = await updateShowCore(f.client, deps(f), {
    id: 'x',
    updateData: upd() as never,
    categoryIds: [],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.equal(res.error, 'Invalid show id.')
  assert.equal(res.wrote, false)
  assert.equal(f.calls.length, 0)
})

test('updateShowCore: success replaces categories and writes a committed audit row', async () => {
  const f = world()
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2, CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, true)
  assert.deepEqual(
    f.tables.show_categories!.map((r) => [r.show_id, r.category_id]),
    [[A, CAT2]]
  )
  assert.equal(f.tables.shows!.find((s) => s.id === A)!.title, 'Show A2')
  assert.equal(f.auditRows()[0]!.diff.outcome, 'committed')
})

test('updateShowCore: forced failure reports wrote true and data.showId', async () => {
  const f = world()
  f.failOn({ table: 'show_categories', op: 'insert', nth: 1 })
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.wrote, true)
  assert.equal(res.data?.showId, A)
})

test('createShowCore: forced category insert failure leaves no show row behind', async () => {
  const f = world()
  const before = f.snapshot().shows
  f.failOn({ table: 'show_categories', op: 'insert', nth: 1 })
  const res = await createShowCore(f.client, deps(f), {
    insertData: { title: 'New Show', slug: 'new-show', genre: 'Drama' },
    categoryIds: [CAT2],
  })
  assert.equal(res.success, false)
  assert.deepEqual(f.snapshot().shows, before)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.diff.outcome, 'failed')
})

test('createShowCore: success inserts at the end with categories and a committed audit row', async () => {
  const f = world()
  const res = await createShowCore(f.client, deps(f), {
    insertData: { title: 'New Show', slug: 'new-show', genre: 'Drama' },
    categoryIds: [CAT2],
  })
  assert.equal(res.success, true)
  const created = f.tables.shows!.find((s) => s.slug === 'new-show')!
  assert.equal(created.sort_order, 3)
  assert.equal(res.data?.showId, created.id)
  assert.equal(f.auditRows()[0]!.diff.outcome, 'committed')
})

test('deleteShowCore: active show is refused before staging media or deleting', async () => {
  const f = world()
  const m = mediaStub()
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, A)
  assert.equal(res.success, false)
  assert.equal(res.error, 'Archive this show before deleting it permanently.')
  assert.equal(m.state.staged, 0)
  assert.equal(dbOps(f, 'shows', 'delete').length, 0)
})

test('deleteShowCore: missing show is refused with no audit row and no delete', async () => {
  const f = world()
  const m = mediaStub()
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, id('9', 9))
  assert.equal(res.success, false)
  assert.equal(res.error, 'Show not found.')
  assert.equal(f.auditRows().length, 0)
  assert.equal(dbOps(f, 'shows', 'delete').length, 0)
})

test('deleteShowCore: pending audit failure deletes nothing and rolls media back', async () => {
  const f = world()
  const m = mediaStub()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, D)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(dbOps(f, 'shows', 'delete').length, 0)
  assert.equal(m.state.rolledBack, m.state.staged)
  assert.equal(m.state.committed, 0)
  assert.ok(f.tables.shows!.some((s) => s.id === D))
})

test('deleteShowCore: forced delete failure rolls media back and writes pending then failed rows', async () => {
  const f = world()
  const m = mediaStub()
  f.failOn({ table: 'shows', op: 'delete', nth: 1 })
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, D)
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.match(res.error ?? '', /forced failure/)
  assert.equal(m.state.rolledBack, 1)
  assert.equal(m.state.committed, 0)
  const rows = f.auditRows().filter((r) => r.entity_id === D)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]!.diff.outcome, 'pending')
  assert.equal(rows[1]!.diff.outcome, 'failed')
  assert.equal(rows[1]!.diff.failed_step, 'delete-show')
  assert.deepEqual(rows[1]!.diff.undone, [])
  assert.deepEqual(rows[1]!.diff.left_in_place, [])
  assert.match(rows[1]!.diff.error, /forced failure/)
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
})

test('deleteShowCore: success writes pending before delete and committed after, then commits media', async () => {
  const f = world()
  const m = mediaStub()
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, D)
  assert.equal(res.success, true)
  assert.equal(res.data?.showId, D)
  const rows = f.auditRows()
  assert.deepEqual(rows.map((r) => r.diff.outcome), ['pending', 'committed'])
  assert.equal(rows[0]!.diff.attempt_id, rows[1]!.diff.attempt_id)
  assert.equal(rows[1]!.diff.title, 'Show D')
  assert.equal(rows[1]!.diff.slug, 'show-d')
  const order = f.calls.map((c) => `${c.table}:${c.op}`)
  const auditIdx = order
    .map((k, i) => (k === 'admin_audit_log:insert' ? i : -1))
    .filter((i) => i >= 0)
  const delIdx = order.indexOf('shows:delete')
  assert.ok(auditIdx[0]! < delIdx && delIdx < auditIdx[1]!)
  assert.equal(m.state.committed, 1)
  assert.ok(!f.tables.shows!.some((s) => s.id === D))
})

test('deleteShowCore: terminal audit failure after delete still commits media and names the attempt', async () => {
  const f = world()
  const m = mediaStub()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 2 })
  const res = await deleteShowCore(f.client, { ...deps(f), media: m.media }, D)
  assert.equal(res.success, false)
  assert.ok(!f.tables.shows!.some((s) => s.id === D))
  assert.equal(m.state.committed, 1)
  const attempt = f.auditRows()[0]!.diff.attempt_id
  assert.match(res.error ?? '', /deleted/)
  assert.ok((res.error ?? '').includes(attempt))
  assert.equal(f.auditRows().length, 1)
})

test('reorderShowCore: invalid direction is refused with no writes and no audit', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await reorderShowCore(f.client, deps(f), { id: B, direction: 'sideways' })
  assert.equal(res.success, false)
  assert.equal(res.error, 'Invalid direction.')
  assert.equal(res.wrote, false)
  assert.deepEqual(f.snapshot(), before)
})

test('reorderShowCore: second update failure restores the first show sort_order', async () => {
  const f = world()
  const before = f.snapshot().shows
  f.failOn({ table: 'shows', op: 'update', nth: 2 })
  const res = await reorderShowCore(f.client, deps(f), { id: B, direction: 'up' })
  assert.equal(res.success, false)
  assert.match(res.error ?? '', /forced failure/)
  assert.equal(res.wrote, true)
  assert.deepEqual(f.snapshot().shows, before)
})

test('reorderShowCore: success swaps sort_order and audits', async () => {
  const f = world()
  const res = await reorderShowCore(f.client, deps(f), { id: B, direction: 'up' })
  assert.equal(res.success, true)
  const so = (sid: string) => f.tables.shows!.find((s) => s.id === sid)!.sort_order
  assert.equal(so(B), 0)
  assert.equal(so(A), 1)
  assert.equal(f.auditRows()[0]!.diff.outcome, 'committed')
})

// ---- Deferred item 23 residual (b): the show drawer save checks updated_at ----

/** Same rows, with the shows BEFORE UPDATE trigger (updated_at = now()) emulated. */
function triggerWorld() {
  return createFakeSupabase(
    {
      shows: [show(A, 'Show A', 0), show(B, 'Show B', 1), show(C, 'Show C', 2), show(D, 'Show D', 3, true)],
      show_categories: [{ show_id: A, category_id: CAT1 }],
    },
    { updatedAtTables: ['shows'] }
  )
}
const rowA = (f: ReturnType<typeof triggerWorld>) => f.tables.shows!.find((s) => s.id === A)!

test('updateShowCore: a stale updated_at is refused with the conflict line; nothing written, no audit row', async () => {
  const f = triggerWorld()
  const before = f.snapshot()
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: '2026-10-20T16:43:20.000001+00:00',
  })
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(res.wrote, false)
  assert.deepEqual(f.snapshot(), before)
  assert.equal(dbOps(f, 'show_categories', 'delete').length, 0)
  assert.equal(dbOps(f, 'show_categories', 'insert').length, 0)
})

test('updateShowCore: a fresh updated_at saves and returns the new value from the database', async () => {
  const f = triggerWorld()
  const res = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, true, res.error)
  assert.equal(rowA(f).title, 'Show A2')
  assert.equal(typeof res.updatedAt, 'string')
  assert.notEqual(res.updatedAt, STAMP)
  assert.equal(res.updatedAt, rowA(f).updated_at)
  const update = f.calls.find((c) => c.table === 'shows' && c.op === 'update')!
  assert.ok(update.filters.some((x) => x.kind === 'eq' && x.col === 'updated_at' && x.value === STAMP))
})

test('updateShowCore: two sequential saves from the same drawer both succeed', async () => {
  const f = triggerWorld()
  const first = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(first.success, true, first.error)
  const second = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd({ title: 'Show A3', slug: 'show-a3' }) as never,
    categoryIds: [CAT1],
    expectedUpdatedAt: first.updatedAt,
  })
  assert.equal(second.success, true, second.error)
  assert.equal(rowA(f).title, 'Show A3')
  assert.equal(second.updatedAt, rowA(f).updated_at)
  // Re-sending the first value now is stale.
  const third = await updateShowCore(f.client, deps(f), {
    id: A,
    updateData: upd({ title: 'Show A4', slug: 'show-a4' }) as never,
    categoryIds: [CAT1],
    expectedUpdatedAt: first.updatedAt,
  })
  assert.equal(third.error, SAVE_CONFLICT)
  assert.equal(rowA(f).title, 'Show A3')
})

test('updateShowCore: a missing or malformed updated_at is refused before any database call', async () => {
  for (const bad of [undefined, null, '', 'now', 42]) {
    const f = triggerWorld()
    const res = await updateShowCore(f.client, deps(f), {
      id: A,
      updateData: upd() as never,
      categoryIds: [CAT2],
      expectedUpdatedAt: bad,
    })
    assert.equal(res.success, false)
    assert.equal(res.error, INVALID_UPDATED_AT)
    assert.equal(res.wrote, false)
    assert.equal(f.calls.length, 0, String(bad))
  }
})

test('updateShowCore: the undo after a failed category step does not overwrite a save that landed after ours', async () => {
  const f = triggerWorld()
  // Another admin saves right after our shows update, before our category insert fails.
  const client = f.client
  let updates = 0
  const db = {
    from: (t: string) => {
      const b = client.from(t)
      if (t === 'show_categories') {
        const orig = b.insert.bind(b)
        b.insert = (rows: unknown) => {
          if (updates++ === 0) {
            const row = f.tables.shows!.find((s) => s.id === A)!
            row.title = 'Theirs'
            row.updated_at = '2026-10-20T16:59:59.999999+00:00'
          }
          return orig(rows)
        }
      }
      return b
    },
  } as never
  f.failOn({ table: 'show_categories', op: 'insert', nth: 1 })
  const res = await updateShowCore(db, deps(f), {
    id: A,
    updateData: upd() as never,
    categoryIds: [CAT2],
    expectedUpdatedAt: STAMP,
  })
  assert.equal(res.success, false)
  assert.equal(rowA(f).title, 'Theirs', 'the undo is compare-and-swap on the value we wrote')
})

test('reorderShowCore: a sort_order that changed since the read is refused, nothing moved', async () => {
  const f = world()
  const client = f.client
  let reads = 0
  const db = {
    from: (t: string) => {
      const b = client.from(t)
      if (t === 'shows') {
        const then = b.then.bind(b)
        b.then = (ok: unknown, ko: unknown) =>
          then((v: unknown) => {
            // Another admin reordered right after our list read.
            if (++reads === 1) f.tables.shows!.find((s) => s.id === B)!.sort_order = 7
            return (ok as (x: unknown) => unknown)(v)
          }, ko as never)
      }
      return b
    },
  } as never
  const res = await reorderShowCore(db, deps(f), { id: B, direction: 'up' })
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(res.wrote, false)
  const so = (sid: string) => f.tables.shows!.find((s) => s.id === sid)!.sort_order
  assert.equal(so(B), 7)
  assert.equal(so(A), 0)
  assert.equal(f.auditRows().length, 0)
})

test('reorderShowCore: the second row moved meanwhile: the first move is undone, conflict line', async () => {
  const f = world()
  const client = f.client
  let reads = 0
  const db = {
    from: (t: string) => {
      const b = client.from(t)
      if (t === 'shows') {
        const then = b.then.bind(b)
        b.then = (ok: unknown, ko: unknown) =>
          then((v: unknown) => {
            if (++reads === 1) f.tables.shows!.find((s) => s.id === A)!.sort_order = 9
            return (ok as (x: unknown) => unknown)(v)
          }, ko as never)
      }
      return b
    },
  } as never
  const res = await reorderShowCore(db, deps(f), { id: B, direction: 'up' })
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  const so = (sid: string) => f.tables.shows!.find((s) => s.id === sid)!.sort_order
  assert.equal(so(B), 1, 'first move undone')
  assert.equal(so(A), 9, 'their value kept')
})
