# Clickit viewer performance — baseline and after (Job E)

Branch `claude/perf-skeletons-6f6fc9`, base `origin/main` cfbc8fb. Measured 2026-10-20 on Koss's Mac, locally only (never the live site).

## How it was measured

- Production build (`next build`, Next 16.2.9 Turbopack) + `next start` on :3210, pointed at the LOCAL Supabase stack (`supabase_*_Clickit`, 127.0.0.1:55321, 17 shows / 94 episodes). No live data, no live writes.
- Every viewer route except `/portfolio` and `/auth` redirects anonymous visitors to `/auth` (proxy auth gate), so those routes are measured **signed in** as a local-only test viewer (`perf-lighthouse@clickit.local`, created on the local stack by anon sign-up; credentials in `/Users/koss/.clickit-checks/perf-tools/test-user.env`, outside the repo). `/portfolio` and `/auth` are measured anonymous.
- Lighthouse 13.5.0, Chrome for Testing 1248 headless, performance category only, default simulated throttling (mobile = Moto G class + slow 4G; desktop preset). 3 runs per route and mode, **median** shown.
- "Own JS KB" = transfer size of first-party scripts the page actually loaded (gzip) — the honest replacement for "First Load JS", which Next 16 no longer prints in the build table.
- Local Supabase answers in ~1 ms, which hides server waterfalls. A second pass puts a fixed **+40 ms per Supabase request** proxy in front of the local stack (`latency-proxy.mjs`, roughly a Worker-to-Supabase hop) and measures server TTFB and mobile Lighthouse on the signed-in routes.
- Scripts: `/Users/koss/.clickit-checks/perf-measure.sh`, `perf-ttfb.sh`, `perf-summary.mjs`; raw Lighthouse JSON in `/Users/koss/.clickit-checks/perf-out/<label>/`.
- Routes: `/en` is a 308 to `/en/portfolio`, and `/en/browse` is a 307 to `/en/watch` (the browse hub), so those two are measured at their targets.

## Before (cfbc8fb, local Supabase, Lighthouse median of 3)

| route | mode | score | FCP s | LCP s | TBT ms | CLS | SI s | own JS KB |
|---|---|---|---|---|---|---|---|---|
| /en/auth | desktop | 97 | 0.33 | 1.14 | 0 | 0.056 | 0.55 | 462 |
| /en/auth | mobile | 79 | 1.21 | 5.59 | 90 | 0.001 | 1.90 | 462 |
| /en/my-list | desktop | 97 | 0.33 | 1.16 | 0 | 0.057 | 0.51 | 474 |
| /en/my-list | mobile | 81 | 1.21 | 5.07 | 38 | 0.001 | 1.61 | 380 |
| /en/portfolio | desktop | 98 | 0.33 | 1.12 | 0 | 0.056 | 0.59 | 382 |
| /en/portfolio | mobile | 80 | 1.21 | 5.39 | 39 | 0.001 | 1.85 | 382 |
| /en/profile | desktop | 97 | 0.33 | 1.18 | 0 | 0.056 | 0.56 | 481 |
| /en/profile | mobile | 81 | 1.21 | 5.08 | 45 | 0.001 | 1.65 | 387 |
| /en/series/last-call | desktop | 96 | 0.37 | 1.29 | 0 | 0.056 | 0.57 | 497 |
| /en/series/last-call | mobile | 80 | 1.36 | 5.01 | 57 | 0.001 | 2.08 | 402 |
| /en/watch/[episode] | desktop | 99 | 0.33 | 0.96 | 0 | 0.000 | 0.54 | 458 |
| /en/watch/[episode] | mobile | 84 | 1.21 | 4.51 | 60 | 0.000 | 2.28 | 458 |
| /en/watch | desktop | 97 | 0.37 | 1.23 | 0 | 0.056 | 0.59 | 489 |
| /en/watch | mobile | 77 | 1.36 | 5.02 | 57 | 0.001 | 5.34 | 416 |

Every route ended on the URL requested (signed-in session held; `/auth` and `/portfolio` anonymous). `/en/auth` desktop is a median of 2 (run 3 failed to launch).

What the numbers say:

