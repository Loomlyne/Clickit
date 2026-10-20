// Source guards for the import preview table (06-12, UI-SPEC 1.6-1.7,
// threats T-06-47 and T-06-48). The component is a client component that
// imports next-intl and @/ paths, so node --test reads its source instead of
// importing it.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const PATH = 'src/components/admin/import-playlist-table.tsx'

function read(): string {
  assert.ok(existsSync(PATH), `${PATH} must exist`)
  return readFileSync(PATH, 'utf8')
}

/** Source with block comments and // line comments removed. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('exports ImportPlaylistTable and maps every row through importRowView', () => {
  const c = code(read())
  assert.match(c, /export function ImportPlaylistTable\(/)
  assert.match(c, /import \{[^}]*importRowView[^}]*\} from '@\/lib\/admin\/import-row-view'/)
  assert.match(c, /importRowView\(row, locale\)/)
})

test('header and cells carry the call-site overrides from UI-SPEC 1.6', () => {
  const c = code(read())
  assert.match(c, /h-11[^'"`]*text-\[11px\][^'"`]*font-normal[^'"`]*tracking-\[0\.14em\]/)
  assert.match(c, /px-2 py-0/)
  assert.match(c, /sticky top-0 z-\[1\] h-11 bg-\[var\(--bg-2\)\]/)
  assert.match(c, /overflow-hidden rounded-\[12px\] border border-\[var\(--line\)\]/)
})

test('body rows are 64px and skipped rows are disabled, muted and dimmed', () => {
  const c = code(read())
  assert.match(c, /\bh-16\b/)
  assert.match(c, /aria-disabled=\{[^}]*\? undefined : 'true'\}|aria-disabled="true"|aria-disabled=\{!view\.tickable\}/)
  assert.match(c, /opacity-40/)
  assert.match(c, /text-\[var\(--text-mute\)\]/)
  assert.match(c, /disabled=\{[^}]*!view\.tickable[^}]*\}/)
  assert.match(c, /hover:bg-white\/\[0\.03\]/)
})

test('only logical direction utilities are used', () => {
  const c = code(read())
  assert.doesNotMatch(c, /(^|[\s'"`:])(left|right)-/m)
  assert.doesNotMatch(c, /\btext-(left|right)\b/)
  assert.doesNotMatch(c, /\b(ml|mr|pl|pr)-\d/)
  assert.match(c, /text-end/)
})

test('no text under 11px', () => {
  const c = code(read())
  for (const m of c.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
    assert.ok(Number(m[1]) >= 11, `text-[${m[1]}px] is under 11px`)
  }
  assert.doesNotMatch(c, /\btext-(xxs|2xs)\b/)
})

test('titles are isolated with bdi and text is rendered by React (T-06-47)', () => {
  const c = code(read())
  assert.match(c, /<div className="truncate text-sm">\s*<bdi>\{row\.title\}<\/bdi>\s*<\/div>/)
  assert.doesNotMatch(c, /dangerouslySetInnerHTML/)
  assert.match(c, /rowSelectAria/)
  assert.match(c, /selectAllAria/)
})

test('thumbnails are unoptimized next/image with an empty alt and a fallback box', () => {
  const c = code(read())
  assert.match(c, /import Image from 'next\/image'/)
  assert.match(c, /<Image[\s\S]*?unoptimized[\s\S]*?\/>/)
  assert.match(c, /alt=""/)
  assert.match(c, /rounded-\[11px\] object-cover/)
  assert.match(c, /bg-\[var\(--bg-3\)\]/)
})

test('uses only existing primitives and the shared chip (T-06-48)', () => {
  const c = code(read())
  assert.match(c, /from '@\/components\/ui\/table'/)
  assert.match(c, /from '@\/components\/ui\/checkbox'/)
  assert.match(c, /from '@\/components\/ui\/skeleton'/)
  assert.match(c, /from '@\/components\/admin\/youtube-status-chip'/)
  assert.match(c, /YouTubeStatusChip/)
  assert.doesNotMatch(c, /shadcn|npx /)
})

test('header checkbox ticks all Ready rows and shows indeterminate', () => {
  const c = code(read())
  assert.match(c, /'indeterminate'/)
  assert.match(c, /onToggleAllReady/)
  assert.match(c, /aria-label=\{t\('selectAllAria'\)\}/)
})

test('phone layout: number and time hidden under 640px, length goes to the subline', () => {
  const c = code(read())
  assert.match(c, /max-sm:hidden/)
  assert.match(c, /sm:hidden/)
  assert.match(c, /tabular-nums/)
})

test('skeleton rows are 64px and the table is aria-busy while reading', () => {
  const c = code(read())
  assert.match(c, /Skeleton/)
  assert.match(c, /skeletonRows/)
  assert.match(c, /aria-busy/)
})
