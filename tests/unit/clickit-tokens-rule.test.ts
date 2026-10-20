import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Linter } from 'eslint'

import clickit, { PATTERNS } from '../../eslint-rules/clickit-tokens.mjs'

const RULE = 'clickit/no-raw-design-values'

function lint(code: string) {
  const linter = new Linter({ configType: 'flat' })
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.jsx'],
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { clickit },
        rules: { [RULE]: 'error' },
      },
    ],
    { filename: 'fixture.jsx' },
  )
  return messages
}

function reports(code: string) {
  const messages = lint(code)
  const fatal = messages.filter((m) => m.fatal)
  assert.deepEqual(fatal, [], `fixture failed to parse: ${code}`)
  return messages.filter((m) => m.ruleId === RULE)
}

const FAILS: Array<[string, string]> = [
  ['bracket radius', '<div className="rounded-[12px]" />'],
  ['variant side radius', '<div className="md:rounded-t-[16px]" />'],
  ['data-variant radius', '<div className="data-[state=open]:rounded-[8px]" />'],
  ['hover hex bracket', '<a className="hover:bg-[#7082ff]" />'],
  ['template bracket shadow with hex', 'const a = `p ${x} shadow-[0_1px_2px_#000] q`'],
  ['bracket rgba background', "const a = 'bg-[rgba(10,10,10,0.96)]'"],
  ['raw palette class', "const a = 'bg-red-500'"],
  [
    'bracket drop-shadow',
    "const a = 'drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]'",
  ],
  ['style hex literal', "const a = <div style={{ background: '#0a0a0a' }} />"],
  ['raw non-neutral rgba string', "const a = 'rgba(8,8,12,0.96)'"],
  // review fix 1: side and modifier prefixes on palette classes
  ['side border palette', "const a = 'border-t-red-500'"],
  ['logical side border palette', "const a = 'border-s-blue-400'"],
  ['axis border palette', "const a = 'hover:border-x-zinc-800'"],
  ['ring-offset palette', "const a = 'ring-offset-blue-400'"],
  ['placeholder palette', "const a = 'placeholder-gray-400'"],
  ['placeholder variant palette', "const a = 'placeholder:text-gray-500'"],
  ['divide palette', "const a = 'divide-slate-700'"],
  ['outline palette', "const a = 'outline-amber-300'"],
  ['decoration palette', "const a = 'decoration-pink-500'"],
  ['accent palette', "const a = 'accent-emerald-500'"],
  ['caret palette', "const a = 'caret-sky-400'"],
  ['fill palette', "const a = 'fill-rose-600'"],
  ['stroke palette', "const a = 'stroke-violet-500'"],
  ['palette with opacity', "const a = 'bg-red-500/40'"],
  // review fix 1: hsl()/oklch() values
  ['hsl value', "const a = 'hsl(0 0% 50%)'"],
  ['hsla value', "const a = 'hsla(210, 40%, 50%, 0.5)'"],
  ['oklch value', "const a = 'oklch(60% 0.2 25)'"],
  ['bracket hsl', "const a = 'bg-[hsl(210,40%,50%)]'"],
  // review fix 1: named colours in arbitrary values
  ['named colour bracket', "const a = 'bg-[red]'"],
  ['named colour side bracket', "const a = 'border-t-[navy]'"],
  ['named colour typed bracket', "const a = 'text-[color:tomato]'"],
  ['named colour in gradient', "const a = 'bg-[linear-gradient(to_right,red,blue)]'"],
  // review fix 1: rgb exemption is exact
  ['rgb with fractional third channel', "const a = 'rgb(0 0 0.5)'"],
  ['rgba with fractional third channel', "const a = 'rgba(0,0,0.5,1)'"],
  ['underscore rgb non-neutral', "const a = 'bg-[rgb(0_0_1)]'"],
  // review fix 2: real hex still flagged
  ['three-digit hex alone', "const a = '#abc'"],
  ['hex after a CSS keyword', "const a = '1px solid #333'"],
  ['hex after color:', "const a = 'color: #123'"],
  ['eight-digit hex', "const a = '#0a0a0aff'"],
]

