# Phase 3: Production Cutover - Research

**Researched:** 2026-10-20 (14:30-15:10 UTC; all live probes are read-only public `dig` / `curl` / `openssl`)
**Domain:** Cloudflare Workers (OpenNext) production cutover from a frozen Vercel deployment, DNS on Cloudflare, Resend domain auth, Supabase new API keys + CAPTCHA, live-DB media-URL rewrite
**Confidence:** HIGH on OpenNext/wrangler shape, DNS behaviour (empirically probed), SQL (tested on the local stack); MEDIUM on Supabase key-disable behaviour and Resend eu-west-1 record values; LOW on GraphQL analytics access with the wrangler OAuth token and on Worker-route fail-open settings.

<user_constraints>
## User Constraints (from CONTEXT.md)

Status line in CONTEXT.md: Decisions D-01..D-15 are the RECOMMENDED answers to `03-DISCUSS-QUESTIONS.md` Q1..Q15, **pending Koss's signature** (relayed by the controller). Plans are written against them; any other answer is applied as a plan revision before execution.

### Locked Decisions

All D-01..D-15 are recommended, PENDING KOSS (question number in brackets).

#### Vercel and rollback
- **D-01 [Q1] Vercel access:** ask the account owner (`clickitstory@gmail.com`) for one sign-in to (a) press "Disable Cron Jobs" before the flip and (b) delete the project after the proof window. Plans must work without it: the Vercel-access steps are optional branches, and the fallback rewording of ROADMAP criterion 2 and PLAT-11 is prepared in the gate file.
- **D-02 [Q2] Cutting Vercel off the database:** at the end of the proof window. Mechanism: the Worker already runs on the new Supabase keys (`sb_publishable_…` in the build, `sb_secret_…` as the `SUPABASE_SERVICE_ROLE_KEY` secret); closing the window switches the legacy `anon` + `service_role` keys off in the Supabase dashboard (one setting, reversible per Supabase docs). The legacy JWT secret is NOT rotated (it would sign every viewer out). This satisfies DNS-03 "service-role key rotated after the flip" and the goal "the old Vercel deployment can no longer write".
- **D-03 [Q3] Proof window:** 7 days, closed by Koss's word after green daily checks. Hard ceiling 60 days (Vercel's certificate for www stops renewing once www leaves Vercel).
- **D-04 [Q4] Rollback authority:** Koss pre-approves the rollback for the proof window only, on these triggers: www or apex down or 5xx for 10 minutes, sign-in broken, playback broken. The controller rolls back first (grey the www record) and reports at once. Anything else waits for his word.

