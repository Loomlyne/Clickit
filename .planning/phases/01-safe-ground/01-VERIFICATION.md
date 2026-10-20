---
phase: 01-safe-ground
verified: 2026-10-20T13:30:00Z
status: human_needed
score: 8/8 code-side must-haves verified (5 controller/owner items pending on GitHub/Supabase)
overrides_applied: 0
re_verification: false
gaps: []
deferred: []
human_verification:
  - test: "Open the Phase 1 PR, Checks tab: `gate` and `migration-guard` run and are green (gate steps lint, typecheck, unit tests, build not skipped)"
    expected: "Two check runs from the GitHub Actions app (id 15368), both success. Runbook step 1 reads them back before the ruleset is created."
    why_human: "Workflows have never run on GitHub (D-06). Node 24 and the `migration-guard` base-copy selection can only be proven by the PR's own run."
  - test: "Controller creates environments `live-db` (reviewer Loomlyne, main only) and `live-db-plan` (main only), owner sets `SUPABASE_DB_URL` in each from his own terminal, controller reads both back (runbook steps 3 to 5)"
    expected: "Readback matches runbook step 5 exactly; no dispatch of `Apply live migrations` before it (GitHub auto-creates a missing environment with no reviewers)."
    why_human: "Repo settings and secrets; the work session may not touch them. SAFE-02 approval gate does not exist until this is done."
  - test: "Controller creates the `main` ruleset requiring `gate` and `migration-guard` (runbook step 6) and reads it back; confirm a red PR cannot merge for a non-admin"
    expected: "Ruleset active, bypass list reads Repository admin, required checks pinned to app 15368. RESEARCH A2 (non-admin push block semantics) confirmed or noted."
    why_human: "GitHub-side setting. Roadmap SC1 'cannot merge' is enforced only after the ruleset exists. Admin bypass `always` is by design (D-08)."
  - test: "First post-merge dispatch of `Apply live migrations` with `pg_dump_taken=true` after the local `supabase db dump` (runbook steps 7, 8)"
    expected: "Dry-run prints `Remote database is up to date`, job `apply` is skipped. Also first proof of setup-cli v3.0.1 with CLI 2.119.0 in CI. Koss approves any run with pending migrations himself in the Actions UI."
    why_human: "Touches the live database (read-only) and GitHub Actions; owner-gated by project rules."
  - test: "Owner confirms Supabase plan tier and backup/PITR status in the dashboard and the answer is recorded in 01-LIVE-AUDIT.md section 5 (runbook step 11)"
    expected: "Plan tier named; backup status recorded. Audit currently says CLI shows `pitr_enabled: false`, `backups: []`, plan tier not exposed (assumed Free)."
    why_human: "Roadmap SC3 and SAFE-04 name 'Supabase plan'; the CLI cannot read it. Marked [OWNER] in the roadmap."
  - test: "Controller runs `supabase db reset --local` from main with the seed (runbook step 12)"
    expected: "Counts `1|15|21|94|6|45|58`. Branch proved the same chain with psql on a scratch DB (log exit=0), not through the CLI."
    why_human: "Needs the local Docker stack in the main checkout."
---

# Phase 1: Safe Ground Verification Report

**Phase Goal (as submitted):** Nothing pushed to main can damage the live database, every PR is gated, a read-only live audit is recorded, and the stray NS pair is resolved before any NS change (SAFE-05 closed by the NS move, registry dig as evidence).
**Verified:** 2026-10-20 (worktree `phase-01-safe-ground-dc6bbe`, head 9faae6b)
**Status:** human_needed
**Re-verification:** No, initial verification

