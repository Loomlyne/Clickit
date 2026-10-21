// Row presentation rules for the import preview table (06-12, UI-SPEC 1.6-1.7).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  importRowView,
  type ImportTableRow,
} from '../../src/lib/admin/import-row-view.ts'
import { formatClock } from '../../src/lib/i18n-format.ts'

const row = (over: Partial<ImportTableRow> = {}): ImportTableRow => ({
  videoId: 'abcdefghijk',
  position: 1,
  title: 'Episode 1',
  thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
  durationSeconds: 1450,
  status: 'ok',
  privacy: 'public',
  arabicTitle: false,
  ...over,
})

test('ready unlisted Arabic-title row is tickable with two sublines', () => {
  const v = importRowView(
    row({ status: 'ok', privacy: 'unlisted', arabicTitle: true }),
    'en'
  )
  assert.equal(v.tickable, true)
  assert.equal(v.tone, 'ok')
  assert.equal(v.chipKey, 'ready')
  assert.deepEqual(v.sublineKeys, ['visibilityUnlisted', 'arabicTitle'])
  assert.equal(v.reasonKey, undefined)
})

test('ready public row has only the visibility subline', () => {
  const v = importRowView(row(), 'en')
  assert.deepEqual(v.sublineKeys, ['visibilityPublic'])
})

test('ready row with unknown privacy shows no visibility subline', () => {
  const v = importRowView(row({ privacy: null }), 'en')
  assert.deepEqual(v.sublineKeys, [])
})

test('bad statuses are skipped with their chip and reason keys', () => {
  const cases = [
    ['private', 'private', 'reason.private'],
    ['removed', 'removed', 'reason.removed'],
    ['not_embeddable', 'notEmbeddable', 'reason.notEmbeddable'],
    ['blocked_ae', 'blockedUae', 'reason.blockedUae'],
  ] as const
  for (const [status, chipKey, reasonKey] of cases) {
    const v = importRowView(row({ status, privacy: null }), 'en')
    assert.equal(v.tickable, false, status)
    assert.equal(v.tone, 'bad', status)
    assert.equal(v.chipKey, chipKey, status)
    assert.equal(v.reasonKey, reasonKey, status)
    assert.deepEqual(v.sublineKeys, [], status)
  }
})

test('not_ready without a premiere date is processing', () => {
  const v = importRowView(row({ status: 'not_ready' }), 'en')
  assert.equal(v.tickable, false)
  assert.equal(v.tone, 'warn')
  assert.equal(v.chipKey, 'notReady')
  assert.equal(v.reasonKey, 'reason.processing')
  assert.equal(v.params, undefined)
})

test('not_ready with a premiere date carries a Dubai-formatted date', () => {
  const v = importRowView(
    row({ status: 'not_ready', premieresAt: '2026-11-02T17:30:00Z' }),
    'en'
  )
  assert.equal(v.reasonKey, 'reason.premieres')
  const expected = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(new Date('2026-11-02T17:30:00Z'))
  assert.deepEqual(v.params, { date: expected })
  // 17:30Z is 21:30 in Dubai (UTC+4)
  assert.match(String(v.params?.date), /21:30/)
})

test('Arabic locale formats the premiere date with ar-AE', () => {
  const v = importRowView(
    row({ status: 'not_ready', premieresAt: '2026-11-02T17:30:00Z' }),
    'ar'
  )
  const expected = new Intl.DateTimeFormat('ar-AE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(new Date('2026-11-02T17:30:00Z'))
  assert.equal(v.params?.date, expected)
})

test('an unparsable premiere date falls back to processing', () => {
  const v = importRowView(
    row({ status: 'not_ready', premieresAt: 'not a date' }),
    'en'
  )
  assert.equal(v.reasonKey, 'reason.processing')
})

test('already with existing location is neutral and carries params', () => {
  const v = importRowView(
    row({
      status: 'already',
      existing: { showTitle: 'Show', seasonNumber: 2, episodeNumber: 5 },
    }),
    'en'
  )
  assert.equal(v.tickable, false)
  assert.equal(v.tone, 'neutral')
  assert.equal(v.chipKey, 'alreadyOnClickit')
  assert.equal(v.reasonKey, 'reason.alreadyOnClickit')
  assert.deepEqual(v.params, { show: 'Show', season: 2, episode: 5 })
})

test('already without a known location still skips and shows the chip', () => {
  const v = importRowView(row({ status: 'already' }), 'en')
  assert.equal(v.tickable, false)
  assert.equal(v.chipKey, 'alreadyOnClickit')
  assert.equal(v.reasonKey, undefined)
})

test('time is an em dash when the length is unknown, else formatClock', () => {
  assert.equal(importRowView(row({ durationSeconds: null }), 'en').time, '—')
  assert.equal(
    importRowView(row({ durationSeconds: 1450 }), 'en').time,
    formatClock(1450, 'en')
  )
  assert.equal(importRowView(row({ durationSeconds: 3725 }), 'en').time, '1:02:05')
  assert.equal(
    importRowView(row({ durationSeconds: 1450 }), 'ar').time,
    formatClock(1450, 'ar')
  )
})
