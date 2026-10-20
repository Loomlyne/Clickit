import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseId,
  parseDirection,
  parseHeroVariant,
  episodeFixesSchema,
  restoreRenameSchema,
  seasonUpdateSchema,
  episodeUpdateSchema,
  categoryOrderSchema,
} from '../../src/lib/admin/schemas.ts'

const U1 = '3f0c1c9e-8b1a-4c53-9a53-6d1f6b1a2c01'
const U2 = '3f0c1c9e-8b1a-4c53-9a53-6d1f6b1a2c02'
const U3 = '3f0c1c9e-8b1a-4c53-9a53-6d1f6b1a2c03'

test('parseId: non-uuid string', () => {
  assert.deepEqual(parseId('not-a-uuid', 'show'), { ok: false, error: 'Invalid show id.' })
})
test('parseId: valid uuid', () => {
  assert.deepEqual(parseId(U1, 'show'), { ok: true, value: U1 })
})
test('parseId: undefined', () => assert.equal(parseId(undefined, 'show').ok, false))
test('parseId: number', () => assert.equal(parseId(123, 'show').ok, false))
test('parseId: empty string', () => assert.equal(parseId('', 'show').ok, false))

test('parseDirection: up and down ok', () => {
  assert.deepEqual(parseDirection('up'), { ok: true, value: 'up' })
  assert.deepEqual(parseDirection('down'), { ok: true, value: 'down' })
})
test('parseDirection: sideways', () => {
  assert.deepEqual(parseDirection('sideways'), { ok: false, error: 'Invalid direction.' })
})
test('parseDirection: undefined', () => assert.equal(parseDirection(undefined).ok, false))
test('parseDirection: UP uppercase', () => assert.equal(parseDirection('UP').ok, false))

test('parseHeroVariant: desktop and mobile ok', () => {
  assert.deepEqual(parseHeroVariant('desktop'), { ok: true, value: 'desktop' })
  assert.deepEqual(parseHeroVariant('mobile'), { ok: true, value: 'mobile' })
})
test('parseHeroVariant: undefined defaults to desktop', () => {
  assert.deepEqual(parseHeroVariant(undefined), { ok: true, value: 'desktop' })
})
test('parseHeroVariant: tablet', () => {
  assert.deepEqual(parseHeroVariant('tablet'), { ok: false, error: 'Invalid hero variant.' })
})
test('parseHeroVariant: empty string', () => assert.equal(parseHeroVariant('').ok, false))

const badNumbers: [string, unknown][] = [
  ['zero', 0], ['negative', -1], ['fraction', 1.5], ['NaN', NaN],
  ['Infinity', Infinity], ['over max', 100001], ['string', '3'],
]
for (const [name, n] of badNumbers) {
  test(`episodeFixesSchema rejects episode number ${name}`, () => {
    assert.equal(episodeFixesSchema.safeParse([{ episodeId: U1, newEpisodeNumber: n }]).success, false)
  })
}
test('episodeFixesSchema rejects non-uuid episodeId', () => {
  assert.equal(episodeFixesSchema.safeParse([{ episodeId: 'abc', newEpisodeNumber: 2 }]).success, false)
})
test('episodeFixesSchema rejects duplicate episodeId', () => {
  assert.equal(
    episodeFixesSchema.safeParse([
      { episodeId: U1, newEpisodeNumber: 2 },
      { episodeId: U1, newEpisodeNumber: 3 },
    ]).success,
    false
  )
})
test('episodeFixesSchema rejects more than 500 entries', () => {
  const many = Array.from({ length: 501 }, (_, i) => ({
    episodeId: `3f0c1c9e-8b1a-4c53-9a53-${String(i).padStart(12, '0')}`,
    newEpisodeNumber: 1,
  }))
  assert.equal(episodeFixesSchema.safeParse(many).success, false)
})
test('episodeFixesSchema accepts valid and empty', () => {
  assert.equal(episodeFixesSchema.safeParse([{ episodeId: U1, newEpisodeNumber: 4 }]).success, true)
  assert.equal(episodeFixesSchema.safeParse([]).success, true)
})

