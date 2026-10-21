# Phase 3: Production Cutover - Context

**Gathered:** 2026-10-20 (work session `phase-03-production-cutover`, worktree `.claude/worktrees/phase-03-production-cutover-689a87`, branch `claude/phase-03-production-cutover-689a87`)
**Status:** SIGNED. Koss answered all recommended, Q1–Q18 = A, as written in `03-DISCUSS-QUESTIONS.md` (relayed by the controller, 2026-10-20 ~17:55 CET). D-01..D-19 are locked (D-07, D-11, D-18 are derived from the signed answers). The watchdog automation and the Jev rollback advisor stay proposals, not planned, unless Koss says so. Plan gate G1–G7 signed by Koss 2026-10-20 ~18:15 CET (03-PLAN-GATE.md): G2/G3/G5 wordings for ROADMAP criterion 1, DNS-02, MEDIA-02 and the www owner line are approved for 03-13 to apply; G7 applied by the controller.
**Session:** planning only. The control session "Clickit controller" in `/Users/koss/Developer/Clickit` commits main, deploys, runs live steps and talks to Koss.

## Amendments after Phase 2 landed (2026-10-21, controller request; G8-G10 wait for Koss's signature in 03-PLAN-GATE.md)

Phase 2 is on main (6ebc802, history 787ca3a), merged into this branch at 24ffb25. Its `02-RUNBOOK.md` Part B adds gates the plans now carry:

- **A-1 P3-pre-cpu (cutover gate, Koss 2026-10-21):** Koss chose Workers Free plus a caching rebuild of the public pages (session "Clickit /en CPU"). After it lands and is deployed to workers.dev, the full 02-21 measurement is re-run: every signed-out public route under 10 ms CPU (p95 of warm requests, no `exceededCpu`) is Koss's gate; signed-in viewer/admin rows and media Worker rows are measured too, and any row over the limit or unmeasured goes to Koss (Workers Paid price question or his written acceptance). Runbook **Step 0a**; no live Phase 3 step starts before it passes. Cron invocations also have 10 ms on Free and are not covered by it: Step 35 and Step 36a check them in the logs, and an `exceededCpu` goes to Koss as the Workers Paid price question.
- **A-2 P3-pre-migration (cutover gate):** migrations `20261020150526_youtube_episode_status_and_order` and `20261021120000_legal_pages_arabic_review` live (apply-live-migrations.yml, Koss approved), read back read-only. Without the second every legal page answers 404; without the first `youtube-recheck` fails. Runbook **Step 0b**, versions re-read at Step 25.
- **A-3 P3-8 three crons (amends D-12, G8):** production schedules exactly `CRON_EXPRESSIONS_FOR_PHASE_3` = `0 1 * * *` publish-scheduled, `30 1 * * *` youtube-recheck, `0 4 * * 1` cleanup-media (UTC). The `55 0` key change is dropped; the cron map stays as Phase 2 shipped it. Kept from D-12: publish refreshes on every run; the workers.dev target keeps `crons: []`. On the Worker, cleanup-media never deletes Supabase originals (no `CLEANUP_SUPABASE_ORIGINALS`, `CLICKIT_RUNTIME=workers`), prunes `rate_limits` and runs the R2 upload sweep as a dry run. Phase 2's "only after P3-6" is replaced by D-01/D-12: with no Vercel access the frozen Vercel cron may still run at 01:00; publish is idempotent and the Worker refreshes anyway.
- **A-4 P3-8b R2 upload sweep switch (G10):** the first Monday 04:00 UTC dry run inside the proof window is read at **Step 36a** (read-only). The switch to `"on"` is **Step 52a**, optional for closing Phase 3, only on Koss's words "sweep deletes on", after the rewrite (Step 51), set in the top-level and env.production vars, deployed through the production target with `--allow-upload-sweep-delete` (never `cf:deploy:workersdev`, D-18). The sweep matches references by path on any host (`src/server/media-references.ts`), so the rewrite does not change what it keeps.
- **A-5 G1 entry item 4 (G9):** if Koss signs G9, the code plans 03-01..03-06 may start on his recorded "Stay Free, do the rebuild" answer; the live steps still wait for Step 0a.
- Phase 2 Part B mapping: P3-1..P3-5 done in Phases 1-2 (re-proven at Steps 1-2); P3-6 -> Step 27; P3-7 -> Step 44; P3-8 -> Step 26; P3-9 custom domains -> D-07 route + proxied flip (G5); P3-10 -> Steps 47-52; P3-11 -> G4; P3-12 -> Part G; P3-13 -> Step 55; P3-pre-max-rows done by Koss 2026-10-21 (1000).

