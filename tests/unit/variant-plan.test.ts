import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'

import {
  QUALITY,
  displayWidth,
  VARIANT_SPEC_VERSION,
  VARIANT_WIDTHS as SCRIPT_WIDTHS,
  encodeVariant,
  planVariants,
  variantKey,
} from '../../scripts/media/variants.mjs'
import {
  VARIANT_WIDTHS as WORKER_WIDTHS,
  variantCandidates,
} from '../../workers/media/src/handler.ts'

test('02-08 planVariants: 2400px JPEG gets 6 variants with the worker key layout and spec string', () => {
  const plan = planVariants(
    { contentType: 'image/jpeg', width: 2400, pages: 1 },
    'show-artwork/a.jpg'
  )
  assert.equal(plan.skipReason, null)
  assert.equal(plan.variants.length, 6)
  const keys = plan.variants.map((v: { key: string }) => v.key).sort()
  assert.deepEqual(
    keys,
    [
      '_v/1280/avif/show-artwork/a.jpg',
      '_v/1280/webp/show-artwork/a.jpg',
      '_v/1920/avif/show-artwork/a.jpg',
      '_v/1920/webp/show-artwork/a.jpg',
      '_v/640/avif/show-artwork/a.jpg',
      '_v/640/webp/show-artwork/a.jpg',
    ].sort()
  )
  const webp1280 = plan.variants.find(
    (v: { key: string }) => v.key === '_v/1280/webp/show-artwork/a.jpg'
  )
  assert.equal(webp1280.spec, `${VARIANT_SPEC_VERSION};w=1280;fmt=webp;q=${QUALITY.webp}`)
  assert.equal(webp1280.contentType, 'image/webp')
  const avif640 = plan.variants.find(
    (v: { key: string }) => v.key === '_v/640/avif/show-artwork/a.jpg'
  )
  assert.equal(avif640.spec, `${VARIANT_SPEC_VERSION};w=640;fmt=avif;q=${QUALITY.avif}`)
  assert.equal(avif640.contentType, 'image/avif')
})

test('02-08 planVariants: never upscales, a width equal to the original gets no variant', () => {
  const widths = (width: number) =>
    planVariants({ contentType: 'image/png', width, pages: 1 }, 'site-assets/x.png')
      .variants.map((v: { width: number }) => v.width)
  assert.deepEqual([...new Set(widths(1500))].sort((a, b) => a - b), [640, 1280])
  assert.deepEqual(widths(640), [])
  assert.deepEqual(widths(500), [])
  assert.deepEqual([...new Set(widths(1920))].sort((a, b) => a - b), [640, 1280])
})

test('02-08 planVariants: SVG, ICO, GIF, animated and video are skipped with a reason', () => {
  const cases: Array<[string, number]> = [
    ['image/svg+xml', 1],
    ['image/x-icon', 1],
    ['image/vnd.microsoft.icon', 1],
    ['image/gif', 1],
    ['image/webp', 3],
    ['video/mp4', 1],
    ['application/octet-stream', 1],
  ]
  for (const [contentType, pages] of cases) {
    const plan = planVariants({ contentType, width: 4000, pages }, 'site-assets/f')
    assert.deepEqual(plan.variants, [], contentType)
    assert.equal(typeof plan.skipReason, 'string', contentType)
    assert.ok(plan.skipReason.length > 0)
  }
})

test('02-08 planVariants: an image with unknown width is skipped, not guessed', () => {
  const plan = planVariants({ contentType: 'image/jpeg', width: null, pages: 1 }, 'a/b.jpg')
  assert.deepEqual(plan.variants, [])
  assert.match(plan.skipReason, /width/)
})

test('02-08 encodeVariant: 2000x1000 PNG becomes WebP at 1280 and AVIF at 640', async () => {
  const png = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer()

  const webp = await encodeVariant(png, 1280, 'webp')
  assert.equal(webp.contentType, 'image/webp')
  assert.equal(webp.info.format, 'webp')
  assert.equal(webp.info.width, 1280)
  assert.equal(webp.info.height, 640)

  const avif = await encodeVariant(png, 640, 'avif')
  assert.equal(avif.contentType, 'image/avif')
  assert.equal(avif.info.format, 'heif')
  assert.equal(avif.info.width, 640)
})

test('02-08 encodeVariant: never enlarges a narrower source', async () => {
  const png = await sharp({
    create: { width: 300, height: 200, channels: 3, background: '#000' },
  })
    .png()
    .toBuffer()
  const out = await encodeVariant(png, 640, 'webp')
  assert.equal(out.info.width, 300)
})

test('02-08 encodeVariant: EXIF orientation 6 (stored landscape) comes out portrait (proves .rotate(), research A2)', async () => {
  const jpeg = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: '#aa3333' },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer()
  const meta = await sharp(jpeg).metadata()
  assert.equal(meta.orientation, 6)
  assert.ok((meta.width ?? 0) > (meta.height ?? 0))

  const out = await encodeVariant(jpeg, 640, 'webp')
  assert.ok(out.info.height > out.info.width, `${out.info.width}x${out.info.height}`)
})

test('02-08 variant key layout and widths cannot drift from the media Worker', () => {
  assert.deepEqual([...SCRIPT_WIDTHS], [...WORKER_WIDTHS])
  for (const width of WORKER_WIDTHS) {
    for (const format of ['avif', 'webp']) {
      const key = variantKey(width, format, 'show-artwork/dir/a b.jpg')
      const candidates = variantCandidates(
        'show-artwork/dir/a b.jpg',
        width,
        `image/${format}`
      )
      assert.ok(
        candidates.includes(key),
        `worker does not look for ${key}; it looks for ${candidates.join(', ')}`
      )
    }
  }
})

test('02-08 displayWidth swaps axes for EXIF orientation 5-8 and planVariants honours a spec version override', () => {
  assert.equal(displayWidth({ width: 2000, height: 1000, orientation: 6 }), 1000)
  assert.equal(displayWidth({ width: 2000, height: 1000, orientation: 1 }), 2000)
  assert.equal(displayWidth({ width: 2000, height: 1000 }), 2000)
  assert.equal(displayWidth({}), null)
  const plan = planVariants(
    { contentType: 'image/jpeg', width: 2000, pages: 1 },
    'a/b.jpg',
    { specVersion: 'v2' }
  )
  assert.ok(plan.variants.every((v: { spec: string }) => v.spec.startsWith('v2;')))
})
