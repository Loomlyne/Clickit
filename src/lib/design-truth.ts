/**
 * Design truth: the signed values of the Clickit look, plus the maps the Phase 4
 * codemod and the admin design page share.
 *
 * Pure data and pure functions, NO imports, so both the Next app and the node
 * test runner (strip-types, no `@/` alias) can load this file.
 *
 * Source of truth for the values is src/styles/globals.css; tests/unit/design-tokens.test.ts
 * fails when the two disagree. Change a signed value in both places, with Koss's word.
 */

/** Every font stack starts with the local LBC font variable. */
export const SIGNED_FONT_PREFIX = 'var(--font-lbc)'

/** The pinned token set: name -> value exactly as spelled in globals.css. */
export const SIGNED_TOKENS: Readonly<Record<string, string>> = {
  // Base palette (D-01: #090909 warm-black)
  '--bg-0': '#090909',
  '--bg-1': '#101010',
  '--bg-2': '#191919',
  '--bg-3': '#2A2A2A',
  '--bg-4': '#424242',
  '--line': 'rgba(255, 255, 255, 0.08)',
  '--line-2': 'rgba(255, 255, 255, 0.14)',
  '--text': '#F4F4F4',
  '--text-dim': '#CCCCCC',
  '--text-mute': '#A1A1A1',

  // Brand yellow and ink
  '--primary': '#ffcc00',
  '--primary-foreground': '#090909',
  '--uis-primary-hover': '#D7AD16',
  '--uis-primary-soft': '#312915',
  '--ring': 'rgba(255, 204, 0, 0.5)',
  '--destructive': '#ff3b30',
  '--destructive-foreground': '#fff',

  // shadcn semantic tokens
  '--background': '#090909',
  '--foreground': '#F4F4F4',
  '--card': '#101010',
  '--card-foreground': '#F4F4F4',
  '--popover': '#101010',
  '--secondary': '#191919',
  '--muted': '#191919',
  '--muted-foreground': '#CCCCCC',
  '--border': 'rgba(255, 255, 255, 0.08)',
  '--input': 'rgba(255, 255, 255, 0.08)',
  '--uis-line': '#2A2A2A',
  '--uis-line-strong': '#424242',

  // Radius (D-02): base + the seven UI System roles + the standard scale
  '--radius': '8px',
  '--uis-r-chip': '999px',
  '--uis-r-control': '999px',
  '--uis-r-shell': '999px',
  '--uis-r-field': '8px',
  '--uis-r-card': '12px',
  '--uis-r-media': '11px',
  '--uis-r-panel': '16px',
  '--radius-sm': '4px',
  '--radius-md': '6px',
  '--radius-lg': '8px',
  '--radius-xl': '10px',
  '--radius-2xl': '12px',
  '--radius-hairline': '1px',

  // Named shadows (D-03 for cta-glow)
  '--shadow-soft': '0 24px 80px rgba(0, 0, 0, 0.38)',
  '--shadow-panel': '0 10px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  '--shadow-popover': '0 24px 80px rgba(0, 0, 0, 0.42)',
  '--shadow-modal': '0 40px 120px rgba(0, 0, 0, 0.6)',
  '--shadow-bar': '0 8px 32px -8px rgba(0, 0, 0, 0.65)',
  '--shadow-inset-hairline': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  '--shadow-live-dot': '0 0 6px rgba(239, 68, 68, 0.9)',
  '--shadow-cta-glow': '0 16px 40px rgba(255, 204, 0, 0.18)',
  '--drop-shadow-splash': '0 24px 80px rgba(0, 0, 0, 0.55)',

  // Brand colours (D-04): base and the AA-safe tints used for text on dark
  '--color-brand-blue': '#2c3569',
  '--color-brand-purple': '#9f54a0',
  '--color-brand-green': '#50a258',
  '--color-brand-red': '#db3f34',
  '--color-brand-orange': '#ea8c2e',
  '--color-brand-yellow': '#f8c623',
  '--color-brand-blue-safe': '#8d9cff',
  '--color-brand-purple-safe': '#c592ff',
  '--color-brand-green-safe': '#77d586',
  '--color-brand-red-safe': '#ff8b82',
  '--color-brand-orange-safe': '#ffb46e',
  '--color-brand-yellow-safe': '#f8d86f',

  // Status tones (same values as the safe tints)
  '--status-success': 'var(--color-brand-green-safe)',
  '--status-warning': 'var(--color-brand-orange-safe)',
  '--status-danger': 'var(--color-brand-red-safe)',
  '--status-neutral': 'var(--text-mute)',
  '--status-neutral-line': 'var(--line-2)',
}

