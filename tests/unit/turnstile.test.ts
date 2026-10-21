import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyTurnstileToken, TURNSTILE_SITEVERIFY_URL } from '../../src/server/turnstile.ts'

const SECRET = '2x0000000000000000000000000000000AA-test-secret'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

type FetchCall = { url: string; init: RequestInit }
function fakeFetch(reply: () => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return reply()
  }
  return { calls, impl: impl as unknown as typeof fetch }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('siteverify URL is the Cloudflare endpoint', () => {
  assert.equal(TURNSTILE_SITEVERIFY_URL, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
})

test('success:true is ok, and the POST carries secret, response and remoteip', async () => {
  const { calls, impl } = fakeFetch(() => json({ success: true, 'error-codes': [] }))
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: '203.0.113.5', fetchImpl: impl })
  assert.deepEqual(res, { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, TURNSTILE_SITEVERIFY_URL)
  assert.equal(calls[0].init.method, 'POST')
  const body = new URLSearchParams(String(calls[0].init.body))
  assert.equal(body.get('secret'), SECRET)
  assert.equal(body.get('response'), TOKEN)
  assert.equal(body.get('remoteip'), '203.0.113.5')
})

test('remoteip is omitted when no ip is known', async () => {
  const { calls, impl } = fakeFetch(() => json({ success: true }))
  await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })
  assert.equal(new URLSearchParams(String(calls[0].init.body)).has('remoteip'), false)
})

test('success:false is refused and the reason includes the first error code', async () => {
  const { impl } = fakeFetch(() => json({ success: false, 'error-codes': ['invalid-input-response', 'timeout-or-duplicate'] }))
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: '203.0.113.5', fetchImpl: impl })
  assert.equal(res.ok, false)
  assert.match((res as { reason: string }).reason, /invalid-input-response/)
})

test('success:false without error codes is still refused', async () => {
  const { impl } = fakeFetch(() => json({ success: false }))
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })
  assert.equal(res.ok, false)
})

test('a truthy non-true success value is refused', async () => {
  const { impl } = fakeFetch(() => json({ success: 'true' }))
  assert.equal((await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })).ok, false)
})

test('HTTP 500 is refused', async () => {
  const { impl } = fakeFetch(() => json({ success: true }, 500))
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })
  assert.equal(res.ok, false)
  assert.match((res as { reason: string }).reason, /500|http/i)
})

test('a non-JSON body is refused', async () => {
  const { impl } = fakeFetch(() => new Response('<html>oops</html>', { status: 200 }))
  assert.equal((await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })).ok, false)
})

test('fetch rejecting is refused and the reason never contains the secret or token', async () => {
  const impl = (async () => {
    throw new Error(`connect failed for secret=${SECRET} response=${TOKEN}`)
  }) as unknown as typeof fetch
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })
  assert.equal(res.ok, false)
  const reason = (res as { reason: string }).reason
  assert.equal(reason.includes(SECRET), false)
  assert.equal(reason.includes(TOKEN), false)
})

test('a request slower than timeoutMs is aborted and refused', async () => {
  let aborted = false
  const impl = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('aborted', 'AbortError'))
      })
    })) as unknown as typeof fetch
  const res = await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl, timeoutMs: 20 })
  assert.equal(res.ok, false)
  assert.equal(aborted, true)
  assert.match((res as { reason: string }).reason, /timeout/i)
})

test('the default timeout is 5000 ms (a signal is passed to fetch)', async () => {
  const { calls, impl } = fakeFetch(() => json({ success: true }))
  await verifyTurnstileToken({ token: TOKEN, secret: SECRET, ip: null, fetchImpl: impl })
  assert.ok(calls[0].init.signal instanceof AbortSignal)
})

test('missing or blank secret is refused without calling fetch', async () => {
  for (const secret of [undefined, '', '   ']) {
    const { calls, impl } = fakeFetch(() => json({ success: true }))
    const res = await verifyTurnstileToken({ token: TOKEN, secret, ip: null, fetchImpl: impl })
    assert.equal(res.ok, false)
    assert.equal(calls.length, 0)
  }
})

test('missing, empty or oversized token is refused without calling fetch', async () => {
  for (const token of [undefined, null, '', '   ', 'a'.repeat(2049)]) {
    const { calls, impl } = fakeFetch(() => json({ success: true }))
    const res = await verifyTurnstileToken({ token, secret: SECRET, ip: null, fetchImpl: impl })
    assert.equal(res.ok, false)
    assert.equal(calls.length, 0)
  }
})

test('a 2048-character token is still sent', async () => {
  const { calls, impl } = fakeFetch(() => json({ success: true }))
  const res = await verifyTurnstileToken({ token: 'a'.repeat(2048), secret: SECRET, ip: null, fetchImpl: impl })
  assert.equal(res.ok, true)
  assert.equal(calls.length, 1)
})
