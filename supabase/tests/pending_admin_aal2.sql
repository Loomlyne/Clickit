-- Pending M2 (supabase/pending/m2_admin_aal2.sql), run by scripts/db-proof.sh after
-- the pending files. Threat T-05-14-01. Truth table for private.is_admin():
--   member + aal2 -> true; member + aal1, member without aal, non-member + aal2,
--   the old app_config admin + aal2, anon -> false.
-- Proven twice per case: calling the function directly, and through RLS
-- (a draft show only admins can see; site-assets storage writes).
-- Test users only (@clickit.local, gen_random_uuid()). Everything is rolled back.

-- The function keeps its name, signature, security and grants.
do $$
declare
  v_proc oid := to_regprocedure('private.is_admin()');
begin
  if v_proc is null then
    raise exception 'FAIL is_admin signature: private.is_admin() not found';
  end if;
  if (select prorettype from pg_proc where oid = v_proc) <> 'boolean'::regtype then
    raise exception 'FAIL is_admin signature: return type changed';
  end if;
  if not (select prosecdef from pg_proc where oid = v_proc) then
    raise exception 'FAIL is_admin signature: no longer security definer';
  end if;
  if (select provolatile from pg_proc where oid = v_proc) <> 's' then
    raise exception 'FAIL is_admin signature: no longer stable';
  end if;
  if not coalesce((select proconfig from pg_proc where oid = v_proc) @> array['search_path=""'], false) then
    raise exception 'FAIL is_admin signature: search_path is %', (select proconfig from pg_proc where oid = v_proc);
  end if;
  if not has_function_privilege('anon', v_proc, 'execute')
     or not has_function_privilege('authenticated', v_proc, 'execute') then
    raise exception 'FAIL is_admin grants: anon or authenticated lost EXECUTE (policies would error)';
  end if;
  if exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = v_proc and a.grantee = 0) then
    raise exception 'FAIL is_admin grants: PUBLIC holds EXECUTE';
  end if;
  if pg_get_functiondef(v_proc) not like '%public.admins%'
     or pg_get_functiondef(v_proc) not like '%aal2%'
     or pg_get_functiondef(v_proc) like '%app_config%' then
    raise exception 'FAIL is_admin body: expected admins + aal2 and no app_config';
  end if;
end $$;

-- The inline storage policy now calls private.is_admin(), same command, role and bucket.
do $$
declare
  r record;
begin
  select p.polcmd, p.polroles::regrole[]::text[] as roles,
         pg_get_expr(p.polqual, p.polrelid) as q,
         pg_get_expr(p.polwithcheck, p.polrelid) as c
  into r
  from pg_policy p
  where p.polrelid = 'storage.objects'::regclass and p.polname = 'Admin manage site-assets';
  if not found then
    raise exception 'FAIL site-assets policy: missing';
  end if;
  if r.polcmd <> '*' or r.roles <> array['authenticated'] then
    raise exception 'FAIL site-assets policy: command % roles %', r.polcmd, r.roles;
  end if;
  if r.q not like '%private.is_admin()%' or r.c not like '%private.is_admin()%'
     or r.q not like '%site-assets%' or r.c not like '%site-assets%' then
    raise exception 'FAIL site-assets policy: using % / with check %', r.q, r.c;
  end if;
  if r.q like '%app_config%' or r.c like '%app_config%' then
    raise exception 'FAIL site-assets policy: still reads app_config';
  end if;
  -- No policy anywhere still reads app_config.admin_user_id inline.
  if exists (
    select 1 from pg_policy p
    where coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%admin_user_id%'
       or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%admin_user_id%'
  ) then
    raise exception 'FAIL no inline admin_user_id policy: one remains';
  end if;
end $$;

-- Fixtures: a member (admins row), a non-member, the old app_config admin, a draft show.
do $$
declare
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_old uuid := (select admin_user_id from public.app_config where id = 1);
  v_show uuid;
begin
  if v_old is null then
    raise exception 'FAIL fixture: app_config.admin_user_id is null (pre_phase5_app_config did not run)';
  end if;
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (v_member, 'm2-member@clickit.local', 'authenticated', 'authenticated', now(), now()),
         (v_other, 'm2-other@clickit.local', 'authenticated', 'authenticated', now(), now());
  insert into public.admins (user_id, display_name) values (v_member, 'M2 Member Fixture');
  if exists (select 1 from public.admins where user_id = v_old) then
    raise exception 'FAIL fixture: the old app_config admin has an admins row';
  end if;
  insert into public.shows (title, slug, genre, status)
  values ('M2 Draft Fixture', 'm2-draft-fixture', 'drama', 'draft')
  returning id into v_show;
  perform set_config('m2.member', v_member::text, true);
  perform set_config('m2.other', v_other::text, true);
  perform set_config('m2.old', v_old::text, true);
  perform set_config('m2.show', v_show::text, true);
