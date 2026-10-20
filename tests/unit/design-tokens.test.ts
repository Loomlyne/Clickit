import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildRadius } from './helpers/ui-system-radius.ts'

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
