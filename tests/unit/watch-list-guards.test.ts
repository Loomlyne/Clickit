// Source guards for the watch-page actions and the static episode list
// (06-11, UI-SPEC sections 3.3, 3.6, 3.7, threats T-06-45 and T-06-46). The
// components are client components that import next-intl and @/ paths, so
// node --test reads their source instead of importing them.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const WATCHLIST_PATH = 'src/hooks/use-watchlist.ts'
const LIKES_PATH = 'src/hooks/use-likes.ts'
const ACTIONS_PATH = 'src/components/watch/watch-actions.tsx'
const LIST_PATH = 'src/components/watch/episode-list.tsx'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`)
  return readFileSync(path, 'utf8')
}

/** Source with block comments and // line comments removed. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// ---------------------------------------------------------------------------
// Task 1: hooks accept onError, WatchActions gives inline feedback
// ---------------------------------------------------------------------------

for (const [name, path] of [
  ['useWatchlist', WATCHLIST_PATH],
  ['useLikes', LIKES_PATH],
] as const) {
  test(`${name}: optional onError option replaces the toast when given`, () => {
    const src = read(path)
    assert.match(
      src,
      /opts\?: \{ onError\?: \(message: string\) => void \}/,
      'opts parameter with onError'
    )
    const c = code(src)
    // Every toast.error call sits behind the same fallback helper, so with
    // onError set none of them can run.
    const calls = c.match(/toast\.error\(/g) ?? []
    assert.equal(calls.length, 1, 'toast.error is called from one place only')
    assert.match(c, /opts\?\.onError/, 'onError is read from opts')
    assert.match(c, /opts\.onError\(message\)|onError\(message\)/)
  })

  test(`${name}: the previous state is restored before the error is reported`, () => {
    const c = code(read(path))
    const restore = c.search(/set(IsInList|IsLiked)\(prev\)/)
    const report = c.search(/reportError\(/)
    assert.notEqual(restore, -1, 'restores prev')
    assert.notEqual(report, -1, 'reports through reportError')
    assert.ok(restore < report, 'restore comes first')
  })
}

test('watch-actions: no toast, a polite live region, size-11 buttons', () => {
  const src = read(ACTIONS_PATH)
  const c = code(src)
  assert.match(src, /^'use client'/, 'client component')
  assert.doesNotMatch(c, /from 'sonner'/, 'no sonner import')
  assert.doesNotMatch(c, /\btoast\b/, 'no toast anywhere')
  assert.match(c, /aria-live="polite"/, 'polite live region')
  assert.match(c, /\bsr-only\b/, 'live region is visually hidden')
  assert.match(c, /export function useWatchAnnouncer/)
  assert.match(c, /export function WatchActions/)
  assert.match(c, /3000/, 'announcement cleared after 3 s')
})

test('watch-actions: hooks report through the live region', () => {
  const c = code(read(ACTIONS_PATH))
  assert.match(c, /useWatchlist\([^)]*onError: announce/)
  assert.match(c, /useLikes\([^)]*onError: announce/)
})

test('watch-actions: share swaps to Check for 2000 ms and announces', () => {
  const c = code(read(ACTIONS_PATH))
  assert.match(c, /\bCheck\b/, 'Check icon')
  assert.match(c, /2000/, '2 s swap')
  assert.match(c, /navigator\.share/)
  assert.match(c, /navigator\.clipboard\s*\.writeText/)
  assert.match(c, /t\('linkCopied'\)/, 'label and announcement use linkCopied')
  assert.match(c, /announce\(t\('linkCopied'\)\)/)
})

test('watch-actions: every button is size-11 with the focus ring and active fill', () => {
  const c = code(read(ACTIONS_PATH))
  const tags = [...c.matchAll(/<button\b[\s\S]*?>/g)].map((m) => m[0])
  assert.ok(tags.length > 0, 'has buttons')
  for (const tag of tags) {
    assert.match(tag, /className=/, `class on ${tag}`)
  }
  // The shared class string carries the size and the ring for all three.
  assert.match(c, /\bsize-11\b/)
  assert.match(c, /rounded-full/)
  assert.match(c, /text-\[var\(--text-dim\)\]/)
  assert.match(c, /hover:text-\[var\(--text\)\]/)
  assert.match(c, /focus-visible:ring-2/)
  assert.match(c, /focus-visible:ring-\[var\(--primary\)\]/)
  assert.match(c, /focus-visible:ring-offset-2/)
  assert.match(c, /focus-visible:ring-offset-\[var\(--bg-0\)\]/)
  assert.match(c, /fill-\[var\(--primary\)\]/)
  assert.match(c, /text-\[var\(--primary\)\]/)
})

test('watch-actions: names are isolated, labels reuse the existing keys', () => {
  const c = code(read(ACTIONS_PATH))
  assert.match(c, /isolate\(showTitle\)/)
  for (const key of [
    'addToWatchlist',
    'removeFromWatchlist',
    'likeShow',
    'unlikeShow',
    'shareEpisode',
  ]) {
    assert.match(c, new RegExp(`t\\('${key}'`), `uses ${key}`)
  }
})

test('watch-actions: logical classes only, no fixed layering', () => {
  const c = code(read(ACTIONS_PATH))
  assert.doesNotMatch(c, /\bfixed\b/)
  assert.doesNotMatch(c, /(^|[^\w])(left|right)-/)
  assert.doesNotMatch(c, /\b(ml|mr|pl|pr)-\d/)
  assert.doesNotMatch(c, /dangerouslySetInnerHTML/)
})

// ---------------------------------------------------------------------------
// Task 2: static EpisodeList
// ---------------------------------------------------------------------------

test('episode-list: static section, no drawer, hover raise, overlay or tooltip', () => {
  const src = read(LIST_PATH)
  const c = code(src)
  assert.match(src, /^'use client'/, 'client component')
  assert.match(c, /export function EpisodeList/)
  assert.doesNotMatch(c, /vaul/, 'no vaul')
  assert.doesNotMatch(c, /Drawer/, 'no Drawer')
  assert.doesNotMatch(c, /onMouseEnter|onMouseLeave/, 'no hover handlers')
  assert.doesNotMatch(c, /\bfixed\b/, 'no fixed positioning')
  assert.doesNotMatch(c, /\btoast\(/, 'no toast call')
  assert.doesNotMatch(c, /from 'sonner'/, 'no sonner import')
  assert.doesNotMatch(
    c,
    /import[^\n]*\b(Tooltip|Popover|DropdownMenu|HoverCard)\b/,
    'no overlay components'
  )
  assert.doesNotMatch(c, /dangerouslySetInnerHTML/, 'no raw HTML')
})

test('episode-list: logical classes only', () => {
  const c = code(read(LIST_PATH))
  assert.doesNotMatch(c, /(^|[^\w])(left|right)-/, 'no left-/right-')
  assert.doesNotMatch(c, /\b(ml|mr|pl|pr)-\d/, 'no ml/mr/pl/pr')
  assert.doesNotMatch(c, /\btext-(left|right)\b/, 'no text-left/right')
})

test('episode-list: current item and season pills expose their state', () => {
  const c = code(read(LIST_PATH))
  assert.match(c, /aria-current=/, 'aria-current')
  assert.match(c, /aria-pressed=/, 'aria-pressed on the pills')
  assert.match(c, /aria-disabled=/, 'aria-disabled on unplayable items')
  assert.match(c, /\bdisabled=/, 'disabled on unplayable items')
  assert.match(c, /opacity-40/, 'unplayable thumbnail dims')
  assert.match(c, /min-h-11/, 'pills are 44px tall')
  assert.match(c, /length > 1/, 'pills only with more than one season')
  assert.match(c, /ms-auto/, 'phone actions sit at the end')
})

test('episode-list: thumbnails come from i.ytimg.com, unoptimized, with fallback', () => {
  const c = code(read(LIST_PATH))
  assert.match(c, /i\.ytimg\.com\/vi\//)
  assert.doesNotMatch(c, /img\.youtube\.com/, 'old thumbnail host is gone')
  assert.match(c, /\bunoptimized\b/)
  assert.match(c, /maxresdefault/)
  assert.match(c, /sddefault/)
  assert.match(c, /hqdefault/)
  assert.match(c, /onError/, 'falls back through onError')
})

test('episode-list: progress, status meta and headings use the Phase 6 keys', () => {
  const c = code(read(LIST_PATH))
  assert.match(c, /progressPercent\(/, 'percent from the 06-04 helper')
  assert.match(c, /h-\[3px\]/, '3px progress bar')
  for (const key of [
    'episodesHeading',
    'nowPlaying',
    'watched',
    'minutesLeft',
    'notOutYet',
  ]) {
    assert.match(c, new RegExp(`'${key}'`), `uses ${key}`)
  }
  assert.match(c, /minutesAbbr/, 'not-started shows the duration')
  assert.match(c, /seasonLabel/, 'pill label')
  assert.match(c, /<h2 className="sr-only">/, 'visually hidden heading')
})

test('episode-list: layout matches the signed rail and phone list', () => {
  const c = code(read(LIST_PATH))
  assert.match(c, /w-\[220px\]/, '220px rail card')
  assert.match(c, /snap-x/)
  assert.match(c, /snap-start/)
  assert.match(c, /overflow-x-auto/)
  assert.match(c, /rounded-media/, 'thumbnail radius (11px)')
  assert.match(c, /outline-\[var\(--primary\)\]/, 'current outline')
  assert.match(c, /outline-offset-2/)
  assert.match(c, /w-28|w-\[112px\]/, 'phone thumbnail is 112px wide')
  assert.match(c, /md:hidden/, 'phone list hides from md up')
  assert.match(c, /max-md:hidden|hidden md:/, 'rail hides below md')
})

test('episode-list: titles are bdi text, selection scrolls into view', () => {
  const c = code(read(LIST_PATH))
  assert.match(c, /<bdi>/)
  assert.match(c, /scrollIntoView\(/)
  assert.match(c, /prefers-reduced-motion/, 'reduced motion jumps instead of smoothing')
  assert.match(c, /inline: 'nearest'/)
  assert.match(c, /block: 'nearest'/)
})
