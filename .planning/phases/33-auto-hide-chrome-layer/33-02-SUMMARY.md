---
phase: 33
plan: 02
subsystem: watch-chrome
tags: [auto-hide, chrome, watchlist, likes, share, episode-navigation]
dependency_graph:
  requires: ["33-01"]
  provides: ["CHROME-01", "CHROME-02"]
  affects: ["src/components/watch/watch-shell.tsx", "src/app/[locale]/(watch)/watch/[episodeId]/page.tsx"]
tech_stack:
  added: []
  patterns: ["two-wave server data fetch", "hook-driven optimistic UI", "shared chromeClass visibility pattern"]
key_files:
  created: []
  modified:
    - src/components/watch/watch-shell.tsx
    - "src/app/[locale]/(watch)/watch/[episodeId]/page.tsx"
decisions:
  - "currentPrevEpisode/currentNextEpisode (state) used for arrows — not stale initial props"
  - "Two-wave data fetch: show.id unavailable until first Promise.all resolves"
  - "navigator.share with clipboard fallback for share handler"
  - "seasonNumber derived via seasons.find() at render time — not a separate state"
metrics:
  duration: "15m"
  completed: "2026-05-05T23:13:15Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 33 Plan 02: Full Chrome Overlay — WatchShell Summary

## One-liner

Top overlay strip (back link, episode title/badge, watchlist/like/share) + left/right edge arrows, all fading via shared `chromeClass` with tabIndex guard, wired to `useWatchlist`/`useLikes` hooks seeded from SSR-fetched initial state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fetch initial watchlist/likes state server-side | ececf4d | `page.tsx` |
| 2 | Replace placeholder back link with full chrome overlay | d409b51 | `watch-shell.tsx` |

## What Was Built

### Task 1 — page.tsx server-side initial state

Added a second data-fetch wave after the episode query resolves (`show.id` now available):

```typescript
const [inWatchlist, isLiked] = user
  ? await Promise.all([
      getShowWatchlistState(user.id, data.show.id),
      getShowLikeState(user.id, data.show.id),
    ])
  : [false, false]
```

Passed as `initialSaved={inWatchlist}` and `initialLiked={isLiked}` to `WatchShell`. Unauthenticated users receive `[false, false]` immediately — no DB query.

### Task 2 — WatchShell chrome overlay

**Deleted:** The placeholder back link (`← Back` div at `absolute top-4 left-4 z-10`).

**Added — top overlay strip (`fixed top-0 left-0 right-0 z-20`):**
- Left: `ArrowLeft` icon + `show.title` as i18n-aware Link to `/series/{slug}`
- Center: `currentEpisode.title` + `S{N} E{N}` badge in font-mono/text-xs/text-white/50
- Right: Bookmark (toggleWatchlist, fills `fill-white` when in list) + Heart (toggleLike, fills `fill-pink-400` when liked) + Share2 (navigator.share → clipboard fallback)
- Gradient scrim: `bg-gradient-to-b from-black/70 to-transparent`
- Visibility: `${chromeClass}` (opacity + pointer-events), `aria-hidden={isIdle}`, `tabIndex={isIdle ? -1 : 0}` on all interactive elements

**Added — edge arrows:**
- Prev: `fixed left-3 top-1/2 -translate-y-1/2 z-20`, only rendered when `currentPrevEpisode` exists
- Next: `fixed right-3 top-1/2 -translate-y-1/2 z-20`, only rendered when `currentNextEpisode` exists
- Both: `size-10 rounded-full bg-black/40 backdrop-blur-sm`, `${chromeClass}`, call `handleEpisodeSwitch`
- Correct: use state variables `currentPrevEpisode`/`currentNextEpisode` (not stale initial props)

**Added — hooks and helpers:**
- `useWatchlist(show.id, initialSaved, userId ?? null)` → `{ isInList, toggle: toggleWatchlist }`
- `useLikes(show.id, initialLiked, userId ?? null)` → `{ isLiked: isShowLiked, toggle: toggleLike }`
- `handleShare()` — Web Share API with clipboard fallback + sonner toast
- `currentSeason`/`seasonNumber` derived at component level for badge

## Deviations from Plan

### Worktree merge required at execution start

The worktree was initialized from Phase 32 HEAD and did not have Plan 01's commits (useIdleTimer, chromeClass, currentPrevEpisode, initialSaved/initialLiked props). `git merge main --no-edit` (fast-forward) brought all Plan 01 changes into the worktree before starting Plan 02. This is expected parallel-agent behavior, not a code deviation.

## Known Stubs

None. All chrome elements are wired to live state:
- Bookmark/Heart → live Supabase mutations via existing hooks
- Share → navigator.share / clipboard (real platform API)
- Episode title/badge → `currentEpisode` state (updates on episode switch)
- Prev/next arrows → `currentPrevEpisode`/`currentNextEpisode` state (recalculated in `handleEpisodeSwitch`)

## Threat Flags

No new network endpoints or trust boundaries introduced beyond those in the plan's threat model (T-33-03 through T-33-05). navigator.share URL is same-origin; RLS enforced at DB level for watchlist/likes mutations.

## Self-Check: PASSED

- `src/components/watch/watch-shell.tsx` — FOUND
- `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — FOUND
- Commit `ececf4d` — FOUND
- Commit `d409b51` — FOUND
- `npx tsc --noEmit` exits 0 — PASS