Starting stance was that the goal was not met. The code side survived every attempt to falsify it. What remains cannot be proven from the repo.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1) A PR adding drop/truncate/delete to a migration fails a check | VERIFIED (code) | `scripts/migration-guard.mjs` (444 lines, real scanner). Negative run in a scratch repo: `drop table` and `truncate` in a new migration exit 1 with `path:line` (`:1`, `:2`); editing an applied migration also flagged (violation count rose to 3). Waiver forms and non-destructive forms covered by `tests/unit/migration-guard.test.ts`: 20/20 pass (re-run by me). |
| 2 | (SC1) A PR failing lint, typecheck, unit tests or build shows red; clean PR green | VERIFIED (code), run pending | `.github/workflows/pr-gate.yml`: job `gate` runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (placeholder public env); job `migration-guard` runs the base-branch copy (`git show HEAD^1`). Plain `pull_request`, no secrets, SHA-pinned actions, concurrency cancel, timeouts. `workflows.test.ts` 17/17 pass. Local equivalent: `p1-gate.log` ends `exit=0`; `npx tsc --noEmit` exit 0 (re-run by me). No GitHub run yet: human item 1. |
| 3 | (SC1) Red check blocks merge | UNCERTAIN, controller step | Ruleset does not exist yet; runbook steps 1 and 6 hold the exact payload (required checks pinned to app 15368, admin bypass `always`). Human item 3. |
| 4 | (SC2) Destructive first migration and seed migrations are no-ops in place; fake data cannot reach a real DB | VERIFIED | `20260401000000_create_schema.sql`: all ten `drop` lines are `--` comments (grep shows only comments plus `on delete cascade`). `20260401000003_seed_data.sql`: only the `app_config` insert with `on conflict do nothing`. The three other seed migrations are `select 1;`. No `picsum`/`dQw4w9WgXcQ`/fake-cast SQL left in `migrations/` (the only `unsplash` hit is a comment). `supabase/seed.sql` (452 lines) carries the data and aborts when `public.shows` is non-empty; `config.toml` `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]`. 58 migration files, same names and versions. `migration-neutralisation.test.ts` 14/14 pass. Scratch-DB proof log ends `exit=0`, `counts=1|15|21|94|6|45|58`, refusal message present, shared DB unchanged. |
| 5 | (SC2) Live migration history matches files | VERIFIED | `01-LIVE-AUDIT.md` section 1 and raw `audit/q1-result.json`: live 58 versions, repo 58 files, no extra, no missing, no name mismatch. Read-only SELECTs only. |
| 6 | (SC2) A live push runs only after Koss approves a CI dry-run; nothing auto-applies | VERIFIED (code), approval gate pending | Old `supabase-migrations.yml` is gone from the branch (still on `origin/main`, removed by the squash). `apply-live-migrations.yml`: `workflow_dispatch` only (no push trigger), `dry-run` job in `live-db-plan` runs `supabase db push --dry-run`; `apply` job `needs: dry-run`, `environment: live-db`, main-only guard, `pg_dump_taken` must be true, no include-all, no `--debug`, no seed, CLI pinned 2.119.0, `contents: read`. The approval itself depends on environment `live-db` with reviewer existing: human item 2. |
| 7 | (SC3 / SAFE-04) Recorded read-only live audit: migrations vs files, `is_admin` source, every media-URL column, plan and backups | VERIFIED except plan tier | `01-LIVE-AUDIT.md` sections 1 to 5 plus `audit/q1..q3` SQL and JSON. `private.is_admin()` body and the one inline storage policy named; media columns table includes `app_config.footer_content` jsonb; backups from CLI (`pitr_enabled false`, `backups []`). Plan tier is not exposed by the CLI and is marked [OWNER]: human item 5. No secrets or connection strings in the audit files (grepped). |
| 8 | (SC3 / SAFE-05) Stray `ignat`/`nataly` pair ruled out, registry dig as evidence | VERIFIED | My own read-only dig at 13:25Z: `dig +norec NS clickitstory.ae @ns1.aedns.ae` and `@ns2.aedns.ae` both return exactly `brett.ns.cloudflare.com.` and `jen.ns.cloudflare.com.`; 1.1.1.1 same; `ignat` SOA equals `brett` SOA (`2417983238`); jen answers apex A (104.21.29.215, 172.67.171.221), brett answers `www` CNAME to the Vercel target. Pair is no longer delegated; who first added it is recorded as not found. Matches audit section 6 and the hand-over's 13:22:50Z check. |

