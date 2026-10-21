import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { IntlMessageFormat } from 'intl-messageformat'
import {
  TOKEN_GROUPS,
  ALIAS_TOKENS,
  BRAND_PAIRS,
  RADIUS_SAMPLES,
  SHADOW_SAMPLES,
} from '../../src/components/admin/design-system/token-groups.ts'
import {
  SIGNED_TOKENS,
  canonicalCssValue,
  resolveSignedValue,
} from '../../src/lib/design-truth.ts'

const root = new URL('../../', import.meta.url)
const read = (rel: string) => readFileSync(new URL(rel, root), 'utf8')

const css = read('src/styles/globals.css')

/** Every custom property name declared anywhere in globals.css. */
const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))

/** Body of the first column-0 block with this header. */
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

/** name -> raw value for every declaration in a block body. */
function declarations(body: string): Array<[string, string]> {
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
}

const flatGroups = TOKEN_GROUPS.flatMap((g) => g.tokens)
const accounted = new Set<string>([...flatGroups, ...ALIAS_TOKENS])

test('token lists only name properties declared in globals.css', () => {
  const names = [
    ...flatGroups,
    ...ALIAS_TOKENS,
    ...RADIUS_SAMPLES.map((r) => r.token),
    ...SHADOW_SAMPLES.elevation.map((s) => s.token),
    ...SHADOW_SAMPLES.utility.map((s) => s.token),
  ]
  assert.ok(names.length > 60)
  for (const name of names) assert.ok(declared.has(name), `${name} is not declared in globals.css`)
  assert.equal(new Set(flatGroups).size, flatGroups.length, 'a token is listed twice in TOKEN_GROUPS')
})

test('token groups follow the contract order and the brand map has six pairs', () => {
  assert.deepEqual(
    TOKEN_GROUPS.map((g) => g.id),
    ['surfaces', 'lines', 'text', 'primary', 'danger', 'brand', 'status']
  )
  assert.deepEqual(BRAND_PAIRS.map((p) => p.nameKey), [
    'brandBlue',
    'brandPurple',
    'brandGreen',
    'brandRed',
    'brandOrange',
    'brandSand',
  ])
  const brand = TOKEN_GROUPS.find((g) => g.id === 'brand')!
  assert.deepEqual(
    brand.tokens,
    BRAND_PAIRS.flatMap((p) => [p.base, p.safe])
  )
})

