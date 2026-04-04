# Requirements: Clickit Story (CIT)

**Defined:** 2026-03-30
**Core Value:** Viewers enter, discover a show, pick an episode, watch immediately -- premium streaming experience for CIT originals.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: Next.js project initialized with App Router, Tailwind CSS, and Supabase client
- [x] **FOUN-02**: Supabase database schema created (series, seasons, episodes, users, watch_progress, watchlist)
- [x] **FOUN-03**: Row Level Security (RLS) enabled on all tables with appropriate policies
- [x] **FOUN-04**: Design system established with CIT brand colors (WCAG-safe tints for dark backgrounds), typography (Montreal/Avenir Arabic), and spacing tokens

### Authentication

- [x] **AUTH-01**: User can sign up with email and password via Supabase Auth
- [x] **AUTH-02**: User can log in and session persists across browser refresh
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: Unauthenticated users can browse and watch content (auth gates personalization, not access)
- [x] **AUTH-05**: Admin user identified by user ID check (single admin, no RBAC)

### Admin Dashboard

- [x] **ADMN-01**: Admin can create, edit, and delete series (title, description, artwork, genre, status)
- [x] **ADMN-02**: Admin can create, edit, and delete seasons within a series
- [x] **ADMN-03**: Admin can create, edit, and delete episodes (title, description, YouTube URL, episode number, status)
- [x] **ADMN-04**: Admin can set show status: draft, coming soon, now streaming
- [x] **ADMN-05**: Admin can set episode status: draft, coming soon, published
- [x] **ADMN-06**: Admin can upload show artwork (poster, hero banner, logo) to Supabase Storage
- [x] **ADMN-07**: Admin can set broadcast schedule (day and time) for each show
- [x] **ADMN-08**: Admin can reorder episodes within a season
- [x] **ADMN-09**: YouTube video ID extracted automatically from pasted URL
- [x] **ADMN-10**: Admin dashboard protected -- only accessible by admin user

### Catalog & Browsing

- [x] **CATL-01**: Home page displays cinematic hero banner featuring a show
- [x] **CATL-02**: Home page displays horizontal content rails (Now Streaming, Coming Soon, by genre)
- [x] **CATL-03**: Series detail page shows full backdrop hero with show artwork and info
- [x] **CATL-04**: Series detail page has season selector (dropdown or tabs)
- [x] **CATL-05**: Series detail page shows horizontal episode cards with thumbnail, number, title, duration
- [x] **CATL-06**: Episode cards display status badges (published, coming soon, locked)
- [x] **CATL-07**: Coming Soon page shows unreleased shows and upcoming episodes
- [x] **CATL-08**: Series listing page shows all available shows in card grid
- [x] **CATL-09**: Show cards display per-show branded artwork and logo
- [x] **CATL-10**: Content rails and cards look intentional with few shows (empty-state design)
- [x] **CATL-11**: Broadcast schedule displayed showing day/time per show

### Watch Experience

- [x] **WTCH-01**: Watch page displays embedded YouTube player (full IFrame API)
- [x] **WTCH-02**: Watch page shows episode metadata (title, description, show name, season/episode number)
- [x] **WTCH-03**: Previous / next episode navigation buttons on watch page
- [ ] **WTCH-04**: Autoplay next episode after current episode ends (with countdown)
- [x] **WTCH-05**: YouTube IFrame API compliance -- no overlays on the player (YouTube ToS)
- [x] **WTCH-06**: Episode quick selector on watch page (season + episode picker without leaving player)

### User Features

- [x] **USER-01**: Authenticated user can add/remove shows from watchlist
- [x] **USER-02**: Watchlist button visible on show cards and series detail page
- [x] **USER-03**: My List page shows all watchlisted shows
- [ ] **USER-04**: Continue watching tracks playback progress per episode (saves every 10-15 seconds)
- [ ] **USER-05**: Continue watching rail on home page showing episodes in progress
- [ ] **USER-06**: Resuming an episode starts from saved progress position
- [ ] **USER-07**: User profile page showing watchlist and watch history

### Search

- [x] **SRCH-01**: Search bar accessible from all pages (header)
- [x] **SRCH-02**: Search finds shows and episodes by title
- [x] **SRCH-03**: Search results display show cards and episode cards with thumbnails

### Navigation & Layout

- [x] **NAVG-01**: Floating top nav bar with: Home, Series, Coming Soon, My List, Search, Profile
- [x] **NAVG-02**: Nav is clean, minimal -- shows CIT logo (white variant on dark)
- [x] **NAVG-03**: Responsive layout -- works on mobile, tablet, desktop
- [x] **NAVG-04**: Dark cinematic UI as default theme
- [x] **NAVG-05**: Login/signup accessible from nav (or profile dropdown when logged in)

### Visual Design

