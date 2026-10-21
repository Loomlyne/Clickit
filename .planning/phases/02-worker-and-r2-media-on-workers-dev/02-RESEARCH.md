# Phase 2: Worker and R2 Media on workers.dev - Research

**Researched:** 2026-10-20
**Domain:** Next.js 16 on Cloudflare Workers (OpenNext), R2 media Worker, direct-to-R2 uploads, Turnstile, cron, Workers Free limits
**Confidence:** MEDIUM-HIGH (versions, limits, R2/Worker APIs verified against current docs and npm; a few items are LOW and listed in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Signed by Koss 2026-10-19 (do not re-ask):
- **D-01 Order:** Phase 01.1 (admin actions hardening) finishes and lands on main first. Phase 2 is planned in parallel and executes only after 01.1 has landed. The Phase 2 execution branch is cut from the `main` that carries 01.1, because both phases touch the upload paths in `src/app/[locale]/admin/actions.ts`.
- **D-02 Workers Free first:** build and run on Workers Free. Measure CPU ms per route on `workers.dev` and record it. Workers Paid ($5/month) comes back to Koss as a priced question only if Free fails, with the measured numbers. No paid feature (Workers Paid, Images Paid, Image Transformations beyond free, R2 beyond free) is enabled without his priced OK.
- **D-03 Images:** every image (and hero/preloader video) moves to R2 in this phase, optimized. Optimize at copy time, locally, with `sharp` in a Node script (WebP and AVIF variants plus the untouched original). Cloudflare Image Transformations are not used. Serve from R2 through a Worker R2 binding on `workers.dev` until the `media.clickitstory.ae` custom domain exists (Phase 3 path). Never set `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` in any build until the media host serves every file in the copy report. Database rows are not rewritten in this phase. Any live-DB write needs Koss's approval as one numbered step.
- **D-04 Deploys:** local wrangler only. No GitHub Actions deploy token, no Workers Builds. Every wrangler command runs with `HOME=/Users/koss/.clickit-cloudflare`, and `wrangler whoami` must show the ClickitStory account (`e329b099...`) before it. Never the default (Vamos) login. `wrangler.jsonc` pins `account_id`.

Signed by Koss 2026-10-20:
- **D-05 Goal:** "remove deployment from Vercel, move it to Cloudflare with the images." Vercel removal happens at the END, after the Cloudflare site is proven live on www. The roadmap edits that make this one path are proposed in CONTEXT for Koss to sign; nothing is moved silently.

Derived for this phase (recorded in CONTEXT so plans follow one line):
- Separate media Worker `clickit-media` with only the `MEDIA` R2 binding; serves `GET/HEAD /<bucket>/<key>` with Range, ETag, long Cache-Control, nosniff, restrictive CSP on SVG; own workers.dev origin; keeps the `bucket/key` layout.
- Variants and loader: WebP at 640/1280/1920 (never upscaled) plus AVIF at the same widths from the copy script; custom `next/image` loader picks the nearest variant on the media origin; YouTube hosts pass through; missing variant falls back to the original.
- New uploads: browser -> presigned PUT -> R2 (aws4fetch in the Worker, R2 token scoped to the media bucket) -> finalize (`MEDIA.head`, prefix and type check) -> DB write. Browser makes WebP variants via canvas; AVIF only from the copy script. SVG stays rejected (Phase 1.1 D-03).
- Crons ship off: `scheduled()` and `/api/cron/*` wired and tested locally; `triggers.crons` empty on the workers.dev deploy.
- Supabase CAPTCHA stays off in this phase; Turnstile widget and token passing ship now; contact and newsletter verify their own token with siteverify now.
- UAT split: write paths on `opennextjs-cloudflare preview` against a local Supabase stack; workers.dev talks to live Supabase, so read paths, sign-in, and at most one owner-approved write on a draft test show.
- Media Worker request budget: every media request counts toward the 100k/day Workers Free requests; recorded in the CPU/limits report.

### Claude's Discretion
File layout under `src/server/*`, variant key naming, exact widths and quality, loader implementation, how CPU ms are collected (Workers Logs / `wrangler tail`), test structure, and the exact wording of runbook steps, all inside the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- Email queue, Resend app emails, Supabase SMTP (Phase 5).
- Cloudflare Image Transformations or the `IMAGES` binding: only on a priced OK from Koss.
- Cache purge integration / `doShardedTagCache`: only at higher traffic.
- Also out of scope here: NS change and DNS records, rewriting media URLs in live DB rows, switching www to the Worker, deleting the Vercel project, YouTube import (Phase 6).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | App builds and runs on Workers (OpenNext) in ClickitStory account, Next 16.3.8+ | Floor is now **16.4.1** (OpenNext 1.20.12 peer). Use `next@16.4.2`. See Standard Stack, Pattern 1 |
| PLAT-02 | Route gates work on Workers | `proxy.ts` Node middleware is supported (experimental) since OpenNext 1.20.3; spike first, edge `middleware.ts` is the fallback. Pitfalls 1, 2 |
| PLAT-03 | Admin edit visible within 10 s | R2 incremental cache + D1 tag cache + DO queue; no `bypassTagCacheOnCacheHit`. Pattern 1 |
| PLAT-04 | Scheduled publish and cleanup from Cron Triggers | Custom worker `scheduled()` -> `handler.fetch`; `crons: []` on deploy. Pattern 5 |
| PLAT-05 | Turnstile on sign-in, sign-up, contact, newsletter; BotID gone | Supabase ignores `captcha_token` when CAPTCHA off (source-verified). Pattern 7 |
| PLAT-06 | Cloudflare Web Analytics; Vercel analytics gone | Manual beacon; workers.dev hostname support unconfirmed (LOW). Pattern 8 |
| PLAT-07 | Rate limits on `CF-Connecting-IP`, fail closed, constant-time cron secret | Keep Supabase `rate_limits`; hash-then-`timingSafeEqual`. Pattern 6 |
| PLAT-08 | Deploy from local wrangler after gate and Koss's Ship (reworded in CONTEXT edit 4) | D-04 flow; `wrangler whoami` first. Environment section |
| PLAT-09 | Free first; CPU per route measured | Measurement method and table template in Pattern 9 |
| MEDIA-01 | Uploads go browser -> R2 | Pattern 4 (presign/finalize), CORS JSON, CSP connect-src |
| MEDIA-03 (copy part, pending signature) | Copy all Supabase objects to R2 with checksums + variants | Pattern 3 (extend copy script) |
| MEDIA-04 (reworded) | Pre-optimized variants served from R2; original fallback | Patterns 2, 3, 4 |
| MEDIA-05 | Hero MP4s fast-start, play on Safari/Chrome/mobile | Faststart check + Range/206 in media Worker. Patterns 2, 3 |
| MEDIA-06 | SVG cannot run script | Rejected on upload (1.1); CSP + nosniff on any SVG served; magic-byte check at finalize |
| PLAT-10 (code part, pending signature) | Vercel code removal | Code Scan section 1 list; Don't Hand-Roll / Pitfall 11 |
</phase_requirements>

## Summary

The stack moved since 2026-10-04. `@opennextjs/cloudflare` is now **1.20.12** and its peer range requires **Next >=16.4.1** (the old 16.3.8 floor is gone). Next published an out-of-band security release on 2026-10-14 (16.4.1; critical `use cache` RCE, critical SVG image-optimizer RCE via `sharp` < 0.35.5, high DoS in Server Actions). The repo uses Server Actions heavily, so the DoS fix matters. Target `next@16.4.2` (npm `latest` today), `react`/`react-dom` 19.2.9 (patched React line), `sharp >= 0.35.5`, `wrangler 4.151.2`. `proxy.ts` (Node middleware) is still flagged experimental, with open bugs about bundle size (about 4.6 MB for a no-op handler, issue #1373) and instrumentation, so the spike-first plan stands and edge `middleware.ts` stays the documented fallback.

The honest Workers Free forecast: 10 ms CPU per request is very tight for React SSR plus `proxy.ts` (next-intl, `getClaims`, `getAppConfig`) on every request, and 50 subrequests per request include every R2, D1 and Supabase call. Cloudflare itself says SSR typically uses 10-20 ms. D-02 already handles this: build on Free, measure, and bring Koss the numbers. Plan the measurement as a first-class deliverable, and make no code change whose only purpose is to squeeze under 10 ms before the numbers exist.

The media design holds with three refinements. (1) Use one URL per image (`<origin>/<bucket>/<key>?w=<width>`) and let the media Worker negotiate AVIF/WebP from the `Accept` header with `Vary: Accept`, falling back to the original. (2) Safari cannot encode WebP from canvas (caniuse, through Safari 26.5), so browser-made variants will be missing for Safari admins; the original-fallback rule therefore has to stay permanently, not just as a migration aid. This also means the Phase 3 custom domain should front the media Worker, not a bare R2 custom domain, or variants and fallback are lost. (3) Presigned PUT cannot cap size, so finalize must HEAD, check magic bytes and delete bad objects.

**Primary recommendation:** Upgrade to Next 16.4.2 + OpenNext 1.20.12 first, run the `proxy.ts` spike and a Free-plan "hello" deploy to learn real CPU and bundle numbers before building the rest; keep media in its own tiny Worker with `Accept` negotiation and permanent original fallback.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route gates (auth, admin, coming-soon, locale) | Frontend Server (`proxy.ts` in the Next Worker) | - | Needs Supabase cookies and app config; today's behaviour |
| ISR/data cache and tag invalidation | Database / Storage (R2 cache bucket + D1 tags + DO queue) | API / Backend | OpenNext overrides; admin actions call `revalidatePath`/`updateTag` |
| Media serving (Range, 304, variant negotiation, SVG CSP) | CDN / Static tier = separate `clickit-media` Worker + R2 | - | Keeps media off the Next Worker's CPU and subrequest budget |
| Image variant creation (existing objects) | Local Node script (sharp) | - | sharp cannot run on workerd |
| Image variant creation (new uploads) | Browser (canvas WebP) | - | No server image library; Safari yields original only |
| Upload authorization (presign, finalize) | API / Backend (Server Action) | Browser (PUT), R2 | Signing needs secrets; finalize validates via `MEDIA.head/get` |
| Cron jobs | API / Backend (custom worker `scheduled()` -> in-process Next route) | - | `revalidatePath/updateTag` need a Next request context |
| Turnstile widget | Browser | API (siteverify for contact/newsletter), Supabase (auth, later) | Token is single-use |
| Rate limiting | API / Backend + Supabase `rate_limits` table | - | No new live migration; keyed on `CF-Connecting-IP` |
| Web Analytics | Browser (beacon) | - | Manual snippet; no server work |
| next/image URL building | Browser + SSR (custom loader, pure function) | - | Loader runs in both |

## Standard Stack

### Core
| Library | Version (npm, 2026-10-20) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | **16.4.2** (floor 16.4.1) | Framework | OpenNext 1.20.12 peer `>=16.4.1`; 16.4.1 fixes three advisories [VERIFIED: npm registry; CITED: nextjs.org/blog/nextjs-security-update-october-14-2026] |
| `react`, `react-dom` | **19.2.9** (repo pins 19.2.4 exact) | UI | Patched React line named in the Next advisory; 19.2.9 exists on npm [VERIFIED: npm registry; CITED: nextjs.org blog] |
| `@opennextjs/cloudflare` | **1.20.12** (2026-10-15) | Adapter | Adds Next 16.4 support; peers `wrangler ^4.148.0` [VERIFIED: npm registry; CITED: OpenNext CHANGELOG] |
| `wrangler` (dev) | **4.151.2** (2026-10-19), Node >= 22 | Deploy, bindings | Peer of adapter [VERIFIED: npm registry] |
| `aws4fetch` | 1.0.20 (2024-08-28, stable) | Presign R2 PUT in Worker | Named in Cloudflare's own R2 docs [CITED: developers.cloudflare.com/r2/examples/aws/aws4fetch] |
| `@marsidev/react-turnstile` | **1.6.2** (2026-10-11; STACK.md said 1.6.1) | Turnstile widget | Used in Supabase's CAPTCHA guide [CITED: supabase.com/docs/guides/auth/auth-captcha] |
| `sharp` | **>= 0.35.5** (latest 0.35.5) | Copy-script variants (devDependency only) | 0.35.5 is the advisory's workaround floor [CITED: nextjs.org blog] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | 2.118.0 | Supabase client | Required >=2.114 if `@supabase/ssr` 0.12.x |
| `@supabase/ssr` | 0.12.7 (repo has ^0.10.0) | Cookies | Optional bump. 0.12.x notes: no breaking changes listed, cache-header and cookie-deletion fixes [CITED: github.com/supabase/ssr/releases]. Recommend NOT bundling this bump into the first Worker spike; do it after gates pass, as its own task |
| `next-intl` | 4.14.9 | i18n | Peer covers Next 16 [VERIFIED: npm] |
| `@aws-sdk/client-s3` | already 3.x | Node scripts only | Move to `devDependencies`; remove from `src/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase `rate_limits` table | D1 | D1 adds a binding and a new schema; Supabase table already exists, so no new live migration |
| Presigned PUT (aws4fetch) | `MEDIA.put` through a Worker route | Violates MEDIA-01 (bytes through the Worker) and Free CPU/body limits |
| Browser canvas WebP | wasm WebP encoder in browser (e.g. jSquash) | Fixes Safari but adds a dependency and bundle; not recommended now, original fallback covers it |
| `proxy.ts` | edge `middleware.ts` | Fallback only if the spike fails; Next 16 deprecates `middleware.ts` but still runs it [ASSUMED] |

**Installation (execution phase only; research did not install):**
```bash
npm install next@16.4.2 react@19.2.9 react-dom@19.2.9 eslint-config-next@16.4.2 @next/bundle-analyzer@16.4.2
npm install @opennextjs/cloudflare@1.20.12 aws4fetch@1.0.20 @marsidev/react-turnstile@1.6.2
npm install -D wrangler@4.151.2 sharp@^0.35.5 @aws-sdk/client-s3
npm uninstall botid @vercel/analytics @vercel/speed-insights
```
`sharp` and `@aws-sdk/client-s3` move from `dependencies` to `devDependencies`.

**Version verification:** every version above was read with `npm view <pkg> version` on 2026-10-20. Peer ranges read with `npm view @opennextjs/cloudflare peerDependencies` (`next >=15.5.28 <16 || >=16.4.1`, `wrangler ^4.148.0`).

## Package Legitimacy Audit

slopcheck could not be installed (no `pip` on this machine), so per protocol every package below is tagged [ASSUMED] for provenance and the planner must put one `checkpoint:human-verify` before the first `npm install`. Registry checks that did run: name exists, repository URL, weekly downloads, no `postinstall` script.

| Package | Registry | Age | Downloads/wk | Source Repo | slopcheck | Disposition |
|---------|----------|-----|--------------|-------------|-----------|-------------|
| `@opennextjs/cloudflare` | npm | 1+ yr | 1.05M | github.com/opennextjs/opennextjs-cloudflare | unavailable | Approved with checkpoint [ASSUMED] (named in Cloudflare/OpenNext docs) |
| `wrangler` | npm | years | n/a | github.com/cloudflare/workers-sdk | unavailable | Approved with checkpoint [ASSUMED] (Cloudflare's own CLI) |
| `aws4fetch` | npm | 5+ yr | 6.0M | github.com/mhart/aws4fetch | unavailable | Approved with checkpoint [ASSUMED] (named in Cloudflare R2 docs; no postinstall) |
| `@marsidev/react-turnstile` | npm | 2+ yr | 1.48M | github.com/marsidev/react-turnstile | unavailable | Approved with checkpoint [ASSUMED] (used in Supabase guide; no postinstall) |
| `sharp` | npm | years | n/a | github.com/lovell/sharp | unavailable | Already in repo; version bump only |

**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none (tool unavailable, so nothing was rated).

## Architecture Patterns

### System Architecture Diagram

```
Viewer/Admin browser
   |
   |-- HTML, RSC, Server Actions --------------> [Worker: clickit  (custom-worker.ts)]
   |                                               | fetch -> .open-next/worker.js (OpenNext handler)
   |                                               |    proxy.ts: next-intl -> updateSession(getClaims) -> gates
   |                                               |    pages / actions / route handlers
   |                                               |      |-- Supabase REST/Auth (fetch)   [live DB on workers.dev]
   |                                               |      |-- NEXT_INC_CACHE_R2_BUCKET (R2 cache bucket, private)
   |                                               |      |-- NEXT_TAG_CACHE_D1 (tags), NEXT_CACHE_DO_QUEUE (DO, SQLite)
   |                                               |      |-- MEDIA (R2 binding): head/get/delete for finalize + cleanup
   |                                               |      '-- aws4fetch presign (secrets R2_ACCESS_KEY_*)
   |                                               '-- scheduled(): Request(/api/cron/*, Bearer) -> handler.fetch   [crons: [] until cutover]
   |
   |-- static assets (/_next/static, /public) --> Workers Assets (no Worker invocation)
   |
   |-- <img>/<video>  https://clickit-media.<sub>.workers.dev/<bucket>/<key>?w=1280 ----> [Worker: clickit-media]
   |                                               | allowlist bucket in {show-artwork, site-assets, avatars}
   |                                               | ?w -> try _v/<w>/avif|webp/<bucket>/<key> by Accept -> else original
   |                                               | Range -> 206, If-None-Match -> 304, HEAD, nosniff, SVG CSP
   |                                               '-- MEDIA (R2 bucket clickit-media)
   |
   '-- PUT (presigned) -------------------------> R2 S3 endpoint https://<acct>.r2.cloudflarestorage.com/clickit-media/<key>
        then finalize Server Action -> MEDIA.head/get(magic bytes) -> DB write

Local scripts (Node): copy script (Supabase Storage -> sharp variants -> R2 via S3 API) -> manifest/report JSON
```

### Recommended Project Structure
```
wrangler.jsonc                 # Next Worker (pins account_id)
open-next.config.ts
custom-worker.ts               # fetch + scheduled + DO re-exports
workers/media/wrangler.jsonc   # media Worker, MEDIA binding only
workers/media/src/index.ts     # exports handleMediaRequest(request, env) (pure, unit-testable) + fetch
workers/media/tsconfig.json    # uses workers types; root tsconfig EXCLUDES workers/ and custom-worker.ts
src/server/                    # r2-presign.ts, upload-finalize.ts, rate-limit.ts, turnstile.ts, cron-auth.ts
src/lib/image-loader.ts        # pure variant URL builder, used by loaderFile
image-loader.ts                # loaderFile entry ('use client'), imports src/lib/image-loader
public/_headers                # /_next/static/* immutable + /brand/* rule
scripts/media/                 # variants.mjs, faststart.mjs, verify-media-host.mjs (extends r2:media)
cloudflare-env.d.ts            # generated: wrangler types --env-interface CloudflareEnv
```

### Pattern 1: OpenNext config for Free (small site with revalidation)
**What:** R2 incremental cache + D1 tag cache + DO queue, regional cache long-lived, no `bypassTagCacheOnCacheHit`.
```ts
// open-next.config.ts  Source: opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  tagCache: d1NextTagCache,
  enableCacheInterception: false, // start OFF; see Pitfall 2. Turn on only after gate tests pass with it
});
```
Facts [CITED: opennext.js.org/cloudflare/caching]: bindings `NEXT_INC_CACHE_R2_BUCKET`, `NEXT_TAG_CACHE_D1`, `NEXT_CACHE_DO_QUEUE` (class `DOQueueHandler`, migration `new_sqlite_classes`), plus service binding `WORKER_SELF_REFERENCE` pointing at the Worker's own name. `deploy`/`upload`/`preview` populate the cache automatically; remote populate deploys a helper Worker `open-next-cache-populate` and provisions the R2 bucket if missing; it runs `CREATE TABLE IF NOT EXISTS revalidations` (plus `ALTER TABLE` for `stale`/`expire`) through `wrangler d1 execute` [CITED: OpenNext populate-cache.ts source]. So the D1 database must exist (create it with wrangler, get its id), but the table need not be hand-made. On Workers Free, SQLite-backed DOs, D1 (5M reads, 100k writes/day) and R2 (1M Class A, 10M Class B/month) are all available [CITED: developers.cloudflare.com/workers/platform/pricing]. Custom-worker must re-export `DOQueueHandler`. Local dev prints a harmless DO warning [CITED: OpenNext known-issues].

### Pattern 2: Media Worker
**What:** `handleMediaRequest(request, env)`, a pure function, wrapped by `export default { fetch }`.
```ts
// Sources: R2 Workers API reference (get/head/onlyIf/range/writeHttpMetadata/httpEtag)
const BUCKETS = new Set(["show-artwork", "site-assets", "avatars"]);
const WIDTHS = [640, 1280, 1920];

