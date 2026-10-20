import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deleteMediaForUrl,
  listKeys,
  stageR2Deletion,
  stageR2DeletionForUrl,
  stageShowMedia,
  withVariantKeys,
  type ListableBucket,
} from '../../src/server/r2-delete.ts'

const ORIGIN = 'https://media.test'
const SHOW = '0b9f2a0e-1111-4222-8333-444455556666'

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
  const staged = stageR2Deletion(bucket, ['show-artwork/shows/a/x.webp'])
  assert.equal(store.size, 1)
  assert.equal(await staged.rollback(), true)
  assert.equal(store.size, 1)
  assert.equal(await staged.commit(), true)
  assert.equal(store.size, 0)
})

test('commit reports false (does not throw) when R2 delete fails', async () => {
  const { bucket } = fakeBucket([], { failDelete: true })
  const staged = stageR2Deletion(bucket, ['show-artwork/shows/a/x.webp'])
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
  assert.equal(await stageR2Deletion(bucket, keys).commit(), true)
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
    assert.equal(stageR2DeletionForUrl(bucket, url, ORIGIN), null)
    assert.equal(await deleteMediaForUrl(bucket, url, ORIGIN, '[t]'), true)
  }
  assert.equal(stageR2DeletionForUrl(bucket, `${ORIGIN}/site-assets/preloader/video-1.mp4`, null), null)
  assert.equal(deleteCalls.length, 0)
})

test('a url on our media origin deletes the original and its variants only', async () => {
  const key = 'site-assets/preloader/video-1-aa.mp4'
  const other = 'site-assets/preloader/video-2-bb.mp4'
  const { bucket, store } = fakeBucket([key, other, `_v/640/webp/${key}`])
  assert.equal(await deleteMediaForUrl(bucket, `${ORIGIN}/${key}?v=3`, ORIGIN, '[t]'), true)
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
  const staged = await stageShowMedia(bucket, SHOW)
  assert.equal(staged.length, 2)
  assert.equal(store.size, mine.length + theirs.length + 1, 'nothing deleted before commit')
  for (const s of staged) assert.equal(await s.commit(), true)
  assert.deepEqual([...store].sort(), [...theirs].sort())
})

test('stageShowMedia with no media stages nothing, and refuses an id that could widen the prefix', async () => {
  const { bucket } = fakeBucket([])
  assert.deepEqual(await stageShowMedia(bucket, SHOW), [])
  await assert.rejects(() => stageShowMedia(bucket, '../x'))
  await assert.rejects(() => stageShowMedia(bucket, ''))
})
