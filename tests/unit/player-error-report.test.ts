// Viewer player-error report (06-09, D-17, T-06-36 to T-06-38).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  PLAYER_REPORT_COUNT_WINDOW_MS,
  PLAYER_REPORT_THRESHOLD,
  PLAYER_REPORT_WINDOW_MS,
  reportPlayerErrorCore,
} from '../../src/server/player-error-report.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const USER = '11111111-1111-4111-8111-111111111111'
const EP = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
// The fake stamps inserts from 2026-01-01T00:00:00.001Z upward.
const NOW = new Date('2026-01-01T00:00:30.000Z')

const V2 = '77777777-7777-4777-8777-777777777777'
const V3 = '88888888-8888-4888-8888-888888888888'

/** Earlier reports by other viewers on EP, inside the 24-hour count window. */
const priorReports = (...users: string[]) =>
  users.map((u, i) => ({
    id: `prior-${i}`,
    key: `player-error:${EP}:${u}`,
    created_at: '2025-12-31T12:00:00.000Z',
  }))

function world(
  extra: Array<Record<string, unknown>> = [],
  rateLimits: Array<Record<string, unknown>> = []
) {
  return createFakeSupabase({
    episodes: [
      { id: EP, status: 'published', player_error_code: null, player_error_at: null },
      { id: OTHER, status: 'published', player_error_code: null, player_error_at: null },
      { id: '44444444-4444-4444-8444-444444444444', status: 'draft', player_error_code: null, player_error_at: null },
      ...extra,
    ],
    rate_limits: rateLimits,
  })
}

/** Two other viewers already reported EP: this user's report is the third. */
const thirdViewerWorld = () => world([], priorReports(V2, V3))

const call = (fake: ReturnType<typeof world>, over: Record<string, unknown> = {}) =>
  reportPlayerErrorCore({
    db: fake.client,
    userId: USER,
    episodeIdRaw: EP,
    codeRaw: 150,
    now: NOW,
    ...over,
  } as Parameters<typeof reportPlayerErrorCore>[0])

const episodeWrites = (fake: ReturnType<typeof world>) =>
  fake.calls.filter((c) => c.table === 'episodes' && c.op === 'update')

test('the window is one hour', () => {
  assert.equal(PLAYER_REPORT_WINDOW_MS, 3_600_000)
})

test('the flag needs three different viewers inside 24 hours', () => {
  assert.equal(PLAYER_REPORT_THRESHOLD, 3)
  assert.equal(PLAYER_REPORT_COUNT_WINDOW_MS, 86_400_000)
})

test('no user: refused as unauthenticated, nothing read or written', async () => {
  const fake = world()
  const res = await call(fake, { userId: null })
  assert.deepEqual(res, { ok: false, reason: 'unauthenticated' })
  assert.equal(fake.calls.length, 0)
})

test('a non-uuid episode id is refused without a write', async () => {
  const fake = world()
  for (const bad of ['nope', '', '1; drop table episodes', null, undefined, 42]) {
    const res = await call(fake, { episodeIdRaw: bad })
    assert.equal(res.ok, false)
  }
  assert.equal(episodeWrites(fake).length, 0)
  assert.equal(fake.tables.rate_limits.length, 0)
})

test('code 153 (site problem), 7, 0 and junk are refused without a write', async () => {
  const fake = world()
  for (const bad of [153, 7, 0, -1, 2.5, '150', null, undefined, NaN]) {
    const res = await call(fake, { codeRaw: bad })
    assert.equal(res.ok, false, `code ${String(bad)}`)
  }
  assert.equal(episodeWrites(fake).length, 0)
  assert.equal(fake.tables.rate_limits.length, 0)
})

test('every allow-listed code is accepted', async () => {
  for (const code of [2, 5, 100, 101, 150]) {
    const fake = thirdViewerWorld()
    const res = await call(fake, { codeRaw: code })
    assert.deepEqual(res, { ok: true })
    assert.equal(fake.tables.episodes.find((e) => e.id === EP)?.player_error_code, code)
  }
})

