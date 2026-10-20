import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizeUploadedObject, type FinalizeBucket } from '../../src/server/upload-finalize.ts'
import { mintUploadKey, variantKeyFor } from '../../src/server/upload-kinds.ts'
import { SVG_REJECTED_MESSAGE } from '../../src/lib/admin/media-guards.ts'

const MB = 1024 * 1024
const SHOW = '0b8f3c1e-5d2a-4c7b-9e1f-3a6d8c2b4f10'
const USER = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const OTHER = '11111111-2222-4333-8444-555555555555'
const fixed = { now: 1760000000000, random: () => 'abcdef12' }

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0])
const ICO = new Uint8Array([0, 0, 1, 0, 1, 0, 0, 0])
const MP4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

type Stored = { bytes: Uint8Array; size: number }

function fakeBucket(objects: Record<string, Stored | Uint8Array>, opts: { failDelete?: boolean } = {}) {
  const store = new Map<string, Stored>()
  for (const [k, v] of Object.entries(objects)) {
    store.set(k, v instanceof Uint8Array ? { bytes: v, size: v.length } : v)
  }
  const deleted: string[] = []
  const bucket: FinalizeBucket = {
    async head(key) {
      const o = store.get(key)
      return o ? { size: o.size } : null
    },
    async get(key, options) {
      const o = store.get(key)
      if (!o) return null
      const off = options?.range?.offset ?? 0
      const len = options?.range?.length ?? o.bytes.length
      const slice = o.bytes.slice(off, off + len)
      return { arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer }
    },
    async delete(keys) {
      if (opts.failDelete) throw new Error('boom')
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        deleted.push(k)
        store.delete(k)
      }
    },
  }
  return { bucket, deleted, store }
}

const posterKey = mintUploadKey('artwork', { slot: 'poster', showId: SHOW, contentType: 'image/png', ...fixed })
const avatarKey = mintUploadKey('avatar', { userId: USER, contentType: 'image/png', ...fixed })

test('valid PNG under the cap with the right prefix is accepted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: PNG })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', showId: SHOW, key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(r, {
    ok: true,
    key: posterKey,
    size: PNG.length,
    contentType: 'image/png',
    variants: [],
    droppedVariants: [],
  })
  assert.deepEqual(deleted, [])
})

test('object missing: "Upload not found", nothing deleted', async () => {
  const { bucket, deleted } = fakeBucket({})
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(r, { ok: false, error: 'Upload not found' })
  assert.deepEqual(deleted, [])
})

