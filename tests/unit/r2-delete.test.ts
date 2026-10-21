import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deleteIfUnreferenced,
  deleteMediaForUrl,
  listKeys,
  stageR2Deletion,
  stageR2DeletionForUrl,
  stageShowMedia,
  withVariantKeys,
  type ListableBucket,
  type MediaDeleteGuard,
} from '../../src/server/r2-delete.ts'
import { readMediaReferenceUrls, type ReferenceDb } from '../../src/server/media-references.ts'
import { createFakeSupabase } from './helpers/fake-supabase.ts'

const ORIGIN = 'https://media.test'
const SHOW = '0b9f2a0e-1111-4222-8333-444455556666'

/** A guard whose reference read finds the given live urls (none by default). */
const guard = (urls: string[] = [], origin: string | null = ORIGIN): MediaDeleteGuard => ({
  readReferences: async () => ({ urls, error: null }),
  mediaOrigin: origin,
  label: '[t]',
})

function fakeBucket(keys: string[], opts: { failDelete?: boolean; pageSize?: number } = {}) {
  const store = new Set(keys)
  const deleteCalls: string[][] = []
  const bucket: ListableBucket = {
    async delete(k) {
      if (opts.failDelete) throw new Error('boom')
      const list = Array.isArray(k) ? k : [k]
      deleteCalls.push(list)
      for (const key of list) store.delete(key)
    },
    async list({ prefix, cursor, limit }) {
      const all = [...store].filter((k) => k.startsWith(prefix)).sort()
      const size = Math.min(opts.pageSize ?? 1000, limit ?? 1000)
      const start = cursor ? Number(cursor) : 0
      const page = all.slice(start, start + size)
      const next = start + size
      return {
        objects: page.map((key) => ({ key })),
        truncated: next < all.length,
        cursor: next < all.length ? String(next) : undefined,
      }
    },
  }
  return { bucket, store, deleteCalls }
}

test('withVariantKeys adds webp and avif variants for every width', () => {
  const keys = withVariantKeys(['show-artwork/shows/a/poster-1-aa.webp'])
  assert.equal(keys.length, 7)
  assert.ok(keys.includes('_v/640/webp/show-artwork/shows/a/poster-1-aa.webp'))
  assert.ok(keys.includes('_v/1920/avif/show-artwork/shows/a/poster-1-aa.webp'))
})

test('a staged deletion removes nothing before commit, and rollback is a no-op', async () => {
  const { bucket, store } = fakeBucket(['show-artwork/shows/a/x.webp'])
  const staged = stageR2Deletion(bucket, ['show-artwork/shows/a/x.webp'], guard())
  assert.equal(store.size, 1)
  assert.equal(await staged.rollback(), true)
  assert.equal(store.size, 1)
  assert.equal(await staged.commit(), true)
  assert.equal(store.size, 0)
})

test('commit reports false (does not throw) when R2 delete fails', async () => {
  const { bucket } = fakeBucket([], { failDelete: true })
  const staged = stageR2Deletion(bucket, ['show-artwork/shows/a/x.webp'], guard())
  const orig = console.error
  console.error = () => {}
  try {
    assert.equal(await staged.commit(), false)
  } finally {
    console.error = orig
  }
})

test('delete batches stay at or under 500 keys', async () => {
  const keys = Array.from({ length: 300 }, (_, i) => `show-artwork/shows/a/f${i}.webp`)
  const { bucket, deleteCalls } = fakeBucket(keys)
  assert.equal(await stageR2Deletion(bucket, keys, guard()).commit(), true)
  assert.ok(deleteCalls.length >= 4)
  assert.ok(deleteCalls.every((c) => c.length <= 500))
})

test('a url behind a Supabase host, a foreign host or nothing stages no deletion (MEDIA-07)', async () => {
  const { bucket, deleteCalls } = fakeBucket([])
  for (const url of [
    'https://proj.supabase.co/storage/v1/object/public/site-assets/preloader/video-1.mp4',
    'https://evil.example/site-assets/preloader/video-1.mp4',
    null,
    '',
  ]) {
    assert.equal(stageR2DeletionForUrl(bucket, url, guard()), null)
    assert.equal(await deleteMediaForUrl(bucket, url, guard()), true)
  }
  assert.equal(stageR2DeletionForUrl(bucket, `${ORIGIN}/site-assets/preloader/video-1.mp4`, guard([], null)), null)
  assert.equal(deleteCalls.length, 0)
})

test('a url on our media origin deletes the original and its variants only', async () => {
  const key = 'site-assets/preloader/video-1-aa.mp4'
  const other = 'site-assets/preloader/video-2-bb.mp4'
  const { bucket, store } = fakeBucket([key, other, `_v/640/webp/${key}`])
  assert.equal(await deleteMediaForUrl(bucket, `${ORIGIN}/${key}?v=3`, guard()), true)
  assert.deepEqual([...store], [other])
})

