# Phase 9: Personalization & Watch Features - Research

**Researched:** 2026-04-04
**Domain:** Watchlist, Continue Watching, Autoplay, YouTube IFrame API progress tracking
**Confidence:** HIGH

## Summary

Phase 9 adds personalization features on top of the fully-wired Supabase backend from Phase 8. The schema already has `watchlist` and `watch_progress` tables with correct RLS policies, meaning no new migrations are required. `watch_history` can be proxied from `watch_progress` without introducing a separate table. The `YouTubePlayer` component already exposes `onReady` and `onStateChange` callbacks but needs extension to support progress tracking via `onProgress` and `onEnded` — both of which delegate to the underlying IFrame API methods (`getCurrentTime()`, `getDuration()`, `getPlayerState()`, `seekTo()`).

The continue-watching query currently returns `ViewShow[]`, which is show-centric rather than episode-centric. This needs a full rewrite to return episode-level objects that include progress percentage, seconds watched, and episode metadata so the home rail can render accurate resume cards. Cross-season episode navigation is currently limited to same-season scope inside `getEpisodeById()` — this must be upgraded to support cross-season next/prev for autoplay to work correctly when an episode at the end of one season should transition into the next.

No new npm packages are required. All persistence is handled by the existing Supabase client, player events are managed by the existing IFrame API integration, and UI state can be kept in local hooks without introducing Zustand. The implementation spans four functional areas: watchlist toggle, progress tracking and resume, continue-watching rail, and autoplay countdown. A reusable `WatchlistToggleButton` is placed on both `PortraitShowCard` and `SeriesDetailHero`. A `/my-list` page reuses the existing `/series` grid shell. The profile page is expanded with watchlist preview and recently-watched sections.

<user_constraints>
## User Constraints (from CONTEXT.md)

- **Client-side mutations, server-side reads for watchlist** — mutations (add/remove) run from the browser client; watchlist data for rendering is fetched server-side via server components.
- **Reusable WatchlistToggleButton** — single component placed on `PortraitShowCard` and `SeriesDetailHero`; must handle optimistic state with error rollback.
- **Extend YouTubePlayer with `onProgress`/`onEnded`** — do not replace the existing player abstraction; extend it with two new optional callbacks.
- **Progress save interval: 10 seconds** — flush also on pause, ended, route-change, and tab-hide (`document.hidden`).
- **Server-side resume fetch, pass `initialProgressSeconds`** — the watch page server component fetches saved progress and passes it down as a prop; the player seeks on `onReady`.
- **Cross-season next/prev upgrade required** — `getEpisodeById()` must be upgraded before autoplay is wired.
- **8-second autoplay countdown** — `AutoplayOverlay` shows a countdown and navigates automatically unless dismissed.
- **Reuse `/series` grid for `/my-list`** — no new grid shell; the my-list page passes watchlisted shows into the existing component.
- **`watch_progress` as watch history proxy** — no new `watch_history` migration; query `watch_progress` ordered by `updated_at` for the "recently watched" display.
- **No Zustand — local hooks only** — `useWatchlist(showId)` and `useProgressTracker(player, episodeId, userId)` are self-contained; no global store.
</user_constraints>

## Standard Stack

| Item | Purpose | Notes |
|------|---------|-------|
| YouTube IFrame API (already loaded) | Player control and progress reads | `getCurrentTime()`, `getDuration()`, `getPlayerState()`, `seekTo()` — no npm package |
| Supabase browser client (already installed) | Watchlist and progress mutations | `@supabase/supabase-js` via existing `createBrowserClient()` helper |
| Supabase server client (already installed) | Server-side reads for resume, watchlist, continue-watching | Existing `createServerClient()` helper |
| Next.js App Router (already installed) | Route for `/my-list`, server components for data fetching | No new routing primitives needed |
| `database.types.ts` (needs regen) | TypeScript types for DB queries | Has type drift — includes phantom tables; must regenerate via Supabase CLI or scope types manually |

No new npm packages. All required APIs are already present in the codebase.

## Architecture

### Player Layer

`YouTubePlayer` is extended with two optional callbacks:

- `onProgress(currentTime: number, duration: number)` — fired by a `setInterval` (10s) inside `WatchPageContent`; the interval reads `player.getCurrentTime()` and `player.getDuration()` directly.
- `onEnded()` — mapped from `YT.PlayerState.ENDED` in the existing `onStateChange` handler.

`WatchPageContent` owns the interval lifecycle: starts on `onReady`, clears on unmount, clears and flushes on pause/ended. Tab-hide flushing attaches to `document.visibilitychange` — when `document.hidden` is true, flush current position immediately.

### Progress Tracking Hook

`useProgressTracker(player, episodeId, userId)` encapsulates:

1. Interval setup and teardown
2. Debounce on first save after `seekTo()` — `getCurrentTime()` returns 0 briefly post-seek; skip saves below 2 seconds unless we already have a stored position
3. Upsert to `watch_progress` via browser Supabase client: `{ user_id, episode_id, progress_seconds, duration_seconds, updated_at }`

### Watchlist Hook

`useWatchlist(showId)` encapsulates:

1. Local boolean state initialized from a prop (`initialInWatchlist`) passed from the server component
2. Optimistic toggle on click
3. Mutation via browser Supabase client (insert or delete from `watchlist`)
4. Error rollback: if mutation rejects, flip state back and surface a toast

### Server-Side Queries

| Query | Input | Output | Used By |
|-------|-------|--------|---------|
| `getEpisodeProgress(userId, episodeId)` | user + episode | `{ progress_seconds, duration_seconds }` or null | Watch page server component |
| `getWatchlistShows(userId)` | user | `Show[]` ordered by `inserted_at desc` | `/my-list` page, profile preview |
| `getShowWatchlistState(userId, showId)` | user + show | `boolean` | `SeriesDetailHero`, `PortraitShowCard` server render |
| `getContinueWatchingEpisodes(userId)` | user | `ContinueWatchingItem[]` (episode-centric) | Home page continue-watching rail |

