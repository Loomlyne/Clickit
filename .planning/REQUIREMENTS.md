# Requirements — v2.0 Full Visual Redesign

**Milestone:** v2.0
**Total:** 68 requirements across 12 categories
**Generated:** 2026-04-24

## v2.0 Requirements

### Design System (DSYS)
- [ ] **DSYS-01**: Platform uses Newsreader (serif) for display headlines, Space Grotesk (sans) for UI text, JetBrains Mono for labels/metadata
- [ ] **DSYS-02**: Platform uses near-black (#0a0a0a) background with electric yellow (#ffcc00) accent color
- [ ] **DSYS-03**: All components use 4px border-radius (down from 11.2px)
- [ ] **DSYS-04**: CSS custom properties define surface layers (--bg-0 through --bg-4), text tiers (--text, --text-dim, --text-mute), line colors, and motion easing
- [ ] **DSYS-05**: Utility classes .mono, .serif, .label available for editorial typography patterns
- [ ] **DSYS-06**: Global resets applied (::selection accent, thin scrollbars, button/a/img base)

### Header (HEAD)
- [ ] **HEAD-01**: Header displays logo with yellow dot indicator + "CLICKIT" text
- [ ] **HEAD-02**: Header shows nav links (Browse, Coming Soon, Support) when authenticated
- [ ] **HEAD-03**: Header shows anchor nav (Why Clickit, Shows, FAQ) on landing page
- [ ] **HEAD-04**: Header shows Sign in + Start free buttons when unauthenticated, avatar when authenticated
- [ ] **HEAD-05**: Header is sticky with backdrop blur, transparent on landing, solid on scroll
- [ ] **HEAD-06**: No search bar in header

### Footer (FOOT)
- [ ] **FOOT-01**: Footer displays editorial "Click*it.*" wordmark with serif typography
- [ ] **FOOT-02**: Footer has newsletter email signup with inline confirmation
- [ ] **FOOT-03**: Footer has 5-column grid (About, Watch, Discover, Company, Account) with working nav links
- [ ] **FOOT-04**: Footer displays social icons (Instagram, X, YouTube, Letterboxd, RSS)
- [ ] **FOOT-05**: Footer bottom bar shows copyright, live status dot, legal links, locale indicator

### Landing Page (LAND)
- [ ] **LAND-01**: Landing hero uses editorial split layout — copy left (eyebrow, serif title, subtitle, 2 CTAs, 3 stats) + poster collage right (4 rotated show posters + "Now playing" tag)
- [ ] **LAND-02**: Scrolling marquee ticker below hero with show announcements
- [ ] **LAND-03**: Stats bar displays 4 metrics in a grid with border separators
- [ ] **LAND-04**: Show grid displays 4 featured shows with 2:3 posters and hover scale effect
- [ ] **LAND-05**: "Why Clickit" section uses split layout with numbered feature blocks
- [ ] **LAND-06**: Genre tiles display in 3-column grid with hover effects and accent arrow
- [ ] **LAND-07**: FAQ accordion with CSS grid animation and rotating plus icon
- [ ] **LAND-08**: CTA banner with backdrop image, gradient scrim, and signup buttons

### Browse Page (BRWS)
- [ ] **BRWS-01**: Browse hero is a full-bleed auto-rotating carousel with backdrop zoom animation
- [ ] **BRWS-02**: Hero content shows eyebrow, serif title, meta row, synopsis, and 3 action buttons (Continue watching, More info, My list)
- [ ] **BRWS-03**: Hero has vertical dot indicators with fill animation synced to rotation interval
- [ ] **BRWS-04**: Continue Watching rail displays landscape cards with progress bars
- [ ] **BRWS-05**: Shorts/Reels section shows 9:16 vertical cards with SHORT badge, play overlay, and view counts
- [ ] **BRWS-06**: Clicking a short opens the Shorts overlay
- [ ] **BRWS-07**: Now Streaming and Coming Soon rails use landscape show cards
- [ ] **BRWS-08**: Bottom CTA banner for upgrade/annual plan
- [ ] **BRWS-09**: Show cards default to landscape (16:9) orientation with hover lift + image scale

### Series Detail (SERS)
- [ ] **SERS-01**: Series hero is 72vh with full-bleed backdrop, gradient scrims, and content bottom-left
- [ ] **SERS-02**: Cast row displays scrollable 140px photo cards with name and role
- [ ] **SERS-03**: Season tabs with accent underline for active tab
- [ ] **SERS-04**: Episode list shows grid with episode number, thumbnail with play overlay, info, and runtime
- [ ] **SERS-05**: Meta sidebar displays year, rating, runtime, genre, creator, and italic tagline
- [ ] **SERS-06**: "More like this" rail shows related shows

### Reviews (REVW)
- [ ] **REVW-01**: User can submit a review with 1-5 star rating and text body (max 600 chars)
- [ ] **REVW-02**: Reviews are stored in Supabase `reviews` table with RLS policies
- [ ] **REVW-03**: All reviews are visible to all users in real-time via Supabase Realtime
- [ ] **REVW-04**: User's own reviews display with "YOURS" accent indicator
- [ ] **REVW-05**: Star rating has hover labels (Nope, Meh, Fine, Great, A masterpiece)

### Watch Page (WTCH)
- [ ] **WTCH-01**: Watch page uses YouTube-style layout — player on top, scrollable content below
- [ ] **WTCH-02**: Sticky header with back button, clickable breadcrumb (show > season > episode), and nav buttons
- [ ] **WTCH-03**: 2-column grid: main content + 420px episode sidebar (collapses at 1180px)
- [ ] **WTCH-04**: Title + action bar with channel avatar, show info, View series button, My List/Like/Share pill buttons
- [ ] **WTCH-05**: Description card with view count, premiere date, genre, synopsis, and hashtags
- [ ] **WTCH-06**: Prev/next episode cards in 2-column grid
- [ ] **WTCH-07**: Episode sidebar with season selector, episode list with NOW PLAYING badge, and "More like this"
- [ ] **WTCH-08**: YouTube IFrame API player preserved with restyled chrome

### Shorts Overlay (SHRT)
- [ ] **SHRT-01**: Full-screen vertical reel viewer opens from browse shorts section
- [ ] **SHRT-02**: Main card displays 9:16 aspect ratio with segmented progress bar auto-advancing over 20s
- [ ] **SHRT-03**: Bottom info shows creator avatar, handle, Follow button, title, tagline, and meta
- [ ] **SHRT-04**: Right action rail with Like (heart toggle), List, and Comment buttons
- [ ] **SHRT-05**: Navigation via keyboard (arrows, space, M, Esc), touch swipe (vertical), and prev/next peek cards
- [ ] **SHRT-06**: Body scroll locked while overlay is open

### Auth (AUTH)
- [ ] **AUTH-01**: Auth page uses split-screen layout — editorial hero left + form right
- [ ] **AUTH-02**: Hero side shows backdrop image, quote testimonial, 3 stats, logo + badge
- [ ] **AUTH-03**: Form side has Sign in/Sign up toggle tabs with serif title
- [ ] **AUTH-04**: OAuth buttons for Google and Apple
- [ ] **AUTH-05**: Password strength meter (4 bars) on signup
- [ ] **AUTH-06**: Remember me, forgot password, terms checkbox controls
- [ ] **AUTH-07**: Wired to existing Supabase Auth (signInWithOAuth, signInWithPassword, signUp)

### Supporting Pages (SUPP)
- [ ] **SUPP-01**: Search page with search input, results grid, and empty state
- [ ] **SUPP-02**: My List page with watchlist grid (2:3 cards, remove button, hover scale)
- [ ] **SUPP-03**: Profile page with avatar upload, profile nav tabs, Go to Admin button
- [ ] **SUPP-04**: Coming Soon page with upcoming shows list and remind me button
- [ ] **SUPP-05**: Support page with contact form (email, topic, message, submit)

### Admin Portal (ADMN)
- [ ] **ADMN-01**: Admin uses new background colors (#0a0a0a, #121212, #1a1a1a)
- [ ] **ADMN-02**: Admin uses electric yellow (#ffcc00) as accent color
- [ ] **ADMN-03**: Admin typography uses Space Grotesk for UI, JetBrains Mono for labels
- [ ] **ADMN-04**: Admin components use 4px border-radius
- [ ] **ADMN-05**: All admin functionality unchanged — visual refresh only

### Responsive (RESP)
- [ ] **RESP-01**: Mobile header collapses nav
- [ ] **RESP-02**: Landing hero stacks to single column at 960px
- [ ] **RESP-03**: Content rails use smaller poster widths on mobile
- [ ] **RESP-04**: Watch page collapses to single column at 1180px
- [ ] **RESP-05**: Footer stacks columns on mobile
- [ ] **RESP-06**: Shorts overlay uses swipe-only on mobile (no peek cards)
- [ ] **RESP-07**: Auth layout stacks at 900px

## Future Requirements

*None — full scope included in v2.0*

## Out of Scope

- Arabic/RTL for new components — deferred to v2.1
- Tweaks panel from prototype — prototyping tool, not production
- Self-hosted video — YouTube embeds stay
- AI recommendations — not enough content
- Translation of new component strings to Arabic — deferred to v2.1
- Shorts connected to real YouTube Shorts API — placeholder data for now
- Review moderation/admin controls — deferred

## Traceability

*Populated by roadmap*
