/**
 * Which tokens the admin design-system page shows, and in what order.
 * Names only, NO imports: tests/unit/design-system-page.test.ts loads this file
 * under the plain node runner and proves every name is declared in globals.css
 * and every literal-colour declaration is listed here.
 *
 * Utility class names are spelled out in full so Tailwind generates them.
 */

export type TokenGroup = {
  id: 'surfaces' | 'lines' | 'text' | 'primary' | 'danger' | 'brand' | 'status'
  labelKey: string
  tokens: readonly string[]
}

/** The six CIT brand colours: base, AA-safe tint, and the message key of the colour name. */
export const BRAND_PAIRS = [
  { nameKey: 'brandBlue', base: '--color-brand-blue', safe: '--color-brand-blue-safe' },
  { nameKey: 'brandPurple', base: '--color-brand-purple', safe: '--color-brand-purple-safe' },
  { nameKey: 'brandGreen', base: '--color-brand-green', safe: '--color-brand-green-safe' },
  { nameKey: 'brandRed', base: '--color-brand-red', safe: '--color-brand-red-safe' },
  { nameKey: 'brandOrange', base: '--color-brand-orange', safe: '--color-brand-orange-safe' },
  { nameKey: 'brandSand', base: '--color-brand-yellow', safe: '--color-brand-yellow-safe' },
] as const

/** Status tones with the word printed on each sample chip. */
export const STATUS_SAMPLES = [
  { tone: 'success', token: '--status-success', labelKey: 'statusSuccess' },
  { tone: 'warning', token: '--status-warning', labelKey: 'statusWarning' },
  { tone: 'danger', token: '--status-danger', labelKey: 'statusDanger' },
  { tone: 'neutral', token: '--status-neutral', labelKey: 'statusNeutral' },
] as const

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    id: 'surfaces',
    labelKey: 'groupSurfaces',
    tokens: ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--bg-4'],
  },
  { id: 'lines', labelKey: 'groupLines', tokens: ['--line', '--line-2'] },
  { id: 'text', labelKey: 'groupText', tokens: ['--text', '--text-dim', '--text-mute'] },
  {
    id: 'primary',
    labelKey: 'groupPrimary',
    tokens: ['--primary', '--primary-foreground', '--uis-primary-hover', '--uis-primary-soft', '--ring'],
  },
  {
    id: 'danger',
    labelKey: 'groupDanger',
    tokens: ['--destructive', '--destructive-foreground'],
  },
  {
    id: 'brand',
    labelKey: 'groupBrand',
    tokens: BRAND_PAIRS.flatMap((pair) => [pair.base, pair.safe]),
  },
  {
    id: 'status',
    labelKey: 'groupStatus',
    tokens: [
      '--status-success',
      '--status-warning',
      '--status-danger',
      '--status-neutral',
      '--status-neutral-line',
    ],
  },
]

/**
 * Every other literal-colour declaration in globals.css: shadcn and sidebar aliases,
 * charts, the accent aliases, the exact-value tokens kept for the codemod, and the
 * UI System lines. They are pinned by tests, not drawn as swatches.
 */
export const ALIAS_TOKENS: readonly string[] = [
  '--accent',
  '--accent-fg',
  '--accent-foreground',
  '--accent-yellow',
  '--accent-yellow-fg',
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--border',
  '--input',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  '--uis-line',
  '--uis-line-strong',
  '--live-dot',
  '--scrim-nav',
  '--scrim-dialog',
  '--scrim-sheet',
  '--gradient-nav-fade',
]

/** The seven radius roles, each with the named utility and the role variable. */
export const RADIUS_SAMPLES = [
  { role: 'chip', utility: 'rounded-chip', token: '--uis-r-chip', labelKey: 'roleChip', useKey: 'roleUseChip' },
  { role: 'control', utility: 'rounded-control', token: '--uis-r-control', labelKey: 'roleControl', useKey: 'roleUseControl' },
  { role: 'shell', utility: 'rounded-shell', token: '--uis-r-shell', labelKey: 'roleShell', useKey: 'roleUseShell' },
  { role: 'field', utility: 'rounded-field', token: '--uis-r-field', labelKey: 'roleField', useKey: 'roleUseField' },
  { role: 'card', utility: 'rounded-card', token: '--uis-r-card', labelKey: 'roleCard', useKey: 'roleUseCard' },
  { role: 'media', utility: 'rounded-media', token: '--uis-r-media', labelKey: 'roleMedia', useKey: 'roleUseMedia' },
  { role: 'panel', utility: 'rounded-panel', token: '--uis-r-panel', labelKey: 'rolePanel', useKey: 'roleUsePanel' },
] as const

/** Shadows: four drawn on boxes, five listed with their computed value only. */
export const SHADOW_SAMPLES = {
  elevation: [
    { utility: 'shadow-panel', token: '--shadow-panel', useKey: 'shadowUsePanel' },
    { utility: 'shadow-soft', token: '--shadow-soft', useKey: 'shadowUseSoft' },
    { utility: 'shadow-popover', token: '--shadow-popover', useKey: 'shadowUsePopover' },
    { utility: 'shadow-modal', token: '--shadow-modal', useKey: 'shadowUseModal' },
  ],
  utility: [
    { utility: 'shadow-inset-hairline', token: '--shadow-inset-hairline', useKey: 'shadowUseInsetHairline' },
    { utility: 'shadow-live-dot', token: '--shadow-live-dot', useKey: 'shadowUseLiveDot' },
    { utility: 'shadow-cta-glow', token: '--shadow-cta-glow', useKey: 'shadowUseCtaGlow' },
    { utility: 'shadow-bar', token: '--shadow-bar', useKey: 'shadowUseBar' },
    { utility: 'drop-shadow-splash', token: '--drop-shadow-splash', useKey: 'shadowUseSplash' },
  ],
} as const
