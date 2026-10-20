export const HERO_VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const HERO_VIDEO_TOO_LARGE = 'Video must be under 50MB'

export const SVG_REJECTED_MESSAGE =
  'SVG uploads are not accepted. Upload a raster image (PNG, JPEG or WebP; ICO for the favicon).'
const MISMATCH_MESSAGE = 'File content does not match its declared type.'

export const SITE_IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
}

export const SOCIAL_ICON_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const MIME_ALIASES: Record<string, string> = {
  'image/vnd.microsoft.icon': 'image/x-icon',
  'image/jpg': 'image/jpeg',
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

function ascii(bytes: Uint8Array, offset: number, len: number): string {
  let s = ''
  for (let i = offset; i < offset + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return s
}

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon'
  let i = 0
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) i = 3
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++
  if (bytes[i] === 0x3c) return 'image/svg+xml'
  return null
}

export type ImageCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string }

export function checkImageUpload(input: {
  declaredMime: string
  bytes: Uint8Array
  allow: Record<string, string>
}): ImageCheck {
  const declared = MIME_ALIASES[input.declaredMime] ?? input.declaredMime
  const sniffed = sniffImageMime(input.bytes)
  if (declared === 'image/svg+xml' || sniffed === 'image/svg+xml') {
    return { ok: false, error: SVG_REJECTED_MESSAGE }
  }
  const ext = input.allow[declared]
  if (!ext) return { ok: false, error: 'Unsupported image type.' }
  if (sniffed !== declared) return { ok: false, error: MISMATCH_MESSAGE }
  return { ok: true, mime: declared, ext }
}

export function checkHeroVideoSize(size: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0 || size > HERO_VIDEO_MAX_BYTES) {
    return { ok: false, error: HERO_VIDEO_TOO_LARGE }
  }
  return { ok: true }
}

export type VideoStoragePort = {
  info(path: string): Promise<{ data: { size?: number } | null; error: { message: string } | null }>
  remove(paths: string[]): Promise<{ error: { message: string } | null }>
}

export async function verifyUploadedVideoSize(
  storage: VideoStoragePort,
  path: string
): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const { data, error } = await storage.info(path)
  if (error) return { ok: false, error: `Could not verify uploaded video size: ${error.message}` }
  const size = data?.size
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return { ok: false, error: 'Could not verify uploaded video size' }
  }
  if (size > HERO_VIDEO_MAX_BYTES) {
    const { error: rmErr } = await storage.remove([path])
    if (rmErr) {
      return {
        ok: false,
        error: `${HERO_VIDEO_TOO_LARGE}; the oversize file could not be removed: ${rmErr.message}`,
      }
    }
    return { ok: false, error: HERO_VIDEO_TOO_LARGE }
  }
  return { ok: true, size }
}
