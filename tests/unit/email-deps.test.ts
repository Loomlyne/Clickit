import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEmailDeps,
  newsletterConfirmUrlFor,
  unsubscribeUrlFor,
} from '../../src/server/email/deps.ts'
import { verifyLinkToken } from '../../src/server/email/links.ts'

const USER = '22222222-2222-4222-8222-222222222222'
const SECRET = 'test-link-secret-not-real'
const ORIGIN = 'https://www.clickitstory.ae'

type Call = { url: string; init: RequestInit }

function fakeFetch(responses: Record<string, unknown>) {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: init ?? {} })
    for (const [suffix, body] of Object.entries(responses)) {
      if (url.endsWith(suffix)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
    return new Response(JSON.stringify({ ID: 'mp_1', id: 're_1' }), { status: 200 })
  }) as typeof fetch
  return { impl, calls }
}

test('unsubscribeUrlFor signs an unsub_digest token with no expiry', async () => {
  const url = await unsubscribeUrlFor(ORIGIN, USER, SECRET)
  assert.ok(url.startsWith(`${ORIGIN}/api/email/unsubscribe?t=`))
  const token = new URL(url).searchParams.get('t') as string
  assert.deepEqual(await verifyLinkToken(token, 'unsub_digest', SECRET, 4_000_000_000), { ok: true, id: USER })
  assert.equal((await verifyLinkToken(token, 'newsletter_confirm', SECRET, 1)).ok, false)
})

test('newsletterConfirmUrlFor is locale-prefixed and expires in 7 days', async () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 0)
  const url = await newsletterConfirmUrlFor(`${ORIGIN}/`, 'ar', USER, SECRET, now)
  assert.ok(url.startsWith(`${ORIGIN}/ar/newsletter/confirm?t=`))
  const token = new URL(url).searchParams.get('t') as string
  const nowSec = Math.floor(now / 1000)
  assert.deepEqual(await verifyLinkToken(token, 'newsletter_confirm', SECRET, nowSec + 7 * 86400 - 5), {
    ok: true,
    id: USER,
  })
  assert.deepEqual(await verifyLinkToken(token, 'newsletter_confirm', SECRET, nowSec + 7 * 86400 + 5), {
    ok: false,
    reason: 'expired',
  })
})

test('missing link secret throws "link secret missing"', async () => {
  await assert.rejects(() => unsubscribeUrlFor(ORIGIN, USER, undefined), /link secret missing/)
  await assert.rejects(() => newsletterConfirmUrlFor(ORIGIN, 'en', USER, '', 0), /link secret missing/)
})

test('claim and finish post to the PostgREST rpc urls with the service key', async () => {
  const f = fakeFetch({ '/rpc/claim_outbox': [{ id: 'x' }], '/rpc/finish_outbox': 1 })
  const deps = buildEmailDeps(
    {
      CLICKIT_RUNTIME: 'workers',
      SUPABASE_URL: 'https://proj.supabase.co/',
      SUPABASE_SERVICE_ROLE_KEY: 'svc-key',
      RESEND_API_KEY: 're_key',
    },
    f.impl,
  )
  const rows = await deps.claimOutbox(['a', 'b'])
  assert.deepEqual(rows, [{ id: 'x' }])
  await deps.finishOutbox([{ id: 'a', status: 'sent' }])
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[0].url, 'https://proj.supabase.co/rest/v1/rpc/claim_outbox')
  assert.equal(f.calls[1].url, 'https://proj.supabase.co/rest/v1/rpc/finish_outbox')
  const headers = f.calls[0].init.headers as Record<string, string>
  assert.equal(headers.apikey, 'svc-key')
  assert.equal(headers.Authorization, 'Bearer svc-key')
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { p_ids: ['a', 'b'] })
  assert.deepEqual(JSON.parse(String(f.calls[1].init.body)), { p_results: [{ id: 'a', status: 'sent' }] })
})

test('a non-ok rpc response throws without leaking the body', async () => {
  const impl = (async () => new Response('secret-detail', { status: 500 })) as unknown as typeof fetch
  const deps = buildEmailDeps(
    { CLICKIT_RUNTIME: 'workers', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' },
    impl,
  )
  await assert.rejects(
    () => deps.claimOutbox(['a']),
    (err: Error) => /claim_outbox/.test(err.message) && !/secret-detail/.test(err.message),
  )
})

test('missing Supabase env throws on claim', async () => {
  const deps = buildEmailDeps({ CLICKIT_RUNTIME: 'workers' }, fakeFetch({}).impl)
  await assert.rejects(() => deps.claimOutbox(['a']), /supabase/i)
})

test('workers runtime uses the Resend mailer; otherwise the Mailpit mailer', async () => {
  const w = fakeFetch({})
  const message = {
    to: 'viewer@example.test',
    subject: 's',
    html: '<p>h</p>',
    text: 't',
    idempotencyKey: 'k1',
  }
  const workers = buildEmailDeps({ CLICKIT_RUNTIME: 'workers', RESEND_API_KEY: 're_key' }, w.impl)
  await workers.mailer.send(message)
  assert.equal(w.calls[0].url, 'https://api.resend.com/emails')

  const l = fakeFetch({})
  const local = buildEmailDeps({ MAILPIT_URL: 'http://127.0.0.1:55324' }, l.impl)
  await local.mailer.send(message)
  assert.equal(l.calls[0].url, 'http://127.0.0.1:55324/api/v1/send')
})

test('unsubscribeUrl port signs with the site origin and secret', async () => {
  const deps = buildEmailDeps({ EMAIL_LINK_SECRET: SECRET, SITE_ORIGIN: 'https://example.test' }, fakeFetch({}).impl)
  const url = await deps.unsubscribeUrl(USER)
  assert.ok(url.startsWith('https://example.test/api/email/unsubscribe?t='))
})

const confirmRow = {
  id: 'r1',
  kind: 'newsletter_confirm',
  idempotency_key: 'nl:1',
  to_address: 'fan@example.test',
  reply_to: null,
  locale: 'ar',
  payload: { subscriber_id: USER },
  attempts: 1,
  first_attempt_at: null,
  to_user: null,
}

test('render fails (so the consumer retries) when the link secret is missing', async () => {
  const deps = buildEmailDeps({}, fakeFetch({}).impl)
  await assert.rejects(async () => deps.render(confirmRow), /link secret missing/)
})

test('render fills a signed, locale-prefixed confirm link when the secret is set', async () => {
  const deps = buildEmailDeps({ EMAIL_LINK_SECRET: SECRET }, fakeFetch({}).impl)
  const out = await deps.render(confirmRow)
  assert.ok(out.html.includes(`${ORIGIN}/ar/newsletter/confirm?t=`))
  assert.ok(out.text.includes(`${ORIGIN}/ar/newsletter/confirm?t=`))
})
