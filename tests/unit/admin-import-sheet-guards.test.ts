// Source guards for the import side sheet (06-17, UI-SPEC 1, threats T-06-69
// to T-06-72). The sheet is a client component that imports next-intl and
// @/ paths, so node --test reads its source instead of importing it.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const SHEET = 'src/components/admin/import-playlist-sheet.tsx'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`)
  return readFileSync(path, 'utf8')
}

/** Source with block comments and // line comments removed. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** The text between the brace that opens at `from` and its match. */
function balanced(src: string, from: number): string {
  let depth = 0
  for (let i = from; i < src.length; i++) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(from + 1, i)
    }
  }
  throw new Error('unbalanced braces')
}

/** Top-level keys of an object literal body. */
function topLevelKeys(body: string): string[] {
  const keys: string[] = []
  let depth = 0
  let token = ''
  for (const ch of body) {
    if ('{[('.includes(ch)) depth += 1
    if ('}])'.includes(ch)) depth -= 1
    if (depth === 0 && ch === ',') {
      keys.push(token)
      token = ''
    } else {
      token += ch
    }
  }
  if (token.trim()) keys.push(token)
  return keys
    .map((k) => k.trim().match(/^([A-Za-z_]\w*)/)?.[1])
    .filter((k): k is string => Boolean(k))
}

test('the sheet names every state, string and link from UI-SPEC 1.8-1.9', () => {
  const c = code(read(SHEET))
  for (const needle of [
    'formatQuotaReset(',
    'nextQuotaReset(',
    'bannerForCode(',
    'role="alert"',
    '/admin/settings?tab=advanced',
    'successHeading',
    'tabIndex={-1}',
    'successNeedsEnglish',
    'allAlreadyHeading',
    'noneImportable',
    'importFailed',
  ]) {
    assert.ok(c.includes(needle), `${SHEET} must contain ${needle}`)
  }
})

test('default-size buttons carry the px-6 override', () => {
  const c = code(read(SHEET))
  const count = (c.match(/px-6/g) ?? []).length
  assert.ok(count >= 3, `expected at least 3 px-6, found ${count}`)
})

test('no physical-direction classes, tiny text or small buttons', () => {
  const c = code(read(SHEET))
  assert.equal(/\b(left|right)-[0-9]/.test(c), false, 'left-N / right-N')
  assert.equal(/\btext-left\b|\btext-right\b/.test(c), false, 'text-left / text-right')
  assert.equal(/text-\[(9|10)px\]/.test(c), false, 'text under 11px')
  assert.equal(/size="sm"/.test(c), false, 'size="sm"')
})

test('the commit call sends only showId, playlistId, videoIds and target', () => {
  const c = code(read(SHEET))
  const at = c.indexOf('commitImport({')
  assert.ok(at >= 0, 'commitImport({ call not found')
  const body = balanced(c, at + 'commitImport('.length)
  assert.deepEqual(topLevelKeys(body).sort(), ['playlistId', 'showId', 'target', 'videoIds'])
})

test('the sheet never injects HTML or pulls from a component registry', () => {
  const c = code(read(SHEET))
  assert.equal(c.includes('dangerouslySetInnerHTML'), false)
  assert.equal(c.includes('@react-bits'), false)
  assert.equal(/registry|shadcn@|npx shadcn/i.test(c), false)
})

test('importing locks the sheet: onOpenChange is a no-op and the close controls are disabled', () => {
  const c = code(read(SHEET))
  assert.match(c, /if \(importing\) return/)
  assert.match(c, /disabled=\{importing\}/)
})

test('the paging loop is bounded by IMPORT_MAX_ITEMS and never retries by itself', () => {
  const c = code(read(SHEET))
  assert.match(c, /IMPORT_MAX_ITEMS/)
  assert.equal(/setInterval\(/.test(c), false)
})

const SCHEDULER = 'src/components/admin/schedule-episodes-button.tsx'
const SHOW_PAGE = 'src/app/[locale]/admin/shows/[id]/page.tsx'

test('the scheduler can be controlled and limited to chosen episodes', () => {
  const c = code(read(SCHEDULER))
  assert.ok((c.match(/episodeIds/g) ?? []).length >= 3, 'episodeIds at least 3 times')
  assert.ok(c.includes('onOpenChange'), 'onOpenChange prop')
  assert.ok(c.includes('hideTrigger'), 'hideTrigger prop')
  assert.ok(c.includes('previewShowSchedule(showId, episodeIds)'), 'preview passes the selection')
  assert.ok(c.includes('applyShowSchedule(showId, episodeIds)'), 'apply passes the selection')
})

test('the scheduler warning also covers English-title and can-not-play slots', () => {
  const c = code(read(SCHEDULER))
  assert.ok(c.includes('needsEnglishTitle'), 'needsEnglishTitle')
  assert.ok(c.includes('youtubeStatus'), 'youtubeStatus')
  assert.ok(c.includes('admin.youtubeStatus'), 'admin.youtubeStatus strings')
  assert.ok(c.includes('cantPlayBadge'), 'cantPlayBadge string')
})

test('an unfiltered scheduler cannot unschedule from a filtered dialog', () => {
  const c = code(read(SCHEDULER))
  assert.match(c, /unscheduleShowEpisodes\(showId\)/)
  assert.match(c, /episodeIds\s*\?\s*null|!episodeIds|episodeIds === undefined/)
})

test('the show page renders the import sheet first in the header action group', () => {
  const c = code(read(SHOW_PAGE))
  assert.equal((c.match(/ImportPlaylistSheet/g) ?? []).length >= 2, true, 'import + use')
  const sheet = c.indexOf('<ImportPlaylistSheet')
  const schedule = c.indexOf('<ScheduleEpisodesButton')
  assert.ok(sheet >= 0 && schedule >= 0 && sheet < schedule, 'sheet before the scheduler')
  assert.match(c, /maxEpisodeNumberBySeason\[[^\]]+\] \?\? 0/)
})

test('the sheet opens the scheduler for the imported episodes only', () => {
  const c = code(read(SHEET))
  const at = c.indexOf('<ScheduleEpisodesButton')
  assert.ok(at >= 0, 'ScheduleEpisodesButton rendered')
  const tag = c.slice(at, c.indexOf('/>', at))
  for (const prop of ['open=', 'onOpenChange=', 'episodeIds=', 'hideTrigger']) {
    assert.ok(tag.includes(prop), `scheduler tag has ${prop}`)
  }
})
