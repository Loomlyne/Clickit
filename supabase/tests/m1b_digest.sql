-- M1b (05-13): build_digest (D-34, F5, Pitfall 8). Threat T-05-13-03.
-- Writes are rolled back at the end.
--
-- Fixed clock (Dubai is UTC+4, no DST):
--   T0 = 2030-03-08 12:00Z (Dubai 2030-03-08 16:00)  first run, nothing new
--   T1 = 2030-03-10 12:00Z (Dubai 2030-03-10 16:00)  date D
--   T1 + 2 h                 (Dubai 18:00, same date D)
--   T1 + 1 day               date D + 1
--   T1 + 2 days              date D + 2

do $$
begin
  perform set_config('m1b.t0', '2030-03-08 12:00:00+00', true);
  perform set_config('m1b.t1', '2030-03-10 12:00:00+00', true);
  if exists (select 1 from public.digest_runs) or exists (select 1 from public.notification_sends) then
    raise exception 'FAIL setup: digest tables not empty';
  end if;
end $$;

-- Shows, seasons, viewers, My List rows and the first episodes.
do $$
declare
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_s uuid; v_s2 uuid; v_s3 uuid;
  v_se uuid; v_se2 uuid; v_se3 uuid;
  v_v1 uuid := gen_random_uuid();
  v_off uuid := gen_random_uuid();
  v_un uuid := gen_random_uuid();
  v_v2 uuid := gen_random_uuid();
  v_a uuid;
begin
  insert into public.shows (title, title_ar, slug, genre, status, card_image_url, hero_url)
  values ('M1b Show', 'برنامج', 'm1b-show', 'Drama', 'now-streaming', 'https://media.clickitstory.ae/m1b/card.jpg', 'https://media.clickitstory.ae/m1b/hero.jpg')
  returning id into v_s;
  insert into public.shows (title, slug, genre, status)
  values ('M1b Second', 'm1b-second', 'Drama', 'now-streaming')
  returning id into v_s2;
  insert into public.shows (title, slug, genre, status, hero_url)
  values ('M1b Third', 'm1b-third', 'Drama', 'coming-soon', 'https://media.clickitstory.ae/m1b/hero3.jpg')
  returning id into v_s3;
  insert into public.seasons (show_id, season_number, title) values (v_s, 2, 'S2') returning id into v_se;
  insert into public.seasons (show_id, season_number, title) values (v_s2, 1, 'S1') returning id into v_se2;
  insert into public.seasons (show_id, season_number, title) values (v_s3, 1, 'S1') returning id into v_se3;

  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
  values (v_v1, 'm1b-viewer@clickit.local', 'authenticated', 'authenticated', now(), now(), now()),
         (v_off, 'm1b-off@clickit.local', 'authenticated', 'authenticated', now(), now(), now()),
         (v_un, 'm1b-unconfirmed-viewer@clickit.local', 'authenticated', 'authenticated', null, now(), now()),
         (v_v2, 'm1b-viewer2@clickit.local', 'authenticated', 'authenticated', now(), now(), now());
  update public.profiles set locale = 'ar' where id = v_v1;
  update public.profiles set notify_new_episodes = false where id = v_off;
  insert into public.watchlist (user_id, show_id)
  values (v_v1, v_s), (v_off, v_s), (v_un, v_s);

  -- A: new, published, live 2 h before T1.
  insert into public.episodes (show_id, season_id, episode_number, title, title_ar, status, live_at)
  values (v_s, v_se, 1, 'Episode A', 'الحلقة أ', 'published', t1 - interval '2 hours')
  returning id into v_a;
  -- Old: live 5 days before T1 (before the window).
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (v_s, v_se, 2, 'Episode Old', 'published', t1 - interval '5 days');
  -- Archived and draft episodes inside the window are never announced.
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at, archived)
  values (v_s, v_se, 3, 'Episode Archived', 'published', t1 - interval '3 hours', true);
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (v_s, v_se, 4, 'Episode Draft', 'draft', t1 - interval '1 hour');

  perform set_config('m1b.s', v_s::text, true);
  perform set_config('m1b.s2', v_s2::text, true);
  perform set_config('m1b.s3', v_s3::text, true);
  perform set_config('m1b.se', v_se::text, true);
  perform set_config('m1b.se2', v_se2::text, true);
  perform set_config('m1b.se3', v_se3::text, true);
  perform set_config('m1b.v1', v_v1::text, true);
  perform set_config('m1b.off', v_off::text, true);
  perform set_config('m1b.un', v_un::text, true);
  perform set_config('m1b.v2', v_v2::text, true);
  perform set_config('m1b.a', v_a::text, true);
