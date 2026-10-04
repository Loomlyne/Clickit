# Project Research Summary

**Project:** Clickit Story (CIT)
**Domain:** Live bilingual (AR/EN) streaming catalog over embedded YouTube, moving from Vercel to Cloudflare Workers (OpenNext) with Supabase kept as system of record
**Researched:** 2026-10-04
**Confidence:** MEDIUM-HIGH (platform limits, pricing, Supabase/YouTube/Turnstile behaviour from official docs; `proxy.ts` on OpenNext and live DB migration state are the weak points)

## Executive Summary

This milestone is a brownfield platform move plus product completion. The live app (Next.js 16, Supabase, 15 shows, 3 users) cannot deploy on Vercel at all, so **no code change reaches production until the Cloudflare Worker serves `www.clickitstory.ae`**. Only configuration changes ship before that: DNS, Resend domain, and Supabase Auth SMTP/templates. That fact drives the whole order. The proven way to run Next 16 on Workers is `@opennextjs/cloudflare` (1.20.8), with an R2 incremental cache, a D1 tag cache, a Durable Object revalidation queue, and a custom worker entry that adds `scheduled` (crons) and `queue` (email) handlers. Media moves to a public R2 bucket on `media.clickitstory.ae` with presigned direct uploads. Auth email goes through Supabase custom SMTP to Resend, so it does not depend on the Worker. App email goes through Cloudflare Queues to Resend.

The recommended path is risk-first. (1) Make CI and migrations safe: CI runs `supabase db push --include-all` on every push to `main`, and the first migration starts with `drop table ... cascade`. (2) Move DNS with identical grey-cloud records. (3) Port to Workers and prove it on `workers.dev`. (4) Put the R2 upload path in place, because `sharp` cannot run in workerd. (5) Cut over, switch off Vercel crons, and only then rewrite media URLs. Feature work comes after the cutover, because before that it cannot ship: OTP sign-in, the two-admin model, app emails, YouTube playlist import, search, RTL and dead controls.

Main risks:
- **Destructive migration replay from CI.** Prevent it before any schema change.
- **`proxy.ts` on OpenNext.** Next 16.3.8 is required and OpenNext's Node middleware is experimental. Spike it first; the fallback is edge `middleware.ts`.
- **Workers Free CPU limit.** 10 ms per request returns error 1102 on SSR, so Workers Paid is effectively required. This is a pricing decision for Koss.
- **Old Vercel deployment keeps running crons against the live DB.** It would double-publish and delete Supabase originals.
- **Broken `.ae` delegation.** The registry lists tasjeel plus a Cloudflare NS pair (`ignat`/`nataly`) that answers REFUSED. The orchestrator verified that this pair does not belong to the ClickitStory account (`e329b099…`); the zone does not exist there.

## Key Findings

### Recommended Stack

Keep the existing app stack (Next 16, React 19.2, Supabase, Tailwind v4, next-intl, shadcn, motion, embla, zod, RHF). The changes for this milestone, in gating order:

