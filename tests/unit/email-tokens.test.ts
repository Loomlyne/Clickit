import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EMAIL_TOKENS } from '../../src/lib/email-tokens.ts'
import { contrastRatio } from '../../src/lib/design-truth.ts'

// Q7 = C (Koss, 2026-10-20): emails follow the reader's colour scheme. Values are literal hex
// because mail clients do not resolve CSS variables or blend rgba.

const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8')

test('light scheme values are pinned', () => {
  assert.deepEqual(EMAIL_TOKENS.light, {
    header: '#090909',
    headerText: '#F4F4F4',
    body: '#ffffff',
    heading: '#111111',
    text: '#333333',
    codeBg: '#f6f6f6',
    codeBorder: '#e5e5e5',
    codeText: '#090909',
    footerText: '#767676',
    divider: '#eeeeee',
  })
})

test('dark scheme values are pinned', () => {
  assert.deepEqual(EMAIL_TOKENS.dark, {
    page: '#090909',
    body: '#090909',
    header: '#090909',
    heading: '#F4F4F4',
    text: '#CCCCCC',
    headerDivider: '#1d1d1d',
    codeBg: '#191919',
    codeBorder: '#2A2A2A',
    codeText: '#ffcc00',
    footerText: '#A1A1A1',
    divider: '#1d1d1d',
  })
})

test('button tokens are pinned', () => {
  assert.deepEqual(EMAIL_TOKENS.button, { bg: '#ffcc00', ink: '#090909', radius: '999px' })
})

test('every colour is literal #RRGGBB (no var(), no rgba)', () => {
  for (const scheme of [EMAIL_TOKENS.light, EMAIL_TOKENS.dark]) {
    for (const [name, value] of Object.entries(scheme)) {
      assert.match(value, /^#[0-9a-fA-F]{6}$/, name)
    }
  }
  assert.match(EMAIL_TOKENS.button.bg, /^#[0-9a-fA-F]{6}$/)
  assert.match(EMAIL_TOKENS.button.ink, /^#[0-9a-fA-F]{6}$/)
})

test('button colours equal --primary / --primary-foreground in globals.css', () => {
  const primary = /--primary:\s*(#[0-9a-fA-F]{6});/.exec(css)?.[1]
  const ink = /--primary-foreground:\s*(#[0-9a-fA-F]{6});/.exec(css)?.[1]
  assert.equal(EMAIL_TOKENS.button.bg.toLowerCase(), primary?.toLowerCase())
  assert.equal(EMAIL_TOKENS.button.ink.toLowerCase(), ink?.toLowerCase())
})

// Light footerText is #767676 (4.54:1 on #ffffff), not Phase 5's pictured #777777 (4.48:1,
// under AA). Same look; Phase 5 confirms when it signs its picture.
test('light footer text meets AA (4.5:1) on the light body', () => {
  assert.ok(contrastRatio(EMAIL_TOKENS.light.footerText, EMAIL_TOKENS.light.body) >= 4.5)
})
