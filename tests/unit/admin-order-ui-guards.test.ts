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

const ADMIN_UI_FILES = [
  'src/components/admin/episodes-table.tsx',
  'src/components/admin/renumber-season-dialog.tsx',
  'src/components/admin/season-tabs.tsx',
  'src/components/admin/youtube-check-panel.tsx',
]

test('dashboard: the YouTube check panel sits between the profile card and the shows table', () => {
  const src = read('src/app/[locale]/admin/page.tsx')
  assert.ok(count(src, /YouTubeCheckPanel/g) >= 2)
  assert.equal(count(src, /summarizeYouTubeHealth/g), 1)
  const profile = src.indexOf('<AdminProfileCard')
  const panel = src.indexOf('<YouTubeCheckPanel')
  const table = src.indexOf('<ShowsTable')
  assert.ok(profile >= 0 && panel > profile && table > panel)
})

test('check panel: all four states and a link to each show', () => {
  const src = read('src/components/admin/youtube-check-panel.tsx')
  for (const key of ['allPlay', 'cantPlayCount', 'notCheckedChip', 'checkOverdue']) {
    assert.ok(count(src, new RegExp(key, 'g')) >= 1, key)
  }
  assert.match(src, /\/admin\/shows\/\$\{/)
  assert.match(src, /min-h-11/)
})

test('admin order UI: logical properties only, nothing under 11px, no small buttons', () => {
  for (const file of ADMIN_UI_FILES) {
    const src = read(file)
    assert.equal(
      count(src, /(?:^|[\s"'`:])-?(?:left|right)-(?:\d|\[|px|auto|full)/gm),
      0,
      `${file}: left-/right- class`
    )
    assert.equal(count(src, /text-\[(?:[0-9]|10)px\]/g), 0, `${file}: text under 11px`)
    assert.equal(count(src, /size="sm"/g), 0, `${file}: size="sm"`)
  }
})

test('admin order UI: every default-size Button carries px-6', () => {
  for (const file of ADMIN_UI_FILES) {
    const src = read(file)
    // A <Button ...> opening tag without a size prop is default size (44px).
    for (const match of src.matchAll(/<Button\b([^>]*?)>/gs)) {
      const attrs = match[1]
      if (/\bsize=/.test(attrs)) continue
      assert.match(attrs, /\bpx-6\b/, `${file}: default Button without px-6`)
    }
  }
})

test('admin order UI: flag only, nothing unpublishes or hides an episode', () => {
  for (const file of ADMIN_UI_FILES) {
    const src = read(file)
    assert.equal(count(src, /unpublish|hideEpisode|setEpisodeStatus/gi), 0, file)
  }
})