- **`next` 16.2.9 → 16.3.8** (gating). It is the OpenNext peer floor. The OpenNext CHANGELOG also lists CVE-2026-94545 (`next/og` RCE) for 16.2.0–16.3.5. The app does not use `next/og`, so live exposure is probably low, but the adapter will not install without the upgrade.
- **`@opennextjs/cloudflare` 1.20.8 + `wrangler` 4.147.0** (Node ≥ 22 in CI). Flags: `nodejs_compat`, `global_fetch_strictly_public`. Pin `account_id: e329b099…` in `wrangler.jsonc`, because the default wrangler login is Vamos.
- **Cache bindings.** R2 `clickit-next-cache` (private) with regional cache, `d1NextTagCache`, DO queue (SQLite class), and `enableCacheInterception`. **Do not set `bypassTagCacheOnCacheHit`** until cache purge is wired. ARCHITECTURE.md sets it to `true`; STACK.md and PITFALLS.md say this serves stale admin edits for up to 30 min. Follow STACK.
- **R2 `clickit-media`** behind custom domain `media.clickitstory.ae`, with r2.dev disabled. **`aws4fetch`** presigns PUTs. The R2 binding handles head/list/delete. `@aws-sdk/client-s3` moves to devDependencies (scripts only).
- **Remove:** `sharp`, `botid`, `@vercel/analytics`, `@vercel/speed-insights`, `vercel.json`, and the 55 MB `bodySizeLimit`.
- **Turnstile** (`@marsidev/react-turnstile`). On auth calls, use Supabase's built-in CAPTCHA only. On contact and newsletter, call siteverify yourself. **Cloudflare Web Analytics** uses the manual beacon. Update the CSP for both.
- **Resend** (`resend` 6.32 SDK, batch + idempotency) and **`react-email` 6.11** (`@react-email/components` is deprecated).
- **Optional:** `@supabase/ssr` 0.12.7 + `supabase-js` 2.117. It stops CDN caching of auth responses.
- **CI:** GitHub Actions `pull_request` only, never `pull_request_target` (the repo is public). `NEXT_PUBLIC_*` values live in Actions Variables, because they are inlined at build time. Deploy runs `opennextjs-cloudflare deploy` inside an Environment with Koss as required reviewer.

Version constraints: OpenNext 1.20.8 requires `next >=16.3.8`, wrangler requires Node ≥ 22, and `@supabase/ssr` 0.12 requires `supabase-js` ≥ 2.114.

### Expected Features

The YouTube Required Minimum Functionality rules set the limits for every viewer feature:
- Nothing may overlay the iframe. The current `autoplay-overlay.tsx` sits `inset-0` over the player and must be moved or redesigned.
- No hover-initiated playback.
- One autoplaying player per page.
- YouTube branding cannot be removed.
- No CIT quality picker and no control over ads.

**Must have (table stakes, all P1 this milestone):**
- **Playlist → season import:** preview first, include/exclude per row, pagination past 50, status checks (private, deleted, not embeddable, region-blocked in AE), dedupe on `(season_id, youtube_video_id)`. Imports land as **draft**, never auto-published.
- **Single-episode add** with server-validated ID.
- **Per-episode resume on switch.**
- **Player compliance:** no overlay, `hl`/`cc_lang_pref` taken from the locale, branded error states for errors 100/101/150.
- **Email OTP sign-in:** a code-only email, 6 boxes, paste/auto-fill, a 60 s resend timer, Turnstile in front, and Arabic-Indic digits normalized.
- **Branded auth emails (EN + AR) via Resend**, then welcome, support auto-reply plus admin copy, newsletter double opt-in, and new-episode alerts for My List (opt-in, batched, one-click unsubscribe headers).
- **Two admins** with their own logins, audit actor recorded, and inbox statuses New/Open/Resolved/Spam plus an assignee.
- **AR+EN search** with Arabic normalization (alef, taa marbuta, alef maqsura, tashkeel) on Postgres FTS.
- **Full RTL viewer UI:** logical classes, Embla `direction:'rtl'`, flipped directional icons, `<bdi>` for codes and times.
- **Reviews:** display names, plus edit and delete of your own review.
- **Every dead control wired.**

**Should have (differentiators):**
- One-link season sync ("check for new episodes").
- Import → broadcast-day scheduling in one flow.
- Daily digest alerts at a fixed Dubai time.
- Nightly broken-episode monitor. This also covers the YouTube 30-day data-refresh policy.
- Audit diff and a concurrency warning.

**Defer (v2+):**
- Admin TOTP MFA (P2 unless discuss decides otherwise).
- Trigram fuzzy search.
- Auto-sync cron.
- WhatsApp/SMS OTP and social sign-in.
- Continue-watching emails.
- Web push.

**Anti-features (do not build):** custom skin over the iframe, CSS-cropping YouTube branding, hover previews through YouTube, auto-publish from sync, auto-delete of vanished videos, machine translation of titles, in-app helpdesk, RBAC, magic link and code in the same email.

