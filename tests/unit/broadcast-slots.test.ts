/**
 * Unit tests for nextBroadcastSlots — the date maths behind bulk episode
 * scheduling.
 *
 * Runs with the Node.js built-in test runner. No Vitest or Jest needed.
 *
 * Everything here is anchored to Dubai wall-clock time (+04:00, no DST), so the
 * expected values are written as UTC instants four hours behind the intended
 * local air time: 21:00 in Dubai is 17:00Z the same day.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextBroadcastSlots } from '../../src/lib/scheduling.ts'

// 2026-08-10 is a Monday. 08:00Z = 12:00 Dubai, so a 21:00 Dubai slot that same
// day is still in the future.
const MONDAY_MORNING = new Date('2026-08-10T08:00:00Z')

test('single weekly day returns consecutive weeks', () => {
  const slots = nextBroadcastSlots(['Friday'], '21:00:00', 3, MONDAY_MORNING)
  assert.deepEqual(slots, [
    '2026-08-14T17:00:00.000Z', // Fri 14 Aug, 21:00 Dubai
    '2026-08-21T17:00:00.000Z',
    '2026-08-28T17:00:00.000Z',
  ])
})

test('two days a week alternate in calendar order', () => {
  const slots = nextBroadcastSlots(
    ['Monday', 'Friday'],
    '21:00:00',
    4,
    MONDAY_MORNING
  )
  assert.deepEqual(slots, [
    '2026-08-10T17:00:00.000Z', // Mon 10 Aug — today, 21:00 still ahead
    '2026-08-14T17:00:00.000Z', // Fri 14 Aug
    '2026-08-17T17:00:00.000Z', // Mon 17 Aug
    '2026-08-21T17:00:00.000Z', // Fri 21 Aug
  ])
})

test("day order in the input does not affect output order", () => {
  const asGiven = nextBroadcastSlots(
    ['Friday', 'Monday'],
    '21:00:00',
    4,
    MONDAY_MORNING
  )
  const sorted = nextBroadcastSlots(
    ['Monday', 'Friday'],
    '21:00:00',
    4,
    MONDAY_MORNING
  )
  assert.deepEqual(asGiven, sorted)
})

test("today's slot is skipped once its time has passed", () => {
  // 19:00Z = 23:00 Dubai on Monday — past the 21:00 airing.
  const mondayNight = new Date('2026-08-10T19:00:00Z')
  const slots = nextBroadcastSlots(['Monday'], '21:00:00', 1, mondayNight)
  assert.deepEqual(slots, ['2026-08-17T17:00:00.000Z'])
})

test('a slot exactly at "now" is treated as past, not scheduled', () => {
  const exactly = new Date('2026-08-10T17:00:00Z')
  const slots = nextBroadcastSlots(['Monday'], '21:00:00', 1, exactly)
  assert.deepEqual(slots, ['2026-08-17T17:00:00.000Z'])
})

test('rolls across month and year boundaries', () => {
  const decLate = new Date('2026-12-28T08:00:00Z') // Monday 28 Dec 2026
  const slots = nextBroadcastSlots(['Monday'], '21:00:00', 3, decLate)
  assert.deepEqual(slots, [
    '2026-12-28T17:00:00.000Z',
    '2027-01-04T17:00:00.000Z',
    '2027-01-11T17:00:00.000Z',
  ])
})

test('a time near midnight stays on its Dubai calendar day', () => {
  // 00:30 Dubai on Friday is 20:30Z the *previous* day.
  const slots = nextBroadcastSlots(['Friday'], '00:30', 1, MONDAY_MORNING)
  assert.deepEqual(slots, ['2026-08-13T20:30:00.000Z'])
})

test('accepts HH:mm as well as HH:mm:ss', () => {
  const short = nextBroadcastSlots(['Friday'], '21:00', 2, MONDAY_MORNING)
  const long = nextBroadcastSlots(['Friday'], '21:00:00', 2, MONDAY_MORNING)
  assert.deepEqual(short, long)
})

test('all seven days give seven consecutive slots', () => {
  const slots = nextBroadcastSlots(
    [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ],
    '21:00:00',
    7,
    MONDAY_MORNING
  )
  assert.equal(slots.length, 7)
  // Consecutive calendar days, starting today.
  for (let i = 1; i < slots.length; i++) {
    const gap =
      new Date(slots[i]).getTime() - new Date(slots[i - 1]).getTime()
    assert.equal(gap, 24 * 60 * 60 * 1000)
  }
})

// Degenerate inputs — these must return nothing rather than throw, because the
// caller renders whatever comes back straight into a confirmation dialog.

test('returns empty when no days are selected', () => {
  assert.deepEqual(nextBroadcastSlots([], '21:00:00', 3, MONDAY_MORNING), [])
  assert.deepEqual(nextBroadcastSlots(null, '21:00:00', 3, MONDAY_MORNING), [])
})

test('returns empty when the show has no broadcast time', () => {
  assert.deepEqual(nextBroadcastSlots(['Friday'], null, 3, MONDAY_MORNING), [])
  assert.deepEqual(nextBroadcastSlots(['Friday'], '', 3, MONDAY_MORNING), [])
})

test('returns empty for a non-positive count', () => {
  assert.deepEqual(nextBroadcastSlots(['Friday'], '21:00:00', 0, MONDAY_MORNING), [])
  assert.deepEqual(nextBroadcastSlots(['Friday'], '21:00:00', -5, MONDAY_MORNING), [])
})

test('unrecognised weekday names yield no slots', () => {
  assert.deepEqual(
    nextBroadcastSlots(['Funday'], '21:00:00', 3, MONDAY_MORNING),
    []
  )
})
