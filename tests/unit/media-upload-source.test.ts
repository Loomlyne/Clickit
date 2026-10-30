import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Source-level invariants for the upload surface (T-02-52, T-02-56, T-02-58).
// The action and route import next/* and server-only, so node --test cannot run
// them; their logic lives in the pure modules tested elsewhere.
const action = readFileSync('src/app/actions/media-upload.ts', 'utf8')
const route = readFileSync('src/app/api/dev/r2-put/[...key]/route.ts', 'utf8')
const guards = readFileSync('src/server/auth-guards.ts', 'utf8')

test('requestMediaUpload checks the session before the type check, per actor', () => {
  assert.match(action, /def\.actor === 'admin' \? await requireAdminUser\(\) : await requireSignedInUser\(\)/)
  const guardAt = action.indexOf('requireAdminUser()')
  const checkAt = action.indexOf('checkUploadRequest({')
  const presignAt = action.indexOf('presignPut(')
  assert.ok(guardAt > 0 && guardAt < checkAt && checkAt < presignAt)
})

test('the action never reads file bytes and never trusts a user id from input', () => {
  assert.ok(!/arrayBuffer\(\)|formData|\.get\('file'\)|new File\(|Blob\(/.test(action))
  assert.ok(!/userId:\s*req\./.test(action))
  assert.match(action, /\.max\(MAX_VARIANT_URLS_PER_CALL\)/)
})

test('the action returns URLs only, never credentials', () => {
  assert.ok(!/return[^\n]*R2_SECRET_ACCESS_KEY|data:[^\n]*R2_/.test(action))
})

test('the shim route delegates to checkShimRequest before any write', () => {
  assert.ok(route.indexOf('checkShimRequest(') > 0)
  assert.ok(route.indexOf('checkShimRequest(') < route.indexOf('MEDIA.put('))
  assert.match(route, /export const dynamic = 'force-dynamic'/)
  assert.match(route, /export async function PUT/)
  assert.ok(!/export async function (GET|POST|DELETE|PATCH)/.test(route))
})

// 05-15 (D-17): the admin guard is requireAdmin (admins row + fresh TOTP), not app_config.
test('the admin guard is requireAdmin: admins row lookup, never app_config', () => {
  assert.match(guards, /export async function requireAdminUser\(\)[\s\S]*?\(await requireAdmin\(\)\)\.id/)
  assert.match(guards, /from\('admins'\)/)
  assert.ok(!guards.includes('admin_user_id'))
  assert.match(guards, /import 'server-only'/)
})

// ------------------------------------------- presign hardening (review item 2)

test('requestMediaUpload rate-limits per signed-in user after the checks and before signing', () => {
  const limitAt = action.indexOf('allowMediaPresign(')
  assert.ok(limitAt > action.indexOf('checkUploadRequest({'), 'after the request checks')
  assert.ok(limitAt < action.indexOf('mintUploadKey('), 'before a key is minted')
  assert.ok(limitAt < action.indexOf('presignPut('), 'before signing')
  assert.match(action, /allowMediaPresign\(\{\s*userId,/)
  assert.match(action, /supabaseRateLimitStore\(createAdminClient\(\)\)/)
})

test('requestMediaUpload signs the declared size: the original with req.size, variants with their checked sizes', () => {
  assert.match(action, /sign\(key, checked\.contentType, req\.size\)/)
  assert.match(action, /planVariantUploads\(\{/)
  assert.match(action, /contentLength,/)
  assert.ok(!/variantWidths/.test(action), 'variantWidths is replaced by variants with sizes')
})

test('the shim token binds the size and the route compares it with Content-Length', () => {
  assert.match(action, /mintShimToken\(objectKey, contentType, contentLength, secret\)/)
  assert.match(route, /contentLength: length/)
  assert.ok(route.indexOf("headers.get('content-length')") < route.indexOf('checkShimRequest('))
  assert.match(route, /body\.byteLength !== length/)
})
