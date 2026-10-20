---
phase: 06-youtube-import-and-player
plan: 09
subsystem: ui
tags: [watch, youtube, player, progress, rate-limit, server-action, node-test]

requires:
  - phase: 06-youtube-import-and-player
    provides: "06-01 withinRateLimitCore seam and episodes columns; 06-04 buildPlayerVars, shouldSaveProgress, videoMatchesFor, REPORTABLE_PLAYER_ERRORS"
provides:
  - "youtube-player.tsx: overlay-free player; hidden on a React-owned wrapper; startSeconds, hidden, onAutoplayBlocked props; getPlayerVideoId()"
  - "use-progress-tracker.ts: expectedVideoId-gated saves, unmount-only flush, resetBaseline"
  - "queries.ts: getEpisodesProgress now returns progressSeconds and durationSeconds; getEpisodeYouTubeStatuses"
  - "watch/status-map.ts: toYouTubeStatusMap, StoredNonOkStatus"
  - "server/player-error-report.ts: reportPlayerErrorCore, PLAYER_REPORT_WINDOW_MS"
  - "actions/player-errors.ts: reportPlayerError(episodeId, code)"
affects: [06-10, 06-14, 06-18]

tech-stack:
  added: []
  patterns:
    - "YT.Player is given an imperatively created inner node inside a React-owned wrapper, so the wrapper's hidden attribute survives"
    - "Source-scan tests for client modules that import next-intl, @/ paths or the YT global"

key-files:
  created:
    - src/lib/watch/status-map.ts
    - src/server/player-error-report.ts
    - src/app/actions/player-errors.ts
    - tests/unit/watch-player-source.test.ts
    - tests/unit/watch-status-map.test.ts
    - tests/unit/player-error-report.test.ts
  modified:
    - src/components/watch/youtube-player.tsx
    - src/hooks/use-progress-tracker.ts
    - src/lib/queries.ts

key-decisions:
  - "Every new prop and parameter is optional, so the current watch-shell.tsx compiles unchanged until 06-14 rewrites it (tsc clean)"
  - "With no expectedVideoId the tracker keeps today's behaviour (every readable clock is saved)"
  - "PLAYING since the switch is tracked with player.addEventListener('onStateChange') inside the tracker, so the shell needs no extra wiring"
  - "A rate-limit ledger error and a real limit both come back as reason 'limited' (withinRateLimitCore returns false for both, fail closed)"

requirements-completed: [YT-05, YT-06]

duration: 35min
completed: 2026-10-20
---

# Phase 6 Plan 09: Player plumbing under the watch page Summary

**Player with nothing drawn over it and an iframe that really hides (hidden on a React-owned wrapper), a progress tracker that cannot save one video's clock onto another episode, saved-seconds and stored-status reads for the shell, and a once-per-hour viewer error report.**

## Task Commits

1. **Task 1: Overlay-free player, hidden wrapper, tracker race fix** - RED `4d1d672`, GREEN `36678ae`
2. **Task 2: Watch-page reads (progress seconds, stored non-ok statuses)** - RED `c467725`, GREEN `31a69de`
3. **Task 3: Viewer player-error report (core, action, test)** - RED `e75ec4b`, GREEN `e7f94b4`

No refactor commits were needed.

## What changed

- **Player:** `startSeconds` goes into `playerVars.start` through `buildPlayerVars({ locale: useLocale(), start, origin })`; no `seekTo`. The loading tint, the error overlay and `getErrorMessage` are gone. `<div ref={wrapperRef} hidden={hidden}>` is the React-owned wrapper; `new YT.Player(mount, …)` gets a `document.createElement('div')` appended to it. Cleanup runs `destroy()` then `replaceChildren()`. `onAutoplayBlocked` is wired through a callback ref. `getPlayerVideoId(player)` is exported.
- **Tracker:** `useProgressTracker(player, episodeId, userId, expectedVideoId?)` returns `{ flush, forceFlush, resetBaseline }`. Saves go through `shouldSaveProgress` with `videoMatches` from `videoMatchesFor({ reportedVideoId: player.getVideoData().video_id, expectedVideoId, playingSinceSwitch })`. The baseline and `playingSinceSwitch` reset when `episodeId` changes. The unmount flush reads a `latestFlush` ref with `[]` deps. Upsert payload and the 95% rule are unchanged.
- **Reads:** `toYouTubeStatusMap` keeps known non-ok statuses only (inherited keys like `constructor` are ignored). `getEpisodeYouTubeStatuses` is an admin-client, server-only read with `neq('youtube_status', 'ok')`; empty input returns `{}` before any query, and an error logs `[queries] youtube status lookup failed` and returns `{}`.
- **Report:** `reportPlayerErrorCore` checks signed-in, uuid, code in `[2, 5, 100, 101, 150]`, published episode, then `withinRateLimitCore` (`player-error:<episodeId>:<userId>`, max 1, 3600 s, `failOpen: false`), then one update of `player_error_code` and `player_error_at` on that id. No YouTube dependency. `reportPlayerError` returns `{ success }` only.

