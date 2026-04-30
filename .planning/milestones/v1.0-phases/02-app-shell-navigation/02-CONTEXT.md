# Phase 2: App Shell & Navigation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the dark cinematic app shell that wraps every page — a floating glass-effect navigation bar with the CIT logo and auth button, plus a full-bleed layout structure. No content yet. This is the chrome every future phase builds inside.

</domain>

<decisions>
## Implementation Decisions

### Navigation Bar Structure
- **D-01:** Ultra-minimal nav: `[CIT Logo]` on the left, `[Sign In / Avatar]` on the right. Nothing else — no links, no search icon. Clean and efficient.
- **D-02:** Logo is the home button (clicking navigates to `/`). No separate "Home" link.
- **D-03:** Content discovery is through scrolling on the home page, not nav links. Nav links would add friction and aren't needed for this catalog size.
- **D-04:** Same nav structure on mobile — not a hamburger or drawer, just the same minimal layout scaled responsively.

### Nav Scroll Behavior
- **D-05:** Always visible — nav floats over content at all times with glass effect always shown. No scroll listener needed. Pure CSS `position: fixed` with `backdrop-filter: blur()`.

### Auth States in Nav
- **D-06:** Unauthenticated: "Sign In" button on the right.
- **D-07:** Authenticated: Initial letter of user's name in a circle (avatar) replaces Sign In. Clicking opens a dropdown with: My List, Profile, Sign Out.

### Page Layout
- **D-08:** Full bleed — content goes edge-to-edge. Cinematic, Netflix-style. Individual sections handle their own inner horizontal padding.
- **D-09:** No global max-width wrapper on the root layout. Hero banners and content rails span the full viewport width.

### Claude's Discretion
- Glass effect exact values (backdrop-filter blur amount, background opacity — target: dark enough to read logo/text, light enough to feel premium)
- "Sign In" button variant (outline or ghost from shadcn Button — must be legible on dark backgrounds)
- Avatar dropdown component and animation
- Inner horizontal padding amount per section type (hero vs. rails vs. text)
- Whether a very subtle bottom border separates the nav from page content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System (Phase 1 output — MANDATORY reading)
- `.planning/phases/01-project-scaffolding-design-system/01-UI-SPEC.md` — Color tokens, WCAG-safe tints, typography scale, shadcn variable mapping
- `src/styles/globals.css` — All CIT design tokens (@theme block) — read before using any color or spacing value
- `src/app/layout.tsx` — Root layout to modify (add nav wrapper, understand current font/body setup)

### Brand Assets
- `public/brand/Clickit_final_logo.svg` — Full wordmark SVG (use this in nav on desktop and mobile)
- `public/brand/Clickit_final_logo.CITpng.svg` — CIT icon mark SVG (alternative if wordmark is too wide on mobile)

### Requirements
- `.planning/REQUIREMENTS.md` — NAVG-01 through NAVG-05, DESG-01, DESG-06, DESG-10

### Project Stack
- `CLAUDE.md` §Technology Stack — Framework versions, shadcn/ui patterns, Tailwind v4 conventions

### Prior Phase Context
- `.planning/phases/01-project-scaffolding-design-system/01-CONTEXT.md` — D-08 (dark-only, class="dark" non-negotiable), D-15 (New York style), D-16 (0.5rem radius)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn Button (New York). Use for "Sign In" — pick outline or ghost variant
- `src/components/ui/badge.tsx` — Available if needed for nav indicators
- `public/brand/` — Both CIT SVGs already in place, no asset work needed

### Established Patterns
- `bg-background` / `text-foreground` — the token pair for dark surfaces and text (from layout.tsx)
- `class="dark"` hardcoded on `<html>` — never conditional, never toggled
- `--font-inter` CSS variable loaded via next/font/google — applied via `font-sans` Tailwind utility
- Tailwind v4 `@theme` block in `globals.css` — all tokens live there, no tailwind.config.js

### Integration Points
- `src/app/layout.tsx` — Phase 2 adds the `<Navbar>` component inside `<body>`, above `{children}`
- `src/app/page.tsx` — Currently a placeholder; Phase 2 may update it to use the new layout
- New component: `src/components/layout/Navbar.tsx` (or similar) — the nav bar component

</code_context>

<specifics>
## Specific Ideas

- "Stylish floating navigation bar" — glass effect with blur, feels premium on dark backgrounds
- "Logo on the left, auth on the right" — matches how modern streaming and SaaS platforms look
- "Clear and efficient" — the user explicitly rejected extra nav links and search icon as clutter
- "Same on mobile" — no separate mobile nav pattern, just the same bar scaled responsively
- Platform must feel like a real streaming service — the nav should be invisible until needed, content is the star

</specifics>

<deferred>
## Deferred Ideas

- Search — explicitly removed from nav for now; if needed in future, can be a floating search overlay triggered from elsewhere (Phase 8)
- Nav links (Series, Coming Soon, My List) — removed from nav; these will be discoverable via home page scroll or addressed in future phases
- My List page — nav link removed, but My List exists in the avatar dropdown after login
- Footer — not part of Phase 2 scope; add in a later phase if needed

</deferred>

---

*Phase: 02-app-shell-navigation*
*Context gathered: 2026-03-31*
