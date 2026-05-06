---
phase: 33
plan: 01
subsystem: watch
tags: [hooks, idle-timer, chrome, watch-shell, client-state]
dependency_graph:
  requires: [Phase 32 — WatchShell fullscreen shell]
  provides: [useIdleTimer hook, idle state scaffolding, currentPrevEpisode tracking]
  affects: [src/hooks/use-idle-timer.ts, src/components/watch/watch-shell.tsx]
tech_stack:
  added: []
  patterns: [bare setTimeout/clearTimeout, ReturnType<typeof setTimeout>, useCallback stable ref]
key_files:
  created:
    - src/hooks/use-idle-timer.ts
  modified:
    - src/components/watch/watch-shell.tsx
decisions:
  - "bare setTimeout over window.setTimeout — avoids TS narrowing to never (confirmed project pitfall)"
  - "chromeClass deferred to overlay JSX in Plan 02 — no visible UI change in this plan"
  - "currentPrevEpisode state added to WatchShell (mirrors currentNextEpisode) — live prev tracking across episode switches"
  - "initialSaved/initialLiked props added to WatchShellProps — consumed by Plan 02 overlay"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 33 Plan 01: useIdleTimer Hook + WatchShell Idle Scaffolding Summary

**One-liner:** Custom useIdleTimer hook (bare setTimeout, useCallback stable ref) wired into WatchShell with currentPrevEpisode tracking and chrome class derivation — no visible UI change, stable foundation for Plan 02 overlay JSX.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useIdleTimer hook | c10c0e8 | src/hooks/use-idle-timer.ts (new) |
| 2 | Wire idle state + prevEpisode tracking into WatchShell | f854d05 | src/components/watch/watch-shell.tsx |

## What Was Built

### Task 1: useIdleTimer Hook

`src/hooks/use-idle-timer.ts` — 28-line custom hook following `useProgressTracker` pattern:

- `isIdle` starts `false` (chrome visible on mount), flips `true` after `delay` ms of inactivity
- `resetTimer` wrapped in `useCallback([delay])` — stable ref safe to pass as event handler prop
- `useEffect` on mount calls `resetTimer()` to start initial countdown
- Cleanup clears `timerRef.current` to prevent state-update-after-unmount
- Uses bare `setTimeout`/`clearTimeout` (not `window.setTimeout`) — avoids TypeScript narrowing trap

### Task 2: WatchShell Idle Scaffolding

`src/components/watch/watch-shell.tsx` — surgical additions, zero restructuring:

- Import + call `useIdleTimer(3000)` — `{ isIdle, resetTimer }` in scope
- `chromeClass` derived: `'opacity-0 pointer-events-none'` when idle, `'opacity-100 pointer-events-auto'` when active (consumed by overlay JSX in Plan 02)
- `currentPrevEpisode` state added (parallel to `currentNextEpisode`) with `findPrevEpisode()` function (cross-season: traverses to last episode of previous season)
- `handleEpisodeSwitch` updated to `setCurrentPrevEpisode(findPrevEpisode(newEpisode))` on every switch
- `onStateChange` state=2 (paused) now calls `resetTimer()` — pause forces chrome visible
- `onStateChange` state=1 (playing/resumed) now calls `resetTimer()` — restart countdown
- Root div gains `onPointerMove`, `onPointerDown`, `onTouchStart`, `onKeyDown` all wired to `resetTimer`
- `initialSaved?: boolean` and `initialLiked?: boolean` added to `WatchShellProps` (default `false`) — consumed by `useWatchlist`/`useLikes` in Plan 02
- Placeholder back link (`← Back`) preserved — Plan 02 replaces it with full overlay

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `chromeClass` is declared and commented "used in Plan 02" — it is computed but not yet applied to any JSX element. This is intentional: Plan 02 adds the overlay JSX that consumes it.
- `initialSaved` and `initialLiked` are destructured with defaults but not yet passed to any hook — intentional, consumed in Plan 02.
- The placeholder back link (`← Back`) remains — Plan 02 deletes and replaces it.

None of these stubs prevent the plan's goal (idle state scaffolding). All three are explicitly deferred to Plan 02 per the plan design.

## Threat Flags

None. Plan 33-01 is purely client-side state scaffolding. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/hooks/use-idle-timer.ts exists | FOUND |
| src/components/watch/watch-shell.tsx exists | FOUND |
| 33-01-SUMMARY.md exists | FOUND |
| Commit c10c0e8 (Task 1) | FOUND |
| Commit f854d05 (Task 2) | FOUND |
