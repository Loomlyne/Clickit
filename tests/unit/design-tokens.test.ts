import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildRadius } from './helpers/ui-system-radius.ts'
import {
  SIGNED_TOKENS,
  SIGNED_FONT_PREFIX,
  RADIUS_CODEMOD,
  SHADOW_CODEMOD,
  STATUS_TONES,
  normalizeCssValue,
  contrastRatio,
} from '../../src/lib/design-truth.ts'
import { cn } from '../../src/lib/utils.ts'

const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8')
const uiConfig = JSON.parse(
  readFileSync(new URL('../../ui.config.json', import.meta.url), 'utf8')
) as { radius: { roundness: number; pill?: boolean; overrides?: Record<string, number> } }

/** Body of the first top-level (column 0) block that starts with `header {`. */
function block(header: string): string {
  const start = css.search(new RegExp(`^${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'))
  assert.ok(start >= 0, `block not found: ${header}`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error(`unterminated block: ${header}`)
}

/** Every top-level block with this header (for headers that occur more than once). */
function blocks(header: string): string[] {
  const re = new RegExp(`^${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'gm')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const open = css.indexOf('{', m.index)
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') {
        depth--
        if (depth === 0) {
          out.push(css.slice(open + 1, i))
          break
        }
      }
    }
  }
  return out
}

