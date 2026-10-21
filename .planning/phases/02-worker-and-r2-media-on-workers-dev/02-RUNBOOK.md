# Phase 2 runbook: owner steps (Worker and R2 media on workers.dev, then the Phase 3 path)

**Status:** reviewed 2026-10-20 by plan 02-02 (see Review log). Written at plan time 2026-10-20; plan 02-02 checked it against the decisions and plans; plans 02-10, 02-20, 02-21 and 02-22 run it.
**Who runs what:** steps marked **[KOSS]** are typed by Koss in his own terminal or dashboard. Steps marked **[CONTROL]** are run by the control session in `/Users/koss/Developer/Clickit`, only after Koss writes the word given in the step. Work sessions never deploy, never write live data, never see a secret.

## Rules for every step

1. One step at a time. Do the step, compare with **Expected**, report the result (or the word asked for), **then wait**. Do not run the next step until the controller confirms.
2. Every `wrangler` command starts with `HOME=/Users/koss/.clickit-cloudflare`. Never run wrangler without it (that would use the default Vamos login).
3. Before every wrangler step, run the **whoami check** (Step 3). If it shows any account other than ClickitStory `e329b099b6e4272fc0915a99832e47fe`, or two accounts, stop and report.
4. Secrets (keys, tokens, passwords) are typed or pasted only into the terminal prompt that wrangler or `read -rs` opens. Never into chat, never into a file in the repo, never into a command line argument.
5. Nothing in Part A touches DNS, www.clickitstory.ae or the Vercel project. Part A writes only to the ClickitStory Cloudflare account, plus four owner-gated exceptions in live Supabase, each with its own step and trigger word: the redirect allow-list setting (Step 23, dashboard, no SQL), the sign-in rows that measurement and UAT sign-ins create in Supabase Auth (Steps 31 and 34), and the one approved draft-show write with its exact row list (Step 32) and its owner-gated revert (Step 32b). Steps 25-27 only read Supabase Storage.
6. Free tier only. If any screen asks for a payment method or a paid plan, stop and report the screen; do not accept.

`<WORKTREE>` below is the main checkout `/Users/koss/Developer/Clickit` since #29 landed on main (6ebc802, 2026-10-21); before that it was the phase worktree. The `<SUB>` below is the account's workers.dev subdomain found in Step 4 (not a secret). The app Worker is `https://clickit.<SUB>.workers.dev`; the media Worker is `https://clickit-media.<SUB>.workers.dev`.

---

## Part A: Phase 2, now

### Account and login

**Step 1 [KOSS] - whoami before login**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler whoami`
Expected: "You are not authenticated" (first time) or a table with exactly one account, id `e329b099b6e4272fc0915a99832e47fe`. Anything else: stop.
Then wait.

**Step 2 [KOSS] - log in to the ClickitStory account**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler login`
Expected: a browser tab opens; sign in as the ClickitStory Cloudflare user (not the Vamos one) and click Allow. Terminal prints "Successfully logged in."
Then wait.

**Step 3 [KOSS] - whoami check (repeat before every wrangler step)**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler whoami`
Expected: exactly one account row, id `e329b099b6e4272fc0915a99832e47fe`. Also check `echo ${CLOUDFLARE_API_TOKEN:-unset}` prints `unset`.
Then wait.

**Step 4 [KOSS] - workers.dev subdomain**
Where: dash.cloudflare.com, ClickitStory account, Workers & Pages, Overview, right column "Subdomain".
Expected: a name ending in `.workers.dev`. If none is set, choose one (suggested: `clickitstory`), confirm; it is free. Report the subdomain (not a secret).
Then wait.

### R2 buckets and CORS

**Step 4b [KOSS] - enable R2 on the account (once)**
Why: the API answers code 10042 ("R2 not enabled") for the ClickitStory account today, so Step 5 fails until this is done.
Where: dash.cloudflare.com, ClickitStory account, R2 Object Storage, "Get started" / "Purchase R2 Plan" (Free tier: 10 GB storage, 1M Class A, 10M Class B operations per month).
Expected: the R2 Overview page with "Create bucket". If the screen asks for a payment method or a paid plan, stop and report it (rule 6): the controller asks Koss as a priced question before anything is entered.
Then wait.

**Step 5 [KOSS] - create the media bucket**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler r2 bucket create clickit-media`
Expected: "Created bucket 'clickit-media'" (if it says it already exists in this account, report that; do not delete anything).
Then wait.

**Step 6 [KOSS] - create the Next cache bucket**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler r2 bucket create clickit-next-cache`
Expected: "Created bucket 'clickit-next-cache'".
Then wait.

**Step 7 [KOSS] - write the CORS file (outside the repo)**
Command: `cd <WORKTREE> && node scripts/cf/r2-cors.mjs --app-origin https://clickit.<SUB>.workers.dev --app-origin https://www.clickitstory.ae > /Users/koss/.clickit-cloudflare/r2-cors.json && cat /Users/koss/.clickit-cloudflare/r2-cors.json`
Expected: JSON with one rule: origins the two URLs above, methods `PUT`, headers `Content-Type`, expose `ETag`, max age 3600. (Local preview never uses the real bucket, so no 127.0.0.1 origin.)
Then wait.

