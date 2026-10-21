-- M1a (05-09): public.admins, am_i_admin(), list_admins().
-- Threats T-05-09-01, T-05-09-02, T-05-09-07. Writes are rolled back at the end.

-- M1a copied nothing from app_config (D-16), although app_config pointed at an account.
do $$
begin
  if (select admin_user_id from public.app_config where id = 1) is null then
    raise exception 'FAIL fixture ran: app_config.admin_user_id is null (pre_phase5_app_config did not run before M1a)';
  end if;
  if (select count(*) from public.admins) <> 0 then
    raise exception 'FAIL admins empty after M1: % rows', (select count(*) from public.admins);
  end if;
end $$;

-- RLS on, no policies, no grants for browser roles.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.admins'::regclass) then
    raise exception 'FAIL admins RLS on: row level security is off';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admins') then
    raise exception 'FAIL admins has no policies: a policy exists';
  end if;
  if has_table_privilege('anon', 'public.admins', 'select')
     or has_table_privilege('authenticated', 'public.admins', 'select')
     or has_table_privilege('authenticated', 'public.admins', 'insert') then
    raise exception 'FAIL admins privileges: anon or authenticated holds a table privilege';
  end if;
  if not has_table_privilege('service_role', 'public.admins', 'select') then
    raise exception 'FAIL admins service_role: no select';
  end if;
end $$;

-- Two test users: a member and a non-member.
do $$
declare
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (v_member, 'm1a-member@clickit.local', 'authenticated', 'authenticated', now(), now()),
         (v_other, 'm1a-other@clickit.local', 'authenticated', 'authenticated', now(), now());
  insert into public.admins (user_id, display_name) values (v_member, 'Member Fixture');
  perform set_config('m1a.member', v_member::text, true);
  perform set_config('m1a.other', v_other::text, true);
end $$;

-- anon: reading admins is denied.
do $$
begin
  set local role anon;
  begin
    perform 1 from public.admins;
    reset role;
    raise exception 'FAIL anon admins denied: select succeeded';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;

-- authenticated: reading admins is denied.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.member'), 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.admins;
    reset role;
    raise exception 'FAIL authenticated admins denied: select succeeded';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;

-- am_i_admin(): true for a member, false for a non-member, not callable by anon.
do $$
declare v boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.member'), 'role', 'authenticated')::text, true);
  v := public.am_i_admin();
  reset role;
  if v is distinct from true then
    raise exception 'FAIL am_i_admin member: got %', v;
  end if;
end $$;

do $$
declare v boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.other'), 'role', 'authenticated')::text, true);
  v := public.am_i_admin();
  reset role;
  if v is distinct from false then
    raise exception 'FAIL am_i_admin non-member: got %', v;
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.am_i_admin()', 'execute') then
    raise exception 'FAIL am_i_admin anon: anon can execute';
  end if;
end $$;

-- list_admins(): denied for authenticated (and anon).
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.member'), 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.list_admins();
    reset role;
    raise exception 'FAIL list_admins authenticated denied: call succeeded';
  exception when insufficient_privilege then
    reset role;
  end;
  if has_function_privilege('anon', 'public.list_admins()', 'execute') then
    raise exception 'FAIL list_admins anon: anon can execute';
  end if;
end $$;

-- list_admins() as service_role: has_totp false without a verified TOTP factor.
do $$
declare r record;
begin
  set local role service_role;
  select * into r from public.list_admins() where user_id = current_setting('m1a.member')::uuid;
  reset role;
  if r.user_id is null then
    raise exception 'FAIL list_admins service_role: member missing';
  end if;
  if r.display_name <> 'Member Fixture' or r.email <> 'm1a-member@clickit.local' then
    raise exception 'FAIL list_admins columns: % %', r.display_name, r.email;
  end if;
  if r.has_totp is distinct from false then
    raise exception 'FAIL list_admins has_totp without factor: got %', r.has_totp;
  end if;
end $$;

-- An unverified TOTP factor does not count.
do $$
declare r record;
begin
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), current_setting('m1a.member')::uuid, 'm1a-unverified', 'totp', 'unverified', now(), now());
  set local role service_role;
  select * into r from public.list_admins() where user_id = current_setting('m1a.member')::uuid;
  reset role;
  if r.has_totp is distinct from false then
    raise exception 'FAIL list_admins has_totp unverified: got %', r.has_totp;
  end if;
end $$;

-- A verified TOTP factor flips has_totp to true.
do $$
declare r record;
begin
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), current_setting('m1a.member')::uuid, 'm1a-verified', 'totp', 'verified', now(), now());
  set local role service_role;
  select * into r from public.list_admins() where user_id = current_setting('m1a.member')::uuid;
  reset role;
  if r.has_totp is distinct from true then
    raise exception 'FAIL list_admins has_totp verified: got %', r.has_totp;
  end if;
end $$;

-- The non-member is not listed.
do $$
begin
  set local role service_role;
  if exists (select 1 from public.list_admins() where user_id = current_setting('m1a.other')::uuid) then
    reset role;
    raise exception 'FAIL list_admins non-member listed';
  end if;
  reset role;
end $$;

rollback;