## Verification

Verified:
- `node --test` on `watch-player-source`, `watch-resume`, `watch-player-state`: 58 pass, 0 fail. `watch-status-map`: 7 pass. `player-error-report`: 16 pass (every behavior bullet, plus per-user and per-episode keys, window expiry, fail-closed on select and insert errors, update failure).
- Full `npm run test:unit`: 836 pass, 0 fail.
- `npx tsc --noEmit` clean; per-file `eslint` on every file touched is clean (14 warnings elsewhere in `src` are pre-existing and not in these files).
- Acceptance greps: `document.createElement('div')` 1, `hidden={hidden}` 1, `getVideoData` in the tracker 1, `export async function getEpisodeYouTubeStatuses` 1, `durationSeconds` in queries 11, forbidden imports in `status-map.ts` 0, YouTube names in the report core 0, `withinRateLimitCore` in the report core 1.

Not verified:
- No browser run: the real `offsetParent === null` on a hidden iframe, `playerVars.start` resuming, `onAutoplayBlocked` firing, and the tracker's PLAYING listener against a live YT player. These are source-scanned and wired by 06-14, to be checked at UAT.
- No `next build` or `gate:local` (not required; the shell does not use the new props yet).
- `reportPlayerError` against the real Supabase (no live writes by rule); the core is tested on the in-memory fake only.

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `player_error_code` / `player_error_at` are missing from `database.types.ts`**
- **Found during:** Task 3
- **Issue:** The project note says the types include the Phase 6 columns, but 06-01 added only the `youtube_*` columns (its SUMMARY says so: "Phase 6 entries only"). The migration has `player_error_*`, the types do not, so a typed `.update({ player_error_code })` fails `tsc`. Types must not be regenerated or hand-edited.
- **Fix:** The update goes through a narrow local view of the `episodes` table (`EpisodeErrorWriter`, cast from `db.from('episodes')`), with a comment. The select and the rate-limit call stay fully typed.
- **Files modified:** src/server/player-error-report.ts
- **Commit:** e7f94b4
- **Follow-up for the controller:** add `player_error_code` and `player_error_at` to `src/lib/database.types.ts`, then drop the cast. 06-08's `youtube-health.ts` already reads these columns, so check how it types them.

**2. [Rule 1 - Bug avoided] Wrapper sizing class**
- **Found during:** Task 1
- **Issue:** The plan gives the wrapper `h-full w-full`, but the outer box is sized by `aspect-video`, and a percentage height against an aspect-ratio-derived height is not reliable. The plan also forbids the literal `absolute inset-0`.
- **Fix:** Wrapper is `absolute start-0 top-0 size-full`; `YT.Player` also gets `width: '100%'`, `height: '100%'`. Nothing is drawn: it is the same box the iframe fills, and `hidden` (Tailwind preflight `[hidden]` rule) still takes it out of layout.
- **Files modified:** src/components/watch/youtube-player.tsx
- **Commit:** 36678ae

**3. [Minor] Namespace import for the rate-limit seam**
- `import * as rateLimit` so the file mentions `withinRateLimitCore` on exactly one line, as the plan's acceptance grep expects. No behaviour change.

## Known Stubs

- `brandColor` stays in `YouTubePlayerProps` as a deprecated, ignored prop so the current `watch-shell.tsx` (which still passes it, and still calls `seekTo` in its own `onReady`) compiles. 06-14 removes both.
- The shell does not yet pass `startSeconds`, `hidden`, `expectedVideoId` or call `reportPlayerError`/`getEpisodeYouTubeStatuses`; that wiring is 06-14 by design.

## Threat Flags

None. `reportPlayerError` is the only new network-reachable surface and is covered by T-06-36 to T-06-38 (signed-in only, allow-listed codes, published episodes, one per user per episode per hour, fail closed, two fixed columns, no YouTube call).

## Self-Check: PASSED

- Files exist: youtube-player.tsx, use-progress-tracker.ts, status-map.ts, player-error-report.ts, player-errors.ts, queries.ts, and the three test files.
- Commits found in `git log`: 4d1d672, 36678ae, c467725, 31a69de, e75ec4b, e7f94b4.