#### Domain
- **D-05 [Q5] Apex:** keep the existing Cloudflare redirect rule apex → `https://www.clickitstory.ae/${1}` (301, query kept). Criterion 1 reads "apex redirects to www, which serves real HTML from the Worker".
- **D-06 [Q6] Flip time:** Tuesday–Thursday 10:00 Dubai time, Koss available two hours after; not within an hour of 01:00 UTC or Monday 04:00 UTC.
- **D-07 (derived, Claude's discretion, recorded so plans follow one line) — flip mechanism:** Worker **route** `www.clickitstory.ae/*` (zone `clickitstory.ae`), not a custom domain. The route is deployed while the `www` CNAME (to Vercel) is grey, where it has no effect. The flip is editing the `www` record grey → orange (one atomic edit); the rollback is orange → grey. Reason: a custom domain needs the CNAME deleted first, and resolvers that ask in that gap negative-cache NXDOMAIN (Cloudflare SOA minimum 1800 s). Universal SSL already covers www (the apex is proxied and serves TLS today); the plan checks the edge certificate list before the flip. After the proof window the record may be replaced by a proxied `AAAA 100::` (no Vercel target left).

#### Media
- **D-08 [Q7] R2-first media:** first ops step of Phase 3, before the flip: re-sync (`npm run r2:copy -- --refresh`, `--execute --update-changed`, `--verify`), verify every object on `https://media.clickitstory.ae`, then deploy `clickit-media` with the env that has the `MEDIA_BUCKET` R2 binding (named `r2` in `workers/media/wrangler.jsonc` on main today; the executor reads the file on main at the time). Rollback: redeploy `--env supabase-only`.
- **D-09 [Q8] DB rewrite (MEDIA-08):** runs right after D-02 (old keys off), so the frozen Vercel cleanup cron can never see rewritten rows. Until then the Worker build renders Supabase URLs as `media.clickitstory.ae` through `toPublicR2MediaUrl`. Target: `https://media.clickitstory.ae/<bucket>/<key>` (query string such as `?v=` kept). Sources: `https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/<bucket>/<key>` and `https://clickit-media.<SUB>.workers.dev/<bucket>/<key>` (Phase 2 uploads). Columns (01-LIVE-AUDIT §3, re-scanned DB-wide at run time): `app_config` hero_video_url, hero_video_mobile_url, og_image_url, favicon_url, favicon_dark_url, auth_image_url, preloader_video_url, `app_config.footer_content` jsonb (4 URLs), `shows` hero_url, hero_image_mobile_url, card_image_url, poster_url, logo_url, hero_video_url, hero_video_mobile_url, `show_cast.image_url`, `profiles.avatar_url`, `shorts.thumbnail_url`. One transaction; a backup table holds (table, column/json path, primary key, old value, new value, run id); read-back = DB-wide scan of every text/varchar/jsonb column finds zero old-host URLs; reverse script restores from the backup table.
- **D-10 [Q9] picsum posters:** left as they are, listed in the rewrite report.
- **D-11 (derived) backup table as a migration:** the backup table is created by a normal migration in `supabase/migrations/` that reaches main through the Phase 3 PR and is applied by `apply-live-migrations.yml` after Koss's approval (Phase 1 rule: no DDL outside that path). The data rewrite itself is a reviewed SQL file run once by the controller after Koss's word, preceded by a local `pg_dump` of the affected tables (Free plan, no restorable backup — 01-LIVE-AUDIT §5).

#### Crons and sign-in protection
- **D-12 [Q10] Worker crons at the flip:** production deploy sets `triggers.crons` to `["55 0 * * *"]` (publish-scheduled, 5 minutes before Vercel's 01:00 UTC). `publish-scheduled` refreshes tags/paths on every run, not only when it published something (Vercel may have published first). `cleanup-media` stays unscheduled on the Worker until Phase 8. The workers.dev target keeps `crons: []`.
- **D-13 [Q11] Supabase CAPTCHA:** turned on (provider Turnstile, the Phase 2 widget's secret) in the same closing step as D-02, after the old keys are off.

#### Email (MAIL-02)
- **D-14 [Q12, Q13] Resend:** the domain is added in the Resend account that owns the current `RESEND_API_KEY` (Koss names the account, never the key), region Ireland `eu-west-1`. Records exactly as Resend's dashboard gives them (MX + SPF TXT on `send`, DKIM TXT `resend._domainkey`), all **DNS only**, added by Koss in the ClickitStory zone; the controller digs both Cloudflare NS for each record before pressing Verify.
- **D-15 [Q14, Q15] DMARC and sender:** `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:<address Koss names>` for two weeks; moving to `p=quarantine` is a Phase 5 step. Contact form sender `Clickit Story <no-reply@clickitstory.ae>` via the existing `RESEND_FROM_EMAIL` var once verified.

#### Gates the controller runs (hard rules from the task)
- **G-DNS:** before any registrar step and before any Resend Verify or flip, `scripts/cutover/dns-check.mjs` digs `jen` and `brett` (`+norec`) for every record in the expected table, and the `.ae` registry servers for NS. Any mismatch: "do not change NS / do not flip".
- **G-REWRITE:** the media-URL rewrite needs Koss's word, a local `pg_dump`, the backup table, and a read-back.
- **G-ROLLBACK:** from the flip until Koss closes the proof window, nothing that breaks the Vercel path runs: no legacy-key switch-off, no CAPTCHA, no rewrite, no Vercel deletion, no removal of the `www` CNAME target.

### Claude's Discretion
Script names and layout under `scripts/cutover/`, test structure, exact SQL shape of the rewrite and scan (inside D-09/D-11), health-check URL samples, wording of runbook steps, the production env file name (`/Users/koss/.clickit-cloudflare/clickit.production.env`), how the production target is expressed in `wrangler.jsonc` (an `env.production` with `"name": "clickit"` is acceptable if `opennextjs-cloudflare deploy` supports `--env`; otherwise a deploy-time config override) — verified by the planner/researcher against OpenNext docs.

### Deferred Ideas (OUT OF SCOPE)
- DMARC `p=quarantine`, Supabase SMTP and auth emails (Phase 5).
- Emptying Supabase Storage, dropping `/api/cdn/storage`, storage-range-proxy, the cutover flag (Phase 8, MEDIA-07).
- Re-enabling the Worker `cleanup-media` cron for R2 orphans (Phase 8).
- Proof-window watchdog (automation) and the Jev "propose rollback or hold" call: proposals only (see 03-DISCUSS-QUESTIONS notes).
- Workers Paid: only on a priced OK (Phase 2 Step 33).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DNS-01 | clickitstory.ae is a zone in the ClickitStory account and the .ae registry lists only its two Cloudflare nameservers, no downtime | Q7: four `.ae` servers all return only `brett`/`jen` today (probed 14:48 UTC); `dns-check.mjs` pure-function design with tested prototype |
| MAIL-02 | clickitstory.ae passes SPF, DKIM and DMARC for Resend | Q6: exact record names, region `eu-west-1`, verification, header-based proof (`parse-auth-results.mjs`) |
| DNS-02 | www and apex served by the Worker; live response shows Cloudflare, real HTML, working sign-in | Q1 (env.production + route), Q2 (flip semantics, empirical probes), Q9 (proof-check) |
| DNS-03 | Vercel crons off before the flip; service-role key rotated after | Q3 (Worker cron), Q4 (new keys; legacy cannot be rotated, only disabled), Q5 (CAPTCHA) |
| DNS-04 | Rollback to Vercel stays possible until the proof window ends | Q2 (grey toggle, TTL 300), Q10 (cert expires 2026-12-29), Q4 (legacy-key disable reversible) |
| MEDIA-02 | Every stored photo/video served from media.clickitstory.ae; DB holds only R2 URLs | Q8 (rewrite + scan), Q9 (`x-media-source: r2`), re-sync tool finding (Pitfall 1) |
| MEDIA-08 | DB media URLs rewritten to R2 with backup table (live DB, Koss's approval); zero old-host URLs | Q8: SQL tested on local stack (rewrite, scan, reverse byte-identical) |
| PLAT-11 | Vercel project and its domain deleted last, after Koss closes the proof window | D-01 branch; Pitfall on dangling CNAME before deletion; Q2 final record state |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Binding for the planner (repo `CLAUDE.md`, `/Users/koss/Developer/Clickit/CLAUDE.local.md`, `~/.claude/CLAUDE.md`):

- **GSD workflow**: file edits only through a GSD command; this is a planning session. The control session "Clickit controller" commits `main`, deploys, runs live steps, and talks to Koss. A work session never deploys, never writes live data, never sees a secret.
- **Cloudflare**: ClickitStory account `e329b099b6e4272fc0915a99832e47fe` only, every wrangler call as `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 …`; the Cloudflare MCP connector in Claude is the Vamos account and must never be used for Clickit.
- **No Vercel**: Vercel deploys are blocked; treat as frozen. Never take `www` off Vercel before the Worker is proven on workers.dev and the DNS switch is ready. DNS change = Koss's numbered step; live DB media-URL rewrite = his word first.
- **Live DB**: never wipe; live migrations ONLY via `.github/workflows/apply-live-migrations.yml` + Koss's approval; local `pg_dump` before any live write (Free plan, no restorable backup). Supabase project `lajguozmtissnnfccmej`.
- **Secrets**: never in chat, files, or command-line args; repo is PUBLIC. Secrets only into `wrangler secret put` / `read -rs` prompts. Password fields always carry a show/hide eye (not touched here).
- **Reviews**: Grok via his subscription only; fallback the local `reviewer` agent, said on the PR. No Codex/CodeRabbit/Cursor/API-key reviewers.
- **CI**: Linux only; PR CI on open and every push with cancel-in-progress (Clickit exception); `gate:local` before PR; paths-ignore docs/.planning; timeouts. Gate facts: clean-clone `next build` needs placeholder public env.
- **Owner steps**: one numbered step each with the exact command or click path, Expected, then wait. UAT is numbered type/click plus expected result.
- **Heavy steps** share the lock `/Users/koss/.clickit-heavy.lock`; one local Supabase stack at a time; Playwright `--workers=2` max.
- **Phase work** in its own worktree/branch (`claude/phase-03-production-cutover-689a87`), PR, `pr-review`, then Koss's Ship squash-merges.
- **Reports** list verified / not verified / failed.

## Summary

Phase 3 is mostly orchestration and proof, not new product code. The code surface is small: an `env.production` block in `wrangler.jsonc`, a `production` target in the Phase 2 build/deploy guard scripts, one cron-map key, one "refresh on every run" change in `publish-scheduled`, and a set of pure, unit-tested scripts under `scripts/cutover/` (`dns-check`, `proof-check`, `keys-check`, `parse-auth-results`) plus two SQL artefacts (backup-table migration; rewrite/scan/reverse ops SQL). Everything risky is an ordered runbook of owner/controller steps.

Four findings change the plan. (1) `opennextjs-cloudflare deploy` in the version Phase 2 pins (1.20.12) accepts `--env`/`-e` and `--config`/`-c` and forwards them to `wrangler deploy` and to cache population (verified in the published package source); an `env.production` block with `"name": "clickit"` therefore works and keeps the same Worker (secrets, R2/D1/DO state unchanged), but **bindings, vars and secrets are non-inheritable** so the block must redeclare every binding and var, and the two deploys (workers.dev, production) are the same Worker, so the last deploy wins. (2) A probe on 2026-10-20 14:48 UTC shows that Cloudflare already proxies `www` to the Vercel target successfully when a request reaches a Cloudflare IP with `Host: www.clickitstory.ae` (HTTP 200, `server: cloudflare`, `cf-ray`, plus `x-vercel-id`): there is no Error 1014, the `*.clickitstory.ae` Universal certificate is already served for `www`, and the grey→orange flip is therefore safe and atomic; the same trick (`curl --resolve`) gives a no-DNS-change pre-flip test of the Worker route. (3) New Supabase keys are created without disabling the old ones; the legacy `anon` key is a JWT embedded in the live Vercel bundle (role `anon`, verified now: REST call returns 200), which is exactly the post-close proof (expect 401). Supabase states the legacy keys can no longer be rotated and are being deprecated by end of 2026, so "rotate the service-role key" must be implemented as "switch to `sb_secret_…` and deactivate legacy". (4) **D-08 names the wrong re-sync tool**: after Phase 2 lands, `npm run r2:media` (originals + AVIF/WebP variants + faststart remux + checksum report, the input of `verify-media-host.mjs` and the deploy guard) is the copy tool; `npm run r2:copy -- --update-changed` would overwrite remuxed videos with raw Supabase bytes.

Other plan-changing facts: Vercel's `www` certificate (Google Trust Services WR1) expires **2026-12-29 02:45 UTC**, so the rollback ceiling is an absolute date, not "60 days from the flip", and an expired cert behind HSTS (`includeSubDomains`) makes a late rollback a hard TLS failure; the controller's wrangler OAuth login probably cannot edit DNS, so D-04 "controller greys the record" needs a zone-scoped DNS-edit API token created by Koss (open question); Phase 2 never verifies the Turnstile token itself for auth forms, so sign-in/sign-up/reset have **no bot protection until Supabase CAPTCHA is on** (D-13 closing step).

**Primary recommendation:** Deploy `env.production` (same Worker `clickit`, route `www.clickitstory.ae/*` by `zone_id`, crons `["55 0 * * *"]`, full binding/var redeclaration guarded by a unit test) with the route inert, prove it with `curl --resolve` against a Cloudflare IP, then flip by editing the existing `www` CNAME from grey to orange; keep every Vercel-breaking step (legacy-key disable, CAPTCHA, DB rewrite, Vercel deletion) behind Koss's close-the-window word.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serving www HTML, auth, admin | Frontend Server (Worker, OpenNext) | Database (Supabase) | Next.js runs in the Worker; Supabase is the only data store |
| Hostname → Worker routing, TLS, apex redirect | CDN / Edge (Cloudflare zone: DNS, route, redirect rule, Universal SSL) | — | Route + proxied record decide who answers; no origin involved after flip |
| Media serving (`media.clickitstory.ae`) | CDN / Edge (`clickit-media` Worker) | Storage (R2 primary, Supabase fallback) | R2-first Worker with Supabase fallback; custom domain already attached |
| Scheduled publish | Edge (Worker Cron Trigger `55 0 * * *`) | API route `/api/cron/publish-scheduled` | `scheduled()` calls the route in-process with `CRON_SECRET` |
| API-key policy (publishable/secret, legacy off) | Database/Auth platform (Supabase dashboard) | Worker secret + build env | Keys are Supabase project settings; Worker consumes them |
| CAPTCHA enforcement on auth | Database/Auth platform (GoTrue) | Browser (Turnstile widget) | Supabase verifies `captchaToken`; Worker only forwards it |
| Transactional email auth (SPF/DKIM/DMARC) | DNS (Cloudflare zone records) | Resend (sender) | Records live in the zone; Resend verifies them |
| DB media-URL rewrite | Database (Postgres, live) | Controller scripts | Pure data change, one atomic `DO` block, backup table in `private` |
| Cutover proof / rollback | Controller scripts (dig/curl/openssl) | Owner UAT in browser | Everything checkable from outside is scripted; sign-in/playback is owner UAT |

## Standard Stack

### Core (already in the repo or on the Phase 2 branch; versions verified)
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `@opennextjs/cloudflare` | 1.20.12 (pinned on phase-2 branch; npm latest 1.20.12, modified 2026-10-15) [VERIFIED: npm registry] | Build + deploy Next.js to Workers; `deploy --env production` | Official adapter, supports `--env`/`--config` passthrough (source-verified) |
| `wrangler` | 4.151.2 (pinned on phase-2 branch) [VERIFIED: phase-2 package.json] | Deploy, secrets, tail | ClickitStory login via `HOME=/Users/koss/.clickit-cloudflare` |
| `next` | 16.4.2 on phase-2 branch (16.2.9 on main) [VERIFIED: package files] | App framework | Phase 2 bump |
| `@supabase/supabase-js` | 2.101.0 [VERIFIED: package-lock.json] | Data/auth client; accepts `sb_publishable_`/`sb_secret_` keys | Source shows it sends the key as `apikey` and as `Authorization: Bearer <key>` when there is no session |
| `@supabase/ssr` | 0.10.0 [VERIFIED: package-lock.json] | Cookie sessions; `getClaims()` verifies the JWT locally against JWKS | Already used; unaffected by API-key format |
| Node `node:test` + `--experimental-strip-types` | Node 26.7 locally [VERIFIED: `node --version`] | Unit tests for cutover scripts | Existing `npm run test:unit` glob picks up `tests/unit/*.test.ts` |
| `dig`, `openssl`, `curl` | macOS system tools [VERIFIED: probes] | DNS/TLS/HTTP proofs | No dependency |
| `supabase` CLI | 2.119.0 installed (2.121.0 available); `^2.84.6` in package.json [VERIFIED] | `db query --linked` (read/write via Management API), `db dump --linked` | Existing Phase 1 live-read path |
| Postgres `pg_dump` | 18.6 at `/opt/homebrew/opt/libpq/bin/pg_dump` [VERIFIED]; not on PATH | Pre-rewrite local dump | Phase 1 runbook step 7 uses `supabase db dump --linked` (pg_dump under the hood) |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `docker exec supabase_db_Clickit psql -U postgres` | Run SQL on the local stack (no `psql` on PATH) | Local rewrite test (under the heavy lock) |
| Cloudflare GraphQL `workersInvocationsAdaptive` | Daily request count vs Free 100k | Proof-window health line (token scope open question) |
| Resend REST (`POST /emails`, `GET /domains`) | Test send, domain status | Owner terminal with `read -rs` for the key |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `env.production` in `wrangler.jsonc` | Separate `wrangler.production.jsonc` via `--config` | Two files drift; the env block with a drift unit test is safer and keeps one source of truth. Use `--config` only if the env block misbehaves in a dry run. |
| Worker route for www | Worker custom domain | Custom domain needs the CNAME deleted first (NXDOMAIN gap, 30-min negative cache). Rejected by D-07. |
| Rewrite as ops SQL (D-11) | Rewrite as a second migration through the approved workflow | Migration path is more audited but the workflow applies ALL pending migrations, so the rewrite file could only reach `main` after the window closes (second PR). Keep D-11; reuse `scanSql` from `scripts/migration-guard.mjs` as a unit-test lint on the ops SQL. |

**Installation:** none. Phase 3 adds no npm packages (scripts use Node built-ins; SQL runs via existing CLI).

**Version verification:** `npm view @opennextjs/cloudflare version` → 1.20.12 (2026-10-15). `npm view @opennextjs/cloudflare@1.20.12 scripts.postinstall` → empty (no postinstall). Wrangler/next versions read from `origin/claude/phase-02-execute-19d86a:package.json`.

## Package Legitimacy Audit

No new external packages are recommended for Phase 3. The only packages involved (`@opennextjs/cloudflare@1.20.12`, `wrangler@4.151.2`, `@supabase/*`, `next`) are already pinned by Phase 1/2 and in the lockfile.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @opennextjs/cloudflare | npm | multi-year, 1.20.12 published 2026-10-15 | not re-measured | github.com/opennextjs/opennextjs-cloudflare | not run (no new install) | Approved (pre-existing pin, no postinstall script) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
*slopcheck was not run because nothing new is installed; the planner must not add a package without a `checkpoint:human-verify`.*

## Architecture Patterns

### System Architecture Diagram

```
                       VISITOR  https://www.clickitstory.ae / https://clickitstory.ae
                                              |
                            DNS (zone clickitstory.ae, NS jen+brett; TTL 300)
              ______________________________|__________________________________________
             |                                |                                         |
   www CNAME GREY (before flip)     www CNAME ORANGE (after flip)              apex AAAA 100:: ORANGE
   resolves to Vercel IPs           resolves to Cloudflare anycast IPs         resolves to Cloudflare IPs
             |                                |                                         |
   Vercel (frozen build, legacy keys)    Cloudflare edge: Universal SSL (*.clickitstory.ae, LE, to 2027-01-18)
   cert GTS WR1, expires 2026-12-29      |                                         |
             |                           +-- Redirect Rules (apex only) <-----------+--> 301 https://www.clickitstory.ae/${1}
             |                           |
             |                  Workers route  www.clickitstory.ae/*  (zone_id d8fa01b2...)   [deployed BEFORE flip; inert while grey]
             |                           |
             |                  Worker `clickit` (OpenNext, env.production, same script as workers.dev)
             |                    |-- fetch(): Next.js routes, middleware gates, Turnstile forms
             |                    |-- scheduled(): cron "55 0 * * *" -> in-process GET /api/cron/publish-scheduled (CRON_SECRET)
             |                    |-- bindings: R2 NEXT_INC_CACHE, R2 MEDIA, D1 tag cache, DO queue, service self-reference
             |                    '-- secrets: SUPABASE_SERVICE_ROLE_KEY (=sb_secret_), CRON_SECRET, R2_*, RESEND_API_KEY, TURNSTILE_SECRET_KEY, ...
             |                           |
             |                           +--> Supabase (publishable key in browser bundle; secret key server-side)
             +--> Supabase (LEGACY anon/service_role until the window closes)
                                         |
   media.clickitstory.ae --> Worker `clickit-media` (custom domain) --> R2 `clickit-media` first, Supabase Storage fallback (X-Media-Source)
   send.clickitstory.ae MX/TXT, resend._domainkey TXT, _dmarc TXT  --> Resend (eu-west-1) sends contact-form mail

   ROLLBACK = edit www record orange -> grey (TTL 300). Route stays deployed; direct-IP traffic still reaches the Worker.
   CLOSE    = sb_ keys already live -> deactivate legacy keys -> CAPTCHA on -> DB rewrite -> record -> AAAA/self-CNAME -> delete Vercel project
```

### Recommended Project Structure
```
wrangler.jsonc                      # top-level = workers.dev (crons: []); env.production = www route + crons + full bindings
scripts/cf/build-target.mjs         # add target 'production' (site origin www, media origin media.clickitstory.ae, media flag verified)
scripts/cf/deploy-guard.mjs         # add checkProductionDeploy (env.production drift, crons exactly ["55 0 * * *"], route exactly www/*)
scripts/cf/deploy.mjs               # add --target production -> `opennextjs-cloudflare deploy --env production`
src/server/cron-schedule.ts         # key '0 1 * * *' -> '55 0 * * *' (cleanup key stays in map, unscheduled)
src/app/api/cron/publish-scheduled/route.ts   # refresh tags/paths on every successful run
scripts/cutover/
  dns-check-core.mjs  dns-check.mjs # pure parse/judge + thin dig runner (jen, brett, .ae registry)
  proof-check.mjs                   # www/apex/media/TLS/gates checks, --resolve-ip option via node:https lookup
  keys-check.mjs                    # legacy anon extracted at run time from the live bundle -> expect 401; publishable -> 200
  parse-auth-results.mjs            # pure: Authentication-Results text -> spf/dkim/dmarc verdicts
  sql/rewrite-media-urls.sql  sql/scan-old-hosts.sql  sql/reverse-media-urls.sql   # ops SQL (NOT in supabase/migrations)
supabase/migrations/<ts>_media_url_rewrite_backup.sql   # CREATE only (guard-clean)
tests/unit/                         # dns-check, cutover-config drift, rewrite-sql lint, parse-auth-results, scheduled/cron-schedule updates
.planning/phases/03-production-cutover/  # RUNBOOK (numbered owner/controller steps), gate file
```

### Pattern 1: `env.production` on the same Worker (answers Q1)
**What:** One Worker script `clickit`; `wrangler.jsonc` top level is the workers.dev target, `env.production` adds routes + crons and **redeclares** every non-inheritable key.
**Evidence:**
- `opennextjs-cloudflare deploy` registers `--config/-c` and `--env/-e` (`withWranglerOptions`), builds `wranglerArgs` including `--config`, `--env`, and passes them to `wrangler deploy`; `populateCache` and `getPlatformProxy` receive the same `environment` and config path [VERIFIED: `@opennextjs/cloudflare@1.20.12` package source, `dist/cli/commands/{deploy,populate-cache}.js`, `dist/cli/commands/utils/utils.js`]. The OpenNext CLI page documents `--config`/`--env` passthrough for `build`, and says commands "also accept wrangler options" [CITED: opennext.js.org/cloudflare/cli]; it gives no deploy+env example, so the plan must include a **dry run**.
- Worker name: with `--env` Wrangler names the Worker `<top-level-name>-<env>` unless the env sets `name` [CITED: developers.cloudflare.com/workers/wrangler/environments]. The media Worker on main already uses `"name": "clickit-media"` in each env, so the pattern is in-repo precedent. Setting `"name": "clickit"` keeps the same script, its secrets, R2/D1 bindings and Durable Object namespace (`DOQueueHandler`, migration `v1` already applied) — no data split.
- Inheritable: `name, main, compatibility_flags, route/routes, workers_dev, triggers, migrations, assets, observability`. Non-inheritable: `vars, r2_buckets, durable_objects, services` (and treat `d1_databases` as non-inheritable, the docs do not list it) [CITED: developers.cloudflare.com/workers/wrangler/configuration]. `populateCache` throws "No R2 binding NEXT_INC_CACHE_R2_BUCKET found" and "No D1 binding" if the env lacks them [VERIFIED: source], a built-in tripwire.
- `workers_dev` defaults to `false` when routes are configured; set it explicitly [CITED: wrangler configuration].
- Secrets are per Worker script; because the name is identical, `SUPABASE_SERVICE_ROLE_KEY` etc. set with `--name clickit` stay in force. Docs say "secrets are non-inheritable and must be defined per environment" because normal envs get different script names [CITED: environments page]; with an explicit identical name this should not apply — **verify in the plan with the read-only `wrangler secret list --name clickit` before and after the first production deploy** (names only). Confidence MEDIUM.
- `wrangler deploy` overrides dashboard-set vars (not secrets) unless `keep_vars` [CITED: configuration]; so every var must live in the file.
**Example (shape, values from Phase 2 file; not a secret):**
```jsonc
// Source: wrangler configuration docs + phase-2 wrangler.jsonc
"env": {
  "production": {
    "name": "clickit",
    "workers_dev": true,                       // keep the debug URL during the proof window; decide at close
    "routes": [{ "pattern": "www.clickitstory.ae/*", "zone_id": "d8fa01b24f24653a29a0a56431072dc2" }],
    "triggers": { "crons": ["55 0 * * *"] },
    "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "clickit" }],
    "r2_buckets": [ /* NEXT_INC_CACHE_R2_BUCKET -> clickit-next-cache, MEDIA -> clickit-media (copy of top level) */ ],
    "d1_databases": [ /* NEXT_TAG_CACHE_D1 -> clickit-tag-cache, REAL database_id (copy of top level) */ ],
    "durable_objects": { "bindings": [{ "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }] },
    "vars": { /* CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET, CLICKIT_RUNTIME: "workers", RESEND_FROM_EMAIL: "Clickit Story <no-reply@clickitstory.ae>" */ }
  }
}
```
Use `zone_id` (public) instead of `zone_name` to avoid an extra zone-scope lookup [CITED: configuration page]. **Drift guard:** a unit test deep-compares the env's bindings/vars (minus the documented differences) with the top level, and `checkProductionDeploy` asserts crons are exactly `["55 0 * * *"]` and the only route is `www.clickitstory.ae/*`.
**Consequence to state in the runbook:** workers.dev and production are the *same* Worker; the last `deploy` wins. After the production deploy, `clickit.clickitstory.workers.dev` serves the production build (SITE_URL = www). That is acceptable and is the test target before the flip. Deploying the workers.dev target again would replace the production code with a build whose crons are `[]` (top-level triggers) and **remove the cron** (empty array removes triggers [CITED: cron-triggers doc]); the deploy guard must refuse a workers.dev deploy during the proof window unless Koss says so.
**Deploy command:** `HOME=… npx opennextjs-cloudflare deploy --env production` (npm needs the `--` injection OpenNext already handles). Phase 2's `deploy.mjs` calls it with no args today; add `--target production`.

### Pattern 2: Pre-flip proof through Cloudflare IPs, flip as a record edit (answers Q2)
**Facts (all probed 2026-10-20 14:48 UTC):**
- `www` is a grey CNAME `ba211fb55cf67415.vercel-dns-017.com` (TTL 300 at both jen and brett). `vercel-dns-017.com` is served by Vercel's own NS (ns1-4.vercel-dns-017.com), not Cloudflare, so Error 1014 (CNAME cross-user: target hostname in another Cloudflare account) cannot apply [CITED: developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1014].
- `curl --resolve www.clickitstory.ae:443:104.21.29.215 https://www.clickitstory.ae/en` returns **HTTP/2 200**, `server: cloudflare`, `cf-ray: …-MRS`, `cf-cache-status: DYNAMIC`, **and** `x-vercel-id`, `x-vercel-cache: MISS`, `x-matched-path`. So the Cloudflare edge already proxies `www` to the Vercel target without any error even though the record is grey. This is direct evidence that turning the record orange does not hit 1014 and does not break the Vercel path (it serves, through Cloudflare, the same content).
- TLS with SNI `www.clickitstory.ae` against a Cloudflare IP returns a Let's Encrypt (YE1) certificate with SAN `*.clickitstory.ae, clickitstory.ae`, valid 2026-10-20 → **2027-01-18** (both anycast IPs). Universal SSL covers www. (The SNI `clickitstory.ae` path returns a different GTS WE1 cert with SANs `clickitstory.ae, media.clickitstory.ae, *.media.clickitstory.ae`; both are valid.)
- Apex: `https://clickitstory.ae/en` → 301 `https://www.clickitstory.ae/en`, `server: cloudflare`.
**Consequences:**
1. The route `www.clickitstory.ae/*` is inert for visitors while the record is grey (they resolve to Vercel IPs 216.198.79.1 / 64.29.17.1 and never reach Cloudflare). Docs state a route needs a proxied record to be invoked in normal flow [CITED: workers/configuration/routing/routes].
2. **Pre-flip test of the Worker route without DNS change:** after the production deploy, `curl --resolve www.clickitstory.ae:443:104.21.29.215 https://www.clickitstory.ae/en` should return a response **without** `x-vercel-id` (and with the Worker's runtime header). If the edge runs the route for a grey hostname this proves the route; if instead it still returns `x-vercel-id`, the route did not fire for a grey record and the flip is the first real test (still safe, because Vercel keeps answering through the proxy). Confidence MEDIUM that the route fires (not documented; consistent with the probe).
3. **The flip is one edit** of the existing record (proxy toggle). Resolvers holding the CNAME answer (≤300 s) still go to Vercel; the rest get Cloudflare IPs and hit the Worker. Both paths answer 200, so there is no gap. The rollback is the reverse edit; clients that already hold Cloudflare IPs for ≤300 s keep reaching the Worker because the route stays deployed (state this; delete the route only if the Worker itself is the problem).
4. Quantified gap risk of the alternative (record type change, e.g. delete CNAME then create `AAAA 100::`): CNAME and AAAA cannot coexist, so the delete/create pair leaves www with no record for the duration between two API calls; any resolver that asks then caches NODATA/NXDOMAIN for up to the SOA minimum, **1800 s** (SOA `…2417983238 10000 2400 604800 1800` at jen/brett). Not needed for the flip. For the final cleanup (remove the Vercel target) use an **in-place edit of the CNAME content** to the zone's own apex (`clickitstory.ae`, proxied; same type, one update, no Error 1014 since same account) instead of delete+create. Whether the Cloudflare API allows an in-place type change in one PUT is [ASSUMED] and not needed.
**Caveats:** route failure mode on exceeding 100k requests/day is fail-closed Error 1027 by default; the fail mode is a per-route setting [CITED: workers/platform/limits]; wrangler config has no key for it that I could verify, so leave the default and monitor the counter (Open Question 4). Cloudflare zone features (Rocket Loader, Auto Minify, Email Obfuscation, Mirage) apply to proxied HTML — the plan should read them before the flip [ASSUMED defaults off on Free; check in dashboard].

### Pattern 3: Cron triggers (answers Q3)
- Format: five fields, UTC; changes take up to 15 minutes to propagate; `crons: []` removes all triggers, an undefined key keeps them; each environment needs its own `triggers` array [CITED: developers.cloudflare.com/workers/configuration/cron-triggers].
- Limits: **5 Cron Triggers per account on Free** (250 Paid); 10 ms CPU per cron invocation on Free [CITED: workers/platform/limits]. We use 1.
- Phase 2 mapping: `src/server/cron-schedule.ts` `CRON_ROUTES = { '0 1 * * *': '/api/cron/publish-scheduled', '0 4 * * 1': '/api/cron/cleanup-media' }`; `custom-worker.ts` `scheduled(event, env, ctx)` calls `buildCronRequest(event.cron, env.CRON_SECRET)` which uses an **exact string match** and returns `null` for an unknown string (logs `cron: no route`) [VERIFIED: phase-2 files]. **Change needed:** replace the key `'0 1 * * *'` with `'55 0 * * *'` (and update `tests/unit/cron-schedule.test.ts`, `tests/unit/scheduled.test.ts`, which assert the old key and `Object.keys(CRON_ROUTES)`), keep `'0 4 * * 1'` mapped but **not** in `env.production.triggers.crons`. The guard asserts crons are exactly `["55 0 * * *"]`.
- `publish-scheduled` today refreshes only when `episodeIds.length > 0` (identical on main and phase-2 apart from auth); D-12 requires moving `updateTag('episodes'); updateTag('shows'); revalidatePath('/'); revalidatePath('/coming-soon')` outside that condition (still inside the success path).
- `CRON_SECRET` on the Worker was generated and piped into `wrangler secret put` in Phase 2 Step 14 and is never seen by a human, so the controller cannot call the route by HTTP; prove the cron by reading the Worker's log line `cron: /api/cron/publish-scheduled status 200` (observability is enabled) after the first 00:55 UTC run [log retention on Free: ASSUMED short].

### Pattern 4: New Supabase keys (answers Q4)
- Create: Dashboard → Settings → API Keys → "Publishable and secret API keys" tab; keys are named `default`; **"Creating the new keys is safe. Legacy keys keep working."** Multiple secret keys allowed (one per component recommended) [CITED: supabase.com/docs/guides/api/api-keys, …/getting-started/migrating-to-new-api-keys].
- Use: send in the `apikey` header; not as `Authorization: Bearer` (they are not JWTs), except that an exact match of `apikey` and `Authorization` is accepted for backward compatibility [CITED: GitHub discussion 29260]. `@supabase/supabase-js@2.101.0` sets `apikey: <key>` and, when no session exists, `Authorization: Bearer <key>` (`src/lib/fetch.ts`: `accessToken = (await getAccessToken()) ?? supabaseKey`) [VERIFIED: package source] — i.e. the exact-match case; with a session it sends the user's JWT. Supabase says any client version can be initialised with the new values [CITED: discussion 29260]. `@supabase/ssr` 0.10 passes keys through unchanged; `getClaims()` verifies the user's access token locally against JWKS, independent of API-key format [VERIFIED: `src/lib/supabase/middleware.ts` comment + docs "new keys aren't JWTs, so they no longer touch your project's JWT secret"].
- Secret key in the Worker: browser-looking `User-Agent` requests get 401 [CITED]; the Worker builds its own `fetch` calls, no browser UA (low risk; the first admin page load proves it). Realtime: public connections last max 24 h unless authenticated; `review-composer.tsx` subscribes with a signed-in user, so sessions upgrade; UAT item.
- Variable names stay: build `NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_…>` (inlined, public), Worker secret `SUPABASE_SERVICE_ROLE_KEY=<sb_secret_…>` (secret put in the owner's terminal). `src/lib/supabase/admin.ts` needs no change.
- Silent-failure trap: `src/lib/config.ts` reads `app_config` through `createAdminClient()` and falls back to defaults on bad data, so a 200 page **does not prove** the secret key works. Proofs: the admin audit page (`createAdminClient`) as the admin account, and the first `publish-scheduled` cron log (500 on a bad key).
- **Disable legacy keys** (close step): Settings → API Keys → deactivate legacy; "reversible, you can re-activate them if you find a client you missed" [CITED]. "There's no automatic usage indicator, so this is a manual check" [CITED] → the consumer inventory is a plan task: Vercel deployment (frozen, intended), `scripts/*.mjs` using `SUPABASE_SERVICE_ROLE_KEY` (`backfill-translations`, `check-show-hero-video-sizes`, `fix-archived-show-duplicates`, `rewrite-slugs`, `upload-compressed-hero-videos`, `migrate-supabase-media-to-r2` — manual tools, need an `sb_secret_…` in the operator's own env), `.github/workflows/pr-gate.yml` (placeholders only, unaffected), `.env.local` of Koss's machine.
- **Rotation is not possible:** "it is no longer possible to rotate the legacy anon, service and JWT secrets" [CITED: supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd]. DNS-03's "service-role key rotated" = new `sb_secret_` live on the Worker + legacy deactivated. Supabase: "deprecating the anon and service_role keys by the end of 2026" [CITED: migration guide]; discussion 29260 says "Late 2026 (TBC): legacy keys will be deleted." Re-enabling after deletion is unknown. → The proof-window ceiling must also respect this (Pitfall 5).
- What deactivation breaks: everything that still sends the legacy JWTs: the frozen Vercel site (reads, sign-in, writes) and manual scripts. The docs do not specify the HTTP status/body for a deactivated legacy key (a community report quotes "legacy api keys are disabled"); the proof therefore asserts **non-2xx** (expect 401) and records the body.
- Existing user sessions: the new keys do not touch the JWT secret, and the docs are silent on sessions; treat "a signed-in viewer stays signed in after deactivation" as an owner UAT item [ASSUMED].
- **Outside proof without any secret** (`scripts/cutover/keys-check.mjs`): fetch `https://www.clickitstory.ae/en` (frozen Vercel build, until it is gone use the saved bundle URL list), download the `/_next/static/chunks/*.js` files, extract the one JWT whose payload has `role: "anon"` and `ref: lajguozmtissnnfccmej` (verified present today: `iss: supabase`, `exp` 2036), then `GET https://lajguozmtissnnfccmej.supabase.co/rest/v1/shows?select=id&limit=1` with `apikey: <that key>`. **Baseline today: 200.** After deactivation expect 401. Control call with the new publishable key (extract `sb_publishable_[A-Za-z0-9_-]+` from the Worker's own bundle after the flip) must stay 200. Keys are held in memory only, never printed, never written (the repo is public). The legacy `service_role` cannot be extracted (it is a secret); coverage comes from the single dashboard toggle (both legacy keys go together) plus Koss's dashboard read-back.
- Baselines measured today without keys: no key → 401 "No API key found in request"; bad key → 401 "Invalid API key".

### Pattern 5: Supabase CAPTCHA (Turnstile) (answers Q5)
- Dashboard: Settings → Authentication → "Bot and Abuse Protection" (labelled "Attack Protection" in some dashboard versions): toggle CAPTCHA, provider Cloudflare Turnstile, paste the widget's **Secret key**, Save [CITED: supabase.com/docs/guides/auth/auth-captcha]. The secret is typed by Koss in the dashboard only.
- Enforced endpoints (GoTrue `api.go`): `POST /signup`, `/recover`, `/resend`, `/magiclink`, `/otp`, `/token`, `/sso`, `/passkeys/authentication/options`. On `/token` the grant types `pkce`, `refresh_token`, `id_token` are skipped; `password` is enforced. Requests with admin credentials skip it. Missing token → HTTP **400**, message "captcha protection: request disallowed (no captcha_token found)" [VERIFIED: raw GitHub supabase/auth `api.go`, `middleware.go`; the string value of the error code was not confirmed].
- Consequences: signed-in sessions and token refresh keep working; sign-in/up/reset forms must pass `options.captchaToken` — Phase 2 already does (`signInAction`, `signUpAction`, `resetPasswordForEmail`) [VERIFIED: phase-2 `auth/actions.ts`, `login-form.tsx`]. Phase 2 deliberately does **not** call siteverify for these forms (token is single use) — so until this switch is on, **auth forms have no bot protection** (state it in the proof-window risk list). Any script that signs in with a password (Phase 2 `make-session-cookie.mjs`) breaks once CAPTCHA is on.
- **Safe live enforcement test** (no state change): `POST /auth/v1/token?grant_type=password` with `apikey: <publishable>` and a body of a non-existent address (`captcha-probe@example.invalid`) and a wrong password, **no** `captcha_token`. Before CAPTCHA: 400 "Invalid login credentials". After: 400 with a captcha message. A failed login attempt writes nothing (only rate-limit counters). Do not use `/signup` or `/recover` (they create users / send mail). `GET /auth/v1/settings` does **not** expose a captcha field (probed: keys are `external, disable_signup, mailer_autoconfirm, phone_autoconfirm, sms_provider, saml_enabled, …`), so it cannot be the proof.
- Turnstile widget hostnames must include `www.clickitstory.ae` and `clickitstory.ae` (Phase 2 Step 20 lists them) [VERIFIED: runbook].

### Pattern 6: Resend domain + proof (answers Q6)
- Add domain `clickitstory.ae` (root domain, as D-14), region `eu-west-1` (Ireland). Region cannot be changed in place; changing it means deleting and re-adding the domain and updating DNS [CITED: resend.com/docs/dashboard/domains/regions]. Valid region ids: `us-east-1, eu-west-1, sa-east-1, ap-northeast-1` [CITED: Resend Create Domain API].
- Resend recommends a sending *subdomain* for reputation isolation [CITED: domains introduction]; D-14 locks the root domain. Record the trade-off in the runbook; Phase 5 can add a subdomain.
- Records for a root domain (per the Create Domain API example, `us-east-1`; names relative to the zone): `TXT resend._domainkey` (value `p=MIGf…`, dashboard-provided, long), `MX send` → `feedback-smtp.<region>.amazonses.com` priority 10, `TXT send` → `v=spf1 include:amazonses.com ~all`; a `CNAME links → links1.resend-dns.com` appears only when open/click tracking is configured [CITED]. For `eu-west-1` the MX value is expected to be `feedback-smtp.eu-west-1.amazonses.com` [ASSUMED by pattern; the dashboard value is authoritative]. The default return-path subdomain is `send` and cannot be changed after creation [CITED: custom-return-path]. In Cloudflare enter the names as `resend._domainkey` and `send`; all **DNS only** (MX/TXT are never proxied). Long TXT values: paste without quotes; Cloudflare splits >255 chars; `dig` shows several quoted chunks, so the parser must join them.
- DMARC: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:<address Koss names>;` [CITED: resend.com/docs/dashboard/domains/dmarc]. DMARC passes if SPF **or** DKIM passes aligned; Resend signs with `d=clickitstory.ae` (aligned), SPF is checked on `send.clickitstory.ae` (relaxed alignment).
- Existing zone has **no** MX/TXT/DMARC/DKIM/CAA records (probed; DNS-PLAN §2), so there is no conflict with a root MX.
- Verification: add records → controller digs jen and brett for each (G-DNS) → Koss presses Verify in Resend → status `verified` (Resend statuses: not_started/pending/verified/failed/temporary_failure; the docs page that lists them was not retrievable, [ASSUMED]).
- **Test send** that shows all three passing: from Koss's own terminal (`read -rs RESEND_API_KEY`, key never echoed) `POST https://api.resend.com/emails` with `from: "Clickit Story <no-reply@clickitstory.ae>"` to a Gmail address Koss owns; in Gmail "Show original" the header block shows `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Automated judgement: Koss pastes the `Authentication-Results:` lines (they contain no secret) into `scripts/cutover/parse-auth-results.mjs`, a pure function returning PASS/FAIL per mechanism (expects `spf=pass`, `dkim=pass header.d=clickitstory.ae`, `dmarc=pass`).
- `RESEND_FROM_EMAIL`: `src/lib/resend.ts` reads `process.env.RESEND_FROM_EMAIL` with default `Clickit Story <onboarding@resend.dev>` [VERIFIED]. It is not a secret: set it as a **`vars` entry in `env.production`** (value `Clickit Story <no-reply@clickitstory.ae>`), only after the domain shows verified; `RESEND_API_KEY` stays a secret (Phase 2 Step 18). The frozen Vercel site keeps its own env and default sender, untouched.

### Pattern 7: Registry NS proof and `dns-check` (answers Q7)
- `dig NS ae. +short` → `ns1.aedns.ae.`, `ns2.aedns.ae.`, `nsext-pch.aedns.ae.`, `ns4.apnic.net.` (2026-10-20 14:48 UTC) [VERIFIED]. Read the list at run time rather than hard-coding it.
- Exact commands (referrals arrive in the AUTHORITY section, so ask for both sections): `dig +norec +noall +answer +authority NS clickitstory.ae @<server>` for each of the four. Today all four return exactly `brett.ns.cloudflare.com.` and `jen.ns.cloudflare.com.` with TTL 3600. DNSSEC: `dig +norec DS clickitstory.ae @ns1.aedns.ae` returns only the `ae.` SOA (no DS), so the zone is unsigned.
- Zone records, per server in `{jen, brett}`: `dig +norec +noall +answer +authority <TYPE> <name> @<server>.ns.cloudflare.com`. Today: apex A `172.67.171.221`, `104.21.29.215` and AAAA `2606:4700:3032::6815:1dd7`, `2606:4700:3034::ac43:abdd` (proxied placeholders, TTL 300); `www` CNAME `ba211fb55cf67415.vercel-dns-017.com.` TTL 300; `media` A same two Cloudflare IPs; SOA serial `2417983238` identical on both.
- **Pure-function design (prototype tested against live dig output, 7/7 PASS):**
  - `parseDig(text)` → records `{name,ttl,type,data}`; lowercases and strips trailing dots; for TXT joins all quoted chunks.
  - `judge(expect, records)` with kinds `exact` (set equality), `txt-prefix` (e.g. DKIM begins `p=MIGf`, SPF equals), `cloudflare-proxied` (all A/AAAA inside Cloudflare's published ranges: v4 list from cloudflare.com/ips-v4 embedded and unit-tested; v6 prefixes `2400:cb00, 2606:4700, 2803:f800, 2405:b500, 2405:8100, 2a06:98c0, 2c0f:f248`), `absent`.
  - `judgeBoth(expect, {jen, brett})` passes only if **both** pass and both return the same data set; the CLI prints one PASS/FAIL line per record and per registry server, exits 1 on any FAIL, prints "do not change NS / do not flip".
  - Expected tables by phase (`--phase`): `pre-flip` (www exact CNAME to Vercel; apex/media cloudflare-proxied; Resend records exact; `_dmarc` txt-prefix `v=DMARC1; p=none`), `post-flip` (www `cloudflare-proxied`), `rollback` (same as pre-flip), `final` (www `cloudflare-proxied`, no `vercel` anywhere in the zone). Unit tests feed captured dig text fixtures; no network in tests.
  - The runner uses `execFile('dig', [...])` with arrays (no shell), `+time=5 +tries=2`.

### Pattern 8: DB media-URL rewrite (answers Q8)
**Backup-table migration** (guard-clean: contains no `drop`, `truncate`, `delete from`, `then delete`; `private` schema already exists on live via `private.is_admin()`; `public` is the exposed schema so a `private` table is not reachable through the Data API; still `enable row level security` and `revoke … from public, anon, authenticated`):
```sql
create schema if not exists private;
create table if not exists private.media_url_rewrite_backup (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  table_name text not null, column_name text not null,
  row_pk jsonb not null,            -- {"id": <pk>}  (app_config.id is integer, others uuid)
  old_value jsonb not null,         -- to_jsonb(original): JSON string for text, document for jsonb
  new_value jsonb not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  unique (run_id, table_name, column_name, row_pk)
);
alter table private.media_url_rewrite_backup enable row level security;
revoke all on table private.media_url_rewrite_backup from public, anon, authenticated;
```
**jsonb: string replace over the jsonb text vs `jsonb_set` per path.** Use a regexp replace over `col::text` with the `g` flag, cast back to jsonb. It is safe because (a) PostgreSQL does not escape `/` in jsonb text output, (b) the replacement `https://media.clickitstory.ae/\1/` contains no `"` or `\`, so the document stays valid, (c) the pattern requires the exact full prefix and one of the three public buckets, and (d) the backup table stores the entire old and new document, so the reverse restores the old document exactly rather than reverse-replacing. `jsonb_set` per path needs the path list in advance (footer_content structure is operator-edited), so it is the fragile option. Structural check inside the run: `jsonb_path_query(old,'strict $.**')` count equals new count (tested: 8 = 8) and the existing check constraint `app_config_footer_content_shape` (requires keys `tagline`, `social`, `legal`) re-validates on UPDATE — a failing replacement aborts the whole `DO` block. (Live footer URLs are most likely the `legal.*` document links; the local row has none.)
**Rewrite as ONE atomic statement.** A single `DO $$ … $$` block is atomic regardless of how the CLI runner batches statements (so there is no dependence on an assumed transaction wrapper). It loops a fixed driver list (the D-09 columns), for each column (1) `INSERT … SELECT` backup rows for rows whose computed new value differs, (2) `UPDATE … FROM backup` guarded by `to_jsonb(col) = old_value` (no lost concurrent edit), (3) `RAISE EXCEPTION` if backed-up count ≠ updated count. Patterns: `^https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/` and `^https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/` → `https://media.clickitstory.ae/\1/` (query string untouched). Anything in another bucket or another host is intentionally left and shows up in the scan. **Tested on the local stack** (rolled-back transaction; fixtures on the real `shows`/`app_config` rows): 35 backup rows over 4 columns, `?v=` kept, `other-bucket` and picsum left alone, scan flagged exactly the left-alone column, reverse restored 35 values and a before/after `to_jsonb` row comparison matched 17/17 shows and 1/1 app_config. The reference SQL (migration, rewrite, reverse) is in Code Examples.
**DB-wide scan (read-only, one statement):** `information_schema.columns` for `data_type in ('text','character varying','jsonb','json','ARRAY')` on base tables in `public` and `auth`, each probed with `query_to_xml(format('select count(*) … where %I::text ~ %L'))` for `supabase\.co/storage|workers\.dev|lajguozmtissnnfccmej`; exclude `private`. Expected exceptions to decide explicitly: `public.admin_audit_log.diff` (history of old values — list, do **not** rewrite audit history; the "zero" criterion should read "zero in served data, audit history excluded and listed") and any prose in `legal_pages.content` / `faqs.answer`. Include `auth.users.raw_user_meta_data` / `raw_app_meta_data` (01-LIVE-AUDIT: no URLs today). Views (`episodes_view`) are derived; skip.
**Live execution path:** DML only, so it is outside the migration workflow. D-11: ops SQL run once by the controller with `supabase db query --linked --project-ref lajguozmtissnnfccmej -f <file>` after Koss's word and a fresh local dump (`supabase db dump --linked [--data-only]` into `/Users/koss/.clickit-backups/`, runbook step 7 pattern). Start the file with `select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user` as a separate read to confirm the CLI login role can update under RLS (open item; the Phase 1 audit read through the same role). Reverse: set the run id (`select run_id, count(*) from private.media_url_rewrite_backup group by 1`), run `reverse-media-urls.sql`; each backup row gets `restored_at`.
**Migration guard:** the guard scans only files **added or changed under `supabase/migrations`** (base vs head) with `drop` (any, except `drop not null/default/identity/expression`), `truncate`, `delete from`, `then delete` flagged unless waived with a same-line `-- safe-drop: <reason>`. The CREATE TABLE above passes untouched. The ops SQL is outside the guard's scope, so add a unit test that runs the exported `scanSql` over `scripts/cutover/sql/*.sql` and fails on any destructive keyword (no `delete`/`drop`/`truncate` is needed anywhere: rewrite and reverse are UPDATE-only, history rows get `restored_at`).
**Local test recipe** (under `/Users/koss/.clickit-heavy.lock`): stack `_Clickit` is up now (ports 55321/55322 forwarded via the Colima ssh process, containers `supabase_db_Clickit` etc.); `psql` is not on PATH, use `docker exec -i supabase_db_Clickit psql -U postgres -v ON_ERROR_STOP=1 < test.sql`. Wrap the whole test in `begin; … rollback;` (migration SQL, fixtures with `update` on real local rows, rewrite, scan, reverse, before/after snapshot compare). `supabase db reset` is not needed and is heavier. The local DB is PostgreSQL 17.11; confirm live is 17.x (`select version()` read).

### Pattern 9: Proof-window checks (answers Q9)
Reuse as-is against `https://www.clickitstory.ae` and `https://media.clickitstory.ae`:
- `node scripts/cf/check-gates.mjs --base https://www.clickitstory.ae` (GET only: `/en`,`/ar` 200, `/` locale redirect, signed-out gates to `/en/auth`, `/api/cron/*` 401, dev route 404) — `ALL PASS` required. Add `--admin-cookie-file`/`--viewer-cookie-file` only for the owner UAT run. Pitfall: it uses `fetch`, which cannot be pinned to an IP; for the pre-flip run use the workers.dev URL, and for the `--resolve` proof use `proof-check.mjs` (below).
- `node scripts/media/verify-media-host.mjs --origin https://media.clickitstory.ae --report <copy-report from r2:media>` → "verify ok … 0 failures" (the origin allow-list already accepts `media.clickitstory.ae`).
- `npm run media:health` (default site www, pages `/en`, `/en/watch`, `/en/portfolio`, `/en/series/last-call`) → every media URL 200; add a check that responses carry `x-media-source: r2`.
**Add (`scripts/cutover/proof-check.mjs`, node:https with a `lookup` override for `--resolve-ip`):**
1. `GET /en` on www: 200, `server: cloudflare`, `cf-ray` present, **no `x-vercel-id`/`x-vercel-cache`** (the only discriminator between "Cloudflare proxying Vercel" and "Worker"; empirically both show `server: cloudflare`), and the Worker marker header. Recommendation: add one response header `x-clickit-runtime: workers` in `custom-worker.ts` (tiny change, makes the check unambiguous) — otherwise rely on absence of `x-vercel-id`.
2. Apex: `GET https://clickitstory.ae/en` → 301, `Location: https://www.clickitstory.ae/en` exact, `server: cloudflare`; `http://clickitstory.ae/` → 301 to https.
3. `media`: 200, `server: cloudflare`, `x-media-source` is `r2` for 10 sampled objects.
4. TLS: `openssl s_client … | openssl x509 -noout -dates -issuer` for www (edge cert must be the Cloudflare LE/GTS one with `notAfter` > 14 days) — and record the **Vercel** cert expiry as the rollback deadline.
5. DNS: `dns-check.mjs --phase post-flip` (all jen/brett).
6. Request counter: dashboard Workers → `clickit` → Metrics, or GraphQL `workersInvocationsAdaptive` filtered by `scriptName: "clickit"`, summing `requests`/`errors` by `datetime`, POST to `https://api.cloudflare.com/client/v4/graphql` [CITED: developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics]. Token scope is not named in the docs and whether the wrangler OAuth token can read analytics is **unverified** (LOW); fallback is a dashboard screenshot read by Koss. Free limit 100,000 requests/day, resets 00:00 UTC; static-asset requests served by the assets binding are not billed as Worker requests [ASSUMED]. There is no traffic baseline (Vercel analytics access lost): take it from Cloudflare zone analytics for the first week.
7. Cron: log line from the 00:55 UTC run.

### Pattern 10: Rollback validity and ceiling (answers Q10)
- Measured 2026-10-20 14:48 UTC: `openssl s_client -connect www.clickitstory.ae:443 -servername www.clickitstory.ae | openssl x509 -noout -dates` → `notBefore=Sep 30 02:45:12 2026 GMT`, `notAfter=Dec 29 02:45:11 2026 GMT`, issuer Google Trust Services WR1, subject `CN=www.clickitstory.ae` [VERIFIED].
- Vercel renews certificates only while the domain's DNS resolves to Vercel (D-03 fact 4 cites Vercel docs; Vercel docs not re-fetched, [CITED via 03-DISCUSS-QUESTIONS fact 4]). After the flip the www record resolves to Cloudflare, so the **last day a DNS rollback has a valid certificate is 2026-12-28 (UTC)**, a fixed date independent of the flip date (unless the flip happens after Vercel's renewal window opens, roughly 30 days before expiry, and renewal succeeds first; read the cert again at flip time and recompute).
- `strict-transport-security: max-age=63072000; includeSubDomains; preload` is served by the Vercel site today, so any browser that has seen it cannot click through an expired cert → a late rollback is a hard outage for returning visitors.
- Second ceiling: Supabase deprecates the legacy keys by end of 2026; if they are deleted, a Vercel rollback has no database. Plan: close the window by **2026-12-15 at the latest**, and replace D-03's "60 days" with "7 days, absolute ceiling = min(2026-12-15, cert notAfter − 14 days)". If the flip date is after ~Nov 25 the 7-day window still fits.
- Rollback authority gap: D-04 has the controller edit DNS. The wrangler OAuth session may not carry a DNS-edit scope (docs: `wrangler login` uses "all the available scopes" by default, scope list not published on the pages read; `wrangler login --scopes-list` shows them) → Open Question 1.

### Anti-Patterns to Avoid
- **Deleting the `www` CNAME to attach a custom domain** (D-07 already rejects it).
- **A second Worker name for production**: splits secrets, creates a new DO namespace/migration, and the R2/D1 cache.
- **Using `r2:copy --update-changed` after `r2:media` ran**: overwrites remuxed videos with raw originals, never regenerates variants (Pitfall 1).
- **Removing the Vercel project while the `www` record still points at a Vercel target**: dangling record; first retarget the record (Pattern 2, point 4).
- **Treating a 200 page as proof of the secret key** (config falls back silently).
- **Deploying the workers.dev target during the proof window**: removes the cron (empty `triggers`) and replaces the production build.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-env wrangler deploy | A shell wrapper juggling configs | `opennextjs-cloudflare deploy --env production` + `env.production` | Forwards `--env`/`--config` and populates the cache from the same env's bindings |
| Cron dispatch | A custom scheduler | Cron Trigger + existing `scheduled()` | Already built and unit-tested in Phase 2 |
| DNS verdicts | Eyeballing `dig` | `dig-check-core` pure functions (tested prototype) | Parses referrals, split TXT chunks, proxied IP ranges, both servers must agree |
| SPF/DKIM/DMARC evaluation | Own DNS/DKIM verification | Resend's domain verification + the receiving mailbox's `Authentication-Results` | The receiving server is the authority; parse its verdicts |
| Atomic multi-table rewrite | Application loops / many statements | One `DO $$` block + backup table with `restored_at` | Atomic by construction, reversible, reviewable |
| Destructive-SQL lint for ops SQL | A new regex | Exported `scanSql` from `scripts/migration-guard.mjs` | Already handles comments, dollar quotes, waivers |
| API-key leak check | Storing the anon key to compare | Extract from the live bundle at run time, never write it | Repo is public |
| CAPTCHA verification for auth forms | Server-side siteverify in actions | Supabase CAPTCHA (token single use) | Phase 2 design; double verification would burn the token |
| Media copy/verify | New copy logic | Phase 2 `r2:media` + `verify-media-host.mjs` | Variants, faststart, checksum report, deploy-guard contract |

**Key insight:** every dangerous step is an ordering/authority problem, not a coding problem; the scripts exist to make the order checkable (DNS answers, headers, 401 vs 200) without any secret.

## Runtime State Inventory

Phase 3 is a hosting migration, so the question "after the repo is updated, what runtime systems still carry the old thing?" applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live Postgres: media URLs with `lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/…` (app_config 6 cols + footer_content 4, shows 3×15 + poster 1, show_cast 1, profiles 1) and Phase 2 `clickit-media.clickitstory.workers.dev` URLs; 3 `picsum.photos` posters; `admin_audit_log.diff` history (01-LIVE-AUDIT §3; scan to confirm) | **Data migration** (D-09/D-11 DO block with backup), after old keys are off; picsum and audit history left and listed |
| Live service config | Supabase: API keys (legacy active, new ones to create), Auth CAPTCHA off, Redirect URLs (workers.dev entry added in Phase 2 Step 23), Site URL already www. Cloudflare: zone DNS (www grey CNAME), redirect rules, Turnstile widget hostnames, Web Analytics site(s), Worker route (new), cron triggers (new). Resend: domain not yet added. Vercel: project/crons/env (no access) | Dashboard steps (owner), none are in git |
| OS-registered state | None — verified: no launchd/pm2/Task Scheduler involvement; checks run ad hoc from the controller's Mac | None |
| Secrets / env vars | Worker secrets by name: `SUPABASE_SERVICE_ROLE_KEY` (replace with `sb_secret_…`), `CRON_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `TURNSTILE_SECRET_KEY`. New: `/Users/koss/.clickit-cloudflare/clickit.production.env` (public `NEXT_PUBLIC_*` only). `RESEND_FROM_EMAIL` becomes a plain var. Vercel env keeps legacy keys until the window closes | `secret put` replace (owner terminal); no key names change |
| Build artifacts | `NEXT_PUBLIC_*` are inlined into the build: SITE_URL, Supabase URL, **publishable key**, media origin + `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified`, Turnstile site key, CF beacon token must all be set **in the production build**; `.open-next/` stamp per target; the frozen Vercel bundle contains the legacy anon key by design | Rebuild per target (`build-target.mjs --target production`), never reuse the workers.dev build |

## Common Pitfalls

### Pitfall 1: Re-sync with the wrong tool (HIGH)
**What goes wrong:** D-08 runs `npm run r2:copy -- --execute --update-changed`. After Phase 2, the bucket may hold remuxed (faststart) MP4s at the original keys and `_v/…` variants written by `r2:media`; `r2:copy` compares raw bytes with Supabase, sees "changed", and `--update-changed` overwrites the remuxed videos with raw originals, and never creates variants.
**Why:** two tools (PR #24 `copy-supabase-media-to-r2-wrangler.mjs`, Phase 2 `migrate-supabase-media-to-r2.mjs`) write one bucket; the phase-2 branch predates #24 and does not contain it.
**How to avoid:** the plan reads Phase 2's SUMMARY/verify report and re-syncs with `npm run r2:media -- --refresh`, dry-run review, `--execute`, then `verify-media-host.mjs --origin https://media.clickitstory.ae --report <copy report>`; keep `r2:copy` only as a read-only `--verify` or retire it. Confidence MEDIUM (depends on what Phase 2 actually ran).
**Warning signs:** `--update-changed` reporting overwrites of `.mp4`; verify failures on `?w=` variants.

### Pitfall 2: Media Worker config merge conflict
Main's `workers/media/wrangler.jsonc` has the custom-domain route live at top level and in both envs (`supabase-only`, `r2`); the phase-2 branch version has the route commented out, R2 binding at top level and `supabase-only` with `r2_buckets: []`, and its `deploy-guard` (`MEDIA_ENVS = ['', 'supabase-only']`) only knows those. After Phase 2 merges, the plan must read the file on main at that time and update `checkMediaDeploy`/`MEDIA_ENVS` to the R2-first env name actually present (D-08 already says so). The R2-first gate (DNS-PLAN §5d) requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in the running app and `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` — production satisfies all four.

### Pitfall 3: Fixed-key overwrites during a rollback
R2-first serving plus a Vercel rollback: an admin uploading on Vercel writes Supabase only; a fixed key (favicon, OG, avatars, hero video) is then stale in R2. Avoid admin media edits during the window or re-run `r2:media --execute` after any rollback.

### Pitfall 4: Vercel's weekly cleanup cron inside the window
Monday 04:00 UTC the frozen Vercel cron may still run against live Supabase (D-01 branch B: it cannot be disabled). It deletes Supabase files that no DB row references **only if** Supabase URLs are what rows hold; admin replacements made on the Worker write R2 URLs, so the replaced Supabase originals look orphaned. R2 holds copies from the re-sync, so this loses no data, but it deletes Supabase objects before MEDIA-07's approval. The flip rule (not within an hour of Monday 04:00) is not enough: record that one Monday run falls inside a 7-day window, and prefer no Worker admin media edits until the run has passed (or the window closed).

### Pitfall 5: Time boxes you do not control
Vercel cert `notAfter` 2026-12-29 and Supabase's end-of-2026 legacy-key deprecation. Read both at flip time and fix the close date (Pattern 10).

### Pitfall 6: Auth forms unprotected until close
Phase 2's criterion "request without a valid token is refused" is not true for sign-in/up/reset until Supabase CAPTCHA is on; the contact/newsletter forms are verified server-side. Say so in the proof-window risk list and in the UAT map.

### Pitfall 7: Same Worker, two targets
A workers.dev redeploy during the window silently removes the cron and the production build (Pattern 1). Guard + runbook line.

### Pitfall 8: Dangling Vercel record at deletion
Retarget the record (in-place CNAME edit to the zone apex, proxied) **before** deleting the Vercel project (PLAT-11), so no Vercel-pointing name remains that another Vercel account could claim [ASSUMED risk class; the retarget is cheap either way].

### Pitfall 9: Secret keys and the repo
The repo is public: no key, no anon JWT, no `sb_*` value in any file, test fixture, log, or PR text. `keys-check.mjs` and `proof-check.mjs` hold keys in memory only; tests use synthetic strings.

### Pitfall 10: Phase 2 entry conditions
Phase 3 starts only if Phase 2's CPU report passed on Workers Free (10 ms CPU per request and per cron invocation; Step 33 may require Workers Paid, which needs a priced OK from Koss) and Phase 2 is on main. Cron triggers also run at 10 ms CPU on Free; if the first 00:55 run fails with Error 1102-like logs, that is the Workers Paid question again.

## Code Examples

### Reference rewrite, scan, reverse (tested on the local stack inside a rolled-back transaction)
```sql
-- rewrite-media-urls.sql (UPDATE/INSERT only; one atomic statement)
do $rewrite$
declare
  v_run uuid := gen_random_uuid();
  v_rx text[] := array[
    'https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/',
    'https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/'];
  v_repl text := 'https://media.clickitstory.ae/\1/';
  c record; v_new text; v_cnt bigint; v_upd bigint;
begin
  for c in select * from (values
      ('app_config','hero_video_url','text'),('app_config','hero_video_mobile_url','text'),
      ('app_config','og_image_url','text'),('app_config','favicon_url','text'),
      ('app_config','favicon_dark_url','text'),('app_config','auth_image_url','text'),
      ('app_config','preloader_video_url','text'),('app_config','footer_content','jsonb'),
      ('shows','hero_url','text'),('shows','hero_image_mobile_url','text'),
      ('shows','card_image_url','text'),('shows','poster_url','text'),
      ('shows','logo_url','text'),('shows','hero_video_url','text'),
      ('shows','hero_video_mobile_url','text'),
      ('show_cast','image_url','text'),('profiles','avatar_url','text'),
      ('shorts','thumbnail_url','text')) as v(tbl, col, typ)
  loop
    v_new := case c.typ
      when 'text' then format('regexp_replace(regexp_replace(t.%1$I, %2$L, %4$L), %3$L, %4$L)', c.col, v_rx[1], v_rx[2], v_repl)
      else format('regexp_replace(regexp_replace(t.%1$I::text, %2$L, %4$L, ''g''), %3$L, %4$L, ''g'')::jsonb', c.col, v_rx[1], v_rx[2], v_repl) end;
    execute format($q$
      insert into private.media_url_rewrite_backup(run_id, table_name, column_name, row_pk, old_value, new_value)
      select %1$L::uuid, %2$L, %3$L, jsonb_build_object('id', t.id), to_jsonb(t.%3$I), to_jsonb(%4$s)
      from public.%2$I t where t.%3$I is not null and %4$s is distinct from t.%3$I $q$, v_run, c.tbl, c.col, v_new);
    get diagnostics v_cnt = row_count;
    execute format($q$
      update public.%1$I t set %2$I = %3$s from private.media_url_rewrite_backup b
      where b.run_id = %4$L::uuid and b.table_name = %1$L and b.column_name = %2$L
        and b.row_pk = jsonb_build_object('id', t.id) and to_jsonb(t.%2$I) = b.old_value $q$,
      c.tbl, c.col, case c.typ when 'text' then 'b.new_value #>> ''{}''' else 'b.new_value' end, v_run);
    get diagnostics v_upd = row_count;
    if v_upd <> v_cnt then raise exception 'rewrite mismatch on %.%: backed up %, updated %', c.tbl, c.col, v_cnt, v_upd; end if;
    raise notice '%.%: % row(s)', c.tbl, c.col, v_cnt;
  end loop;
  raise notice 'run_id %', v_run;
end $rewrite$;
```
```sql
-- scan-old-hosts.sql (read-only; expect zero rows after the rewrite, audit history listed separately)
select table_schema, table_name, column_name, hits from (
  select table_schema, table_name, column_name,
    (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I where %I::text ~ %L',
      table_schema, table_name, column_name, 'supabase\.co/storage|workers\.dev|lajguozmtissnnfccmej'), false, true, '')))[1]::text::int as hits
  from information_schema.columns c
  where table_schema in ('public','auth') and data_type in ('text','character varying','jsonb','json','ARRAY')
    and table_name in (select table_name from information_schema.tables t
                       where t.table_schema = c.table_schema and t.table_type = 'BASE TABLE')) s
where hits > 0;
```
```sql
-- reverse-media-urls.sql (UPDATE only; replace RUN_ID_HERE with the run id)
do $reverse$
declare v_run uuid := 'RUN_ID_HERE'::uuid; b record; v_n bigint := 0; v_one bigint; v_typ text;
begin
  for b in select * from private.media_url_rewrite_backup where run_id = v_run and restored_at is null order by id loop
    select data_type into v_typ from information_schema.columns
      where table_schema = 'public' and table_name = b.table_name and column_name = b.column_name;
    execute format('update public.%I t set %I = %s where t.id::text = %L and to_jsonb(t.%I) = %L::jsonb',
      b.table_name, b.column_name, case when v_typ = 'jsonb' then '$1' else '($1 #>> ''{}'')' end,
      b.row_pk->>'id', b.column_name, b.new_value) using b.old_value;
    get diagnostics v_one = row_count;
    if v_one <> 1 then raise exception 'reverse: row % %.% not at new value', b.row_pk, b.table_name, b.column_name; end if;
    update private.media_url_rewrite_backup set restored_at = now() where id = b.id; v_n := v_n + 1;
  end loop;
  raise notice 'restored % value(s)', v_n;
end $reverse$;
```

### dns-check core (prototype run against live dig output, 7/7 PASS)
```js
// Source: prototype in the research scratchpad; parse + judge are pure, the runner is a thin execFile('dig') wrapper
export function parseDig(text) {
  const out = []
  for (const raw of String(text).split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith(';')) continue
    const m = /^(\S+)\s+(\d+)\s+IN\s+(\S+)\s+(.*)$/.exec(line)
    if (!m) continue
    let data = m[4].trim()
    if (m[3] === 'TXT') data = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('')   // join split chunks
    else data = data.replace(/\.$/, '').toLowerCase()
    out.push({ name: m[1].replace(/\.$/, '').toLowerCase(), ttl: Number(m[2]), type: m[3], data })
  }
  return out
}
// dig args: ['+norec','+noall','+answer','+authority','+time=5','+tries=2', TYPE, name, '@server']
// judgeBoth(expect, {jen, brett}): PASS only if both servers pass AND return the same data set.
```

### Pre-flip and post-flip proofs (read-only)
```bash
# Worker route fires through a Cloudflare IP while the record is still grey (expect NO x-vercel-id)
curl -sSI --resolve www.clickitstory.ae:443:104.21.29.215 https://www.clickitstory.ae/en | grep -iE '^(HTTP|server|cf-ray|x-vercel|x-clickit)'
# Rollback ceiling: Vercel certificate dates (expect notAfter=Dec 29 02:45:11 2026 GMT)
echo | openssl s_client -connect www.clickitstory.ae:443 -servername www.clickitstory.ae 2>/dev/null | openssl x509 -noout -dates
# Registry proof (loop over: dig NS ae. +short)
dig +norec +noall +answer +authority NS clickitstory.ae @ns1.aedns.ae
```

### Production deploy shape (controller, after Koss's word)
```bash
# Source: OpenNext 1.20.12 deploy.js passthrough; wrangler pinned 4.151.2
HOME=/Users/koss/.clickit-cloudflare npm run cf:deploy:production -- --dry-run      # guard only (new script wraps: build-target --target production; deploy-guard; then)
HOME=/Users/koss/.clickit-cloudflare npx opennextjs-cloudflare deploy --env production
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rotate legacy `anon`/`service_role`/JWT secret | Publishable/secret keys, deactivate legacy | June 2025 preview; legacy deprecated by end of 2026 | "Rotate service-role key" becomes "new secret key + deactivate legacy" |
| One Vercel-style cron file | Worker Cron Triggers in wrangler | Phase 2 | Cron string must match `CRON_ROUTES` exactly |
| Worker custom domain for every hostname | Routes for hostnames with an existing external record | n/a | Avoids delete-then-add gap |
| Resend default region us-east-1 | Per-domain region incl. `eu-west-1` | current | Fixed at creation |

**Deprecated/outdated:** `opennextjs-cloudflare --configPath` (use `--config`, source logs a deprecation warning); workers.dev as the production host; the Phase 2 runbook P3-9 ("attach Worker custom domains www and apex") and P3-11 ("rotate the service role key") are superseded by D-05/D-07 and Pattern 4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Worker route fires for a request that reaches a Cloudflare IP while the `www` record is grey (consistent with the 14:48 probe, not documented) | Pattern 2 | Pre-flip `--resolve` proof unavailable; the flip is then the first real test (still safe) |
| A2 | With an explicit identical `name`, secrets set via `--name clickit` apply to `env.production` | Pattern 1 | Worker would run without secrets after the first production deploy; mitigated by `secret list` before/after and by the deploy dry run |
| A3 | eu-west-1 return-path MX is `feedback-smtp.eu-west-1.amazonses.com` | Pattern 6 | Wrong record typed; dashboard value is authoritative (D-14), dig check compares with it |
| A4 | Existing user sessions survive deactivating legacy keys | Pattern 4 | Viewers signed out at close; reversible toggle |
| A5 | Supabase PG/CLI login role can UPDATE tables under RLS via `db query` | Pattern 8 | Rewrite fails with 0 rows; check `rolbypassrls` first |
| A6 | Static-asset requests do not count toward the 100k/day Worker request limit | Pattern 9 | Counter higher than expected; monitoring covers it |
| A7 | Cloudflare edge features (Rocket Loader etc.) are off by default on the zone | Pattern 2 | HTML rewriting breaks hydration; read the settings before the flip |
| A8 | Wrangler OAuth token may read GraphQL analytics / edit DNS | Pattern 9 / 10 | Falls back to dashboard reads and a Koss-made scoped token |
| A9 | Vercel's renewal window and domain-claim rules (dangling CNAME) behave as commonly documented | Pattern 10, Pitfall 8 | Rollback ceiling slightly different; retarget is cheap either way |
| A10 | Workers log retention on Free is short (days) | Pattern 3 | Cron proof must be read the same day |

## Open Questions

1. **Who can edit DNS at night (D-04)?**
   - Known: DNS changes in Cloudflare are not in `wrangler`; the wrangler OAuth login probably lacks a DNS-edit scope; the Cloudflare MCP is the Vamos account.
   - Unclear: whether the controller can PATCH `/zones/d8fa01b24f24653a29a0a56431072dc2/dns_records/<www id>` `{"proxied": false}`.
   - Recommendation: before the flip, run `wrangler login --scopes-list` (read-only); if no DNS scope, one owner step: Koss creates an API token limited to Zone → DNS → Edit on `clickitstory.ae` only, stores it in macOS Keychain, and the rollback script reads it from there; otherwise D-04 downgrades to "Koss toggles it".
2. **D-08 tool choice** — confirm with the Phase 2 SUMMARY which tool wrote the final bucket contents (Pitfall 1).
3. **Production target without Vercel access** — D-01 branch B: nothing can stop Vercel's Monday cleanup; accept per Pitfall 4 or ask the owner for one sign-in.
4. **Route failure mode** — keep fail-closed (Error 1027 at 100k/day) or set fail-open in the dashboard so overflow falls back to Vercel during the window? Not settable in wrangler as far as verified; default is closed. Recommend leave default and monitor.
5. **Web Analytics / `NEXT_PUBLIC_CF_BEACON_TOKEN` for www** — Phase 2 Step 22 may have been refused for workers.dev; create the www site token before the production build (inlined at build time).
6. **Phase 2 CPU report / Workers Paid** — entry condition; if Free fails, cron and pages inherit it.
7. **Admin-audit history in the scan** — confirm the "zero old-host URLs" wording excludes `admin_audit_log.diff` (history) or Koss wants it rewritten.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `dig` | dns-check, proofs | ✓ | system BIND | — |
| `openssl` | cert expiry | ✓ | /opt/homebrew/bin/openssl | — |
| `curl` | proofs | ✓ | system | — |
| Node | scripts, tests | ✓ | v26.7.0 | — |
| `gh` | PR/CI | ✓ | ~/.local/bin/gh | — |
| `supabase` CLI | live read/dump/query | ✓ | 2.119.0 (2.121.0 available) | — |
| Docker (Colima) + local stack `_Clickit` | rewrite test | ✓ | containers healthy; PG 17.11; ports 55321/55322 | `supabase start` |
| `psql` | local SQL | ✗ on PATH | — | `docker exec -i supabase_db_Clickit psql -U postgres` |
| `pg_dump` | pre-rewrite dump | ✓ (not on PATH) | 18.6 at `/opt/homebrew/opt/libpq/bin` | `supabase db dump --linked` |
| `wrangler` logged in to ClickitStory | deploys, secrets | not probed (research-only rule) | 4.151.2 pinned | — |
| Heavy lock `/Users/koss/.clickit-heavy.lock` | local DB test | file absent now (free) | — | — |
| Cloudflare DNS-edit credential for the controller | D-04 rollback | unknown | — | Koss toggles the record |
| Vercel dashboard access | D-01 cron off / project delete | ✗ (lost) | — | D-01 branch B wording |

**Missing dependencies with no fallback:** none blocking planning.
**Missing dependencies with fallback:** `psql` on PATH (docker exec); DNS-edit credential (Open Question 1); Vercel access (branch B).

## Validation Architecture

(`workflow.nyquist_validation` is true in `.planning/config.json`.)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via `node --experimental-strip-types --test` |
| Config file | none; script `test:unit` in `package.json` globs `tests/unit/*.test.ts` and `tests/unit/**/*.test.ts` |
| Quick run command | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/dns-check.test.ts` (per file) |
| Full suite command | `npm run gate:local` (lint, typecheck, test:unit, guard:migrations, build; Phase 2 adds `cf:build`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DNS-01 | All four `.ae` servers list only jen+brett; jen/brett serve every expected record identically | unit (parse/judge with dig fixtures) + live script | `node --test tests/unit/dns-check.test.ts`; live: `node scripts/cutover/dns-check.mjs --phase pre-flip` | ❌ Wave 0 |
| MAIL-02 | Resend records present on both NS; SPF/DKIM/DMARC pass on a real message | unit (parse-auth-results fixtures) + live dns-check + owner test send | `node --test tests/unit/parse-auth-results.test.ts`; live: dns-check + owner pastes headers | ❌ Wave 0 |
| DNS-02 | www/apex served by Worker (headers, 301, no `x-vercel-id`, gates ALL PASS); real account signs in and plays | live script + owner UAT | `node scripts/cutover/proof-check.mjs --site https://www.clickitstory.ae`; `node scripts/cf/check-gates.mjs --base https://www.clickitstory.ae`; **owner UAT**: sign in and play an episode | proof-check ❌ Wave 0; check-gates ✅ (Phase 2) |
| DNS-03 | Worker cron exact string maps to route; guard allows exactly `["55 0 * * *"]`; legacy anon refused (401), secret key works | unit + live | `node --test tests/unit/scheduled.test.ts tests/unit/cron-schedule.test.ts tests/unit/cutover-config.test.ts`; live: `node scripts/cutover/keys-check.mjs`; owner: admin audit page loads; Worker cron log; dashboard read-back | ❌ Wave 0 (update 2 existing) |
| DNS-04 | Rollback = record to grey restores Vercel (`server: Vercel`, `x-vercel-id`); cert `notAfter` read and ceiling computed | live script + rehearsal | `node scripts/cutover/dns-check.mjs --phase rollback`; `proof-check.mjs --expect vercel`; optional owner-approved rehearsal toggle on flip day | ❌ Wave 0 |
| MEDIA-02 | Every media URL on live pages 200 from `media.clickitstory.ae` with `x-media-source: r2`; verify report 0 failures | live script | `npm run media:health`; `node scripts/media/verify-media-host.mjs --origin https://media.clickitstory.ae --report <copy report>` | ✅ (Phase 2) |
| MEDIA-08 | Rewrite + scan + reverse correct and reversible; guard-clean; live read-back zero | SQL test on local stack + unit lint + live scan | local: `docker exec -i supabase_db_Clickit psql -U postgres -v ON_ERROR_STOP=1 < scripts/cutover/sql/test-local.sql` (inside `begin…rollback`); unit: `node --test tests/unit/rewrite-sql.test.ts`; live: `supabase db query --linked -f scripts/cutover/sql/scan-old-hosts.sql` (read) | ❌ Wave 0 |
| PLAT-11 | Vercel project deleted; www no longer references a Vercel target | owner UAT (+ fallback reword) + dns-check `final` | `dns-check.mjs --phase final`; owner confirms deletion screenshot/text | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/updated unit file (`node --test …`).
- **Per wave merge:** `npm run test:unit` and `npm run guard:migrations`.
- **Phase gate:** `npm run gate:local` green; then live proofs in runbook order, each a numbered step with Expected output.

### Wave 0 Gaps
- [ ] `tests/unit/dns-check.test.ts` — parse/judge fixtures (split TXT, referral in authority, proxied ranges, disagreeing servers) — DNS-01, MAIL-02, DNS-04
- [ ] `tests/unit/cutover-config.test.ts` — `env.production` drift vs top level, crons exactly `["55 0 * * *"]`, route exactly `www.clickitstory.ae/*`, `name: "clickit"`, `vars` contain `RESEND_FROM_EMAIL` — DNS-02/03
- [ ] `tests/unit/parse-auth-results.test.ts` — MAIL-02
- [ ] `tests/unit/rewrite-sql.test.ts` — `scanSql` lint of `scripts/cutover/sql/*.sql` (no destructive keywords) and migration guard clean — MEDIA-08
- [ ] `scripts/cutover/sql/test-local.sql` (+ driver) — rolled-back local test of rewrite/scan/reverse — MEDIA-08
- [ ] Updates: `tests/unit/cron-schedule.test.ts`, `tests/unit/scheduled.test.ts` (new key `55 0 * * *`), `tests/unit/` for `build-target`/`deploy-guard` production target
- [ ] `scripts/cutover/{dns-check,proof-check,keys-check,parse-auth-results}.mjs`
- [ ] Framework install: none
**Owner-only UAT (numbered type/click + expected):** sign in with a real account on www, play an episode, progress remembered; admin audit page loads (proves `sb_secret_`); reviews realtime update for a signed-in viewer; viewer stays signed in after legacy keys are deactivated; Resend Verify click and Gmail "Show original" for the test send; Supabase dashboard toggles (create keys, deactivate legacy, CAPTCHA on); Cloudflare record toggle; Vercel project deletion (or branch-B wording). Automated proof is preferred for everything else.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + CAPTCHA (Turnstile) on password/OTP/recover/signup; legacy keys off |
| V3 Session Management | yes | `@supabase/ssr` cookies, JWT verified via `getClaims()`; sessions survive key change (UAT) |
| V4 Access Control | yes | RLS on `public`; backup table in `private` with RLS on and grants revoked; admin check `private.is_admin()` |
| V5 Input Validation | yes | Fixed driver list + `%I`/`%L` quoting in the DO block; URL regex anchored to exact host + three buckets |
| V6 Cryptography | yes | Never hand-rolled: Supabase keys, Cloudflare Universal SSL, Resend DKIM; constant-time cron compare is Phase 2 |
| V14 Configuration | yes | Public repo: no secrets in files; secrets via `wrangler secret put` / `read -rs`; separate `sb_secret_` per component; zone-scoped DNS token in Keychain |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Leaked legacy `service_role`/`anon` still valid | Elevation / Info disclosure | Create new keys, move consumers, deactivate legacy (reversible), prove 401 from outside |
| Secret key sent from a browser/UA | Info disclosure | Supabase 401s browser UAs; keep `sb_secret_` server-only, never `NEXT_PUBLIC_` |
| Bot floods auth forms | DoS / Spoofing | Supabase CAPTCHA on at close; interim risk documented |
| DNS hijack via over-scoped credential | Tampering | API token limited to Zone→DNS→Edit on `clickitstory.ae`; no global key; never the default (Vamos) wrangler login |
| Dangling record after Vercel deletion | Spoofing/takeover | Retarget the record before deleting the project |
| Destructive SQL in a live rewrite | Tampering | One atomic DO block, UPDATE-only, backup table, optimistic old-value guard, `pg_dump` first, Koss's word |
| Secret in a public repo / log | Info disclosure | In-memory extraction, no printing, synthetic test fixtures, pr-review before Ship |
| Email spoofing of the domain | Spoofing | SPF + DKIM + DMARC (`p=none` now, quarantine in Phase 5) |

## Sources

### Primary (HIGH confidence)
- Published package source `@opennextjs/cloudflare@1.20.12` (npm tarball read in scratch dir): `dist/cli/commands/deploy.js`, `populate-cache.js`, `utils/utils.js`, `utils/run-wrangler.js`, `utils/helpers.js`
- Published package source `@supabase/supabase-js@2.101.0`: `src/lib/fetch.ts`
- https://developers.cloudflare.com/workers/wrangler/environments/ and /configuration/ (name suffix, inheritable keys, `workers_dev`, `keep_vars`, `zone_id`)
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ (UTC, 15 min propagation, empty array removes, per-env triggers)
- https://developers.cloudflare.com/workers/platform/limits/ (100k/day, 1027, fail mode per route, 5 crons Free, 10 ms CPU, 50 subrequests)
- https://developers.cloudflare.com/workers/configuration/routing/routes/ (proxied record requirement, matching, precedence)
- https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/ (query)
- https://supabase.com/docs/guides/api/api-keys and /getting-started/migrating-to-new-api-keys.md and /troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd.md
- https://supabase.com/docs/guides/auth/auth-captcha; raw `supabase/auth` `internal/api/api.go` and `middleware.go` (verifyCaptcha routes and skips)
- https://resend.com/docs/api-reference/domains/create-domain, /dashboard/domains/regions, /custom-return-path, /dmarc
- Live probes 2026-10-20 14:30-15:10 UTC: `dig` (jen, brett, four `.ae` servers), `openssl s_client` (www/apex/media, SNI over Cloudflare IPs), `curl` (www via `--resolve`, apex, Supabase REST/auth settings)
- Local stack `supabase_db_Clickit` (PG 17.11): SQL prototypes in rolled-back transactions
- Repo files: Phase 2 branch `origin/claude/phase-02-execute-19d86a` (wrangler.jsonc, custom-worker.ts, scheduled.ts, cron-schedule.ts, scripts/cf/*, verify-media-host.mjs, runbook, 02-08 summary), main (migration-guard.mjs, pr-gate.yml, apply-live-migrations.yml, supabase clients, resend.ts, supabase-media.ts, cron routes)

### Secondary (MEDIUM confidence)
- https://github.com/orgs/supabase/discussions/29260 (timeline, header compatibility, Realtime 24 h)
- Cloudflare Error 1014 doc via search (cross-account CNAME rule)
- OpenNext CLI page (passthrough statement; no deploy+env example)

### Tertiary (LOW confidence)
- Community reports on the exact "legacy API keys are disabled" message; third-party posts on the end-of-2026 date
- Route fail-open control and wrangler OAuth scope list (not found in official pages read)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is already pinned; no new package.
- Architecture (env.production, route flip, cron): HIGH for OpenNext/wrangler shape and DNS behaviour (source + probes); MEDIUM for secrets-per-env and route-on-grey-record.
- Supabase keys/CAPTCHA: MEDIUM — docs confirm reversibility and header rules; exact post-disable response and session survival are unproven until the close step.
- Resend: MEDIUM — record names verified from the API example; eu-west-1 values rely on the dashboard.
- SQL: HIGH — tested on PostgreSQL 17.11 locally; live role privileges unverified.
- Pitfalls: HIGH on tool-choice and time-box findings, MEDIUM on Vercel-side behaviour (no access).

**Research date:** 2026-10-20
**Valid until:** 2026-11-03 for provider behaviour (Supabase key deprecation and Cloudflare pages move fast); the Vercel certificate date and DNS snapshot must be re-read at flip time.