**Score:** 8/8 truths hold on the code and read-only evidence side; truth 3 and the "run" half of truths 2 and 6 need GitHub-side actions.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/migration-guard.mjs` | Scanner, applied-file immutability, blob allow-list | VERIFIED | Substantive; exports `scanSql`, `classifyChanges`, `runGuard`, `PATTERNS`, `PHASE1_NEUTRALISATION`; `execFileSync('git', [...])` arrays; run against `origin/main` gives `5 files checked, 0 violations, 0 warnings` (the five allow-listed in-place edits match their pinned from/to blob SHAs) |
| `tests/unit/migration-guard.test.ts` | Fixtures | VERIFIED | 394 lines, 20 pass |
| `tests/unit/migration-neutralisation.test.ts` | Regression for neutralised files | VERIFIED | 14 pass |
| `tests/unit/workflows.test.ts` | Workflow text assertions | VERIFIED | 17 pass |
| `.github/workflows/pr-gate.yml` | `gate`, `migration-guard` | VERIFIED (not yet run on GitHub) | See truth 2 |
| `.github/workflows/apply-live-migrations.yml` | Dry-run then approved apply | VERIFIED (not yet run) | See truth 6 |
| `supabase/seed.sql`, `supabase/config.toml` | Fake data off migrations, seeding on | VERIFIED | See truth 4 |
| `package.json` scripts | `typecheck`, `guard:migrations`, `gate:local` order | VERIFIED | `lint, typecheck, test:unit, guard:migrations, build` |
| `01-LIVE-AUDIT.md` + `audit/` | Recorded audit | VERIFIED | See truths 5, 7, 8 |
| `01-CONTROLLER-RUNBOOK.md` | Steps for what the session may not run | VERIFIED | 14 sections, tagged CONTROLLER/OWNER, read-back conditions and rollbacks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tests | guard | ESM import of pure exports | WIRED | tests run and pass |
| guard | git | `execFileSync('git', ...)` | WIRED | negative run in a scratch repo produced real diff-based findings |
| `package.json` `gate:local` | guard | `npm run guard:migrations` | WIRED | |
| `pr-gate.yml` `migration-guard` | base-branch guard | `git show HEAD^1:scripts/migration-guard.mjs`, fallback to PR copy with warning | WIRED | `fetch-depth: 2` supports `HEAD^1`; first real proof is the PR run |
| `apply` job | `dry-run` job | `needs` plus `pending` output | WIRED | |
| `[db.seed]` | `seed.sql` | `sql_paths` | WIRED | |

### Data-Flow Trace (Level 4)

Not applicable: no dynamic-data UI in this phase.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Guard clean on this branch | `node scripts/migration-guard.mjs --base origin/main --head HEAD` | exit 0, 5 files, 0 violations | PASS |
| Guard red on drop/truncate and applied-file edit | scratch repo, guard run | exit 1, names `path:line` | PASS |
| Guard, neutralisation, workflow tests | `node --test` on the three files | 20/20, 14/14, 17/17 | PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| Registry NS | `dig +norec NS clickitstory.ae @ns1/ns2.aedns.ae` | jen + brett only | PASS |
| Full gate | not re-run by instruction; `/Users/koss/.clickit-checks/p1-gate.log` ends `exit=0` | exit=0 | PASS (log) |

### Probe Execution

No `probe-*.sh` declared or present. SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| SAFE-01 | 01-01, 01-03 | A pushed migration can never re-run the destructive first migration or seed fake data; history matches files | SATISFIED | Truths 4, 5 |
| SAFE-02 | 01-01, 01-02, 01-03, 01-04 | Live migrations only after Koss approves a CI dry-run; new drop/truncate/delete fails CI | SATISFIED in code; environments and approval wiring pending | Truths 1, 6; human items 2, 4 |
| SAFE-03 | 01-01, 01-02, 01-04 | Every PR runs lint, typecheck, unit tests, build; red blocks merge | SATISFIED in code; ruleset and first run pending | Truths 2, 3; human items 1, 3 |
| SAFE-04 | 01-04 | Read-only live audit recorded | SATISFIED except plan tier ([OWNER]) | Truth 7; human item 5 |
| SAFE-05 | 01-04 | Stray ignat/nataly pair found or ruled out | SATISFIED as redefined (closed by the NS move, registry dig) | Truth 8 |

Orphaned requirements: none. REQUIREMENTS.md maps SAFE-01 to SAFE-05 to Phase 1 and the union of plan `requirements` fields (01-01: SAFE-02/03/01; 01-02: SAFE-03/02; 01-03: SAFE-01/02; 01-04: SAFE-02/03/04/05) covers all five.

### Anti-Patterns Found

No TBD/FIXME/XXX in the phase's files. No stubs. No secrets in committed audit or runbook files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/ROADMAP.md` | 31, 36 | Phase 1 goal and SC3 still say "owner ... known before any NS change" and "zone move moved to Phase 3"; the submitted goal says SAFE-05 is closed by the NS move | Warning | Doc drift. The NS change already happened (CLAUDE.local.md records it, plus the apex outage lesson), so "before any NS change" was not honoured in sequence. The outcome (pair not delegated, serves no rival zone, both NS answering apex and www) is verified, but the contract text should be updated to match. |
| `.planning/REQUIREMENTS.md` | 14, 145-149 | SAFE-05 wording "before any NS change"; all five traceability rows still `Pending`; ROADMAP plan checkboxes unchecked | Warning | Update at phase close. |
| `supabase/migrations/20260530000000_reviews_unique_user_show.sql` | 7, 14 | `DELETE FROM reviews` | Info | Old, already applied on live; immutable under the guard; not in SAFE-01 scope. |
| `scripts/migration-guard.mjs` | n/a | Guard is a safety net for mistakes (obfuscated SQL not caught), and the Phase 1 PR and PRs editing `pr-gate.yml` are judged by their own text | Info | Documented in the file and runbook as accepted residuals (Pitfall 9). |
| `apply-live-migrations.yml` | `apply` job | Apply re-runs `db push` rather than replaying the dry-run output | Info | Same commit, no include-all; acceptable. |

### Human Verification Required

See the `human_verification` frontmatter. In order: (1) PR checks green on GitHub; (2) environments `live-db` and `live-db-plan` created, secrets set by Koss, read back; (3) ruleset created and read back; (4) local dump, then first read-only dry-run; (5) Supabase plan tier and backups in the dashboard; (6) `supabase db reset --local` proof. The approval click on any run with pending migrations is Koss's alone, and an agent never approves.

### Gaps Summary

No code-side gaps. Each success criterion has its code and evidence in the branch; the remaining items are GitHub settings, the first PR run, the first live dry-run and the Supabase plan tier, all controller or owner steps by design. One non-blocking warning: ROADMAP.md and REQUIREMENTS.md text for SAFE-05 and the Phase 1 goal still describe the pre-NS-move plan and should be reworded to match the submitted goal when the phase closes. Order constraint to keep: environments and ruleset read back before the squash merge, and no other PR merges until they exist.

---

_Verified: 2026-10-20_
_Verifier: Claude (gsd-verifier)_
