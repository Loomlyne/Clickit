import type { CSSProperties } from 'react'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Tinted chip styles for admin category badges from a #RRGGBB color. */
export function categoryChipStyle(hex: string): CSSProperties {
  const rgb = hexToRgb(hex)
  if (!rgb) return {}
  const lum = relativeLuminance(hex)
  const text = lum > 0.55 ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.95)'
  return {
    backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`,
    borderColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`,
    color: text,
  }
}
