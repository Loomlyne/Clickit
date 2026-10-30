-- M1a (05-09): profile columns, backfill, and the system-column guard.
-- Threats T-05-09-03, T-05-09-04. Writes are rolled back at the end.

-- Every auth user has a profile after the backfill (the fixture left one without).
do $$
declare n bigint;
begin
  select count(*) into n
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
  if n <> 0 then
    raise exception 'FAIL every auth user has a profile: % missing', n;
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where u.email = 'noprofile-fixture@clickit.local'
  ) then
    raise exception 'FAIL backfill created the missing profile';
  end if;
end $$;

-- Existing people: welcome_sent_at set, password_set_at = account creation.
do $$
declare n bigint;
begin
  select count(*) into n
  from public.profiles p join auth.users u on u.id = p.id
  where p.welcome_sent_at is null
     or p.password_set_at is null
     or p.password_set_at <> u.created_at;
  if n <> 0 then
    raise exception 'FAIL existing profiles backfilled: % rows without welcome_sent_at / password_set_at = created_at', n;
  end if;
end $$;

-- onboarded_at set only for profiles that already had a display name.
do $$
begin
  if exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where u.email = 'named-fixture@clickit.local' and p.onboarded_at is null
  ) then
    raise exception 'FAIL onboarded_at backfill: named profile not onboarded';
  end if;
  if exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where u.email = 'noprofile-fixture@clickit.local' and p.onboarded_at is not null
  ) then
    raise exception 'FAIL onboarded_at backfill: unnamed profile marked onboarded';
  end if;
end $$;

-- Columns and defaults: a new profile gets notify_new_episodes = true, nulls elsewhere.
do $$
declare
  v_user uuid := gen_random_uuid();
  r public.profiles%rowtype;
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (v_user, 'm1a-profile@clickit.local', 'authenticated', 'authenticated', now(), now());
  select * into r from public.profiles where id = v_user;
  if r.id is null then
    raise exception 'FAIL new profile: handle_new_user did not create it';
  end if;
  if r.notify_new_episodes is distinct from true then
    raise exception 'FAIL notify_new_episodes default true: got %', r.notify_new_episodes;
  end if;
  if r.welcome_sent_at is not null or r.password_set_at is not null or r.onboarded_at is not null or r.locale is not null then
    raise exception 'FAIL new profile system columns start null';
  end if;
  perform set_config('m1a.user', v_user::text, true);
end $$;

-- locale accepts en/ar only.
do $$
begin
  begin
    update public.profiles set locale = 'fr' where id = current_setting('m1a.user')::uuid;
    raise exception 'FAIL profiles locale check: fr accepted';
  exception when check_violation then
    null;
  end;
end $$;

-- Server path (service role / definer) can set the system columns.
do $$
begin
  set local role service_role;
  update public.profiles
  set welcome_sent_at = now() - interval '1 day', password_set_at = now() - interval '2 days'
  where id = current_setting('m1a.user')::uuid;
  reset role;
  if (select welcome_sent_at from public.profiles where id = current_setting('m1a.user')::uuid) is null then
    raise exception 'FAIL service_role can set welcome_sent_at';
  end if;
end $$;

-- As the signed-in user: system columns stay, display_name still updates.
do $$
declare
  v_before record;
  v_after record;
  v_count integer;
begin
  select welcome_sent_at, password_set_at into v_before
  from public.profiles where id = current_setting('m1a.user')::uuid;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.user'), 'role', 'authenticated')::text, true);
  update public.profiles
  set welcome_sent_at = null, password_set_at = null, display_name = 'Changed By User'
  where id = current_setting('m1a.user')::uuid;
  get diagnostics v_count = row_count;
  reset role;

  if v_count <> 1 then
    raise exception 'FAIL own-row update policy: % rows updated', v_count;
  end if;
  select welcome_sent_at, password_set_at, display_name into v_after
  from public.profiles where id = current_setting('m1a.user')::uuid;
  if v_after.welcome_sent_at is distinct from v_before.welcome_sent_at
     or v_after.password_set_at is distinct from v_before.password_set_at then
    raise exception 'FAIL user cannot change system columns: welcome % -> %, password % -> %',
      v_before.welcome_sent_at, v_after.welcome_sent_at, v_before.password_set_at, v_after.password_set_at;
  end if;
  if v_after.display_name is distinct from 'Changed By User' then
    raise exception 'FAIL user can still update display_name: got %', v_after.display_name;
  end if;
end $$;

-- The user can still change their own notify_new_episodes and locale.
do $$
declare v_count integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m1a.user'), 'role', 'authenticated')::text, true);
  update public.profiles set notify_new_episodes = false, locale = 'ar'
  where id = current_setting('m1a.user')::uuid;
  get diagnostics v_count = row_count;
  reset role;
  if v_count <> 1 or (select notify_new_episodes from public.profiles where id = current_setting('m1a.user')::uuid) then
    raise exception 'FAIL user can switch notify_new_episodes';
  end if;
end $$;

rollback;
