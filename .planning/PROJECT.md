# Clickit Story (CIT)

## What This Is

A Netflix-style cinematic streaming platform for Clickit Story — a UAE-based digital media company producing 15 original programs spanning travel, health, music, comedy, cooking, kids, poetry, cinema, tech, and more. The platform lets viewers discover shows, browse episodes by season, and watch via embedded YouTube players. Content is bilingual (Arabic/English), produced from Abu Dhabi by Spacelight Studios FZ LLC. The admin (client Issam Dridi / Nejib Challakhi) uploads videos to YouTube then connects them to the platform for a premium viewing experience.

## Core Value

Viewers enter the platform, discover a show, pick an episode, and watch immediately — a premium, immersive, zero-friction experience that makes CIT's original content feel like a real streaming service, not a YouTube channel.

## Current State

**Shipped:** v1.0 (2026-04-16)
**Deployed:** Vercel production
**Stack:** Next.js 16.2 + Supabase + Tailwind CSS v4 + shadcn/ui
**LOC:** 13,259 TypeScript across 323 files

The platform is live with the full viewer experience (cinematic home page, series browsing, watch page with autoplay, personalization) and admin dashboard (show/season/episode CRUD, artwork upload, archive management). All 15 CIT programs are seeded. Content is served from Supabase with Postgres FTS search and RLS security.

## Requirements

### Validated

- ✓ Next.js project with App Router, Tailwind CSS, Supabase client — v1.0
- ✓ Design system with CIT brand colors (WCAG-safe tints), typography, spacing tokens — v1.0
- ✓ Responsive cinematic dark UI following CIT brand guidelines — v1.0
- ✓ Supabase schema (shows, seasons, episodes, profiles, watch_progress, watchlist) with RLS — v1.0
- ✓ Supabase auth client setup (server/browser/admin/middleware) — v1.0
- ✓ User authentication via Supabase Auth (sign up, login, logout) — v1.0
- ✓ Series catalog with cinematic hero banners and content rails — v1.0
- ✓ Series detail page with season selector and episode browser — v1.0
- ✓ Episode watch page with embedded YouTube IFrame API player — v1.0
- ✓ Show/episode status management (draft, coming soon, now streaming/published) — v1.0
- ✓ Watchlist (add/remove shows) with My List page — v1.0
- ✓ Continue watching with progress tracking (10s intervals) and resume — v1.0
- ✓ Autoplay next episode with 8-second countdown and cross-season support — v1.0
- ✓ Coming Soon page with unreleased shows and upcoming episodes — v1.0
- ✓ Admin dashboard: full CRUD for shows, seasons, episodes, artwork upload — v1.0
- ✓ YouTube URL extraction and video ID auto-detection — v1.0
- ✓ Broadcast schedule display (day/time per show) — v1.0
- ✓ Per-show branded artwork with brand color glow effects — v1.0
- ✓ Postgres Full-Text Search across shows and episodes — v1.0
- ✓ Catalog-aware empty states and browse redirect — v1.0
- ✓ Profile page with watchlist preview and watch history — v1.0

### Active

(None — next milestone requirements TBD via `/gsd-new-milestone`)

### Out of Scope

- Self-hosted video / uploads — YouTube handles all video hosting, transcoding, CDN
- Payment / subscription — All content free for v1, premature monetization
- Comments / chat — Moderation burden, YouTube has comments already
- Role-based admin — Single admin, building RBAC for one user is waste
- Mobile native app — Web-first, responsive design covers mobile
- AI recommendations — Only ~15 shows, not enough content for ML
- Download for offline — YouTube embed API doesn't support download
- Real-time WebSocket features — Content updates are infrequent, standard HTTP sufficient
- Multi-creator uploads — Only admin manages content
- Live streaming — Not part of v1 platform scope
- Trailer preview on hover — Nice-to-have, deferred to v2
- Notifications system — Deferred to v2
- Analytics dashboard — Deferred to v2
- Teaser countdown timers — Deferred

## Context

**Client:** Issam Dridi (creative vision) / Nejib Challakhi (founder), operating as Clickit Story under Spacelight Studios FZ LLC from Yas Creative Hub, Abu Dhabi.

**Content catalog:** 15 original programs, 294 total episodes planned. Programs range from 15-80 minutes in duration. Each show has its own branded logo and identity. Content is still in production — catalog will grow slowly over time.

