import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRAND_PALETTE,
  BRAND_COLOR_HEX,
  NEUTRAL_ACCENT_HEX,
  DEFAULT_GENRE_HEX,
  DEFAULT_CATEGORY_PILL_HEX,
  CATEGORY_HEX_PLACEHOLDER,
  COLOR_INPUT_EMPTY_HEX,
  COLOR_PICKER_RAINBOW,
} from '../../src/lib/brand-colors.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const css = readFileSync(join(root, 'src/styles/globals.css'), 'utf8')

function cssToken(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  assert.ok(m, `token not found in globals.css: --${name}`)
  return m[1].toLowerCase()
}

test('palette has six entries in CIT order with names', () => {
  assert.deepEqual(
    BRAND_PALETTE.map((p) => p.key),
    ['brand-blue', 'brand-purple', 'brand-green', 'brand-red', 'brand-orange', 'brand-yellow']
  )
  assert.deepEqual(
    BRAND_PALETTE.map((p) => p.name),
    ['Innovative Blue', 'Royal Purple', 'Oasis Green', 'Crimson Red', 'Sunset Orange', 'Desert Sand']
  )
  assert.deepEqual(
    BRAND_PALETTE.filter((p) => !p.showSelectable).map((p) => p.key),
    ['brand-yellow']
  )
})

test('palette hex and safeHex equal the @theme brand tokens', () => {
  for (const p of BRAND_PALETTE) {
    assert.equal(p.hex.toLowerCase(), cssToken(`color-${p.key}`), `${p.key} hex`)
    assert.equal(p.safeHex.toLowerCase(), cssToken(`color-${p.key}-safe`), `${p.key} safeHex`)
    assert.match(p.hex, /^#[0-9A-F]{6}$/)
    assert.match(p.safeHex, /^#[0-9A-F]{6}$/)
  }
})

test('BRAND_COLOR_HEX has exactly the 5 show keys derived from the palette', () => {
  assert.deepEqual(Object.keys(BRAND_COLOR_HEX), [
    'brand-blue',
    'brand-purple',
    'brand-green',
    'brand-red',
    'brand-orange',
  ])
  for (const p of BRAND_PALETTE.filter((x) => x.showSelectable)) {
    assert.equal(BRAND_COLOR_HEX[p.key as keyof typeof BRAND_COLOR_HEX], p.hex)
  }
  assert.deepEqual(BRAND_COLOR_HEX, {
    'brand-blue': '#2C3569',
    'brand-purple': '#9F54A0',
    'brand-green': '#50A258',
    'brand-red': '#DB3F34',
    'brand-orange': '#EA8C2E',
  })
})

test('picker and default constants', () => {
  assert.equal(NEUTRAL_ACCENT_HEX, '#A1A1A1')
  assert.equal(DEFAULT_GENRE_HEX, '#2C3569')
  assert.equal(DEFAULT_CATEGORY_PILL_HEX, '#8D9CFF')
  assert.equal(CATEGORY_HEX_PLACEHOLDER, '#F8C623')
  assert.equal(COLOR_INPUT_EMPTY_HEX, '#000000')
  assert.equal(
    COLOR_PICKER_RAINBOW,
    'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
  )
})

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

test('source scan: no second brand hex map under src/', () => {
  const hexes = BRAND_PALETTE.flatMap((p) => [p.hex, p.safeHex]).map((h) => h.toLowerCase())
  const allowed = new Set(['src/lib/brand-colors.ts', 'src/lib/design-truth.ts'])
  const offenders: string[] = []
  for (const file of walk(join(root, 'src'))) {
    const rel = relative(root, file)
    if (allowed.has(rel) || rel.startsWith('src/styles')) continue
    const code = stripComments(readFileSync(file, 'utf8')).toLowerCase()
    for (const h of hexes) if (code.includes(h)) offenders.push(`${rel}: ${h}`)
  }
  assert.deepEqual(offenders, [])
})
