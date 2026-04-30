---
phase: 03-home-page-catalog-ui
plan: 01
subsystem: ui
tags: [motion, embla-carousel, shadcn, show-card, mock-data, tailwind-v4, brand-colors]

# Dependency graph
requires:
  - phase: 01-project-scaffolding-design-system
    provides: shadcn/ui setup, design tokens (brand colors, surfaces, typography), Badge and Button components
provides:
  - Show interface and typed mock data (5 shows with brand colors)
  - brandColorBgMap, brandColorTextMap, brandColorHexMap static class mappings
  - FEATURED_SHOWS, NOW_STREAMING, COMING_SOON_SHOWS helper arrays
  - ShowCard client component with motion hover, brand ribbon, badges
  - PlaceholderCard server component with muted skeleton treatment
  - shadcn Card and Carousel primitives
  - motion and embla-carousel-react dependencies installed
affects: [03-02-PLAN, 03-03-PLAN, 04-series-detail, 05-watch-page]

# Tech tracking
tech-stack:
  added: [motion ^12.38.0, embla-carousel ^8.6.0, embla-carousel-react ^8.6.0, shadcn Card, shadcn Carousel]
  patterns: [static brand color class maps for Tailwind v4, motion.div whileHover for card interactions, group-focus-within for keyboard accessible hover overlays]

key-files:
  created:
    - src/lib/mock-data.ts
    - src/components/shows/show-card.tsx
    - src/components/shows/placeholder-card.tsx
    - src/components/ui/card.tsx
    - src/components/ui/carousel.tsx
  modified:
    - package.json

key-decisions:
  - "Static brand color maps (brandColorBgMap, brandColorTextMap, brandColorHexMap) instead of dynamic Tailwind class strings -- required for Tailwind v4 CSS-first config which cannot detect dynamically constructed class names"
  - "ShowCard uses group-focus-within alongside group-hover to ensure Watch overlay is keyboard accessible"
  - "PlaceholderCard is a server component (no 'use client') with aria-hidden for zero JS overhead on decorative elements"

patterns-established:
  - "Brand color mapping: Always use static map objects from mock-data.ts, never construct bg-brand-${color} dynamically"
  - "Show card pattern: motion.div wrapper with whileHover scale, group class for hover/focus state propagation"
  - "Placeholder pattern: Server component, aria-hidden, opacity-60, skeleton divs matching real component dimensions"

requirements-completed: [CATL-09, CATL-10, DESG-03, DESG-04, DESG-05, DESG-08, DESG-09]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 3 Plan 01: Foundation Components Summary

**ShowCard with motion hover effects, PlaceholderCard skeleton, typed mock data with 5 CIT shows, and brand color static maps for Tailwind v4**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T07:34:29Z
- **Completed:** 2026-03-31T07:37:29Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Installed Phase 3 dependencies (motion, embla-carousel-react) and added shadcn Card + Carousel primitives
- Created typed Show interface with 5 mock shows matching real CIT programs, 3 brand color static maps, and helper arrays for content rail grouping
- Built ShowCard client component with motion whileHover scale (1.05), brand ribbon, 16:9 artwork placeholder, dark hover overlay with Watch button, genre/episode count badges, and keyboard accessibility
- Built PlaceholderCard server component with muted opacity-60 treatment, skeleton placeholders, and aria-hidden for decorative non-interactive display

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and add shadcn components** - `785153e` (chore)
2. **Task 2: Create mock data types, show data, and brand color maps** - `b685762` (feat)
3. **Task 3: Build ShowCard and PlaceholderCard components** - `e7f0be7` (feat)

## Files Created/Modified
- `src/lib/mock-data.ts` - Show interface, MOCK_SHOWS array (5 shows), brand color maps (bg/text/hex), helper arrays (FEATURED_SHOWS, NOW_STREAMING, COMING_SOON_SHOWS)
- `src/components/shows/show-card.tsx` - Interactive show card with motion hover scale, brand ribbon, artwork area, hover overlay with Watch button, genre and episode count badges
- `src/components/shows/placeholder-card.tsx` - Non-interactive placeholder card with muted treatment, skeleton lines, aria-hidden
- `src/components/ui/card.tsx` - shadcn Card primitive (Card, CardHeader, CardTitle, CardContent, CardFooter, CardAction, CardDescription)
- `src/components/ui/carousel.tsx` - shadcn Carousel primitive wrapping embla-carousel-react (Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext)
- `package.json` - Added motion, embla-carousel, embla-carousel-react dependencies

## Decisions Made
- Static brand color maps instead of dynamic Tailwind class strings (Tailwind v4 cannot detect dynamically constructed classes)
- ShowCard uses group-focus-within alongside group-hover to ensure Watch overlay is keyboard accessible without duplicating hover logic
- PlaceholderCard is a server component with no 'use client' directive and aria-hidden="true" for zero JS overhead on decorative elements

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were already completed in prior commits (785153e, b685762); Task 3 was executed fresh.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components render real mock data. Brand color artwork placeholders (solid color background with title text) are intentional Phase 3 design per UI-SPEC D-19; real artwork images will be wired in Phase 7.

## Next Phase Readiness
- ShowCard and PlaceholderCard are ready for use in Plan 02 (HeroBanner, ContentRail) and Plan 03 (Series page grid)
- Mock data exports (FEATURED_SHOWS, NOW_STREAMING, COMING_SOON_SHOWS) are pre-grouped for content rail rendering
- Brand color maps provide safe static class references for any component needing show-specific accent colors

## Self-Check: PASSED

All 5 created files verified present on disk. All 3 task commits (785153e, b685762, e7f0be7) verified in git history.

---
*Phase: 03-home-page-catalog-ui*
*Completed: 2026-03-31*
