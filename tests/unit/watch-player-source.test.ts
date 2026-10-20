// Source guards for the YouTube player component and the progress tracker
// (06-09, UI-SPEC 3.1 hard rule, checker blocker 3 and W2). Both files are
// client modules that import next-intl, @/ paths and the YT global, so
// node --test reads their source instead of importing them.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const PLAYER = readFileSync('src/components/watch/youtube-player.tsx', 'utf8')
const TRACKER = readFileSync('src/hooks/use-progress-tracker.ts', 'utf8')

/** The opening JSX tag that contains `needle`, from its `<` to its `>`. */
function openingTagWith(src: string, needle: string): string {
  const at = src.indexOf(needle)
  assert.notEqual(at, -1, `${needle} not found`)
  const start = src.lastIndexOf('<', at)
  const end = src.indexOf('>', at)
  return src.slice(start, end + 1)
}

/** Source with // line comments and block comments removed. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('player: hidden is on the React-owned wrapper that carries wrapperRef', () => {
  const tag = openingTagWith(PLAYER, 'ref={wrapperRef}')
  assert.match(tag, /hidden=\{hidden\}/)
})

test('player: YT.Player gets an imperatively created inner node, never the wrapper', () => {
  assert.equal(PLAYER.split("document.createElement('div')").length - 1, 1)
  assert.match(PLAYER, /wrapperRef\.current\.appendChild\(mount\)/)
  assert.match(PLAYER, /new YT\.Player\(\s*mount\b/)
  assert.doesNotMatch(PLAYER, /new YT\.Player\(\s*wrapperRef/)
  assert.doesNotMatch(PLAYER, /new YT\.Player\(\s*containerRef/)
})

test('player: nothing is drawn over the player', () => {
  const src = code(PLAYER)
  assert.doesNotMatch(src, /seekTo/)
  assert.doesNotMatch(src, /absolute inset-0/)
  assert.doesNotMatch(src, /getErrorMessage/)
  assert.doesNotMatch(src, /z-10/)
  assert.doesNotMatch(src, /role="alert"/)
})

test('player: vars come from buildPlayerVars with the site locale and the start second', () => {
  assert.match(PLAYER, /buildPlayerVars\(/)
  assert.match(PLAYER, /useLocale\(\)/)
  assert.match(PLAYER, /startSeconds/)
  assert.match(PLAYER, /origin:\s*window\.location\.origin/)
})

test('player: autoplay-blocked event is wired through a callback ref', () => {
  assert.match(PLAYER, /onAutoplayBlocked/)
  assert.match(PLAYER, /onAutoplayBlockedRef/)
})

test('player: cleanup destroys the player and removes the leftover child', () => {
  assert.match(PLAYER, /\.destroy\(\)/)
  assert.match(PLAYER, /replaceChildren\(\)|removeChild\(/)
})

test('player: exposes the reported video id for the tracker', () => {
  assert.match(PLAYER, /export function getPlayerVideoId/)
  assert.match(PLAYER, /getVideoData\(\)/)
  assert.match(PLAYER, /video_id/)
})

test('tracker: the unmount flush has no [forceFlush] dependency array', () => {
  assert.doesNotMatch(TRACKER, /\[forceFlush\]/)
  assert.match(TRACKER, /latestFlush/)
})

test('tracker: saves go through shouldSaveProgress and videoMatchesFor', () => {
  assert.match(TRACKER, /shouldSaveProgress\(/)
  assert.match(TRACKER, /videoMatchesFor\(/)
  assert.match(TRACKER, /getVideoData/)
  assert.match(TRACKER, /expectedVideoId/)
})

test('tracker: tracks PLAYING since the switch and returns resetBaseline', () => {
  assert.match(TRACKER, /playingSinceSwitch/)
  assert.match(TRACKER, /resetBaseline/)
  assert.match(TRACKER, /return\s*\{[^}]*resetBaseline[^}]*\}/)
})

test('tracker: keeps the upsert payload and the 95% rule', () => {
  assert.match(TRACKER, /onConflict:\s*'user_id,episode_id'/)
  assert.match(TRACKER, /0\.95/)
  assert.match(TRACKER, /progress_seconds/)
  assert.match(TRACKER, /duration_seconds/)
})
