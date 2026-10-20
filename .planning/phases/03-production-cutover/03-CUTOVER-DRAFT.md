# Phase 3 cutover plan with rollback (DRAFT v2, input for `/gsd-discuss-phase 3`)

Status: draft by work session C, 2026-10-20. v2 applies the independent review (Sonnet `reviewer`, verdict "sound with fixes", 13 findings F1-F13, listed in section 6). Not signed. Nothing here runs before Phase 2 UAT passes and Koss signs Phase 3 discuss and plan.
Sources: ROADMAP Phase 3, `02-RUNBOOK.md` Part B (P3-1..P3-13), job D's `workers/media/DNS-PLAN.md`, code on `origin/main` and on this branch.

## 0. Facts this plan rests on (2026-10-20)

- Public DNS for `clickitstory.ae` has two records only: apex `A 216.198.79.1` (Vercel) and `www CNAME ba211fb55cf67415.vercel-dns-017.com` (Vercel). No MX, SPF, DKIM, DMARC, CAA, DNSSEC. NS at the registry: `ns3/ns4.tasjeel.ae` plus a lame Cloudflare pair `ignat`/`nataly` (same pair as `invios.online`). Details: `workers/media/DNS-PLAN.md`.
- Koss has no Vercel access. The frozen Vercel deployment keeps running with its own env (old Supabase keys, `CRON_SECRET`) and its two crons. Nobody can switch them off or redeploy. Vercel calls its crons on the production deployment internally, so no DNS change ever stops them.
- Rendering does not need any DB rewrite: `src/lib/supabase-media.ts` (`toPublicR2MediaUrl`) maps Supabase Storage URLs to the media host at render time, in the frozen build and in the Worker.
- Job D may move the zone to the ClickitStory account **before** Phase 3 (its steps c-f). If so, P3-1..P3-5 are already done and only need their checks.

## 1. Critical finding: the frozen Vercel cleanup cron and the URL rewrite

`origin/main` `src/app/api/cron/cleanup-media/route.ts` lines 43-58: `extractStoragePath()` only recognises `…/storage/v1/object/public/<bucket>/…` URLs. Every Monday 04:00 UTC the Vercel cron deletes files that are older than 24 h, not referenced, and match its scan: the `shows/` prefix in `show-artwork` and `site-assets`, versioned names only (`hero-<ts>`, `poster-<ts>`, `card-<ts>`, `logo-<ts>`, `<ts>`, `hero-desktop|mobile-<ts>.mp4`). Stable legacy names (`poster.webp`) and the `avatars` bucket are not touched.
After a DB rewrite to `https://media.clickitstory.ae/...`, the referenced set is empty, so every versioned show original in those prefixes would be deleted on the next Monday run. The Worker's own copy of this route (this branch, same lines; flag check line 218) has the same blind spot.

Two ways to stay safe (Q1):
- **A (recommended): do not rewrite in Phase 3.** Rendering already goes to `media.clickitstory.ae`. Move P3-10 to after P3-11 has proven the frozen deployment has no working server key, or to Phase 8 together with emptying Supabase Storage. Needs Koss's signature because the ROADMAP Phase 3 goal says "media URLs rewritten".
- **B: rewrite in Phase 3**, only after P3-11 (key rotation) has proven the frozen cron dead (Supabase API logs show 401s on the old key, Storage object count unchanged after the next Monday 04:00 UTC), plus a snapshot of every Storage original (the 02-08 R2 copy with checksums, or a second local copy) taken before P3-10.

Precondition for ever setting `CLEANUP_SUPABASE_ORIGINALS=on` on the Worker: fix `extractStoragePath` to also recognise media-host URLs (P3-pre-1 below).
Edits made on workers.dev during Phase 2 already point rows at R2 URLs; the Vercel cron then deletes the replaced Supabase original after 24 h. That is the intended orphan cleanup for a replaced image, not loss of a current image, but it means the R2 copy (02-08) must be taken before any workers.dev edit of existing media in UAT (RUNBOOK copy steps come before UAT, keep that order).

## 2. Flip method: Worker Routes on proxied records