test('listKeys follows cursors across pages and refuses a truncated page without a cursor', async () => {
  const keys = Array.from({ length: 7 }, (_, i) => `show-artwork/shows/a/f${i}.webp`)
  const { bucket } = fakeBucket(keys, { pageSize: 3 })
  assert.deepEqual((await listKeys(bucket, 'show-artwork/shows/a/')).sort(), [...keys].sort())
  const broken: ListableBucket = {
    delete: async () => {},
    list: async () => ({ objects: [{ key: 'x' }], truncated: true }),
  }
  await assert.rejects(() => listKeys(broken, 'x'))
})

test('stageShowMedia stages both buckets for one show, leaves other shows alone, deletes on commit', async () => {
  const mine = [
    `show-artwork/shows/${SHOW}/poster-1-aa.webp`,
    `show-artwork/shows/${SHOW}/cast/c1-1-aa.webp`,
    `site-assets/shows/${SHOW}/hero-desktop-1-aa.mp4`,
  ]
  const theirs = ['show-artwork/shows/ffffffff-1111-4222-8333-444455556666/poster-1-aa.webp', 'site-assets/hero/video-1-aa.mp4']
  const variant = `_v/640/webp/${mine[0]}`
  const { bucket, store } = fakeBucket([...mine, ...theirs, variant])
  const staged = await stageShowMedia(bucket, SHOW, guard())
  assert.equal(staged.length, 2)
  assert.equal(store.size, mine.length + theirs.length + 1, 'nothing deleted before commit')
  for (const s of staged) assert.equal(await s.commit(), true)
  assert.deepEqual([...store].sort(), [...theirs].sort())
})

test('stageShowMedia with no media stages nothing, and refuses an id that could widen the prefix', async () => {
  const { bucket } = fakeBucket([])
  assert.deepEqual(await stageShowMedia(bucket, SHOW, guard()), [])
  await assert.rejects(() => stageShowMedia(bucket, '../x', guard()))
  await assert.rejects(() => stageShowMedia(bucket, '', guard()))
})

// ---- deferred items 21-23: every delete of a previously-live key re-checks every reference ----

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const err = console.error
  const warn = console.warn
  console.error = () => {}
  console.warn = () => {}
  try {
    return await fn()
  } finally {
    console.error = err
    console.warn = warn
  }
}

const POSTER = `show-artwork/shows/${SHOW}/poster-1750000000000-12345678.webp`
const variantsOf = (k: string) => [640, 1280, 1920].flatMap((w) => [`_v/${w}/webp/${k}`, `_v/${w}/avif/${k}`])

test('deleteIfUnreferenced deletes an unreferenced key and its variants', async () => {
  const { bucket, store } = fakeBucket([POSTER, ...variantsOf(POSTER)])
  const r = await deleteIfUnreferenced(bucket, [POSTER, ...variantsOf(POSTER)], guard())
  assert.equal(r.ok, true)
  assert.deepEqual(r.kept, [])
  assert.equal(store.size, 0)
})

test('deleteIfUnreferenced keeps a key another scope still uses (poster also the site OG image), in any url form', async () => {
  for (const live of [`${ORIGIN}/${POSTER}`, `${ORIGIN}/${POSTER}?v=4`, `https://proj.supabase.co/storage/v1/object/public/${POSTER}`]) {
    const { bucket, store, deleteCalls } = fakeBucket([POSTER, ...variantsOf(POSTER)])
    const r = await quiet(() => deleteIfUnreferenced(bucket, [POSTER, ...variantsOf(POSTER)], guard([live])))
    assert.equal(r.ok, true)
    assert.equal(r.deleted.length, 0)
    assert.equal(store.size, 7, live)
    assert.equal(deleteCalls.length, 0)
  }
})

test('deleteIfUnreferenced keeps the variant keys of a still-referenced original, deletes the rest', async () => {
  const other = `show-artwork/shows/${SHOW}/card-1750000000000-12345678.webp`
  const { bucket, store } = fakeBucket([POSTER, ...variantsOf(POSTER), other])
  // Only a variant url is stored live: the original and every variant stay.
  const r = await quiet(() =>
    deleteIfUnreferenced(bucket, [`_v/640/webp/${POSTER}`, `_v/1280/avif/${POSTER}`, other], guard([`${ORIGIN}/_v/1920/webp/${POSTER}`]))
  )
  assert.equal(r.ok, true)
  assert.deepEqual(r.kept, [`_v/640/webp/${POSTER}`, `_v/1280/avif/${POSTER}`])
  assert.deepEqual(r.deleted, [other])
  assert.ok(store.has(`_v/640/webp/${POSTER}`) && store.has(POSTER) && !store.has(other))
})

