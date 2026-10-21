import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
}

const select = read('src/components/ui/select.tsx')
const localeLayout = read('src/app/[locale]/layout.tsx')
// Phase 6 moved the Toaster out of the layout into RouteScopedToaster (04-P6-ADDENDUM).
const toaster = read('src/components/route-scoped-toaster.tsx')
const landing = read('src/components/landing/landing-hero-animations.tsx')
const viewerLayout = read('src/app/[locale]/(viewer)/layout.tsx')
const avatar = read('src/components/layout/user-avatar.tsx')
const css = read('src/styles/globals.css')

test('D-03 snap 1: select uses card/field radius, popover surface and shadow tokens', () => {
  assert.ok(select.includes('bg-[var(--bg-1)]/98'), 'menu surface is --bg-1 at 98%')
  assert.ok(select.includes('shadow-popover'))
  assert.ok(select.includes('shadow-inset-hairline'))
  assert.ok(select.includes('rounded-card'))
  assert.ok(select.includes('rounded-field'))
  assert.ok(!select.includes('#11151d'), 'blue-black surface removed')
  assert.ok(!select.includes('rounded-['), 'no bracket radius')
  assert.ok(!select.includes('shadow-['), 'no bracket shadow')
})

test('D-03 snap 2: toaster uses --bg-1 and shadow-popover', () => {
  assert.ok(toaster.includes('bg-[var(--bg-1)] text-foreground shadow-popover'))
  assert.ok(localeLayout.includes('<RouteScopedToaster />'))
  for (const src of [localeLayout, toaster]) {
    assert.ok(!src.includes('#10131a'))
    assert.ok(!src.includes('shadow-['))
  }
})

test('D-03 snap 3: /portfolio CTA uses the yellow glow and primary hover token', () => {
  assert.ok(landing.includes('shadow-cta-glow'))
  assert.ok(landing.includes('hover:bg-[var(--uis-primary-hover)]'))
  assert.ok(!landing.includes('7082ff'))
  assert.ok(!landing.includes('96,115,255'))
  assert.ok(!landing.includes('shadow-['))
})

test('D-01: preload cover and avatar ink use tokens, no #0a0a0a', () => {
  assert.ok(viewerLayout.includes("background: 'var(--bg-0)'"))
  assert.ok(!viewerLayout.includes('#0a0a0a'))
  assert.ok(avatar.includes('text-[var(--primary-foreground)]'))
  assert.ok(!avatar.includes('#0a0a0a'))
})

test('avatar gradient uses chart tokens that equal the old literals', () => {
  assert.ok(avatar.includes('from-[var(--chart-5)]'))
  assert.ok(avatar.includes('to-[var(--chart-2)]'))
  assert.ok(!avatar.includes('#c8a04a'))
  assert.ok(!avatar.includes('#d97757'))
  assert.match(css, /--chart-5:\s*#c8a04a;/i)
  assert.match(css, /--chart-2:\s*#d97757;/i)
})

test('snap tokens exist in globals.css with the signed values', () => {
  assert.match(css, /--shadow-popover:\s*0 24px 80px rgba\(0, 0, 0, 0\.42\);/)
  assert.match(css, /--shadow-inset-hairline:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.04\);/)
  assert.match(css, /--shadow-cta-glow:\s*0 16px 40px rgba\(255, 204, 0, 0\.18\);/)
  assert.match(css, /--uis-primary-hover:\s*#D7AD16;/i)
})