### Architecture Approach

One Worker (`custom-worker.ts`) re-exports the OpenNext fetch handler and `DOQueueHandler`, and adds two handlers:
- **`scheduled`:** calls the existing `/api/cron/*` routes **in-process** through `handler.fetch`, not by self-fetching the public hostname. That keeps `updateTag`/`revalidatePath` inside a Next request context.
- **`queue`:** consumes app-email events.

Supabase stays the only system of record. D1 holds only cache tags and rate limits. All Cloudflare-specific code lives behind small `src/server/*` modules (media, email, jobs, youtube, ratelimit, admin guard). Replacing the ~12 storage call sites is also when the 4,230-line `admin/actions.ts` gets split by domain.

**Major components:**
1. **OpenNext fetch + `proxy.ts`:** i18n, Supabase session refresh, coming-soon, auth and admin gates. BotID is removed and Turnstile replaces it.
2. **Cache layer:** R2 incremental cache (private bucket), D1 tag cache, DO revalidation queue.
3. **Media:** request presign → browser PUT to the R2 S3 endpoint → finalize (`MEDIA.head`, write the DB URL, audit, `updateTag`). A weekly sweep removes orphans older than 24 h.
4. **Email:** auth email = Supabase SMTP → Resend, with Go templates branching on `{{ .Data.locale }}`. App email = `EMAIL_QUEUE` → consumer → `resend.batch.send`, idempotent per event and user, with a DLQ.
5. **Admin authority:** a `public.admins` table, with the `private.is_admin()` body swapped to read it. Done expand-then-contract; a single `requireAdmin()` serves the app.
6. **YouTube importer:** preview/commit server actions, `YOUTUBE_API_KEY` as a Worker secret restricted by API.

**Cutover order** (each step reversible on its own):
1. Add the zone with identical grey records.
2. NS change at tasjeel.
3. Resend DNS.
4. Supabase SMTP.
5. R2, D1 and Queues resources, then copy the media.
6. DB expand migrations.
7. Worker on `workers.dev`, full UAT.
8. **Disable the Vercel crons.**
9. Attach the Worker custom domain to `www` and the apex.
10. Rewrite DB media URLs, using a backup table.
11. Proof window, then owner-gated contract: empty Supabase Storage, drop `admin_user_id` and `youtube_api_key`, delete the Vercel project.

### Critical Pitfalls

1. **CI replays the destructive first migration or the seed files against live.** Read live `schema_migrations` read-only and diff it against the files. Make the DROP block and the seed migrations guarded no-ops in place (do not delete the files). Move fake data to `seed.sql`. Put `--dry-run` on PRs and gate the real push behind Koss's approval. Fail CI on new `drop/truncate/delete`. Back up before the first schema ship.
2. **`proxy.ts` on OpenNext is experimental (1.20.3+).** Spike it first on `opennextjs-cloudflare preview`. Add a Playwright gate suite: signed-out requests to `/watch`, `/admin` and `/my-list` must return 307, plus coming-soon and locale-cookie checks. Fallback: rename to edge `middleware.ts`. Admin actions keep their own server-side checks.
3. **Old Vercel crons and env keep writing to live Supabase after cutover.** Disable the crons and env in the Vercel dashboard before the DNS flip (deploys are blocked, so a config change cannot be shipped). Rotate `SUPABASE_SERVICE_ROLE_KEY` afterwards. Disable `cleanup-media` everywhere until it understands R2 keys, or it deletes the rollback originals.
4. **NS cutover outage or split-brain.**
   - Resolve who owns `ignat`/`nataly` first.
   - Add the zone in the ClickitStory account and note its assigned pair.
   - Re-create the records exactly, DNS-only.
   - Set exactly two NS at tasjeel and verify against every `aedns.ae` server.
   - Only then attach the Worker domain.

   HSTS `includeSubDomains; preload` is live, so every new subdomain needs valid TLS from its first request.