**Step 8 [KOSS] - apply CORS to the media bucket**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler r2 bucket cors set clickit-media --file /Users/koss/.clickit-cloudflare/r2-cors.json`
Expected: a success line. If it rejects a key name, report the exact error (research assumption A3); the controller fixes `scripts/cf/r2-cors.mjs` and you repeat Steps 7-8.
Then wait.

**Step 9 [KOSS] - read CORS back**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler r2 bucket cors list clickit-media`
Expected: the same two origins, method PUT, header Content-Type.
Then wait.

### D1 tag cache

**Step 10 [KOSS] - create the D1 database**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler d1 create clickit-tag-cache`
Expected: output with `"database_id": "<uuid>"`. Report the uuid (not a secret). The work session writes it into `wrangler.jsonc` (plan 02-10); the deploy guard refuses the all-zero placeholder.
Then wait.

### Build values (public, not secrets)

**Step 11 [KOSS] - create the workers.dev build env file**
Command: `umask 077 && open -e /Users/koss/.clickit-cloudflare/clickit.workersdev.env` (create it if TextEdit asks), and type these five lines with the real values:
`NEXT_PUBLIC_SUPABASE_URL=https://lajguozmtissnnfccmej.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key from the Supabase dashboard, API settings>`, `NEXT_PUBLIC_SITE_URL=https://clickit.<SUB>.workers.dev`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>` (do **Step 20 now, before Step 12**: the deploy guard from plan 02-13 refuses a build with no real Turnstile site key or with a Cloudflare test key), `NEXT_PUBLIC_CF_BEACON_TOKEN=` (left empty until Step 22). Save.
Check: `grep -c -E '^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY|SITE_URL|TURNSTILE_SITE_KEY|CF_BEACON_TOKEN)=' /Users/koss/.clickit-cloudflare/clickit.workersdev.env`
Expected: `5`. Media origin and the cutover flag are NOT in this file; the build script sets them per target (plan 02-06).
Then wait.

### First workers.dev deploy (remote spike)

> **Migration gate before ANY app-Worker deploy of the PR #29 code (Step 12 redeploys, Step 30, every later "deploy workers.dev"):** migration `supabase/migrations/20261021120000_legal_pages_arabic_review.sql` must already be live: applied through `apply-live-migrations.yml` (from main, after Koss's approval of the dry run) and read back read-only (`legal_pages` has `ar_reviewed`, `title_ar_draft`, `content_ar_draft`; anon cannot select the two draft columns). The public legal query selects `ar_reviewed`, so without the migration `/legal/*`, `/terms` and `/privacy` return 404. The controller checks this before it runs the deploy command; no migration read-back, no deploy.
>
> **Old code after the migration (controller, 2026-10-21):** after migration 20261021120000 is applied, legal-page saves on the old code (www / frozen Vercel) fail: its bare `.select()` returns the revoked draft columns. Keep the apply → new-deploy gap short, and make no legal edits on www in between.
>
> **Live state (controller, 2026-10-21):**
> - PR #29 squash-merged on Koss's Ship: 6ebc802 (tree = b45b318), history 787ca3a; tags `backup/main-pre-pr29-20261021-1433`, `archive/phase-02-at-pr29`. Phase 2 stays In Progress.
> - Fresh live dump before the migration: `/Users/koss/.clickit-backups/live-20261021T133420Z-*`.
> - D-22 (Phase 6 duplicate YouTube ids): 18 older placeholder rows set `youtube_video_id = null`, 5 kept, 0 duplicate groups; logged in `/Users/koss/.clickit-backups/d22-before-*.json`.
> - `apply-live-migrations.yml` run 39609825509 applied 20261020150526 and 20261021120000 on Koss's approval (about 14:4x CET). Read back 14:45: `legal_pages` has `ar_reviewed`, `title_ar_draft`, `content_ar_draft`; anon has no SELECT on the drafts; both rows `ar_reviewed = true`; `episodes` has the `youtube_*` columns and `episodes_youtube_video_id_key`; the 5 youtube functions exist; 0 duplicate groups; 39 episodes; www still 200. **The migration gate above is passed.**
> - workers.dev runs main 787ca3a, version `7222dcee`, deployed 14:51 CET, media flag off. Signed-out smoke 14:52 all OK. Signed-in UAT by Koss on 7222dcee **passed** (2026-10-21, reported by the controller): Turnstile sign-in, admin settings with the existing admin login, `/ar/privacy`.
> - Every deploy warns "DOQueueHandler not exported" although `custom-worker.ts` re-exports it; the "Clickit /en CPU" session is checking whether ISR revalidation works. Open until it reports.

