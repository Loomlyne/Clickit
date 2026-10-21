'use server'

import { AwsClient } from 'aws4fetch'
import { headers } from 'next/headers'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser, requireSignedInUser } from '@/server/auth-guards'
import { getWorkerEnv } from '@/server/cloudflare'
import { mintShimToken, SHIM_TOKEN_TTL_MS } from '@/server/dev-upload-shim'
import { allowMediaPresign } from '@/server/media-presign-limit'
import { presignPut } from '@/server/r2-presign'
import { supabaseRateLimitStore } from '@/server/rate-limit-store'
import {
  MAX_VARIANT_URLS_PER_CALL,
  UPLOAD_KINDS,
  checkUploadRequest,
  mintUploadKey,
  planVariantUploads,
  variantKeyFor,
  type UploadKind,
  type VariantWidth,
} from '@/server/upload-kinds'

// Direct-to-R2 upload requests (MEDIA-01). This action never receives file
// bytes: it checks the session, the kind's allowlist and the declared sizes,
// applies the per-user presign limit, mints the key server-side and returns
// presigned PUT URLs (local signing, no subrequest) that sign each declared size
// as Content-Length and expire in 60 s. The real gate is finalizeUploadedObject (HEAD, magic bytes,
// delete on refusal), called by the per-kind finalize actions (plans 02-15/16).

const KIND_VALUES = Object.keys(UPLOAD_KINDS) as [UploadKind, ...UploadKind[]]

const requestSchema = z.object({
  kind: z.enum(KIND_VALUES),
  slot: z.string().max(32).optional(),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
  filename: z.string().max(200).optional(),
  showId: z.string().uuid().optional(),
  /** WebP copies the browser already made, with their exact byte sizes. */
  variants: z
    .array(
      z.object({
        width: z.union([z.literal(640), z.literal(1280), z.literal(1920)]),
        size: z.number().int().positive(),
      })
    )
    .max(MAX_VARIANT_URLS_PER_CALL)
    .optional(),
})

export type MediaUploadInput = z.input<typeof requestSchema>

type PutTarget = {
  url: string
  method: 'PUT'
  headers: { 'Content-Type': string }
  /** Signed size: the PUT body must be exactly this many bytes. */
  contentLength: number
  expiresAt: number
}

export type MediaUploadTarget = {
  key: string
  contentType: string
  put: PutTarget
  variants: Array<{ width: VariantWidth; key: string; put: PutTarget }>
}

export type MediaUploadResult =
  | { success: true; data: MediaUploadTarget }
  | { success: false; error: string }

const LOCAL_HOST_RE = /^127\.0\.0\.1(?::[0-9]{1,5})?$/
const UNAVAILABLE = 'Uploads are not available right now'
const RATE_LIMITED = 'Too many uploads in the last 10 minutes. Try again later.'

export async function requestMediaUpload(input: MediaUploadInput): Promise<MediaUploadResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid upload request' }
  const req = parsed.data
  const def = UPLOAD_KINDS[req.kind]

  // 1. Session. The avatar owner id always comes from the session, never from input.
  let userId: string
  try {
    userId = def.actor === 'admin' ? await requireAdminUser() : await requireSignedInUser()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unauthorized' }
  }

  // 2. Kind, slot, type allowlist (SVG refused), declared size cap.
  const checked = checkUploadRequest({
    kind: req.kind,
    slot: req.slot,
    contentType: req.contentType,
    size: req.size,
  })
  if (!checked.ok) return { success: false, error: checked.error }
  if (def.needsShowId && !req.showId) return { success: false, error: 'Missing showId' }
  const plan = planVariantUploads({
    kind: req.kind,
    contentType: checked.contentType,
    capBytes: checked.capBytes,
    variants: req.variants,
  })
  if (!plan.ok) return { success: false, error: plan.error }

  // 3. Per-user presign limit (rate_limits, fails closed).
  const limit = await allowMediaPresign({
    userId,
    getStore: () => supabaseRateLimitStore(createAdminClient()),
  })
  if (!limit.allowed) return { success: false, error: limit.reason === 'limited' ? RATE_LIMITED : UNAVAILABLE }

  // 4. Key minted server-side (filename is never used).
  let key: string
  try {
    key = mintUploadKey(req.kind, {
      slot: req.slot,
      showId: req.showId,
      userId,
      contentType: checked.contentType,
    })
  } catch {
    return { success: false, error: 'Invalid upload request' }
  }

  // 5. URLs. Each signs its declared size (the original's was checked against the cap above).
  try {
    const env = await getWorkerEnv()
    const hasCredentials = Boolean(env.R2_ACCESS_KEY_ID) && Boolean(env.R2_SECRET_ACCESS_KEY)
    let put: PutTarget
    const variants: MediaUploadTarget['variants'] = []

    if (env.LOCAL_DEV === '1' && !hasCredentials) {
      // Local preview: the S3 endpoint does not exist, so write through the shim.
      const host = (await headers()).get('host') ?? ''
      if (!LOCAL_HOST_RE.test(host)) return { success: false, error: 'Local upload shim needs host 127.0.0.1' }
      const secret = env.LOCAL_UPLOAD_SHIM_SECRET ?? ''
      const shim = async (objectKey: string, contentType: string, contentLength: number): Promise<PutTarget> => {
        const token = await mintShimToken(objectKey, contentType, contentLength, secret)
        return {
          url: `http://${host}/api/dev/r2-put/${objectKey}?t=${token}`,
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          contentLength,
          expiresAt: Date.now() + SHIM_TOKEN_TTL_MS,
        }
      }
      put = await shim(key, checked.contentType, req.size)
      for (const { width, size } of plan.variants) {
        const variantKey = variantKeyFor(key, width)
        variants.push({ width, key: variantKey, put: await shim(variantKey, 'image/webp', size) })
      }
    } else {
      const sign = (objectKey: string, contentType: string, contentLength: number) =>
        presignPut({
          accountId: env.CLOUDFLARE_ACCOUNT_ID,
          key: objectKey,
          contentType,
          contentLength,
          credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
          AwsClientImpl: AwsClient,
        })
      put = await sign(key, checked.contentType, req.size)
      for (const { width, size } of plan.variants) {
        const variantKey = variantKeyFor(key, width)
        variants.push({ width, key: variantKey, put: await sign(variantKey, 'image/webp', size) })
      }
    }
    return { success: true, data: { key, contentType: checked.contentType, put, variants } }
  } catch (err) {
    // Messages name a missing variable, never a value.
    console.error('[requestMediaUpload] could not presign', err instanceof Error ? err.message : 'unknown error')
    return { success: false, error: UNAVAILABLE }
  }
}