end $$;

-- Truth table, called directly (as the file's owner after setting the claims)
-- and as `authenticated` through the draft-show RLS policy.
do $$
declare
  c record;
  v_direct boolean;
  v_as_role boolean;
  v_sees int;
begin
  for c in
    select * from (values
      ('member+aal2',     current_setting('m2.member'), '"aal2"', true),
      ('member+aal1',     current_setting('m2.member'), '"aal1"', false),
      ('member+no aal',   current_setting('m2.member'), null,     false),
      ('member+aal empty',current_setting('m2.member'), '""',     false),
      ('non-member+aal2', current_setting('m2.other'),  '"aal2"', false),
      ('old app_config admin+aal2', current_setting('m2.old'), '"aal2"', false)
    ) t(label, sub, aal, expected)
  loop
    perform set_config('request.jwt.claims',
      case when c.aal is null
        then json_build_object('sub', c.sub, 'role', 'authenticated')::text
        else (json_build_object('sub', c.sub, 'role', 'authenticated')::jsonb
              || jsonb_build_object('aal', c.aal::jsonb))::text
      end, true);

    v_direct := private.is_admin();

    set local role authenticated;
    v_as_role := private.is_admin();
    select count(*) into v_sees from public.shows where id = current_setting('m2.show')::uuid;
    reset role;

    if v_direct is distinct from c.expected or v_as_role is distinct from c.expected then
      raise exception 'FAIL is_admin %: direct % as authenticated % expected %',
        c.label, v_direct, v_as_role, c.expected;
    end if;
    if (v_sees = 1) is distinct from c.expected then
      raise exception 'FAIL draft show RLS %: sees % rows, expected admin=%', c.label, v_sees, c.expected;
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- anon: false, and the draft show stays hidden.
do $$
declare
  v boolean;
  v_sees int;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  v := private.is_admin();
  select count(*) into v_sees from public.shows where id = current_setting('m2.show')::uuid;
  reset role;
  if v is distinct from false then
    raise exception 'FAIL is_admin anon: %', v;
  end if;
  if v_sees <> 0 then
    raise exception 'FAIL draft show RLS anon: sees % rows', v_sees;
  end if;
  -- anon with a forged aal2 but no sub is still not an admin.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon', 'aal', 'aal2')::text, true);
  set local role anon;
  v := private.is_admin();
  reset role;
  if v is distinct from false then
    raise exception 'FAIL is_admin anon+aal2: %', v;
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Storage: member+aal2 may write to site-assets; member+aal1, non-member+aal2
-- and the old app_config admin are refused.
do $$
declare
  c record;
  v_n int;
begin
  -- Allowed: member + aal2 inserts, updates and deletes.
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m2.member'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('site-assets', 'm2-proof/admin-aal2.mp4');
  update storage.objects set metadata = '{"m2":"aal2"}'::jsonb
   where bucket_id = 'site-assets' and name = 'm2-proof/admin-aal2.mp4';
  get diagnostics v_n = row_count;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL storage member+aal2 update: % rows', v_n;
  end if;

  for c in
    select * from (values
      ('member+aal1',     current_setting('m2.member'), 'aal1'),
      ('non-member+aal2', current_setting('m2.other'),  'aal2'),
      ('old app_config admin+aal2', current_setting('m2.old'), 'aal2')
    ) t(label, sub, aal)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', c.sub, 'role', 'authenticated', 'aal', c.aal)::text, true);
    set local role authenticated;
    begin
      insert into storage.objects (bucket_id, name) values ('site-assets', 'm2-proof/refused.mp4');
      reset role;
      raise exception 'FAIL storage % insert: allowed', c.label;
    exception when insufficient_privilege then
      reset role;
    end;
    set local role authenticated;
    update storage.objects set metadata = '{"m2":"refused"}'::jsonb
     where bucket_id = 'site-assets' and name = 'm2-proof/admin-aal2.mp4';
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then
      raise exception 'FAIL storage % update: % rows changed', c.label, v_n;
    end if;
    set local role authenticated;
    delete from storage.objects -- safe-drop: test row inside a rolled-back transaction
     where bucket_id = 'site-assets' and name = 'm2-proof/admin-aal2.mp4';
    get diagnostics v_n = row_count;
    reset role;
    if v_n <> 0 then
      raise exception 'FAIL storage % delete: % rows removed', c.label, v_n;
    end if;
  end loop;

  -- Allowed again: member + aal2 deletes its object.
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('m2.member'), 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  delete from storage.objects -- safe-drop: test row inside a rolled-back transaction
   where bucket_id = 'site-assets' and name = 'm2-proof/admin-aal2.mp4';
  get diagnostics v_n = row_count;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL storage member+aal2 delete: % rows', v_n;
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
