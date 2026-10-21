// Source guards for the up-next card / bar and the branded error card
// (06-10, UI-SPEC section 4, checker flag b, threat T-06-42..44). The cards are
// client components that import next-intl and @/ paths, so node --test reads
// their source instead of importing them.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const UPNEXT_PATH = 'src/components/watch/up-next-card.tsx'
const ERROR_PATH = 'src/components/watch/player-error-card.tsx'
const RING_PATH = 'src/components/watch/countdown-ring.tsx'
const HOOK_PATH = 'src/hooks/use-element-visible.ts'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} must exist`)
  return readFileSync(path, 'utf8')
}

/** Source with block comments and // line comments removed. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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

/** Every opening `<Button ...>` tag (arrow functions inside props are allowed). */
function buttonTags(src: string): string[] {
  return [...src.matchAll(/<Button\b((?:[^>]|=>)*)>/g)].map((m) => m[0])
}

function assertTokenRules(name: string, src: string) {
  const c = code(src)
  assert.doesNotMatch(c, /\bfixed\b/, `${name}: no fixed positioning`)
  assert.doesNotMatch(c, /\bz-20\b/, `${name}: no z-20 layering`)
  assert.doesNotMatch(
    c,
    /(^|[^\w])(left|right)-/,
    `${name}: logical properties only`
  )
  assert.doesNotMatch(c, /\b(ml|mr|pl|pr)-\d/, `${name}: logical spacing only`)
  assert.doesNotMatch(
    c,
    /\btext-(left|right)\b/,
    `${name}: logical alignment only`
  )
  assert.doesNotMatch(c, /from-black/, `${name}: no black gradient`)
  assert.doesNotMatch(c, /text-\[(\d|10)px\]/, `${name}: no text under 11px`)
  assert.doesNotMatch(c, /\btoast\(/, `${name}: no toast`)
  assert.doesNotMatch(c, /dangerouslySetInnerHTML/, `${name}: no raw HTML`)
}

function assertButtonRules(name: string, src: string) {
  const tags = buttonTags(code(src))
  assert.ok(tags.length > 0, `${name}: has Buttons`)
  for (const tag of tags) {
    assert.match(tag, /\bmin-h-11\b/, `${name}: min-h-11 on ${tag}`)
    assert.match(tag, /\bpx-6\b/, `${name}: px-6 on ${tag}`)
    assert.doesNotMatch(
      tag,
      /size="(sm|xs|icon|icon-sm|icon-xs)"/,
      `${name}: default size only`
    )
  }
}

test('up-next card: token, layering and logical-property rules', () => {
  assertTokenRules('up-next-card', read(UPNEXT_PATH))
})

test('up-next card: container-query layout, both variants, Esc cancels', () => {
  const src = read(UPNEXT_PATH)
  assert.match(src, /@container/)
  assert.match(src, /@min-\[560px\]/)
  assert.match(src, /'stage'/)
  assert.match(src, /'bar'/)
  const esc = src.match(/e(?:vent)?\.key === 'Escape'[\s\S]{0,120}/)
  assert.ok(esc, 'an Escape key handler exists')
  assert.match(esc[0], /onCancel\(\)/, 'Escape calls onCancel')
})

test('up-next card: every default-size Button is 44px tall with px-6', () => {
  assertButtonRules('up-next-card', read(UPNEXT_PATH))
})

test('up-next card: the bar can never sit on the player', () => {
  const bar = code(functionBody(read(UPNEXT_PATH), 'UpNextBar'))
  assert.doesNotMatch(bar, /\babsolute\b/, 'bar branch has no absolute')
  assert.doesNotMatch(bar, /\binset-/, 'bar branch has no inset')
  assert.match(bar, /upNextBarTitle/)
  assert.match(bar, /seasonEpisodeLong/)
  assert.match(bar, /bg-\[var\(--uis-primary-soft\)\]/)
})

test('up-next card: titles render as text inside bdi, never as HTML', () => {
  const src = code(read(UPNEXT_PATH))
  assert.match(src, /<bdi>/)
})

test('countdown ring: SVG ring, reduced motion hides it, mirrored in RTL on the arc only', () => {
  const src = read(RING_PATH)
  assertTokenRules('countdown-ring', src)
  assert.match(src, /<svg\b/)
  assert.match(src, /stroke-\[var\(--line-2\)\]/)
  assert.match(src, /stroke-\[var\(--primary\)\]/)
  assert.match(src, /rtl:-scale-x-100/)
  assert.match(src, /aria-hidden/)
  assert.match(src, /usePrefersReducedMotion/)
  assert.match(src, /Intl\.NumberFormat/)
  assert.match(src, /tabular-nums/)
})

test('visibility hook: IntersectionObserver at the 50% rule plus tab visibility', () => {
  const src = read(HOOK_PATH)
  assert.equal(src.split('IntersectionObserver').length - 1, 1)
  assert.match(src, /visibilityState/)
  assert.match(src, /visibilitychange/)
  assert.match(src, /isVisibleEnough\(/)
  assert.match(src, /threshold:\s*\[0, 0\.5, 1\]/)
})

test('error card: token, layering and logical-property rules', () => {
  assertTokenRules('player-error-card', read(ERROR_PATH))
})

test('error card: alert role, container query, reported line only for reported errors', () => {
  const src = read(ERROR_PATH)
  assert.equal(src.split('role="alert"').length - 1, 1)
  assert.match(src, /@container/)
  assert.match(src, /@min-\[560px\]/)
  const c = code(src)
  const at = c.indexOf("t('errorReported')")
  assert.notEqual(at, -1, 'errorReported is rendered')
  const guard = c.slice(Math.max(0, at - 160), at)
  assert.match(guard, /showReportedLine/)
  assert.match(guard, /!spec\.site/)
})

test('error card: every default-size Button is 44px tall with px-6', () => {
  assertButtonRules('player-error-card', read(ERROR_PATH))
})
