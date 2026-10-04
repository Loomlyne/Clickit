<!-- GSD:project-start source:PROJECT.md -->
## Project

**Clickit Story (CIT)**

A Netflix-style streaming platform for Clickit Story, a UAE digital media company (Spacelight Studios FZ LLC, Abu Dhabi) with 15 original programs. Viewers sign up, discover a show, pick an episode and watch it through an embedded YouTube player; two admins (Issam Dridi, Nejib Challakhi) upload to YouTube and connect episodes to the platform. This milestone takes the live app off Vercel onto Cloudflare + Supabase and finishes it for production.

**Core Value:** A signed-in viewer opens a show and an episode from YouTube plays immediately, with progress remembered — and the admin can put a whole YouTube season on the platform from one playlist link.

### Constraints

- **Stack**: Next.js 16 App Router + Supabase (auth + Postgres) + Tailwind v4, hosted on Cloudflare Workers — client and Koss's standard stack
- **Video**: YouTube embed only — no video hosting cost or infrastructure
- **Data safety**: never wipe the live Supabase DB; live DB writes, DNS, secrets, emails to real people are owner-gated, one numbered step each
- **Process**: Koss signs discuss, plan, UAT and ship; this session is the control session (only one that commits to main and deploys)
- **Accounts**: Cloudflare work only in the ClickitStory account; never the default (Vamos) wrangler login
- **Cost**: free tiers first; any paid Cloudflare feature (Images) priced and agreed with Koss before enabling
- **Timeline**: no fixed date — order by risk
<!-- GSD:project-end -->

## Deployment Notes

