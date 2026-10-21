---
phase: 06-youtube-import-and-player
plan: 00
subsystem: infra
tags: [gate, migrations, upstream-check, github-actions]
requires: []
provides:
  - "Proof that Phase 1 / 1.1 modules are on the branch"
  - "Proof that no workflow can apply a migration on push"
  - "Phase 2-5 presence list and migration-guard waiver syntax"
affects: [06-01, 06-23, 06-21, 06-24]
key-files:
  created: []
  modified: []
decisions:
  - "Phase 6 proceeds against main as it is today (G8); Phase 2-5 modules are stood in for with TODO(phase-N) markers"
metrics:
  tasks: 2
  files: 0
  completed: 2026-10-20
---

# Phase 6 Plan 00: Wave 0 gate Summary

Branch already contains origin/main (c0da1d8); Phase 1 and 1.1 modules are present; no workflow can apply a migration from a push; Phases 2-5 are absent and recorded, not blocking.

## Task 1: Merge and upstream check

- `git fetch origin main` then `git merge --no-edit origin/main`: "Already up to date". `git merge-base --is-ancestor origin/main HEAD` passes (origin/main = c0da1d8). No merge commit was needed, so no file changed.
- Task 1 verify command printed nothing: all 14 listed paths exist (action-runner, compensation, counts, schemas, ports, episode-lifecycle, season-episode-writes, show-schedule, audit, fake-supabase, reorder-episode-emulator, migration-guard.mjs, apply-live-migrations.yml, publish-scheduled route).
- Symbols found: `export async function logAuditStrict` (src/lib/audit.ts), `reorderEpisodeCore` (episode-lifecycle.ts), `planShowScheduleCore` (show-schedule.ts), `registerRpc` (fake-supabase.ts), `async function assertAdmin` (src/app/[locale]/admin/actions.ts).

### Phase 2 modules (recorded, G8)

- ABSENT `src/server/cloudflare.ts`
- ABSENT `src/server/scheduled.ts`
- ABSENT `src/server/cron-schedule.ts`
- ABSENT `src/server/cron-auth.ts`
- ABSENT `src/server/rate-limit-policy.ts`
- ABSENT `wrangler.jsonc` (so no Worker `name` or `triggers.crons` to record)
- ABSENT `custom-worker.ts`

### Phase 5 modules (recorded, G8)

- ABSENT `requireAdmin` anywhere under `src/`
- ABSENT `admins` table in `supabase/migrations` (the only "admins" hits are words in comments of 20260605000000 and 20260605000001; no `create table ... admins`)

All seven TODO(phase-N) hand-offs listed in the plan stay in force: Phase 6 code uses the stand-ins and carries the literal markers.

### Admin mechanism on main (for the 06-20 UAT login)

- `assertAdmin` (actions.ts ~line 185-189) selects `app_config.admin_user_id` (row id = 1) and throws `Unauthorized` when it differs from the signed-in user id (Phase 1.1).
- No admins table and no TOTP yet.
- `supabase/seed.sql` seeds no admin (no admin match in the file).

## Task 2: Migrations never apply on push

Verify command (all `.github/workflows/*.yml|*.yaml`, push trigger AND `supabase db push` / `migration up` / `psql`) printed nothing; `safe-drop` guard found; exit 0. Workflows present: `apply-live-migrations.yml`, `pr-gate.yml`. `supabase-migrations.yml` is gone.

Lines that gate the live apply (`.github/workflows/apply-live-migrations.yml`):

- L41-42: `on:` / `workflow_dispatch:` with a required boolean input `pg_dump_taken` ("Local pg_dump of live taken on the Mac before this run (D-03)"). No push trigger.
- `dry-run` job (L58-62): `environment: live-db-plan`; step "Main only" fails unless `GITHUB_REF` is `refs/heads/main`; runs `supabase db push --dry-run --db-url "$SUPABASE_DB_URL"` and writes nothing.
- `apply` job (L117-123): `needs: dry-run`, `if: needs.dry-run.outputs.pending == 'true'`, `environment: live-db`; step "live-db must require a reviewer" (L139) checks the environment protection rules; "Backup confirmed" (L162); "Apply" (L179-180) runs `supabase db push --db-url "$SUPABASE_DB_URL" --yes`.

Note on the plan wording "PR dry-run job": on main the SQL dry-run is the `dry-run` job inside the manual `apply-live-migrations.yml`. The per-PR check is `migration-guard` in `pr-gate.yml` (`on: pull_request`, branches [main], L26-29), which runs the destructive-SQL guard using the BASE branch copy of `scripts/migration-guard.mjs`. Plans 06-21 and 06-24 use `apply-live-migrations.yml` (manual dispatch plus environment approval); only the controller or Koss can start it.

### Waiver syntax for 06-23 (`scripts/migration-guard.mjs`)

A comment `-- safe-drop: <reason>` on the SAME line as the destructive statement, with a non-empty reason (regex `^\s*safe-drop:\s*(\S.*)$`, case-insensitive, applied to the comment text). Example from the script header:

```sql
drop policy if exists p on t; -- safe-drop: recreated below
```

Not waived: empty reason, waiver on another line, or text inside a string literal. Rule D-05: a migration already on base is immutable (edit, rename, delete fail). The guard compares only committed changes (`git diff base...head`), so commit before running it locally. 06-23 puts the waiver on the `drop column` line.

## Deviations from Plan

None - plan executed exactly as written. No files were modified, so there are no per-task commits; this SUMMARY is the only commit.

## Known Stubs

None.

## Self-Check: PASSED

- Merge ancestry, verify commands and symbol greps re-run above with no output / expected matches.
