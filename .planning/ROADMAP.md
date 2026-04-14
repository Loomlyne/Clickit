# Roadmap: Clickit Story (CIT)

## Overview

This roadmap follows a frontend-first approach: the cinematic dark UI is built first with mock data so the client can see and validate the look before any backend work begins. Phases 1-5 deliver the complete visual experience (design system, navigation shell, home page, catalog browsing, series detail, and watch page) using hardcoded data. Phases 6-7 build the backend (Supabase schema, RLS, admin dashboard). Phases 8-9 wire everything together (replace mocks with real data, add auth, search, watchlist, continue watching, autoplay). The result is a premium Netflix-style streaming platform for CIT's 15 original programs.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Scaffolding & Design System** - Next.js project init, CIT brand tokens, WCAG-safe color palette, typography setup
- [ ] **Phase 2: App Shell & Navigation** - Dark cinematic layout shell, glass-effect nav bar, responsive structure, CIT logo
- [x] **Phase 3: Home Page & Catalog UI** - Cinematic hero banner, content rails, show cards with branded artwork, motion effects (mock data) (completed 2026-03-31)
- [ ] **Phase 4: Series Detail & Browse Pages** - Series detail page, season selector, episode cards, Coming Soon page (mock data). Note: broadcast schedule (CATL-11) reclassified to Phase 7.
- [ ] **Phase 5: Watch Page UI** - YouTube embedded player, episode metadata, prev/next nav, episode quick selector (mock data)
- [ ] **Phase 6: Backend Foundation** - Supabase schema, RLS policies, auth client setup, seed data
- [x] **Phase 7: Admin Dashboard** - Full admin CRUD for shows, seasons, episodes, artwork upload, status management
- [ ] **Phase 8: Data Integration, Auth & Search** - Replace mock data with Supabase, wire auth flows, implement search
- [x] **Phase 9: Personalization & Watch Features** - Watchlist, continue watching, autoplay next episode, user profile (completed 2026-04-04)

## Phase Details

### Phase 1: Project Scaffolding & Design System
**Goal**: The project is initialized and the CIT visual language is codified into reusable design tokens that enforce brand consistency across every future component
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-04
**Success Criteria** (what must be TRUE):
  1. Next.js app runs locally with App Router and Tailwind CSS configured
  2. CIT brand colors are defined as design tokens with WCAG AA-safe tints for text on dark backgrounds
  3. Typography scale is configured with Montreal (English) and fallback fonts, matching CIT hierarchy
  4. A test page renders sample components (headings, body text, color swatches, buttons) demonstrating the design system
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md -- Scaffold Next.js project, configure design tokens, shadcn/ui, font loading, ESLint/Prettier
- [x] 01-02-PLAN.md -- Build design system test pages (/design-system/colors, typography, spacing, components)
**UI hint**: yes

### Phase 2: App Shell & Navigation
**Goal**: Visitors see a polished, dark cinematic app shell with a glass-effect navigation bar, CIT logo, and responsive layout that feels like a real streaming platform before any content exists
**Depends on**: Phase 1
**Requirements**: NAVG-01, NAVG-02, NAVG-03, NAVG-04, NAVG-05, DESG-01, DESG-06, DESG-10
**Success Criteria** (what must be TRUE):
  1. A floating top nav bar displays links for Home, Series, Coming Soon, My List, Search, and Profile placeholder
  2. The CIT logo (white SVG variant) displays correctly in the nav on the dark background
  3. The nav bar has a soft glass-effect (blur/translucency) that feels premium
  4. The layout is fully responsive -- nav collapses or adapts on mobile, tablet, and desktop
  5. Every page has a dark luxury background (black/near-black) as the default theme
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md -- Build glass-effect navbar, root layout shell, Playwright test infrastructure
- [x] 02-02-PLAN.md -- Create auth section (Sign In / avatar dropdown), wire into navbar, visual verification
**UI hint**: yes

### Phase 3: Home Page & Catalog UI
**Goal**: Visitors land on a cinematic home page with a hero banner and horizontal content rails showcasing shows -- the visual centerpiece that proves this platform looks and feels like a real streaming service
**Depends on**: Phase 2
**Requirements**: CATL-01, CATL-02, CATL-08, CATL-09, CATL-10, DESG-02, DESG-03, DESG-04, DESG-05, DESG-07, DESG-08, DESG-09
**Success Criteria** (what must be TRUE):
  1. Home page displays a large cinematic hero banner featuring a show with artwork, title, and CTA
  2. Home page displays horizontal scrollable content rails (Now Streaming, by genre) with show cards
  3. Show cards display per-show branded artwork, logo, and color ribbon from the CIT brand palette
  4. Cards have hover effects (scale, overlay) and pages have subtle motion transitions
  5. A series listing page shows all available shows in a card grid with metadata chips (genre, episode count, status)
  6. The platform looks intentional and premium even with only 3-5 mock shows (empty-state design handled)