export async function handleMediaRequest(req: Request, env: { MEDIA: R2Bucket }): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  const url = new URL(req.url);
  const parts = decodeURIComponent(url.pathname.slice(1)).split("/");
  if (!BUCKETS.has(parts[0]) || parts.length < 2 || parts.some((p) => p === "" || p === "." || p === "..")) return new Response("Not Found", { status: 404 });
  const key = parts.join("/");
  const w = Number(url.searchParams.get("w"));
  const accept = req.headers.get("accept") ?? "";
  const candidates: string[] = [];
  if (WIDTHS.includes(w)) {
    if (accept.includes("image/avif")) candidates.push(`_v/${w}/avif/${key}`);
    if (accept.includes("image/webp")) candidates.push(`_v/${w}/webp/${key}`);
  }
  candidates.push(key); // original is ALWAYS the final fallback
  for (const k of candidates) {
    const obj = req.method === "HEAD" ? await env.MEDIA.head(k) : await env.MEDIA.get(k, { range: req.headers, onlyIf: req.headers });
    if (obj) return toResponse(req, obj, k !== key);
  }
  return new Response("Not Found", { status: 404 });
}
```
`toResponse` must add what the Cloudflare docs example omits: the docs sample returns 200 or 412 and never sets `Content-Range` or 206 [CITED: R2 workers-api-usage page]. Required behaviour:
- `headers = new Headers(); obj.writeHttpMetadata(headers); headers.set("etag", obj.httpEtag); headers.set("accept-ranges", "bytes")`.
- Has body and `obj.range` set: status **206**, `Content-Range: bytes <offset>-<offset+length-1>/<obj.size>`, `Content-Length` = length. (R2 returns `range` as `{offset,length}` or `{suffix}` on the object; compute from `obj.range` and `obj.size`.) Has body, no range: 200.
- No body (`"body" in obj` false): precondition failed. For `If-None-Match` it is 304 (empty body, keep ETag), otherwise 412. Decide by which header the request carried.
- HEAD: same headers, no body.
- Variant served: `Vary: Accept`; also set `Vary: Accept` on every `?w=` response so the original fallback is cached per Accept.
- Cache-Control: objects under `<bucket>/<key>` that carry `?v=` (fixed-key admin overwrite, per `stripStorageCacheBust`) or timestamped filenames: `public, max-age=31536000, immutable`. Fixed keys without `?v=`: shorter (`max-age=3600`). Decide in one function keyed on whether `?v=` is present.
- `X-Content-Type-Options: nosniff` always. If the stored content type is `image/svg+xml`: add `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` and `Content-Disposition: inline`. `Cross-Origin-Resource-Policy: cross-origin`.
- Range on a missing/invalid range: pass the `Headers` straight to R2 (it parses `Range`); do not hand-parse.
Cache API: Cloudflare's current Cache API page lists no workers.dev restriction (only: no-op in dashboard editor/Playground, unavailable behind Access, `cache.put` rejects 206) [CITED: developers.cloudflare.com/workers/runtime-apis/cache]. Earlier project notes said it is a no-op on workers.dev; that is not confirmed either way. Do not rely on it: the Worker must be correct with no cache, and caching is a Phase 3 optimization on the custom domain.
workers.dev: each Worker gets `<name>.<account-subdomain>.workers.dev`, one subdomain per account, so `clickit` and `clickit-media` share the account subdomain and differ by name [CITED: developers.cloudflare.com/workers/configuration/routing/workers-dev]. The account subdomain must be registered once (owner step if not yet). Set `preview_urls: false` on the media Worker (workers.dev preview/version URLs stay live even when `workers_dev` is off).

### Pattern 3: Copy script extension (sharp variants, idempotent, checksums)
Existing script is dry-run by default, manifest-based, refuses a changed source, verifies sha256 + metadata, is re-runnable [VERIFIED: repo read]. Extend it, do not fork it.
- **Variant rules.** Raster types `image/jpeg|png|webp` (and `avif` source): for each W in {640,1280,1920} with `W < originalWidth` (strictly smaller; never upscale), write `_v/<W>/webp/<bucket>/<key>` (quality 80, effort 4: sharp defaults) and `_v/<W>/avif/<bucket>/<key>` (quality 50, effort 4: sharp defaults) [CITED: sharp.pixelplumbing.com/api-output]. If the original is narrower than 640, make no variants (the original is the fallback). Always call `.rotate()` first: sharp strips all metadata including EXIF orientation by default [CITED: sharp docs], so without `.rotate()` portrait phone photos come out sideways (`[ASSUMED]` that bare `.rotate()` auto-orients; prove with an EXIF-rotated fixture in a unit test).
- **Skip list (no variants):** `image/gif` (animated; AVIF sequences are unsupported in sharp [CITED]), `image/svg+xml`, `image/x-icon`/`.ico`, anything animated (`metadata.pages > 1`), and all video. Originals are still copied byte-for-byte.
- **Idempotency.** Put `src-sha256` and `variant-spec` (for example `v1;w=1280;fmt=webp;q=80`) in `customMetadata` on every variant. On re-run, `HEAD` the variant; skip when both match. Changing quality or widths means bumping the spec string, which regenerates only stale variants.
- **Dry-run report** (default, no writes): per source object: bucket/key, size, sha256 if cached, detected type, planned variant list, estimated bytes. Totals by type; count of skipped types with reason.
- **Checksum report** (JSON next to the manifest, one row per R2 object written): `{ role: "original"|"variant"|"video-remux", srcBucket, srcKey, srcSha256, dstKey, dstSha256, dstSize, contentType, transform: "none"|"sharp:webp:1280:q80"|"ffmpeg:faststart", verified: true }` and a summary with counts and failures. Originals must satisfy `dstSha256 == srcSha256`; variants are verified by re-download of the written object, sha256 recorded, and `src-sha256` metadata equal to the source hash.
- **Rate/volume:** 86 originals + up to 6 variants each is about 600 PUTs, negligible against 1M Class A/month.
- **Reading the manifest count:** re-read at copy time; do not hard-code 86 (CONTEXT edit 5).
- **Check for other media references** at copy time (legal/FAQ HTML, footer/social JSON in `app_config`), as the code scan notes, so no referenced object is missed.

**Video faststart check (MEDIA-05).** Do it in Node, no ffprobe dependency: read the first 64 KiB of the MP4 and walk top-level boxes (`size` u32, `type` 4 chars; `size==1` means 64-bit largesize, `size==0` means to end of file). Faststart means `moov` appears before `mdat`. Unit-test with two tiny synthetic byte buffers. If a hero MP4 is not faststart, remux locally with `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4` (lossless, no re-encode), record it as `role: video-remux`, and keep both hashes in the report (the destination sha will legitimately differ from the source). `ffmpeg`/`ffprobe` are installed locally (see Environment Availability). Check also `scripts/check-show-hero-video-sizes.mjs` and the `.tmp/hero-compress` folder for existing compressed files before re-encoding anything.

### Pattern 4: Direct-to-R2 upload (presign, finalize)
1. Server Action `requestUpload({ kind, filename, contentType, size })`: check session (admin for artwork/site assets/cast/videos; any signed-in user for own avatar), validate content type against an allowlist (no SVG), cap declared size, rate-limit, mint key (`<bucket>/<uuid or timestamped name>.<ext>`, avatar keys scoped `avatars/<userId>/...`). Return presigned URLs for the original and, for rasters, for each variant key (`_v/<w>/webp/<key>`).
2. Signing (aws4fetch, runs in the Worker; HMAC via SubtleCrypto, cheap in CPU):
```ts
// Source: developers.cloudflare.com/r2/examples/aws/aws4fetch
const client = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const u = new URL(`https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/clickit-media/${key}`);
u.searchParams.set("X-Amz-Expires", "300");
const signed = await client.sign(new Request(u, { method: "PUT", headers: { "Content-Type": contentType } }), { aws: { signQuery: true } });
return signed.url; // browser must PUT with the same Content-Type
```
Presigned URLs work only on the `r2.cloudflarestorage.com` endpoint, not on custom domains; a different `Content-Type` gives 403 `SignatureDoesNotMatch` [CITED: R2 docs; STACK.md]. Expiry 300 s is enough for 55 MB over a typical admin connection; raise only for hero videos if needed.
3. Browser PUTs with `fetch` (or XHR for progress). Videos can be large; one PUT is fine up to 5 GB on R2, no multipart needed for hero MP4s.
4. Finalize Server Action `finalizeUpload({ key, kind })`: `MEDIA.head(key)` -> exists, `size` <= cap for kind, prefix matches the kind and (for avatars) the caller's id; `MEDIA.get(key, { range: { offset: 0, length: 32 } })` -> check magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`, MP4 `ftyp` at byte 4). On any failure: `MEDIA.delete(key)` (and variants) and return an error. Only then write the DB row. Presigned PUT cannot enforce size or content (the signed Content-Type is only a claim), so finalize is the real gate. Short expiry plus a cleanup sweep for unreferenced keys under `avatars/` limits abuse.
5. The cap on the number of presigned URLs per call keeps subrequests and CPU small. Presign is a local signing operation (no subrequest).
6. **Bucket CORS.** Wrangler format (nested) [CITED: developers.cloudflare.com/r2/buckets/cors]: `npx wrangler r2 bucket cors set clickit-media --file r2-cors.json`, verify with `... cors list clickit-media`. File:
```json
{ "rules": [ { "allowed": { "origins": ["https://clickit.<sub>.workers.dev", "https://www.clickitstory.ae"], "methods": ["PUT"], "headers": ["Content-Type"] }, "exposeHeaders": ["ETag"], "maxAgeSeconds": 3600 } ] }
```
The docs page shows only `origins` and `methods` in the wrangler example; `headers`, `exposeHeaders`, `maxAgeSeconds` key names are [ASSUMED] from the R2 API shape, so read back with `cors list` and fix from the error message. The dashboard JSON (bare array, PascalCase `AllowedOrigins`, `AllowedMethods`, `AllowedHeaders`, `ExposeHeaders`, `MaxAgeSeconds`) is a different format; do not mix them.
7. **CSP.** Add the R2 S3 endpoint to `connect-src` (exact account host from env, not a wildcard) or the browser PUT is blocked by the app's own CSP.
8. **Browser variants.** `createImageBitmap(file)` (applies EXIF orientation) -> `OffscreenCanvas` or canvas -> `toBlob("image/webp", 0.8)` per width, skipping widths >= source width. **Always check `blob.type === "image/webp"`**: unsupported types silently become PNG [CITED: MDN toBlob]. Safari (desktop and iOS, through 26.5) does not support WebP encoding in `toBlob` or `convertToBlob` [CITED: caniuse via search]. When the blob is not WebP, upload the original only. The media Worker then serves the original, which is correct. Do not upload PNG-as-WebP.
9. **Videos.** Replace the Supabase signed-upload flow (`createHeroVideoUpload`, `createPreloaderVideoUpload`, `createShowVideoUpload`, `save*`) with the same presign/finalize pair; finalize reads `ftyp` and may run the existing `mp4-audio.ts` slice-based check. Faststart cannot be fixed server-side on Workers; admin-uploaded videos must be pre-encoded with faststart (document in the admin UI hint and the runbook), and finalize can at least detect `mdat`-before-`moov` using the same box walker and warn.
10. **Local test limit.** `opennextjs-cloudflare preview` runs a local R2 simulation that has no S3 endpoint, so a real presigned PUT cannot be exercised locally. Plan: unit-test the signed URL shape (query has `X-Amz-Signature`, `X-Amz-Expires`, signed headers include `content-type`), test finalize against `wrangler r2 object put --local` objects in preview, and do exactly one real presigned round trip on workers.dev with a scratch key prefix (`_uat/`) that is deleted afterwards (an R2 write, not a DB write; the owner approves it as one numbered step).