test('every literal-colour declaration is accounted for in the token lists', () => {
  const literal = /^(#|rgba?\(|oklch\()/i
  const rootDecls = declarations(block(':root')).filter(([, v]) => literal.test(v))
  assert.ok(rootDecls.length > 40)
  for (const [name] of rootDecls) {
    assert.ok(accounted.has(name), `${name} is a literal colour in :root but is in neither TOKEN_GROUPS nor ALIAS_TOKENS`)
  }
  // The six brand colours and their safe tints live in an @theme static block.
  const brandDecls = [...css.matchAll(/(--color-brand-[a-z-]+)\s*:\s*#/g)].map((m) => m[1])
  assert.equal(brandDecls.length, 12)
  for (const name of brandDecls) assert.ok(accounted.has(name), `${name} is not accounted for`)
})

test('every status token is in TOKEN_GROUPS', () => {
  const status = [...declared].filter((n) => n.startsWith('--status-'))
  assert.ok(status.length >= 5)
  const group = TOKEN_GROUPS.find((g) => g.id === 'status')!
  for (const name of status) assert.ok(group.tokens.includes(name), `${name} missing from the status group`)
})

test('token samples cover the seven radius roles and the nine shadows', () => {
  assert.deepEqual(
    RADIUS_SAMPLES.map((r) => r.role),
    ['chip', 'control', 'shell', 'field', 'card', 'media', 'panel']
  )
  for (const r of RADIUS_SAMPLES) {
    assert.equal(r.utility, `rounded-${r.role}`)
    assert.equal(r.token, `--uis-r-${r.role}`)
  }
  assert.deepEqual(
    SHADOW_SAMPLES.elevation.map((s) => s.utility),
    ['shadow-panel', 'shadow-soft', 'shadow-popover', 'shadow-modal']
  )
  assert.deepEqual(
    SHADOW_SAMPLES.utility.map((s) => s.utility),
    ['shadow-inset-hairline', 'shadow-live-dot', 'shadow-cta-glow', 'shadow-bar', 'drop-shadow-splash']
  )
})

// Keys the UI-SPEC Copywriting Contract lists, plus the keys added by the planner notes.
const REQUIRED_KEYS = [
  'navLabel', 'eyebrow', 'pageTitle', 'pageDescription', 'sectionNavAria',
  'sectionColour', 'sectionType', 'sectionRadius', 'sectionSurfaces', 'sectionComponents',
  'reading', 'matchSummary', 'matchDiffer', 'tokenMissing',
  'groupSurfaces', 'groupLines', 'groupText', 'groupPrimary', 'groupDanger', 'groupBrand', 'groupStatus',
  'brandBlue', 'brandPurple', 'brandGreen', 'brandRed', 'brandOrange', 'brandSand',
  'safeTint', 'baseColour', 'contrastLabel', 'brandNote', 'categoryNote',
  'typeFont', 'renderedNote', 'weightRegular', 'weightBold', 'typeScaleNew', 'typeScaleLegacy',
  'roleLabel', 'roleBody', 'roleHeading', 'roleDisplay',
  'typeSampleEn', 'typeSampleAr', 'mixedSample', 'mixedTitle', 'tokenCol', 'renderedCol',
  'roleChip', 'roleControl', 'roleShell', 'roleField', 'roleCard', 'roleMedia', 'rolePanel',
  'roleUseChip', 'roleUseControl', 'roleUseShell', 'roleUseField', 'roleUseCard', 'roleUseMedia', 'roleUsePanel',
  'shadowUsePanel', 'shadowUseSoft', 'shadowUsePopover', 'shadowUseModal',
  'shadowUseInsetHairline', 'shadowUseLiveDot', 'shadowUseCtaGlow', 'shadowUseBar', 'shadowUseSplash',
  'glassNote',
  'btnDefault', 'btnSecondary', 'btnOutline', 'btnGhost', 'btnDestructive', 'btnLink',
  'primaryHoverNote', 'buttonSizesNote', 'focusNote',
  'inputPlaceholder', 'inputFilled', 'inputInvalidMessage', 'selectItem', 'toastButton', 'toastMessage',
  'statusSuccess', 'statusWarning', 'statusDanger', 'statusNeutral',
  'legacy13', 'legacy16', 'legacy30', 'legacy36',
] as const

type Dict = Record<string, string>
const en = (JSON.parse(read('src/messages/en.json')) as { admin: { designSystem?: Dict } }).admin.designSystem
const ar = (JSON.parse(read('src/messages/ar.json')) as { admin: { designSystem?: Dict } }).admin.designSystem

test('messages: admin.designSystem exists in en and ar with every contract key', () => {
  assert.ok(en && ar, 'admin.designSystem missing in en.json or ar.json')
  for (const key of REQUIRED_KEYS) {
    assert.ok(typeof en[key] === 'string' && en[key].length > 0, `en.${key} missing`)
    assert.ok(typeof ar[key] === 'string' && ar[key].length > 0, `ar.${key} missing`)
  }
})

test('messages: en and ar have the identical key set', () => {
  assert.ok(en && ar)
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort())
  assert.ok(Object.keys(en).length >= 80)
})

test('messages: every ICU message parses in both languages', () => {
  assert.ok(en && ar)
  for (const [lang, dict, locale] of [['en', en, 'en'], ['ar', ar, 'ar']] as const) {
    for (const [key, value] of Object.entries(dict)) {
      assert.doesNotThrow(() => new IntlMessageFormat(value, locale), `${lang}.${key} is not valid ICU`)
    }
  }
})

test('messages: plural summaries format to the expected sentences', () => {
  assert.ok(en && ar)
  const one = new IntlMessageFormat(en.matchSummary, 'en').format({ count: 1 })
  const many = new IntlMessageFormat(en.matchSummary, 'en').format({ count: 62 })
  assert.equal(one, '1 token matches the signed value')
  assert.equal(many, '62 tokens match the signed values')
  const arTwo = new IntlMessageFormat(ar.matchDiffer, 'ar').format({ count: 2 })
  assert.equal(arTwo, 'رمزان يختلفان عن القيمة المعتمدة')
})

test('canonical css compare treats minified and source spellings as equal', () => {
  const eq = (live: string, signed: string) => assert.equal(canonicalCssValue(live), canonicalCssValue(signed), `${live} vs ${signed}`)
  eq('#f4f4f4', '#F4F4F4')
  eq('#ccc', '#CCCCCC')
  eq('#ffffff14', 'rgba(255, 255, 255, 0.08)')
  eq('0 24px 80px #00000061', '0 24px 80px rgba(0, 0, 0, 0.38)')
  eq(
    '\n    0 10px 32px #00000047,inset 0 1px 0 #ffffff0d',
    '0 10px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
  )
  eq('0 8px 32px -8px #000000a6', '0 8px 32px -8px rgba(0, 0, 0, 0.65)')
  eq('0 0 6px #ef4444e6', '0 0 6px rgba(239, 68, 68, 0.9)')
  assert.notEqual(canonicalCssValue('#101011'), canonicalCssValue('#101010'))
  assert.notEqual(canonicalCssValue('8px'), canonicalCssValue('9px'))
  assert.equal(canonicalCssValue(''), '')
})

test('signed values that reference another token resolve to the final value', () => {
  assert.equal(resolveSignedValue('--status-success'), SIGNED_TOKENS['--color-brand-green-safe'])
  assert.equal(resolveSignedValue('--status-neutral'), SIGNED_TOKENS['--text-mute'])
  assert.equal(resolveSignedValue('--status-neutral-line'), SIGNED_TOKENS['--line-2'])
  assert.equal(resolveSignedValue('--bg-0'), '#090909')
})

// DS-04: the page is admin-only because it lives under the admin layout and nowhere else.
const pagePath = 'src/app/[locale]/admin/design-system/page.tsx'
const viewPath = 'src/components/admin/design-system/design-system-view.tsx'

function dirsNamed(dir: URL, name: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = new URL(`${entry.name}/`, dir)
    if (entry.name === name) out.push(child.pathname.replace(root.pathname, '').replace(/\/$/, ''))
    dirsNamed(child, name, out)
  }
  return out
}

test('DS-04: the page file exists under the admin route', () => {
  assert.ok(existsSync(new URL(pagePath, root)), `${pagePath} is missing`)
  assert.ok(existsSync(new URL(viewPath, root)), `${viewPath} is missing`)
})

test('DS-04: no other design-system route directory exists under src/app', () => {
  assert.deepEqual(dirsNamed(new URL('src/app/', root), 'design-system'), ['src/app/[locale]/admin/design-system'])
})

test('DS-04: the admin layout still redirects signed-out and non-admin users', () => {
  const layout = read('src/app/[locale]/admin/layout.tsx')
  // 05-15 (D-17): one gate, requireAdmin(); failures go to /watch or /auth/mfa.
  assert.ok(layout.includes('await requireAdmin()'))
  assert.ok(layout.includes("redirect({ href: '/watch', locale })"))
  assert.ok(layout.includes("pathname: '/auth/mfa'"))
  assert.ok(!layout.includes('admin_user_id'))
})

test('DS-04: the page and the view read no data', () => {
  for (const file of [pagePath, viewPath]) {
    const source = read(file)
    for (const banned of ['createClient', 'createAdminClient', 'supabase', 'fetch(']) {
      assert.ok(!source.includes(banned), `${file} contains "${banned}"`)
    }
  }
})

test('DS-04: the view reads live styles through useSyncExternalStore, with no effect hook', () => {
  const view = read(viewPath)
  assert.ok(view.includes('useSyncExternalStore'))
  assert.ok(!view.includes('useEffect'))
  assert.ok(view.includes('@/lib/design-truth'))
})

test('DS-04: the sidebar links the page after Audit', () => {
  const header = read('src/components/admin/admin-header.tsx')
  const matches = header.match(/\/admin\/design-system/g) ?? []
  assert.equal(matches.length, 1)
  assert.ok(header.indexOf("href: '/admin/audit'") < header.indexOf("href: '/admin/design-system'"))
  assert.ok(!header.includes('rounded-['))
})
