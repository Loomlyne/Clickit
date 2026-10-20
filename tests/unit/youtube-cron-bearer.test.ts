// Constant-time Bearer check for GET /api/cron/youtube-recheck (PR #27 review,
// finding 1): SHA-256 of both sides, compared with timingSafeEqual.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { bearerMatches } from '../../src/server/youtube/bearer.ts'

const SECRET = 'cron-secret-for-tests'

test('the exact Bearer header passes', () => {
  assert.equal(bearerMatches(`Bearer ${SECRET}`, SECRET), true)
})

test('the secret is trimmed like process.env.CRON_SECRET?.trim()', () => {
  assert.equal(bearerMatches(`Bearer ${SECRET}`, `  ${SECRET}\n`), true)
})

test('missing secret or header fails', () => {
  assert.equal(bearerMatches(`Bearer ${SECRET}`, undefined), false)
  assert.equal(bearerMatches(`Bearer ${SECRET}`, null), false)
  assert.equal(bearerMatches(`Bearer ${SECRET}`, ''), false)
  assert.equal(bearerMatches(`Bearer ${SECRET}`, '   '), false)
  assert.equal(bearerMatches(null, SECRET), false)
  assert.equal(bearerMatches(undefined, SECRET), false)
  assert.equal(bearerMatches('', SECRET), false)
  // An empty secret never matches the header "Bearer " or "Bearer undefined".
  assert.equal(bearerMatches('Bearer ', ''), false)
  assert.equal(bearerMatches('Bearer undefined', undefined), false)
})

test('wrong, shorter, longer or differently cased headers fail', () => {
  for (const h of [
    `Bearer ${SECRET}x`,
    `Bearer ${SECRET.slice(0, -1)}`,
    `bearer ${SECRET}`,
    SECRET,
    `Bearer  ${SECRET}`,
    `Basic ${SECRET}`,
  ])
    assert.equal(bearerMatches(h, SECRET), false, h)
})

test('source hashes both sides with SHA-256 and compares with timingSafeEqual', () => {
  const src = readFileSync('src/server/youtube/bearer.ts', 'utf8')
  assert.match(src, /import \{ createHash, timingSafeEqual \} from 'node:crypto'/)
  assert.match(src, /createHash\('sha256'\)/)
  assert.match(src, /timingSafeEqual\(digest\(header\), digest\(`Bearer \$\{trimmed\}`\)\)/)
  const code = src.replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /header\s*[!=]==|[!=]==\s*header/)
})