`ContinueWatchingItem` shape:
```ts
{
  episodeId: string
  episodeTitle: string
  episodeThumbnail: string
  episodeNumber: number
  seasonNumber: number
  showId: string
  showTitle: string
  showSlug: string
  progressSeconds: number
  durationSeconds: number
  progressPercent: number // derived: progressSeconds / durationSeconds
}
```

### Component Map

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `WatchlistToggleButton` | `components/watchlist/` | Heart/bookmark icon, optimistic toggle, error rollback |
| `ContinueWatchingCard` | `components/home/` | Episode card with progress bar overlay for home rail |
| `ContinueWatchingRail` | `components/home/` | Horizontal rail, conditionally rendered only when items exist |
| `AutoplayOverlay` | `components/watch/` | 8-second countdown, next-episode title, dismiss button |
| `MyListPage` | `app/(viewer)/my-list/` | Server component, fetches `getWatchlistShows`, passes to `/series` grid shell |

### Cross-Season Episode Navigation

`getEpisodeById(episodeId)` currently returns same-season `nextEpisode` and `prevEpisode`. Upgrade path:

1. After fetching the episode, get its `season_number` and `show_id`
2. If no next episode in current season, query the first episode of `season_number + 1` for the same show
3. If no prev episode in current season, query the last episode of `season_number - 1`
4. Return `{ episode, nextEpisode, prevEpisode }` — same shape, cross-season aware

### Resume Flow

```
WatchPage (server component)
  → fetch episode + getEpisodeProgress(userId, episodeId)
  → pass initialProgressSeconds to WatchPageContent
    → pass to YouTubePlayer as prop
      → onReady: player.seekTo(initialProgressSeconds)
        → useProgressTracker starts interval
```

## Pitfalls

1. **`database.types.ts` type drift** — the generated types include `watch_history` and `user_favorites` tables that do not exist in migrations. Queries against these types will compile but fail at runtime. Either regenerate via `supabase gen types typescript` or add manual type overrides that exclude phantom tables before using them in queries.

2. **`getContinueWatching()` returns wrong shape** — the existing function returns `ViewShow[]`. A full rewrite is required to return episode-centric objects. Do not attempt to adapt the existing return value; replace the query entirely.

3. **`getEpisodeById()` same-season limitation** — autoplay will silently stop at season boundaries without the cross-season upgrade. This must be done before wiring `AutoplayOverlay`, not after.

4. **`seekTo()` returns 0 briefly** — after calling `player.seekTo(n)`, `getCurrentTime()` returns 0 for approximately one tick. If the progress tracker saves immediately after seek, it will overwrite the stored position with 0. Fix: skip saves where `currentTime < 2` unless `progressSeconds` is already 0 in the DB (i.e., new episode).

5. **Tab visibility flush** — `beforeunload` is unreliable on mobile and some desktop browsers. Use `document.visibilitychange` as the primary flush trigger. Also flush on Next.js route change via `router.events` or component unmount.

6. **RLS has no DELETE on `watch_progress`** — this is intentional. Progress is only ever upserted, never deleted. Do not add a delete path to `useProgressTracker`.

7. **Optimistic watchlist desync** — if the Supabase mutation rejects (network error, RLS violation), the optimistic toggle has already flipped the UI. The hook must catch the error, flip state back, and call `toast.error()`. Without this, the user sees a watchlisted show that isn't actually saved.

8. **Continue-watching rail renders with zero items on first visit** — the component must not render at all (not render empty) when `getContinueWatchingEpisodes` returns an empty array. Conditional rendering at the section level, not inside the rail component.

## Validation Architecture

All validation is manual on Vercel preview deploy — no Playwright (dev server fails in worktrees). Use `tsc --noEmit` for type checking after each task.

### Type Check Gate
```bash
npx tsc --noEmit
```
Run after: extending `YouTubePlayer` props, adding new query functions, creating hook files, adding `ContinueWatchingItem` type.

### Watchlist Validation
1. Navigate to any show detail page (logged in)
2. Click watchlist toggle — confirm optimistic state flips immediately
3. Refresh — confirm show appears in watchlisted state (server render)
4. Navigate to `/my-list` — confirm show appears in grid
5. Toggle off — confirm show is removed from `/my-list` after refresh
6. Test empty state: remove all watchlisted shows, confirm `/my-list` renders empty state UI

### Continue Watching Validation
1. Play an episode for 15+ seconds (two save intervals)
2. Close tab, reopen platform
3. Confirm continue-watching rail appears on home page
4. Confirm card shows correct episode title, show name, and progress bar at correct percentage
5. Click card — confirm watch page opens and player seeks to saved position (not 0:00)

### Autoplay Validation
1. Seek to last 10 seconds of an episode
2. Let episode end — confirm `AutoplayOverlay` appears with 8-second countdown
3. Let countdown expire — confirm navigation to next episode URL
4. Repeat at last episode of a season — confirm navigation crosses to first episode of next season
5. Test dismiss: click dismiss button during countdown — confirm overlay closes, no navigation

### Profile Page Validation
1. Navigate to `/profile`
2. Confirm watchlist preview section shows correct shows
3. Confirm recently-watched section shows episodes ordered by most recent activity
4. Confirm both sections show empty state when no data

### My List Page Validation
1. Navigate to `/my-list` with watchlisted shows — confirm grid renders using `/series` shell
2. Navigate to `/my-list` with no watchlisted shows — confirm empty state with CTA to browse shows
3. Confirm page is not accessible to unauthenticated users (redirect to `/login`)
