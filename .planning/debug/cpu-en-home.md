---
slug: cpu-en-home
status: fixed-awaiting-redeploy-measurement
trigger: "/en costs ~500 ms CPU per request on the test Worker, /ar ~65 ms (Workers Free allows 10 ms)"
created: 2026-10-21
updated: 2026-10-21
branch: claude/phase-02-cpu-en-f3ef3f
---

# /en costs ~500 ms CPU on the Worker, /ar ~65 ms

## Symptoms (02-SPIKE.md, Task 4)

Test Worker clickit.clickitstory.workers.dev, version 0c24ae10 (commit d7b59d6), wrangler tail,
signed-out GETs 2 s apart:

| Route | CPU p50 / p95 / max | wall p50 / p95 |
|---|---|---|
| /en | 507 / 940 / 950 ms | 1153 / 2175 ms |
| /ar | 65 / 117 / 126 ms | 470 / 795 ms |
| /en/auth | 107 / 386 / 529 ms | |

No exceededCpu in that sample. At 13:00 UTC on 2026-10-21 a read-only curl round (about 20 GETs)
got `error code: 1102` (CPU exceeded) on most routes, /ar and /en/portfolio included: Free is
now cutting the Worker off.

## Request path (map)

1. `custom-worker.ts` -> `.open-next/worker.js` (OpenNext): skew check, image routes, then the
   middleware bundle (`.open-next/middleware/handler.mjs`, 2.6 MB, statically imported, so it is
   evaluated when the isolate starts).
2. Middleware = `src/proxy.ts`: next-intl routing, Supabase `updateSession` (`getClaims()`),
   `getAppConfig()` (PostgREST read through `unstable_cache`, R2 incremental cache + D1 tag cache),
   coming-soon gate, locale-root 308 (commit d43fd90, not in the measured build), auth gate.
3. Then `await import("./server-functions/default/handler.mjs")`: the Next server bundle is loaded
   lazily, on the first request that needs a render in that isolate.
4. Render: every page under `[locale]/(viewer)` is dynamic. `(viewer)/layout.tsx` calls
   `createClient()` + `getClaims()` (cookies) and `getLocale()` from `src/lib/locale-server.ts`
   (reads the NEXT_LOCALE cookie). `.next/prerender-manifest.json` holds no /en or /ar route, so
   there is nothing in the incremental cache for OpenNext to serve; `enableCacheInterception` is
   off anyway. The landing hero reads User-Agent / Sec-CH-UA-Mobile (`src/lib/device.ts`).
5. In the measured build, /en and /ar rendered the full layout (117 KB) and then the page's
   `permanentRedirect()` fired after streaming had started (200 + meta refresh, then a second
   render of /portfolio). Fixed already by d43fd90 (proxy answers a real 308).

## Why /en and /ar differed

Not the locale. The same layout, page and module graph serve both. What differs is who comes first
in a fresh isolate:

- Local workerd preview (`opennextjs-cloudflare preview`, inspector CPU profile), fresh isolate:
  first request /ar/portfolio = 326 ms busy (197 ms in the worker bundle, 92 ms runtime);
  the next route /en/portfolio = 105 ms; first /en/auth = 289 ms (new page chunk). Warm:
  /en/portfolio and /ar/portfolio both about 35 ms, /en 308 about 14-21 ms.
- So the first request in each isolate pays the lazy load of the Next server bundle plus cold JIT
  (300-950 ms on Cloudflare hardware); later requests pay the render (35-65 ms).
- In the sample, the /en requests were sent first, so they landed on cold isolates and warmed them;
  /ar and /en/auth then mostly reused warm ones. /en's p50 of 507 ms is the cold cost, /ar's 65 ms
  is the warm render.

Eliminated:
- /en not prerendered while /ar is: neither is prerendered (manifest checked).
- Something only in the en locale: no en-only code path. The NEXT_LOCALE cookie read
  (`src/lib/locale-server.ts`) behaves differently for en (default) and ar, but it changes
  output, not CPU. Same-URL renders with Accept-Language ar, cookie ar and no cookie gave the same
  text (differences were only Suspense streaming order).