**Step 12 [CONTROL] - first deploy of the app Worker, media flag off**
Trigger: Koss writes "deploy workers.dev" (the same word for every app-Worker deploy in Phase 2, including redeploys).
Command (control session, in a checkout of the pushed phase-branch commit the work session names): `npm run cf:deploy:workersdev -- --media-flag off`
Expected: the guard prints `deploy-guard ok` (account, stamp target `workersdev`, no loopback, no local Supabase, D1 id set, crons empty, build stamp equals HEAD, clean tree, HEAD pushed to an origin branch), then wrangler prints the URL `https://clickit.<SUB>.workers.dev`. `curl -sI https://clickit.<SUB>.workers.dev/en` returns `HTTP/2 200` or a redirect. Pages that need the service role may fail until Step 13; that is expected.
Then wait.

### Worker secrets (one per step, typed into the wrangler prompt only)

**Step 13 [KOSS] - Supabase service role key**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name clickit`
Expected: prompt "Enter a secret value:"; paste the live service role key (Supabase dashboard, API settings); output "Success! Uploaded secret SUPABASE_SERVICE_ROLE_KEY".
Then wait.

**Step 14 [KOSS] - cron secret (generated, never seen)**
Command: `openssl rand -hex 32 | HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put CRON_SECRET --name clickit`
Expected: "Success! Uploaded secret CRON_SECRET". (A new value; Vercel's own CRON_SECRET is left as it is. Crons stay off on the Worker until Phase 3.)
Then wait.

**Step 15 [KOSS] - R2 API token scoped to the media bucket**
Where: dash.cloudflare.com, ClickitStory account, R2, Manage R2 API Tokens, Create API token. Name `clickit-media-presign`; Permissions "Object Read & Write"; Specify bucket: `clickit-media` only; TTL forever (rotation is a Phase 3 step). Create.
Expected: the page shows an Access Key ID and a Secret Access Key once. Keep the page open for Steps 16-17. Do not copy them anywhere else.
Then wait.

**Step 16 [KOSS] - R2 access key id**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put R2_ACCESS_KEY_ID --name clickit`
Expected: paste the Access Key ID at the prompt; "Success! Uploaded secret R2_ACCESS_KEY_ID".
Then wait.

**Step 17 [KOSS] - R2 secret access key**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put R2_SECRET_ACCESS_KEY --name clickit`
Expected: paste the Secret Access Key at the prompt; "Success! Uploaded secret R2_SECRET_ACCESS_KEY". Close the token page.
Then wait.

**Step 18 [KOSS] - Resend key (existing contact-form mail path)**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put RESEND_API_KEY --name clickit`
Expected: "Success! Uploaded secret RESEND_API_KEY". (Contact and newsletter are not exercised on workers.dev; they are tested on local preview.)
Then wait.

**Step 19 - removed (2026-10-20)**: admin Arabic fill uses the Workers AI binding `AI` (wrangler.jsonc, model `@cf/google/gemma-4-26b-a4b-it`); no secret needed. Nothing to type.

### Turnstile and Web Analytics

**Step 20 [KOSS] - create the Turnstile widget (run it during Step 11, before the first deploy in Step 12)**
Where: dash.cloudflare.com, ClickitStory account, Turnstile, Add widget. Name `clickit`; Hostnames: `clickit.<SUB>.workers.dev`, `www.clickitstory.ae`, `clickitstory.ae`; Widget mode: the mode Koss signed in plan 02-05 (recommended: Managed). Free plan.
Expected: a Site Key and a Secret Key. Put the Site Key (public) into `/Users/koss/.clickit-cloudflare/clickit.workersdev.env` as `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>`. Keep the page open for Step 21.
Then wait.

**Step 21 [KOSS] - Turnstile secret**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put TURNSTILE_SECRET_KEY --name clickit`
Expected: paste the Secret Key at the prompt; "Success! Uploaded secret TURNSTILE_SECRET_KEY". Supabase CAPTCHA stays OFF (it is project-wide and would break sign-in on the live Vercel site); it is Phase 3 step P3-7.
Then wait.

**Step 22 [KOSS] - Web Analytics site**
Where: dash.cloudflare.com, ClickitStory account, Analytics & Logs, Web Analytics, Add a site, hostname `clickit.<SUB>.workers.dev`.
Expected: either a JS snippet with a token (put the token into the env file as `NEXT_PUBLIC_CF_BEACON_TOKEN=<token>`), or a refusal for workers.dev hostnames. If refused, report the exact message; the beacon stays off on workers.dev and PLAT-06 is proven on www at the Phase 3 cutover (research A9).
Then wait.

### Supabase (live project dashboard setting, no SQL)

**Step 23 [KOSS] - add the workers.dev URL to the Supabase redirect allow-list**
Where: supabase.com dashboard, project `lajguozmtissnnfccmej`, Authentication, URL Configuration, Redirect URLs, Add URL: `https://clickit.<SUB>.workers.dev/**`. Do not change the Site URL (it stays www for the live site).
Expected: the list shows the new entry next to the existing ones.
Then wait.

