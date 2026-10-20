---
phase: 01-safe-ground
plan: 03
subsystem: database
tags: [supabase-migrations, seed, migration-guard, postgres, scratch-database]

requires:
  - phase: 01-safe-ground/01
    provides: "scripts/migration-guard.mjs with PHASE1_NEUTRALISATION (to = null)"
provides:
  - "Five neutralised migrations (no executable drop, no fake data), same names and versions"
  - "supabase/seed.sql: fake data with self-guard and text[] broadcast_day literals; [db.seed] enabled"
  - "PHASE1_NEUTRALISATION with five final blob SHAs; guard passes against origin/main"
  - "tests/unit/migration-neutralisation.test.ts (34 tests with the guard suite)"
affects: [01-04 runbook and ruleset, Phase 1.1 local resets (now load seed.sql)]

tech-stack:
  added: []
  patterns:
    - "Neutralise applied migrations in place (comment out / select 1;) so versions stay recorded on live"
    - "Fresh-chain proof on a throwaway database on the shared local Postgres via docker exec psql, never db reset"

key-files:
  created:
    - supabase/seed.sql
    - tests/unit/migration-neutralisation.test.ts
  modified:
    - supabase/migrations/20260401000000_create_schema.sql
    - supabase/migrations/20260401000003_seed_data.sql
    - supabase/migrations/20260425000001_seed_example_shorts.sql
    - supabase/migrations/20260506115421_seed_fake_show_cast.sql
    - supabase/migrations/20260506120139_add_fake_cast_images.sql
    - supabase/config.toml
    - scripts/migration-guard.mjs

key-decisions:
  - "Break Fast Daily 'Mon-Fri' expanded to {Monday,Tuesday,Wednesday,Thursday,Friday} (Koss D-11/plan-gate default)"
  - "Proof ran on scratch DB p1_scratch_safe_ground with psql per file, single transaction; no supabase CLI reset of any kind"

requirements-completed: [SAFE-01, SAFE-02]

duration: 25min
completed: 2026-10-20
---

# Phase 1 Plan 03: Neutralise Migrations and Relocate Seed Summary

**The ten drops in the first migration are comments, four seed migrations are `select 1;` no-ops (app_config insert kept), fake data lives in a self-guarded `supabase/seed.sql`, and a fresh chain of all 58 migrations plus the seed was proven on a scratch database with the shared stack untouched.**

## Accomplishments

- `20260401000000_create_schema.sql`: CLEANUP header rewritten, ten drop statements prefixed `-- `; everything else byte-identical.
- `20260401000003_seed_data.sql`: only the `app_config` insert (`ON CONFLICT (id) DO NOTHING`) remains; the DO block (15 shows, 21 seasons, 94 episodes) removed.
- Shorts, fake cast and cast-image migrations reduced to a header plus `select 1;`.
- `supabase/seed.sql`: header, refusal self-guard, moved DO block (14 `broadcast_day` values converted to `text[]` literals, Poets Platform stays NULL, Mon-Fri expanded), `public.shorts` insert, fake cast insert, cast-image update, in that order. `[db.seed] enabled = true`.
- Guard allow-list `to` SHAs filled after the proof; `node scripts/migration-guard.mjs --base origin/main --head HEAD` exits 0 (5 files checked, 0 violations, 0 warnings).
- `git diff --name-status origin/main -- supabase/migrations`: exactly the five files, all M; 58 migration files unchanged in count; `20260605000003` untouched.

## Task Commits

1. Task 1: `0943390` fix(01-03) neutralise destructive first migration and move fake seed data to seed.sql
2. Task 2: no repo change (proof script and log live in `/Users/koss/.clickit-checks/`, uncommitted by design)
3. Task 3 RED: `8f02b18` test(01-03) failing regression test
4. Task 3 GREEN: `2229ddc` feat(01-03) pin allow-list to final blobs

## Scratch proof (D-11 amended)

Script `/Users/koss/.clickit-checks/p1-scratch-proof.sh`, log `/Users/koss/.clickit-checks/p1-scratch-proof.log`, run detached under the heavy lock; third run ended `exit=0`:

```
workdir_label=/Users/koss/Developer/Clickit/.claude/worktrees/phase-01.1-admin-actions-hardening-inserted
before=58|17|94
migrations_applied=ok
seed=ok
counts=1|15|21|94|6|45|58
cast_images=45
broadcast_days=Monday,Tuesday,Wednesday,Thursday,Friday
seed_rerun_exit=3
ERROR:  seed.sql refuses to run: public.shows is not empty (never seed a real database)
refusal_message=yes
after=58|17|94
shared_db_unchanged=yes
scratch_db_left=0
lock_released=1
exit=0
```

Fingerprint is `schema_migrations count | shows | episodes` of the shared `postgres` database. After the run `pg_database` has no `p1_scratch_safe_ground` and `/Users/koss/.clickit-heavy.lock` is gone. The only operations on the shared DB were a read-only fingerprint query and a read-only `pg_dump --schema-only` (auth, storage, extensions).

## Tests

- `node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/unit/migration-guard.test.ts tests/unit/migration-neutralisation.test.ts`: 34 pass, 0 fail (RED commit first had the blob and `to` tests failing)
- `npx tsc --noEmit`: clean
- Guard against `origin/main`: exit 0
- Not run (by rule or plan): full `npm run test:unit`, build, any GitHub workflow, `supabase` CLI, live DB

## Final blob SHAs (allow-list `to`)

| File | to |
|------|----|
| 20260401000000_create_schema.sql | c87bf539d731d8a42bd7058fb2725273bbb356f3 |
| 20260401000003_seed_data.sql | e6f0cd77d26e56c720059fd02e43412d7c292bc3 |
| 20260425000001_seed_example_shorts.sql | 0fcbc891c664fcc1fed44a866e6b48cfe0a5b7f4 |
| 20260506115421_seed_fake_show_cast.sql | 01af38c04c45402dfa7a191ae35f83af3e2b3245 |
| 20260506120139_add_fake_cast_images.sql | 8477b0d4ec5502ca0b454a473e828a260ba5b025 |

Any later edit to one of these files must refresh its `to` (the regression test fails otherwise).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scratch bootstrap needed two extra steps**
- **Found during:** Task 2 (first two runs failed, both cleaned up by the trap)
- **Issue:** (a) the schema-only dump of `auth`/`storage` also copied app-owned policies on `storage.objects` and triggers on `auth.users` from the shared DB (they reference `public`/`private` objects absent in the scratch DB), so migration 20260408000002 failed with a duplicate policy; (b) migration 20260424000000 alters publication `supabase_realtime`, which is per-database and not in a schema dump.
- **Fix:** In the scratch DB only, drop policies and non-internal triggers in `auth`/`storage`/`extensions` after the dump, and `create publication supabase_realtime`. No repo file changed; no migration edited.
- **Files modified:** `/Users/koss/.clickit-checks/p1-scratch-proof.sh` (outside repo)

Otherwise the plan was executed as written. No defect surfaced in the five edited files or in `seed.sql`, so Task 2 produced no fix commit.

## Known Stubs

None. `PHASE1_NEUTRALISATION[*].to` stubs from plan 01 are resolved.

## Threat Flags

None. T-01-13 to T-01-17 are mitigated: no executable drop remains (scan clean, allow-list pinned), seed self-guard proven by rerun, no CLI reset and shared DB fingerprint identical before/after, only the local container was used.

## Self-Check: PASSED

- supabase/seed.sql, tests/unit/migration-neutralisation.test.ts present
- Commits 0943390, 8f02b18, 2229ddc in git log
- STATE.md and ROADMAP.md not staged or edited by this plan