/** Bracket radius classes -> named or standard utility with the same px. */
export const RADIUS_CODEMOD: ReadonlyArray<{ from: string; to: string; px: number }> = [
  { from: 'rounded-[12px]', to: 'rounded-card', px: 12 },
  { from: 'rounded-[11px]', to: 'rounded-media', px: 11 },
  { from: 'rounded-[8px]', to: 'rounded-field', px: 8 },
  { from: 'rounded-[16px]', to: 'rounded-panel', px: 16 },
  { from: 'rounded-t-[16px]', to: 'rounded-t-panel', px: 16 },
  { from: 'rounded-[10px]', to: 'rounded-xl', px: 10 },
  { from: 'rounded-[6px]', to: 'rounded-md', px: 6 },
  { from: 'rounded-b-[4px]', to: 'rounded-b-sm', px: 4 },
  { from: 'rounded-[1px]', to: 'rounded-hairline', px: 1 },
  { from: 'rounded-[var(--uis-r-media)]', to: 'rounded-media', px: 11 },
]

/**
 * Bracket shadow classes -> named shadow utility. `changes: 'D-03'` marks the two
 * rows whose rendered value moves on purpose (owner decision D-03): the toaster
 * shadow 0.45 -> 0.42 alpha, and the indigo CTA glow -> brand-yellow glow.
 */
export const SHADOW_CODEMOD: ReadonlyArray<{ from: string; to: string; changes?: 'D-03' }> = [
  { from: 'shadow-[0_24px_80px_rgba(0,0,0,0.42)]', to: 'shadow-popover' },
  { from: 'shadow-[0_24px_80px_rgba(0,0,0,0.45)]', to: 'shadow-popover', changes: 'D-03' },
  { from: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', to: 'shadow-inset-hairline' },
  { from: 'shadow-[0_0_6px_rgba(239,68,68,0.9)]', to: 'shadow-live-dot' },
  { from: 'shadow-[0_40px_120px_rgba(0,0,0,0.6)]', to: 'shadow-modal' },
  { from: 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.65)]', to: 'shadow-bar' },
  { from: 'drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]', to: 'drop-shadow-splash' },
  { from: 'shadow-[0_16px_40px_rgba(96,115,255,0.28)]', to: 'shadow-cta-glow', changes: 'D-03' },
  { from: 'shadow-[var(--shadow-soft)]', to: 'shadow-soft' },
  { from: 'shadow-[var(--shadow-panel)]', to: 'shadow-panel' },
]

export type StatusTone = {
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  cssVar: string
  oldClasses: readonly string[]
  newClasses: readonly string[]
}

/** Status chips: the old brand-*-safe / raw-var classes and the status-* names that replace them. */
export const STATUS_TONES: ReadonlyArray<StatusTone> = [
  {
    tone: 'success',
    cssVar: '--status-success',
    oldClasses: ['text-brand-green-safe', 'border-brand-green-safe/35', 'bg-brand-green-safe/8'],
    newClasses: ['text-status-success', 'border-status-success/35', 'bg-status-success/8'],
  },
  {
    tone: 'warning',
    cssVar: '--status-warning',
    oldClasses: ['text-brand-orange-safe', 'border-brand-orange-safe/35', 'bg-brand-orange-safe/8'],
    newClasses: ['text-status-warning', 'border-status-warning/35', 'bg-status-warning/8'],
  },
  {
    tone: 'danger',
    cssVar: '--status-danger',
    oldClasses: ['text-brand-red-safe', 'border-brand-red-safe/35', 'bg-brand-red-safe/8'],
    newClasses: ['text-status-danger', 'border-status-danger/35', 'bg-status-danger/8'],
  },
  {
    tone: 'neutral',
    cssVar: '--status-neutral',
    oldClasses: ['text-[var(--text-mute)]', 'border-[var(--line-2)]'],
    newClasses: ['text-status-neutral', 'border-status-neutral-line'],
  },
]

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)))
}

