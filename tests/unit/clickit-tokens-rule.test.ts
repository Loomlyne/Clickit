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
]

for (const [name, code] of FAILS) {
  test(`flags: ${name}`, () => {
    const found = reports(code)
    assert.ok(found.length >= 1, `expected a report for: ${code}`)
    for (const m of found) {
      assert.match(m.message, /Raw (hex|rgb|radius|shadow|palette) value/)
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

test('PATTERNS has exactly hex, rgb, radius, shadow, palette', () => {
  assert.deepEqual(Object.keys(PATTERNS).sort(), [
    'hex',
    'palette',
    'radius',
    'rgb',
    'shadow',
  ])
})

test('message names the kind, the fragment and the named utility', () => {
  const [m] = reports("const a = 'rounded-[12px]'")
  assert.match(m.message, /radius/)
  assert.match(m.message, /rounded-\[/)
  assert.match(m.message, /rounded-chip\|control\|shell\|field\|card\|media\|panel\|hairline/)
})
