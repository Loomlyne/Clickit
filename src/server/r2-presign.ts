// Presigned PUT URLs for the R2 S3 endpoint (MEDIA-01, T-02-57).
// Local signing only: no subrequest, no network. The AwsClient class is
// injected (production passes aws4fetch's); tests pass the real one with fake
// keys or a fake signer.
//
// aws4fetch leaves Content-Type OUT of the signed headers by default
// (UNSIGNABLE_HEADERS), which would let a browser PUT any type with the same
// URL. `allHeaders: true` puts it into X-Amz-SignedHeaders, so R2 answers 403
// SignatureDoesNotMatch unless the PUT repeats exactly the signed Content-Type.
// Content-Length is signed the same way: the browser sets it from the Blob it
// sends (it cannot be set by script), so a body of any other size is refused by
// R2 and a declared size under the kind's cap really caps the stored object.
// The link lives 60 s: the browser starts every PUT right after the request.

export const R2_ENDPOINT_BUCKET = 'clickit-media'
export const PRESIGN_EXPIRES_SECONDS = 60
const REQUIRED_SIGNED_HEADERS = ['content-length', 'content-type', 'host']

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
  /** The signed size: the PUT body must be exactly this many bytes. */
  contentLength: number
  expiresAt: number
}

export async function presignPut(input: {
  accountId: string | undefined
  key: string
  contentType: string
  /** Declared size in bytes, already checked against the kind's cap by the caller. */
  contentLength: number
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
  const contentLength = input.contentLength
  if (typeof contentLength !== 'number' || !Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error('Invalid content length')
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
    new Request(url, {
      method: 'PUT',
      headers: { 'Content-Type': input.contentType, 'Content-Length': String(contentLength) },
    }),
    { aws: { signQuery: true, allHeaders: true } }
  )
  // Fail closed if a runtime dropped a header before signing: an unsigned
  // Content-Length would let the PUT store any size.
  const signedHeaders = (new URL(signed.url).searchParams.get('X-Amz-SignedHeaders') ?? '').split(';')
  for (const name of REQUIRED_SIGNED_HEADERS) {
    if (!signedHeaders.includes(name)) throw new Error(`Presign failed: ${name} is not signed`)
  }
  return {
    url: signed.url,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
    contentLength,
    expiresAt: now.getTime() + expires * 1000,
  }
}
