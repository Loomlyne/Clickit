import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EMAIL_TOKENS } from '../../src/lib/email-tokens.ts'
import { contrastRatio } from '../../src/lib/design-truth.ts'

// Q7 = C (Koss, 2026-10-20): emails follow the reader's colour scheme. Values are literal hex
// because mail clients do not resolve CSS variables or blend rgba.

const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8')

// Every colour role from Koss's signed 05-q12-schemes picture (D-27 = Q12 C).
test('light scheme values are pinned', () => {
  assert.deepEqual(EMAIL_TOKENS.light, {
    page: '#F4F4F4',
    card: '#FFFFFF',
    header: '#090909',
    heading: '#111111',
    body: '#333333',
    hint: '#555555',
    codeBox: '#F6F6F6',
    codeBorder: '#E5E5E5',
    code: '#111111',
    rule: '#E5E5E5',
    footer: '#767676',
  })
})

test('dark scheme values are pinned', () => {
  assert.deepEqual(EMAIL_TOKENS.dark, {
    page: '#090909',
    card: '#101010',
    cardBorder: '#222222',
    header: '#101010',
    headerRule: '#222222',
    heading: '#F4F4F4',
    body: '#CCCCCC',
    hint: '#A1A1A1',
    codeBox: '#191919',
    codeBorder: '#2A2A2A',
    code: '#ffcc00',
    rule: '#222222',
    footer: '#A1A1A1',
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

// Light footer is #767676 (4.54:1 on the white card), as signed in 05-q12-schemes.
test('light footer text meets AA (4.5:1) on the light card', () => {
  assert.ok(contrastRatio(EMAIL_TOKENS.light.footer, EMAIL_TOKENS.light.card) >= 4.5)
})

test('body, hint and footer text meet AA on their card in both schemes', () => {
  for (const s of [EMAIL_TOKENS.light, EMAIL_TOKENS.dark]) {
    for (const role of ['heading', 'body', 'hint', 'footer'] as const) {
      assert.ok(contrastRatio(s[role], s.card) >= 4.5, role)
    }
  }
  assert.ok(contrastRatio(EMAIL_TOKENS.dark.code, EMAIL_TOKENS.dark.codeBox) >= 4.5)
  assert.ok(contrastRatio(EMAIL_TOKENS.light.code, EMAIL_TOKENS.light.codeBox) >= 4.5)
})
