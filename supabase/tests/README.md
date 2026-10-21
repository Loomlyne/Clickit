# supabase/tests

SQL proofs for Phase 5. They run only inside a scratch database, never on the shared
local database and never on live.

## Heavy steps

Every heavy step in Phase 5 (db-proof, gate:local, builds, Playwright, local stack work)
starts with one detached launch line. Both scripts take `/Users/koss/.clickit-heavy.lock`
and end the log with `exit=<rc>`. Read the log's last line to verify. Logs live in
`/Users/koss/.clickit-checks/`, never `/tmp`. macOS has no `setsid` command; never use a bare `setsid`.

```
caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/db-proof.sh > /Users/koss/.clickit-checks/p5-db-proof.log 2>&1 &
caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/heavy-run.sh npm run gate:local > /Users/koss/.clickit-checks/p5-gate.log 2>&1 &
```

`db-proof.sh` options: `--only <glob>` runs only test files whose name (without `.sql`)
matches the glob; `--types-out <path>` writes `supabase gen types` output taken from the
scratch database (prints `types_written=<path|no>`).

## What db-proof.sh does

1. Refuses (`exit=2`) when `supabase_db_Clickit` is not running; prints `other_stacks=`.
2. Creates `p5_proof_<pid>` inside that container, bootstraps auth/storage/extensions
   from a read-only schema dump of the shared database, applies every
   `supabase/migrations/*.sql` and `supabase/seed.sql`.
3. Runs `supabase/tests/0*.sql` and `m*.sql` in name order, each printing `ok <name>`.
4. Applies `supabase/tests/pre_*.sql` fixtures once (data that must exist before the
   Phase 5 migrations run; prints `pre_fixtures=<n>`): just before the first
   `supabase/migrations/*_phase5_*.sql` file, or, when there is none, before
   `supabase/pending/*.sql`. Then applies `supabase/pending/*.sql`
   (prints `pending_applied=<n>`) and runs `supabase/tests/pending_*.sql`.
5. Drops the scratch database, checks the shared database fingerprint
   (`schema_migrations`, `public.shows`, `auth.users` counts) is unchanged, prints
   `scratch_db_left=0`, `shared_db_unchanged=yes` and, last, `exit=<rc>`.

## Assertion convention

- One `do $$ ... $$;` block per behaviour.
- On failure: `raise exception 'FAIL <behaviour>: <detail>';`.
- Simulate a caller inside the file's transaction with `set local role <anon|authenticated|service_role>`
  and `set local request.jwt.claims = '<json>'`; `reset role` afterwards.
- No UUIDs or emails of real people: use `gen_random_uuid()` and `@clickit.local`.
- Each file runs in one transaction (`psql --single-transaction`). A file that writes data
  must undo it (end with `rollback;`) so later files see the seeded state.
- File naming: `0*.sql` and `m*.sql` run against the migrated schema; `pre_*.sql` are
  fixtures applied before the first `_phase5_` migration (they persist, no `rollback;`);
  `pending_*.sql` run after `supabase/pending/*.sql`.
