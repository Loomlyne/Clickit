---
phase: 08-data-integration-auth-search
plan: 01
subsystem: ui
tags: [typescript, supabase, postgres-fts, brand-colors, view-types, search]

requires:
  - phase: 06-supabase-backend
    provides: "Database schema, RLS, auth clients, DB type generation"
  - phase: 06.1-ui-cinematic-redesign
    provides: "ShowArt primitive, brand color maps in mock-data.ts"
provides:
  - "brand-colors.ts with BRAND_COLOR_HEX/BG/TEXT maps typed against ViewShow"
  - "auth-errors.ts with mapAuthError utility"
  - "ViewEpisode, ViewSeason types and mapEpisode/mapSeason functions in queries.ts"
  - "6 new query functions: getDistinctGenres, getScheduleShows, getComingSoonEpisodes, getAllShows, searchShows, searchEpisodes"
  - "All 19 component files migrated to ViewShow/ViewEpisode/ViewSeason from queries.ts"
affects: [08-02, 08-03, search, auth, series-detail, watch-page, coming-soon]

tech-stack:
  added: []
  patterns: ["ViewShow/ViewEpisode/ViewSeason as canonical viewer-facing types", "BRAND_COLOR_HEX/BG/TEXT maps from brand-colors.ts", "Postgres FTS via textSearch with websearch config"]

key-files:
  created: ["src/lib/brand-colors.ts", "src/lib/auth-errors.ts"]
  modified: ["src/lib/queries.ts", "src/components/series/episode-row.tsx", "src/components/watch/watch-page-content.tsx", "src/components/series/series-detail-content.tsx", "src/components/shows/show-card.tsx", "src/components/shows/reel-card.tsx", "src/components/series/metadata-card.tsx"]

key-decisions:
  - "ViewEpisode status uses 'draft' not 'locked' -- aligns with DB schema (draft/coming-soon/published)"
  - "MetadataCard strips releaseYear/cast/director/viewCount/languages (mock-only fields not in DB)"
  - "PortraitShowCard defaults Instagram handle to @clickitstory (mock-only field removed)"
  - "ReelCard takes showSlug/showTitle/showBrandColor as explicit props instead of MOCK_SHOWS lookup"
  - "ShowReview type inlined in reviews-section.tsx (no DB table for reviews)"
  - "coming-soon page migrated to Supabase queries ahead of Plan 02 to resolve type mismatch"

patterns-established:
  - "Import ViewShow/ViewEpisode/ViewSeason from @/lib/queries for all viewer components"
  - "Import BRAND_COLOR_HEX/BG/TEXT from @/lib/brand-colors for brand color maps"
  - "Use mapEpisode/mapSeason/mapShow helpers in page server components to convert DB rows"

requirements-completed: [AUTH-01, AUTH-02, SRCH-02]

duration: 10min
completed: 2026-04-04
---

# Phase 08 Plan 01: Shared Types & Utilities Extraction Summary

