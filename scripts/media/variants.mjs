// Variant planning and encoding for the R2 media copy (D-03, MEDIA-04).
// Pure planning plus a sharp encoder; no network, nothing imported from src/.
// The key layout and widths are shared with workers/media/src/handler.ts
// (variantCandidates); a unit test pins the two together.

import sharp from 'sharp'

export const VARIANT_WIDTHS = [640, 1280, 1920]
export const VARIANT_FORMATS = ['avif', 'webp']
// Bump this string to regenerate every variant while leaving originals alone.
export const VARIANT_SPEC_VERSION = 'v1'
// sharp defaults per the research (webp 80, avif 50, effort 4).
export const QUALITY = { webp: 80, avif: 50 }
export const EFFORT = 4

const MIME = { avif: 'image/avif', webp: 'image/webp' }
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

/**
 * @param {number} width
 * @param {'avif' | 'webp'} format
 * @param {string} bucketKey `<bucket>/<key>`
 */
export function variantKey(width, format, bucketKey) {
  return `_v/${width}/${format}/${bucketKey}`
}

export function variantSpec(width, format) {
  return `${VARIANT_SPEC_VERSION};w=${width};fmt=${format};q=${QUALITY[format]}`
}

/**
 * @param {{ contentType: string | null, width: number | null, pages?: number | null }} meta
 * @param {string} bucketKey `<bucket>/<key>`
 * @returns {{ variants: Array<{ width: number, format: 'avif' | 'webp', key: string, spec: string, contentType: string }>, skipReason: string | null }}
 */
export function planVariants(meta, bucketKey) {
  const contentType = String(meta?.contentType ?? '').split(';')[0].trim().toLowerCase()
  if (contentType.startsWith('video/')) return skip('video: no variants')
  if (contentType === 'image/svg+xml') return skip('svg: never decoded, no variants')
  if (contentType === 'image/x-icon' || contentType === 'image/vnd.microsoft.icon') {
    return skip('ico: no variants')
  }
  if (contentType === 'image/gif') return skip('gif: may be animated, no variants')
  if (!RASTER_TYPES.has(contentType)) return skip(`type ${contentType || 'unknown'}: not a raster image`)
  if ((meta.pages ?? 1) > 1) return skip('animated image: no variants')
  if (!Number.isInteger(meta.width) || meta.width <= 0) return skip('unknown image width')

  const variants = []
  for (const width of VARIANT_WIDTHS) {
    // Strictly narrower than the original: never upscale, never duplicate.
    if (width >= meta.width) continue
    for (const format of VARIANT_FORMATS) {
      variants.push({
        width,
        format,
        key: variantKey(width, format, bucketKey),
        spec: variantSpec(width, format),
        contentType: MIME[format],
      })
    }
  }
  return { variants, skipReason: variants.length ? null : 'original is not wider than the smallest variant' }
}

function skip(reason) {
  return { variants: [], skipReason: reason }
}

/**
 * @param {Buffer | Uint8Array} input
 * @param {number} width
 * @param {'avif' | 'webp'} format
 */
export async function encodeVariant(input, width, format) {
  // .rotate() applies EXIF orientation: sharp strips metadata on output, so
  // without it phone photos would come out sideways.
  const pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true })
  const encoded =
    format === 'webp'
      ? pipeline.webp({ quality: QUALITY.webp, effort: EFFORT })
      : pipeline.avif({ quality: QUALITY.avif, effort: EFFORT })
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
  return { data, info, contentType: MIME[format] }
}
