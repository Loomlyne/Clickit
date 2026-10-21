---
phase: 06-youtube-import-and-player
plan: 12
subsystem: ui
tags: [youtube, import, admin, table, i18n, node-test, tdd]

requires:
  - phase: 06-02
    provides: "YouTubeStatus semantics (status precedence)"
  - phase: 06-04
    provides: "formatClock, localeTag, isolate"
  - phase: 06-05
    provides: "admin.youtubeImport / admin.youtubeStatus strings, YouTubeStatusChip"
provides:
  - "importRowView / ImportTableRow: pure status to chip key, tone, reason key, params and clock mapping"
  - "ImportPlaylistTable: presentational preview table for the import sheet (UI-SPEC 1.6-1.7)"
affects: [06-17]

tech-stack:
  added: []
  patterns:
    - "Row view model in a pure module (runtime relative import carries .ts), markup in a client component, source-scan guard test for the component"
    - "aria-label from rich message via t.markup with the title isolated (FSI/PDI)"

key-files:
  created:
    - src/lib/admin/import-row-view.ts
    - src/components/admin/import-playlist-table.tsx
    - tests/unit/import-row-view.test.ts
    - tests/unit/admin-import-table-guards.test.ts
  modified: []

key-decisions:
  - "ImportTableRow is local to the table; 06-17 maps the server PreviewRow onto it"
  - "A not_ready row with a missing or unparsable premieresAt falls back to reason.processing"
  - "An 'already' row without a known location keeps its chip and is skipped but has no reason line (no params to fill the message)"
  - "Ready rows with privacy null show no visibility subline rather than guessing Public"
  - "Tick cell uses p-0 (the 44px label box is the cell); every other body cell is px-2 py-0"

requirements-completed: [YT-01, YT-02]

duration: 12min
completed: 2026-10-20
---

# Phase 6 Plan 12: Import preview table Summary

**A standalone `ImportPlaylistTable` (tick box, thumbnail, two-line title, length, status chip; skipped rows greyed and disabled with their reason; skeleton rows while reading) backed by a tested pure `importRowView` mapping, ready for the sheet in 06-17.**

## Task Commits

1. **Task 1: Pure row view mapping**
   - RED `91ce0ca` (test), GREEN `7f46e19` (feat)
2. **Task 2: ImportPlaylistTable component and guard test**
   - RED `4146b69` (test), GREEN `7714b65` (feat)

No refactor commits.

## What was built

- `importRowView(row, locale)`: Ready rows are tickable with `sublineKeys` (`visibilityPublic` / `visibilityUnlisted`, plus `arabicTitle`); Private, Removed, Not embeddable and Blocked in UAE are `bad` with `reason.*` keys; Not ready is `warn` with `reason.premieres` and a `{date}` (Asia/Dubai, `ar-AE` / `en-GB`) or `reason.processing`; Already is `neutral` with `{show, season, episode}`. `time` is `formatClock` or an em dash.
- `ImportPlaylistTable({ rows, ticked, onToggle, onToggleAllReady, skeletonRows, disabled, locale })`: container, sticky `h-11` header with select-all-Ready checkbox (`indeterminate` when partly ticked), 64px rows, whole-row click toggles Ready rows (label click stops propagation so it cannot double toggle), skipped rows get `aria-disabled="true"`, `text-[var(--text-mute)]`, `opacity-40` thumbnail, disabled checkbox and no hover. Thumbnail is `next/image unoptimized`, `alt=""`, `bg-[var(--bg-3)]` box when missing. Title is `<div className="truncate text-sm"><bdi>…</bdi></div>`; subline is 11px, with the length appended under 640px. `#` and Time columns are `max-sm:hidden`. The table is `aria-busy` while skeleton rows show.

## Verification

- `node --test tests/unit/import-row-view.test.ts tests/unit/admin-import-table-guards.test.ts`: 22 tests, 22 pass (11 + 11).
- RED confirmed before each GREEN (module not found; 11 guard failures).
- `npx eslint` on both source files and both tests: clean. `npx tsc --noEmit`: clean.
- `grep -cE "from '@/|server-only|next/" src/lib/admin/import-row-view.ts`: 0.
- Not verified: no build, `gate:local`, browser or visual check against the mockup (not required; nothing renders the table until 06-17). Phone/RTL layout is checked by class scan only.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. `ImportPlaylistTable` receives all data by props; the sheet that feeds it is 06-17.

## Threat Flags

None. Titles render as React text inside `<bdi>`; thumbnails are `unoptimized` and come only from API-returned URLs; no new primitives or registry pulls (T-06-47, T-06-48).

## Self-Check: PASSED

- FOUND: src/lib/admin/import-row-view.ts, src/components/admin/import-playlist-table.tsx, tests/unit/import-row-view.test.ts, tests/unit/admin-import-table-guards.test.ts
- FOUND commits: 91ce0ca, 7f46e19, 4146b69, 7714b65
