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

## Prototype fix (e49a219, kept on the branch; superseded by plan v2 below)

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

## Plan v2: cached public pages on Workers Free (after the independent review; for Koss's signature, no code until signed)

v1 and its addendum are replaced by this section. The independent review (Sonnet) verdict was
"sound with changes"; each required change is marked [R1]-[R9].

### Goal [R4]

Every **public page** answers under 10 ms CPU on Workers Free, signed out and signed in: locale
roots, portfolio, about, support, privacy, terms, legal, auth (signed out), watch home, show
pages, episode pages, browse, updates, my-list, profile, coming-soon.
**Out of scope, stays over 10 ms:** /admin/* and admin server actions, the viewer server actions
(contact, player-error), /auth/callback, /api/*, crons.

### Options for Koss [R9] (prices and facts read 2026-10-21)

| | What | Monthly cost | Effort | Still over 10 ms after | Visible change |
|---|---|---|---|---|---|
| A | Zone Cache Rule (bypass on `sb-` cookie, edge TTL, purge by API) | $0 | — | **not possible**: zone cache rules apply to proxied origin requests and `fetch()` subrequests; "Cloudflare Workers run before the cache", so the Worker's own HTML is never cached by them (developers.cloudflare.com/workers/reference/how-the-cache-works/). Free cache keys can vary by device ("Cache by device type", no plan restriction listed, cache-rules/settings, updated 2026-10-15), but that does not help here. | — |
| A2 | **Workers Cache** (launched 2026-07-06, "available today to every Worker on any plan", blog.cloudflare.com/workers-cache/): a cache in front of the Worker; "cache hits do not consume CPU time" (developers.cloudflare.com/workers/cache/) | $0 | only as the cache layer under C (pages are per-visitor today, and any `Set-Cookie` bypasses it) | — | — |
| B | **Workers Paid**: "$5 USD per month for an account", 10 million requests and 30 million CPU ms included, then $0.30 per extra million requests and $0.02 per extra million CPU ms; CPU limit 30 s per request by default (developers.cloudflare.com/workers/platform/pricing/, last updated 2026-10-02) | $5 at today's scale (30M CPU ms covers ~500k renders/month at 60 ms; traffic not measured, Web Analytics off) | none in code; Koss subscribes in the dashboard | nothing (limit becomes 30 s) | none |
| C | **This plan**: gateway + Workers Cache + user-independent pages | $0 | 8-9 session days | admin, actions, /auth/callback, /api, crons (out of scope); a fill (miss) runs in its own invocation and can still 1102 | pictures 1-3, utm dropped on the locale-root hop |

### Design (C)

1. **Gateway** = the default `fetch` entrypoint, with Workers Cache off. It runs on every request
   (~0.5-2 ms, estimate) and decides:
   - **Hard deny** [R1]: `/admin*`, `/<locale>/admin*`, `/auth/callback`, `/api/*`, non-GET/HEAD,
     any `next-action` header, and `/<locale>/auth*` for a signed-in visitor. These go straight
     to OpenNext and are never cacheable.
   - **Bare `/` and unprefixed paths** [R3]: the gateway answers a 307 to `/<locale><path><query>`.
     The locale is the NEXT_LOCALE cookie if it is en/ar, else the Accept-Language negotiation,
     else en. No proxy, not cached. Excluded: `/api`, `/auth/callback`, `/_next`, files with an
     extension, sitemap.xml, robots.txt.
   - **Visitor class, verified** [R1]: it rebuilds the Supabase auth cookie (chunked `.0/.1`,
     `base64-` prefix) and verifies the JWT locally (ES256, JWKS from the project, cached per
     isolate; same check as `getClaims()`).
     - Valid -> `user`.
     - Auth cookie present but invalid, expired or unverifiable -> bypass to OpenNext (the proxy
       refreshes or clears it).
     - Only the `sb-…-code-verifier` cookie, or no auth cookie -> `anon`.
     - Cookie presence alone never makes `user`.
   - **Key** [R5]: `cf.cacheKey = /__c/<class>/<rsc-kind>/<segment-prefetch>/<path>?<allowlisted params>`.
     - `_rsc` is stripped.
     - `utm_*`, `fbclid`, `gclid` and `msclkid` are removed from the URL itself before the
       render, so no cached body or Location carries a visitor's query (fixes the e49a219 308
       bug).
     - `next` (auth) and `category` (browse) are kept only when they pass the same sanitizers
       as the pages; other values bypass.
     - No device part: the hero picks its media in the browser.
   - It **strips** `Cookie`, `Authorization` and `Accept-Language` before calling the cached
     entrypoint, and sets `x-clickit-class: user|anon` (any copy on the incoming request is
     dropped). The render physically cannot see who is visiting, so no personal data can enter a
     shared entry. The proxy's gates read only that class header on this path.
2. **Cached entrypoint** = OpenNext behind `ctx.exports`, with Workers Cache on.
   - Cacheable responses carry `Cache-Control: max-age=<long>, stale-while-revalidate,
     stale-if-error` plus `Cache-Tag`.
   - Everything else returns `no-store`.
   - The class `user` never stores redirects [R1]; gate 307s are cached only for `anon`.
3. **Fill success on Free** [R2]:
   - Fills run in the cached entrypoint's own invocation, so the gateway stays under 10 ms even
     on a miss.
   - Content changes use `ctx.cache.invalidate()` (mark stale), not purge. Visitors keep getting
     the last good copy until a refill succeeds, and `stale-if-error` covers a refill that ends
     in 1102. The copy is served stale indefinitely.
   - Public pages are prerendered at build (`generateStaticParams`; ISR in the R2 incremental
     cache, populated at deploy on the build machine, not in a Free invocation), so most fills
     are a cache read plus the proxy, not a render.
   - Workers Cache keys include the Worker version and "pre-warming is not available". The
     controller runs a seeding script after each deploy: every URL x class x locale, retried
     until it is served from the cache.
4. **Freshness** [R6]:
   - Invalidation is by content tags only: `site-config`, `shows`, `episodes`, `shorts`,
     `seasons`, `categories`, and the FAQ/legal `revalidatePath` calls.
   - `profile/actions.ts` (`revalidatePath('/profile')`) does not invalidate anything shared.
   - The coming-soon toggle (`updateFeatureFlags` -> `bumpSiteConfigCache`: `updateTag('site-config')`
     + `revalidatePath('/', 'layout')`) **purges** instead of invalidating, so the cached 307s and
     pages switch on the next request.
   - Purges and invalidations are debounced: Workers Cache uses Free purge limits, 5 tag requests
     a minute per account.
   - A test walks the import graph of every cached route and fails on `cookies()`, `headers()`
     or the server Supabase client.
5. **User-independent pages**: the reads in the map below move to the browser or to the URL
   locale (pictures 1-3).
6. **Session refresh** [R7]:
   - Hits skip the proxy's token rotation. The browser client (`createBrowserClient`,
     auto-refresh) refreshes before expiry and rewrites the cookie.
   - An expired JWT bypasses to the proxy, which refreshes it, about once an hour per user.
   - Race covered by a long-session test: local Supabase with a 60 s JWT, two tabs, 15 minutes
     of mixed cached and bypassed pages. The user must stay signed in, with no
     `refresh_token_already_used`.
7. **Prototype e49a219** is replaced by 1-2. Its tested rules (targets, locale cookie,
   storability) are reused. If the spike rejects Workers Cache, the prototype's Cache API + R2
   tier is the fallback; then the R2 lifecycle step and cost below apply.

### Reads that make public pages per-visitor today (map, unchanged from v1)

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


### Spike first [R8]; stop and report if any part fails

a. RSC and segment-prefetch payloads for each cached route are identical across
   `next-router-state-tree` and `next-url` (Next 16.4.2, OpenNext 1.20.12, local preview diff).
b. Fill success rate on Free:
   - workers.dev now runs main 787ca3a (version 7222dcee); read-only GETs, about 30 fills per
     route type, about 1 request/s.
   - Record ok vs 1102 for a render and for an ISR read (02-CPU-REPORT had 47/179 at 1102).
c. Forged/expired cookie and poisoning tests below, against the local preview.
d. The wrangler warning "DurableObjectNamespace … DOQueueHandler … no such class is exported"
   shows on every deploy, even though custom-worker.ts re-exports it. Check:
   - whether ISR revalidation through `NEXT_CACHE_DO_QUEUE` really runs on workers.dev (a static
     test page with a short `revalidate`; tail shows the DO invocation and the R2 entry changes);
   - fix the export if not.
e. Workers Cache on the ClickitStory Free account (a controller deploy to workers.dev):
   - `cache.enabled` is accepted;
   - a hit shows no Worker CPU in tail;
   - gateway -> `ctx.exports` with `cf.cacheKey` works;
   - `invalidate`/`purge` by tag works from a server action;
   - whether hits and the gateway->cached call each count toward the 100k requests/day.

### Named tests [R1, R5, R6]

- Forged `Cookie: sb-x=1` -> anon; a JWT signed with another key -> bypass. Neither ever gets
  the user shell or a cached /watch/<episode> body.
- Expired JWT with a valid signature -> bypass to the proxy (refresh); the response is not cached.
- Code-verifier cookie only -> anon.
- Admin and non-admin signed in -> the same viewer shell; `/admin*` is never cached for either;
  the Admin menu entry comes from the browser.
- No redirect stored in class `user`. Anon 307s are stored, and the coming-soon toggle purges them.
- Hard-deny list -> always OpenNext, `no-store`.
- Poisoning: the same URL with varied Accept-Language, Cookie, User-Agent, X-Forwarded-Host,
  Forwarded and Next-Url gives an identical body before a route joins the cache.
- RTL: a stored /ar body has `lang="ar" dir="rtl"`, a stored /en body `lang="en" dir="ltr"`.
- `/` and unprefixed paths: 307 by cookie, then Accept-Language, then en; not cached; proxy not
  invoked.
- `_rsc` is stripped; utm is absent from stored bodies and Location headers.
- Import graph: no `cookies()`/`headers()`/server Supabase client in cached routes.
- A profile action does not invalidate shared entries; a content action does.
- The long-session refresh test (design 6).

### Expected CPU per route (estimates until the spike measures them)

| Route | Today ok-p50 (02-CPU-REPORT) | Hit | Miss (fill, own invocation) |
|---|---|---|---|
| /, unprefixed paths | proxy 307 | gateway 307, ~0.5-1 ms (never cached) | — |
| /en, /ar (308) | 42 / 59 ms | gateway ~0.5-2 ms, cache 0 | proxy only, ~10-20 ms |
| portfolio, about, support, privacy, terms, legal, coming-soon | 38-73 ms | ~0.5-2 ms | ISR read ~10-20 ms; render 40-100 ms |
| /auth (signed out) | 42 / 48 ms | ~0.5-2 ms | ~10-20 ms / 40-70 ms |
| watch home, browse | 93 / 35 ms | ~0.5-2 ms | ~10-20 ms / 40-180 ms |
| show, episode | 61-74 ms / not measured | ~0.5-2 ms | ~10-20 ms / 60-150 ms |
| updates, my-list, profile (user class) | 48 ms / not measured | ~0.5-2 ms | ~10-20 ms / 40-100 ms |
| admin, actions, /auth/callback, /api, crons | 50-300+ ms | out of scope | — |

### Effort

8-9 session days:
- spike 1-1.5;
- gateway, JWT verification and unprefixed redirects 1.5;
- user-independent pages 3;
- ISR, tags and invalidation 1;
- the named tests, long-session test and seeding script 1.5.
One PR to main.

### Risks

- Workers Cache is three months old. The Free docs do not say whether hits and the
  gateway->cached call count toward 100k/day (the gateway call may double it); the spike reads
  this.
- Fills can still 1102 on Free. Stale copies hide that after the first fill, but the first view
  after a deploy depends on seeding.
- Every deploy starts the cache cold (version in the key).
- Visible: pictures 1-3; utm dropped on the `/en` -> `/en/portfolio` hop; admin edits show
  after one refill instead of at once; coming-soon switches at once.
- If the spike falls back to the prototype tier:
  - R2 lifecycle, Koss's live step after the first deploy:
    `HOME=/Users/koss/.clickit-cloudflare npx -y wrangler@4.151.2 r2 bucket lifecycle add clickit-next-cache anon-html-expiry anon-html/ --expire-days 7`.
  - R2 on Free (pricing page updated 2026-10-01): 1M Class A, 10M Class B, 10 GB per month,
    delete free. Reads are capped by 100k requests/day, so at most ~3M Class B a month.
  - Writes happen once per fill.

### Pictures

`.planning/debug/cpu-public-cache-mockup.html`:
- section 0, request flow;
- sections 1-3, before/after for the header, show page and Continue watching, EN and AR,
  options A/B. Recommended: 1A, 2A, 3A.

Next step: `/gsd-phase` (insert a decimal phase after 2), then `/gsd-plan-phase` with the spike
as plan 1. Jev: no fit. Automation: a post-deploy seeding and CPU-sample agent.
