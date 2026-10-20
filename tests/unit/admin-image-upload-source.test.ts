import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const admin = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')
const profile = readFileSync('src/app/[locale]/(viewer)/profile/actions.ts', 'utf8')

function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  assert.ok(start >= 0, `${name} not found`)
  const next = src.indexOf('\nexport async function ', start + 10)
  return src.slice(start, next === -1 ? src.length : next)
}

const ADMIN_FINALIZERS = [
  'finalizeArtworkUpload',
  'finalizeSiteImageUpload',
  'finalizeSocialIconUpload',
  'finalizeCastImageUpload',
]

test('admin finalize actions run through runAdminAction and the core, and take no file body', () => {
  for (const name of ADMIN_FINALIZERS) {
    const b = body(admin, name)
    assert.ok(b.includes('runAdminAction('), `${name} must use runAdminAction`)
    assert.ok(b.includes('finalizeImageUploadCore('), `${name} must call the core`)
    assert.ok(!/FormData|\bFile\b|\bBlob\b|arrayBuffer/.test(b), `${name} must not take a file body`)
  }
})

test('the avatar finalize checks the signed-in user, takes no file body, and writes via the core', () => {
  const b = body(profile, 'finalizeAvatarUpload')
  assert.ok(b.indexOf('requireSignedInUser(') < b.indexOf('finalizeImageUploadCore('))
  assert.ok(b.includes("type: 'profile', userId"), 'target is the caller\'s own profile')
  assert.ok(!/FormData|\bFile\b|\bBlob\b|arrayBuffer/.test(b))
  // The owner id comes from the session, never from the input.
  assert.ok(!/input\.userId|parsed\.data\.userId/.test(b))
})

test('the old FormData actions still exist until plan 02-19', () => {
  for (const name of ['uploadArtwork', 'uploadSiteImage', 'uploadSocialIcon', 'uploadCastImage']) {
    assert.ok(admin.includes(`export async function ${name}(`), `${name} removed too early`)
  }
  assert.ok(profile.includes('export async function uploadAvatar('))
})

test('the 01.1 guards stay on the old paths: SVG refusal and the strict audit writer', () => {
  assert.ok(admin.includes('checkImageUpload({'))
  assert.ok(admin.includes('audit: logAuditStrict'))
})

test('artwork columns map every upload slot to a distinct shows column', () => {
  const m = /const ARTWORK_COLUMN = \{([\s\S]*?)\} as const/.exec(admin)
  assert.ok(m)
  const cols = [...m[1]!.matchAll(/:\s*'([a-z_]+)'/g)].map((x) => x[1])
  assert.deepEqual(cols, ['poster_url', 'card_image_url', 'hero_url', 'hero_image_mobile_url', 'logo_url'])
})
