---
phase: 10-empty-state-polish
plan: 01
subsystem: ui
tags: [empty-states, catalog-stage, redirect, server-component, supabase]

# Dependency graph
requires:
  - phase: 08-data-integration
    provides: Supabase queries (getStreamingShows, getComingSoonShows), mapShow/mapSeason/mapEpisode helpers, createPublicClient
  - phase: 06.1-ui-cinematic-redesign
    provides: ScrollReveal, CtaBanner visual structure, brand color system
provides:
  - getCatalogStage() cached query returning {stage, showCount} with zero/growing/full tiers
  - Browse page empty-catalog redirect guard (D-01)
  - Series detail text-only empty state for shows with no seasons (D-02)
  - Catalog-aware CtaBanner with three copy tiers (D-03)
affects: [homepage, browse, series-detail, cta-banner]

# Tech tracking
tech-stack:
  added: []
  patterns: [catalog-stage-enum, count-only-supabase-query, conditional-empty-state]

key-files:
  created: []
  modified:
    - src/lib/queries.ts
    - src/app/(viewer)/browse/page.tsx
    - src/app/(viewer)/series/[slug]/page.tsx
    - src/components/home/cta-banner.tsx

key-decisions:
  - "getCatalogStage uses count-only query ({count: 'exact', head: true}) for zero row transfer"
  - "CtaBanner fetches getCatalogStage internally (async server component) rather than receiving stage as prop"
  - "Browse redirect uses already-fetched streaming/comingSoon arrays -- zero additional DB cost"
  - "Series empty state uses text-only layout (no glass card, no bordered container) per brand guidelines"

patterns-established:
  - "Catalog stage enum: zero (0 shows) / growing (1-5) / full (6+) drives copy across components"
  - "Empty state pattern: small-caps label + display heading + body + link CTA, no decorative wrappers"

requirements-completed: [D-01, D-02, D-03, D-04]

# Metrics
duration: 5min
completed: 2026-04-14
---

# Phase 10 Plan 01: Empty State Polish Summary

**Catalog-aware empty states with getCatalogStage() query, browse redirect guard, series text-only empty state, and three-tier CtaBanner copy**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-14T13:25:15Z
- **Completed:** 2026-04-14T14:12:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- getCatalogStage() cached query returns {stage, showCount} using count-only Supabase query with zero row transfer
- Browse page redirects to / when both streaming and coming-soon show arrays are empty (D-01)
- Series detail page shows text-only empty state ("Episodes are being prepared.") when viewSeasons.length === 0 (D-02)
- CtaBanner becomes async server component with three copy tiers matching catalog stage: zero/growing/full (D-03, D-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getCatalogStage() query and browse redirect guard** - `bf12282` (feat)
2. **Task 2: Series empty state and catalog-aware CtaBanner** - `e7eb18a` (feat)

## Files Created/Modified
- `src/lib/queries.ts` - Added getCatalogStage() with CatalogStage type, unstable_cache wrapping, count-only query
- `src/app/(viewer)/browse/page.tsx` - Added redirect('/') guard when streaming + coming-soon are both empty
- `src/app/(viewer)/series/[slug]/page.tsx` - Added conditional empty state for viewSeasons.length === 0 with Link to /coming-soon
- `src/components/home/cta-banner.tsx` - Rewritten as async server component with CTA_COPY object mapping three stages

## Decisions Made
- getCatalogStage uses createPublicClient() (not createClient()) inside unstable_cache closure to avoid cookie access
- Browse redirect reuses already-fetched streaming/comingSoon arrays -- no additional DB query needed
- CtaBanner fetches catalog stage internally rather than prop-drilling from parent pages
- Series empty state follows "no decorative boxes" guideline -- text-only with small-caps label pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are wired to live Supabase data via getCatalogStage() and existing query helpers.

## Next Phase Readiness
- All four CONTEXT.md decisions (D-01 through D-04) implemented
- Platform handles zero/growing/full catalog states gracefully
- Phase 10 is the final phase -- milestone v1.0 complete

## Self-Check: PASSED

All 4 modified files exist. Both task commits (bf12282, e7eb18a) verified in git log.

---
*Phase: 10-empty-state-polish*
*Completed: 2026-04-14*
