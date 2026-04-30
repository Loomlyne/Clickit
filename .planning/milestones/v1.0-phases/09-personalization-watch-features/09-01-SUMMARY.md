---
phase: 09-personalization-watch-features
plan: 01
subsystem: ui
tags: [supabase, watchlist, optimistic-ui, sonner, react-hooks]

# Dependency graph
requires:
  - phase: 08-data-integration-auth
    provides: Supabase auth, real queries layer, viewer layout with user hydration
provides:
  - Watchlist query functions (getWatchlistShows, getShowWatchlistState, getShowsWatchlistState)
  - useWatchlist hook with optimistic toggle and error rollback
  - WatchlistToggleButton reusable component (card + hero variants)
  - /my-list authenticated page with show grid and empty state
affects: [09-02, 09-03, profile-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic-ui-with-rollback, client-supabase-mutations, auth-redirect-pattern]

key-files:
  created:
    - src/hooks/use-watchlist.ts
    - src/components/watchlist/watchlist-toggle-button.tsx
    - src/app/(viewer)/my-list/page.tsx
  modified:
    - src/lib/queries.ts
    - src/components/shows/portrait-show-card.tsx
    - src/components/series/series-detail-hero.tsx
    - src/app/(viewer)/series/[slug]/page.tsx

key-decisions:
  - "useWatchlist hook uses local useState instead of Zustand store -- sufficient for per-component toggle state"
  - "WatchlistToggleButton replaces static Heart/Bookmark icons -- single source of truth for watchlist interaction"
  - "Unauthenticated users see toggle button but clicking redirects to /auth?next=<path> -- no broken states"

patterns-established:
  - "Optimistic UI pattern: flip state immediately, revert on Supabase error with sonner toast"
  - "Auth-gated client interaction: check userId in hook, redirect to /auth?next= if null"
  - "Optional watchlist props pattern: userId !== undefined gates rendering of WatchlistToggleButton"

requirements-completed: [USER-01, USER-02, USER-03]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 9 Plan 1: Watchlist Toggle, Queries, and My List Page Summary

**Watchlist query layer with optimistic toggle hook, reusable card/hero button component, and authenticated /my-list page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T18:25:09Z
- **Completed:** 2026-04-04T18:29:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Three watchlist query functions added to queries.ts for fetching saved shows, checking single show state, and batch-checking multiple shows
- useWatchlist hook with optimistic toggle, error rollback via sonner toast, and auth redirect for unauthenticated users
- WatchlistToggleButton component with card (absolute overlay, Plus/Check icon) and hero (inline CTA row) variants
- WatchlistToggleButton wired into PortraitShowCard and SeriesDetailHero, replacing static placeholder icons
- /my-list page with auth guard, show grid matching /series layout, and empty state with Browse Shows CTA

## Task Commits

Each task was committed atomically:

1. **Task 1: Watchlist queries, hook, and toggle button** - `23acdb7` (feat)
2. **Task 2: Wire watchlist into PortraitShowCard, SeriesDetailHero, and create My List page** - `25e3949` (feat)

## Files Created/Modified
- `src/lib/queries.ts` - Added getWatchlistShows, getShowWatchlistState, getShowsWatchlistState
- `src/hooks/use-watchlist.ts` - Client hook with optimistic toggle, error rollback, auth redirect
- `src/components/watchlist/watchlist-toggle-button.tsx` - Reusable button with card and hero variants
- `src/components/shows/portrait-show-card.tsx` - Added WatchlistToggleButton overlay, removed static Bookmark icon
- `src/components/series/series-detail-hero.tsx` - Added WatchlistToggleButton in CTA row, removed static Heart button
- `src/app/(viewer)/series/[slug]/page.tsx` - Passes user and watchlist state to SeriesDetailHero
- `src/app/(viewer)/my-list/page.tsx` - New page with auth guard, show grid, empty state

## Decisions Made
- Used local useState in useWatchlist hook instead of Zustand store -- toggle state is per-component, no cross-component sync needed
- WatchlistToggleButton replaces both the static Heart button (hero) and Bookmark icon (card) -- single source of truth for watchlist interaction
- userId prop uses `undefined` vs `null` distinction: `undefined` means auth state unknown (hide button), `null` means explicitly unauthenticated (show button, redirect on click)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all watchlist functionality is wired to real Supabase queries.

## Next Phase Readiness
- Watchlist toggle is live on all show surfaces and /my-list page
- Ready for Plan 02 (continue watching / watch progress) and Plan 03 (autoplay, profile enhancements)
- useWatchlist pattern can be referenced for similar optimistic UI hooks

---
*Phase: 09-personalization-watch-features*
*Completed: 2026-04-04*
