# Phase 3 runbook: production cutover (www and media to Cloudflare, Vercel off)

**Status:** decisions D-01..D-19 SIGNED by Koss (Q1-Q18 = A, 2026-10-20 ~17:55 CET); plan gate G1-G7 signed 2026-10-20 ~18:15 CET; amendments G8-G10 signed 2026-10-21 15:03 CET and G11 2026-10-21 ~15:10 CET (03-PLAN-GATE.md, 03-CONTEXT.md A-1..A-6). Written by plan 03-06 on 2026-10-21 from the scripts as they are on the phase branch (03-01..03-05). Nothing in this file has been run yet.
**Who runs what:** **[KOSS]** steps are typed or clicked by Koss in his own terminal, dashboard or Hermes. **[CONTROL]** steps are run by the control session "Clickit controller" in the main checkout `/Users/koss/Developer/Clickit` on `main`, after the Phase 3 PR is squash-merged by Koss's Ship. Ops plans 03-07..03-13 run these steps in order: 03-07 = Steps 0a-12, 03-08 = 13-17, 03-09 = 18-24, 03-10 = 25-35, 03-11 = 36-39 and 36a, 03-12 = 40-52 and 52a, 03-13 = 53-56.
**Gates:** G-DNS (Steps 6, 31, 54 and every other dns-check call), G-REWRITE (Steps 47-51), G-ROLLBACK (top of Part G; precondition on every step from 40 to 55). Branch-B fallbacks, inventories, ceilings and deviations: `03-GATES.md`.

## Rules for every step

1. One step at a time. Do the step, compare with **Expected**, record the result, **then wait**. The next step starts only when the controller confirms (and, for a [CONTROL] step that changes anything, after Koss writes its **Trigger** word in chat or the question form).
2. Every wrangler command in this file is written in full as `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 ...`, and the same step runs the whoami check first: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` must show exactly one account, ClickitStory `e329b099b6e4272fc0915a99832e47fe`, and `echo ${CLOUDFLARE_API_TOKEN:-unset}` must print `unset`. Anything else: stop. In prose this file says "the HOME-pinned CLI". The npm scripts `cf:build:production`, `cf:deploy:production` and `cf:deploy:media` pin the same HOME and run their own account check.
3. Never the Cloudflare MCP connector (it is the Vamos account). Cloudflare dashboard steps are Koss's; Cloudflare API calls exist only inside `scripts/cutover/rollback.mjs` (Keychain token, www `proxied` toggle only).
4. Secrets (keys, tokens, passwords) go only into a prompt: the HOME-pinned CLI's `secret put` prompt, `read -rs`, `security add-generic-password -w`, or a dashboard field. Never into chat, a file in a repo, a command-line argument or a log. Logs hold names, counts, statuses and verdicts only. The repo is public.
5. Heavy local steps (builds, `r2:media`) run under `/Users/koss/.clickit-heavy.lock` through `scripts/cutover/with-heavy-lock.sh <log> -- <command...>`; the log sits under `/Users/koss/.clickit-checks/` and ends with `exit=<status>`. The controller runs its heavy steps detached (`perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m scripts/cutover/with-heavy-lock.sh ...`) and polls the log for the `exit=` line.
6. DNS gates are full `node scripts/cutover/dns-check.mjs` commands. From Step 6 on, every dns-check call except the `--phase ns` reads passes `--with-resend --resend-mx <host from Step 4> --dkim-file /Users/koss/.clickit-checks/p3-dkim.txt` (no hidden state). Any FAIL prints `do not change NS / do not press Verify / do not flip`: obey it.
7. Proof scripts and their probe path: the locale root answers 308 to `/en/portfolio` (on the frozen site and on the Worker), so every `proof-check.mjs` call passes `--site-path /en/portfolio` (a path that answers 200; if the site is ever in coming-soon mode use `/en/coming-soon`). `keys-check.mjs` follows same-origin redirects itself.
8. Record every result with the clock time (`date -u` and `TZ=Asia/Dubai date`) in the plan's ops log named in the step. **Ops log rule:** while a plan runs, its log lives OUTSIDE the repo at `/Users/koss/.clickit-checks/p3-ops/03-<NAME>-LOG.md` (`03-DNS-MAIL-LOG`, `03-MEDIA-LOG`, `03-KEYS-LOG`, `03-FLIP-LOG`, `03-PROOF-WINDOW`, `03-CLOSE-LOG`, `03-FINAL-PROOF`; `mkdir -p /Users/koss/.clickit-checks/p3-ops` first), because the deploy guards refuse any dirty or untracked file in the main checkout and the production deploy needs the build stamp sha to equal HEAD. Only after the plan's last deploy step does the controller copy the log into `.planning/phases/03-production-cutover/` and commit it alone as a planning note (no code, no deploy); never between Steps 25 and 26. The guards are not loosened. (`/Users/koss/.clickit-checks/p3-exec/` holds the work session's local test logs, e.g. the 03-05 SQL proof `p3-sql-test-r2.log`; it is not an ops log.)
9. Live database: reads only with `supabase db query --linked --project-ref lajguozmtissnnfccmej -f <file>` (SELECT-only by discipline; the CLI prints "Initialising login role..."). DDL only through `apply-live-migrations.yml` after Koss approves in the Actions UI (an agent never approves). The one data write (Step 50) and its reverse (Step 52) need Koss's words. Never wipe, never hard-delete rows.
10. Free tier only. Any screen asking for a payment method or a paid plan: stop and bring it to Koss as a priced question.

Placeholders: `<host from Step 4>` = the Resend MX host shown in the Resend dashboard (public); `<copy report>` = `.tmp/r2-media-reports/copy-<timestamp>.json` from Step 15; `<Step 17 report>` = `.tmp/r2-media-reports/verify-<timestamp>.json` from Step 17. Both report paths are relative to the main checkout, where every [CONTROL] command runs.

---

## Part 0: Pre-cutover gates (added 2026-10-21 from 02-RUNBOOK Part B)

No live Phase 3 step, Step 1 included, runs before Steps 0a, 0b and 0c are PASS and recorded. Log: `/Users/koss/.clickit-checks/p3-ops/03-DNS-MAIL-LOG.md`.

**Step 0a [CONTROL] - P3-pre-cpu: CPU re-measurement after the /en caching rebuild (A-1)**
Precondition: the /en CPU caching rebuild (Phase 2.1, session "Clickit /en CPU") is on `main` and deployed to workers.dev.
Command or Where: re-run the full 02-21 measurement exactly as `02-CPU-REPORT.md` describes it: the signed-out pass over every public route, then the signed-in viewer and admin pass (the sign-ins as 02-RUNBOOK Step 34, on Koss's word "approve measurement sign-ins"), plus the media Worker rows if `02-CPU-REPORT.md` lists them. Record the new report path and its table.
Expected: on Workers Free, every signed-out public route has p95 CPU of warm requests under 10 ms and no `exceededCpu` (Koss's gate). A signed-in or media row over 10 ms, or an unmeasured row, goes to Koss before Step 1 (Workers Paid price question, or his written acceptance of the gap); it is not decided here. If Koss approved Workers Paid instead: record the plan read from the dashboard and that no row shows `exceededCpu`. Log one of: `P3-pre-cpu: PASS (Workers Free)`, `P3-pre-cpu: PASS (Koss accepted: <rows>, <time>)`, `P3-pre-cpu: PASS (Workers Paid)`.
Rollback: none (read-only). A FAIL stops the phase and goes to Koss.
Then wait.

**Step 0b [CONTROL + KOSS] - P3-pre-migration: the two Phase 2/6 migrations are live (A-2)**
Command or Where: migrations `20261020150526_youtube_episode_status_and_order` and `20261021120000_legal_pages_arabic_review` are applied only through `apply-live-migrations.yml` after Koss approved the dry run (01-CONTROLLER-RUNBOOK Steps 7-9). Then the controller writes this read to `/Users/koss/.clickit-checks/p3-ops/p3-pre-migration.sql` and runs `supabase db query --linked --project-ref lajguozmtissnnfccmej -f /Users/koss/.clickit-checks/p3-ops/p3-pre-migration.sql`:
```sql
select version from supabase_migrations.schema_migrations
 where version in ('20261020150526', '20261021120000') order by 1;
