---
phase: 09-personalization-watch-features
plan: 02
subsystem: ui
tags: [supabase, youtube-iframe-api, progress-tracking, autoplay, continue-watching, react-hooks]

# Dependency graph
requires:
  - phase: 09-personalization-watch-features
    plan: 01
    provides: Watchlist queries, useWatchlist hook, WatchlistToggleButton, /my-list page
  - phase: 08-data-integration-auth
    provides: Supabase auth, real queries layer, viewer layout with user hydration
provides:
  - useProgressTracker hook with 10s interval, flush on pause/tab-hide/unmount
  - AutoplayOverlay component with 8-second countdown and cross-season navigation
  - ContinueWatchingCard episode-centric resume card with progress bar
  - ContinueWatchingRail rewritten with auth guard and episode-centric data
  - getEpisodeProgress and getContinueWatchingEpisodes query functions
  - Cross-season prev/next episode resolution in getEpisodeById
  - Resume playback from saved position via server-side progress fetch
affects: [09-03, profile-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [progress-upsert-with-interval, cross-season-episode-ordering, autoplay-countdown-overlay, episode-centric-continue-watching]

key-files:
  created:
    - src/hooks/use-progress-tracker.ts
    - src/components/watch/autoplay-overlay.tsx
    - src/components/home/continue-watching-card.tsx
  modified:
    - src/lib/queries.ts
    - src/components/watch/watch-page-content.tsx
    - src/app/(viewer)/watch/[episodeId]/page.tsx
    - src/components/home/continue-watching-rail.tsx

key-decisions:
  - "Progress flush on pause (YT state 2) and ended (YT state 0) per CONTEXT.md decision"
  - "Cross-season navigation flattens all published episodes, sorts by (season_number, episode_number), uses adjacent entries"
  - "ContinueWatchingItem is episode-centric (not show-centric) -- replaced old getContinueWatching entirely"
  - "forceFlush bypasses 10-second delta check for pause/ended/tab-hide events"

patterns-established:
  - "Progress upsert pattern: upsert with onConflict user_id+episode_id, completed when currentTime/duration >= 0.95"
  - "Resume playback: server-side getEpisodeProgress fetch, passed as initialProgressSeconds prop, player.seekTo on onReady"
  - "Autoplay pattern: setInterval countdown from 8 to 0, onPlayNow navigates via router.push, onCancel clears timer"

requirements-completed: [WTCH-04, USER-04, USER-05, USER-06]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 9 Plan 2: Progress Tracking, Resume, Continue Watching Rail, and Autoplay Summary

**Watch progress tracked every 10s with resume from saved position, episode-centric continue watching rail, and 8-second autoplay countdown overlay with cross-season navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T18:31:43Z
- **Completed:** 2026-04-04T18:36:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Progress tracker hook saves to watch_progress table every 10 seconds during playback, flushes on pause, tab hide, and route change
- Watch page fetches saved progress server-side and seeks to saved position on player ready
- Continue watching rail rewritten with episode-centric ContinueWatchingCard showing progress bars, brand colors, and resume CTA
- Autoplay overlay appears after episode ends with 8-second countdown, play now, and cancel actions
- Cross-season prev/next episode navigation sorts all published episodes across seasons by (season_number, episode_number)

## Task Commits

Each task was committed atomically:

1. **Task 1: Query upgrades, progress tracker hook, and autoplay overlay** - `83324c6` (feat)
2. **Task 2: Wire watch page (resume + autoplay + progress), rewrite continue watching rail** - `e2c452f` (feat)

## Files Created/Modified
- `src/lib/queries.ts` - Added ContinueWatchingItem type, getEpisodeProgress, getContinueWatchingEpisodes; replaced old getContinueWatching; upgraded getEpisodeById with cross-season navigation
- `src/hooks/use-progress-tracker.ts` - Client hook with 10s interval, forceFlush for pause/ended/tab-hide, upsert with completed detection
- `src/components/watch/autoplay-overlay.tsx` - 8-second countdown overlay with Play now / Cancel buttons, responsive layout
- `src/components/watch/watch-page-content.tsx` - Added resume seek on ready, progress tracker wiring, autoplay overlay rendering on episode end
- `src/app/(viewer)/watch/[episodeId]/page.tsx` - Fetches user and episode progress server-side, passes initialProgressSeconds and userId to client
- `src/components/home/continue-watching-card.tsx` - Episode-centric resume card with ShowArt thumbnail, progress bar (brand color), metadata
- `src/components/home/continue-watching-rail.tsx` - Rewritten: auth guard, getContinueWatchingEpisodes, episode-centric cards in horizontal scroll

## Decisions Made
- Progress flush on pause (YT state 2) and ended (YT state 0) per CONTEXT.md decision -- ensures progress is always saved when user stops watching
- Cross-season navigation flattens all published episodes across all seasons, sorted by (season_number, episode_number) -- last episode of S1 links to first episode of S2
- Replaced getContinueWatching entirely with getContinueWatchingEpisodes returning episode-centric ContinueWatchingItem[] instead of ViewShow[]
- forceFlush bypasses 10-second delta check so pause/ended/tab-hide events always persist current position

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all progress tracking, resume, autoplay, and continue watching functionality is wired to real Supabase queries.

## Next Phase Readiness
- Watch progress, resume, autoplay, and continue watching rail are fully functional
- Ready for Plan 03 (profile page enhancements with My List preview and Recently Watched)
- useProgressTracker pattern can be referenced for similar real-time persistence hooks

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (83324c6, e2c452f) verified in git log.

---
*Phase: 09-personalization-watch-features*
*Completed: 2026-04-04*
