---
phase: 04-series-detail-browse-pages
verified: 2026-03-31T15:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Season switching visually updates the episode list"
    expected: "Clicking Season 2 tab causes the Season 2 episode list to appear in place of Season 1 episodes"
    why_human: "The client-side state transition (activeSeasonId) renders correctly in code, but visual correctness requires a running browser"
  - test: "Ambient glow and cinematic gradient match the home hero visually"
    expected: "SeriesDetailHero looks visually indistinguishable in glow style from hero-slide.tsx"
    why_human: "Both files contain identical gradient strings verified by code review, but pixel-level visual match requires browser rendering"
  - test: "EpisodeRow play overlay appears on hover for published episodes"
    expected: "Hovering a published episode row reveals a centered play button circle over the thumbnail"
    why_human: "group-hover:opacity-100 CSS behavior requires browser interaction"
---

# Phase 4: Series Detail & Browse Pages — Verification Report

**Phase Goal:** Viewers can click on any show from the catalog and see a dedicated series detail page with season navigation and episode list — plus a Coming Soon browse page listing unreleased shows and upcoming episodes.
**Verified:** 2026-03-31T15:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Series detail page shows a full backdrop hero with show artwork, description, and metadata | VERIFIED | `src/app/series/[slug]/page.tsx` renders `SeriesDetailHero` with show title, tagline, genre, metadata chips, and CTA; ambient glow uses exact `brandColorHexMap` radial-gradient from hero-slide.tsx |
| 2 | Season selector (tabs or dropdown) switches the displayed episode list | VERIFIED | `SeasonSelector` renders `Tabs` for 1-5 seasons (threshold: `seasons.length <= 5`), `Select` for 6+. `SeriesDetailContent` holds `activeSeasonId` state and passes `episodesBySeason[activeSeasonId]` to `EpisodeList` |
| 3 | Episode cards display thumbnail, number, title, duration, and status badges (published, coming soon, locked) | VERIFIED | `EpisodeRow` renders: brand-color thumbnail with episode number, title (truncated), description (`line-clamp-1`), duration badge, Coming Soon badge (`bg-brand-orange`) for coming-soon, Locked badge (`bg-surface-3`) for locked |
| 4 | Coming Soon page shows unreleased shows and upcoming episodes with appropriate styling | VERIFIED | `src/app/coming-soon/page.tsx` renders "Upcoming Shows" grid (ComingSoonShowCard at `opacity-80` + Coming Soon badge) and "New Episodes Dropping Soon" section (EpisodeRows grouped by show) |
| 5 | CATL-11 (broadcast schedule) reclassified as admin feature | VERIFIED (reclassified) | ROADMAP decision D-15 explicitly documents this reclassification. CATL-11 moved to Phase 7 admin dashboard. No `/schedule` page was built — this is the correct outcome per the decision record. REQUIREMENTS.md tracking row marks it "Phase 4 Complete" which reflects the decision being made in Phase 4, not a page being built. |