select table_name, column_name from information_schema.columns
 where table_schema = 'public' and (
   (table_name = 'episodes' and column_name in ('youtube_status', 'youtube_checked_at',
     'youtube_duration_seconds', 'player_error_code', 'player_error_at', 'title_edited',
     'title_ar_edited', 'description_edited', 'description_ar_edited', 'youtube_text_baseline_at'))
   or (table_name = 'shorts' and column_name in ('title_edited', 'channel_name_edited', 'youtube_checked_at'))
   or (table_name = 'legal_pages' and column_name in ('ar_reviewed', 'title_ar_draft', 'content_ar_draft')))
 order by 1, 2;
select to_regclass('public.episodes_youtube_video_id_key') is not null as video_id_index;
select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('renumber_season', 'record_youtube_checks',
   'record_short_checks', 'get_youtube_key', 'set_youtube_key', 'youtube_key_meta') order by 1;
select
  has_column_privilege('anon', 'public.legal_pages', 'title_ar_draft', 'SELECT') as anon_title_draft,
  has_column_privilege('anon', 'public.legal_pages', 'content_ar_draft', 'SELECT') as anon_content_draft,
  has_column_privilege('authenticated', 'public.legal_pages', 'title_ar_draft', 'SELECT') as auth_title_draft,
  has_column_privilege('authenticated', 'public.legal_pages', 'content_ar_draft', 'SELECT') as auth_content_draft,
  has_column_privilege('anon', 'public.legal_pages', 'ar_reviewed', 'SELECT') as anon_ar_reviewed,
  has_function_privilege('anon', 'public.get_youtube_key()', 'EXECUTE') as anon_get_key,
  has_function_privilege('anon', 'public.set_youtube_key(text)', 'EXECUTE') as anon_set_key,
  has_function_privilege('anon', 'public.record_youtube_checks(jsonb)', 'EXECUTE') as anon_record_checks;
