---
phase: 03-production-cutover
plan: 05
subsystem: database
tags: [media-08, media-02, migration, ops-sql, rewrite, reverse, heavy-lock, node-test]
requires:
  - phase: 03-production-cutover
    provides: "03-01 ENTRY: PASS gate; 03-04 media-health --expect-source (03-02 is an ordering dependency only and has not run)"
provides:
  - "supabase/migrations/20261021143410_media_url_rewrite_backup.sql: private.media_url_rewrite_backup, RLS on, grants revoked from public/anon/authenticated (create only)"
  - "scripts/cutover/sql/check-backup-table.sql: existence, RLS flag, anon/authenticated select, ACL grants to API roles, row counts (read-only)"
  - "scripts/cutover/sql/preflight.sql: role/bypassrls, version, per-driver-column old_host/rewritable/not_rewritable with verdict, outside-driver old-host scan (read-only)"
  - "scripts/cutover/sql/rewrite-media-urls.sql: one atomic DO block over the 18 D-09 columns with backup, guarded update, count and jsonb leaf checks, run id in clickit.rewrite_run_id"
  - "scripts/cutover/sql/scan-old-hosts.sql: narrowed DB-wide old-host scan, public + auth, admin_audit_log excluded (read-only)"
  - "scripts/cutover/sql/report.sql: newest run per table/column, picsum posters by id and slug, admin_audit_log old-host rows (read-only)"
  - "scripts/cutover/sql/reverse-media-urls.sql: UPDATE-only restore of one run (setting or single open run), restored_at set"
  - "scripts/cutover/with-heavy-lock.sh: shared heavy lock wrapper with start=/end=/exit= log lines (reused for r2:media, runbook Steps 14-15)"
  - "scripts/cutover/sql/test-local.sql + test-local.sh: rolled-back proof on supabase_db_Clickit"
affects: [03-06 runbook Steps 10-12 and 47-52, 03-07 to 03-13 ops plans, proof window]
tech-stack:
  added: []
  patterns:
    - "Ops SQL linted by the migration guard's own scanSql in a unit test (the guard only scans supabase/migrations)"
    - "Local proof reads the shipped SQL files as text (psql backtick + set_config) and runs marked blocks, so assertions test the real files, not copies"
    - "Old-host detection = scan pattern still matching after the rewrite expression (works for text and jsonb alike)"
key-files:
  created:
    - supabase/migrations/20261021143410_media_url_rewrite_backup.sql
    - scripts/cutover/sql/check-backup-table.sql
    - scripts/cutover/sql/preflight.sql
    - scripts/cutover/sql/rewrite-media-urls.sql
    - scripts/cutover/sql/scan-old-hosts.sql
    - scripts/cutover/sql/report.sql
    - scripts/cutover/sql/reverse-media-urls.sql
    - scripts/cutover/sql/test-local.sql
    - scripts/cutover/sql/test-local.sh
    - scripts/cutover/with-heavy-lock.sh
    - tests/unit/rewrite-sql.test.ts
  modified:
    - tests/unit/youtube-migration.test.ts
    - tests/unit/legal-pages-arabic.test.ts
key-decisions:
  - "Rewrite regexes are anchored: text columns need the URL at the start ('^'), jsonb needs it at the start of a JSON string ('\"'); a URL inside prose is left and counted as not rewritable (stop for plan revision) instead of being rewritten silently"
  - "Old-host scan and preflight use ~* (case-insensitive) with the narrowed pattern supabase\\.co/storage/v1/|clickit-media\\.[a-z0-9-]+\\.workers\\.dev"
  - "check-backup-table reads grants from pg_class.relacl via aclexplode, not information_schema.role_table_grants (which hides grants the current role is not part of)"
  - "Rewrite checks each driver column exists with the expected type before touching it (schema drift on live = exception, nothing written)"
  - "Reverse raises when the chosen run has nothing left to restore, and when any value is no longer at the rewritten value (all-or-nothing)"
patterns-established:
  - "with-heavy-lock.sh <log> -- <cmd>: every heavy local step, log outside the repo, last line exit=<status>"
requirements-completed: []
duration: 12min
completed: 2026-10-21
---

# Phase 3 Plan 05: MEDIA-08 rewrite SQL Summary

**Backup-table migration plus atomic, reversible media-URL rewrite SQL (preflight, rewrite, scan, report, reverse), proven on the local Supabase stack in one rolled-back transaction under the heavy lock.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-21T14:29:36Z
- **Completed:** 2026-10-21T14:41Z
- **Tasks:** 2 of 2
- **Files:** 11 created, 2 modified

## Accomplishments

- Migration `20261021143410_media_url_rewrite_backup.sql` creates only `private.media_url_rewrite_backup` (RLS on, `revoke all ... from public, anon, authenticated`); the migration guard passes (1 file checked, 0 violations). Written only: it reaches live through apply-live-migrations.yml after Koss approves (runbook Steps 10-12).
- Rewrite is one `DO` block over the 18 D-09 columns: it backs up every changed value, updates only rows still at the backed-up value, raises on a count mismatch or a jsonb leaf-count change, keeps `?v=`, and leaves picsum, other buckets and other hosts alone. It prints a per-column notice and a one-line summary with the run id.
- Preflight counts per driver column the old-host values, rewritable values and old-host values the rewrite cannot convert, plus an old-host scan outside the driver list (admin_audit_log excluded). Any hit means "stop: plan revision".
- Local proof (`/Users/koss/.clickit-checks/p3-exec/p3-sql-test.log`, start 14:39:04Z, `exit=0`, "test-local: PASS"): 8 planted values backed up and rewritten; `?v=` kept; picsum and other-bucket left alone; footer leaf count unchanged; preflight not rewritable = `shows.card_image_url=1`, rewritable 8, nothing outside the driver list; scan after the rewrite = `public.shows.card_image_url=1` only (the auth `workers.dev` value is ignored); reverse made all 67 snapshot rows byte-identical; a second run was reversed through the "single open run" path; two open runs were refused. After the rollback, `to_regclass('private.media_url_rewrite_backup')` was empty, as it was before the run. The heavy lock was released.

