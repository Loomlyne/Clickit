---
phase: 06-youtube-import-and-player
plan: 17
subsystem: ui
tags: [youtube, import, admin, sheet, scheduler, i18n, node-test, tdd]

requires:
  - phase: 06-04
    provides: "nextQuotaReset, formatQuotaReset, isolate"
  - phase: 06-05
    provides: "admin.youtubeImport / youtubeErrors / youtubeStatus strings, YouTubeStatusChip"
  - phase: 06-12
    provides: "ImportPlaylistTable, ImportTableRow"
  - phase: 06-13
    provides: "previewPlaylistPage, commitImport, previewShowSchedule/applyShowSchedule with episodeIds"
provides:
  - "import-sheet-state.ts: pure toTableRow, initialTicks, tickedInPlaylistOrder, summarizeTicks, bannerForCode, canImport"
  - "ImportPlaylistSheet: the signed side sheet (link, target, page-by-page reading, table, states, success)"
  - "ScheduleEpisodesButton controlled mode (open, onOpenChange, episodeIds, hideTrigger)"
  - "Import entry button on the show admin page"
affects: [06-18]

tech-stack:
  added: []
  patterns:
    - "Pure state module for the sheet (runtime relative imports carry .ts), markup in a client component, source-scan guard test"
    - "Preview load in an effect keyed on open, with null-until-answered state (no synchronous setState in the effect)"

key-files:
  created:
    - src/lib/admin/import-sheet-state.ts
    - src/components/admin/import-playlist-sheet.tsx
    - tests/unit/import-sheet-state.test.ts
    - tests/unit/admin-import-sheet-guards.test.ts
  modified:
    - src/components/admin/schedule-episodes-button.tsx
    - src/app/[locale]/admin/shows/[id]/page.tsx

key-decisions:
  - "Cancel schedule is hidden when the scheduler is limited to chosen episodes: that action clears the whole show's schedule, which a dialog about N new drafts must not offer"
  - "A preview refusal without a typed code is shown as the network banner (with Try again)"
  - "A quota refusal during Import (commit) shows the quota message with the reset time instead of the generic importFailed text"
  - "The scheduler warning banner lists one line per issue (no video, needs English title, can't play) with the count in front of the existing label strings; no new i18n keys"
  - "Link parse errors appear after the 400 ms idle, on paste or on Enter, never mid-typing"

requirements-completed: [YT-01, YT-02]

duration: ~10min (19:26-19:35 CET commits)
completed: 2026-10-20
---

# Phase 6 Plan 17: Import side sheet Summary

**From a show's admin page, "Import season from YouTube" opens the signed side sheet: paste a playlist link, it reads up to four pages into the 06-12 table, the admin picks a new or existing season, imports the ticked Ready videos as drafts, and "Schedule these N episodes" opens the existing scheduler limited to exactly those drafts.**

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | RED: sheet state tests | 825c565 |
| 1 | GREEN: state module and sheet core | 48c8923 |
| 2 | RED: states guard test | 36e71cb |
| 2 | GREEN: states, banners, success | 65c8573 |
| 3 | RED: scheduler and show page guards | 6723f26 |
| 3 | GREEN: scheduler controlled mode, show page entry | b0299b9 |

No refactor commits.

## What was built

- **`import-sheet-state.ts`** (pure, no `@/`, `next/*` or `server-only`): `toTableRow` maps the server row field for field; `initialTicks` ticks Ready rows only; `tickedInPlaylistOrder` sorts by position and drops any tick that is not a Ready row; `summarizeTicks` returns ready / cantPlay / already / tickedCount and the first and last episode number (new season from 1, existing season after its last episode); `bannerForCode` picks the `admin.youtubeErrors` key via `YOUTUBE_ERROR_MESSAGE_KEYS`, the action (settings, retry, none), `needsTime`, `disableLink` and the panel (banner or dashed); `canImport` is false while reading or importing, with no ticks, with a blank new-season title, or when `blocked`.
- **`ImportPlaylistSheet`**: trigger (`ListVideo`, enabled without a key); frame per UI-SPEC 1.2 (side flips for Arabic, own close button, `showCloseButton={false}`); link field reading on paste, after 400 ms and on Enter, only when `parsePlaylistId` accepts; target Select plus season title (prefilled from the playlist unless edited, `maxLength=120`, `dir="auto"`) or the append note; reading loop over at most `IMPORT_MAX_ITEMS / 50` pages with no auto-retry; summary chips, meta and numbering note inside one `aria-live` region (`aria-busy` while reading); `ImportPlaylistTable` fed through `toTableRow`; all 1.8 states (empty, reading/paging, nothing new, nothing importable, empty playlist, private, quota with `formatQuotaReset(nextQuotaReset(now))`, key missing with the link disabled, key rejected, network with Try again, importing lock, import failed with ticks kept); success column with the heading focused, the Needs English chip and the Done / Schedule footer. The commit call sends exactly `showId`, `playlistId`, `videoIds` (playlist order) and `target`.
- **`ScheduleEpisodesButton`**: optional `open`, `onOpenChange`, `episodeIds`, `hideTrigger`. Controlled and uncontrolled share one effect that previews whenever the dialog opens; `previewShowSchedule(showId, episodeIds)` and `applyShowSchedule(showId, episodeIds)`. The warning banner now also covers slots with `needsEnglishTitle` or a non-ok stored `youtubeStatus`. Uncontrolled use keeps its copy and look.
- **Show page**: `ImportPlaylistSheet` first in the header action group, with `seasons` (locale-aware title, `lastEpisodeNumber` from `maxEpisodeNumberBySeason`) and `nextSeasonNumber` (max + 1, or 1).

