import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source guards for plan 06-18: arrows, renumber, flags and the dashboard
// panel. The components import next/* and @/ paths, so they are scanned as
// text rather than imported.

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length
}

const episodesTable = read('src/components/admin/episodes-table.tsx')

test('episodes table: shared Can\'t-play and Needs-English rules, no local script check', () => {
  assert.ok(count(episodesTable, /cantPlayReason\(/g) >= 1)
  assert.ok(count(episodesTable, /needsEnglishTitle\(/g) >= 1)
  assert.equal(count(episodesTable, /containsArabicScript/g), 0)
})

test('episodes table: failed moves are explained with moveFailed', () => {
  assert.ok(count(episodesTable, /moveFailed/g) >= 1)
})

test('episodes table: arrows are visible 44px controls in a w-64 actions cell', () => {
  assert.ok(count(episodesTable, /size="icon-lg"/g) >= 2)
  assert.equal(count(episodesTable, /size="icon-sm"/g), 0)
  assert.ok(count(episodesTable, /w-64/g) >= 1)
})

test('episodes table: the pending arrow spins and honours reduced motion', () => {
  assert.match(episodesTable, /animate-spin motion-reduce:animate-none/)
})

test('episodes table: moved row highlight and live region', () => {
  assert.match(episodesTable, /bg-\[var\(--uis-primary-soft\)\]/)
  assert.match(episodesTable, /aria-live="polite"/)
})

test('episodes table: edit of an untranslated row opens with the title focused', () => {
  assert.match(episodesTable, /initialFocus=/)
})

test('renumber dialog: own close button on the logical end, 44px, no primitive close', () => {
  const src = read('src/components/admin/renumber-season-dialog.tsx')
  assert.equal(count(src, /showCloseButton=\{false\}/g), 1)
  assert.ok(count(src, /end-4/g) >= 1)
  assert.ok(count(src, /size-11/g) >= 1)
})

test('renumber dialog: one renumberSeason call and an alert for a refusal', () => {
  const src = read('src/components/admin/renumber-season-dialog.tsx')
  assert.equal(count(src, /renumberSeason\(/g), 1)
  assert.match(src, /role="alert"/)
})

test('season tabs: renumber hint, dialog and the empty-state import entry', () => {
  const src = read('src/components/admin/season-tabs.tsx')
  assert.ok(count(src, /ImportPlaylistSheet/g) >= 2)
  assert.ok(count(src, /gapsHint/g) >= 1)
  assert.ok(count(src, /RenumberSeasonDialog/g) >= 2)
})
