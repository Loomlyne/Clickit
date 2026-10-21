---
phase: 06-youtube-import-and-player
plan: 14
subsystem: ui
tags: [watch, youtube, rmf, resume, up-next, player-errors, toaster, node-test]

requires:
  - phase: 06-04
    provides: "resume rules, ENDED state machine (ENDED_MODE 'bar'), errorCardFor, playerIframeHidden, formatClock, isolate"
  - phase: 06-05
    provides: "player.* and watch.* strings"
  - phase: 06-09
    provides: "YouTubePlayer (startSeconds, hidden wrapper, onAutoplayBlocked), useProgressTracker(expectedVideoId, resetBaseline), getEpisodesProgress seconds, getEpisodeYouTubeStatuses, reportPlayerError"
  - phase: 06-10
    provides: "UpNextCard (bar / stage), PlayerErrorCard, useElementVisible"
  - phase: 06-11
    provides: "EpisodeList, WatchActions, useWatchAnnouncer"
provides:
  - "Stacked watch shell: solid top bar, black 16:9 stage, control bar, scrolling episode section"
  - "Per-episode resume on every switch (A -> B -> A), Resumed at m:ss with Start from the beginning"
  - "ENDED wiring: shipped 'bar' strip (no hide, no stop), 'card' alternative (stop, hide, stage card)"
  - "Branded error card with stored-status reasons, one viewer report per episode per page load, 153 logged only"
  - "UAE preflight: blocked_ae episodes show the card and are never loaded"
  - "RouteScopedToaster: no Toaster on /watch/*"
  - "tests/unit/watch-layout-guards.test.ts (23 source guards)"
affects: [06-18, 06-19, 06-20]

tech-stack:
  added: []
  patterns:
    - "Play requests (load / replay) are queued in state and run from one effect keyed on the hidden flag, so the player is un-hidden in one commit and loaded after it"
    - "ENDED transitions go through one dispatch helper: endedReducer(ENDED_MODE) then endedEffects(ENDED_MODE).stop -> stopPlayer()"
    - "Source guard parses JSX tags (generics skipped) to find the start-over button's parent element"

key-files:
  created:
    - src/components/route-scoped-toaster.tsx
    - tests/unit/watch-layout-guards.test.ts
  modified:
    - src/components/watch/watch-shell.tsx
    - src/components/watch/youtube-player.tsx
    - src/app/[locale]/(watch)/watch/[episodeId]/page.tsx
    - src/app/[locale]/layout.tsx
  deleted:
    - src/components/watch/episode-tray.tsx
    - src/components/watch/autoplay-overlay.tsx

key-decisions:
  - "Tracker baseline is re-applied from an effect declared after useProgressTracker, because the tracker zeroes its baseline in its own [player, episodeId] effect after the synchronous resetBaseline call"
  - "A switch skips the 'leave' clock read when the outgoing episode already ended or the player is hidden, so a stopped player's 0:00 can never un-complete an ended episode"
  - "One WatchActions variant 'top' (Watchlist/Like hidden below md by 06-11) instead of two phone/desktop instances, so Share renders once"
  - "RouteScopedToaster sits inside NextIntlClientProvider so next-intl's usePathname has its locale"
  - "The shell's 16:9 box is the only 'Video player' region; the player's own region role was removed"

requirements-completed: [YT-05, YT-06]

duration: 17min
completed: 2026-10-20
---

# Phase 6 Plan 14: Stacked watch shell Summary