A Worker Custom Domain on `www` needs the `www` CNAME deleted first and a new certificate, a gap with no fast rollback. Instead:
- Hard gate: zone **Active** and the Universal SSL edge certificate **Active** (covers the apex and `*.clickitstory.ae`, first level only, on Free; issued only after activation, minutes to hours).
- SSL/TLS mode **Full (strict) first**, while the records are still DNS-only (setting Proxied on Flexible would make Cloudflare talk HTTP to Vercel and loop on Vercel's HTTPS redirect). Before that, check Vercel's certificate on both names: `curl -sI https://www.clickitstory.ae/en` and `curl --resolve clickitstory.ae:443:216.198.79.1 -sI https://clickitstory.ae/`.
- Step A (no visible change): `www` CNAME and apex A to **Proxied**, still pointing at Vercel. Check `server: cloudflare` plus `x-vercel-id`, 200. Then test sign-in and the contact form on the frozen site: it rate-limits contact/newsletter on the first `x-forwarded-for` value (`contact.ts:34`), which behind the proxy becomes a few shared Cloudflare IPs. If it trips, roll Step A back (records DNS-only) and decide.
- Step B (the flip): Worker Routes `www.clickitstory.ae/*` and `clickitstory.ae/*` → Worker `clickit`, plus a route `www.clickitstory.ae/.well-known/acme-challenge/*` (and apex) with **no Worker**, so Vercel keeps renewing its certificates during the proof window (Q3). Check: `server: cloudflare`, no `x-vercel-id`, real HTML, sign-in, an episode plays, admin save, apex redirects to www as Vercel did.
- **Rollback = delete the two Worker routes, then switch Supabase CAPTCHA off if P3-7 already ran** (in that order). Traffic goes back to Vercel through the proxied records. Second level: records back to DNS-only.
- End state (Q4): keep Routes permanently; at P3-13 point the proxied records at an originless `AAAA 100::` instead of Vercel. No switch to Custom Domains (that would bring back the gap).
- Free plan limit: 100k Worker requests per day. Read real daily traffic from the Vercel-era numbers or Web Analytics before the flip; if near the limit, the priced Workers Paid question comes first.

## 3. Ordered steps

Preconditions: Phase 2 UAT passed on workers.dev; Phase 1 SAFE-01/02/04 closed; SAFE-05 closed (stray NS owner known); `media:health` green; Koss signed Phase 3 plan.
**Schema freeze**: no non-additive migration from P3-9B until P3-13 (the rollback to Vercel assumes the schema it was built for).

| # | Step | Who | Expected | Rollback |
|---|------|-----|----------|----------|
| P3-pre-1 | Code: Worker `cleanup-media` recognises media-host URLs (`extractStoragePath`), with tests; P3-10 rewrite script (rule in F11 below), idempotent and re-runnable, with tests on sample rows including `?v=` | work session | tests green, PR landed | — |
| P3-1 | Stray NS pair: in the Invios Cloudflare account, look for a `clickitstory.ae` zone; remove it only after P3-3 shows the ClickitStory zone Active | Koss (read-only first) | owner of `ignat`/`nataly` known | — |
| P3-2 | Screenshot of the Tasjeel DNS panel (no AXFR, so an unprobed hostname would vanish silently); then add zone `clickitstory.ae` (ClickitStory, Free) with only the records in the screenshot, all **DNS only** | Koss | zone records = Tasjeel panel, all grey; NS pair noted | delete the zone |
| P3-3 | At Tasjeel: replace all four NS with the assigned pair. Keep the Tasjeel zone intact | Koss | all four `.ae` registry servers return only the new pair; zone Active; `www` still 200 from Vercel | NS back to `ns3/ns4.tasjeel.ae`; settles within the old NS TTL |
| P3-4 | Wait out the old NS TTL; zone Active; Universal SSL Active; www and apex still Vercel | controller | all true | — |
| P3-4b | Resend: add the domain (Koss's Resend), its SPF/DKIM/DMARC records DNS-only, test send | Koss | Resend Verified; test mail passes SPF, DKIM, DMARC | delete the records |
| P3-5 | `media.clickitstory.ae` → Worker `clickit-media` (job D step f, if not done) | Koss/controller | `npm run media:health` all ok on live HTML | remove the custom domain |
| P3-6 | Before the flip: confirm the frozen cron paths exist (`curl` without a secret → 401) on www (still Vercel) | controller | both 401 | — |
| P3-9A | SSL Full (strict) (still grey), then records Proxied; frozen-site sign-in and contact test | Koss | `server: cloudflare` + `x-vercel-id`; sign-in and contact work | records DNS-only |
| P3-9B | **Flip**: production build (`NEXT_PUBLIC_SITE_URL=https://www.clickitstory.ae`), deploy; routes www/apex → `clickit`; ACME pass-through routes; Turnstile hostnames, Web Analytics site, R2 CORS include www/apex | controller deploys after Koss's word; Koss clicks routes | checks in section 2 Step B | delete the two routes |
| P3-7 | Supabase CAPTCHA on (Turnstile secret), right after the flip | Koss | sign-in on www works (Worker sends tokens) | delete routes first if rolling back, then CAPTCHA off |
| P3-11a | Check Supabase Settings → API Keys: new `sb_publishable`/`sb_secret` keys or legacy JWT `anon`/`service_role` | Koss (read-only) | key type known | — |
| P3-11 | Rotate. **New keys**: create a new secret key, `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name clickit` (ClickitStory HOME), admin save on www works, then revoke the old secret key (publishable key stays). **Legacy**: create new publishable+secret keys, switch the Worker to both (new build for the publishable key), test, then disable legacy keys | Koss types keys | Worker admin save works; Supabase API logs show 401s for the old key; Storage object count unchanged after the next Monday 04:00 UTC | none once revoked (Q1: Vercel rollback becomes read-only for server-key paths with new keys, fully dead with legacy keys) |
| P3-8 | Worker crons on, after P3-11 (so the Worker, not Vercel, publishes and invalidates its own cache): `triggers.crons = CRON_EXPRESSIONS_FOR_PHASE_3`, deploy guard changed in the same commit | controller after Koss's word | both schedules in the dashboard; next `publish-scheduled` 200 | `crons: []`, redeploy |
| P3-10 | Only if Q1 = B. Monday after 04:00 UTC at the earliest: backup table in a **private schema** (or RLS on), columns found by an `information_schema.columns` scan over `public` (text, varchar, citext, json, jsonb, arrays) with a per-column count; dry run; one transaction; re-scan = 0 old-host URLs; check `updated_at`/audit triggers on bulk update. Rule: `https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<key>?q` → `https://media.clickitstory.ae/<bucket>/<key>?q` for buckets `show-artwork`, `site-assets`, `avatars` only, query kept | controller writes, Koss approves the one live step | 0 old-host URLs; images all from the media host; 02-08 checksums still match | restore from the backup table |
| P3-12 | Proof window (Q2): daily `media:health`, sign-in check; re-run the P3-10 script (if used) after any rollback/re-flip and before closing | controller | green | delete routes, then CAPTCHA off |
| P3-13 | Last: Koss closes the window → proxied records to originless `AAAA 100::`; Vercel project deletion if access ever returns (otherwise it keeps running unreached, with dead keys) | Koss | live site green | — |

## 4. Open questions for Koss (discuss-phase)

- **Q1** URL rewrite: A) defer it (rendering already uses the media host; avoids the frozen-cron hazard) or B) rewrite in Phase 3 after the key rotation is proven. Recommended: **A**. Either way the key rotation (P3-11) happens, and after it a Vercel rollback cannot do server-key work (contact, newsletter, admin); with legacy keys it cannot serve viewers either.
- **Q2** Proof-window length. Recommended: 14 days.
- **Q3** ACME pass-through routes so Vercel keeps its certificates during the window. Recommended: yes (no cost).
- **Q4** Routes forever with an originless record, not Custom Domains. Recommended: yes.