function toHex2(n: number): string {
  return clamp255(n).toString(16).padStart(2, '0').toUpperCase()
}

function formatAlpha(a: number): string {
  return String(Number(Math.min(1, Math.max(0, a)).toFixed(2)))
}

function colour(r: number, g: number, b: number, a: number): string {
  const alpha = Number(Math.min(1, Math.max(0, a)).toFixed(2))
  if (alpha >= 1) return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
  return `rgba(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)}, ${formatAlpha(alpha)})`
}

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`
// rgb()/rgba() with plain numbers only; var() arguments never match and are left alone.
const RGB_FN = new RegExp(
  String.raw`rgba?\(\s*${NUM}\s*[,\s]\s*${NUM}\s*[,\s]\s*${NUM}\s*(?:[,/]\s*${NUM}(%?)\s*)?\)`,
  'gi'
)

/**
 * Normalise a CSS colour (or a value containing rgb()/rgba() colours) so two
 * spellings of the same value compare equal: whole-string hex becomes upper-case
 * #RRGGBB (or rgba() when alpha < 1); rgb()/rgba() in either syntax becomes
 * rgba(r, g, b, a) with a 0-prefixed alpha (or #RRGGBB when opaque).
 */
export function normalizeCssValue(value: string): string {
  let v = value.trim().replace(/\s+/g, ' ')
  if (v === '') return ''

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v)
  if (hex) {
    let h = hex[1]
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return colour(r, g, b, a)
  }

  v = v.replace(RGB_FN, (_m, r: string, g: string, b: string, a: string | undefined, pct: string) => {
    let alpha = a === undefined ? 1 : parseFloat(a)
    if (pct === '%') alpha /= 100
    return colour(parseFloat(r), parseFloat(g), parseFloat(b), alpha)
  })
  return v
}

function luminance(hex: string): number {
  const h = hex.slice(1)
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG 2.x contrast ratio between two opaque colours (any hex spelling). */
export function contrastRatio(a: string, b: string): number {
  const ha = normalizeCssValue(a)
  const hb = normalizeCssValue(b)
  if (!/^#[0-9A-F]{6}$/.test(ha) || !/^#[0-9A-F]{6}$/.test(hb)) {
    throw new Error(`contrastRatio needs opaque colours, got "${a}" and "${b}"`)
  }
  const la = luminance(ha)
  const lb = luminance(hb)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Compare-ready spelling of a computed CSS value. The browser returns custom
 * properties as the production stylesheet spells them, and the build minifier
 * rewrites rgba() as #rrggbbaa and drops spaces after commas. Embedded hex colours
 * become rgba()/#RRGGBB like normalizeCssValue, and list commas get one space.
 * Two spellings of the same value give the same string; empty stays empty.
 */
export function canonicalCssValue(value: string): string {
  let v = value.trim().replace(/\s+/g, ' ')
  if (v === '') return ''
  v = v.replace(/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b/gi, (hex) => normalizeCssValue(hex))
  return normalizeCssValue(v).replace(/\s*,\s*/g, ', ')
}

/**
 * Signed value of a pinned token with `var(--other)` references followed to the
 * final value: the browser resolves those before returning a custom property.
 */
export function resolveSignedValue(name: string, depth = 0): string | undefined {
  const raw = SIGNED_TOKENS[name]
  if (raw === undefined) return undefined
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(raw)
  if (ref && depth < 5) return resolveSignedValue(ref[1], depth + 1)
  return raw
}
