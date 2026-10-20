// Script routing (D-04, no translation) and the single "Needs English title"
// rule (checker W3).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  containsArabicScript,
  dominantScript,
  needsEnglishTitle,
  routeYouTubeText,
} from '../../src/server/youtube/script.ts'

test('containsArabicScript', () => {
  assert.equal(containsArabicScript('حلقة'), true)
  assert.equal(containsArabicScript('Episode 1 حلقة'), true)
  assert.equal(containsArabicScript('Episode 1'), false)
  assert.equal(containsArabicScript(''), false)
})

test('dominantScript: Arabic when letters are at least half; digits and punctuation ignored', () => {
  assert.equal(dominantScript('حلقة'), 'ar')
  assert.equal(dominantScript('حلقة 12345 !!!'), 'ar')
  assert.equal(dominantScript('ab حل'), 'ar') // exactly half
  assert.equal(dominantScript('Episode 1 حلقة'), 'other')
  assert.equal(dominantScript('Episode'), 'other')
  assert.equal(dominantScript('12345 !!!'), 'other')
  assert.equal(dominantScript(''), 'other')
})

test('routeYouTubeText sends Arabic text to the *_ar fields', () => {
  assert.deepEqual(routeYouTubeText({ title: 'حلقة', description: 'وصف' }), {
    title: 'حلقة',
    title_ar: 'حلقة',
    description: '',
    description_ar: 'وصف',
  })
})

test('routeYouTubeText keeps English text in title/description with null *_ar', () => {
  assert.deepEqual(routeYouTubeText({ title: 'Episode 1', description: 'About it' }), {
    title: 'Episode 1',
    title_ar: null,
    description: 'About it',
    description_ar: null,
  })
})

test('routeYouTubeText routes title and description independently', () => {
  assert.deepEqual(routeYouTubeText({ title: 'Episode 1', description: 'وصف' }), {
    title: 'Episode 1',
    title_ar: null,
    description: '',
    description_ar: 'وصف',
  })
})

test('routeYouTubeText trims and caps lengths (title 100, description 1000)', () => {
  const out = routeYouTubeText({ title: `  ${'a'.repeat(150)}  `, description: 'b'.repeat(1500) })
  assert.equal(out.title.length, 100)
  assert.equal(out.description.length, 1000)
  const ar = routeYouTubeText({ title: 'ح'.repeat(150), description: 'و'.repeat(1500) })
  assert.equal(ar.title_ar?.length, 100)
  assert.equal(ar.description_ar?.length, 1000)
  assert.equal(ar.title.length, 100)
})

test('routeYouTubeText tolerates missing text', () => {
  assert.deepEqual(
    routeYouTubeText({ title: undefined as unknown as string, description: undefined as unknown as string }),
    { title: '', title_ar: null, description: '', description_ar: null }
  )
})

test('needsEnglishTitle: Arabic-dominant title, or title mirroring title_ar', () => {
  assert.equal(needsEnglishTitle({ title: 'حلقة 1', title_ar: null }), true)
  assert.equal(needsEnglishTitle({ title: 'X', title_ar: 'X' }), true)
  assert.equal(needsEnglishTitle({ title: 'Episode', title_ar: 'حلقة' }), false)
  assert.equal(needsEnglishTitle({ title: 'Episode 1 حلقة', title_ar: null }), false) // minority Arabic
  assert.equal(needsEnglishTitle({ title: 'Episode', title_ar: null }), false)
  assert.equal(needsEnglishTitle({ title: 'Episode', title_ar: '' }), false)
})

test('needsEnglishTitle and routeYouTubeText agree on one rule', () => {
  for (const text of ['حلقة', 'Episode', 'Episode 1 حلقة', 'ab حل', '']) {
    const routed = routeYouTubeText({ title: text, description: '' })
    assert.equal(
      needsEnglishTitle({ title: routed.title, title_ar: routed.title_ar }),
      dominantScript(text) === 'ar' && text.trim() !== '',
      text
    )
  }
})
