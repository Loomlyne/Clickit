---
phase: 09-personalization-watch-features
plan: "03"
subsystem: ui
tags: [supabase, react, next.js, profile, watchlist, watch-history, episode-progress]

requires:
  - phase: 09-01
    provides: watchlist toggle, WatchlistToggleButton, getWatchlistShows query
  - phase: 09-02
    provides: watch_progress table, resume playback, autoplay next episode, getContinueWatchingEpisodes

provides:
  - Profile page expanded with My List preview (up to 6 shows) and Recently Watched (up to 10 episodes)
  - ProfileHistoryRow component with thumbnail, episode metadata, progress bar and Completed badge
  - getRecentlyWatched and getEpisodesProgress batch query functions
  - Episode rows on series detail page show progress bars and Completed badges for watched content

affects: [future profile enhancements, episode detail pages, series detail page]

tech-stack:
  added: []
  patterns:
    - Batch episode progress fetch on series detail page (getEpisodesProgress) for logged-in users
    - Progress map threaded server-side through SeriesDetailContent -> EpisodeList -> EpisodeRow
    - ProfileHistoryRow uses inline brand hex color for progress bar (not Tailwind class)

key-files:
  created:
    - src/components/profile/profile-history-row.tsx
  modified:
    - src/lib/queries.ts
    - src/app/(viewer)/profile/page.tsx
    - src/components/series/episode-row.tsx
    - src/app/(viewer)/series/[slug]/page.tsx
    - src/components/series/episode-list.tsx
    - src/components/series/series-detail-content.tsx

key-decisions:
  - "getEpisodesProgress batch-fetches all episode progress in a single Supabase query using .in() filter — no N+1"
  - "progressMap threaded as prop through SeriesDetailContent and EpisodeList to avoid context or global state"
  - "ProfileHistoryRow progress bar uses inline style for brand color (same hex alpha pattern as other components)"

patterns-established:
  - "Batch progress pattern: collect all episode IDs server-side, single query, build Record keyed by episode_id"
  - "Episode row progress: optional resumePercent + isCompleted props, rendered below metadata badges row"

requirements-completed: [USER-07]

duration: ~45min (including Vercel deploy and user verification)
completed: "2026-04-04"
---

# Phase 09 Plan 03: Profile Expansion and Episode Progress Indicators Summary

**Profile page rebuilt as personalization hub with My List preview, recently watched history, and episode rows now showing inline progress bars and Completed badges drawn from batch-fetched watch_progress data.**

## Performance

- **Duration:** ~45 min (including Vercel deploy and checkpoint verification)
- **Started:** 2026-04-04T22:00:00Z (estimated)
- **Completed:** 2026-04-04T22:42:35Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 7

## Accomplishments

- Added `getRecentlyWatched` and `getEpisodesProgress` to `queries.ts` — recently watched ordered by `updated_at`, batch progress via `.in()` filter
- Created `ProfileHistoryRow` component: thumbnail with brand color, episode/show metadata, inline progress bar or Completed badge
- Expanded profile page from a single centered settings card to a full three-section layout: settings + My List preview (up to 6 shows) + Recently Watched (up to 10 episodes) with empty states and "See all" link
- Threaded `progressMap` from series detail server page through `SeriesDetailContent` and `EpisodeList` to each `EpisodeRow` — episode rows now show thin progress bars (in-progress) or Completed badge (watched) with zero N+1 queries
- Deployed to Vercel production and received user approval across all verification scenarios

## Task Commits

1. **Task 1: Profile page expansion, history row, episode progress indicators** - `a037ee0` (feat)
2. **Task 2: Vercel deploy and visual verification** - checkpoint approved by user (no code commit)

**Plan metadata:** (committed with state update docs)

## Files Created/Modified

- `src/lib/queries.ts` — Added `RecentlyWatchedItem` type, `getRecentlyWatched()`, and `getEpisodesProgress()` functions
- `src/components/profile/profile-history-row.tsx` — New component: history row with thumbnail, metadata, progress bar/badge
- `src/app/(viewer)/profile/page.tsx` — Expanded to three-section layout: settings, My List preview, Recently Watched
- `src/components/series/episode-row.tsx` — Added `resumePercent` and `isCompleted` optional props, progress UI below badges
- `src/app/(viewer)/series/[slug]/page.tsx` — Added batch progress fetch via `getEpisodesProgress` for logged-in users
- `src/components/series/episode-list.tsx` — Added `progressMap` prop, passes `resumePercent`/`isCompleted` to each `EpisodeRow`
- `src/components/series/series-detail-content.tsx` — Passed `progressMap` through to `EpisodeList`

## Decisions Made

- `getEpisodesProgress` uses a single `.in()` Supabase query to batch-fetch all visible episode progress — no N+1 fetches per episode
- `progressMap` is threaded as a plain prop (not React context or Zustand) because it is fetched server-side and passed down two levels only
- `ProfileHistoryRow` computes `progressPercent` inline from `progressSeconds / durationSeconds` — same pattern as the watch page player

## Deviations from Plan

None — plan executed exactly as written. Post-commit polish commits (UX improvements, layout fixes) were made by the user separately and do not affect plan scope.

## Issues Encountered

None. TypeScript compilation passed with zero errors. Supabase join syntax for nested relations worked first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 09 personalization is complete. All three plans (watchlist, continue watching/autoplay/resume, profile hub) are done and verified on production.

No blockers for the next phase.

---
*Phase: 09-personalization-watch-features*
*Completed: 2026-04-04*