**Step 24 [KOSS] - secret names read-back**
Command: `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret list --name clickit`
Expected: names only: CRON_SECRET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY. No values are shown.
Then wait.

### Media copy, media Worker, flag on (Steps 25-32, prepared 2026-10-21 14:5x CET)

**Where things stand (controller, 2026-10-21):** the scripts are on `main` since #29 (6ebc802), so `<WORKTREE>` is now the main checkout `/Users/koss/Developer/Clickit`. Steps 26-29 must run there: `deploy.mjs` resolves `--verify-report` from the checkout it runs in, so the reports must sit in the main checkout's `.tmp/` (gitignored) for the controller's Step 30. `<SUB>` is `clickitstory`. R2 bucket `clickit-media` already holds a verified copy of the 86 objects from 2026-10-20 (#24); this run re-syncs it. Re-sync only with `r2:media` (never `r2:copy`, which overwrites the fast-start videos).

| Step | Who | Writes | Needs Koss's word |
|---|---|---|---|
| 25 | Koss, his terminal | nothing | no (his own terminal) |
| 26 | Koss, same terminal | nothing (reads Supabase Storage; `.tmp/` files) | no |
| 26b | controller | nothing (reads the report) | no |
| 27 | Koss, same terminal | R2 bucket `clickit-media` (adds and replaces copies; deletes nothing) | the controller's "dry-run reviewed, run step 27" |
| 28 | controller | a new Worker `clickit-media-r2` on workers.dev (option A) | **yes: "deploy media worker"**, after the option A PR is on main |
| 29 | Koss or controller | nothing (GET/HEAD only; `.tmp/` file) | no |
| 30 | controller | the `clickit` Worker on workers.dev | **yes: "flag on workers.dev"** |
| 31 | Koss, in Hermes | a sign-in row in live Supabase Auth only | no (accepted cost of sign-in UAT) |
| 32 | Koss, in Hermes | one live `shows` row + one audit row + new R2 objects | **yes: "approve one draft write"** |
| 32b | controller | reverts that `shows.poster_url`; deletes the test R2 keys | **yes: "approve poster revert", then "approve test poster cleanup"** |

Steps 25-29 run in ONE terminal window that stays open. The values are read with `read -rs` so they never reach the screen, the shell history or a file.

**Step 25 [KOSS] - load the copy credentials into this terminal only**
Commands, one at a time, pasting each value at its silent prompt:
1. `cd /Users/koss/Developer/Clickit`
2. `read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY`
3. `read -rs R2_ACCESS_KEY_ID && export R2_ACCESS_KEY_ID`
4. `read -rs R2_SECRET_ACCESS_KEY && export R2_SECRET_ACCESS_KEY`
5. `export NEXT_PUBLIC_SUPABASE_URL=https://lajguozmtissnnfccmej.supabase.co CLOUDFLARE_ACCOUNT_ID=e329b099b6e4272fc0915a99832e47fe CLOUDFLARE_R2_BUCKET=clickit-media`
Check: `for v in SUPABASE_SERVICE_ROLE_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY NEXT_PUBLIC_SUPABASE_URL CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_R2_BUCKET; do [ -n "${(P)v}" ] && echo "$v set" || echo "$v MISSING"; done`
Expected: six "set" lines, no values printed. The R2 key pair is the Step 15 token (the same pair stored as Worker secrets in Step 24); if it is no longer at hand, create a second token with the same scope (Object Read & Write, bucket `clickit-media` only), use it here, then delete the old one and re-run Step 24's `wrangler secret put` for both R2 names.
Then wait.

**Step 26 [KOSS] - build the manifest and dry-run report (no writes)**
Command (same terminal): `npm run r2:media -- --refresh`
Expected: "Wrote N objects to .tmp/r2-media-manifest.json" and "Dry-run report: .tmp/r2-media-reports/dry-run-<timestamp>.md" with per-type counts, planned variants and skipped types (SVG, ICO, GIF, video) with reasons. N is read now; it may be more than 86 (uploads since 2026-10-20). Send the controller the path of the .md report (file names, sizes and hashes only).
Then wait.

**Step 26b [CONTROL] - review the dry run**
Read the .md report. Check: N against the live Storage object count (read-only); source buckets are only `show-artwork`, `site-assets`, `avatars`; every skipped type has a reason. Then write "dry-run reviewed, run step 27" (or stop and say what is wrong).

**Step 27 [KOSS] - execute the copy (writes R2 only)**
Trigger: the controller writes "dry-run reviewed, run step 27".
Command (same terminal): `npm run r2:media -- --execute`
Expected: one line per object (`copied`, `skipped (identical)` or `remuxed`), then "Verified N originals, V variants" and "Checksum report: .tmp/r2-media-reports/copy-<timestamp>.json and .md". Zero failures. Re-running the same command prints only `skipped (identical)` lines. Send the controller the copy report path.
Note: from here until the cutover, any admin media edit on www (frozen Vercel) goes to Supabase only. A new upload is a new key and the media Worker falls back to Supabase for it; an overwrite of a fixed key (avatars, `settings/og.png`, the hero video) leaves R2 stale. So: no media edits on www until the cutover, or re-run Steps 26-27 just before it.
Then wait.

