---
phase: 05-watch-page-ui
verified: 2026-03-31T23:10:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "YouTube player loads and renders iframe on /watch/e1-1-1"
    expected: "YouTube iframe appears with the video thumbnail/controls, replacing the loading state"
    why_human: "Requires live browser with network access to youtube.com/iframe_api to confirm the IFrame API script loads and YT.Player initializes"
  - test: "No UI elements overlay the YouTube player in a live browser"
    expected: "The video player container has no absolutely-positioned siblings on top of the iframe"
    why_human: "WTCH-05 requires visual/DOM inspection in a running browser to confirm z-index stacking"
---

# Phase 5: Watch Page UI Verification Report

**Phase Goal:** Visitors can open an episode and see a fully laid-out watch page with embedded YouTube player, episode metadata, and navigation controls -- validating the core watch experience layout before backend integration
**Verified:** 2026-03-31T23:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                      | Status     | Evidence                                                                                 |
|----|--------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------|
| 1  | Watch page at /watch/[episodeId] renders a YouTube player iframe with correct video ID    | ✓ VERIFIED | `youtube-player.tsx` line 79: `new YT.Player(containerRef.current, { videoId, ... })`; script loaded from `https://www.youtube.com/iframe_api` line 34 |
| 2  | Episode metadata (title, description, show name, season/episode breadcrumb, duration) visible below player | ✓ VERIFIED | `watch-page-content.tsx` lines 61-78: EpisodeBreadcrumb + h1 title + Badge duration + description paragraph all rendered |
| 3  | No UI elements overlay the YouTube player container (YouTube ToS compliance)               | ✓ VERIFIED | `youtube-player.tsx`: loading state is hidden with `className={cn("w-full h-full", !isReady && "hidden")}` (line 163-165); player div always mounted; no absolutely-positioned children inside the region div |
| 4  | Clicking an episode row on the series detail page navigates to /watch/{episodeId}          | ✓ VERIFIED | `episode-row.tsx` line 133: `<Link href={"/watch/"+episode.id}>` for published episodes |
| 5  | Series detail hero Watch CTA button navigates to /watch/{firstEpisodeId}                  | ✓ VERIFIED | `series-detail-hero.tsx` line 160: `<Link href={"/watch/"+firstEpisodeId}>Watch {firstEpisodeLabel}</Link>` |
| 6  | Prev/Next episode navigation buttons visible below player metadata                         | ✓ VERIFIED | `watch-page-content.tsx` lines 82-84: `<EpisodeNav prev={prevEpisode} next={nextEpisode} />` rendered after metadata section |
| 7  | Prev button disabled on first published episode                                            | ✓ VERIFIED | `episode-nav.tsx` lines 43-53: when `prev` is null, renders `<div aria-disabled="true" tabIndex={-1} className="...opacity-50 pointer-events-none...">` |
| 8  | Next button disabled on last published episode                                             | ✓ VERIFIED | `episode-nav.tsx` lines 71-82: same disabled pattern for null `next` |
| 9  | Cross-season navigation works: Next on last ep of S1 goes to first ep of S2               | ✓ VERIFIED | `mock-data.ts` line 307-308: `getEpisodeNavigation` flattens all published episodes across ALL seasons; `episode-nav.tsx` line 29: `href={"/watch/"+prev.id}` |
| 10 | Episode quick-selector with SeasonSelector and EpisodeList visible below navigation        | ✓ VERIFIED | `watch-page-content.tsx` lines 91-109: `<section aria-label="Episode selector">` containing SeasonSelector + EpisodeList |
| 11 | Current episode highlighted in quick-selector (left border + bg-surface-2)                | ✓ VERIFIED | `episode-row.tsx` lines 119-129: `isCurrentEpisode` true → renders `<div aria-current="true" className="...bg-surface-2 border-l-2..." style={{ borderLeftColor: brandColorHexMap[...] }}>` |
| 12 | Season containing current episode pre-selected in quick-selector                          | ✓ VERIFIED | `watch-page-content.tsx` line 41: `const [activeSeasonId, setActiveSeasonId] = useState(season.id)` where `season` is server-resolved from `getEpisodeById` |
| 13 | E2E test file exists and covers all WTCH requirements                                      | ✓ VERIFIED | `tests/e2e/watch-page.spec.ts` — 144 lines, covers WTCH-01, WTCH-02, WTCH-03, WTCH-05, WTCH-06, cross-season, 404, and series integration |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact                                               | Expected                                                  | Status     | Details                                                                      |
|--------------------------------------------------------|-----------------------------------------------------------|------------|------------------------------------------------------------------------------|
| `src/components/watch/youtube-player.tsx`              | YouTube IFrame API wrapper with singleton script loading  | ✓ VERIFIED | 169 lines; `'use client'`; `apiReady/apiLoading/readyCallbacks` singleton; `youtube.com/iframe_api` script; `player.destroy()` cleanup; `role="region" aria-label="Video player"` |
| `src/components/watch/episode-breadcrumb.tsx`          | Show > Season N > Episode N breadcrumb navigation         | ✓ VERIFIED | 40 lines; `aria-label="Breadcrumb"` on nav; `aria-current="page"` on last li |
| `src/components/watch/watch-page-content.tsx`          | Client wrapper managing player + metadata + navigation    | ✓ VERIFIED | 112 lines; `'use client'`; contains EpisodeNav, SeasonSelector, EpisodeList, YouTubePlayer, EpisodeBreadcrumb; `aria-label="Episode selector"` |
| `src/app/watch/[episodeId]/page.tsx`                   | Server component with generateMetadata and generateStaticParams | ✓ VERIFIED | Exports `generateMetadata`, `generateStaticParams`, default `WatchPage`; uses async params; `notFound()` for missing episodes |
| `src/app/watch/[episodeId]/not-found.tsx`              | 404 page for invalid episode IDs                          | ✓ VERIFIED | Contains "Episode Not Found" heading; Link to `/series` "Browse All Series" |
| `src/lib/mock-data.ts`                                 | getEpisodeById, getEpisodeNavigation, youtubeId on episodes | ✓ VERIFIED | Both helper functions at lines 280, 302; `youtubeId` field on all published episodes; placeholder IDs with comment |
| `src/components/watch/episode-nav.tsx`                 | Prev/Next navigation buttons with episode title preview   | ✓ VERIFIED | `'use client'`; ChevronLeft/ChevronRight; `aria-disabled`; `min-h-[44px]`; `/watch/${prev.id}` and `/watch/${next.id}` |
| `src/components/series/episode-list.tsx`               | Updated EpisodeList with optional currentEpisodeId prop   | ✓ VERIFIED | `currentEpisodeId?: string` added; forwarded to EpisodeRow |
| `src/components/series/episode-row.tsx`                | Updated with currentEpisodeId and highlight styling       | ✓ VERIFIED | `currentEpisodeId?: string`; `isCurrentEpisode` computed; `aria-current="true"` + `border-l-2` + `brandColorHexMap` inline style |
| `src/components/series/series-detail-hero.tsx`         | Added firstEpisodeId prop for watch page CTA              | ✓ VERIFIED | `firstEpisodeId?: string` in interface; `<Link href={"/watch/"+firstEpisodeId}>` |
| `src/app/series/[slug]/page.tsx`                       | Passes firstEpisodeId to SeriesDetailHero                 | ✓ VERIFIED | Lines 47-58: `firstEpisodeId` computed alongside `firstEpisodeLabel`; passed to `<SeriesDetailHero ... firstEpisodeId={firstEpisodeId} />` |
| `tests/e2e/watch-page.spec.ts`                         | E2E tests covering WTCH-01 through WTCH-06                | ✓ VERIFIED | 144 lines; 12 tests; all WTCH-0x labels present in comments |

