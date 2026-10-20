import assert from 'node:assert/strict'
import test from 'node:test'
import {
  archiveShowCore,
  restoreShowCore,
} from '../../src/lib/admin/show-archive.ts'
import { archiveSlugForShow } from '../../src/lib/admin/show-namespace.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) =>
  `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = id('a')
const B = id('b')
const SA = id('c')
const SB = id('d')
const E = (n: number) => id('e', n)
const V = id('9', 1) // visible episode in A's season
const FB = id('f', 1) // B's episode

const PLACEHOLDER = archiveSlugForShow(A)

function recordRow(over: Partial<Row> = {}, diff: Partial<Row> = {}): Row {
  return {
    id: id('1', 1),
    created_at: '2025-12-01T00:00:00.000Z',
    admin_user_id: 'admin-1',
    action_type: 'archive',
    entity_type: 'show',
    entity_id: A,
    diff: {
      outcome: 'committed',
      title: 'Show A',
      previous_slug: 'show-a',
      archived_episode_ids: [E(1), E(2), E(3), E(4)],
      ...diff,
    },
    ...over,
  }
}

function world(opts: { archivedA?: boolean; record?: boolean | Row[] } = {}) {
  const archivedA = opts.archivedA ?? true
  const audit: Row[] =
    opts.record === false
      ? []
      : Array.isArray(opts.record)
        ? opts.record
        : [recordRow()]
  const ep = (n: number): Row => ({
    id: E(n),
    show_id: A,
    season_id: SA,
    episode_number: n,
    title: `Ep ${n}`,
    archived: true,
  })
  return createFakeSupabase({
    shows: [
      {
        id: A,
        title: 'Show A',
        title_ar: null,
        slug: archivedA ? PLACEHOLDER : 'show-a',
        archived: archivedA,
      },
      {
        id: B,
        title: 'Show B',
        title_ar: null,
        slug: 'show-b',
        archived: false,
      },
    ],
    seasons: [
      { id: SA, show_id: A, season_number: 1 },
      { id: SB, show_id: B, season_number: 1 },
    ],
    episodes: [
      ep(1),
      ep(2),
      ep(3),
      ep(4),
      {
        id: V,
        show_id: A,
        season_id: SA,
        episode_number: 10,
        title: 'Visible 10',
        archived: false,
      },
      {
        id: FB,
        show_id: B,
        season_id: SB,
        episode_number: 1,
        title: 'B one',
        archived: false,
      },
    ],
    admin_audit_log: audit,
  })
}

type Fake = ReturnType<typeof createFakeSupabase>

function deps(f: Fake, fill: (en: string | null | undefined, ar: string | null | undefined) => Promise<string | null> = async () => null) {
  return { audit: f.auditWriter, adminUserId: 'admin-1', fillArabic: fill }
}

const restore = (
  f: Fake,
  input: { showId?: unknown; rename?: unknown; fixes?: unknown },
  fill?: Parameters<typeof deps>[1]
) =>
  restoreShowCore(f.client, deps(f, fill), {
    showId: input.showId === undefined ? A : input.showId,
    rename: input.rename,
    fixes: input.fixes,
  })

const row = (f: Fake, table: string, rid: string) =>
  f.tables[table].find((r) => r.id === rid) as Row

const auditOf = (f: Fake, action: string) =>
  f.auditRows().filter((r) => r.action_type === action && r.id !== id('1', 1))

async function refused(
  f: Fake,
  input: Parameters<typeof restore>[1],
  messagePart?: string
) {
  const before = f.snapshot()
  const res = await restore(f, input)
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  if (messagePart) assert.match(res.error ?? '', new RegExp(messagePart))
  assert.deepEqual(f.snapshot(), before)
}

// ---- validation -----------------------------------------------------------

for (const [label, bad] of [
  ['zero', 0],
  ['negative', -1],
  ['fractional', 1.5],
  ['NaN', Number.NaN],
] as const) {
  test(`restore refuses ${label} episode number and changes nothing`, async () => {
    const f = world()
    await refused(f, { fixes: [{ episodeId: E(3), newEpisodeNumber: bad }] })
  })
}

test('restore refuses an episode id from another show', async () => {
  const f = world()
  await refused(
    f,
    { fixes: [{ episodeId: FB, newEpisodeNumber: 5 }] },
    'not part of this show'
  )
  assert.equal(row(f, 'episodes', FB).episode_number, 1)
})

test('restore refuses a fix for an episode that is not archived', async () => {
  const f = world()
  await refused(
    f,
    { fixes: [{ episodeId: V, newEpisodeNumber: 11 }] },
    'not part of this show'
  )
})

test('restore of a show that is not archived is refused', async () => {
  const f = world({ archivedA: false })
  await refused(f, {}, 'Only archived shows can be restored.')
})

test('restore refuses a 201 character title and an unknown rename key', async () => {
  const f = world()
  await refused(f, { rename: { title: 'x'.repeat(201) } })
  await refused(f, { rename: { title: 'ok', archived: false } })
})

// ---- happy path and round trip ---------------------------------------------

test('plain restore brings the show and its archived episodes back', async () => {
  const f = world()
  const res = await restore(f, {})
  assert.equal(res.success, true)
  const show = row(f, 'shows', A)
  assert.equal(show.archived, false)
  assert.equal(show.slug, 'show-a')
  for (const n of [1, 2, 3, 4]) assert.equal(row(f, 'episodes', E(n)).archived, false)
})

test('archive then restore keeps a custom slug and an episode archived earlier stays archived', async () => {
  const f = createFakeSupabase({
    shows: [{ id: A, title: 'Show A', title_ar: null, slug: 'my-custom-slug', archived: false }],
    seasons: [{ id: SA, show_id: A, season_number: 1 }],
    episodes: [
      { id: E(1), show_id: A, season_id: SA, episode_number: 1, title: 'one', archived: false },
      { id: E(2), show_id: A, season_id: SA, episode_number: 2, title: 'two', archived: false },
      { id: E(3), show_id: A, season_id: SA, episode_number: 3, title: 'old', archived: true },
    ],
  })
  const arch = await archiveShowCore(f.client, { audit: f.auditWriter, adminUserId: 'admin-1' }, A)
  assert.equal(arch.success, true)
  assert.equal(row(f, 'shows', A).slug, PLACEHOLDER)
  assert.equal(row(f, 'shows', A).archived, true)
  const res = await restore(f, {})
  assert.equal(res.success, true, res.error)
  assert.equal(row(f, 'shows', A).slug, 'my-custom-slug')
  assert.equal(row(f, 'shows', A).archived, false)
  assert.equal(row(f, 'episodes', E(1)).archived, false)
  assert.equal(row(f, 'episodes', E(2)).archived, false)
  assert.equal(row(f, 'episodes', E(3)).archived, true)
})

// ---- audit -----------------------------------------------------------------

test('archive writes one audit row with previous_slug and archived_episode_ids', async () => {
  const f = createFakeSupabase({
    shows: [{ id: A, title: 'Show A', title_ar: null, slug: 'my-show', archived: false }],
    seasons: [{ id: SA, show_id: A, season_number: 1 }],
    episodes: [
      { id: E(1), show_id: A, season_id: SA, episode_number: 1, title: 'one', archived: false },
      { id: E(2), show_id: A, season_id: SA, episode_number: 2, title: 'two', archived: true },
    ],
  })
  const res = await archiveShowCore(f.client, { audit: f.auditWriter, adminUserId: 'admin-1' }, A)
  assert.equal(res.success, true)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].action_type, 'archive')
  assert.equal(rows[0].entity_id, A)
  assert.equal(rows[0].diff.outcome, 'committed')
  assert.equal(rows[0].diff.previous_slug, 'my-show')
  assert.deepEqual(rows[0].diff.archived_episode_ids, [E(1)])
})

test('restore writes one restore audit row with fixes and restored ids', async () => {
  const f = world()
  const res = await restore(f, { fixes: [{ episodeId: E(3), newEpisodeNumber: 30 }] })
  assert.equal(res.success, true, res.error)
  const rows = auditOf(f, 'restore')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].diff.outcome, 'committed')
  assert.deepEqual(rows[0].diff.episode_fixes, [{ episodeId: E(3), from: 3, to: 30 }])
  assert.deepEqual([...rows[0].diff.restored_episode_ids].sort(), [E(1), E(2), E(3), E(4)].sort())
  assert.equal(row(f, 'episodes', E(3)).episode_number, 30)
})

// ---- atomicity -------------------------------------------------------------

test('archive: episodes update failure leaves the show active and audits the failure', async () => {
  const f = createFakeSupabase({
    shows: [{ id: A, title: 'Show A', title_ar: null, slug: 'my-show', archived: false }],
    seasons: [{ id: SA, show_id: A, season_number: 1 }],
    episodes: [
      { id: E(1), show_id: A, season_id: SA, episode_number: 1, title: 'one', archived: false },
    ],
  })
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const res = await archiveShowCore(f.client, { audit: f.auditWriter, adminUserId: 'admin-1' }, A)
  assert.equal(res.success, false)
  assert.ok(res.error)
  assert.equal(row(f, 'shows', A).archived, false)
  assert.equal(row(f, 'shows', A).slug, 'my-show')
  assert.equal(row(f, 'episodes', E(1)).archived, false)
  const rows = f.auditRows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].diff.outcome, 'failed')
  assert.equal(rows[0].diff.failed_step, 'archive-episodes')
  assert.deepEqual(rows[0].diff.undone, ['archive-show'])
})

test('restore: show update failure after fixes undoes the renumbering', async () => {
  const f = world()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  const res = await restore(f, { fixes: [{ episodeId: E(3), newEpisodeNumber: 30 }] })
  assert.equal(res.success, false)
  assert.ok(res.error)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  const rows = auditOf(f, 'restore')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].diff.outcome, 'failed')
  assert.equal(rows[0].diff.failed_step, 'restore-show')
})

test('restore: episodes un-archive failure re-archives the show with the placeholder slug', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  const res = await restore(f, {})
  assert.equal(res.success, false)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
  assert.equal(row(f, 'shows', A).archived, true)
  assert.equal(row(f, 'shows', A).slug, PLACEHOLDER)
  const rows = auditOf(f, 'restore')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].diff.outcome, 'failed')
  assert.deepEqual(rows[0].diff.undone, ['restore-show'])
})

test('restore: a failing undo is listed in left_in_place', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  f.failOn({ table: 'shows', op: 'update', nth: 2 })
  const res = await restore(f, {})
  assert.equal(res.success, false)
  const rows = auditOf(f, 'restore')
  assert.equal(rows.length, 1)
  assert.ok(
    rows[0].diff.left_in_place.some((x: Row) => x.step === 'restore-show')
  )
})

test('restore: audit insert failure undoes everything', async () => {
  const f = world()
  f.failOn({ table: 'admin_audit_log', op: 'insert', nth: 1 })
  const before = f.snapshot({ exclude: ['admin_audit_log'] })
  const res = await restore(f, { fixes: [{ episodeId: E(3), newEpisodeNumber: 30 }] })
  assert.equal(res.success, false)
  assert.deepEqual(f.snapshot({ exclude: ['admin_audit_log'] }), before)
})

// ---- conflicts and renumbering ----------------------------------------------

test('restore: swapping two archived episode numbers succeeds', async () => {
  const f = world()
  const res = await restore(f, {
    fixes: [
      { episodeId: E(3), newEpisodeNumber: 4 },
      { episodeId: E(4), newEpisodeNumber: 3 },
    ],
  })
  assert.equal(res.success, true, res.error)
  assert.equal(row(f, 'episodes', E(3)).episode_number, 4)
  assert.equal(row(f, 'episodes', E(4)).episode_number, 3)
})

test('restore: a fix landing on a number held by a visible episode returns conflicts and writes nothing', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await restore(f, { fixes: [{ episodeId: E(3), newEpisodeNumber: 10 }] })
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.conflicts?.length, 1)
  assert.equal(res.conflicts?.[0].episodeId, E(3))
  assert.equal(res.conflicts?.[0].conflictingEpisodeTitle, 'Visible 10')
  assert.deepEqual(f.snapshot(), before)
})

test('restore: two restored episodes ending on the same number return conflicts and write nothing', async () => {
  const f = world()
  const before = f.snapshot()
  const res = await restore(f, {
    fixes: [
      { episodeId: E(1), newEpisodeNumber: 20 },
      { episodeId: E(2), newEpisodeNumber: 20 },
    ],
  })
  assert.equal(res.success, false)
  assert.ok((res.conflicts?.length ?? 0) >= 1)
  assert.deepEqual(f.snapshot(), before)
})

// ---- rename ----------------------------------------------------------------

test('restore rename calls fillArabic and stores title_ar', async () => {
  const f = world()
  const calls: unknown[][] = []
  const res = await restore(
    f,
    { rename: { title: 'New Title' } },
    async (en, ar) => {
      calls.push([en, ar])
      return 'عنوان جديد'
    }
  )
  assert.equal(res.success, true, res.error)
  assert.deepEqual(calls, [['New Title', null]])
  assert.equal(row(f, 'shows', A).title, 'New Title')
  assert.equal(row(f, 'shows', A).title_ar, 'عنوان جديد')
})

test('restore rename stores null title_ar when fillArabic returns null', async () => {
  const f = world()
  const res = await restore(f, { rename: { title: 'New Title' } }, async () => null)
  assert.equal(res.success, true, res.error)
  assert.equal(row(f, 'shows', A).title_ar, null)
})

// ---- archive record --------------------------------------------------------

test('legacy show without an archive record restores every archived episode and audits legacy', async () => {
  const f = world({ record: false })
  const res = await restore(f, {})
  assert.equal(res.success, true, res.error)
  for (const n of [1, 2, 3, 4]) assert.equal(row(f, 'episodes', E(n)).archived, false)
  assert.equal(row(f, 'shows', A).slug, 'show-a')
  const rows = auditOf(f, 'restore')
  assert.equal(rows[0].diff.archive_record, 'legacy')
})

test('show archived twice restores from the newest committed record', async () => {
  const older = recordRow(
    { id: id('1', 1), created_at: '2025-11-01T00:00:00.000Z' },
    { previous_slug: 'old-slug', archived_episode_ids: [E(1)] }
  )
  const newer = recordRow(
    { id: id('1', 2), created_at: '2025-12-01T00:00:00.000Z' },
    { previous_slug: 'new-slug', archived_episode_ids: [E(1), E(2)] }
  )
  const f = world({ record: [newer, older] })
  const res = await restore(f, {})
  assert.equal(res.success, true, res.error)
  assert.equal(row(f, 'shows', A).slug, 'new-slug')
  assert.equal(row(f, 'episodes', E(1)).archived, false)
  assert.equal(row(f, 'episodes', E(2)).archived, false)
  assert.equal(row(f, 'episodes', E(3)).archived, true)
  const rows = f.auditRows().filter((r) => r.action_type === 'restore')
  assert.equal(rows[0].diff.archive_record_id, newer.id)
  assert.equal(rows[0].diff.archive_record, 'recorded')
})

test('previous slug since taken returns a show conflict and writes nothing', async () => {
  const f = world({ record: [recordRow({}, { previous_slug: 'my-show' })] })
  f.tables.shows.push({
    id: id('7', 1),
    title: 'Other',
    title_ar: null,
    slug: 'my-show',
    archived: false,
  })
  const before = f.snapshot()
  const res = await restore(f, {})
  assert.equal(res.success, false)
  assert.equal(res.wrote, false)
  assert.equal(res.showConflict?.slug, 'my-show')
  assert.equal(res.showConflict?.slugConflictTitle, 'Other')
  assert.deepEqual(f.snapshot(), before)
})

test('recorded episode ids that no longer exist are skipped and reported', async () => {
  const gone = id('e', 99)
  const f = world({
    record: [recordRow({}, { archived_episode_ids: [E(1), E(2), gone, FB] })],
  })
  const res = await restore(f, {})
  assert.equal(res.success, true, res.error)
  assert.equal(row(f, 'episodes', E(1)).archived, false)
  assert.equal(row(f, 'episodes', E(2)).archived, false)
  assert.equal(row(f, 'episodes', E(3)).archived, true)
  assert.equal(row(f, 'episodes', FB).archived, false)
  const rows = auditOf(f, 'restore')
  assert.deepEqual([...rows[0].diff.skipped_episode_ids].sort(), [gone, FB].sort())
})

test('the exact no-op payload archive-table sends restores without any renumber write', async () => {
  // visible blocker was deleted; the dialog is pre-filled with the stored number
  const f = world()
  const res = await restoreShowCore(f.client, deps(f), {
    showId: A,
    rename: {
      title: undefined,
      slug: undefined,
      episodeFixes: [{ episodeId: E(3), newEpisodeNumber: 3 }],
    },
  })
  assert.equal(res.success, true, res.error)
  const numberWrites = f.calls.filter(
    (c) =>
      c.table === 'episodes' &&
      c.op === 'update' &&
      c.patch &&
      'episode_number' in c.patch
  )
  assert.equal(numberWrites.length, 0)
  assert.equal(row(f, 'shows', A).slug, 'show-a')
  assert.equal(row(f, 'shows', A).title, 'Show A')
  const rows = auditOf(f, 'restore')
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].diff.episode_fixes, [])
  assert.equal(rows[0].diff.renamed_from, null)
})

// ---- result shape ----------------------------------------------------------

test('result carries wrote and showId on a mid-flow failure; validation refusal has wrote false', async () => {
  const f = world()
  f.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const res = await restore(f, {})
  assert.equal(res.success, false)
  assert.equal(res.wrote, true)
  assert.deepEqual(res.data, { showId: A })

  const g = world()
  const bad = await restore(g, { fixes: [{ episodeId: E(3), newEpisodeNumber: 0 }] })
  assert.equal(bad.wrote, false)
})