- **Mobile LCP is ~5 s on every route, even `/auth`**, while desktop is ~1.1 s. Simulated mobile LCP lands at time-to-interactive: Lighthouse's mobile model (Lantern) charges for the ~380–460 KB gz of first-party JS that starts before first paint, so nothing counts as painted until that JS has run. Unthrottled, the same pages paint in 0.2–0.8 s. The entry preloader (`#preload-cover` + brand video, first page of a new tab) adds to it but is **not** the main cause: an experiment with the cover and preloader removed (column "no preloader" below) moved mobile LCP by only 0.3–0.5 s (`/portfolio` 5.39 → 4.85, `/auth` 5.59 → 5.05). On `/portfolio` the LCP element on a first visit *is* the preloader `<video>`.
- First-party JS per page is 380–500 KB gzip. On every viewer page: react-dom 71 KB, `@supabase/supabase-js` 60 KB (47 KB of it unused on `/watch`), `motion` 44 KB (24 KB unused). `zod` adds 74 KB on `/auth` only.
- TBT is low (38–90 ms) and CLS is ~0 on mobile; desktop CLS 0.056 on most routes.
- Local data has **no show artwork** (all image URLs empty), so the LCP element on `/watch` is the hero watermark text, and image fixes cannot be measured here.

## After (branch 5233f43, same method)

Lighthouse, median of 3 (before → after; "no preloader" = experiment only, not shipped):

| route | mode | score | LCP s | TBT ms | SI s | no preloader LCP s |
|---|---|---|---|---|---|---|
| /en/auth | desktop | 97 → 98 | 1.14 → 1.10 | 0 → 0 | 0.55 → 0.50 | — |
| /en/auth | mobile | 79 → 79 | 5.59 → 5.57 | 90 → 59 | 1.90 → 1.59 | 5.05 |
| /en/my-list | desktop | 97 → 97 | 1.16 → 1.14 | 0 → 0 | 0.51 → 0.48 | — |
| /en/my-list | mobile | 81 → 81 | 5.07 → 5.06 | 38 → 25 | 1.61 → 1.45 | — |
| /en/portfolio | desktop | 98 → 94* | 1.12 → 1.02 | 0 → 0 | 0.59 → 1.94* | — |
| /en/portfolio | mobile | 80 → 76* | 5.39 → 5.44 | 39 → 32 | 1.85 → 5.44* | 4.85 |
| /en/profile | desktop | 97 → 97 | 1.18 → 1.16 | 0 → 0 | 0.56 → 0.48 | — |
| /en/profile | mobile | 81 → 81 | 5.08 → 5.23 | 45 → 42 | 1.65 → 1.49 | — |
| /en/series/last-call | desktop | 96 → 97 | 1.29 → 1.22 | 0 → 0 | 0.57 → 0.54 | — |
| /en/series/last-call | mobile | 80 → 80 | 5.01 → 5.23 | 57 → 44 | 2.08 → 1.65 | 5.37 |
| /en/watch/[episode] | desktop | 99 → 99 | 0.96 → 0.95 | 0 → 0 | 0.54 → 0.74 | — |
| /en/watch/[episode] | mobile | 84 → 83 | 4.51 → 4.66 | 60 → 41 | 2.28 → 2.23 | — |
| /en/watch | desktop | 97 → 97 | 1.23 → 1.25 | 0 → 0 | 0.59 → 0.53 | — |
| /en/watch | mobile | 77 → 80 | 5.02 → 5.39 | 57 → 57 | 5.34 → 1.64 | 5.14 |

\* `/portfolio` Speed Index is **not** a regression: `/portfolio` code is untouched by this branch, and re-running the **base** commit cfbc8fb under the same machine conditions (load ~5.3) gave mobile SI 5.36 / desktop 1.94 — the same as the branch (5.44 / 1.94, 5 runs). The first "before" pass (SI 1.85) caught the preloader at a different moment. Speed Index on that page swings with when the brand video paints.

Signed-in routes with **+40 ms per Supabase request** (mobile, median of 3, before → after): `/watch` LCP 5.36 → 5.31, TBT 74 → 29; series 5.10 → 5.25; episode 4.50 → 4.66 (SI 6.32 → 2.29); my-list 5.05 → 4.84; profile 5.15 → 5.22. Within noise for LCP — Lantern's JS charge dominates — so the server change has to be read from the timing below.

Server time to the full HTML document at +40 ms per Supabase request (`curl` `time_total`, median of 25, signed in; first byte is the `loading.tsx` shell and stays ~60 ms on both):

