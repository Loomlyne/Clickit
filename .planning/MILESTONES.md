# Milestones

## v1.0 CIT Streaming Platform (Shipped: 2026-04-16)

**Phases completed:** 11 phases (incl. 6.1 inserted), 27 plans, 51 tasks
**Timeline:** 16 days (2026-03-30 to 2026-04-14)
**Commits:** 286 | **Files:** 323 | **LOC:** 13,259 TypeScript
**Requirements:** 60/60 complete (3 accepted as intentional design decisions per audit)

**Key accomplishments:**

1. Cinematic dark streaming UI with auto-rotating hero, content rails, show cards with per-brand color glow, Ken Burns zoom, and WCAG-compliant motion
2. Full watch experience: YouTube IFrame API player, prev/next navigation, cross-season autoplay with 8-second countdown, and resume from saved position
3. Supabase backend with 7 tables, RLS policies, admin auth via app_config, and 15 CIT programs seeded with seasons and episodes
4. Complete admin dashboard: show/season/episode CRUD with artwork upload, episode reorder, archive with conflict resolution, and YouTube URL extraction
5. Personalization layer: watchlist, continue watching rail, progress tracking (10s intervals), and profile page with watch history
6. Catalog-aware empty states, Postgres FTS search, genre filtering, broadcast schedule page, and server-hydrated auth

**Known design decisions at close:**
- NAVG-01/SRCH-01: Navbar intentionally minimal (logo + profile only) — accepted per audit
- CATL-08: /series browse handled via redirect to landing — accepted per audit

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---

## v2.1 UX Fixes (In Progress: started 2026-04-29)

**Scope:** Support + newsletter submission flows, CTA repair, route and anchor repair, company pages
**Planned phases:** 4 phases, 31 end-state verification
**Status:** Implementation in progress

**Target outcomes:**

1. Support messages persist in Supabase, show real validation states, and attempt email delivery to `contact@clickitstory.com`
2. Newsletter signup works from the footer and updates flow, stores subscriptions in Supabase, and attempts email delivery through Resend
3. Dead or misleading CTAs are replaced with real destinations across landing, browse, coming soon, support, profile, and footer
4. `About`, `Creators`, and `Press` exist as real localized viewer routes and footer links

**Planned archive:** `.planning/milestones/v2.1-ROADMAP.md`, `.planning/milestones/v2.1-REQUIREMENTS.md`

---

## v2.2 Immersive Watch (Completed: 2026-05-06)

**Scope:** Full watch page redesign, fullscreen-first video, swipe-up episode tray
**Planned phases:** 3 phases (32–34), 15 requirements
**Status:** Complete with runtime verification caveat

**Outcomes:**

1. Watch page opens with video filling the viewport, no Navbar, Footer, or layout chrome
2. Auto-hide top overlay (back, title, actions, prev/next arrows) fades in on interaction, out after 3s idle
3. Persistent peek handle at viewport bottom; swipe-up reveals Vaul bottom sheet with full episode list
4. Episode tray: season selector tabs + scrollable vertical list; tap to navigate; player keeps playing

**Audit:** `.planning/milestones/v2.2-MILESTONE-AUDIT.md`

---
