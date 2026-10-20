import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkWhoamiOutput, checkEnv } from '../../scripts/cf/wrangler-guard.mjs'

const CLICKIT = 'e329b099b6e4272fc0915a99832e47fe'
const VAMOS = '0123456789abcdef0123456789abcdef'

const clickitOnly = `Getting User settings...
 ⛅️ wrangler 4.151.2
Account Name | Account ID
ClickitStory | ${CLICKIT}`

const notAuthenticated = `You are not authenticated. Please run \`wrangler login\`.`

test('ClickitStory-only output passes remote', () => {
  assert.equal(checkWhoamiOutput(clickitOnly, 'remote').ok, true)
})

test('ClickitStory-only output passes local', () => {
  assert.equal(checkWhoamiOutput(clickitOnly, 'local').ok, true)
})

test('Vamos-style different id fails remote and local', () => {
  const text = `Account Name | Account ID\nVamos | ${VAMOS}`
  assert.equal(checkWhoamiOutput(text, 'remote').ok, false)
  assert.equal(checkWhoamiOutput(text, 'local').ok, false)
})

test('ClickitStory plus another id fails in both modes', () => {
  const text = `${clickitOnly}\nVamos | ${VAMOS}`
  assert.equal(checkWhoamiOutput(text, 'remote').ok, false)
  assert.equal(checkWhoamiOutput(text, 'local').ok, false)
})

test('not-authenticated passes local and fails remote', () => {
  assert.equal(checkWhoamiOutput(notAuthenticated, 'local').ok, true)
  assert.equal(checkWhoamiOutput(notAuthenticated, 'remote').ok, false)
})

test('unrelated output fails local', () => {
  assert.equal(checkWhoamiOutput('something else entirely', 'local').ok, false)
})

test('CLOUDFLARE_API_TOKEN set fails', () => {
  assert.equal(checkEnv({ CLOUDFLARE_API_TOKEN: 'x' }).ok, false)
})

test('CLOUDFLARE_ACCOUNT_ID mismatch fails, match and unset pass', () => {
  assert.equal(checkEnv({ CLOUDFLARE_ACCOUNT_ID: VAMOS }).ok, false)
  assert.equal(checkEnv({ CLOUDFLARE_ACCOUNT_ID: CLICKIT }).ok, true)
  assert.equal(checkEnv({}).ok, true)
})