5. **Cache and session correctness.**
   - Without the R2/D1 cache config, `updateTag` does nothing across isolates and pages re-render on every hit (CPU, 1102).
   - Never add Cache Everything rules on HTML. A response with `Set-Cookie` must be `private, no-store`.
   - `NEXT_PUBLIC_*` values are build-time only. Retire `NEXT_PUBLIC_MEDIA_CUTOVER_READY`; the cutover is a data change, not a flag.

Also high-impact:
- **OTP sends the *Confirm signup* template to new users.** Edit that template as well as Magic Link, and test with a never-seen address.
- **Supabase lowers the auth email rate limit to 30/hour** after custom SMTP is enabled. Set it on purpose.
- **Turnstile tokens are single-use.** Use one verifier per form and reset the widget on failure.
- **Use `CF-Connecting-IP`, never `x-forwarded-for`,** for rate limits.
- **New tables need explicit GRANTs** (the `auto_expose_new_tables` default changed).
- **The PKCE reset link fails when opened on another device.** Move reset to `token_hash` + `verifyOtp`.

## Implications for Roadmap

### Phase 1: Safety baseline and owner decisions
**Rationale:** Every later phase writes schema, and CI can currently replay a destructive migration. Pricing decides whether the Worker can work at all.
**Delivers:**
- Read-only live audit: migration history vs files, which `is_admin` the policies use, the media URL inventory, Supabase plan and backups.
- Destructive and seed migrations neutralized in place.
- CI: lint, typecheck, unit tests and build on PRs. Migration push gated (dry-run plus approval). Destructive-SQL grep.
- A recorded investigation of the stray Cloudflare NS pair.
- Recorded Koss decisions: Workers Paid, Resend plan and domain slot, Images.

**Addresses:** the hardening items "destructive first migration" and "schema drift".
**Avoids:** Pitfall 1 (migration replay) and Pitfall 4 (Free CPU), via the decision gate.

### Phase 2: DNS on Cloudflare and auth email via Resend (config only)
**Rationale:** The zone unlocks the R2 custom domain, Resend DNS, the Worker custom domain and Turnstile. Supabase SMTP does not depend on the Worker and can ship while Vercel still serves, which shrinks the cutover.
**Delivers:**
- Zone in the ClickitStory account with identical grey records. NS moved at tasjeel; only the Cloudflare pair is listed.
- Resend domain with DKIM, SPF on `send.` and DMARC `p=none`.
- Supabase custom SMTP with all auth templates branded EN/AR, Confirm signup included. `{{ .Token }}` added to Magic Link for later OTP use. Rate limit set. Leaked-password protection on.

**Avoids:** Pitfalls 6 (NS split-brain), 20 (Resend DNS before the zone is active) and 10 (template/rate limit).

### Phase 3: Workers platform port (proved on workers.dev)
**Rationale:** Highest technical risk. It must be proved before anything depends on it.
**Delivers:**
- **`proxy.ts` spike first:** Next 16.3.8 + OpenNext 1.20.8.
- **Worker setup:** `wrangler.jsonc`, `open-next.config.ts`, `custom-worker.ts` (crons in-process, queue skeleton), and generated `CloudflareEnv` types.
- **Vercel removal:** `vercel.json`, BotID, `@vercel/*` and their CSP hosts.
- **Turnstile and analytics:** Turnstile on auth, contact and newsletter (Supabase CAPTCHA plus own siteverify), CSP updated, Cloudflare Web Analytics.
- **Fixes:** D1 rate limiter keyed on `CF-Connecting-IP`; constant-time cron secret compare.
- **Static headers:** `_headers` for static assets.
- **Deploy workflow** with an Environment approval.
- **UAT on workers.dev:** gating Playwright suite, cache-invalidation test (edit visible within 10 s), cron run-now.

**Uses:** the STACK core table and the cache bindings.
**Avoids:** Pitfalls 2, 3, 7, 8, 11, 17, 18 and 21.

