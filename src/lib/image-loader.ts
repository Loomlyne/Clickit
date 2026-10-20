/**
 * Pure helpers for the next/image custom loader. No imports on purpose: the
 * loader entry (`image-loader.ts` at the repo root) is bundled for the client.
 *
 * Contract with the media Worker (`workers/media/src/handler.ts`): it serves
 * `<media origin>/<bucket>/<key>?w=<width>` and only honours the widths in its
 * `VARIANT_WIDTHS`; any other `?w=` silently serves the full-size original.
 * `tests/unit/image-loader.test.ts` fails if the two lists drift apart.
 */

export const LOADER_WIDTHS: readonly number[] = [640, 1280, 1920]

/** Nearest supported width >= the requested width, capped at the largest. */
export function pickVariantWidth(width: number): number {
  const largest = LOADER_WIDTHS[LOADER_WIDTHS.length - 1]
  if (!Number.isFinite(width) || width <= 0) return LOADER_WIDTHS[0]
  for (const candidate of LOADER_WIDTHS) {
    if (candidate >= width) return candidate
  }
  return largest
}

/**
 * Adds `?w=` to URLs on exactly the media origin. Everything else (YouTube,
 * Unsplash, Picsum, Supabase, data:, blob:, local paths, other hosts) is
 * returned unchanged, and so is every src when no media origin is active.
 */
export function buildImageUrl({
  src,
  width,
  mediaOrigin,
}: {
  src: string
  width: number
  mediaOrigin: string | null
}): string {
  if (!mediaOrigin) return src
  if (!src.startsWith('https://') && !src.startsWith('http://')) return src

  try {
    const url = new URL(src)
    if (url.origin !== mediaOrigin) return src
    url.searchParams.delete('w')
    url.searchParams.append('w', String(pickVariantWidth(width)))
    return url.toString()
  } catch {
    return src
  }
}
