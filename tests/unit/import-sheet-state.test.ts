// Pure state rules for the import side sheet (06-17, UI-SPEC 1.3-1.5, 1.8).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  bannerForCode,
  canImport,
  initialTicks,
  summarizeTicks,
  tickedInPlaylistOrder,
  toTableRow,
} from '../../src/lib/admin/import-sheet-state.ts'
import type { ImportTableRow } from '../../src/lib/admin/import-row-view.ts'
import type { PreviewRow } from '../../src/lib/admin/youtube-import.ts'

const prow = (over: Partial<PreviewRow> = {}): PreviewRow => ({
  videoId: 'aaaaaaaaaaa',
  position: 1,
  title: 'Episode 1',
  thumbnailUrl: 'https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg',
  durationSeconds: 1450,
  status: 'ok',
  privacy: 'public',
  arabicTitle: false,
  ...over,
})

const trow = (over: Partial<ImportTableRow> = {}): ImportTableRow => ({
  ...prow(),
  ...over,
})

test('toTableRow keeps every field of the server row', () => {
  const src = prow({
    videoId: 'bbbbbbbbbbb',
    position: 7,
    title: 'مرحبا',
    thumbnailUrl: null,
    durationSeconds: null,
    status: 'not_ready',
    privacy: 'unlisted',
    arabicTitle: true,
    premieresAt: '2026-11-01T10:00:00.000Z',
  })
  assert.deepEqual(toTableRow(src), {
    videoId: 'bbbbbbbbbbb',
    position: 7,
    title: 'مرحبا',
    thumbnailUrl: null,
    durationSeconds: null,
    status: 'not_ready',
    privacy: 'unlisted',
    arabicTitle: true,
    premieresAt: '2026-11-01T10:00:00.000Z',
    existing: undefined,
  })
  const already = toTableRow(
    prow({ status: 'already', existing: { showTitle: 'S', seasonNumber: 2, episodeNumber: 3 } })
  )
  assert.equal(already.status, 'already')
  assert.deepEqual(already.existing, { showTitle: 'S', seasonNumber: 2, episodeNumber: 3 })
})

test('initialTicks ticks Ready rows and nothing else', () => {
  const rows = [
    trow({ videoId: 'a1', status: 'ok' }),
    trow({ videoId: 'a2', status: 'private' }),
    trow({ videoId: 'a3', status: 'already' }),
    trow({ videoId: 'a4', status: 'ok' }),
    trow({ videoId: 'a5', status: 'not_ready' }),
  ]
  assert.deepEqual([...initialTicks(rows)].sort(), ['a1', 'a4'])
  assert.equal(initialTicks([]).size, 0)
})

test('tickedInPlaylistOrder sorts by position whatever the tick order', () => {
  const rows = [
    trow({ videoId: 'c', position: 3 }),
    trow({ videoId: 'a', position: 1 }),
    trow({ videoId: 'b', position: 2 }),
    trow({ videoId: 'd', position: 4 }),
  ]
  const ticked = new Set(['d', 'b', 'c'])
  assert.deepEqual(tickedInPlaylistOrder(rows, ticked), ['b', 'c', 'd'])
})

test('tickedInPlaylistOrder ignores ticks that are not Ready rows', () => {
  const rows = [
    trow({ videoId: 'a', position: 1 }),
    trow({ videoId: 'b', position: 2, status: 'private' }),
  ]
  assert.deepEqual(tickedInPlaylistOrder(rows, new Set(['a', 'b', 'zzz'])), ['a'])
})

test('summarizeTicks counts the three groups and numbers a new season from 1', () => {
  const rows = [
    trow({ videoId: 'a', position: 1, status: 'ok' }),
    trow({ videoId: 'b', position: 2, status: 'ok' }),
    trow({ videoId: 'c', position: 3, status: 'ok' }),
    trow({ videoId: 'd', position: 4, status: 'private' }),
    trow({ videoId: 'e', position: 5, status: 'removed' }),
    trow({ videoId: 'f', position: 6, status: 'not_embeddable' }),
    trow({ videoId: 'g', position: 7, status: 'blocked_ae' }),
    trow({ videoId: 'h', position: 8, status: 'not_ready' }),
    trow({ videoId: 'i', position: 9, status: 'already' }),
  ]
  const s = summarizeTicks(rows, new Set(['a', 'c']), { kind: 'new' })
  assert.deepEqual(s, {
    ready: 3,
    cantPlay: 5,
    already: 1,
    tickedCount: 2,
    firstNumber: 1,
    lastNumber: 2,
  })
})