## Verification

Verified:
- `node --test tests/unit/import-sheet-state.test.ts tests/unit/admin-import-sheet-guards.test.ts`: 29 pass, 0 fail (17 state + 12 guards). RED shown before each GREEN (module not found; the states guard failed; 5 scheduler/page guards failed).
- `npm run test:unit`: 998 pass, 0 fail.
- `npx tsc --noEmit`: clean. `npx eslint` on the sheet, the state module, the scheduler, the show page and both tests: clean.
- Acceptance greps: `showCloseButton={false}` 1; flag (a) label override 1; `ImportPlaylistTable` 3; `toTableRow` 2; `previewPlaylistPage` 2; `commitImport` 2; forbidden-class grep 0; `formatQuotaReset` 2; `px-6` 10; `episodeIds` in the scheduler 6; `onOpenChange` 4; `ImportPlaylistSheet` in the show page 2; import-sheet-state forbidden-import grep 0.

Not verified:
- No browser run: the sheet layout, RTL flip, the Select inside the sheet, focus on the success heading, focus return to the trigger, and the hand-off from the closing sheet to the opening scheduler dialog (two Radix dialogs changing in the same tick) were not seen on screen.
- No live YouTube call and no key; the paging loop, refusals and commit rest on the 06-06/06-13 core tests plus the source guards here. No Supabase command, no build, `gate:local` or Playwright (heavy, left to the PR gate).
- Arabic text of the new surfaces not rendered (string parity is covered by the 06-05 message test).

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Cancel schedule hidden in the filtered scheduler**
- **Found during:** Task 3
- **Issue:** The scheduler dialog's "Cancel schedule" calls `unscheduleShowEpisodes(showId)`, which clears the schedule of the whole show. In a dialog limited to the N new drafts that would be a surprising, destructive action.
- **Fix:** The button renders only when `episodeIds` is not set; uncontrolled use is unchanged. Guard test added.
- **Files modified:** src/components/admin/schedule-episodes-button.tsx, tests/unit/admin-import-sheet-guards.test.ts
- **Commit:** b0299b9

**2. [Rule 3 - Blocking] Scheduler preview moved into an effect**
- **Found during:** Task 3
- **Issue:** Controlled mode has no click handler to start the preview (the parent flips `open`), so the old `openDialog()` could not run.
- **Fix:** One effect keyed on `open`, `showId`, `episodeIds`; state is `null` until the preview answers, so no synchronous setState runs in the effect (lint clean).
- **Commit:** b0299b9

## Known Stubs

None. Every control is wired: link to the preview action, ticks to the commit, success to the scheduler.

## Threat Flags

None. The only new surface is the client calling the 06-13 actions that already exist; the payload shape is guarded (T-06-69), playlist titles render as React text and a controlled input with `maxLength=120` (T-06-70), the loop stops at 4 pages and Try again is a user click (T-06-71), no registry components (T-06-72).

## Self-Check: PASSED

- FOUND: src/lib/admin/import-sheet-state.ts, src/components/admin/import-playlist-sheet.tsx, tests/unit/import-sheet-state.test.ts, tests/unit/admin-import-sheet-guards.test.ts
- FOUND commits: 825c565, 48c8923, 36e71cb, 65c8573, 6723f26, b0299b9