**Programs include:**
- Last Call (street interviews, 25min)
- Review Documentary (travel documentary, 42min)
- Doctor Care (health/medical, 50min)
- Poets Platform (Emirati poetry, 80min)
- Kids Area (children's talent, 35min)
- Saturn Podcast (AI/sci-fi podcast, 25min)
- InFocus (behind-the-scenes cinema, 80min)
- Break Fast Daily (morning show, 60min, daily)
- Meta Talk (VR talk show, 25min)
- 360 (Arab creatives spotlight, 55min)
- Music Hub (music talent, 50min)
- Laugh or Leave (comedy competition, 15min)
- Island Cooke (culinary adventure, 50min)
- 60 Questions Challenge (quiz show, 80min)
- NextHub (business, mentioned in broadcast schedule)

**Broadcast schedule:** Each show has a specific broadcast day and time (e.g., Break Fast Daily Mon-Fri 11am, InFocus Sunday 7pm, Meta Talk Wednesday 9pm).

**Video hosting:** All videos are hosted on YouTube. The admin uploads to YouTube, then pastes the YouTube URL into the admin panel to connect it to an episode on the platform.

**Branding assets available:**
- SVG logos: full "clickit story" wordmark + "CIT" icon mark
- Logo variants: primary (white gradient), secondary blue (#2C3569), white (for dark bg), black
- Font: Arthead FREE for logo "story" text

## Constraints

- **Stack**: Next.js (App Router) + Supabase (auth + Postgres DB) + Tailwind CSS, deployed on Vercel
- **Video**: YouTube embed only — no self-hosted video infrastructure
- **Admin**: Single admin user, no role-based access control
- **Bilingual**: Arabic (RTL) and English content, but UI is English-first for v1
- **Brand**: Must follow CIT Branding Guideline for colors, typography, logo usage, and patterns
- **Content growth**: Slow — platform must look good with few shows initially, not feel empty (v1.0 ships with catalog-aware empty states)

## Design System

### Colors (from CIT Branding Guideline)

**Primary:**
- Innovative Blue: `#2C3569` (dominant brand color, 15% usage)
- Royal Purple: `#9F54A0` (15% usage)
- Oasis Green: `#50A258` (15% usage)

**Secondary:**
- Crimson Red: `#DB3F34`
- Sunset Orange: `#EA8C2E`
- Desert Sand & Yellow: `#F8C623`

**Neutrals:**
- Black: `#000000` (10% usage)
- White: `#FFFFFF` (30% usage)

**Platform UI approach:** Dark cinematic backgrounds (black/near-black) with CIT brand colors as accents on show cards, category ribbons, badges, CTAs, and UI highlights. White logo variant on dark surfaces.

### Typography

- **English:** Montreal (sans-serif) — Light, Regular, Medium, Bold
- **Arabic:** Daken Black (headlines) + Avenir Arabic (body)
- **Hierarchy:** Header 82pt ExtraBold, Sub Header 50pt Bold, Body 16pt Regular, CTA 26pt Regular

### Patterns

UAE-inspired patterns for category ribbons and show branding:
- Islamic geometric patterns (Oasis Green, Royal Purple)
- Arabic calligraphy motifs
- 3D geometric / parametric patterns (Innovative Blue)
- Abu Dhabi skyline silhouette (Crimson Red)

Each program gets a branded "ribbon" — a pattern + color combination from 5 brand colors.

### Color Harmony Rules

- Set 1: Royal Purple + Oasis Green
- Set 2: Crimson Red + Desert Sand & Yellow
- Set 3: Royal Purple + Sunset Orange
- Innovative Blue + White are neutral — pair with any set

### Logo Assets

- Full wordmark: `Clickit_final_logo.svg` (white on dark)
- CIT icon mark: `Clickit_final_logo.CITpng.svg`
- Source files on external drive: `/Volumes/Lexar/Work/Freelance/Issam Dridi {Clickit}/Recourses/Clickit logo/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for auth + DB | Client preference, serverless Postgres, built-in auth | ✓ Good — zero ops overhead, RLS works well |
| YouTube embeds for video | No need for video infrastructure, client uploads to YouTube | ✓ Good — hybrid approach (lite for catalog, IFrame API for watch) |
| Dark cinematic UI | Netflix-style immersion for streaming content, white logo on dark | ✓ Good — brand-color glow system adds premium feel |
| Next.js + Vercel | SSR for SEO, App Router for modern patterns, Vercel for deployment | ✓ Good — unstable_cache + updateTag for ISR |
| Single admin (no RBAC) | Only one person manages content, keep it simple | ✓ Good — app_config lookup is flexible enough |
| English-first UI | Arabic content supported but UI chrome is English for v1 | -- Pending — RTL deferred to v2 |
| Minimal navbar (logo + profile only) | Clean streaming aesthetic, content speaks for itself | ✓ Good — intentional design, not a gap |
| Frontend-first approach | UI with mock data before backend, client validates look first | ✓ Good — visual sign-off before wiring |
| Brand color static maps | Tailwind v4 compatibility, never construct class names dynamically | ✓ Good — type-safe, zero runtime cost |
| Hybrid YouTube strategy | Lite embed for catalog thumbnails, IFrame API for watch page | ✓ Good — saves ~500KB per catalog page |
| Postgres FTS over Algolia | 15 shows / 294 episodes trivial for built-in FTS | ✓ Good — zero cost, zero sync issues |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
5. All milestone decisions added to Key Decisions

---
*Last updated: 2026-04-16 after v1.0 milestone completion*
