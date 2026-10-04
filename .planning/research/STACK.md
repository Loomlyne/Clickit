# Stack Research

**Domain:** YouTube-backed streaming platform (Next.js 16 App Router + Supabase) moving from Vercel to Cloudflare Workers
**Researched:** 2026-10-04
**Confidence:** HIGH for versions, limits, pricing and OpenNext config (npm registry, Cloudflare docs dated Sep-Oct 2026, OpenNext CHANGELOG and source read directly). MEDIUM where noted.

Scope: only what must be added or changed for the milestone. The existing app stack (Next 16, React 19.2, Supabase, Tailwind v4, next-intl, shadcn, motion, embla, zod, react-hook-form) stays.

---

## Headline findings (read these first)

1. **Next.js must move from 16.2.9 to 16.3.8 before anything else.** `@opennextjs/cloudflare@1.20.8` (released 2026-10-02) declares `peerDependencies.next: ">=15.5.27 <16 || >=16.3.8"`. Its CHANGELOG says Next 16.2.0 through 16.3.5 have a critical `next/og` remote code execution bug (CVE-2026-94545). The live app runs 16.2.9. A grep of `src/` found no `next/og` / `ImageResponse` use, so the live risk is probably low. The adapter still will not install cleanly without the upgrade. **HIGH** (npm registry + CHANGELOG). I could not find the CVE in the GitHub Advisory DB. The detail is MEDIUM; the version floor is HIGH.
2. **`src/proxy.ts` works on Workers only from OpenNext 1.20.3, and it is flagged experimental.** Next 16 `proxy.ts` always runs on the Node.js runtime. OpenNext added "Node.js middleware (`proxy.ts`)" bundling in 1.20.3, which needs `nodejs_compat`. The OpenNext docs site (last commit May 2026) still says Node middleware is "not yet supported". It is stale; trust the CHANGELOG. **HIGH** for "supported in 1.20.3+", **MEDIUM** for "stable in practice".
3. **The 3 MiB / 10 MiB Worker size limit is gone.** As of Sep 2026, Cloudflare's limits page lists Worker size as **64 MiB uncompressed on both Free and Paid**, with "no compressed size limit". The OpenNext docs still quote 3/10 MiB and are stale. The limit that bites now is **startup time: 1 second** on both plans. **HIGH**.
4. **The Workers Free plan cannot run this app. Workers Paid ($5/month) is effectively required.** Free gives 10 ms CPU per request and per cron run. Cloudflare's own page says SSR and auth workloads "typically use 10-20 ms". Paid gives 30 s by default (up to 5 min), 15 min per cron or queue invocation, and 10M requests plus 30M CPU-ms included. **This is a pricing decision. Koss must agree before anyone builds on it** (his "pricing: discuss first" rule). **HIGH**.
5. **Image optimisation: use a custom `next/image` loader that points at `/cdn-cgi/image/` on the R2 media domain. Do not use the Worker `IMAGES` binding.** Both bill against the same free quota of 5,000 unique transformations per month. The free tier is hard-capped: no charge, but new transforms return error `9422`. Only same-zone `/cdn-cgi/image` supports `onerror=redirect`, which falls back to the original image instead of breaking. Its output is also cached by the CDN, so the Worker is never invoked for images. Remove `sharp` entirely. **MEDIUM-HIGH**.
6. **`@react-email/components` is deprecated on npm.** React Email 6 ships everything from the single `react-email` package (`import { Html, Button, render } from "react-email"`). **HIGH**.
7. **Resend Free is 100 emails/day and 3,000/month.** Supabase auth emails sent through Resend SMTP count toward the same quota as new-episode alerts. Alerts to My List users will hit the daily cap fast. Pro is $20/month. **Pricing decision for Koss.** **HIGH** (resend.com/pricing).

---

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

---

## Capability-by-capability configuration

### 1. Next 16.3 on Workers via OpenNext

