/**
 * Vendored radius formula (test helper only).
 * Source: github.com/Loomlyne/ui-system, packages/core/src/radius.ts
 * Commit: 0404be9913cb4a5005eab357bea16278819bf7c0
 * Copied verbatim except the `./config` import, replaced by the inline types
 * below. Used by tests/unit/design-tokens.test.ts to prove the --uis-r-* roles
 * in globals.css equal what the UI System engine yields for ui.config.json.
 */

export type RadiusRole = 'chip' | 'control' | 'field' | 'card' | 'panel' | 'media' | 'shell'

export type RadiusConfig = {
  roundness: number
  pill?: boolean
  overrides?: Partial<Record<RadiusRole, number>>
}

/**
 * Radius engine. One roundness value (0..100) drives every role, so the whole
 * interface moves from sharp to round together. `pill` independently turns
 * controls, chips and nav shells into full pills (the "soft product" look).
 *
 *   role      at 0   at 100   pill
 *   chip      0      10       999
 *   control   0      14       999   buttons, nav items, segmented tabs
 *   field     0      14       999   inputs, selects
 *   card      0      24       -
 *   panel     0      32       -     popovers, drawers, dialogs, inset panels
 *   media     0      22       -     images, video, thumbnails
 *   shell     0      22       999   floating nav bars, docks, islands
 */

export const RADIUS_ROLES: RadiusRole[] = ['chip', 'control', 'field', 'card', 'panel', 'media', 'shell']

const MAX: Record<RadiusRole, number> = { chip: 10, control: 14, field: 14, card: 24, panel: 32, media: 22, shell: 22 }
const PILL_ROLES: RadiusRole[] = ['chip', 'control', 'field', 'shell']
export const PILL = 999

export interface RadiusTokens extends Record<RadiusRole, number> {
  /** Avatars: squares that soften, becoming circles past 70% roundness or in pill mode. */
  avatar: string
  /** Radius for content nested inside a panel with 8px padding. */
  inner: number
}

export function buildRadius(cfg: RadiusConfig): RadiusTokens {
  const t = Math.min(1, Math.max(0, (Number(cfg.roundness) || 0) / 100))
  const out = {} as RadiusTokens
  for (const role of RADIUS_ROLES) {
    out[role] = cfg.pill && PILL_ROLES.includes(role) ? PILL : Math.round(MAX[role] * t)
  }
  for (const [role, px] of Object.entries(cfg.overrides ?? {})) {
    if (typeof px === 'number' && Number.isFinite(px)) out[role as RadiusRole] = px
  }
  out.avatar = cfg.pill || t >= 0.7 ? '50%' : `${Math.round(16 * t)}px`
  out.inner = Math.max(0, out.panel - 8)
  return out
}

export const px = (n: number) => (n >= PILL ? '999px' : `${n}px`)
