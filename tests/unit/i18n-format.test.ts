import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatClock,
  formatNumberList,
  isolate,
  localeTag,
} from '../../src/lib/i18n-format.ts'

test('formatClock: m:ss under an hour, h:mm:ss from an hour', () => {
  assert.equal(formatClock(552, 'en'), '9:12')
  assert.equal(formatClock(3765, 'en'), '1:02:45')
  assert.equal(formatClock(0, 'en'), '0:00')
  assert.equal(formatClock(3599, 'en'), '59:59')
  assert.equal(formatClock(3600, 'en'), '1:00:00')
  assert.equal(formatClock(59.9, 'en'), '0:59')
})

test('formatClock: negative, NaN and Infinity are 0:00', () => {
  assert.equal(formatClock(-5, 'en'), '0:00')
  assert.equal(formatClock(Number.NaN, 'en'), '0:00')
  assert.equal(formatClock(Number.POSITIVE_INFINITY, 'en'), '0:00')
})

test('formatClock in Arabic takes every digit from one numbering system', () => {
  const nf = (n: number, min: number) =>
    new Intl.NumberFormat('ar', { minimumIntegerDigits: min }).format(n)
  assert.equal(formatClock(552, 'ar'), `${nf(9, 1)}:${nf(12, 2)}`)
  assert.equal(formatClock(3765, 'ar'), `${nf(1, 1)}:${nf(2, 2)}:${nf(45, 2)}`)
})

test('isolate wraps in first-strong isolate and pop isolate', () => {
  assert.equal(isolate('حلقة'), '⁨حلقة⁩')
  assert.equal(isolate('Show').charCodeAt(0), 0x2068)
  assert.equal(isolate('Show').charCodeAt(5), 0x2069)
})

test('formatNumberList is a localized conjunction over localized numbers', () => {
  assert.equal(formatNumberList([1, 2, 4, 7], 'en'), '1, 2, 4, and 7')
  assert.equal(formatNumberList([3], 'en'), '3')
  assert.equal(formatNumberList([], 'en'), '')
  const nf = new Intl.NumberFormat('ar')
  const expected = new Intl.ListFormat('ar', { style: 'long', type: 'conjunction' }).format(
    [1, 2, 4].map((n) => nf.format(n))
  )
  assert.equal(formatNumberList([1, 2, 4], 'ar'), expected)
})

test('localeTag is the date tag from UI-SPEC', () => {
  assert.equal(localeTag('ar'), 'ar-AE')
  assert.equal(localeTag('en'), 'en-GB')
  assert.equal(localeTag('fr'), 'en-GB')
})
