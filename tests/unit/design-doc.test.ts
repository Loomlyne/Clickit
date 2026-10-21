import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  RADIUS_CODEMOD,
  SHADOW_CODEMOD,
  STATUS_TONES,
  canonicalCssValue,
  normalizeCssValue,
} from '../../src/lib/design-truth.ts'
import { EMAIL_TOKENS } from '../../src/lib/email-tokens.ts'

const doc = readFileSync(new URL('../../DESIGN.md', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8')

/** Text of the `## heading` section (up to the next `## `), or fail. */
function section(heading: string): string {
  const lines = doc.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`))
  assert.ok(start >= 0, `DESIGN.md has no "## ${heading}" section`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => l.startsWith('## '))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

/** Markdown table rows (header and separator skipped) as trimmed cells. */
function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) => l.slice(1, l.lastIndexOf('|')).split('|').map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c)))
    .slice(1)
}

/** Backtick-quoted spans in a cell. */
function ticks(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}

/** Every declaration value of a custom property in globals.css. */
function declarations(name: string): string[] {
  const re = new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`, 'g')
  return [...css.matchAll(re)].map((m) => m[1])
}

/** Compare-ready value: colours normalised, spaces inside brackets dropped. */
function squash(value: string): string {
  return canonicalCssValue(value).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
}

function assertTokenTable(headingName: string): number {
  const table = rows(section(headingName)).filter((cells) => ticks(cells[0]).some((t) => t.startsWith('--')))
  assert.ok(table.length > 0, `no token rows in "${headingName}"`)
  for (const cells of table) {
    const names = ticks(cells[0])
    const value = ticks(cells[1])[0]
    assert.ok(value !== undefined, `no value in row ${cells[0]}`)
    for (const name of names) {
      const found = declarations(name)
      assert.ok(found.length > 0, `${name} (DESIGN.md "${headingName}") is not declared in globals.css`)
      for (const v of found) {
        assert.equal(squash(v), squash(value), `${name}: globals.css has "${v}", DESIGN.md has "${value}"`)
      }
    }
  }
  return table.length
}

test('Mode and Color table equals globals.css, every token name', () => {
  const n = assertTokenTable('Mode and Color')
  assert.ok(n >= 14, `only ${n} rows`)
  for (const t of ['--bg-1', '--bg-2', '--bg-3', '--bg-4', '--destructive', '--ring']) {
    assert.ok(doc.includes(`\`${t}\``), `${t} missing from DESIGN.md`)
  }
})

test('Exact legacy tokens table equals globals.css', () => {
  const n = assertTokenTable('Exact legacy tokens')
  assert.ok(n >= 9, `only ${n} rows`)
})

test('normalizeCssValue treats spacing and case as equal (guard for the parser)', () => {
  assert.equal(normalizeCssValue('rgba(255,255,255,0.08)'), normalizeCssValue('rgba(255, 255, 255, 0.08)'))
  assert.equal(normalizeCssValue('#d7ad16'), normalizeCssValue('#D7AD16'))
})

test('Radius Roles table lists every role with the px of RADIUS_CODEMOD and globals.css', () => {
  const table = rows(section('Radius Roles')).filter((cells) => /^rounded-/.test(ticks(cells[1] ?? '')[0] ?? ''))
  const byRole = new Map(table.map((cells) => [cells[0].replace(/`/g, ''), cells]))
  const expected: Record<string, number> = {
    chip: 999,
    control: 999,
    shell: 999,
    field: 8,
    card: 12,
    media: 11,
    panel: 16,
    hairline: 1,
  }
  for (const [role, px] of Object.entries(expected)) {
    const cells = byRole.get(role)
    assert.ok(cells, `Radius Roles has no row for ${role}`)
    assert.equal(ticks(cells[1])[0], `rounded-${role}`)
    assert.equal(Number(cells[3].replace(/\D/g, '')), px, `${role} px in DESIGN.md`)
    const token = role === 'hairline' ? '--radius-hairline' : `--uis-r-${role}`
    assert.equal(ticks(cells[2])[0], token, `${role} token cell`)
    const found = declarations(token)
    assert.ok(found.length > 0, `${token} is not declared in globals.css`)
    for (const v of found) assert.equal(v.trim(), `${px}px`, `${token} in globals.css`)
  }
  for (const m of RADIUS_CODEMOD) {
    const role = /^rounded-(?:b-|t-)?(card|media|field|panel|hairline)$/.exec(m.to)?.[1]
    if (!role) continue
    assert.equal(m.px, expected[role], `RADIUS_CODEMOD ${m.to} px`)
  }
  assert.ok(doc.includes('`--radius` 8px'), 'the --radius base note is missing')
  for (const std of ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl']) {
    assert.ok(doc.includes(std), `${std} missing from the standard scale line`)
  }
})

test('Shadows table lists every SHADOW_CODEMOD utility with the globals.css value', () => {
  const table = rows(section('Shadows')).filter((cells) => /^(drop-)?shadow-/.test(ticks(cells[0])[0] ?? ''))
  const byUtility = new Map(table.map((cells) => [ticks(cells[0])[0], cells]))
  const wanted = new Set(SHADOW_CODEMOD.map((m) => m.to))
  assert.ok(wanted.size >= 9)
  for (const utility of wanted) {
    const cells = byUtility.get(utility)
    assert.ok(cells, `Shadows has no row for ${utility}`)
    const token = `--${utility}`
    const found = declarations(token)
    assert.ok(found.length > 0, `${token} is not declared in globals.css`)
    for (const v of found) {
      assert.equal(squash(v), squash(ticks(cells[1])[0]), `${utility}: globals.css has "${v}"`)
    }
  }
})

test('Status tones table lists every tone with the STATUS_TONES classes', () => {
  const table = rows(section('Status tones'))
  for (const tone of STATUS_TONES) {
    const cells = table.find((c) => c[0].replace(/`/g, '') === tone.tone)
    assert.ok(cells, `Status tones has no row for ${tone.tone}`)
    assert.equal(ticks(cells[1])[0], tone.cssVar)
    for (const cls of tone.newClasses) assert.ok(cells[2].includes(`\`${cls}\``), `${tone.tone} row misses ${cls}`)
    assert.ok(declarations(tone.cssVar).length > 0, `${tone.cssVar} is not declared in globals.css`)
  }
})

test('DESIGN.md carries none of the old literals', () => {
  for (const banned of ['#0a0a0a', '6073ff', '7082ff', '10131a', '11151d', 'indigo']) {
    assert.ok(!doc.toLowerCase().includes(banned), `DESIGN.md still contains ${banned}`)
  }
})

test('DESIGN.md names the guard, the page, the brand class and the email scheme rule', () => {
  for (const needle of [
    '/admin/design-system',
    'brand-yellow',
    'Desert Sand',
    'clickit/no-raw-design-values',
    'prefers-color-scheme',
    'No element is ever drawn over any pixel of the YouTube iframe',
    'rounded-card',
    'text-status-success',
  ]) {
    assert.ok(doc.includes(needle), `DESIGN.md is missing "${needle}"`)
  }
})

test('DESIGN.md has no private link (public repo)', () => {
  assert.ok(!/claude\.ai/i.test(doc), 'DESIGN.md must not link to a claude.ai artifact')
})

test('Email tables equal EMAIL_TOKENS, both schemes, every role', () => {
  const email = section('Email')
  const parts = email.split(/^### /m)
  const find = (name: string) => {
    const part = parts.find((p) => p.toLowerCase().startsWith(name))
    assert.ok(part, `Email section has no "### ${name}" table`)
    return rows(part)
  }
  const check = (scheme: 'light' | 'dark') => {
    const table = find(scheme)
    const tokens: Record<string, string> = EMAIL_TOKENS[scheme]
    const seen = new Set<string>()
    for (const cells of table) {
      const role = ticks(cells[0])[0]
      const hex = ticks(cells[1])[0]
      assert.ok(role in tokens, `${scheme}: DESIGN.md role "${role}" is not in EMAIL_TOKENS`)
      assert.equal(hex.toLowerCase(), tokens[role].toLowerCase(), `${scheme}.${role}`)
      seen.add(role)
    }
    assert.deepEqual([...seen].sort(), Object.keys(tokens).sort(), `${scheme}: roles in DESIGN.md vs EMAIL_TOKENS`)
  }
  check('light')
  check('dark')

  const button = find('button')
  const seen = new Set<string>()
  for (const cells of button) {
    const key = ticks(cells[0])[0]
    assert.equal(ticks(cells[1])[0].toLowerCase(), (EMAIL_TOKENS.button as Record<string, string>)[key].toLowerCase(), `button.${key}`)
    seen.add(key)
  }
  assert.deepEqual([...seen].sort(), Object.keys(EMAIL_TOKENS.button).sort())

  // Every hex in the section belongs to the token module.
  const known = new Set(
    [...Object.values(EMAIL_TOKENS.light), ...Object.values(EMAIL_TOKENS.dark), ...Object.values(EMAIL_TOKENS.button)].map((v) => v.toLowerCase()),
  )
  for (const m of email.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    assert.ok(known.has(m[0].toLowerCase()), `Email section mentions ${m[0]}, which is not an EMAIL_TOKENS value`)
  }
})
