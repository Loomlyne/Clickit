// Locale root (/en, /ar) answers a real HTTP 308 to /<locale>/portfolio from the
// proxy (plan 02-21 CPU work, 2026-10-21). Before, the page's permanentRedirect()
// ran after streaming started: the Worker rendered the whole layout (117 KB on
// /en), the browser got 200 + a meta refresh and then rendered /portfolio again.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { localeRootTarget } from '../../src/server/locale-root.ts'

test('locale root maps to the portfolio landing', () => {
  assert.equal(localeRootTarget('/', 'en'), '/en/portfolio')
  assert.equal(localeRootTarget('/', 'ar'), '/ar/portfolio')
})

test('any other path is left alone', () => {
  for (const p of ['/portfolio', '/browse', '/auth', '/admin', '//', '/ ', '']) {
    assert.equal(localeRootTarget(p, 'en'), null, JSON.stringify(p))
  }
})

test('proxy sends the 308 after the coming-soon gate and before the auth gate', () => {
  const src = readFileSync('src/proxy.ts', 'utf8')
  const call = src.indexOf('localeRootTarget(pathWithoutLocale, locale)')
  assert.ok(call > 0, 'proxy calls localeRootTarget')
  assert.ok(call > src.indexOf('flags.comingSoonMode'), 'coming-soon gate runs first')
  assert.ok(call < src.indexOf('Step 5: Auth gate'), 'before the auth gate')
  assert.match(src.slice(call, call + 400), /redirectWithCookies\(url, intlResponse, 308\)/)
  assert.match(src, /NextResponse\.redirect\(url, status\)/)
})
