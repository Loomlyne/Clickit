-- Pending M3 (supabase/pending/m3_close_anon_youtube.sql), run by scripts/db-proof.sh
-- after the pending files. Threat T-05-14-02, research F1 and A8.
--   anon: cannot select episodes_view, cannot call get_public_youtube_video_id.
--   authenticated: both still work.
--   service_role (the 05-05 catalog client): both still work, the view returns rows
--   with YouTube ids.
-- Read-only apart from session settings; the file still ends with rollback.

-- Pick a seeded episode that the view exposes with a YouTube id.
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.episodes_view where youtube_video_id is not null order by id limit 1;
  if v_id is null then
    raise exception 'FAIL fixture: no seeded episode with a YouTube id in episodes_view';
  end if;
  perform set_config('m3.episode', v_id::text, true);
end $$;

-- Catalog privileges after M3.
do $$
begin
  if has_function_privilege('anon', 'public.get_public_youtube_video_id(uuid)', 'execute') then
    raise exception 'FAIL anon execute revoked: anon still has EXECUTE';
  end if;
  if exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.get_public_youtube_video_id(uuid)'::regprocedure and a.grantee = 0
  ) then
    raise exception 'FAIL public execute revoked: PUBLIC holds EXECUTE';
  end if;
  if not has_function_privilege('authenticated', 'public.get_public_youtube_video_id(uuid)', 'execute') then
    raise exception 'FAIL authenticated execute kept: missing';
  end if;
  if not has_function_privilege('service_role', 'public.get_public_youtube_video_id(uuid)', 'execute') then
    raise exception 'FAIL service_role execute kept: missing';
  end if;
  if has_table_privilege('anon', 'public.episodes_view', 'select') then
    raise exception 'FAIL anon view select revoked: anon still has SELECT';
  end if;
  if not has_table_privilege('authenticated', 'public.episodes_view', 'select')
     or not has_table_privilege('service_role', 'public.episodes_view', 'select') then
    raise exception 'FAIL view select kept: authenticated or service_role lost SELECT';
  end if;
  -- Not widened: browser roles hold nothing beyond SELECT on the view.
  if has_table_privilege('authenticated', 'public.episodes_view', 'insert')
     or has_table_privilege('authenticated', 'public.episodes_view', 'update')
     or has_table_privilege('authenticated', 'public.episodes_view', 'delete')
     or has_table_privilege('anon', 'public.episodes_view', 'insert') then
    raise exception 'FAIL view not widened: a browser role holds a write privilege';
  end if;
end $$;

-- anon: the view and the function are both refused.
do $$
declare
  v_n bigint;
  v_yt text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into v_n from public.episodes_view;
    reset role;
    raise exception 'FAIL anon episodes_view denied: select returned % rows', v_n;
  exception when insufficient_privilege then
    reset role;
  end;
  set local role anon;
  begin
    v_yt := public.get_public_youtube_video_id(current_setting('m3.episode')::uuid);
    reset role;
    raise exception 'FAIL anon youtube id denied: call returned %', coalesce(v_yt, '<NULL>');
  exception when insufficient_privilege then
    reset role;
  end;
  -- M3 touches nothing else: anon still reads the public episode columns and shows.
  set local role anon;
  select count(*) into v_n from public.episodes where id = current_setting('m3.episode')::uuid;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL anon base episodes kept: % rows', v_n;
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- authenticated (any signed-in viewer): both work.
do $$
declare
  v_n bigint;
  v_yt text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.episodes_view;
  v_yt := public.get_public_youtube_video_id(current_setting('m3.episode')::uuid);
  reset role;
  if v_n < 1 then
    raise exception 'FAIL authenticated episodes_view: % rows', v_n;
  end if;
  if v_yt is null then
    raise exception 'FAIL authenticated youtube id: null for a published episode';
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- service_role (catalog client, A8): the view returns rows with YouTube ids.
do $$
declare
  v_n bigint;
  v_with_id bigint;
  v_yt text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select count(*), count(youtube_video_id) into v_n, v_with_id from public.episodes_view;
  v_yt := public.get_public_youtube_video_id(current_setting('m3.episode')::uuid);
  reset role;
  if v_n < 1 or v_with_id < 1 then
    raise exception 'FAIL service_role episodes_view: % rows, % with a YouTube id', v_n, v_with_id;
  end if;
  if v_yt is null then
    raise exception 'FAIL service_role youtube id: null for a published episode';
  end if;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
