# Phase 3 cutover plan with rollback (DRAFT, input for `/gsd-discuss-phase 3`)

Status: draft by work session C, 2026-10-20. Not signed. Nothing here runs before Phase 2 UAT passes and Koss signs Phase 3 discuss and plan.
Sources: ROADMAP Phase 3, `02-RUNBOOK.md` Part B (P3-1..P3-13), job D's `workers/media/DNS-PLAN.md`, live code on `origin/main`.

## 0. Facts this plan rests on (2026-10-20)

- Public DNS for `clickitstory.ae` has two records only: apex `A 216.198.79.1` (Vercel) and `www CNAME ba211fb55cf67415.vercel-dns-017.com` (Vercel). No MX, SPF, DKIM, DMARC, CAA, DNSSEC. NS at the registry: `ns3/ns4.tasjeel.ae` plus a lame Cloudflare pair `ignat`/`nataly` (same pair as `invios.online`). Details: `workers/media/DNS-PLAN.md`.
- Koss has no Vercel access. The frozen Vercel deployment keeps running, with its own env (old service-role key, `CRON_SECRET`) and its two crons, and nobody can switch them off or redeploy.
- Job D may move the zone to the ClickitStory account **before** Phase 3 (its steps c-f: add zone DNS-only, NS at Tasjeel, `media.clickitstory.ae` on the `clickit-media` Worker). If so, steps P3-1..P3-5 below are already done and only need their checks.

## 1. Critical finding: the frozen Vercel cron would delete Supabase originals after the URL rewrite

`origin/main` `src/app/api/cron/cleanup-media/route.ts` (the code the frozen build most likely runs) builds its "referenced" set with `extractStoragePath()`, which only recognises `…/storage/v1/object/public/<bucket>/…` URLs. Every Monday 04:00 UTC the Vercel cron deletes files under the show/site prefixes that are older than 24 h and not referenced.
After the DB rewrite (P3-10) every row points at `https://media.clickitstory.ae/...`, so **every** Supabase original under those prefixes looks orphaned and would be deleted on the next Monday run. The originals are the media Worker's fallback and part of the rollback path.
Koss cannot switch the Vercel cron off (no access). Mitigation, built into the order below:
1. Rotate the Supabase service-role (secret) key **before** the rewrite (P3-11 moves ahead of P3-10). The Vercel deployment then has a dead key: its admin client fails and the cron returns 500 without deleting anything.
2. Run the rewrite on a Monday after 04:00 UTC at the earliest, never on a Sunday night, so even a missed rotation leaves a week to notice.
3. Before the rewrite, take a Storage object list (count + checksums from the 02-08 manifest) and compare it after the next Monday 04:00 UTC.

Consequence Koss must decide (Q1 below): after the rotation, a rollback to Vercel serves viewers (anon/publishable key unchanged) but every Vercel server action that needs the service key fails (admin writes, some account flows).

## 2. Flip method: Worker Routes on proxied records, not Custom Domains, during the proof window

A Worker Custom Domain on `www` needs the existing `www` CNAME deleted first and a certificate issued, which is a gap of seconds to minutes with no record and no rollback faster than re-creating the CNAME. Proposed instead:
- Zone Active, Universal SSL edge certificate covers the apex and `*.clickitstory.ae` (Free plan) before any flip.
- Step A (no visible change): switch the `www` CNAME and apex A to **Proxied** (orange), still pointing at Vercel. SSL/TLS mode **Full (strict)** (Vercel has a valid certificate). Check: `curl -sI https://www.clickitstory.ae/en` shows `server: cloudflare` plus Vercel headers (`x-vercel-id`), 200.
- Step B (the flip): add Worker Routes `www.clickitstory.ae/*` and `clickitstory.ae/*` → Worker `clickit`. Check: `server: cloudflare`, no `x-vercel-id`, real HTML, sign-in and an episode play.
- **Rollback = delete the two routes** (seconds, dashboard or `wrangler` with the ClickitStory HOME). Traffic goes straight back to Vercel through the proxied records. Second-level rollback = set the records back to DNS-only (grey).
- At proof-window close (P3-12): optionally move to Custom Domains, then point the proxied records at an originless target (`AAAA 100::`) before deleting the Vercel project (P3-13).
- Note: while the routes are active, Vercel's HTTP-01 certificate renewal for `www` fails (the Worker answers `/.well-known/acme-challenge`). Vercel certificates last 90 days, so the Vercel rollback path stays healthy for weeks, not months. The proof window should be shorter than about 60 days, or the Worker should pass `/.well-known/acme-challenge/*` through to Vercel (one-line route exclusion, Q3).

## 3. Ordered steps (each: who, command or click, expected, rollback)

Preconditions: Phase 2 UAT passed on workers.dev; Phase 1 SAFE-01/02/04 closed (live migrations safe); SAFE-05 closed (stray NS owner known); `media:health` green against workers.dev; Koss signed Phase 3 plan.