- [x] **DESG-01**: Dark luxury background (black/near-black) across all pages
- [x] **DESG-02**: Large cinematic hero banners with show artwork
- [x] **DESG-03**: Horizontal episode cards with hover state (scale, overlay)
- [x] **DESG-04**: Clean white typography on dark backgrounds
- [x] **DESG-05**: CIT brand color accents on cards, badges, CTAs, category ribbons
- [x] **DESG-06**: Soft glass-effect top navigation bar
- [x] **DESG-07**: Subtle motion/transitions (page transitions, card hovers)
- [x] **DESG-08**: Per-show color ribbon using CIT brand pattern system (5 brand colors)
- [x] **DESG-09**: Small metadata chips (duration, episode count, genre, status)
- [x] **DESG-10**: CIT logo (SVG) displayed correctly following brand guidelines

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Engagement

- **ENGM-01**: Trailer preview on hover (auto-playing short clip)
- **ENGM-02**: Notification system for new episodes/show releases
- **ENGM-03**: Featured collections (curated playlists of episodes across shows)
- **ENGM-04**: Teaser countdown timer for upcoming releases

### Internationalization

- **I18N-01**: Full Arabic RTL layout for entire UI
- **I18N-02**: Language toggle switching all UI chrome to Arabic
- **I18N-03**: Arabic search support with proper stemming

### Analytics & Admin

- **ANLT-01**: Admin analytics dashboard (views, watch time, popular shows)
- **ANLT-02**: View count per episode
- **ANLT-03**: Audience demographics

### Platform

- **PLAT-01**: Progressive Web App (PWA) for mobile home screen install
- **PLAT-02**: Social sharing (share episode link with OG preview)
- **PLAT-03**: Email newsletter integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-hosted video / uploads | YouTube handles all video hosting, transcoding, CDN |
| Payment / subscription | All content free for v1, premature monetization |
| Comments / chat | Moderation burden, YouTube has comments already |
| Role-based admin | Single admin, building RBAC for one user is waste |
| Mobile native app | Web-first, responsive design covers mobile |
| AI recommendations | Only ~15 shows, not enough content for ML |
| Download for offline | YouTube embed API doesn't support download |
| Real-time WebSocket features | Content updates are infrequent, standard HTTP sufficient |
| Multi-creator uploads | Only admin manages content |
| Live streaming | Not part of v1 platform scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 6 | Complete |
| FOUN-03 | Phase 6 | Complete |
| FOUN-04 | Phase 1 | Complete |
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 6 | Complete |
| AUTH-05 | Phase 6 | Complete |
| ADMN-01 | Phase 7 | Complete |
| ADMN-02 | Phase 7 | Complete |
| ADMN-03 | Phase 7 | Complete |
| ADMN-04 | Phase 7 | Complete |
| ADMN-05 | Phase 7 | Complete |
| ADMN-06 | Phase 7 | Complete |
| ADMN-07 | Phase 7 | Complete |
| ADMN-08 | Phase 7 | Complete |
| ADMN-09 | Phase 7 | Complete |
| ADMN-10 | Phase 7 | Complete |
| CATL-01 | Phase 3 | Complete |
| CATL-02 | Phase 3 | Complete |
| CATL-03 | Phase 4 | Complete |
| CATL-04 | Phase 4 | Complete |
| CATL-05 | Phase 4 | Complete |
| CATL-06 | Phase 4 | Complete |
| CATL-07 | Phase 4 | Complete |
| CATL-08 | Phase 3 | Complete |
| CATL-09 | Phase 3 | Complete |
| CATL-10 | Phase 3 | Complete |
| CATL-11 | Phase 4 | Complete |
| WTCH-01 | Phase 5 | Complete |
| WTCH-02 | Phase 5 | Complete |
| WTCH-03 | Phase 5 | Complete |
| WTCH-04 | Phase 9 | Pending |
| WTCH-05 | Phase 5 | Complete |
| WTCH-06 | Phase 5 | Complete |
| USER-01 | Phase 9 | Complete |
| USER-02 | Phase 9 | Complete |
| USER-03 | Phase 9 | Complete |
| USER-04 | Phase 9 | Pending |
| USER-05 | Phase 9 | Pending |
| USER-06 | Phase 9 | Pending |
| USER-07 | Phase 9 | Pending |
| SRCH-01 | Phase 8 | Complete |
| SRCH-02 | Phase 8 | Complete |
| SRCH-03 | Phase 8 | Complete |
| NAVG-01 | Phase 2 | Complete |
| NAVG-02 | Phase 2 | Complete |
| NAVG-03 | Phase 2 | Complete |
| NAVG-04 | Phase 2 | Complete |
| NAVG-05 | Phase 2 | Complete |
| DESG-01 | Phase 2 | Complete |
| DESG-02 | Phase 3 | Complete |
| DESG-03 | Phase 3 | Complete |
| DESG-04 | Phase 3 | Complete |
| DESG-05 | Phase 3 | Complete |
| DESG-06 | Phase 2 | Complete |
| DESG-07 | Phase 3 | Complete |
| DESG-08 | Phase 3 | Complete |
| DESG-09 | Phase 3 | Complete |
| DESG-10 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation (full traceability)*