## 5. Already built in Phase 2 (branch `claude/phase-02-execute-19d86a`)

- Worker cron handler with the schedules kept off (`src/server/scheduled.ts`, `CRON_EXPRESSIONS_FOR_PHASE_3`); the deploy guard refuses non-empty crons until P3-8 changes both.
- Copy and verify scripts with checksum reports tied to the manifest hash.
- Media Worker (job D + 02-03) with Supabase fallback and variants; `npm run media:health`.
- No admin action deletes a Supabase original any more (02-19). The Worker's `cleanup-media` touches Supabase only with `CLEANUP_SUPABASE_ORIGINALS=on` (keep it off until P3-pre-1).

## 6. Review log (Sonnet `reviewer`, 2026-10-20, verdict "sound with fixes")

F1 rewrite not needed for rendering → Q1 option A; scope of the cron scan corrected; Worker cleanup blind spot → P3-pre-1. F2 key type check (P3-11a), rotation order, contact/newsletter use the admin client, verify via Supabase logs. F3 Worker crons after rotation; cron-path check before the flip. F4 Full (strict) before Proxied; frozen-site rate limit behind the proxy; apex certificate check. F5 Universal SSL as a hard gate. F6 ACME pass-through (Q3 yes). F7 Tasjeel screenshot gate; old NS TTL. F8 Routes forever, originless record; apex→www redirect; 100k requests/day. F9 rollback includes CAPTCHA off. F10 schema freeze. F11 exact mapping rule (a host swap would 404). F12 column types, private backup table, triggers. F13 idempotent re-runnable rewrite.