**Step 28a [KOSS] - decision: which media Worker serves R2 for the workers.dev test** — **DECIDED 2026-10-21: A** (Koss in session C). Built on branch `phase-02-finish`: env `r2-workersdev` in `workers/media/wrangler.jsonc`, guard and origin checks in `scripts/cf/deploy-guard.mjs`. Step 28 runs only after that PR is on main.
`--env r2` deploys the **production** media host (`media.clickitstory.ae`) R2-first, because `clickit-media` has that custom domain in every env. The gate in `workers/media/DNS-PLAN.md` §5d cannot pass while www is the frozen Vercel build (it has no R2 credentials and no `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified`), and `workers/media/wrangler.jsonc` says never deploy `--env r2` before it passes. Options:
- **A (chosen): a separate workers.dev-only media Worker.** Env `r2-workersdev` (Worker name `clickit-media-r2`, explicit `routes: []` because wrangler inherits the top-level custom domain otherwise, `workers_dev: true`, R2 binding); the deploy guard refuses it with any route, another name or no binding, and the media-origin check accepts `clickit-media-r2.<sub>.workers.dev`. Production media stays Supabase-only until Phase 3. Cost: one small PR and review before Step 28.
- **B: `--env r2` on the production media host now,** with a written freeze on media edits on www until the cutover. No code. Breaks the §5d rule; rollback is `npm run cf:deploy:media -- --env supabase-only`.
- **C: skip Steps 28-30 in Phase 2** and do them as part of the Phase 3 cutover. No R2 test on workers.dev before go-live.
Expected: Koss picks A, B or C. Nothing is deployed before his answer.
Then wait.

**Step 28 [CONTROL] - deploy the media Worker**
Trigger: Koss writes "deploy media worker" after his 28a answer.
Pre-check (every option): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` shows only ClickitStory `e329b099b6e4272fc0915a99832e47fe`; `git status --short` clean; HEAD is on origin.
- Option A (after its PR is on main): `npm run cf:deploy:media -- --env r2-workersdev` → URL `https://clickit-media-r2.clickitstory.workers.dev`. `<MEDIA_ORIGIN>` below = that URL. Also check production is untouched: `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png` still returns 200 and `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 deployments list --name clickit-media` shows no new deployment.
- Option B: `npm run cf:deploy:media -- --env r2` → `<MEDIA_ORIGIN>` = `https://clickit-media.clickitstory.workers.dev` (and `media.clickitstory.ae` now serves R2 first).
Expected: `deploy-guard ok`, then the URL. `curl -sI <MEDIA_ORIGIN>/` returns 404 (no listing). Option B also: `curl -sI https://media.clickitstory.ae/site-assets/settings/favicon.png` returns 200 (the Worker sends no header naming its source; Step 29 is the proof).
Then wait.

**Step 29 [KOSS or CONTROL] - verify every object on the media host (read only)**
Command (main checkout): `node scripts/media/verify-media-host.mjs --origin <MEDIA_ORIGIN> --report .tmp/r2-media-reports/copy-<timestamp>.json`
Expected: "verify ok: N originals, V variants, 0 failures" and `.tmp/r2-media-reports/verify-<timestamp>.json`. Any failure: stop; the flag stays off.
Then wait.

**Step 30 [CONTROL] - workers.dev build with media on R2**
Trigger: Step 29 printed 0 failures AND Koss writes "flag on workers.dev".
Pre-check: migration 20261021120000 is live and read back (done 2026-10-21 14:45 CET, run 39609825509); `git status --short` clean in the main checkout; the verify report from Step 29 is in its `.tmp/`.
Command (main checkout): `npm run cf:deploy:workersdev -- --media-flag verified --media-origin <MEDIA_ORIGIN> --verify-report .tmp/r2-media-reports/verify-<timestamp>.json`
Expected: the guard checks the verify report (same manifest, equal object count, 0 failures) before building; the build sets `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` and `NEXT_PUBLIC_MEDIA_ORIGIN` for this target only. Images on `https://clickit.clickitstory.workers.dev/en` load from `<MEDIA_ORIGIN>`. No Vercel build ever gets this flag. Rollback: `npm run cf:deploy:workersdev -- --media-flag off`.
Note: the media-origin rule accepts `clickit-media[-r2].<sub>.workers.dev` or `media.clickitstory.ae` (option A, `phase-02-finish`).
Note (Step 32 with option A): the draft show's new `poster_url` points at `clickit-media-r2.clickitstory.workers.dev` until Step 32b reverts it; Step 32b is required, so no live row keeps that test host.
Then wait.

### Approvals during UAT (plan 02-22)