select has_key, updated_at from public.youtube_key_meta();
```
Expected: both versions; 16 column rows (episodes 10, shorts 3, legal_pages 3); `video_id_index` true; the six functions `public.renumber_season`, `public.record_youtube_checks`, `public.record_short_checks`, `public.get_youtube_key`, `public.set_youtube_key`, `public.youtube_key_meta`; the four draft-column privileges false, `anon_ar_reviewed` true (the legal-page 404 risk is gone), the three function privileges false. `youtube_key_meta()` returns `has_key` and `updated_at` only (never last4, never the key); if the CLI role is refused on it, Koss reads the admin Settings key field instead (saved or not). `has_key` false means youtube-recheck answers 503 `key_missing` every night: the controller tells Koss to save the YouTube key in the admin Settings before Step 26, or to accept the nightly 503. Log `P3-pre-migration: PASS` (plus `youtube key: saved|missing`).
Rollback: none (read-only). Step 25 re-reads the versions the same day before the production build.
Then wait.

**Step 0c [CONTROL] - P3-pre-phase2: Phase 2 UAT passed and media verify shows 0 failures (G11)**
Command or Where: `git fetch origin && git show origin/main:.planning/phases/02-worker-and-r2-media-on-workers-dev/02-UAT.md` (or the record PR #30's finish names) shows Koss's pass for both Phase 2 UAT parts; the media verify report named there shows `failures` empty (0 failures).
Expected: both found. Log `P3-pre-phase2: PASS <UAT record path> <verify report path>`.
Rollback: none (read-only). A FAIL stops the phase and goes to Koss.
Then wait.

---

## Part A: Entry and DNS-01

Log: `/Users/koss/.clickit-checks/p3-ops/03-DNS-MAIL-LOG.md`.

**Step 1 [CONTROL] - entry read**
Precondition: Steps 0a, 0b and 0c PASS recorded.
Command:
1. Re-read the controller line in `/Users/koss/Developer/Clickit/CLAUDE.local.md` (another session named: you are retired, stop).
2. `git -C /Users/koss/Developer/Clickit fetch origin && git -C /Users/koss/Developer/Clickit log -3 --oneline origin/main` shows the Phase 3 squash commit; `git status --short` is empty.
3. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` and `echo ${CLOUDFLARE_API_TOKEN:-unset}`.
4. `node scripts/cutover/dns-check.mjs --phase ns`
5. `node scripts/cutover/proof-check.mjs --expect vercel --vercel-ip 216.198.79.1 --site-path /en/portfolio`
6. `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png | grep -iE '^(HTTP|x-media-source|server)'`
Expected: Phase 3 squash on origin/main; one ClickitStory account, `unset`; `dns-check ns: ALL PASS`; `proof-check vercel: ALL PASS` with the `rollback:` line giving the Vercel certificate notAfter (record it; read 2026-10-21: Dec 29 02:45:11 2026 GMT); media answers 200 from cloudflare, with no `x-media-source` header (Worker on `--env supabase-only`) or `x-media-source: r2` (already R2-first; then Step 16 is skipped with a note).
Rollback: none (read-only).
Then wait.

**Step 2 [CONTROL] - DNS-01 proof**
Command: `node scripts/cutover/dns-check.mjs --phase ns`
Expected: `PASS ns clickitstory.ae NS @<server>` for all four `.ae` registry servers (read at run time from `dig NS ae. +short`: ns1.aedns.ae, ns2.aedns.ae, nsext-pch.aedns.ae, ns4.apnic.net on 2026-10-21), each listing exactly brett + jen; `PASS ns clickitstory.ae DS @<server>` on all four (no DS, negative answer with an SOA); last line `dns-check ns: ALL PASS`. jen/brett SOA equality is checked by every later phase. Log the full output with the time.
Rollback: none (read-only). A FAIL: stop, nothing else in this runbook runs.
Then wait.

---

## Part B: Mail (D-14, D-15, MAIL-02)

Log: `/Users/koss/.clickit-checks/p3-ops/03-DNS-MAIL-LOG.md`. Rollback for the whole part: Koss deletes the four records he added (no mail depends on them yet) and removes the domain in Resend.

**Step 3 [KOSS] - name the Resend account and the DMARC report address**
Where: chat, words only.
Expected: the Resend account (login email or team name) that owns the current `RESEND_API_KEY` (the Worker secret), and the mailbox for DMARC reports (`rua`). Never the key.
Rollback: none.
Then wait.

**Step 4 [KOSS] - add the domain in Resend**
Where: resend.com, that account, Domains, Add domain: `clickitstory.ae`, region **Ireland (eu-west-1)**. The region cannot be changed later (changing it means deleting and re-adding the domain).
Expected: Resend shows the record table: MX `send` (priority and host, e.g. `feedback-smtp.eu-west-1.amazonses.com`, as Resend shows it), TXT `send` (SPF `v=spf1 include:amazonses.com ~all`), TXT `resend._domainkey` (DKIM `p=...`). Names and values are public; report the MX host and priority in chat (= `<host from Step 4>`) and save the DKIM value, exactly as shown, to `/Users/koss/.clickit-checks/p3-dkim.txt` (one line, no quotes). If Resend also lists a tracking CNAME, report it; it is not added in this phase.
Rollback: delete the domain in Resend.
Then wait.

**Step 5 [KOSS] - add the four records in Cloudflare DNS**
Where: dash.cloudflare.com, ClickitStory account, zone clickitstory.ae, DNS, Records, Add record (all **DNS only**, grey):
1. MX, name `send`, mail server = `<host from Step 4>`, priority as Resend shows.
2. TXT, name `send`, content = the SPF value from Resend.
3. TXT, name `resend._domainkey`, content = the DKIM value, pasted without quotes.
4. TXT, name `_dmarc`, content `v=DMARC1; p=none; rua=mailto:<address from Step 3>`.
Expected: four new records, proxy status DNS only; nothing else in the zone changed. Report "records added" with the time.
Rollback: delete these four records.
Then wait.

**Step 6 [CONTROL] - G-DNS before Verify**
Command: `node scripts/cutover/dns-check.mjs --phase resend --resend-mx <host from Step 4> --dkim-file /Users/koss/.clickit-checks/p3-dkim.txt`
Expected: every line PASS on jen and brett (registry NS and DS rules, jen/brett SOA equal, apex A and AAAA proxied, www still the exact Vercel CNAME, media proxied, MX `send`, SPF, DKIM exact against the file, DMARC prefix), last line `dns-check resend: ALL PASS`. Any FAIL: write "do not press Verify" and stop.
Rollback: none (read-only).
Then wait.

