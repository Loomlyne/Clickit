import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MEDIA_PRESIGN_RATE_KEY,
  MEDIA_PRESIGN_RATE_LIMIT,
  MEDIA_PRESIGN_RATE_WINDOW_MS,
  allowMediaPresign,
  mediaPresignRateIp,
} from '../../src/server/media-presign-limit.ts'
import type { RateLimitStore } from '../../src/server/rate-limit-policy.ts'

// Review item 2: presigned PUTs are rate-limited per signed-in user and fail closed.

const USER = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const NOW = 1_760_000_000_000

function memoryStore(initial = 0) {
  const rows: { ip: string; key: string }[] = []
  const counts: { ip: string; key: string; since: string }[] = []
  let preset = initial
  const store: RateLimitStore = {
    async count(ip, key, since) {
      counts.push({ ip, key, since })
      return preset + rows.filter((r) => r.ip === ip && r.key === key).length
    },
    async record(ip, key) {
      rows.push({ ip, key })
    },
  }
  return { store, rows, counts, setPreset: (n: number) => (preset = n) }
}

test('the limit is 30 presign calls per user per 10 minutes under key media-presign', () => {
  assert.equal(MEDIA_PRESIGN_RATE_KEY, 'media-presign')
  assert.equal(MEDIA_PRESIGN_RATE_LIMIT, 30)
  assert.equal(MEDIA_PRESIGN_RATE_WINDOW_MS, 10 * 60 * 1000)
  assert.equal(mediaPresignRateIp(USER), `user:${USER}`)
})

test('allowMediaPresign records one row per allowed call against user:<id> and the 10 minute window', async () => {
  const mem = memoryStore()
  const res = await allowMediaPresign({ userId: USER, getStore: () => mem.store, now: () => NOW })
  assert.deepEqual(res, { allowed: true, reason: 'ok' })
  assert.deepEqual(mem.rows, [{ ip: `user:${USER}`, key: 'media-presign' }])
  assert.equal(mem.counts[0].since, new Date(NOW - MEDIA_PRESIGN_RATE_WINDOW_MS).toISOString())
})

test('allowMediaPresign refuses at the limit', async () => {
  const mem = memoryStore(MEDIA_PRESIGN_RATE_LIMIT - 1)
  assert.equal((await allowMediaPresign({ userId: USER, getStore: () => mem.store, now: () => NOW })).allowed, true)
  const second = await allowMediaPresign({ userId: USER, getStore: () => mem.store, now: () => NOW })
  assert.deepEqual(second, { allowed: false, reason: 'limited' })
})

test('allowMediaPresign fails closed: store error, store factory throw, missing user', async () => {
  const broken: RateLimitStore = {
    async count() {
      throw new Error('db down')
    },
    async record() {},
  }
  assert.equal((await allowMediaPresign({ userId: USER, getStore: () => broken })).allowed, false)
  assert.equal(
    (
      await allowMediaPresign({
        userId: USER,
        getStore: () => {
          throw new Error('no service role key')
        },
      })
    ).allowed,
    false
  )
  for (const userId of ['', undefined, null]) {
    const mem = memoryStore()
    const res = await allowMediaPresign({ userId: userId as never, getStore: () => mem.store })
    assert.equal(res.allowed, false)
    assert.equal(mem.counts.length, 0)
  }
})