- Many Supabase queries: they are I/O (wall time), not CPU.

Conclusion: even warm, a render costs 35-65 ms CPU, so no render fits Free's 10 ms. Only a cached
answer that skips both the proxy and the Next server does.

## Fix

`src/server/anon-html-cache.ts` + `custom-worker.ts` (tests: `tests/unit/anon-html-cache.test.ts`).

- Signed-out `GET` of `/<en|ar>`, `/portfolio`, `/about`, `/support`, `/privacy`, `/terms` is
  answered from a 120 s copy: Cache API first (per data centre; functional on custom domains),
  then R2 (`clickit-next-cache`, prefix `anon-html/`; works on workers.dev). A miss renders through
  OpenNext exactly as before and stores the result.
- Bypass: any `sb-*` cookie (signed in), Next router / Server Action headers (`rsc`,
  `next-router-*`, `next-action`), non-GET, any query parameter other than `utm_*`, `fbclid`,
  `gclid`, `msclkid`.
- Stored only: 200 `text/html` or a 308 with `location`; Set-Cookie must be only NEXT_LOCALE (never
  stored; a hit sets `NEXT_LOCALE=<url locale>` when the visitor's differs, like next-intl); and
  only when the render's cookie locale was the URL locale.
- Key: build version (`.open-next/clickit-build-stamp.json` gitSha + createdAt, so a deploy never
  serves HTML pointing at old chunks) + device class (mobile/desktop, same function as
  `src/lib/device.ts`, now `src/lib/device-class.ts`) + path.
- `custom-worker.ts` loads `.open-next/worker.js` with a dynamic import on the first miss, and
  re-exports `DOQueueHandler` from its own file: a hit in a fresh isolate never evaluates the proxy
  bundle or the Next server.
- Visitors still get `cache-control: private, no-store` (browsers do not keep the page); the Worker
  adds `x-clickit-cache: MISS | HIT-EDGE | HIT-R2` and `age`.

Trade-offs (deliberate):
- An admin change (content, coming-soon flag, ticker) reaches signed-out visitors of these pages
  within 120 s, not at once (`getAppConfig` already caches 15 min, invalidated by tag on save).
- A render that streamed an error boundary (Supabase down) is stored for up to 120 s.
- R2 keeps one object per build x device x path (about 24 per deploy, ~150-180 KB each). A
  lifecycle rule on `anon-html/` (e.g. delete after 1 day) is a follow-up for the controller.

## Verification (local, 2026-10-21)

- Unit: `tests/unit/anon-html-cache.test.ts` 20/20; with `scheduled` and `worker-request-paths`
  `npm run test:unit` in gate:local.
- Local preview of this branch (workerd, local Supabase): `/en/portfolio` MISS 0.5 s then HIT-EDGE
  4 ms wall; mobile UA gets its own MISS then HIT; `/ar/portfolio` MISS then HIT; `/en` 308
  MISS then HIT with `location: /en/portfolio`; `/en/auth`, `/en/watch` (307 to auth) and a
  request with an `sb-` cookie bypass (no header).
- CPU, before -> after (local):
  - fresh isolate, first request: 326 ms busy (197 ms worker JS) -> hit 0.13 ms worker JS
    (the rest of the 26 ms busy is miniflare's local Cache/R2 emulation and the profiler);
  - warm: render 35 ms -> hit path JS 0.04 ms (edge) / 0.03 ms (R2), measured in Node over 3,000
    hits with a 150 KB body.

## Expected on Cloudflare after a redeploy (not measured; no deploy from this session)

| Route (signed out) | before | after, hit | after, miss |
|---|---|---|---|
| /en, /ar (308) | 65-950 ms | ~1-3 ms | proxy only (~15-30 ms warm) |
| /en/portfolio, /ar/portfolio | 65-950 ms | ~1-3 ms | unchanged render (~65 ms warm, 300-950 ms cold) |
| /about /support /privacy /terms | render | ~1-3 ms | unchanged |
| /en/auth, /watch, shows, episodes, admin, signed-in | unchanged | not cached | unchanged |

A miss happens at most once per build x device x path per 120 s via R2 (and once per data
centre for the Cache API tier). Everything not listed still renders and stays over 10 ms: Free
still fails for /en/auth, show and episode pages and every signed-in page.

## How to measure after the redeploy

1. Deploy as usual (controller, Koss's word). New version id from the deploy output.
2. `HOME=/Users/koss/.clickit-cloudflare npx -y wrangler@4.151.2 tail clickit --format json --ip self`
   (CLOUDFLARE_API_TOKEN unset).
3. One priming GET per route and device, then 10 GETs per route 2 s apart, no query marker
   (any `?m=` marker bypasses the cache; `utm_*` is fine):
   `curl -s -o /dev/null -D - https://clickit.clickitstory.workers.dev/en/portfolio | grep -i x-clickit-cache`
   Expected: first `MISS`, then `HIT-R2` or `HIT-EDGE`.
4. Read `cpuTime` per event for /en, /ar, /en/portfolio, /ar/portfolio. Expected hits in low single
   ms. If every hit is `HIT-R2`, the Cache API is not active on workers.dev (expected; it is on a
   custom domain).

## Cross-check with 02-CPU-REPORT.md (main 787ca3a)

- Cause agrees: interleaved, /en ok-p50 42 ms and /ar 59 ms; the Task 4 gap was an order effect.
  Independent check here: local workerd profile, fresh isolate, whichever route goes first pays
  ~326 ms; warm /en/portfolio and /ar/portfolio both ~35 ms.
- d43fd90 checked independently, read-only: local preview of the branch answers `/en` and `/ar`
  with a 308 `location: /<locale>/portfolio` and an empty body (no layout render);
  `tests/unit/locale-root-redirect.test.ts` pins the order (after the coming-soon gate, before
  the auth gate).
- Report adds: from ~2 min of steady traffic Free enforced the limit, 47/179 requests 503
  (1102), every route fails, cheapest success 4 ms. Every page is private/no-store with no
  `x-nextjs-cache`.

## Plan: cached public pages on Workers Free (for Koss's signature; no code until signed)

Koss, 2026-10-21 (via controller): "Stay Free, do the rebuild". Goal: every public route answers
under 10 ms CPU, signed out and signed in.

Status of code already on this branch: e49a219 (anonymous Worker cache in front of OpenNext,
lazy OpenNext load) was built before the scope change. It stays as step 4's base; nothing new is
written before the signature.

### Why this shape

- A render costs 35-100 ms warm, so the fix is to stop rendering per request.
- OpenNext's own cache (ISR + `enableCacheInterception`) still runs the proxy first (next-intl,
  Supabase session, `getAppConfig`), which alone is about 15-20 ms locally. So a Worker-level
  front cache that answers before the proxy is needed too.
- Client navigation fetches RSC payloads. For dynamic pages those depend on the router state
  tree, which makes the key unbounded. For static pages the payload is per path. So pages must
  become truly static (ISR), not just Worker-cached.

### Reads that make public pages per-visitor today (map)

| File | Reads | Moves to |
|---|---|---|
| `[locale]/(viewer)/layout.tsx` | `getClaims()` (cookie session) -> `initialUser`; NEXT_LOCALE cookie locale | no session read; locale from URL. Header `AuthSection` (already client) reads the session in the browser |
| `[locale]/layout.tsx` `generateMetadata` | NEXT_LOCALE cookie locale | URL locale |
| `components/layout/footer.tsx`, `landing/landing-faq.tsx`, `legal/legal-page-content.tsx`, privacy, terms, support, legal/[slug], coming-soon | NEXT_LOCALE cookie locale | URL locale (`next-intl` `getLocale` / params) |
| `landing/landing-hero.tsx` | `auth.getUser()` (CTA href), User-Agent (`getIsMobile`) | CTA href decided in the browser (default `/auth`); hero video chosen in the browser (`<source media>` / matchMedia) |
| `(viewer)/series/[slug]/page.tsx` | `getUser()`, watchlist, like, episode progress, profile row; User-Agent | public show data static; personal state from a browser hook (Supabase RLS); placeholders (picture 2) |
| `(viewer)/watch/page.tsx` | `getUser()` -> personalised hero + `ContinueWatchingRail`; User-Agent | static hero; rail rendered in the browser for signed-in (picture 3) |
| `(watch)/watch/[episodeId]/page.tsx` | `getUser()`, watchlist, like, progress map (resume) | static episode data; personal state + resume position from the browser before play starts |
| `(viewer)/updates/page.tsx` | `getUser()` email to prefill the form | prefill in the browser |
| `(viewer)/my-list`, `(viewer)/profile` | the signed-in user's data | static shell + browser fetch (signed-in key class only) |
| `(viewer)/auth/page.tsx` | `getUser()` + admin check -> redirect a signed-in visitor | anonymous class cached; signed-in visitors keep going through the proxy (rare) |
| `src/proxy.ts` | session refresh, `getAppConfig` flags, gates | unchanged logic; skips the Supabase client when no `sb-` cookie; its redirects (coming-soon, auth gate) are cached per class |

Writes are already browser-side (progress `hooks/use-progress-tracker.ts`, watchlist, like), so
they cost no Worker CPU. Server actions left: contact form, player error report (rare).

### What changes (build order, each with tests)

1. Locale from the URL everywhere (12 files). Small.
2. Shared layout and header without a server session read: `AuthSection` resolves the session
   in the browser (`getSession()` reads the cookie, no network) and shows the placeholder the
   signature picks (picture 1).
3. Personal data to browser hooks: show page, episode page (resume waits for the position),
   watch home rail, updates prefill, my-list, profile (pictures 2 and 3). Hero and show-page
   media variant chosen in the browser.
4. Pages static: `generateStaticParams` for shows and legal slugs, on-demand ISR for episodes,
   long `revalidate` fallback, existing `updateTag` / `revalidatePath` calls do the
   invalidation (D1 tag cache already deployed). `enableCacheInterception: true` once the gate
   tests pass with it on (research Pitfall 2).
5. Worker front cache (extends e49a219): key = build + auth class (`sb-` cookie present or not)
   + path + RSC kind (`rsc` / `next-router-segment-prefetch` value); stores 200, 308 and gate
   307s; freshness = latest `revalidatedAt` in the D1 tag cache (read at most every 10 s per
   isolate), so an admin save shows within ~10 s; stale-while-revalidate on a change.
6. Post-deploy warm-up script for the controller (every public URL x locale x class, retries),
   plus a tail-based CPU check that reuses `scripts/cf/measure-routes.mjs`.

First task is a spike that settles the one technical unknown: Next 16 RSC and segment-prefetch
responses for static pages must be the same for any router state. If they are not, stop and
report before building the rest.

### Expected CPU per route (Workers Free; estimates until measured)

| Route | Today ok-p50 (02-CPU-REPORT) | After: cache hit | After: front-cache miss, ISR hit | After: full render (rare) |
|---|---|---|---|---|
| /en, /ar (308) | 42 / 59 ms | ~1-3 ms | proxy only ~10-20 ms | n/a |
| /portfolio, /about, /support, /privacy, /terms, /legal/* | 38-73 ms | ~1-3 ms | ~10-20 ms | 40-100 ms warm |
| /browse, /watch (home) | 35 / 93 ms | ~1-3 ms | ~10-20 ms | 40-180 ms |
| /series/<slug> (en, ar) | 61 / 74 ms | ~1-3 ms | ~10-20 ms | 60-130 ms |
| /watch/<episode> | not measured | ~1-3 ms | ~10-20 ms | ~60-150 ms |
| /auth (signed out), /updates, /coming-soon | 42-48 ms | ~1-3 ms | ~10-20 ms | 40-70 ms |
| /my-list, /profile (signed in) | not measured | ~1-3 ms | ~10-20 ms | 40-100 ms |
| /admin/*, admin server actions | not measured | not cached | — | 50-300+ ms (stays over 10 ms) |
| contact / player-error actions, /auth/callback, /api/*, crons | — | not cached | — | over 10 ms, rare |

Hits should be the bulk of traffic. Misses happen once per path x class x RSC kind after a deploy
(warm-up covers them) and after an admin save (stale copy served meanwhile).

### Effort

About 6-8 working days of session time: locale 0.5; header 0.5; personal data to the browser 2-3;
static/ISR + interception 1-1.5; front cache extension + warm-up 1-1.5; tests, local preview
measurement and Playwright 1. Lands as one PR to main (after #29, now merged).

### Risks

1. Admin pages stay dynamic and over 10 ms. Two admins working steadily can hit 1102 errors;
   Free's tolerance is not documented. Only Workers Paid or an admin rewrite fixes that.
2. Misses still cost 40-900 ms. First views after a deploy need the warm-up, and an unwarmed
   page can answer 1102 once.
3. RSC and segment-prefetch keys (the spike). If static payloads still vary by router state,
   client navigation misses and goes over 10 ms.
4. `enableCacheInterception` skips the proxy for ISR hits: gates must still hold. Gate tests run
   with it on, and gate redirects are cached per auth class.
5. Visible: placeholders for signed-in state (pictures 1-3), resume waits ~0.1-0.3 s, phone hero
   may show its poster briefly, admin edits take ~10 s to appear.
6. The cache never holds personal data: keys carry only build, class and path; the `sb-`
   cookie only picks the class. A forged `sb-` cookie gets the signed-in shell with no data
   (RLS).
7. Free quotas: R2 class A/B and D1 reads stay far below free limits at today's traffic;
   requests still count against 100k/day.

### Pictures for the signature

`.planning/debug/cpu-public-cache-mockup.html`: header (signed out, signed in, admin; EN and AR),
show-page buttons and progress, Continue watching rail; before and after with options A/B.
Recommended: 1A empty avatar circle, 2A grey placeholders, 3A placeholder row.

GSD: this is phase-sized; `/gsd-phase` (insert a decimal phase after 2) then
`/gsd-plan-phase`, so it gets discuss, plan and UAT gates. Jev: a small typed
"cacheable / bypass" decision per request is plain code, so Jev adds nothing here. Automation:
a post-deploy warm-up and CPU-sample agent (tail + measure-routes) that reports p95 per route.

## Addendum for the controller (2026-10-21): prototype, remaining routes, risks

### (1) What e49a219 does, in plain words (prototype; nothing merges or deploys before the signature)

The Worker keeps a copy of six signed-out page types (/<locale> 308, /portfolio, /about,
/support, /privacy, /terms, EN and AR) and answers from it before the proxy and Next.js
run. The copy lives 120 s, in the edge cache, with R2 as backup. It is kept twice, once for
phones and once for desktops, because the hero picks its video by device. That uses the same
detection as today, so there is no visible difference. Visible effect: an admin edit takes up
to 120 s to reach signed-out visitors of those pages. Every answer it touches carries
`x-clickit-cache` (HIT-EDGE, HIT-R2, MISS); bypassed requests carry nothing.
Picture: section 0 of `.planning/debug/cpu-public-cache-mockup.html`.

### (2) Routes the prototype does not cover

| Route | Today (02-CPU-REPORT ok-p50) | Signed out | Signed in | How it gets under 10 ms |
|---|---|---|---|---|
| /en/auth, /ar/auth | 42 / 48 ms | cacheable (public form; Turnstile runs in the browser) | proxy already sends signed-in visitors on; that redirect is cached per class | add to the list; key also on `?next=` but only when it passes `getSafeAuthNextPath` (other values render and are not stored) |
| /series/<slug> | 61 / 74 ms | cacheable once the page stops reading the session and User-Agent | needs the hybrid: static show, list/like/progress from the browser | static/ISR + front cache, both classes |
| /watch (home), /watch/<episode> | 93 ms / not measured | when sign-in skip is on: cacheable; when off: the gate 307 to /auth, cached per class | hybrid: static page, Continue watching / list / like / resume position from the browser (writes already are) | static/ISR + front cache, both classes |
| /browse | 35 ms | it only redirects to /watch (keeps `?category=`), from inside a page render | same | move the redirect into the proxy (like d43fd90) and cache it; key on `category` |
| /updates | 48 ms | not public: the gate sends signed-out visitors to /auth (307, cacheable per class) | prefill of the email moves to the browser; page cached for the signed-in class | front cache, signed-in class |

Signed-in on Free: the limit is per request, not per visitor. A signed-in render costs the same
40-150 ms, and Free started refusing requests after about 2 minutes of steady traffic. Viewers
watching shows are the core use, and with sign-in skip off every watch page is signed-in. So
signed-in pages must be cached too, and the hybrid (shared cached shell + personal data fetched by
the browser straight from Supabase under RLS) is worth it: it is the only way the signed-in
routes fit, and it costs no Worker CPU because those reads never touch the Worker. Without
it, show, episode and watch-home requests from signed-in viewers stay at 40-150 ms and get 1102
under load. Admin is the exception: it stays rendered, over 10 ms (2 users).

### (3) Risks

- **Stale content.** Prototype: up to 120 s after an admin save. Plan: freshness compares the
  copy with the last revalidation OpenNext writes to D1 on every save (`updateTag` /
  `revalidatePath`, already in the admin actions), read at most every 10 s per Worker
  instance. Edits show within ~10 s, and the old copy is served while the new one renders.
  Content with no save (scheduled publish at 01:00) relies on that cron's own revalidation:
  check it during the build.
- **Cache poisoning.** The key holds only build, class, device and path, plus allowlisted,
  sanitised params (`next`, `category`). The Host cannot be spoofed, because Cloudflare routes by
  host. Anything else in the request that changes the HTML would poison the copy. Known ones:
  User-Agent (keyed by device), the NEXT_LOCALE cookie (only stored when it equals the URL locale),
  Accept-Language (changes only the cookie, which is never stored). Router/action headers bypass.
  The plan adds a test that renders one URL with varied headers (language, cookie, UA, forwarded
  host, `next-url`) and requires identical text before a route is allowed into the cache. Only
  200 HTML and 308/307 are stored; any Set-Cookie other than NEXT_LOCALE blocks storing.
- **A signed-in user getting a signed-out copy.** The prototype bypasses on any `sb-` cookie,
  which also covers the chunked `.0/.1` and the PKCE code-verifier cookies. The plan keys on that
  class instead, so the signed-in copy never contains signed-out UI. Browsers and Cloudflare's
  CDN never store the page: visitors keep `cache-control: private, no-store`. A forged `sb-`
  cookie gets the signed-in shell, with no data (RLS).
- **RTL / locale mixups.** The locale is in the path and the key; `lang`/`dir` come from the
  `[locale]` segment. The prototype refuses to store a render whose cookie locale differs from
  the URL. The plan moves every cookie-locale read to the URL locale and adds a store guard: the
  body must contain `lang="ar" dir="rtl"` for /ar and `lang="en" dir="ltr"` for /en, or it is
  not stored.
- **R2 lifecycle rule (live step for Koss, after the first deploy with the cache).** Old builds
  leave copies under `anon-html/`. One numbered step in his terminal:
  1. `HOME=/Users/koss/.clickit-cloudflare npx -y wrangler@4.151.2 r2 bucket lifecycle add clickit-next-cache anon-html-expiry anon-html/ --expire-days 7`
  Expected: the rule is listed by `... r2 bucket lifecycle list clickit-next-cache`. Seven days,
  not one, so copies of the live build that nobody refreshed are not deleted every day.
- **R2 and D1 cost on Free** (R2 pricing page, updated 2026-10-01: 10 GB, 1M Class A,
  10M Class B per month; delete is free; D1 5M reads / 100k writes per day). A hit reads R2 only
  when the edge cache misses; on workers.dev the edge cache may never hold, so every hit is
  one Class B read. Workers Free caps requests at 100k/day, so at most ~3M Class B per month:
  under 10M. Writes (Class A) happen once per miss. With the prototype's 120 s life, 24 keys x
  720 refreshes/day is about 0.5M per month in the worst case, under 1M. With the plan's
  save-based freshness, writes happen only after a deploy or a save. Storage is a few MB. D1: one
  small read per Worker instance every 10 s.