test('an unknown episode is refused without a write', async () => {
  const fake = world()
  const res = await call(fake, { episodeIdRaw: '55555555-5555-4555-8555-555555555555' })
  assert.equal(res.ok, false)
  assert.equal(episodeWrites(fake).length, 0)
  assert.equal(fake.tables.rate_limits.length, 0)
})

test('an unpublished episode is refused without a write', async () => {
  const fake = world()
  const res = await call(fake, { episodeIdRaw: '44444444-4444-4444-8444-444444444444' })
  assert.equal(res.ok, false)
  assert.equal(episodeWrites(fake).length, 0)
  assert.equal(fake.tables.rate_limits.length, 0)
})

test('the third different viewer raises the flag: two columns on that episode only', async () => {
  const fake = thirdViewerWorld()
  const res = await call(fake)
  assert.deepEqual(res, { ok: true })
  const writes = episodeWrites(fake)
  assert.equal(writes.length, 1)
  assert.deepEqual(Object.keys(writes[0].patch).sort(), ['player_error_at', 'player_error_code'])
  assert.equal(writes[0].patch.player_error_code, 150)
  assert.equal(writes[0].patch.player_error_at, NOW.toISOString())
  assert.deepEqual(
    writes[0].filters.map((f) => ({ ...f })),
    [{ kind: 'eq', col: 'id', value: EP }]
  )
  const other = fake.tables.episodes.find((e) => e.id === OTHER)
  assert.equal(other?.player_error_code, null)
  assert.equal(other?.player_error_at, null)
  // The ledger key names the episode and the user.
  assert.equal(fake.tables.rate_limits.at(-1)?.key, `player-error:${EP}:${USER}`)
})

test('a second report inside the window is limited and writes nothing', async () => {
  const fake = thirdViewerWorld()
  assert.deepEqual(await call(fake), { ok: true })
  const res = await call(fake, { codeRaw: 100 })
  assert.deepEqual(res, { ok: false, reason: 'limited' })
  assert.equal(episodeWrites(fake).length, 1)
  assert.equal(fake.tables.episodes.find((e) => e.id === EP)?.player_error_code, 150)
})

test('the limit is per user and per episode', async () => {
  const fake = world()
  assert.deepEqual(await call(fake), { ok: true })
  assert.deepEqual(await call(fake, { episodeIdRaw: OTHER }), { ok: true })
  assert.deepEqual(
    await call(fake, { userId: '66666666-6666-4666-8666-666666666666' }),
    { ok: true }
  )
})

test('after the window the same viewer can report again', async () => {
  const fake = thirdViewerWorld()
  assert.deepEqual(await call(fake), { ok: true })
  const later = new Date(NOW.getTime() + PLAYER_REPORT_WINDOW_MS + 60_000)
  assert.deepEqual(await call(fake, { now: later, codeRaw: 5 }), { ok: true })
  assert.equal(fake.tables.episodes.find((e) => e.id === EP)?.player_error_code, 5)
})

test('a rate-limit read error fails closed: refused, no write', async () => {
  const fake = world()
  fake.failOn({ table: 'rate_limits', op: 'select', nth: 1 })
  const res = await call(fake)
  assert.equal(res.ok, false)
  assert.equal(episodeWrites(fake).length, 0)
})

test('a rate-limit write error fails closed: refused, no write', async () => {
  const fake = world()
  fake.failOn({ table: 'rate_limits', op: 'insert', nth: 1 })
  const res = await call(fake)
  assert.equal(res.ok, false)
  assert.equal(episodeWrites(fake).length, 0)
})

test('a failed episode update is reported as failed', async () => {
  const fake = thirdViewerWorld()
  fake.failOn({ table: 'episodes', op: 'update', nth: 1 })
  const res = await call(fake)
  assert.deepEqual(res, { ok: false, reason: 'failed' })
})

