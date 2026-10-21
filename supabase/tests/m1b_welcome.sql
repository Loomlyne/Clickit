-- M1b (05-13): claim_welcome (D-30, Pitfall 7). Threat T-05-13-03.
-- Writes are rolled back at the end.
--
-- Concurrency: dblink is not installed in the scratch database (checked below), so two
-- concurrent sessions cannot be opened from this file. Concurrency proven by the
-- conditional update: claim_welcome updates profiles ... where welcome_sent_at is null;
-- a second concurrent caller blocks on the row lock, re-checks the condition after the
-- first commits (READ COMMITTED), updates nothing and returns null. The unique
-- idempotency_key 'welcome:<user>' is the second line of defence. Both are asserted below.

-- Structural guard for the concurrency argument above.
do $$
declare v_src text;
begin
  select p.prosrc into v_src from pg_proc p where p.oid = 'public.claim_welcome(uuid,text)'::regprocedure;
  if v_src !~ 'welcome_sent_at is null' then
    raise exception 'FAIL claim_welcome conditional update: body has no "welcome_sent_at is null" condition';
  end if;
  if v_src !~ 'on conflict \(idempotency_key\) do nothing' then
    raise exception 'FAIL claim_welcome unique key: body has no on conflict (idempotency_key)';
  end if;
  if exists (select 1 from pg_extension where extname = 'dblink') then
    raise notice 'dblink present: concurrency still proven by the conditional update (rows here are uncommitted)';
  end if;
end $$;

-- A new user (profile created by the signup trigger, welcome_sent_at null):
-- two sequential claims return one id then null; one outbox row.
do $$
declare
  v_user uuid := gen_random_uuid();
  v_first uuid;
  v_second uuid;
  r record;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
  values (v_user, 'm1b-welcome-new@clickit.local', 'authenticated', 'authenticated', now(), now(), now());
  if (select welcome_sent_at from public.profiles where id = v_user) is not null then
    raise exception 'FAIL setup: new user already has welcome_sent_at';
  end if;

  -- The real caller is the service role.
  set local role service_role;
  v_first := public.claim_welcome(v_user, 'ar');
  v_second := public.claim_welcome(v_user, 'ar');
  reset role;

  if v_first is null then
    raise exception 'FAIL claim_welcome first call: null';
  end if;
  if v_second is not null then
    raise exception 'FAIL claim_welcome second call: %', v_second;
  end if;
  if (select count(*) from public.email_outbox where to_user = v_user and kind = 'welcome') <> 1 then
    raise exception 'FAIL claim_welcome one row: % rows',
      (select count(*) from public.email_outbox where to_user = v_user and kind = 'welcome');
  end if;
  select * into r from public.email_outbox where id = v_first;
  if r.idempotency_key <> 'welcome:' || v_user or r.status <> 'pending' or r.locale <> 'ar'
     or r.to_email is not null or r.payload <> '{}'::jsonb then
    raise exception 'FAIL claim_welcome row shape: key % status % locale %', r.idempotency_key, r.status, r.locale;
  end if;
  if (select welcome_sent_at from public.profiles where id = v_user) is null then
    raise exception 'FAIL claim_welcome sets welcome_sent_at';
  end if;
end $$;

-- A user without a profile row gets the profile first, then exactly one welcome.
do $$
declare
  v_user uuid := gen_random_uuid();
  v_id uuid;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
  values (v_user, 'm1b-welcome-noprofile@clickit.local', 'authenticated', 'authenticated', now(), now(), now());
  delete from public.profiles where id = v_user;

  v_id := public.claim_welcome(v_user, 'fr');
  if v_id is null then
    raise exception 'FAIL claim_welcome missing profile: null';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and welcome_sent_at is not null) then
    raise exception 'FAIL claim_welcome creates the profile';
  end if;
  if (select locale from public.email_outbox where id = v_id) <> 'en' then
    raise exception 'FAIL claim_welcome unknown locale falls back to en';
  end if;
  if public.claim_welcome(v_user, 'en') is not null then
    raise exception 'FAIL claim_welcome missing profile second call';
  end if;
  if (select count(*) from public.email_outbox where to_user = v_user) <> 1 then
    raise exception 'FAIL claim_welcome missing profile one row';
  end if;
end $$;

-- A backfilled user (M1a set welcome_sent_at for every existing profile) gets none.
do $$
declare
  v_user uuid;
begin
  select u.id into v_user from auth.users u where u.email = 'named-fixture@clickit.local';
  if v_user is null then
    raise exception 'FAIL setup: fixture user missing';
  end if;
  if (select welcome_sent_at from public.profiles where id = v_user) is null then
    raise exception 'FAIL setup: fixture user not backfilled';
  end if;
  if public.claim_welcome(v_user, 'en') is not null then
    raise exception 'FAIL claim_welcome backfilled user: got an id';
  end if;
  if exists (select 1 from public.email_outbox where to_user = v_user) then
    raise exception 'FAIL claim_welcome backfilled user: outbox row exists';
  end if;
end $$;

-- Every pre-Phase-5 account (fixtures) is backfilled: no claim succeeds for any of them.
do $$
declare n bigint;
begin
  select count(*) into n
  from auth.users u
  where u.email like '%-fixture@clickit.local'
    and public.claim_welcome(u.id, 'en') is not null;
  if n <> 0 then
    raise exception 'FAIL claim_welcome existing accounts: % claimed', n;
  end if;
end $$;

-- A null user raises.
do $$
begin
  begin
    perform public.claim_welcome(null, 'en');
    raise exception 'FAIL claim_welcome null user: no error';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

rollback;
