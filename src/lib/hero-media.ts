export type HeroMediaChoice =
  | { kind: 'video'; url: string; type: 'mp4' | 'youtube' }
  | { kind: 'image'; url: string }
  | null

export interface HeroMediaInput {
  videoUrl?: string
  videoType?: 'mp4' | 'youtube'
  mobileVideoUrl?: string
  mobileVideoType?: 'mp4' | 'youtube'
  imageUrl?: string
  mobileImageUrl?: string
}

export interface HeroMediaOptions {
  allowVideo?: boolean
}

/**
 * Resolves the single best hero media to render for a given viewport.
 *
 * Priority chains:
 *   Mobile:  mobile video > mobile image > desktop video > desktop image > null
 *   Desktop: desktop video > desktop image > null
 *
 * Why the mobile chain prefers mobile image over desktop video: an uploaded
 * mobile image is the admin's explicit vertical crop. A desktop video is a
 * fallback only when no mobile-specific hero exists.
 *
 * Pure function, no React, no Next, no browser APIs. Safe to test standalone.
 */
export function resolveHeroMedia(
  isMobile: boolean,
  input: HeroMediaInput,
  { allowVideo = true }: HeroMediaOptions = {}
): HeroMediaChoice {
  const {
    videoUrl,
    videoType,
    mobileVideoUrl,
    mobileVideoType,
    imageUrl,
    mobileImageUrl,
  } = input

  if (isMobile) {
    if (allowVideo && mobileVideoUrl && mobileVideoType) {
      return { kind: 'video', url: mobileVideoUrl, type: mobileVideoType }
    }
    if (mobileImageUrl) return { kind: 'image', url: mobileImageUrl }
    if (allowVideo && videoUrl && videoType) {
      return { kind: 'video', url: videoUrl, type: videoType }
    }
    if (imageUrl) return { kind: 'image', url: imageUrl }
    return null
  }
  if (allowVideo && videoUrl && videoType) {
    return { kind: 'video', url: videoUrl, type: videoType }
  }
  if (imageUrl) return { kind: 'image', url: imageUrl }
  return null
}
