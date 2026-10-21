import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkWhoamiOutput, checkEnv, wranglerChildEnv, CLICKIT_HOME } from '../../scripts/cf/wrangler-guard.mjs'

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

// ------------------------------------------------- other credential routes (review item 4)

const REFUSED_NAMES = [
  'CLOUDFLARE_API_TOKEN',
  'CF_API_TOKEN',
  'CLOUDFLARE_API_KEY',
  'CF_API_KEY',
  'CLOUDFLARE_EMAIL',
  'CF_EMAIL',
  'CLOUDFLARE_API_BASE_URL',
  'CF_API_BASE_URL',
  'XDG_CONFIG_HOME',
]

test('checkEnv refuses every other wrangler credential or config route, naming the variable', () => {
  for (const name of REFUSED_NAMES) {
    const res = checkEnv({ [name]: 'x' })
    assert.equal(res.ok, false, name)
    assert.ok(res.reason.includes(name), `${name}: ${res.reason}`)
    assert.ok(!res.reason.includes("'x'"), name)
  }
})

test('checkEnv ignores an empty value for a refused name', () => {
  for (const name of REFUSED_NAMES) assert.equal(checkEnv({ [name]: '' }).ok, true, name)
})

test('checkEnv refuses a deprecated CF_ACCOUNT_ID that is not ClickitStory', () => {
  assert.equal(checkEnv({ CF_ACCOUNT_ID: VAMOS }).ok, false)
  assert.equal(checkEnv({ CF_ACCOUNT_ID: CLICKIT }).ok, true)
})

test('wranglerChildEnv keeps only PATH and pins HOME; no credential or XDG variable passes', () => {
  const env = wranglerChildEnv({
    PATH: '/usr/bin',
    HOME: '/Users/someone',
    CLOUDFLARE_API_TOKEN: 't',
    CLOUDFLARE_API_KEY: 'k',
    CLOUDFLARE_EMAIL: 'e',
    XDG_CONFIG_HOME: '/x',
    CLOUDFLARE_ACCOUNT_ID: VAMOS,
  })
  assert.deepEqual(env, { PATH: '/usr/bin', HOME: CLICKIT_HOME, WRANGLER_SEND_METRICS: 'false' })
})

test('the guard CLI spawns wrangler whoami with wranglerChildEnv, not the parent env', () => {
  const src = readFileSync('scripts/cf/wrangler-guard.mjs', 'utf8')
  const main = src.slice(src.indexOf('function main('))
  assert.match(main, /env: wranglerChildEnv\(process\.env\)/)
  assert.equal(/\.\.\.process\.env/.test(main), false)
})

test('deploy.mjs uses the shared wranglerChildEnv for its wrangler children', () => {
  const src = readFileSync('scripts/cf/deploy.mjs', 'utf8')
  assert.match(src, /wranglerChildEnv\(process\.env\)/)
})

// ------------------------------- XDG_CONFIG_HOME only blocks remote work (PR #29 re-review item 4)
// A local preview build never talks to Cloudflare, and its wrangler children get
// wranglerChildEnv (no XDG) anyway; refusing XDG_CONFIG_HOME there only blocked builds.

test('checkEnv local mode allows XDG_CONFIG_HOME; remote mode and the default still refuse it', () => {
  assert.equal(checkEnv({ XDG_CONFIG_HOME: '/x' }, 'local').ok, true)
  const remote = checkEnv({ XDG_CONFIG_HOME: '/x' }, 'remote')
  assert.equal(remote.ok, false)
  assert.ok(remote.reason.includes('XDG_CONFIG_HOME'))
  assert.equal(checkEnv({ XDG_CONFIG_HOME: '/x' }).ok, false, 'default is the strict (remote) mode')
})

test('checkEnv local mode keeps every other refusal', () => {
  for (const name of REFUSED_NAMES.filter((n) => n !== 'XDG_CONFIG_HOME')) {
    const res = checkEnv({ [name]: 'x' }, 'local')
    assert.equal(res.ok, false, name)
    assert.ok(res.reason.includes(name), name)
  }
  assert.equal(checkEnv({ CLOUDFLARE_ACCOUNT_ID: VAMOS }, 'local').ok, false)
  assert.equal(checkEnv({ XDG_CONFIG_HOME: '/x', CLOUDFLARE_API_TOKEN: 't' }, 'local').reason.includes('XDG_CONFIG_HOME'), false)
})

test('checkEnv refuses an unknown mode', () => {
  assert.equal(checkEnv({}, 'preview' as never).ok, false)
})

test('callers: guard CLI passes its mode, preview build is local, workersdev build and deploys are remote', () => {
  const guard = readFileSync('scripts/cf/wrangler-guard.mjs', 'utf8')
  assert.match(guard.slice(guard.indexOf('function main(')), /checkEnv\(process\.env, mode\)/)
  const build = readFileSync('scripts/cf/build-target.mjs', 'utf8')
  assert.match(build, /checkEnv\(process\.env, target === 'preview' \? 'local' : 'remote'\)/)
  assert.match(readFileSync('scripts/cf/deploy.mjs', 'utf8'), /checkEnv\(process\.env, 'remote'\)/)
  assert.match(readFileSync('scripts/cf/deploy-guard.mjs', 'utf8'), /checkEnv\(processEnv \?\? \{\}, 'remote'\)/)
})
