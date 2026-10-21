# Hand-over: Phase 3, Production Cutover (code and runbook)

- Branch: `claude/phase-03-production-cutover-689a87` (worktree `.claude/worktrees/phase-03-production-cutover-689a87`), origin/main merged up to 233ead8 (PR #30 history commit).
- Plans executed: 03-01 … 03-06 (code, SQL, runbook), each with a SUMMARY in `.planning/phases/03-production-cutover/`. 03-07 … 03-13 are the live steps: the controller and Koss run them after Ship, in the order of `03-RUNBOOK.md`.
- PR: opened by the orchestrator/controller after this hand-over (not by the 03-06 executor). Not merged: merge is Koss's Ship through the controller.
- **No deploy, no live write, no secret seen.** No wrangler call against the account, no Cloudflare API call, no DNS change, no live database query, no workflow dispatch was made by the work session. Read-only public smokes only (dig, public GET/HEAD and TLS reads in 03-03/03-04).

## Gates

| Gate | Result |
|---|---|
| `npm run gate:local` (lint, typecheck, test:unit, guard:migrations, `next build`, `cf:build` preview) under `/Users/koss/.clickit-heavy.lock` via `scripts/cutover/with-heavy-lock.sh`, detached, placeholder public env only | **exit=0** on 3bd9cd3, log `/Users/koss/.clickit-checks/p3-gate.log` (start 2026-10-21T14:55:56Z, end 14:56:48Z). After it only `.planning/` files changed (03-06 runbook, gate file, deferred items, this hand-over, summary); every test skips `.planning` |
| Unit tests | 2234 pass, 0 fail |
| Lint | 0 errors, 25 warnings (all pre-existing, none in Phase 3 files) |
| Typecheck | clean |
| Migration guard | 1 file checked, 0 violations |
| `next build` / `cf:build` | compiled, 57/57 static pages; `build stamp written: target preview, media flag off` |
| Local SQL proof (03-05, re-run after the PR #31 review fixes) | `/Users/koss/.clickit-checks/p3-exec/p3-sql-test-pr31-head2.log` (head dc59c27, after `db reset --local` of this branch): `test-local: PASS`, `exit=0` (one rolled-back transaction on the local stack; now also updated_at drift, concurrent edit, strict refusal and partial reverse). Not part of `gate:local` (it needs the heavy lock that `gate:local` already holds): the controller runs it before Ship, see "Controller pre-Ship step" below |
| CI (`pr-gate.yml`) | runs on PR open and every push (Clickit exception) |

## What changed, per plan

- **03-01:** `publish-scheduled` refreshes the episodes/shows tags and `/`, `/coming-soon` on every successful run (D-12). `wrangler.jsonc` `env.production`: Worker name `clickit`, route `www.clickitstory.ae/*` by zone id, crons `0 1 * * *`, `30 1 * * *`, `0 4 * * 1` (G8), `RESEND_FROM_EMAIL = Clickit Story <no-reply@clickitstory.ae>`, no `CLEANUP_SUPABASE_ORIGINALS`, `R2_UPLOAD_SWEEP_DELETE` off; top level keeps `crons: []`. Tests: `publish-scheduled-refresh.test.ts`, `cutover-config.test.ts` (drift test).
- **03-02:** `build-target --target production` (env file `/Users/koss/.clickit-cloudflare/clickit.production.env`, publishable key only, real Turnstile, beacon token, media verified on `media.clickitstory.ae`, report sha256 in the stamp); `checkProductionDeploy`, `checkTargetSwitch` (D-18), media custom-domain route rule; `deploy.mjs --target production` is deploy-only and writes `clickit.last-deploy.json`; `--offline` dry run; npm scripts `cf:build:production`, `cf:deploy:production`. Test: `production-target.test.ts` (52 cases).
- **03-03:** `scripts/cutover/dns-check.mjs` (+ core; phases ns, resend, pre-flip, post-flip, rollback, final; registry + jen/brett + SOA) and `rollback.mjs` (+ core; Keychain token `clickit-cf-dns-edit`, one PATCH `{ proxied: false }` on www). Tests: `dns-check.test.ts`, `rollback.test.ts`.
- **03-04:** `x-clickit-runtime: workers` on every Worker response (`src/server/runtime-header.ts`, `custom-worker.ts`); `proof-check.mjs` (`--site-path`), `keys-check.mjs` (legacy 401 / publishable 200, captcha probe, `--extract-only`), `media-health --expect-source r2|supabase`, `parse-auth-results.mjs`, `http-pin.mjs`. Tests: `runtime-header`, `proof-check`, `keys-check`, `media-health-source`, `parse-auth-results`.
- **03-05:** migration `supabase/migrations/20261021143410_media_url_rewrite_backup.sql` (creates `private.media_url_rewrite_backup` only, with `reverse_skipped_at` / `reverse_skip_reason`; RLS on; grants revoked); ops SQL `check-backup-table`, `preflight` (role privileges and trigger list), `rewrite-media-urls`, `scan-old-hosts`, `report`, `reverse-media-urls` (strict) and `reverse-media-urls-partial` (also the `clickit-media-r2` test host); rewrite and reverse pause the four `updated_at` triggers inside their own transaction (PR #31 review findings 1, 2, 6); `with-heavy-lock.sh`; local proof `test-local.sql/.sh`. Tests: `rewrite-sql.test.ts`; `youtube-migration.test.ts` and `legal-pages-arabic.test.ts` allow the new newest migration.
- **03-06:** `03-RUNBOOK.md` (Steps 0a-0c, 1-56, 36a, 52a; each with Command or Where, Expected, Rollback, Then wait; trigger words), `03-GATES.md` (branch B wording, legacy-key inventory, rollback ceiling, risk list, deviations, rewording for signature, controller follow-ups, findings), `deferred-items.md`.

## Guard dry-run outputs (03-02, offline, no wrangler started)

```
$ node scripts/cf/deploy.mjs --target production --dry-run --offline --verify-report /nonexistent.json
account check: skipped (offline)
deploy-guard REFUSED:
  - .open-next/cloudflare/next-env.mjs is missing: cannot prove no .env value is in the bundle
  - no production build: run cf:build:production first (.open-next/clickit-build-stamp.json missing)
  - production media: verify report missing or not an object
  - HEAD is not contained in origin/main: production deploys only from main (PR + Ship)
exit=1
```
`--target media --env r2 --dry-run --offline`: `deploy-guard ok (dry run)` against the real media config. `--offline` without `--dry-run` is refused.

## Files the controller runs (all named in 03-RUNBOOK.md)

- npm: `cf:build:production`, `cf:deploy:production` (`--dry-run`, `--verify-report`, `--allow-upload-sweep-delete` only at Step 52a), `cf:deploy:media` (`--env r2`, `--env supabase-only`), `r2:media` (`--refresh`, `--execute`; Koss's terminal), `media:health -- --expect-source r2`.
- `scripts/cutover/dns-check.mjs`, `proof-check.mjs`, `keys-check.mjs`, `rollback.mjs`, `parse-auth-results.mjs`, `with-heavy-lock.sh`.
- `scripts/cf/check-gates.mjs`, `scripts/media/verify-media-host.mjs`.
- `scripts/cutover/sql/check-backup-table.sql`, `preflight.sql`, `rewrite-media-urls.sql`, `scan-old-hosts.sql`, `report.sql`, `reverse-media-urls.sql` (strict, the default), `reverse-media-urls-partial.sql` (only on Koss's "reverse rewrite partial", runbook Step 52) (live: `supabase db query --linked --project-ref lajguozmtissnnfccmej -f …`). `test-local.sql/.sh` are local only.
- `.github/workflows/apply-live-migrations.yml` (Step 10 dispatch; Koss approves at Step 11).

## PR checklist (controller)

- **Migration file present: Phase 1 migration rule applies.** Exactly one new migration, `20261021143410_media_url_rewrite_backup.sql` (create table, RLS, revoke; no drop/delete/truncate; guard 0 violations). It reaches live only through `apply-live-migrations.yml` after Koss approves (runbook Steps 10-12), never on merge. Its dry run must list only this file (Step 0b's two migrations must already be live).
- Review: Grok via Koss's subscription; fallback the local `reviewer` agent, and say so on the PR. No Codex, CodeRabbit, Cursor or API-key reviewer.
- Clean-clone check before Ship (`/Users/koss/.clickit-checks/pr-check.sh <pr> <branch>`; the build needs the placeholder public env).
- Local SQL proof before Ship (the controller pre-Ship step below).

## Controller pre-Ship step: local SQL proof (PR #31 review finding 7; same text as 03-GATES.md section 10)

`test-local.sh` needs Docker, `supabase_db_Clickit` and the heavy lock; `gate:local` already holds that lock, so the proof is not inside `gate:local`. Run once before Ship, after the clean-clone check, from the checked clone (or the main checkout after the merge):

1. `perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m scripts/cutover/sql/test-local.sh /Users/koss/.clickit-checks/p3-exec/p3-sql-test-preship.log`, then `until grep -q '^exit=' /Users/koss/.clickit-checks/p3-exec/p3-sql-test-preship.log; do sleep 5; done; grep -E 'before_backup_table|test-local: PASS|psql_status|after_rollback_backup_table|^exit=' /Users/koss/.clickit-checks/p3-exec/p3-sql-test-preship.log`.
   Expected: `test-local: PASS`, `psql_status=0`, `after_rollback_backup_table` equal to `before_backup_table`, last line `exit=0`. First re-apply this branch's migrations to the shared stack: `scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-exec/p3-db-reset.log -- supabase db reset --local` from the same checkout (another branch's migrations, e.g. Phase 5's `profiles_protect_system_columns` trigger, make the preflight trigger check fail by design). Any other exit: no Ship.
- Live steps are in `03-RUNBOOK.md` and run only after Ship; Part 0 (Steps 0a P3-pre-cpu, 0b P3-pre-migration, 0c P3-pre-phase2) gates every live step.

## Open items for the controller

1. **check-gates vs the locale-root 308 (blocks Step 28's `ALL PASS`).** `scripts/cf/check-gates.mjs` wants `GET /en` and `GET /ar` to answer 200; the app answers 308 to `/<locale>/portfolio` since 02-21. A small reviewed fix on its own branch before Step 28 (03-GATES.md section 9 item 1, `deferred-items.md`). Not fixed in this PR (03-06 was writing-only; Phase 2 file). **FIXED in this branch (cfafdb6): check-gates accepts the locale-root 308 and probes `/<locale>/portfolio` for 200.**
2. `.planning/handovers/r2-media-copy.md` needs the "superseded for re-sync" header line (03-GATES.md section 8). The CLAUDE.local.md half of G7 is already applied.
3. Steps 23 and 42 are the first live checks of `rollback.mjs --verify-token` (user token required) and of keys-check's exact-401 rule (a 403 is a finding for Koss).
4. ROADMAP and REQUIREMENTS: no DNS-*, MAIL-*, MEDIA-* or PLAT-* requirement is ticked; they close with the ops plans (03-07 … 03-13). The signed rewording lines wait in 03-GATES.md section 7.
