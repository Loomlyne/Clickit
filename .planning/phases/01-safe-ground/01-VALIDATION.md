---
phase: 1
slug: safe-ground
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` § Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `npm run test:unit` (strip-types) |
| **Config file** | none (flags in `package.json`) |
| **Quick run command** | `npm run typecheck && npm run test:unit` |
| **Full suite command** | `npm run gate:local` under `/Users/koss/.clickit-heavy.lock`, detached, log `/Users/koss/.clickit-checks/p1-gate.log` ending `exit=` |
| **Estimated runtime** | quick ~10 s; full several minutes (build) |

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** add `npm run lint`, YAML syntax check of `.github/workflows/*.yml`, and `node scripts/migration-guard.mjs --base origin/main`
- **Before `/gsd:verify-work`:** full suite green + local reset counts (D-11)
- **Max feedback latency:** 15 s for the quick loop

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Automated command |
|------|------|------|-------------|-------------------|
| 01-01-T1 scanner + classifier | 01 | 1 | SAFE-02 | `node --experimental-strip-types --test tests/unit/migration-guard.test.ts` |
| 01-01-T2 git rules, CLI, scripts | 01 | 1 | SAFE-02, SAFE-03 | `npm run test:unit && npm run typecheck && node scripts/migration-guard.mjs --base origin/main --head HEAD` |
| 01-02-T1 pr-gate.yml | 02 | 1 | SAFE-03 | `node --experimental-strip-types --test tests/unit/workflows.test.ts` + ruby YAML parse |
| 01-02-T2 apply-live-migrations.yml | 02 | 1 | SAFE-02 | `npm run test:unit` + ruby YAML parse + old file absent |
| 01-03-T1 neutralise + seed.sql + config | 03 | 2 | SAFE-01 | scanSql over the five files + seed/config greps |
| 01-03-T2 scratch-DB proof [BLOCKING] | 03 | 2 | SAFE-01 | `/Users/koss/.clickit-checks/p1-scratch-proof.log` ends `exit=0`, `counts=1\|15\|21\|94\|6\|45\|58` |
| 01-03-T3 allow-list SHAs + regression test | 03 | 2 | SAFE-01, SAFE-02 | `npm run test:unit && node scripts/migration-guard.mjs --base origin/main --head HEAD` |
| 01-04-T1 controller runbook | 04 | 3 | SAFE-02, SAFE-03, SAFE-04 | grep checks on `01-CONTROLLER-RUNBOOK.md` |
| 01-04-T2 merge main + gate:local | 04 | 3 | SAFE-03 | `/Users/koss/.clickit-checks/p1-gate.log` ends `exit=0` |
| 01-04-T3 hand-over, push, PR | 04 | 3 | SAFE-04, SAFE-05 | PR URL in hand-over; remote branch = HEAD; PR open, unmerged |

Note (planning, 2026-10-20): the running local stack is labelled with the Phase 1.1 worktree, so D-11 is proved on a scratch database `p1_scratch_safe_ground` with psql (no `supabase db reset`); the CLI reset is runbook step 12.

Requirement coverage:

| Requirement | Behavior | Test Type | Automated Command |
|-------------|----------|-----------|-------------------|
| SAFE-01 | DROP block + seeds neutralised; guard finds no unwaived destructive SQL in edited files | unit | `node --experimental-strip-types --test tests/unit/migration-guard.test.ts` |
| SAFE-01 | Fresh local DB: migrations + `supabase/seed.sql` apply; expected counts | integration (local stack, lock) | `supabase db reset --local` + count query via `docker exec supabase_db_Clickit psql` |
| SAFE-01 | `seed.sql` refuses a populated DB | integration (local) | re-run seed.sql via psql after reset, expect non-zero exit with guard message |
| SAFE-02 | Guard: clean pass; drop/truncate/delete fail; waiver passes; edit/rename/delete of applied file fails; allow-list once | unit | `tests/unit/migration-guard.test.ts` |
| SAFE-02 | Apply workflow shape (dispatch only, dry-run → apply, `environment: live-db`, no `--include-all`/`--include-seed`, SHA pins, timeouts) | unit (text) | `node --experimental-strip-types --test tests/unit/workflows.test.ts` |
| SAFE-03 | PR workflow shape (opened/synchronize/reopened, jobs `gate` + `migration-guard`, concurrency cancel, no secrets, SHA pins, timeouts) | unit (text) | `tests/unit/workflows.test.ts` |
| SAFE-03 | Gate steps green on branch | local | `npm run gate:local` under the lock |
| SAFE-04 | Evidence on file | doc | `test -f .planning/phases/01-safe-ground/01-LIVE-AUDIT.md` |
| SAFE-05 | Evidence on file | doc | `grep -q 'SAFE-05' .planning/phases/01-safe-ground/01-LIVE-AUDIT.md` |

## Wave 0 Requirements

- [ ] `scripts/migration-guard.mjs` + `tests/unit/migration-guard.test.ts` — SAFE-01, SAFE-02
- [ ] `tests/unit/workflows.test.ts` — SAFE-02, SAFE-03
- [ ] `typecheck` + `guard:migrations` scripts in `package.json`; `gate:local` updated — SAFE-03

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workflows run on GitHub (first PR run) | SAFE-03 | Must not run workflows to test; first real PR run is the proof | Open the Phase 1 PR; check runs `gate` and `migration-guard` appear and pass |
| Ruleset + `live-db` environment exist | SAFE-02, SAFE-03 | Repo settings are controller/owner steps after signing | Controller runs the plan's `gh api` commands, reads back with GET |
| First live dry-run + approval | SAFE-02 | Live DB; owner-gated | Controller dispatches "Apply live migrations"; dry-run shows nothing pending; Koss approves or rejects |
| Supabase plan tier | SAFE-04 | Not exposed by CLI | Koss checks the dashboard (one numbered step) |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
