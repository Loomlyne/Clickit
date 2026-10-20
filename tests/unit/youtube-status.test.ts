// One precedence function for every YouTube entry point (RESEARCH Pattern 3):
// removed, private, not_ready, not_embeddable, blocked_ae, ok.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  YOUTUBE_STATUSES,
  classifyVideo,
  videoReason,
  type VideoItem,
} from '../../src/server/youtube/status.ts'
import { statusToVideoError } from '../../src/lib/youtube-errors.ts'

const good = (over: Partial<VideoItem> = {}): VideoItem => ({
  snippet: { title: 'Ep 1', description: '', liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT24M10S' },
  status: { privacyStatus: 'unlisted', uploadStatus: 'processed', embeddable: true },
  ...over,
})

test('status list is fixed and in SQL check order', () => {
  assert.deepEqual(
    [...YOUTUBE_STATUSES],
    ['ok', 'private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready']
  )
})

test('absent item and dead upload statuses are removed', () => {
  assert.equal(classifyVideo(undefined), 'removed')
  for (const uploadStatus of ['deleted', 'failed', 'rejected']) {
    assert.equal(
      classifyVideo(good({ status: { uploadStatus, privacyStatus: 'public', embeddable: true } })),
      'removed',
      uploadStatus
    )
  }
})

test('private wins over not embeddable', () => {
  assert.equal(
    classifyVideo(
      good({ status: { privacyStatus: 'private', uploadStatus: 'processed', embeddable: false } })
    ),
    'private'
  )
})

test('uploaded, upcoming and live are not_ready', () => {
  assert.equal(
    classifyVideo(good({ status: { privacyStatus: 'public', uploadStatus: 'uploaded', embeddable: true } })),
    'not_ready'
  )
  for (const liveBroadcastContent of ['upcoming', 'live']) {
    assert.equal(
      classifyVideo(good({ snippet: { title: 'x', liveBroadcastContent } })),
      'not_ready',
      liveBroadcastContent
    )
  }
})

test('not_ready wins over not_embeddable and region blocks', () => {
  assert.equal(
    classifyVideo(
      good({
        snippet: { title: 'x', liveBroadcastContent: 'upcoming' },
        status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false },
        contentDetails: { regionRestriction: { blocked: ['AE'] } },
      })
    ),
    'not_ready'
  )
})

test('embeddable false is not_embeddable, ahead of a region block', () => {
  assert.equal(
    classifyVideo(
      good({
        status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: false },
        contentDetails: { regionRestriction: { blocked: ['AE'] } },
      })
    ),
    'not_embeddable'
  )
})

test('region restriction semantics: blocked list, allowed list, empty allowed', () => {
  const rr = (regionRestriction: { allowed?: string[]; blocked?: string[] }) =>
    classifyVideo(good({ contentDetails: { regionRestriction } }))
  assert.equal(rr({ blocked: ['AE'] }), 'blocked_ae')
  assert.equal(rr({ blocked: ['US'] }), 'ok')
  assert.equal(rr({ allowed: ['US'] }), 'blocked_ae')
  assert.equal(rr({ allowed: ['AE', 'US'] }), 'ok')
  assert.equal(rr({ allowed: [] }), 'blocked_ae')
  assert.equal(rr({}), 'ok')
  assert.equal(classifyVideo(good({ contentDetails: { regionRestriction: { blocked: ['US'] } } }), 'US'), 'blocked_ae')
})

test('unlisted, processed, embeddable and unrestricted is ok', () => {
  assert.equal(classifyVideo(good()), 'ok')
})

test('videoReason: premieres carries the start time, everything else processing', () => {
  const at = '2026-11-01T10:00:00Z'
  assert.deepEqual(
    videoReason(
      good({
        snippet: { title: 'x', liveBroadcastContent: 'upcoming' },
        liveStreamingDetails: { scheduledStartTime: at },
      })
    ),
    { kind: 'premieres', at }
  )
  assert.deepEqual(
    videoReason(good({ snippet: { title: 'x', liveBroadcastContent: 'upcoming' } })),
    { kind: 'processing' }
  )
  assert.deepEqual(
    videoReason(good({ status: { privacyStatus: 'public', uploadStatus: 'uploaded', embeddable: true } })),
    { kind: 'processing' }
  )
  assert.deepEqual(videoReason(undefined), { kind: 'processing' })
})

test('statusToVideoError maps every status', () => {
  assert.equal(statusToVideoError('ok'), null)
  assert.equal(statusToVideoError('removed'), 'video_not_found')
  assert.equal(statusToVideoError('private'), 'video_private')
  assert.equal(statusToVideoError('not_embeddable'), 'video_not_embeddable')
  assert.equal(statusToVideoError('blocked_ae'), 'video_blocked_uae')
  assert.equal(statusToVideoError('not_ready'), 'video_not_ready')
})
