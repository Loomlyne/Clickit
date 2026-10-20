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

test('uploadVideoDirect shares the PUT/progress path and sends no bytes to an action', () => {
  const start = upload.indexOf('export async function uploadVideoDirect')
  assert.ok(start > 0)
  const body = upload.slice(start)
  assert.match(body, /putWithProgress\(/)
  assert.match(body, /requestMediaUpload\(/)
  assert.match(body, /variantWidths: \[\]/)
  assert.match(body, /target\.put\.headers\['Content-Type'\]/)
  assert.equal(/new FormData\(|createImageBitmap|canvas|MediaRecorder|ffmpeg/i.test(body), false)
})

test('video texts are the signed ones (option M)', () => {
  assert.match(upload, /Upload an MP4 video\./)
  assert.match(
    upload,
    /This video is not fast-start\. Re-export it with "fast start" \(web optimised\) on, then upload again\. Nothing was saved\./
  )
  assert.match(upload, /MP4, fast-start, under 50MB/)
  assert.match(readFileSync('src/components/admin/upload-status.tsx', 'utf8'), /Checking fast-start…/)
})
