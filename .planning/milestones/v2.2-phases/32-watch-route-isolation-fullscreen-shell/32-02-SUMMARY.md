---
plan: 32-02
phase: 32-watch-route-isolation-fullscreen-shell
status: complete
committed: 9b0c4d2
---

## Summary

Added `handleEpisodeSwitch` to `WatchShell` and rewired `AutoplayOverlay.onPlayNow` to use it. Deleted orphan `WatchPageContent`. Phase 32 fully shipped and pushed.

## Changes

- `watch-shell.tsx` — `handleEpisodeSwitch(newEpisode)` inserted after `useProgressTracker` call. Strict sequence: forceFlush → setCurrentEpisode → loadVideoById({videoId, startSeconds:0}) → window.history.replaceState
- `watch-shell.tsx` — `AutoplayOverlay.onPlayNow` now calls `handleEpisodeSwitch(nextEpisode)` (no router.push)
- `watch-page-content.tsx` — deleted, zero orphan refs confirmed

## Acceptance Criteria — All Passed

- `function handleEpisodeSwitch` ✓
- `playerRef.current.loadVideoById` ✓ (count: 2 — one in switch handler, one type-check)
- `startSeconds: 0` object form ✓
- `window.history.replaceState` ✓
- `handleEpisodeSwitch(nextEpisode)` in AutoplayOverlay ✓
- No `router.push(\`/watch` ✓
- Pitfall 3 guard: `videoId={episode.youtubeId}` preserved, `currentEpisode.youtubeId` absent ✓
- Pitfall 2 guard: `useProgressTracker(playerInstance, currentEpisode.id` preserved ✓
- forceFlush calls: 4 (state=0 ended, state=2 paused, switch handler, unmount via hook) ✓
- `watch-page-content.tsx` deleted ✓
- `npx tsc --noEmit` PASS ✓

## Hand-off to Phase 33

`handleEpisodeSwitch(newEpisode: ViewEpisode)` is the public switch primitive. Phase 33's prev/next edge arrows call it directly. Phase 34's tray episode rows call it directly. The iframe is stable across the entire session — never remounted.

## Manual Smoke Test (Task 3)

Awaiting user verification of 7-point checklist in plan. Build is live on Vercel.
