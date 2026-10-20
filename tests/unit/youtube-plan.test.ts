// Import planner (numbering, script routing, length) and import payload bounds.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildImportPlan, importStatus } from '../../src/server/youtube/plan.ts'
import { needsEnglishTitle } from '../../src/server/youtube/script.ts'
import type { VideoItem } from '../../src/server/youtube/status.ts'
import { commitImportSchema, previewPageSchema } from '../../src/lib/admin/schemas.ts'

const NOW = new Date('2026-10-20T12:00:00.000Z')
const SHOW = { description: 'Show description', description_ar: 'وصف البرنامج' }

function video(
  id: string,
  over: { title?: string; description?: string; duration?: string; status?: VideoItem['status'] } = {}
): VideoItem {
  return {
    id,
    snippet: {
      title: over.title ?? `Video ${id}`,
      description: over.description ?? `About ${id}`,
      liveBroadcastContent: 'none',
    },
    contentDetails: { duration: over.duration ?? 'PT10M5S' },
    status: over.status ?? { privacyStatus: 'unlisted', uploadStatus: 'processed', embeddable: true },
  }
}

const vid = (n: number) => `vid${String(n).padStart(8, '0')}`

test('existing season: numbers continue after the highest number including archived (max 4 -> 5, 6, 7)', () => {
  const plan = buildImportPlan({
    videos: [
      { id: vid(1), position: 1, item: video(vid(1)) },
      { id: vid(2), position: 2, item: video(vid(2)) },
      { id: vid(3), position: 3, item: video(vid(3)) },
    ],
    startNumber: 4,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.deepEqual(
    plan.rows.map((r) => [r.youtube_video_id, r.episode_number]),
    [
      [vid(1), 5],
      [vid(2), 6],
      [vid(3), 7],
    ]
  )
})

test('playlist order sets numbers even when the input is out of order', () => {
  const plan = buildImportPlan({
    videos: [
      { id: vid(3), position: 9, item: video(vid(3)) },
      { id: vid(1), position: 2, item: video(vid(1)) },
      { id: vid(2), position: 5, item: video(vid(2)) },
    ],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.deepEqual(plan.rows.map((r) => r.youtube_video_id), [vid(1), vid(2), vid(3)])
  assert.deepEqual(plan.rows.map((r) => r.episode_number), [1, 2, 3])
})

test('new season numbers 1..n; unticked (absent) and non-ok rows never consume numbers', () => {
  const plan = buildImportPlan({
    videos: [
      { id: vid(1), position: 1, item: video(vid(1)) },
      // position 2 unticked: not passed in
      {
        id: vid(3),
        position: 3,
        item: video(vid(3), { status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: true } }),
      },
      { id: vid(4), position: 4, item: video(vid(4)) },
      { id: vid(5), position: 5, item: video(vid(5), { duration: 'PT0S' }) },
      { id: vid(6), position: 6, item: video(vid(6)) },
    ],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.deepEqual(
    plan.rows.map((r) => [r.youtube_video_id, r.episode_number]),
    [
      [vid(1), 1],
      [vid(4), 2],
      [vid(6), 3],
    ]
  )
})

test('PT0S is not_ready and never reaches the plan', () => {
  assert.equal(importStatus(video(vid(1), { duration: 'PT0S' })), 'not_ready')
  assert.equal(importStatus(video(vid(1), { duration: 'garbage' })), 'not_ready')
  assert.equal(importStatus(video(vid(1))), 'ok')
  assert.equal(importStatus(undefined), 'removed')
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { duration: 'PT0S' }) }],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.equal(plan.rows.length, 0)
})

test('Arabic-dominant title: title_ar = title = text and the row needs an English title', () => {
  const text = 'الحلقة الأولى من البرنامج'
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { title: text }) }],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  const r = plan.rows[0]!
  assert.equal(r.title, text)
  assert.equal(r.title_ar, text)
  assert.equal(needsEnglishTitle({ title: r.title, title_ar: r.title_ar }), true)
  assert.equal(plan.needsEnglishCount, 1)
})

test('English title goes to title only; needsEnglishCount counts only Arabic rows', () => {
  const plan = buildImportPlan({
    videos: [
      { id: vid(1), position: 1, item: video(vid(1), { title: 'Episode one' }) },
      { id: vid(2), position: 2, item: video(vid(2), { title: 'حلقة اثنان' }) },
    ],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.equal(plan.rows[0]!.title, 'Episode one')
  assert.equal(plan.rows[0]!.title_ar, null)
  assert.equal(plan.needsEnglishCount, 1)
})

test('empty description falls back to the show description and description_ar', () => {
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { description: '   ' }) }],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.equal(plan.rows[0]!.description, SHOW.description)
  assert.equal(plan.rows[0]!.description_ar, SHOW.description_ar)
})

