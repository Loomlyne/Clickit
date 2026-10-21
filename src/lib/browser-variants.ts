// Pure helpers for browser-made WebP variants (MEDIA-04). No '@/' imports so
// node --test loads this file. The browser code that uses them is
// browser-upload.ts.

import { VARIANT_WIDTHS, type VariantWidth } from '../server/upload-kinds.ts'

/** Source types that never get variants (icons are tiny, gifs may be animated, svg is refused). */
const NO_VARIANT_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
  'image/svg+xml',
])

/**
 * Widths (of 640, 1280, 1920) strictly narrower than the source. A source at or
 * below 640 px gets none: the original is already small enough.
 */
export function planBrowserVariants(sourceWidth: number, sourceType?: string): VariantWidth[] {
  if (typeof sourceWidth !== 'number' || !Number.isFinite(sourceWidth) || sourceWidth <= 0) return []
  const type = (sourceType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (NO_VARIANT_TYPES.has(type)) return []
  return VARIANT_WIDTHS.filter((w) => w < sourceWidth)
}

/**
 * True only when the encoder really produced WebP. canvas.toBlob silently falls
 * back to PNG for types it cannot encode (Safari), and a PNG must never be
 * uploaded under a WebP variant key.
 */
export function isRealWebp(blob: { type?: string } | null | undefined): boolean {
  return Boolean(blob) && blob?.type === 'image/webp'
}

/** Width fixed to `targetWidth`, height scaled to keep the aspect ratio (at least 1). */
export function scaledSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number
): { width: number; height: number } {
  const height = Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth))
  return { width: targetWidth, height }
}

/** Whole percent (0 to 100) for the bar, from the original upload's loaded/total fraction. */
export function progressPercent(fraction: number): number {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))
  return Math.round(f * 100)
}

/** Line under the bar. The 3-copy text is exactly the signed one (mockups/DECISIONS.md). */
export function uploadProgressLine(kind: 'image' | 'video', variantCount: number): string {
  if (kind === 'video' || variantCount <= 0) return 'Uploading…'
  return `Uploading… then ${variantCount} smaller ${variantCount === 1 ? 'copy' : 'copies'}`
}

/** "3.4 MB" style size for the file row of the signed progress zone. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`
}
