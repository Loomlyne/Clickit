-- Smoke test for scripts/db-proof.sh: the scratch database has the app schema
-- and role switching works, so later RLS truth-table tests can trust it.

do $$
begin
  if to_regclass('public.shows') is null then
    raise exception 'FAIL schema present: public.shows is missing';
  end if;
end $$;

do $$
begin
  if to_regprocedure('private.is_admin()') is null then
    raise exception 'FAIL admin helper present: private.is_admin() is missing';
  end if;
end $$;

do $$
declare n bigint;
begin
  set local role anon;
  select count(*) into n from public.shows;
  reset role;
  if n is null then
    raise exception 'FAIL anon can read shows: count was null';
  end if;
exception when others then
  reset role;
  raise exception 'FAIL anon can read shows: %', sqlerrm;
end $$;