### Pattern 5: Cron through a custom worker
```ts
// custom-worker.ts  Source: opennext.js.org/cloudflare/howtos/custom-worker
// @ts-ignore generated at build time
import { default as handler } from "./.open-next/worker.js";
export { DOQueueHandler } from "./.open-next/worker.js";
export default {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    const path = event.cron === "0 1 * * *" ? "/api/cron/publish-scheduled" : "/api/cron/cleanup-media";
    const req = new Request(`https://self.invalid${path}`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    ctx.waitUntil(handler.fetch(req, env, ctx).then(r => { if (!r.ok) console.error("cron failed", path, r.status); }));
  },
} satisfies ExportedHandler<CloudflareEnv>;
```
- `wrangler.jsonc` `main` points at `custom-worker.ts`. The adapter's own worker only exports `fetch` [CITED: OpenNext custom-worker page].
- Keep the cron path map in one tested pure function (cron string -> path), unit-tested.
- Deploy with `"triggers": { "crons": [] }`. Only an empty array removes triggers; commenting the key out leaves existing ones in place; propagation up to 15 minutes [CITED: Cloudflare cron-triggers and wrangler configuration docs]. Cron times are UTC, same as Vercel.
- Local test: `wrangler dev --test-scheduled` and call `/cdn-cgi/local/scheduled?cron=0+1+*+*+*` (current docs name `/cdn-cgi/local/scheduled`; older notes say `/__scheduled`; confirm against the dev server banner [MEDIUM]). Whether `opennextjs-cloudflare preview` also exposes it is unconfirmed; if not, run `wrangler dev` on the built output with the same config.
- Free limits apply to crons: 10 ms CPU and 50 subrequests per run [CITED: limits page]. `cleanup-media` (286 lines, lists then deletes) is the likely failure. It stays off anyway; measure it once locally for operations count and record it as a known Paid trigger.

### Pattern 6: Rate limit, cron secret, client IP
- IP: `request.headers.get("cf-connecting-ip")` is set by Cloudflare on requests reaching the Worker (the docs page for Request does not document it; widely documented elsewhere [ASSUMED]; prove with `wrangler tail` or an echo route in the spike). Replace `getClientIp` (`x-forwarded-for`/`x-real-ip`) in `contact.ts`. In production, if the header is missing: fail closed (refuse the action). In local preview it is absent, so allow a `LOCAL_DEV=1` override that is rejected by the deploy guard (below).
- Limiter: keep the Supabase `rate_limits` table and `withinRateLimit` shape; change the catch to return **false** (fail closed). Cost: 2 Supabase subrequests per check. No new live migration. Note that every limited action on workers.dev writes a row to the live table, so contact/newsletter must not be exercised on workers.dev (UAT them on preview with local Supabase).
- Cron secret: `crypto.subtle.timingSafeEqual(a, b)` is a documented workerd extension taking two `ArrayBuffer`/`TypedArray` [CITED: developers.cloudflare.com/workers/runtime-apis/web-crypto]. The docs do not state the equal-length requirement; workerd throws on length mismatch [ASSUMED]. Safe pattern: SHA-256 both strings (`crypto.subtle.digest`) and compare the two 32-byte digests, which also avoids leaking the secret length. Unit test on Node: `crypto.subtle.timingSafeEqual` does not exist in Node, so isolate the comparison behind a function that takes the comparator as a parameter, or use `node:crypto.timingSafeEqual` in the test shim. Apply to both cron routes.

### Pattern 7: Turnstile
- Widget: `@marsidev/react-turnstile` `<Turnstile siteKey=... onSuccess=... />`; after any failed submit call `reset()` because the token is single-use (300 s validity) [CITED: STACK.md, Cloudflare Turnstile docs].
- **Auth forms:** pass `options.captchaToken` to `signInWithPassword`, `signUp`, `resetPasswordForEmail`. With Supabase CAPTCHA disabled the server ignores the token: the Auth server's captcha middleware returns immediately when `config.Security.Captcha.Enabled` is false and only reads `gotrue_meta_security.captcha_token` when enabled [VERIFIED: supabase/auth `internal/api/middleware.go`]. So shipping the widget now cannot break the live Vercel sign-in. **Consequence for PLAT-05:** on workers.dev the auth forms show the widget but are not enforced until Koss enables Supabase CAPTCHA at cutover. State this in the UAT script. Enforcement can be proven locally: the repo's `supabase/config.toml` has a commented `[auth.captcha]` block (provider `turnstile`); enable it in a local-only config with Turnstile's test secret `1x0000000000000000000000000000000AA` (always passes) and `2x...AA` (always fails), and test sitekey `1x00000000000000000000AA`. Test keys work on localhost/127.0.0.1 [CITED: developers.cloudflare.com/turnstile/troubleshooting/testing]. The exact `config.toml` key names are in the file's own comment (`enabled`, `provider`, `secret`).
- **Contact and newsletter:** server action POSTs `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, `remoteip` (from `cf-connecting-ip`). Refuse on `success: false`. Put the siteverify call after zod validation and before the rate-limit insert so rejected bots do not fill `rate_limits`.
- CSP: `script-src https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`; `connect-src` as needed.
- Remove `BotIdInit`, `checkBotId` (auth + contact), the BotID branch in `proxy.ts`, `withBotId` in `next.config.ts` (Code Scan section 1).
- Turnstile secret and site key are separate. Site key is public (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, build time). The hostname list on the Turnstile widget must include the workers.dev hostname.

