---
phase: 01-safe-ground
plan: 02
subsystem: infra
tags: [github-actions, pr-gate, migration-guard, supabase-cli, workflow-dispatch]

requires:
  - phase: 01-safe-ground/01
    provides: "scripts/migration-guard.mjs, npm scripts typecheck and guard:migrations"
provides:
  - ".github/workflows/pr-gate.yml: PR checks `gate` and `migration-guard`"
  - ".github/workflows/apply-live-migrations.yml: hand-started dry-run then approved apply"
  - "tests/unit/workflows.test.ts: 17 text tests on both workflow files"
affects: [01-04 runbook (live-db and live-db-plan environments, ruleset required checks)]

tech-stack:
  added: []
  patterns:
    - "Always-reporting required check: no workflow-level path filter; an in-job scope step gates heavy steps"
    - "Guard judged by the base branch copy (git show HEAD^1 into RUNNER_TEMP)"
    - "Workflow shape proven by string/regex tests, never by running on GitHub (D-06)"

key-files:
  created:
    - .github/workflows/pr-gate.yml
    - tests/unit/workflows.test.ts
  modified:
    - .github/workflows/apply-live-migrations.yml (replaces supabase-migrations.yml)

key-decisions:
  - "Pins as in the plan: checkout v4.2.2, setup-node v7.1.0, supabase/setup-cli v3.0.1, CLI 2.119.0, Node 24"
  - "Header comments avoid the literal strings the tests forbid (path-filter keyword, target-event name, secrets reference, forbidden CLI flags) so plain-text grep acceptance checks stay at 0"

patterns-established:
  - "Plan-gate defaults honoured: separate live-db-plan environment for the dry-run, live-db approval for apply, no workflow-level path filter"

requirements-completed: [SAFE-03, SAFE-02]

duration: 10min
completed: 2026-10-20
---

# Phase 1 Plan 02: PR Gate and Approved Live Migrations Summary

**`pr-gate.yml` (always-reporting `gate` + `migration-guard` running the base branch's guard) and `apply-live-migrations.yml` (dispatch on main, dry-run in `live-db-plan`, apply behind `live-db` approval, no include-all), proven by 17 local text tests and a YAML parse.**

## Accomplishments

- `pr-gate.yml`: `pull_request` (opened, synchronize, reopened, to main), read-only token, no secrets, per-PR concurrency with cancel, Linux, timeouts. `gate` classifies the change set (`scope` step) and runs npm ci, lint, typecheck, unit tests, build (placeholder public env) only for code changes; docs-only still ends green. `migration-guard` runs the base copy of the guard (`git show HEAD^1:...` into `$RUNNER_TEMP`), PR copy plus a warning only when the base has none.
- `apply-live-migrations.yml`: auto-apply on push removed. Dispatch only, both jobs refuse to run off `refs/heads/main`, `pg_dump_taken` required, `dry-run` writes the pending list to the run summary and outputs `pending` (unknown output counts as pending), `apply` needs it, runs in `live-db`, uses `supabase db push --db-url "$SUPABASE_DB_URL" --yes`. CLI 2.119.0.
- `tests/unit/workflows.test.ts`: 8 pr-gate tests and 9 apply tests (existence, triggers, forbidden flags, needs chain, environments, commands, main-only, input, pins, permissions, concurrency, timeouts).

## Task Commits

1. Task 1 RED: `bdcc5d2` test(01-02) pr-gate tests
2. Task 1 GREEN: `8bd263b` feat(01-02) pr-gate workflow
3. Task 2 RED: `6c14cad` test(01-02) apply workflow tests
4. Task 2 GREEN: `cd35784` feat(01-02) apply workflow (replaces supabase-migrations.yml)

## Verification

- `node --experimental-strip-types --test tests/unit/workflows.test.ts`: 17 pass, 0 fail (RED runs showed 8 then 9 failures first)
- `ruby -ryaml` parse of both workflow files: ok
- `ls .github/workflows`: exactly `apply-live-migrations.yml`, `pr-gate.yml`
- Acceptance greps: forbidden strings 0 in both files; `environment: live-db$` 1, `environment: live-db-plan` 1; scope condition count 6
- Not run (by rule): any GitHub workflow, `gh api`, `supabase`, build, full `npm run test:unit` (plan 04)

## Deviations from Plan

None - plan executed as written. Git records the apply file as add plus delete rather than a rename because the rewrite left too little shared content; the old path is gone and the new one exists.

## Known Stubs

None.

## Threat Flags

None. T-01-06 to T-01-12 and T-01-24 are covered by the file shapes and tests; T-01-10 and T-01-12 still depend on the plan 04 runbook (creating `live-db` with Koss as reviewer before the first dispatch).

## Self-Check: PASSED

- pr-gate.yml, apply-live-migrations.yml, workflows.test.ts present; supabase-migrations.yml absent
- Commits bdcc5d2, 8bd263b, 6c14cad, cd35784 present in git log