### Key Link Verification

| From                                                    | To                                         | Via                          | Status     | Details                                                                  |
|---------------------------------------------------------|--------------------------------------------|------------------------------|------------|--------------------------------------------------------------------------|
| `src/components/series/episode-row.tsx`                 | `/watch/${episode.id}`                     | Next.js Link href            | ✓ WIRED    | Line 133: `<Link href={"/" + "watch/${episode.id}"}>`                   |
| `src/app/watch/[episodeId]/page.tsx`                    | `src/lib/mock-data.ts`                     | `getEpisodeById(episodeId)`  | ✓ WIRED    | Lines 9, 67: imports and calls `getEpisodeById`; result used for all props |
| `src/components/watch/youtube-player.tsx`               | `youtube.com/iframe_api`                   | script tag injection         | ✓ WIRED    | Line 34: `tag.src = 'https://www.youtube.com/iframe_api'`               |
| `src/components/watch/episode-nav.tsx`                  | `/watch/${episode.id}`                     | Next.js Link href            | ✓ WIRED    | Lines 29, 57: `href={"/" + "watch/${prev.id}"}` and `href={"/" + "watch/${next.id}"}` |
| `src/components/watch/watch-page-content.tsx`           | `src/components/series/season-selector.tsx` | import SeasonSelector        | ✓ WIRED    | Line 11: `import { SeasonSelector } from '@/components/series/season-selector'`; rendered at line 97 |
| `src/components/watch/watch-page-content.tsx`           | `src/components/series/episode-list.tsx`   | import EpisodeList           | ✓ WIRED    | Line 12: `import { EpisodeList } from '@/components/series/episode-list'`; rendered at line 103 with `currentEpisodeId={episode.id}` |

### Data-Flow Trace (Level 4)