<domain>
## Phase Boundary

Move production traffic from the frozen Vercel deployment to the Cloudflare Worker built in Phase 2, in the ClickitStory Cloudflare account, without downtime and with a rollback that stays usable until Koss closes the proof window:

1. Prove DNS-01 (zone on Cloudflare, registry lists only jen/brett) against every `.ae` registry server.
2. MAIL-02: Resend can send from clickitstory.ae (SPF, DKIM, DMARC pass on a test send).
3. Media Worker `clickit-media` serves R2 first (Supabase fallback) on `media.clickitstory.ae`.
4. Worker on new Supabase keys, production build for `www.clickitstory.ae`, crons on, then the flip: www served by the Worker; the apex keeps redirecting to www.
5. Proof window with daily checks; rollback = one DNS switch.
6. Closing the window: old Supabase keys off (Vercel loses the database), Supabase CAPTCHA on, DB media URLs rewritten to `https://media.clickitstory.ae` with a backup table and read-back (MEDIA-08), then the Vercel project removed (PLAT-11, or its signed replacement).

Out of scope: emptying Supabase Storage and the contract cleanup (MEDIA-07, Phase 8); auth emails and Supabase SMTP (Phase 5); any new UI; Workers Paid (only on a priced OK from Koss, Phase 2 Step 33).

Entry condition: Phase 2 is on main, its workers.dev UAT passed, and the media copy verify report is 0 failures. Phase 1 SAFE-01/02/04 are closed (live migrations only via `apply-live-migrations.yml` + Koss's approval).

</domain>

<decisions>
## Implementation Decisions

All D-01..D-19 SIGNED by Koss 2026-10-20 ~17:55 CET (question number in brackets).

### Vercel and rollback
- **D-01 [Q1] Vercel access:** ask the account owner (`clickitstory@gmail.com`) for one sign-in to (a) press "Disable Cron Jobs" before the flip and (b) delete the project after the proof window. Plans must work without it: the Vercel-access steps are optional branches, and the fallback rewording of ROADMAP criterion 2 and PLAT-11 is prepared in the gate file.
- **D-02 [Q2] Cutting Vercel off the database:** at the end of the proof window. Mechanism: the Worker already runs on the new Supabase keys (`sb_publishable_…` in the build, `sb_secret_…` as the `SUPABASE_SERVICE_ROLE_KEY` secret); closing the window switches the legacy `anon` + `service_role` keys off in the Supabase dashboard (one setting, reversible per Supabase docs). The legacy JWT secret is NOT rotated (it would sign every viewer out). This satisfies DNS-03 "service-role key rotated after the flip" and the goal "the old Vercel deployment can no longer write".
- **D-03 [Q3] Proof window:** 7 days, closed by Koss's word after green daily checks. Absolute latest close 2026-12-15 (Vercel's www certificate `notAfter` 2026-12-29 02:45 UTC cannot renew once www leaves Vercel; Supabase legacy keys deprecated end of 2026). Re-read both at flip time.
- **D-04 [Q4] Rollback authority:** Koss pre-approves the rollback for the proof window only, on these triggers: www or apex down or 5xx for 10 minutes, sign-in broken, playback broken. The controller rolls back first (grey the www record) and reports at once. Anything else waits for his word.
- **D-16 [Q16] DNS-edit authority:** before the flip Koss creates a Cloudflare API token scoped to Zone → DNS → Edit on `clickitstory.ae` only, stored in macOS Keychain; `scripts/cutover/rollback.mjs` reads it from Keychain at run time (never printed, never in a file) and only toggles `proxied` on the `www` record. Fallback (B): Koss toggles the record himself.
- **D-17 [Q18] Route failure mode:** "fail open" on the www route during the proof window (dashboard setting; overflow goes to the Vercel target); back to the default at close.
- **D-18 (derived) one Worker, two targets:** from the flip until Phase 3 closes, no workers.dev deploy of `clickit` (it would drop the production cron and build). The deploy guard refuses `--target workersdev` while a production stamp is the latest deploy, unless an explicit override names the reason.

