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

test('the admin guard keeps assertAdmin logic: signed in, app_config row 1, admin_user_id', () => {
  assert.match(guards, /\.eq\('id', 1\)/)
  assert.match(guards, /config\?\.admin_user_id !== user\.id/)
  assert.match(guards, /import 'server-only'/)
})