**Step 7 [KOSS] - press Verify in Resend**
Where: Resend, Domains, clickitstory.ae, Verify.
Expected: status Verified (it may sit at pending for some minutes; refresh). Report the status and time. Steps 25-26 (production build and deploy, `RESEND_FROM_EMAIL = no-reply@clickitstory.ae`) never run before this shows Verified.
Rollback: none needed (Verify changes nothing in DNS).
Then wait.

**Step 8 [KOSS] - one test send from his terminal**
Command (his terminal, one line at a time):
1. `read -rs RESEND_API_KEY` (paste the key at the silent prompt)
2. `curl -sS https://api.resend.com/emails -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' -d '{"from":"Clickit Story <no-reply@clickitstory.ae>","to":["<his own Gmail address>"],"subject":"Clickit MAIL-02 test","text":"MAIL-02 test send"}'`
3. `unset RESEND_API_KEY`
Expected: a JSON answer with an `id`; the mail arrives in his Gmail.
Rollback: none.
Then wait.

**Step 9 [KOSS + CONTROL] - MAIL-02 judge**
Where (Koss): Gmail, the test mail, More, Show original; copy the `Authentication-Results:` header block (no secret in it) and save it to `/Users/koss/.clickit-checks/p3-auth-results.txt`.
Command (controller): `node scripts/cutover/parse-auth-results.mjs < /Users/koss/.clickit-checks/p3-auth-results.txt`
Expected: `SPF: PASS`, `DKIM: PASS (d=clickitstory.ae)`, `DMARC: PASS`, `MAIL-02: PASS`, exit 0. Log `MAIL-02: PASS` with the time.
Rollback: none (read-only). A FAIL: bring the three lines to Koss; DNS records are corrected by Koss and Steps 6-9 repeat.
Then wait.

---

## Part C: Backup table (D-11, schema through the workflow)

Log: `/Users/koss/.clickit-checks/p3-ops/03-DNS-MAIL-LOG.md`.

**Step 10 [CONTROL] - local dumps, then the dry-run dispatch**
Trigger: Koss writes "dry-run backup table".
Command (01-CONTROLLER-RUNBOOK Step 7, then Step 8):
```bash
mkdir -p /Users/koss/.clickit-backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
supabase db dump --linked -f /Users/koss/.clickit-backups/live-$TS-schema.sql
supabase db dump --linked --data-only -f /Users/koss/.clickit-backups/live-$TS-data.sql
test -s /Users/koss/.clickit-backups/live-$TS-schema.sql && test -s /Users/koss/.clickit-backups/live-$TS-data.sql && echo dumps-ok
gh workflow run apply-live-migrations.yml --repo Loomlyne/Clickit --ref main -f pg_dump_taken=true
gh run list --repo Loomlyne/Clickit --workflow apply-live-migrations.yml --limit 1
gh run view <id> --repo Loomlyne/Clickit
```
Expected: `dumps-ok`; the dry-run job summary lists exactly one pending migration, `20261021143410_media_url_rewrite_backup.sql`; the `apply` job waits for approval. Anything else pending (or an error about ordering): stop, bring it to Koss (never the include-all flag).
Rollback: none (nothing applied yet).
Then wait.

**Step 11 [KOSS] - approve the backup-table migration**
Where: GitHub, Loomlyne/Clickit, Actions, the run from Step 10: read the dry-run summary, then Review deployments, `live-db`, Approve. Only Koss approves; the controller never calls the approval API.
Expected: the `apply` job ends green; its log shows the one migration applied.
Rollback: the table is new and empty; it stays (no drop through any path). If it must go, that is a new reviewed migration on Koss's word.
Then wait.

**Step 12 [CONTROL] - read back the backup table**
Command: `supabase db query --linked --project-ref lajguozmtissnnfccmej -f scripts/cutover/sql/check-backup-table.sql`
Expected: `table_exists` true, `rls_on` true, `anon_can_select` false, `authenticated_can_select` false, `api_role_grants` 0; `backup_rows` 0, `open_rows` 0, `runs` 0. Log `backup table: OK` (with `media_url_rewrite_backup` and the run id of the workflow). Then copy this plan's log into `.planning/phases/03-production-cutover/03-DNS-MAIL-LOG.md` and commit it alone as a planning note (ops log rule).
Rollback: none (read-only).
Then wait.

---

## Part D: Media R2-first (D-08, Pitfalls 1-3)

Log: `/Users/koss/.clickit-checks/p3-ops/03-MEDIA-LOG.md`.

D-08 ordering note: the verify runs right after the R2-first deploy (Step 17 after Step 16), because only an R2-serving Worker can serve the image variants and the remuxed fast-start videos that the verify checks; the Supabase fallback keeps every image working in between, and going back is one deploy (`npm run cf:deploy:media -- --env supabase-only`).

**Step 13 [KOSS] - media freeze, then credentials in one terminal**
Where and Command:
1. Koss himself tells the two admins (Issam, Nejib): no image or video changes in the admin until he lifts it (lifted at Step 39, or after the first Monday 04:00 UTC inside the proof window; Pitfalls 3-4). Report the time he told them.
2. One terminal window that stays open for Steps 14-15, in `/Users/koss/Developer/Clickit`, exactly as 02-RUNBOOK Step 25: `read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY` (the service key that works today), `read -rs R2_ACCESS_KEY_ID && export R2_ACCESS_KEY_ID`, `read -rs R2_SECRET_ACCESS_KEY && export R2_SECRET_ACCESS_KEY`, then `export NEXT_PUBLIC_SUPABASE_URL=https://lajguozmtissnnfccmej.supabase.co CLOUDFLARE_ACCOUNT_ID=e329b099b6e4272fc0915a99832e47fe CLOUDFLARE_R2_BUCKET=clickit-media`.
3. Check: `for v in SUPABASE_SERVICE_ROLE_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY NEXT_PUBLIC_SUPABASE_URL CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_R2_BUCKET; do [ -n "${(P)v}" ] && echo "$v set" || echo "$v MISSING"; done`
Expected: the freeze time reported; six "set" lines, no value printed.
Rollback: none (nothing written).
Then wait.

