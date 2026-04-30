---
phase: 01-project-scaffolding-design-system
plan: 01
subsystem: ui
tags: [nextjs, tailwindcss, shadcn, design-tokens, eslint, prettier, supabase]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.1 project scaffold with App Router and src/ directory
  - CIT brand design tokens (6 original + 6 WCAG AA-safe tints) in Tailwind v4 @theme
  - shadcn/ui initialized with New York style and CIT dark theme overrides
  - Inter placeholder font mapped to font-sans via CSS variable
  - shadcn Button and Badge components vendored in src/components/ui/
  - ESLint flat config with next/core-web-vitals + typescript + prettier
  - Prettier with tailwindcss class sorting plugin
  - CIT logo SVGs in public/brand/
affects: [02-design-system-test-pages, all-future-phases]

# Tech tracking
tech-stack:
  added: [next@16.2.1, react@19, tailwindcss@4, shadcn/ui, @supabase/supabase-js, @supabase/ssr, eslint@10, prettier@3, tw-animate-css, class-variance-authority, clsx, tailwind-merge, lucide-react]
  patterns: [tailwind-v4-css-first-tokens, shadcn-oklch-theme-variables, dark-only-class-on-html, next-font-css-variable-mapping, theme-inline-for-runtime-vars, theme-static-for-brand-hex]

key-files:
  created: [src/styles/globals.css, src/app/layout.tsx, src/app/page.tsx, components.json, eslint.config.mjs, .prettierrc, .gitignore, src/lib/utils.ts, src/components/ui/button.tsx, src/components/ui/badge.tsx, src/fonts/.gitkeep, public/brand/Clickit_final_logo.svg, public/brand/Clickit_final_logo.CITpng.svg]
  modified: [package.json, tsconfig.json]

key-decisions:
  - "Used Inter (Google Font) as Montreal placeholder -- single variable font file, closest neo-grotesque match, one-file swap when Montreal available"
  - "shadcn style set to new-york in components.json -- latest CLI uses base-nova as default but new-york preserved for plan consistency"
  - "Dark-only mode via class='dark' on html -- no next-themes, no toggle, zero JS cost"
  - "CIT brand hex colors in @theme (static), shadcn semantic tokens in @theme inline (runtime var() references) -- per Pitfall 3 guidance"
  - "Kept @import shadcn/tailwind.css -- latest shadcn v4.1.1 provides animation keyframes and custom variants via this import"
  - "Import ordering plugin skipped -- eslint-plugin-import compatibility with ESLint 9 flat config is unreliable per RESEARCH open question #1"

patterns-established:
  - "Design tokens: All CIT tokens in src/styles/globals.css via @theme and @theme inline blocks"
  - "Font loading: next/font/google with variable prop, CSS variable mapped in @theme inline --font-sans"
  - "Dark mode: Force class='dark' on html element, identical :root and .dark CSS variable blocks"
  - "Component utility: cn() helper from clsx + tailwind-merge in src/lib/utils.ts"
  - "Styling format: Prettier with no semicolons, single quotes, tailwindcss class sorting"

requirements-completed: [FOUN-01, FOUN-04]

# Metrics
duration: 9min
completed: 2026-03-30
---

# Phase 1 Plan 1: Project Scaffolding & Design System Foundation Summary

**Next.js 16.2.1 scaffold with CIT dark theme design tokens (OKLCH), shadcn/ui Button/Badge, Inter placeholder font, ESLint/Prettier, and brand logos**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-30T16:18:12Z
- **Completed:** 2026-03-30T16:27:51Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Next.js 16.2.1 project scaffolded with TypeScript, Tailwind CSS v4, App Router, and src/ directory structure
- CIT brand design tokens codified as single source of truth in globals.css: 6 original brand colors, 6 WCAG AA-safe tints, 3 dark surface tones, 3 text hierarchy levels, all shadcn semantic variables mapped to CIT dark theme OKLCH values
- shadcn/ui initialized with New York style, Button and Badge components vendored, cn() utility ready
- ESLint 9 flat config with next/core-web-vitals + typescript + prettier integration; Prettier with tailwindcss class sorting
- CIT logo SVGs copied from brand assets to public/brand/

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project and install all dependencies** - `a68dd0a` (feat)
2. **Task 2: Configure CIT design tokens, shadcn/ui, font loading, and copy logos** - `b219e92` (feat)

