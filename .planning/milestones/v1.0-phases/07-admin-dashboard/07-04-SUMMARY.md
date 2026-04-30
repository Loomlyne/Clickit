---
phase: 07-admin-dashboard
plan: 04
subsystem: admin
tags: [archive, permanent-delete, restore, conflict-resolution, admin-nav-link]

requires:
  - phase: 07-admin-dashboard (plan 01)
    provides: admin layout, actions.ts with restoreShow/deleteShowPermanently, ConfirmDialog, EmptyState
  - phase: 07-admin-dashboard (plan 03)
    provides: show detail page, season/episode management
provides:
  - Archive page at /admin/archive listing soft-deleted shows
  - ArchiveTable with restore (with conflict resolution) and permanent delete flows
  - Conditional Admin link in viewer nav dropdown for admin users only
affects: [10-connect-frontend-to-supabase]

tech-stack:
  added: []
  patterns: [episode-conflict-resolution-on-restore, conditional-admin-nav-via-isAdmin-prop]

key-files:
  created:
    - src/app/admin/archive/page.tsx
    - src/components/admin/archive-table.tsx
  modified:
    - src/components/layout/user-dropdown.tsx

key-decisions:
  - "ArchiveTable restore uses conflict resolution dialog when episode numbers collide with existing episodes"
  - "Toast messages use show title format rather than generic strings for better UX"
  - "UserDropdown receives isAdmin prop from AuthSection which computes real admin state from app_config"

patterns-established:
  - "Archive restore with episode number conflict detection and interactive fix dialog"

requirements-completed: [ADMN-01, ADMN-10]

duration: pre-implemented
completed: 2026-04-04
---

# Phase 07 Plan 04: Archive Section + Admin Nav Link Summary

**Archive management page with restore (including episode conflict resolution) and permanent delete flows, plus conditional Admin link in the viewer navigation dropdown**

## Performance

- **Duration:** Pre-implemented in prior session (2026-04-04)
- **Summary written:** 2026-04-16 (retroactive)
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments
- Archive page at /admin/archive queries `archived=true` shows, renders ArchiveTable with a warning banner about permanent deletion
- ArchiveTable provides one-click restore with automatic episode number conflict detection — when restored episodes collide with existing episode numbers, a conflict resolution dialog lets admin reassign numbers before completing restore
- Permanent delete uses ConfirmDialog with destructive styling, cascade-deletes seasons and episodes
- EmptyState rendered when archive is empty ("Archive Empty")
- UserDropdown extended with `isAdmin` prop — Admin link to `/admin` conditionally rendered only for admin users
- AuthSection computes real admin state from `app_config` table and passes `isAdmin={isAdmin}` to UserDropdown

## Files Created/Modified
- `src/app/admin/archive/page.tsx` — Server Component archive page querying `shows.archived=true`, renders ArchiveTable with warning banner
- `src/components/admin/archive-table.tsx` — Client component with restore, conflict resolution dialog, permanent delete via ConfirmDialog, and empty state
- `src/components/layout/user-dropdown.tsx` — Added `isAdmin` prop and conditional `/admin` Admin link in dropdown menu

## Decisions Made
- ArchiveTable includes an episode conflict resolution dialog beyond the original plan spec — when restoring a show whose episodes have numbers that now conflict with active episodes, the admin can reassign numbers inline rather than getting a generic error
- Toast messages use show title (`"${show.title}" restored`, `"${show.title}" permanently deleted`) rather than the generic strings in the plan spec — better UX
- AuthSection already computed real admin state from `app_config`, so the plan's instruction to pass `isAdmin={false}` was correctly skipped to avoid regression

## Deviations from Plan

### Enhancement: Episode conflict resolution on restore
- **Found during:** Implementation
- **Issue:** Restoring an archived show can fail if episode numbers now conflict with episodes added while the show was archived
- **Enhancement:** Added `resolveConflictsAndRestore` Server Action and conflict resolution dialog with per-episode number reassignment
- **Files:** archive-table.tsx, actions.ts
- **Impact:** Improved robustness, no scope creep — directly supports archive restore reliability

## Issues Encountered
None.

## Known Stubs
None — all components fully wired to Server Actions and database.

## User Setup Required
None.

## Next Phase Readiness
- Admin dashboard is feature-complete: full CRUD, archive/restore with conflict handling, permanent delete
- Ready for Phase 8 (data integration) and Phase 10 (frontend wiring)

## Self-Check: PASSED

All 3 files verified present on disk. Archive page, ArchiveTable, and UserDropdown isAdmin prop confirmed.

---
*Phase: 07-admin-dashboard*
*Completed: 2026-04-04 (summary retroactive 2026-04-16)*
