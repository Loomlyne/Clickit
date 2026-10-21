import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatQuotaReset, nextQuotaReset } from '../../src/lib/youtube-quota.ts'

const iso = (d: Date) => d.toISOString()

test('PDT: midnight Los Angeles is 07:00 UTC, 11:00 Dubai', () => {
  const reset = nextQuotaReset(new Date('2026-10-20T08:00:00Z'))
  assert.equal(iso(reset), '2026-10-21T07:00:00.000Z')
  assert.equal(formatQuotaReset(reset, 'en'), '11:00')
})

test('PST: midnight Los Angeles is 08:00 UTC, 12:00 Dubai', () => {
  const reset = nextQuotaReset(new Date('2026-12-01T10:00:00Z'))
  assert.equal(iso(reset), '2026-12-02T08:00:00.000Z')
  assert.equal(formatQuotaReset(reset, 'en'), '12:00')
})

test('just before the reset it is that same instant; at the instant it is 24 hours later', () => {
  const reset = new Date('2026-10-21T07:00:00Z')
  assert.equal(iso(nextQuotaReset(new Date(reset.getTime() - 1))), iso(reset))
  assert.equal(iso(nextQuotaReset(reset)), '2026-10-22T07:00:00.000Z')
})

test('across the November change the result is still local midnight in Los Angeles', () => {
  // US DST ended Sunday 2026-11-01 at 02:00 local.
  // Saturday evening PDT: next midnight is the start of Sunday, still PDT.
  assert.equal(iso(nextQuotaReset(new Date('2026-11-01T03:00:00Z'))), '2026-11-01T07:00:00.000Z')
  // Sunday after the change: the next midnight is PST.
  assert.equal(iso(nextQuotaReset(new Date('2026-11-01T10:00:00Z'))), '2026-11-02T08:00:00.000Z')
  // Spring: DST starts Sunday 2027-03-14 at 02:00 local.
  assert.equal(iso(nextQuotaReset(new Date('2027-03-14T05:00:00Z'))), '2027-03-14T08:00:00.000Z')
  assert.equal(iso(nextQuotaReset(new Date('2027-03-14T12:00:00Z'))), '2027-03-15T07:00:00.000Z')
})

test('the reset is always 00:00 in Los Angeles and strictly after now', () => {
  const la = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  })
  const start = Date.parse('2026-01-01T00:00:00Z')
  for (let i = 0; i < 400; i++) {
    const now = new Date(start + i * 86_400_000 * 0.9 + 13 * 60_000)
    const reset = nextQuotaReset(now)
    assert.ok(reset.getTime() > now.getTime())
    assert.ok(reset.getTime() - now.getTime() <= 25 * 3_600_000)
    assert.equal(la.format(reset), '00:00')
  }
})

test('formatQuotaReset shows Dubai wall time with hour and minute', () => {
  assert.equal(formatQuotaReset(new Date('2026-10-21T07:00:00Z'), 'en'), '11:00')
  assert.equal(formatQuotaReset(new Date('2026-10-21T07:05:00Z'), 'en'), '11:05')
  const ar = formatQuotaReset(new Date('2026-10-21T07:00:00Z'), 'ar')
  assert.equal(
    ar,
    new Intl.DateTimeFormat('ar-AE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai',
    }).format(new Date('2026-10-21T07:00:00Z'))
  )
})