end $$;

-- First run, nothing new in its window: zero rows, one success run, window = p_now - 24 h .. p_now.
do $$
declare
  t0 timestamptz := current_setting('m1b.t0')::timestamptz;
  n bigint;
  r record;
begin
  select count(*) into n from public.build_digest(t0);
  if n <> 0 then
    raise exception 'FAIL no new episodes: % rows', n;
  end if;
  if (select count(*) from public.email_outbox where kind = 'digest') <> 0 then
    raise exception 'FAIL no new episodes: outbox has digest rows';
  end if;
  select * into r from public.digest_runs;
  if r.status <> 'success' or r.emails <> 0 then
    raise exception 'FAIL no new episodes success run: status % emails %', r.status, r.emails;
  end if;
  if r.window_start <> t0 - interval '24 hours' or r.window_end <> t0 then
    raise exception 'FAIL first run window: % .. %', r.window_start, r.window_end;
  end if;
end $$;

-- Run at T1: one digest row for the viewer (notify on, confirmed), none for notify off or unconfirmed.
do $$
declare
  t0 timestamptz := current_setting('m1b.t0')::timestamptz;
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_v1 uuid := current_setting('m1b.v1')::uuid;
  v_a uuid := current_setting('m1b.a')::uuid;
  v_ret uuid[];
  r record;
  v_show jsonb;
  v_ep jsonb;
begin
  select array_agg(d) into v_ret from public.build_digest(t1) d;
  if coalesce(cardinality(v_ret), 0) <> 1 then
    raise exception 'FAIL digest one row: returned %', coalesce(cardinality(v_ret), 0);
  end if;
  if (select count(*) from public.email_outbox where kind = 'digest') <> 1 then
    raise exception 'FAIL digest one row in outbox: %', (select count(*) from public.email_outbox where kind = 'digest');
  end if;
  if exists (select 1 from public.email_outbox where kind = 'digest'
             and to_user in (current_setting('m1b.off')::uuid, current_setting('m1b.un')::uuid)) then
    raise exception 'FAIL digest notify false or unconfirmed got a row';
  end if;

  select * into r from public.email_outbox where id = v_ret[1];
  if r.to_user <> v_v1 or r.kind <> 'digest' or r.status <> 'pending' or r.to_email is not null then
    raise exception 'FAIL digest row target: % % %', r.to_user, r.kind, r.status;
  end if;
  if r.idempotency_key <> 'digest:' || v_v1 || ':2030-03-10' then
    raise exception 'FAIL digest key Dubai date: %', r.idempotency_key;
  end if;
  if r.locale <> 'ar' then
    raise exception 'FAIL digest locale from profile: %', r.locale;
  end if;

  -- Payload: the 05-11 contract (shows[].title/title_ar/slug/image_url/episodes[], total_shows).
  if (r.payload->>'total_shows')::int <> 1 or jsonb_array_length(r.payload->'shows') <> 1 then
    raise exception 'FAIL digest payload shows: %', r.payload;
  end if;
  v_show := r.payload->'shows'->0;
  if v_show->>'title' <> 'M1b Show' or v_show->>'title_ar' <> 'برنامج' or v_show->>'slug' <> 'm1b-show'
     or v_show->>'image_url' <> 'https://media.clickitstory.ae/m1b/card.jpg' then
    raise exception 'FAIL digest payload show fields: %', v_show;
  end if;
  if jsonb_array_length(v_show->'episodes') <> 1 then
    raise exception 'FAIL digest only new visible episodes (old, archived, draft excluded): %', v_show->'episodes';
  end if;
  v_ep := v_show->'episodes'->0;
  if (v_ep->>'id')::uuid <> v_a then
    raise exception 'FAIL digest payload shows[0].episodes[0].id: %', v_ep->>'id';
  end if;
  if jsonb_typeof(v_ep->'season_number') <> 'number' or (v_ep->>'season_number')::int <> 2
     or (v_ep->>'episode_number')::int <> 1 or v_ep->>'title' <> 'Episode A' or v_ep->>'title_ar' <> 'الحلقة أ' then
    raise exception 'FAIL digest payload episode fields: %', v_ep;
  end if;

  -- Ledger has the pair, and only that pair.
  if not exists (select 1 from public.notification_sends where user_id = v_v1 and episode_id = v_a and kind = 'digest') then
    raise exception 'FAIL digest ledger pair missing';
  end if;
  if (select count(*) from public.notification_sends) <> 1 then
    raise exception 'FAIL digest ledger only sent pairs: % rows', (select count(*) from public.notification_sends);
  end if;

  -- The run row: window_start = previous success window_end, window_end = p_now.
  select * into r from public.digest_runs where window_end = t1;
  if r.status <> 'success' or r.emails <> 1 or r.window_start <> t0 then
    raise exception 'FAIL digest run row: status % emails % start %', r.status, r.emails, r.window_start;
  end if;
