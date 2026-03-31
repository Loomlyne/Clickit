# Clickit Story (CIT)

## What This Is

A Netflix-style cinematic streaming platform for Clickit Story — a UAE-based digital media company producing 15 original programs spanning travel, health, music, comedy, cooking, kids, poetry, cinema, tech, and more. The platform lets viewers discover shows, browse episodes by season, and watch via embedded YouTube players. Content is bilingual (Arabic/English), produced from Abu Dhabi by Spacelight Studios FZ LLC. The admin (client Issam Dridi / Nejib Challakhi) uploads videos to YouTube then connects them to the platform for a premium viewing experience.

## Core Value

Viewers enter the platform, discover a show, pick an episode, and watch immediately — a premium, immersive, zero-friction experience that makes CIT's original content feel like a real streaming service, not a YouTube channel.

## Requirements

### Validated

- [x] Next.js project initialized with App Router, Tailwind CSS, Supabase client — Validated in Phase 1
- [x] Design system with CIT brand colors (WCAG-safe tints), typography, spacing tokens — Validated in Phase 1
- [x] Responsive cinematic dark UI following CIT brand guidelines — Foundation validated in Phase 1

### Active

- [ ] User authentication via Supabase Auth (sign up, login, logout)
- [x] Series catalog with cinematic hero banners and content rails — Validated in Phase 3
- [x] Series detail page with season selector and episode browser — Validated in Phase 4
- [ ] Episode watch page with embedded YouTube player
- [ ] Show statuses: draft, coming soon, now streaming
- [ ] Episode statuses: draft, coming soon, published
- [ ] Watchlist (add/remove shows)
- [ ] Continue watching (track progress per episode)
- [ ] Autoplay next episode
- [x] Coming Soon page showing unreleased shows and episodes — Validated in Phase 4
- [ ] Admin dashboard: manage shows, seasons, episodes, release state
- [ ] Admin connects YouTube video URLs to episodes
- [ ] Responsive cinematic dark UI following CIT brand guidelines
- [ ] Broadcast schedule display (day/time per show)
- [ ] Per-show branded artwork and logo display
- [ ] Search across shows and episodes

### Out of Scope

- Self-hosted video / video uploads — YouTube is the video host, always
- Role-based admin — single admin only, no team permissions
- Payments / subscriptions — all content is free for v1
- Mobile native app — web-first, responsive only
- Real-time chat / comments — not part of v1
- Multi-creator upload — only admin manages content
- Notifications system — deferred to v2
- Trailer preview on hover — nice-to-have, deferred
- Analytics dashboard — deferred to v2
- Teaser countdown timers — deferred

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
- **Content growth**: Slow — platform must look good with few shows initially, not feel empty

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
| Supabase for auth + DB | Client preference, serverless Postgres, built-in auth | -- Pending |
| YouTube embeds for video | No need for video infrastructure, client uploads to YouTube | -- Pending |
| Dark cinematic UI | Netflix-style immersion for streaming content, white logo on dark | -- Pending |
| Next.js + Vercel | SSR for SEO, App Router for modern patterns, Vercel for deployment | -- Pending |
| Single admin (no RBAC) | Only one person manages content, keep it simple | -- Pending |
| English-first UI | Arabic content supported but UI chrome is English for v1 | -- Pending |

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

---
*Last updated: 2026-03-31 after Phase 4 completion — series detail and coming-soon pages built*
