import assert from 'node:assert/strict'
import test from 'node:test'
import { liveKeysForUrl, r2KeyFromUrl, r2KeysForUrl } from '../../src/server/r2-keys.ts'

const ORIGIN = 'https://media.test'
const KEY = 'show-artwork/shows/3f2504e0-4f89-41d3-9a0c-0305e82c3301/poster-1750000000000-12345678.webp'

test('url on our origin gives the key, with or without a cache-bust query', () => {
  assert.equal(r2KeyFromUrl(`${ORIGIN}/${KEY}`, ORIGIN), KEY)
  assert.equal(r2KeyFromUrl(`${ORIGIN}/${KEY}?v=3`, ORIGIN), KEY)
})

test('Supabase Storage urls, foreign hosts, empty values and no origin give nothing', () => {
  const supabase = 'https://proj.supabase.co/storage/v1/object/public/show-artwork/shows/x/poster-1.webp'
  assert.deepEqual(r2KeysForUrl(supabase, ORIGIN), [])
  assert.deepEqual(r2KeysForUrl(`https://evil.test/${KEY}`, ORIGIN), [])
  assert.deepEqual(r2KeysForUrl(null, ORIGIN), [])
  assert.deepEqual(r2KeysForUrl('', ORIGIN), [])
  assert.deepEqual(r2KeysForUrl(`${ORIGIN}/${KEY}`, null), [])
})

test('keys outside the three media buckets, traversal and double slashes are refused', () => {
  assert.equal(r2KeyFromUrl(`${ORIGIN}/_v/640/webp/${KEY}`, ORIGIN), null)
  assert.equal(r2KeyFromUrl(`${ORIGIN}/other/x.webp`, ORIGIN), null)
  assert.equal(r2KeyFromUrl(`${ORIGIN}/site-assets/../avatars/x.webp`, ORIGIN), null)
  assert.equal(r2KeyFromUrl(`${ORIGIN}/site-assets//x.webp`, ORIGIN), null)
  assert.equal(r2KeyFromUrl(`${ORIGIN}/site-assets/%2e%2e/x.webp`, ORIGIN), null)
})

test('the key list is the original plus webp and avif variants at the three widths', () => {
  const keys = r2KeysForUrl(`${ORIGIN}/${KEY}`, ORIGIN)
  assert.equal(keys[0], KEY)
  assert.equal(keys.length, 7)
  assert.ok(keys.includes(`_v/1920/avif/${KEY}`))
  assert.ok(keys.includes(`_v/640/webp/${KEY}`))
})

test('live keys: our origin gives the same keys as r2KeysForUrl', () => {
  assert.deepEqual(liveKeysForUrl(`${ORIGIN}/${KEY}?v=2`, ORIGIN), r2KeysForUrl(`${ORIGIN}/${KEY}`, ORIGIN))
})

test('live keys: a Supabase Storage public url stands for the same <bucket>/<path> key (copy script layout)', () => {
  const supabase = `https://proj.supabase.co/storage/v1/object/public/${KEY}?v=1`
  const keys = liveKeysForUrl(supabase, ORIGIN)
  assert.equal(keys[0], KEY)
  assert.equal(keys.length, 7)
  assert.ok(keys.includes(`_v/640/webp/${KEY}`))
  // Works with no media origin too: refusing is always safe.
  assert.deepEqual(liveKeysForUrl(supabase, null), keys)
})

test('live keys: empty, foreign, other buckets and traversal give nothing', () => {
  assert.deepEqual(liveKeysForUrl(null, ORIGIN), [])
  assert.deepEqual(liveKeysForUrl('', ORIGIN), [])
  assert.deepEqual(liveKeysForUrl('not a url', ORIGIN), [])
  assert.deepEqual(liveKeysForUrl(`https://evil.test/${KEY}`, ORIGIN), [])
  assert.deepEqual(liveKeysForUrl('https://p.supabase.co/storage/v1/object/public/other/x.png', ORIGIN), [])
  assert.deepEqual(liveKeysForUrl('https://p.supabase.co/storage/v1/object/public/avatars/../x.png', ORIGIN), [])
})