| route | base full doc ms | branch full doc ms | saved |
|---|---|---|---|
| /en/watch | 213 | 199 | 14 ms |
| /en/series/last-call | 270 | 259 | 11 ms |
| /en/watch/[episode] | 274 | 216 | **59 ms** |
| /en/my-list | 188 | 200 | −11 ms (code unchanged → noise) |
| /en/profile | 257 | 247 | 10 ms (code unchanged → noise) |

What changed for a viewer:

- **Skeletons** (F5, signed picture `skeletons-before-after.png`): hub, series, My List and episode pages now show bones in the real boxes (16:9 rails, 9:16 shorts, start-aligned My List, black player + 134 px tray), token colours, a shimmer that stops for reduce-motion and runs right-to-left in `/ar`, and one screen-reader "Loading" label. Nothing jumps when content lands.
- **Fewer serial database waves** (F1–F3): the episode page saves one full Supabase round trip (~59 ms at +40 ms latency; more on a real Worker→Supabase hop); hub and series save ~10–15 ms locally, more where the auth call is slower.
- **One priority hero image** (F4): only slide 1 preloads at high priority. **Not measurable here** — the local data has no show artwork. Check on the live data after deploy.
- Lighthouse scores are flat within run-to-run noise (±0.3 s LCP). The ~5 s mobile LCP floor is client JS (F7) plus the preloader (F6); both need the proposals below.


## Lenis removed (Koss, 2026-10-20: "if there is Lenis scroll animation, remove it from all pages")

- Removed the `SmoothScroll` (Lenis) provider from the viewer layout, every `data-lenis-prevent`, and the `lenis` package. Scrolling is native everywhere; no global `scroll-behavior: smooth`.
- The navbar's hide/show uses one passive, rAF-throttled `scroll` listener with the same thresholds; scroll persistence uses `window.scrollY` / `window.scrollTo` with a `scrollHeight - innerHeight` clamp.
- Client JS, sum of every `.next/static/chunks/*.js` (gzip -9): **834,231 → 827,984 bytes (−6.2 KB gz, −19.9 KB raw, 59 → 58 files)**. Lenis was loaded by the viewer layout, so the saving lands on every viewer page. Minified Lenis core + React adapter is ~6.0 KB gz (5.1 + 0.9). Lenis also ran a requestAnimationFrame loop on every frame while smoothing wheel scrolls on desktop; that main-thread work is gone too.
- Click-through on a prod build (Playwright, en + ar, 1440 and 375 px), 66 + 4 checks:
  - wheel scrolling works on home, hub, series
  - the navbar hides on scroll down and shows on scroll up (and stays pinned on the landing page)
  - the shorts overlay locks the page and restores the position on close
  - the desktop user dropdown opens with its items
  - the 375 px menu sheet opens without moving the page
  - back from an episode restores the series scroll (900 → 900)
  - the episode shell does not scroll the page
  - no horizontal overflow
  - The only failure was the known local artifact: supabase-js `getUser` "Failed to fetch" because the production CSP blocks `http://127.0.0.1:55321` from the browser.

## What is slow (step 2 findings)