## Task Commits

1. **Task 1 (RED): failing lint test**: `893bd18` (test)
2. **Task 1 (GREEN): migration + ops SQL**: `b5c46f9` (feat)
3. **Task 2: heavy-lock wrapper + local proof**: `6e42032` (feat)
4. **Fix: two tests that pinned the newest migration**: `3eb7747` (fix)

## Final gates (detached under the lock, log `/Users/koss/.clickit-checks/p3-exec/p3-05-gates2.log`, exit=0)

- `npm run test:unit`: 2175 pass, 0 fail
- `npm run lint`: 0 errors, 25 warnings, all in files this plan did not touch (they were already there)
- `npm run typecheck`: pass
- `npm run guard:migrations`: 1 file checked, 0 violations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two tests pinned the newest migration**
- **Found during:** final gates
- **Issue:** `youtube-migration.test.ts` and `legal-pages-arabic.test.ts` asserted that `20261021120000_legal_pages_arabic_review.sql` is the newest migration. The new Phase 3 migration sorts after it, so both failed.
- **Fix:** both now allow exactly `20261021143410_media_url_rewrite_backup.sql` after the pinned file.
- **Commit:** `3eb7747`

**2. [Rule 1 - Bug] Grant check would hide grants**
- **Found during:** Task 1
- **Issue:** `information_schema.role_table_grants` only lists grants the current role takes part in, so it can report 0 when anon still has a grant.
- **Fix:** `check-backup-table.sql` reads `pg_class.relacl` through `aclexplode` (grantee 0 = PUBLIC, anon, authenticated). The lint test was changed to match.
- **Commit:** `b5c46f9`

**3. [Rule 2 - Critical] Stricter rewrite matching than the research SQL**
- **Found during:** Task 1
- **Issue:** the research regexes were unanchored, so a URL inside prose or in the middle of a value would also have been rewritten.
- **Fix:** text columns anchor on `^`; jsonb anchors on the opening `"` of a JSON string. Anything else stays as it is and preflight counts it as not rewritable. The rewrite also refuses a missing or retyped driver column before writing anything.
- **Commit:** `b5c46f9`

**4. [Path] Local test log location**
- The plan names `/Users/koss/.clickit-checks/p3-sql-test.log`. The executor rule says all logs go under `/Users/koss/.clickit-checks/p3-exec/`, so the log is `/Users/koss/.clickit-checks/p3-exec/p3-sql-test.log` (the default in `test-local.sh`). Point the plan's verify grep there.

**5. [Additions] Extra coverage in the local proof**
- test-local.sql also runs `check-backup-table.sql` and `report.sql`, reverses a second run through the "single open run" path, and checks that two open runs are refused. It inserts one fake backup row to do that (rolled back). test-local.sh records the backup-table state before and after the run, so the check still works after a local `migration up`.

## Notes for the runbook (03-06) and the live run

- The `set_updated_at` triggers on `app_config`, `shows`, `profiles` and `shorts` will set `updated_at` to the time of the run, both on the rewrite and on any reverse. The reverse restores the media values exactly, but not `updated_at`. In the local proof the compare is byte-identical because `now()` is the same for the whole transaction.
- Reverse on live in a new session: with one open run, nothing needs setting. To choose a run, first run `select set_config('clickit.rewrite_run_id', '<run id>', false);` in the same session.
- Open item A5 is unchanged: preflight's first read shows whether the CLI login role has `rolbypassrls`. Locally `postgres` has `rolsuper=f, rolbypassrls=t`.
- Local fixtures use the live project's public Storage host string inside SQL run only on the local container. No command touched live.

## Known Stubs

None.

## Threat Flags

None. Every surface is in the plan's threat register: T-03-22 (scanSql lint plus the grep acceptance), T-03-23 (guarded update and count check), T-03-24 (private schema, RLS, grants checked through the ACL), T-03-25 (fixed driver list, `%I`/`%L`), T-03-26 (single DO block), T-03-27 (backup table and a reverse proven byte-identical).

## TDD Gate Compliance

RED `893bd18` (test, 15 of 16 failing), then GREEN `b5c46f9` (feat, 16 of 16 passing). No refactor commit.

## Self-Check: PASSED

- All 11 created files exist; commits 893bd18, b5c46f9, 6e42032, 3eb7747 are in `git log`.
- `grep -liE "\bdelete\b|\bdrop\b|\btruncate\b" scripts/cutover/sql/*.sql supabase/migrations/*_media_url_rewrite_backup.sql` prints nothing.
- `scripts/cutover/with-heavy-lock.sh ./x.log -- true` is refused (exit 64), and `bash -n` passes on both scripts.
- `/Users/koss/.clickit-heavy.lock` is gone after each run.
