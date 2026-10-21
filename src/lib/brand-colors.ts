import type { ViewShow } from '@/lib/queries'

/**
 * The one brand map (D-04). Desert Sand keeps the class name brand-yellow;
 * shows use only the 5 show keys (showSelectable). Values mirror the @theme
 * brand tokens in globals.css; tests/unit/brand-colors.test.ts pins the parity.
 */
export const BRAND_PALETTE = [
  { key: 'brand-blue', name: 'Innovative Blue', hex: '#2C3569', safeHex: '#8D9CFF', showSelectable: true },
  { key: 'brand-purple', name: 'Royal Purple', hex: '#9F54A0', safeHex: '#C592FF', showSelectable: true },
  { key: 'brand-green', name: 'Oasis Green', hex: '#50A258', safeHex: '#77D586', showSelectable: true },
  { key: 'brand-red', name: 'Crimson Red', hex: '#DB3F34', safeHex: '#FF8B82', showSelectable: true },
  { key: 'brand-orange', name: 'Sunset Orange', hex: '#EA8C2E', safeHex: '#FFB46E', showSelectable: true },
  { key: 'brand-yellow', name: 'Desert Sand', hex: '#F8C623', safeHex: '#F8D86F', showSelectable: false },
] as const

export const BRAND_COLOR_HEX = Object.fromEntries(
  BRAND_PALETTE.filter((p) => p.showSelectable).map((p) => [p.key, p.hex])
) as Record<ViewShow['brandColor'], string>

export const BRAND_COLOR_BG: Record<ViewShow['brandColor'], string> = {
  'brand-blue': 'bg-brand-blue',
  'brand-purple': 'bg-brand-purple',
  'brand-green': 'bg-brand-green',
  'brand-red': 'bg-brand-red',
  'brand-orange': 'bg-brand-orange',
}

export const BRAND_COLOR_TEXT: Record<ViewShow['brandColor'], string> = {
  'brand-blue': 'text-brand-blue',
  'brand-purple': 'text-brand-purple',
  'brand-green': 'text-brand-green',
  'brand-red': 'text-brand-red',
  'brand-orange': 'text-brand-orange',
}

/** Accent for a show whose brand_color is not a known key. */
export const NEUTRAL_ACCENT_HEX = '#A1A1A1'

/** Genre tile fallback (Innovative Blue). */
export const DEFAULT_GENRE_HEX = BRAND_PALETTE[0].hex

/** Landing genre-pill fallback (Innovative Blue, safe tint). */
export const DEFAULT_CATEGORY_PILL_HEX = BRAND_PALETTE[0].safeHex

/** Category hex input placeholder (Desert Sand). */
export const CATEGORY_HEX_PLACEHOLDER = BRAND_PALETTE[5].hex

/** Native colour input value while no colour is set. */
export const COLOR_INPUT_EMPTY_HEX = '#000000'

/** Swatch shown in the category picker before a colour is chosen. */
export const COLOR_PICKER_RAINBOW =
  'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
