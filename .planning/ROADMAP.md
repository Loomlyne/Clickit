# Roadmap: Clickit Story (CIT)

## Milestones

- ✅ **v1.0 CIT Streaming Platform** -- Phases 1-10 (shipped 2026-04-16)
- ✅ **v1.1 Full Bilingual UI (AR/EN)** -- Phases 12-13 shipped; Phases 14-17 superseded by v2.0
- ~~v1.2 Editorial Feature Parity~~ -- Superseded by v2.0 (editorial design IS the main design now)
- ✅ **v2.0 Full Visual Redesign** -- Phases 18-27 (completed 2026-04-28)
- 🚧 **v2.1 UX Fixes** -- Phases 28-31 in progress (started 2026-04-29)
- ✅ **v2.2 Immersive Watch** -- Phases 32-34 completed 2026-05-06

## Phases

<details>
<summary>v1.0 CIT Streaming Platform (Phases 1-10) -- SHIPPED 2026-04-16</summary>

- [x] Phase 1: Project Scaffolding & Design System (2/2 plans) -- completed 2026-03-30
- [x] Phase 2: App Shell & Navigation (2/2 plans) -- completed 2026-03-31
- [x] Phase 3: Home Page & Catalog UI (3/3 plans) -- completed 2026-03-31
- [x] Phase 4: Series Detail & Browse Pages (3/3 plans) -- completed 2026-04-01
- [x] Phase 5: Watch Page UI (2/2 plans) -- completed 2026-04-01
- [x] Phase 6: Backend Foundation (2/2 plans) -- completed 2026-04-02
- [x] Phase 6.1: UI Cinematic Redesign (5/5 plans) -- completed 2026-04-03 (INSERTED)
- [x] Phase 7: Admin Dashboard (4/4 plans) -- completed 2026-04-04
- [x] Phase 8: Data Integration, Auth & Search (3/3 plans) -- completed 2026-04-04
- [x] Phase 9: Personalization & Watch Features (3/3 plans) -- completed 2026-04-04
- [x] Phase 10: Empty State Polish (1/1 plan) -- completed 2026-04-14

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v1.1 Full Bilingual UI -- Phases 12-13 shipped, Phases 14-17 superseded</summary>

- [x] Phase 12: i18n Infrastructure (1/1 plan) -- completed 2026-04-21
- [x] Phase 13: Route Restructure + Auth Safety (7/7 plans) -- completed 2026-04-24
- [x] ~~Phase 14-17~~ -- Superseded by v2.0 (RTL + translations will redo on new components in v2.1)

</details>

### ✅ v2.0 Full Visual Redesign -- Phases 18-27

- [x] **Phase 18: Design Tokens & Typography** -- New fonts, colors, radii, CSS custom properties, utility classes, global resets
- [x] **Phase 19: Header & Footer Shell** -- Editorial header (dot logo, nav, auth buttons) + footer (wordmark, newsletter, 5-col grid, socials, live status)
- [x] **Phase 20: Landing Page** -- Split hero, marquee ticker, stats bar, show grid, Why Clickit, genre tiles, FAQ accordion, CTA banner
- [x] **Phase 21: Browse Page** -- Full-bleed hero carousel, continue watching rail, shorts/reels cards, landscape show rails, bottom CTA
- [x] **Phase 22: Series Detail & Reviews** -- Cinematic hero, cast row, season tabs, episode grid, meta sidebar, review composer with Supabase Realtime
- [x] **Phase 23: Watch Page** -- YouTube-style layout, sticky header breadcrumb, 2-column grid, action bar, description card, prev/next cards, episode sidebar
- [x] **Phase 24: Shorts Overlay** -- Full-screen vertical reel viewer, segmented progress, creator info, action rail, keyboard+swipe nav
- [x] **Phase 25: Auth & Supporting Pages** -- Split-screen auth, OAuth, password strength meter; search, my list, profile, coming soon, support restyled
- [x] **Phase 26: Admin Visual Refresh** -- New tokens applied to admin portal (backgrounds, accent, fonts, radii) -- functionality unchanged
- [x] **Phase 27: Responsive Polish** -- Mobile breakpoints across all pages (header, landing, content rails, watch, footer, shorts, auth)

### ✅ v2.2 Immersive Watch -- Phases 32-34

