// Source guards for the stacked watch page (06-14, UI-SPEC sections 3 and 4,
// threats T-06-53..56). The shell is a client component that imports next-intl
// and @/ paths, so node --test reads its source instead of importing it.
//
// YouTube required minimum functionality: nothing is ever drawn over a visible
// player (no fixed chrome, arrows, tray raise, overlay, tooltip, popover, toast).
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const SHELL_PATH = 'src/components/watch/watch-shell.tsx'
const LIST_PATH = 'src/components/watch/episode-list.tsx'
const PLAYER_PATH = 'src/components/watch/youtube-player.tsx'
const UPNEXT_PATH = 'src/components/watch/up-next-card.tsx'
const ERROR_PATH = 'src/components/watch/player-error-card.tsx'
const TRAY_PATH = 'src/components/watch/episode-tray.tsx'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`)
  return readFileSync(path, 'utf8')
}

/** Source with block comments and // line comments removed. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

/** Every file under `dir` (recursive) with one of the given extensions. */
function walk(dir: string, exts: string[]): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full)
  }
  return out
}

/** Files under src that mention `needle` (outside comments). */
function srcFilesMentioning(needle: string): string[] {
  return walk('src', ['.ts', '.tsx', '.js', '.jsx', '.mjs']).filter((file) =>
    code(readFileSync(file, 'utf8')).includes(needle)
  )
}

/** The text of a balanced `{ ... }` block that starts at or after `from`. */
function braceBlock(src: string, from: number): string {
  const open = src.indexOf('{', from)
  assert.notEqual(open, -1, 'opening brace not found')
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  assert.fail('unbalanced braces')
}

/** The source of one top-level function, from its keyword to the next one. */
function functionBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `function ${name} not found`)
  const next = src.indexOf('\nfunction ', start + 1)
  const exported = src.indexOf('\nexport function ', start + 1)
  const ends = [next, exported].filter((n) => n !== -1)
  return src.slice(start, ends.length ? Math.min(...ends) : undefined)
}

type Tag = { name: string; attrs: string; index: number; closing: boolean; selfClosing: boolean }

/**
 * JSX tags in source order. An opening tag starts with `<` after whitespace,
 * `(`, `{`, `}`, `>`, `?`, `:` or `&`, so TypeScript generics
 * (`useState<number>`) are skipped; a closing `</` matches anywhere; `=>`
 * inside attributes does not end a tag.
 */
function jsxTags(src: string): Tag[] {
  const re = /(?:(?<=^|[\s({}>?:&])|(?=<\/))<(\/?)([A-Za-z][\w.]*)\b((?:[^>]|=>)*)>/g
  return [...src.matchAll(re)].map((m) => ({
    name: m[2],
    attrs: m[3],
    index: m.index ?? 0,
    closing: m[1] === '/',
    selfClosing: m[3].trimEnd().endsWith('/'),
  }))
}

/** The opening tag that encloses position `at` (nearest unclosed ancestor). */
function parentTagAt(src: string, at: number): Tag {
  const stack: Tag[] = []
  for (const tag of jsxTags(src)) {
    if (tag.index >= at) break
    if (tag.closing) {
      const i = stack.map((t) => t.name).lastIndexOf(tag.name)
      if (i !== -1) stack.length = i
    } else if (!tag.selfClosing) {
      stack.push(tag)
    }
  }
  const parent = stack.at(-1)
  assert.ok(parent, 'no enclosing tag found')
  return parent
}

// ---------------------------------------------------------------------------
// Task 1: stacked layout, control bar, resume, no tray
// ---------------------------------------------------------------------------

test('watch-shell: nothing positioned over the player, no idle chrome', () => {
  const c = code(read(SHELL_PATH))
  assert.doesNotMatch(c, /\bfixed\b/, 'no fixed positioning')
  assert.doesNotMatch(c, /\btop-1\/2\b/, 'no arrows centred on the video')
  assert.doesNotMatch(c, /useIdleTimer|use-idle-timer/, 'no auto-hide chrome')
  assert.doesNotMatch(c, /backdrop-blur/, 'no translucent bars')
  assert.doesNotMatch(c, /from 'vaul'/, 'no drawer tray')
  assert.doesNotMatch(c, /\btoast\(|from 'sonner'/, 'no toast on the watch route')
  assert.doesNotMatch(c, /onMouseEnter|onPointerEnter/, 'no hover raise')
  assert.doesNotMatch(c, /\bz-(10|20|30|40|50)\b/, 'no layered chrome')
})

test('watch-shell: onReady never seeks, no hard-coded start at 0', () => {
  const c = code(read(SHELL_PATH))
  let from = c.indexOf('onReady=')
  assert.notEqual(from, -1, 'onReady handler present')
  while (from !== -1) {
    assert.doesNotMatch(braceBlock(c, from), /seekTo\(/, 'no seekTo inside onReady')
    from = c.indexOf('onReady=', from + 1)
  }
  assert.doesNotMatch(c, /startSeconds:\s*0\b/, 'start comes from the saved position')
})

test('watch-shell: uses EpisodeList, WatchActions, resume rules and the player', () => {
  const c = code(read(SHELL_PATH))
  assert.match(c, /from '@\/components\/watch\/episode-list'/, 'imports EpisodeList')
  assert.match(c, /from '@\/components\/watch\/watch-actions'/, 'imports WatchActions')
  assert.match(c, /<EpisodeList\b/, 'renders EpisodeList')
  assert.match(c, /<WatchActions\b/, 'renders WatchActions')
  assert.match(c, /useWatchAnnouncer\(\)/, 'one announcer in the shell')
  assert.equal(c.match(/useWatchAnnouncer\(\)/g)?.length, 1, 'exactly one announcer')
  assert.match(c, /resumeSecondsFor\(/, 'resume start from the positions map')
  assert.match(c, /seedPositions\(/, 'positions seeded from the server map')
  assert.match(c, /nextPositions\(/, 'positions updated through the reducer')
  assert.match(c, /type: 'leave'/, 'outgoing clock recorded on a switch')
  assert.match(c, /type: 'restart'/, 'start over recorded')
  assert.match(c, /resetBaseline\(/, 'tracker baseline follows the resume point')
  assert.match(c, /formatClock\(/, 'resumed time formatted per locale')
  assert.match(c, /import\('@\/components\/watch\/youtube-player'\)/, 'player loaded dynamically')
  assert.match(c, /ssr: false/, 'player is client only')
  assert.match(c, /startSeconds=\{/, 'initial mount passes startSeconds')
  // Player vars (hl, captions, start) are built inside the player.
  assert.match(code(read(PLAYER_PATH)), /buildPlayerVars\(/, 'player builds its vars')
})

test('watch-shell: switch order is leave, flush, set, baseline, load', () => {
  const c = code(read(SHELL_PATH))
  const body = functionBody(c, 'handleEpisodeSwitch')
  const order = [
    body.indexOf("type: 'leave'"),
    body.indexOf('forceFlush()'),
    body.indexOf('setCurrentEpisode('),
    body.indexOf('resetBaseline('),
  ]
  for (const at of order) assert.notEqual(at, -1, 'every switch step present')
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i - 1] < order[i], `switch step ${i} runs after step ${i - 1}`)
  }
  assert.match(body, /resumeSecondsFor\(positionsRef\.current\[target\.id\]\)/, 'per-episode start')
})

test('watch-shell: stacked frame classes from UI-SPEC 3.2-3.5', () => {
  const c = code(read(SHELL_PATH))
  assert.match(c, /flex h-dvh flex-col overflow-hidden bg-\[var\(--bg-0\)\]/, 'root frame')
  assert.match(c, /env\(safe-area-inset-bottom\)/, 'safe-area bottom padding')
  assert.match(c, /orientation:landscape/, 'landscape phones scroll the document')
  assert.match(c, /relative flex flex-none justify-center bg-black/, 'black stage')
  assert.match(c, /aspect-video/, 'video box is 16:9')
  assert.match(c, /min-h-\[200px\]/, 'player at least 200px tall')
  assert.match(c, /min-w-\[200px\]/, 'player at least 200px wide')
  assert.match(c, /role="region"/, 'video box is a region')
  assert.match(c, /tabIndex=\{-1\}/, 'video box takes programmatic focus')
  assert.match(
    c,
    /flex-none h-\[60px\] grid grid-cols-\[auto_minmax\(0,1fr\)_auto\] items-center gap-3 border-b border-\[var\(--line\)\] bg-\[var\(--bg-1\)\] px-3 py-2 md:px-5/,
    'control bar'
  )
  assert.match(c, /size="icon-lg"/, 'phone prev/next are 44px icons')
  assert.match(c, /min-h-11 px-6 py-2 text-sm font-bold/, 'desktop prev/next sizing')
  assert.match(c, /border-b border-\[var\(--line\)\]/, 'solid top bar border')
  assert.match(c, /rtl:rotate-180/, 'chevrons and back arrow mirror in RTL')
  assert.doesNotMatch(c, /(^|[^\w-])(left|right)-\d/, 'logical properties only')
  assert.doesNotMatch(c, /\b(ml|mr|pl|pr)-\d/, 'logical spacing only')
  assert.doesNotMatch(c, /\btext-(left|right)\b/, 'logical alignment only')
})

for (const path of [SHELL_PATH, LIST_PATH, PLAYER_PATH, UPNEXT_PATH, ERROR_PATH]) {
  test(`${path}: no tooltip, popover, dropdown or hover card (checker W5)`, () => {
    const c = code(read(path))
    assert.doesNotMatch(
      c,
      /from '@\/components\/ui\/(tooltip|popover|dropdown-menu|hover-card)'/,
      'no floating UI near the player'
    )
  })
}

test('watch-shell: the start-over button parent never clips its hit area (flag e)', () => {
  const c = code(read(SHELL_PATH))
  assert.match(c, /'startFromBeginning'/, 'desktop label used')
  assert.match(c, /'startOver'/, 'phone label used')
  // The <button> whose content renders the start-over label.
  const button = [...c.matchAll(/<button\b/g)]
    .map((m) => m.index ?? 0)
    .find((at) => /startFromBeginning|startOver/.test(c.slice(at, c.indexOf('</button>', at))))
  assert.ok(button !== undefined, 'start-over is a <button>')
  const tag = c.slice(button, c.indexOf('>', c.indexOf('className', button)))
  assert.match(tag, /after:-inset-x-3/, 'hit area stretches 12px sideways')
  assert.match(tag, /after:-inset-y-3/, 'hit area stretches 12px up and down')
  const parent = parentTagAt(c, button)
  assert.doesNotMatch(parent.attrs, /\btruncate\b/, 'parent is not truncated')
  assert.doesNotMatch(parent.attrs, /\boverflow-hidden\b/, 'parent does not clip')
})

test('episode-tray.tsx is gone and nothing imports it', () => {
  assert.equal(existsSync(TRAY_PATH), false, 'tray file removed')
  assert.deepEqual(srcFilesMentioning('episode-tray'), [], 'no import of the tray')
})
