---
phase: 08-data-integration-auth-search
verified: 2026-04-04T17:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Auth signup — create account and confirm toast"
    expected: "Account created toast appears, user redirected to home"
    why_human: "Requires real Supabase auth call; cannot test programmatically without running server"
  - test: "Auth login persistence across browser refresh"
    expected: "Avatar visible immediately on page load without Sign In flash"
    why_human: "Session state on refresh is browser-level behavior, cannot be grepped"
  - test: "Auth logout clears session"
    expected: "Sign In button reappears, profile dropdown gone"
    why_human: "Requires clicking avatar dropdown — UI interaction only"
  - test: "Auth error messages are user-friendly"
    expected: "Wrong password shows 'Email or password is incorrect.' not raw Supabase string"
    why_human: "Requires triggering real auth error against Supabase"
  - test: "Search finds real content"
    expected: "Typing a show name in navbar and pressing Enter navigates to /search?q=... and shows results from DB"
    why_human: "Requires Supabase FTS index to be populated with real content; cannot dry-run"
---

# Phase 8: Data Integration, Auth & Search Verification Report

**Phase Goal:** The frontend displays real content from Supabase instead of mock data, users can sign up and log in, and search finds shows and episodes -- the platform becomes a living, data-driven application
**Verified:** 2026-04-04T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All shared viewer components use ViewShow/ViewEpisode/ViewSeason from queries.ts, not mock-data.ts | VERIFIED | Zero files import from `@/lib/mock-data` — confirmed by grep. show-card.tsx, watch-page-content.tsx, episode-row.tsx all import from `@/lib/queries` |
| 2 | Brand color maps (BRAND_COLOR_HEX/BG/TEXT) are importable from brand-colors.ts | VERIFIED | `src/lib/brand-colors.ts` exists and exports all three maps typed against `ViewShow['brandColor']` |
| 3 | Search query functions (searchShows, searchEpisodes) exist and use Postgres FTS | VERIFIED | Both functions exist in `queries.ts`, both use `.textSearch('fts', query, { type: 'websearch', config: 'english' })` |
| 4 | Auth error mapping utility returns user-friendly messages | VERIFIED | `mapAuthError` in `auth-errors.ts` maps 7 Supabase error codes; login-form and signup-form both call `mapAuthError(error.message)` |
| 5 | No component references the 'locked' episode status | VERIFIED | Zero matches for `'locked'` across all of `src/components/` |
| 6 | Series listing page at /series shows all shows from Supabase | VERIFIED | `src/app/(viewer)/series/page.tsx` calls `getAllShows()` and `getDistinctGenres()` from queries.ts; renders `PortraitShowCard` grid |
| 7 | Coming soon page at /coming-soon shows coming-soon data from Supabase | VERIFIED | `getComingSoonShows()` and `getComingSoonEpisodes()` called; no mock-data imports |
| 8 | Schedule page at /schedule shows broadcast data from Supabase | VERIFIED | `src/app/(viewer)/schedule/page.tsx` calls `getScheduleShows()` and groups by `broadcastDay` |
| 9 | Home page has no mock-data imports | VERIFIED | `src/app/(viewer)/page.tsx` imports from `@/lib/queries` only; no MOCK_REELS or ReelCard |
| 10 | Logged-in users see avatar on page load without Sign In flash | VERIFIED | `layout.tsx` calls `supabase.auth.getUser()` and passes `initialUser` to `<Navbar>`; `AuthSection` initializes state from `initialUser` prop |
| 11 | mock-data.ts is deleted and no file imports from it | VERIFIED | `src/lib/mock-data.ts` does not exist; zero grep matches for `from '@/lib/mock-data'` in entire `src/` |
| 12 | Search input visible in navbar on all pages | VERIFIED | `NavbarSearch` component imported and rendered in `navbar.tsx`; desktop input + mobile icon button both present |
| 13 | Search results page shows matching shows and episodes with recovery states | VERIFIED | `src/app/(viewer)/search/page.tsx` handles empty, short-query, no-results, and results states; `SearchResults` renders `PortraitShowCard` grid and `EpisodeRow` list |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/brand-colors.ts` | Brand color hex, bg, text maps | VERIFIED | 26 lines, exports BRAND_COLOR_HEX, BRAND_COLOR_BG, BRAND_COLOR_TEXT typed against `ViewShow['brandColor']` |
| `src/lib/auth-errors.ts` | mapAuthError utility | VERIFIED | 15 lines, exports `mapAuthError` with 7 error mappings including 'Invalid login credentials' and 'User already registered' |
| `src/lib/queries.ts` | ViewEpisode, ViewSeason types, mapper functions, 6 query functions + FTS search | VERIFIED | All 10 required exports confirmed: ViewEpisode (status: 'published' | 'coming-soon' | 'draft', no 'locked'), ViewSeason, mapEpisode, mapSeason, getDistinctGenres, getScheduleShows, getComingSoonEpisodes, getAllShows, searchShows, searchEpisodes |
| `src/app/(viewer)/series/page.tsx` | Series listing with Supabase data | VERIFIED | 169 lines, async server component, calls getAllShows + getDistinctGenres, renders genre filter chips and PortraitShowCard grid |
| `src/app/(viewer)/coming-soon/page.tsx` | Coming soon with Supabase data | VERIFIED | 146 lines, async server component, calls getComingSoonShows + getComingSoonEpisodes |
| `src/app/(viewer)/schedule/page.tsx` | Broadcast schedule page | VERIFIED | 165 lines, calls getScheduleShows, groups by broadcastDay with DAY_ORDER sort |
| `src/app/(viewer)/layout.tsx` | Server user hydration | VERIFIED | Async layout, calls `supabase.auth.getUser()`, passes `initialUser` to Navbar |
| `src/components/layout/navbar.tsx` | Accepts initialUser, includes NavbarSearch | VERIFIED | NavbarProps interface with `initialUser`, renders `<NavbarSearch />` between NavLinks and AuthSection |
| `src/components/layout/auth-section.tsx` | Accepts initialUser, no flash | VERIFIED | AuthSectionProps with `initialUser`; useState initialized from `initialUser` prop |
| `src/components/layout/nav-links.tsx` | Series + Schedule links | VERIFIED | NAV_LINKS array contains `{ label: 'Series', href: '/series' }` and `{ label: 'Schedule', href: '/schedule' }` |
| `src/components/auth/login-form.tsx` | mapAuthError wired | VERIFIED | `import { mapAuthError } from '@/lib/auth-errors'`; `setServerError(mapAuthError(error.message))` |
| `src/components/auth/signup-form.tsx` | mapAuthError wired | VERIFIED | Same pattern as login-form |
| `src/components/layout/navbar-search.tsx` | Glass search input + mobile icon | VERIFIED | 66 lines, 'use client', form submits to `/search?q=...`, desktop glass input + sm:hidden mobile icon button |
| `src/app/(viewer)/search/page.tsx` | FTS search page with edge states | VERIFIED | 84 lines, searchParams: Promise<{ q?: string }>, parallel searchShows + searchEpisodes, 4 render states |
| `src/components/search/search-results.tsx` | Two-section results layout | VERIFIED | 59 lines, PortraitShowCard grid + EpisodeRow list, result count display |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/shows/show-card.tsx` | `src/lib/brand-colors.ts` | `import BRAND_COLOR_HEX` | WIRED | Line 9: `import { BRAND_COLOR_HEX } from '@/lib/brand-colors'` |
| `src/components/watch/watch-page-content.tsx` | `src/lib/queries.ts` | `import ViewEpisode, ViewShow, ViewSeason` | WIRED | Line 12: `import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'` |
| `src/app/(viewer)/series/page.tsx` | `src/lib/queries.ts` | `getAllShows()` and `getDistinctGenres()` | WIRED | Both functions called in Promise.all on line 41-44 |
| `src/app/(viewer)/coming-soon/page.tsx` | `src/lib/queries.ts` | `getComingSoonShows()` and `getComingSoonEpisodes()` | WIRED | Both functions called in Promise.all on lines 22-25 |
| `src/app/(viewer)/layout.tsx` | `src/lib/supabase/server.ts` | `supabase.auth.getUser()` | WIRED | Line 7: `const { data: { user } } = await supabase.auth.getUser()` |
| `src/components/auth/login-form.tsx` | `src/lib/auth-errors.ts` | `mapAuthError()` | WIRED | Line 14 import, line 45 usage: `setServerError(mapAuthError(error.message))` |
| `src/app/(viewer)/search/page.tsx` | `src/lib/queries.ts` | `searchShows()` and `searchEpisodes()` | WIRED | Lines 3-4 imports, lines 42-45 called via Promise.all |
| `src/components/layout/navbar-search.tsx` | `/search` route | form action `router.push(/search?q=...)` | WIRED | Line 15: `router.push('/search?q=${encodeURIComponent(trimmed)}')` |
| `src/components/layout/navbar.tsx` | `src/components/layout/navbar-search.tsx` | `NavbarSearch import` | WIRED | Line 9: `import { NavbarSearch } from './navbar-search'`; rendered on line 47 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `/series/page.tsx` | `allShows` / `genres` | `getAllShows()` + `getDistinctGenres()` in queries.ts — Supabase `.from('shows').select('*').eq('archived', false)` | Yes — live Supabase query with filters | FLOWING |
| `/schedule/page.tsx` | `scheduleShows` | `getScheduleShows()` — Supabase `.from('shows').not('broadcast_day', 'is', null)` | Yes — real DB query filtering on broadcast_day | FLOWING |
| `/search/page.tsx` | `shows` / `episodes` | `searchShows()` + `searchEpisodes()` — Supabase `.textSearch('fts', query, { type: 'websearch', config: 'english' })` | Yes — Postgres FTS queries against indexed columns | FLOWING |
| `auth-section.tsx` | `user` state | Initialized from `initialUser` prop (server-fetched); `useEffect` calls `supabase.auth.getUser()` to load full profile | Yes — server-hydrated initial value, client enriched | FLOWING |
| `genres-grid.tsx` | `genres` | `getDistinctGenres()` — Supabase `.from('shows').select('genre')` with dedup | Yes — live DB query | FLOWING |

