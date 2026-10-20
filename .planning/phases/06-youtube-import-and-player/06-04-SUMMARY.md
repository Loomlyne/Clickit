---
phase: 06-youtube-import-and-player
plan: 04
subsystem: ui
tags: [watch, youtube, resume, ended-state, i18n, quota, node-test]

requires:
  - phase: 06-youtube-import-and-player
    provides: "06-00 gate (G8: Phases 2-5 absent); 06-02 YouTubeStatus type"
provides:
  - "resume.ts: resumeSecondsFor, shouldSaveProgress, videoMatchesFor, nextPositions, seedPositions, progressPercent"
  - "ended-state.ts: ENDED_MODE ('bar' default), endedReducer, playerHidden, endedEffects, barView, isVisibleEnough"
  - "player-errors.ts: classifyPlayerError, errorCardFor, REPORTABLE_PLAYER_ERRORS (153 never reportable)"
  - "player-vars.ts: buildPlayerVars (hl, English-only caption vars, start)"
  - "player-dom.ts: playerIframeHidden structural check"
  - "i18n-format.ts: formatClock, isolate, formatNumberList, localeTag"
  - "youtube-quota.ts: nextQuotaReset (midnight America/Los_Angeles), formatQuotaReset (Asia/Dubai)"
affects: [06-05, 06-09, 06-10, 06-14]

tech-stack:
  added: []
  patterns:
    - "Reducers return { state, advance } so the shell un-hides before it loads (UI-SPEC 4.1)"
    - "Runtime relative imports inside pure modules use the .ts extension (youtube-quota -> i18n-format); type-only imports extensionless"

key-files:
  created:
    - src/lib/watch/resume.ts
    - src/lib/watch/ended-state.ts
    - src/lib/watch/player-errors.ts
    - src/lib/watch/player-vars.ts
    - src/lib/watch/player-dom.ts
    - src/lib/i18n-format.ts
    - src/lib/youtube-quota.ts
    - tests/unit/watch-resume.test.ts
    - tests/unit/watch-player-state.test.ts
    - tests/unit/i18n-format.test.ts
    - tests/unit/youtube-quota.test.ts
  modified: []

key-decisions:
  - "ENDED_MODE = 'bar' shipped (D-09, G1 = B, 2026-10-20); 'card' is a built, tested alternative and the same reducer tests run for both modes"
  - "endedEffects.stop fires once when the player becomes hidden (and on every error), not on moves between hidden states; in 'bar' mode only errors stop/hide"
  - "A 'seed' positions event only fills episodes the session has not touched, so a re-seed cannot roll back the A -> B -> A fix"
  - "A 'leave' with NaN, no duration, or a post-seek zero over a real position returns the same map, matching the tracker guards"

requirements-completed: [YT-05, YT-06]

duration: 25min
completed: 2026-10-20
---

# Phase 6 Plan 04: Watch-page and formatting rules Summary

**Pure, tested rules for per-episode resume (A -> B -> A), the 'bar'/'card' ENDED state machine with visibility-gated auto-advance, branded player error mapping with 153 kept out of reports, locale player vars, a clock/number formatter and a DST-safe YouTube quota reset time in Dubai.**

## Task Commits

1. **Task 1: Resume and save rules** - RED `08bc2a5`, GREEN `bd888b2`
2. **Task 2: Player errors, ENDED state machine, player vars, iframe check** - RED `2dc3e32`, GREEN `8b2cd27`
3. **Task 3: Clock/isolate/lists and quota reset** - RED `997cbc3`, GREEN `d7b066d`

No refactor commits were needed.

## Verification

- `node --test` on the four plan test files: 59 tests, 59 pass. Full `npm run test:unit`: 687 pass, 0 fail.
- `npx eslint` on every new source and test file: clean. `npx tsc --noEmit`: clean.
- Acceptance greps: `ENDED_MODE: 'card' | 'bar' = 'bar'` count 1; `grep -cE "^import" src/lib/watch/resume.ts` 0; `Asia/Dubai` and `America/Los_Angeles` present in `youtube-quota.ts`; no `@/`, `server-only` or `next/` in any new source file.
- DST checks: PDT reset 07:00Z (11:00 Dubai), PST reset 08:00Z (12:00 Dubai), the exact reset instant rolls 24 h, November 2026 and March 2027 transitions, and a 400-sample loop asserting the result is always 00:00 in Los Angeles.
- Not verified: no build, `gate:local` or browser run (not required; nothing consumes these modules yet). The `IntersectionObserver` hook, `hidden`/`stopVideo` wiring and the real iframe check belong to 06-10 and 06-14.

## Notes for consumers

- `endedReducer(mode, state, event, visible)` returns `{ state, advance }`. `visible` is the shell's stored flag (player box >= 50% in view and tab visible); `visibility` events carry the new value for the shell to store and never change state themselves.
- Reduced motion: 'bar' opens `upnext { counting: false, reduced: true }` (only Play now); 'card' opens `cancelled`.
- `errorCardFor` returns `primary`/`secondary`; with no next episode `playNextEpisode` is dropped and `backToShow` becomes primary (secondary null). `reportable` and `showReportedLine` are false for 153, unknown codes and preflight `blocked_ae`.
- Message keys only: reasons live under `player`, buttons are `player.tryAgain`, `player.playNextEpisode`, `watch.backToShow`. Strings land in 06-05.
- Quota copy: compute `formatQuotaReset(nextQuotaReset(new Date()), locale)` for `{time}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Wrong expectation in my own save-guard test**
- **Found during:** Task 1 GREEN
- **Issue:** asserted `shouldSaveProgress({currentTime: 1, lastSaved: 2})` is true, but the 10 s delta guard (correctly) refuses it.
- **Fix:** the case now sets `force: true`, which is what it was meant to test (the below-2 s guard allows a save when lastSaved <= 2).
- **Files modified:** tests/unit/watch-resume.test.ts
- **Commit:** bd888b2

### Additions inside the plan's scope (not in the behavior list)

- `nextPositions` 'leave' ignores NaN, missing duration and post-seek zero over a real position, so the in-session map never diverges from what the tracker would save.
- `errorCardFor` also returns `showReportedLine` and `site` for the card renderer.
- `MIN_VISIBLE_RATIO` and `PlayerVars` type exported next to their functions.

## Known Stubs

None. G8: no TODO(phase-N) markers were required by this plan (pure modules, no Phase 2-5 dependency).

## Threat Flags

None. T-06-17 mitigated (allow-list, 153 and unknown codes not reportable, tested); T-06-18 accepted with 'bar' shipped; T-06-19 mitigated (tick moves only while `visible`, reduced motion never counts).

## Self-Check: PASSED

- All 11 files exist; commits 08bc2a5, bd888b2, 2dc3e32, 8b2cd27, 997cbc3, d7b066d in `git log`.
- STATE.md and ROADMAP.md untouched; `src/lib/database.types.ts` untouched.
