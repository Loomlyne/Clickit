// Review item 8 (PR #29): the updated_at compare-and-swap (9a953f9/b73b30c pattern) for the
// remaining admin form saves: categories, shorts, FAQs, seasons and episodes (legal pages:
// legal-pages-arabic.test.ts). A stale editor gets the existing conflict line and nothing is
// written; a fresh one gets the new updated_at back for its next save.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { INVALID_UPDATED_AT, SAVE_CONFLICT, rowVersion, updateIfUnchanged } from '../../src/lib/admin/row-version.ts'
import { updateEpisodeCore, updateSeasonCore } from '../../src/lib/admin/season-episode-writes.ts'
import { createRowVersionChains } from '../../src/lib/admin/version-chain.ts'
import { createFakeSupabase, type Row } from './helpers/fake-supabase.ts'

const id = (p: string, n = 0) => `${p.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`
const S1 = id('a')
const SE1 = id('c')
const E1 = id('e', 1)
const E3 = id('e', 3)
const V0 = '2026-10-20T10:00:00.000001+00:00'
const OLD = '2026-10-19T10:00:00.000001+00:00'

// ---- updateIfUnchanged on the list tables ----------------------------------------

for (const table of ['categories', 'shorts', 'faqs'] as const) {
  test(`updateIfUnchanged(${table}): fresh lands with the new updated_at, stale writes nothing`, async () => {
    const f = createFakeSupabase({ [table]: [{ id: 'r1', name: 'a', updated_at: V0 }] }, { updatedAtTables: [table] })
    const stale = rowVersion(OLD)
    assert.ok(stale.ok)
    const before = f.snapshot()
    const r1 = await updateIfUnchanged(f.client, table, 'r1', { name: 'b' }, stale.value, '*')
    assert.equal(r1.error, SAVE_CONFLICT)
    assert.deepEqual(f.snapshot(), before)

    const fresh = rowVersion(V0)
    assert.ok(fresh.ok)
    const r2 = await updateIfUnchanged(f.client, table, 'r1', { name: 'b' }, fresh.value, '*')
    assert.equal(r2.error, null)
    assert.equal(r2.row?.name, 'b')
    assert.ok(fresh.value.next && fresh.value.next !== V0)
    assert.equal(r2.row?.updated_at, fresh.value.next)
  })
}

// ---- seasons and episodes ---------------------------------------------------------

const ep = (eid: string, num: number, archived = false): Row => ({
  id: eid, show_id: S1, season_id: SE1, title: `Episode ${num}`, title_ar: `حلقة ${num}`,
  description: `D ${num}`, description_ar: `و ${num}`, episode_number: num, youtube_video_id: null,
  duration: 600, status: 'draft', publish_at: null, archived, updated_at: V0,
})

function world() {
  return createFakeSupabase(
    {
      shows: [{ id: S1, title: 'Show 1', season_count: 1, episode_count: 1 }],
      seasons: [{ id: SE1, show_id: S1, title: 'Season 1', title_ar: '', season_number: 1, episode_count: 1, updated_at: V0 }],
      episodes: [ep(E1, 1), ep(E3, 3, true)],
    },
    { updatedAtTables: ['seasons', 'episodes'] }
  )
}

function deps(f: ReturnType<typeof world>) {
  const fills: unknown[] = []
  return {
    fills,
    audit: f.auditWriter,
    adminUserId: 'admin-1',
    fillArabic: async (en: string | null | undefined, ar: string | null | undefined) => {
      fills.push(en)
      return (ar ?? '').trim() ? (ar as string) : `ar-${en}`
    },
  }
}

test('updateSeasonCore: missing or malformed updated_at refused before any read', async () => {
  for (const bad of [undefined, '', 'now']) {
    const f = world()
    const res = await updateSeasonCore(f.client, deps(f), SE1, { title: 'New' }, bad)
    assert.equal(res.error, INVALID_UPDATED_AT)
    assert.equal(res.wrote, false)
    assert.equal(f.calls.length, 0)
  }
})

