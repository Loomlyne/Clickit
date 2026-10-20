import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isRealWebp,
  planBrowserVariants,
  scaledSize,
  uploadProgressLine,
  combineProgress,
} from '../../src/lib/browser-variants.ts'

test('planBrowserVariants: only widths narrower than the source, at most 640/1280/1920', () => {
  assert.deepEqual(planBrowserVariants(2400, 'image/png'), [640, 1280, 1920])
  assert.deepEqual(planBrowserVariants(1500, 'image/jpeg'), [640, 1280])
  assert.deepEqual(planBrowserVariants(1280, 'image/webp'), [640])
  assert.deepEqual(planBrowserVariants(1921, 'image/png'), [640, 1280, 1920])
  assert.deepEqual(planBrowserVariants(640, 'image/png'), [])
  assert.deepEqual(planBrowserVariants(100, 'image/png'), [])
})

test('planBrowserVariants: icons, gifs, svg and junk widths get no variants', () => {
  assert.deepEqual(planBrowserVariants(2400, 'image/x-icon'), [])
  assert.deepEqual(planBrowserVariants(2400, 'image/vnd.microsoft.icon'), [])
  assert.deepEqual(planBrowserVariants(2400, 'image/gif'), [])
  assert.deepEqual(planBrowserVariants(2400, 'image/svg+xml'), [])
  assert.deepEqual(planBrowserVariants(0, 'image/png'), [])
  assert.deepEqual(planBrowserVariants(Number.NaN, 'image/png'), [])
  assert.deepEqual(planBrowserVariants(-5, 'image/png'), [])
})

test('isRealWebp: only a blob that really says image/webp', () => {
  assert.equal(isRealWebp({ type: 'image/webp' }), true)
  assert.equal(isRealWebp({ type: 'image/png' }), false)
  assert.equal(isRealWebp({ type: '' }), false)
  assert.equal(isRealWebp(null), false)
  assert.equal(isRealWebp(undefined), false)
})

test('scaledSize keeps the aspect ratio and never returns 0', () => {
  assert.deepEqual(scaledSize(2400, 1200, 640), { width: 640, height: 320 })
  assert.deepEqual(scaledSize(1000, 1500, 640), { width: 640, height: 960 })
  assert.deepEqual(scaledSize(5000, 1, 640), { width: 640, height: 1 })
})

test('combineProgress: original is 100% of the bar until variants run', () => {
  assert.equal(combineProgress(0, 0, 3), 0)
  assert.equal(combineProgress(0.5, 0, 3), 50)
  assert.equal(combineProgress(1, 0, 3), 100)
  assert.equal(combineProgress(1, 3, 3), 100)
  assert.equal(combineProgress(2, 0, 0), 100)
  assert.equal(combineProgress(-1, 0, 0), 0)
})

test('uploadProgressLine uses the signed text for 3 copies, honest counts otherwise', () => {
  assert.equal(uploadProgressLine('image', 3), 'Uploading… then 3 smaller copies')
  assert.equal(uploadProgressLine('image', 2), 'Uploading… then 2 smaller copies')
  assert.equal(uploadProgressLine('image', 1), 'Uploading… then 1 smaller copy')
  assert.equal(uploadProgressLine('image', 0), 'Uploading…')
  assert.equal(uploadProgressLine('video', 0), 'Uploading…')
})
