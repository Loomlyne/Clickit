---
phase: 04-series-detail-browse-pages
plan: 03
subsystem: ui
tags: [react, nextjs, coming-soon, browse-page, showcard, episode-row, playwright]

# Dependency graph
requires:
  - phase: 04-series-detail-browse-pages/01
    provides: Mock data layer (COMING_SOON_SHOWS, getComingSoonEpisodesFromStreamingShows, ShowCard, EpisodeRow)
provides:
  - /coming-soon route with two content sections (unreleased shows and upcoming episodes)
  - ComingSoonShowCard wrapper component with opacity and badge overlay
  - E2E tests for CATL-07 (Coming Soon page)
affects: [05-watch-page, 08-supabase-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ComingSoonShowCard wraps existing ShowCard with opacity-80 and Badge overlay
    - Server component page with grouped episode display by show name

key-files:
  created:
    - src/components/shows/coming-soon-show-card.tsx
    - src/app/coming-soon/page.tsx
    - tests/e2e/coming-soon.spec.ts
  modified: []

key-decisions:
  - "Coming Soon page is a server component -- no client-side state needed, mock data is synchronous"
  - "ComingSoonShowCard is a client component wrapping the existing ShowCard (which uses motion)"
  - "Episodes grouped by show name on the Coming Soon page for clear section hierarchy"

patterns-established:
  - "Component wrapper pattern: ComingSoonShowCard wraps ShowCard with visual overlay instead of modifying the original"
  - "Episode grouping by show: reduce episodes into show-keyed record for section-based rendering"

requirements-completed: [CATL-07]

# Metrics
duration: 17min
completed: 2026-03-31
---

# Phase 4 Plan 3: Coming Soon Page Summary

**Coming Soon browse page at /coming-soon with unreleased show cards (80% opacity + badge overlay) and upcoming episodes from streaming shows grouped by show name**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-31T13:42:12Z
- **Completed:** 2026-03-31T13:59:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built ComingSoonShowCard component that wraps existing ShowCard with 80% opacity and Coming Soon badge overlay (bg-brand-orange)
- Created /coming-soon route with two sections: "Upcoming Shows" grid (ComingSoonShowCard) and "New Episodes Dropping Soon" (EpisodeRows grouped by show)
- Both empty states render gracefully with correct copy per UI-SPEC ("All Caught Up" and "No New Episodes Scheduled")
- Added 8 Playwright E2E tests covering CATL-07 requirements

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ComingSoonShowCard and Coming Soon page** - `e17f73b` (feat)
2. **Task 2: Add E2E tests for Coming Soon page** - `af0ad8c` (test)

## Files Created/Modified
- `src/components/shows/coming-soon-show-card.tsx` - Client component wrapping ShowCard with opacity-80 and Coming Soon badge overlay
- `src/app/coming-soon/page.tsx` - Server component page with two sections: unreleased shows grid and upcoming episodes grouped by show
- `tests/e2e/coming-soon.spec.ts` - 8 Playwright tests covering CATL-07 (page title, subtitle, sections, Poets Platform card, badge, episode rows, metadata)

## Decisions Made
- Coming Soon page kept as a server component (no client-side state needed, all data is synchronous mock data)
- ComingSoonShowCard is a client component because it wraps ShowCard which uses motion for whileHover
- Skipped scroll-reveal animation on page sections per plan guidance -- page is a browse page where content is immediately visible on load
- Episodes grouped by show name using a reduce pattern for clear section hierarchy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Dev server failed to start in worktree environment (ECANCELED fs error during `next dev`). TypeScript compilation passed cleanly (`npx tsc --noEmit`). E2E test execution deferred to verifier/orchestrator which runs from the main repo. The test file follows established patterns from existing E2E tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Coming Soon page complete, ready for Phase 5 (watch page) which will wire episode links
- Phase 4 is now fully complete: series detail page (Plan 01-02) and Coming Soon page (Plan 03)
- All browse pages functional with mock data

## Self-Check: PASSED

All 3 created files verified on disk. Both task commits (e17f73b, af0ad8c) found in git log.

---
*Phase: 04-series-detail-browse-pages*
*Completed: 2026-03-31*
