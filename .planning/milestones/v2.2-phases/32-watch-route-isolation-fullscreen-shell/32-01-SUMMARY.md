---
plan: 32-01
phase: 32-watch-route-isolation-fullscreen-shell
status: complete
committed: 39a1070
---

## Summary

Created the `(watch)/` route group and `WatchShell` fullscreen client component. Watch page now renders a black fullscreen viewport with no Navbar, Footer, Silk, MarqueeTicker, or Lenis.

## Files Created

- `src/app/[locale]/(watch)/layout.tsx` — bare segment layout (`h-dvh min-h-svh overflow-hidden bg-black`)
- `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — server component rendering `<WatchShell>` directly
- `src/components/watch/watch-shell.tsx` — fullscreen client shell

## Files Deleted

- `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` (route conflict prevention)
- `src/app/[locale]/(viewer)/watch/[episodeId]/loading.tsx`
- `src/app/[locale]/(viewer)/watch/[episodeId]/not-found.tsx`

## Pitfall Guards Verified

- Pitfall 2 (wrong episodeId key): `useProgressTracker(playerInstance, currentEpisode.id, ...)` ✓
- Pitfall 3 (prop destroys player): `videoId={episode.youtubeId}` — initial prop only, never `currentEpisode.youtubeId` ✓

## Self-Check: PASSED

- `npx tsc --noEmit` — clean after clearing stale `.next/` cache
- All grep acceptance criteria verified (see commit message)
- No orphan `(viewer)/watch` refs in src/

## Hand-off to Plan 02

`playerRef`, `currentEpisode` state, and `useProgressTracker` keyed on `currentEpisode.id` are all seeded. Plan 02 only needs to add `handleEpisodeSwitch` (forceFlush → setCurrentEpisode → loadVideoById → replaceState) and wire `AutoplayOverlay.onPlayNow` to it instead of `router.push`.
