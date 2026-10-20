// Finalize gate for direct-to-R2 uploads (MEDIA-01, MEDIA-06, T-02-53/54).
// A presigned PUT cannot cap size or check content, so this is the real gate:
// HEAD for size, a 64 byte ranged GET for magic bytes, key shape and owner
// check, delete on refusal. Pure: no '@/' or server-only imports; the bucket is
// injected (the app Worker's MEDIA binding in production, a fake in tests).
//
// Deletion rule: only keys PROVEN to be ours are ever deleted. A key that fails
// the kind/owner shape check (another kind, another user's avatar folder) is
// refused and left alone, and variant keys are only deleted when they have the
// exact form `_v/<640|1280|1920>/webp/<the verified key>`.

import { SVG_REJECTED_MESSAGE } from '../lib/admin/media-guards.ts'
import { sniffMediaType } from './magic-bytes.ts'
import {
  UPLOAD_KINDS,
  VARIANT_WIDTHS,
  isUploadKind,
  isVariantKeyFor,
  keyMatchesKind,
  variantKeyFor,
  type UploadKind,
} from './upload-kinds.ts'

export type FinalizeBucket = {
  head(key: string): Promise<{ size: number } | null>
  get(
    key: string,
    options?: { range?: { offset: number; length: number } }
  ): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>
  delete(keys: string | string[]): Promise<void>
}

export type DroppedVariant = {
  key: string
  reason: 'bad-key' | 'not-allowed' | 'missing' | 'too-large' | 'not-webp' | 'check-failed'
}

export type FinalizeResult =
  | {
      ok: true
      key: string
      size: number
      contentType: string
      variants: string[]
      droppedVariants: DroppedVariant[]
      cleanupFailed?: true
    }
  | { ok: false; error: string; cleanupFailed?: true }

const SNIFF_BYTES = 64
const MISMATCH_MESSAGE = 'File content does not match its declared type.'

async function sniff(bucket: FinalizeBucket, key: string) {
  const body = await bucket.get(key, { range: { offset: 0, length: SNIFF_BYTES } })
  if (!body) return null
  return sniffMediaType(new Uint8Array(await body.arrayBuffer()).subarray(0, SNIFF_BYTES))
}

async function refuse(
  bucket: FinalizeBucket,
  key: string,
  error: string
): Promise<FinalizeResult> {
  const doomed = [key, ...VARIANT_WIDTHS.map((w) => variantKeyFor(key, w))]
  try {
    await bucket.delete(doomed)
    return { ok: false, error }
  } catch {
    return { ok: false, error, cleanupFailed: true }
  }
}

export async function finalizeUploadedObject(input: {
  kind: UploadKind
  slot?: string | null
  showId?: string | null
  userId?: string | null
  key: string
  variantKeys: readonly string[]
  bucket: FinalizeBucket
}): Promise<FinalizeResult> {
  const { kind, key, bucket } = input
  if (!isUploadKind(kind)) return { ok: false, error: 'Invalid upload kind' }
  const def = UPLOAD_KINDS[kind]
  const slot = input.slot ? input.slot : undefined

  // Not provably ours: refuse, delete nothing.
  if (!keyMatchesKind(kind, key, { slot, showId: input.showId, userId: input.userId })) {
    return { ok: false, error: 'Invalid upload key' }
  }

  let head: { size: number } | null
  try {
    head = await bucket.head(key)
  } catch {
    return { ok: false, error: 'Could not verify the upload' }
  }
  if (!head) return { ok: false, error: 'Upload not found' }

  const size = head.size
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return refuse(bucket, key, 'No file provided')
  }
  const capBytes = def.capBytes(slot)
  if (size > capBytes) return refuse(bucket, key, def.overCapMessage(slot))

  let sniffed: ReturnType<typeof sniffMediaType>
  try {
    sniffed = await sniff(bucket, key)
  } catch {
    return refuse(bucket, key, 'Could not verify the upload')
  }
  if (sniffed === 'text/markup') return refuse(bucket, key, SVG_REJECTED_MESSAGE)
  const allowed = def.allowed(slot)
  const sniffedExt = sniffed ? allowed[sniffed] : undefined
  const keyExt = key.slice(key.lastIndexOf('.') + 1)
  if (!sniffed || !sniffedExt) return refuse(bucket, key, MISMATCH_MESSAGE)
  // The extension was minted from the declared type: bytes must agree with it.
  if (sniffedExt !== keyExt) return refuse(bucket, key, MISMATCH_MESSAGE)

  const variantsAllowed = def.variants && sniffed !== 'image/x-icon'
  const kept: string[] = []
  const dropped: DroppedVariant[] = []
  let cleanupFailed = false

  const dropAndDelete = async (variantKey: string, reason: DroppedVariant['reason']) => {
    dropped.push({ key: variantKey, reason })
    try {
      await bucket.delete(variantKey)
    } catch {
      cleanupFailed = true
    }
  }

  for (const variantKey of new Set(input.variantKeys)) {
    if (typeof variantKey !== 'string' || !isVariantKeyFor(variantKey, key)) {
      // Not derived from the verified key: never touch it.
      dropped.push({ key: String(variantKey), reason: 'bad-key' })
      continue
    }
    if (!variantsAllowed) {
      await dropAndDelete(variantKey, 'not-allowed')
      continue
    }
    try {
      const vHead = await bucket.head(variantKey)
      if (!vHead) {
        dropped.push({ key: variantKey, reason: 'missing' })
        continue
      }
      if (typeof vHead.size !== 'number' || vHead.size <= 0 || vHead.size > capBytes) {
        await dropAndDelete(variantKey, 'too-large')
        continue
      }
      if ((await sniff(bucket, variantKey)) !== 'image/webp') {
        await dropAndDelete(variantKey, 'not-webp')
        continue
      }
      kept.push(variantKey)
    } catch {
      dropped.push({ key: variantKey, reason: 'check-failed' })
    }
  }

  return {
    ok: true,
    key,
    size,
    contentType: sniffed,
    variants: kept,
    droppedVariants: dropped,
    ...(cleanupFailed ? { cleanupFailed: true as const } : {}),
  }
}