**`open-next.config.ts`** (OpenNext "small site using revalidation" guideline, verbatim pattern):

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  tagCache: d1NextTagCache,
  enableCacheInterception: true, // turn OFF if PPR / cacheComponents is ever enabled
});
```

- Do **not** set `bypassTagCacheOnCacheHit: true` unless you also wire `cachePurge`. Otherwise admin edits (55 `revalidatePath` + 43 `updateTag` calls) serve stale content for up to 30 min from the regional cache. 1.20.0 also fixed a `BucketCachePurge` bug that silently skipped purges, which shows this path is fragile. Start without the bypass. **HIGH**.
- `unstable_cache` (25 calls) goes through the incremental cache (R2) and is invalidated through the tag cache (D1). Nothing in app code changes. **MEDIUM**: this is how OpenNext's data cache works, but the docs page does not name `unstable_cache` explicitly. Prove it in UAT by editing a show and seeing it update.
- `refresh()` (15 calls) is client-router only and does not depend on the adapter.

**`wrangler.jsonc`** (shape; names are recommendations):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "clickit",
  "account_id": "e329b099b6e4272fc0915a99832e47fe", // pin it: Koss's default wrangler login is the Vamos account
  "main": "./custom-worker.ts",                      // wraps .open-next/worker.js (cron + queue)
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true },
  "routes": [{ "pattern": "www.clickitstory.ae", "custom_domain": true }],
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "clickit" }],
  "r2_buckets": [
    { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "clickit-next-cache" },
    { "binding": "MEDIA", "bucket_name": "clickit-media" }
  ],
  "d1_databases": [
    { "binding": "NEXT_TAG_CACHE_D1", "database_name": "clickit-tag-cache", "database_id": "<id>" },
    { "binding": "APP_DB", "database_name": "clickit-app", "database_id": "<id>" } // rate limits
  ],
  "durable_objects": { "bindings": [{ "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["DOQueueHandler"] }],
  "queues": {
    "producers": [{ "binding": "EMAIL_QUEUE", "queue": "clickit-email" }],
    "consumers": [{ "queue": "clickit-email", "max_batch_size": 10, "max_retries": 5, "dead_letter_queue": "clickit-email-dlq" }]
  },
  "triggers": { "crons": ["0 1 * * *", "0 4 * * 1"] },
  "vars": { "NEXT_PUBLIC_MEDIA_ORIGIN": "https://media.clickitstory.ae" }
}
```

Pin `account_id`. Koss's CLAUDE.md warns that unpinned configs deploy to whichever login is active, and the default login is Vamos. Use `HOME=/Users/koss/.clickit-cloudflare` locally and the CI token scoped to the ClickitStory account only.

**`custom-worker.ts`** (cron + queue). The cron handler should **call the existing Next route handlers through the fetch handler**, not reimplement them. `revalidatePath`/`updateTag` only work inside a Next request context:

