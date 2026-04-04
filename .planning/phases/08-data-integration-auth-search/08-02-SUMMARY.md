---
phase: 08-data-integration-auth-search
plan: 02
subsystem: ui
tags: [supabase, nextjs, server-components, auth-ux, streaming-pages]

# Dependency graph
requires:
  - phase: 08-data-integration-auth-search plan 01
    provides: ViewShow/ViewEpisode/ViewSeason types, query functions, brand-colors, auth-errors, mappers
provides:
  - Real /series page with genre filter chips from Supabase
  - Real /schedule page showing broadcast times grouped by day
  - Server-hydrated navbar (no auth flash for logged-in users)
  - Auth error mapping with user-friendly messages
  - mock-data.ts deleted, zero mock imports in codebase
affects: [08-03-search, viewer-pages, auth-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-user-hydration-via-layout, genre-filter-via-searchParams, auth-error-mapping]

key-files:
  created:
    - src/app/(viewer)/schedule/page.tsx
  modified:
    - src/app/(viewer)/series/page.tsx
    - src/app/(viewer)/page.tsx
    - src/app/(viewer)/layout.tsx
    - src/components/layout/navbar.tsx
    - src/components/layout/auth-section.tsx
    - src/components/layout/nav-links.tsx
    - src/components/home/genres-grid.tsx
    - src/components/auth/login-form.tsx
    - src/components/auth/signup-form.tsx

key-decisions:
  - "Server user hydration in viewer layout: fetch user in async layout, pass initialUser to Navbar/AuthSection to prevent Sign In flash"
  - "GenresGrid converted from client to server component: replaced motion.div hover with CSS transition-transform for zero-JS genre browsing"
  - "Reels section removed from home page: no reels table in DB, no data source"

patterns-established:
  - "Server user hydration: layout fetches supabase.auth.getUser(), passes {id, email} to client components as initialUser prop"
  - "Genre filtering via URL searchParams: /series?genre=X with server-side filtering"
  - "Auth error mapping: mapAuthError() wraps raw Supabase error.message into user-friendly copy"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 8 Plan 2: Viewer Pages Supabase Rewire Summary

**Real /series with genre filters, /schedule with broadcast times, server-hydrated auth, error mapping, and mock-data.ts deleted**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T16:18:35Z
- **Completed:** 2026-04-04T16:23:51Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- /series page shows real show grid with genre filter chips from Supabase (getAllShows + getDistinctGenres)
- /schedule page shows broadcast schedule grouped by day with brand-color time badges
- Home page cleaned: reels section removed (no DB table), genres-grid queries DB directly as server component
- Viewer layout fetches user server-side, passes initialUser to Navbar/AuthSection to eliminate Sign In flash
- Auth forms use mapAuthError() for user-friendly error messages with AlertCircle icon and UI-SPEC styling
- Nav links updated to include Series, Coming Soon, Schedule
- mock-data.ts deleted; zero files import from it; zero `as any` casts in viewer app

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite /series, /coming-soon, and create /schedule pages** - `036e1ca` (feat)
2. **Task 2: Clean home page, wire server user hydration, auth error mapping, nav links, delete mock-data** - `66f4705` (feat)

## Files Created/Modified
- `src/app/(viewer)/series/page.tsx` - Real series listing with genre filter chips from Supabase
- `src/app/(viewer)/schedule/page.tsx` - New broadcast schedule page grouped by day
- `src/app/(viewer)/page.tsx` - Removed reels section and mock-data imports
- `src/app/(viewer)/layout.tsx` - Async layout with server user hydration
- `src/components/layout/navbar.tsx` - Accepts initialUser prop, passes to AuthSection
- `src/components/layout/auth-section.tsx` - Initializes user state from initialUser to prevent flash
- `src/components/layout/nav-links.tsx` - Added Series and Schedule links
- `src/components/home/genres-grid.tsx` - Server component querying getDistinctGenres()
- `src/components/auth/login-form.tsx` - mapAuthError + AlertCircle error banner
- `src/components/auth/signup-form.tsx` - mapAuthError + AlertCircle error banner
- `src/lib/mock-data.ts` - Deleted

## Decisions Made
- Server user hydration in viewer layout: fetch user in async layout, pass initialUser to Navbar/AuthSection to prevent Sign In flash on page load
- GenresGrid converted from client to server component: replaced motion.div hover with CSS transition-transform for zero-JS genre browsing
- Reels section removed from home page: no reels table in DB, cannot be wired to real data
- Coming-soon page was already fully wired to Supabase in Plan 01, no changes needed

## Deviations from Plan

### Auto-handled

**1. [Rule 1 - Observation] Coming-soon page already wired**
- **Found during:** Task 1
- **Issue:** Plan specified rewriting coming-soon page, but it was already fully connected to Supabase in Plan 01
- **Action:** No changes needed; verified existing implementation satisfies all acceptance criteria
- **Impact:** None -- plan already satisfied

**2. [Rule 1 - Observation] Watch page and series detail page already clean**
- **Found during:** Task 2
- **Issue:** Plan specified removing `as any` casts from watch and series detail pages, but Plan 01 already cleaned them
- **Action:** Verified zero `as any` casts via grep; no changes needed
- **Impact:** None -- plan already satisfied

---

**Total deviations:** 2 observations (both work already done in Plan 01)
**Impact on plan:** No scope changes. All acceptance criteria met.

## Known Stubs

None -- all pages are wired to real Supabase data. No placeholder text or hardcoded empty values.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All viewer pages now use real Supabase data
- mock-data.ts deleted, codebase is fully data-driven
- Ready for Plan 03: search page with Postgres FTS
- Auth UX complete: server hydration, error mapping, nav links

## Self-Check: PASSED

All 10 created/modified files verified present. mock-data.ts confirmed deleted. Both commits (036e1ca, 66f4705) verified in git log.

---
*Phase: 08-data-integration-auth-search*
*Completed: 2026-04-04*
