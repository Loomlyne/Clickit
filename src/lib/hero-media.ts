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

/**
 * Resolves the single best hero media to render for a given viewport.
 *
 * Priority chains:
 *   Mobile:  mobile video > desktop video > mobile image > desktop image > null
 *   Desktop: desktop video > desktop image > null
 *
 * Why the mobile chain prefers desktop video over mobile image: a video carries
 * more storytelling weight than an image, and a slightly-cropped desktop video
 * on mobile still communicates motion/brand better than a static image. The
 * admin can always upload a mobile-specific variant if cropping is wrong.
 *
 * Pure function — no React, no Next, no browser APIs. Safe to test standalone.
 */
export function resolveHeroMedia(
  isMobile: boolean,
  input: HeroMediaInput,
): HeroMediaChoice {
  const { videoUrl, videoType, mobileVideoUrl, mobileVideoType, imageUrl, mobileImageUrl } = input

  if (isMobile) {
    if (mobileVideoUrl && mobileVideoType) return { kind: 'video', url: mobileVideoUrl, type: mobileVideoType }
    if (videoUrl && videoType) return { kind: 'video', url: videoUrl, type: videoType }
    if (mobileImageUrl) return { kind: 'image', url: mobileImageUrl }
    if (imageUrl) return { kind: 'image', url: imageUrl }
    return null
  }
  if (videoUrl && videoType) return { kind: 'video', url: videoUrl, type: videoType }
  if (imageUrl) return { kind: 'image', url: imageUrl }
  return null
}
