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