**Step 14 [KOSS] - re-sync dry run (no writes)**
Command (same terminal): `scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-r2media-refresh.log -- npm run r2:media -- --refresh`
Expected: the log `/Users/koss/.clickit-checks/p3-r2media-refresh.log` ends with `exit=0` and holds "Wrote N objects to .tmp/r2-media-manifest.json" and "Dry-run report: .tmp/r2-media-reports/dry-run-<timestamp>.md". The wrapper waits (log line `waiting=`) while another build or local stack holds the lock. Never use r2:copy (and never `--update-changed`): it would overwrite the remuxed fast-start videos with raw originals and makes no variants. The controller then reviews the .md report (new objects since Phase 2, changed fixed keys such as avatars, `settings/og.png` and the hero video, skipped types with reasons; source buckets only show-artwork, site-assets, avatars) and writes "dry-run reviewed, run step 15". Log `dry-run reviewed: ok` with the report path.
Rollback: none (reads Supabase Storage, writes only `.tmp/`).
Then wait.

**Step 15 [KOSS] - execute the copy, then once more**
Trigger: the controller wrote "dry-run reviewed, run step 15".
Command (same terminal):
1. `scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-r2media-execute.log -- npm run r2:media -- --execute`
2. `scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-r2media-execute2.log -- npm run r2:media -- --execute`
Then close the terminal (or `unset SUPABASE_SERVICE_ROLE_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY`).
Expected: both logs end with `exit=0`. The first shows `copied` / `remuxed` / `skipped (identical)` lines, "Verified N originals, V variants" and "Checksum report: .tmp/r2-media-reports/copy-<timestamp>.json and .md", zero failures; the second shows only `skipped (identical)`. Send the controller the copy report path (= `<copy report>`). Log `second run: identical` and the `copy-<timestamp>.json` path.
Rollback: none needed (adds and replaces R2 copies only; deletes nothing; Supabase untouched).
Then wait.

