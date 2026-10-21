---
phase: 06-youtube-import-and-player
plan: 07
subsystem: api
tags: [renumber, reorder, scheduler, audit, rpc, node-test]

requires:
  - phase: 06-01
    provides: "public.renumber_season SQL function (migration 20261020150526) and its Phase 6 DB types"
  - phase: 06-02
    provides: "needsEnglishTitle rule in src/server/youtube/script.ts"
provides:
  - "renumberSeasonCore, callRenumberSeasonRpc (src/lib/admin/episode-lifecycle.ts)"
  - "emulateRenumberSeason test emulator"
  - "planShowScheduleCore(db, showId, now, episodeIds?) with needsEnglishTitle and youtubeStatus on each slot"
affects: [06-13, 06-18]

key-files:
  created:
    - tests/unit/helpers/renumber-season-emulator.ts
    - tests/unit/admin-renumber.test.ts
  modified:
    - src/lib/admin/episode-lifecycle.ts
    - src/lib/admin/show-schedule.ts
    - tests/unit/admin-episode-lifecycle.test.ts
    - tests/unit/admin-show-schedule.test.ts

key-decisions:
  - "The 'renumber' compensation step has no undo: the SQL function is all-or-nothing (D-19). An audit failure after success returns 'left in place' with wrote true."
  - "An RPC failure (refusal, missing function or other) returns wrote false; non-refusals also write one failed audit row, refusals write nothing."
  - "Scheduler episodeIds are de-duplicated, then any non-uuid id refuses before a read; a count mismatch refuses (foreign show, archived, published, unknown)."

requirements-completed: [YT-07, YT-01]

duration: 15min
completed: 2026-10-20
---

# Phase 6 Plan 07: Renumber core and scheduler filter Summary

**Renumber is one audited call to public.renumber_season with every error mapped and no app-side undo; the scheduler plan can now be limited to chosen episode ids and each slot reports needsEnglishTitle and youtubeStatus.**

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | renumberSeasonCore, emulator, reorder gap case | 9901ce2 |
| 2 | Scheduler episode filter and warnings | fd3f857 |

## What was built

- `renumberSeasonCore(db, deps, showId, seasonId)`: parses both ids, reads the season, checks it belongs to the show (no RPC otherwise), then runs `renumber` then `audit` through `runWithCompensation`. Success returns `data: { showId, map }` and writes one audit row `{ action: 'update', entity: 'season', diff: { kind: 'renumber', map } }` where the map lists only changed rows (archived included). Errors: P0002 -> "Season not found.", P0001 "Already numbered" -> "Already numbered 1 to N." (refusal, no audit), PGRST202/42883 -> message naming the Phase 6 migration and `public.renumber_season`.
- `callRenumberSeasonRpc` casts the client like `callReorderEpisodeRpc` (types do include `renumber_season` after 06-01, but the cast keeps the error shape identical to reorder).
- `emulateRenumberSeason` mirrors the SQL rules and error codes; header states real SQL runs only on the controller's local stack.
- Reorder gap case (1, 2, 4: moving 4 up gives it 2, the other gets 4) added to `admin-episode-lifecycle.test.ts`; passes against the existing emulator with no code change.
- `planShowScheduleCore` gained `episodeIds?` (de-duplicated, `parseId` each, `.in('id', ids)`, refuse on count mismatch with "Some selected episodes cannot be scheduled."), selects `title_ar` and `youtube_status`, and slots carry `needsEnglishTitle` and `youtubeStatus`. `applyShowScheduleCore` unchanged.

## Deviations from Plan

1. **[Rule 1 - plan example wrong] needsEnglishTitle test input.** The plan says `'Ep 1 حلقة'` gives false, but the shared rule (Arabic letters at least half of all letters) gives true for it (2 Latin vs 4 Arabic letters). The rule in `script.ts` was not touched; the test uses `'Episode 1 حلقة'` (7 vs 4) for the false case.
2. **TDD ordering:** tests and implementation for each task were written together and committed once per task, so there are no separate RED commits for 06-07. The tests were run green before each commit.
3. Added extra tests beyond the list: duplicate id in the scheduler list counts once; archived-only season is a refusal.

## Verification

- Verified: `node --test` for admin-renumber, admin-episode-lifecycle, admin-show-schedule and admin-actions-season-episode-wrappers (76 pass, 0 fail); eslint on all touched files clean; `npx tsc --noEmit` clean; `grep -c renumber_season` in episode-lifecycle.ts is at least 1; `episodeIds` appears 3 times in show-schedule.ts; the renumber step has no `undo` key (asserted in a test).
- Not verified: the real SQL function against Postgres (controller's local stack only); the UI that calls these cores (06-13, 06-18).
- Failed: nothing.

## Known Stubs

None. `renumberSeasonCore` has no caller yet (the action wrapper is a later plan); `episodeIds` is not yet passed by any wrapper (06-13).

## Threat Flags

None. T-06-28/29/30 mitigations are in place: parseId on both ids and show scoping, one audit row with the full map plus a failure audit row, scheduler ids parsed and count-checked.

## Self-Check: PASSED

Files exist; commits 9901ce2 and fd3f857 are on branch phase-06-youtube-import-player.
