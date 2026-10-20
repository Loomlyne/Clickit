import assert from 'node:assert/strict'
import test from 'node:test'

import { beaconAttributes } from '../../src/lib/web-analytics.ts'

test('empty or missing token renders nothing', () => {
  assert.equal(beaconAttributes(''), null)
  assert.equal(beaconAttributes('   '), null)
  assert.equal(beaconAttributes(undefined), null)
})

test('a plain token yields the beacon script attributes', () => {
  assert.deepEqual(beaconAttributes('abc'), {
    src: 'https://static.cloudflareinsights.com/beacon.min.js',
    'data-cf-beacon': '{"token":"abc"}',
  })
})

test('tokens with quotes, angle brackets or whitespace are refused', () => {
  for (const bad of ['a"b', "a'b", 'a<b', 'a>b', 'a b', 'a\nb', 'a\\b']) {
    assert.equal(beaconAttributes(bad), null, JSON.stringify(bad))
  }
})

test('SPA tracking is not forced on', () => {
  assert.doesNotMatch(beaconAttributes('abc')!['data-cf-beacon'], /spa/)
})
