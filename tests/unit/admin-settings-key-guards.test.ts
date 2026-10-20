// Source-scan guards for the editable YouTube key (06-16, G6, T-06-61..64):
// both key actions run through the one YouTube admin seam, the old plaintext
// write path is gone, Server Actions keep Next's same-origin check, and the
// key never travels back to the browser.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('src/app/[locale]/admin/actions.ts', 'utf8')

// Same block parser as admin-actions-id-coverage.test.ts.
function block(name: string): string {
  const re = /export async function (\w+)\(/g
  const starts: Array<{ name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(actions))) starts.push({ name: m[1]!, index: m.index })
  const i = starts.findIndex((s) => s.name === name)
  assert.ok(i !== -1, `${name} not found in actions.ts`)
  return actions.slice(starts[i]!.index, starts[i + 1]?.index ?? actions.length)
}

test('saveYouTubeApiKey and testYouTubeKey run through runAdminAction(youtubeAdminEnv)', () => {
  assert.match(actions, /export async function saveYouTubeApiKey\(/)
  assert.match(actions, /export async function testYouTubeKey\(/)
  const save = block('saveYouTubeApiKey')
  assert.ok(save.includes('runAdminAction(youtubeAdminEnv'), 'save lacks the seam')
  assert.ok(save.includes('saveYouTubeApiKeyCore('), 'save lacks its core')
  const testKey = block('testYouTubeKey')
  assert.ok(testKey.includes('runAdminAction(youtubeAdminEnv'), 'test lacks the seam')
  assert.ok(testKey.includes('testYouTubeKeyCore('), 'test lacks its core')
  assert.ok(testKey.includes('getServerYouTubeClient('), 'test does not read the key on this request')
})

test('no youtube_api_key anywhere in actions.ts (old plaintext write path removed)', () => {
  assert.equal(actions.includes('youtube_api_key'), false)
})

test('saveYouTubeApiKey logs nothing and its revalidate never mentions the input', () => {
  const save = block('saveYouTubeApiKey')
  assert.equal(save.includes('console.'), false)
  const param = save.match(/export async function saveYouTubeApiKey\(\s*(\w+)/)?.[1]
  assert.ok(param, 'saveYouTubeApiKey has no input parameter')
  const reval = save.slice(save.indexOf('revalidate:'))
  assert.ok(save.includes('revalidate:'), 'save does not revalidate')
  assert.equal(new RegExp(`\\b${param}\\b`).test(reval), false, 'revalidate mentions the input')
})

test('next.config adds no serverActions.allowedOrigins (same-origin check stays the CSRF guard)', () => {
  const configs = readdirSync('.').filter((f) => /^next\.config\./.test(f))
  assert.ok(configs.length > 0, 'no next.config found')
  for (const f of configs) {
    const text = readFileSync(f, 'utf8')
    assert.equal(text.includes('allowedOrigins'), false, `${f} widens allowedOrigins`)
  }
})
