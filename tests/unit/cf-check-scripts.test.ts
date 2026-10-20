import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error plain .mjs without types
import * as gates from '../../scripts/cf/check-gates.mjs'
// @ts-expect-error plain .mjs without types
import * as reval from '../../scripts/cf/check-revalidate.mjs'

test('check-gates parseArgs reads every flag', () => {
  const o = gates.parseArgs(['--base', 'http://x', '--admin-cookie-file', 'a', '--viewer-cookie-file', 'v', '--expect-coming-soon'])
  assert.deepEqual(o, { base: 'http://x', adminCookieFile: 'a', viewerCookieFile: 'v', expectComingSoon: true, help: false })
})

test('check-gates parseArgs rejects unknown flags and missing values', () => {
  assert.throws(() => gates.parseArgs(['--nope']))
  assert.throws(() => gates.parseArgs(['--base']))
  assert.throws(() => gates.parseArgs(['--base', '--help']))
})

test('check-gates normalizeBase keeps only the origin and refuses non-http', () => {
  assert.equal(gates.normalizeBase('https://x.workers.dev/en/'), 'https://x.workers.dev')
  assert.throws(() => gates.normalizeBase('ftp://x'))
  assert.throws(() => gates.normalizeBase('nope'))
})

test('check-gates redirectPath resolves relative and absolute Locations', () => {
  assert.equal(gates.redirectPath(307, '/en/auth?next=/profile', 'http://h'), '/en/auth')
  assert.equal(gates.redirectPath(302, 'http://h/ar', 'http://h'), '/ar')
  assert.equal(gates.redirectPath(200, '/en', 'http://h'), null)
  assert.equal(gates.redirectPath(307, null, 'http://h'), null)
})

test('check-revalidate accepts only the exact local Supabase URL', () => {
  assert.equal(reval.isLocalSupabaseUrl('http://127.0.0.1:55321'), true)
  assert.equal(reval.isLocalSupabaseUrl('http://127.0.0.1:55321/'), true)
  for (const bad of [
    'https://lajguozmtissnnfccmej.supabase.co',
    'http://127.0.0.1:54321',
    'http://localhost:55321',
    'http://127.0.0.1:55321.evil.com',
    'http://127.0.0.1:55321@evil.com',
    '',
    undefined,
  ]) {
    assert.equal(reval.isLocalSupabaseUrl(bad), false, String(bad))
  }
})

test('check-revalidate REST mode refuses a live URL before touching the network', async () => {
  const saved = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    throw new Error('network must not be used')
  }) as typeof fetch
  try {
    await assert.rejects(
      reval.run({ base: 'http://127.0.0.1:8787', supabaseUrl: 'https://lajguozmtissnnfccmej.supabase.co', viaAdminAction: false }, () => {}),
      /local only/,
    )
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = saved
  }
})

test('check-revalidate via-admin-action needs --expect', async () => {
  await assert.rejects(reval.run({ base: 'http://127.0.0.1:8787', viaAdminAction: true }, () => {}), /--expect/)
})

test('check-revalidate parseArgs reads the via-admin-action options', () => {
  const o = reval.parseArgs(['--via-admin-action', '--base', 'http://x', '--path', '/en/series/a', '--expect', 'T', '--cookie-file', 'c'])
  assert.equal(o.viaAdminAction, true)
  assert.equal(o.path, '/en/series/a')
  assert.equal(o.expect, 'T')
  assert.equal(o.cookieFile, 'c')
})
