import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  nextPositions,
  progressPercent,
  resumeSecondsFor,
  seedPositions,
  shouldSaveProgress,
  videoMatchesFor,
} from '../../src/lib/watch/resume.ts'
import type { PositionsMap } from '../../src/lib/watch/resume.ts'

const entry = (seconds: number, duration: number, completed = false) => ({
  seconds,
  duration,
  completed,
})

test('resumeSecondsFor: nothing, completed, short and near-end start at 0:00', () => {
  assert.equal(resumeSecondsFor(undefined), 0)
  assert.equal(resumeSecondsFor(entry(300, 600, true)), 0)
  assert.equal(resumeSecondsFor(entry(4, 600)), 0)
  assert.equal(resumeSecondsFor(entry(597, 600)), 0)
  assert.equal(resumeSecondsFor(entry(595, 600)), 0)
})

test('resumeSecondsFor: otherwise floors the saved second', () => {
  assert.equal(resumeSecondsFor(entry(552.7, 1450)), 552)
  assert.equal(resumeSecondsFor(entry(5, 1450)), 5)
  // unknown duration: only the other rules apply
  assert.equal(resumeSecondsFor(entry(120, 0)), 120)
})

const base = { currentTime: 100, duration: 600, lastSaved: 0, force: false, videoMatches: true }

test('shouldSaveProgress mirrors the four tracker guards', () => {
  assert.equal(shouldSaveProgress(base), true)
  // non-finite or negative time
  assert.equal(shouldSaveProgress({ ...base, currentTime: Number.NaN }), false)
  assert.equal(shouldSaveProgress({ ...base, currentTime: -1 }), false)
  // non-finite or non-positive duration
  assert.equal(shouldSaveProgress({ ...base, duration: Number.NaN }), false)
  assert.equal(shouldSaveProgress({ ...base, duration: 0 }), false)
  // post-seek zero must not overwrite a real position
  assert.equal(shouldSaveProgress({ ...base, currentTime: 1, lastSaved: 300 }), false)
  assert.equal(shouldSaveProgress({ ...base, currentTime: 1, lastSaved: 2, force: true }), true)
  // 10 second delta
  assert.equal(shouldSaveProgress({ ...base, currentTime: 105, lastSaved: 100 }), false)
  assert.equal(shouldSaveProgress({ ...base, currentTime: 110, lastSaved: 100 }), true)
})

test('shouldSaveProgress: force bypasses only the 10 second delta', () => {
  assert.equal(shouldSaveProgress({ ...base, currentTime: 105, lastSaved: 100, force: true }), true)
  assert.equal(shouldSaveProgress({ ...base, currentTime: Number.NaN, force: true }), false)
  assert.equal(shouldSaveProgress({ ...base, duration: 0, force: true }), false)
  assert.equal(shouldSaveProgress({ ...base, currentTime: 1, lastSaved: 300, force: true }), false)
})

test('shouldSaveProgress: a wrong video never saves, even when forced', () => {
  assert.equal(shouldSaveProgress({ ...base, videoMatches: false }), false)
  assert.equal(shouldSaveProgress({ ...base, videoMatches: false, force: true }), false)
  assert.equal(shouldSaveProgress({ ...base, videoMatches: true, force: true }), true)
})

test('videoMatchesFor waits for the new id or PLAYING after a switch', () => {
  assert.equal(
    videoMatchesFor({ reportedVideoId: 'NEW', expectedVideoId: 'NEW', playingSinceSwitch: false }),
    true
  )
  assert.equal(
    videoMatchesFor({ reportedVideoId: 'OLD', expectedVideoId: 'NEW', playingSinceSwitch: true }),
    false
  )
  assert.equal(
    videoMatchesFor({ reportedVideoId: undefined, expectedVideoId: 'NEW', playingSinceSwitch: true }),
    true
  )
  assert.equal(
    videoMatchesFor({ reportedVideoId: '', expectedVideoId: 'NEW', playingSinceSwitch: true }),
    true
  )
  assert.equal(
    videoMatchesFor({ reportedVideoId: undefined, expectedVideoId: 'NEW', playingSinceSwitch: false }),
    false
  )
})