end $$;

-- Same Dubai date: a new episode, then a call at T1 + 2 h: nothing, no run row, window not moved.
do $$
declare
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_b uuid;
  n_runs bigint;
  n bigint;
begin
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (current_setting('m1b.s')::uuid, current_setting('m1b.se')::uuid, 5, 'Episode B', 'published', t1 + interval '1 hour')
  returning id into v_b;
  perform set_config('m1b.b', v_b::text, true);

  select count(*) into n_runs from public.digest_runs;
  select count(*) into n from public.build_digest(t1 + interval '2 hours');
  if n <> 0 then
    raise exception 'FAIL same date second call: % rows', n;
  end if;
  if (select count(*) from public.digest_runs) <> n_runs then
    raise exception 'FAIL same date no run row: % -> %', n_runs, (select count(*) from public.digest_runs);
  end if;
  if (select max(window_end) from public.digest_runs where status = 'success') <> t1 then
    raise exception 'FAIL same date window not moved';
  end if;
  if (select count(*) from public.email_outbox where kind = 'digest') <> 1 then
    raise exception 'FAIL same date no outbox row';
  end if;
end $$;

-- Window and ledger: E1 went live before the last successful run (T1 - 1 h) and its show is
-- added to a second viewer's list afterwards; C is already in the ledger for the viewer;
-- a newer show S3 comes first. The run on date D + 1 includes B, never E1, C or A again.
do $$
declare
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_v1 uuid := current_setting('m1b.v1')::uuid;
  v_e1 uuid; v_c uuid; v_g uuid;
  v_ret uuid[];
  r record;
begin
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (current_setting('m1b.s2')::uuid, current_setting('m1b.se2')::uuid, 1, 'Episode E1', 'published', t1 - interval '1 hour')
  returning id into v_e1;
  insert into public.watchlist (user_id, show_id) values (current_setting('m1b.v2')::uuid, current_setting('m1b.s2')::uuid);

  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (current_setting('m1b.s')::uuid, current_setting('m1b.se')::uuid, 6, 'Episode C', 'published', t1 + interval '3 hours')
  returning id into v_c;
  insert into public.notification_sends (user_id, episode_id, kind) values (v_v1, v_c, 'digest');

  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (current_setting('m1b.s3')::uuid, current_setting('m1b.se3')::uuid, 1, 'Episode G', 'published', t1 + interval '5 hours')
  returning id into v_g;
  insert into public.watchlist (user_id, show_id) values (v_v1, current_setting('m1b.s3')::uuid);

  select array_agg(d) into v_ret from public.build_digest(t1 + interval '1 day') d;
  if coalesce(cardinality(v_ret), 0) <> 1 then
    raise exception 'FAIL D+1 one row (viewer only): %', coalesce(cardinality(v_ret), 0);
  end if;
  select * into r from public.email_outbox where id = v_ret[1];
  if r.to_user <> v_v1 or r.idempotency_key <> 'digest:' || v_v1 || ':2030-03-11' then
    raise exception 'FAIL D+1 row: % %', r.to_user, r.idempotency_key;
  end if;
  if exists (select 1 from public.email_outbox where kind = 'digest' and to_user = current_setting('m1b.v2')::uuid) then
    raise exception 'FAIL window: E1 (live before the last successful run) produced a row';
  end if;
  if exists (
    select 1
    from public.email_outbox o,
         jsonb_array_elements(o.payload->'shows') s,
         jsonb_array_elements(s->'episodes') e
    where o.kind = 'digest' and (e->>'id')::uuid = v_e1
  ) then
    raise exception 'FAIL window: E1 is in a digest row';
  end if;

  -- Shows ordered by newest live_at: S3 (G at T1 + 5 h) before S (B at T1 + 1 h).
  if (r.payload->>'total_shows')::int <> 2
     or r.payload->'shows'->0->>'slug' <> 'm1b-third'
     or r.payload->'shows'->1->>'slug' <> 'm1b-show' then
    raise exception 'FAIL D+1 show order: %', r.payload;
  end if;
  if r.payload->'shows'->0->>'image_url' <> 'https://media.clickitstory.ae/m1b/hero3.jpg' then
    raise exception 'FAIL image falls back to hero: %', r.payload->'shows'->0;
  end if;
  if jsonb_array_length(r.payload->'shows'->1->'episodes') <> 1
     or (r.payload->'shows'->1->'episodes'->0->>'id')::uuid <> current_setting('m1b.b')::uuid then
    raise exception 'FAIL D+1 includes B only (not A again, not C from the ledger): %', r.payload->'shows'->1;
  end if;
  select * into r from public.digest_runs where window_end = t1 + interval '1 day';
  if r.window_start <> t1 or r.status <> 'success' or r.emails <> 1 then
    raise exception 'FAIL D+1 run row: % % %', r.window_start, r.status, r.emails;
  end if;
  if (select count(*) from public.notification_sends where user_id = v_v1) <> 4 then
    raise exception 'FAIL D+1 ledger: % pairs for the viewer (A, C, B, G expected)',
      (select count(*) from public.notification_sends where user_id = v_v1);
  end if;
