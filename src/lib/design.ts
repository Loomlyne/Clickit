// Design variant flag.
//
// Selects between the default rounded-glassmorphic design and the editorial
// monochrome variant ported from the Claude Design handoff bundle at
// Clickit- handoff/. Controlled at build time via NEXT_PUBLIC_DESIGN.
//
// Because the env var is prefixed NEXT_PUBLIC_, Next.js inlines its value
// during the build, which means `if (isEditorial)` guards at module scope
// become dead-code-eliminated branches in the production bundle — the
// unused component tree never ships.
//
// This is consumed by:
// - src/app/layout.tsx — sets `data-design` attribute + font variables on <html>
// - (viewer)/*/page.tsx and admin/*/page.tsx — route-level component selection
// - individual component barrels that re-export the right variant

export type DesignVariant = 'default' | 'editorial'

export const DESIGN: DesignVariant =
  process.env.NEXT_PUBLIC_DESIGN === 'editorial' ? 'editorial' : 'default'

export const isEditorial = DESIGN === 'editorial'
