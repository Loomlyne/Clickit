'use client'

import { buildImageUrl } from './src/lib/image-loader'
import { getPublicMediaOrigin } from './src/lib/supabase-media'

/**
 * next/image custom loader (replaces the Vercel image optimizer). Media-origin
 * URLs get `?w=<640|1280|1920>`, served by the clickit-media Worker from
 * pre-built R2 variants with the original as a permanent fallback. Every other
 * src is returned unchanged. With the cutover flag unset there is no media
 * origin, so nothing changes from today.
 */
export default function clickitImageLoader({
  src,
  width,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return buildImageUrl({ src, width, mediaOrigin: getPublicMediaOrigin() })
}
