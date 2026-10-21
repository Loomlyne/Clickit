-- M1a (05-09): episodes.live_at trigger + backfill, newsletter double opt-in columns.
-- Writes are rolled back at the end.

-- Backfill: every visible seeded episode has live_at; hidden ones do not.
-- (The seed runs after M1a, so the trigger set these; the backfill statement
-- itself is proven by the migration applying without error on an empty table.)
do $$
declare n bigint;
begin
  select count(*) into n from public.episodes
  where live_at is null
    and (status = 'published' or (status = 'coming-soon' and publish_at is not null and publish_at <= now()));
  if n <> 0 then
    raise exception 'FAIL visible episodes have live_at: % without', n;
  end if;
  select count(*) into n from public.episodes
  where live_at is not null
    and not (status = 'published' or (status = 'coming-soon' and publish_at is not null and publish_at <= now()));
  if n <> 0 then
    raise exception 'FAIL hidden episodes have no live_at: % with', n;
  end if;
end $$;

-- live_at is not in the browser-role column grants (research F5).
do $$
begin
  if has_column_privilege('anon', 'public.episodes', 'live_at', 'select')
     or has_column_privilege('authenticated', 'public.episodes', 'live_at', 'select') then
    raise exception 'FAIL live_at server-only: browser role can select it';
  end if;
end $$;

-- A season to hang test episodes on.
do $$
declare v_season uuid; v_show uuid;
begin
  select s.id, s.show_id into v_season, v_show from public.seasons s order by s.id limit 1;
  if v_season is null then
    raise exception 'FAIL setup: no seeded season';
  end if;
  perform set_config('m1a.season', v_season::text, true);
  perform set_config('m1a.show', v_show::text, true);
end $$;

-- Insert published: live_at set. Insert draft: live_at null.
do $$
declare v_pub uuid; v_draft uuid; v_future uuid; v_past uuid;
begin
  insert into public.episodes (show_id, season_id, episode_number, title, status)
  values (current_setting('m1a.show')::uuid, current_setting('m1a.season')::uuid, 90001, 'M1a published', 'published')
  returning id into v_pub;
  insert into public.episodes (show_id, season_id, episode_number, title, status)
  values (current_setting('m1a.show')::uuid, current_setting('m1a.season')::uuid, 90002, 'M1a draft', 'draft')
  returning id into v_draft;
  insert into public.episodes (show_id, season_id, episode_number, title, status, publish_at)
  values (current_setting('m1a.show')::uuid, current_setting('m1a.season')::uuid, 90003, 'M1a scheduled', 'coming-soon', now() + interval '3 days')
  returning id into v_future;
  insert into public.episodes (show_id, season_id, episode_number, title, status, publish_at)
  values (current_setting('m1a.show')::uuid, current_setting('m1a.season')::uuid, 90004, 'M1a due', 'coming-soon', now() - interval '1 hour')
  returning id into v_past;

  if (select live_at from public.episodes where id = v_pub) is null then
    raise exception 'FAIL insert published sets live_at';
  end if;
  if (select live_at from public.episodes where id = v_draft) is not null then
    raise exception 'FAIL insert draft leaves live_at null';
  end if;
  if (select live_at from public.episodes where id = v_future) is not null then
    raise exception 'FAIL insert future coming-soon leaves live_at null';
  end if;
  if (select live_at from public.episodes where id = v_past) is null then
    raise exception 'FAIL insert due coming-soon sets live_at';
  end if;

  perform set_config('m1a.pub', v_pub::text, true);
  perform set_config('m1a.draft', v_draft::text, true);
  perform set_config('m1a.future', v_future::text, true);
end $$;

-- Draft -> published sets live_at.
do $$
begin
  update public.episodes set status = 'published' where id = current_setting('m1a.draft')::uuid;
  if (select live_at from public.episodes where id = current_setting('m1a.draft')::uuid) is null then
    raise exception 'FAIL update draft to published sets live_at';
  end if;
end $$;

-- Scheduled episode whose publish_at moves into the past sets live_at.
do $$
begin
  update public.episodes set publish_at = now() - interval '1 minute' where id = current_setting('m1a.future')::uuid;
  if (select live_at from public.episodes where id = current_setting('m1a.future')::uuid) is null then
    raise exception 'FAIL coming-soon publish_at passed sets live_at';
  end if;
end $$;

-- Changing publish_at (or status) later does not move an existing live_at.
do $$
declare v_before timestamptz; v_after timestamptz;
begin
  update public.episodes set live_at = now() - interval '5 days' where id = current_setting('m1a.pub')::uuid;
  select live_at into v_before from public.episodes where id = current_setting('m1a.pub')::uuid;
  update public.episodes set publish_at = now() + interval '7 days' where id = current_setting('m1a.pub')::uuid;
  update public.episodes set status = 'published', title = 'M1a published again' where id = current_setting('m1a.pub')::uuid;
  select live_at into v_after from public.episodes where id = current_setting('m1a.pub')::uuid;
  if v_after is distinct from v_before then
    raise exception 'FAIL existing live_at unchanged: % -> %', v_before, v_after;
  end if;
end $$;

-- Newsletter: 'pending' accepted, 'bogus' rejected, new columns present with defaults.
do $$
declare r public.newsletter_subscribers%rowtype;
begin
  insert into public.newsletter_subscribers (email, normalized_email, status)
  values ('m1a-news@clickit.local', 'm1a-news@clickit.local', 'pending')
  returning * into r;
  if r.status <> 'pending' then
    raise exception 'FAIL newsletter pending accepted: got %', r.status;
  end if;
  if r.locale <> 'en' or r.confirmed_at is not null or r.confirm_sent_at is not null then
    raise exception 'FAIL newsletter new columns defaults: locale %, confirmed_at %, confirm_sent_at %',
      r.locale, r.confirmed_at, r.confirm_sent_at;
  end if;
  -- old statuses still valid
  insert into public.newsletter_subscribers (email, normalized_email, status)
  values ('m1a-news2@clickit.local', 'm1a-news2@clickit.local', 'active');
end $$;

do $$
begin
  begin
    insert into public.newsletter_subscribers (email, normalized_email, status)
    values ('m1a-bogus@clickit.local', 'm1a-bogus@clickit.local', 'bogus');
    raise exception 'FAIL newsletter bogus status rejected: insert succeeded';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.newsletter_subscribers (email, normalized_email, locale)
    values ('m1a-fr@clickit.local', 'm1a-fr@clickit.local', 'fr');
    raise exception 'FAIL newsletter locale check: fr accepted';
  exception when check_violation then
    null;
  end;
end $$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
  where table_schema = 'public' and table_name = 'newsletter_subscribers'
    and column_name in ('confirmed_at', 'confirm_sent_at', 'locale');
  if n <> 3 then
    raise exception 'FAIL newsletter columns exist: % of 3', n;
  end if;
end $$;

rollback;