test('one viewer alone records the report but never raises the flag', async () => {
  const fake = world()
  assert.deepEqual(await call(fake), { ok: true })
  assert.equal(episodeWrites(fake).length, 0)
  assert.equal(fake.tables.rate_limits.length, 1)
  assert.equal(fake.tables.rate_limits[0].key, `player-error:${EP}:${USER}`)
  // The same account reporting every hour for a day is still one viewer.
  for (let h = 1; h <= 24; h++) {
    const at = new Date(NOW.getTime() + h * (PLAYER_REPORT_WINDOW_MS + 1000))
    assert.deepEqual(await call(fake, { now: at }), { ok: true })
  }
  assert.equal(episodeWrites(fake).length, 0)
  const ep = fake.tables.episodes.find((e) => e.id === EP)
  assert.equal(ep?.player_error_code, null)
  assert.equal(ep?.player_error_at, null)
})

test('two viewers: no flag; the third different viewer raises it', async () => {
  const fake = world()
  assert.deepEqual(await call(fake, { userId: V2 }), { ok: true })
  assert.deepEqual(await call(fake, { userId: V3 }), { ok: true })
  assert.equal(episodeWrites(fake).length, 0)
  assert.deepEqual(await call(fake, { codeRaw: 101 }), { ok: true })
  assert.equal(episodeWrites(fake).length, 1)
  assert.equal(fake.tables.episodes.find((e) => e.id === EP)?.player_error_code, 101)
})

test('reports older than 24 hours and reports on other episodes do not count', async () => {
  const fake = world([], [
    { id: 'old-1', key: `player-error:${EP}:${V2}`, created_at: '2025-12-30T23:59:00.000Z' },
    { id: 'old-2', key: `player-error:${EP}:${V3}`, created_at: '2025-12-31T00:00:29.999Z' },
    { id: 'other-ep', key: `player-error:${OTHER}:${V2}`, created_at: '2025-12-31T12:00:00.000Z' },
    { id: 'other-ep-2', key: `player-error:${OTHER}:${V3}`, created_at: '2025-12-31T12:00:00.000Z' },
  ])
  assert.deepEqual(await call(fake), { ok: true })
  assert.equal(episodeWrites(fake).length, 0)
})

test('the viewer count reads distinct keys by episode prefix inside 24 hours', async () => {
  const fake = thirdViewerWorld()
  await call(fake)
  const selects = fake.calls.filter((c) => c.table === 'rate_limits' && c.op === 'select')
  assert.equal(selects.length, 2)
  assert.deepEqual(selects[1].filters, [
    { kind: 'like', col: 'key', value: `player-error:${EP}:%` },
    { kind: 'gte', col: 'created_at', value: '2025-12-31T00:00:30.000Z' },
  ])
})

test('a viewer-count read error: refused as failed, the episode is not touched', async () => {
  const fake = thirdViewerWorld()
  fake.failOn({ table: 'rate_limits', op: 'select', nth: 2 })
  assert.deepEqual(await call(fake), { ok: false, reason: 'failed' })
  assert.equal(episodeWrites(fake).length, 0)
  const thrown = thirdViewerWorld()
  thrown.throwOn({ table: 'rate_limits', op: 'select', nth: 2 })
  assert.deepEqual(await call(thrown), { ok: false, reason: 'failed' })
  assert.equal(episodeWrites(thrown).length, 0)
})

test('the core has no YouTube dependency and uses the shared rate-limit seam', () => {
  const src = readFileSync('src/server/player-error-report.ts', 'utf8')
  assert.equal(/createYouTubeClient|googleapis|getVideos/.test(src), false)
  assert.equal(src.split('withinRateLimitCore').length - 1 >= 1, true)
  assert.match(src, /failOpen:\s*false/)
  assert.equal(/from '@\/|server-only|next\//.test(src), false)
})

test('the action is a server action over the core with the admin client', () => {
  const src = readFileSync('src/app/actions/player-errors.ts', 'utf8')
  assert.match(src, /^'use server'/)
  assert.match(src, /export async function reportPlayerError\(/)
  assert.match(src, /auth\.getUser\(\)/)
  assert.match(src, /createAdminClient\(\)/)
  assert.match(src, /reportPlayerErrorCore\(/)
  assert.match(src, /\[actions\/player-errors\]/)
  assert.doesNotMatch(src, /createYouTubeClient|googleapis/)
})
