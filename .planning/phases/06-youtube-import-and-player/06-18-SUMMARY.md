---
phase: 06-youtube-import-and-player
plan: 18
subsystem: ui
tags: [admin, youtube, episodes-table, renumber, dashboard, i18n, node-test, tdd]

requires:
  - phase: 06-05
    provides: "admin.episodesTable / admin.dashboard / admin.youtubeStatus strings, YouTubeStatusChip"
  - phase: 06-08
    provides: "cantPlayReason, summarizeYouTubeHealth, CHECK_OVERDUE_HOURS"
  - phase: 06-13
    provides: "renumberSeason, reorderEpisode Server Actions"
  - phase: 06-15
    provides: "EpisodeFormDrawer initialFocus='title'"
  - phase: 06-17
    provides: "ImportPlaylistSheet"
provides:
  - "Episodes table with 44px arrows, move failure messages, Can't play badge and Needs English title mark"
  - "RenumberSeasonDialog and planRenumber (pure)"
  - "Gap hint and the empty-state Import entry in the season tabs"
  - "YouTubeCheckPanel on the admin dashboard"
affects: [06-19, 06-20, 06-22]

tech-stack:
  added: []
  patterns:
    - "Pure plan module (planRenumber) decides when the control shows and what changes; the database function stays the only writer"
    - "Source-scan guard test over the admin order UI files (logical properties, no tiny text, no small buttons, px-6 on default Buttons, flag-only)"

key-files:
  created:
    - src/components/admin/renumber-season-dialog.tsx
    - src/components/admin/youtube-check-panel.tsx
    - src/lib/admin/renumber-plan.ts
    - tests/unit/admin-order-ui-guards.test.ts
    - tests/unit/renumber-plan.test.ts
  modified:
    - src/components/admin/episodes-table.tsx
    - src/components/admin/season-tabs.tsx
    - src/app/[locale]/admin/page.tsx

key-decisions:
  - "Edit and Archive in the table became default-size (44px, px-6) buttons in a wrapping group so no target is under 44px; the actions cell may wrap on narrow screens instead of squeezing the 8px gaps"
  - "Focus after a move is restored through a ref read when the transition ends (no setState in an effect), falling back to the row's other arrow when the clicked one is now disabled"
  - "The dashboard page renders no panel when the status read fails, so 'All episodes play' is never shown for data that was not read"
  - "Episodes of archived or missing shows are skipped on the dashboard (titles come from the non-archived shows list)"
  - "Gap hint shows whenever the active numbers are not exactly 1..N (also for a season that starts above 1)"

requirements-completed: [YT-07, YT-02]

duration: ~25min
completed: 2026-10-20
---

# Phase 6 Plan 18: Order, renumber and Can't-play flags in the admin Summary

**Safe 44px up/down arrows with a clear failure message, a deliberate "Renumber 1 to N" dialog with a change list, "Can't play" and "Needs English title" marks in the episodes table, a dashboard "YouTube check" panel, and an Import entry for shows with no seasons; nothing unpublishes or hides an episode.**

## Task Commits

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | Episodes table arrows, failure handling and flags | 9533d7a | 7e00cca |
| 2 | Renumber dialog, gap hint, empty-state import entry | 5e23c7b | e916bb9 |
| 3 | Dashboard YouTube check panel and UI guards | 9235746 | 9e21129 |

No refactor commits.

## What was built