**Score:** 11/11 truths verified (4 deliverable criteria all pass; CATL-11 reclassification correctly applied)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/mock-data.ts` | Season/Episode interfaces, 9 seasons, 43 episodes, 4 helper functions | VERIFIED | `Season` and `Episode` interfaces exported. `MOCK_SEASONS` has exactly 9 entries. `MOCK_EPISODES` has exactly 43 entries. All 4 helpers exported and correct. |
| `src/components/series/series-detail-hero.tsx` | Cinematic hero with ambient glow, staggered motion reveal | VERIFIED | `'use client'`, `SeriesDetailHero` exported, `-mt-16` navbar bleed, exact `radial-gradient(ellipse 80% 80% at 60% 40%, ...)` ambient glow, exact `rgba(8,8,12,0.96)` cinematic gradient, `CINEMA_EASE = [0.16, 1, 0.3, 1]`, delays at 0.3 and 0.85, `MotionConfig reducedMotion="user"`, `min-h-[50vh]` |
| `src/components/series/episode-row.tsx` | Three visual states: published/coming-soon/locked | VERIFIED | `'use client'`, `EpisodeRow` exported, `aria-disabled="true"` on non-interactive, `<Link>` for published only, `Play`/`Clock`/`Lock` imports, `opacity-45` dimmed state, `group-hover:opacity-100` play overlay, `bg-brand-orange` and `bg-surface-3` badges, `brandColorBgMap`, `line-clamp-1`, `w-[120px]` and `w-[200px]` |
| `src/components/ui/tabs.tsx` | shadcn Tabs component (Radix UI) | VERIFIED | File exists at expected path |
| `src/components/ui/select.tsx` | shadcn Select component (Radix UI) | VERIFIED | File exists at expected path |
| `src/components/series/season-selector.tsx` | Adaptive tabs/select for season switching | VERIFIED | `'use client'`, `SeasonSelector` exported, `seasons.length <= 5` threshold, both `Tabs` and `Select` imports, `aria-live="polite"` with `sr-only` span |
| `src/components/series/episode-list.tsx` | Paginated list with Load More | VERIFIED | `'use client'`, `EpisodeList` exported, `CHUNK_SIZE = 20`, `Load More Episodes` button, `No Episodes Yet` empty state, `aria-label="Episodes"` on `<section>` |
| `src/components/series/series-detail-content.tsx` | Client wrapper managing activeSeasonId state | VERIFIED | `'use client'`, `SeriesDetailContent` exported, `useState(seasons[0]?.id)` for initial season, connects `SeasonSelector` and `EpisodeList` |
| `src/app/series/[slug]/page.tsx` | Series detail page (server component) | VERIFIED | No `'use client'`, `await params` (Next.js 16 async params), `notFound()` for invalid slug, `generateMetadata`, `generateStaticParams`, `SeriesDetailHero` import, `ContentRail` import with "More Like This" |
| `src/app/series/[slug]/not-found.tsx` | Custom 404 for invalid series slugs | VERIFIED | "Show Not Found" heading, "Browse All Series" CTA linking to `/series` |
| `src/components/shows/coming-soon-show-card.tsx` | ShowCard wrapper with Coming Soon badge + opacity | VERIFIED | `'use client'`, `ComingSoonShowCard` exported, `ShowCard` import (wraps), `opacity-80`, `bg-brand-orange`, "Coming Soon" text in Badge |
| `src/app/coming-soon/page.tsx` | Coming Soon page (server component) | VERIFIED | No `'use client'`, "Coming Soon" h1, "New shows and episodes on the way." subtitle, "Upcoming Shows" section, "New Episodes Dropping Soon" section, "All Caught Up" empty state, "No New Episodes Scheduled" empty state, `COMING_SOON_SHOWS` import, `getComingSoonEpisodesFromStreamingShows` import, `EpisodeRow` and `ComingSoonShowCard` imports |
| `tests/e2e/series-detail.spec.ts` | E2E tests for CATL-03, CATL-04, CATL-05, CATL-06 | VERIFIED | All 4 CATL comment markers present, `page.goto('/series/last-call')`, `page.goto('/series/nonexistent-show')`, `getByRole('tab'`, 12 test cases |
| `tests/e2e/coming-soon.spec.ts` | E2E tests for CATL-07 | VERIFIED | `CATL-07` comment marker, `page.goto('/coming-soon')`, "Upcoming Shows", "New Episodes Dropping Soon", "Poets Platform", 8 test cases |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `series-detail-hero.tsx` | `mock-data.ts` | `brandColorHexMap[show.brandColor]` | WIRED | Line 45: `brandColorHexMap[show.brandColor]}55` in radial-gradient inline style. Import confirmed at line 10. |
| `episode-row.tsx` | `mock-data.ts` | `brandColorBgMap[showBrandColor]` | WIRED | Line 33: `brandColorBgMap[showBrandColor]` applied as className on thumbnail div. Import confirmed at line 8. |
| `series/[slug]/page.tsx` | `mock-data.ts` | `getShowBySlug(slug)` | WIRED | Line 35: `const show = getShowBySlug(slug)`. All four helper functions imported and called. |
| `series/[slug]/page.tsx` | `series-detail-hero.tsx` | `SeriesDetailHero` import | WIRED | Line 4: `import { SeriesDetailHero }`. Line 66: `<SeriesDetailHero show={show} firstEpisodeLabel={firstEpisodeLabel} />` |
| `episode-list.tsx` | `episode-row.tsx` | `EpisodeRow` import | WIRED | Line 6: `import { EpisodeRow }`. Line 36: `<EpisodeRow key={ep.id} episode={ep} showBrandColor={showBrandColor} />` |
| `series/[slug]/page.tsx` | `content-rail.tsx` | `ContentRail` import for More Like This | WIRED | Line 6: `import { ContentRail }`. Line 78: `<ContentRail title="More Like This" shows={moreLikeThis} />` |
| `coming-soon/page.tsx` | `mock-data.ts` | `COMING_SOON_SHOWS` and `getComingSoonEpisodesFromStreamingShows` | WIRED | Lines 8–10: both imported. Lines 19–20: both called and results rendered. |
| `coming-soon-show-card.tsx` | `show-card.tsx` | `ShowCard` wrapped with overlay | WIRED | Line 3: `import { ShowCard }`. Line 16: `<ShowCard show={show} />` inside `opacity-80` wrapper. |
| `coming-soon/page.tsx` | `episode-row.tsx` | `EpisodeRow` for upcoming episodes | WIRED | Line 6: `import { EpisodeRow }`. Lines 87–90: `<EpisodeRow key={ep.id} episode={ep} showBrandColor={brandColor} />` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `series/[slug]/page.tsx` | `show`, `seasons`, `episodesBySeason` | `getShowBySlug`, `getSeasonsByShowId`, `getEpisodesBySeasonId` from `mock-data.ts` | Yes — TypeScript arrays with 43 real episodes across 9 seasons | FLOWING |
| `SeriesDetailContent` | `currentEpisodes` | `episodesBySeason[activeSeasonId]` passed as prop from server page | Yes — Record pre-computed on server, client slices by active season | FLOWING |
| `EpisodeList` | `visibleEpisodes` | `episodes.slice(0, visibleCount)` — episodes passed from `SeriesDetailContent` | Yes — renders real episode data from mock arrays | FLOWING |
| `coming-soon/page.tsx` | `comingSoonShows`, `upcomingEpisodes`, `episodesByShow` | `COMING_SOON_SHOWS` (1 show: Poets Platform), `getComingSoonEpisodesFromStreamingShows()` (5 episodes from streaming shows) | Yes — Poets Platform in COMING_SOON_SHOWS; 5 coming-soon episodes across Last Call, Review Documentary, Doctor Care, Saturn Podcast | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: TypeScript compilation used as proxy (dev server not available per instructions).

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| All Phase 4 files type-safe | `npx tsc --noEmit` | Zero errors, zero warnings | PASS |
| Mock data counts correct | Node script on mock-data.ts | 9 seasons, 43 episodes, status values: 32 published / 9 coming-soon / 4 locked | PASS |
| E2E test files exist and have correct CATL markers | File read + grep | series-detail.spec.ts has CATL-03/04/05/06; coming-soon.spec.ts has CATL-07 | PASS |
| Next.js 16 async params pattern used | File read | `params: Promise<{ slug: string }>`, `const { slug } = await params` | PASS |
| Server component purity (no 'use client' on page files) | File read | Neither `series/[slug]/page.tsx` nor `coming-soon/page.tsx` contain `'use client'` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CATL-03 | 04-01, 04-02 | Series detail page shows full backdrop hero with show artwork and info | SATISFIED | `SeriesDetailHero` renders show title (h1), tagline, genre, season/episode count chips, Watch CTA or "Coming Soon" disabled button. Cinematic gradient + ambient glow. |
| CATL-04 | 04-02 | Series detail page has season selector (dropdown or tabs) | SATISFIED | `SeasonSelector` in `SeasonSelector.tsx`: Tabs rendered for `seasons.length <= 5`, Select for 6+. `aria-live` announcement on change. `SeriesDetailContent` manages shared state. |
| CATL-05 | 04-02 | Series detail page shows horizontal episode cards with thumbnail, number, title, duration | SATISFIED | `EpisodeRow` renders: `aspect-video` thumbnail at responsive widths, `E{n}` episode number prefix, title (truncated), `{n} min` duration badge. |
| CATL-06 | 04-02 | Episode cards display status badges (published, coming soon, locked) | SATISFIED | `EpisodeRow` renders: no badge for published; `bg-brand-orange` "Coming Soon" badge; `bg-surface-3` "Locked" badge. Non-published rows use `aria-disabled="true"` div, no Link wrapper. |
| CATL-07 | 04-03 | Coming Soon page shows unreleased shows and upcoming episodes | SATISFIED | `/coming-soon` route renders two sections. Section 1: `ComingSoonShowCard` (Poets Platform) at opacity-80 with Coming Soon badge. Section 2: EpisodeRows from `getComingSoonEpisodesFromStreamingShows()` grouped by show. Both sections have empty states. |
| CATL-11 | 04-01 (decision D-15) | Broadcast schedule displayed showing day/time per show | RECLASSIFIED — NOT built in Phase 4 | Decision D-15 documented in 04-CONTEXT.md and ROADMAP.md: CATL-11 is an admin management feature, moved to Phase 7. No `/schedule` page was built. REQUIREMENTS.md marks it "Phase 4 Complete" meaning the decision was made and recorded in this phase. |

**CATL-11 note:** The REQUIREMENTS.md status table shows "Phase 4 | Complete" but no viewer-facing schedule page exists. The ROADMAP is the authoritative source and explicitly states this was reclassified. The "Complete" status means the decision is recorded and approved — the actual implementation belongs to Phase 7. This is coherent and not a gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `episode-row.tsx` | 112 | `href="#"` on published episode links | Info | Intentional Phase 5 placeholder — plan documents "Phase 5 wires to /watch/[episodeId]". Not a stub. |
| `series-detail-hero.tsx` | 123 | `href="#"` on Watch CTA anchor | Info | Intentional Phase 5 placeholder — same rationale. |

No blockers. No implementation stubs. No `TODO`/`FIXME`/placeholder comments. No `return null` / empty return values in rendering paths. Both `href="#"` occurrences are documented intentional Phase 5 placeholders.

---

### Human Verification Required

#### 1. Season Tab Switching Updates Episode List

**Test:** Open `/series/last-call` in a browser. Verify Season 1 episodes are visible (e.g., "Late Night in Abu Dhabi"). Click the "Season 2" tab. Verify the episode list changes to Season 2 content (e.g., "Return to the Streets").
**Expected:** Episode list replaces immediately on tab click with the correct season's episodes.
**Why human:** Client-side React state (`activeSeasonId`) transition is correct in code; requires browser to confirm re-render occurs.

#### 2. Ambient Glow Visual Match

**Test:** Open `/series/last-call` and compare the hero gradient visually with the home page hero (e.g., Last Call card on home). Both should show the same purple radial glow treatment.
**Expected:** Brand color glow feels identical in style — same ellipse shape, same feathering.
**Why human:** The gradient strings in both files are verified identical by code review, but browser rendering is needed for visual confirmation.

#### 3. EpisodeRow Hover Play Overlay

**Test:** On `/series/last-call`, hover over any published episode row. A play button circle should appear overlaid on the thumbnail.
**Expected:** `opacity-0` overlay becomes `opacity-100` on hover, showing centered play icon.
**Why human:** `group-hover:opacity-100` CSS requires browser mouse interaction.

---

### Gaps Summary

No gaps found. All 11 must-have items are verified: data layer (mock-data.ts with 9 seasons, 43 episodes, 4 helpers), foundational components (SeriesDetailHero, EpisodeRow, shadcn Tabs/Select), interactive components (SeasonSelector, EpisodeList, SeriesDetailContent), pages (series/[slug]/page.tsx, series/[slug]/not-found.tsx, coming-soon/page.tsx), and E2E tests (series-detail.spec.ts, coming-soon.spec.ts). TypeScript compilation passes with zero errors. All key links are wired. All data flows from mock arrays to rendered components. CATL-11 is correctly reclassified to Phase 7 per decision D-15.

---

_Verified: 2026-03-31T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