test('Arabic description goes to description_ar; description falls back to the show description', () => {
  const text = 'وصف الحلقة باللغة العربية'
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { description: text }) }],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.equal(plan.rows[0]!.description_ar, text)
  assert.equal(plan.rows[0]!.description, SHOW.description)
})

test('English description stays English; description_ar null (no translation)', () => {
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { description: 'Plain English' }) }],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.equal(plan.rows[0]!.description, 'Plain English')
  assert.equal(plan.rows[0]!.description_ar, null)
})

test('show with no description: description is an empty string, never null', () => {
  const plan = buildImportPlan({
    videos: [{ id: vid(1), position: 1, item: video(vid(1), { description: '' }) }],
    startNumber: 0,
    showDefaults: { description: null, description_ar: null },
    now: NOW,
  })
  assert.equal(plan.rows[0]!.description, '')
  assert.equal(plan.rows[0]!.description_ar, null)
})

test('duration in minutes and seconds; every row is a draft with youtube_status ok and checked now', () => {
  const plan = buildImportPlan({
    videos: [
      { id: vid(1), position: 1, item: video(vid(1), { duration: 'PT10M5S' }) },
      { id: vid(2), position: 2, item: video(vid(2), { duration: 'PT1H2M' }) },
      { id: vid(3), position: 3, item: video(vid(3), { duration: 'PT20S' }) },
    ],
    startNumber: 0,
    showDefaults: SHOW,
    now: NOW,
  })
  assert.deepEqual(
    plan.rows.map((r) => [r.duration, r.youtube_duration_seconds]),
    [
      [10, 605],
      [62, 3720],
      [1, 20],
    ]
  )
  for (const r of plan.rows) {
    assert.equal(r.status, 'draft')
    assert.equal(r.youtube_status, 'ok')
    assert.equal(r.youtube_checked_at, NOW.toISOString())
  }
})

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SHOW_ID = '3f0c1c9e-8b1a-4c53-9a53-6d1f6b1a2c01'
const SEASON_ID = '3f0c1c9e-8b1a-4c53-9a53-6d1f6b1a2c02'
const ids = (n: number) => Array.from({ length: n }, (_, i) => `v${String(i).padStart(10, '0')}`)

const commit = (over: Record<string, unknown> = {}) => ({
  showId: SHOW_ID,
  playlistId: 'PLabcdefghij',
  videoIds: ids(3),
  target: { kind: 'new', seasonTitle: 'Season 2' },
  ...over,
})

test('commitImportSchema: a valid new and existing payload pass', () => {
  assert.equal(commitImportSchema.safeParse(commit()).success, true)
  assert.equal(
    commitImportSchema.safeParse(commit({ target: { kind: 'existing', seasonId: SEASON_ID } })).success,
    true
  )
  assert.equal(commitImportSchema.safeParse(commit({ videoIds: ids(200) })).success, true)
})

test('commitImportSchema refuses bad payloads', () => {
  const bad: Array<[string, Record<string, unknown>]> = [
    ['0 ids', { videoIds: [] }],
    ['201 ids', { videoIds: ids(201) }],
    ['10-char id', { videoIds: ['abcdefghij'] }],
    ['duplicate ids', { videoIds: [ids(1)[0], ids(1)[0]] }],
    ['non-uuid showId', { showId: 'show-1' }],
    ['unknown target kind', { target: { kind: 'other', seasonTitle: 'X' } }],
    ['empty new-season title', { target: { kind: 'new', seasonTitle: '   ' } }],
    ['title over 120 chars', { target: { kind: 'new', seasonTitle: 'x'.repeat(121) } }],
    ['non-uuid seasonId', { target: { kind: 'existing', seasonId: 'nope' } }],
    ['bad playlist id', { playlistId: 'has space' }],
    ['unknown key', { titles: ['x'] }],
    ['client rows smuggled into target', { target: { kind: 'new', seasonTitle: 'S', rows: [] } }],
  ]
  for (const [label, over] of bad) {
    assert.equal(commitImportSchema.safeParse(commit(over)).success, false, label)
  }
})

test('previewPageSchema: page is 0..3 and unknown keys are refused', () => {
  const ok = { showId: SHOW_ID, url: 'https://www.youtube.com/playlist?list=PLabc', page: 0 }
  assert.equal(previewPageSchema.safeParse(ok).success, true)
  assert.equal(
    previewPageSchema.safeParse({ showId: SHOW_ID, playlistId: 'PLabc', pageToken: 'CDIQAA', page: 3 }).success,
    true
  )
  assert.equal(previewPageSchema.safeParse({ ...ok, page: 4 }).success, false)
  assert.equal(previewPageSchema.safeParse({ ...ok, page: -1 }).success, false)
  assert.equal(previewPageSchema.safeParse({ ...ok, url: 'x'.repeat(2049) }).success, false)
  assert.equal(previewPageSchema.safeParse({ ...ok, extra: 1 }).success, false)
  assert.equal(previewPageSchema.safeParse({ ...ok, showId: 'no' }).success, false)
})
