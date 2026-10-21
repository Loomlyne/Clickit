'use client'

// Browser side of direct-to-R2 uploads (MEDIA-01, MEDIA-04, MEDIA-05).
//
// Images: check type + size -> read the image size -> make WebP copies (only if the
//   browser really encodes WebP) -> requestMediaUpload (declares every byte size)
//   -> PUT the original (XMLHttpRequest, progress) and the copies at once ->
//   finalize*Upload. The links sign each size as Content-Length and live 60 s,
//   so every PUT starts right after the request.
// Videos (uploadVideoDirect): check type + size -> requestMediaUpload (no copies) ->
//   PUT the MP4 (same XHR progress code) -> finalize*VideoUpload. Nothing is decoded
//   or transcoded in the browser; fast-start and audio are checked by finalize.
//
// No file bytes ever go to a server action. Client checks are UX only: the
// real gate is the finalize action (magic bytes, size, owner, delete on refusal).

import { requestMediaUpload } from '@/app/actions/media-upload'
import {
  isRealWebp,
  planBrowserVariants,
  progressPercent,
  scaledSize,
} from '@/lib/browser-variants'
import { UPLOAD_KINDS, checkUploadRequest, type UploadKind, type VariantWidth } from '@/server/upload-kinds'

export type ImageUploadKind = Extract<UploadKind, 'artwork' | 'site-image' | 'social-icon' | 'cast-image' | 'avatar'>

/** Signed texts (mockups/DECISIONS.md, option M). English only; Arabic pending Koss's signature. */
export const UPLOAD_MESSAGES = {
  network: 'Upload stopped: the connection dropped or the upload link expired. Nothing was saved.',
  refused: 'The file did not match its type and was removed. Nothing was saved.',
  safari: 'This browser cannot make WebP copies; the original will be used.',
  /** Video texts, also signed in option M (mockups/upload-states.html). */
  notMp4: 'Upload an MP4 video.',
  notFastStart:
    'This video is not fast-start. Re-export it with "fast start" (web optimised) on, then upload again. Nothing was saved.',
  /** Helper line under a video field (the signed hint). */
  videoHint: 'MP4, fast-start, under 50MB',
} as const

export type UploadErrorKind = 'too-large' | 'wrong-type' | 'network' | 'refused' | 'unavailable'
export type UploadError = { kind: UploadErrorKind; message: string }

export type UploadProgress = {
  fileName: string
  fileSize: number
  percent: number
  phase: 'uploading' | 'saving'
  /** How many smaller copies follow the original (0 when none; always 0 for video). */
  variantCount: number
}

export type FinalizeResult = {
  success: boolean
  data?: string | null
  error?: string
  mediaCleanupFailed?: boolean
}

export type UploadImageResult =
  | { ok: true; url: string; key: string; safariFallback: boolean }
  | { ok: false; error: UploadError }

export type UploadImageInput = {
  file: File
  kind: ImageUploadKind
  slot?: string
  /** Show id for artwork and cast images. */
  showId?: string
  finalize: (args: { key: string; variantKeys: string[] }) => Promise<FinalizeResult>
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

const WEBP_QUALITY = 0.8

class PutFailed extends Error {}

/** Type problems first (size ignored), then the size cap, with the server's own messages. */
function checkFile(
  file: File,
  kind: UploadKind,
  slot: string | undefined,
  contentType: string = file.type
): UploadError | null {
  const typeOnly = checkUploadRequest({ kind, slot, contentType, size: 1 })
  if (!typeOnly.ok) return { kind: 'wrong-type', message: typeOnly.error }
  const full = checkUploadRequest({ kind, slot, contentType, size: file.size })
  if (!full.ok) {
    return { kind: file.size > 0 ? 'too-large' : 'wrong-type', message: full.error }
  }
  return null
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', WEBP_QUALITY)
    } catch {
      resolve(null)
    }
  })
}

type Variant = { width: VariantWidth; blob: Blob }