end $$;

-- A failed run (forced exception) leaves no run row and does not move the window.
create function public.m1b_test_force_fail() returns trigger language plpgsql as $f$
begin
  raise exception 'm1b forced failure';
end
$f$;
create trigger m1b_test_force_fail before insert on public.email_outbox
  for each row execute function public.m1b_test_force_fail();

do $$
declare
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_f uuid;
  n_runs bigint;
  v_raised boolean := false;
begin
  insert into public.episodes (show_id, season_id, episode_number, title, status, live_at)
  values (current_setting('m1b.s')::uuid, current_setting('m1b.se')::uuid, 7, 'Episode F', 'published', t1 + interval '1 day 2 hours')
  returning id into v_f;
  perform set_config('m1b.f', v_f::text, true);
  select count(*) into n_runs from public.digest_runs;
  begin
    perform public.build_digest(t1 + interval '2 days');
  exception when others then
    if sqlerrm <> 'm1b forced failure' then
      raise exception 'FAIL forced failure: unexpected error %', sqlerrm;
    end if;
    v_raised := true;
  end;
  if not v_raised then
    raise exception 'FAIL forced failure: build_digest did not raise';
  end if;
  if (select count(*) from public.digest_runs) <> n_runs
     or exists (select 1 from public.digest_runs where status <> 'success') then
    raise exception 'FAIL failed run leaves no run row';
  end if;
  if (select max(window_end) from public.digest_runs where status = 'success') <> t1 + interval '1 day' then
    raise exception 'FAIL failed run moved the window';
  end if;
  if exists (select 1 from public.notification_sends where episode_id = v_f) then
    raise exception 'FAIL failed run wrote the ledger';
  end if;
end $$;

drop trigger m1b_test_force_fail on public.email_outbox;
drop function public.m1b_test_force_fail();

-- The next run starts at the last success (T1 + 1 day) and includes F.
do $$
declare
  t1 timestamptz := current_setting('m1b.t1')::timestamptz;
  v_ret uuid[];
  r record;
begin
  select array_agg(d) into v_ret from public.build_digest(t1 + interval '2 days') d;
  if coalesce(cardinality(v_ret), 0) <> 1 then
    raise exception 'FAIL after failure one row: %', coalesce(cardinality(v_ret), 0);
  end if;
  select * into r from public.email_outbox where id = v_ret[1];
  if (r.payload->'shows'->0->'episodes'->0->>'id')::uuid <> current_setting('m1b.f')::uuid then
    raise exception 'FAIL after failure includes F: %', r.payload;
  end if;
  select * into r from public.digest_runs where window_end = t1 + interval '2 days';
  if r.window_start <> t1 + interval '1 day' or r.status <> 'success' then
    raise exception 'FAIL after failure window_start: % %', r.window_start, r.status;
  end if;
end $$;

-- service_role (the cron caller) can run it; a repeat on the same date is a no-op.
do $$
declare n bigint;
begin
  set local role service_role;
  select count(*) into n from public.build_digest(current_setting('m1b.t1')::timestamptz + interval '2 days 1 hour');
  reset role;
  if n <> 0 then
    raise exception 'FAIL service_role repeat same date: % rows', n;
  end if;
end $$;

rollback;
