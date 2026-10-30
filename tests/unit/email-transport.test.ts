import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  EMAIL_FROM_DEFAULT,
  classifyResendResponse,
  createLocalMailer,
  createResendMailer,
} from '../../src/server/email/transport.ts'

const MESSAGE = {
  to: 'viewer-secret@example.com',
  subject: 'Welcome subject',
  html: '<p>HTML-BODY-MARKER</p>',
  text: 'TEXT-BODY-MARKER',
  replyTo: 'support@clickitstory.ae',
  headers: { 'List-Unsubscribe': '<https://example.com/u>' },
  idempotencyKey: 'welcome:abc',
}

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return respond()
  }) as typeof fetch
  return { impl, calls }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function assertNoLeak(result: unknown) {
  const text = JSON.stringify(result)
  for (const marker of [
    'viewer-secret@example.com',
    'HTML-BODY-MARKER',
    'TEXT-BODY-MARKER',
    'Welcome subject',
    're_test_key',
  ]) {
    assert.ok(!text.includes(marker), `result leaks ${marker}: ${text}`)
  }
}

test('default From is the clickitstory.ae no-reply address', () => {
  assert.equal(EMAIL_FROM_DEFAULT, 'Clickit Story <no-reply@clickitstory.ae>')
})

test('resend send: one POST with auth, idempotency key, body fields', async () => {
  const f = fakeFetch(() => json(200, { id: 'prov_123' }))
  const mailer = createResendMailer({ apiKey: 're_test_key', from: EMAIL_FROM_DEFAULT, fetch: f.impl })
  const result = await mailer.send(MESSAGE)
  assert.deepEqual(result, { kind: 'sent', providerId: 'prov_123' })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].url, 'https://api.resend.com/emails')
  assert.equal(f.calls[0].init.method, 'POST')
  const headers = new Headers(f.calls[0].init.headers)
  assert.equal(headers.get('authorization'), 'Bearer re_test_key')
  assert.equal(headers.get('idempotency-key'), 'welcome:abc')
  assert.equal(headers.get('content-type'), 'application/json')
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), {
    from: EMAIL_FROM_DEFAULT,
    to: ['viewer-secret@example.com'],
    subject: 'Welcome subject',
    html: '<p>HTML-BODY-MARKER</p>',
    text: 'TEXT-BODY-MARKER',
    reply_to: 'support@clickitstory.ae',
    headers: { 'List-Unsubscribe': '<https://example.com/u>' },
  })
  assertNoLeak(result)
})

test('resend send: optional fields are omitted when absent', async () => {
  const f = fakeFetch(() => json(200, { id: 'p' }))
  const mailer = createResendMailer({ apiKey: 're_test_key', from: 'A <a@b.c>', fetch: f.impl })
  await mailer.send({
    to: 'x@y.z',
    subject: 's',
    html: 'h',
    text: 't',
    idempotencyKey: 'k',
  })
  const body = JSON.parse(String(f.calls[0].init.body))
  assert.ok(!('reply_to' in body))
  assert.ok(!('headers' in body))
})

test('status classification', async () => {
  const cases: Array<[number, unknown, string | null, unknown]> = [
    [200, { id: 'p1' }, null, { kind: 'sent', providerId: 'p1' }],
    [429, { name: 'rate_limit_exceeded' }, '30', { kind: 'retry', retryAfterSec: 30, reason: 'rate_limited' }],
    [429, {}, null, { kind: 'retry', reason: 'rate_limited' }],
    [500, {}, null, { kind: 'retry', reason: 'server_error' }],
    [502, {}, null, { kind: 'retry', reason: 'server_error' }],
    [503, {}, null, { kind: 'retry', reason: 'server_error' }],
    [409, { name: 'invalid_idempotent_request' }, null, { kind: 'already_sent' }],
    [409, { name: 'concurrent_idempotent_requests' }, null, { kind: 'retry', reason: 'concurrent' }],
    [400, { name: 'validation_error' }, null, { kind: 'permanent', status: 400 }],
    [403, {}, null, { kind: 'permanent', status: 403 }],
    [422, {}, null, { kind: 'permanent', status: 422 }],
  ]
  for (const [status, body, retryAfter, expected] of cases) {
    assert.deepEqual(classifyResendResponse(status, body, retryAfter), expected, `status ${status}`)
  }
})

test('classification tolerates junk bodies and retry-after values', () => {
  assert.deepEqual(classifyResendResponse(409, null, null), { kind: 'permanent', status: 409 })
  assert.deepEqual(classifyResendResponse(409, 'text', null), { kind: 'permanent', status: 409 })
  assert.deepEqual(classifyResendResponse(200, {}, null), { kind: 'retry', reason: 'no_provider_id' })
  assert.deepEqual(classifyResendResponse(429, {}, 'soon'), { kind: 'retry', reason: 'rate_limited' })
  assert.deepEqual(classifyResendResponse(429, {}, '-5'), { kind: 'retry', reason: 'rate_limited' })
})