| # | Step | Who | Expected | Rollback |
|---|------|-----|----------|----------|
| P3-1 | Stray NS pair: in the Invios Cloudflare account, check for a `clickitstory.ae` zone; remove it only after P3-3 shows the ClickitStory zone Active | Koss (read-only check first) | Owner of `ignat`/`nataly` known | none needed |
| P3-2 | Add zone `clickitstory.ae` (ClickitStory account, Free); keep only the two records, **DNS only** | Koss | Dashboard shows exactly 2 grey records; note the assigned NS pair | delete the zone (nothing points at it yet) |
| P3-3 | At Tasjeel: replace all four NS with the assigned pair | Koss | `dig +norec NS clickitstory.ae @ns1.aedns.ae` (and the other 3 registry servers) shows only the new pair; zone Active; `curl -sI https://www.clickitstory.ae/en` still 200 from Vercel | set NS back to `ns3/ns4.tasjeel.ae` (records there unchanged); about 1 h to settle |
| P3-4 | Records check | controller | www and apex still Vercel (`x-vercel-id`); Universal SSL "Active" | — |
| P3-4b | Resend: add domain on Koss's Resend account, add its SPF/DKIM/DMARC records in the zone (DNS only), test send | Koss | Resend "Verified"; test mail passes SPF, DKIM, DMARC | delete the records (no mail flow depends on them yet) |
| P3-5 | `media.clickitstory.ae` → Worker `clickit-media` (job D step f, if not done) | Koss/controller | `npm run media:health` all ok on the live HTML | remove the custom domain; frozen site images break again exactly as before D |
| P3-6 | Vercel crons cannot be switched off (no access). Replace with: confirm what the frozen build runs (`curl` the two cron paths without a secret → 401 means they exist) and rely on P3-11 to defang them | controller | Both answer 401 | — |
| P3-8 | Worker crons on: `triggers.crons = ["0 1 * * *", "0 4 * * 1"]` (`CRON_EXPRESSIONS_FOR_PHASE_3`) and the 02-06 deploy guard updated in the same change; deploy | controller, after Koss's word | Dashboard shows both schedules; next run logs `publish-scheduled 200` | set `crons: []` and redeploy |
| P3-9A | Records to Proxied, SSL Full (strict) | Koss | `server: cloudflare` + `x-vercel-id`, 200 | back to DNS only |
| P3-9B | **Flip**: Worker Routes for www and apex → `clickit`; production build target with `NEXT_PUBLIC_SITE_URL=https://www.clickitstory.ae`; add www/apex to the Turnstile widget hostnames, Web Analytics site, R2 CORS; Supabase Site URL/redirects already www | controller deploy, Koss clicks | `server: cloudflare`, no `x-vercel-id`; sign-in, play an episode, admin save; `npm run media:health` | **delete the two routes** (seconds) |
| P3-7 | Supabase CAPTCHA on (Turnstile secret), **right after the flip, not before**: the frozen Vercel site sends no token, so CAPTCHA on would break its sign-in | Koss | sign-in on www still works (Worker sends tokens) | switch CAPTCHA off |
| P3-11 | Rotate the Supabase **secret/service-role key only** (keep the publishable/anon key), `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name clickit` with the ClickitStory HOME | Koss types the key | Worker admin save works; the frozen Vercel cron path now fails (no delete possible) | put the old key back is **not** possible once revoked; rollback to Vercel becomes read-only for server-key paths (Q1) |
| P3-10 | DB media URL rewrite (Monday after 04:00 UTC at the earliest): 1) backup/mapping table `media_url_backup_<date>` with (table, column, row id, old value, new value) for every text/varchar/jsonb column in `public` that contains the Supabase Storage host or the `clickit-media.<sub>.workers.dev` host (found with an `information_schema.columns` scan, then a count per column); 2) dry run printing counts; 3) the `UPDATE`s in one transaction; 4) re-scan = 0 old-host URLs | controller writes SQL, Koss approves the one live step | 0 old-host URLs; every page image from `media.clickitstory.ae`; checksums from the 02-08 report still match (re-copy any delta) | restore from the backup table (one `UPDATE … FROM backup`) |
| P3-12 | Proof window (length: Koss, Q2); daily `media:health` + one sign-in check; Storage object count unchanged after the next Monday 04:00 UTC | controller | all green | delete routes (P3-9B rollback) |
| P3-13 | Last: Koss closes the window → point the proxied records at `AAAA 100::` (originless) or switch to Custom Domains → delete the Vercel project and domain (needs Vercel access; if never regained, the project simply keeps running unreached) | Koss | live site still green | — (one-way) |

## 4. Open questions for Koss (discuss-phase)

- **Q1** Service-key rotation before the URL rewrite (protects the Supabase originals from the frozen Vercel cron, but makes a Vercel rollback read-only for admin and other server-key paths). Recommended: yes, rotate first.
- **Q2** Proof-window length. Recommended: 14 days (inside Vercel's certificate life; see Q3).
- **Q3** Let the Worker pass `/.well-known/acme-challenge/*` through to Vercel during the proof window so Vercel keeps renewing its certificate. Recommended: no, with a proof window of 60 days or less; yes only for a longer window.
- **Q4** Routes now and Custom Domains at the end, or keep Routes. Recommended: Routes during the window, Custom Domains at P3-13.

## 5. What is already built for this in Phase 2 (branch `claude/phase-02-execute-19d86a`)

- Worker cron handler with the two schedules kept off (`src/server/scheduled.ts`, `CRON_EXPRESSIONS_FOR_PHASE_3`); the deploy guard refuses non-empty crons until P3-8 changes both together.
- Copy and verify scripts with checksum reports tied to the manifest hash (`scripts/migrate-supabase-media-to-r2.mjs`, `scripts/media/verify-media-host.mjs`).
- The media Worker (job D + plan 02-03) with Supabase fallback and variants; `npm run media:health` (job D).
- No Supabase original is deleted by any admin action any more (02-19); the Worker's `cleanup-media` only touches Supabase with `CLEANUP_SUPABASE_ORIGINALS=on`.