- **Episodes table (`episodes-table.tsx`):** arrows are `outline icon-lg` 44px circles with `disabled:opacity-35`, in a `w-64` actions cell. While saving, every arrow of that table is disabled and the clicked one shows a spinner (`motion-reduce:animate-none`). The optimistic reorder is unchanged (swap with the array neighbour = nearest active episode, whatever its number, D-13). Success: the moved row gets `bg-[var(--uis-primary-soft)]` for 1200 ms (`duration-700`, `motion-reduce:transition-none`), a hidden `aria-live="polite"` line says `moved`, and focus returns to the same arrow by episode id. Failure: the optimistic order reverts when the transition ends and `toast.error(moveFailed)` carries the server reason (a thrown action is caught and reported the same way). Status cell: bad chip `cantPlayBadge` with the reason (status text or `cantPlayViewerReport`) and the check date in Dubai time, from the shared `cantPlayReason`. Title cell: warn chip from the shared `needsEnglishTitle`; Edit on such a row passes `initialFocus="title"`. Edit and Archive keep 8px gaps and are 44px each.
- **`RenumberSeasonDialog` + `planRenumber`:** the control exists only when the active numbers are not exactly 1..N. Own `Dialog` with `showCloseButton={false}` and a `size-11` close at `end-4`; lists changed episodes only (8 max, then `renumberMore`); description states the change is logged; confirm calls `renumberSeason(showId, seasonId)` once; success closes, toasts `renumberDone`, `router.refresh()`; failure keeps the dialog open with `renumberFailed` in a `role="alert"` line. Closing is blocked while the call runs. The server (06-07) puts archived episodes after N and writes the audit row (G3, D-19).
- **Season tabs:** Renumber button first in each season's action group; `gapsHint` with `formatNumberList` on the count line; the other buttons are now default-size 44px with `px-6`. A show with no seasons shows "Add season" and `ImportPlaylistSheet trigger="outline"` side by side.
- **Dashboard:** `YouTubeCheckPanel` between the profile card and the shows header. The page reads episode status columns, seasons and the already-loaded shows (admin client), joins in code, and calls `summarizeYouTubeHealth(rows, new Date())`. States: all good, broken count with up to five `min-h-11` links to `/admin/shows/{showId}` and `cantPlayMore`, never checked, `checkOverdue` chip past 36 hours.

## Verification

Verified:
- `tests/unit/admin-order-ui-guards.test.ts` (14 tests) and `tests/unit/renumber-plan.test.ts` (5 tests): pass. RED shown first for each task (6 of 6, then 3 of 9, then 5 of 14 failing before the code).
- `tests/unit/youtube-health.test.ts`: pass.
- `npm run test:unit`: 1017 pass, 0 fail.
- `npx tsc --noEmit`: clean. `npx eslint` on all five source files: clean.
- Acceptance greps: `size="icon-lg"` 2, `size="icon-sm"` 0, `w-64` present, `containsArabicScript` 0, `showCloseButton={false}` 1, `renumberSeason(` 1 in the dialog, `summarizeYouTubeHealth` 1 line in `admin/page.tsx`, `YouTubeCheckPanel` 2 lines.

Not verified:
- No browser or visual check against `06-q13.png`; no `next build`, no Playwright (heavy steps not run).
- Arabic/RTL rendering of the new rows, the focus return after a move, and the wrap of the actions cell on narrow screens were not looked at.
- The live `renumber_season` function and the dashboard read were not run (no live or local database use).

Failed: none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Dashboard read failure shows no panel**
- **Found during:** Task 3
- **Issue:** An unchecked error from the status read would have produced "All episodes play" or "Not checked yet" for data that was never read.
- **Fix:** On error the page logs and renders no panel.
- **Files modified:** `src/app/[locale]/admin/page.tsx`
- **Commit:** 9e21129

**2. [Rule 3 - Blocking] Guard rules forced wider button conversion and comment rewording**
- **Found during:** Tasks 1 to 3
- **Issue:** The plan's guard (no `size="sm"`, `px-6` on every default Button, no `right-`/`unpublish` text) applies to the whole files, which still had `size="sm"` buttons (Edit, Archive, Edit season, Add episode) and comments naming `right-4` / unpublish.
- **Fix:** Converted those four buttons to default-size 44px with `min-h-11 px-6 py-2 text-sm font-bold` and reworded the comments.
- **Commits:** 7e00cca, e916bb9, 9e21129

**3. [Plan addition] `src/lib/admin/renumber-plan.ts` and its unit test**
- The decision "is the control needed, what changes" is shared by the dialog and the season tabs; kept pure so it is tested for real instead of only source-scanned. Commit e916bb9.

**4. Arrow buttons written out twice**
- The plan's acceptance wants `size="icon-lg"` on at least two lines, so up and down are two explicit blocks instead of a map.

## Known Stubs

None. (G8: no Phase 2 to 5 module is needed by this plan, so no `TODO(phase-N)` marker was required.)

## Threat Flags

None. The dashboard service-role read of status columns is the accepted T-06-76. T-06-75 is mitigated by visible 44px controls with 8px gaps and no hit-area pseudo-elements.

## Self-Check: PASSED

- Files found: renumber-season-dialog.tsx, youtube-check-panel.tsx, renumber-plan.ts, admin-order-ui-guards.test.ts, renumber-plan.test.ts.
- Commits found: 9533d7a, 7e00cca, 5e23c7b, e916bb9, 9235746, 9e21129.