test('summarizeTicks numbers an existing season after its last episode', () => {
  const rows = [trow({ videoId: 'a' }), trow({ videoId: 'b', position: 2 })]
  const s = summarizeTicks(rows, new Set(['a', 'b']), { kind: 'existing', lastEpisodeNumber: 7 })
  assert.equal(s.tickedCount, 2)
  assert.equal(s.firstNumber, 8)
  assert.equal(s.lastNumber, 9)
})

test('summarizeTicks counts only Ready ticks', () => {
  const rows = [trow({ videoId: 'a' }), trow({ videoId: 'b', position: 2, status: 'private' })]
  const s = summarizeTicks(rows, new Set(['a', 'b']), { kind: 'new' })
  assert.equal(s.tickedCount, 1)
})

test('bannerForCode: quota needs the reset time and has no action', () => {
  const b = bannerForCode('quota')
  assert.equal(b.messageKey, 'quota')
  assert.equal(b.action, null)
  assert.equal(b.needsTime, true)
  assert.equal(b.panel, 'banner')
})

test('bannerForCode: key problems offer Settings, key_missing also disables the link', () => {
  for (const code of ['key_missing', 'key_rejected', 'api_not_allowed'] as const) {
    assert.equal(bannerForCode(code).action, 'settings', code)
    assert.equal(bannerForCode(code).needsTime, false, code)
  }
  assert.equal(bannerForCode('key_missing').disableLink, true)
  assert.equal(bannerForCode('key_rejected').disableLink, false)
  assert.equal(bannerForCode('key_missing').messageKey, 'keyMissing')
  assert.equal(bannerForCode('key_rejected').messageKey, 'keyRejected')
  assert.equal(bannerForCode('api_not_allowed').messageKey, 'keyRejected')
})

test('bannerForCode: network retries, private playlist keeps the link', () => {
  assert.equal(bannerForCode('network').action, 'retry')
  const priv = bannerForCode('playlist_private')
  assert.equal(priv.action, null)
  assert.equal(priv.messageKey, 'playlistPrivate')
  assert.equal(priv.disableLink, false)
})

test('bannerForCode: empty playlist is the dashed panel, not a banner', () => {
  const b = bannerForCode('empty_playlist')
  assert.equal(b.panel, 'dashed')
  assert.equal(b.messageKey, 'emptyPlaylist')
})

const base = {
  tickedCount: 3,
  target: { kind: 'new' as const },
  seasonTitle: 'Season one',
  reading: false,
  importing: false,
}

test('canImport is true when ticks exist and the title is filled', () => {
  assert.equal(canImport(base), true)
})

test('canImport is false while reading or importing', () => {
  assert.equal(canImport({ ...base, reading: true }), false)
  assert.equal(canImport({ ...base, importing: true }), false)
})

test('canImport is false with no ticks', () => {
  assert.equal(canImport({ ...base, tickedCount: 0 }), false)
})

test('canImport needs a non-blank title for a new season only', () => {
  assert.equal(canImport({ ...base, seasonTitle: '   ' }), false)
  assert.equal(canImport({ ...base, seasonTitle: '' }), false)
  assert.equal(canImport({ ...base, target: { kind: 'existing' }, seasonTitle: '' }), true)
})

test('canImport honours an explicit block (quota, key problems)', () => {
  assert.equal(canImport({ ...base, blocked: true }), false)
})

test('the module imports nothing from @/, next/* or server-only', () => {
  const src = readFileSync('src/lib/admin/import-sheet-state.ts', 'utf8')
  assert.equal(/from '@\/|server-only|from 'next\//.test(src), false)
  const relative = [...src.matchAll(/^import (?!type)[^\n]*from '(\.[^']+)'/gm)]
  for (const m of relative) assert.match(m[1], /\.ts$/, `runtime import ${m[1]} must end in .ts`)
})