**Plans**: 3 plans
Plans:
- [x] 03-01-PLAN.md -- Install deps (motion, embla), add shadcn Card/Carousel, create mock data, build ShowCard and PlaceholderCard
- [x] 03-02-PLAN.md -- Build cinematic hero banner with auto-rotating crossfade, ambient glow, and progress indicator
- [x] 03-03-PLAN.md -- Build ContentRail carousel, wire home page, create /series catalog grid, add E2E tests
**UI hint**: yes

### Phase 4: Series Detail & Browse Pages
**Goal**: Visitors can navigate from the catalog into a series detail page to browse episodes by season, and can explore Coming Soon content -- completing the full pre-watch browsing journey
**Depends on**: Phase 3
**Requirements**: CATL-03, CATL-04, CATL-05, CATL-06, CATL-07, CATL-11
**Success Criteria** (what must be TRUE):
  1. Series detail page shows a full backdrop hero with show artwork, description, and metadata
  2. Season selector (tabs or dropdown) switches the displayed episode list
  3. Episode cards display thumbnail, number, title, duration, and status badges (published, coming soon, locked)
  4. Coming Soon page shows unreleased shows and upcoming episodes with appropriate styling
  5. CATL-11 (broadcast schedule) reclassified as admin feature -- moved to Phase 7 per D-15
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md -- Extend mock data with Season/Episode types, install shadcn Tabs/Select, build SeriesDetailHero and EpisodeRow
- [x] 04-02-PLAN.md -- Build SeasonSelector, EpisodeList, wire series detail page at /series/[slug], add E2E tests
- [x] 04-03-PLAN.md -- Build Coming Soon page at /coming-soon with ComingSoonShowCard, add E2E tests
**UI hint**: yes

### Phase 5: Watch Page UI
**Goal**: Visitors can open an episode and see a fully laid-out watch page with embedded YouTube player, episode metadata, and navigation controls -- validating the core watch experience layout before backend integration
**Depends on**: Phase 4
**Requirements**: WTCH-01, WTCH-02, WTCH-03, WTCH-05, WTCH-06
**Success Criteria** (what must be TRUE):
  1. Watch page displays an embedded YouTube player using the IFrame API with a real YouTube video
  2. Episode metadata (title, description, show name, season/episode number) displays alongside or below the player
  3. Previous and next episode navigation buttons are visible and functional (navigate between mock episodes)
  4. An episode quick selector (season + episode picker) allows switching episodes without leaving the watch page
  5. No UI elements overlay the YouTube player during playback (YouTube ToS compliance)
**Plans**: 2 plans
Plans:
- [x] 05-01-PLAN.md -- Build YouTube player component, watch page route, episode metadata, wire existing episode links
- [x] 05-02-PLAN.md -- Add prev/next episode navigation, episode quick-selector, E2E tests
**UI hint**: yes

### Phase 6: Backend Foundation
**Goal**: The Supabase backend is fully configured with database schema, Row Level Security, and auth client -- ready to receive real content and serve it to the frontend
**Depends on**: Phase 1
**Requirements**: FOUN-02, FOUN-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Supabase database has tables for series, seasons, episodes, users, watch_progress, and watchlist with proper relationships
  2. Row Level Security is enabled on every table with policies that allow public read of published content and restrict writes to admin
  3. Unauthenticated users can query published content through the Supabase client (no auth gate on browsing)
  4. A single admin user can be identified by user ID check in the application
**Plans**: 2 plans
Plans:
- [x] 06-01-PLAN.md -- Supabase init, schema migration (6 tables), RLS policies, storage bucket, seed data (15 CIT programs)
- [x] 06-02-PLAN.md -- Supabase client utilities (server, browser, admin), middleware for token refresh, TypeScript type generation

### Phase 7: Admin Dashboard
**Goal**: The admin can populate and manage all platform content -- creating shows, seasons, and episodes with artwork, YouTube links, and release statuses -- through a protected dashboard
**Depends on**: Phase 6
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, ADMN-07, ADMN-08, ADMN-09, ADMN-10
**Success Criteria** (what must be TRUE):
  1. Admin can create, edit, and delete series with title, description, artwork, genre, and status (draft/coming soon/now streaming)
  2. Admin can manage seasons within a series and create episodes with title, description, YouTube URL, number, and status
  3. Admin can upload show artwork (poster, hero banner, logo) to Supabase Storage and see it reflected on the platform
  4. YouTube video ID is automatically extracted from pasted URLs (multiple URL formats supported)
  5. Admin dashboard is protected and only accessible by the designated admin user
