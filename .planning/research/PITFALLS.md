# Pitfalls Research

**Domain:** Brownfield move of a live Next.js 16 + Supabase streaming catalog (YouTube embeds) from Vercel to Cloudflare Workers (OpenNext), media to R2, auth email to Resend, plus YouTube playlist import
**Researched:** 2026-10-04
**Confidence:** MEDIUM-HIGH overall (official docs for Cloudflare, OpenNext, Supabase, YouTube, Turnstile; live DNS and repo checked directly; a few community-only items marked LOW)

Phase names used below are suggestions for the roadmap:
- **P-Infra**: Workers/OpenNext port (build, cache, crons, env, Vercel removal)
- **P-DNS**: Nameserver move, Worker custom domain, Resend DNS, cutover
- **P-Media**: R2 bucket, media domain, direct uploads, migration + URL rewrite
- **P-Auth**: Turnstile, OTP sign-in, Resend SMTP/templates, sign-up gate, admins
- **P-YouTube**: playlist/single import, key rotation, resume per episode
- **P-RTL**: Arabic UI
- **P-CI**: GitHub Actions, migration safety, hardening

---

## Live findings (checked 2026-10-04, not hypothetical)

1. **The .ae delegation is already half-moved.** The `.ae` registry (`ns1/ns2.aedns.ae`, `ns4.apnic.net`) returns four NS for `clickitstory.ae`: `ns3.tasjeel.ae`, `ns4.tasjeel.ae`, `ignat.ns.cloudflare.com`, `nataly.ns.cloudflare.com`. WHOIS shows the same four. Both Cloudflare NS answer **REFUSED** for this zone; tasjeel answers correctly. Resolvers that pick a Cloudflare NS get a refusal and retry, so the site still loads, but it is slower and some resolvers will fail. Before P-DNS, find out who added `ignat`/`nataly` and **which Cloudflare account** they belong to. Cloudflare gives each account its own NS pair, so if the zone gets added in the ClickitStory account `e329b099…` and it is assigned a different pair, these two are wrong.
2. Today: apex `A 216.198.79.1` (Vercel), `www CNAME ba211fb55cf67415.vercel-dns-017.com`. Record TTL 14,440 s on tasjeel, parent NS TTL 3,600 s, SOA negative TTL 86,400 s. No MX, TXT, CAA, DS (no DNSSEC to unwind). `media.clickitstory.ae` does not resolve, but it is already in the live CSP `media-src` (from `NEXT_PUBLIC_MEDIA_ORIGIN`).
3. Live headers send `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Every new subdomain (media, send, etc.) must serve valid HTTPS from its first request.
4. `supabase/migrations/20260401000000_create_schema.sql` begins with `drop table if exists public.shows/episodes/seasons/profiles/watch_progress/watchlist cascade`. Four migrations seed fake data (`*_seed_data.sql`, `*_seed_example_shorts.sql`, `*_seed_fake_show_cast.sql`, `*_expand_app_config.sql`). CI runs `supabase db push --include-all` on every push to `main`.
5. `src/app/api/cron/cleanup-media/route.ts` deletes Supabase Storage objects whose URL no DB row references. `vercel.json` still schedules it weekly, plus `publish-scheduled` daily, on the current Vercel production deployment.
6. `sharp` is imported in `src/app/[locale]/admin/actions.ts`. `checkBotId` (Vercel BotID) gates `auth/actions.ts` and `actions/contact.ts`. The contact rate limiter reads `x-forwarded-for` / `x-real-ip`.
7. `src/proxy.ts` (Next 16 proxy) gates every route and refreshes the Supabase session.

---

## Critical Pitfalls

### Pitfall 1: CI migration push re-runs the destructive first migration or seed files against live data

**What goes wrong:**
`supabase db push --include-all` applies every local migration whose version is missing from the remote `supabase_migrations.schema_migrations` table, even if it sorts before the latest one. If that history table ever disagrees with the files (schema drift is already a known defect, someone runs `migration repair --status reverted`, a file is renamed or re-timestamped, a worktree squashes migrations), the CLI treats `20260401000000_create_schema.sql` as pending. It then runs `drop table ... cascade` on shows, episodes, profiles and watch_progress. Seed migrations re-insert picsum posters and fake cast into production.

**Why it happens:**
`--include-all` was added to tolerate migrations from parallel sessions. That is exactly the case where history and files get out of sync. The workflow runs on any push to `main` that touches `supabase/migrations/**`, without a dry run and without a human gate.

**How to avoid:**
- Before any other migration work, read the live history read-only (`select version from supabase_migrations.schema_migrations order by 1`) and diff it against the files. Record the result as a decision note.
- Turn the first migration's DROP block and every seed migration into guarded no-ops in place. Keep the file and version; do not delete it, because deleting a file that exists in remote history makes `db push` fail with "remote migration versions not found". Put the fake data in `supabase/seed.sql`, which only runs on local `db reset`.
- Change CI to run `supabase db push --dry-run` on PRs. Gate the real push behind a GitHub Environment with Koss as required reviewer, or drop auto-apply and let the control session apply migrations by hand and read them back (this matches the control-session rule "migration applied verbatim and read back").
- Add a CI grep that fails any new migration containing `drop table`, `truncate`, or `delete from` without a waiver comment.
- Take a fresh backup (`pg_dump` of public plus auth.users ids) before the first P-CI ship.

**Warning signs:** `db push --dry-run` lists any version older than the newest one on remote. Migration files are renamed in a diff. The workflow log shows "Applying migration 20260401...".

**Phase to address:** P-CI. Do it before the first migration this milestone ships, which in practice is the first phase that touches the schema.

---

### Pitfall 2: Next 16 `proxy.ts` on OpenNext is experimental

**What goes wrong:**
In Next 16, `proxy.ts` runs only on the Node.js runtime. OpenNext Cloudflare marked Node middleware as "not yet supported" until PR #1309 (merged 2026-08-25), which adds it as "experimental and unsupported", requires `nodejs_compat`, and makes the worker larger. Builds either fail with "Node.js middleware is not currently supported" or deploy with route gating that behaves differently than on Vercel. The worst case is a silent pass-through, where signed-out users reach `/watch` and `/admin` pages. Those pages still enforce admin checks server-side, but the sign-up wall breaks.

**How to avoid:**
- Pin `@opennextjs/cloudflare` (currently 1.20.8) and test `proxy.ts` on `wrangler dev` / preview before anything else in P-Infra. If it misbehaves, rename it to `middleware.ts` with the edge runtime. That path is deprecated in Next 16 but still the stable one on OpenNext.
- Write a Playwright smoke test that runs against the Worker preview URL: signed-out GETs to `/en/watch/...`, `/en/admin`, `/en/my-list` must 307 to `/auth`; signed-in must 200; coming-soon mode must redirect.
- Never rely on the proxy alone for admin. Every admin server action must re-check `is_admin` (it does today; keep it that way during the split of `actions.ts`).

**Warning signs:** The build warns about middleware runtime. `/admin` returns 200 HTML to a signed-out curl. The `NEXT_LOCALE` cookie is missing on the first response.

**Phase to address:** P-Infra (first spike).

---

### Pitfall 3: ISR and `updateTag` look fine but stop invalidating without OpenNext cache config

**What goes wrong:**
The app has 26+ `unstable_cache` calls and uses `updateTag('shows' | 'episodes' | 'categories')` and `revalidatePath` from admin actions. Without an incremental cache and a tag cache in `open-next.config.ts`, OpenNext's default dummy cache means two things. Prerendered pages are re-rendered on every request, which burns CPU (see Pitfall 4). And tag revalidation does nothing across isolates: an admin publishes an episode, and viewers in other colos keep seeing stale data until the isolate dies. With the regional cache enabled but cache purge not enabled, stale HTML is served for up to 30 minutes after `updateTag`.

**How to avoid:**
- Configure the R2 incremental cache plus `D1NextModeTagCache` (the right fit for this traffic; switch to DoShardedTagCache only if revalidation volume grows). Add the DO queue only if time-based `revalidate` is used; on-demand tags need no queue.
- If you enable the regional cache, enable automatic cache purge. It only works on a zone with a custom domain, so it waits for P-DNS.
- The daily `publish-scheduled` cron must call the same tag invalidation the admin actions call. A cron that flips `status='published'` in SQL without invalidating leaves the episode invisible until the cache expires.
- UAT step: edit a show title in admin, then within 10 s load the show page from a different browser and network and confirm the new title.

**Warning signs:** CPU time per request is close to SSR cost on pages that should be static. The R2 cache bucket stays empty. Admin edits "don't show up".

**Phase to address:** P-Infra.

---

### Pitfall 4: Workers Free plan CPU (10 ms) kills Next SSR with error 1102; this is a pricing decision

**What goes wrong:**
Cloudflare's limits page: Free plan gets 10 ms CPU per HTTP request and 10 ms per Cron Trigger; Paid gets 30 s by default. A Next App Router SSR render with next-intl messages (1,436 keys) and React Compiler output routinely goes past 10 ms, which returns error 1102 "Worker exceeded CPU". Community reports confirm OpenNext SSR "does not fit" on Free.

**How to avoid:**
Bring Workers Paid ($5/month at the time of writing; confirm the current price) to Koss as a priced decision before P-Infra planning is signed. CLAUDE.md says pricing is discussed first; do not enable it yourself. If he declines, the plan must change: heavy static prerendering, the static-assets incremental cache, and accepting that admin and auth pages may 1102.

**Warning signs:** `outcome: exceededCpu` in `wrangler tail`. Intermittent 1102 on `/[locale]/show/*`.

**Phase to address:** Before P-Infra (decision gate).

**Note on bundle size (sources disagree):** OpenNext docs still say 3 MiB (Free) / 10 MiB (Paid) compressed. The current Cloudflare limits page says 64 MiB uncompressed on both plans, with "no compressed size limit". The binding constraint now is **startup time of 1 s** (error 10021). Keep `@aws-sdk/client-s3` out of the Worker bundle and use the R2 binding plus `aws4fetch` for presigning. Remove `@vercel/*` and `botid`, and check `wrangler deploy` output for `startup_time_ms`.

---

### Pitfall 5: Old Vercel deployment keeps running crons against the live DB after cutover

**What goes wrong:**
Vercel's crons belong to the Vercel production deployment, not to DNS. After `www` points to Cloudflare, the blocked-but-still-live Vercel production keeps calling `/api/cron/publish-scheduled` daily and `/api/cron/cleanup-media` weekly with its own env (service-role key) against the same Supabase project. That causes double publishing (and double new-episode emails once alerts exist). Once media URLs are rewritten to R2, the old cleanup logic sees every Supabase hero object as unreferenced and deletes it after 24 h. That destroys the rollback copy (see Pitfall 9).

**How to avoid:**
Make removing the Vercel project (or at least disabling its crons and env) a numbered owner step inside the cutover phase, done after the Worker serves `www` and before the media URL rewrite. Deploys are blocked, so a config change cannot be shipped. It has to be done in the dashboard: delete the project, or remove its env vars so the crons 401. Rotate `SUPABASE_SERVICE_ROLE_KEY` afterwards, because Vercel had a copy.

**Warning signs:** Supabase logs show requests from Vercel IPs after cutover. `audit_log` has duplicate publish entries.

**Phase to address:** P-DNS (cutover checklist). Must be done before P-Media's rewrite.

---

### Pitfall 6: NS cutover outage or split-brain from the .ae registrar

**What goes wrong:**
- The zone gets added to Cloudflare, Cloudflare's import scan copies Vercel's records as **proxied** (orange), and the zone goes active. `www` then proxies to Vercel through Cloudflare, which gives redirect loops or 525 errors under the wrong SSL mode, and Vercel's domain verification breaks.
- The Worker custom domain can't attach because a CNAME already exists for `www`.
- The registrar change at tasjeel is done by hand (often a support ticket for .ae), may need a TDRA/aeDA update cycle, and can be slow. The current mixed delegation (live finding 1) shows a previous attempt half-applied.
- Apex `clickitstory.ae` and `www` behave differently. The live site redirects apex to `www`; on Cloudflare this needs a redirect rule or a Worker route on both.
- HSTS preload plus `includeSubDomains` means any subdomain served without valid TLS during the switch is a hard browser error, with no "proceed" option.

**How to avoid (zero-downtime order):**
1. Add the zone in the **ClickitStory account** and confirm the assigned NS pair. Re-create the current records exactly, **DNS-only (grey)**, pointing at Vercel. Lower the tasjeel record TTLs to 300 a day ahead if tasjeel allows it.
2. At tasjeel: set exactly the two Cloudflare NS and remove `ns3/ns4.tasjeel.ae`. Wait until all `aedns.ae` servers return only Cloudflare NS and the zone shows Active. The site is still served by Vercel during this, with no change visible to users.
3. Only then attach the Worker custom domain to `www` (and apex, or redirect apex), delete the Vercel records, and verify `www.clickitstory.ae` (not `*.workers.dev`, not `*.vercel.app`) with curl: `server: cloudflare`, real HTML, auth cookies set.
4. Keep the Vercel project alive (crons disabled) for 48 h as a rollback target: flip `www` back to the Vercel CNAME, grey-clouded.

**Warning signs:** `dig @<each aedns server> clickitstory.ae NS` returns mixed sets. Cloudflare dashboard shows "Pending nameserver update" for days. `ERR_TOO_MANY_REDIRECTS`.

**Phase to address:** P-DNS. Investigate finding 1 as the first task.

---

### Pitfall 7: Supabase session cookies cached or lost on Workers

**What goes wrong:**
- A Cloudflare Cache Rule "Cache Everything" on HTML (added for speed, or copied from another product) caches a response that carries `Set-Cookie: sb-...-auth-token`, which serves one viewer's session to others.
- Session refresh happens only in `proxy.ts`. If the proxy matcher excludes a route, or the proxy is broken (Pitfall 2), tokens are never refreshed and users get logged out every hour (`jwt_expiry` 3600).
- Server Components that try to `setAll` cookies throw. This is normal with `@supabase/ssr`, but a refactor that removes the try/catch breaks pages.
- Code that uses `getSession()` on the server trusts an unverified cookie. Use `getClaims()`/`getUser()`.

**How to avoid:**
Never add cache rules for HTML or `/_next/data`. Only `/_next/static`, `/brand`, and the media domain get edge caching. Test refresh by setting the JWT expiry low on a local Supabase stack and browsing past it on `wrangler dev`. Add a response-header test: any response with `Set-Cookie` must carry `Cache-Control: private, no-store`.

**Warning signs:** `cf-cache-status: HIT` on a page response that has `Set-Cookie`. Users report being someone else (stop everything). Logouts on the hour.

**Phase to address:** P-Infra (checks), P-DNS (cache rules).

---

### Pitfall 8: NEXT_PUBLIC values and module-scope env are baked at build

**What goes wrong:**
`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_ORIGIN` and `NEXT_PUBLIC_MEDIA_CUTOVER_READY` are inlined when the bundle is built. `next.config.ts` also calls `getPublicMediaOrigin()` at build time to produce the CSP and `images.remotePatterns`. Setting these in the Cloudflare dashboard after the build does nothing for client code. "Flip the media flag in the dashboard" silently has no effect, or worse, the server side reads the new value while the client reads the old one.
Also: `wrangler deploy` replaces dashboard-only `vars` unless `--keep-vars` is set. Secrets survive; plain vars do not. A CI deploy can wipe values set by hand.

**How to avoid:**
- Keep every NEXT_PUBLIC value in the GitHub Actions build env (they are public anyway), and treat changing one as a rebuild plus deploy.
- Put non-public values in `wrangler secret put` only. Keep `vars` in `wrangler.jsonc` (committed, no secrets) so CI is the single source of truth.
- Read server env inside functions, not at module top level.
- Delete `NEXT_PUBLIC_MEDIA_CUTOVER_READY` as a runtime toggle. Make cutover a data change (URLs in the DB), not a build flag.

**Warning signs:** The browser bundle contains an old origin (`grep` the `.open-next/assets` output). CSP blocks `media.clickitstory.ae` or allows a stale origin.

**Phase to address:** P-Infra, P-Media.

---

### Pitfall 9: The media URL rewrite misses places or can't be rolled back

**What goes wrong:**
The existing script copies the 86 objects with checksums but does **not** rewrite the DB. A naive `update ... set url = replace(...)` on known columns misses:
- jsonb in `app_config` / site settings (hero video, portfolio, auth-page media, ticker)
- `auth.users.raw_user_meta_data->>'avatar_url'` as well as `profiles.avatar_url`
- HTML in legal pages and FAQs
- Supabase image-transform URLs (`/render/image/public/...`) and query strings
- cached copies in the R2 incremental cache (old HTML keeps old URLs until revalidated)

Then the cleanup cron deletes the Supabase originals (Pitfall 5) and nothing is left to roll back to.

**How to avoid:**
- Search the whole DB first, read-only, for `lajguozmtissnnfccmej.supabase.co/storage` in every text and jsonb column (`information_schema` driven). The count must match the manifest.
- Run the rewrite as one transaction that writes an `old_url -> new_url` mapping table first, so it is reversible, and is idempotent. Run it on a local copy of the live schema first.
- Keep Supabase Storage untouched for at least 7 days after proof. Disable `cleanup-media` (both Vercel and Cloudflare) until it is rewritten to understand R2 keys. "Supabase Storage emptied" is the last task of P-Media, gated by Koss, not part of the rewrite.
- After the rewrite: revalidate all tags, and confirm zero Supabase storage requests in the Supabase logs for 48 h.

**Warning signs:** Mixed hosts in page HTML. 404s on avatars only (auth metadata missed). Supabase egress not dropping.

**Phase to address:** P-Media.

---

### Pitfall 10: OTP sign-in sends the wrong template to new users, and SMTP rate limits drop to 30/hour

**What goes wrong:**
- `signInWithOtp` sends the **Magic Link** template to existing users but the **Confirm signup** template to new ones (when `shouldCreateUser` is true). If only Magic Link was edited to show `{{ .Token }}`, new users get a link or a non-working code. Supabase issue #12868 documents "Confirm signup `{{ .Token }}` always errors: Token has expired or is invalid" on a first attempt.
- The existing reset flow uses `exchangeCodeForSession` (PKCE). The `code_verifier` cookie lives in the browser that asked for the email, so opening the reset link in Gmail's in-app browser or on a phone fails. The fix is `token_hash` links handled by `verifyOtp` on the server, or the 6-digit code.
- After custom SMTP (Resend) is enabled, Supabase sets the auth email rate limit to **30/hour** by default (raise it in Auth > Rate Limits). OTP resends are limited to one per 60 s per user. The OTP expiry setting also governs reset and confirmation link validity.
- Supabase templates are single-language Go templates. EN + AR needs either `{{ if eq .Data.locale "ar" }}` on user metadata set at sign-up, or the Auth **Send Email Hook** to a Worker endpoint that renders with Resend. The hook has a 5 s response budget and a signed payload to verify.
- Resend's free plan allows **100 emails/day, 3,000/month**, and Koss's account is shared across products. New-episode alerts to My List users plus auth emails can exhaust it, after which auth emails stop.

**How to avoid:**
Edit both Magic Link and Confirm signup templates (and Reauthentication, if used) and test with a never-seen email. Move reset, confirm and email change to `token_hash` + `verifyOtp`. Set the auth rate limit on purpose. Send bulk alerts in batches with a daily cap below the quota, or on a separate Resend plan or domain; ask Koss first, since this is pricing. Put auth email on its own subdomain if marketing mail is added (Supabase recommends separate sending domains).

**Warning signs:** "Token has expired or is invalid" on a first sign-in. Resend dashboard shows 429s. Auth logs show `over_email_send_rate_limit`.

**Phase to address:** P-Auth.

---

### Pitfall 11: Turnstile token consumed twice, or blocked by CSP

**What goes wrong:**
- Turnstile tokens are valid for 300 s and can be validated **once**. A replay returns `timeout-or-duplicate`. In server actions this happens when the action verifies the token and then passes the same token to Supabase Auth's built-in captcha (if `[auth.captcha]` is enabled), when the form is retried after a validation error without resetting the widget, or when React resubmits the action.
- The CSP in `next.config.ts` has no `https://challenges.cloudflare.com` in `script-src`/`frame-src`, so the widget never renders and every sign-in fails. The same goes for Cloudflare Web Analytics (`static.cloudflareinsights.com`, `cloudflareinsights.com` in connect-src).
- BotID's `checkBotId()` stays in the auth and contact actions after the Vercel removal, so every request is treated as bot-or-unknown off Vercel.

**How to avoid:**
Pick one verifier per form. For Supabase auth calls, either enable Supabase captcha and only pass the token through, or verify in the action and leave Supabase captcha off. Never do both. Call `turnstile.reset()` after every failed submit. Use `idempotency_key` for retries. Swap BotID for Turnstile and update the CSP in the same commit. Send `remoteip` from `CF-Connecting-IP`.

**Warning signs:** `timeout-or-duplicate` in logs. Sign-in fails only on the second attempt. CSP violation reports for challenges.cloudflare.com.

**Phase to address:** P-Auth (CSP part in P-Infra).

---

### Pitfall 12: Playlist import brings in videos that won't play

**What goes wrong:**
- `playlistItems.list` returns at most 50 items per page. Without `nextPageToken` handling, seasons longer than 50 are cut short.
- Private and deleted videos come back as "Private video" / "Deleted video" with no thumbnails. The client publishes on broadcast days, so episodes that are **scheduled/private at import time** import with no metadata, or are skipped, and never update.
- Some videos have `status.embeddable=false`, `uploadStatus` other than `processed`, or `contentDetails.regionRestriction` that blocks `AE`. This is likely on the music show because of Content ID. These import fine but show player error 101/150 or "not available in your country" to UAE viewers.
- `liveBroadcastContent` of `upcoming`/`live` gives a `P0D` duration. Missing `maxres` thumbnails give broken images. ISO 8601 durations with hours or days get mis-parsed.
- Quota: `playlistItems.list` and `videos.list` cost 1 unit each, so a 50-video season with batched `videos.list?id=` (≤50 ids) costs about 2 units. Quota is only a problem if someone uses `search.list` (separate 100/day budget) or calls `videos.list` per video in a loop. Invalid requests still cost a unit. The quota resets at midnight Pacific (11:00 Dubai).
- A key restricted by HTTP referrer fails from a Worker (no referrer), and Workers have no fixed egress IP. Restrict the key by **API** (YouTube Data API v3 only), keep it in a Worker secret, and rotate the old key, which must be assumed leaked.

**How to avoid:**
The import is a preview-then-commit flow. Show each video's status (playable / private / not embeddable / blocked in AE / upcoming) and let the admin pick. Store `youtube_status` and `last_checked_at`, and run a daily re-check cron that refreshes private-to-public changes and flags videos that became unplayable. The YouTube Developer Policies also require you to verify every 30 days that stored videos aren't deleted and to refresh or delete stored API data within 30 days, so the cron also handles compliance. Batch `videos.list` with `part=snippet,contentDetails,status`. Validate IDs on the server (`^[A-Za-z0-9_-]{11}$`, then API existence).

**Warning signs:** Imported episode count is lower than the playlist count. Episodes titled "Private video". Player `onError` codes 100, 101 or 150 in client logs.

**Phase to address:** P-YouTube.

---

## Moderate Pitfalls

### Pitfall 13: YouTube embed ToS and the Error 153 referrer requirement
- Required Minimum Functionality: "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls." The 8 s autoplay-next countdown, shorts overlay and any "Netflix-style" title card must sit **beside or after** the player, or replace it when the video ends (unmount or hide the iframe). They must never cover the iframe while it is visible. Minimum viewport 200x200 (480x270 recommended with controls). Never more than one autoplaying player per page, so the hero video plus the shorts overlay must not both autoplay a YouTube embed. No hover-triggered actions on the player.
- YouTube now needs a Referer: `Referrer-Policy: no-referrer` or `same-origin` gives **Error 153**. The current `strict-origin-when-cross-origin` works; keep it when the CSP and headers move to Workers, and set `referrerpolicy` on the iframe as well.
- Kids content (`madeForKids`) disables some player features; don't build UI that assumes they exist. (LOW: behaviour varies)

**Phase:** P-YouTube; header carry-over in P-Infra.

### Pitfall 14: R2 public access done the "quick" way
- The `r2.dev` URL is rate-limited, has no cache or WAF, and is meant for development only. Serve production media from `media.clickitstory.ae` as an R2 custom domain, which needs the zone on Cloudflare, so P-Media's public serving depends on P-DNS. Disable r2.dev public access afterwards.
- Presigned PUT from the browser needs bucket CORS with `PUT`, `Content-Type` in AllowedHeaders, `ETag` exposed, and the exact origin `https://www.clickitstory.ae` (plus localhost for dev). CORS changes can take up to 30 s to apply. An expired presigned URL returns 403 **without** CORS headers, which the browser shows as a CORS error.
- AWS SDK v3 adds default flexible-checksum headers (`x-amz-checksum-*`, `x-amz-sdk-checksum-algorithm`) to signed requests, which can break presigned PUTs from browsers. Sign with `aws4fetch`, or set the client to `requestChecksumCalculation: 'WHEN_REQUIRED'`, and sign `Content-Type` and `Content-Length` limits. (MEDIUM: community-reported)
- Never let the client choose the key. The server issues `shows/{id}/hero-{ts}.webp` and checks the MIME type and size in the presign step. The client-side "SVG sanitizer" defect becomes worse here: an uploaded SVG served from the media origin can carry script. Serve SVG with `Content-Disposition: attachment`, or reject it.

**Phase:** P-Media.

### Pitfall 15: Video from R2 doesn't seek or start on Safari
- Safari needs `206 Partial Content` for MP4. The R2 custom domain handles `Range`, but a Worker that proxies media must forward `Range` and `If-*` headers and pass back 206 and `Content-Range`.
- Encode hero MP4s with `-movflags +faststart`, otherwise the `moov` atom at the end forces a full download before playback.
- Set `Content-Type: video/mp4` on upload (the S3 API doesn't infer it) and long `Cache-Control` on versioned keys. Re-uploading under the same key is served stale from cache unless purged, so always use versioned keys.
- Autoplaying hero video must be `muted playsinline`.

**Phase:** P-Media.

### Pitfall 16: `next/image` on Workers: sharp gone, transform quota, `minimumCacheTTL` ignored
- `sharp` can't run in workerd. The admin upload path that resizes or converts with sharp must move to browser-side resize (canvas/OffscreenCanvas to WebP) before the presigned PUT, or to Cloudflare Images (paid beyond quota, ask Koss).
- OpenNext image optimization needs an `IMAGES` binding or a custom loader. Free plan: **5,000 unique transformations/month**. Above that, new transforms fail with error 9422 (no charge, but broken images). With `formats: ['image/avif','image/webp']` × device sizes × (86 media + ~294 YouTube thumbnails), you can reach 5k. Set `unoptimized` on YouTube thumbnails (`i.ytimg.com` is already optimized), cut `deviceSizes`/`imageSizes`, and use one format.
- `minimumCacheTTL` isn't supported. Rely on cache headers on the media domain.
- Drop `picsum.photos`, `images.unsplash.com` and the Supabase storage host from `remotePatterns` after the placeholder purge and media move.

**Phase:** P-Infra (loader), P-Media (upload resize).

### Pitfall 17: Crons on Workers aren't routes
`vercel.json` crons called HTTP routes with `Authorization: Bearer CRON_SECRET`. The OpenNext worker has no `scheduled` handler by default. You need a custom worker entry that exports `scheduled` and calls the logic directly (or `fetch`es the route internally with the secret, compared in constant time; this fixes the "cron secret compare" defect). Free plan: 5 cron triggers per account, 10 ms CPU each. Cron times are UTC: the daily publish at `0 1 * * *` UTC is 05:00 Dubai. Confirm that matches the broadcast-day logic, which runs in Dubai time.

**Phase:** P-Infra.

### Pitfall 18: Rate limiter and logs keyed on the wrong IP
Behind Cloudflare, `x-forwarded-for` can be set by the client, which defeats the contact and newsletter rate limits. Use `CF-Connecting-IP` only. If rate limits move to D1, use one row per key per window with an atomic upsert. Read-then-write across isolates lets bursts through.

**Phase:** P-Infra / P-CI hardening.

### Pitfall 19: Supabase redirect allow-list and Site URL during the move
The domain doesn't change, so the Site URL stays `https://www.clickitstory.ae`. But:
- Testing auth on `*.workers.dev` before cutover: if the preview origin isn't in the allow-list, Supabase silently falls back to the Site URL, so emails from preview tests land on the **Vercel** production site. Add the exact preview URL temporarily, then remove it. Avoid `**` wildcards in production.
- Cookie domain: don't set `domain=.clickitstory.ae` on auth cookies unless needed. Host-only cookies on `www` keep the media subdomain from receiving them.
- Users logged in on Vercel keep their cookies after the cutover (same host), so sessions survive. Changing cookie name or options would log everyone out. Leave `@supabase/ssr` defaults alone during the move.
- Enable leaked-password protection (an advisor finding). Fix the anon-callable SECURITY DEFINER `get_public_youtube_video_id` before the sign-up wall goes live, or the "sign-up required" rule can be bypassed for video IDs.

**Phase:** P-Auth (allow-list), P-DNS (cookie verification).

### Pitfall 20: Resend DNS and DMARC on the new zone
- Resend needs an MX and an SPF TXT on the `send.` subdomain and a DKIM TXT `resend._domainkey`. The domain has no MX/TXT today, so nothing conflicts, but these records must be **DNS-only**. Add them in Cloudflare **after** the zone is active, otherwise you verify against tasjeel and lose the records at the NS switch.
- Add `_dmarc` TXT starting at `p=none; rua=...`, then tighten. Gmail and Yahoo bulk-sender rules require DMARC for volume senders, and auth email without DMARC goes to spam.
- An apex SPF isn't needed for Resend (it uses `send.`). Don't publish an apex `v=spf1 -all` if Zoho or another mailbox might be added later without planning for it.
- Pick the Resend region once (e.g. eu-west-1); changing it means re-verifying.

**Phase:** P-DNS (records), P-Auth (sending).

### Pitfall 21: GitHub Actions on a public repo
- `pull_request` runs from forks get **no secrets**. That is fine for lint, typecheck, test and build if the build needs no secrets; give the PR build dummy `NEXT_PUBLIC_*` values. Never use `pull_request_target` with a checkout of the PR head, because that exposes `SUPABASE_DB_URL` and `CLOUDFLARE_API_TOKEN`.
- Deploy only on `push` to `main`, inside a GitHub Environment `production` with Koss as required reviewer (that is the Ship gate). Store the Cloudflare token as an environment secret, scoped to Workers Scripts/R2/D1 edit on account `e329b099…` only.
- Turn on "Require approval for all outside collaborators" for workflow runs. Keep actions pinned to SHAs (already done).
- The migration workflow and the deploy workflow run separately. App code that needs a new column can go live before the migration, or the reverse. Make deploy `needs:` the migration job, or keep migrations backward-compatible (expand, then contract).
- Wrangler in CI must not use any `HOME` login. `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` only, so the default (Vamos) account can never be the target. Put `account_id` in `wrangler.jsonc`.

**Phase:** P-CI. The deploy job must exist before the P-DNS cutover.

---

## Minor Pitfalls

### Pitfall 22: RTL in Tailwind v4
The repo has about 117 physical-direction classes (`ml-/pr-/left-/text-left/translate-x/rounded-l...`) against 88 logical and 12 `rtl:` uses. Common misses:
- Directional icons (chevrons, play-next arrows) need `rtl:-scale-x-100`.
- **Embla needs `direction: 'rtl'`** in its options and `dir` on the container, or rails scroll the wrong way and snap badly.
- `motion` `x` animations and Lenis horizontal behaviour don't mirror.
- `tracking-*` letter-spacing breaks Arabic letter joining, so reset it under `rtl:` or `:lang(ar)`. `uppercase` does nothing for Arabic.
- Mixed EN/AR titles need `dir="auto"` / `<bdi>`.
- Numbers, durations and dates need `Intl` with `ar-AE` (or keep Latin digits on purpose; decide once).
- The LBC font **does** include Arabic glyphs (209 in U+0600–06FF, checked). Check the line-height and diacritics clipping with real Arabic copy.
- Form inputs for Arabic need `dir="rtl"`. Email and password fields stay `dir="ltr"`.

**Phase:** P-RTL. Add a lint rule (eslint-plugin-tailwindcss or a grep in CI) banning new physical classes.

### Pitfall 23: Supabase latency from Dubai edges to Singapore
Supabase is in ap-southeast-1. Vercel pinned functions to `fra1`. Workers run at the colo nearest the viewer (Dubai), so every uncached Supabase round trip is about 90–100 ms. Pages making 4–6 sequential queries will feel slower than expected. Parallelize queries (`Promise.all`), rely on the tag cache, and consider Smart Placement or a placement hint near Singapore for the Worker. (MEDIUM)

**Phase:** P-Infra.

### Pitfall 24: Placeholder purge done by migration
The task "remove picsum posters, test YouTube IDs, fake cast" must not ship as a migration that runs automatically in CI. It is a live-data delete, so it needs Koss's approved list and one numbered owner step, with a backup of the affected rows. Supabase Storage objects referenced by deleted rows are cleaned by the R2-aware cleanup later, not in the same step.

**Phase:** Product-completeness phase, after P-CI.

### Pitfall 25: Free Supabase project pausing and `auto_expose_new_tables`
If the live project is on the free tier, low traffic during a long migration window can pause it (the project memory mentions an earlier pause). `config.toml` notes that the `auto_expose_new_tables` default flipped on 2026-05-30 and the field is removed on 2026-10-30. New tables created by migrations are no longer reachable by `anon`/`authenticated` without explicit `GRANT`, so new features 401/permission-deny until grants are added. Put explicit GRANTs in every new-table migration. (MEDIUM: from the CLI config comment)

**Phase:** Any phase adding tables (admins, youtube_status, rate limits if in Postgres).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `middleware.ts` (edge) instead of `proxy.ts` | Stable on OpenNext today | Deprecated in Next 16; a rename later | Acceptable until OpenNext Node middleware leaves "experimental" |
| D1NextModeTagCache instead of DO-sharded | Simple, free tier | Write contention if revalidation explodes | Acceptable at 2 admins / ~300 episodes |
| Keep `@aws-sdk/client-s3` in the Worker | Reuse `r2-media-core.ts` | Startup time, bundle size | Only in Node scripts, never in the Worker |
| `--include-all` on db push | No out-of-order failures | Can replay old destructive files | Never without dry-run and an approval gate |
| `unoptimized` on all images | Avoids the transform quota | Larger payloads on artwork | Acceptable for YouTube thumbs; not for 4K uploads |
| Storing YouTube metadata forever | Fast pages | Breaks the 30-day policy, stale titles | Never; daily/weekly refresh cron |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenNext | No cache config, assuming ISR "just works" | R2 incremental + D1 tag cache; purge on zone |
| Cloudflare env | Setting NEXT_PUBLIC in dashboard | Build env in CI; secrets via `wrangler secret` |
| Supabase Auth | Editing only the Magic Link template | Edit Confirm signup too; `token_hash` + `verifyOtp` |
| Supabase SMTP | Assuming the old limit after enabling Resend | Set the auth email rate limit explicitly (default 30/h) |
| Turnstile | Verifying in the action and passing to Supabase captcha | One verifier; reset the widget on failure |
| YouTube API | Referrer-restricted key on the server | API-restricted key in a Worker secret, rotated |
| R2 | r2.dev in production; client-chosen keys | Custom domain; server-issued keys, CORS by exact origin |
| Vercel | Pointing DNS away and forgetting the project | Disable crons/env, delete after the rollback window |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Dummy incremental cache | Every page SSR, 1102 on Free | Configure R2 cache | Immediately on Free; cost on Paid |
| Sequential Supabase calls from Dubai | TTFB 500 ms+ | `Promise.all`, tag cache, placement | Now |
| Image transforms × formats × sizes | 9422 errors mid-month | Fewer sizes and one format, thumbs unoptimized | ~5k unique transforms/month |
| Heavy global scope | Deploy fails 10021 | Lazy-init clients in handlers | 1 s startup |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| HTML cache rule on an auth site | Session leakage between users | No HTML caching; `private, no-store` with Set-Cookie |
| `pull_request_target` + head checkout | DB URL and CF token stolen from a public repo | `pull_request` only; secrets in a protected environment |
| Trusting `x-forwarded-for` | Rate-limit bypass | `CF-Connecting-IP` |
| SVG uploads served from the media domain | Stored XSS on a sibling origin | Reject SVG or serve as attachment, strict sanitizer |
| Old Vercel env still holding the service-role key | Out-of-band writes to live DB | Delete the Vercel env/project; rotate the key |
| anon-callable SECURITY DEFINER function | Bypasses the sign-up wall | Revoke from anon, or move behind auth |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Countdown/overlay drawn over the YouTube iframe | ToS violation, risk of API/embed loss | Show next-episode UI after `ENDED`, beside the player |
| Region-blocked episode shown as playable | UAE viewer sees a YouTube error | Hide or flag at import; daily re-check |
| PKCE reset link opened on another device | "Invalid link" | `token_hash` links or 6-digit code |
| Turnstile not reset after an error | Second attempt always fails | Reset on every failed submit |
| RTL carousel scrolling backwards | Arabic UI feels broken | Embla `direction: 'rtl'` |

## "Looks Done But Isn't" Checklist

- [ ] **Worker deploy:** green on `*.workers.dev` but gating untested. Run signed-out curl on `/en/watch`, `/en/admin`, `/en/my-list` on `www.clickitstory.ae`.
- [ ] **Cache:** the site loads, but admin edits don't appear for other users. Run the 10 s cross-browser UAT.
- [ ] **Crons:** `scheduled` handler exists, but times are UTC vs Dubai and it doesn't invalidate tags. Check one scheduled episode goes live and is visible.
- [ ] **DNS:** the zone is Active, but the parent still lists the tasjeel NS. Check `dig` against every `aedns.ae` server.
- [ ] **Vercel:** the domain is gone, but crons still run. Check Supabase logs for Vercel IPs.
- [ ] **Media:** pages show R2 URLs, but avatars come from auth metadata. Run the full-DB search for the Supabase storage host: count must be 0.
- [ ] **Media video:** plays in Chrome, not in Safari. Check the 206 response and faststart.
- [ ] **Auth email:** existing users get the code, new users don't. Test with a fresh address and the AR locale.
- [ ] **Resend:** domain verified, but no DMARC. Check mail-tester and the Gmail "Show original" result (SPF/DKIM/DMARC pass).
- [ ] **YouTube import:** 50-video playlist OK, 51+ truncated. Test a 60-item playlist with one private and one non-embeddable video.
- [ ] **Turnstile:** widget renders on localhost but not on prod (CSP). Check prod console for CSP violations.
- [ ] **CI:** deploy job works, but the migration job still auto-applies with `--include-all`. Check the workflow requires approval.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Destructive migration replayed | HIGH | Stop CI; restore from Supabase PITR/daily backup (check the plan has it before starting); re-apply later migrations |
| Cutover breaks the site | LOW (if Vercel kept) | Re-point `www` to the Vercel CNAME, DNS-only; investigate on workers.dev |
| URL rewrite wrong | LOW (mapping table + Supabase objects kept) | Reverse with the mapping table; revalidate tags |
| Supabase objects deleted by old cron | MEDIUM | Restore from the R2 copy (checksums in the manifest) |
| Resend quota exhausted | LOW | Pause alerts; auth resumes next day; consider a plan change (ask Koss) |
| YouTube key leaked or quota hit | LOW | Rotate the key in Google Cloud; `wrangler secret put`; quota resets 11:00 Dubai |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Migration replay | P-CI (before any schema change) | `db push --dry-run` clean; DROP/seed files neutralized; approval gate present |
| 2 proxy.ts on OpenNext | P-Infra spike | Gating Playwright suite green on the preview Worker |
| 3 ISR/tag cache | P-Infra | Cross-browser edit visibility under 10 s |
| 4 Free CPU limit | Pre-P-Infra decision | Koss's priced answer recorded; no 1102 in `wrangler tail` |
| 5 Vercel crons | P-DNS cutover | No Vercel IPs in Supabase logs 48 h after cutover |
| 6 NS cutover | P-DNS | All parent servers list only Cloudflare NS; `server: cloudflare` on www and apex |
| 7 Cookie caching | P-Infra/P-DNS | No `HIT` with `Set-Cookie`; refresh past JWT expiry works |
| 8 Build-time env | P-Infra | Bundle grep for origins; deploy keeps vars |
| 9 URL rewrite | P-Media | DB-wide host search = 0; Supabase egress ~0 for 48 h |
| 10 OTP/templates/limits | P-Auth | New and existing user, EN and AR, code works; rate limit set |
| 11 Turnstile | P-Auth | Retry after a wrong password succeeds; no CSP violations |
| 12 Playlist edge cases | P-YouTube | 60-item mixed playlist preview shows correct statuses |
| 13 Embed ToS / 153 | P-YouTube | No element overlaps the iframe while playing; Referrer-Policy unchanged |
| 14–16 R2/video/images | P-Media | Browser PUT works; Safari seeks; transform count under quota |
| 17 Crons | P-Infra | Scheduled publish observed live |
| 21 GitHub Actions | P-CI | Fork PR has no secrets; deploy requires approval |
| 22 RTL | P-RTL | AR screenshots of rails, player page, forms; lint bans physical classes |

## Sources

- OpenNext Cloudflare overview (supported features, Node middleware unsupported, size limits): https://opennext.js.org/cloudflare (HIGH)
- OpenNext caching (R2 incremental, D1/DO tag cache, queue, regional cache, purge needs zone): https://opennext.js.org/cloudflare/caching (HIGH)
- OpenNext env vars (NEXT_PUBLIC inlined at build, `--keep-vars`): https://opennext.js.org/cloudflare/howtos/env-vars (HIGH)
- OpenNext images (binding or loader, `minimumCacheTTL` unsupported): https://opennext.js.org/cloudflare/howtos/image (HIGH)
- OpenNext PR #1309, Node middleware / proxy.ts, "experimental and unsupported", merged 2026-08-25: https://github.com/opennextjs/opennextjs-cloudflare/pull/1309 (HIGH)
- OpenNext issue #962, Next 16 proxy not supported: https://github.com/opennextjs/opennextjs-cloudflare/issues/962 (MEDIUM)
- workers-sdk issue #13755 (proxy version trap): https://github.com/cloudflare/workers-sdk/issues/13755 (MEDIUM)
- Cloudflare Workers limits (10 ms Free CPU, 64 MiB, 1 s startup, 5 crons Free): https://developers.cloudflare.com/workers/platform/limits/ (HIGH)
- OpenNext SSR 1102 on Free, community: https://github.com/psatomas/psatomas.com/issues/44 , https://github.com/Signal-K/client/pull/243 (LOW–MEDIUM)
- Cloudflare Images pricing (5,000 free transforms, 9422 over limit): https://developers.cloudflare.com/images/pricing/ (HIGH)
- R2 public buckets (r2.dev rate-limited, custom domain for prod): https://developers.cloudflare.com/r2/buckets/public-buckets/ (HIGH)
- R2 CORS (presigned PUT, ETag, 30 s propagation, 403 without CORS): https://developers.cloudflare.com/r2/buckets/cors/ (HIGH)
- Turnstile server-side validation (300 s, single-use, timeout-or-duplicate, idempotency_key): https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (HIGH)
- Supabase custom SMTP (30/h default after enabling, DKIM/DMARC/SPF, separate domains): https://supabase.com/docs/guides/auth/auth-smtp (HIGH)
- Supabase passwordless email OTP (`{{ .Token }}`, 60 s, expiry governs links): https://supabase.com/docs/guides/auth/auth-email-passwordless (HIGH)
- Supabase redirect URLs (fallback to Site URL, wildcards): https://supabase.com/docs/guides/auth/redirect-urls (HIGH)
- signInWithOtp sends Confirm signup to new users: https://github.com/orgs/supabase/discussions/28947 , https://github.com/supabase/supabase/issues/12868 (MEDIUM)
- YouTube quota costs (1 unit list calls, 10k/day, reset midnight PT): https://developers.google.com/youtube/v3/determine_quota_cost (HIGH)
- YouTube video resource (embeddable, privacyStatus, regionRestriction, duration): https://developers.google.com/youtube/v3/docs/videos (HIGH)
- YouTube Required Minimum Functionality (no overlays, 200x200, one autoplay): https://developers.google.com/youtube/terms/required-minimum-functionality (HIGH)
- YouTube Developer Policies (30-day storage/refresh, deletion checks): https://developers.google.com/youtube/terms/developer-policies (HIGH)
- YouTube Error 153 referrer requirement: https://til.simonwillison.net/youtube/fixing-153-embed (MEDIUM)
- Resend pricing (Free 100/day, 3,000/month): https://resend.com/pricing (HIGH)
- Live checks run 2026-10-04: `dig` against `aedns.ae`, tasjeel and Cloudflare NS; `whois clickitstory.ae`; `curl -sI https://www.clickitstory.ae`; repo reads of `next.config.ts`, `vercel.json`, `src/proxy.ts`, migrations, cron routes, `package.json` (HIGH)

---
*Pitfalls research for: Vercel to Cloudflare Workers migration of a live Next.js 16 + Supabase streaming catalog*
*Researched: 2026-10-04*