### Pattern 8: Cloudflare Web Analytics
Manual beacon via `next/script` in the root layout: `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"<token>"}'>`. SPA route-change tracking is automatic by default (three browser mechanisms); `"spa": false` turns it off [CITED: developers.cloudflare.com/web-analytics/get-started/web-analytics-spa]. This corrects STACK.md, which suggested setting `spa:true`. For a site not proxied by Cloudflare, the dashboard flow is Add a site -> hostname -> copy snippet [CITED: .../get-started]. **Unconfirmed (LOW):** whether `*.workers.dev` hostnames can be added. Make the beacon conditional on `NEXT_PUBLIC_CF_BEACON_TOKEN`: if workers.dev is refused, the token is created for `www.clickitstory.ae` at cutover and PLAT-06 is proven then. CSP: `script-src https://static.cloudflareinsights.com`, `connect-src https://cloudflareinsights.com`.

### Pattern 9: Measuring CPU per route on Free
- Enable `"observability": { "enabled": true }` (head sampling 1). Workers Free keeps 200k log events/day for 3 days [CITED: Workers Logs docs]. Invocation logs show CPU time and wall time since the April 2025 change; Tail Workers and Logpush get them at the top level of the trace event [CITED: Cloudflare changelog 2025-04-09]. The exact JSON field name is not in the docs (Logpush calls it `CPUTimeMs`; a third-party tool queries `$workers.cpuTimeMs` [LOW]). Wave 0 spike: deploy a tiny Worker or the real one, open Workers Logs, and write down the exact field name before building the report script.
- `wrangler tail clickit --format json --sampling-rate 1` streams events; flags `--status error|ok|canceled`, `--method`, `--ip self`, `--search` exist [CITED: wrangler tail docs]. Whether each tail event carries a CPU field is not documented; test it in the spike. Use `--ip self` so only Koss's own requests are captured.
- Over the limit the client gets Error 1102 and the outcome is `exceededCpu` [CITED: limits page]. Subrequest overrun is a separate error. Capture `outcome`, `cpuTime`, `wallTime`, request path, status, subrequest count if available.
- **Method:** a script (`scripts/cf-measure-routes.mjs`) hits each route 25 times per variant, spaced out, from Koss's own IP, and the report takes p50/p95/max per route and keeps the first request after a deploy separately (cold isolate). Routes and variants: `/`, `/en`, `/ar`, `/en/watch`, a show page, an episode page, `/en/auth`, `/en/support`, `/en/admin` (signed-in admin), `/api/cron/*` (via `--test-scheduled` locally, and once deployed with the Bearer secret if Koss approves), a Server Action (any admin edit on a draft show), `/_next/image` is no longer used, media Worker `GET` with and without `Range`. Each both signed-out (redirect cost) and signed-in where it differs; both `en` and `ar`.
- **Report table (template):**

