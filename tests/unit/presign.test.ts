import assert from 'node:assert/strict'
import test from 'node:test'
import { AwsClient } from 'aws4fetch'
import { presignPut, R2_ENDPOINT_BUCKET } from '../../src/server/r2-presign.ts'

const ACCOUNT = 'e329b099b6e4272fc0915a99832e47fe'
const creds = { accessKeyId: 'AKIAFAKEFAKEFAKE0000', secretAccessKey: 'fake-secret-never-real-0000000000000000000' }
const now = new Date('2026-10-20T10:00:00.000Z')

test('presigned URL targets the account R2 endpoint and bucket path', async () => {
  const r = await presignPut({
    accountId: ACCOUNT,
    key: 'show-artwork/shows/s/poster-1.png',
    contentType: 'image/png',
    credentials: creds,
    AwsClientImpl: AwsClient,
    now,
  })
  const u = new URL(r.url)
  assert.equal(u.protocol, 'https:')
  assert.equal(u.host, `${ACCOUNT}.r2.cloudflarestorage.com`)
  assert.equal(u.pathname, `/${R2_ENDPOINT_BUCKET}/show-artwork/shows/s/poster-1.png`)
  assert.equal(R2_ENDPOINT_BUCKET, 'clickit-media')
  assert.equal(r.method, 'PUT')
  assert.deepEqual(r.headers, { 'Content-Type': 'image/png' })
})

test('query has expiry 300, signature, credential and content-type in signed headers', async () => {
  const r = await presignPut({
    accountId: ACCOUNT,
    key: 'avatars/u/avatar-1.webp',
    contentType: 'image/webp',
    credentials: creds,
    AwsClientImpl: AwsClient,
    now,
  })
  const q = new URL(r.url).searchParams
  assert.equal(q.get('X-Amz-Expires'), '300')
  assert.equal(q.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
  assert.match(q.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/)
  assert.ok(q.get('X-Amz-Credential')?.startsWith(`${creds.accessKeyId}/`))
  assert.ok(q.get('X-Amz-Credential')?.endsWith('/auto/s3/aws4_request'))
  const signed = (q.get('X-Amz-SignedHeaders') ?? '').split(';')
  assert.ok(signed.includes('content-type'), `signed headers: ${signed.join(';')}`)
  assert.ok(signed.includes('host'))
})

test('expiresAt is now plus 300 seconds', async () => {
  const r = await presignPut({
    accountId: ACCOUNT,
    key: 'a/b.png',
    contentType: 'image/png',
    credentials: creds,
    AwsClientImpl: AwsClient,
    now,
  })
  assert.equal(r.expiresAt, now.getTime() + 300_000)
})

test('a different content type produces a different signature', async () => {
  const sign = async (contentType: string) =>
    new URL(
      (
        await presignPut({
          accountId: ACCOUNT,
          key: 'a/b.png',
          contentType,
          credentials: creds,
          AwsClientImpl: AwsClient,
          now,
        })
      ).url
    ).searchParams.get('X-Amz-Signature')
  assert.notEqual(await sign('image/png'), await sign('image/jpeg'))
})

test('the secret never appears in the URL or headers', async () => {
  const r = await presignPut({
    accountId: ACCOUNT,
    key: 'a/b.png',
    contentType: 'image/png',
    credentials: creds,
    AwsClientImpl: AwsClient,
    now,
  })
  assert.ok(!r.url.includes(creds.secretAccessKey))
  assert.ok(!JSON.stringify(r.headers).includes(creds.secretAccessKey))
})

test('fake signer: receives a PUT request with Content-Type and signQuery + allHeaders', async () => {
  const seen: { method?: string; ct?: string | null; opts?: unknown; expires?: string | null } = {}
  class FakeAws {
    constructor(public cfg: Record<string, unknown>) {
      seen.opts = { cfg }
    }
    async sign(req: Request, init: unknown) {
      seen.method = req.method
      seen.ct = req.headers.get('content-type')
      seen.expires = new URL(req.url).searchParams.get('X-Amz-Expires')
      seen.opts = { ...(seen.opts as object), init }
      return new Request(req.url + '&X-Amz-Signature=deadbeef', { method: 'PUT' })
    }
  }
  const r = await presignPut({
    accountId: ACCOUNT,
    key: 'k/x.png',
    contentType: 'image/png',
    credentials: creds,
    AwsClientImpl: FakeAws as never,
    now,
  })
  assert.equal(seen.method, 'PUT')
  assert.equal(seen.ct, 'image/png')
  assert.equal(seen.expires, '300')
  assert.deepEqual((seen.opts as { init: unknown }).init, { aws: { signQuery: true, allHeaders: true } })
  assert.deepEqual((seen.opts as { cfg: unknown }).cfg, {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  assert.ok(r.url.endsWith('X-Amz-Signature=deadbeef'))
})

test('missing credentials throw an error naming the variable, not a value', async () => {
  await assert.rejects(
    presignPut({
      accountId: ACCOUNT,
      key: 'a/b.png',
      contentType: 'image/png',
      credentials: { accessKeyId: undefined, secretAccessKey: creds.secretAccessKey },
      AwsClientImpl: AwsClient,
      now,
    }),
    (e: Error) => e.message.includes('R2_ACCESS_KEY_ID') && !e.message.includes(creds.secretAccessKey)
  )
  await assert.rejects(
    presignPut({
      accountId: ACCOUNT,
      key: 'a/b.png',
      contentType: 'image/png',
      credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: '' },
      AwsClientImpl: AwsClient,
      now,
    }),
    (e: Error) => e.message.includes('R2_SECRET_ACCESS_KEY') && !e.message.includes(creds.accessKeyId)
  )
  await assert.rejects(
    presignPut({
      accountId: '',
      key: 'a/b.png',
      contentType: 'image/png',
      credentials: creds,
      AwsClientImpl: AwsClient,
      now,
    }),
    (e: Error) => e.message.includes('CLOUDFLARE_ACCOUNT_ID')
  )
})

test('keys that could escape the bucket path or carry a query are refused', async () => {
  for (const key of ['', '/abs', 'a/../b', 'a?b=1', 'a#b', 'a\\b', 'a b']) {
    await assert.rejects(
      presignPut({
        accountId: ACCOUNT,
        key,
        contentType: 'image/png',
        credentials: creds,
        AwsClientImpl: AwsClient,
        now,
      }),
      /invalid object key/i,
      JSON.stringify(key)
    )
  }
})

test('an account id that is not 32 hex characters is refused (no host injection)', async () => {
  await assert.rejects(
    presignPut({
      accountId: 'evil.example.com/x',
      key: 'a/b.png',
      contentType: 'image/png',
      credentials: creds,
      AwsClientImpl: AwsClient,
      now,
    }),
    /CLOUDFLARE_ACCOUNT_ID/
  )
})
