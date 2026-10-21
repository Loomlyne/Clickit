---
phase: 06-youtube-import-and-player
plan: 11
subsystem: ui
tags: [watch, episode-list, watchlist, likes, a11y, rtl, node-test]

requires:
  - phase: 06-youtube-import-and-player
    provides: "06-04 progressPercent, isolate; 06-05 watch.* and player.* strings"
provides:
  - "useWatchlist / useLikes: optional opts.onError replaces the toast"
  - "WatchActions + useWatchAnnouncer: toast-free Watchlist, Like and Share with a polite live region"
  - "EpisodeList: static season pills, desktop rail and phone list"
affects: [06-14]

tech-stack:
  added: []
  patterns:
    - "Shared hooks keep their toast path; a caller opts out with onError (other pages unchanged)"
    - "One hidden-per-breakpoint markup pair (max-md:hidden rail, md:hidden list); scroll-into-view targets data-current and ignores the display:none copy"

key-files:
  created:
    - src/components/watch/watch-actions.tsx
    - src/components/watch/episode-list.tsx
    - tests/unit/watch-list-guards.test.ts
  modified:
    - src/hooks/use-watchlist.ts
    - src/hooks/use-likes.ts

key-decisions:
  - "Playable = episode.isLive && youtubeId (the series page rule), not raw status === 'published', so a coming-soon episode past its publish_at is selectable"
  - "WatchActions 'top' hides Watchlist/Like below md itself; 'season-row' is md:hidden, so the shell cannot show them twice"
  - "EpisodeList draws its own thumbnail (not ShowArt): ShowArt has no unoptimized or onError and adds a black gradient; fallback tile is var(--bg-2)"

patterns-established:
  - "reportError(message) inside the hook: onError if given, else toast.error"

requirements-completed: [YT-05, YT-06]

duration: 20min
completed: 2026-10-20
---

# Phase 6 Plan 11: Episode list and watch actions Summary

**Standalone static EpisodeList (season pills, 220px rail, phone rows with progress bars and status meta) and toast-free WatchActions (Watchlist, Like, Share) backed by an opt-in onError on the two shared hooks, ready for the 06-14 shell rewrite.**

## Task Commits

1. **Task 1: Hooks accept onError; WatchActions** - RED `6ec8bfb`, GREEN `c86b870`
2. **Task 2: Static EpisodeList** - RED `54aea37`, GREEN `7ef49cf`

## Verification

- `tests/unit/watch-list-guards.test.ts`: 17 tests, 17 pass. Full `npm run test:unit`: 863 pass, 0 fail.
- `npx eslint` on the five source files and the test: clean. `npx tsc --noEmit`: clean.
- Acceptance greps: `onError` count 5 in each hook; `from 'sonner'` count 0 in watch-actions.tsx; `aria-current` present in episode-list.tsx.
- Callers of the hooks without the third argument (`like-button.tsx`, `watchlist-toggle-button.tsx`, current `watch-shell.tsx`) are unchanged in behaviour: they still toast.
- Not verified: no browser, build or `gate:local` run (nothing renders these components yet; 06-14 places them). The guard tests are source scans, so rendering, the Check swap timing, the live-region announcement, RTL rail direction and the thumbnail fallback chain are untested at runtime.

## Deviations from Plan

None to code scope. Notes:

- The guard test's clipboard assertion was loosened to `\s*` after the GREEN run because the call is split across lines (formatting only).
- `watch.addToWatchlist`, `removeFromWatchlist`, `likeShow`, `unlikeShow`, `shareEpisode` have no `{title}` placeholder in en/ar, so the `isolate(showTitle)` value passed to them is not rendered today. The values are passed so the labels start including the show name the moment 06-05's strings gain a placeholder.
- The old `toast.success` share path in `watch-shell.tsx` and the old tray are untouched; 06-14 swaps them.

## Known Stubs

None. `EpisodeList` and `WatchActions` are unused until 06-14 (intentional per the plan).

## Threat Flags

None. T-06-45: no `sonner`/`toast` in `watch-actions.tsx` or `episode-list.tsx`, no tooltip/popover imports (guard-tested). T-06-46: titles render as React text inside `<bdi>`, no `dangerouslySetInnerHTML` (guard-tested).

## Self-Check: PASSED

- Files present: watch-actions.tsx, episode-list.tsx, watch-list-guards.test.ts, both hooks.
- Commits present: 6ec8bfb, c86b870, 54aea37, 7ef49cf.
