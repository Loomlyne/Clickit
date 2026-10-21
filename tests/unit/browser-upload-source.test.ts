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
  assert.match(body, /variants: \[\]/)
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

// ------------------------------------------- presign hardening (review item 2)

test('the request declares the file size and each copy size; the PUT body must match the signed size', () => {
  assert.match(upload, /size: file\.size/)
  assert.match(upload, /variants: made\.variants\.map\(\(v\) => \(\{ width: v\.width, size: v\.blob\.size \}\)\)/)
  assert.match(upload, /file\.size !== target\.put\.contentLength/)
  assert.match(upload, /blob\.size !== variant\.put\.contentLength/)
  assert.ok(!/variantWidths/.test(upload))
})

test('copies start with the original, not after it (the links live 60 s)', () => {
  const start = upload.indexOf('export async function uploadImageDirect')
  const body = upload.slice(start, upload.indexOf('export type VideoUploadKind'))
  const copiesAt = body.indexOf('target.variants.map(')
  const originalAt = body.indexOf('await putWithProgress(')
  assert.ok(copiesAt > 0 && copiesAt < originalAt, 'copy PUTs are started before the original is awaited')
})

test('a rate-limited request is reported as unavailable, not as a wrong type', () => {
  assert.match(upload, /\/not available\|too many\/i/)
})
