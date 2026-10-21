import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HIBP_TIMEOUT_MS, isPwned } from '../../src/server/auth/hibp.ts'

// SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = '5BAA6'
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'
const OTHER = '0018A45C4D1DEF81644B54AB7F969B88D65'

type Call = { url: string; init: RequestInit | undefined }

function fakeFetch(body: string, status = 200) {
  const calls: Call[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(body, { status })
  }) as typeof fetch
  return { impl, calls }
}

test('HIBP_TIMEOUT_MS is 3 seconds', () => {
  assert.equal(HIBP_TIMEOUT_MS, 3000)
})

test('suffix hit with a positive count -> true, prefix only on the wire', async () => {
  const f = fakeFetch(`${OTHER}:3\r\n${SUFFIX}:9545824\r\n`)
  assert.equal(await isPwned('password', f.impl), true)
  assert.equal(f.calls.length, 1)
  assert.ok(f.calls[0].url.endsWith(`/range/${PREFIX}`), f.calls[0].url)
  assert.ok(f.calls[0].url.startsWith('https://api.pwnedpasswords.com/range/'))
  const headers = new Headers(f.calls[0].init?.headers)
  assert.equal(headers.get('Add-Padding'), 'true')
})

test('the full password and the full hash never leave in the URL or headers', async () => {
  const f = fakeFetch(`${SUFFIX}:1`)
  await isPwned('password', f.impl)
  const sent = JSON.stringify({ url: f.calls[0].url, headers: [...new Headers(f.calls[0].init?.headers)] })
  assert.ok(!sent.includes('password'))
  assert.ok(!sent.toUpperCase().includes(SUFFIX))
  assert.ok(!sent.toUpperCase().includes(PREFIX + SUFFIX))
})

test('suffix match is case-insensitive', async () => {
  const f = fakeFetch(`${SUFFIX.toLowerCase()}:12`)
  assert.equal(await isPwned('password', f.impl), true)
})

test('no suffix in the body -> false', async () => {
  const f = fakeFetch(`${OTHER}:3\r\n0123456789ABCDEF0123456789ABCDEF012:7\r\n`)
  assert.equal(await isPwned('password', f.impl), false)
})

test('padded row with count 0 -> false', async () => {
  const f = fakeFetch(`${OTHER}:3\r\n${SUFFIX}:0\r\n`)
  assert.equal(await isPwned('password', f.impl), false)
})

test('fetch that resolves after the timeout -> null (fail open)', async () => {
  const slow = (async (_url: string | URL | Request, init?: RequestInit) => {
    await new Promise((r) => setTimeout(r, 200))
    if (init?.signal?.aborted) throw new Error('aborted')
    return new Response(`${SUFFIX}:1`)
  }) as typeof fetch
  assert.equal(await isPwned('password', slow, 20), null)
})

test('fetch that ignores the abort signal and resolves late -> null', async () => {
  const stubborn = (async () => {
    await new Promise((r) => setTimeout(r, 100))
    return new Response(`${SUFFIX}:1`)
  }) as typeof fetch
  assert.equal(await isPwned('password', stubborn, 20), null)
})

test('fetch rejects -> null', async () => {
  const boom = (async () => {
    throw new TypeError('network down')
  }) as typeof fetch
  assert.equal(await isPwned('password', boom), null)
})

test('status 503 -> null', async () => {
  const f = fakeFetch('unavailable', 503)
  assert.equal(await isPwned('password', f.impl), null)
})