test('updateSeasonCore: stale updated_at is the conflict line; no AI call, no write, no audit', async () => {
  const f = world()
  const d = deps(f)
  const before = f.snapshot()
  const res = await updateSeasonCore(f.client, d, SE1, { title: 'New', title_ar: '' }, OLD)
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(res.wrote, false)
  assert.equal(d.fills.length, 0)
  assert.deepEqual(f.snapshot(), before)
})

test('updateSeasonCore: fresh save returns the new updated_at; a second save chains on it', async () => {
  const f = world()
  const res = await updateSeasonCore(f.client, deps(f), SE1, { title: 'New' }, V0)
  assert.equal(res.success, true)
  const next = (res as { updatedAt?: string }).updatedAt
  assert.ok(next && next !== V0)
  assert.equal(f.snapshot().seasons![0]!.updated_at, next)
  const again = await updateSeasonCore(f.client, deps(f), SE1, { title: 'Newer' }, next)
  assert.equal(again.success, true)
  assert.equal((await updateSeasonCore(f.client, deps(f), SE1, { title: 'X' }, V0)).error, SAVE_CONFLICT)
})

test('updateSeasonCore: a save that lands during the AI fill still conflicts (atomic CAS)', async () => {
  const f = world()
  const d = deps(f)
  d.fillArabic = async (en) => {
    f.tables.seasons![0]!.updated_at = '2026-10-20T10:00:09.000001+00:00'
    return `ar-${en}`
  }
  const res = await updateSeasonCore(f.client, d, SE1, { title: 'New', title_ar: '' }, V0)
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(f.tables.seasons![0]!.title, 'Season 1')
  const upd = f.calls.find((c) => c.table === 'seasons' && c.op === 'update')
  assert.ok(upd?.filters.some((x) => x.kind === 'eq' && x.col === 'updated_at' && x.value === V0))
  assert.equal(f.auditRows().filter((r) => r.diff?.outcome !== 'failed').length, 0)
})

test('updateEpisodeCore: missing updated_at refused before any read; stale refused before any AI call', async () => {
  const f = world()
  assert.equal((await updateEpisodeCore(f.client, deps(f), E1, { title: 'R' }, undefined)).error, INVALID_UPDATED_AT)
  assert.equal(f.calls.length, 0)
  const d = deps(f)
  const before = f.snapshot()
  const res = await updateEpisodeCore(f.client, d, E1, { title: 'R', title_ar: '' }, OLD)
  assert.equal(res.error, SAVE_CONFLICT)
  assert.equal(d.fills.length, 0)
  assert.deepEqual(f.snapshot(), before)
})

test('updateEpisodeCore: fresh save returns the new updated_at', async () => {
  const f = world()
  const res = await updateEpisodeCore(f.client, deps(f), E1, { title: 'Renamed' }, V0)
  assert.equal(res.success, true)
  const next = (res as { updatedAt?: string }).updatedAt
  assert.ok(next && next !== V0)
  assert.equal(f.snapshot().episodes!.find((r) => r.id === E1)!.updated_at, next)
})

test('updateEpisodeCore: a save landing between read and write conflicts and the archived bump is undone', async () => {
  const f = world()
  const d = deps(f)
  // Moving to number 3 bumps the archived holder first; another admin saves E1 meanwhile.
  f.tables.episodes!.find((r) => r.id === E1)!.updated_at = V0
  const origFrom = f.client.from.bind(f.client)
  let bumped = false
  f.client.from = (t: string) => {
    const b = origFrom(t)
    if (t === 'episodes' && !bumped) {
      const upd = b.update.bind(b)
      b.update = (patch: Row) => {
        if ('episode_number' in patch && !('title' in patch) && patch.episode_number !== 3) {
          bumped = true
          f.tables.episodes!.find((r) => r.id === E1)!.updated_at = '2026-10-20T10:00:09.000001+00:00'
        }
        return upd(patch)
      }
    }
    return b
  }
  const res = await updateEpisodeCore(f.client, d, E1, { episode_number: 3 }, V0)
  assert.equal(res.success, false)
  assert.equal(res.error, SAVE_CONFLICT)
  const rows = f.snapshot().episodes!
  assert.equal(rows.find((r) => r.id === E1)!.episode_number, 1)
  assert.equal(rows.find((r) => r.id === E3)!.episode_number, 3, 'the bump was undone')
})

