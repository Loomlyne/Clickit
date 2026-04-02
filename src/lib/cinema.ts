/**
 * Shared cinematic constants for full-bleed hero backgrounds.
 * Left vignette + bottom fade + top fade — consistent across home hero and series detail.
 */
export const CINEMATIC_GRADIENT = [
  'linear-gradient(to right, rgba(8,8,12,0.96) 0%, rgba(8,8,12,0.72) 35%, rgba(8,8,12,0.25) 65%, rgba(8,8,12,0) 100%)',
  'linear-gradient(to top, rgba(8,8,12,1) 0%, rgba(8,8,12,0.85) 18%, rgba(8,8,12,0.3) 40%, rgba(8,8,12,0) 65%)',
  'linear-gradient(to bottom, rgba(8,8,12,0.4) 0%, transparent 15%)',
].join(', ')

export const CINEMA_EASE = [0.16, 1, 0.3, 1] as const
