---
phase: 07-admin-dashboard
plan: 01
subsystem: admin
tags: [nextjs, route-groups, supabase, rls, shadcn, admin-dashboard, auth-gate]

# Dependency graph
requires:
  - phase: 06-supabase-backend-foundation
    provides: "Supabase client setup (server/browser/admin), schema with shows/episodes/app_config tables, RLS policies"
provides:
  - "Route group restructure separating viewer (Navbar+Footer) from admin shell"
  - "Admin layout with auth gate checking app_config.admin_user_id"
  - "AdminHeader with Shows/Archive tab navigation"
  - "Shared admin components: StatusBadge, EmptyState, ConfirmDialog"
  - "YouTube URL extraction utility (extractYouTubeId, getYouTubeThumbnailUrl)"
  - "Slug generation utility (generateSlug)"
  - "DB migration adding archived column to shows and episodes with updated RLS"
  - "shadcn sheet, dialog, table components installed"
affects: [07-02, 07-03, 07-04, 10-connect-frontend]

# Tech tracking
tech-stack:
  added: [shadcn/sheet, shadcn/dialog, shadcn/table]
  patterns: [route-group-viewer-admin-split, admin-auth-gate-via-app-config, status-badge-color-map]

key-files:
  created:
    - src/app/(viewer)/layout.tsx
    - src/app/admin/layout.tsx
    - src/components/admin/admin-header.tsx
    - src/components/admin/status-badge.tsx
    - src/components/admin/empty-state.tsx
    - src/components/admin/confirm-dialog.tsx
    - src/lib/youtube.ts
    - src/lib/slug.ts
    - src/components/ui/sheet.tsx
    - src/components/ui/table.tsx
    - supabase/migrations/20260403000000_add_archived_column.sql
  modified:
    - src/app/layout.tsx
    - src/lib/database.types.ts

key-decisions:
  - "Route group (viewer) wraps all public pages with Navbar+Footer; admin routes get separate shell"
  - "Admin auth gate checks app_config.admin_user_id — single admin, no RBAC"
  - "AdminHeader is client component for usePathname-based active tab detection"
  - "StatusBadge uses direct hex colors matching UI-SPEC color map"
  - "Archived column + updated RLS policies hide archived content from viewers"

patterns-established:
  - "Route group pattern: (viewer) for public, /admin for protected"
  - "Admin auth gate: createClient() -> getUser() -> app_config lookup -> redirect"
  - "Status color map: now-streaming=#50A258, coming-soon=#EA8C2E, draft=secondary, published=#50A258, archived=destructive"

requirements-completed: [ADMN-10, ADMN-09, ADMN-04, ADMN-05]

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 7 Plan 1: Admin Dashboard Foundation Summary

**Route group restructure with admin auth gate, shared components (StatusBadge, EmptyState, ConfirmDialog), YouTube/slug utilities, and archived column migration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T21:48:12Z
- **Completed:** 2026-04-03T21:50:15Z
- **Tasks:** 3
- **Files modified:** 34

## Accomplishments
- Route group restructure: root layout stripped to html/body/fonts/Toaster, viewer layout gets Navbar+Footer, admin layout gets AdminHeader
- Admin auth gate protecting /admin/* with Supabase auth + app_config.admin_user_id check
- Five shared admin components ready: AdminHeader, StatusBadge, EmptyState, ConfirmDialog
- YouTube URL extraction handles 5+ URL formats (watch, youtu.be, embed, shorts, live)
- DB migration adds archived column to shows and episodes with updated RLS policies excluding archived content
- Three shadcn components installed: sheet, dialog, table

## Task Commits

Each task was committed atomically:

1. **Task 1: Route group restructure + shadcn install + DB migration** - `12a03d4` (feat)
2. **Task 2: Utility functions + Admin layout with auth gate + Admin header** - `19afe91` (feat)
3. **Task 3: Shared admin components (StatusBadge, EmptyState, ConfirmDialog)** - `7e132b4` (feat)

## Files Created/Modified
- `src/app/layout.tsx` - Root layout stripped to html/body/fonts/Toaster only
- `src/app/(viewer)/layout.tsx` - Viewer shell with Navbar + Footer + pt-16 padding
- `src/app/admin/layout.tsx` - Admin auth gate + AdminHeader shell
- `src/components/admin/admin-header.tsx` - CIT Admin header with Shows/Archive tab nav
- `src/components/admin/status-badge.tsx` - Color-coded status badges for 5 statuses
- `src/components/admin/empty-state.tsx` - Reusable empty state with heading/body/action
- `src/components/admin/confirm-dialog.tsx` - Confirmation dialog with destructive/loading states
- `src/lib/youtube.ts` - extractYouTubeId and getYouTubeThumbnailUrl utilities
- `src/lib/slug.ts` - generateSlug utility for URL-safe slugs
- `src/components/ui/sheet.tsx` - shadcn Sheet component (installed)
- `src/components/ui/dialog.tsx` - shadcn Dialog component (installed)
- `src/components/ui/table.tsx` - shadcn Table component (installed)
- `supabase/migrations/20260403000000_add_archived_column.sql` - Archived column + RLS updates
- `src/lib/database.types.ts` - Regenerated with archived field

## Decisions Made
- Route group `(viewer)` wraps all public pages; admin routes sit outside at `/admin/*`
- Admin auth gate uses `app_config.admin_user_id` lookup (single admin, no RBAC)
- AdminHeader is a client component to enable `usePathname()` for active tab detection
- StatusBadge uses inline hex colors from UI-SPEC rather than CSS variables for brand accuracy
- Archived column uses `boolean NOT NULL DEFAULT false` with indexes for query performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin shell ready for Plan 02 (Shows list page with CRUD)
- StatusBadge, EmptyState, ConfirmDialog available for all subsequent plans
- YouTube extraction utility ready for episode form (Plan 03)
- Archived column and RLS policies ready for archive management (Plan 04)

## Self-Check: PASSED

---
*Phase: 07-admin-dashboard*
*Completed: 2026-04-03*
