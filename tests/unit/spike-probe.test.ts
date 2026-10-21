// Spike probes (plan 02.1-01 Task 2). Throwaway with the probes (plan 02.1-06).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_BURN_ITERATIONS,
  SPIKE_CACHE_CONTROL,
  SPIKE_TAG,
  burnCpu,
  parseIterations,
  parseProbePath,
  probeCacheKey,
  probeCacheResponse,
  rewriteForProbe,
  stripForProbe,
} from '../../src/server/spike-probe.ts'

const BASE = 'https://clickit.clickitstory.workers.dev'
const STAMP = '2026-10-21T15:00:00.000Z'

function inbound(path: string) {
  return new Request(`${BASE}${path}`, {
    headers: {
      Cookie: 'sb-127-auth-token=base64-abc; NEXT_LOCALE=ar',
      Authorization: 'Bearer abc',
      'Accept-Language': 'ar',
      'x-clickit-class': 'user',
      'X-Clickit-Debug': '1',
      rsc: '1',
      'next-router-state-tree': '%5B%22%22%5D',
      'next-router-prefetch': '1',
      'next-router-segment-prefetch': '/_tree',
      'next-url': '/spike-probe',
      'user-agent': 'probe',
    },
  })
}

test('stripForProbe removes Cookie, Authorization, Accept-Language and x-clickit-*', () => {
  const out = stripForProbe(inbound('/spike-probe/gw/en/portfolio?_rsc=abc12'))
  for (const name of ['cookie', 'authorization', 'accept-language', 'x-clickit-class', 'x-clickit-debug']) {
    assert.equal(out.headers.get(name), null, name)
  }
})

test('stripForProbe keeps rsc, next-router-* , next-url and _rsc, and rewrites the path', () => {
  const out = stripForProbe(inbound('/spike-probe/gw/en/portfolio?_rsc=abc12&x=1'))
  const url = new URL(out.url)
  assert.equal(url.pathname, '/en/portfolio')
  assert.equal(url.searchParams.get('_rsc'), 'abc12')
  assert.equal(url.searchParams.get('x'), '1')
  assert.equal(out.headers.get('rsc'), '1')
  assert.equal(out.headers.get('next-router-state-tree'), '%5B%22%22%5D')
  assert.equal(out.headers.get('next-router-prefetch'), '1')
  assert.equal(out.headers.get('next-router-segment-prefetch'), '/_tree')
  assert.equal(out.headers.get('next-url'), '/spike-probe')
  assert.equal(out.headers.get('user-agent'), 'probe')
  assert.equal(out.method, 'GET')
  assert.equal(out.redirect, 'manual')
})

test('stripForProbe maps /spike-probe/gw and /spike-probe/gw/ to /', () => {
  assert.equal(new URL(stripForProbe(inbound('/spike-probe/gw')).url).pathname, '/')
  assert.equal(new URL(stripForProbe(inbound('/spike-probe/gw/')).url).pathname, '/')
})

test('rewriteForProbe (bypass) rewrites the path and keeps every header', () => {
  const out = rewriteForProbe(inbound('/spike-probe/gw/en/about'))
  assert.equal(new URL(out.url).pathname, '/en/about')
  assert.equal(out.headers.get('cookie'), 'sb-127-auth-token=base64-abc; NEXT_LOCALE=ar')
  assert.equal(out.headers.get('accept-language'), 'ar')
})

test('parseProbePath', () => {
  assert.deepEqual(parseProbePath('/spike-probe/gw/en/auth'), { kind: 'gw', rest: '/en/auth' })
  assert.deepEqual(parseProbePath('/spike-probe/gw'), { kind: 'gw', rest: '/' })
  assert.deepEqual(parseProbePath('/spike-probe/cache/plain'), { kind: 'cache', rest: 'plain' })
  assert.deepEqual(parseProbePath('/spike-probe/cache/plain/x'), { kind: 'other', rest: '/spike-probe/cache/plain/x' })
  assert.deepEqual(parseProbePath('/spike-probe/cache/'), { kind: 'other', rest: '/spike-probe/cache/' })
  assert.deepEqual(parseProbePath('/spike-probe/gwx'), { kind: 'other', rest: '/spike-probe/gwx' })
  assert.deepEqual(parseProbePath('/spike-probe/a/b'), { kind: 'other', rest: '/spike-probe/a/b' })
})

test('plain probe carries the documented Cache-Control, Cache-Tag and stamp', async () => {
  const res = probeCacheResponse('plain', { stamp: STAMP, burnIterations: 0 })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), SPIKE_CACHE_CONTROL)
  assert.equal(res.headers.get('cache-control'), 'public, max-age=86400, stale-while-revalidate=2592000, stale-if-error=2592000')
  assert.equal(res.headers.get('cache-tag'), SPIKE_TAG)
  assert.equal(SPIKE_TAG, 'spike-a')
  assert.equal(res.headers.get('x-spike-filled-at'), STAMP)
  assert.equal(res.headers.get('set-cookie'), null)
  assert.deepEqual(JSON.parse(await res.text()), { probe: 'plain', stamp: STAMP })
})

test('r307 and r308 redirect to /spike-probe/a with the same Cache-Control and tag', () => {
  for (const [name, status] of [
    ['r307', 307],
    ['r308', 308],
  ] as const) {
    const res = probeCacheResponse(name, { stamp: STAMP, burnIterations: 0 })
    assert.equal(res.status, status)
    assert.equal(res.headers.get('location'), '/spike-probe/a')
    assert.equal(res.headers.get('cache-control'), SPIKE_CACHE_CONTROL)
    assert.equal(res.headers.get('cache-tag'), SPIKE_TAG)
    assert.equal(res.headers.get('x-spike-filled-at'), STAMP)
  }
})

test('cookie probe carries Set-Cookie (expected BYPASS at Workers Cache)', () => {
  const res = probeCacheResponse('cookie', { stamp: STAMP, burnIterations: 0 })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('set-cookie') ?? '', /^spike=1/)
  assert.equal(res.headers.get('cache-control'), SPIKE_CACHE_CONTROL)
})

test('burn probe runs a fixed iteration count and reports it', async () => {
  const res = probeCacheResponse('burn', { stamp: STAMP, burnIterations: 1000 })
  assert.equal(res.headers.get('cache-tag'), SPIKE_TAG)
  const body = JSON.parse(await res.text())
  assert.equal(body.iterations, 1000)
  assert.equal(body.result, burnCpu(1000))
  assert.equal(burnCpu(0), 0)
})

test('unknown probe name is a no-store 404', () => {
  const res = probeCacheResponse('nope', { stamp: STAMP, burnIterations: 0 })
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal(res.headers.get('cache-tag'), null)
})

test('iterations are bounded; cache key ignores the query unless a k token is given', () => {
  assert.equal(parseIterations(null), 0)
  assert.equal(parseIterations('abc'), 0)
  assert.equal(parseIterations('-5'), 0)
  assert.equal(parseIterations('1500'), 1500)
  assert.equal(parseIterations('999999999'), MAX_BURN_ITERATIONS)
  assert.equal(probeCacheKey('plain', null), '/__spike/plain')
  assert.equal(probeCacheKey('burn', 'run-07'), '/__spike/burn/run-07')
  assert.equal(probeCacheKey('burn', '../x'), '/__spike/burn')
  assert.equal(probeCacheKey('burn', 'x'.repeat(33)), '/__spike/burn')
})
