// Worker bundle budget parser and threshold (05-19, controller condition 3).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUDGET_GZIP_KIB, checkBudget, parseUploadSize } from '../../scripts/cf/bundle-budget.mjs'

test('parses the wrangler dry-run size line (KiB and MiB), last one wins', () => {
  assert.deepEqual(parseUploadSize('Total Upload: 14433.11 KiB / gzip: 2949.63 KiB'), {
    totalKiB: 14433.11,
    gzipKiB: 2949.63,
  })
  assert.deepEqual(parseUploadSize('x\nTotal Upload: 1.5 MiB / gzip: 512 KiB\nTotal Upload: 14.1 MiB / gzip: 2.9 MiB\n'), {
    totalKiB: 14438.4,
    gzipKiB: 2969.6,
  })
  assert.equal(parseUploadSize('Uploaded clickit (3.2 sec)'), null)
})

test('budget is 3,000 KiB gzip, inclusive', () => {
  assert.equal(BUDGET_GZIP_KIB, 3000)
  assert.equal(checkBudget({ totalKiB: 14000, gzipKiB: 2949.63 }).ok, true)
  assert.equal(checkBudget({ totalKiB: 14000, gzipKiB: 3000 }).ok, true)
  const over = checkBudget({ totalKiB: 14000, gzipKiB: 3000.01 })
  assert.equal(over.ok, false)
  assert.match(over.line, /^bundle-budget FAIL gzip=3000\.01 KiB .* over=0\.01 KiB$/)
  assert.equal(checkBudget(null).ok, false)
})

test('gate:local runs the budget right after cf:build', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
  assert.match(pkg.scripts['gate:local']!, /npm run cf:build && npm run cf:bundle-budget$/)
  assert.match(pkg.scripts['cf:bundle-budget']!, /^HOME=\/Users\/koss\/\.clickit-cloudflare node scripts\/cf\/bundle-budget\.mjs$/)
})

test('the budget runs the repo wrangler, never npx', () => {
  const src = readFileSync('scripts/cf/bundle-budget.mjs', 'utf8')
  assert.ok(src.includes("node_modules/.bin/wrangler"))
  assert.doesNotMatch(src, /spawnSync\(\s*'npx'/)
})