/** Declaration value inside a block body, whitespace collapsed; undefined when absent. */
function decl(body: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|[\\s;])${name.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`)
  const m = re.exec(body)
  return m ? m[1].replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim() : undefined
}

const root = block(':root')
const dark = block('.dark')
const themeInline = block('@theme inline')
const themeStatics = blocks('@theme static')

function staticDecl(name: string): string | undefined {
  for (const b of themeStatics) {
    const v = decl(b, name)
    if (v !== undefined) return v
  }
  return undefined
}

const lower = (s: string | undefined) => (s ?? '').toLowerCase()

test('signed colour truth in :root', () => {
  const expected: Record<string, string> = {
    '--bg-0': '#090909',
    '--bg-1': '#101010',
    '--bg-2': '#191919',
    '--bg-3': '#2a2a2a',
    '--bg-4': '#424242',
    '--primary': '#ffcc00',
    '--primary-foreground': '#090909',
    '--uis-primary-hover': '#d7ad16',
    '--uis-primary-soft': '#312915',
    '--destructive': '#ff3b30',
    '--ring': 'rgba(255, 204, 0, 0.5)',
    '--radius': '8px',
  }
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(lower(decl(root, name)), value, name)
  }
})

test('.dark shadcn tokens equal :root ones', () => {
  const names = [...dark.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])
  assert.ok(names.length > 20)
  for (const name of names) {
    assert.equal(decl(dark, name), decl(root, name), name)
  }
})

test('font stacks start with the LBC variable', () => {
  for (const name of ['--font-title', '--font-en-body', '--font-ar-body']) {
    assert.ok(decl(root, name)?.startsWith('var(--font-lbc)'), name)
  }
})

test('radius roles hold the signed px values', () => {
  const expected = { chip: '999px', control: '999px', shell: '999px', field: '8px', card: '12px', media: '11px', panel: '16px' }
  for (const [role, value] of Object.entries(expected)) {
    assert.equal(decl(root, `--uis-r-${role}`), value, role)
  }
})

test('radius roles equal the vendored UI System engine on ui.config.json', () => {
  const built = buildRadius(uiConfig.radius)
  for (const role of ['chip', 'control', 'shell', 'field', 'card', 'media', 'panel'] as const) {
    assert.equal(decl(root, `--uis-r-${role}`), `${built[role]}px`, role)
  }
})

test('named radius keys point at the --uis-r-* roles in @theme inline', () => {
  for (const role of ['chip', 'control', 'shell', 'field', 'card', 'media', 'panel']) {
    assert.equal(decl(themeInline, `--radius-${role}`), `var(--uis-r-${role})`, role)
  }
})

test('standard radius scale and hairline live in @theme static, not @theme inline', () => {
  const scale = { sm: '4px', md: '6px', lg: '8px', xl: '10px', '2xl': '12px', hairline: '1px' }
  for (const [key, value] of Object.entries(scale)) {
    assert.equal(staticDecl(`--radius-${key}`), value, key)
    assert.equal(decl(themeInline, `--radius-${key}`), undefined, `${key} must not stay in @theme inline`)
  }
})

test('shadow tokens: exactly the nine, in @theme static, not duplicated in :root', () => {
  const expected: Record<string, string> = {
    '--shadow-soft': '0 24px 80px rgba(0, 0, 0, 0.38)',
    '--shadow-panel': '0 10px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    '--shadow-popover': '0 24px 80px rgba(0, 0, 0, 0.42)',
    '--shadow-modal': '0 40px 120px rgba(0, 0, 0, 0.6)',
    '--shadow-bar': '0 8px 32px -8px rgba(0, 0, 0, 0.65)',
    '--shadow-inset-hairline': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    '--shadow-live-dot': '0 0 6px rgba(239, 68, 68, 0.9)',
    '--shadow-cta-glow': '0 16px 40px rgba(255, 204, 0, 0.18)',
    '--drop-shadow-splash': '0 24px 80px rgba(0, 0, 0, 0.55)',
  }
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(staticDecl(name), value, name)
    assert.equal(decl(root, name), undefined, `${name} must not be declared in :root`)
  }
  const all = themeStatics.flatMap((b) => [...b.matchAll(/(--(?:drop-)?shadow-[a-z-]+)\s*:/g)].map((m) => m[1]))
  assert.deepEqual([...all].sort(), Object.keys(expected).sort())
})

test('brand colours are @theme static with unchanged values', () => {
  const brand: Record<string, string> = {
    '--color-brand-blue': '#2c3569',
    '--color-brand-purple': '#9f54a0',
    '--color-brand-green': '#50a258',
    '--color-brand-red': '#db3f34',
    '--color-brand-orange': '#ea8c2e',
    '--color-brand-yellow': '#f8c623',
    '--color-brand-blue-safe': '#8d9cff',
    '--color-brand-purple-safe': '#c592ff',
    '--color-brand-green-safe': '#77d586',
    '--color-brand-red-safe': '#ff8b82',
    '--color-brand-orange-safe': '#ffb46e',
    '--color-brand-yellow-safe': '#f8d86f',
  }
  for (const [name, value] of Object.entries(brand)) {
    assert.equal(lower(staticDecl(name)), value, name)
  }
})

test('status tones: :root vars and @theme inline colour keys', () => {
  const rootTones: Record<string, string> = {
    '--status-success': 'var(--color-brand-green-safe)',
    '--status-warning': 'var(--color-brand-orange-safe)',
    '--status-danger': 'var(--color-brand-red-safe)',
    '--status-neutral': 'var(--text-mute)',
    '--status-neutral-line': 'var(--line-2)',
  }
  for (const [name, value] of Object.entries(rootTones)) {
    assert.equal(decl(root, name), value, name)
    assert.equal(decl(themeInline, name.replace('--status-', '--color-status-')), `var(${name})`, name)
  }
})

test('exact-value tokens keep today\'s values', () => {
  assert.equal(decl(root, '--ink-legacy-rgb'), '10 10 10')
  assert.equal(decl(root, '--ink-cinema-rgb'), '8 8 12')
  assert.equal(decl(root, '--ink-scrim-rgb'), '4 6 10')
  assert.equal(decl(root, '--primary-rgb'), '255 204 0')
  assert.equal(decl(root, '--live-dot'), 'oklch(63.7% 0.237 25.331)')
  assert.equal(decl(root, '--scrim-nav'), 'rgb(var(--ink-legacy-rgb) / 0.96)')
  assert.equal(
    decl(root, '--gradient-nav-fade'),
    'linear-gradient(180deg, rgb(var(--ink-legacy-rgb) / 0.95), rgb(var(--ink-legacy-rgb) / 0.65))'
  )
  assert.equal(decl(root, '--scrim-dialog'), 'rgb(var(--ink-scrim-rgb) / 0.82)')
  assert.equal(decl(root, '--scrim-sheet'), 'rgb(var(--ink-scrim-rgb) / 0.8)')
  assert.equal(decl(themeInline, '--color-live-dot'), 'var(--live-dot)')
})

test('--primary-rgb channels equal --primary', () => {
  const hex = lower(decl(root, '--primary')).replace('#', '')
  const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
  assert.equal(decl(root, '--primary-rgb'), channels)
})

test('surface and text colour keys reference the base palette (no duplicate hex)', () => {
  assert.equal(decl(themeInline, '--color-surface-1'), 'var(--bg-1)')
  assert.equal(decl(themeInline, '--color-surface-2'), 'var(--bg-2)')
  assert.equal(decl(themeInline, '--color-surface-3'), 'var(--bg-3)')
  assert.equal(decl(themeInline, '--color-surface-4'), 'var(--bg-4)')
  assert.equal(decl(themeInline, '--color-text-primary'), 'var(--text)')
  assert.equal(decl(themeInline, '--color-text-secondary'), 'var(--text-dim)')
  assert.equal(decl(themeInline, '--color-text-muted'), 'var(--text-mute)')
  assert.equal(/--color-surface-[1-4]\s*:\s*#/.test(css), false)
})

// ---------------------------------------------------------------------------
// design-truth.ts: signed values, codemod maps, normaliser, contrast
// ---------------------------------------------------------------------------

/** Declaration of a token wherever it lives: :root, @theme static, then @theme inline. */
function declAnywhere(name: string): string | undefined {
  return decl(root, name) ?? staticDecl(name) ?? decl(themeInline, name)
}

test('cn(): named radius utilities beat the standard scale', () => {
  assert.equal(cn('rounded-lg', 'rounded-card'), 'rounded-card')
  assert.equal(cn('rounded-full', 'rounded-card'), 'rounded-card')
  assert.equal(cn('rounded-t-lg', 'rounded-t-panel'), 'rounded-t-panel')
  assert.equal(cn('rounded-hairline', 'rounded-xs'), 'rounded-xs')
})

test('cn(): named shadow utilities beat the standard scale', () => {
  assert.equal(cn('shadow-md', 'shadow-soft'), 'shadow-soft')
  assert.equal(cn('shadow-popover', 'shadow-inset-hairline'), 'shadow-inset-hairline')
  assert.equal(cn('drop-shadow-lg', 'drop-shadow-splash'), 'drop-shadow-splash')
})

test('normalizeCssValue(): hex forms', () => {
  assert.equal(normalizeCssValue('#fc0'), '#FFCC00')
  assert.equal(normalizeCssValue(' #ffcc00 '), '#FFCC00')
  assert.equal(normalizeCssValue('#ffffff14'), 'rgba(255, 255, 255, 0.08)')
  assert.equal(normalizeCssValue('#ffffffff'), '#FFFFFF')
})

test('normalizeCssValue(): rgb/rgba forms', () => {
  assert.equal(normalizeCssValue('rgba(255,255,255,.08)'), 'rgba(255, 255, 255, 0.08)')
  assert.equal(normalizeCssValue('rgba(255, 255, 255, 0.08)'), 'rgba(255, 255, 255, 0.08)')
  assert.equal(normalizeCssValue('rgb(255 255 255 / 0.08)'), 'rgba(255, 255, 255, 0.08)')
  assert.equal(normalizeCssValue('rgb(255, 204, 0)'), '#FFCC00')
  assert.equal(
    normalizeCssValue('0 24px 80px rgba(0,0,0,.38)'),
    '0 24px 80px rgba(0, 0, 0, 0.38)'
  )
})

test('normalizeCssValue(): other strings pass through', () => {
  assert.equal(normalizeCssValue('999px'), '999px')
  assert.equal(normalizeCssValue(''), '')
  assert.equal(normalizeCssValue('var(--text-mute)'), 'var(--text-mute)')
  assert.equal(normalizeCssValue('rgb(var(--ink-legacy-rgb) / 0.96)'), 'rgb(var(--ink-legacy-rgb) / 0.96)')
})

test('contrastRatio(): WCAG 2.x on the signed pairs', () => {
  assert.equal(contrastRatio('#F4F4F4', '#101010').toFixed(1), '17.3')
  assert.equal(contrastRatio('#090909', '#ffcc00').toFixed(1), '13.2')
  assert.equal(contrastRatio('#A1A1A1', '#101010').toFixed(1), '7.4')
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0')
})

test('SIGNED_TOKENS: every entry equals its declaration in globals.css', () => {
  const names = Object.keys(SIGNED_TOKENS)
  assert.ok(names.length >= 60, `expected the full pinned set, got ${names.length}`)
  for (const name of names) {
    const actual = declAnywhere(name)
    assert.notEqual(actual, undefined, `${name} is not declared in globals.css`)
    assert.equal(normalizeCssValue(actual ?? ''), normalizeCssValue(SIGNED_TOKENS[name]), name)
  }
})

test('SIGNED_TOKENS: covers the headline truth', () => {
  for (const name of ['--bg-0', '--primary', '--primary-foreground', '--radius', '--shadow-popover', '--color-brand-green-safe', '--status-success']) {
    assert.ok(name in SIGNED_TOKENS, name)
  }
  assert.equal(normalizeCssValue(SIGNED_TOKENS['--bg-0']), '#090909'.toUpperCase())
  assert.equal(SIGNED_FONT_PREFIX, 'var(--font-lbc)')
})

const NAMED_ROLES = ['chip', 'control', 'shell', 'field', 'card', 'media', 'panel']

/** Resolve a radius utility key (card, md, hairline ...) to px using globals.css only. */
function resolveRadiusKey(key: string): number {
  if (NAMED_ROLES.includes(key)) {
    const viaTheme = decl(themeInline, `--radius-${key}`)
    const m = /^var\((--uis-r-[a-z]+)\)$/.exec(viaTheme ?? '')
    assert.ok(m, `--radius-${key} must be var(--uis-r-*) in @theme inline`)
    return parseInt(decl(root, m[1]) ?? '', 10)
  }
  return parseInt(staticDecl(`--radius-${key}`) ?? '', 10)
}

test('RADIUS_CODEMOD: every row resolves to the bracket px it replaces', () => {
  assert.ok(RADIUS_CODEMOD.length >= 10)
  for (const row of RADIUS_CODEMOD) {
    const toKey = /^rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br))?-(.+)$/.exec(row.to)?.[1]
    assert.ok(toKey, `bad target ${row.to}`)
    const resolved = resolveRadiusKey(toKey)
    assert.equal(resolved, row.px, `${row.from} -> ${row.to}`)

    const bracket = /\[(.+)\]$/.exec(row.from)?.[1]
    assert.ok(bracket, `bad source ${row.from}`)
    const fromPx = bracket.endsWith('px')
      ? parseInt(bracket, 10)
      : parseInt(decl(root, /^var\((.+)\)$/.exec(bracket)?.[1] ?? '') ?? '', 10)
    assert.equal(fromPx, row.px, `${row.from} px`)
  }
  const hairline = RADIUS_CODEMOD.find((r) => r.from === 'rounded-[1px]')
  assert.equal(hairline?.to, 'rounded-hairline')
})

test('SHADOW_CODEMOD: every row maps to the token holding the same value', () => {
  assert.ok(SHADOW_CODEMOD.length >= 10)
  for (const row of SHADOW_CODEMOD) {
    const tokenName = `--${row.to}`
    const tokenValue = staticDecl(tokenName)
    assert.notEqual(tokenValue, undefined, `${row.to} has no token`)
    const bracket = /\[(.+)\]$/.exec(row.from)?.[1] ?? ''
    if (bracket.startsWith('var(')) {
      assert.equal(bracket, `var(${tokenName})`, row.from)
      continue
    }
    const sourceValue = bracket.replace(/_/g, ' ')
    const same = normalizeCssValue(sourceValue) === normalizeCssValue(tokenValue ?? '')
    if (row.changes === 'D-03') assert.equal(same, false, `${row.from} is flagged D-03 but is identical`)
    else assert.equal(same, true, `${row.from} -> ${row.to}`)
  }
  const d03 = SHADOW_CODEMOD.filter((r) => r.changes === 'D-03').map((r) => r.from)
  assert.deepEqual(d03.sort(), ['shadow-[0_16px_40px_rgba(96,115,255,0.28)]', 'shadow-[0_24px_80px_rgba(0,0,0,0.45)]'].sort())
})

test('STATUS_TONES: four tones, vars declared in :root, classes renamed', () => {
  assert.deepEqual(STATUS_TONES.map((t) => t.tone), ['success', 'warning', 'danger', 'neutral'])
  for (const tone of STATUS_TONES) {
    assert.notEqual(decl(root, tone.cssVar), undefined, tone.cssVar)
    assert.equal(tone.oldClasses.length, tone.newClasses.length)
    for (const cls of tone.newClasses) assert.match(cls, /status-/)
  }
})
