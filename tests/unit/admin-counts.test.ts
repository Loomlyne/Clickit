import assert from 'node:assert/strict'
import test from 'node:test'
import {
  recomputeShowCounts,
  recomputeSeasonEpisodeCount,
} from '../../src/lib/admin/counts.ts'
import {
  getActiveShowNamespaceConflict,
  normalizeEnglishTitle,
  archiveSlugForShow,
} from '../../src/lib/admin/show-namespace.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

function seed() {
  return createFakeSupabase({
    shows: [
      { id: 'sh1', title: 'My Show', slug: 'my-show', archived: false, season_count: 0, episode_count: 0 },
      { id: 'sh2', title: 'Old', slug: 'old', archived: true },
    ],
    seasons: [
      { id: 's1', show_id: 'sh1', episode_count: 0 },
      { id: 's2', show_id: 'sh1', episode_count: 0 },
    ],
    episodes: [
      { id: 'e1', show_id: 'sh1', season_id: 's1', episode_number: 1, archived: false },
      { id: 'e2', show_id: 'sh1', season_id: 's1', episode_number: 2, archived: true },
      { id: 'e3', show_id: 'sh1', season_id: 's2', episode_number: 1, archived: false },
    ],
  })
}

test('recomputeShowCounts excludes archived episodes', async () => {
  const f = seed()
  const r = await recomputeShowCounts(f.client as any, 'sh1')
  assert.deepEqual(r, { error: null })
  const show = f.tables.shows.find((s: any) => s.id === 'sh1')
  assert.equal(show.season_count, 2)
  assert.equal(show.episode_count, 2)
})

test('recomputeSeasonEpisodeCount excludes archived episodes', async () => {
  const f = seed()
  const r = await recomputeSeasonEpisodeCount(f.client as any, 's1')
  assert.deepEqual(r, { error: null })
  assert.equal(f.tables.seasons.find((s: any) => s.id === 's1').episode_count, 1)
})

test('forced failure on count select is returned', async () => {
  const f = seed()
  f.failOn({ table: 'episodes', op: 'select', nth: 1 })
  const r = await recomputeShowCounts(f.client as any, 'sh1')
  assert.ok(r.error)
  assert.equal(f.tables.shows.find((s: any) => s.id === 'sh1').episode_count, 0)
})

test('forced failure on shows update is returned', async () => {
  const f = seed()
  f.failOn({ table: 'shows', op: 'update', nth: 1 })
  const r = await recomputeShowCounts(f.client as any, 'sh1')
  assert.equal(r.error, 'forced failure')
})

test('forced failure on season count update is returned', async () => {
  const f = seed()
  f.failOn({ table: 'seasons', op: 'update', nth: 1 })
  const r = await recomputeSeasonEpisodeCount(f.client as any, 's1')
  assert.equal(r.error, 'forced failure')
})

test('namespace conflict: normalized title, ignores archived and excludeId', async () => {
  const f = seed()
  const db = f.client as any
  const hit = await getActiveShowNamespaceConflict(db, { title: '  MY  show ', slug: 'other' })
  assert.equal(hit?.titleConflictTitle, 'My Show')
  assert.equal(hit?.slugConflictTitle, undefined)
  const slugHit = await getActiveShowNamespaceConflict(db, { title: 'zzz', slug: 'my-show' })
  assert.equal(slugHit?.slugConflictTitle, 'My Show')
  assert.equal(await getActiveShowNamespaceConflict(db, { title: 'Old', slug: 'old' }), null)
  assert.equal(
    await getActiveShowNamespaceConflict(db, { title: 'My Show', slug: 'my-show', excludeId: 'sh1' }),
    null
  )
})

test('pure helpers', () => {
  assert.equal(normalizeEnglishTitle('  A   B '), 'a b')
  assert.equal(archiveSlugForShow('12345678-aaaa'), 'archived-12345678')
})
