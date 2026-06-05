# Clickit Platform Audit — Master Plan (2026-05-30)

Synthesized from a 5-agent swarm audit. Source reports in this folder:
`01-perf-preloader-hero.md` · `02-perf-portfolio-watch.md` · `03-perf-bundle-data-cache.md` · `04-security.md` · `05-ux-accessibility.md`

Goals (user): **faster** (esp. preloader + portfolio + all pages), **more secure on all data**, **more user-friendly**.

---

## Executive summary — the 6 things that matter most

1. **~30MB of unused 3D deps ship risk + bloat.** `three`, `@react-three/fiber`, `@base-ui/react` are in `dependencies` with **no real imports** (Silk.jsx is orphaned, used only by the deleted `viewer-silk-background.tsx`). Removing them is the single biggest, safest win. *(agents 01 + 03)*
2. **The preloader hard-blocks the page up to 7s** with no preload hint, weak dedup, and `preload="auto"` competing for bandwidth — this IS the lag you feel. *(agents 01 + 02)*
3. **Rail cards use raw `<img>`** (ShowCard/EpisodeCard/ContinueWatchingCard) — 10–20 full-res images load unoptimized on portfolio/watch. *(agents 02 + 05)*
4. **Security holes that are actually exploitable**: stored XSS via admin GA/Pixel IDs, no HTTP security headers/CSP, BotID is non-blocking on auth, reviews are unlimited-spammable, `server-only` missing on the service-role module. *(agent 04)*
5. **No streaming + eager YouTube iframes** make content pages wait on RSC waterfalls and ~500KB of YouTube JS before interactive. *(agent 02)*
6. **Accessibility + i18n gaps**: `prefers-reduced-motion` not respected (heavy motion), RTL breaks on auth password toggles, hardcoded English strings, no `error.tsx` boundary. *(agent 05)*

---

## TRACK A — FASTER

### P0 — Quick wins (ship first; low risk, high impact)
| # | Action | Files | Effort |
|---|--------|-------|--------|
| A1 | **Remove dead 3D/unused deps** `three`, `@react-three/fiber`, `@base-ui/react`; delete `src/components/Silk.jsx` (VERIFY no real imports first) | package.json, Silk.jsx | S |
| A2 | **Preloader**: `hardReleaseMs` 7000→3500, `preload="auto"`→`"metadata"`, add `sessionStorage` shown-guard, add `<link rel="preload" as="video">` in RSC layout | entry-preload.tsx, (viewer)/layout.tsx | S |
| A3 | **Remove double `<PageTransition>`** (one in layout.tsx + one in template.tsx fire two fades/nav) | (viewer)/layout.tsx:45 | S |
| A4 | **next.config knobs**: `images.formats:['image/avif','image/webp']`, `images.minimumCacheTTL`, consider `reactCompiler` | next.config.ts | S |
| A5 | Move `shadcn` to devDependencies; add `sharp` to deps | package.json | S |

### P1 — High impact
| # | Action | Files | Effort |
|---|--------|-------|--------|
| A6 | **Convert rail cards to `next/image`** (lazy, sized, srcset) | ShowCard, EpisodeCard, ContinueWatchingCard | M |
| A7 | **Stream the portfolio/home page** — wrap LandingHero + ShowsPortfolio in `<Suspense>` (skeletons already exist in loading.tsx); fix sequential RSC waterfall | portfolio/page.tsx, (viewer)/page.tsx | M |
| A8 | **YouTube facade / lazy** — don't autoplay all hero iframes; activate only the visible slide; gate hero iframe behind a click/intersection facade | landing-hero.tsx, HeroBanner, CinematicBackdrop | M |
| A9 | **Dedupe YouTube IFrame API loader** (two singletons) | lib/youtube.ts:62, watch/youtube-player.tsx:17 | S |

### P2 — Bigger investments
| # | Action | Effort |
|---|--------|--------|
| A10 | Convert LBC fonts (504KB+506KB TTF) → WOFF2 + Arabic/Latin subset (~700KB saved) | M |
| A11 | `getShowsByGenre(genre, excludeId)` query to stop fetching ALL shows for "More Like This" (series/[slug]:88,134) | M |
| A12 | Reduce client-bundle surface (106 `'use client'`); evaluate PPR on `/watch` | L |

---

## TRACK B — MORE SECURE

### P0 — Must-fix
| # | Action | Files | Effort |
|---|--------|-------|--------|
| B1 | **Add `import 'server-only'`** to the service-role module (prevents accidental key leak to browser) | src/lib/supabase/admin.ts | S |
| B2 | **Fix stored XSS in analytics IDs** — strict-validate GA (`^G-[A-Z0-9]+$`) + Pixel (`^[0-9]+$`) before interpolating into `<Script>` | layout.tsx:151,168 + admin schema | S |
| B3 | **HTTP security headers** — CSP, X-Frame-Options (admin), X-Content-Type-Options, Referrer-Policy, HSTS via next.config headers() | next.config.ts | M |
| B4 | **Sanitize/forbid SVG uploads** to public buckets (or strip scripts) | admin/actions.ts:2236,2323 | M |

### P1 — Hardening
| # | Action | Files | Effort |
|---|--------|-------|--------|
| B5 | **Reviews abuse**: add `UNIQUE(user_id, show_id)` + move writes behind a Server Action with auth check | new migration + reviews flow | M |
| B6 | **Rate-limit + BotID** on contact, newsletter, and auth mutations | contact.ts:33,120, auth/actions.ts | M |
| B7 | Revisit BotID non-blocking decision on signup (mass-account risk) | auth/actions.ts:36 | S |
| B8 | Full RLS re-verify pass — confirm every table RLS-enabled + least-privilege (agent 04 detail) | migrations | M |

---

## TRACK C — MORE USER-FRIENDLY

### P0 / P1
| # | Action | Files | Effort |
|---|--------|-------|--------|
| C1 | **Respect `prefers-reduced-motion`** — gate hero animations, infinite bouncing arrow, ScrollReveal, preloader video, navbar `animate-ping` | landing-hero-animations.tsx:15-82, scroll-reveal.tsx, entry-preload.tsx | M |
| C2 | **Add a viewer `error.tsx`** boundary (today a DB/network failure = unbranded crash page) | (viewer)/error.tsx | S |
| C3 | **Fix RTL** — auth password eye-toggles use `right-3` (overlaps Arabic text); use logical `end-3` | login/signup/reset-password forms | S |
| C4 | **i18n hardcoded strings** — search page (5), ShowCard "Play"/"New", "Cast" headings, watch tray `S1/S2`, review date `en-US` | search/page.tsx, ShowCard, series | M |
| C5 | A11y: `next/image` alt coverage, icon-button aria-labels, MobileNav `modal` focus trap, visible search label | ui/* | M |

---

## Recommended execution order
1. **Wave 1 (P0 quick wins, ~half day):** A1–A5, B1–B2, C2–C3. All low-risk, immediately felt. Ship as one or two commits → auto-deploys.
2. **Wave 2 (perf P1):** A6–A9, then verify with Lighthouse.
3. **Wave 3 (security P1 + headers):** B3–B8.
4. **Wave 4 (UX + i18n + a11y):** C1, C4–C5.
5. **Wave 5 (bigger bets):** A10–A12.

Each wave = its own commit(s) on `~/Developer/Clickit`, pushed to `main` → Vercel auto-deploy. Migrations (B5) auto-apply via the new GitHub Action.
