import assert from 'node:assert/strict'
import test from 'node:test'
import { fillTickerArabic } from '../../src/lib/admin/ticker.ts'

test('failed translation leaves slot empty and is counted', async () => {
  const { items, untranslated } = await fillTickerArabic(
    [{ tag: 'NEW', text: 'Season 2 is out' }],
    async () => [null, 'الموسم']
  )
  assert.equal(items[0]!.tag_ar, undefined)
  assert.equal(items[0]!.text_ar, 'الموسم')
  assert.equal(untranslated, 1)
})

test('existing tag_ar kept and not sent', async () => {
  let sent: string[] = []
  const { items, untranslated } = await fillTickerArabic(
    [{ tag: 'NEW', text: 'Hi', tag_ar: 'جديد' }],
    async (texts) => { sent = texts; return ['مرحبا'] }
  )
  assert.deepEqual(sent, ['Hi'])
  assert.equal(items[0]!.tag_ar, 'جديد')
  assert.equal(items[0]!.text_ar, 'مرحبا')
  assert.equal(untranslated, 0)
})

test('per-field max lengths go to the batch, one per slot (review item 7, PR #29)', async () => {
  let limits: Array<number | undefined> = []
  await fillTickerArabic(
    [{ tag: 'NEW', text: 'Season 2 is out', tag2: 'LIVE' }],
    async (texts, maxLengths) => { limits = maxLengths ?? []; return texts.map(() => 'نص') },
    { tag_ar: 24, text_ar: 240, tag2_ar: 24 }
  )
  assert.deepEqual(limits, [24, 240, 24])
})