| # | Finding | Where | Safe to fix here? |
|---|---|---|---|
| F1 | `/watch` hub waited for `auth.getUser()` + featured shows before starting the 7 catalog queries (2 serial waves). | `src/app/[locale]/(viewer)/watch/page.tsx` | Yes — fixed |
| F2 | `/series/[slug]` waited for the slug lookup before the auth check, and the "more shows" fallback ran after the signed-in wave (up to 4 serial waves). | `src/app/[locale]/(viewer)/series/[slug]/page.tsx` | Yes — fixed |
| F3 | `/watch/[episodeId]` read the resume point alone, then the watchlist/like/progress wave (3 serial waves signed in). | `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` | Yes — fixed |
| F4 | Hero carousel preloads **every** slide image (+ the loop clone) at high priority, so N+1 hero images compete with the LCP image. | `cinematic-backdrop.tsx`, `hero-slide.tsx`, `hero-banner.tsx` | Yes — fixed (slide 0 only; others eager, normal priority) |
| F5 | Loading skeletons do not match the real layout (portrait cards where rows are 16:9, centred My List header, phone rows drawn sideways) → visible jump when content lands; `animate-pulse` ignores reduce-motion; raw white alpha instead of UI System tokens. | `loading.tsx` files under `(viewer)` and `(watch)` | Needs Koss's signature on the picture |
| F6 | Entry preloader: on the first page of every new tab session a full-screen black cover + brand video holds the page for up to 3 s (hard release). Lighthouse always hits it (fresh profile); removing it moves simulated mobile LCP by ~0.3–0.5 s. | `src/components/layout/entry-preload.tsx`, `(viewer)/layout.tsx` | Product choice — proposal P1 |
| F7 | Client JS: `motion` (44 KB gz) is on every page through `MotionConfig` in the root layout and the preloader; `@supabase/supabase-js` (60 KB gz, 47 KB unused on `/watch`) ships to every viewer page through the navbar auth section; `zod` (74 KB gz) ships with the auth forms on `/auth` only. | root layout, `auth-section.tsx`, `login-form.tsx` | Refactor — proposal P2/P3 |
| F8 | `@vercel/analytics` + `@vercel/speed-insights` load on every page; off Vercel they post to endpoints that do not exist. | `src/app/[locale]/layout.tsx` | Job C owns Vercel removal — proposal P4 |
| F9 | Watch page loads the full YouTube IFrame API + player on mount (needed to play). A lite facade (thumbnail, load player on tap) would cut ~1 MB of YouTube JS from first load but changes the play flow (iOS can need a second tap). | `youtube-player.tsx`, `watch-shell.tsx` | Behaviour change — proposal P5 |
| F10 | Each hero slide paints a full-screen SVG `feTurbulence` noise layer with `mix-blend-mode: overlay` (4 octaves) — expensive paint on low-end phones. | `cinematic-backdrop.tsx` | Visual change — proposal P6 |
| — | Fonts: LBC regular/bold via `next/font/local`, `display: swap`, ~71 KB each (Arabic glyphs included). Already right; subsetting would break Arabic. | `src/app/[locale]/layout.tsx` | No change |
| — | Images below the fold (cards, episode thumbs, cast) already use `next/image` with `sizes` and lazy loading. | — | No change |
| — | Public catalog queries are already behind `unstable_cache` (15–60 min, tagged). | `src/lib/queries.ts` | No change |

## Proposals (not done here)

- **P1 Entry preloader** (F6): it is the LCP element on a first visit and worth ~0.3–0.5 s of simulated mobile LCP (experiment above), not the whole 5 s. Options: show it only on `/portfolio` (the brand landing), cap it at ~1.2 s, or skip it on deep links. Needs Koss's call; it is a brand moment.
- **P2 motion** (F7): switch to `LazyMotion` + `m.*` components with `domAnimation` loaded async; drop `MotionConfig` from the root layout in favour of the existing `usePrefersReducedMotion` hook. ~11 files.
- **P3 supabase-js on the client** (F7): the navbar only needs "is signed in + avatar", which the server layout already passes as `initialUser`. In `src/components/layout/auth-section.tsx`, replace the static `import { createClient } from '@/lib/supabase/client'` with `const { createClient } = await import('@/lib/supabase/client')` inside the auth-change effect and in `signOut`. That takes ~60 KB gz of supabase-js off `/portfolio` and the `/watch` hub first load. Other static importers to treat the same way later: review-composer, login-form, reset-password-form, profile-header, account-settings, use-watchlist, use-likes, use-progress-tracker. Not done here because it touches the auth area (owner of auth to decide).
- **P4 Vercel analytics** (F8, for Job C): remove `<Analytics />` / `<SpeedInsights />` with the rest of the Vercel code during the Cloudflare move; if analytics are wanted, Cloudflare Web Analytics is one beacon.
- **P5 YouTube facade** (F9): thumbnail + play button, player mounts on tap with `autoplay=1`. Needs a picture and an iOS check.
- **P6 Hero noise layer** (F10): bake the noise into a tiny PNG tile (no filter, no blend) or drop it on phones.
- **Desktop CLS 0.056** on most routes comes from the navbar right-hand cluster settling after hydration (auth section). Reserve its width server-side; same auth file as P3.
- **Phase 2 boundary** (Job C files, not touched): image loader/remotePatterns in `next.config.ts`, OpenNext/wrangler, `workers/`, `proxy.ts`. On Workers, make sure hero/card images go through the `clickit-media` `?w=` variants (C's 02-03) and that `/brand/*` keeps the 1-year immutable cache header.
