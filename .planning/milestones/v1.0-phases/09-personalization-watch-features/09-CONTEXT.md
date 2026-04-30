# Phase 9: Personalization & Watch Features - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Source:** Codex AI analysis (6 decisions surfaced from codebase inspection)

<domain>
## Phase Boundary

Phase 9 delivers the full personalization and watch-enhancement layer:

- **Watchlist** — authenticated users can save/remove shows; unauthenticated users are redirected to auth
- **Continue Watching** — progress is tracked during playback and surfaced on the home rail as episode-centric cards
- **Resume Playback** — watch page seeks to saved position on load if prior progress exists
- **Autoplay** — countdown overlay after episode ends, cross-season next-episode resolution
- **My List page** — dedicated `/my-list` route showing the user's saved shows in a grid
- **Profile page expansion** — adds "My List" preview and "Recently Watched" section alongside existing account settings
</domain>

<decisions>
## Implementation Decisions

### Watchlist

- Client-side Supabase mutations with optimistic UI for watchlist toggle. Server-side reads only.
- Reusable `WatchlistToggleButton` component used on both `PortraitShowCard` (absolute top-right) and `SeriesDetailHero` (in CTA row).
- Unauthenticated users see the button but clicking redirects to `/auth?next=<current-path>`.
- No Zustand store — use a local `useWatchlist(showId)` hook exposing `{ isInList, toggle, isLoading }` with optimistic state.
- `getShowWatchlistState(showIds: string[])` for batch checking on grid pages.

### Continue Watching

- Extend `YouTubePlayer` to expose `onProgress(currentTime, duration)` and `onEnded()` callbacks.
- Save progress every 10 seconds during playback. Flush on pause, ended, route change, tab hide.
- Only write when progress moved by at least 10 seconds since last persisted value.
- Mark `completed = true` when `ENDED` fires or `currentTime / duration >= 0.95`.
- No persistence for unauthenticated users.
- Replace `getContinueWatching()` to return episode-centric data: episode ID, title, show title, progress percent, resume URL — not `ViewShow[]`.
- Build specialized `ContinueWatchingCard` for the rail; do not reuse the generic `ContentRail`.

### Resume Playback

- Fetch saved progress server-side in the watch page, pass `initialProgressSeconds` prop to `WatchPageContent`.
- On `onReady`, seek to saved position if `initialProgressSeconds > 0` and episode is not completed.
- New query: `getEpisodeProgress(episodeId)` returning `{ progressSeconds, durationSeconds, completed }`.

### Autoplay

- Upgrade `getEpisodeById()` so next/prev resolution is cross-season (order all published episodes by `(season_number, episode_number)`, find current index, return adjacent entries).
- Show countdown overlay on `ENDED` only when a next published episode exists.
- 8-second countdown with `Play now` and `Cancel` buttons.
- Edge cases: last episode of show shows "Series complete" message; coming-soon next episode shows a disabled state.

### My List Page

- Reuse `/series` page shell and grid pattern with `PortraitShowCard`.
- No genre filter chips — just header + count + grid.
- Authenticated-only page with empty state: "Your list is empty" + CTA to `/series`.

### Profile Page (USER-07)

- Treat "watch history" as `watch_progress` ordered by `updated_at` — no new migration needed.
- Expand profile page: keep existing account settings card, add "My List" preview section and "Recently Watched" section below it.
- Generated types in `database.types.ts` include `watch_history` and `user_favorites` tables that do not exist in migrations — this is type drift; ignore those tables entirely.

### Claude's Discretion

- Exact progress bar color mapping per show brand color
- `ContinueWatchingCard` exact layout proportions
- `AutoplayOverlay` animation timing details
- Profile page section ordering within the expanded layout
- Whether to surface a nav link for My List in the main navigation
</decisions>

<canonical_refs>
## Canonical References

- `src/components/watch/youtube-player.tsx` — YouTube IFrame API wrapper (extend for progress callbacks)
- `src/components/watch/watch-page-content.tsx` — Watch page client component (add resume + autoplay logic)
- `src/components/watch/episode-nav.tsx` — Prev/next episode navigation (update for cross-season resolution)
- `src/components/home/continue-watching-rail.tsx` — Existing rail shell (replace with episode-centric data + new card)
- `src/components/shows/portrait-show-card.tsx` — Show card (add `WatchlistToggleButton` at absolute top-right)
- `src/components/series/series-detail-hero.tsx` — Hero (add `WatchlistToggleButton` in CTA row)
- `src/components/series/episode-row.tsx` — Episode row (extend props with `resumePercent?: number`, `isCompleted?: boolean`)
- `src/app/(viewer)/profile/page.tsx` — Profile page (expand with My List preview + Recently Watched)
- `src/app/(viewer)/profile/actions.ts` — Server action pattern reference
- `src/app/(viewer)/watch/[episodeId]/page.tsx` — Watch page server component (fetch + pass `initialProgressSeconds`)
- `src/app/(viewer)/series/[slug]/page.tsx` — Series detail page
- `src/lib/queries.ts` — All viewer queries (add `getEpisodeProgress`, update `getContinueWatching`, `getShowWatchlistState`, `getEpisodeById` cross-season)
- `src/lib/database.types.ts` — Generated DB types (NOTE: has drift — ignore `watch_history` and `user_favorites` tables)
- `supabase/migrations/20260401000000_create_schema.sql` — Schema with `watchlist` + `watch_progress` tables
- `supabase/migrations/20260401000001_create_rls_policies.sql` — RLS policies (sufficient for Phase 9, no new migration needed)
</canonical_refs>

<specifics>
## Specific Ideas

- `useWatchlist(showId)` hook API: `{ isInList, toggle, isLoading }` — optimistic flip on toggle, rollback on Supabase error
- `getShowWatchlistState(showIds: string[])` — batch query returning a `Set<string>` or `Record<string, boolean>` for efficient grid rendering
- `EpisodeRow` progress extension: add optional `resumePercent?: number` and `isCompleted?: boolean` props; render a thin progress bar at the bottom of the row when `resumePercent` is set
- Cross-season next episode algorithm: query all published episodes ordered by `(season_number ASC, episode_number ASC)`, find current episode index in the flat list, return `list[index + 1]` or `null`
- `ContinueWatchingCard` shape: thumbnail + show title + episode title + progress bar + resume button; episode-centric, not show-centric
- `AutoplayOverlay`: renders on top of the player after `ENDED`, countdown from 8 to 0, auto-navigates on 0 unless cancelled
</specifics>

<deferred>
## Deferred Ideas

- Real `watch_history` table — use `watch_progress` ordered by `updated_at` as a proxy for now
- `user_favorites` table — does not exist in current schema; defer entirely
- localStorage progress persistence for anonymous/unauthenticated users
- Social sharing of watchlist
- Watch party / co-watching features
</deferred>