- [x] **Phase 32: Watch Route Isolation & Fullscreen Shell** -- Move watch into `(watch)/` route group; video fills 100dvw × 100dvh on entry with zero chrome; YouTube IFrame API stays alive across episode switches (completed 2026-05-06)
- [x] **Phase 33: Auto-Hide Chrome Layer** -- Top overlay (back/title/badge/actions) and edge prev/next arrows fade in on interaction, fade out after 3s idle, never block YouTube native controls (completed 2026-05-05)
- [x] **Phase 34: Episode Tray** -- Persistent 24px peek handle plus Vaul bottom sheet with 3 snap points (peek/half/full); season selector tabs + vertical episode list; tap navigates without remounting the player (completed 2026-05-06)

## Phase Details

### Phase 18: Design Tokens & Typography
**Goal**: Every component in the app draws from the new editorial design system -- fonts load without FOIT, colors cascade via CSS custom properties, and the visual foundation is locked before any page work begins
**Depends on**: Nothing (first phase of v2.0; builds on i18n infrastructure from v1.1 Phases 12-13)
**Requirements**: DSYS-01, DSYS-02, DSYS-03, DSYS-04, DSYS-05, DSYS-06
**Success Criteria** (what must be TRUE):
  1. Navigating to any page shows Newsreader rendering on display headlines, Space Grotesk on UI text, and JetBrains Mono on labels/metadata -- no fallback flash
  2. The page background is near-black (#0a0a0a) and any accent-colored element (button, link, badge) uses electric yellow (#ffcc00)
  3. All interactive elements (buttons, cards, inputs, modals) render with 4px border-radius -- no remnant 11.2px rounded corners
  4. Browser DevTools confirms CSS custom properties --bg-0 through --bg-4, --text/--text-dim/--text-mute, --line, and --ease are defined and consumed by components
  5. Selecting text shows the accent-colored ::selection highlight, scrollbars are thin-styled, and .mono/.serif/.label utility classes produce the expected typography
**Plans**: 1/1 complete

### Phase 19: Header & Footer Shell
**Goal**: The global chrome wrapping every page matches the editorial design -- visitors see the new header on every route and scroll to the new footer at the bottom
**Depends on**: Phase 18
**Requirements**: HEAD-01, HEAD-02, HEAD-03, HEAD-04, HEAD-05, HEAD-06, FOOT-01, FOOT-02, FOOT-03, FOOT-04, FOOT-05
**Success Criteria** (what must be TRUE):
  1. Header displays the yellow dot + "CLICKIT" logo text, and shows Browse/Coming Soon/Support nav links when user is signed in; shows anchor nav (Why Clickit, Shows, FAQ) on the landing page
  2. Unauthenticated visitors see "Sign in" and "Start free" buttons in the header; authenticated visitors see their avatar -- no search bar appears anywhere in the header
  3. Header is sticky with backdrop blur, starts transparent on landing page, and transitions to solid background on scroll
  4. Footer displays the editorial "Click*it.*" serif wordmark, a newsletter email signup with inline confirmation, and a 5-column navigation grid with working links
  5. Footer bottom bar shows copyright, a live status indicator dot, legal links (Privacy, Terms), social icons (Instagram, X, YouTube, Letterboxd, RSS), and locale indicator
**Plans**: 2/2 complete
**UI hint**: yes

### Phase 20: Landing Page
**Goal**: First-time visitors land on an editorial home page that sells the platform through visual storytelling -- copy, posters, stats, features, genres, FAQ, and a final CTA
**Depends on**: Phase 19
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06, LAND-07, LAND-08
**Success Criteria** (what must be TRUE):
  1. Landing hero displays a split layout: editorial copy on the left (eyebrow, serif title, subtitle, 2 CTA buttons, 3 stats) and a collage of 4 rotated show posters with a "Now playing" tag on the right
  2. A scrolling marquee ticker runs continuously below the hero with show announcements
  3. Stats bar shows 4 metrics in a bordered grid; show grid displays 4 featured shows with 2:3 poster cards that scale on hover; "Why Clickit" section uses split layout with numbered feature blocks
  4. Genre tiles render in a 3-column grid with hover effects and accent arrow; FAQ accordion opens/closes with CSS grid animation and a rotating plus icon
  5. CTA banner at the bottom shows a backdrop image with gradient scrim and signup buttons
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 21: Browse Page
**Goal**: Authenticated viewers browse the full catalog through an auto-rotating hero carousel, content rails, and shorts preview cards -- the main discovery surface of the platform
**Depends on**: Phase 19
**Requirements**: BRWS-01, BRWS-02, BRWS-03, BRWS-04, BRWS-05, BRWS-06, BRWS-07, BRWS-08, BRWS-09
**Success Criteria** (what must be TRUE):
  1. Browse hero is a full-bleed auto-rotating carousel with backdrop zoom animation, vertical dot indicators with fill animation synced to rotation interval, and each slide shows eyebrow/serif title/meta row/synopsis/3 action buttons
  2. Continue Watching rail displays landscape cards with progress bars reflecting real watch_progress data
  3. Shorts/Reels section shows 9:16 vertical cards with SHORT badge, play overlay, and view counts; clicking a short card opens the Shorts overlay (Phase 24)
  4. Now Streaming and Coming Soon rails display landscape (16:9) show cards with hover lift and image scale effect
  5. Bottom CTA banner renders below the last content rail
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 22: Series Detail & Reviews
**Goal**: Viewers see a cinematic series page with cast, episodes, and metadata -- and can write star-rated reviews that appear in real-time for all users
**Depends on**: Phase 19
**Requirements**: SERS-01, SERS-02, SERS-03, SERS-04, SERS-05, SERS-06, REVW-01, REVW-02, REVW-03, REVW-04, REVW-05
**Success Criteria** (what must be TRUE):
  1. Series hero fills 72vh with full-bleed backdrop image, gradient scrims, and content positioned bottom-left; cast row displays scrollable 140px photo cards with name and role
  2. Season tabs highlight the active season with an accent underline; episode list renders a grid with episode number, thumbnail with play overlay, info text, and runtime badge
  3. Meta sidebar shows year, rating, runtime, genre, creator, and italic tagline; "More like this" rail displays related shows
  4. Authenticated user can submit a review with 1-5 star rating (hover labels: Nope/Meh/Fine/Great/A masterpiece) and text body (max 600 chars); reviews persist to Supabase `reviews` table with RLS
  5. All users see reviews in real-time via Supabase Realtime; user's own review displays with a "YOURS" accent indicator
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 23: Watch Page
**Goal**: Viewers watch episodes in a YouTube-style layout with clear navigation, episode context, and quick access to the rest of the series
**Depends on**: Phase 19
**Requirements**: WTCH-01, WTCH-02, WTCH-03, WTCH-04, WTCH-05, WTCH-06, WTCH-07, WTCH-08
**Success Criteria** (what must be TRUE):
  1. Watch page uses YouTube-style layout -- player on top, scrollable content below -- with the YouTube IFrame API player preserved and restyled chrome
  2. Sticky header shows a back button, clickable breadcrumb (show > season > episode), and navigation buttons
  3. 2-column grid renders main content area alongside a 420px episode sidebar; sidebar includes season selector, episode list with NOW PLAYING badge, and "More like this" rail
  4. Title + action bar displays channel avatar, show info, View series button, and My List/Like/Share pill buttons
  5. Description card shows view count, premiere date, genre, synopsis, and hashtags; prev/next episode cards render in a 2-column grid below the description
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 24: Shorts Overlay
**Goal**: Viewers can browse vertical short-form content in a full-screen immersive overlay with swipe/keyboard navigation
**Depends on**: Phase 21
**Requirements**: SHRT-01, SHRT-02, SHRT-03, SHRT-04, SHRT-05, SHRT-06
**Success Criteria** (what must be TRUE):
  1. Clicking a short card on the browse page opens a full-screen vertical reel viewer displaying 9:16 content with a segmented progress bar that auto-advances over 20 seconds
  2. Bottom info shows creator avatar, handle, Follow button, title, tagline, and metadata
  3. Right action rail displays Like (heart toggle), List, and Comment buttons
  4. User can navigate via keyboard (arrows for prev/next, space for pause, M for mute, Esc to close), touch swipe (vertical), and prev/next peek cards flanking the main card
  5. Body scroll is locked while the overlay is open; closing the overlay returns to the browse page scroll position
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 25: Auth & Supporting Pages
**Goal**: All secondary viewer surfaces (auth, search, my list, profile, coming soon, support) match the editorial design -- no page retains the old visual treatment
**Depends on**: Phase 18
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, SUPP-01, SUPP-02, SUPP-03, SUPP-04, SUPP-05
**Success Criteria** (what must be TRUE):
  1. Auth page uses split-screen layout: editorial hero on the left (backdrop image, quote testimonial, 3 stats, logo + badge) and form on the right (Sign in/Sign up toggle tabs with serif title)
  2. Auth form includes OAuth buttons for Google and Apple, a password strength meter (4 bars) on signup, remember me checkbox, forgot password link, and terms checkbox -- all wired to existing Supabase Auth
  3. Search page renders with new design tokens, search input, results grid, and styled empty state
  4. My List page shows watchlist as 2:3 poster cards with remove button and hover scale; Profile page has avatar upload, profile nav tabs, and Go to Admin button
  5. Coming Soon page displays upcoming shows with remind me button; Support page has a contact form (email, topic, message, submit) styled in the editorial design
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 26: Admin Visual Refresh
**Goal**: Admin portal uses the same design tokens as the viewer surface -- dark backgrounds, yellow accent, new fonts, tight radii -- while all CRUD functionality remains unchanged
**Depends on**: Phase 18
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05
**Success Criteria** (what must be TRUE):
  1. Admin pages render on #0a0a0a/#121212/#1a1a1a background surfaces instead of the old palette
  2. All accent-colored admin elements (active tabs, save buttons, status badges, progress indicators) use electric yellow (#ffcc00)
  3. Admin typography uses Space Grotesk for UI text and JetBrains Mono for labels/metadata; all admin components use 4px border-radius
  4. Every admin CRUD operation (create show, edit episode, upload artwork, archive, restore) works identically to pre-redesign -- visual refresh only, zero functional changes
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 27: Responsive Polish
**Goal**: Every page in the redesigned platform adapts gracefully to mobile, tablet, and desktop viewports -- no layout breaks, no truncated content, no unusable interactions
**Depends on**: Phase 20, Phase 21, Phase 22, Phase 23, Phase 24, Phase 25, Phase 26
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07
**Success Criteria** (what must be TRUE):
  1. Mobile header collapses navigation into a hamburger/drawer menu; landing hero stacks to single column at 960px breakpoint
  2. Content rails use smaller poster widths on mobile viewports; watch page collapses from 2-column to single column at 1180px
  3. Footer stacks its 5-column grid into a single column on mobile; auth layout stacks from side-by-side to vertical at 900px
  4. Shorts overlay on mobile uses swipe-only navigation (no peek cards flanking the main card)
  5. All pages pass visual QA at breakpoints 1180, 1100, 960, 900, 720, 560, and 420px without layout breaks, text overflow, or unusable touch targets
**Plans**: 1/1 complete
**UI hint**: yes

### Phase 32: Watch Route Isolation & Fullscreen Shell
**Goal**: Watch page opens with video filling the entire viewport -- no Navbar, Footer, Silk, MarqueeTicker, or Lenis -- and the YouTube player survives episode switches without losing progress tracking
**Depends on**: Nothing (first phase of v2.2; builds on v1.0 watch route currently in `(viewer)/`)
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06
**Success Criteria** (what must be TRUE):
  1. Loading any `/watch/[id]` URL paints a black fullscreen viewport with the YouTube iframe edge-to-edge -- no Navbar at top, no Footer at bottom, no Silk WebGL background, no MarqueeTicker bar
  2. On iOS Safari, the player fills the viewport without being clipped by the dynamic toolbar -- `h-dvh` and `min-h-svh` keep the iframe correctly sized as the toolbar shows/hides
  3. YouTube native controls (play, seek scrubber, volume, captions, cast, fullscreen) are visible and interactive -- `controls=1` and no overlay covers them
  4. Clicking a different episode (from tray or arrow) swaps the video via `loadVideoById()` -- the iframe element is the same DOM node before and after, no flash of black, no reload
  5. Continue-watching progress writes still fire every 10s in the new layout -- pausing the video then refreshing the page resumes within 10s of the last position
  6. Lenis smooth-scroll never hijacks the watch route -- pinch/wheel/touch gestures behave like the native browser, with no scroll-locked feel
**Plans**: 2 plans
Plans:
- [x] 32-01-PLAN.md -- Create (watch)/ route group, bare segment layout, page.tsx migration, WatchShell component (fullscreen shell + initial player wiring)
- [x] 32-02-PLAN.md -- Add handleEpisodeSwitch (loadVideoById + replaceState), wire AutoplayOverlay, delete WatchPageContent, smoke test
**UI hint**: yes

### Phase 33: Auto-Hide Chrome Layer
**Goal**: Provide accessible, non-intrusive chrome over the fullscreen player -- top overlay and edge prev/next arrows appear on interaction and disappear after 3s idle, with strict no-overlap of YouTube's native control bar
**Depends on**: Phase 32
**Requirements**: CHROME-01, CHROME-02
**Success Criteria** (what must be TRUE):
  1. On entry, the player is fully visible with chrome hidden -- no top bar, no edge arrows; only YouTube's own controls (and the peek handle from Phase 34) are present
  2. Tapping the screen, moving the pointer, or pressing a key fades the top overlay and edge arrows in within ~200ms -- back button, show title, S/E badge, watchlist/like/share, and prev/next arrows are all reachable
  3. After 3 seconds of no interaction, the top overlay and edge arrows fade out -- and while hidden, taps in those regions pass through to the YouTube controls (no `pointer-events` blocking)
  4. When the YouTube player enters a paused state (`onStateChange` state=2), the chrome stays visible and ignores the idle timer until playback resumes
  5. Edge prev/next arrow buttons sit at 50% viewport height on the left/right edges, fade with the top overlay, and disappear entirely on episodes that have no previous (S1E1) or no next (final episode of final season)
  6. Tapping prev/next swaps episodes via `loadVideoById()` -- the player keeps the same iframe and progress tracking continues uninterrupted
**Plans**: 2 plans
Plans:
- [x] 33-01-PLAN.md -- useIdleTimer hook + currentPrevEpisode state + WatchShell idle wiring
- [x] 33-02-PLAN.md -- Top overlay + edge arrows + page.tsx initial watchlist/likes fetch
**UI hint**: yes

### Phase 34: Episode Tray
**Goal**: A persistent peek handle and Vaul-based bottom sheet let viewers browse seasons and episodes without ever covering the player or remounting the iframe
**Depends on**: Phase 32, Phase 33
**Requirements**: TRAY-01, TRAY-02, TRAY-03, TRAY-04, TRAY-05, TRAY-06, TRAY-07
**Success Criteria** (what must be TRUE):
  1. A 24px pill-shaped peek handle is always visible at the viewport bottom -- shows the show name and current episode counter (e.g. "Last Call · Ep 3 of 12") -- and stays visible regardless of chrome auto-hide state
  2. Swiping up from the bottom edge on mobile, or clicking the peek handle on desktop, opens the tray; swiping down or tapping the backdrop returns it to the peek state
  3. The tray honors three snap points -- closed/peek (handle only), half (~50dvh with 3-4 episode rows + the player visibly compressed above), and full (~95dvh, full scrollable list) -- and the player is never wrapped by the tray (sibling DOM, never covered)
  4. The tray header shows the show title and a row of season tabs covering all seasons; tapping a different season tab swaps the episode list in place -- no page navigation, the player keeps playing
  5. Each episode row renders a 16:9 thumbnail, S/E badge, episode title, duration, and a mini progress bar reflecting saved continue-watching state; the currently-playing row is highlighted with a distinct background plus indicator
  6. Tapping any episode row navigates to that episode via `loadVideoById()` (no iframe remount); on mobile the tray automatically returns to the peek state after selection so the new episode is immediately watchable
**Plans**: 1 plan
Plans:
- [x] 34-01-PLAN.md -- Add Vaul tray, snap states, player squeeze behavior, season tabs, episode rows, progress bars, and switch wiring
**UI hint**: yes

## Dependency Graph (v2.0)

```
18 (Design Tokens & Typography) [foundation -- everything depends on this]
 ├─> 19 (Header & Footer Shell)
 │    ├─> 20 (Landing Page)
 │    ├─> 21 (Browse Page)
 │    │    └─> 24 (Shorts Overlay)
 │    ├─> 22 (Series Detail & Reviews)
 │    └─> 23 (Watch Page)
 ├─> 25 (Auth & Supporting Pages)
 └─> 26 (Admin Visual Refresh)

All viewer + admin phases ──> 27 (Responsive Polish) [final phase]
```

Phases 20, 21, 22, 23 may run in parallel after Phase 19 lands (independent page surfaces). Phase 24 blocks on Phase 21 (shorts cards live on browse). Phases 25 and 26 can run in parallel with viewer page phases since they only depend on Phase 18 tokens. Phase 27 is serial after all other phases complete.

## Dependency Graph (v2.2)

```
32 (Watch Route Isolation & Fullscreen Shell) [foundation -- builds the (watch)/ route group + IFrame API stability]
 ├─> 33 (Auto-Hide Chrome Layer) [requires fullscreen shell + iframe handle]
 └─> 34 (Episode Tray) [requires fullscreen shell; uses chrome interactions established in 33]
```

Phase 32 is serial first. Phases 33 and 34 both depend on 32 but are largely independent surfaces (chrome overlay vs. bottom sheet). 34 references 33's interaction patterns (idle timer aware peek handle), so prefer serial 32 → 33 → 34 unless plan-phase splits cleanly.

## Progress

**Execution Order:**
v2.0: 18 -> 19 -> 20/21/22/23 (parallel eligible) -> 24 -> 25/26 (parallel eligible) -> 27
v2.2: 32 -> 33 -> 34

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffolding & Design System | v1.0 | 2/2 | Complete | 2026-03-30 |
| 2. App Shell & Navigation | v1.0 | 2/2 | Complete | 2026-03-31 |
| 3. Home Page & Catalog UI | v1.0 | 3/3 | Complete | 2026-03-31 |
| 4. Series Detail & Browse Pages | v1.0 | 3/3 | Complete | 2026-04-01 |
| 5. Watch Page UI | v1.0 | 2/2 | Complete | 2026-04-01 |
| 6. Backend Foundation | v1.0 | 2/2 | Complete | 2026-04-02 |
| 6.1. UI Cinematic Redesign | v1.0 | 5/5 | Complete | 2026-04-03 |
| 7. Admin Dashboard | v1.0 | 4/4 | Complete | 2026-04-04 |
| 8. Data Integration, Auth & Search | v1.0 | 3/3 | Complete | 2026-04-04 |
| 9. Personalization & Watch Features | v1.0 | 3/3 | Complete | 2026-04-04 |
| 10. Empty State Polish | v1.0 | 1/1 | Complete | 2026-04-14 |
| 12. i18n Infrastructure | v1.1 | 1/1 | Complete | 2026-04-21 |
| 13. Route Restructure + Auth Safety | v1.1 | 7/7 | Complete | 2026-04-24 |
| ~~14-17~~ | ~~v1.1~~ | - | Superseded | - |
| ~~18-26~~ | ~~v1.2~~ | - | Superseded | - |
| 18. Design Tokens & Typography | v2.0 | 1/1 | Complete | 2026-04-28 |
| 19. Header & Footer Shell | v2.0 | 2/2 | Complete | 2026-04-28 |
| 20. Landing Page | v2.0 | 1/1 | Complete | 2026-04-28 |
| 21. Browse Page | v2.0 | 1/1 | Complete | 2026-04-28 |
| 22. Series Detail & Reviews | v2.0 | 1/1 | Complete | 2026-04-28 |
| 23. Watch Page | v2.0 | 1/1 | Complete | 2026-04-28 |
| 24. Shorts Overlay | v2.0 | 1/1 | Complete | 2026-04-28 |
| 25. Auth & Supporting Pages | v2.0 | 1/1 | Complete | 2026-04-28 |
| 26. Admin Visual Refresh | v2.0 | 1/1 | Complete | 2026-04-28 |
| 27. Responsive Polish | v2.0 | 1/1 | Complete | 2026-04-28 |
| 32. Watch Route Isolation & Fullscreen Shell | v2.2 | 2/2 | Complete | 2026-05-06 |
| 33. Auto-Hide Chrome Layer | v2.2 | 2/2 | Complete   | 2026-05-05 |
| 34. Episode Tray | v2.2 | 1/1 | Complete | 2026-05-06 |
