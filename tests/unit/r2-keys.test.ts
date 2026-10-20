import assert from 'node:assert/strict'
import test from 'node:test'
import { r2KeyFromUrl, r2KeysForUrl } from '../../src/server/r2-keys.ts'

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