const PASSES: Array<[string, string]> = [
  ['radius var bracket', "const a = 'rounded-[var(--uis-r-media)]'"],
  ['shadow var bracket', "const a = 'shadow-[var(--shadow-soft)]'"],
  ['html entity', "const a = '&#039;'"],
  ['anchor id', '<a href="#main" />'],
  ['bare hash href', '<a href="#" />'],
  ['neutral black rgba', "const a = 'rgba(0,0,0,0.85)'"],
  ['neutral white rgba', "const a = 'rgba(255, 255, 255, 0.1)'"],
  ['interpolated rgba', 'const a = `rgba(${r},${g},${b},0.35)`'],
  ['white and black overlays', "const a = 'bg-white/10 text-black/60'"],
  [
    'non-colour brackets',
    "const a = 'w-[12px] h-[3px] tracking-[0.2em] text-[11px]'",
  ],
  ['comment with hex', '// #fff in a comment\nconst a = 1'],
  ['rgb with var channel', "const a = 'rgb(var(--ink-legacy-rgb) / 0.96)'"],
  [
    'status and brand opacity classes',
    "const a = 'bg-status-success/8 text-brand-green-safe/35'",
  ],
  [
    'named utilities',
    "const a = 'rounded-card shadow-popover drop-shadow-splash'",
  ],
  // review fix 1: neutral underscore rgb, var-based colour functions, safe words
  ['underscore neutral black rgb', "const a = 'bg-[rgb(0_0_0/0.5)]'"],
  ['underscore neutral white rgb', "const a = 'bg-[rgb(255_255_255/0.1)]'"],
  ['neutral rgb space form', "const a = 'rgb(0 0 0 / 0.4)'"],
  ['hsl with var', "const a = 'hsl(var(--primary))'"],
  ['oklch with var', "const a = 'oklch(var(--x) / 0.5)'"],
  ['transparent and current', "const a = 'bg-transparent text-current border-[currentColor]'"],
  ['image url with a colour word', "const a = 'bg-[url(/img/red.png)]'"],
  ['var with a colour word', "const a = 'text-[var(--red)]'"],
  ['non-colour utility with a colour word', "const a = 'grid-cols-[tan_1fr]'"],
  // review fix 2: fragment links and order numbers
  ['fragment link add', '<a href="#add" />'],
  ['fragment link face', '<Link href="#face" />'],
  ['router to fragment', '<Link to="#bad" />'],
  ['href property', "const a = { href: '#add' }"],
  ['four-letter hash word', "const a = '#face'"],
  ['order number', "const a = 'Item #123'"],
  ['long order number', "const a = 'Order #123456 is ready'"],
  ['ticket ref in prose', "const a = `Ticket #${n} and tag #bad`"],
]

for (const [name, code] of FAILS) {
  test(`flags: ${name}`, () => {
    const found = reports(code)
    assert.ok(found.length >= 1, `expected a report for: ${code}`)
    for (const m of found) {
      assert.match(m.message, /Raw (hex|rgb|colorfn|named|radius|shadow|palette) value/)
      assert.match(m.message, /eslint-disable-next-line clickit\/no-raw-design-values -- /)
    }
  })
}

for (const [name, code] of PASSES) {
  test(`allows: ${name}`, () => {
    assert.deepEqual(
      reports(code).map((m) => m.message),
      [],
    )
  })
}

test('PATTERNS has exactly hex, rgb, colorfn, named, radius, shadow, palette', () => {
  assert.deepEqual(Object.keys(PATTERNS).sort(), [
    'colorfn',
    'hex',
    'named',
    'palette',
    'radius',
    'rgb',
    'shadow',
  ])
})

// review fix 3: a waiver must carry " -- <reason>"
const NO_REASON = /waiver needs a reason/

test('flags: waiver without a reason', () => {
  const found = reports(
    "// eslint-disable-next-line clickit/no-raw-design-values\nconst a = '#123456'",
  )
  assert.equal(found.length, 1)
  assert.match(found[0].message, NO_REASON)
})

test('flags: waiver with an empty reason', () => {
  const found = reports(
    "// eslint-disable-next-line clickit/no-raw-design-values -- \nconst a = '#123456'",
  )
  assert.ok(found.some((m) => NO_REASON.test(m.message)))
})

test('allows: waiver with a reason', () => {
  assert.deepEqual(
    reports(
      "// eslint-disable-next-line clickit/no-raw-design-values -- colour comes from the CMS row\nconst a = '#123456'",
    ).map((m) => m.message),
    [],
  )
})

test('allows: other rules waived without a reason', () => {
  assert.deepEqual(
    reports(
      "// eslint-disable-next-line no-console\nconst a = 1",
    ).map((m) => m.message),
    [],
  )
})

test('message names the kind, the fragment and the named utility', () => {
  const [m] = reports("const a = 'rounded-[12px]'")
  assert.match(m.message, /radius/)
  assert.match(m.message, /rounded-\[/)
  assert.match(m.message, /rounded-chip\|control\|shell\|field\|card\|media\|panel\|hairline/)
})
