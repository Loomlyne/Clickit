import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AUTH_LINK_MINUTES,
  CODE_LENGTH,
  RESEND_WAIT_SECONDS,
  normalizeCode,
  resendRemaining,
} from '../../src/lib/auth-code.ts'

const RLM = String.fromCharCode(0x200f)
const LRM = String.fromCharCode(0x200e)

test('plain, spaced and hyphenated codes normalise to six digits', () => {
  assert.equal(normalizeCode('481523'), '481523')
  assert.equal(normalizeCode('481 523'), '481523')
  assert.equal(normalizeCode('481-523'), '481523')
  assert.equal(normalizeCode('  481 - 523 \n'), '481523')
})

test('Arabic-Indic digits map to ASCII', () => {
  assert.equal(normalizeCode('٤٨١٥٢٣'), '481523')
})

test('Extended Arabic-Indic digits map to ASCII', () => {
  assert.equal(normalizeCode('۴۸۱۵۲۳'), '481523')
})

test('mixed digit systems normalise', () => {
  assert.equal(normalizeCode('٤8١5٢3'), '481523')
})

test('RLM and LRM around a pasted code are stripped', () => {
  assert.equal(normalizeCode(RLM + '481523' + LRM), '481523')
})

test('embedded and isolate bidi controls are stripped', () => {
  for (let cp = 0x202a; cp <= 0x202e; cp++) {
    assert.equal(normalizeCode('481' + String.fromCharCode(cp) + '523'), '481523', `U+${cp.toString(16)}`)
  }
  for (let cp = 0x2066; cp <= 0x2069; cp++) {
    assert.equal(normalizeCode('481' + String.fromCharCode(cp) + '523'), '481523', `U+${cp.toString(16)}`)
  }
})

test('input is capped at CODE_LENGTH digits', () => {
  assert.equal(normalizeCode('12345678'), '123456')
})

test('non-digits and non-strings give an empty string', () => {
  assert.equal(normalizeCode('abc'), '')
  assert.equal(normalizeCode(''), '')
  assert.equal(normalizeCode(undefined), '')
  assert.equal(normalizeCode(null), '')
})

test('letters between digits are dropped', () => {
  assert.equal(normalizeCode('4a8b1c5d2e3'), '481523')
})

test('resendRemaining counts whole seconds down and never goes below 0', () => {
  assert.equal(resendRemaining(0, 0), 60)
  assert.equal(resendRemaining(0, 59_001), 1)
  assert.equal(resendRemaining(0, 60_000), 0)
  assert.equal(resendRemaining(0, 999_999), 0)
})

test('timing constants', () => {
  assert.equal(CODE_LENGTH, 6)
  assert.equal(AUTH_LINK_MINUTES, 15)
  assert.equal(RESEND_WAIT_SECONDS, 60)
})