// ---- client chains ----------------------------------------------------------------

test('createRowVersionChains: one chain per row; rows sharing an updated_at never move each other', () => {
  const c = createRowVersionChains()
  assert.equal(c.resolve('a', V0), V0)
  c.link('a', V0, 'v1')
  assert.equal(c.resolve('a', V0), 'v1')
  assert.equal(c.resolve('b', V0), V0, 'row b loaded at the same updated_at is not moved')
  c.link('a', 'v1', 'v2')
  assert.equal(c.resolve('a', V0), 'v2')
})

// ---- wiring -----------------------------------------------------------------------

const actions = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
function bodyOf(name: string): string {
  const start = actions.indexOf(`export async function ${name}(`)
  assert.notEqual(start, -1, `${name} not found`)
  const next = actions.indexOf('\nexport ', start + 10)
  return actions.slice(start, next === -1 ? undefined : next)
}

test('updateCategory, updateShort and upsertFaq (update branch) write through updateIfUnchanged', () => {
  for (const [name, table] of [['updateCategory', 'categories'], ['updateShort', 'shorts'], ['upsertFaq', 'faqs']] as const) {
    const b = bodyOf(name)
    assert.match(b, /expectedUpdatedAt/, `${name} takes expectedUpdatedAt`)
    assert.match(b, /rowVersion\(expectedUpdatedAt\)/, `${name} validates it`)
    assert.ok(b.includes(`updateIfUnchanged(`) && b.includes(`'${table}'`), `${name} writes ${table} through updateIfUnchanged`)
    assert.ok(!new RegExp(`from\\('${table}'\\)\\s*\\.update\\(`).test(b), `${name} has no plain update`)
    assert.match(b, /withUpdatedAt\(|\bupdatedAt\b/, `${name} returns the new updatedAt`)
  }
  const faq = bodyOf('upsertFaq')
  assert.ok(faq.indexOf('rowVersion(expectedUpdatedAt)') < faq.indexOf('createArabicFiller('), 'FAQ version is checked before any AI call')
})

test('updateSeason and updateEpisode pass the editor version to their cores and return it', () => {
  for (const [name, core] of [['updateSeason', 'updateSeasonCore'], ['updateEpisode', 'updateEpisodeCore']] as const) {
    const b = bodyOf(name)
    assert.match(b, /expectedUpdatedAt/)
    assert.match(b, new RegExp(`${core}\\([\\s\\S]*?expectedUpdatedAt\\s*\\)`))
  }
  const cores = readFileSync('src/lib/admin/season-episode-writes.ts', 'utf8')
  assert.equal((cores.match(/\.eq\('updated_at', expected\)/g) ?? []).length, 2, 'season and episode UPDATE carry the CAS')
  assert.equal((cores.match(/\.eq\('updated_at', written\)/g) ?? []).length, 2, 'their undo is CAS on the value written')
})

test('getFaqs reads updated_at; reorderCategories returns the new versions to the page', () => {
  assert.match(actions, /\.select\('id, question, answer, question_ar, answer_ar, sort_order, updated_at'\)/)
  const reorder = bodyOf('reorderCategories')
  assert.match(reorder, /\.select\('id, sort_order, updated_at'\)/)
  const manager = readFileSync('src/components/admin/categories-manager.tsx', 'utf8')
  assert.match(manager, /mergeVersions\(|updated_at: v\.updated_at/)
})
