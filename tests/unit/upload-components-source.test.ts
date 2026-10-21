import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (p: string) => readFileSync(p, 'utf8')

const FILES: Array<{ path: string; finalize: string }> = [
  { path: 'src/components/admin/artwork-upload-zone.tsx', finalize: 'finalizeArtworkUpload' },
  { path: 'src/components/admin/hero-media-picker.tsx', finalize: 'finalizeArtworkUpload' },
  { path: 'src/components/admin/cast-editor.tsx', finalize: 'finalizeCastImageUpload' },
  { path: 'src/components/admin/settings/image-upload-field.tsx', finalize: 'finalizeSiteImageUpload' },
  { path: 'src/components/admin/settings/footer-editor.tsx', finalize: 'finalizeSocialIconUpload' },
  { path: 'src/components/profile/avatar-upload.tsx', finalize: 'finalizeAvatarUpload' },
]

for (const { path, finalize } of FILES) {
  test(`${path} uploads browser -> R2 -> ${finalize}`, () => {
    const src = read(path)
    assert.match(src, /uploadImageDirect/)
    assert.match(src, new RegExp(finalize))
    assert.equal(/uploadArtwork|uploadCastImage|uploadSiteImage|uploadSocialIcon|uploadAvatar/.test(src), false)
    assert.equal(/formData\.(set|append)\(['"](file|avatar)['"]|fd\.set\('file'/.test(src), false)
  })
}

test('artwork drawer and hero picker keep "upload then Save" (commit: false)', () => {
  assert.match(read('src/components/admin/artwork-upload-zone.tsx'), /commit: false/)
  assert.match(read('src/components/admin/hero-media-picker.tsx'), /finalizeArtworkUpload\(\{[^}]*commit: false/)
})

test('upload zone texts are the signed ones', () => {
  const status = read('src/components/admin/upload-status.tsx')
  assert.match(status, /Saving…/)
  assert.match(status, /label: 'Retry'/)
  assert.match(status, /minHeight: '44px'/)
  assert.match(status, /prefers-reduced-motion: reduce/)
  const up = read('src/lib/browser-upload.ts')
  assert.match(up, /Upload stopped: the connection dropped or the upload link expired\. Nothing was saved\./)
  assert.match(up, /The file did not match its type and was removed\. Nothing was saved\./)
  assert.match(up, /This browser cannot make WebP copies; the original will be used\./)
})

const VIDEO_FILES: Array<{ path: string; finalize: string; kind: string }> = [
  { path: 'src/components/admin/hero-video-manager.tsx', finalize: 'finalizeHeroVideoUpload', kind: 'hero-video' },
  { path: 'src/components/admin/settings/preloader-video-field.tsx', finalize: 'finalizePreloaderVideoUpload', kind: 'preloader-video' },
  { path: 'src/components/admin/hero-media-picker.tsx', finalize: 'finalizeShowVideoUpload', kind: 'show-video' },
]

for (const { path, finalize, kind } of VIDEO_FILES) {
  test(`${path} uploads video browser -> R2 -> ${finalize}`, () => {
    const src = read(path)
    assert.match(src, /uploadVideoDirect/)
    assert.match(src, new RegExp(`kind: '${kind}'`))
    assert.match(src, new RegExp(finalize))
    assert.match(src, /<UploadStatus/)
    assert.match(src, /UPLOAD_MESSAGES\.videoHint/)
    assert.equal(
      /createHeroVideoUpload|saveHeroVideoUpload|createPreloaderVideoUpload|savePreloaderVideoUpload|createShowVideoUpload|saveShowVideoUpload|uploadToSignedUrl|supabase\/client/.test(src),
      false
    )
  })
}

test('the show drawer keeps "upload then Save" for videos (commit: false)', () => {
  assert.match(read('src/components/admin/hero-media-picker.tsx'), /finalizeShowVideoUpload\(\{[^}]*commit: false/)
})