**ViewEpisode/ViewSeason types, brand-colors.ts, auth-errors.ts, 6 Supabase query functions (including FTS search), and 23 component files migrated off mock-data imports**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-04T16:04:11Z
- **Completed:** 2026-04-04T16:14:16Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Created brand-colors.ts with BRAND_COLOR_HEX, BRAND_COLOR_BG, BRAND_COLOR_TEXT maps typed against ViewShow['brandColor']
- Created auth-errors.ts with mapAuthError utility covering 7 Supabase auth error codes
- Added ViewEpisode and ViewSeason types plus mapEpisode/mapSeason mapper functions to queries.ts
- Added 6 new query functions to queries.ts: getDistinctGenres, getScheduleShows, getComingSoonEpisodes, getAllShows, searchShows (Postgres FTS), searchEpisodes (Postgres FTS)
- Migrated 19 component files from mock-data.ts imports to queries.ts + brand-colors.ts
- Replaced all 'locked' episode status references with 'draft' across the codebase
- Cleaned up watch page and series detail page to use proper mapEpisode/mapSeason helpers (removed `as any` casts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create brand-colors.ts, auth-errors.ts, and expand queries.ts** - `a30ef7e` (feat)
2. **Task 2: Migrate all 23 component files from mock-data to queries.ts + brand-colors.ts** - `117e86c` (refactor)

## Files Created/Modified
- `src/lib/brand-colors.ts` - Brand color hex, bg class, and text class maps
- `src/lib/auth-errors.ts` - Auth error message mapping utility
- `src/lib/queries.ts` - ViewEpisode, ViewSeason types, mappers, 6 new query functions
- `src/components/home/hero-banner.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/home/hero-slide.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/home/content-rail.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/shows/show-card.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/shows/portrait-show-card.tsx` - ViewShow + BRAND_COLOR_HEX, removed mock-only fields
- `src/components/shows/coming-soon-show-card.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/shows/episode-art-card.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/shows/reel-card.tsx` - Inline Reel type, explicit show props, BRAND_COLOR_BG
- `src/components/auth/show-collage.tsx` - ViewShow + BRAND_COLOR_HEX
- `src/components/watch/watch-page-content.tsx` - ViewEpisode/ViewShow/ViewSeason + BRAND_COLOR_BG
- `src/components/watch/episode-nav.tsx` - ViewEpisode
- `src/components/series/season-selector.tsx` - ViewSeason
- `src/components/series/series-detail-hero.tsx` - ViewShow/ViewSeason + BRAND_COLOR_HEX
- `src/components/series/series-detail-content.tsx` - ViewSeason/ViewEpisode/ViewShow + BRAND_COLOR_HEX
- `src/components/series/episode-row.tsx` - ViewEpisode/ViewShow + BRAND_COLOR_HEX, draft replaces locked
- `src/components/series/episode-list.tsx` - ViewEpisode/ViewShow
- `src/components/series/metadata-card.tsx` - ViewShow (stripped mock-only fields)
- `src/components/series/shows-carousel.tsx` - ViewShow
- `src/components/series/reviews-section.tsx` - Inline ShowReview type
- `src/app/(viewer)/coming-soon/page.tsx` - Migrated to Supabase queries
- `src/app/(viewer)/page.tsx` - Updated ReelCard caller with new props
- `src/app/(viewer)/series/[slug]/page.tsx` - Use mapSeason/mapEpisode helpers
- `src/app/(viewer)/watch/[episodeId]/page.tsx` - Use mapEpisode/mapSeason helpers

## Decisions Made
- ViewEpisode status uses 'draft' not 'locked' -- aligns with DB schema (draft/coming-soon/published) instead of the mock data's 'locked' concept
- MetadataCard stripped releaseYear, cast, director, viewCount, languages fields that only existed in mock data, not the DB. Shows seasons/episodes count instead.
- PortraitShowCard defaults Instagram handle to @clickitstory since instagramHandle/instagramUrl were mock-only fields
- ReelCard redesigned to accept showSlug/showTitle/showBrandColor as explicit props rather than looking up MOCK_SHOWS internally
- ShowReview type kept inline in reviews-section.tsx since there's no reviews DB table
- coming-soon/page.tsx migrated to Supabase queries (getComingSoonShows, getComingSoonEpisodes) because it passes episodes to EpisodeRow which now expects ViewEpisode type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated coming-soon/page.tsx from mock data to Supabase queries**
- **Found during:** Task 2 (component migration)
- **Issue:** coming-soon/page.tsx used mock Episode type (with 'locked' status) and passed to EpisodeRow which now expects ViewEpisode. tsc failed with type incompatibility.
- **Fix:** Rewrote coming-soon/page.tsx to use getComingSoonShows() and getComingSoonEpisodes() from queries.ts, import BRAND_COLOR_HEX from brand-colors.ts
- **Files modified:** src/app/(viewer)/coming-soon/page.tsx
- **Verification:** tsc --noEmit passes with zero errors
- **Committed in:** 117e86c (Task 2 commit)

**2. [Rule 3 - Blocking] Updated page.tsx ReelCard caller with new props**
- **Found during:** Task 2 (component migration)
- **Issue:** ReelCard interface changed (new required props: showSlug, showTitle, showBrandColor), but page.tsx call site only passed `reel`
- **Fix:** Added MOCK_SHOWS import to page.tsx, looked up show data per reel, passed required props
- **Files modified:** src/app/(viewer)/page.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** 117e86c (Task 2 commit)

**3. [Rule 1 - Bug] Cleaned up watch/series pages to use proper mapper functions**
- **Found during:** Task 2 (component migration)
- **Issue:** Watch page and series detail page had inline DB-to-view mapping with `as any` casts that obscured type safety
- **Fix:** Used mapEpisode/mapSeason/mapShow helpers consistently, removed `as any` casts
- **Files modified:** src/app/(viewer)/watch/[episodeId]/page.tsx, src/app/(viewer)/series/[slug]/page.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** 117e86c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for type safety and tsc passing. No scope creep.

## Known Stubs

- `src/components/shows/portrait-show-card.tsx` line 21: `const likeCount = 0` -- hardcoded since viewCount was a mock-only field. Will be resolved when social features are implemented.
- `src/components/shows/portrait-show-card.tsx` lines 22-23: Instagram handle/URL defaulted to @clickitstory -- mock-only fields removed. Will be resolved when show social links are added to DB schema.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All viewer components now use ViewShow/ViewEpisode/ViewSeason from queries.ts
- Brand color maps available from brand-colors.ts
- Search query functions (searchShows, searchEpisodes) ready for search UI in Plan 03
- Auth error mapper ready for auth forms in Plan 02
- genres-grid.tsx still imports MOCK_SHOWS (expected -- handled in Plan 02)

## Self-Check: PASSED

- All created files exist (brand-colors.ts, auth-errors.ts, queries.ts)
- All commit hashes found (a30ef7e, 117e86c)
- SUMMARY.md exists

---
*Phase: 08-data-integration-auth-search*
*Completed: 2026-04-04*