**The watch page is now stacked (top bar, black 16:9 stage, control bar, episode list) with nothing ever drawn over the iframe; each episode resumes at its own position on every switch; ENDED uses the signed up-next bar (video and YouTube end screen untouched); errors and UAE blocks show the branded card; no Toaster is mounted on /watch/*.**

## Task Commits

1. **Task 1: Stacked layout, control bar and resume; remove the tray** - RED `45a0fdc`, GREEN `50e684d`
2. **Task 2: ENDED and error wiring, stored-status reasons, blocked preflight, page props** - RED `39b4994`, GREEN `96d4211`
3. **Fix: one Video player landmark** - `418d427`
4. **Task 3: Route-scoped Toaster and the remaining guards** - RED `fe47a8d`, GREEN `478990a`

No refactor commits.

## What changed

- **Layout (D-08, UI-SPEC 3.2-3.5):** root `flex h-dvh flex-col overflow-hidden`, safe-area bottom padding, landscape phones (`max-height: 500px`) scroll the document. Top bar is static and solid: phone back icon + title + `seasonEpisodeShort` + Share; desktop back link with `<bdi>` show name + title + `seasonEpisodeLong` + Watchlist/Like/Share. Stage uses the §3.4 height formulas; the box is `role="region"`, `tabIndex={-1}`, no ring. Control bar is the exact §3.5 grid; phone `icon-lg` prev/next, desktop `min-h-11 px-6` buttons, disabled when there is no playable neighbour. Episode section is `EpisodeList` with `WatchActions variant="season-row"` at the season row end and one `useWatchAnnouncer` node.
- **Resume (D-10):** positions seeded with `seedPositions(progressMap)`; a switch runs leave -> `forceFlush()` -> set episode -> `resetBaseline(start)` -> load at `resumeSecondsFor(positionsRef.current[target.id])`. Initial mount passes `startSeconds`; `onReady` never seeks. "Resumed at m:ss · Start from the beginning / Start over" uses `formatClock`; only the inner "Resumed at" span truncates (flag e). Start over: `seekTo(0, true)`, `nextPositions(restart)`, baseline 0, focus to the stage box.
- **ENDED (D-09, G1 = B):** `endedReducer(ENDED_MODE, ...)`; `hidden={playerHidden(ENDED_MODE, state)}`; `stopVideo` only through `if (effects.stop) stopPlayer()`. Shipped `'bar'`: the control bar is replaced by `UpNextCard variant="bar"` (`counting`, or `paused` while the box is under 50% in view, `static` under reduced motion, `series-end`); Cancel/Esc gives the normal bar with "Finished" and Next enabled; PLAYING after the end screen's own replay returns the normal bar. `'card'`: `UpNextCard variant="stage"` replaces the stopped, hidden iframe; Watch again un-hides then `seekTo(0)` + `playVideo()`. The countdown ticks once per second only while counting and visible.
- **Un-hide before load:** every load or replay is queued and run from one effect (`if (!pendingPlay || hidden || !playerInstance) return`, deps include `hidden`). No `cueVideoById`.
- **Errors (D-11):** `onError` -> error state (always stops and hides) -> `errorCardFor({ code, storedStatus: youtubeStatuses[id] ?? null, hasNext })`; reportable codes are sent once per episode per page load (signed-in viewers only, fire and forget); 153 logs `[watch] YouTube error 153 (referrer)` once and is never reported. Try again re-runs the switch on the current episode.
- **UAE preflight:** a stored `blocked_ae` episode opens on the UAE card; `YouTubePlayer` is not mounted until a playable episode is current, then it mounts and loads. Switching to a blocked episode stops the current video and shows the card without loading. Blocked episodes stay selectable.
- **Dev check:** while hidden, a development-only effect runs `console.assert(playerIframeHidden(boxRef.current), '[watch] iframe visible under a card')`.
- **Page:** `getEpisodeYouTubeStatuses(episodeIds)` joins the second `Promise.all` for every viewer; passes `youtubeStatuses` and the seconds `progressMap`; `initialProgressSeconds`, `getEpisodeProgress` and prev/next props dropped. Scheduling gate, metadata and JSON-LD unchanged.
- **Toaster:** `RouteScopedToaster` (`usePathname` from `@/i18n/navigation`) returns null for `/watch/...`, otherwise the same dark Toaster moved verbatim. `<Toaster` count in layout.tsx: 0.

## Verification

Verified:
- Plan verification: `node --test` on `watch-layout-guards`, `watch-resume`, `watch-player-state`: 70 pass, 0 fail. Task 2 set with `watch-cards-guards`: 75 pass.
- Full `npm run test:unit`: 919 pass, 0 fail.
- `npx tsc --noEmit` clean; `npx eslint` on `src/components/watch`, the watch route, `route-scoped-toaster.tsx`, the layout and the test: clean.
- Acceptance: `episode-tray.tsx` and `autoplay-overlay.tsx` do not exist; `grep -rn "episode-tray\|autoplay-overlay" src | wc -l` = 0; `grep -c "<Toaster" "src/app/[locale]/layout.tsx"` = 0; Referrer-Policy `strict-origin-when-cross-origin` asserted in `next.config.ts`.
- Mutation check: adding `overflow-hidden` to the start-over button's parent makes the flag (e) guard fail.
- RED before GREEN for every task: Task 1 RED 7 failing, Task 2 RED 6 failing, Task 3 RED 2 failing.

Not verified:
- No browser run, `next build`, `gate:local` or Playwright (project rule: heavy steps go to the controller). So these are source-guarded only: real `offsetParent === null` under the error card, A -> B -> A resume against a live player, the countdown pausing out of view, the landscape media variant and the `!` important stage height, RTL mirroring, and the signed pictures (not opened).
- `reportPlayerError` against real Supabase (no live writes by rule).
- `tests/e2e/watch-page.spec.ts` is stale (old breadcrumb, "Episode selector" tabs, `e1-1-*` ids, and an `[class*="absolute"]` check that the 06-09 player wrapper already trips); not touched here.

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tracker baseline reset overrode the switch's resetBaseline**
- **Found during:** Task 1
- **Issue:** `useProgressTracker` sets `lastSavedRef = 0` in its `[player, episodeId]` effect, which runs after the shell's synchronous `resetBaseline(start)` in the switch, so the resume baseline was lost.
- **Fix:** kept the plan-order call, and added an effect after the tracker call that re-applies `resetBaseline(resumeFrom)` on episode, player and resume-point changes.
- **Files modified:** src/components/watch/watch-shell.tsx
- **Commit:** 50e684d

**2. [Rule 1 - Bug] A stopped player's clock could un-complete an ended episode**
- **Found during:** Task 2
- **Issue:** in card mode Play now / auto-advance run after `stopVideo`; the switch's 'leave' would read 0:00 and write `completed: false` over the 'ended' entry.
- **Fix:** the 'leave' read is skipped when the outgoing episode already ended (`endedEpisodeRef`) or the player is hidden; PLAYING clears the marker.
- **Files modified:** src/components/watch/watch-shell.tsx
- **Commit:** 96d4211

**3. [Rule 2 - A11y] Two nested "Video player" regions**
- **Found during:** Task 2
- **Issue:** the plan puts `role="region"` on the shell box; `youtube-player.tsx` (06-09) still had its own region with the same name inside it.
- **Fix:** the player's outer div is now a plain `relative size-full bg-black`; the shell box is the only landmark. Guarded in the Task 3 test. File is outside the plan's list.
- **Files modified:** src/components/watch/youtube-player.tsx
- **Commit:** 418d427

### Choices inside the plan's scope

- One `WatchActions variant="top" include={['watchlist','like','share']}` covers both phone (Share only, 06-11 hides Watchlist/Like below md) and desktop, so Share is not rendered twice.
- `RouteScopedToaster` is placed inside `NextIntlClientProvider` (it was a sibling after it) so `usePathname` has the locale context.
- Previous / Next and the up-next target use the playable neighbour (`isLive && youtubeId`, the 06-11 list rule); an unplayable neighbour disables the button.
- `reportPlayerError` is only called for signed-in viewers (the server refuses others anyway).
- Mode-aware status line: "Finished" in bar mode after Cancel and in card mode while a card shows; the fresh-start text under an error card.

## Deferred Items (out of scope, not changed)

- `src/hooks/use-idle-timer.ts` has no users now; `vaul` is still in `package.json` with no importer under `src`; `getEpisodeProgress` in `queries.ts` has no caller. Candidates for the 06-19 cleanup.
- `src/app/[locale]/(watch)/layout.tsx` comment still says the layout provides the Toaster and that children use `position: fixed`.
- `tests/e2e/watch-page.spec.ts` needs a rewrite for the stacked layout (see Not verified).

## Known Stubs

None. G8: this plan names no `TODO(phase-N)` markers.

## Threat Flags

None. T-06-53 (stacked flow, guard test), T-06-54 (bar mode untouched, stop before hide, un-hide before load, visibility-gated countdown, onAutoplayBlocked), T-06-55 (Referrer-Policy asserted, 153 never reported) and T-06-56 (per-page-load set plus the 06-09 server limit) are mitigated as planned.

## Self-Check: PASSED

- FOUND: src/components/route-scoped-toaster.tsx, tests/unit/watch-layout-guards.test.ts, src/components/watch/watch-shell.tsx
- GONE as intended: src/components/watch/episode-tray.tsx, src/components/watch/autoplay-overlay.tsx
- FOUND commits: 45a0fdc, 50e684d, 39b4994, 96d4211, 418d427, fe47a8d, 478990a
- STATE.md, ROADMAP.md and src/lib/database.types.ts untouched.
