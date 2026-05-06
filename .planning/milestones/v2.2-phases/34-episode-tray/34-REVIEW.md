# Phase 34 Code Review

Depth: standard
Scope:

- `src/components/watch/episode-tray.tsx`
- `src/components/watch/watch-shell.tsx`
- `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx`
- `src/lib/queries.ts`
- `src/hooks/use-idle-timer.ts`

## Findings

### High: Raised tray overlays the YouTube player and blocks controls

File: `src/components/watch/watch-shell.tsx`
Line: 182

`WatchShell` now keeps the player at `bottom: 0` for every tray snap state, while `EpisodeTray` still renders a fixed bottom drawer over the viewport. When the tray is raised to `0.5`, the lower half of the YouTube iframe is covered by the tray, including the native YouTube controls area. This breaks the Phase 34 contract documented in `34-CONTEXT.md` and `34-01-PLAN.md`, where the tray must remain a sibling and squeeze the player instead of covering it.

Impact:

- Users cannot reliably reach YouTube controls when the tray is raised.
- The watch route regresses from the phase acceptance criteria: player bottom offset no longer follows tray snap state.
- The tray now competes with the video surface for pointer events.

Recommended fix:

- Restore a bottom offset for the player when the tray is raised, at least enough to keep YouTube controls exposed.
- If the desired product direction is an overlay tray, cap it below the control strip or add a non-overlapping safe zone rather than using `bottom: 0` unconditionally.

## Verified Clean

- Episode selection still routes through `handleEpisodeSwitch()`, preserving the single iframe path.
- Season changes remain local UI state and do not navigate.
- `getEpisodesProgress()` has an empty-list guard and returns a stable map shape.
- `useIdleTimer()` clears timers on cleanup and handles disabled state without leaving a timer active.

## Verification Run

- `npm exec tsc -- --noEmit` passed before review.
- `git diff --check` passed before review.

