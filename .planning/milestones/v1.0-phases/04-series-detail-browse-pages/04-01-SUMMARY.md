---
phase: 04-series-detail-browse-pages
plan: 01
subsystem: ui
tags: [mock-data, shadcn, motion, series-detail, episode-row, radix-ui]

# Dependency graph
requires:
  - phase: 03-home-page-catalog-ui
    provides: Show interface, MOCK_SHOWS, brandColor maps, hero-slide ambient glow pattern, Badge/Button components
provides:
  - Season and Episode TypeScript interfaces matching future Supabase schema
  - 9 mock seasons and 43 mock episodes with realistic content and status distribution
  - 4 helper functions (getShowBySlug, getSeasonsByShowId, getEpisodesBySeasonId, getComingSoonEpisodesFromStreamingShows)
  - SeriesDetailHero component with ambient glow and staggered reveal
  - EpisodeRow component with three visual states (published, coming-soon, locked)
  - shadcn Tabs and Select components installed
affects: [04-02-series-detail-page, 04-03-coming-soon-page, 05-watch-page]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-tabs", "@radix-ui/react-select"]
  patterns: ["episode row three-state rendering (published/coming-soon/locked)", "series detail hero with ambient brand glow"]

key-files:
  created:
    - src/components/series/series-detail-hero.tsx
    - src/components/series/episode-row.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/select.tsx
  modified:
    - src/lib/mock-data.ts

key-decisions:
  - "SeriesDetailHero is a client component for motion stagger animations; MotionConfig reducedMotion='user' for accessibility"
  - "EpisodeRow uses Link wrapper for published episodes only; non-interactive states use div with aria-disabled"
  - "Episode status distribution follows exact UI-SPEC table: realistic mix of published/coming-soon/locked per show"

patterns-established:
  - "Episode row pattern: horizontal flex with responsive thumbnail (120/140/200px) + text content, three state variants via status prop"
  - "Series hero pattern: ambient brand glow + cinematic gradient overlay matching home hero-slide exactly"

requirements-completed: [CATL-03, CATL-11]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 4 Plan 01: Mock Data Extension and Foundational Components Summary

**Season/Episode mock data layer with 43 episodes, SeriesDetailHero with ambient glow, and EpisodeRow with published/coming-soon/locked states**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T13:32:22Z
- **Completed:** 2026-03-31T13:37:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended mock-data.ts with Season and Episode interfaces, 9 seasons and 43 episodes with realistic creative content and accurate status distribution
- Built SeriesDetailHero with ambient brand color glow, cinematic gradient overlay, and staggered motion reveal matching the home hero pattern exactly
- Built EpisodeRow with three distinct visual states: published (interactive, play overlay on hover), coming-soon (dimmed, clock, orange badge), locked (dimmed, lock icon, gray badge)
- Installed shadcn Tabs and Select components for the season selector in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn Tabs + Select, extend mock data** - `322a4e3` (feat)
2. **Task 2: Build SeriesDetailHero component** - `1d3c0a7` (feat)
3. **Task 3: Build EpisodeRow component** - `3bf0430` (feat)

## Files Created/Modified

- `src/lib/mock-data.ts` - Extended with Season/Episode interfaces, 9 seasons, 43 episodes, 4 helper functions
- `src/components/series/series-detail-hero.tsx` - Cinematic hero with ambient glow, staggered reveal, and CTA button
- `src/components/series/episode-row.tsx` - Horizontal episode row with three visual states
- `src/components/ui/tabs.tsx` - shadcn Tabs component (Radix UI)
- `src/components/ui/select.tsx` - shadcn Select component (Radix UI)

## Decisions Made

- SeriesDetailHero uses 'use client' for motion animations; wraps all motion elements in MotionConfig reducedMotion="user" for accessibility
- EpisodeRow uses conditional Link wrapper (only for published episodes); non-interactive states use div with aria-disabled="true"
- Episode mock data uses creative, show-appropriate titles and descriptions (e.g., "Late Night in Abu Dhabi" for Last Call, "Heart Health 101" for Doctor Care)
- CTA button on hero uses asChild with anchor tag for published shows, disabled button for coming-soon shows

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components render real mock data. Episode row links use `#` href as intentional Phase 5 placeholder (documented in plan).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SeriesDetailHero and EpisodeRow are ready for Plan 02 (series detail page assembly)
- getComingSoonEpisodesFromStreamingShows is ready for Plan 03 (Coming Soon page)
- shadcn Tabs and Select are installed for Plan 02's SeasonSelector component
- All existing Phase 3 exports unchanged (Show, MOCK_SHOWS, brand color maps)

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 3 task commits verified in git log.

---
*Phase: 04-series-detail-browse-pages*
*Completed: 2026-03-31*
