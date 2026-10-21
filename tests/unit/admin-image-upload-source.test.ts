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

test('the old FormData actions are gone (plan 02-19)', () => {
  for (const name of ['uploadArtwork', 'uploadSiteImage', 'uploadSocialIcon', 'uploadCastImage']) {
    assert.ok(!admin.includes(`export async function ${name}(`), `${name} is back`)
  }
  assert.ok(!profile.includes('export async function uploadAvatar('))
})

test('the 01.1 guards live on the finalize path: SVG refusal in finalize, strict audit writer in the ports', () => {
  assert.ok(admin.includes('audit: logAuditStrict'))
  const finalize = readFileSync('src/server/upload-finalize.ts', 'utf8')
  assert.ok(finalize.includes('SVG_REJECTED_MESSAGE'))
})

test('artwork columns map every upload slot to a distinct shows column', () => {
  const m = /const ARTWORK_COLUMN = \{([\s\S]*?)\} as const/.exec(admin)
  assert.ok(m)
  const cols = [...m[1]!.matchAll(/:\s*'([a-z_]+)'/g)].map((x) => x[1])
  assert.deepEqual(cols, ['poster_url', 'card_image_url', 'hero_url', 'hero_image_mobile_url', 'logo_url'])
})

test('every image finalize names the scope where its key could already be live (01.1 review)', () => {
  const scopes: Record<string, RegExp> = {
    finalizeArtworkUpload: /live: \{ type: 'show-artwork', showId, columns: ARTWORK_COLUMNS \}/,
    finalizeSiteImageUpload: /live: \{ type: 'app-config', columns: SITE_IMAGE_COLUMNS \}/,
    finalizeSocialIconUpload: /live: \{ type: 'social-icons' \}/,
    finalizeCastImageUpload: /live: \{ type: 'show-cast', showId \}/,
  }
  for (const [name, re] of Object.entries(scopes)) assert.match(body(admin, name), re, name)
  const avatar = body(profile, 'finalizeAvatarUpload')
  assert.match(avatar, /live: \{ type: 'profile', userId \}/)
  assert.ok(avatar.includes('readLive'))
  // The finalize gate gets the live keys too, on both port builders.
  assert.ok(avatar.includes('liveKeys: i.liveKeys'))
  assert.ok(admin.includes('liveKeys: input.liveKeys'))
  assert.ok(admin.includes('liveKeys: (url) => liveKeysForUrl(url, mediaOrigin)'))
  assert.ok(avatar.includes('liveKeys: (url) => liveKeysForUrl(url, mediaOrigin)'))
})
