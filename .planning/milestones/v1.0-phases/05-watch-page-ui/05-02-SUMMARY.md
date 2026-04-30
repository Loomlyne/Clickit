---
phase: 05-watch-page-ui
plan: 02
subsystem: ui
tags: [episode-nav, quick-selector, cross-season, episode-highlight, playwright, e2e]

# Dependency graph
requires:
  - phase: 05-01
    provides: "YouTube player, watch page route, episode breadcrumb, mock data helpers"
  - phase: 04
    provides: "SeasonSelector, EpisodeList, EpisodeRow components"
provides:
  - "EpisodeNav component with prev/next cross-season navigation"
  - "Current episode highlighting in EpisodeRow (left brand-color border + bg-surface-2)"
  - "Episode quick-selector on watch page (SeasonSelector + EpisodeList reuse)"
  - "E2E test suite for WTCH-01 through WTCH-06"
affects: [watch-page-integration, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Current episode highlight via aria-current=true + brand-color left border inline style"
    - "Cross-component prop threading: currentEpisodeId flows WatchPageContent -> EpisodeList -> EpisodeRow"
    - "Season pre-selection via useState(season.id) from server-resolved context"

key-files:
  created:
    - src/components/watch/episode-nav.tsx
    - tests/e2e/watch-page.spec.ts
  modified:
    - src/components/watch/watch-page-content.tsx
    - src/components/series/episode-list.tsx
    - src/components/series/episode-row.tsx

key-decisions:
  - "Current episode rendered as div (not Link) to prevent self-navigation"
  - "brandColorHexMap used for inline borderLeftColor style on current episode highlight"

patterns-established:
  - "Current episode highlight: aria-current=true + bg-surface-2 + border-l-2 with brand color inline style"
  - "Optional prop propagation: currentEpisodeId defaults to undefined so existing series detail page is unaffected"

requirements-completed: [WTCH-03, WTCH-05, WTCH-06]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 5 Plan 2: Episode Navigation and Quick-Selector Summary

**Prev/next episode navigation with cross-season support, episode quick-selector reusing Phase 4 components, and E2E test suite covering all WTCH requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T22:16:45Z
- **Completed:** 2026-03-31T22:20:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- EpisodeNav component with prev/next buttons, cross-season navigation, and disabled states at show boundaries
- Current episode highlighting in quick-selector with left brand-color border and persistent bg-surface-2 background
- Episode quick-selector wired into watch page reusing SeasonSelector + EpisodeList from Phase 4
- Comprehensive E2E test suite covering WTCH-01 (player), WTCH-02 (metadata), WTCH-03 (navigation), WTCH-05 (no overlays), WTCH-06 (quick-selector)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build EpisodeNav, update EpisodeList/EpisodeRow, wire quick-selector** - `3eef298` (feat)
2. **Task 2: Write E2E tests for all watch page requirements** - `13ed4b9` (test)

## Files Created/Modified
- `src/components/watch/episode-nav.tsx` - Prev/Next navigation buttons with cross-season support
- `src/components/watch/watch-page-content.tsx` - Added EpisodeNav, SeasonSelector, EpisodeList, and season state
- `src/components/series/episode-list.tsx` - Added optional currentEpisodeId prop passed through to EpisodeRow
- `src/components/series/episode-row.tsx` - Added currentEpisodeId prop, current episode highlight with brand border
- `tests/e2e/watch-page.spec.ts` - 12 E2E tests covering WTCH-01 through WTCH-06, 404, and integration

## Decisions Made
- Current episode rendered as non-clickable `<div>` (not `<Link>`) per UI-SPEC guidance that current episode should not be self-navigable
- Used `brandColorHexMap` with inline `style={{ borderLeftColor }}` for the current episode left border accent since Tailwind v4 requires static class names
- Season pre-selection uses `useState(season.id)` where `season` is the server-resolved season containing the current episode

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `youtube-player.tsx` for `YT` namespace types (from Plan 01) are out of scope. All files modified in this plan compile cleanly.

## Known Stubs

None - all components are fully wired with real mock data.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Watch page is fully interactive: player, metadata, navigation, and episode selector all functional
- E2E tests ready to run against deployed Vercel preview
- Phase 5 complete; ready for Phase 6 (backend/admin) or Phase 8 (integration)

## Self-Check: PASSED

All 5 files verified on disk. Both commit hashes (3eef298, 13ed4b9) confirmed in git log.

---
*Phase: 05-watch-page-ui*
*Completed: 2026-03-31*
