// Rate-limit seam for admin writes and viewer reports (Phase 6), on the same
// rate_limits ledger as src/app/actions/contact.ts.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { withinRateLimitCore } from '../../src/server/youtube/rate-limit.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

// The fake stamps inserts from 2026-01-01T00:00:00.001Z upward.
const NOW = new Date('2026-01-01T00:00:30.000Z')
const opts = (over: Partial<Parameters<typeof withinRateLimitCore>[1]> = {}) => ({
  key: 'report:user-1:episode-1',
  max: 2,
  windowSec: 60,
  now: NOW,
  failOpen: false,
  ...over,
})

test('allows the first two calls, refuses the third, one row per allowed call', async () => {
  const fake = createFakeSupabase({ rate_limits: [] })
  assert.equal(await withinRateLimitCore(fake.client, opts()), true)
  assert.equal(await withinRateLimitCore(fake.client, opts()), true)
  assert.equal(await withinRateLimitCore(fake.client, opts()), false)
  const rows = fake.tables.rate_limits.filter(
    (r) => r.key === 'report:user-1:episode-1'
  )
  assert.equal(rows.length, 2)
  const inserts = fake.calls.filter(
    (c) => c.table === 'rate_limits' && c.op === 'insert'
  )
  assert.equal(inserts.length, 2)
  assert.deepEqual(inserts[0].patch, [{ key: 'report:user-1:episode-1' }])
})

test('counts only rows of this key inside the window', async () => {
  const fake = createFakeSupabase({
    rate_limits: [
      { id: 'old-1', key: 'report:user-1:episode-1', created_at: '2025-12-31T23:59:00.000Z' },
      { id: 'old-2', key: 'report:user-1:episode-1', created_at: '2025-12-31T23:59:29.999Z' },
      { id: 'other', key: 'report:user-2:episode-1', created_at: '2026-01-01T00:00:20.000Z' },
      { id: 'other-2', key: 'report:user-2:episode-1', created_at: '2026-01-01T00:00:21.000Z' },
    ],
  })
  assert.equal(await withinRateLimitCore(fake.client, opts()), true)
  assert.equal(await withinRateLimitCore(fake.client, opts()), true)
  assert.equal(await withinRateLimitCore(fake.client, opts()), false)

  const select = fake.calls.find(
    (c) => c.table === 'rate_limits' && c.op === 'select'
  )
  assert.ok(select)
  assert.deepEqual(select.filters, [
    { kind: 'eq', col: 'key', value: 'report:user-1:episode-1' },
    { kind: 'gte', col: 'created_at', value: '2025-12-31T23:59:30.000Z' },
  ])
})

test('a row exactly at the window start still counts', async () => {
  const fake = createFakeSupabase({
    rate_limits: [
      { id: 'edge', key: 'k', created_at: '2025-12-31T23:59:30.000Z' },
    ],
  })
  assert.equal(
    await withinRateLimitCore(fake.client, opts({ key: 'k', max: 1 })),
    false
  )
})

for (const failOpen of [true, false]) {
  test(`count error returns failOpen=${failOpen} and writes nothing`, async () => {
    const fake = createFakeSupabase({ rate_limits: [] })
    fake.failOn({ table: 'rate_limits', op: 'select', nth: 1 })
    assert.equal(
      await withinRateLimitCore(fake.client, opts({ failOpen })),
      failOpen
    )
    assert.equal(fake.tables.rate_limits.length, 0)
  })

  test(`thrown count returns failOpen=${failOpen}`, async () => {
    const fake = createFakeSupabase({ rate_limits: [] })
    fake.throwOn({ table: 'rate_limits', op: 'select', nth: 1 })
    assert.equal(
      await withinRateLimitCore(fake.client, opts({ failOpen })),
      failOpen
    )
  })

  test(`insert error returns failOpen=${failOpen}`, async () => {
    const fake = createFakeSupabase({ rate_limits: [] })
    fake.failOn({ table: 'rate_limits', op: 'insert', nth: 1 })
    assert.equal(
      await withinRateLimitCore(fake.client, opts({ failOpen })),
      failOpen
    )
  })
}

test('max 0 refuses without writing', async () => {
  const fake = createFakeSupabase({ rate_limits: [] })
  assert.equal(await withinRateLimitCore(fake.client, opts({ max: 0 })), false)
  assert.equal(fake.tables.rate_limits.length, 0)
})