### Behavioral Spot-Checks

Step 7b: Spot-checks on runnable code are limited to module-level verification without a running server. TypeScript compilation is the proxy check.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| queries.ts exports all 10 required identifiers | Node.js string check on file content | All 10 found | PASS |
| searchShows uses websearch FTS config | grep `.textSearch('fts', query, { type: 'websearch', config: 'english' })` | Found on lines 387 and 405 | PASS |
| mock-data.ts deleted | `ls src/lib/mock-data.ts` | File not found | PASS |
| Zero mock-data imports in src/ | `grep -rn "mock-data" src/` | Zero matches | PASS |
| Zero 'locked' status references in components | `grep -rn "'locked'" src/components/` | Zero matches | PASS |
| Zero `as any` casts in watch/series pages | grep check on watch/[episodeId] and series/[slug] pages | Zero matches | PASS |
| TypeScript compilation (source files) | `npx tsc --noEmit` filtered to source errors only | Zero source errors (duplicate .next/types artifacts are macOS filesystem artifacts, not build issues) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUTH-01 | 08-01, 08-02 | User can sign up with email and password via Supabase Auth | SATISFIED | `signup-form.tsx` calls `supabase.auth.signUp()`, uses `mapAuthError()`, shows success toast; requires human verification for live flow |
| AUTH-02 | 08-01, 08-02 | User can log in and session persists across browser refresh | SATISFIED | `login-form.tsx` calls `signInWithPassword()`, `auth-section.tsx` initialized from `initialUser` (server-fetched) to prevent flash; human verification needed for persistence |
| AUTH-03 | 08-02 | User can log out from any page | SATISFIED | `auth-section.tsx` renders `UserDropdown` on all pages via Navbar; logout wired through auth state change; human verification needed for click flow |
| SRCH-01 | 08-03 | Search bar accessible from all pages | SATISFIED | `NavbarSearch` rendered in `navbar.tsx` which is in `ViewerLayout` — present on every viewer page |
| SRCH-02 | 08-01, 08-03 | Search finds shows and episodes by title | SATISFIED | `searchShows` + `searchEpisodes` use Postgres FTS `.textSearch('fts', query, { type: 'websearch', config: 'english' })`; human verification needed for real data match |
| SRCH-03 | 08-03 | Search results display show cards and episode cards | SATISFIED | `search-results.tsx` renders `PortraitShowCard` grid for shows and `EpisodeRow` list for episodes |

