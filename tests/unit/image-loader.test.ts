import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  LOADER_WIDTHS,
  buildImageUrl,
  pickVariantWidth,
} from '../../src/lib/image-loader.ts'
import { VARIANT_WIDTHS } from '../../workers/media/src/handler.ts'

const ORIGIN = 'https://m.example'

test('LOADER_WIDTHS stays in step with the media Worker VARIANT_WIDTHS', () => {
  assert.deepEqual([...LOADER_WIDTHS], [...VARIANT_WIDTHS])
})

test('pickVariantWidth picks the nearest supported width >= requested, capped at 1920', () => {
  assert.equal(pickVariantWidth(100), 640)
  assert.equal(pickVariantWidth(640), 640)
  assert.equal(pickVariantWidth(641), 1280)
  assert.equal(pickVariantWidth(1280), 1280)
  assert.equal(pickVariantWidth(1500), 1920)
  assert.equal(pickVariantWidth(3840), 1920)
})

test('pickVariantWidth only ever returns a width the Worker serves', () => {
  for (const width of [0, 1, 16, 96, 256, 384, 750, 828, 1080, 1200, 2048, 3840]) {
    assert.ok(VARIANT_WIDTHS.includes(pickVariantWidth(width)), String(width))
  }
})

test('pickVariantWidth falls back to the smallest width for invalid input', () => {
  assert.equal(pickVariantWidth(Number.NaN), 640)
  assert.equal(pickVariantWidth(-5), 640)
})

test('media-origin URLs get ?w=<variant width>', () => {
  assert.equal(
    buildImageUrl({
      src: 'https://m.example/show-artwork/a.jpg',
      width: 750,
      mediaOrigin: ORIGIN,
    }),
    'https://m.example/show-artwork/a.jpg?w=1280'
  )
})

test('an existing ?v= is kept (v then w) and an existing w is replaced', () => {
  assert.equal(
    buildImageUrl({
      src: 'https://m.example/site-assets/settings/logo.png?v=123',
      width: 640,
      mediaOrigin: ORIGIN,
    }),
    'https://m.example/site-assets/settings/logo.png?v=123&w=640'
  )
  assert.equal(
    buildImageUrl({
      src: 'https://m.example/avatars/a.png?w=99&v=7',
      width: 1500,
      mediaOrigin: ORIGIN,
    }),
    'https://m.example/avatars/a.png?v=7&w=1920'
  )
})

test('an http loopback media origin matches exactly', () => {
  assert.equal(
    buildImageUrl({
      src: 'http://127.0.0.1:8789/show-artwork/a.jpg',
      width: 300,
      mediaOrigin: 'http://127.0.0.1:8789',
    }),
    'http://127.0.0.1:8789/show-artwork/a.jpg?w=640'
  )
})

test('everything that is not the exact media origin passes through unchanged', () => {
  const passthrough = [
    '/brand/logo.svg',
    'data:image/png;base64,AAAA',
    'blob:https://www.clickitstory.ae/abc',
    'https://i.ytimg.com/vi/x/hq.jpg',
    'https://img.youtube.com/vi/x/hq.jpg',
    'https://images.unsplash.com/x',
    'https://picsum.photos/x',
    'https://abc.supabase.co/storage/v1/object/public/show-artwork/a.jpg',
    'https://other.example/show-artwork/a.jpg',
    // same host, different scheme or port is a different origin
    'http://m.example/show-artwork/a.jpg',
    'https://m.example:8443/show-artwork/a.jpg',
    // look-alike host
    'https://m.example.evil.test/show-artwork/a.jpg',
    'https://evil.test/?u=https://m.example/a.jpg',
    'https://not a url',
    '',
  ]
  for (const src of passthrough) {
    assert.equal(
      buildImageUrl({ src, width: 1080, mediaOrigin: ORIGIN }),
      src,
      src
    )
  }
})

test('a null media origin leaves every src unchanged', () => {
  for (const src of [
    'https://m.example/show-artwork/a.jpg',
    '/brand/logo.svg',
    'https://abc.supabase.co/storage/v1/object/public/show-artwork/a.jpg',
  ]) {
    assert.equal(buildImageUrl({ src, width: 640, mediaOrigin: null }), src)
  }
})