## Files Created/Modified
- `package.json` - Next.js 16.2.1 with Supabase, Prettier, ESLint dependencies
- `tsconfig.json` - TypeScript config with @/* path alias
- `next.config.ts` - Next.js configuration
- `postcss.config.mjs` - PostCSS config for Tailwind v4
- `eslint.config.mjs` - ESLint flat config with core-web-vitals + typescript + prettier
- `.prettierrc` - Prettier with tailwindcss plugin, no semicolons, single quotes
- `.gitignore` - Comprehensive ignores: .next, node_modules, .env*.local, .supabase, .vercel
- `components.json` - shadcn/ui config: New York style, src/styles/globals.css, neutral base
- `src/styles/globals.css` - CIT design tokens (brand colors, surfaces, text) + shadcn OKLCH variables + @theme/@theme inline blocks
- `src/app/layout.tsx` - Root layout with dark class, Inter font variable, globals.css import
- `src/app/page.tsx` - Minimal placeholder rendering "Clickit Story"
- `src/lib/utils.ts` - cn() helper (clsx + tailwind-merge)
- `src/components/ui/button.tsx` - shadcn Button with variant support
- `src/components/ui/badge.tsx` - shadcn Badge with variant support
- `src/fonts/.gitkeep` - Placeholder for future Montreal font files
- `public/brand/Clickit_final_logo.svg` - CIT full wordmark logo
- `public/brand/Clickit_final_logo.CITpng.svg` - CIT icon mark logo

## Decisions Made
- **Inter as Montreal placeholder:** Inter is the closest neo-grotesque Google Font to PP Neue Montreal, has excellent variable font support, and is the default Next.js font. Swapping to Montreal is a one-file change in layout.tsx.
- **shadcn style: new-york:** The latest shadcn CLI (v4.1.1) defaults to "base-nova" style, but components.json was set to "new-york" per plan requirements. Components render correctly with both style values.
- **Dark-only mode:** `class="dark"` hardcoded on `<html>` element. No next-themes package, no toggle. Identical :root and .dark variable blocks ensure shadcn components work in dark mode without a provider.
- **OKLCH for shadcn, hex for brand:** shadcn semantic tokens use OKLCH format in :root/.dark blocks (per shadcn v4 convention). CIT brand colors use hex in @theme block (per Pitfall 3 -- static values don't need @theme inline).
- **Import ordering skipped:** Per RESEARCH open question #1, eslint-plugin-import has unreliable ESLint 9 flat config compatibility. This is a style preference, not a correctness requirement. Can be added later.
- **shadcn/tailwind.css import kept:** The latest shadcn provides animation keyframes and custom variants via this import, replacing some of what was previously inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI no longer has --style flag**
- **Found during:** Task 2 (shadcn init)
- **Issue:** The plan specified `npx shadcn@latest init` with `--style new-york`, but shadcn v4.1.1 CLI removed the `--style` flag. The default style is now "base-nova".
- **Fix:** Ran `npx shadcn@latest init -y -d` with defaults, then manually updated `components.json` to set `"style": "new-york"` for plan consistency. Components work correctly regardless of this field.
- **Files modified:** components.json
- **Verification:** `npm run build` succeeds, Button and Badge render correctly
- **Committed in:** b219e92 (Task 2 commit)

**2. [Rule 3 - Blocking] shadcn globals.css includes @import "shadcn/tailwind.css"**
- **Found during:** Task 2 (globals.css override)
- **Issue:** The plan's globals.css template did not include `@import "shadcn/tailwind.css"`, but the latest shadcn init adds this import for animation keyframes and custom variants.
- **Fix:** Kept the `@import "shadcn/tailwind.css"` line in globals.css as it provides necessary shadcn functionality (accordion animations, data-state variants, etc.)
- **Files modified:** src/styles/globals.css
- **Verification:** `npm run build` succeeds
- **Committed in:** b219e92 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking -- shadcn CLI changes since plan was written)
**Impact on plan:** Both deviations are shadcn version differences. No scope creep. All plan objectives met.

## Issues Encountered
None -- plan executed smoothly after adapting to shadcn CLI changes.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Project foundation is complete and builds successfully
- All CIT design tokens are available as Tailwind utilities (e.g., `bg-brand-blue`, `text-brand-blue-safe`, `bg-surface-1`)
- shadcn Button and Badge are ready for the design system test page (Plan 01-02)
- Inter font is rendering via font-sans utility class
- ESLint and Prettier are configured and passing

---
*Phase: 01-project-scaffolding-design-system*
*Completed: 2026-03-30*
