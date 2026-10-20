'use server'

import { AwsClient } from 'aws4fetch'
import { headers } from 'next/headers'
import { z } from 'zod'

import { requireAdminUser, requireSignedInUser } from '@/server/auth-guards'
import { getWorkerEnv } from '@/server/cloudflare'
import { mintShimToken } from '@/server/dev-upload-shim'
import { presignPut } from '@/server/r2-presign'
import {
  MAX_VARIANT_URLS_PER_CALL,
  UPLOAD_KINDS,
  VARIANT_WIDTHS,
  checkUploadRequest,
  mintUploadKey,
  variantKeyFor,
  type UploadKind,
  type VariantWidth,
} from '@/server/upload-kinds'

// Direct-to-R2 upload requests (MEDIA-01). This action never receives file
// bytes: it checks the session, the kind's allowlist and the declared size,
// mints the key server-side and returns presigned PUT URLs (local signing, no
// subrequest). The real gate is finalizeUploadedObject (HEAD, magic bytes,
// delete on refusal), called by the per-kind finalize actions (plans 02-15/16).

const KIND_VALUES = Object.keys(UPLOAD_KINDS) as [UploadKind, ...UploadKind[]]

const requestSchema = z.object({
  kind: z.enum(KIND_VALUES),
  slot: z.string().max(32).optional(),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
  filename: z.string().max(200).optional(),
  showId: z.string().uuid().optional(),
  variantWidths: z
    .array(z.union([z.literal(640), z.literal(1280), z.literal(1920)]))
    .max(MAX_VARIANT_URLS_PER_CALL)
    .optional(),
})

export type MediaUploadInput = z.input<typeof requestSchema>

type PutTarget = {
  url: string
  method: 'PUT'
  headers: { 'Content-Type': string }
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

  // 3. Key minted server-side (filename is never used).
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

  const widths: VariantWidth[] =
    def.variants && checked.contentType !== 'image/x-icon'
      ? VARIANT_WIDTHS.filter((w) => req.variantWidths?.includes(w))
      : []

  // 4. URLs.
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
      const shim = async (objectKey: string, contentType: string): Promise<PutTarget> => {
        const token = await mintShimToken(objectKey, contentType, secret)
        return {
          url: `http://${host}/api/dev/r2-put/${objectKey}?t=${token}`,
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          expiresAt: Date.now() + 300_000,
        }
      }
      put = await shim(key, checked.contentType)
      for (const width of widths) {
        const variantKey = variantKeyFor(key, width)
        variants.push({ width, key: variantKey, put: await shim(variantKey, 'image/webp') })
      }
    } else {
      const sign = (objectKey: string, contentType: string) =>
        presignPut({
          accountId: env.CLOUDFLARE_ACCOUNT_ID,
          key: objectKey,
          contentType,
          credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
          AwsClientImpl: AwsClient,
        })
      put = await sign(key, checked.contentType)
      for (const width of widths) {
        const variantKey = variantKeyFor(key, width)
        variants.push({ width, key: variantKey, put: await sign(variantKey, 'image/webp') })
      }
    }
    return { success: true, data: { key, contentType: checked.contentType, put, variants } }
  } catch (err) {
    // Messages name a missing variable, never a value.
    console.error('[requestMediaUpload] could not presign', err instanceof Error ? err.message : 'unknown error')
    return { success: false, error: 'Uploads are not available right now' }
  }
}