test('key of another kind is refused and NOT deleted (cannot prove it is ours)', async () => {
  const { bucket, deleted, store } = fakeBucket({ [posterKey]: PNG })
  const r = await finalizeUploadedObject({ kind: 'site-image', slot: 'og', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.deepEqual(deleted, [])
  assert.ok(store.has(posterKey))
})

test("another user's avatar key is refused and NOT deleted", async () => {
  const theirs = mintUploadKey('avatar', { userId: OTHER, contentType: 'image/png', ...fixed })
  const { bucket, deleted, store } = fakeBucket({ [theirs]: PNG })
  const r = await finalizeUploadedObject({ kind: 'avatar', userId: USER, key: theirs, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.deepEqual(deleted, [])
  assert.ok(store.has(theirs))
})

test('a variant key pointing at someone else is never deleted', async () => {
  const theirs = mintUploadKey('avatar', { userId: OTHER, contentType: 'image/png', ...fixed })
  const { bucket, deleted, store } = fakeBucket({ [avatarKey]: PNG, [theirs]: PNG })
  const r = await finalizeUploadedObject({ kind: 'avatar', userId: USER, key: avatarKey, variantKeys: [theirs], bucket })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.deepEqual(r.variants, [])
    assert.deepEqual(r.droppedVariants, [{ key: theirs, reason: 'bad-key' }])
  }
  assert.ok(store.has(theirs))
  assert.deepEqual(deleted, [])
})

test('size over the cap: refused with the kind message, original and variants deleted', async () => {
  const big: Stored = { bytes: PNG, size: 2 * MB + 1 }
  const v640 = variantKeyFor(avatarKey, 640)
  const { bucket, deleted } = fakeBucket({ [avatarKey]: big, [v640]: WEBP })
  const r = await finalizeUploadedObject({ kind: 'avatar', userId: USER, key: avatarKey, variantKeys: [v640], bucket })
  assert.deepEqual(r, { ok: false, error: 'File must be under 2MB' })
  assert.ok(deleted.includes(avatarKey))
  assert.ok(deleted.includes(v640))
})

test('hero video over 50 MB uses the existing message', async () => {
  const key = mintUploadKey('hero-video', { slot: 'desktop', contentType: 'video/mp4', ...fixed })
  const { bucket, deleted } = fakeBucket({ [key]: { bytes: MP4, size: 50 * MB + 1 } })
  const r = await finalizeUploadedObject({ kind: 'hero-video', slot: 'desktop', key, variantKeys: [], bucket })
  assert.deepEqual(r, { ok: false, error: 'Video must be under 50MB' })
  assert.deepEqual(deleted.includes(key), true)
})

test('SVG renamed .png is refused with the 01.1 message and deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: SVG })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE })
  assert.ok(deleted.includes(posterKey))
})

test('HTML renamed .png is refused and deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: new TextEncoder().encode('<!doctype html><script>1</script>') })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.ok(deleted.includes(posterKey))
})

test('MP4 bytes uploaded as an image are refused and deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: MP4 })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(r, { ok: false, error: 'File content does not match its declared type.' })
  assert.ok(deleted.includes(posterKey))
})

test('PNG bytes under a .webp key (type does not match the minted extension) are refused', async () => {
  const webpKey = mintUploadKey('artwork', { slot: 'poster', showId: SHOW, contentType: 'image/webp', ...fixed })
  const { bucket, deleted } = fakeBucket({ [webpKey]: PNG })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: webpKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.ok(deleted.includes(webpKey))
})

test('unknown bytes (plain text) are refused and deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: new TextEncoder().encode('just text') })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.ok(deleted.includes(posterKey))
})

test('empty object is refused and deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: { bytes: new Uint8Array(0), size: 0 } })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.ok(deleted.includes(posterKey))
})

test('good WebP variants are kept', async () => {
  const v640 = variantKeyFor(posterKey, 640)
  const v1280 = variantKeyFor(posterKey, 1280)
  const { bucket, deleted } = fakeBucket({ [posterKey]: PNG, [v640]: WEBP, [v1280]: WEBP })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [v640, v1280], bucket })
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.variants, [v640, v1280])
  assert.deepEqual(deleted, [])
})

test('variant of the wrong shape is dropped, original kept, not deleted', async () => {
  const { bucket, deleted } = fakeBucket({ [posterKey]: PNG })
  const bad = ['_v/800/webp/' + posterKey, '_v/640/avif/' + posterKey, 'show-artwork/other.webp']
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: bad, bucket })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.deepEqual(r.variants, [])
    assert.deepEqual(r.droppedVariants.map((d) => d.key).sort(), [...bad].sort())
    assert.ok(r.droppedVariants.every((d) => d.reason === 'bad-key'))
  }
  assert.deepEqual(deleted, [])
})

test('variant with non-WebP bytes is deleted, original kept', async () => {
  const v640 = variantKeyFor(posterKey, 640)
  const { bucket, deleted } = fakeBucket({ [posterKey]: PNG, [v640]: PNG })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [v640], bucket })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.deepEqual(r.variants, [])
    assert.deepEqual(r.droppedVariants, [{ key: v640, reason: 'not-webp' }])
  }
  assert.deepEqual(deleted, [v640])
})