test('seedPositions maps the server rows', () => {
  const map = seedPositions({
    A: { progressSeconds: 120, durationSeconds: 1450, completed: false },
    B: { progressSeconds: 0, durationSeconds: 0, completed: true },
  })
  assert.deepEqual(map, {
    A: { seconds: 120, duration: 1450, completed: false },
    B: { seconds: 0, duration: 0, completed: true },
  })
})

test('nextPositions: leave records the position and the 95% completed rule', () => {
  const seed = seedPositions({ A: { progressSeconds: 120, durationSeconds: 1450, completed: false } })
  const afterLeave = nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: 600, duration: 1450 })
  assert.deepEqual(afterLeave.A, { seconds: 600, duration: 1450, completed: false })
  // immutable
  assert.deepEqual(seed.A, { seconds: 120, duration: 1450, completed: false })
  const done = nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: 1378, duration: 1450 })
  assert.equal(done.A.completed, true)
  const justUnder = nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: 1377, duration: 1450 })
  assert.equal(justUnder.A.completed, false)
})

test('nextPositions: leave ignores unusable player values', () => {
  const seed = seedPositions({ A: { progressSeconds: 120, durationSeconds: 1450, completed: false } })
  assert.equal(nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: Number.NaN, duration: 1450 }), seed)
  assert.equal(nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: 50, duration: 0 }), seed)
  // post-seek zero would not be saved by the tracker either
  assert.equal(nextPositions(seed, { type: 'leave', episodeId: 'A', seconds: 1, duration: 1450 }), seed)
})

test('nextPositions: ended completes and zeroes, restart zeroes', () => {
  const seed = seedPositions({ A: { progressSeconds: 120, durationSeconds: 1450, completed: false } })
  const ended = nextPositions(seed, { type: 'ended', episodeId: 'A' })
  assert.deepEqual(ended.A, { seconds: 0, duration: 1450, completed: true })
  const restarted = nextPositions(ended, { type: 'restart', episodeId: 'A' })
  assert.deepEqual(restarted.A, { seconds: 0, duration: 1450, completed: false })
  // unknown episode
  assert.deepEqual(nextPositions({}, { type: 'ended', episodeId: 'Z' }).Z, {
    seconds: 0,
    duration: 0,
    completed: true,
  })
})

test('nextPositions: seed only fills episodes the session has not touched', () => {
  const live: PositionsMap = { A: entry(600, 1450) }
  const merged = nextPositions(live, {
    type: 'seed',
    positions: { A: entry(120, 1450), B: entry(30, 900) },
  })
  assert.equal(merged.A.seconds, 600)
  assert.equal(merged.B.seconds, 30)
})

test('A -> B -> A resumes A where this session left it, not at the page-load value', () => {
  let positions = seedPositions({ A: { progressSeconds: 120, durationSeconds: 1450, completed: false } })
  assert.equal(resumeSecondsFor(positions.A), 120)
  positions = nextPositions(positions, { type: 'leave', episodeId: 'A', seconds: 600, duration: 1450 })
  // enter B (unknown), leave B
  assert.equal(resumeSecondsFor(positions.B), 0)
  positions = nextPositions(positions, { type: 'leave', episodeId: 'B', seconds: 30, duration: 900 })
  assert.equal(resumeSecondsFor(positions.A), 600)
  assert.equal(resumeSecondsFor(positions.B), 30)
})

test('progressPercent', () => {
  assert.equal(progressPercent(entry(10, 1000, true)), 100)
  assert.equal(progressPercent(entry(250, 1000)), 25)
  assert.equal(progressPercent(entry(333, 1000)), 33)
  assert.equal(progressPercent(entry(5000, 1000)), 100)
  assert.equal(progressPercent(entry(50, 0)), 0)
  assert.equal(progressPercent(undefined), 0)
})