/**
 * WebP copies narrower than the source. Returns no copies and `unsupported: true`
 * as soon as the browser hands back anything but real WebP (Safari returns PNG);
 * a PNG blob is never uploaded as a WebP copy.
 */
async function makeVariants(
  file: File,
  kind: ImageUploadKind
): Promise<{ variants: Variant[]; unsupported: boolean }> {
  // Types that never get copies (icons, gifs) and kinds without variants: nothing to make, no note.
  if (!UPLOAD_KINDS[kind].variants || planBrowserVariants(Number.MAX_SAFE_INTEGER, file.type).length === 0) {
    return { variants: [], unsupported: false }
  }
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Cannot decode here (old browser, unusual file). The original still uploads.
    return { variants: [], unsupported: true }
  }
  try {
    const widths = planBrowserVariants(bitmap.width, file.type)
    const variants: Variant[] = []
    for (const width of widths) {
      const { width: w, height: h } = scaledSize(bitmap.width, bitmap.height, width)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return { variants: [], unsupported: true }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, w, h)
      const blob = await canvasToBlob(canvas)
      if (!blob || !isRealWebp(blob)) return { variants: [], unsupported: true }
      variants.push({ width, blob })
    }
    return { variants, unsupported: false }
  } finally {
    bitmap.close()
  }
}

/**
 * PUT with progress. The Content-Type header is exactly the signed one; the
 * browser sets Content-Length from the Blob (scripts cannot), which must equal
 * the signed size.
 */