**Step 31 [KOSS] - name the draft test show (read only)**
Where: https://clickit.<SUB>.workers.dev/en/admin, signed in as admin (in Hermes). Pick one show whose status is draft (not visible to viewers) **and whose current poster is a Supabase Storage URL or empty** (not an R2 key: replacing an R2 poster deletes the old R2 object, and Step 32b could not bring it back). Tell the controller its title. Nothing is changed by this step apart from what any sign-in does in live Supabase Auth (a session row in auth.sessions and auth.users.last_sign_in_at); that is the accepted cost of sign-in UAT on workers.dev.
Expected: a draft show title. The controller records, read-only by id: the show id, the current `poster_url` (exact string, or NULL) and `updated_at`. Step 32b restores that exact `poster_url`.
Then wait.

**Step 32 [KOSS] - approve the single live write of Phase 2**
Trigger word: "approve one draft write". Then, in Hermes on workers.dev, open that draft show in the admin and upload a new poster image (a test PNG the controller gives you). This one action is the real presigned upload round trip (browser -> R2 -> finalize) AND the only database write of Phase 2.
Exactly what changes:
- one row in `public.shows` (the named draft show, by id): `poster_url` becomes `https://clickit-media-r2.<SUB>.workers.dev/show-artwork/shows/<show id>/poster-<ts>-<rand>.<png|jpg|webp>` (plus the existing `?v=` cache-bust if the column uses it); no other column and no other row;
- one new row in `public.admin_audit_log` for that upload;
- new objects in R2 bucket `clickit-media` (key shapes from `src/server/upload-kinds.ts` `mintUploadKey` / `variantKeyFor`):
  - original: `show-artwork/shows/<show id>/poster-<ts>-<rand>.<ext>` (the path of the new `poster_url`);
  - WebP variants, only the widths the browser made (smaller than the image): `_v/640/webp/<original key>`, `_v/1280/webp/<original key>`, `_v/1920/webp/<original key>`;
- the previous poster: if it is a Supabase Storage URL it is NOT deleted (Supabase is emptied only after Koss approves, MEDIA-07); if it were an R2 key it would be deleted from R2 only.
Expected: the progress bar completes, the new poster shows in the admin within 10 seconds, and it loads from `clickit-media-r2.<SUB>.workers.dev`. The controller records the new `poster_url` exactly (it gives the original key) and then reads back, read-only by id: the show row (only `poster_url` and `updated_at` differ from the values recorded at Step 31) and `admin_audit_log` rows created after the trigger time (exactly one). The show stays a draft, invisible to viewers.
Then wait.

**Step 32b [CONTROL] - revert the test poster (owner-gated) and clean up its R2 objects**
Chosen: **revert** (not a dedicated test show). A new never-publish show would itself be a live insert to create and a live delete to remove, and it would sit in the admin show list; restoring one column on an existing draft is a smaller, fully reversible write.
Trigger word: "approve poster revert". Runs right after Step 32's read-back, before Phase 2 closes; the `clickit-media-r2` host is a test host and must not stay in a live row.
1. Write (controller, live project, one statement, guarded by the Step 32 value so it changes nothing if the row moved on):
   `update public.shows set poster_url = <Step 31 poster_url, or NULL> where id = '<show id>' and poster_url = '<Step 32 poster_url>' returning id, poster_url;`
   Expected: exactly 1 row, `poster_url` equal to the Step 31 value. 0 rows: stop and report (someone changed the show). `updated_at` changes through the `set_updated_at` trigger; that is expected. The `admin_audit_log` row from Step 32 stays (the log is append-only); this SQL revert writes no audit row, so the controller notes it in the hand-over.
2. Read back (read-only, by id): `poster_url` equals the Step 31 value; no other column differs from Step 31 except `updated_at`.
3. R2 cleanup, trigger word "approve test poster cleanup" (writes R2 only; the keys are those listed in Step 32, derived from the recorded `poster_url`):
   `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 r2 object delete "clickit-media/<original key>" --remote`
   then the same command for `clickit-media/_v/640/webp/<original key>`, `clickit-media/_v/1280/webp/<original key>`, `clickit-media/_v/1920/webp/<original key>` (a variant the browser did not make returns not found; that is fine).
   Check: `curl -sI https://clickit-media-r2.<SUB>.workers.dev/<original key>` returns 404.
Expected: the show is exactly as it was at Step 31 (apart from `updated_at`), the four test keys are gone from R2, and no live row points at `clickit-media-r2`.
Then wait.

