import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  parseIsoDuration,
  secondsToMinutes,
} from '../../src/server/youtube/duration.ts'

test('parseIsoDuration covers every optional part', () => {
  assert.equal(parseIsoDuration('PT24M10S'), 1450)
  assert.equal(parseIsoDuration('PT1H2M45S'), 3765)
  assert.equal(parseIsoDuration('P1DT2H'), 93600)
  assert.equal(parseIsoDuration('PT30S'), 30)
  assert.equal(parseIsoDuration('PT2H'), 7200)
  assert.equal(parseIsoDuration('P2D'), 172800)
})

test('zero durations are 0, not null', () => {
  assert.equal(parseIsoDuration('PT0S'), 0)
  assert.equal(parseIsoDuration('P0D'), 0)
})

test('empty and malformed input is null', () => {
  assert.equal(parseIsoDuration(''), null)
  assert.equal(parseIsoDuration('garbage'), null)
  assert.equal(parseIsoDuration('P'), null)
  assert.equal(parseIsoDuration('PT'), null)
  assert.equal(parseIsoDuration('24M10S'), null)
  assert.equal(parseIsoDuration(null as unknown as string), null)
  assert.equal(parseIsoDuration(undefined as unknown as string), null)
})

test('secondsToMinutes rounds and never returns less than 1', () => {
  assert.equal(secondsToMinutes(1450), 24)
  assert.equal(secondsToMinutes(10), 1)
  assert.equal(secondsToMinutes(0), 1)
  assert.equal(secondsToMinutes(90), 2)
})