function putWithProgress(
  url: string,
  contentType: string,
  body: Blob,
  onFraction: (fraction: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onFraction(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onFraction(1)
        resolve()
      } else {
        // 403 is an expired or mismatched link; anything else is also a stopped upload.
        reject(new PutFailed(`PUT ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new PutFailed('network'))
    xhr.ontimeout = () => reject(new PutFailed('timeout'))
    xhr.onabort = () => reject(new PutFailed('aborted'))
    if (signal) {
      if (signal.aborted) {
        reject(new PutFailed('aborted'))
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })
}

async function putVariant(url: string, contentType: string, blob: Blob, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob, signal })
    return res.ok
  } catch {
    return false
  }
}

export async function uploadImageDirect(input: UploadImageInput): Promise<UploadImageResult> {
  const { file, kind, slot, showId, finalize, onProgress, signal } = input
  const fail = (error: UploadError): UploadImageResult => ({ ok: false, error })

  const checkError = checkFile(file, kind, slot)
  if (checkError) return fail(checkError)

  const report = (percent: number, phase: UploadProgress['phase'], variantCount: number) =>
    onProgress?.({ fileName: file.name, fileSize: file.size, percent, phase, variantCount })

  // Copies are made before the request so the request names only widths we really have.
  report(0, 'uploading', 0)
  const made = await makeVariants(file, kind)
  const variantCount = made.variants.length
  report(0, 'uploading', variantCount)

  let target
  try {
    const res = await requestMediaUpload({
      kind,
      slot,
      contentType: file.type,
      size: file.size,
      filename: file.name,
      showId,
      variants: made.variants.map((v) => ({ width: v.width, size: v.blob.size })),
    })
    if (!res.success) {
      const kindOf: UploadErrorKind = /not available|too many/i.test(res.error) ? 'unavailable' : 'wrong-type'
      return fail({ kind: kindOf, message: res.error })
    }
    target = res.data
  } catch {
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }

  // The signed Content-Length is the size declared above; a changed file would get a 403.
  if (file.size !== target.put.contentLength) return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })

  // Copies are optional: one that fails is simply not listed (the original always works).
  // They start together with the original, so no link is used after its 60 s.
  const copies = target.variants.map(async (variant) => {
    const blob = made.variants.find((v) => v.width === variant.width)?.blob
    if (!blob || blob.size !== variant.put.contentLength) return null
    if (await putVariant(variant.put.url, variant.put.headers['Content-Type'], blob, signal)) return variant.key
    console.warn('[browser-upload] a smaller copy did not upload; the original will be used for it')
    return null
  })

  try {
    await putWithProgress(
      target.put.url,
      target.put.headers['Content-Type'],
      file,
      (fraction) => report(progressPercent(fraction), 'uploading', variantCount),
      signal
    )
  } catch {
    await Promise.allSettled(copies)
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }
  const variantKeys = (await Promise.all(copies)).filter((key): key is string => key !== null)

  report(100, 'saving', variantCount)
  let result: FinalizeResult
  try {
    result = await finalize({ key: target.key, variantKeys })
  } catch {
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }
  if (!result.success || !result.data) {
    const raw = result.error ?? ''
    const message = /does not match/i.test(raw) || raw === '' ? UPLOAD_MESSAGES.refused : raw
    return fail({ kind: 'refused', message })
  }
  return { ok: true, url: result.data, key: target.key, safariFallback: made.unsupported }
}

export type VideoUploadKind = Extract<UploadKind, 'hero-video' | 'preloader-video' | 'show-video'>

export type UploadVideoResult =
  | { ok: true; url: string; key: string }
  | { ok: false; error: UploadError }

export type UploadVideoInput = {
  file: File
  kind: VideoUploadKind
  /** 'desktop' | 'mobile' for hero-video and show-video; none for preloader-video. */
  slot?: 'desktop' | 'mobile'
  /** Show id for show-video. */
  showId?: string
  finalize: (args: { key: string }) => Promise<FinalizeResult>
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

/** Finalize refusals that name fast-start get the signed text; everything else passes through. */
function videoRefusalMessage(raw: string): string {
  if (/fast.?start/i.test(raw)) return UPLOAD_MESSAGES.notFastStart
  if (/does not match/i.test(raw) || raw === '') return UPLOAD_MESSAGES.refused
  return raw
}

/**
 * Browser -> R2 for one MP4 (hero desktop/mobile, preloader, per-show hero). Same
 * request, XHR PUT and error mapping as uploadImageDirect, with no copies. The real
 * gate (size, magic bytes, fast-start, audio) is the finalize action, which deletes a
 * refused object.
 */
export async function uploadVideoDirect(input: UploadVideoInput): Promise<UploadVideoResult> {
  const { file, kind, slot, showId, finalize, onProgress, signal } = input
  const fail = (error: UploadError): UploadVideoResult => ({ ok: false, error })

  // Some systems report an empty type for .mp4; the picker already limits to video/mp4.
  const contentType = file.type || (/\.mp4$/i.test(file.name) ? 'video/mp4' : '')
  const checkError = checkFile(file, kind, slot, contentType)
  if (checkError) {
    return fail(checkError.kind === 'wrong-type' ? { kind: 'wrong-type', message: UPLOAD_MESSAGES.notMp4 } : checkError)
  }

  const report = (percent: number, phase: UploadProgress['phase']) =>
    onProgress?.({ fileName: file.name, fileSize: file.size, percent, phase, variantCount: 0 })

  report(0, 'uploading')
  let target
  try {
    const res = await requestMediaUpload({
      kind,
      slot,
      contentType,
      size: file.size,
      filename: file.name,
      showId,
      variants: [],
    })
    if (!res.success) {
      const kindOf: UploadErrorKind = /not available|too many/i.test(res.error) ? 'unavailable' : 'wrong-type'
      return fail({ kind: kindOf, message: res.error })
    }
    target = res.data
  } catch {
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }

  if (file.size !== target.put.contentLength) return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  try {
    await putWithProgress(
      target.put.url,
      target.put.headers['Content-Type'],
      file,
      (fraction) => report(progressPercent(fraction), 'uploading'),
      signal
    )
  } catch {
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }

  report(100, 'saving')
  let result: FinalizeResult
  try {
    result = await finalize({ key: target.key })
  } catch {
    return fail({ kind: 'network', message: UPLOAD_MESSAGES.network })
  }
  if (!result.success || !result.data) {
    return fail({ kind: 'refused', message: videoRefusalMessage(result.error ?? '') })
  }
  return { ok: true, url: result.data, key: target.key }
}
