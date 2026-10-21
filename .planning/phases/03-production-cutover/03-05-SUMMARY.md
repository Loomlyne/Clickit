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
  - "scripts/cutover/sql/reverse-media-urls.sql: UPDATE-only restore of one run (setting or single open run), restored_at set; strict by default (refuses and lists values changed since the rewrite)"
  - "scripts/cutover/sql/reverse-media-urls-partial.sql: same DO block in partial mode (restores the rest, marks changed values reverse_skipped_at / reverse_skip_reason)"
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
  - "Reverse raises when the chosen run has nothing left to restore. Strict (default) refuses the whole run and lists every value changed since the rewrite; partial (separate file, Koss's word) restores the rest and marks the changed values skipped (PR #31 review finding 1)"
  - "updated_at: the rewrite and the reverse pause the four updated_at triggers with alter table ... disable trigger inside their own DO block (pattern of 20261021120000); not session_replication_role, not a stored-and-restored updated_at (PR #31 review finding 2, reasons below)"
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
- Local proof (`/Users/koss/.clickit-checks/p3-exec/p3-sql-test.log`, start 14:39:04Z, `exit=0`, "test-local: PASS"): 8 planted values backed up and rewritten; `?v=` kept; picsum and other-bucket left alone; footer leaf count unchanged; preflight not rewritable = `shows.card_image_url=1`, rewritable 8, nothing outside the driver list; scan after the rewrite = `public.shows.card_image_url=1` only (the auth `workers.dev` value is ignored); reverse made the media values of all 67 snapshot rows byte-identical (that first proof could not see `updated_at`: see "PR #31 review fixes"); a second run was reversed through the "single open run" path; two open runs were refused. After the rollback, `to_regclass('private.media_url_rewrite_backup')` was empty, as it was before the run. The heavy lock was released.

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

