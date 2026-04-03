---
phase: 07-admin-dashboard
plan: 02
subsystem: admin
tags: [nextjs, server-actions, react-hook-form, zod, supabase-storage, shadcn-sheet, admin-crud]

# Dependency graph
requires:
  - phase: 07-admin-dashboard
    plan: 01
    provides: "Admin layout with auth gate, StatusBadge, EmptyState, ConfirmDialog, slug utility, archived column migration, shadcn sheet/dialog/table"
  - phase: 06-supabase-backend-foundation
    provides: "Supabase client setup (server/browser/admin), schema with shows/seasons/episodes tables, RLS policies, Storage bucket"
provides:
  - "All 12 Server Actions for admin CRUD (shows, seasons, episodes)"
  - "Admin show list page at /admin with data table"
  - "ShowFormDrawer for create/edit with 15+ form fields"
  - "ArtworkUploadZone for immediate client-side upload to Supabase Storage"
affects: [07-03, 07-04, 10-connect-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-actions-with-zod-validation, react-hook-form-in-sheet-drawer, immediate-artwork-upload-client-side, pre-generated-uuid-for-upload-path]

key-files:
  created:
    - src/app/admin/actions.ts
    - src/app/admin/page.tsx
    - src/components/admin/shows-table.tsx
    - src/components/admin/show-form-drawer.tsx
    - src/components/admin/artwork-upload-zone.tsx
  modified: []

key-decisions:
  - "Single actions.ts file contains all 12 Server Actions — single source of truth for admin mutations"
  - "Pre-generated UUID via crypto.randomUUID() in create mode allows artwork upload before form save"
  - "Three-step swap for episode reordering (set to -1, swap, set final) avoids unique constraint violation"
  - "ArtworkUploadZone uses browser Supabase client for direct storage upload, not Server Actions (avoids 1MB body limit)"
  - "Empty strings normalized to null for optional fields before DB insert/update"

patterns-established:
  - "Server Action pattern: assertAdmin() -> zodSchema.parse() -> createAdminClient() -> mutation -> revalidatePath -> ActionResult"
  - "Form drawer pattern: Sheet + useForm + zodResolver + Select components with onValueChange -> form.setValue"
  - "Artwork upload pattern: client-side upload on file select -> onUploadComplete callback -> form.setValue stores URL"

requirements-completed: [ADMN-01, ADMN-04, ADMN-06, ADMN-07]

# Metrics
duration: 6min
completed: 2026-04-03
---

# Phase 7 Plan 2: Admin Show CRUD Summary

**12 Server Actions with Zod validation for all admin mutations, show list data table, create/edit drawer with 15+ form fields and artwork upload to Supabase Storage**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-03T21:53:29Z
- **Completed:** 2026-04-03T21:59:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All 12 Server Actions (show/season/episode CRUD + reorder) with Zod validation and assertAdmin defense-in-depth
- Admin show list page at /admin with sortable data table, StatusBadge, and empty state
- ShowFormDrawer with all form fields per UI-SPEC including Arabic RTL fields, genre, brand color swatches, status, and broadcast schedule
- ArtworkUploadZone with three visual states (empty/uploading/uploaded), immediate upload to Supabase Storage, and file size validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions for all admin CRUD operations** - `cadfd2e` (feat)
2. **Task 2: Show list page + ShowsTable + ShowFormDrawer + ArtworkUploadZone** - `7507108` (feat)

## Files Created/Modified
- `src/app/admin/actions.ts` - All 12 Server Actions with Zod schemas, assertAdmin, and createAdminClient
- `src/app/admin/page.tsx` - Admin show list page (server component, fetches non-archived shows)
- `src/components/admin/shows-table.tsx` - Data table with edit/archive actions, drawer integration
- `src/components/admin/show-form-drawer.tsx` - Create/edit drawer with react-hook-form + zodResolver
- `src/components/admin/artwork-upload-zone.tsx` - Upload zone with Supabase Storage integration

## Decisions Made
- Single `actions.ts` file for all 12 admin CRUD operations (show, season, episode) -- single source of truth, easy to audit
- Pre-generated UUID via `crypto.randomUUID()` for create mode so artwork uploads know the storage path before show is saved
- Three-step swap for episode reordering: set current to -1, move adjacent to current's number, set current to adjacent's number -- avoids unique constraint violations
- Browser Supabase client for artwork uploads (avoids Server Action 1MB body limit, direct to Storage)
- Empty strings normalized to null for all optional DB fields before insert/update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all components are fully wired to Server Actions and Supabase clients.

## Next Phase Readiness
- Server Actions for seasons and episodes ready for Plan 03 (show detail page)
- ShowFormDrawer pattern established for season/episode drawers
- ArtworkUploadZone reusable for any future upload needs
- Archive action ready for Plan 04 (archive management page)

## Self-Check: PASSED

---
*Phase: 07-admin-dashboard*
*Completed: 2026-04-03*
