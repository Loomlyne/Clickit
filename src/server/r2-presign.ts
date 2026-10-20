// Presigned PUT URLs for the R2 S3 endpoint (MEDIA-01, T-02-57).
// Local signing only: no subrequest, no network. The AwsClient class is
// injected (production passes aws4fetch's); tests pass the real one with fake
// keys or a fake signer.
//
// aws4fetch leaves Content-Type OUT of the signed headers by default
// (UNSIGNABLE_HEADERS), which would let a browser PUT any type with the same
// URL. `allHeaders: true` puts it into X-Amz-SignedHeaders, so R2 answers 403
// SignatureDoesNotMatch unless the PUT repeats exactly the signed Content-Type.

export const R2_ENDPOINT_BUCKET = 'clickit-media'
export const PRESIGN_EXPIRES_SECONDS = 300

const ACCOUNT_ID_RE = /^[0-9a-f]{32}$/
// Bucket-relative keys minted by upload-kinds.ts: lowercase path characters only.
const OBJECT_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/

type AwsClientLike = {
  sign(request: Request, init?: unknown): Promise<Request>
}
export type AwsClientCtor = new (config: {
  accessKeyId: string
  secretAccessKey: string
  service: string
  region: string
}) => AwsClientLike

export type PresignResult = {
  url: string
  method: 'PUT'
  headers: { 'Content-Type': string }
  expiresAt: number
}

export async function presignPut(input: {
  accountId: string | undefined
  key: string
  contentType: string
  credentials: { accessKeyId: string | undefined; secretAccessKey: string | undefined }
  AwsClientImpl: AwsClientCtor
  bucket?: string
  expiresSeconds?: number
  now?: Date
}): Promise<PresignResult> {
  // Names only in errors, never values.
  if (!input.credentials.accessKeyId) throw new Error('R2_ACCESS_KEY_ID is not set')
  if (!input.credentials.secretAccessKey) throw new Error('R2_SECRET_ACCESS_KEY is not set')
  if (!input.accountId || !ACCOUNT_ID_RE.test(input.accountId)) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not set or is not a 32 character hex id')
  }
  if (!OBJECT_KEY_RE.test(input.key) || input.key.includes('..') || input.key.includes('//')) {
    throw new Error('Invalid object key')
  }
  const expires = input.expiresSeconds ?? PRESIGN_EXPIRES_SECONDS
  const bucket = input.bucket ?? R2_ENDPOINT_BUCKET
  const now = input.now ?? new Date()

  const client = new input.AwsClientImpl({
    accessKeyId: input.credentials.accessKeyId,
    secretAccessKey: input.credentials.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const url = new URL(`https://${input.accountId}.r2.cloudflarestorage.com/${bucket}/${input.key}`)
  url.searchParams.set('X-Amz-Expires', String(expires))
  const signed = await client.sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': input.contentType } }),
    { aws: { signQuery: true, allHeaders: true } }
  )
  return {
    url: signed.url,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
    expiresAt: now.getTime() + expires * 1000,
  }
}