**0. [Follow-up fix, coordinator 2026-10-21] clickit-media-r2 test host**
- **Found after:** main merged into the branch (1d11529, PR #30). The workers.dev app now uses a second media Worker host, `clickit-media-r2.<sub>.workers.dev` (02-RUNBOOK Steps 28-32b, deploy-guard MEDIA_HOST `^clickit-media(?:-r2)?\.`). The scan pattern `clickit-media\.[a-z0-9-]+\.workers\.dev` did not match that host, so a row left on it would have been missed and the read-back would wrongly have shown zero.
- **Fix:** the scan, preflight and report pattern is now `supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev`. Rewrite and preflight also map `https://clickit-media-r2\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/` to `https://media.clickitstory.ae/<bucket>/`, with the same anchoring and `?v=` kept. Other subdomains of either name still count as not rewritable. test-local.sql adds a rewritable clickit-media-r2 value (show A hero_video_url) and a not-rewritable one on another subdomain (show B logo_url). The planted rewritable count goes from 8 to 9, and not rewritable is now shows.card_image_url plus shows.logo_url. Local re-run: `/Users/koss/.clickit-checks/p3-exec/p3-sql-test-r2.log`, PASS, exit=0. The D-09 sources sentence in 03-CONTEXT.md names the host.

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
- **Fix:** text columns anchor on `^`; jsonb anchors on the opening `"` of a JSON string (three host regexes since fix 0). Anything else stays as it is and preflight counts it as not rewritable. The rewrite also refuses a missing or retyped driver column before writing anything.
- **Commit:** `b5c46f9`

**4. [Path] Local test log location**
- The plan names `/Users/koss/.clickit-checks/p3-sql-test.log`. The executor rule says all logs go under `/Users/koss/.clickit-checks/p3-exec/`, so the log is `/Users/koss/.clickit-checks/p3-exec/p3-sql-test.log` (the default in `test-local.sh`). Point the plan's verify grep there.

**5. [Additions] Extra coverage in the local proof**
- test-local.sql also runs `check-backup-table.sql` and `report.sql`, reverses a second run through the "single open run" path, and checks that two open runs are refused. It inserts one fake backup row to do that (rolled back). test-local.sh records the backup-table state before and after the run, so the check still works after a local `migration up`.

## Notes for the runbook (03-06) and the live run

- ~~The `set_updated_at` triggers will set `updated_at` on the rewrite and on any reverse; the local compare was byte-identical only because `now()` is constant in one transaction.~~ Superseded by the PR #31 review fixes below: the rewrite and the reverse no longer move `updated_at`, and the local proof now sees `updated_at` drift.
- Reverse on live in a new session: with one open run, nothing needs setting. To choose a run, first run `select set_config('clickit.rewrite_run_id', '<run id>', false);` in the same session.
- Open item A5 is unchanged: preflight's first read shows whether the CLI login role has `rolbypassrls`. Locally `postgres` has `rolsuper=f, rolbypassrls=t`.
- Local fixtures use the live project's public Storage host string inside SQL run only on the local container. No command touched live.

## PR #31 review fixes (findings 1, 2, 6, 7; 2026-10-21)

**1. Reverse was all-or-nothing.** `reverse-media-urls.sql` is now the strict mode (default): it walks the whole run, and if any value no longer holds the rewritten value (an admin edited it, or the row is gone) it raises one error that lists every such value (`<table>.<column> id=<id>: value changed since the rewrite` / `row missing`) and restores nothing. `reverse-media-urls-partial.sql` carries the same DO block with `clickit.reverse_mode = partial` (a separate file because the live path is `supabase db query -f <file>`, where a psql variable does not exist; a unit test keeps the two DO blocks equal): it restores every untouched value, leaves the changed ones as the admin left them, keeps their `restored_at` empty and sets `reverse_skipped_at` / `reverse_skip_reason` (two new nullable columns in `20261021143410`, which is not on live yet). `report.sql` shows `skipped` per column and lists the skipped rows; `check-backup-table.sql` counts `skipped_rows`. The rewrite already raised on a concurrent edit (backed-up count vs updated count); the local proof now tests it.

**2. `updated_at` (choice and reasons).** The rewrite and the reverse each pause the four `updated_at` triggers (`app_config`, `shows`, `profiles`: `set_updated_at`; `shorts`: `shorts_updated_at`; `show_cast` has none) with `alter table public.<t> disable trigger <name>` at the start of their DO block and `enable` it again at the end, the pattern `20261021120000` uses (it pauses `legal_pages.set_updated_at` with the same statement, inside one explicit transaction). Why this one:
- Storing the old `updated_at` in the backup row and writing it back does not work alone: the triggers are `BEFORE UPDATE` and set `new.updated_at = now()` unconditionally, so any UPDATE that writes the old value back is overwritten. It would need the same pause anyway.
- `set local session_replication_role = replica` needs superuser (or a granted SET on that parameter); the local `postgres` role is `rolsuper = f`, and Supabase's hosted `postgres` role is not a superuser either (not read on live by this session). It would also silence every trigger and foreign-key check on every table, not just these four.
- `alter table ... disable trigger` needs the role to own the tables (local: `postgres` owns all five driver tables; live: not read by this session, preflight `[role]` `driver_owner` shows it at Step 47). It is transactional: inside the single DO block it is never left disabled (an error rolls it back with everything else) and only this transaction sees the pause. It takes a SHARE ROW EXCLUSIVE lock on the four tables until commit: reads go on, admin writes wait for the seconds the block runs; `lock_timeout` is 10s so a lock held by someone else makes the block raise instead of queueing the app's writes behind it. Each trigger must exist and be enabled ('O') or the block raises, so it never switches on a trigger that was off.
- Preflight (finding 6) shows ownership and the trigger list before the run (runbook Step 47 requires both).

What a reverse restores, exactly: every backed-up media value goes back to its exact old value (the whole jsonb document for `footer_content`); `updated_at` is untouched by the rewrite and by the reverse; so a row nobody edited since the rewrite is byte-identical to before the rewrite. A row an admin edited in another column keeps that edit and its `updated_at`. A value an admin changed is refused (strict) or kept and listed (partial).

Note for the controller: runbook rule 9 says DDL goes only through `apply-live-migrations.yml`. The pause is an `alter table` statement in an ops file, net zero inside one transaction, no schema change survives it; rule 9 now names it. If that exception is not acceptable, the alternative is a reviewed migration that teaches `update_updated_at()` / `update_shorts_updated_at()` to skip when a transaction-local setting is on; not done here.

**6. Preflight privileges.** `preflight.sql` adds a `[role]` row (USAGE on `private`, SELECT/INSERT/UPDATE on `private.media_url_rewrite_backup`, RLS bypass or owner of it, SELECT/UPDATE and ownership of every driver table, verdict `ok` or `stop: role cannot run the rewrite`) and a `[triggers]` list (exactly the four `updated_at` triggers, enabled). Step 47 Expected requires both.

**7. `test-local.sh` and `gate:local`.** Not added to `gate:local`: `gate:local` already runs under the heavy lock and `test-local.sh` takes it too (nested lock = wait for ever), and it needs Docker and the local stack. It is a numbered controller pre-Ship step in `03-GATES.md` section 10 and in the hand-over.

**Local proof** (`/Users/koss/.clickit-checks/p3-exec/p3-sql-test-pr31.log`, start 2026-10-21T15:27:15Z, `exit=0`, `test-local: PASS`): every row with an `updated_at` trigger is set to `2001-02-03 04:05:06+00` before the snapshot, so a firing trigger would show. After the rewrite only the media columns differ and `updated_at` is unchanged; after the strict reverse all 67 rows are byte-identical including `updated_at`; the four triggers are enabled after every run; a concurrent edit (test-only trigger on the backup table, inside a savepoint) makes the rewrite raise `rewrite mismatch on shows.poster_url: backed up 1, updated 0` and write nothing; after an admin edit the strict reverse refuses, lists `shows.poster_url id=…: value changed since the rewrite` and restores nothing; the partial reverse restores 8, skips 1, keeps the admin value and its `updated_at`, and leaves every other row byte-identical. RED first: `p3-sql-test-pr31-red1.log` (preflight markers missing, exit=3), `p3-sql-test-pr31-red2.log` (old reverse: `2 row(s) differ from the snapshot after reverse`, the `updated_at` drift, exit=3). The local stack holds every migration of this branch except `20261021143410`, which the proof applies inside its own rolled-back transaction from the branch file (so the edited version is what was tested); after the run the backup table is absent again and the four triggers are enabled.

## Known Stubs

None.

## Threat Flags

None. Every surface is in the plan's threat register: T-03-22 (scanSql lint plus the grep acceptance), T-03-23 (guarded update and count check), T-03-24 (private schema, RLS, grants checked through the ACL), T-03-25 (fixed driver list, `%I`/`%L`), T-03-26 (single DO block), T-03-27 (backup table and a reverse proven locally: every media value restored exactly, `updated_at` untouched, so a row nobody edited is byte-identical; a value an admin changed is refused (strict) or skipped and listed (partial)).

## TDD Gate Compliance

RED `893bd18` (test, 15 of 16 failing), then GREEN `b5c46f9` (feat, 16 of 16 passing). No refactor commit.

## Self-Check: PASSED

- All 11 created files exist; commits 893bd18, b5c46f9, 6e42032, 3eb7747 are in `git log`.
- `grep -liE "\bdelete\b|\bdrop\b|\btruncate\b" scripts/cutover/sql/*.sql supabase/migrations/*_media_url_rewrite_backup.sql` prints nothing.
- `scripts/cutover/with-heavy-lock.sh ./x.log -- true` is refused (exit 64), and `bash -n` passes on both scripts.
- `/Users/koss/.clickit-heavy.lock` is gone after each run.
