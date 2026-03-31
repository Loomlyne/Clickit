# Phase 3: Home Page & Catalog UI - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the cinematic home page and series listing page using static mock data. Delivers: (1) a full-viewport hero banner with auto-rotating shows and ambient color glow, (2) horizontal content rails with 16:9 show cards, and (3) a `/series` grid catalog page. No Supabase yet — all data is TypeScript mock objects. This is the visual centerpiece that proves CIT looks and feels like a real streaming service.

</domain>

<decisions>
## Implementation Decisions

### Hero Banner

- **D-01:** Full viewport height (100vh). The hero fills the entire screen on landing — the most immersive cinematic first impression.
- **D-02:** Auto-rotating carousel cycling through 2-3 featured shows. Uses a timer-based rotation — no manual arrow navigation needed.
- **D-03:** Background treatment: full-bleed show artwork + ambient color glow. The show's brand color (from `brandColor` field) radiates as a soft background glow behind/around the artwork, making each featured show feel uniquely branded. Dark gradient overlay ensures text legibility.
- **D-04:** Hero text overlay: show title (large, bold) + tagline/short description (1-2 lines) + single "Watch Now" CTA button.
- **D-05:** Transition: crossfade between featured shows (not slide/pan).
- **D-06:** Rotation indicator: a thin progress bar filling over the auto-rotation timer (replaces dot indicators). More modern, fewer UI elements.
- **D-07:** Pause on hover — auto-rotation pauses when the user hovers over the hero.
- **D-08:** Bottom edge: gradient fade to `--background` (`#0A0A0F`) — hero bleeds into the page. No hard edge between hero and content rails below.

### Show Card Design

- **D-09:** Card aspect ratio: landscape 16:9 (video thumbnail proportions). Cinematic, matches video content.
- **D-10:** Card info displayed: show artwork (16:9 thumbnail), show title, genre chip (badge), episode count chip.
- **D-11:** Show branded logo (SVG) positioned on the artwork in the bottom-left corner. Overlaid on the thumbnail, not in the text area below.
- **D-12:** Hover state: scale to 1.05 + semi-transparent dark overlay appears on the artwork with a centered "Watch" button. Uses `motion` for smooth animation. DESG-03 requirement met.
- **D-13:** Card surface: `--card` (`#1A1A22`) background for the text area below the artwork.

### Brand Ribbon