**Step 16 [CONTROL] - media Worker R2-first**
Trigger: Koss writes "media r2 first". Skip with a note if Step 1 already showed `x-media-source: r2`.
Command:
1. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` and `echo ${CLOUDFLARE_API_TOKEN:-unset}`; `git status --short` empty.
2. `npm run cf:deploy:media -- --env r2 --dry-run`
3. `npm run cf:deploy:media -- --env r2`
4. `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png | grep -iE '^(HTTP|x-media-source)'`
Expected: `deploy-guard ok (dry run)`, then `deploy-guard ok` and the deploy output (route `media.clickitstory.ae` custom domain, R2 binding `MEDIA_BUCKET`); the curl shows 200 and `x-media-source: r2`. Log the deploy time and `x-media-source: r2`.
Rollback: `npm run cf:deploy:media -- --env supabase-only` (whoami first, same step).
Then wait.

**Step 17 [CONTROL] - verify every object on media.clickitstory.ae**
Command:
1. `node scripts/media/verify-media-host.mjs --origin https://media.clickitstory.ae --report <copy report>`
2. `npm run media:health -- --expect-source r2`
Expected: `verify ok: N originals, V variants, 0 failures` and a new `.tmp/r2-media-reports/verify-<timestamp>.json` (= `<Step 17 report>`, the file Steps 25-26 hash and check; it stays in the main checkout's gitignored `.tmp/`); media:health ends `N/N media URLs ok via ...` with every line `ok  200 r2 ...` (no `x-media-source ... expected r2`). Log `verify ok: ... 0 failures`, the `verify-<timestamp>.json` path and `x-media-source: r2`. Then copy this plan's log into `.planning/phases/03-production-cutover/03-MEDIA-LOG.md` and commit it alone as a planning note.
Rollback: any failure: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami`, then `npm run cf:deploy:media -- --env supabase-only`, and stop.
Then wait.

---

## Part E: Keys and prerequisites (D-02, D-16)

Log: `/Users/koss/.clickit-checks/p3-ops/03-KEYS-LOG.md`. Names, counts and verdicts only.

**Step 18 [KOSS] - new Supabase API keys**
Where: supabase.com, project lajguozmtissnnfccmej, Settings, API Keys, tab "Publishable and secret API keys": create (or confirm) the publishable key, and create a secret key named `clickit-worker`. Do not touch the "Legacy API keys" tab (legacy keys stay active until Step 41).
Expected: one publishable key and the secret key `clickit-worker` listed. Report "created" (names only).
Rollback: delete the `clickit-worker` secret key in the dashboard (nothing uses it yet).
Then wait.

**Step 19 [KOSS + CONTROL] - the secret key on the Worker**
Command (Koss, his terminal):
1. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` (one ClickitStory account) and `echo ${CLOUDFLARE_API_TOKEN:-unset}` (unset).
2. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put SUPABASE_SERVICE_ROLE_KEY --name clickit` and paste the `sb_secret_…` value of `clickit-worker` at the prompt.
Command (controller): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami`, then `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret list --name clickit`.
Expected: "Success! Uploaded secret SUPABASE_SERVICE_ROLE_KEY"; the list shows names only (CRON_SECRET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, and any other name already there). Log `secret list: <names, sorted>`. The workers.dev site keeps working (the new key works while legacy keys are active); Step 29 proves it on the admin audit page.
Rollback: Koss puts the legacy service_role value back with the same `secret put` command (whoami first).
Then wait.

**Step 20 [KOSS] - Web Analytics site for www**
Where: dash.cloudflare.com, ClickitStory account, Analytics & Logs, Web Analytics, Add a site: `www.clickitstory.ae`.
Expected: the site is listed; its beacon token (public) is shown in the JS snippet; keep it for Step 21.
Rollback: remove the site.
Then wait.

**Step 21 [KOSS] - the production build env file (outside the repo)**
Command (his terminal):
1. `umask 077`
2. `read -rs PUB` (the publishable key), `read -rs TSK` (the Turnstile site key of the same widget as workers.dev), `read -rs BEACON` (Step 20 token)
3. `printf 'NEXT_PUBLIC_SUPABASE_URL=https://lajguozmtissnnfccmej.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nNEXT_PUBLIC_SITE_URL=https://www.clickitstory.ae\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=%s\nNEXT_PUBLIC_CF_BEACON_TOKEN=%s\n' "$PUB" "$TSK" "$BEACON" > /Users/koss/.clickit-cloudflare/clickit.production.env && unset PUB TSK BEACON`
4. Checks (counts only): `grep -cE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_TURNSTILE_SITE_KEY|NEXT_PUBLIC_CF_BEACON_TOKEN)=' /Users/koss/.clickit-cloudflare/clickit.production.env` and `grep -c '^NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_' /Users/koss/.clickit-cloudflare/clickit.production.env` and `stat -f %Lp /Users/koss/.clickit-cloudflare/clickit.production.env`
Expected: `5`, `1`, `600`. Log `env file counts: 5 1`. (The production build refuses a legacy JWT, any `sb_secret_` value in a NEXT_PUBLIC name, the Turnstile test key and an empty beacon token.)
Rollback: `rm /Users/koss/.clickit-cloudflare/clickit.production.env` (outside every repo).
Then wait.

**Step 22 [KOSS + CONTROL] - Turnstile hostnames and R2 CORS read-back**
Where (Koss): dash.cloudflare.com, Turnstile, the Clickit widget, Hostnames: `www.clickitstory.ae` and `clickitstory.ae` present (add them if missing).
Command (controller): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami`, then `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 r2 bucket cors list clickit-media`.
Expected: both hostnames on the widget; the CORS list has origin `https://www.clickitstory.ae`. Log `turnstile hostnames: ok` and `cors: www present`.
Rollback: none (read-only, or a hostname added).
Then wait.

**Step 23 [KOSS + CONTROL] - the rollback credential (D-16)**
Where (Koss): dash.cloudflare.com, **My Profile, API Tokens** (a user token: `rollback.mjs --verify-token` calls `/user/tokens/verify`, which does not accept an account-owned token from Manage Account, API Tokens), Create Token, Custom: name `clickit-dns-edit`, permission Zone, DNS, Edit; Zone resources: Include, Specific zone, `clickitstory.ae` only; no IP filter or TTL unless he wants one. Then in his terminal: `security add-generic-password -a clickit -s clickit-cf-dns-edit -w` and paste the token at the prompt.
Command (controller): `node scripts/cutover/rollback.mjs --verify-token`, then `node scripts/cutover/rollback.mjs --show`.
Expected: "token active"; `--show` prints the www record: CNAME, target class vercel, proxied false (no id, no token). Log `token active`. Branch B (D-16, no token): Koss toggles the record himself at Step 37; log `D-16 branch B`.
Rollback: Koss deletes the token in My Profile, API Tokens and `security delete-generic-password -s clickit-cf-dns-edit`.
Then wait.

**Step 24 [KOSS] - zone and Supabase settings read**
Where: dash.cloudflare.com, zone clickitstory.ae: Speed, Optimization, Rocket Loader off; Scrape Shield, Email Address Obfuscation off (turn off if on); SSL/TLS, Edge Certificates lists `*.clickitstory.ae` (and the apex) active. supabase.com, Authentication, URL Configuration: Site URL `https://www.clickitstory.ae`.
Expected: report each value. Log `Rocket Loader: off`, `Email Address Obfuscation: off`, `edge certificate *.clickitstory.ae: active`, `Supabase Site URL: https://www.clickitstory.ae`. Then copy this plan's log into `.planning/phases/03-production-cutover/03-KEYS-LOG.md` and commit it alone as a planning note, and push the planning notes of 03-07..03-09 before Step 25 (the production guard needs HEAD in origin/main).
Rollback: turn a setting back on only on Koss's word.
Then wait.

---

## Part F: The flip (D-01, D-05, D-06, D-07, D-12, D-17, D-18), all on flip day

Log: `/Users/koss/.clickit-checks/p3-ops/03-FLIP-LOG.md`. Flip day is Tuesday-Thursday, flip at 10:00 Asia/Dubai, Koss available for two hours after. No planning-note commit between Steps 25 and 26.

**Step 25 [CONTROL] - the one production build and its account-checked dry run**
Trigger: Koss writes "build production".
Precondition: Step 0a PASS recorded; Step 7 shows Verified; `git -C /Users/koss/Developer/Clickit rev-parse HEAD` equals `rev-parse origin/main`; `git status --short` empty.
Command:
1. Step 0b versions re-read today: `supabase db query --linked --project-ref lajguozmtissnnfccmej "select version from supabase_migrations.schema_migrations where version in ('20261020150526','20261021120000','20261021143410') order by 1"` (three rows).
2. Resend secret check (controller request from Phase 5 05-08, 2026-10-21: the email queue retries about 15 minutes, then marks mails failed if the key is missing): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami`, then `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret list --name clickit` (names only) lists RESEND_API_KEY. Log `resend secret: present`. If it is missing, stop: Koss's numbered step in his terminal is `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put RESEND_API_KEY --name clickit` (whoami first; value from the Resend account named at Step 3), then the controller re-lists.
3. The build, detached, under the lock: `perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-build-production.log -- npm run cf:build:production -- --verify-report <Step 17 report> &` (the npm script already passes `--media-flag verified`); poll `tail -1 /Users/koss/.clickit-checks/p3-build-production.log` every 30-60 s until `exit=`.
4. `node -e 'const s=require("./.open-next/clickit-build-stamp.json");console.log(s.target,s.gitSha,s.supabaseKeyKind,s.mediaFlag)'` and `git rev-parse HEAD`.
5. `npm run cf:deploy:production -- --dry-run --verify-report <Step 17 report>` (the guard runs the account check itself). When Step 52a runs this step again, add `--allow-upload-sweep-delete` here.
Expected: three versions; `resend secret: present`; the build log ends `exit=0` and holds `build stamp written: target production, media flag verified`; the stamp says `production`, gitSha equal to `git rev-parse HEAD`, `publishable`, `verified`; the dry run prints `deploy-only: using build stamp <sha7> built <time>` and `deploy-guard ok (dry run)`. Any `deploy-guard REFUSED` line: stop and bring the reasons to Koss.
Rollback: none (nothing deployed).
Then wait.

**Step 26 [CONTROL] - deploy production (route inert while www is grey)**
Trigger: Koss writes "deploy production".
Command:
1. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` and `echo ${CLOUDFLARE_API_TOKEN:-unset}`.
2. `npm run cf:deploy:production -- --verify-report <Step 17 report>` (deploy-only of the Step 25 build; it never rebuilds).
3. `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret list --name clickit`.
Expected: `deploy-only: using build stamp <sha7> built <time>`, `deploy-guard ok`, `deployed production: route www.clickitstory.ae/*, crons 0 1 * * *, 30 1 * * *, 0 4 * * 1` and `D-18: /Users/koss/.clickit-cloudflare/clickit.last-deploy.json now says production; cf:deploy:workersdev is refused until Phase 3 closes`. The Worker crons are live from here (01:00 UTC publish-scheduled, 01:30 UTC youtube-recheck, Monday 04:00 UTC cleanup-media; cleanup-media never deletes Supabase originals on the Worker and the R2 upload sweep is a dry run). The secret list shows the same names as Step 19. Log all lines with the time.
Rollback: none needed for visitors (the route is inert while the www record is grey). To undo the deploy, on Koss's word: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deployments list --name clickit`, then `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 rollback <previous version id>` (whoami first, same step).
Then wait.

**Step 27 [KOSS] - Vercel crons off (D-01), after Step 26 and before Step 32**
Where: branch A (the owner account `clickitstory@gmail.com` can sign in once): vercel.com, project clickit, Settings, Cron Jobs, Disable Cron Jobs; report the confirmation text. Branch B (no access): the controller writes "no Vercel access: signed branch-B wording applies (03-GATES.md)".
Expected: branch A: confirmation text; log `Vercel crons disabled`. Branch B: log `no Vercel access: signed branch-B wording applies (03-GATES.md)` (the frozen Vercel cron may still run at 01:00 UTC; publish is idempotent and the Worker refreshes anyway, A-3).
Rollback: Enable Cron Jobs (only on Koss's word, e.g. after a rollback to Vercel).
Then wait.

**Step 28 [CONTROL] - pre-flip proofs (read-only)**
Command:
1. `node scripts/cutover/proof-check.mjs --expect worker --site https://clickit.clickitstory.workers.dev --site-path /en/portfolio` (the production build answers on workers.dev too: marker header `x-clickit-runtime: workers`).
2. `node scripts/cutover/proof-check.mjs --expect worker --resolve-ip 104.21.29.215 --site-path /en/portfolio` (www through a Cloudflare IP, no DNS change).
3. `node scripts/cf/check-gates.mjs --base https://clickit.clickitstory.workers.dev`
4. `node scripts/cutover/keys-check.mjs --expect legacy-on --legacy-ip 216.198.79.1 --worker-site https://clickit.clickitstory.workers.dev`
5. `node scripts/cutover/proof-check.mjs --expect vercel --vercel-ip 216.198.79.1 --site-path /en/portfolio` (public www still Vercel).
Expected: 1 `proof-check worker: ALL PASS`. 2 `proof-check worker: ALL PASS`; if it still shows `x-vercel-id` the route did not fire for a grey record (research A1): log "route not fired for a grey record (A1): the flip is the first real test" and continue only with Koss's word. 3 `ALL PASS` (log `check-gates workers.dev: ALL PASS`; see 03-GATES.md section 9 item 1: check-gates must accept the locale-root 308 before this step). 4 `PASS keys legacy-on: legacy 200, publishable 200` and `keys-check legacy-on: ALL PASS`. 5 `proof-check vercel: ALL PASS`.
Rollback: none (read-only).
Then wait.

**Step 29 [KOSS] - owner check on workers.dev**
Where: Hermes, https://clickit.clickitstory.workers.dev/en/auth: sign in as admin; open /en/admin and the audit page; it loads with rows (this proves the `sb_secret_` key; a 200 home page does not, because config reads fall back silently); sign out.
Expected: audit rows shown. Log `audit page: rows shown (secret key works)`.
Rollback: none (a sign-in row in live Auth is the accepted cost).
Then wait.

**Step 30 [KOSS] - route failure mode: fail open (D-17)**
Where: dash.cloudflare.com, zone clickitstory.ae, Workers Routes, route `www.clickitstory.ae/*`, Edit, request limit failure mode: Fail open (proceed), Save.
Expected: the route shows Fail open. Log `failure mode: fail open`. If the dashboard has no such setting, record what it shows and bring it to Koss before Step 32.
Rollback: set it back to Fail closed (Step 46 does that at the close).
Then wait.

**Step 31 [CONTROL] - G-DNS before the flip, time check, close-by date**
Command:
1. `node scripts/cutover/dns-check.mjs --phase pre-flip --with-resend --resend-mx <host from Step 4> --dkim-file /Users/koss/.clickit-checks/p3-dkim.txt`
2. `date -u` and `TZ=Asia/Dubai date`
3. `node scripts/cutover/proof-check.mjs --expect vercel --vercel-ip 216.198.79.1 --site-path /en/portfolio` (the `rollback:` line: Vercel certificate notAfter)
Expected: `dns-check pre-flip: ALL PASS`; it is Tuesday, Wednesday or Thursday, about 10:00 Asia/Dubai, and not within an hour of 01:00 UTC, 01:30 UTC or Monday 04:00 UTC; the certificate notAfter recorded, and the close-by date written as `close-by <date>` = min(2026-12-15, notAfter minus 14 days). Then one line at the start of a log line: `ready to flip` (all three hold) or `do not flip` (and why).
Rollback: none (read-only).
Then wait.

**Step 32 [KOSS] - the flip**
Trigger: Koss writes "flip www" (only after Step 31 wrote `ready to flip`).
Where: dash.cloudflare.com, zone clickitstory.ae, DNS, Records, `www` (CNAME to the Vercel target), Edit, Proxy status: Proxied (orange), Save. Report the clock time.
Expected: the record shows Proxied; nothing else changed. G-ROLLBACK starts now (Part G).
Rollback: Step 37 (the same record back to DNS only).
Then wait.

**Step 33 [CONTROL] - post-flip proofs, within 10 minutes**
Command:
1. `node scripts/cutover/dns-check.mjs --phase post-flip --with-resend --resend-mx <host from Step 4> --dkim-file /Users/koss/.clickit-checks/p3-dkim.txt`
2. `node scripts/cutover/proof-check.mjs --expect worker --site-path /en/portfolio`
3. `node scripts/cf/check-gates.mjs --base https://www.clickitstory.ae`
4. `npm run media:health -- --expect-source r2`
Expected: `dns-check post-flip: ALL PASS`; `proof-check worker: ALL PASS` (site 200 with `x-clickit-runtime: workers` and no `x-vercel-id`, cert, apex 301 to `https://www.clickitstory.ae/en`, http 301, media 404 from cloudflare); check-gates `ALL PASS`; media:health all ok via r2. Log each line with the time. Any FAIL lasting 10 minutes, or a D-04 trigger (www or apex down or 5xx for 10 minutes, sign-in broken, playback broken): Step 37 at once.
Rollback: Step 37.
Then wait.

**Step 34 [KOSS] - UAT on www (Hermes)**
Where and steps:
1. Open https://www.clickitstory.ae/en. Expected: the site loads (portfolio landing).
2. Sign in with a real viewer account through the Turnstile widget. Expected: signed in.
3. Open a show, play an episode for 60 seconds. Expected: it plays.
4. Reload the episode page. Expected: it resumes where it stopped.
5. Open https://clickitstory.ae/en. Expected: lands on https://www.clickitstory.ae/en.
6. Sign out; sign in as the admin; open /en/admin and the audit page. Expected: rows shown.
7. Send the contact form. Expected: the mail arrives from `no-reply@clickitstory.ae`.
Expected: all seven pass ("done" from Koss is a pass). Log `UAT www: pass` (or the failing item: a D-04 trigger means Step 37).
Rollback: Step 37 on a D-04 trigger.
Then wait.

**Step 35 [CONTROL] - first cron runs (after 01:00 and 01:30 UTC)**
Command: either Koss reads Workers & Pages, clickit, Logs in the dashboard, or the controller runs `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` and then, detached, `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 tail clickit --format json > /Users/koss/.clickit-checks/p3-ops/p3-cron-tail.jsonl` from 00:55 to 01:40 UTC, stopped by its own PID (never a pattern kill). Then `node scripts/cutover/proof-check.mjs --expect worker --site-path /en/portfolio`.
Expected: Worker log lines `cron: /api/cron/publish-scheduled status 200` and `cron: /api/cron/youtube-recheck status 200`; no `exceededCpu` on either cron invocation (Workers Free allows 10 ms CPU per cron invocation; Step 0a measured page requests, so this is the first cron CPU proof). Log `publish-scheduled status 200`, `youtube-recheck status 200` and `cron exceededCpu: none`. youtube-recheck answering 503 `key_missing` (Step 0b found no key) is logged as `youtube-recheck key_missing reported to Koss`, not a rollback trigger. An `exceededCpu` goes to Koss with the Workers Paid price question, not decided here. `proof-check worker: ALL PASS`. Then copy this plan's log into `.planning/phases/03-production-cutover/03-FLIP-LOG.md` and commit it alone as a planning note.
Rollback: none (read-only). A failing publish cron (not 200) is brought to Koss the same morning.
Then wait.
