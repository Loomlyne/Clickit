-- MEDIA-08 / D-11 read-back (read-only), after apply-live-migrations.yml put
-- the backup-table migration on live (runbook Step 12) and again before the
-- rewrite. Expect: table_exists true, rls_on true, anon and authenticated
-- cannot select, api_role_grants 0. The row count is 0 before the first run.

select
  to_regclass('private.media_url_rewrite_backup') is not null as table_exists,
  (select c.relrowsecurity from pg_class c
    where c.oid = to_regclass('private.media_url_rewrite_backup')) as rls_on,
  has_table_privilege('anon', 'private.media_url_rewrite_backup', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'private.media_url_rewrite_backup', 'select') as authenticated_can_select,
  -- grants read from the ACL itself (information_schema.role_table_grants
  -- hides grants the current role is not part of); grantee 0 = PUBLIC.
  (select count(*) from pg_class c, aclexplode(c.relacl) a
    where c.oid = to_regclass('private.media_url_rewrite_backup')
      and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) as api_role_grants;

select count(*) as backup_rows,
  count(*) filter (where restored_at is null) as open_rows,
  count(distinct run_id) as runs
from private.media_url_rewrite_backup;
