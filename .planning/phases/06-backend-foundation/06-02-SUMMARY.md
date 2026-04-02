---
phase: 06-backend-foundation
plan: 02
subsystem: database
tags: [supabase, ssr, typescript, middleware, auth, cookies]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Supabase schema with 7 tables, RLS policies, is_admin() function, env vars"
provides:
  - "Typed Supabase client factory for Server Components (createClient in server.ts)"
  - "Typed Supabase client factory for Client Components (createClient in client.ts)"
  - "Admin client that bypasses RLS for Server Actions (createAdminClient in admin.ts)"
  - "Middleware helper for auth token refresh (updateSession in middleware.ts)"
  - "Root Next.js middleware for automatic session refresh"
  - "Auto-generated TypeScript types from Supabase schema (Database type)"
  - "npm gen-types script for type regeneration"
affects: [phase-07-admin-dashboard, phase-08-data-integration, phase-09-user-features]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Supabase SSR cookie-based auth pattern", "Typed client factories per context (server/browser/admin/middleware)", "getUser() over getSession() for JWT validation"]

key-files:
  created:
    - src/lib/database.types.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/admin.ts
    - src/lib/supabase/middleware.ts
    - middleware.ts
  modified:
    - package.json

key-decisions:
  - "Used middleware.ts (not proxy.ts) for Supabase auth refresh -- standard Supabase SSR pattern, backward compatible in Next.js 16"
  - "Generated types from remote Supabase project via CLI -- includes extra pre-existing tables beyond the 7 core tables"

patterns-established:
  - "Server Component data fetching: import { createClient } from '@/lib/supabase/server', then const supabase = await createClient()"
  - "Client Component queries: import { createClient } from '@/lib/supabase/client', then const supabase = createClient()"
  - "Admin Server Actions: import { createAdminClient } from '@/lib/supabase/admin' -- bypasses RLS"
  - "Never use getSession() on server -- always getUser() for JWT validation"
  - "Never expose SUPABASE_SERVICE_ROLE_KEY to client code"

requirements-completed: [FOUN-02, FOUN-03, AUTH-04, AUTH-05]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 6 Plan 2: Supabase Client Integration Summary

**Typed Supabase client factories for server/browser/admin/middleware contexts with auto-generated TypeScript types and auth token refresh middleware**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T10:48:00Z
- **Completed:** 2026-04-02T10:52:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Auto-generated TypeScript types from remote Supabase schema covering all 7 core tables plus helper types (Tables, TablesInsert, TablesUpdate)
- Created 4 context-specific Supabase client factories following official @supabase/ssr patterns
- Set up Next.js middleware for automatic auth token refresh on every request using getUser() JWT validation
- Zero TypeScript errors -- all files pass tsc --noEmit

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate TypeScript types from Supabase schema** - `9a1615a` (feat)
2. **Task 2: Create Supabase client utilities and middleware** - `e5868ee` (feat)

## Files Created/Modified
- `src/lib/database.types.ts` - Auto-generated TypeScript types from Supabase schema (Database, Tables, TablesInsert, TablesUpdate)
- `src/lib/supabase/server.ts` - Async createClient() for Server Components with cookie-based auth
- `src/lib/supabase/client.ts` - createClient() singleton for browser-side Client Components
- `src/lib/supabase/admin.ts` - createAdminClient() with service_role key bypassing RLS (server-only)
- `src/lib/supabase/middleware.ts` - updateSession() helper with getUser() JWT validation
- `middleware.ts` - Root Next.js middleware that refreshes Supabase auth tokens on every request
- `package.json` - Updated gen-types script with actual project ID

## Decisions Made
- Used middleware.ts (not proxy.ts) for auth token refresh -- this is the standard Supabase SSR pattern documented by Supabase, backward compatible in Next.js 16
- Generated types from remote Supabase project includes extra pre-existing tables (categories, email_notifications, show_categories, user_favorites, watch_history) beyond the 7 core tables from our migration -- these are harmless and provide correct typing for any existing data

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all files are fully functional with real Supabase integration.

## Issues Encountered

None.

## User Setup Required

None - environment variables (.env.local) were already configured in Plan 01.

## Next Phase Readiness
- All 4 Supabase client utilities ready for import by Phase 7 (admin dashboard Server Actions), Phase 8 (data integration queries), and Phase 9 (user features: watchlist, watch progress)
- Database types provide full IntelliSense for all table operations
- Middleware automatically refreshes auth sessions -- no manual token management needed in feature code

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (9a1615a, e5868ee) verified in git history.

---
*Phase: 06-backend-foundation*
*Completed: 2026-04-02*
