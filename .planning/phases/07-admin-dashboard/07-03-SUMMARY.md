---
phase: 07-admin-dashboard
plan: 03
subsystem: ui
tags: [react-hook-form, zod, shadcn-tabs, shadcn-sheet, youtube-embed, admin-crud]

requires:
  - phase: 07-admin-dashboard (plan 01)
    provides: admin layout, actions.ts with all Server Actions, database types
  - phase: 07-admin-dashboard (plan 02)
    provides: ShowsTable, ShowFormDrawer, StatusBadge, ConfirmDialog, EmptyState
provides:
  - Show detail page at /admin/shows/[id] with breadcrumb navigation
  - SeasonTabs component for tab-per-season navigation
  - EpisodesTable with reorder arrows, edit, and archive
  - SeasonFormDrawer for season CRUD
  - EpisodeFormDrawer for episode CRUD with YouTube URL input
  - YouTubeUrlInput component for video ID extraction and thumbnail preview
affects: [07-admin-dashboard plan 04, 10-connect-frontend-to-supabase]

tech-stack:
  added: []
  patterns: [z.number() with valueAsNumber for react-hook-form + Zod v4 coercion, useTransition for optimistic reorder]

key-files:
  created:
    - src/app/admin/shows/[id]/page.tsx
    - src/components/admin/season-tabs.tsx
    - src/components/admin/episodes-table.tsx
    - src/components/admin/season-form-drawer.tsx
    - src/components/admin/episode-form-drawer.tsx
    - src/components/admin/youtube-url-input.tsx
  modified: []

key-decisions:
  - "Used z.number() with register valueAsNumber instead of z.coerce.number() to avoid Zod v4 input type mismatch with zodResolver"
  - "SeasonTabs uses router.refresh() after mutations for server data revalidation"
  - "EpisodesTable uses useTransition for reorder to disable buttons during pending state"

patterns-established:
  - "Zod v4 + react-hook-form: use z.number() with register({ valueAsNumber: true }) instead of z.coerce.number()"
  - "Table reorder pattern: useTransition wrapping Server Action call with disabled state on buttons"

requirements-completed: [ADMN-02, ADMN-03, ADMN-05, ADMN-08, ADMN-09]

duration: 4min
completed: 2026-04-03
---

# Phase 07 Plan 03: Show Detail + Seasons + Episodes Summary

**Show detail page with season tab navigation, episode management table with reorder arrows, and YouTube URL extraction input for episode video linking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T22:01:59Z
- **Completed:** 2026-04-03T22:06:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Show detail page at /admin/shows/[id] with breadcrumb, seasons, episodes hierarchy
- Season management via tabs with add/edit drawers following uniform Sheet pattern
- Episode table with reorder (up/down arrows using three-step swap Server Action), edit, and archive
- YouTubeUrlInput component extracting video IDs from all URL formats with live thumbnail preview

## Task Commits

Each task was committed atomically:

1. **Task 1: YouTubeUrlInput + SeasonFormDrawer + EpisodeFormDrawer** - `a1f99b7` (feat)
2. **Task 2: Show detail page + SeasonTabs + EpisodesTable** - `719ef83` (feat)

## Files Created/Modified
- `src/components/admin/youtube-url-input.tsx` - YouTube URL input with ID extraction and thumbnail preview
- `src/components/admin/season-form-drawer.tsx` - Season create/edit drawer with Sheet pattern
- `src/components/admin/episode-form-drawer.tsx` - Episode create/edit drawer with YouTube input and status select
- `src/components/admin/episodes-table.tsx` - Episode list table with reorder arrows, edit, archive
- `src/components/admin/season-tabs.tsx` - Tab navigation between seasons with add/edit drawers
- `src/app/admin/shows/[id]/page.tsx` - Server Component show detail page with data fetching

## Decisions Made
- Used `z.number()` with `register({ valueAsNumber: true })` instead of `z.coerce.number()` because Zod v4's coerce creates `unknown` input type that causes type mismatch with `zodResolver` from `@hookform/resolvers`
- SeasonTabs calls `router.refresh()` after successful mutations to trigger server-side data re-fetch rather than client-side state updates
- EpisodesTable uses `useTransition` from React to wrap reorder Server Action calls, providing isPending state to disable buttons during reorder (prevents double-clicks)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Zod v4 coerce type mismatch with zodResolver**
- **Found during:** Task 1 (SeasonFormDrawer + EpisodeFormDrawer)
- **Issue:** `z.coerce.number()` in Zod v4 creates input type `unknown` which breaks `zodResolver` type compatibility with react-hook-form
- **Fix:** Changed to `z.number()` with `{ valueAsNumber: true }` in register calls
- **Files modified:** season-form-drawer.tsx, episode-form-drawer.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** a1f99b7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential type fix for Zod v4 compatibility. No scope creep.

## Issues Encountered
None beyond the Zod v4 type mismatch documented above.

## Known Stubs
None - all components are fully wired to Server Actions and database types.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full show -> season -> episode management flow complete
- Ready for Plan 04 (archive management page) or Phase 10 (connect frontend to backend)
- All Server Actions from Plan 01 are now consumed by UI components

## Self-Check: PASSED

All 7 files verified present on disk. Both task commits (a1f99b7, 719ef83) verified in git log.

---
*Phase: 07-admin-dashboard*
*Completed: 2026-04-03*
