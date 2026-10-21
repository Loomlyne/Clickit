/**
 * Shared cinematic constants for full-bleed hero backgrounds.
 * Left vignette + bottom fade + top fade — consistent across home hero and series detail.
 */
export const CINEMATIC_GRADIENT = [
  'linear-gradient(to right, rgb(var(--ink-cinema-rgb) / 0.96) 0%, rgb(var(--ink-cinema-rgb) / 0.72) 35%, rgb(var(--ink-cinema-rgb) / 0.25) 65%, rgb(var(--ink-cinema-rgb) / 0) 100%)',
  'linear-gradient(to top, rgb(var(--ink-cinema-rgb) / 1) 0%, rgb(var(--ink-cinema-rgb) / 0.85) 18%, rgb(var(--ink-cinema-rgb) / 0.3) 40%, rgb(var(--ink-cinema-rgb) / 0) 65%)',
  'linear-gradient(to bottom, rgb(var(--ink-cinema-rgb) / 0.4) 0%, transparent 15%)',
].join(', ')

export const CINEMA_EASE = [0.16, 1, 0.3, 1] as const
