import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HERO_VIDEO_MAX_BYTES,
  SVG_REJECTED_MESSAGE,
  SITE_IMAGE_MIME_EXT,
  SOCIAL_ICON_MIME_EXT,
  sniffImageMime,
  checkImageUpload,
  checkHeroVideoSize,
  verifyUploadedVideoSize,
} from '../../src/lib/admin/media-guards.ts'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const AVIF = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])
const ICO = new Uint8Array([0, 0, 1, 0, 1, 0])
const enc = (s: string) => new TextEncoder().encode(s)

test('sniffImageMime recognises formats', () => {
  assert.equal(sniffImageMime(PNG), 'image/png')
  assert.equal(sniffImageMime(JPEG), 'image/jpeg')
  assert.equal(sniffImageMime(WEBP), 'image/webp')
  assert.equal(sniffImageMime(AVIF), null)
  assert.equal(sniffImageMime(ICO), 'image/x-icon')
  assert.equal(sniffImageMime(enc('<?xml version="1.0"?><svg/>')), 'image/svg+xml')
  assert.equal(sniffImageMime(enc('  \n<svg/>')), 'image/svg+xml')
  assert.equal(sniffImageMime(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x73])), 'image/svg+xml')
  assert.equal(sniffImageMime(enc('hello')), null)
})

test('declared SVG is refused', () => {
  const r = checkImageUpload({ declaredMime: 'image/svg+xml', bytes: enc('<svg/>'), allow: SITE_IMAGE_MIME_EXT })
  assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE })
})

test('SVG bytes declared as PNG are refused', () => {
  const r = checkImageUpload({ declaredMime: 'image/png', bytes: enc('<svg/onload=alert(1)>'), allow: SITE_IMAGE_MIME_EXT })
  assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE })
})

test('mismatched bytes are refused', () => {
  const r = checkImageUpload({ declaredMime: 'image/png', bytes: JPEG, allow: SITE_IMAGE_MIME_EXT })
  assert.deepEqual(r, { ok: false, error: 'File content does not match its declared type.' })
})

test('allowed raster types pass', () => {
  assert.deepEqual(checkImageUpload({ declaredMime: 'image/webp', bytes: WEBP, allow: SITE_IMAGE_MIME_EXT }), { ok: true, mime: 'image/webp', ext: 'webp' })
  assert.deepEqual(checkImageUpload({ declaredMime: 'image/x-icon', bytes: ICO, allow: SITE_IMAGE_MIME_EXT }), { ok: true, mime: 'image/x-icon', ext: 'ico' })
  for (const allow of [SITE_IMAGE_MIME_EXT, SOCIAL_ICON_MIME_EXT]) {
    const r = checkImageUpload({ declaredMime: 'image/jpeg', bytes: JPEG, allow })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.ext, 'jpg')
  }
  const alias = checkImageUpload({ declaredMime: 'image/vnd.microsoft.icon', bytes: ICO, allow: SITE_IMAGE_MIME_EXT })
  assert.equal(alias.ok, true)
  if (alias.ok) assert.equal(alias.ext, 'ico')
})

test('AVIF is refused (site-assets bucket does not allow image/avif)', () => {
  for (const allow of [SITE_IMAGE_MIME_EXT, SOCIAL_ICON_MIME_EXT]) {
    assert.equal(allow['image/avif'], undefined)
    const r = checkImageUpload({ declaredMime: 'image/avif', bytes: AVIF, allow })
    assert.deepEqual(r, { ok: false, error: 'Unsupported image type.' })
  }
  assert.equal(SVG_REJECTED_MESSAGE.includes('AVIF'), false)
})

test('ICO is not allowed for social icons', () => {
  const r = checkImageUpload({ declaredMime: 'image/x-icon', bytes: ICO, allow: SOCIAL_ICON_MIME_EXT })
  assert.equal(r.ok, false)
})

test('checkHeroVideoSize', () => {
  assert.equal(HERO_VIDEO_MAX_BYTES, 50 * 1024 * 1024)
  assert.deepEqual(checkHeroVideoSize(50 * 1024 * 1024), { ok: true })
  assert.deepEqual(checkHeroVideoSize(50 * 1024 * 1024 + 1), { ok: false, error: 'Video must be under 50MB' })
  for (const v of [NaN, -1, undefined]) assert.equal(checkHeroVideoSize(v).ok, false)
})

function port(info: { data: { size?: number } | null; error: { message: string } | null }, removeErr: string | null = null) {
  const removed: string[][] = []
  return {
    removed,
    info: async () => info,
    remove: async (p: string[]) => {
      removed.push(p)
      return { error: removeErr ? { message: removeErr } : null }
    },
  }
}

test('verifyUploadedVideoSize removes oversize objects', async () => {
  const p = port({ data: { size: 60 * 1024 * 1024 }, error: null })
  const r = await verifyUploadedVideoSize(p, 'a.mp4')
  assert.deepEqual(r, { ok: false, error: 'Video must be under 50MB' })
  assert.deepEqual(p.removed, [['a.mp4']])
})

test('verifyUploadedVideoSize reports failed removal', async () => {
  const p = port({ data: { size: 60 * 1024 * 1024 }, error: null }, 'nope')
  const r = await verifyUploadedVideoSize(p, 'a.mp4')
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /could not be removed/)
})

test('verifyUploadedVideoSize ok, error and missing size', async () => {
  const ok = port({ data: { size: 10 * 1024 * 1024 }, error: null })
  assert.deepEqual(await verifyUploadedVideoSize(ok, 'a.mp4'), { ok: true, size: 10 * 1024 * 1024 })
  const err = port({ data: null, error: { message: 'x' } })
  assert.equal((await verifyUploadedVideoSize(err, 'a.mp4')).ok, false)
  assert.deepEqual(err.removed, [])
  const none = port({ data: {}, error: null })
  assert.deepEqual(await verifyUploadedVideoSize(none, 'a.mp4'), { ok: false, error: 'Could not verify uploaded video size' })
})