**Step 33 [KOSS] - Workers plan decision (only if the CPU report fails)** — **DECIDED 2026-10-21: "Stay Free, do the rebuild".** The signed-out pass of 02-21 failed on every route (02-CPU-REPORT.md); the caching rebuild is its own PR after #29. Steps 34 onward wait until it lands.
Only when `02-CPU-REPORT.md` shows a core route over the Free limits (p95 CPU over 10 ms, or 50 subrequests, or Error 1102). The controller brings the table and the price (Workers Paid, $5 per month, per Cloudflare's pricing page on the day).
Expected: Koss answers "stay on Free" or "approve Workers Paid". Nothing is enabled before his answer.
Then wait.

**Step 34 [KOSS] - approve the measurement sign-ins (runs during plan 02-21, before Steps 31-32)** — **waits for the caching rebuild to land (2026-10-21).**
Trigger word: "approve measurement sign-ins". Plan 02-21 signs in once as an admin and once as a viewer through `scripts/cf/make-session-cookie.mjs` in Koss's terminal. Each sign-in writes to live Supabase Auth: a row in auth.sessions and auth.users.last_sign_in_at (and a refresh token). Nothing else is written; the measurement itself is GET-only.
Expected: Koss writes the trigger word; the two cookie files are created by him (plan 02-21 Task 2).
Then wait.

---

## Part B: Phase 3 path - listed here, **Phase 3, not now**

Do not run any step in Part B during Phase 2. Each becomes a numbered step in the Phase 3 runbook with its own commands and expected output. Order matters.

- **P3-pre-cpu (Phase 3, not now, cutover gate, Koss 2026-10-21)** After the caching rebuild lands and is deployed to workers.dev, re-run the 02-21 measurement: every public route must be under 10 ms CPU (Workers Free, p95 of warm requests, no `exceededCpu`). The cutover does not start until this passes.
- **P3-pre-migration (Phase 3, not now, cutover gate, before ANY cutover deploy)** Migration `supabase/migrations/20261021120000_legal_pages_arabic_review.sql` must be live BEFORE any deploy of this code to www or the custom domains: applied through `apply-live-migrations.yml` with Koss's approval of the dry run, then read back read-only (`ar_reviewed`, `title_ar_draft`, `content_ar_draft` present; anon refused on the draft columns). The public legal query selects `ar_reviewed`: without the migration every legal page answers 404. Already applied for the workers.dev deploys in Part A: read it back again anyway.
- **P3-pre-max-rows (Phase 3, not now, pre-cutover check, read-only)** Confirm the live Supabase PostgREST `max_rows` is at least 1000: supabase.com dashboard, project `lajguozmtissnnfccmej`, Settings, API, Max rows. Koss reads it, or a session reads it through a read-only path. No change is needed; Phase 6's `readAllPages` relies on pages of up to 1000 rows. If it shows less than 1000, stop and tell the controller (added 2026-10-21 at the controller's request). **Done 2026-10-21: Koss read Max rows = 1000 (passes).**
- **P3-1 (Phase 3, not now)** Resolve the stray Cloudflare NS pair `ignat`/`nataly` (SAFE-05, Phase 1 item): find the owning account or rule it out. Must close before P3-3.
- **P3-2 (Phase 3, not now)** Add the zone `clickitstory.ae` to the ClickitStory account (Free plan) and re-create every current record DNS-only first (Vercel records and Resend records unchanged), compared line by line with the live zone at tasjeel.
- **P3-3 (Phase 3, not now)** Change the nameservers at tasjeel.ae to the ClickitStory-assigned pair. Check with `dig NS clickitstory.ae` against every `.ae` registry server until only the Cloudflare pair answers. www stays on Vercel throughout.
- **P3-4 (Phase 3, not now)** DNS records check: www and apex still resolve to Vercel; Resend SPF/DKIM/DMARC records present.
- **P3-5 (Phase 3, not now)** Media custom domain `media.clickitstory.ae`: attach it to the **media Worker** `clickit-media` (recommended; keeps `?w=` variants, Accept negotiation and the original fallback), not to the bare R2 bucket. Re-run the verify script against `https://media.clickitstory.ae`.
- **P3-6 (Phase 3, not now)** Switch off the Vercel crons (Vercel dashboard) and confirm no Vercel cron runs against live Supabase.
- **P3-7 (Phase 3, not now)** Enable Supabase CAPTCHA: provider Turnstile, secret = the Turnstile Secret Key, in the Supabase dashboard. From then on sign-in, sign-up and reset without a token are refused.
- **P3-8 (Phase 3, not now)** Enable Worker crons: set `triggers.crons` to `["0 1 * * *", "30 1 * * *", "0 4 * * 1"]` in `wrangler.jsonc` (UTC; the first and last as on Vercel, `30 1 * * *` = Phase 6 `/api/cron/youtube-recheck`, already mapped in `src/server/cron-schedule.ts`), deploy, read back in the dashboard. Only after P3-6.
- **P3-8b (Phase 3, not now, after P3-8 and at least one Monday 04:00 UTC run)** R2 upload sweep: read the dry run, then Koss's word flips it. The weekly `cleanup-media` cron lists the app Worker's `MEDIA` bucket (`clickit-media`, at most 5000 keys a run) and picks R2 uploads that were never finalised: keys of the exact minted upload shape (`<ts>-<8 hex>`; the 86 objects copied from Supabase never match), every object for the key (original and `_v/` variants) uploaded more than 24 h ago, no live reference anywhere (`src/server/r2-upload-sweep.ts`). `wrangler.jsonc` ships `"R2_UPLOAD_SWEEP_DELETE": "off"`: a dry run that deletes nothing.
  1. Read the report of a scheduled run (read-only): Cloudflare dashboard, ClickitStory account, Workers & Pages, `clickit`, Logs, filter `r2 upload sweep`; or during the run `HOME=/Users/koss/.clickit-cloudflare npx wrangler tail clickit --format pretty`. Expected: one line `[cron/cleanup-media] r2 upload sweep` with `mode: 'dry-run'`, `examined`, `truncated: false`, `candidates` and `candidateKeys`, `error: null`. Do not call the route by hand to get it: the same request also prunes live `rate_limits` rows. Stop and tell the controller if `error` is set, `truncated` is true, or any candidate key is not an upload Koss recognises as abandoned.
  2. Koss's word, then the controller: on a branch set `"R2_UPLOAD_SWEEP_DELETE": "on"` in `wrangler.jsonc` vars (exactly `on`), PR, Koss's Ship, then deploy with the explicit flag: `npm run cf:deploy:workersdev -- --media-flag <off|verified as now> --allow-upload-sweep-delete` (the deploy guard refuses `on` without it and prints a loud warning with it). Never set the var in the dashboard: that skips the guard, and the next deploy overwrites it anyway.
  3. Next Monday run: Logs show `mode: 'delete'`, `deleted` equal to `candidates` (or fewer: a key that became live in between is kept), `error: null`. Rollback: set it back to `"off"` and deploy (no flag needed).
