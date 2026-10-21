// Shared "Can't play" rule and dashboard summary (D-17, UI-SPEC 5.3 / 5.5,
// RESEARCH Pattern 10). Pure; flag only, nothing is unpublished.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CHECK_OVERDUE_HOURS,
  cantPlayReason,
  summarizeYouTubeHealth,
  type HealthRow,
} from '../../src/lib/admin/youtube-health.ts'

const NOW = new Date('2026-10-20T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

let n = 0
function row(over: Partial<HealthRow> = {}): HealthRow {
  n += 1
  return {
    id: `ep-${n}`,
    show_id: 'show-a',
    show_title: 'Alpha',
    season_number: 1,
    episode_number: n,
    archived: false,
    youtube_status: 'ok',
    youtube_checked_at: hoursAgo(2),
    player_error_at: null,
    player_error_code: null,
    ...over,
  }
}

test('cantPlayReason: a stored not-ok status is the reason', () => {
  for (const s of ['private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready'] as const)
    assert.equal(cantPlayReason({ youtube_status: s }), s)
})

test('cantPlayReason: a viewer report newer than the last check', () => {
  assert.equal(
    cantPlayReason({
      youtube_status: 'ok',
      youtube_checked_at: hoursAgo(5),
      player_error_at: hoursAgo(1),
    }),
    'viewer_report'
  )
})

test('cantPlayReason: a report older than the last check is cleared by that check', () => {
  assert.equal(
    cantPlayReason({
      youtube_status: 'ok',
      youtube_checked_at: hoursAgo(1),
      player_error_at: hoursAgo(5),
    }),
    null
  )
})

test('cantPlayReason: no status and no report is fine', () => {
  assert.equal(cantPlayReason({ youtube_status: null }), null)
  assert.equal(
    cantPlayReason({ youtube_status: null, youtube_checked_at: null, player_error_at: null }),
    null
  )
})

test('cantPlayReason: a report with no check yet is a viewer report', () => {
  assert.equal(
    cantPlayReason({ youtube_status: null, youtube_checked_at: null, player_error_at: hoursAgo(1) }),
    'viewer_report'
  )
  assert.equal(
    cantPlayReason({ youtube_status: 'ok', youtube_checked_at: null, player_error_at: hoursAgo(1) }),
    'viewer_report'
  )
})

test('cantPlayReason: the stored status wins over a viewer report', () => {
  assert.equal(
    cantPlayReason({
      youtube_status: 'blocked_ae',
      youtube_checked_at: hoursAgo(5),
      player_error_at: hoursAgo(1),
    }),
    'blocked_ae'
  )
})

test('CHECK_OVERDUE_HOURS is 36', () => {
  assert.equal(CHECK_OVERDUE_HOURS, 36)
})

test('summary: lastCheckedAt is the newest check; not overdue inside 36 h', () => {
  const s = summarizeYouTubeHealth(
    [row({ youtube_checked_at: hoursAgo(30) }), row({ youtube_checked_at: hoursAgo(3) })],
    NOW
  )
  assert.equal(s.lastCheckedAt, hoursAgo(3))
  assert.equal(s.neverChecked, false)
  assert.equal(s.overdue, false)
  assert.deepEqual(s.cantPlay, [])
  assert.equal(s.cantPlayTotal, 0)
})

test('summary: overdue when the newest check is older than 36 h (exactly 36 h is not)', () => {
  assert.equal(summarizeYouTubeHealth([row({ youtube_checked_at: hoursAgo(37) })], NOW).overdue, true)
  assert.equal(summarizeYouTubeHealth([row({ youtube_checked_at: hoursAgo(36) })], NOW).overdue, false)
})

test('summary: never checked', () => {
  const s = summarizeYouTubeHealth([row({ youtube_checked_at: null, youtube_status: null })], NOW)
  assert.equal(s.lastCheckedAt, null)
  assert.equal(s.neverChecked, true)
  assert.equal(s.overdue, false)
  const empty = summarizeYouTubeHealth([], NOW)
  assert.equal(empty.neverChecked, true)
  assert.equal(empty.cantPlayTotal, 0)
})

test('summary: first 5 broken entries sorted by show, season, episode; total counts all', () => {
  const rows: HealthRow[] = [
    row({ show_id: 'show-b', show_title: 'Beta', season_number: 1, episode_number: 2, youtube_status: 'removed' }),
    row({ show_id: 'show-a', show_title: 'Alpha', season_number: 2, episode_number: 1, youtube_status: 'private' }),
    row({ show_id: 'show-a', show_title: 'Alpha', season_number: 1, episode_number: 3, youtube_status: 'blocked_ae' }),
    row({ show_id: 'show-a', show_title: 'Alpha', season_number: 1, episode_number: 1, youtube_status: 'not_ready' }),
    row({ show_id: 'show-c', show_title: 'Gamma', season_number: 1, episode_number: 1, youtube_status: 'not_embeddable' }),
    row({
      show_id: 'show-b',
      show_title: 'Beta',
      season_number: 1,
      episode_number: 1,
      youtube_checked_at: hoursAgo(4),
      player_error_at: hoursAgo(1),
      player_error_code: 150,
    }),
    row({ show_id: 'show-a', show_title: 'Alpha', season_number: 1, episode_number: 2 }), // fine
  ]
  const s = summarizeYouTubeHealth(rows, NOW)
  assert.equal(s.cantPlayTotal, 6)
  assert.equal(s.cantPlay.length, 5)
  assert.deepEqual(
    s.cantPlay.map((c) => [c.showTitle, c.seasonNumber, c.episodeNumber, c.reason]),
    [
      ['Alpha', 1, 1, 'not_ready'],
      ['Alpha', 1, 3, 'blocked_ae'],
      ['Alpha', 2, 1, 'private'],
      ['Beta', 1, 1, 'viewer_report'],
      ['Beta', 1, 2, 'removed'],
    ]
  )
  assert.equal(s.cantPlay[0]!.showId, 'show-a')
  assert.ok(s.cantPlay[0]!.id)
})

test('summary: archived rows are excluded; published and draft both count', () => {
  const rows: HealthRow[] = [
    row({ archived: true, youtube_status: 'removed', youtube_checked_at: hoursAgo(1) }),
    row({ youtube_status: 'private', youtube_checked_at: hoursAgo(10) }), // published
    { ...row({ youtube_status: 'removed', youtube_checked_at: hoursAgo(10) }), status: 'draft' } as HealthRow,
  ]
  const s = summarizeYouTubeHealth(rows, NOW)
  assert.equal(s.cantPlayTotal, 2)
  assert.ok(s.cantPlay.every((c) => c.reason !== null))
  // The archived row's newer check does not count either.
  assert.equal(s.lastCheckedAt, hoursAgo(10))
})

test('summary does not change its input (flag only)', () => {
  const rows = [row({ youtube_status: 'removed' })]
  const before = structuredClone(rows)
  summarizeYouTubeHealth(rows, NOW)
  assert.deepEqual(rows, before)
})