test('resend send over real Response objects: 429 retry-after, 5xx, 409', async () => {
  const run = async (res: Response) => {
    const f = fakeFetch(() => res)
    return createResendMailer({ apiKey: 're_test_key', from: EMAIL_FROM_DEFAULT, fetch: f.impl }).send(MESSAGE)
  }
  assert.deepEqual(await run(json(429, {}, { 'retry-after': '30' })), {
    kind: 'retry',
    retryAfterSec: 30,
    reason: 'rate_limited',
  })
  assert.equal((await run(json(503, {}))).kind, 'retry')
  assert.deepEqual(await run(json(409, { name: 'invalid_idempotent_request', message: 'HTML-BODY-MARKER' })), {
    kind: 'already_sent',
  })
  assert.deepEqual(await run(json(409, { name: 'concurrent_idempotent_requests' })), {
    kind: 'retry',
    reason: 'concurrent',
  })
  const permanent = await run(json(422, { message: 'viewer-secret@example.com is invalid' }))
  assert.deepEqual(permanent, { kind: 'permanent', status: 422 })
  assertNoLeak(permanent)
})

test('non-JSON error body does not crash and does not leak', async () => {
  const f = fakeFetch(() => new Response('<html>viewer-secret@example.com</html>', { status: 400 }))
  const result = await createResendMailer({ apiKey: 're_test_key', from: EMAIL_FROM_DEFAULT, fetch: f.impl }).send(MESSAGE)
  assert.deepEqual(result, { kind: 'permanent', status: 400 })
  assertNoLeak(result)
})

test('fetch throwing -> retry with reason network', async () => {
  const impl = (async () => {
    throw new Error('boom viewer-secret@example.com')
  }) as unknown as typeof fetch
  const result = await createResendMailer({ apiKey: 're_test_key', from: EMAIL_FROM_DEFAULT, fetch: impl }).send(MESSAGE)
  assert.deepEqual(result, { kind: 'retry', reason: 'network' })
  assertNoLeak(result)
})

test('missing api key -> retry not_configured, fetch never called', async () => {
  for (const apiKey of [undefined, '', '   ']) {
    const f = fakeFetch(() => json(200, { id: 'x' }))
    const mailer = createResendMailer({ apiKey, from: EMAIL_FROM_DEFAULT, fetch: f.impl })
    assert.deepEqual(await mailer.send(MESSAGE), { kind: 'retry', reason: 'not_configured' })
    assert.equal(f.calls.length, 0)
  }
})

test('local mailer refuses on workers', () => {
  assert.throws(() => createLocalMailer({ runtime: 'workers' }), /local mailer refused on workers/)
})

test('local mailer posts to Mailpit on node', async () => {
  const f = fakeFetch(() => json(200, { ID: 'mp_1' }))
  const mailer = createLocalMailer({ runtime: 'node', fetch: f.impl })
  const result = await mailer.send(MESSAGE)
  assert.deepEqual(result, { kind: 'sent', providerId: 'mp_1' })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].url, 'http://127.0.0.1:55324/api/v1/send')
  assert.equal(f.calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), {
    From: { Email: 'no-reply@clickitstory.ae', Name: 'Clickit Story' },
    To: [{ Email: 'viewer-secret@example.com' }],
    Subject: 'Welcome subject',
    HTML: '<p>HTML-BODY-MARKER</p>',
    Text: 'TEXT-BODY-MARKER',
    ReplyTo: [{ Email: 'support@clickitstory.ae' }],
    Headers: { 'List-Unsubscribe': '<https://example.com/u>' },
  })
  assertNoLeak(result)
})

test('local mailer: custom url, failure and network error stay classified', async () => {
  const f = fakeFetch(() => json(500, {}))
  const failed = await createLocalMailer({ runtime: 'node', mailpitUrl: 'http://127.0.0.1:9999/', fetch: f.impl }).send(MESSAGE)
  assert.equal(f.calls[0].url, 'http://127.0.0.1:9999/api/v1/send')
  assert.deepEqual(failed, { kind: 'retry', reason: 'local_unavailable' })

  const impl = (async () => {
    throw new Error('ECONNREFUSED')
  }) as unknown as typeof fetch
  assert.deepEqual(await createLocalMailer({ runtime: 'node', fetch: impl }).send(MESSAGE), {
    kind: 'retry',
    reason: 'local_unavailable',
  })
})