### Phase 4: R2 media pipeline (pre-cutover)
**Rationale:** `sharp` and 55 MB server-action uploads cannot run on Workers, so admin uploads must work before the cutover.
**Delivers:**
- R2 `clickit-media`: CORS by exact origin, r2.dev off, custom domain `media.clickitstory.ae`, SVG served with strict headers or rejected.
- Presign/finalize uploads with browser-side resize. Splitting `admin/actions.ts` happens here.
- Image strategy (see Gaps).
- Hero MP4s re-encoded with `+faststart`, versioned keys, Safari 206 checked.
- 86 objects copied with checksums by Koss's script run.
- Weekly orphan sweep rewritten for R2 keys.
- SVG sanitizer fix.

**Avoids:** Pitfalls 14, 15 and 16.

### Phase 5: Production cutover
**Rationale:** The point where everything after it can ship.
**Delivers:**
- **Before the flip:** DB expand migrations (admins table, `is_admin` body swap, notification columns, import uniqueness). Vercel crons and env disabled.
- **The flip:** `www` and the apex attached to the Worker, verified on the real domain (`server: cloudflare`, real HTML, cookies kept).
- **After it is stable:** media URL rewrite (DB-wide search, backup/mapping table, zero old-host matches), all tags revalidated, service-role key rotated.
- **Rollback:** the Vercel project stays as the rollback target during the proof window.

**Avoids:** Pitfalls 5, 6 and 9, and Anti-Pattern 4 (data and DNS changed in the same step).