**Plans**: 4 plans
Plans:
- [x] 07-01-PLAN.md -- Foundation: route group restructure, shadcn install, DB migration, utilities, admin layout shell, shared components
- [x] 07-02-PLAN.md -- Show CRUD: Server Actions, ShowsTable, ShowFormDrawer with ArtworkUploadZone
- [x] 07-03-PLAN.md -- Show detail: SeasonTabs, EpisodesTable with reorder, SeasonFormDrawer, EpisodeFormDrawer, YouTubeUrlInput
- [ ] 07-04-PLAN.md -- Archive section, permanent delete, admin nav link, Vercel deploy checkpoint
**UI hint**: yes

### Phase 8: Data Integration, Auth & Search
**Goal**: The frontend displays real content from Supabase instead of mock data, users can sign up and log in, and search finds shows and episodes -- the platform becomes a living, data-driven application
**Depends on**: Phase 5, Phase 7
**Requirements**: AUTH-01, AUTH-02, AUTH-03, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. All catalog pages (home, series listing, series detail, coming soon, schedule) display real data from Supabase
  2. User can sign up with email/password and log in with session persisting across browser refresh
  3. User can log out from any page via the nav profile dropdown
  4. Search bar is accessible from all pages and finds shows and episodes by title with card results
**Plans**: 3 plans
Plans:
- [x] 08-01-PLAN.md -- Type foundation: extract brand-colors.ts, auth-errors.ts, expand queries.ts with ViewEpisode/ViewSeason types and query functions, migrate all 23 component files off mock-data
- [x] 08-02-PLAN.md -- Page wiring: rewrite /series, /coming-soon, create /schedule, clean home page, server user hydration, auth error mapping, delete mock-data.ts
- [x] 08-03-PLAN.md -- Search: build NavbarSearch component, /search page with Postgres FTS, Vercel deploy verification checkpoint
**UI hint**: yes

### Phase 9: Personalization & Watch Features
**Goal**: Authenticated users get a personalized streaming experience -- saving shows to a watchlist, resuming episodes from where they left off, and having the next episode autoplay after one ends
**Depends on**: Phase 8
**Requirements**: WTCH-04, USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07
**Success Criteria** (what must be TRUE):
  1. Authenticated user can add and remove shows from their watchlist, with the watchlist button visible on show cards and series detail
  2. My List page shows all watchlisted shows for the logged-in user
  3. Continue watching tracks playback progress per episode (saving every 10-15 seconds) and a continue watching rail appears on the home page
  4. Resuming an episode starts from the saved progress position
  5. After an episode ends, the next episode autoplays with a visible countdown
**Plans**: 3 plans
Plans:
- [x] 09-01-PLAN.md -- Watchlist: queries, useWatchlist hook, WatchlistToggleButton, wire into cards/hero, My List page
- [x] 09-02-PLAN.md -- Progress tracking, resume playback, continue watching rail rewrite, autoplay countdown overlay
- [x] 09-03-PLAN.md -- Profile page expansion (My List preview + Recently Watched), episode progress indicators, Vercel deploy
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Note: Phase 6 depends only on Phase 1 and can run in parallel with Phases 2-5 if desired.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffolding & Design System | 2/2 | Complete | 2026-03-30 |
| 2. App Shell & Navigation | 2/2 | Complete | 2026-03-31 |
| 3. Home Page & Catalog UI | 3/3 | Complete | 2026-03-31 |
| 4. Series Detail & Browse Pages | 3/3 | Complete | 2026-04-01 |
| 5. Watch Page UI | 2/2 | Complete | 2026-04-01 |
| 6. Backend Foundation | 2/2 | Complete | 2026-04-02 |
| 6.1 UI Cinematic Redesign | 5/5 | Complete | 2026-04-03 |
| 7. Admin Dashboard | 4/4 | Complete | 2026-04-04 |
| 8. Data Integration, Auth & Search | 3/3 | Complete | 2026-04-04 |
| 9. Personalization & Watch Features | 3/3 | Complete   | 2026-04-04 |

### Phase 10: Empty State Polish

**Goal:** The platform communicates intentional "coming soon" states rather than appearing broken when the catalog is empty or a show has no episodes -- browse redirects to landing page, series detail shows a text-only empty state, and CtaBanner adapts copy to catalog size
**Requirements**: D-01, D-02, D-03, D-04
**Depends on:** Phase 9
**Plans:** 1 plan

Plans:
- [ ] 10-01-PLAN.md -- Add getCatalogStage() query, browse redirect guard, series empty state, catalog-aware CtaBanner