| Route | Auth | Locale | n | CPU p50 ms | CPU p95 ms | CPU max ms | Cold CPU ms | Subrequests | Outcome counts | Free verdict (<=10 ms p95 and <50 sub) |
|---|---|---|---|---|---|---|---|---|---|---|

- Dashboard metric "CPU Time per execution" shows quantiles per Worker [CITED: metrics docs], useful as a cross-check, not per route.
- Per D-02: if any core route fails, produce the table plus Workers Paid price ($5/month) as one question to Koss; do not enable Paid in code or config.

### Pattern 10: Custom `next/image` loader
- `next.config.ts`: `images: { loader: "custom", loaderFile: "./image-loader.ts" }`. The file must `export default` a function returning a string, and Cloudflare/Next docs show it with `'use client'` because it is serialized to client components [CITED: nextjs.org/docs/app/api-reference/config/next-config-js/images]. The loader receives `{ src, width, quality }`. With a custom loader, `remotePatterns` and `minimumCacheTTL` stop mattering (the browser fetches the loader's URL directly), so drop `formats` and `minimumCacheTTL`. Keep `deviceSizes`/`imageSizes` only if the loader should map them.
- Loader logic (pure, unit-tested):
  1. If `src` starts with `/` (local `public/` asset) or `data:`/`blob:`: return `src` unchanged.
  2. YouTube hosts (`i.ytimg.com`, `img.youtube.com`, others already allowed in `remotePatterns`), Unsplash, Picsum: return `src` unchanged.
  3. If `src` origin equals `getPublicMediaOrigin()`: pick the nearest width `>= requested` from {640,1280,1920} (cap at 1920), set `?w=<that>` while preserving an existing `?v=`; return it.
  4. Otherwise (Supabase URL when the flag is off): return `src` unchanged.
- Existing helpers keep their roles: `toPublicR2MediaUrl` still maps Supabase URLs to `<origin>/<bucket>/<key>` (preserves `search`, so `?v=` survives) only when the `verified` flag is on; the loader then adds `w`. The loader must not import anything server-only.
- Components with `unoptimized` today (`cast-editor`, `image-upload-field`, `footer-editor`, `footer`) bypass the loader entirely. Admin previews can stay unoptimized. Footer renders for every visitor, so drop `unoptimized` there once variants exist. 25 files use `next/image`; none need edits for the loader itself, but `sizes` props decide which widths the browser requests, so spot-check hero and card images (`fill` images without `sizes` request the largest width).
- The `verified` flag: with it off, nothing in the app points at R2 at all. See Pitfall 3 for how to prove the media path.

### Anti-Patterns to Avoid
- `bypassTagCacheOnCacheHit: true`: admin edits can stay stale up to 30 minutes unless cache purge is wired (OpenNext docs: it needs purge or manual purging).
- Importing `@aws-sdk/client-s3`, `sharp`, `node:crypto` in `src/` code that ships in the Worker.
- Server-side image resizing on the Worker (CPU).
- Using the `r2.dev` public URL as the media origin: rate-limited, "non-production" [CITED: R2 public buckets docs].
- Streaming big bodies or videos through the Next Worker (Server Actions or `/api/cdn/storage`).
- Hand-parsing `Range` for R2: pass the request `Headers`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SigV4 query signing | Own HMAC signer | `aws4fetch` `sign` with `signQuery` | Canonicalization and encoding bugs; documented by Cloudflare |
| Range / conditional parsing | Own parser | R2 `get(key, { range: req.headers, onlyIf: req.headers })` | R2 handles suffix/offset forms and all conditional headers except `If-Range` |
| Image encoding | Canvas pipeline for existing files; wasm encoders | `sharp` in the local script | Quality, ICC, EXIF handling are solved |
| Turnstile widget | Own script injection | `@marsidev/react-turnstile` | Rendering/reset lifecycle |
| ISR cache and tags on Workers | Custom cache layer | OpenNext overrides | Already integrates with `revalidatePath/updateTag` |
| Cron-to-route plumbing | Re-implement publish/cleanup in the Worker | `handler.fetch` to existing routes | `revalidatePath/updateTag` need a Next request context |
| Constant-time compare | `===` or hand-rolled XOR loop | `crypto.subtle.timingSafeEqual` on digests | Timing leak |
| MP4 faststart fix | Custom box rewriter | `ffmpeg -c copy -movflags +faststart` locally | Lossless, one command |

**Key insight:** every piece that does image or video work belongs off the Worker (local script or browser); the Worker only signs, validates, serves bytes and routes.

## Common Pitfalls

### Pitfall 1: `proxy.ts` bundle size, startup and open adapter bugs
**What goes wrong:** Node middleware bundles about 4.6 MB for a no-op handler (issue #1373, open); instrumentation or `@opentelemetry/api` can break bundling (#1400, #1401, open); `@vercel/og` was pulled into the bundle until 1.20.11 fixed it (#1376). Startup limit is 1 s; Worker size limit is 64 MiB on both plans per Cloudflare's limits page (updated 2026-10-12), though issue text still quotes 3 MiB [VERIFIED: GitHub issue list; CITED: limits page].
**How to avoid:** Spike first on 1.20.12 with the real `proxy.ts`. Record bundle size (gzip and raw) and startup result in the spike. Do not install Sentry/OpenTelemetry in this phase. Fallback: port `proxy.ts` logic to edge `middleware.ts` (same functions; no Node APIs are used today per the code scan).
**Warning signs:** deploy error 10021 (startup exceeded CPU), `Could not resolve` build errors.

### Pitfall 2: Cache interception can skip the gates
**What goes wrong:** With `enableCacheInterception`, cached ISR/SSG hits may be answered before the app runs; a third-party write-up notes proxy code can end up behind the cache, so cached pages skip it (not confirmed for OpenNext).
**How to avoid:** Leave interception off first. The gate suite (signed-out request to each gated page must redirect; non-admin to `/admin` must bounce; coming-soon on/off) runs against preview with interception off, and again before any later switch-on.

### Pitfall 3: The `verified` flag means workers.dev does not use R2 images until the end
**What goes wrong:** With the flag off, `toPublicR2MediaUrl` returns null and the app renders Supabase URLs, so nothing on workers.dev exercises the media Worker, variants or loader. `getPublicMediaOrigin` also rejects non-https origins, so a local `http://127.0.0.1` media Worker cannot be used in preview.
**How to avoid:** Sequence: (1) copy script run + checksum report; (2) `verify-media-host` script HEADs every object in the report against the media Worker origin and compares size/ETag/status; (3) only then build workers.dev with the flag `verified` and the media Worker origin (this satisfies D-03's condition; the DB still holds Supabase URLs because mapping is at read time). For local preview of the loader and media Worker, add an explicit loopback allowance (`http://127.0.0.1:<port>` accepted only when a separate env such as `NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK=1` is set) with a unit test, and make the deploy script refuse any build stamped with loopback, local Supabase URL, or `LOCAL_DEV`. Unit tests already pass explicit parameters into the helpers, so most logic is testable without the flag.

### Pitfall 4: Local-env build deployed by mistake
**What goes wrong:** `NEXT_PUBLIC_*` values are inlined at `next build` [CITED: OpenNext env-vars page]. A preview build made against local Supabase carries `http://127.0.0.1:55321`; deploying it breaks production, and a flag-on build deployed too early breaks images.
**How to avoid:** One script per target (`cf:build:preview`, `cf:build:workersdev`) that writes a stamp file in `.open-next/` listing target and the `NEXT_PUBLIC_*` hashes; `cf:deploy` reads the stamp and refuses a preview stamp. Run `wrangler whoami` and compare `account_id` first (D-04).

### Pitfall 5: CSP breaks the preview and the upload
**What goes wrong:** `next.config.ts` adds `upgrade-insecure-requests` in production builds, and a preview build is a production build served over `http://127.0.0.1:8787`, so the browser upgrades local Supabase calls to https and they hang (the file's own comment describes the same hang for localhost). `connect-src` only allows `*.supabase.co`, not a local Supabase; and it does not allow the R2 S3 endpoint or Turnstile/Analytics hosts.
**How to avoid:** Derive CSP hosts from env at build time (Supabase URL host, R2 endpoint host, media origin); gate `upgrade-insecure-requests` on a `CSP_UPGRADE_INSECURE` env that preview sets to false. Remove `va.vercel-scripts.com`, `vercel.live`, `*.vercel-insights.com`. Add `challenges.cloudflare.com` (script, frame), `static.cloudflareinsights.com`, `cloudflareinsights.com`. Add the media origin to `media-src`.

### Pitfall 6: Presigned PUT cannot cap size or content
**What goes wrong:** A signed-in user can PUT any bytes up to R2's limits within the expiry; the signed Content-Type is only a claim.
**How to avoid:** Finalize does `head` (size cap), magic-byte check, prefix/owner check, delete on failure; 300 s expiry; avatar keys scoped to the user id; sweep unfinalized objects in the cleanup cron later. SVG remains rejected.

### Pitfall 7: Static asset headers
**What goes wrong:** `headers()` in `next.config.ts` does not apply to `/_next/static` or `public/` because the Worker is not in front of Workers Assets [CITED: OpenNext caching page]. The existing `/brand/*` long-cache rule stops working.
**How to avoid:** `public/_headers` with `/_next/static/*` immutable and the `/brand/*` rule.

### Pitfall 8: Subrequests, not only CPU, may fail on Free
**What goes wrong:** Every R2 get (data cache), D1 query (tag check), and Supabase call counts toward 50 subrequests per request on Free; `getAppConfig` and about 33 cached reads can multiply this on a cold cache. Cron `cleanup-media` lists and removes objects and is the likely over-limit case.
**How to avoid:** Record a subrequest count per route in the report (Workers Logs shows subrequest info per invocation [LOW, verify in spike]); treat 50 as a pass/fail line next to 10 ms.

### Pitfall 9: Old tests and scripts bind to code being deleted
`tests/unit/r2-media.test.ts` (423 lines) and `r2-media-migration.test.ts` (419 lines) test `r2-media-core.ts` and the copy script; `storage-range-proxy.test.ts` tests the Supabase proxy. Deleting or rewriting the source needs the tests rewritten in the same task, or `gate:local` goes red.

### Pitfall 10: `tsconfig`/lint pick up Worker code
`workers/media` and `custom-worker.ts` use Workers types (`R2Bucket`, `ExportedHandler`), which conflict with DOM/Node types in the root tsconfig, and ESLint may lint generated `.open-next`. Exclude `workers/`, `custom-worker.ts`, `.open-next/`, `.wrangler/` from root `tsconfig`, and add `.open-next` and `.wrangler` to `.gitignore` and ESLint ignores.

### Pitfall 11: Vercel remnants keep the build green but wrong
`getSiteUrl` falls back to `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`; on Workers these are unset, so `NEXT_PUBLIC_SITE_URL` must be set at build, else metadata, sitemap and auth redirects use the wrong host. Remove the Vercel fallbacks (PLAT-10 code part) and add a unit test that `getSiteUrl` throws or returns a safe default when the var is missing in production. Also `bodySizeLimit: '55mb'` should drop to the default or `'2mb'` once uploads go direct.

### Pitfall 12: Workers.dev UAT touches live data
Sign-in on workers.dev creates a session in live Supabase auth; contact/newsletter write rows; admin edits write live content. UAT script: read paths and sign-in only, plus at most one owner-approved write on a draft test show. Everything else on preview with local Supabase.

### Pitfall 13: Supabase redirect allow-list
Local: `supabase/config.toml` has `site_url = http://127.0.0.1:3000` and `additional_redirect_urls = ["https://127.0.0.1:3000"]` (note https). Preview serves on port 8787 by default (wrangler dev) and over http, so add `http://127.0.0.1:8787` to the local allow-list (local config file only). The live project's redirect allow-list must gain the workers.dev URL before sign-in links work there; that is a dashboard setting on the live project, so it is an owner numbered step (not an SQL change). Cookie behaviour: `@supabase/ssr` host-only cookies on `127.0.0.1` are fine; whether it sets `Secure` over http is [ASSUMED] to be off by default; verify in preview.

## Code Examples

### Cache-Control selection in the media Worker
```ts
function cacheControlFor(url: URL, variantServed: boolean): string {
  if (url.searchParams.has("v") || variantServed) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}
```
(Variants are keyed by content hash through `?v=`/timestamped filenames; if a fixed-key object is overwritten without `?v=` a long cache would go stale, which is why the rule hangs on `v`.)

### Constant-time cron auth
```ts
// Source: developers.cloudflare.com/workers/runtime-apis/web-crypto (timingSafeEqual), hash-first pattern
async function cronAuthOk(header: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !header) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(header)),
    crypto.subtle.digest("SHA-256", enc.encode(`Bearer ${secret}`)),
  ]);
  return (crypto.subtle as unknown as { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean }).timingSafeEqual(a, b);
}
```

### Wrangler skeleton (Next Worker, Free)
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "clickit",
  "account_id": "e329b099...",            // full id from CONTEXT; pinned (D-04)
  "main": "./custom-worker.ts",
  "compatibility_date": "2026-10-15",      // set to the deploy date; must be >= 2024-09-23
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true },
  "workers_dev": true, "preview_urls": false,
  "triggers": { "crons": [] },             // explicit empty array; commented-out would NOT remove an existing trigger
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "clickit" }],
  "r2_buckets": [
    { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "clickit-next-cache" },
    { "binding": "MEDIA", "bucket_name": "clickit-media" }
  ],
  "d1_databases": [{ "binding": "NEXT_TAG_CACHE_D1", "database_name": "clickit-tag-cache", "database_id": "<id>" }],
  "durable_objects": { "bindings": [{ "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["DOQueueHandler"] }]
}
```
Sources: OpenNext caching/custom-worker pages; Cloudflare wrangler configuration (`account_id`, `workers_dev`, `preview_urls`, `triggers.crons = []`, `observability`). No Queues, no APP_DB (rate limits stay in Supabase), no routes.

## Environment and secrets inventory (Worker)

| Name | Kind | Where set | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build-time (inlined) | build env | live vs local differ by target; stamp guard |
| `NEXT_PUBLIC_SITE_URL` | build-time | build env | replaces VERCEL_* fallbacks |
| `NEXT_PUBLIC_MEDIA_ORIGIN`, `NEXT_PUBLIC_MEDIA_CUTOVER_READY` | build-time | build env | flag stays unset until verify-media-host passes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_CF_BEACON_TOKEN` | build-time (public) | build env | |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | `wrangler secret` (Koss, terminal) | |
| `CRON_SECRET`, `TURNSTILE_SECRET_KEY` | secret | `wrangler secret` | |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secret | `wrangler secret` | R2 token scoped to the media bucket only |
| `CLOUDFLARE_ACCOUNT_ID` | var | `wrangler.jsonc` vars | non-secret; also used for CSP and presign host |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GOOGLE_TRANSLATE_API_KEY` | secret / var | `wrangler secret` | still read by existing code |
| `CLOUDFLARE_R2_BUCKET` | var | vars | `clickit-media` |

- Runtime `process.env` reads keep working; bindings via `getCloudflareContext().env` (`{ async: true }` in static paths) [CITED: OpenNext env-vars page; STACK.md].
- Local: `.dev.vars` for secrets the Worker needs in preview; OpenNext recommends `.env` files so `process.env` works in both `next dev` and wrangler dev, and `NEXTJS_ENV` selects the env file set [CITED: OpenNext env-vars page]. No real secret in a tracked file (no `.env.example` exists today; add one with placeholder names only).
- `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts` generates types; wrangler config also has `secrets.required` to declare secret names without values [CITED: wrangler configuration docs].
- Secrets cannot be read back after creation [CITED: OpenNext env-vars page]; the runbook steps are `wrangler secret put <NAME>` or `secret bulk` by Koss, one numbered step.
- Use `--keep-vars`/`keep_vars` only if dashboard vars are ever used; otherwise config is the source of truth.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next floor 16.3.8 | Next >=16.4.1 (use 16.4.2) | OpenNext 1.20.12, 2026-10-15; Next security release 2026-10-14 | Raises the upgrade target; fixes Server Action DoS relevant to this app |
| Images through Image Transformations loader | Pre-built variants + Accept negotiation in media Worker | D-03, 2026-10-19 | No paid image feature; permanent original fallback |
| `spa:true` on beacon | SPA tracking automatic | current Cloudflare docs | Drop the flag from STACK.md's snippet |
| Worker size 3/10 MiB | 64 MiB both plans | Cloudflare limits page 2026-10-12 | Size is not the Free-plan blocker; startup (1 s) and CPU are |
| Cron local URL `/__scheduled` | `/cdn-cgi/local/scheduled` in current docs | docs now | Confirm in dev banner |

**Deprecated/outdated:** `OpenNext docs: Node middleware not supported` (stale; changelog 1.20.3+ supports it as experimental). STACK.md's "Workers Free cannot run this app" is a hypothesis, not a measured fact; D-02 says measure.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `middleware.ts` (edge) still works in Next 16.4 as a fallback | Alternatives | Fallback plan for proxy.ts fails; need another gate mechanism |
| A2 | Bare `sharp().rotate()` auto-orients before metadata strip | Pattern 3 | Sideways portrait images; caught by a fixture test |
| A3 | Wrangler CORS file accepts `allowed.headers`, `exposeHeaders`, `maxAgeSeconds` keys | Pattern 4 | Upload blocked by CORS; fix after `cors list` readback |
| A4 | `CF-Connecting-IP` is present on workers.dev requests | Pattern 6 | Fail-closed limiter blocks everyone; prove in spike |
| A5 | `timingSafeEqual` throws on unequal lengths | Pattern 6 | Only matters if hash-first pattern is skipped |
| A6 | Supabase `@supabase/ssr` sets no `Secure` flag by default on http | Pitfall 13 | Local preview sign-in fails; verify in preview |
| A7 | Cache API behaviour on workers.dev (docs show no restriction; older notes say no-op) | Pattern 2 | Only a performance difference; design works either way |
| A8 | Workers Logs CPU field name (`$workers.cpuTimeMs` / `CPUTimeMs`) | Pattern 9 | Report script uses wrong field; confirm in spike |
| A9 | Web Analytics accepts a `workers.dev` hostname | Pattern 8 | PLAT-06 proven only at cutover |
| A10 | Account's workers.dev subdomain already registered | Pattern 2 | One extra owner step |
| A11 | `opennextjs-cloudflare deploy` works non-interactively with an OAuth login under the pinned HOME (docs do not mention `CLOUDFLARE_API_TOKEN`) | Environment | Deploy step needs an API token or a different login method |
| A12 | All five packages' legitimacy (slopcheck unavailable) | Package Audit | Supply-chain risk; checkpoint before install |

## Open Questions (RESOLVED)

1. **Phase 3 media custom domain: bare R2 custom domain or the media Worker?**
   - Known: a bare R2 custom domain serves `<bucket>/<key>` directly and ignores `?w=`, and Safari-uploaded images have no variants.
   - Unclear: whether Koss accepts the Workers Free 100k requests/day cap on media after cutover.
   - Recommendation: attach `media.clickitstory.ae` to the media Worker (keeps variants, Accept negotiation, fallback, Cache API on a real zone). Put this in the Phase 3 context for Koss.
   - RESOLVED: recommendation recorded in 02-RUNBOOK.md P3-5 (Phase 3, not now): front the media Worker; final choice is Phase 3's.
2. **Does the Free plan pass for any dynamic page?** Unknown until measured. The deliverable is the table, not a guess.
   - RESOLVED: measured in plan 02-10 Task 4 (early sample, early stop rule) and plan 02-21 (02-CPU-REPORT.md, stop rule, RUNBOOK Step 33 priced question).
3. **Does `proxy.ts` bundle and start within 1 s startup / run within 10 ms?** The spike answers; fallback exists.
   - RESOLVED: plan 02-01 Task 4 (preview, bundle, startup; edge middleware.ts fallback) and plan 02-10 (remote run).
4. **Delete `/api/cdn/storage` and `storage-range-proxy` in Phase 2?** With the verified-flag build as the only target it is dead code. Recommend delete with its tests once the final workers.dev build uses the media Worker; git history is the rollback. Koss/planner to confirm.
   - RESOLVED: Default applied: keep until Phase 3 (plan 02-09); Koss may veto at plan sign-off, then plan 02-19 removes it.
5. **Admin uploads from Safari get no variants.** Accept as is (original fallback) or add a wasm encoder later. Recommendation: accept now, note in the admin UI helper text, revisit if image weight matters.
   - RESOLVED: accepted with the permanent original fallback (plan 02-03) and the Safari helper text in the signed upload UI (plans 02-05, 02-17).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, scripts, tests | yes | v26.7.0 (wrangler needs >=22) | - |
| ffmpeg / ffprobe | faststart remux of hero MP4s | yes | /opt/homebrew/bin | - |
| Docker | local Supabase stack | yes | 29.8.2 | - |
| Supabase CLI | local stack for preview UAT | yes | /opt/homebrew/bin/supabase | - |
| wrangler / OpenNext CLI | build, preview, deploy | not probed (machine rule: no wrangler during research) | - | installed by npm in execution |
| pip / slopcheck | package legitimacy check | no (`pip` not found) | - | planner adds `checkpoint:human-verify` before install |
| Cloudflare account resources (R2 buckets, D1, workers.dev subdomain, tokens) | deploy | not probed (no account access in research) | - | owner numbered steps via pinned HOME |

**Missing dependencies with no fallback:** none for research; account resources are an owner step.
**Missing with fallback:** slopcheck (checkpoint).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (`node --test`) with `--experimental-strip-types` (Node v26.7.0 locally) |
| Config file | none (flags in `package.json` script `test:unit`); tests in `tests/unit/*.test.ts` |
| Quick run command | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/<file>.test.ts` |
| Full suite command | `npm run test:unit`; phase gate `npm run gate:local` (lint + unit + build) plus a new `npm run cf:build` (OpenNext build) added to the gate for this phase |

Design rule: put Worker logic in pure functions (`handleMediaRequest`, loader, cron path map, cron auth, rate-limit key, finalize validators, faststart box walker, variant planner) so `node --test` covers them with fake `R2Bucket` objects. Existing tests use this style (`r2-media-migration.test.ts`).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | Build succeeds with OpenNext; versions at floor | build | `npm run cf:build` | Wave 0 |
| PLAT-02 | Gate rules (signed-out redirect, non-admin refused, coming-soon, locale) | unit on extracted pure gate function + preview curl script | `npm run test:unit` (gate matrix) + `scripts/cf-check-gates.mjs --base http://127.0.0.1:8787` | Wave 0 |
| PLAT-03 | Edit visible <=10 s | preview e2e script: edit show on local Supabase, poll page | `scripts/cf-check-revalidate.mjs` | Wave 0 |
| PLAT-04 | Cron path map + auth; routes run on trigger | unit + `wrangler dev --test-scheduled` call | unit file + manual-scripted curl | Wave 0 |
| PLAT-05 | siteverify refusal, widget present, token passed | unit (fake fetch, Turnstile test secrets) + preview with local Supabase CAPTCHA on | unit file | Wave 0 |
| PLAT-06 | Beacon only when token set; CSP hosts present | unit (CSP string, component render) + manual dashboard check | unit file | Wave 0 |
| PLAT-07 | IP from `cf-connecting-ip`, fail closed on error/missing, constant-time compare | unit | unit file | Wave 0 |
| PLAT-08 | Deploy guard: whoami account match, stamp refuses preview/loopback builds | unit on guard function + dry run of guard script | unit file | Wave 0 |
| PLAT-09 | CPU table produced, per-route p50/p95/cold, subrequests | script + Workers Logs | `scripts/cf-measure-routes.mjs` then report file in phase dir | Wave 0 |
| MEDIA-01 | Presign shape; finalize validation; no body through action | unit (sign URL parse; fake `MEDIA`) + one live R2 round trip on workers.dev (owner step) | unit file | Wave 0 |
| MEDIA-03 copy | Dry-run report, idempotent re-run, checksums, variants | unit with fake S3 + sharp fixtures; then real `--execute` (owner step) | extend `r2-media-migration.test.ts` | Partly exists |
| MEDIA-04 | Loader picks nearest width; unchanged for YouTube/local; media Worker serves variant/original/304/206/HEAD/404/allowlist | unit | unit files | Wave 0 |
| MEDIA-05 | Faststart walker; Worker 206 + `Content-Range`, `Accept-Ranges` | unit + `curl -r 0-1023 -I` on media Worker | unit + curl | Wave 0 |
| MEDIA-06 | Finalize rejects SVG by magic bytes; Worker adds CSP/nosniff on SVG | unit | unit file | Wave 0 |
| PLAT-10 (code) | No `vercel`/`botid` strings left in src, config, package.json | grep check test | `node --test` file scanning repo | Wave 0 |

### Sampling Rate
- **Per task commit:** the quick command for the touched test file plus `npm run lint`.
- **Per wave merge:** `npm run test:unit` and `npm run cf:build`.
- **Phase gate:** `npm run gate:local` (with `cf:build`), clean-clone check by the control session, preview checks, then workers.dev checks (`curl -I` for media 200/206/304/404, signed-out redirect checks, CPU report) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/unit/media-worker.test.ts`, `image-loader.test.ts`, `faststart.test.ts`, `variant-plan.test.ts`, `presign.test.ts`, `upload-finalize.test.ts`, `cron-auth.test.ts`, `rate-limit.test.ts`, `turnstile.test.ts`, `deploy-guard.test.ts`, `no-vercel.test.ts`
- [ ] Rewrite `r2-media.test.ts` and `storage-range-proxy.test.ts` alongside the code they test (or delete with the code)
- [ ] `npm run cf:build`, `cf:build:preview`, `cf:build:workersdev`, `cf:deploy` scripts; `cf-typegen`
- [ ] Spike plan (first plan in the phase): `proxy.ts` on OpenNext 1.20.12 under `opennextjs-cloudflare preview`, bundle size and startup, CPU field name, `cf-connecting-ip` presence, cron local URL

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth unchanged; Turnstile (enforced by Supabase CAPTCHA at cutover); no new auth code |
| V3 Session Management | yes | `@supabase/ssr` cookies; check `Set-Cookie` and cache headers on Workers |
| V4 Access Control | yes | `proxy.ts` gates; presign/finalize check admin or owner; avatar key scoped to user id |
| V5 Input Validation | yes | zod (existing) + magic-byte check at finalize + key allowlist in media Worker (reject `..`, empty segments) |
| V6 Cryptography | yes | aws4fetch SigV4, `crypto.subtle` SHA-256 + `timingSafeEqual`; never hand-roll |
| V12/V13 Files and API | yes | R2 token scoped to the media bucket only; CORS limited to app origins; `nosniff`, SVG CSP; rate limits |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via SVG upload | Tampering | SVG rejected on upload; CSP `sandbox` + nosniff on any SVG served |
| Oversized or disguised upload via presigned PUT | DoS / Tampering | Finalize HEAD size cap, magic bytes, delete on failure, short expiry |
| Path traversal in media Worker key | Tampering / Info disclosure | Bucket allowlist, reject `.`/`..`/empty segments, never read other prefixes (`clickit-next-cache` is a different bucket and not bound) |
| Cron endpoint brute-force or timing | Spoofing | Hash then `timingSafeEqual`; also the route is only reachable with the Bearer |
| Rate-limit bypass via spoofed `X-Forwarded-For` | Spoofing | Use `CF-Connecting-IP` only; ignore client XFF; fail closed |
| Token replay on Turnstile | Spoofing | Single-use tokens; reset after failure; `siteverify` with `remoteip` |
| Secrets in build | Info disclosure | Only `NEXT_PUBLIC_*` public values at build; secrets via `wrangler secret`; no `.env` committed |
| Next advisories (Server Action DoS, `use cache` RCE, SVG optimizer RCE) | DoS / EoP | Upgrade to 16.4.1+, React 19.2.9, sharp >= 0.35.5; the repo does not use `use cache` or `next/og` |
| Cross-account deploy (Vamos login) | Tampering | `account_id` pinned; `HOME` pinned; `whoami` check in the deploy guard |

## Project Constraints (from CLAUDE.md)

- Stack: Next.js 16 App Router + Supabase + Tailwind v4 on Cloudflare Workers; video = YouTube embed only.
- Never wipe the live Supabase DB; live DB writes, DNS, secrets and emails to real people are owner-gated, one numbered step each. Secrets stay in Koss's terminal; never in chat or files.
- Koss signs discuss, plan, UAT and ship. The control session is the only one that commits to main and deploys; this is a work session (own branch/worktree).
- Cloudflare work only in the ClickitStory account, never the default (Vamos) wrangler login; `HOME=/Users/koss/.clickit-cloudflare`.
- Free tiers first; any paid Cloudflare feature is priced and agreed with Koss before enabling.
- Repo edits must start from a GSD workflow (`/gsd-execute-phase` for planned work); no direct edits outside GSD.
- Global: pricing is never invented; UI choices come with pictures; password fields get a show/hide eye (relevant if auth forms are touched for Turnstile); a shown control must work end to end; gates run locally (`gate:local`), no new CI minutes spent; PRs reviewed before Ship.
- Machine rules: one build at a time; detached long checks with an `exit=` line; Playwright workers <= 2; one local Supabase stack at a time.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-10-20): next 16.4.2, react 19.2.9 exists, @opennextjs/cloudflare 1.20.12 (peers), wrangler 4.151.2, @marsidev/react-turnstile 1.6.2, aws4fetch 1.0.20, sharp 0.35.5, @supabase/ssr 0.12.7 (peer supabase-js ^2.114.0), supabase-js 2.118.0, next-intl 4.14.9
- https://nextjs.org/blog/nextjs-security-update-october-14-2026 - advisories and fixed versions
- https://raw.githubusercontent.com/opennextjs/opennextjs-cloudflare/main/packages/cloudflare/CHANGELOG.md - 1.20.3 to 1.20.12
- https://opennext.js.org/cloudflare/caching , /howtos/custom-worker , /known-issues , /cli , /howtos/env-vars
- OpenNext source `d1-next-tag-cache.ts`, `populate-cache.ts` (table creation, R2 provisioning)
- https://github.com/opennextjs/opennextjs-cloudflare/issues (proxy.ts and Free-plan issue titles #1373, #1376, #1400, #1401, #1382, #1328)
- https://developers.cloudflare.com/workers/platform/limits/ and /pricing/ (Free limits, subrequests, CPU, startup, DO/D1/R2 free quotas)
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ and /workers-api-usage/ (get/head/onlyIf/range, docs example lacks 206)
- https://developers.cloudflare.com/r2/buckets/cors/ , /r2/examples/aws/aws4fetch/ , /r2/buckets/public-buckets/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ , /wrangler/configuration/ , /wrangler/commands/workers/ (tail flags), /routing/workers-dev/ , /runtime-apis/cache/ , /runtime-apis/web-crypto/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/ (test keys)
- https://github.com/supabase/auth `internal/api/middleware.go` (captcha disabled returns early)
- https://nextjs.org/docs/app/api-reference/config/next-config-js/images (loaderFile)
- https://sharp.pixelplumbing.com/api-output , /api-resize
- Repo reads: `next.config.ts`, `src/proxy.ts`, `src/lib/supabase-media.ts`, `src/lib/supabase/middleware.ts`, `scripts/migrate-supabase-media-to-r2.mjs`, `src/app/actions/contact.ts`, `src/app/api/cron/*`, `package.json`, `supabase/config.toml`, CONTEXT, CODE-SCAN, STACK.md, PITFALLS.md

### Secondary (MEDIUM confidence)
- https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/ (CPU/wall time in logs; field names not given)
- https://developers.cloudflare.com/web-analytics/get-started/ and /web-analytics-spa/
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob (PNG fallback); caniuse WebP `toBlob` (Safari unsupported, through 26.5; read via search results)
- https://github.com/supabase/ssr/releases (0.12.3 to 0.12.7)
- https://github.com/vercel/next.js/releases/tag/v16.4.2

### Tertiary (LOW confidence)
- Third-party `cf-logs` tool for the `$workers.cpuTimeMs` field name
- Web Analytics on `workers.dev` hostnames: no source found either way
- Cache API behaviour on workers.dev: current docs silent; older project notes say no-op

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for versions (registry read today), MEDIUM for compatibility of Next 16.4.2 with this repo until the spike runs
- Architecture: MEDIUM-HIGH; media Worker, presign and cron patterns are from official docs; Free-plan CPU outcome is unknown until measured
- Pitfalls: MEDIUM-HIGH; repo-specific ones come from direct code reads

**Research date:** 2026-10-20
**Valid until:** 2026-10-27 (OpenNext and Next are shipping every few days; re-run `npm view` for `@opennextjs/cloudflare` and `next` on the execution day)
