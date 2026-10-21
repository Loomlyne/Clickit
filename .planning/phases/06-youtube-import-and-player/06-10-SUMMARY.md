---
phase: 06-youtube-import-and-player
plan: 10
subsystem: ui
tags: [watch, up-next, error-card, countdown-ring, intersection-observer, next-intl, node-test]

requires:
  - phase: 06-04
    provides: "EndedState rules (UPNEXT_SECONDS, isVisibleEnough), errorCardFor, isolate"
  - phase: 06-05
    provides: "player.* and watch.* message keys (EN and AR)"
provides:
  - "UpNextCard: 'bar' variant (shipped default, G1 = B) and 'stage' variant (card mode), all states"
  - "CountdownRing: linear SVG ring, 64 and 44 sizes, RTL-mirrored arc, hidden under reduced motion"
  - "useElementVisible: 50% in view and tab visible gate for auto-advance"
  - "PlayerErrorCard: branded error card driven by errorCardFor"
  - "cardGlow helper (brand glow background, mirrored in RTL)"
affects: [06-14]

tech-stack:
  added: []
  patterns:
    - "Presentational cards: the shell (06-14) picks the card and passes callbacks; all copy and layout live here"
    - "Source-scan guard tests for client components that node --test cannot import"

key-files:
  created:
    - src/components/watch/up-next-card.tsx
    - src/components/watch/countdown-ring.tsx
    - src/components/watch/player-error-card.tsx
    - src/hooks/use-element-visible.ts
    - tests/unit/watch-cards-guards.test.ts
  modified: []

key-decisions:
  - "The bar strip is a normal-flow section (no absolute, no inset) so it cannot sit on the visible player; the stage card and error card are absolute inset-0 and only render while the iframe is hidden"
  - "Ring arc is told to travel to the position one second ahead one frame after mount, so it lands exactly when the number changes (linear 1 s transition per step); paused freezes it with no transition"
  - "Bar variant renders nothing for 'cancelled': Cancel hands back to the normal control bar (06-14)"

requirements-completed: [YT-06]

duration: 25min
completed: 2026-10-20
---

# Phase 6 Plan 10: Up-next and error cards Summary

**Up-next bar (shipped default) and card, countdown ring, 50 percent visibility hook and the branded player error card, all state-complete and source-guarded.**

## Task Commits

1. **Task 1: Up-next card, ring, visibility hook** - RED `c44b4db`, GREEN `1c5270f`
2. **Task 2: Branded error card and guard test** - RED `d9348c5`, GREEN `6232eaa`

## What was built

- `up-next-card.tsx`: `UpNextCard({ variant, state, secondsLeft, next, current?, show, onPlayNow, onCancel, onWatchAgain })`.
  - Bar (default): ring 44 at the start, `upNextBarTitle` (rich, `<bdi>`) and `seasonEpisodeLong`, Play now + Cancel; `static` (reduced motion) has no ring and only Play now; `series-end` shows `seriesEndHeading` + `seriesEndBody` and Back to show; `cancelled` renders nothing. Two rows under 640px (`sm:` breakpoint). `bg-[var(--uis-primary-soft)]`.
  - Stage (card mode): container-query layout (`@min-[560px]`), brand glow, 220x124 thumbnail with the 64 ring at `-top-3 -end-3`, narrow layout with the 44 ring; cancelled shows Play now + Watch again; series end shows the done eyebrow, heading, body, Watch again and Back to show.
  - Esc calls `onCancel` while counting, paused or static; one polite announcement on show (`upNextAnnounce`, or the eyebrow when static); focus never moved.
- `countdown-ring.tsx`: SVG per UI-SPEC (track `--line-2`, arc `--primary`, width 3, round caps, 12 o'clock clockwise, `rtl:-scale-x-100` on the circle group only), number via `Intl.NumberFormat` with `tabular-nums`, `aria-hidden`; returns null under reduced motion.
- `use-element-visible.ts`: `IntersectionObserver` (`threshold: [0, 0.5, 1]`, `isVisibleEnough`) combined with `document.visibilityState` through `useSyncExternalStore`; false on the server and first render.
- `player-error-card.tsx`: `PlayerErrorCard({ spec, show, onPrimary, hasNext })`, `role="alert"`, wide "!" circle, reason from `spec.reasonKey`, `errorReported` only when `spec.showReportedLine && !spec.site`, primary Try again / Play next episode, Back to show as secondary, or primary when there is no next episode.
- `watch-cards-guards.test.ts` (10 tests): no `fixed`, `z-20`, `left-`/`right-`, physical spacing, `from-black`, text under 11px, `toast(`, raw HTML; every `<Button` carries `min-h-11` and `px-6` and a default size; bar branch has no `absolute`/`inset-`; `@container` and `@min-[560px]` present; Esc handler; ring and hook rules; error card alert role and reported-line guard.

## Verification

- Verified: `node --test tests/unit/watch-cards-guards.test.ts tests/unit/watch-player-state.test.ts` 44 pass, 0 fail. `npx eslint` on all four source files and the test: clean. `npx tsc --noEmit`: clean.
- Verified: acceptance greps (`variant` count 6; `IntersectionObserver` 1; `visibilityState` 1; forbidden-class grep 0; `px-6` 7; `upNextBarTitle` 1; `isVisibleEnough` 2; `role="alert"` 1). Every message key the cards use exists in `en.json` and `ar.json`.
- Not verified: no browser or visual check of the rendered cards against the signed pictures (no build, no Playwright, nothing mounts these components until 06-14). Ring timing, RTL mirroring and the container-query breakpoints are by source reading only. Pictures were not opened.
- Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `errorCardFor` takes one object argument**
- **Found during:** Task 2
- **Issue:** The plan's interface sketch shows `errorCardFor({ code, storedStatus }, hasNext)`; the shipped 06-04 function is `errorCardFor({ code, storedStatus, hasNext })` and returns `showReportedLine` as well. The card is typed with `ReturnType<typeof errorCardFor>` so it is unaffected, and it reads `showReportedLine` plus `!spec.site` for the reported line.
- **Commit:** 6232eaa

### Additions

- `UpNextCard` takes an optional `current` prop (the finished episode's season and episode) because the series-end eyebrow `upNextDoneEyebrow` needs it and `next` is null at series end.
- `cardGlow(brandHex, rtl)` is exported from `up-next-card.tsx` and reused by the error card (the plan asks for the same glow in both).
- `PlayerErrorCard` also guards `hasNext` itself: with no next episode a `playNextEpisode` primary is shown as Back to show.
- The G1 = B plan text already treats the bar as default; no deviation from the signed decision.

## Known Stubs

None. G8: no Phase 2-5 dependency in this plan, so no `TODO(phase-N)` markers were needed.

## Threat Flags

None. T-06-42 mitigated (React text and `<bdi>`, guard bans raw HTML); T-06-43 mitigated (`useElementVisible` supplies the 50 percent and tab gate, the ring and auto-advance are absent under reduced motion); T-06-44 mitigated (bar has no `absolute`, guard test enforces it; stage and error card render only while the iframe is hidden).

## Notes for 06-14

- Feed `state='paused'` when `endedReducer` is counting but `useElementVisible` is false; feed `'static'` for the bar under reduced motion.
- The bar variant returns null for `cancelled`; the shell shows the normal control bar with status `finished`.
- `autoplay-overlay.tsx` is untouched and still imported by the current shell; 06-14 deletes it.

## Self-Check: PASSED

- All five files exist; commits c44b4db, 1c5270f, d9348c5, 6232eaa in `git log`.
- STATE.md, ROADMAP.md and `src/lib/database.types.ts` untouched.