- **D-14:** Brand color ribbon placement: a 3-4px colored line at the very top edge of the card. Uses the show's assigned `brandColor` (one of the 5 CIT brand colors). Minimal but distinctive — visible on both the artwork and text sections of the card.
- **D-15:** Islamic geometric pattern textures deferred. Color only for Phase 3 — the pattern SVG assets are complex and can be layered in during a polish pass. DESG-08 is color-satisfied; pattern-satisfaction deferred.
- **D-16:** Brand color assigned manually per show in mock data (`brandColor: 'brand-purple'` etc.). Available Tailwind tokens: `brand-blue` (#2C3569), `brand-purple` (#9F54A0), `brand-green` (#50A258), `brand-red` (#DB3F34), `brand-orange` (#EA8C2E). No auto-assignment logic needed.

### Content Rails

- **D-17:** Home page shows all defined rails (Now Streaming, Coming Soon, by genre) even with sparse data. Rails that lack enough real shows use graceful "Coming Soon" placeholder cards — styled to match real cards but with a locked/grayed-out treatment and "Coming Soon" text. This prevents any rail from looking broken with 1-2 real cards.
- **D-18:** Placeholder cards slot in after real shows to reach a minimum visual density (target: ~4 cards visible per rail at a time on desktop).

### Mock Data

- **D-19:** Mock shows: 5 real CIT show names with placeholder artwork. Placeholder artwork = show's brand color as solid background + show title as centered text (no external images, no network dependency).
  - Show names to use: Last Call, Review Documentary, Doctor Care, Saturn Podcast, Poets Platform
  - Each gets a manually assigned `brandColor` from the 5 CIT brand colors
  - Each gets a `genre`, `episodeCount`, `status` (streaming/coming-soon), short `tagline`
- **D-20:** Mock data lives in a TypeScript file (e.g., `src/lib/mock-data.ts`). Exported as typed objects/arrays. Planner should design the shape to match the future Supabase schema (easier data integration in Phase 8).

### Series Listing Page

- **D-21:** Route: `/series` — dedicated catalog page listing all available shows.
- **D-22:** Layout: responsive grid — 4 columns on desktop (≥1280px), 3 on large tablet (≥1024px), 2 on tablet (≥640px), 1 on mobile. Uses the same 16:9 landscape card component from content rails.
- **D-23:** No filters for Phase 3 — too few shows to warrant filter UI. Clean grid only.

### Claude's Discretion

- Exact motion timing values (crossfade duration, card hover scale duration, progress bar fill speed)
- Hero content horizontal padding / text positioning (left-aligned vs. centered)
- Embla carousel configuration for content rails (loop, drag, touch behavior)
- Section header typography and spacing above each content rail
- Exact overlay opacity on card hover (must be enough to see Watch button, not so dark it kills the artwork)
- Whether content rails have "See All →" links (recommend yes for Now Streaming, but decide at implementation)
- Exact placeholder card visual treatment (opaque vs. translucent, blur on artwork area)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System (Phase 1 output — MANDATORY)
- `.planning/phases/01-project-scaffolding-design-system/01-UI-SPEC.md` — Color token values, WCAG-safe tints, typography scale, spacing tokens, shadcn variable mapping
- `src/styles/globals.css` — All CIT design tokens in `@theme` block — use these tokens, never hardcode hex values. Brand color tokens: `brand-blue`, `brand-purple`, `brand-green`, `brand-red`, `brand-orange` and their `-safe` WCAG variants. Surface tokens: `surface-1`, `surface-2`, `surface-3`. Text hierarchy: `text-primary`, `text-secondary`, `text-muted`.

### Project Brand & Branding Assets
- `.planning/PROJECT.md` §Design System — CIT brand colors, typography hierarchy, pattern system (5 brand colors, 4 pattern types), color harmony rules, logo asset locations
- `public/brand/Clickit_final_logo.svg` — Full CIT wordmark (white on dark, use in nav)
- `public/brand/Clickit_final_logo.CITpng.svg` — CIT icon mark SVG

### App Shell (Phase 2 output)
- `.planning/phases/02-app-shell-navigation/02-CONTEXT.md` — D-08 (full-bleed layout), D-09 (no global max-width), D-01 through D-07 (nav decisions)
- `src/components/layout/navbar.tsx` — Glass nav (already complete, do not modify)
- `src/app/layout.tsx` — Root layout (understand structure before adding new routes)

### Requirements
- `.planning/REQUIREMENTS.md` — CATL-01, CATL-02, CATL-08, CATL-09, CATL-10, DESG-02, DESG-03, DESG-04, DESG-05, DESG-07, DESG-08, DESG-09

### Stack Reference
- `CLAUDE.md` §Technology Stack — `motion` (^12.x) for animations, `embla-carousel-react` (^8.6.x) for content rails, Tailwind v4 CSS-first config, shadcn/ui New York style

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/badge.tsx` — shadcn Badge component. Use for genre chips and episode count chips on show cards. Already styled with CIT dark theme.
- `src/components/ui/button.tsx` — shadcn Button (New York style). Use for "Watch Now" CTA on hero and "Watch" overlay on card hover.
- `src/components/ui/dropdown-menu.tsx` — Available but not needed for this phase.
- `public/brand/` — Both CIT SVGs already in place.

### Established Patterns
- `bg-background` / `text-foreground` — Standard dark surface token pair
- `bg-card` (`#1A1A22`) — Use for card text area and any elevated surfaces
- `bg-surface-2` / `bg-surface-3` — Available for hover states on cards
- `class="dark"` on `<html>` — Always hardcoded, never conditional (Phase 1 D-08)
- Tailwind v4 `@theme` block in `globals.css` — All tokens live there, no `tailwind.config.js`
- `font-sans` applies Inter (Montreal placeholder) via `--font-inter` CSS variable

### Integration Points
- `src/app/page.tsx` — Current home page placeholder needs to be replaced with the hero + rails layout
- `src/app/layout.tsx` — Root layout wraps all pages; `<Navbar>` is already rendered here. New pages inherit it.
- New routes to create: `src/app/series/page.tsx` (catalog grid)

</code_context>

<specifics>
## Specific Ideas

- Hero feel: full-screen immersion with the show's brand color glowing behind the artwork — each show "owns" the full screen when it's featured
- Content rails: horizontal scroll with embla-carousel, same UX pattern used on Netflix/Disney+
- Show cards: 16:9 like a TV screen — the artwork IS the card, with a thin brand color top strip and minimal text below
- Logo bottom-left on artwork (like Netflix show cards show the show's title card treatment)
- Progress bar indicator on hero feels more like Apple TV+ than Netflix — premium and different

</specifics>

<deferred>
## Deferred Ideas

- Islamic geometric pattern textures on brand ribbons — deferred to a visual polish pass (Phase 3 delivers color-only ribbons)
- Genre/status filters on `/series` catalog page — deferred until catalog has enough shows (Phase 8+)
- Trailer preview on hover — explicitly out of scope per PROJECT.md
- Per-show "Coming Soon" countdown timers — out of scope per PROJECT.md
- Search bar — Phase 8 (SRCH-01 through SRCH-03)
- Continue watching rail — Phase 9 (USER-04 through USER-06)
- Watchlist button on cards — Phase 9 (USER-01, USER-02)

</deferred>

---

*Phase: 03-home-page-catalog-ui*
*Context gathered: 2026-03-31*
