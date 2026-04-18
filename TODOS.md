# TODOS

Deferred work from CEO review of post-v1.0 hero media + landing redesign (2026-04-18).

---

## P1 — Fix

*(None outstanding — P1 items were fixed inline during CEO review: MIME validation, variant validation)*

---

## P2 — Do Soon

### prefers-reduced-motion support
**What:** Gate the Ken Burns hero zoom, auto-playing video backgrounds, and motion entrance animations behind `useReducedMotion()` from `motion/react`. Also conditionally set `autoPlay` on `<video>` and `?autoplay=1` in YouTube iframe URLs based on the same hook.

**Why:** `DESIGN.md` explicitly requires it. Users who set "Reduce Motion" in their OS accessibility settings (often people with vestibular disorders) currently get the full animation regardless.

**Where to start:** `src/components/home/hero-slide.tsx` for entrance animations. `src/components/primitives/cinematic-backdrop.tsx` for video autoplay.

**Effort:** human ~1h / CC ~5min | **Blocked by:** nothing

---

### Hero media test coverage
**What:** Unit tests for the `CinematicBackdrop` media resolution fallback chain (5 branches: mobile video → desktop video fallback → mobile image → desktop image → bloom only). Integration tests for `uploadShowVideoFile` server action (size validation, admin auth, variant check).

**Why:** The fallback chain is non-trivial. If someone refactors `cinematic-backdrop.tsx`, it'll silently break for shows that don't have all 4 media variants configured. Zero tests currently cover any of this.

**Where to start:** `src/components/primitives/cinematic-backdrop.tsx` props → render output. `src/app/admin/actions.ts` `uploadShowVideoFile`.

**Effort:** human ~2h / CC ~15min | **Blocked by:** nothing

---

## P3 — Backlog

### YouTube iframe lazy loading in hero carousel
**What:** Only mount `VideoLayer` for the currently active hero slide. Unmount (or never mount) iframes for non-active slides. Pass `isActive` from `HeroSlide` down into `CinematicBackdrop` to conditionally render the `VideoLayer`.

**Why:** Each YouTube iframe triggers ~600KB of YouTube Player JS from Google on page load. With 3+ shows using YouTube hero videos, this is 1.8MB+ of third-party JS loaded for slides the user hasn't seen. Visibly slow on mobile.

**Where to start:** `src/components/home/hero-slide.tsx` → `src/components/primitives/cinematic-backdrop.tsx`. `isActive` is already passed to `HeroSlide`.

**Effort:** human ~2h / CC ~10min | **Blocked by:** nothing

---

### Storage cleanup for orphaned hero media files
**What:** A scheduled cleanup job that compares file paths in `site-assets/shows/*/hero-*.mp4` and `show-artwork/shows/*/hero*.webp` against the URLs stored in `shows` DB columns. Deletes files with no matching DB reference.

**Why:** When an admin uploads a hero video or image but closes the drawer without saving, the file lives in Supabase storage indefinitely. At 15 shows this is negligible. At 50+ shows (or frequent media swaps) it becomes a storage cost and confusion problem.

**Where to start:** New Supabase Edge Function or Vercel cron at `/api/cron/cleanup-media`. List storage paths, query DB for all hero URLs, diff, delete orphans.

**Effort:** human ~4h / CC ~20min | **Blocked by:** nothing

---

*Last updated: 2026-04-18 (CEO review — post-v1.0 hero media + landing)*
