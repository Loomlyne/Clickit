# Hand-over: Phase 1 Safe Ground

DRAFT: written before push; the orchestrator pushes, opens the PR and fills the `PR:` line.

Branch `claude/phase-01-safe-ground-dc6bbe` -> remote `phase-01-safe-ground`. Base: `origin/main` d517ddc merged in (merge commit cca94fb; base won the STATE.md conflict). Work session; nothing deployed, no live DB access, no repo setting changed, no GitHub workflow run.
Final commit: the PR head is authoritative (`git log -1` on the branch after this file's commit).

PR: pending

## What is in the branch

- SAFE-01: five neutralised migrations (same names and versions, no executable drop, no fake data): `20260401000000_create_schema.sql` (ten drop lines now comments), `20260401000003_seed_data.sql` (only the `app_config` insert), `20260425000001_seed_example_shorts.sql`, `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql` (`select 1;`). Fake data moved to `supabase/seed.sql` (refuses to run when `public.shows` is not empty; Break Fast Daily expanded to five weekday names); `supabase/config.toml` `[db.seed]` enabled.
- SAFE-02: `scripts/migration-guard.mjs` (`npm run guard:migrations`; destructive-SQL scan with same-line `-- safe-drop: <reason>` waiver, applied-migration immutability, exact from/to blob allow-list for the five files `PHASE1_NEUTRALISATION`), `.github/workflows/apply-live-migrations.yml` (dispatch on `main` only, `dry-run` in `live-db-plan`, `apply` behind `live-db` approval, `pg_dump_taken` input, CLI 2.119.0, no include-all flag; replaces `supabase-migrations.yml`, so nothing auto-applies on push any more).
- SAFE-03: `.github/workflows/pr-gate.yml` (checks `gate` and `migration-guard`, guard run from the base branch copy), package scripts `typecheck`, `guard:migrations`, `gate:local` = lint, typecheck, unit tests, guard, build.
- SAFE-04: closed by `.planning/phases/01-safe-ground/01-LIVE-AUDIT.md` sections 1 to 5 (live migration history, admin policies and columns, media host counts). Owner dashboard check (plan tier, backups) pending: runbook step 11.
- SAFE-05: registry evidence in `01-LIVE-AUDIT.md` section 6 (commit 49fb186), plus this hand-over's own read-only re-check (below).
- Runbook for everything this session may not run: `.planning/phases/01-safe-ground/01-CONTROLLER-RUNBOOK.md`.

## SAFE-05 re-check (read-only, no DNS change)

- Time: 2026-10-20T13:22:50Z
- Command: `dig +norec NS clickitstory.ae @ns1.aedns.ae | awk '$4=="NS"{print tolower($5)}' | sort -u`
- Result, exactly two names: `brett.ns.cloudflare.com.` and `jen.ns.cloudflare.com.` (no ignat/nataly, no tasjeel).

## Gates (2026-10-20, clock UTC)

- `npm run gate:local` after merging `origin/main`, head cca94fb, `npm ci` first, placeholder public env, under the heavy lock: log `/Users/koss/.clickit-checks/p1-gate.log`, 13:22:43Z to 13:23:15Z, last line `exit=0`.
  - Lint: 0 errors, 17 warnings (pre-existing, other files).
  - Typecheck: clean.
  - Unit tests: 502 tests, 502 pass, 0 fail.
  - Guard: `migration-guard: 5 files checked, 0 violations, 0 warnings`.
  - `next build`: compiled, 55/55 static pages.
- Scratch-database proof of the full 58-migration chain plus seed (log `/Users/koss/.clickit-checks/p1-scratch-proof.log`, `exit=0`): `counts=1|15|21|94|6|45|58`, seed refusal on a non-empty database (`seed.sql refuses to run: public.shows is not empty`), shared database fingerprint unchanged (`58|17|94` before and after), scratch database removed.
- Guard against `origin/main`: exit 0, 0 violations.
- Workflow YAML parses (`ruby -ryaml`); 17 workflow text tests pass.

## NOT verified

- Both workflows on GitHub until this PR's own run (never run to test them, D-06).
- Node 24 in CI (RESEARCH A3).
- `supabase/setup-cli` v3.0.1 with CLI 2.119.0 in CI (A5); first proof is the post-merge read-only dry-run.
- `supabase db reset --local` through the CLI (the local stack belonged to Phase 1.1; proof used a scratch database with psql; runbook step 12).
- Environments `live-db` and `live-db-plan` (branch policy `main`), their secrets, deletion of the repo-level `SUPABASE_DB_URL`, the ruleset (runbook steps 3, 4, 4b, 5, 6).
- Non-admin push block semantics of the ruleset (A2).
- First live dry-run (runbook step 8).
- Supabase plan tier and backup status (runbook step 11).
- Guard can be edited by the PR it checks (Pitfall 9): CI runs the base branch copy, so this residual applies only to the Phase 1 PR itself and to PRs that edit `pr-gate.yml`.
- The orchestrator's uncommitted STATE.md edit was discarded to allow the merge (see below); the orchestrator must redo it.

## Plan-gate defaults used (signed by Koss 2026-10-20)

- Second environment `live-db-plan`: created in the runbook (required: the dry-run reads its environment secret).
- Ruleset extras `non_fast_forward`, `deletion`: not included (literal D-08).
- Repo secret `SUPABASE_DB_URL`: deleted by the owner. Timing moved by review CR-02 from "after the first good dry-run" to BEFORE the Phase 1 squash merge (runbook step 4b); Koss signed the deletion, the earlier timing is a change he should see at Ship.
- `live-db-plan` is mandatory (CR-02); the "if declined, the dry-run reads the repo-level secret" fallback is removed.
- Break Fast Daily seed days: five weekday names.
- Supabase CLI pin: bumped to 2.119.0.
- Approving account for `live-db`: `Loomlyne` (id 223640340).

## Merge freeze

The Phase 1 squash merge itself waits for the controller runbook's pre-merge block (review CR-02), in this order: create `live-db` (reviewer `Loomlyne`) and `live-db-plan`, both with deployment-branch policy `main` only (step 3); Koss puts the DB URL in both environment secrets (step 4); Koss DELETES the repo-wide `SUPABASE_DB_URL` (step 4b); the controller reads all of it back, including that the repo-level secret is gone (step 5). Why: `workflow_dispatch` runs the workflow from the ref the dispatcher picks, so while a repo-level `SUPABASE_DB_URL` exists a writer can dispatch an edited branch copy (no `environment:`, no "Main only" step) and write to live without approval. The "Main only" steps are diagnostics; the real protection is environment-only secrets plus the `main` branch policy plus the required reviewer.

After the merge, no other PR merges to `main` until the ruleset (step 6) is created and read back. No `Apply live migrations` dispatch before step 5 passes: GitHub auto-creates a missing environment with no reviewers when a workflow references it.

## Approval gate is procedural

The same GitHub account (`Loomlyne`, Koss's admin token, also on this Mac) both dispatches and approves, so GitHub cannot tell an agent from Koss. The rule: Koss approves in the Actions UI himself; the controller never approves and never calls the `pending_deployments` API (RESEARCH Pitfalls 10 and 11; `prevent_self_review: false` on purpose).

## Controller steps before the merge and after Ship

See `.planning/phases/01-safe-ground/01-CONTROLLER-RUNBOOK.md` (pre-merge block: steps 2, 3, 4, 4b, 5; then step 1 and the squash merge; then steps 6 to 12). Known conflict: the Phase 2 branch `claude/phase-02-execute-19d86a` edits the same `package.json` scripts block (base wins, re-add `typecheck`, `guard:migrations`).

## UAT (type/click -> expected)

1. Open the PR, Checks tab -> `gate` and `migration-guard` are green.
2. Click `gate` -> lint, typecheck, unit tests and build steps ran (not skipped).
3. In a terminal in the worktree type `npm run guard:migrations` -> exit 0, `0 violations`.
4. Type `git switch -c uat-guard-red`, create `supabase/migrations/20261101000000_uat_red.sql` containing `drop table public.shows;`, type `git add -A && git commit -qm uat && npm run guard:migrations` -> exit 1 naming that file, line 1, `drop`.
5. Append ` -- safe-drop: uat` to that line, commit, run the guard again -> exit 0; then `git switch -` and `git branch -D uat-guard-red`.
6. PR Files tab, open `.github/workflows/apply-live-migrations.yml` -> only `workflow_dispatch`, jobs `dry-run` then `apply` with `environment: live-db`, no include-all flag.
7. Open `supabase/migrations/20260401000000_create_schema.sql` -> the ten drop lines are comments.
8. Type `tail -15 /Users/koss/.clickit-checks/p1-scratch-proof.log` -> `counts=1|15|21|94|6|45|58`, the refusal message, `exit=0`.
