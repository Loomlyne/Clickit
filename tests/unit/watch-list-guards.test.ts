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
