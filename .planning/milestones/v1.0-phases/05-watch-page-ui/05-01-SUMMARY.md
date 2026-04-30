---
phase: 05-watch-page-ui
plan: 01
subsystem: ui
tags: [youtube-iframe-api, watch-page, video-player, next-dynamic-routes, breadcrumb]

# Dependency graph
requires:
  - phase: 04-series-detail-browse-pages
    provides: EpisodeRow, SeriesDetailHero, SeasonSelector, EpisodeList components and mock episode data
provides:
  - Watch page route at /watch/[episodeId] with YouTube IFrame API player
  - YouTube player client component with singleton script loading and error handling
  - Episode breadcrumb navigation component
  - Watch page content wrapper with metadata display
  - getEpisodeById and getEpisodeNavigation mock data helpers
  - Episode links wired from series detail to watch page
affects: [05-02-watch-page-nav-quickselector, 06-supabase-backend, 09-integration]

# Tech tracking
tech-stack:
  added: ["@types/youtube (dev)", "shadcn separator"]
  patterns: ["YouTube IFrame API singleton loading", "callback refs to avoid useEffect retrigger", "server page with client island for video player"]

key-files:
  created:
    - src/components/watch/youtube-player.tsx
    - src/components/watch/episode-breadcrumb.tsx
    - src/components/watch/watch-page-content.tsx
    - src/app/watch/[episodeId]/page.tsx
    - src/app/watch/[episodeId]/not-found.tsx
    - src/components/ui/separator.tsx
  modified:
    - src/lib/mock-data.ts
    - src/components/series/episode-row.tsx
    - src/components/series/series-detail-hero.tsx
    - src/app/series/[slug]/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "YouTube IFrame API loaded via singleton pattern with module-level state to prevent duplicate script tags across route navigations"
  - "Callback props stored in refs to avoid player destruction on parent re-renders (Pitfall 5 from RESEARCH.md)"
  - "Non-published episodes show 'Episode Not Available' inline page instead of 404, preserving the episode's existence while communicating unavailability"
  - "Placeholder YouTube IDs (dQw4w9WgXcQ, jNQXAC9IVRw, 9bZkp7q19f0) rotated across published episodes for development"

patterns-established:
  - "YouTube IFrame API singleton: module-level apiReady/apiLoading flags with callback queue for concurrent initialization"
  - "Watch page server/client split: server page resolves episode context, client component manages player lifecycle"
  - "Episode navigation: flatten all published episodes across seasons into ordered array for O(1) prev/next lookup"

requirements-completed: [WTCH-01, WTCH-02, WTCH-05]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 5 Plan 1: Watch Page Foundation Summary

**YouTube IFrame API player with singleton loading, watch page route with episode metadata/breadcrumb, and all series detail episode links wired to /watch/[episodeId]**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T22:04:35Z
- **Completed:** 2026-03-31T22:11:01Z
- **Tasks:** 1
- **Files modified:** 12

## Accomplishments
- Built YouTube IFrame API player component with singleton script loading, error state handling (101/150/100/generic), accessible region landmark, and proper useEffect cleanup
- Created watch page route with generateMetadata/generateStaticParams, not-found page, and non-published episode "not available" state
- Added episode breadcrumb (Show > Season N > Episode N) with accessible nav/ol/aria-current markup
- Extended mock data with youtubeId placeholders on all published episodes and two new helper functions (getEpisodeById, getEpisodeNavigation)
- Wired all existing episode links: EpisodeRow href from "#" to /watch/{id}, SeriesDetailHero CTA from "#" to /watch/{firstEpisodeId}

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend mock data + build YouTube player + watch page route** - `cb8a4db` (feat)

## Files Created/Modified
- `src/components/watch/youtube-player.tsx` - YouTube IFrame API wrapper with singleton script loading, error handling, loading state
- `src/components/watch/episode-breadcrumb.tsx` - Breadcrumb nav: Show > Season N > Episode N with aria-label and aria-current
- `src/components/watch/watch-page-content.tsx` - Client wrapper managing player + metadata with cinematic fade-in animation
- `src/app/watch/[episodeId]/page.tsx` - Server page with generateMetadata, generateStaticParams, notFound handling
- `src/app/watch/[episodeId]/not-found.tsx` - 404 page for invalid episode IDs
- `src/components/ui/separator.tsx` - shadcn separator component (installed for Phase 5 use)
- `src/lib/mock-data.ts` - Added youtubeId to published episodes, getEpisodeById, getEpisodeNavigation helpers
- `src/components/series/episode-row.tsx` - Changed href="#" to href={/watch/${episode.id}}
- `src/components/series/series-detail-hero.tsx` - Added firstEpisodeId prop, CTA links to /watch/{firstEpisodeId}
- `src/app/series/[slug]/page.tsx` - Computes and passes firstEpisodeId to SeriesDetailHero
- `package.json` - Added @types/youtube dev dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- YouTube IFrame API loaded via singleton pattern with module-level state -- prevents duplicate script tags even with React Strict Mode double-mounting
- Callback props (onReady, onStateChange, onError) stored in refs so useEffect only depends on videoId -- avoids player destruction on parent re-renders
- Non-published episodes render an inline "Episode Not Available" page instead of triggering notFound() -- preserves the URL and gives a clear message with back-link to the show
- Placeholder YouTube IDs rotated across 3 well-known public videos for development -- simple string swap when real CIT IDs available

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components render with real mock data and functional YouTube player embeds.

## Next Phase Readiness
- Watch page foundation complete with player, metadata, and linked navigation
- Plan 02 will add EpisodeNav prev/next buttons and episode quick-selector reusing SeasonSelector + EpisodeList
- YouTube player component exposes onReady/onStateChange callbacks ready for future continue-watching integration (Phase 9)

## Self-Check: PASSED

All created files verified present on disk. Commit cb8a4db verified in git log.

---
*Phase: 05-watch-page-ui*
*Completed: 2026-03-31*