test('restoreRenameSchema rejects unknown keys', () => {
  assert.equal(restoreRenameSchema.safeParse({ title: 'a', archived: false }).success, false)
})
test('restoreRenameSchema rejects 201-char title', () => {
  assert.equal(restoreRenameSchema.safeParse({ title: 'x'.repeat(201) }).success, false)
})
test('restoreRenameSchema rejects whitespace-only title', () => {
  assert.equal(restoreRenameSchema.safeParse({ title: '   ' }).success, false)
})
test('restoreRenameSchema rejects 61-char slug', () => {
  assert.equal(restoreRenameSchema.safeParse({ slug: 'x'.repeat(61) }).success, false)
})
test('restoreRenameSchema accepts full and empty, trims', () => {
  const r = restoreRenameSchema.safeParse({
    title: ' Show ', slug: ' show ', episodeFixes: [{ episodeId: U1, newEpisodeNumber: 2 }],
  })
  assert.equal(r.success, true)
  if (r.success) {
    assert.equal(r.data.title, 'Show')
    assert.equal(r.data.slug, 'show')
  }
  assert.equal(restoreRenameSchema.safeParse({}).success, true)
})

test('seasonUpdateSchema rejects archived', () => {
  assert.equal(seasonUpdateSchema.safeParse({ archived: true }).success, false)
})
test('seasonUpdateSchema rejects id', () => {
  assert.equal(seasonUpdateSchema.safeParse({ id: U1 }).success, false)
})
test('seasonUpdateSchema rejects season_number 0', () => {
  assert.equal(seasonUpdateSchema.safeParse({ season_number: 0 }).success, false)
})
test('seasonUpdateSchema rejects empty title', () => {
  assert.equal(seasonUpdateSchema.safeParse({ title: '' }).success, false)
})
test('seasonUpdateSchema rejects bad show_id', () => {
  assert.equal(seasonUpdateSchema.safeParse({ show_id: 'x' }).success, false)
})
test('seasonUpdateSchema accepts season-tabs payload', () => {
  assert.equal(
    seasonUpdateSchema.safeParse({ title: 'S1', title_ar: null, season_number: 1, show_id: U1 }).success,
    true
  )
})

test('episodeUpdateSchema rejects archived', () => {
  assert.equal(episodeUpdateSchema.safeParse({ archived: true }).success, false)
})
test('episodeUpdateSchema rejects episode_count', () => {
  assert.equal(episodeUpdateSchema.safeParse({ episode_count: 3 }).success, false)
})
test('episodeUpdateSchema rejects bad status', () => {
  assert.equal(episodeUpdateSchema.safeParse({ status: 'live' }).success, false)
})
test('episodeUpdateSchema rejects bad publish_at', () => {
  assert.equal(episodeUpdateSchema.safeParse({ publish_at: 'tomorrow' }).success, false)
})
test('episodeUpdateSchema rejects negative episode_number', () => {
  assert.equal(episodeUpdateSchema.safeParse({ episode_number: -2 }).success, false)
})
test('episodeUpdateSchema rejects fractional duration', () => {
  assert.equal(episodeUpdateSchema.safeParse({ duration: 1.5 }).success, false)
})
test('episodeUpdateSchema accepts episodes-table payload', () => {
  assert.equal(
    episodeUpdateSchema.safeParse({
      title: 'E1', title_ar: null, description: 'd', description_ar: null,
      episode_number: 1, youtube_video_id: 'abc', duration: 600, status: 'published',
      publish_at: '2026-10-20T10:00:00+04:00', show_id: U1, season_id: U2,
    }).success,
    true
  )
})

test('categoryOrderSchema rejects non-array', () => {
  assert.equal(categoryOrderSchema.safeParse('x').success, false)
})
test('categoryOrderSchema rejects empty array', () => {
  assert.equal(categoryOrderSchema.safeParse([]).success, false)
})
test('categoryOrderSchema rejects non-uuid entry', () => {
  assert.equal(categoryOrderSchema.safeParse([U1, 'nope']).success, false)
})
test('categoryOrderSchema rejects duplicates', () => {
  assert.equal(categoryOrderSchema.safeParse([U1, U1]).success, false)
})
test('categoryOrderSchema rejects 501 ids', () => {
  const ids = Array.from({ length: 501 }, (_, i) => `3f0c1c9e-8b1a-4c53-9a53-${String(i).padStart(12, '0')}`)
  assert.equal(categoryOrderSchema.safeParse(ids).success, false)
})
test('categoryOrderSchema accepts 3 unique', () => {
  assert.equal(categoryOrderSchema.safeParse([U1, U2, U3]).success, true)
})
