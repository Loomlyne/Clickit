---
status: complete
quick_id: 261011-q4y
commits: [66ddca3, ca907a3, deda01a]
---

# Quick 261011-q4y: Fix 28 ESLint errors

Final `npm run lint`: 0 errors, 17 warnings (was 28 errors, 18 warnings). `npx tsc --noEmit` clean. `npm run test:unit` 75/75 pass. Nothing pushed.

## Task 1 (66ddca3) no-explicit-any
- `src/lib/queries.ts`: local row types (`NewEpisodeRow`, `ContinueWatchingRow`, `ComingSoonRow`, `RecentlyWatchedRow`, inline types for likes/watchlist/watched-shows) with `as unknown as` casts at the query boundary; mapping logic unchanged.
- `src/app/[locale]/admin/actions.ts`: removed `as any` and its stale disable; tsc accepts the update payload without it.

## Task 2 (ca907a3) set-state-in-effect
- categories-manager (ColorPicker), youtube-url-input, mobile-nav, shorts-overlay, use-idle-timer: state now derived/adjusted during render (previous-value compare). youtube-url-input keeps the error as a boolean and builds the message at render (so it follows locale changes).
- entry-preload: removed `setVideoStarted(false)` in the video effect (it was a no-op: the state is always false when that effect runs, since only `onPlaying`, which fires after it, sets it true). Kept the mount `setActive(true)` with a disable.

## eslint-disable used (4, each with a one-line reason in code)
1. `entry-preload.tsx` `setActive(true)`: mount-only flag, must flip after hydration (sessionStorage is client-only).
2. `navbar.tsx` `setScrolled(window.scrollY > 24)`: browser-only read after hydration.
3. `review-composer.tsx` `void loadReviews(supabase)`: data fetch; state is set only after the awaited query.
4. `use-idle-timer.ts` `resetTimer()` in effect: clears idle state when the timer restarts.

## Task 3 (deda01a) refs
- viewer-scroll-persistence, youtube-player: latest-value refs now assigned in a no-deps `useEffect` declared before the other effects.
- like-button, watchlist-toggle-button: `justLiked` / `justAdded` moved from refs to `useState`. Ring/particles now unmount once the ring animation completes (previously they stayed mounted but invisible until the next render).
- youtube-player: fixing the refs exposed a previously hidden set-state-in-effect on `setIsReady(false)`/`setErrorCode(null)`; moved to a reset during render on `videoId` change.

## Not verified
- UI behaviour of all changed components has not been seen in a browser (like/watchlist burst, YouTube player switching videos, navbar, mobile nav close on route change, shorts progress, entry preload, categories colour picker, YouTube URL input).
- `npm run build` not run (needs Supabase env).
