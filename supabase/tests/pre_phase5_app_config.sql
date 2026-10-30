-- Fixture applied by scripts/db-proof.sh just before the first _phase5_
-- migration. It reproduces the pre-Phase-5 shape that M1a must handle:
--   * app_config.admin_user_id points at an account (on live: a test account,
--     D-16), so m1a_admins can prove M1a copies nothing into public.admins;
--   * one auth user has no profile row (live: 3 auth users, 2 profiles), so
--     m1a_profiles can prove the backfill creates it.
-- Persists on purpose (no rollback): M1a and the m1a_* tests read these rows.
-- Test addresses only (@clickit.local); ids come from gen_random_uuid().

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_orphan uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (v_admin, 'admin-fixture@clickit.local', 'authenticated', 'authenticated',
          now() - interval '40 days', now() - interval '40 days');

  insert into public.app_config (id, admin_user_id)
  values (1, v_admin)
  on conflict (id) do update set admin_user_id = excluded.admin_user_id;

  -- An existing account that never got a profile row.
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (v_orphan, 'noprofile-fixture@clickit.local', 'authenticated', 'authenticated',
          now() - interval '20 days', now() - interval '20 days');
  delete from public.profiles where id = v_orphan;

  -- An existing account with a display name (onboarded before Phase 5).
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (gen_random_uuid(), 'named-fixture@clickit.local', 'authenticated', 'authenticated',
          now() - interval '10 days', now() - interval '10 days');
  update public.profiles p set display_name = 'Named Fixture'
  from auth.users u
  where u.id = p.id and u.email = 'named-fixture@clickit.local';

  if (select admin_user_id from public.app_config where id = 1) is distinct from v_admin then
    raise exception 'FAIL pre fixture: app_config.admin_user_id not set';
  end if;
  if exists (select 1 from public.profiles where id = v_orphan) then
    raise exception 'FAIL pre fixture: orphan account still has a profile';
  end if;
end $$;
