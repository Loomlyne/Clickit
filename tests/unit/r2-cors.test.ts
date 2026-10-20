import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildR2CorsRules } from '../../scripts/cf/r2-cors.mjs'

const APP = 'https://clickit.example.workers.dev'
const WWW = 'https://www.clickitstory.ae'

test('happy path returns one nested wrangler rule with PUT only', () => {
  assert.deepEqual(buildR2CorsRules([APP, WWW]), {
    rules: [
      {
        allowed: {
          origins: [APP, WWW],
          methods: ['PUT'],
          headers: ['Content-Type'],
        },
        exposeHeaders: ['ETag'],
        maxAgeSeconds: 3600,
      },
    ],
  })
})

test('http origin is refused', () => {
  assert.throws(() => buildR2CorsRules(['http://127.0.0.1:8787']), /https/)
  assert.throws(() => buildR2CorsRules([APP, 'http://clickit.example.workers.dev']), /https/)
})

test('wildcard origin is refused', () => {
  assert.throws(() => buildR2CorsRules(['*']), /wildcard|\*/i)
  assert.throws(() => buildR2CorsRules(['https://*.workers.dev']), /wildcard|\*/i)
})

test('origin with a path, query or hash is refused', () => {
  assert.throws(() => buildR2CorsRules([`${APP}/en`]), /path/i)
  assert.throws(() => buildR2CorsRules([`${APP}/?a=1`]), /query|search/i)
  assert.throws(() => buildR2CorsRules([`${APP}/#x`]), /hash|fragment/i)
})

test('non-URL input is refused', () => {
  assert.throws(() => buildR2CorsRules(['not a url']), /origin/i)
  assert.throws(() => buildR2CorsRules([42 as unknown as string]), /origin/i)
})

test('empty list is refused', () => {
  assert.throws(() => buildR2CorsRules([]), /at least one/i)
  assert.throws(() => buildR2CorsRules(undefined as unknown as string[]), /at least one/i)
})

test('repeated and trailing-slash origins are de-duplicated, order kept', () => {
  const out = buildR2CorsRules([APP, `${APP}/`, WWW, APP])
  assert.deepEqual(out.rules[0].allowed.origins, [APP, WWW])
})

test('CLI prints JSON for valid origins and exits 1 for http', () => {
  const script = fileURLToPath(new URL('../../scripts/cf/r2-cors.mjs', import.meta.url))
  const ok = spawnSync(process.execPath, [script, '--app-origin', APP, '--app-origin', WWW], { encoding: 'utf8' })
  assert.equal(ok.status, 0)
  assert.deepEqual(JSON.parse(ok.stdout).rules[0].allowed.origins, [APP, WWW])
  const bad = spawnSync(process.execPath, [script, '--app-origin', 'http://127.0.0.1:8787'], { encoding: 'utf8' })
  assert.equal(bad.status, 1)
  assert.equal(bad.stdout, '')
  const none = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(none.status, 1)
})
