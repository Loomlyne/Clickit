import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  assertClickitAccount,
  destinationKey,
  isMissingObject,
  parseOptions,
  wranglerEnv,
} from '../../scripts/copy-supabase-media-to-r2-wrangler.mjs'

const CLICKIT = 'e329b099b6e4272fc0915a99832e47fe'

test('destinationKey keeps the Worker layout <bucket>/<path>', () => {
  assert.equal(
    destinationKey('show-artwork', 'shows/abc/card-1.webp'),
    'show-artwork/shows/abc/card-1.webp'
  )
})

test('destinationKey rejects empty, absolute and traversal paths', () => {
  for (const [bucket, key] of [
    ['', 'a.png'],
    ['avatars', ''],
    ['avatars', '/a.png'],
    ['avatars', 'a/../b.png'],
    ['avatars', 'a/./b.png'],
    ['avatars', 'a//b.png'],
  ]) {
    assert.throws(() => destinationKey(bucket, key), /Invalid source object path/)
  }
})

test('isMissingObject matches only the wrangler [ERROR] line', () => {
  assert.equal(
    isMissingObject({
      stdout: 'Downloading "avatars/nope" from "clickit-media".',
      stderr: '\u001b[31m✘ \u001b[41;31m[\u001b[41;97mERROR\u001b[41;31m]\u001b[0m \u001b[1mThe specified key does not exist.\u001b[0m',
    }),
    true
  )
  assert.equal(isMissingObject({ stderr: '✘ [ERROR] A request to the Cloudflare API failed. [code: 10007]' }), true)
})

test('isMissingObject ignores the key in error.message and other errors', () => {
  const key = 'site-assets/not found 10007 does not exist.png'
  assert.equal(
    isMissingObject({ message: `Command failed: npx wrangler r2 object get clickit-media/${key}`, stderr: '', stdout: `Downloading "${key}"` }),
    false
  )
  assert.equal(isMissingObject({ stderr: '✘ [ERROR] fetch failed' }), false)
  assert.equal(isMissingObject(undefined), false)
})

test('wranglerEnv drops inherited credentials and pins the ClickitStory account', () => {
  const env = wranglerEnv({
    PATH: '/usr/bin',
    CLOUDFLARE_API_TOKEN: 'x',
    CLOUDFLARE_API_KEY: 'y',
    CLOUDFLARE_EMAIL: 'z',
    CLOUDFLARE_ACCOUNT_ID: 'vamos',
  })
  assert.equal(env.CLOUDFLARE_API_TOKEN, undefined)
  assert.equal(env.CLOUDFLARE_API_KEY, undefined)
  assert.equal(env.CLOUDFLARE_EMAIL, undefined)
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, CLICKIT)
  assert.equal(env.HOME, '/Users/koss/.clickit-cloudflare')
  assert.equal(env.PATH, '/usr/bin')
})

test('assertClickitAccount accepts only the ClickitStory account', () => {
  assertClickitAccount(`│ ClickitStory │ ${CLICKIT} │`)
  assert.throws(() => assertClickitAccount('no accounts'), /aborting/)
  assert.throws(
    () => assertClickitAccount(`│ ClickitStory │ ${CLICKIT} │\n│ Vamos │ ${'a'.repeat(32)} │`),
    /aborting/
  )
})

test('--refresh and --update-changed are refused outside their step', () => {
  assert.equal(parseOptions(['--refresh']).refresh, true)
  assert.throws(() => parseOptions(['--execute', '--refresh']), /--refresh only applies/)
  assert.throws(() => parseOptions(['--verify', '--refresh']), /--refresh only applies/)
  assert.throws(() => parseOptions(['--verify', '--update-changed']), /--update-changed only applies/)
  assert.equal(parseOptions(['--execute', '--update-changed']).updateChanged, true)
})
