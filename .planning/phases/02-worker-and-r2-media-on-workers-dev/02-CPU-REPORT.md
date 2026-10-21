# Phase 2 CPU report (plan 02-21)

Status: **signed-out pass done 2026-10-21; signed-in admin/viewer rows and the media Worker rows are still open** (they need RUNBOOK Step 34, Koss's "approve measurement sign-ins", and the two cookie files from `make-session-cookie.mjs`).

## Method (signed-out pass)

- Date 2026-10-21, 13:52–14:01 CET. Deploy measured: app Worker `clickit` version `0c24ae10` = commit d7b59d6 (deployed 2026-10-20 23:29 CET). Read-only, signed out, no DB writes.
- `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4.151.2 tail clickit --format json --ip self`; field paths from 02-SPIKE.md (`cpuTime`, `wallTime`, `outcome`, `event.response.status`).
- 14 routes. One tagged warm-up hit each (`?m=warm`, excluded), then 12 rounds **interleaved** across all routes (`?m=r1`..`r12`), 1 s apart, so no route absorbs the isolate warm-up. (The Task 4 sample ran `/en` first, ten times in a row: its 507 ms p50 was mostly isolate warm-up, not `/en`.)
- Percentiles: nearest-rank, over `outcome: ok` events only. `exceededCpu` events are cut at 10 ms by the platform and answer 503, so they are counted separately.
- 198 events; 2 curl attempts failed client-side. The tail JSONL was deleted after extraction; no IP is written.

## Signed-out routes (Workers Free)

| route | n | ok | exceededCpu (503) | CPU p50 (ok) | CPU p95 (ok) | CPU max (ok) | wall p50 (ok) |
|---|---|---|---|---|---|---|---|
| /en | 12 | 10 | 2 | 42 | 104 | 104 | 367 |
| /ar | 11 | 5 | 6 | 59 | 79 | 79 | 334 |
| /en/portfolio | 12 | 8 | 4 | 70 | 108 | 108 | 447 |
| /ar/portfolio | 12 | 10 | 2 | 73 | 147 | 147 | 474 |
| /en/browse | 11 | 10 | 1 | 35 | 79 | 79 | 519 |
| /en/series/<slug> | 12 | 11 | 1 | 61 | 120 | 120 | 829 |
| /ar/series/<slug> | 12 | 10 | 2 | 74 | 128 | 128 | 859 |
| /en/watch | 12 | 8 | 4 | 93 | 177 | 177 | 707 |
| /en/auth | 12 | 6 | 6 | 42 | 64 | 64 | 373 |
| /ar/auth | 12 | 9 | 3 | 48 | 573 | 573 | 378 |
| /en/about | 12 | 6 | 6 | 38 | 59 | 59 | 362 |
| /en/support | 12 | 8 | 4 | 42 | 107 | 107 | 398 |
| /en/privacy | 11 | 7 | 4 | 46 | 73 | 73 | 493 |
| /en/updates | 12 | 10 | 2 | 48 | 738 | 738 | 549 |

**Free verdict: fail.** From about 2 minutes into steady traffic the platform started enforcing the 10 ms limit: 47 of 179 measured requests ended `exceededCpu` and answered **503** (Error 1102). Every route fails, including the simplest (`/en/about`, ok-p50 38 ms). Cheapest successful request seen: 4 ms.

## Where the CPU goes (first findings)

1. **Locale root double render (fixed in d43fd90, not deployed).** `/en` and `/ar` called `permanentRedirect()` after the layout had started streaming: the Worker rendered the whole layout (117 KB on `/en`), returned 200 plus a meta refresh, and the browser then rendered `/portfolio` a second time. The proxy now answers a real 308 before any render.
2. **Every page is dynamic.** All routes answer `cache-control: private, no-cache, no-store` with no `x-nextjs-cache` header: nothing is served from the R2 incremental cache, and every hit runs the proxy (next-intl, Supabase session refresh, `getAppConfig`) plus a full React server render of 120–330 KB of HTML and RSC payload. That base cost alone is 30–40 ms on the lightest page.
3. **Implication:** small code trims will not reach 10 ms. Getting under the Free limit needs cached rendering for public pages (static or ISR output served through `enableCacheInterception`, which is off today), and that means taking per-request reads (session, cookies) out of the shared layout for signed-out visitors. That is a restructure with UX risk (header/avatar state), not a quick fix.

## Still to measure

- Signed-in: `/en/admin`, show and episode pages as a viewer (Step 34 + cookies).
- Media Worker: an image with `?w=1280` and `Accept: image/avif`, and the hero MP4 with `Range: bytes=0-1023`.
- Cron runs (local estimate with `wrangler dev --test-scheduled`).
- Daily views against the 100k/day request budget: Web Analytics is not set up (Step 22 skipped), so today's views are unknown.