### Domain
- **D-05 [Q5] Apex:** keep the existing Cloudflare redirect rule apex → `https://www.clickitstory.ae/${1}` (301, query kept). Criterion 1 reads "apex redirects to www, which serves real HTML from the Worker".
- **D-06 [Q6] Flip time:** Tuesday–Thursday 10:00 Dubai time, Koss available two hours after; not within an hour of 01:00 UTC or Monday 04:00 UTC.
- **D-07 (derived, Claude's discretion, recorded so plans follow one line) — flip mechanism:** Worker **route** `www.clickitstory.ae/*` (zone `clickitstory.ae`), not a custom domain. The route is deployed while the `www` CNAME (to Vercel) is grey, where it has no effect. The flip is editing the `www` record grey → orange (one atomic edit); the rollback is orange → grey. Reason: a custom domain needs the CNAME deleted first, and resolvers that ask in that gap negative-cache NXDOMAIN (Cloudflare SOA minimum 1800 s). Universal SSL already covers www (the apex is proxied and serves TLS today); the plan checks the edge certificate list before the flip. After the proof window the record may be replaced by a proxied `AAAA 100::` (no Vercel target left).

### Media
- **D-08 [Q7] R2-first media:** first ops step of Phase 3, before the flip: re-sync with the Phase 2 tool `npm run r2:media -- --refresh` (dry-run report reviewed), `--execute`, then verify (never `r2:copy --update-changed`, which would overwrite remuxed fast-start MP4s — RESEARCH Pitfall 1), verify every object on `https://media.clickitstory.ae`, then deploy `clickit-media` with the env that has the `MEDIA_BUCKET` R2 binding (named `r2` in `workers/media/wrangler.jsonc` on main today; the executor reads the file on main at the time). Rollback: redeploy `--env supabase-only`.
- **D-09 [Q8] DB rewrite (MEDIA-08):** runs right after D-02 (old keys off), so the frozen Vercel cleanup cron can never see rewritten rows. Until then the Worker build renders Supabase URLs as `media.clickitstory.ae` through `toPublicR2MediaUrl`. Target: `https://media.clickitstory.ae/<bucket>/<key>` (query string such as `?v=` kept). Sources: `https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/<bucket>/<key>` and `https://clickit-media.<SUB>.workers.dev/<bucket>/<key>` (Phase 2 uploads). Columns (01-LIVE-AUDIT §3, re-scanned DB-wide at run time): `app_config` hero_video_url, hero_video_mobile_url, og_image_url, favicon_url, favicon_dark_url, auth_image_url, preloader_video_url, `app_config.footer_content` jsonb (4 URLs), `shows` hero_url, hero_image_mobile_url, card_image_url, poster_url, logo_url, hero_video_url, hero_video_mobile_url, `show_cast.image_url`, `profiles.avatar_url`, `shorts.thumbnail_url`. One transaction; a backup table holds (table, column/json path, primary key, old value, new value, run id); read-back = DB-wide scan of every text/varchar/jsonb column finds zero old-host URLs; reverse script restores from the backup table.
- **D-10 [Q9] picsum posters:** left as they are, listed in the rewrite report.
- **D-19 [Q17] Audit history:** `admin_audit_log` is excluded from the rewrite and from "zero old-host URLs"; the report counts its old-host rows.
- **D-11 (derived) backup table as a migration:** the backup table is created by a normal migration in `supabase/migrations/` that reaches main through the Phase 3 PR and is applied by `apply-live-migrations.yml` after Koss's approval (Phase 1 rule: no DDL outside that path). The data rewrite itself is a reviewed SQL file run once by the controller after Koss's word, preceded by a local `pg_dump` of the affected tables (Free plan, no restorable backup — 01-LIVE-AUDIT §5).

### Crons and sign-in protection
- **D-12 [Q10] Worker crons at the flip** (schedule amended 2026-10-21 by A-3 / G8: the three Phase 2 crons, not `55 0`; the refresh rule stands): production deploy sets `triggers.crons` to `["55 0 * * *"]` (publish-scheduled, 5 minutes before Vercel's 01:00 UTC). `publish-scheduled` refreshes tags/paths on every run, not only when it published something (Vercel may have published first). `cleanup-media` stays unscheduled on the Worker until Phase 8. The workers.dev target keeps `crons: []`.
- **D-13 [Q11] Supabase CAPTCHA:** turned on (provider Turnstile, the Phase 2 widget's secret) in the same closing step as D-02, after the old keys are off.

### Email (MAIL-02)
- **D-14 [Q12, Q13] Resend:** the domain is added in the Resend account that owns the current `RESEND_API_KEY` (Koss names the account, never the key), region Ireland `eu-west-1`. Records exactly as Resend's dashboard gives them (MX + SPF TXT on `send`, DKIM TXT `resend._domainkey`), all **DNS only**, added by Koss in the ClickitStory zone; the controller digs both Cloudflare NS for each record before pressing Verify.
- **D-15 [Q14, Q15] DMARC and sender:** `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:<address Koss names>` for two weeks; moving to `p=quarantine` is a Phase 5 step. Contact form sender `Clickit Story <no-reply@clickitstory.ae>` via the existing `RESEND_FROM_EMAIL` var once verified.

### Gates the controller runs (hard rules from the task)
- **G-DNS:** before any registrar step and before any Resend Verify or flip, `scripts/cutover/dns-check.mjs` digs `jen` and `brett` (`+norec`) for every record in the expected table, and the `.ae` registry servers for NS. Any mismatch: "do not change NS / do not flip".
- **G-REWRITE:** the media-URL rewrite needs Koss's word, a local `pg_dump`, the backup table, and a read-back.
- **G-ROLLBACK:** from the flip until Koss closes the proof window, nothing that breaks the Vercel path runs: no legacy-key switch-off, no CAPTCHA, no rewrite, no Vercel deletion, no removal of the `www` CNAME target.

### Claude's Discretion
Script names and layout under `scripts/cutover/`, test structure, exact SQL shape of the rewrite and scan (inside D-09/D-11), health-check URL samples, wording of runbook steps, the production env file name (`/Users/koss/.clickit-cloudflare/clickit.production.env`), how the production target is expressed in `wrangler.jsonc` (an `env.production` with `"name": "clickit"` is acceptable if `opennextjs-cloudflare deploy` supports `--env`; otherwise a deploy-time config override) — verified by the planner/researcher against OpenNext docs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` — Phase 3 goal and criteria 0–5
- `.planning/REQUIREMENTS.md` — DNS-01..04, MAIL-02, MEDIA-02, MEDIA-07, MEDIA-08, PLAT-04, PLAT-11
- `.planning/phases/03-production-cutover/03-DISCUSS-QUESTIONS.md` — the 15 questions and the 5 facts behind D-01..D-19
- `.planning/phases/01-safe-ground/01-LIVE-AUDIT.md` — §3 media-URL columns, §5 no backups (pg_dump first), §6 registry NS
- `.planning/phases/01-safe-ground/01-CONTROLLER-RUNBOOK.md` — how live migrations are applied (workflow + approval)
- `.planning/research/ARCHITECTURE.md` — "Cutover Order and Rollback", Anti-Pattern 5 (Vercel crons)
- `.planning/research/PITFALLS.md`
- Phase 2 (branch `claude/phase-02-execute-19d86a`, read-only until it lands): `.planning/phases/02-worker-and-r2-media-on-workers-dev/02-RUNBOOK.md` Part B P3-1..P3-13, `02-CONTEXT.md`, `02-06-PLAN.md` (build-target, deploy-guard), `02-07-PLAN.md` (scheduled handler, check-gates), `02-08-PLAN.md` (copy + verify-media-host), `02-20-PLAN.md`, `02-22-PLAN.md`
- `workers/media/DNS-PLAN.md` — zone history, rollback inside Cloudflare, R2 mirror gate (§5d)
- `.planning/handovers/r2-media-copy.md` — `npm run r2:copy` re-sync

### Code
- `src/app/api/cron/cleanup-media/route.ts` — keeps a file only if a Supabase URL references it (fact 2)
- `src/app/api/cron/publish-scheduled/route.ts` — refreshes only when it published something (D-12)
- `src/lib/supabase-media.ts` — `toPublicR2MediaUrl`, cutover flag
- `src/lib/supabase/admin.ts` — reads `SUPABASE_SERVICE_ROLE_KEY` (new secret key goes here)
- `src/lib/resend.ts` — `RESEND_FROM_EMAIL`, default `onboarding@resend.dev`
- `workers/media/wrangler.jsonc`, `workers/media/src/handler.ts`
- Phase 2 branch: `wrangler.jsonc`, `scripts/cf/{build-target,deploy-guard,deploy,wrangler-guard,check-gates}.mjs`, `scripts/media/verify-media-host.mjs`, `src/server/scheduled.ts`, `custom-worker.ts`

### Rules
- `CLAUDE.md`, `/Users/koss/Developer/Clickit/CLAUDE.local.md`, `~/.claude/CLAUDE.md`, `~/.claude/rules/control-session.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- Live DNS read 2026-10-20 15:30 CET: registry NS jen/brett; `www` CNAME `ba211fb55cf67415.vercel-dns-017.com` DNS only (`server: Vercel`); apex proxied, 301 to www; `media` = Worker custom domain (`server: cloudflare`); no MX, TXT, DMARC, DKIM, CAA records; no DS record.
- Live www HTML already references `media.clickitstory.ae` (frozen Vercel build has the media origin baked in), so a DNS rollback after the DB rewrite would still show images.
- `supabase-js` 2.101.0 (new publishable/secret keys supported).
- Legacy key consumers outside the app: `scripts/*.mjs` (backfill, copy, hero videos, slugs), `.github/workflows/pr-gate.yml` uses placeholders only (unaffected). All must be moved to the new keys or confirmed unaffected before D-02.
- Phase 2 guard (`deploy-guard.mjs`) requires `triggers.crons: []` and media envs `''`/`supabase-only`; Phase 3 adds a `production` target and the R2-first media env with their own rules, without loosening the workers.dev rules.

</code_context>

<specifics>
## Specific Ideas

- Koss's words for the phase (via Phase 2 D-05): "remove deployment from Vercel, move it to Cloudflare with the images."
- Every owner step: one numbered step with the exact command or click path, Expected, Then wait. Secrets only into prompts (`wrangler secret put`, `read -rs`), never chat or files.

</specifics>

<deferred>
## Deferred Ideas

- DMARC `p=quarantine`, Supabase SMTP and auth emails (Phase 5).
- Emptying Supabase Storage, dropping `/api/cdn/storage`, storage-range-proxy, the cutover flag (Phase 8, MEDIA-07).
- Re-enabling the Worker `cleanup-media` cron for R2 orphans (Phase 8).
- Proof-window watchdog (automation) and the Jev "propose rollback or hold" call: proposals only (see 03-DISCUSS-QUESTIONS notes).
- Workers Paid: only on a priced OK (Phase 2 Step 33).

</deferred>

---

*Phase: 03-production-cutover*
*Context gathered: 2026-10-20*