- **P3-9 (Phase 3, not now)** Attach the Worker custom domains `www.clickitstory.ae` and `clickitstory.ae`; add them to the Turnstile widget, Web Analytics and the R2 CORS list (already there for www); update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL.
- **P3-10 (Phase 3, not now)** Database media URL rewrite, live DB, Koss's approval as one numbered step: create a backup/mapping table first, then rewrite both the Supabase Storage host and the `clickit-media.<SUB>.workers.dev` host (new uploads made on workers.dev in Phase 2) to `https://media.clickitstory.ae`. A DB-wide search finds zero old-host media URLs.
- **P3-11 (Phase 3, not now)** Rotate the Supabase service role key; `HOME=/Users/koss/.clickit-cloudflare npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name clickit` with the new value; confirm the old Vercel deployment can no longer write.
- **P3-12 (Phase 3, not now)** Proof window: Koss decides its length; the written rollback path to Vercel stays usable until he closes it.
- **P3-13 (Phase 3, not now, LAST)** Delete the Vercel project and its domain, only after Koss closes the proof window.

Until P3-13 the Vercel project itself is untouched by Phase 2: Phase 2 deletes `vercel.json`, BotID and the Vercel packages from the repo only, which is safe because Vercel deploys are blocked and the code reaches main only through Koss's Ship.

---

## Review log

Plan 02-02, 2026-10-20. Checked line by line against 02-CONTEXT.md (D-01..D-05, derived decisions, roadmap edits 1-9) and plans 02-03, 02-06, 02-08, 02-10, 02-20, 02-21.

1. **Wrangler commands pinned to HOME=/Users/koss/.clickit-cloudflare** - fixed. Every `Command` line was already pinned; the P3-11 secret command was not, now pinned. Remaining unpinned `wrangler` mentions are prose (rules, Expected text).
2. **Every Part A step has Expected and Then wait** - fixed. Step 33 had no Expected line; added. 34 steps, 34 "Then wait", 34 "Expected".
3. **Part A touches no DNS, www, Vercel; live rows only in the approved steps** - fixed. Rule 5 claimed Part A wrote only to Cloudflare and Step 23, which contradicted Steps 31, 32 and 34; Rule 5 now lists all four live-Supabase exceptions. No step touches DNS, www or Vercel.
4. **Script names and flags match plans 02-06 and 02-08** - pass. `cf:deploy:workersdev -- --media-flag off|verified --media-origin --verify-report`, `cf:deploy:media`, `r2:media -- --refresh`/`--execute`, `scripts/media/verify-media-host.mjs --origin --report`. Step 12's guard list extended to match 02-06 checkDeploy (stamp equals HEAD, clean tree, HEAD pushed). The CORS step uses `scripts/cf/r2-cors.mjs --app-origin` (built in this plan).
5. **Part B P3-1..P3-13** - pass. All 13 marked "Phase 3, not now"; P3-13 (Vercel deletion) is last; P3-6 (Vercel crons off) precedes P3-8 (Worker crons on, schedules equal vercel.json); P3-7 Supabase CAPTCHA; P3-10 DB URL rewrite with backup table and Koss's approval; P3-11 service role rotation.
6. **No secret value, placeholder secret or real key** - pass. Only `<anon/publishable key ...>` style descriptions and public ids (Supabase project ref, Cloudflare account id). A grep for JWT-shaped strings and Supabase secret-key prefixes prints 0.
7. **2026-10-20, work session C after plans 02-13/02-19** - fixed. The 02-13 deploy guard refuses a missing Turnstile site key, so Step 20 now runs inside Step 11, before Step 12. Added Step 4b (enable R2; the account answers 10042 today) with the rule-6 payment-method stop.