- **Vercel deploys silently block on git author identity — and the obvious fix is paywalled.** All commits push as GitHub user `Loomlyne` (`223640340+Loomlyne@users.noreply.github.com`), which is not a member of the `clickit-s-projects` Vercel team that owns this project. Builds succeed fine (`readyState: READY` on the build sub-resource within seconds), but the deployment itself sits at `readyState: BLOCKED` and never promotes to production — indefinitely, not just slow. Reproduces identically via git push or `vercel deploy --prod` from the CLI. Confirmed in the dashboard: deployments show "Blocked" with tooltip "loomlyne is not a member of this team." `clickit-s-projects` is on the free **Hobby plan**, which caps the team at one member and gates "Invite Members" behind a Pro upgrade — so the obvious fix (add Loomlyne to the team) isn't available without paying. `clickitstory@gmail.com` also has no GitHub account connected. Real options: (1) upgrade to Pro and invite `koussay.zayani0@gmail.com`, or (2) connect a GitHub identity to `clickitstory@gmail.com`'s Vercel account, add it as a `Loomlyne/Clickit` collaborator, and switch git's local push credentials to it. Deployment Protection ("Vercel Authentication") is a separate, unrelated setting on this project — it gates viewing raw `*.vercel.app` URLs, not this.
- **`vercel ls`/`vercel inspect` human-readable output always shows `UNKNOWN` status** for this project's access token — it can list deployments/URLs but not resolve the real state in that view. Use `vercel inspect <url> --format json` to see the actual `readyState`.
- Raw `https://clickit-xxxxx-clickit-s-projects.vercel.app` per-deployment URLs are gated behind Vercel's own auth (return HTTP 200 serving a "Redirecting..." login page, not real app content) — checking status codes against them proves nothing. Verify against the real production domain (`www.clickitstory.ae`) instead.

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Headline findings (read these first)
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended | Confidence |
|---|---|---|---|---|
| `next` | **16.3.8** (from ^16.2.9) | Framework | Required by the OpenNext peer range. Fixes CVE-2026-94545. OpenNext 1.20.7 patched the 16.3 `loadCustomCacheHandlers` crash that caused site-wide 500s, and 1.20.3 patched the 16.3 Turbopack wasm and instrumentation chunks. Use the exact version the adapter is tested against. | HIGH |
| `@opennextjs/cloudflare` | **1.20.8** | Next to Workers adapter | The only maintained adapter for Next 16 on Workers. Runs the Node.js runtime, not edge-only like the dead `next-on-pages`. Supports App Router, server actions, ISR, `revalidatePath`/`revalidateTag`/`updateTag`, `'use cache'`, `after()`, PPR, Turbopack, and `proxy.ts` (1.20.3+). | HIGH |
| `wrangler` (dev) | **4.147.0** (peer `^4.125.0`) | Deploy, bindings, local runtime | Required by OpenNext. **Needs Node >= 22** (`engines.node`), so CI must use Node 22 or 24. | HIGH |
| Workers compat | `compatibility_date` = current date at setup (e.g. `2026-10-01`); flags `["nodejs_compat", "global_fetch_strictly_public"]` | Runtime | `nodejs_compat` is mandatory for OpenNext and for `proxy.ts`. The date must be >= 2024-09-23. `global_fetch_strictly_public` is in the OpenNext template. | HIGH |
| Cloudflare R2 | n/a | (a) public media bucket, (b) private Next incremental cache bucket | Free tier: 10 GB-month, 1M Class A, 10M Class B, zero egress. Use **two separate buckets** so the cache bucket is never public. | HIGH |
| Cloudflare D1 | n/a | Next tag cache (`NEXT_TAG_CACHE_D1`) plus app rate limits | Free: 5M rows read/day, 100k writes/day, 5 GB. Use the OpenNext "small site" recommendation (`d1NextTagCache`). The D1 tag cache stores `stale`/`expire` per tag (source read), so Next 16 `revalidateTag(tag, profile)` and `updateTag` semantics are preserved. | HIGH |
| Durable Objects (SQLite) | n/a | `DOQueueHandler`, the ISR time-based revalidation queue | Recommended by OpenNext for production. SQLite-backed DOs work on Free and Paid. Declare with `new_sqlite_classes`. | HIGH |
| Cloudflare Queues | n/a | App email fan-out (new-episode alerts, welcome, support copies) | Available on Workers Free (10k ops/day, 24 h retention) and Paid (1M ops/month, 4-14 day retention). Consumer invocations get 15 min CPU on Paid. | HIGH |
| Cron Triggers | n/a | Replace `vercel.json` crons (`0 1 * * *` publish, `0 4 * * 1` cleanup) | Free 5 per account, Paid 250. Cron times are UTC, the same as Vercel, so the existing schedules carry over unchanged. | HIGH |
### Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---|---|---|---|---|
| `aws4fetch` | **1.0.20** | Presign R2 `PUT` URLs inside the Worker | Only for minting presigned upload URLs (SigV4 over `fetch` + `SubtleCrypto`, about 2.5 KB). This is Cloudflare's documented Workers approach. All other server-side R2 access uses the **R2 binding** (`env.MEDIA.put/get/delete/list`), which needs no credentials. | HIGH |
| `@aws-sdk/client-s3` | 3.1146.0 | Node scripts only (`scripts/migrate-supabase-media-to-r2.mjs`, `upload-compressed-hero-videos.mjs`) | Move to **devDependencies**. Delete it from `src/lib/r2-media-core.ts` and rewrite that file on the R2 binding. Keeping it out of the Worker saves bundle size and startup time. | HIGH |
| `@marsidev/react-turnstile` | **1.6.1** | Turnstile widget | The library Supabase's own CAPTCHA docs recommend. Use it on sign-in, sign-up, OTP request, password reset, contact and newsletter. | HIGH |
| `resend` | **6.32.0** | App emails from Workers (welcome, alerts, support, newsletter) | Fetch-based, so it works on Workers. Use `resend.batch.send()` (up to 100 per call) and `idempotencyKey` (24 h) in the queue consumer. Replace the hand-rolled `fetch` in `src/lib/resend.ts` so you get typed errors, batching and idempotency. | HIGH |
| `react-email` | **6.11.0** | Email templates (EN + AR, RTL) | Single package in v6: components plus `render()`/`pretty()`. Templates live in `src/emails/`. Also used to export static HTML for the Supabase auth templates (see Auth email). | HIGH |
| `@react-email/ui` (dev) | latest, pin with `-E` | `email dev` preview server | Local preview only. Never imported by the app. | MEDIUM |
| `standardwebhooks` | **1.1.1** | Verify Supabase Send Email Hook signatures | Only if you take the hook route (see Auth email). It is already a transitive dependency of `resend`. | HIGH |
| `@supabase/ssr` | **0.12.7** (from 0.10) | SSR auth cookies | Optional but recommended in the platform phase. 0.12 "passes cache headers to `setAll` to prevent CDN caching of auth responses". That matters once Cloudflare cache and the R2 ISR cache sit in front of the app. Requires `@supabase/supabase-js >= 2.114` (latest 2.117.2). | MEDIUM |
| `@cloudflare/workers-types` or `wrangler types` | 5.20261004.x | Types for `CloudflareEnv` | Prefer generated types: `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`. | HIGH |
### Development Tools
| Tool | Purpose | Notes |
|---|---|---|
| `opennextjs-cloudflare build` / `preview` / `deploy` / `upload` | Build and ship | `preview` runs the real `workerd` runtime locally. Run it before every Ship, not just `next dev`. `deploy` also **populates the R2 incremental cache and D1 tag table**, so a bare `wrangler deploy` is not enough. |
| `initOpenNextCloudflareForDev()` in `next.config.ts` | Bindings during `next dev` | Local simulations of R2, D1 and Queues. The DO queue warns locally ("will not work in local development"). The warning is harmless. |
| `wrangler dev --test-scheduled` | Test cron locally | Hit `/__scheduled?cron=0+1+*+*+*`. |
| GitHub Actions: `actions/checkout@v7` (7.0.1), `actions/setup-node@v7` (7.0.0), `cloudflare/wrangler-action@v4` (4.1.3) | CI + deploy | Versions read from GitHub releases on 2026-10-04. Cloudflare's own example still pins `checkout@v6`; v7 is current. |
| Workers Logs (`observability.enabled: true`) | Prod logging and CPU time per invocation | Replaces Vercel logs. Shows CPU ms, which you need for the Free vs Paid decision. |
## Capability-by-capability configuration
### 1. Next 16.3 on Workers via OpenNext
- Do **not** set `bypassTagCacheOnCacheHit: true` unless you also wire `cachePurge`. Otherwise admin edits (55 `revalidatePath` + 43 `updateTag` calls) serve stale content for up to 30 min from the regional cache. 1.20.0 also fixed a `BucketCachePurge` bug that silently skipped purges, which shows this path is fragile. Start without the bypass. **HIGH**.
- `unstable_cache` (25 calls) goes through the incremental cache (R2) and is invalidated through the tag cache (D1). Nothing in app code changes. **MEDIUM**: this is how OpenNext's data cache works, but the docs page does not name `unstable_cache` explicitly. Prove it in UAT by editing a show and seeing it update.
- `refresh()` (15 calls) is client-router only and does not depend on the adapter.
- Remove `withBotId`, `botid`, `@vercel/analytics`, `@vercel/speed-insights`, `vercel.json`, and the `va.vercel-scripts.com` / `vercel.live` / `*.vercel-insights.com` CSP entries.
- Add `initOpenNextCloudflareForDev()`.
- `experimental.serverActions.bodySizeLimit: '55mb'` becomes `'2mb'` or the default. Uploads go direct to R2, so big bodies never reach the Worker. Workers accept 100 MB request bodies on the Cloudflare Free and Pro zone plans; that limit depends on the zone plan, not the Workers plan.
- `images.minimumCacheTTL` is ignored by OpenNext. Drop it when switching to the custom loader.
- Add `public/_headers` with `/_next/static/*  Cache-Control: public,max-age=31536000,immutable`. The Worker does not run in front of static assets, so the `headers()` in `next.config.ts` does **not** apply to `_next/static` or `public/`, including the `/brand/*` rule. Move that rule into `_headers` too.
- Remove every `export const runtime = "edge"` (none found today).
| Limit | Free | Paid |
|---|---|---|
| CPU per request | 10 ms | 30 s default, 5 min max |
| CPU per cron | 10 ms | 30 s (< 1 h interval) / 15 min (>= 1 h) |
| Worker size | 64 MiB uncompressed | 64 MiB |
| Startup time | 1 s | 1 s |
| Subrequests | 50 | 10,000 |
| Memory | 128 MB | 128 MB |
| Request body | 100 MB (zone Free/Pro) | same |
| Requests | 100k/day | 10M/month incl. |
### 2. R2: direct uploads, public media domain, video
- **Bucket `clickit-media`** has a public **custom domain `media.clickitstory.ae`** (zone on Cloudflare). **Disable `r2.dev`.** Custom domain is required for caching, WAF and Image Transformations. **HIGH**.
- **Direct upload flow:**
- **Bucket CORS** must allow `PUT` from `https://www.clickitstory.ae` (and `http://localhost:3000` for dev) with header `Content-Type`. Set it with `wrangler r2 bucket cors set clickit-media --file r2-cors.json`. The CORS requirement is HIGH; the exact command syntax is MEDIUM, so check it with `wrangler r2 bucket cors --help`.
- **R2 API token:** create an Object Read & Write token scoped to **`clickit-media` only**. Store it as Worker secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`. Never `NEXT_PUBLIC_`.
- **Video:** hero MP4s on the media domain. R2 serves `Range` requests, and the Cloudflare CDN caches `.mp4` by default up to 512 MB per file on the Free plan. Encode with `ffmpeg ... -movflags +faststart` so playback starts before the full download. Add `media.clickitstory.ae` to CSP `media-src` and `img-src`. **MEDIUM** (cache extension list and range-from-cache behaviour are from Cloudflare cache docs and general knowledge, not re-verified line by line).
### 3. Images without sharp
- **Same billing.** Both draw on the 5,000 unique transformations per month free.
- **Graceful over-quota behaviour.** `format=auto` counts once. Over quota, `onerror=redirect` serves the original instead of `9422`. That fallback only works when source and transform share a zone.
- **No Worker invocation.** CDN-cached, so no Worker CPU or requests are spent on images.
- Trim `deviceSizes` to about `[640, 1080, 1920]` and `imageSizes` to `[256, 384]` to bound unique transforms. Estimate: about 400 artworks x 5 widths is about 2,000 per month.
- In the zone Transformations settings, allow only own-zone origins so other sites cannot spend the quota.
- **Remove `sharp`** (native module, cannot run in workerd). The upload step stores the original (JPEG/PNG/WebP). Delivery converts format. Cap upload size client-side (for example 15 MB).
- **Confidence:** MEDIUM-HIGH. Loader pattern, pricing and `onerror` rule are from docs. Zone setting names are from general knowledge.
### 4. Turnstile + Web Analytics
- **Auth forms (sign-in, sign-up, OTP request, reset):** enable **Supabase Auth > Attack Protection > CAPTCHA = Turnstile** with the secret key. Pass the widget token as `options.captchaToken` to `signInWithPassword`, `signUp`, `signInWithOtp` and `resetPasswordForEmail`. Supabase verifies it server-side. **Do not also call siteverify yourself on these.** Tokens are **single-use**, valid for 300 s, and a second check fails with `timeout-or-duplicate`. **HIGH**.
- **Contact and newsletter server actions:** the widget puts the token in the form field `cf-turnstile-response`. The action calls `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `{ secret, response, remoteip, idempotency_key }`. `remoteip` comes from the `cf-connecting-ip` header. Use that same header for the rate limiter, which fixes "rate limiter IP source". **HIGH**.
- After any failed submit, call `turnstile.reset()`, because the token has already been consumed.
- CSP additions: `script-src https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`.
- **Web Analytics:** use the **manual JS beacon** (`https://static.cloudflareinsights.com/beacon.min.js` with `data-cf-beacon='{"token":"...","spa":true}'`) through `next/script` in the root layout. Do not use automatic injection. Automatic injection depends on the proxy rewriting HTML and fails on `no-transform`. The strict CSP also has to allow the beacon explicitly: `script-src https://static.cloudflareinsights.com`, `connect-src https://cloudflareinsights.com`. **MEDIUM** (manual vs automatic setup is in the docs; the `spa` flag and CSP hosts are from general knowledge).
### 5. Auth email: OTP + password, Resend, EN + AR
- **OTP and password together:** keep email+password. Add `signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } })` and `verifyOtp({ email, token, type: "email" })`.
- **Delivery, recommended: Resend SMTP in Supabase.**
- **Alternative: Supabase Send Email Hook (HTTP) pointing at a Worker route.**
- **App emails** (welcome, new-episode alerts with unsubscribe, support auto-reply + admin copy, newsletter confirmation):
- **Resend account:**
### 6. YouTube Data API v3 (playlist import)
- `playlistItems.list` with `part=snippet,contentDetails,status`, `playlistId`, `maxResults=50`, paging with `pageToken`. Then `videos.list` with `part=snippet,contentDetails,status` and `id=<up to 50 comma-separated>`. Use `contentDetails.duration` (ISO-8601, e.g. `PT24M3S`; parse with a small regex because date-fns has no ISO-duration parser).
- **Quota:** both calls cost **1 unit**. The default is 10,000 units/day for non-search endpoints (search has its own 100 calls/day bucket). A 50-episode season costs 2 units. **HIGH** (Google docs).
- Filter out "Private video" and "Deleted video" items, and anything with `status.privacyStatus != "public"` or `"unlisted"`. `snippet.thumbnails.maxres` is often missing, so fall back to `standard`, then `high`.
- **Key handling:** Worker secret `YOUTUBE_API_KEY`. Restrict the key to **YouTube Data API v3 only**. IP and referrer restrictions do not work for Worker egress. Rotate the old key, which is a known item.
- YouTube API Services policy limits how long stored API data may be kept without refreshing (about 30 days for some fields). Consider a monthly metadata refresh in the cleanup cron. **LOW**: policy detail not re-verified.
### 7. GitHub Actions CI + deploy (public repo)
- **`ci.yml`** on `pull_request` and `push` to `main`: Node 22, `npm ci`, `lint`, `tsc --noEmit`, `test:unit`, `opennextjs-cloudflare build`. That runs `next build` **and** the Workers transform, so adapter breakages are caught in the PR.
- **`deploy.yml`** on `workflow_dispatch` (or push to `main`) with `environment: production` and **required reviewer = Koss**. That puts Koss's Ship approval inside GitHub. Steps: build, then `npx opennextjs-cloudflare deploy` (it populates the R2 cache and D1 tags). Use `cloudflare/wrangler-action@v4` only if you need its secret-sync features. Running the OpenNext CLI directly with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env is simpler.
- **API token:** "Edit Cloudflare Workers" template plus R2 and D1 edit, scoped to the **ClickitStory account** and the `clickitstory.ae` zone only.
- **Runtime secrets** (Supabase service role, Resend, Turnstile secret, YouTube key, R2 keys, CRON_SECRET) are set once with `wrangler secret put` / `wrangler secret bulk` by Koss in his terminal. They never go into GitHub. Per his rule: one numbered step, then wait.
- The existing `.github/workflows/supabase-migrations.yml` stays. Check that it cannot auto-apply to the live DB without the same gate.
## Installation
# Upgrade first (gating)
# Cloudflare adapter + runtime libs
# Dev
# Move to dev (scripts only)
# Remove
# package.json scripts
#   "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
#   "deploy":  "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
#   "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
#   "email:dev": "email dev --dir src/emails"
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| R2 incremental cache + regional cache | Workers KV incremental cache | Never here. OpenNext itself advises against KV because it is eventually consistent (up to 60 s), so admin edits would appear late. |
| D1 tag cache (`d1NextTagCache`) | `doShardedTagCache` + cache purge | Only at high traffic. It needs 3 DO classes and purge wiring, which is overkill at 15 shows and 3 users. |
| DO queue | Memory queue | Staging or low-traffic single-IP only (OpenNext guidance). Revalidations are not deduplicated across isolates. |
| `/cdn-cgi/image` custom loader | `IMAGES` binding + default `/_next/image` | If media ever lives outside `clickitstory.ae`. The binding works for any origin but cannot fall back on `9422` and runs through the Worker every time. |
| `aws4fetch` presign | `@aws-sdk/s3-request-presigner` in the Worker | Not worth it. It works under `nodejs_compat` but adds far more bundle weight and startup time for one signature. |
| Resend SMTP in Supabase | Send Email Hook to Worker + React Email | If bilingual Go templates get unmanageable, or you need per-user dynamic content beyond `user_metadata`. |
| D1 for rate limits | Workers Rate Limiting binding (`ratelimits`) | Burst protection only. Periods are 10 s or 60 s only, and counts are per Cloudflare location, not global, so it cannot express "5 per hour per email". |
| `proxy.ts` (Node runtime) | Rename back to `middleware.ts` (edge runtime, deprecated in Next 16 but still supported) | Fallback if the experimental OpenNext Node-middleware bundling breaks `next-intl` or Supabase cookie refresh in `preview`. Edge middleware has been supported by OpenNext for longer. |
| GitHub Actions deploy | Cloudflare Workers Builds (Git integration) | If Koss prefers a dashboard. But Builds deploys on every push to main, which does not match the "Koss signs Ship" gate as cleanly as a GitHub environment approval. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| `next` 16.2.x / < 16.3.8 | Outside the OpenNext peer range. CVE-2026-94545 range per the OpenNext CHANGELOG. | `next@16.3.8` |
| `@cloudflare/next-on-pages` | Edge-runtime only and superseded. No `proxy.ts` / Node runtime. | `@opennextjs/cloudflare` |
| `sharp` | Native binary that cannot run in workerd and fails the Worker bundle. | Cloudflare Image Transformations (`/cdn-cgi/image`) |
| `@aws-sdk/client-s3` in Worker code | Heavy bundle and slower startup, now that the 1 s startup limit is the binding constraint. | R2 binding + `aws4fetch` for presign |
| `botid`, `@vercel/analytics`, `@vercel/speed-insights` | Vercel-only and no-ops off Vercel. | Turnstile, Cloudflare Web Analytics |
| `@react-email/components` | Deprecated on npm. | `react-email` v6 |
| `export const runtime = "edge"` | Not supported by OpenNext. | Default Node runtime |
| r2.dev public URL in production | No cache, WAF or transformations; rate-limited dev URL. | `media.clickitstory.ae` custom domain; disable r2.dev |
| Presigned URLs on the custom domain | Not supported; signatures only work on `r2.cloudflarestorage.com`. | Sign against the S3 endpoint |
| Double Turnstile verification (yours + Supabase) | Tokens are single-use, so the second check always fails. | Supabase CAPTCHA for auth; own siteverify for contact and newsletter |
| `pull_request_target` in a public repo | Exposes secrets to fork code. | `pull_request` + Actions Variables for public build values |
| `bodySizeLimit: '55mb'` server actions | Uploads should never transit the Worker. | Presigned direct-to-R2 PUT |
| Unpinned `account_id` in `wrangler.jsonc` | Koss's default wrangler login is Vamos, so it would deploy to the wrong account. | Pin `e329b099...`, separate `HOME` |
## Stack Patterns by Variant
- Expect `Error 1102 exceeded CPU` on SSR pages, especially the 4,230-line admin actions and the catalog pages. The publish cron also gets only 10 ms CPU.
- Mitigations: make every viewer page ISR/cached so most hits are R2 cache reads, which use little CPU. Even so, auth-gated pages ("sign-up required for everything except landing") are per-user dynamic, so this will not hold. **Recommend Paid as a precondition of the platform phase.**
- Send new-episode alerts as a **daily digest** per user, not one email per episode, and cap the batch. Auth OTPs have priority. Otherwise move to Pro ($20/mo, 50k/month, no daily cap). Pricing decision for Koss.
- Rename it to `middleware.ts` (edge). Keep the logic. Remove anything Node-only (none expected: next-intl middleware and `@supabase/ssr` are edge-safe).
## Version Compatibility
| Package A | Compatible With | Notes |
|---|---|---|
| `@opennextjs/cloudflare@1.20.8` | `next >=16.3.8`, `wrangler ^4.125.0`, `@opennextjs/aws@4.1.7` (bundled dep) | Optional peer `rclone.js` only for `--rclone` cache upload; not needed. |
| `wrangler@4.147.0` | Node >= 22 | CI `setup-node` must be 22 or 24. |
| `next@16.3.8` | `react`/`react-dom ^19` (19.2.4 OK; 19.3.0 latest), `babel-plugin-react-compiler` | `reactCompiler: true` keeps working. 16.3 offers an experimental Rust compiler (`turbopackRustReactCompiler`); do not enable it in this milestone. |
| `next-intl@4.14.9` (latest) | `next ^16` | Bump from 4.9.1 alongside Next for 16.3 fixes. MEDIUM. |
| `@supabase/ssr@0.12.7` | `@supabase/supabase-js ^2.114.0` | Upgrade both together. |
| `react-email@6.11.0` | `react ^19`, `@react-email/render >=2.1.0` | Includes the `email` CLI. Its heavy CLI deps (esbuild, socket.io) are not imported at runtime, but confirm Worker startup after adding it. |
| D1 tag cache | OpenNext >= 1.19.6 | `populateCache` adds `stale`/`expire` columns for SWR. Always deploy through `opennextjs-cloudflare deploy` so migrations run. |
## Open items needing Koss's decision (pricing / accounts)
## Sources
- npm registry, queried 2026-10-04: versions and peer ranges of `@opennextjs/cloudflare`, `next`, `wrangler`, `aws4fetch`, `resend`, `react-email`, `@react-email/components` (deprecated), `@marsidev/react-turnstile`, `@supabase/ssr`, `@supabase/supabase-js`, `standardwebhooks`. HIGH
- https://github.com/opennextjs/opennextjs-cloudflare/blob/main/packages/cloudflare/CHANGELOG.md: 1.20.3 `proxy.ts` support, 1.20.7 CVE floor and 16.3 cache-handler fix, 1.20.8 floor 16.3.8, 1.20.0 purge fix. HIGH
- OpenNext source (`packages/cloudflare/src`): D1 tag cache stale/expire, image handler behaviour without `IMAGES`, no Cache API on image responses. HIGH
- https://opennext.js.org/cloudflare (caching, get-started, custom-worker, image, bindings, env-vars). HIGH for config; stale on size limits and Node middleware.
- https://developers.cloudflare.com/workers/platform/limits/ (updated 2026-09-05) and /workers/platform/pricing/ (2026-10-02). HIGH
- https://developers.cloudflare.com/images/pricing/ (2026-07-08): 5,000 free, 9422, `onerror`, binding billing. HIGH
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/, /r2/examples/aws/aws4fetch/, /r2/buckets/public-buckets/, /r2/pricing/. HIGH
- https://developers.cloudflare.com/queues/platform/pricing/, /durable-objects/platform/pricing/, /d1/platform/pricing/, /workers/runtime-apis/bindings/rate-limit/. HIGH
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (2026-09-16). HIGH
- https://developers.cloudflare.com/web-analytics/get-started/. MEDIUM (manual-snippet details)
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ (2026-09-18); GitHub releases for checkout/setup-node/wrangler-action. HIGH
- https://supabase.com/docs/guides/auth/auth-email-passwordless, /auth-email-templates, /auth-smtp, /auth-captcha, /auth-hooks, /auth-hooks/send-email-hook; supabase CLI config template (`otp_length`). HIGH
- https://resend.com/docs/send-with-supabase-smtp, /send-with-cloudflare-workers, https://resend.com/pricing. HIGH
- https://react.email/docs/getting-started/manual-setup, /utilities/render. HIGH
- https://developers.google.com/youtube/v3/determine_quota_cost. HIGH
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy, https://nextjs.org/blog/next-16-3. HIGH
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->
