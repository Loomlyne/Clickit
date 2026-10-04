# Architecture Research

**Domain:** Next.js 16 streaming catalog moving from Vercel to Cloudflare Workers (OpenNext), Supabase remains system of record
**Researched:** 2026-10-04
**Confidence:** MEDIUM overall. Cloudflare and OpenNext bindings are HIGH (official docs). Next.js 16 `proxy.ts` on OpenNext is MEDIUM-LOW (experimental upstream). Live DB state (which migrations are applied) is NOT verified; read-only check needed.

## Standard Architecture

### System Overview

```
                         Browser (viewer / admin)
            │ HTML, RSC, Server Actions            │ PUT (presigned)     │ GET media
            ▼                                       ▼                     ▼
┌──────────────────────────────────────┐   ┌──────────────────┐  ┌───────────────────────┐
│ Worker "clickit" (custom-worker.ts)  │   │ R2 S3 endpoint   │  │ media.clickitstory.ae │
│  fetch  → .open-next/worker.js       │   │ <acct>.r2.cloud- │  │ (R2 custom domain,    │
│           proxy.ts → routes/actions  │   │ flarestorage.com │  │  edge cache, Range)   │
│  scheduled → fetch(/api/cron/*)      │   └────────┬─────────┘  └──────────┬────────────┘
│  queue  → email consumer             │            │                       │
└──┬──────┬──────┬──────┬──────┬───────┘            └──────────┬────────────┘
   │      │      │      │      │                               ▼
   │      │      │      │      │                     R2 bucket clickit-media (public)
   │      │      │      │      └─ MEDIA binding (head/list/delete/put) ──────┘
   │      │      │      └──── EMAIL_QUEUE (producer + consumer, same Worker)
   │      │      └─────────── NEXT_TAG_CACHE_D1 + RATE_LIMIT rows (D1 clickit-edge)
   │      └────────────────── NEXT_INC_CACHE_R2_BUCKET (R2 clickit-next-cache, private)
   │                          NEXT_CACHE_DO_QUEUE (Durable Object, time-based revalidation)
   ▼
 External (HTTPS fetch from Worker)
   Supabase lajguozmtissnnfccmej  — Postgres + Auth + RLS (system of record)
   Resend API                      — app-event email (welcome, new episode, support, newsletter)
   YouTube Data API v3             — playlistItems.list, videos.list (admin only)
   Turnstile siteverify            — auth + contact + newsletter

 Supabase Auth ── custom SMTP (smtp.resend.com) ──► Resend ──► viewer inbox   (auth emails; no Worker in path)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `custom-worker.ts` | Single Worker entry. Re-exports OpenNext `fetch`, adds `scheduled` and `queue` handlers, re-exports `DOQueueHandler` | OpenNext "custom worker" pattern; `wrangler.jsonc` `main` points here |
| OpenNext fetch handler | Next.js 16 App Router: pages, RSC, Server Actions, `/api/*` routes, `proxy.ts` gate | `@opennextjs/cloudflare`, `nodejs_compat` flag |
| `proxy.ts` | i18n routing, Supabase session refresh, coming-soon gate, auth gate, admin gate | Existing file; drop BotID branch; admin check reads `admins` table |
| Incremental cache | `unstable_cache` data (26+ calls, 900s/3600s revalidate) and ISR output | R2 bucket `clickit-next-cache` via `NEXT_INC_CACHE_R2_BUCKET`, wrapped in regional cache |
| Tag cache | `updateTag` / `revalidateTag` / `revalidatePath` from admin actions and cron | D1 `NEXT_TAG_CACHE_D1` (`D1NextModeTagCache`) |
| Revalidation queue | Time-based revalidation of stale entries | Durable Object `NEXT_CACHE_DO_QUEUE` (SQLite-backed; available on Free plan) |
| Media store | All images, avatars, hero/preloader MP4 | R2 bucket `clickit-media`, public only through `media.clickitstory.ae` (r2.dev disabled) |
| Upload signer | Issues short-lived presigned PUT URLs after an auth/admin check | Server action + `aws4fetch` (`signQuery: true`) with an R2 API token scoped to `clickit-media` |
| Upload finalizer | Verifies object (`MEDIA.head`), writes URL to Supabase, audit log, `updateTag` | Server action using R2 binding + service-role Supabase client |
| Cron jobs | Publish scheduled episodes; sweep orphan media | Cron Triggers → `scheduled()` → in-process call of the existing `/api/cron/*` routes |
| Email producer | Enqueues app events (`welcome`, `episode.published`, `support.received`, `newsletter.confirm`) | `env.EMAIL_QUEUE.send()` from actions/routes |
| Email consumer | Renders EN/AR template, sends via Resend, records send for idempotency | `queue()` handler in `custom-worker.ts`, Resend REST (existing `src/lib/resend.ts`) |
| Auth email | Signup confirm, OTP code, recovery, email change | Supabase Auth custom SMTP → Resend; Go templates branch on `{{ .Data.locale }}` |
| Admin authority | Who is an admin | `public.admins` table + `private.is_admin()` used by every RLS policy and by `proxy.ts` |
| YouTube importer | Playlist → season's episodes; single link → one episode | Server actions, `YOUTUBE_API_KEY` Worker secret, preview-then-commit |
| Rate limiter | Per-IP / per-email windows for auth, contact, newsletter | D1 table `rate_limits`, key from `cf-connecting-ip` |

## Worker Bindings (wrangler.jsonc)

| Binding | Type | Name / target | Notes |
|---------|------|---------------|-------|
| `NEXT_INC_CACHE_R2_BUCKET` | R2 | `clickit-next-cache` | Private. Never the media bucket. |
| `MEDIA` | R2 | `clickit-media` | Public via custom domain only. |
| `NEXT_TAG_CACHE_D1` | D1 | `clickit-edge` | Holds OpenNext `revalidations` table + app `rate_limits` table (separate migrations dir `d1/migrations`). |
| `NEXT_CACHE_DO_QUEUE` | Durable Object | class `DOQueueHandler` | Needs `migrations: [{ tag: "v1", new_sqlite_classes: ["DOQueueHandler"] }]`. |
| `EMAIL_QUEUE` | Queue producer + consumer | `clickit-email` (+ DLQ `clickit-email-dlq`) | Queues on Workers Free since 2026-02-04: 10k ops/day, 24h retention. |
| `IMAGES` | Images | — | **Not bound by default.** Only if Koss approves (see Images decision below). |
| `ASSETS` | Static assets | `.open-next/assets` | Generated by OpenNext. |
| `WORKER_SELF_REFERENCE` | Service | `clickit` | OpenNext uses it for cache population/revalidation. |
| Crons | `triggers.crons` | `"0 * * * *"` publish, `"0 4 * * 1"` media sweep | Free plan allows 5 per account. Hourly publish is now possible (Vercel Hobby forced daily). |
| Vars (plain) | `vars` | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_ORIGIN=https://media.clickitstory.ae`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `NEXT_PUBLIC_*` are **inlined at build time**: they must also be in the CI build env, not only in Worker vars. |
| Secrets | `wrangler secret put` | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `YOUTUBE_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `TURNSTILE_SECRET_KEY`, `UNSUBSCRIBE_SIGNING_SECRET`, `CRON_SECRET` | Set by Koss in his terminal (`HOME=/Users/koss/.clickit-cloudflare`). OpenNext exposes string bindings on `process.env`, so existing `process.env.X` reads keep working. |

Compatibility: `compatibility_flags: ["nodejs_compat"]`, `compatibility_date` current. Typed env: `wrangler types` → `cloudflare-env.d.ts`.

Access pattern in app code (one wrapper, never scatter `getCloudflareContext` calls):

```typescript
// src/server/cloudflare.ts
import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'
export function cf() {
  const { env, ctx } = getCloudflareContext()
  return { env: env as CloudflareEnv, waitUntil: ctx.waitUntil.bind(ctx) }
}
```

`open-next.config.ts`:

```typescript
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache'
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache'
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue'

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: 'long-lived', bypassTagCacheOnCacheHit: true }),
  tagCache: d1NextTagCache,
  queue: doQueue,
})
```
(Import paths for tag cache / queue overrides: verify against the installed `@opennextjs/cloudflare` version at implementation time — MEDIUM.)

## Recommended Project Structure

```
custom-worker.ts              # fetch (OpenNext) + scheduled + queue; re-export DOQueueHandler
open-next.config.ts           # R2 incremental cache, D1 tag cache, DO queue
wrangler.jsonc                # bindings above; account_id e329b099… pinned
cloudflare-env.d.ts           # generated by `wrangler types`
d1/migrations/                # D1-only SQL (rate_limits); OpenNext table per its docs
src/server/
├── cloudflare.ts             # cf(): env + waitUntil
├── admin/guard.ts            # requireAdmin(): getUser + admins lookup (one place)
├── media/
│   ├── keys.ts               # key builder: <bucket>/<entity>/<uuid>.<ext>; path rules
│   ├── presign.ts            # aws4fetch presigned PUT (content-type + cache-control signed)
│   ├── finalize.ts           # MEDIA.head verify → DB write → audit → updateTag
│   └── url.ts                # MEDIA_ORIGIN + key ↔ URL; replaces supabase-media.ts after cutover
├── email/
│   ├── events.ts             # zod schemas for queue messages (discriminated union)
│   ├── produce.ts            # enqueue(event)
│   ├── consume.ts            # queue() batch handler
│   ├── templates/{en,ar}/    # welcome, new-episode, support-ack, support-admin, newsletter-confirm
│   └── unsubscribe.ts        # HMAC token sign/verify
├── jobs/
│   ├── publish-scheduled.ts  # pure: returns {episodeIds, showSlugs}; route does revalidate + enqueue
│   └── cleanup-media.ts      # pure: R2 list vs DB references
├── youtube/
│   ├── client.ts             # playlistItems.list / videos.list, ISO-8601 duration parse
│   └── import.ts             # preview() and commit() for a season
└── ratelimit.ts              # D1 window counter, key from cf-connecting-ip
src/app/[locale]/admin/actions/   # split of the 4,230-line actions.ts by domain:
    shows.ts seasons.ts episodes.ts media.ts settings.ts youtube.ts ...
```

### Structure Rationale

- **`src/server/*`** keeps Cloudflare-specific code behind small modules so the 4,230-line `admin/actions.ts` stops touching storage SDKs directly. Splitting `actions.ts` is a side effect of replacing every `admin.storage.upload(...)` call (about 12 call sites) with presign/finalize; do the split in the same phase.
- **`jobs/*` pure functions** let the same logic run from the cron route, a manual admin "run now" button, and unit tests.
- **`custom-worker.ts` at root** because OpenNext's generated `.open-next/worker.js` is build output and must not be edited.

## Architectural Patterns

### Pattern 1: Presigned PUT → R2 → finalize → DB URL

**What:** Browser never sends file bytes through a Server Action. Admin (or viewer for avatar) asks for a signed URL, PUTs straight to R2, then calls finalize which verifies and records.
**Why here:** Removes the 55 MB `serverActions.bodySizeLimit`; Worker CPU stays tiny; `sharp` (native, cannot run on Workers) is removed.

```
1. Client picks file → client-side resize/encode (canvas → WebP, fixed widths) for rasters;
   MP4 is pre-compressed offline (ffmpeg, scripts/upload-compressed-hero-videos.mjs).
2. action requestUpload({ kind:'show-poster', showId, contentType, size })
     requireAdmin() | for avatars: auth.uid() only
     validate contentType allowlist + size cap per kind
     key = show-artwork/<showId>/<uuid>.webp           (immutable, never overwritten)
     url = presign PUT (expires 300s, signs content-type + cache-control: public, max-age=31536000, immutable)
     → { url, key }
3. Browser PUT url (R2 bucket CORS: origin https://www.clickitstory.ae, PUT, Content-Type, Cache-Control)
4. action finalizeUpload({ kind, showId, key })
     requireAdmin(); key must match expected prefix for kind/entity
     head = env.MEDIA.head(key) → exists, size ≤ cap, contentType matches
     UPDATE shows SET poster_url = MEDIA_ORIGIN + '/' + key  (service role)
     insert admin_audit_log; updateTag('shows')
     old key → left for the weekly sweep (no synchronous delete, no rollback juggling)
```
**Trade-offs:** Orphans exist if a user abandons between 3 and 4; the weekly `cleanup-media` sweep deletes R2 keys older than 24 h that no DB column references. This replaces the copy-backup/rollback machinery in `r2-media-core.ts` (which assumed dual-write to Supabase + R2); that file and `@aws-sdk/client-s3` go away (aws4fetch is ~a few KB and is what Cloudflare documents for presigning).

**SVG:** keep SVG logos only via `<img>` (scripts do not execute in `<img>`), serve from the separate media subdomain, and add a Transform Rule on `media.clickitstory.ae` setting `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` and `X-Content-Type-Options: nosniff`. Sanitizer fix is still required (known defect) but no longer the only defense.

### Pattern 2: Cron → `scheduled()` → in-process call of the existing route

**What:** Cron Trigger fires `scheduled()`, which calls the OpenNext fetch handler directly with a synthetic Request to `/api/cron/publish-scheduled`. No network self-fetch.
**Why:** `updateTag` / `revalidatePath` need Next's request context; running the route through the handler keeps that. Self-fetching the Worker's own custom domain from inside the Worker is unreliable, and the in-process call avoids it.

```typescript
// custom-worker.ts
import { default as handler } from './.open-next/worker.js'
const CRON_ROUTES: Record<string, string> = {
  '0 * * * *': '/api/cron/publish-scheduled',
  '0 4 * * 1': '/api/cron/cleanup-media',
}
export default {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    const path = CRON_ROUTES[event.cron]
    if (!path) return
    const req = new Request(`https://www.clickitstory.ae${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    })
    ctx.waitUntil(handler.fetch(req, env, ctx))
  },
  async queue(batch, env, ctx) { /* email consumer, see Pattern 3 */ },
} satisfies ExportedHandler<CloudflareEnv>
export { DOQueueHandler } from './.open-next/worker.js'
```
Route keeps the Bearer check (fix to constant-time compare, known defect) so the route can still be hit manually. Cron times are UTC: `0 1 * * *` was 05:00 Dubai; going hourly is safe because the route is idempotent and viewer-facing liveness is already computed lazily (`isEpisodeLive`).

### Pattern 3: App events → Queue → Resend (idempotent consumer)

**What:** Actions enqueue small typed messages; the consumer does the slow, failure-prone work.

| Event | Producer | Consumer action | Idempotency |
|-------|----------|-----------------|-------------|
| `welcome` | First successful sign-in after confirm (auth callback / verifyOtp action) | 1 email in profile locale | `UPDATE profiles SET welcome_sent_at=now() WHERE id=$1 AND welcome_sent_at IS NULL RETURNING` before enqueue |
| `episode.published` | `publish-scheduled` route and admin "publish now" | Fan out to users whose watchlist contains the show and who have not unsubscribed; Resend batch endpoint (≤100 per call) | `notification_sends` unique (`episode_id`, `user_id`); insert-then-send |
| `support.received` | contact action | Auto-reply to sender + admin copy to every row in `admins` (Reply-To = sender) | message id in the queue body; `support_messages.ack_sent_at` |
| `newsletter.confirm` | newsletter action | Double opt-in link (HMAC token) | `newsletter_subscribers.confirm_sent_at` |

- Consumer: `max_batch_size` ~10, `max_retries` 3, DLQ `clickit-email-dlq`; call `msg.ack()` per message, `msg.retry({ delaySeconds })` on 429/5xx.
- Unsubscribe: HMAC-signed link plus `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers; `/api/email/unsubscribe` route flips `profiles.notify_new_episodes=false`. Required for bulk-sender compliance (Gmail/Yahoo).
- Recipient emails come from Supabase via service role inside the consumer, not inside the queue message (keeps PII out of queue storage; 24 h retention on Free).
- Volume reality: 3 users today. Resend free tier limits (100/day, 3,000/month at the time of writing — verify on Resend's pricing page) matter only once fan-out grows; flag to Koss before turning on alerts at scale. Do not decide a plan.

### Pattern 4: Auth email via Supabase custom SMTP (not the Send Email Hook)

**What:** Supabase Auth → SMTP `smtp.resend.com:465`, user `resend`, password = a Resend API key restricted to sending on `clickitstory.ae`, sender `Clickit Story <no-reply@clickitstory.ae>`. Templates (Confirm signup, Magic Link / OTP, Reset password, Change email, Reauthentication) edited in Supabase with Go templates:

```
{{ if eq .Data.locale "ar" }}<div dir="rtl">رمز الدخول: {{ .Token }}</div>{{ else }}Your sign-in code: {{ .Token }}{{ end }}
```
**Why SMTP over the Send Email Hook:** auth email keeps working even if the Worker is broken mid-cutover; no webhook secret or endpoint to maintain; `{{ .Token }}` gives the 6-digit code for email OTP and `{{ .Data }}` exposes `user_metadata` for language. Requirement: sign-up writes `options.data.locale`; users without it get English.
**Switch to the hook only if** templates need shared React components with app emails. The hook fully replaces SMTP when enabled (Supabase docs).
**Also:** raise Supabase Auth email rate limit (custom-SMTP default is low, ~30/hour) and set leaked-password protection on (advisor finding).

### Pattern 5: `admins` table + `private.is_admin()`

The repo already contains `20260724115941_restrict_public_episode_access.sql`, which creates `private.is_admin()` (still reading `app_config.admin_user_id`) and rewrites every policy from `public.is_admin()` to `private.is_admin()`. **Whether it is applied on live is unknown** (schema drift is a listed defect). First step: read-only `supabase migration list` / `select to_regprocedure('private.is_admin()')` on live.

Target (expand → contract, each step safe for the code still running on Vercel):

```sql
-- EXPAND (safe while old code runs)
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid references auth.users(id)
);
alter table public.admins enable row level security;
-- no policies: only service_role and SECURITY DEFINER functions read it
insert into public.admins(user_id)
  select admin_user_id from public.app_config where id = 1 and admin_user_id is not null;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
$$;
-- policies already call private.is_admin(); body swap needs no policy rewrite
```
- App side: one `requireAdmin()` used by `proxy.ts` (`checkIsAdmin`), `/api/youtube-meta`, and every admin action. `private` is not exposed to PostgREST, so `requireAdmin()` does not use RPC; it uses the service-role client: `select 1 from admins where user_id = $uid`.
- Second admin: Nejib signs up normally, then Koss runs one numbered owner-gated `insert into public.admins` (live DB write).
- Audit log already stores `admin_user_id` per row, so "who did what" works once both admins have accounts.
- CONTRACT (after cutover is proven and no deployed code reads it): drop `app_config.admin_user_id` and `app_config.youtube_api_key`.

### Pattern 6: YouTube playlist import (preview, then commit)

```
admin pastes playlist URL
  → action previewPlaylist(url, seasonId)  [requireAdmin]
      parse list= id (server-side regex; reject anything else)
      playlistItems.list part=contentDetails maxResults=50, follow nextPageToken
      videos.list id=<≤50 ids> part=snippet,contentDetails,status
      map: title, description, thumbnails.maxres|high, ISO-8601 duration → seconds,
           position → episode_number; flag private/deleted/already-imported
      → return preview rows (nothing written)
  → admin edits/deselects → action commitImport(seasonId, rows)
      re-validate every video id (11 chars [A-Za-z0-9_-]) on the server
      upsert episodes on unique (season_id, youtube_video_id); status = draft unless chosen
      audit log; updateTag('episodes'); revalidatePath series page
```
- Key: `YOUTUBE_API_KEY` Worker secret; restrict in Google Cloud to "YouTube Data API v3" only (IP restriction is not workable from Workers egress). Old key (was in `app_config`, possibly exposed via Data API) is revoked by Koss in Google Cloud.
- Quota: `playlistItems.list` and `videos.list` cost 1 unit each per call; a 30-episode season is ~2 calls. Default 10,000/day is ample.
- Thumbnails stay on `i.ytimg.com` (no copy to R2); next/image for them should be `unoptimized` (already optimized by YouTube) to save transformation budget.
- Also drop/limit the anon-callable SECURITY DEFINER `get_public_youtube_video_id` (advisor finding) as part of this phase.

## Data Flow

### Request flow (viewer page)

```
GET www.clickitstory.ae/en/series/x
  → Worker fetch → proxy.ts: next-intl → updateSession (Supabase Auth, cookies)
        → getAppConfig (cached, tag site-config) → coming-soon / auth gate
  → RSC render → queries.ts unstable_cache
        hit:  regional cache → R2 clickit-next-cache (tag freshness checked in D1)
        miss: Supabase PostgREST (anon/authenticated, RLS) → write R2
  → HTML with <img src="https://media.clickitstory.ae/show-artwork/...">  (served by R2 edge, not the Worker)
```

### Mutation flow (admin)

```
Admin action → requireAdmin → Supabase (service role) write → admin_audit_log
            → updateTag(tag) → D1 revalidations row → next read of that tag misses → refetch
            → (optional) EMAIL_QUEUE.send(...)
```

### Key Data Flows

1. **Upload:** browser → presign action → R2 S3 endpoint (PUT) → finalize action → `MEDIA.head` → Supabase URL column → tag invalidation.
2. **Scheduled publish:** Cron → `scheduled()` → route → Supabase update → `updateTag('episodes','shows')` → `EMAIL_QUEUE` `episode.published` → consumer → Resend.
3. **Auth email:** Supabase Auth → SMTP → Resend → inbox (Worker not involved).
4. **YouTube import:** admin → preview action → YouTube API → preview UI → commit action → Supabase upsert.
5. **Media read:** browser → `media.clickitstory.ae` → Cloudflare cache → R2 (Range requests native, so `/api/cdn/storage` range proxy is deleted).

## One-time Media Migration (86 Supabase Storage objects)

URL scheme: **`https://media.clickitstory.ae/<supabase-bucket>/<original-key>`**. This keeps the layout the existing `scripts/migrate-supabase-media-to-r2.mjs` and `toPublicR2MediaUrl()` already use, so the DB rewrite is a pure prefix replace:

`https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/` → `https://media.clickitstory.ae/`

DB keeps absolute URLs (as today) — fewer code changes than switching to key-only columns.

Steps:
1. R2 bucket `clickit-media` + custom domain `media.clickitstory.ae` live (requires the zone on Cloudflare — R2 custom domains need the domain as a zone in the same account; partial CNAME setup needs a Business plan, so the NS move comes first).
2. Koss runs the script in his terminal (manifest, then `--execute`): copies all 86 objects, verifies size + sha256. Re-runnable for deltas.
3. Inventory SQL (read-only) across every `text`/`jsonb` column for `supabase.co/storage/v1/object/public` (known: shows poster/hero/logo/card_image/hero_video, categories.cover_url, profiles.avatar_url, shorts.thumbnail_url, show_cast.image_url, app_config favicon/preloader/hero/etc.; also check legal/FAQ HTML and portfolio JSON).
4. Migration: create `ops.media_url_backup(table_name, column_name, pk, old_value)`, copy every affected value, then `UPDATE ... SET col = replace(col, <old prefix>, <new prefix>)`. Read back: zero rows still match the old prefix; backup row count = updated count.
5. Proof window (Koss chooses length). During it Supabase Storage stays intact; rollback = reverse `UPDATE` from the backup table.
6. Owner-gated: empty Supabase Storage via Storage API (not SQL delete on `storage.objects`), drop storage policies, remove `supabase.co` from CSP `media-src`/`remotePatterns`, delete `supabase-media.ts` rewrite, `storage-range-proxy.ts`, `/api/cdn/storage`, `r2-media-core.ts`, the `NEXT_PUBLIC_MEDIA_CUTOVER_READY` flag.

## Images decision (needs Koss)

`next/image` on Workers has no built-in optimizer without the `IMAGES` binding. Cloudflare Images: 5,000 unique transformations/month free; on Free, extra new transformations fail with error 9422 (no charge); paid is $0.50 per 1,000 beyond 5,000 (Cloudflare pricing page). Every width × format × source counts.

Recommendation: **no Images binding for v1.** Resize/encode rasters in the browser at upload to fixed widths (e.g. 480/960/1920 WebP), store variants as sibling keys, use a tiny custom `next/image` loader that picks the nearest variant from `media.clickitstory.ae`, and `unoptimized` for `i.ytimg.com`. Zero Cloudflare cost, zero Worker CPU, no 9422 surprise. Revisit Images binding only if Koss agrees a price.

## Cutover Order and Rollback

Ordered so each step is reversible on its own and nothing is down if a later step stalls. Every DNS/registrar/secret/live-DB step is one numbered owner action.

| # | Step | Depends on | Rollback |
|---|------|-----------|----------|
| 1 | Add `clickitstory.ae` zone to the ClickitStory account (Free). Import existing records; **keep Vercel records exactly** (apex A / `www` CNAME to Vercel) and set them **DNS-only (grey cloud)** so Vercel keeps issuing its cert. Lower TTLs. Check DNSSEC at tasjeel: disable before NS change. | — | Nothing changed for users. |
| 2 | Koss changes nameservers at tasjeel.ae to the two Cloudflare NS. Wait for zone "Active". Verify site still served by Vercel. | 1 | Restore tasjeel NS (slow: resolver caches up to 48 h). Mitigated by identical records, so never needed in practice. |
| 3 | Resend: add domain `clickitstory.ae`; add its DKIM TXT (`resend._domainkey`), SPF MX + TXT on `send.` subdomain, plus `_dmarc` TXT `p=none` to start. Verify in Resend. | 2 | Remove records. No user impact. |
| 4 | Supabase Auth SMTP → Resend, templates EN/AR, sender `no-reply@clickitstory.ae`. Test signup/OTP/reset on a test inbox. **Independent of the Worker; can ship while Vercel still serves.** | 3 | Toggle custom SMTP off in Supabase. |
| 5 | Create R2 `clickit-media` (+ CORS, r2.dev off) and custom domain `media.clickitstory.ae`; R2 `clickit-next-cache`; D1 `clickit-edge`; queue + DLQ. Run media copy script. | 2 | Delete resources; nothing references them yet. |
| 6 | DB expand migrations (admins table, private.is_admin body, notification/email columns, unique (season_id, youtube_video_id)). Compatible with the Vercel build still serving. | live migration state read first | Each migration ships with a written down-migration; admin_user_id still present. |
| 7 | Deploy Worker build to `clickit.<subdomain>.workers.dev` (or `next.clickitstory.ae` custom domain) against live Supabase. Full UAT: browse, watch, sign-in (cookies on that host), admin upload/import, cron run-now, email send. | 4, 5, 6 | Nothing public changed. |
| 8 | **Disable Vercel cron jobs** (project Settings → Cron Jobs; no deploy needed, which matters because Vercel deploys are BLOCKED). Otherwise Vercel keeps running publish/cleanup against the same Supabase in parallel. | before 9 | Re-enable. |
| 9 | Cutover: delete `www` (and apex) Vercel records in Cloudflare DNS, attach Worker Custom Domains `www.clickitstory.ae` and `clickitstory.ae` (apex → www via Redirect Rule or the Worker). Verify live URL, not exit codes. | 7, 8 | Detach custom domain, re-create Vercel record (DNS-only): minutes. Requires the Vercel project, its production deployment, and its domain assignment to stay untouched during the proof window. |
| 10 | DB media URL rewrite (section above). Done **after** 9 is stable, because the old Vercel build's `remotePatterns` lacks the media host and would break images if we had to roll back 9. | 9 | Reverse UPDATE from backup table. |
| 11 | Proof window passes → owner-gated cleanup: empty Supabase Storage, contract migrations (drop `admin_user_id`, `youtube_api_key`), remove Vercel packages/config (`vercel.json`, `@vercel/*`, `botid`, `sharp`), remove domain from Vercel, delete Vercel project. | 10 + Koss sign-off | Not reversible: this is why it is last. |

Supabase Auth Site URL and redirect URLs stay the same (same hostname), so no auth config change at cutover. Add the workers.dev / preview host to Supabase redirect allowlist for step 7 and remove it after.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Today (3 users, 39 episodes) | Everything above; one Worker, one D1, regional cache. |
| 1k–10k viewers | Media is served by R2 edge cache (no Worker cost). Watch progress writes go straight to Supabase; watch Supabase connection/egress first. Email fan-out moves to Resend batch + likely a paid Resend tier (Koss decision). |
| 100k+ | Supabase compute tier; consider `DOShardedTagCache` instead of D1 tag cache per OpenNext guidance for larger sites; Cache Purge integration (`CACHE_PURGE_API_TOKEN`, zone id). |

### Scaling Priorities

1. **First bottleneck is the Workers Free plan, not traffic.** Free gives 10 ms CPU per request and 50 subrequests per request (Cloudflare limits page). Next.js SSR with RSC, Supabase calls, R2 cache and D1 reads routinely exceeds 10 ms CPU. Workers Paid (5 min CPU, 10,000 subrequests) is very likely required. This is a pricing decision for Koss before Phase build, not something to assume.
2. **Second:** Supabase egress/compute from progress writes and uncached authenticated pages.

## Anti-Patterns

### Anti-Pattern 1: Using the media bucket as the Next cache bucket
**What people do:** one R2 bucket for everything.
**Why it's wrong:** cache objects (RSC payloads, possibly per-user data) become public through the media domain.
**Do this instead:** two buckets; only `clickit-media` has a custom domain.

### Anti-Pattern 2: Uploading files through Server Actions on Workers
**What people do:** keep `bodySizeLimit: '55mb'` and stream to R2 from the action.
**Why it's wrong:** burns Worker CPU/memory (128 MB isolate), zone body limit 100 MB, and `sharp` cannot run on Workers.
**Do this instead:** presigned PUT + finalize.

### Anti-Pattern 3: Cron self-fetch over the public hostname
**What people do:** `fetch('https://www.clickitstory.ae/api/cron/...')` inside `scheduled()`.
**Why it's wrong:** same-zone self-fetch from a Worker is unreliable and adds a hop; it also breaks on workers.dev before cutover.
**Do this instead:** `handler.fetch(new Request(...), env, ctx)` in-process.

### Anti-Pattern 4: Changing live data and DNS in the same step
**What people do:** rewrite DB URLs, drop `admin_user_id`, and flip DNS together.
**Why it's wrong:** DNS rollback to the old Vercel build then hits a DB the old build cannot read.
**Do this instead:** expand migrations before cutover, data rewrite after, contract last.

### Anti-Pattern 5: Leaving Vercel crons on
**What people do:** assume moving DNS stops Vercel.
**Why it's wrong:** Vercel crons call the Vercel deployment directly, regardless of DNS; two publishers and two media sweepers hit one DB (the old sweeper deletes Supabase Storage objects it thinks are orphans).
**Do this instead:** disable Vercel crons in the dashboard before cutover.

### Anti-Pattern 6: Sending email inline in the request
**What people do:** `await sendTransactionalEmail()` inside the contact/publish path.
**Why it's wrong:** Resend latency/429s fail the user action; fan-out in a request hits the subrequest cap.
**Do this instead:** enqueue; consumer retries with DLQ.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres/Auth | `@supabase/ssr` in proxy/RSC/actions; service-role client in actions, cron, consumer | Unchanged. `fetch`-based, works in Workers. Keep RLS on everything. |
| R2 (media) | Binding `MEDIA` for head/list/delete; S3 presign via aws4fetch for browser PUT | R2 API token scoped to `clickit-media` object read/write only. |
| Resend | SMTP (Supabase Auth) + REST (consumer) | Two separate API keys, both sending-only, domain-restricted. |
| YouTube Data API v3 | REST from server actions | Secret key; API-restricted. |
| Turnstile | Widget on auth/contact/newsletter; `siteverify` in actions | Replaces BotID; remove BotID branch in `proxy.ts` and `withBotId` in `next.config.ts`. |
| Cloudflare Web Analytics | Beacon script | Update CSP: add `static.cloudflareinsights.com`, `cloudflareinsights.com`, `challenges.cloudflare.com`, media origin; remove Vercel origins. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Actions ↔ storage | `src/server/media/*` only | No action imports an S3 SDK or Supabase Storage after cutover. |
| Actions/cron ↔ email | `EMAIL_QUEUE` messages (zod-validated) | Consumer is the only Resend REST caller. |
| proxy/actions ↔ admin authority | `requireAdmin()` → `admins` table | DB side: `private.is_admin()` in RLS. One source of truth. |
| Next ↔ cache | OpenNext overrides | App code only uses `unstable_cache`/`updateTag`; no direct D1/R2 cache access. |
| Worker ↔ D1 rate limits | `src/server/ratelimit.ts` | Replaces Supabase `rate_limits` table (current contact.ts ledger); fail-open behavior stays deliberate. |

## Build Order Implications (for the roadmap)

1. **Read-only live audit** (migration list vs repo, which policies use which `is_admin`, storage object inventory, URL columns). Everything below depends on knowing the real schema.
2. **Cloudflare zone + NS move with identical records** — unlocks R2 custom domain, Resend DNS, Worker custom domain. Zero user impact.
3. **Resend domain + Supabase Auth SMTP/templates** — independent of the Worker; ship early, reduces cutover scope.
4. **DB expand migrations** (admins, private.is_admin body swap, email/notification columns, import uniqueness).
5. **OpenNext port** (wrangler, open-next.config, custom worker, bindings, remove sharp/BotID/Vercel analytics, Turnstile, presign/finalize upload path, `actions.ts` split, cron wiring, D1 rate limit). Spike `proxy.ts` on OpenNext first (see risk below). Deploy to workers.dev, UAT.
6. **Cutover** (disable Vercel crons → DNS to Worker), then **media URL rewrite**.
7. **Queue email events** (welcome, new-episode with unsubscribe, support, newsletter) — needs Worker + Resend domain.
8. **YouTube import** — needs Worker secret and admins guard; can run in parallel with 7.
9. **Contract + Vercel removal + Supabase Storage emptied** after proof window.

Product completeness, design system, Arabic RTL and hardening phases can interleave after step 5 lands; they do not change the platform boundaries above.

### Highest-risk unknown: `proxy.ts` on OpenNext

Next.js 16 `proxy.ts` always runs on the Node.js runtime. OpenNext Cloudflare added Node.js middleware (`proxy.ts`) support in 1.20.3 (Aug 2026) and labels it **experimental, not officially maintained**; edge `middleware.ts` remains the stable path. Recent releases require Next.js **16.3.8+** (repo is on `^16.2.9`), and there are open issues (dynamic `require` of instrumentation in 16.3, `@opentelemetry/api` bundling failure). Plan a spike at the start of step 5: upgrade Next to the version OpenNext pins, build, and run the gate paths (locale redirect + cookie merge, coming-soon, auth, admin). Fallback: rename to `middleware.ts` on the edge runtime (deprecated in 16 but supported) with the same logic. Phase 5 needs `/gsd-research-phase`.

## Sources

- OpenNext Cloudflare caching (R2 incremental cache, D1 tag cache, DO queue, regional cache, purge): https://opennext.js.org/cloudflare/caching — HIGH
- OpenNext custom worker (scheduled/queue handlers, re-export DOQueueHandler): https://opennext.js.org/cloudflare/howtos/custom-worker — HIGH
- OpenNext image optimization (IMAGES binding, custom loader): https://opennext.js.org/cloudflare/howtos/image — HIGH
- OpenNext Cloudflare releases (Node middleware experimental 1.20.3; Next 16.3.8+ requirement in 1.20.8): https://github.com/opennextjs/opennextjs-cloudflare/releases — MEDIUM
- Next 16 proxy issues: https://github.com/opennextjs/opennextjs-cloudflare/issues/962, https://github.com/opennextjs/opennextjs-cloudflare/issues/1400 — MEDIUM
- Workers limits (Free 10 ms CPU, 50 subrequests, 5 crons; Paid 5 min, 10,000): https://developers.cloudflare.com/workers/platform/limits/ — HIGH
- Queues on Workers Free (2026-02-04): https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/ — HIGH
- Durable Objects pricing (SQLite DOs on Free): https://developers.cloudflare.com/durable-objects/platform/pricing/ — HIGH
- R2 public buckets / custom domain requirements: https://developers.cloudflare.com/r2/buckets/public-buckets/ — HIGH
- Cloudflare Images pricing (5,000 free, error 9422, $0.50/1,000): https://developers.cloudflare.com/images/pricing/ — HIGH
- Supabase email templates (Go templates, `.Token`, `.Data`): https://supabase.com/docs/guides/auth/auth-email-templates — HIGH
- Supabase Send Email Hook (replaces SMTP when enabled): https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook — HIGH
- Codebase: `src/proxy.ts`, `src/lib/r2-media-core.ts`, `src/lib/supabase-media.ts`, `next.config.ts`, `vercel.json`, `src/app/api/cron/publish-scheduled/route.ts`, `src/lib/config.ts`, `supabase/migrations/20260724115941_restrict_public_episode_access.sql`

---
*Architecture research for: Clickit Story platform move to Cloudflare Workers + Supabase*
*Researched: 2026-10-04*