```ts
// @ts-expect-error generated at build time
import { default as handler } from "./.open-next/worker.js";
export { DOQueueHandler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    const path = event.cron === "0 1 * * *" ? "/api/cron/publish-scheduled" : "/api/cron/cleanup-media";
    const req = new Request(`https://www.clickitstory.ae${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
  async queue(batch, env) { /* render react-email, resend.batch.send(), msg.ack()/retry() */ },
} satisfies ExportedHandler<CloudflareEnv>;
```

Pattern from the OpenNext "custom worker" how-to (HIGH). Calling the route through `handler.fetch` is a design recommendation (MEDIUM). Compare the bearer with a constant-time check (`crypto.subtle.timingSafeEqual`). This is already on the hardening list as "cron secret compare".

**`next.config.ts` changes:**
- Remove `withBotId`, `botid`, `@vercel/analytics`, `@vercel/speed-insights`, `vercel.json`, and the `va.vercel-scripts.com` / `vercel.live` / `*.vercel-insights.com` CSP entries.
- Add `initOpenNextCloudflareForDev()`.
- `experimental.serverActions.bodySizeLimit: '55mb'` becomes `'2mb'` or the default. Uploads go direct to R2, so big bodies never reach the Worker. Workers accept 100 MB request bodies on the Cloudflare Free and Pro zone plans; that limit depends on the zone plan, not the Workers plan.
- `images.minimumCacheTTL` is ignored by OpenNext. Drop it when switching to the custom loader.
- Add `public/_headers` with `/_next/static/*  Cache-Control: public,max-age=31536000,immutable`. The Worker does not run in front of static assets, so the `headers()` in `next.config.ts` does **not** apply to `_next/static` or `public/`, including the `/brand/*` rule. Move that rule into `_headers` too.
- Remove every `export const runtime = "edge"` (none found today).

**Environment variables:** OpenNext exposes Worker vars and secrets on `process.env`, so existing `process.env.X` reads keep working. Bindings come from `getCloudflareContext().env`; use `{ async: true }` in SSG paths. `NEXT_PUBLIC_*` values are **inlined at build time**, so they must exist in the CI build environment, not only as Worker vars. **HIGH**.

**Limits that matter here (Cloudflare docs, Sep 2026):**

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

The 50-subrequest cap on Free also breaks the admin import and cron paths: each Supabase query, YouTube call and R2 op counts as one.

### 2. R2: direct uploads, public media domain, video

- **Bucket `clickit-media`** has a public **custom domain `media.clickitstory.ae`** (zone on Cloudflare). **Disable `r2.dev`.** Custom domain is required for caching, WAF and Image Transformations. **HIGH**.
- **Direct upload flow:**
  1. Admin server action checks admin, validates type and size, mints a key.
  2. `aws4fetch` signs a `PUT` to `https://<account>.r2.cloudflarestorage.com/clickit-media/<key>?X-Amz-Expires=600` with `signQuery: true`, and includes `Content-Type` in the signature.
  3. The browser `PUT`s the file straight to R2.
  4. A finalize action `HEAD`s the object through the `MEDIA` binding and writes the URL to Supabase.

  Facts that shape this:
  - Presigned URLs only work on the `r2.cloudflarestorage.com` S3 endpoint, **not on custom domains**.
  - Expiry can be 1 s to 7 days.
  - PUT, GET, HEAD and DELETE are supported; **POST form uploads are not**.
  - If the client sends a different Content-Type than the one signed, R2 returns 403 `SignatureDoesNotMatch`.

  **HIGH**.
- **Bucket CORS** must allow `PUT` from `https://www.clickitstory.ae` (and `http://localhost:3000` for dev) with header `Content-Type`. Set it with `wrangler r2 bucket cors set clickit-media --file r2-cors.json`. The CORS requirement is HIGH; the exact command syntax is MEDIUM, so check it with `wrangler r2 bucket cors --help`.
- **R2 API token:** create an Object Read & Write token scoped to **`clickit-media` only**. Store it as Worker secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`. Never `NEXT_PUBLIC_`.
- **Video:** hero MP4s on the media domain. R2 serves `Range` requests, and the Cloudflare CDN caches `.mp4` by default up to 512 MB per file on the Free plan. Encode with `ffmpeg ... -movflags +faststart` so playback starts before the full download. Add `media.clickitstory.ae` to CSP `media-src` and `img-src`. **MEDIUM** (cache extension list and range-from-cache behaviour are from Cloudflare cache docs and general knowledge, not re-verified line by line).

### 3. Images without sharp

**Recommended: global custom loader to Cloudflare Image Transformations on the media zone.**

```ts
// image-loader.ts  (next.config: images: { loader: "custom", loaderFile: "./image-loader.ts" })
export default function cfLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("https://i.ytimg.com") || src.startsWith("https://img.youtube.com")) return src; // already sized by YouTube
  const path = src.replace("https://media.clickitstory.ae/", "");
  return `https://media.clickitstory.ae/cdn-cgi/image/width=${width},quality=${quality ?? 80},format=auto,onerror=redirect/${path}`;
}
```

Why this over the `IMAGES` binding with the default `/_next/image`:

- **Same billing.** Both draw on the 5,000 unique transformations per month free.
- **Graceful over-quota behaviour.** `format=auto` counts once. Over quota, `onerror=redirect` serves the original instead of `9422`. That fallback only works when source and transform share a zone.
- **No Worker invocation.** CDN-cached, so no Worker CPU or requests are spent on images.

Also:
- Trim `deviceSizes` to about `[640, 1080, 1920]` and `imageSizes` to `[256, 384]` to bound unique transforms. Estimate: about 400 artworks x 5 widths is about 2,000 per month.
- In the zone Transformations settings, allow only own-zone origins so other sites cannot spend the quota.
- **Remove `sharp`** (native module, cannot run in workerd). The upload step stores the original (JPEG/PNG/WebP). Delivery converts format. Cap upload size client-side (for example 15 MB).
- **Confidence:** MEDIUM-HIGH. Loader pattern, pricing and `onerror` rule are from docs. Zone setting names are from general knowledge.

Images Free is free and hard-capped, so it is not a paid feature. **Images Paid** ($0.50 per 1,000 over 5k) would be one, so ask Koss before enabling it.

### 4. Turnstile + Web Analytics

- **Auth forms (sign-in, sign-up, OTP request, reset):** enable **Supabase Auth > Attack Protection > CAPTCHA = Turnstile** with the secret key. Pass the widget token as `options.captchaToken` to `signInWithPassword`, `signUp`, `signInWithOtp` and `resetPasswordForEmail`. Supabase verifies it server-side. **Do not also call siteverify yourself on these.** Tokens are **single-use**, valid for 300 s, and a second check fails with `timeout-or-duplicate`. **HIGH**.
- **Contact and newsletter server actions:** the widget puts the token in the form field `cf-turnstile-response`. The action calls `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `{ secret, response, remoteip, idempotency_key }`. `remoteip` comes from the `cf-connecting-ip` header. Use that same header for the rate limiter, which fixes "rate limiter IP source". **HIGH**.
- After any failed submit, call `turnstile.reset()`, because the token has already been consumed.
- CSP additions: `script-src https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`.
- **Web Analytics:** use the **manual JS beacon** (`https://static.cloudflareinsights.com/beacon.min.js` with `data-cf-beacon='{"token":"...","spa":true}'`) through `next/script` in the root layout. Do not use automatic injection. Automatic injection depends on the proxy rewriting HTML and fails on `no-transform`. The strict CSP also has to allow the beacon explicitly: `script-src https://static.cloudflareinsights.com`, `connect-src https://cloudflareinsights.com`. **MEDIUM** (manual vs automatic setup is in the docs; the `spa` flag and CSP hosts are from general knowledge).

### 5. Auth email: OTP + password, Resend, EN + AR

- **OTP and password together:** keep email+password. Add `signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } })` and `verifyOtp({ email, token, type: "email" })`.
  - The **Magic Link template must contain `{{ .Token }}`**. That turns it into a 6-digit code; without it Supabase sends a link.
  - Length is configurable (`otp_length`, default 6). Check the hosted project's "Email OTP Length" reads 6.
  - Expiry: default 1 h, one request per 60 s. **That expiry setting also governs confirmation, recovery and email-change links.** Do not shorten it below about 15 min.
  - **HIGH**.
- **Delivery, recommended: Resend SMTP in Supabase.**
  - Settings: `smtp.resend.com:465`, user `resend`, password = a Resend API key **dedicated to Supabase**, sender `Clickit Story <no-reply@clickitstory.ae>`.
  - Supabase applies 30 emails/hour after custom SMTP is enabled. Raise it on the Rate Limits page.
  - Bilingual: one template per email type, branching on `{{ if eq .Data.locale "ar" }} ... {{ else }} ... {{ end }}`. `.Data` is `user_metadata`, so write `locale` at sign-up and whenever the user switches language.
  - Author the templates in React Email, `email export` to HTML with the Go placeholders as literal text, then push them through the Management API (`mailer_templates_*` / `mailer_subjects_*`) so they are versioned in git.
  - Why SMTP over the hook: auth email keeps working even if the Worker is down or misconfigured, and there is no code in the auth path.
  - **HIGH** (Supabase + Resend docs).
- **Alternative: Supabase Send Email Hook (HTTP) pointing at a Worker route.**
  - Free plan. Payload includes `user`, `email_data.token`, `token_hash`, `email_action_type` and `redirect_to`. Signed per Standard Webhooks; verify with `standardwebhooks`.
  - Pick this only if Go-template conditionals become unmanageable or per-locale subjects are required. Note that subjects can also use `.Data` conditionals.
  - Respond fast and send inline. Do not enqueue: an OTP sitting in a queue is a bad sign-in experience.
  - **HIGH** for the hook spec. **LOW** for the hook timeout (not found in docs; assume a few seconds).
- **App emails** (welcome, new-episode alerts with unsubscribe, support auto-reply + admin copy, newsletter confirmation):
  - Producer: a server action or cron does `env.EMAIL_QUEUE.send({...})`.
  - Consumer: the `queue()` handler renders `react-email` with `render()` and calls `resend.batch.send()` with up to 100 per call, using `idempotencyKey: "<type>/<entity-id>/<user-id>"`.
  - Configure a DLQ.
  - Resend allows 10 requests/s per team; batching keeps you far below that.
  - Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers to alert emails.
  - **HIGH** for the APIs, **MEDIUM** for the design.
- **Resend account:**
  - Free allows **3 domains**. Koss's account may already be full (Vamos, Invios...). Check before planning.
  - `clickitstory.ae` needs SPF, DKIM and DMARC records in Cloudflare DNS (none exist yet).
  - A separate subdomain such as `mail.clickitstory.ae` for marketing-type alerts keeps auth sending reputation apart. Supabase recommends this.

### 6. YouTube Data API v3 (playlist import)

- `playlistItems.list` with `part=snippet,contentDetails,status`, `playlistId`, `maxResults=50`, paging with `pageToken`. Then `videos.list` with `part=snippet,contentDetails,status` and `id=<up to 50 comma-separated>`. Use `contentDetails.duration` (ISO-8601, e.g. `PT24M3S`; parse with a small regex because date-fns has no ISO-duration parser).
- **Quota:** both calls cost **1 unit**. The default is 10,000 units/day for non-search endpoints (search has its own 100 calls/day bucket). A 50-episode season costs 2 units. **HIGH** (Google docs).
- Filter out "Private video" and "Deleted video" items, and anything with `status.privacyStatus != "public"` or `"unlisted"`. `snippet.thumbnails.maxres` is often missing, so fall back to `standard`, then `high`.
- **Key handling:** Worker secret `YOUTUBE_API_KEY`. Restrict the key to **YouTube Data API v3 only**. IP and referrer restrictions do not work for Worker egress. Rotate the old key, which is a known item.
- YouTube API Services policy limits how long stored API data may be kept without refreshing (about 30 days for some fields). Consider a monthly metadata refresh in the cleanup cron. **LOW**: policy detail not re-verified.

### 7. GitHub Actions CI + deploy (public repo)

- **`ci.yml`** on `pull_request` and `push` to `main`: Node 22, `npm ci`, `lint`, `tsc --noEmit`, `test:unit`, `opennextjs-cloudflare build`. That runs `next build` **and** the Workers transform, so adapter breakages are caught in the PR.
  - Use `pull_request`, **never `pull_request_target`**, because this is a public repo and fork PRs must not see secrets.
  - Build-time `NEXT_PUBLIC_*` values (Supabase URL, publishable key, Turnstile site key, media origin, analytics token) are public by design. Store them as **GitHub Actions Variables**, not Secrets, so fork PRs can build too.
- **`deploy.yml`** on `workflow_dispatch` (or push to `main`) with `environment: production` and **required reviewer = Koss**. That puts Koss's Ship approval inside GitHub. Steps: build, then `npx opennextjs-cloudflare deploy` (it populates the R2 cache and D1 tags). Use `cloudflare/wrangler-action@v4` only if you need its secret-sync features. Running the OpenNext CLI directly with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env is simpler.
- **API token:** "Edit Cloudflare Workers" template plus R2 and D1 edit, scoped to the **ClickitStory account** and the `clickitstory.ae` zone only.
- **Runtime secrets** (Supabase service role, Resend, Turnstile secret, YouTube key, R2 keys, CRON_SECRET) are set once with `wrangler secret put` / `wrangler secret bulk` by Koss in his terminal. They never go into GitHub. Per his rule: one numbered step, then wait.
- The existing `.github/workflows/supabase-migrations.yml` stays. Check that it cannot auto-apply to the live DB without the same gate.

---

## Installation

```bash
# Upgrade first (gating)
npm install next@16.3.8 eslint-config-next@16.3.8 @next/bundle-analyzer@16.3.8

# Cloudflare adapter + runtime libs
npm install @opennextjs/cloudflare@1.20.8 aws4fetch@1.0.20 @marsidev/react-turnstile@1.6.1 resend@6.32.0 react-email@6.11.0
npm install @supabase/ssr@0.12.7 @supabase/supabase-js@2.117.2   # recommended, test auth flows

# Dev
npm install -D wrangler@4.147.0 @react-email/ui -E

# Move to dev (scripts only)
npm uninstall @aws-sdk/client-s3 && npm install -D @aws-sdk/client-s3

# Remove
npm uninstall sharp botid @vercel/analytics @vercel/speed-insights

# package.json scripts
#   "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
#   "deploy":  "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
#   "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
#   "email:dev": "email dev --dir src/emails"
```

Add `.open-next/`, `.wrangler/` and `.dev.vars` to `.gitignore`.

---

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

**If Koss declines Workers Paid ($5/mo):**
- Expect `Error 1102 exceeded CPU` on SSR pages, especially the 4,230-line admin actions and the catalog pages. The publish cron also gets only 10 ms CPU.
- Mitigations: make every viewer page ISR/cached so most hits are R2 cache reads, which use little CPU. Even so, auth-gated pages ("sign-up required for everything except landing") are per-user dynamic, so this will not hold. **Recommend Paid as a precondition of the platform phase.**

**If Resend stays on Free (100/day):**
- Send new-episode alerts as a **daily digest** per user, not one email per episode, and cap the batch. Auth OTPs have priority. Otherwise move to Pro ($20/mo, 50k/month, no daily cap). Pricing decision for Koss.

**If `proxy.ts` misbehaves under `opennextjs-cloudflare preview`:**
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

1. Workers Paid, $5/month: effectively required (CPU 10 ms on Free).
2. Resend plan: Free 100/day vs Pro $20/month, plus a free domain slot in his existing account (max 3 on Free).
3. Images Paid: only if more than 5,000 unique transforms per month are ever needed. Not expected.

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

---
*Stack research for: Clickit Story, Vercel to Cloudflare Workers migration milestone*
*Researched: 2026-10-04*