test('variant over the kind cap is deleted, original kept', async () => {
  const v640 = variantKeyFor(avatarKey, 640)
  const { bucket, deleted } = fakeBucket({ [avatarKey]: PNG, [v640]: { bytes: WEBP, size: 2 * MB + 1 } })
  const r = await finalizeUploadedObject({ kind: 'avatar', userId: USER, key: avatarKey, variantKeys: [v640], bucket })
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.droppedVariants, [{ key: v640, reason: 'too-large' }])
  assert.deepEqual(deleted, [v640])
})

test('a declared variant that was never uploaded is dropped without a delete', async () => {
  const v640 = variantKeyFor(posterKey, 640)
  const { bucket, deleted } = fakeBucket({ [posterKey]: PNG })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [v640], bucket })
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.droppedVariants, [{ key: v640, reason: 'missing' }])
  assert.deepEqual(deleted, [])
})

test('ICO originals and video kinds take no variants (valid-shape variants deleted)', async () => {
  const icoKey = mintUploadKey('site-image', { slot: 'favicon', contentType: 'image/x-icon', ...fixed })
  const v = variantKeyFor(icoKey, 640)
  const a = fakeBucket({ [icoKey]: ICO, [v]: WEBP })
  const r1 = await finalizeUploadedObject({ kind: 'site-image', slot: 'favicon', key: icoKey, variantKeys: [v], bucket: a.bucket })
  assert.equal(r1.ok, true)
  if (r1.ok) assert.deepEqual(r1.variants, [])
  assert.deepEqual(a.deleted, [v])

  const vidKey = mintUploadKey('preloader-video', { contentType: 'video/mp4', ...fixed })
  const vv = variantKeyFor(vidKey, 640)
  const b = fakeBucket({ [vidKey]: MP4, [vv]: WEBP })
  const r2 = await finalizeUploadedObject({ kind: 'preloader-video', key: vidKey, variantKeys: [vv], bucket: b.bucket })
  assert.equal(r2.ok, true)
  if (r2.ok) assert.equal(r2.contentType, 'video/mp4')
  assert.deepEqual(b.deleted, [vv])
})

test('delete failure during cleanup: error returned with cleanupFailed:true', async () => {
  const { bucket } = fakeBucket({ [posterKey]: SVG }, { failDelete: true })
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(r, { ok: false, error: SVG_REJECTED_MESSAGE, cleanupFailed: true })
})

test('head throwing never yields ok:true', async () => {
  const bucket: FinalizeBucket = {
    head: async () => {
      throw new Error('network')
    },
    get: async () => null,
    delete: async () => {},
  }
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
})

test('get returning null after a good head is refused (never ok without sniffing)', async () => {
  const bucket: FinalizeBucket = {
    head: async () => ({ size: 10 }),
    get: async () => null,
    delete: async () => {},
  }
  const r = await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.equal(r.ok, false)
})

test('show-video and cast-image keys of the wrong show are refused', async () => {
  const key = mintUploadKey('show-video', { slot: 'desktop', showId: SHOW, contentType: 'video/mp4', ...fixed })
  const { bucket, deleted } = fakeBucket({ [key]: MP4 })
  const r = await finalizeUploadedObject({ kind: 'show-video', slot: 'desktop', showId: OTHER, key, variantKeys: [], bucket })
  assert.equal(r.ok, false)
  assert.deepEqual(deleted, [])
})

test('the sniff reads at most 64 bytes', async () => {
  const seen: unknown[] = []
  const inner = fakeBucket({ [posterKey]: PNG })
  const bucket: FinalizeBucket = {
    head: inner.bucket.head,
    get: async (k, o) => {
      seen.push(o)
      return inner.bucket.get(k, o)
    },
    delete: inner.bucket.delete,
  }
  await finalizeUploadedObject({ kind: 'artwork', slot: 'poster', key: posterKey, variantKeys: [], bucket })
  assert.deepEqual(seen[0], { range: { offset: 0, length: 64 } })
})
