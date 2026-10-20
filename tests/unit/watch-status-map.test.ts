// Stored YouTube status map for the watch page (06-09, checker W1).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { toYouTubeStatusMap } from '../../src/lib/watch/status-map.ts'

test('keeps only the known non-ok statuses', () => {
  assert.deepEqual(
    toYouTubeStatusMap([
      { id: 'a', youtube_status: 'private' },
      { id: 'b', youtube_status: 'ok' },
      { id: 'c', youtube_status: null },
      { id: 'd', youtube_status: 'weird' },
      { id: 'e', youtube_status: 'blocked_ae' },
    ]),
    { a: 'private', e: 'blocked_ae' }
  )
})

test('an empty list gives an empty map', () => {
  assert.deepEqual(toYouTubeStatusMap([]), {})
})

test('every known non-ok status passes through', () => {
  const rows = ['private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready'].map(
    (s, i) => ({ id: `ep-${i}`, youtube_status: s })
  )
  assert.deepEqual(toYouTubeStatusMap(rows), {
    'ep-0': 'private',
    'ep-1': 'removed',
    'ep-2': 'not_embeddable',
    'ep-3': 'blocked_ae',
    'ep-4': 'not_ready',
  })
})

test('inherited object keys are not statuses', () => {
  assert.deepEqual(
    toYouTubeStatusMap([
      { id: 'a', youtube_status: 'constructor' },
      { id: 'b', youtube_status: '__proto__' },
      { id: 'c', youtube_status: 'toString' },
    ]),
    {}
  )
})

// queries.ts imports next/* and @/ paths, so node --test reads its source.
const QUERIES = readFileSync('src/lib/queries.ts', 'utf8')

function functionBody(name: string): string {
  const at = QUERIES.indexOf(`export async function ${name}`)
  assert.notEqual(at, -1, `${name} not found`)
  const next = QUERIES.indexOf('\nexport ', at + 1)
  return QUERIES.slice(at, next === -1 ? undefined : next)
}

test('getEpisodeYouTubeStatuses: returns {} before any query on an empty list', () => {
  const body = functionBody('getEpisodeYouTubeStatuses')
  const early = body.indexOf('episodeIds.length === 0')
  assert.notEqual(early, -1)
  assert.match(body.slice(early, early + 60), /return \{\}/)
  assert.ok(early < body.indexOf('.from('), 'the empty check must come before the query')
})

test('getEpisodeYouTubeStatuses: server-only admin read of non-ok statuses', () => {
  const body = functionBody('getEpisodeYouTubeStatuses')
  assert.match(body, /createAdminClient\(\)/)
  assert.match(body, /toYouTubeStatusMap\(/)
  assert.match(body, /neq\('youtube_status', 'ok'\)/)
  assert.match(body, /\.in\('id', episodeIds\)/)
  assert.match(body, /\[queries\] youtube status lookup failed/)
})

test('getEpisodesProgress: also returns saved seconds and duration', () => {
  const body = functionBody('getEpisodesProgress')
  assert.match(body, /progressSeconds/)
  assert.match(body, /durationSeconds/)
})