### Phase 6: Design system truth
**Rationale:** Koss's rule is design before code for anything a customer sees. The phases after this one add viewer, admin and email UI.
**Delivers:**
- DESIGN.md and `/design-system` matching the live look (LBC, #ffcc00, #0a0a0a, 8px radius).
- One token set with the 86 hard-coded hex values and the indigo leftovers removed.
- A Claude Design canvas: foundations, viewer, admin and email templates. It includes OTP screens, the RTL treatment, the import preview and inbox, and a player layout that complies with RMF.

### Phase 7: Access and accounts
**Delivers:**
- Sign-up wall (landing and legal stay public).
- OTP sign-in UI. The `shouldCreateUser` choice is for discuss.
- Reset, confirm and email change moved to `token_hash`.
- Two admins: `requireAdmin()`, Nejib's insert as a numbered owner step, audit actor.
- The anon-callable `get_public_youtube_video_id` revoked or moved behind auth.
- `/legal` gating fix.

**Avoids:** Pitfalls 10, 19 and 25 (GRANTs).

### Phase 8: App email events
**Rationale:** Needs the Worker queue and the verified Resend domain.
**Delivers:**
- **Queue:** `EMAIL_QUEUE` producer and consumer with a DLQ.
- **Messages:** welcome (sent once), support auto-reply plus an admin copy with reply-to, newsletter double opt-in.
- **New-episode alerts:** fired by the publish cron and admin publish, idempotent per episode and user, digest cadence, HMAC one-click unsubscribe and a preference toggle.

**Gate:** the Resend plan decision applies before alerts are switched on beyond the 3 current users.

### Phase 9: YouTube import and player
**Delivers:**
- **Reorder fix first**, since bulk import writes positions.
- **Import:** playlist preview/commit with paging, status, AE region, embeddable and dedupe checks, landing as draft, then the existing scheduler. Single-episode add.
- **Key:** Worker secret with API restriction. The old key is rotated by Koss.
- **Player:** per-episode resume on switch. Autoplay-next moved off the iframe for RMF. `hl`/`cc_lang_pref` set. Branded error states. Referrer-Policy kept so error 153 does not appear.
- **Optional:** nightly status re-check cron.

**Avoids:** Pitfalls 12 and 13.

### Phase 10: Product completeness and search
**Delivers:**
- Every dead control wired: genres-grid, CTA and FAQ toggles, CTA copy and genre color editors, season delete, inbox status and assignee.
- Reviews with display names and edit.
- Shorts verified (one autoplay player).
- AR+EN search: IMMUTABLE normalization function, generated tsvector, GIN, and RLS/published filter.
- Broadcast-day validation.
- Placeholder purge as an owner-gated live delete with a backup, from Koss's approved list. Never a CI migration.

### Phase 11: Full Arabic RTL
**Delivers:** an audit of ~117 physical classes plus a lint ban on new ones. Embla RTL, icon flips, `<bdi>`, `tracking` reset for Arabic, input `dir`, a single digit-style decision, `motion`/Lenis mirroring, and Arabic screenshots for UAT.

### Phase 12: Hardening, E2E and contract cleanup
**Delivers:**
- E2E for sign-in, browse, watch and admin import. Stale Playwright specs and dead code removed.
- Contract migrations: drop `admin_user_id` and `youtube_api_key`.
- Supabase Storage emptied through the API.
- Vercel project and domain deleted.
- `supabase.co`, `picsum` and `unsplash` removed from CSP and `remotePatterns`.

Every item is owner-gated after the proof window.

### Phase Ordering Rationale

- **Vercel deploys are blocked,** so nothing in code ships until Phase 5. Phases 1–2 hold everything that can ship before then (CI, migration safety, DNS, Supabase config). Phases 3–4 hold everything the Worker needs on day one: the gates, the cache, the crons, Turnstile replacing BotID, and the uploads without `sharp`.
- **Expand, then cutover, then data rewrite, then contract.** This keeps DNS rollback to Vercel possible at every step.
- **Phase 6 before the feature phases** satisfies design-before-code. The feature phases (7–11) depend on the Worker and partly on each other: email events need the queue and Resend, and import needs the reorder fix and `requireAdmin`. Phases 9 and 10 can run in parallel worktrees, and so can 8 and 9.

### Research Flags

Need `/gsd-plan-phase --research-phase` (or a spike) during planning:
- **Phase 2:** who owns the `ignat`/`nataly` NS pair, the tasjeel/.ae NS change procedure and timing, and whether Cloudflare assigns a different pair to the ClickitStory zone.
- **Phase 3:** `proxy.ts` under OpenNext 1.20.x (experimental), the cache config interplay (regional cache vs purge), and whether `unstable_cache` invalidation works through the D1 tag cache. Also measured CPU per request.
- **Phase 4:** exact `wrangler r2 bucket cors` syntax, Image Transformations zone settings vs the client-side variants approach, and presign header signing.
- **Phase 10:** Arabic Snowball stemmer coverage and normalization, tested against real titles.

Standard patterns (skip research):
- **Phase 6:** design work done on the canvas.
- **Phase 7:** Supabase OTP and admins are well documented.
- **Phase 8:** Queues and Resend batch are documented.
- **Phase 11:** RTL conventions are known.
- **Phase 12.**

**Phase 9:** light. The YouTube API is well documented; the RMF overlay redesign is design work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions and peer ranges come from the npm registry. Limits and pricing come from Cloudflare docs dated Sep–Oct 2026. The OpenNext docs site is stale on size limits and Node middleware; the CHANGELOG was trusted instead. The CVE detail is MEDIUM. |
| Features | MEDIUM-HIGH | YouTube RMF, player parameters, Data API and Supabase OTP are from official docs. The UX norms and competitor comparison come from training data. |
| Architecture | MEDIUM | The bindings and patterns are HIGH. `proxy.ts` on OpenNext is MEDIUM-LOW. The live DB migration state is unverified. |
| Pitfalls | MEDIUM-HIGH | Live DNS, headers and repo were checked directly on 2026-10-04. The 1102-on-Free reports are community-sourced. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

**Decisions pending Koss (pricing: none approved, do not assume):**
- **Workers Paid, $5/month.** Effectively required: Free allows 10 ms CPU per request and per cron, and 50 subrequests.
- **Resend plan.** Free is 100/day and 3,000/month, shared with auth email, versus Pro at $20/month. Free is also capped at 3 domains, so check whether his account has a slot for `clickitstory.ae`.
- **Images.** Enabling paid Image Transformations ($0.50 per 1,000 beyond 5,000 per month) is his decision.

**DNS ownership:** the stray Cloudflare NS pair `ignat`/`nataly` is delegated at the `.ae` registry but is not in account `e329b099…`. Find the owning account or the deleted zone before changing NS. Phase 1 investigation, Phase 2 fix.

**Conflicts between the research files, resolved here:**
- **Image strategy.** STACK recommends a `/cdn-cgi/image` custom loader on the free, hard-capped tier with `onerror=redirect`. ARCHITECTURE recommends client-side resized variants with no transforms. Recommendation: STACK's loader with tight `deviceSizes`, and YouTube thumbnails `unoptimized`. Turning on Transformations is still Koss's decision; if he declines, use ARCHITECTURE's variants.
- **Publish cron cadence.** STACK keeps daily `0 1 * * *` UTC; ARCHITECTURE proposes hourly. Keep daily for parity at cutover and offer hourly as a discuss item. Check it against the Dubai broadcast-day logic.
- **YouTube thumbnails.** FEATURES says copy them to R2; ARCHITECTURE says keep `i.ytimg.com`. Recommendation: keep `i.ytimg.com`, `unoptimized`, with a maxres → standard → high fallback. The nightly re-check also meets the 30-day refresh policy.
- **D1 layout.** One database (`clickit-edge`: tag cache plus `rate_limits`) is enough. STACK's two-database split is optional.
- **OTP expiry.** It also governs reset and confirm links. Set it to about 15 min, not lower.

**Still unverified:**
- **LBC Arabic glyphs.** PITFALLS checked: 209 glyphs in U+0600–06FF. FEATURES assumed none. Line-height and diacritic clipping still need checking with real copy. Email clients will not load LBC, so a fallback stack is needed.
- **Live migration state and `private.is_admin()` presence.** A read-only check in Phase 1.
- **Supabase plan, PITR and backups.** Confirm before the first schema ship.

**Product questions for discuss:**
1. OTP as a sign-up path?
2. Digit style.
3. Alert cadence.
4. Admin MFA at launch?
5. Does the client's channel run ads?

## Sources

### Primary (HIGH confidence)
- npm registry, queried 2026-10-04: OpenNext, next, wrangler, aws4fetch, resend, react-email, Turnstile, Supabase versions and peer ranges.
- OpenNext Cloudflare CHANGELOG and source: `proxy.ts` 1.20.3, the 16.3.8 floor, D1 tag cache stale/expire, the purge fix.
- Cloudflare docs: Workers limits and pricing, R2 (presigned URLs, public buckets, CORS), Images pricing (5k free, 9422, `onerror`), Queues, DO, D1, Turnstile server-side validation, GitHub Actions CI.
- Supabase docs: passwordless OTP, email templates, custom SMTP (30/h), CAPTCHA, Send Email Hook, redirect URLs.
- YouTube: Required Minimum Functionality, player parameters, Data API quota, `playlistItems`/`videos`, Developer Policies (30-day refresh).
- Resend pricing and the Supabase SMTP guide.
- Live checks on 2026-10-04: `dig` against the `.ae` registry, tasjeel and the Cloudflare NS; whois; live response headers; repo files (`next.config.ts`, `vercel.json`, `src/proxy.ts`, migrations, cron routes). Orchestrator check: the zone is absent from the ClickitStory account.

### Secondary (MEDIUM confidence)
- OpenNext issues #962 and #1400 and workers-sdk #13755: Next 16 proxy problems.
- Supabase discussion #28947 and issue #12868: OTP sends Confirm signup to new users.
- RFC 8058 one-click unsubscribe and the Gmail/Yahoo bulk-sender rules.
- YouTube Error 153 referrer requirement (Simon Willison TIL).
- PostgreSQL Snowball Arabic stemmer.

### Tertiary (LOW confidence)
- Community reports of OpenNext SSR returning 1102 on Workers Free.
- Supabase Send Email Hook timeout.
- `setPlaybackQuality` being a no-op.
- GCC competitor feature comparison.

---
*Research completed: 2026-10-04*
*Ready for roadmap: yes*
