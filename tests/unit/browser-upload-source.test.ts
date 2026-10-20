import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const upload = readFileSync('src/lib/browser-upload.ts', 'utf8')

test('browser upload sends no file through a server action', () => {
  assert.equal(/new FormData\(/.test(upload), false)
  assert.equal(/uploadArtwork|uploadCastImage|uploadSiteImage|uploadSocialIcon|uploadAvatar/.test(upload), false)
  assert.match(upload, /requestMediaUpload/)
})

test('browser upload PUTs with XHR progress and repeats the signed Content-Type', () => {
  assert.match(upload, /XMLHttpRequest/)
  assert.match(upload, /setRequestHeader\('Content-Type', contentType\)/)
  assert.match(upload, /target\.put\.headers\['Content-Type'\]/)
})

test('a variant is only uploaded after the blob is checked as real WebP', () => {
  assert.match(upload, /image\/webp/)
  assert.match(upload, /isRealWebp\(blob\)/)
})
