-- MEDIA-08 rewrite (D-09): Supabase Storage and Phase 2 media Worker URLs ->
-- https://media.clickitstory.ae/<bucket>/<key>, query string (?v=) kept.
--
-- Run ONCE on live by the controller after Koss's word and a fresh local dump
-- (runbook Steps 47-52), after preflight.sql read clean and
-- check-backup-table.sql shows the backup table. INSERT and UPDATE only.
--
-- One DO block = one atomic statement: any error rolls back every column.
-- For each driver column it
--   1. copies every value whose rewritten form differs into
--      private.media_url_rewrite_backup (whole old and new value as jsonb),
--   2. updates only rows still at the backed-up old value (no lost admin edit),
--   3. raises if the backed-up count differs from the updated count.
-- jsonb columns: a global replace over the jsonb text, only where a JSON
-- string starts with the old prefix; the leaf count must be unchanged and the
-- app_config_footer_content_shape check constraint re-validates the document.
-- Values on another bucket, another host (picsum.photos, YouTube) or another
-- Storage path (render/image, object/sign) are left alone; preflight.sql counts
-- them and scan-old-hosts.sql shows any old-host value that remains.
--
-- The run id is printed and kept in the setting clickit.rewrite_run_id for the
-- rest of the transaction, so reverse-media-urls.sql in the same transaction
-- (the local test) picks it up.
do $rewrite$
declare
  v_run uuid := gen_random_uuid();
  v_rx text[] := array[
    'https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/',
    'https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/'];
  v_repl text := 'https://media.clickitstory.ae/\1/';
  c record;
  v_new text;
  v_cnt bigint;
  v_upd bigint;
  v_bad bigint;
  v_total bigint := 0;
  v_summary text := '';
begin
  if to_regclass('private.media_url_rewrite_backup') is null then
    raise exception 'private.media_url_rewrite_backup is missing: apply the backup-table migration first';
  end if;

  perform set_config('clickit.rewrite_run_id', v_run::text, true);

  for c in select * from (values
      ('app_config', 'hero_video_url', 'text'),
      ('app_config', 'hero_video_mobile_url', 'text'),
      ('app_config', 'og_image_url', 'text'),
      ('app_config', 'favicon_url', 'text'),
      ('app_config', 'favicon_dark_url', 'text'),
      ('app_config', 'auth_image_url', 'text'),
      ('app_config', 'preloader_video_url', 'text'),
      ('app_config', 'footer_content', 'jsonb'),
      ('shows', 'hero_url', 'text'),
      ('shows', 'hero_image_mobile_url', 'text'),
      ('shows', 'card_image_url', 'text'),
      ('shows', 'poster_url', 'text'),
      ('shows', 'logo_url', 'text'),
      ('shows', 'hero_video_url', 'text'),
      ('shows', 'hero_video_mobile_url', 'text'),
      ('show_cast', 'image_url', 'text'),
      ('profiles', 'avatar_url', 'text'),
      ('shorts', 'thumbnail_url', 'text')) as v(tbl, col, typ)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = c.tbl and column_name = c.col
        and ((c.typ = 'jsonb' and data_type = 'jsonb')
          or (c.typ = 'text' and data_type in ('text', 'character varying')))
    ) then
      raise exception 'driver column public.%.% (%) not found: stop, plan revision', c.tbl, c.col, c.typ;
    end if;

    -- text: the URL must start the value; jsonb: the URL must start a JSON string.
    v_new := case c.typ
      when 'text' then format(
        'regexp_replace(regexp_replace(t.%1$I, %2$L, %4$L), %3$L, %4$L)',
        c.col, '^' || v_rx[1], '^' || v_rx[2], v_repl)
      else format(
        'regexp_replace(regexp_replace(t.%1$I::text, %2$L, %4$L, ''g''), %3$L, %4$L, ''g'')::jsonb',
        c.col, '"' || v_rx[1], '"' || v_rx[2], '"' || v_repl) end;

    execute format($q$
      insert into private.media_url_rewrite_backup (run_id, table_name, column_name, row_pk, old_value, new_value)
      select %1$L::uuid, %2$L, %3$L, jsonb_build_object('id', t.id), to_jsonb(t.%3$I), to_jsonb(%4$s)
      from public.%2$I t
      where t.%3$I is not null and %4$s is distinct from t.%3$I $q$,
      v_run, c.tbl, c.col, v_new);
    get diagnostics v_cnt = row_count;

    execute format($q$
      update public.%1$I t set %2$I = %3$s
      from private.media_url_rewrite_backup b
      where b.run_id = %4$L::uuid and b.table_name = %1$L and b.column_name = %2$L
        and b.row_pk = jsonb_build_object('id', t.id) and to_jsonb(t.%2$I) = b.old_value $q$,
      c.tbl, c.col, case c.typ when 'text' then 'b.new_value #>> ''{}''' else 'b.new_value' end, v_run);
    get diagnostics v_upd = row_count;

    if v_upd <> v_cnt then
      raise exception 'rewrite mismatch on %.%: backed up %, updated %', c.tbl, c.col, v_cnt, v_upd;
    end if;

    if c.typ = 'jsonb' then
      select count(*) into v_bad
      from private.media_url_rewrite_backup b
      where b.run_id = v_run and b.table_name = c.tbl and b.column_name = c.col
        and (jsonb_typeof(b.old_value) is distinct from jsonb_typeof(b.new_value)
          or (select count(*) from jsonb_path_query(b.old_value, 'strict $.**'))
             <> (select count(*) from jsonb_path_query(b.new_value, 'strict $.**')));
      if v_bad > 0 then
        raise exception 'rewrite changed the jsonb structure of %.% in % row(s)', c.tbl, c.col, v_bad;
      end if;
    end if;

    raise notice '%.%: % row(s)', c.tbl, c.col, v_cnt;
    v_total := v_total + v_cnt;
    v_summary := v_summary || format('%s.%s=%s ', c.tbl, c.col, v_cnt);
  end loop;

  raise notice 'rewrite summary: run_id % total % value(s): %', v_run, v_total, rtrim(v_summary);
end $rewrite$;
