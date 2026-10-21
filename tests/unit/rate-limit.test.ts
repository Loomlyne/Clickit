import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIpFrom } from '../../src/server/client-ip.ts'
import { decideRateLimit } from '../../src/server/rate-limit-policy.ts'

// ---- clientIpFrom ----------------------------------------------------------

test('clientIpFrom reads cf-connecting-ip', () => {
  const h = new Headers({ 'cf-connecting-ip': '203.0.113.5' })
  assert.equal(clientIpFrom(h), '203.0.113.5')
})

test('clientIpFrom accepts an IPv6 address', () => {
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '2001:db8::8a2e:370:7334' })), '2001:db8::8a2e:370:7334')
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '::1' })), '::1')
})

test('clientIpFrom ignores x-forwarded-for and x-real-ip', () => {
  const h = new Headers({ 'x-forwarded-for': '198.51.100.9', 'x-real-ip': '198.51.100.10' })
  assert.equal(clientIpFrom(h), null)
})

test('clientIpFrom prefers cf-connecting-ip over spoofable headers', () => {
  const h = new Headers({
    'cf-connecting-ip': '203.0.113.5',
    'x-forwarded-for': '198.51.100.9',
    'x-real-ip': '198.51.100.10',
  })
  assert.equal(clientIpFrom(h), '203.0.113.5')
})

test('clientIpFrom rejects invalid or oversized values', () => {
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': 'not an ip' })), null)
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '999.1.1.1' })), null)
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '1.2.3.4, 5.6.7.8' })), null)
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '1'.repeat(46) })), null)
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '' })), null)
})

test('clientIpFrom returns null without the header and 127.0.0.1 only with the explicit override', () => {
  assert.equal(clientIpFrom(new Headers()), null)
  assert.equal(clientIpFrom(new Headers(), { allowLocalOverride: false }), null)
  assert.equal(clientIpFrom(new Headers(), { allowLocalOverride: true }), '127.0.0.1')
})

test('the local override does not replace a real header or fix an invalid one', () => {
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': '203.0.113.5' }), { allowLocalOverride: true }), '203.0.113.5')
  assert.equal(clientIpFrom(new Headers({ 'cf-connecting-ip': 'garbage' }), { allowLocalOverride: true }), null)
})

// ---- decideRateLimit -------------------------------------------------------

type Call = string
function makeStore(opts: { count?: number | Error; recordError?: Error } = {}) {
  const calls: Call[] = []
  return {
    calls,
    store: {
      async count(ip: string, key: string, sinceIso: string) {
        calls.push(`count:${ip}:${key}:${sinceIso}`)
        if (opts.count instanceof Error) throw opts.count
        return opts.count ?? 0
      },
      async record(ip: string, key: string) {
        calls.push(`record:${ip}:${key}`)
        if (opts.recordError) throw opts.recordError
      },
    },
  }
}

const base = { key: 'support', limit: 5, windowMs: 3_600_000, now: () => Date.parse('2026-10-20T12:00:00.000Z') }

test('decideRateLimit refuses with no-ip and never touches the store', async () => {
  const { store, calls } = makeStore()
  const res = await decideRateLimit({ ...base, ip: null, store })
  assert.deepEqual(res, { allowed: false, reason: 'no-ip' })
  assert.deepEqual(calls, [])
})

test('decideRateLimit refuses an empty ip string', async () => {
  const { store } = makeStore()
  assert.deepEqual(await decideRateLimit({ ...base, ip: '', store }), { allowed: false, reason: 'no-ip' })
})

test('decideRateLimit refuses when count() throws (fail closed)', async () => {
  const { store } = makeStore({ count: new Error('db down') })
  assert.deepEqual(await decideRateLimit({ ...base, ip: '203.0.113.5', store }), { allowed: false, reason: 'store-error' })
})

test('decideRateLimit refuses at the limit and above, without recording', async () => {
  for (const count of [5, 6, 500]) {
    const { store, calls } = makeStore({ count })
    const res = await decideRateLimit({ ...base, ip: '203.0.113.5', store })
    assert.deepEqual(res, { allowed: false, reason: 'limited' })
    assert.equal(calls.some((c) => c.startsWith('record:')), false)
  }
})

test('decideRateLimit allows below the limit and records the hit', async () => {
  const { store, calls } = makeStore({ count: 4 })
  const res = await decideRateLimit({ ...base, ip: '203.0.113.5', store })
  assert.deepEqual(res, { allowed: true, reason: 'ok' })
  assert.deepEqual(calls, [
    'count:203.0.113.5:support:2026-10-20T11:00:00.000Z',
    'record:203.0.113.5:support',
  ])
})

test('decideRateLimit refuses when record() throws after an allow', async () => {
  const { store } = makeStore({ count: 0, recordError: new Error('insert failed') })
  assert.deepEqual(await decideRateLimit({ ...base, ip: '203.0.113.5', store }), { allowed: false, reason: 'store-error' })
})

test('decideRateLimit treats a non-numeric count as a store error', async () => {
  const store = {
    async count() {
      return Number.NaN
    },
    async record() {},
  }
  assert.deepEqual(await decideRateLimit({ ...base, ip: '203.0.113.5', store }), { allowed: false, reason: 'store-error' })
})

test('decideRateLimit refuses a non-positive limit or window (misconfiguration fails closed)', async () => {
  const { store } = makeStore()
  assert.equal((await decideRateLimit({ ...base, limit: 0, ip: '203.0.113.5', store })).allowed, false)
  assert.equal((await decideRateLimit({ ...base, windowMs: 0, ip: '203.0.113.5', store })).allowed, false)
})