All 6 requirements declared across plans are accounted for. No orphaned requirements for Phase 8.

**Requirements from REQUIREMENTS.md traceability table mapped to Phase 8:** AUTH-01, AUTH-02, AUTH-03, SRCH-01, SRCH-02, SRCH-03 — all 6 addressed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/shows/portrait-show-card.tsx` | 21-23 | `const likeCount = 0` and Instagram handle defaults to `@clickitstory` | Info | Mock-only fields removed from DB schema; documented as known stubs in 08-01-SUMMARY.md. Not blocking — these fields have no DB source and do not affect show browsing or search |
| `.next/types/routes.d 2.ts` | — | Duplicate generated file with space in filename (macOS artifact) | Info | macOS Finder copy artifact in `.next/` — not a source file, not deployed. tsc reports duplicate identifier errors from this file only. Zero source-level errors. |

No blockers or warnings. One info-level known stub (documented) and one macOS filesystem artifact in the build cache.

### Human Verification Required

#### 1. Auth Signup Flow

**Test:** Click "Sign In" in the navbar, switch to "Create Account", fill in name/email/password, submit
**Expected:** Toast appears: "Account created! Welcome to Clickit Story." — user is logged in and avatar appears in navbar
**Why human:** Requires live Supabase auth call; cannot invoke signUp() programmatically without a running server and real credentials

#### 2. Auth Login and Session Persistence

**Test:** Log out, then log back in with the account just created. Refresh the page.
**Expected:** On login: "Signed in successfully!" toast. After refresh: avatar is visible immediately without a flash of "Sign In" button.
**Why human:** Session persistence across refresh is browser-level behavior dependent on cookie handling; no static analysis can confirm it

#### 3. Auth Logout

**Test:** While logged in, click the avatar in the navbar dropdown, click "Sign Out"
**Expected:** Redirected to home, navbar shows "Sign In" button, no user avatar
**Why human:** Requires clicking UI elements in a running browser session

#### 4. User-Friendly Auth Error Messages

**Test:** Attempt login with correct email but wrong password
**Expected:** Error banner shows "Email or password is incorrect." with an alert icon — NOT the raw Supabase string
**Why human:** Requires triggering a real failed auth call against Supabase

#### 5. Search Finds Real Content

**Test:** Click the search bar in the navbar, type a show name that exists in the database (e.g. a known CIT show title), press Enter
**Expected:** Navigate to /search?q=[query], show card appears in "Shows" section and/or matching episodes appear in "Episodes" section
**Why human:** Requires Supabase FTS `fts` column to be populated via DB trigger; depends on real seeded content

### Gaps Summary

No gaps. All automated verification checks passed. Phase 8 goal is fully achieved in code:

- `src/lib/mock-data.ts` deleted — zero files import from it
- All viewer components use `ViewShow`/`ViewEpisode`/`ViewSeason` from `queries.ts`
- All catalog pages (`/series`, `/coming-soon`, `/schedule`, home) fetch from Supabase
- `ViewEpisode.status` is `'published' | 'coming-soon' | 'draft'` — 'locked' purged from codebase
- Auth forms (`login-form.tsx`, `signup-form.tsx`) call `mapAuthError()` on all error paths
- Server user hydration in `ViewerLayout` prevents Sign In flash for authenticated users
- `NavbarSearch` present in navbar on every viewer page
- `/search` page handles all edge states and calls FTS functions
- `SearchResults` reuses existing `PortraitShowCard` and `EpisodeRow` components
- All 6 requirements (AUTH-01/02/03, SRCH-01/02/03) are implemented

Human verification is needed only to confirm live auth flows and real search results against the populated Supabase database.

---

_Verified: 2026-04-04T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
