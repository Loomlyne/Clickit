---
phase: 05-accounts-and-email
plan: 01
subsystem: test-infrastructure
tags: [totp, rfc6238, db-proof, scratch-database, heavy-lock]
requires: ["05-00"]
provides: [totp-helper, db-proof-harness, heavy-run-wrapper]
affects: [05-09, 05-13, 05-14, 05-17, 05-32]
tech-stack:
  added: []
  patterns: ["scratch database inside the shared local container", "detached launch with exit= line"]
key-files:
  created:
    - scripts/lib/totp.mjs
    - tests/unit/totp.test.ts
    - scripts/db-proof.sh
    - scripts/heavy-run.sh
    - supabase/tests/00_smoke.sql
    - supabase/tests/README.md
  modified: []
key-decisions:
  - "db-proof.sh waits for the heavy lock (stale pid recovered); heavy-run.sh exits 75 when the lock is held, per plan"
  - "pre_*.sql fixtures in supabase/tests run after migrations and seed, before supabase/pending (backs the pre_fixtures= line for 05-09)"
  - "Scratch bootstrap creates supabase_vault and mirrors the stack's default privileges for postgres in public and storage"
requirements-completed: [AUTH-05, AUTH-06]
duration: 25min
completed: 2026-10-21
---

# Phase 5 Plan 01: Wave 0 test infrastructure Summary

**RFC 6238 TOTP helper proven against the Appendix B vectors, and a scratch-database proof harness that leaves the shared local database untouched and ends its log with `exit=`.**

## Tasks

1. TOTP helper (TDD). RED `024b527`, GREEN `1772c37`. `scripts/lib/totp.mjs` exports `base32Decode` and `totp`; 8 assertions pass (T=59 gives 287082 and 94287082, plus the 1111111109, 1234567890 and 2000000000 rows). Invalid base32 throws `totp: invalid base32 secret` without echoing the input. No `console.` calls; not imported from `src/`. eslint and tsc clean.
2. Proof harness. `0831324`. `scripts/db-proof.sh`, `scripts/heavy-run.sh`, `supabase/tests/00_smoke.sql`, `supabase/tests/README.md` (launch line, assertion convention).

## Verification

- Detached run (`caffeinate ... perl setsid ... bash scripts/db-proof.sh`): log `/Users/koss/.clickit-checks/p5-db-proof.log` ends `exit=0`, contains `ok 00_smoke`, `pre_fixtures=0`, `pending_applied=0`, `scratch_db_left=0`, `shared_db_unchanged=yes`, `other_stacks=none`.
- `--types-out` run wrote 32 KB of types from the scratch database (`types_written=...`).
- Negative run with a deliberately failing test file (removed afterwards): `FAIL m_zz_negative`, `exit=1`, scratch database still dropped, shared database unchanged.
- `bash scripts/heavy-run.sh true` ends `exit=0` and leaves no lock directory.
- No `worktrees/phase` path in `db-proof.sh`; `clickit-heavy.lock` referenced.

## Deviations from Plan

**1. [Rule 3 - Blocking] Scratch bootstrap lacked Vault**
- **Found during:** Task 2 first run
- **Issue:** migration 20261020150526 requires `supabase_vault`, which the Phase 1 bootstrap did not create.
- **Fix:** `create extension if not exists supabase_vault cascade` in the scratch database.
- **Commit:** 0831324

**2. [Rule 3 - Blocking] Scratch database had no default privileges**
- **Found during:** Task 2 second run (`00_smoke` failed: permission denied for table shows as anon)
- **Issue:** default privileges are per database, so `anon`/`authenticated` had no table grants in a fresh database.
- **Fix:** bootstrap mirrors the stack's `pg_default_acl` for `postgres` in `public` and `storage`, plus schema usage on `public`.
- **Commit:** 0831324

## Known Stubs

None.

## Threat Flags

None. The harness only reads the shared database (schema dump and count fingerprint); live Supabase is never contacted.

## Notes for later plans

- Run via the launch line at the top of `supabase/tests/README.md`; test files that write data should end with `rollback;`.
- The pg_dump bootstrap prints five known, harmless errors (functions/schemas referenced by copied defaults); they are expected and do not fail the run.

## Self-Check: PASSED