test('deleteIfUnreferenced: a failed reference read deletes nothing (fail safe) and reports not ok', async () => {
  const { bucket, store, deleteCalls } = fakeBucket([POSTER])
  for (const readReferences of [
    async () => ({ urls: [], error: 'db down' }),
    async () => {
      throw new Error('network')
    },
  ]) {
    const r = await quiet(() => deleteIfUnreferenced(bucket, [POSTER], { readReferences, mediaOrigin: ORIGIN, label: '[t]' }))
    assert.equal(r.ok, false)
    assert.ok(r.error)
    assert.deepEqual(r.deleted, [])
  }
  assert.equal(store.size, 1)
  assert.equal(deleteCalls.length, 0)
})

test('the reference read happens at delete time, not when the deletion was staged', async () => {
  const { bucket, store } = fakeBucket([POSTER])
  const live: string[] = []
  const g: MediaDeleteGuard = { readReferences: async () => ({ urls: [...live], error: null }), mediaOrigin: ORIGIN, label: '[t]' }
  const staged = stageR2Deletion(bucket, [POSTER], g)
  live.push(`${ORIGIN}/${POSTER}`) // another admin saved this url after the stage
  assert.equal(await quiet(() => staged.commit()), true)
  assert.ok(store.has(POSTER))
})

test('remove path (deleteMediaForUrl): a same-scope share is kept (og and auth image hold the same file)', async () => {
  const og = 'site-assets/settings/og-1750000000000-12345678.jpg'
  const { bucket, store } = fakeBucket([og])
  // removeSiteImage cleared og_image_url; auth_image_url still holds the same file.
  assert.equal(await quiet(() => deleteMediaForUrl(bucket, `${ORIGIN}/${og}`, guard([`${ORIGIN}/${og}?v=2`]))), true)
  assert.ok(store.has(og))
})

test('remove path: a cross-scope share is kept, and a failed read reports false and deletes nothing', async () => {
  const { bucket, store } = fakeBucket([POSTER])
  assert.equal(await quiet(() => deleteMediaForUrl(bucket, `${ORIGIN}/${POSTER}`, guard([`${ORIGIN}/${POSTER}`]))), true)
  assert.ok(store.has(POSTER))
  const failing: MediaDeleteGuard = { readReferences: async () => ({ urls: [], error: 'x' }), mediaOrigin: ORIGIN, label: '[t]' }
  assert.equal(await quiet(() => deleteMediaForUrl(bucket, `${ORIGIN}/${POSTER}`, failing)), false)
  assert.ok(store.has(POSTER))
})

test('show delete (stageShowMedia): a show file reused elsewhere (site OG, another show) survives the commit', async () => {
  const cast = `show-artwork/shows/${SHOW}/cast/1750000000000-12345678.png`
  const video = `site-assets/shows/${SHOW}/hero-desktop-1750000000000-12345678.mp4`
  const { bucket, store } = fakeBucket([POSTER, ...variantsOf(POSTER), cast, video])
  // The show row is gone; the site OG image still points at its poster and another show at the cast portrait.
  const fake = createFakeSupabase({
    shows: [{ id: 'other-show', poster_url: null, logo_url: null }],
    show_cast: [{ id: 'c9', show_id: 'other-show', image_url: `${ORIGIN}/${cast}?v=1` }],
    app_config: [{ id: 1, og_image_url: `${ORIGIN}/${POSTER}`, footer_content: { social: [] } }],
    profiles: [],
    shorts: [],
  })
  const g: MediaDeleteGuard = {
    readReferences: () => readMediaReferenceUrls(fake.client as ReferenceDb),
    mediaOrigin: ORIGIN,
    label: '[t]',
  }
  const staged = await stageShowMedia(bucket, SHOW, g)
  for (const s of staged) assert.equal(await quiet(() => s.commit()), true)
  assert.ok(store.has(POSTER), 'poster used as OG image kept')
  assert.ok(variantsOf(POSTER).every((k) => store.has(k)), 'its variants kept')
  assert.ok(store.has(cast), 'cast portrait reused by another show kept')
  assert.ok(!store.has(video), 'an unreferenced show file is deleted')
})

test('show delete: a failed reference read at commit deletes nothing', async () => {
  const { bucket, store } = fakeBucket([POSTER])
  const failing: MediaDeleteGuard = { readReferences: async () => ({ urls: [], error: 'x' }), mediaOrigin: ORIGIN, label: '[t]' }
  const staged = await stageShowMedia(bucket, SHOW, failing)
  for (const s of staged) assert.equal(await quiet(() => s.commit()), false)
  assert.ok(store.has(POSTER))
})