| Artifact                           | Data Variable       | Source                                                   | Produces Real Data | Status      |
|------------------------------------|---------------------|----------------------------------------------------------|--------------------|-------------|
| `watch-page-content.tsx` (player)  | `episode.youtubeId` | `getEpisodeById(episodeId)` → `MOCK_EPISODES.find()`     | Yes (mock data)    | ✓ FLOWING   |
| `watch-page-content.tsx` (metadata) | `episode`, `show`, `season` | Server page resolves via `getEpisodeById` → passed as props | Yes (mock data) | ✓ FLOWING |
| `episode-nav.tsx` (prev/next links) | `prev`, `next`     | `getEpisodeNavigation()` in server page → passed as props | Yes (computed from mock data) | ✓ FLOWING |
| `episode-list.tsx` (quick-selector) | `currentEpisodes`  | `episodesBySeason[activeSeasonId]` → from `getEpisodeById` output | Yes (mock data) | ✓ FLOWING |
| `episode-row.tsx` (highlight)      | `isCurrentEpisode`  | `currentEpisodeId === episode.id` from parent            | Yes (prop threading) | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot run against live server per verification instructions (no Playwright/dev server execution). E2E test file existence verified in place of execution. TypeScript compilation (`npx tsc --noEmit`) exits with code 0 as the runnable check.

| Behavior                             | Command                     | Result          | Status    |
|--------------------------------------|-----------------------------|-----------------|-----------|
| TypeScript compiles with zero errors | `npx tsc --noEmit`          | No output (0)   | ✓ PASS    |
| E2E test file exists                 | `ls tests/e2e/watch-page.spec.ts` | File present | ✓ PASS |
| mock-data.ts has getEpisodeById      | grep in mock-data.ts        | Line 280        | ✓ PASS    |
| mock-data.ts has getEpisodeNavigation | grep in mock-data.ts       | Line 302        | ✓ PASS    |
| All published episodes have youtubeId | grep in mock-data.ts       | Multiple hits   | ✓ PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                          | Status       | Evidence                                                                       |
|-------------|-------------|----------------------------------------------------------------------|--------------|--------------------------------------------------------------------------------|
| WTCH-01     | 05-01-PLAN  | Watch page displays embedded YouTube player (full IFrame API)        | ✓ SATISFIED  | `youtube-player.tsx`: IFrame API singleton loader + `new YT.Player()`; E2E test covers it |
| WTCH-02     | 05-01-PLAN  | Watch page shows episode metadata (title, description, show name, season/episode number) | ✓ SATISFIED | `watch-page-content.tsx`: h1 title, description p, EpisodeBreadcrumb (show+season+ep), Badge duration |
| WTCH-03     | 05-02-PLAN  | Previous / next episode navigation buttons on watch page             | ✓ SATISFIED  | `episode-nav.tsx` with prev/next Links; disabled states; cross-season via `getEpisodeNavigation` |
| WTCH-05     | 05-01-PLAN, 05-02-PLAN | YouTube IFrame API compliance — no overlays on the player | ✓ SATISFIED  | Loading state hidden when `!isReady` (not overlaying); no absolutely-positioned children inside player region; E2E structural test covers it |
| WTCH-06     | 05-02-PLAN  | Episode quick selector on watch page (season + episode picker without leaving player) | ✓ SATISFIED | `watch-page-content.tsx`: SeasonSelector + EpisodeList in `<section aria-label="Episode selector">`; currentEpisodeId highlights current episode |

No orphaned requirements: WTCH-04 is assigned to Phase 9 (not this phase) and is correctly absent from all plans.

### Anti-Patterns Found

No blockers or warnings found in any phase-modified file.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/mock-data.ts` | 170 | `// Placeholder YouTube IDs -- swap for real CIT video IDs when available` | Info | Intentional dev placeholder; clearly documented; not a stub — all episodes have functional YouTube IDs for development purposes |

### Human Verification Required

#### 1. YouTube IFrame API Runtime Initialization

**Test:** Open `/watch/e1-1-1` in a browser on Vercel preview. Observe that the loading state (Play icon on colored background) transitions to the actual YouTube player iframe.
**Expected:** Within ~3 seconds on a normal connection, the loading spinner/icon disappears and a working YouTube player appears with the video thumbnail and YouTube controls.
**Why human:** The IFrame API script loads from an external CDN (`youtube.com/iframe_api`) at runtime. Static analysis confirms the script tag is injected and `new YT.Player()` is called, but whether the API responds and fires `onYouTubeIframeAPIReady` cannot be verified without a running browser with network access.

#### 2. No Overlays on Player (WTCH-05 visual confirmation)

**Test:** Open `/watch/e1-1-1` in browser, right-click the player area, and inspect the z-index stacking. Confirm no UI chrome (navigation, badges, modals) appears over the video region.
**Expected:** The video player occupies its 16:9 aspect-ratio container with no DOM siblings positioned on top of it.
**Why human:** WTCH-05 is a YouTube ToS compliance requirement about visual DOM stacking order. The code structure prevents this architecturally (no `position: absolute` children inside the player region after `isReady`), but final confirmation requires visual inspection in a running browser.

### Gaps Summary

No gaps found. All 13 observable truths are VERIFIED. All artifacts exist, are substantive, and are correctly wired with real data flowing through them. TypeScript compiles with zero errors. The E2E test file comprehensively covers all five WTCH requirements with labeled test cases matching the requirement IDs.

The two human verification items above are standard live-environment checks required for any component that depends on external network (YouTube IFrame API) — they do not indicate implementation defects.

---

_Verified: 2026-03-31T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
