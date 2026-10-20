import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canDeletePermanently } from '../../src/lib/admin/guards.ts'

const archiveTable = readFileSync(
  new URL('../../src/components/admin/archive-table.tsx', import.meta.url),
  'utf8'
)
const episodesTable = readFileSync(
  new URL('../../src/components/admin/archive-episodes-table.tsx', import.meta.url),
  'utf8'
)

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length
}

// Pins: per-row show delete Tooltip wrapped in {canDeletePermanently(show) && (...)}
test('archive-table: per-row delete is guarded by canDeletePermanently(show)', () => {
  const guarded = count(
    archiveTable,
    /\{canDeletePermanently\(show\)\s*&&\s*\(\s*<(Tooltip|Button)\b[\s\S]{0,600}?handleDeleteClick\(show\)/g
  )
  const all = count(archiveTable, /handleDeleteClick\(show\)/g)
  assert.ok(guarded >= 1)
  assert.equal(guarded, all)
})

// Pins: bulk delete Button wrapped in {deletableSelectedIds.length > 0 && (...)}
test('archive-table: bulk delete button is guarded by deletableSelectedIds', () => {
  assert.match(
    archiveTable,
    /\{deletableSelectedIds\.length\s*>\s*0\s*&&\s*\(\s*<Button\b[\s\S]{0,400}?setBulkDeleteDialogOpen\(true\)/
  )
  assert.equal(count(archiveTable, /setBulkDeleteDialogOpen\(true\)/g), 1)
})

// Pins: handleBulkDeleteConfirm only sends archived ids
test('archive-table: handleBulkDeleteConfirm uses deletableSelectedIds', () => {
  const start = archiveTable.indexOf('async function handleBulkDeleteConfirm')
  const end = archiveTable.indexOf('async function', start + 10)
  assert.ok(start >= 0)
  const body = archiveTable.slice(start, end)
  assert.ok(body.includes('const ids = deletableSelectedIds'))
  assert.ok(!body.includes('const ids = selectedIds'))
})

// Pins: deletableSelectedIds declaration built from canDeletePermanently(
test('archive-table: deletableSelectedIds is built with canDeletePermanently(', () => {
  assert.match(archiveTable, /deletableSelectedIds[\s\S]{0,200}?canDeletePermanently\(/)
})

// Pins: per-row episode delete Tooltip wrapped in {canDeletePermanently(episode) && (...)}
test('archive-episodes-table: per-row delete is guarded by canDeletePermanently(episode)', () => {
  const guarded = count(
    episodesTable,
    /\{canDeletePermanently\(episode\)\s*&&\s*\(\s*<(Tooltip|Button)\b[\s\S]{0,600}?setDeletingEpisode\(episode\)/g
  )
  const all = count(episodesTable, /setDeletingEpisode\(episode\)/g)
  assert.ok(guarded >= 1)
  assert.equal(guarded, all)
})

// Pins: ArchivedEpisode carries archived
test('archive-episodes-table: ArchivedEpisode has archived: boolean', () => {
  const m = episodesTable.match(/export interface ArchivedEpisode \{[\s\S]*?\}/)
  assert.ok(m)
  assert.ok(m[0].includes('archived: boolean'))
})

// Sanity link between the scan and the guard
test('canDeletePermanently is false for non-archived rows', () => {
  assert.equal(canDeletePermanently({ archived: false }), false)
  assert.equal(canDeletePermanently({ archived: true }), true)
})
