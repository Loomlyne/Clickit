---
phase: 05-accounts-and-email
plan: 14
subsystem: database
tags: [supabase, rls, aal2, totp, storage-policy, anon-revoke, pending-migration, db-proof]
requires: ["05-09"]
provides: [supabase/pending/m2_admin_aal2.sql, supabase/pending/m3_close_anon_youtube.sql, supabase/pending/README.md, pending_admin_aal2 proof, pending_anon_revoke proof]
affects: [05-17, 05-36, 05-37, 05-41]
tech-stack:
  added: []
  patterns: ["ordering-sensitive migrations staged in supabase/pending and proven by db-proof before they are copied into supabase/migrations"]
key-files:
  created:
    - supabase/pending/README.md
    - supabase/pending/m2_admin_aal2.sql
    - supabase/pending/m3_close_anon_youtube.sql
    - supabase/tests/pending_admin_aal2.sql
    - supabase/tests/pending_anon_revoke.sql
  modified: []
key-decisions:
  - "M2 and M3 live in supabase/pending (no timestamps; m2 sorts before m3); 05-41 copies them byte for byte under new timestamps, 05-37 applies both in one approval"
  - "M3 restates grant select on episodes_view to authenticated, service_role: both already hold SELECT on the local stack (checked 2026-10-21), so nothing is widened"
  - "The old app_config admin with aal2 is an explicit false case: M2 ends the app_config rule for RLS and the site-assets storage policy"
  - "AUTH-05, AUTH-06, AUTH-08 stay Pending: the SQL is written and proven but reaches live only in 05-37"
requirements-completed: []
duration: 5min
completed: 2026-10-21
---

# Phase 5 Plan 14: Pending M2 and M3 Summary

**M2 (`private.is_admin()` = admins row AND `aal2`, inline site-assets storage policy moved onto it) and M3 (anon loses EXECUTE on `get_public_youtube_video_id` and SELECT on `episodes_view`) are written in `supabase/pending/`, outside `supabase/migrations`, and proven in a scratch database: `pending_applied=2`, both truth tables pass, `exit=0`.**

## Performance

- Start: 2026-10-21T14:39Z
- End: 2026-10-21T14:44Z
- Tasks: 2 of 2
- Files: 5 created

## Accomplishments

- `m2_admin_aal2.sql`: `create or replace function private.is_admin()` keeps name, signature, `security definer`, `stable`, `search_path = ''` and the existing grants (CREATE OR REPLACE keeps the ACL); body is `exists (admins row for auth.uid()) and coalesce(auth.jwt()->>'aal','') = 'aal2'`. `Admin manage site-assets` is dropped (same-line `-- safe-drop:` waiver) and recreated `for all to authenticated` with `bucket_id = 'site-assets' and (select private.is_admin())` in both using and with check. No `app_config` reference.
- `m3_close_anon_youtube.sql`: `revoke execute ... from public, anon`; `grant execute ... to authenticated, service_role`; `revoke select on episodes_view from anon`; `grant select on episodes_view to authenticated, service_role` (restates existing grants only).
- `README.md`: purpose, why the CLI and migration guard ignore the folder, db-proof order, `seed:local-admin` (05-17) applying M2 to the local stack only, 05-41 copy rule.
- `pending_admin_aal2.sql`: function shape and grants unchanged (anon/authenticated EXECUTE kept, no PUBLIC); body reads admins + aal2, no app_config; storage policy command/role/bucket and `private.is_admin()` in both expressions; no policy anywhere still reads `admin_user_id`. Truth table, each case both called directly and as `authenticated`, plus a draft show visible only to admins: member+aal2 true; member+aal1, member without aal, member with empty aal, non-member+aal2, old app_config admin+aal2 false; anon and anon with a forged aal2 false. Storage: member+aal2 insert/update/delete on site-assets allowed; member+aal1, non-member+aal2, old app_config admin+aal2 refused on insert (42501) and 0 rows on update/delete.
- `pending_anon_revoke.sql`: privilege checks (anon no EXECUTE, PUBLIC no EXECUTE, authenticated and service_role EXECUTE; anon no SELECT on the view, authenticated and service_role SELECT, no write privilege for browser roles); anon select on the view and the function call both raise permission denied; anon still reads the public episode columns (M3 touches nothing else); authenticated reads the view and gets a YouTube id; service_role reads the view with YouTube ids and calls the function (A8, catalog client path).

## Task Commits

1. Task 1: pending M2, M3 and README: `06c37d3`
2. Task 2: truth-table proofs: `40ee1ad`

## Verification

- Task 1 verify command: PASS. `ls supabase/migrations` has no m2/m3 file; newest migration is still M1a `20261021142458_phase5_m1a_accounts.sql` (05-13's M1b does not exist yet).
- Migration guard run against the pending folder (`--dir supabase/pending`): no drop/delete/truncate violation; only "bad migration file name" for the three files, expected because they carry no timestamp until 05-41.
- Detached proof `/Users/koss/.clickit-checks/p5-db-proof.log`: `pre_fixtures=1`, `ok 00_smoke`, `ok m1a_admins`, `ok m1a_episodes_newsletter`, `ok m1a_profiles`, `pending_applied=2`, `ok pending_admin_aal2`, `ok pending_anon_revoke`, `scratch_db_left=0`, `shared_db_unchanged=yes`, `lock_released=1`, `exit=0`. Task 2 verify command: PASS.
- Negative runs (working copy only, restored with `git checkout --`, `git diff supabase/pending` empty afterwards): M2 with the aal check bypassed (`or true`) gave `FAIL is_admin member+aal1: direct t as authenticated t expected f`, `exit=1` (`p5-db-proof-neg-m2.log`); M3 without the anon view revoke gave `FAIL anon view select revoked: anon still has SELECT`, `exit=1` (`p5-db-proof-neg-m3.log`). Both runs: shared DB unchanged, scratch DB dropped, lock released.
- Bootstrap lines `ERROR: schema "private" does not exist` / `relation "public.app_config" does not exist` come from the read-only schema dump of the shared DB referencing objects the scratch DB creates later in migrations; they were there before this plan and do not affect the result.

## Not verified

- Live grants and policy definitions: the proof uses the migrations replayed in a scratch DB, not the live schema. 05-37's dry-run read covers live.
- `npm run seed:local-admin` applying M2 to the local stack: that script belongs to 05-17.

## Deviations from Plan

None in scope. Extra cases inside the planned tests (Rule 2, test coverage): the old app_config admin with aal2 must be false (proves M2 ends the app_config rule for the live test account), an empty `aal` claim and an anon token with a forged `aal2` are false, storage update/delete are covered beside insert, and M3 is checked not to remove anon's existing base-table read.

## Known Stubs

None.

## Threat Flags

None. T-05-14-01 and T-05-14-02 mitigated and proven; T-05-14-03 mitigated by keeping both files out of `supabase/migrations`.

## Self-Check: PASSED

- FOUND: supabase/pending/README.md, supabase/pending/m2_admin_aal2.sql, supabase/pending/m3_close_anon_youtube.sql, supabase/tests/pending_admin_aal2.sql, supabase/tests/pending_anon_revoke.sql
- FOUND: 06c37d3, 40ee1ad
