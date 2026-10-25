-- MEDIA-08 reverse, STRICT mode (UPDATE only): put back every value of one
-- rewrite run from private.media_url_rewrite_backup and mark each backup row
-- restored_at. If any value of the run was changed after the rewrite (an admin
-- edited it, or the row is gone), it restores NOTHING and raises one error
-- that lists every changed value:
--   reverse (strict): <n> value(s) changed since the rewrite, nothing restored
--   (run reverse-media-urls-partial.sql to restore the others): <table>.<column>
--   id=<id>: value changed since the rewrite; ...
-- reverse-media-urls-partial.sql is this file with the mode set to partial:
-- it restores every value still at the rewritten value and leaves the changed
-- ones as the admin left them (restored_at stays empty; reverse_skipped_at and
-- reverse_skip_reason are set; they are listed in the notice and in
-- report.sql). The DO block below is the same in both files
-- (tests/unit/rewrite-sql.test.ts keeps them equal).
--
-- Which run:
--   - the setting clickit.rewrite_run_id when it is set (rewrite-media-urls.sql
--     sets it for its own transaction; to choose a run on live, run
--     `select set_config('clickit.rewrite_run_id', '<run id>', false);` in the
--     same session first);
--   - otherwise the single run that still has rows with restored_at is null.
--     More than one open run raises: set the run id explicitly.
-- List runs with:
--   select run_id, count(*), count(restored_at) from private.media_url_rewrite_backup group by 1;
--
-- One DO block = one atomic statement. Like the rewrite, it first pauses the
-- four updated_at triggers inside its own transaction (alter table ...
-- disable trigger, enabled again before the block ends), so updated_at is not
-- touched: a row nobody edited since the rewrite ends byte-identical to before
-- the rewrite; a row an admin edited keeps the admin's updated_at. Each value
-- is written back only while the row still holds the value the rewrite wrote
-- (to_jsonb(col) = new_value).
select set_config('clickit.reverse_mode', 'strict', false) as reverse_mode;

do $reverse$
declare
  v_mode text := coalesce(nullif(current_setting('clickit.reverse_mode', true), ''), 'strict');
  v_set text := nullif(current_setting('clickit.rewrite_run_id', true), '');
  v_run uuid;
  v_open bigint;
  b record;
  g record;
  v_typ text;
  v_one bigint;
  v_rows bigint := 0;
  v_n bigint := 0;
  v_reason text;
  v_skipped text[] := '{}';
begin
  if v_mode not in ('strict', 'partial') then
    raise exception 'reverse: clickit.reverse_mode must be strict or partial, got %', v_mode;
  end if;

  if to_regclass('private.media_url_rewrite_backup') is null then
    raise exception 'private.media_url_rewrite_backup is missing: nothing to reverse';
  end if;

  if v_set is not null then
    v_run := v_set::uuid;
  else
    select count(distinct run_id) into v_open
    from private.media_url_rewrite_backup where restored_at is null;
    if v_open = 0 then
      raise exception 'reverse: no open run (every backup row already has restored_at)';
    elsif v_open > 1 then
      raise exception 'reverse: % open runs; set clickit.rewrite_run_id to the run to reverse', v_open;
    end if;
    select distinct run_id into v_run
    from private.media_url_rewrite_backup where restored_at is null;
  end if;

  perform set_config('lock_timeout', '10s', true);

  -- Pause the updated_at triggers for this transaction only (as the rewrite).
  for g in select * from (values
      ('app_config', 'set_updated_at'),
      ('shows', 'set_updated_at'),
      ('profiles', 'set_updated_at'),
      ('shorts', 'shorts_updated_at')) as v(tbl, trg)
  loop
    if not exists (
      select 1 from pg_trigger t
      where t.tgrelid = to_regclass(format('public.%I', g.tbl)) and t.tgname = g.trg
        and not t.tgisinternal and t.tgenabled = 'O'
    ) then
      raise exception 'reverse: trigger public.%.% missing or not enabled: stop, plan revision', g.tbl, g.trg;
    end if;
    execute format('alter table public.%I disable trigger %I', g.tbl, g.trg);
  end loop;

  for b in
    select * from private.media_url_rewrite_backup
    where run_id = v_run and restored_at is null
    order by id
  loop
    v_rows := v_rows + 1;
    select data_type into v_typ from information_schema.columns
    where table_schema = 'public' and table_name = b.table_name and column_name = b.column_name;
    if v_typ is null then
      raise exception 'reverse: column public.%.% not found', b.table_name, b.column_name;
    end if;

    execute format(
      'update public.%I t set %I = %s where t.id::text = %L and to_jsonb(t.%I) = %L::jsonb',
      b.table_name, b.column_name,
      case when v_typ = 'jsonb' then '$1' else '($1 #>> ''{}'')' end,
      b.row_pk ->> 'id', b.column_name, b.new_value)
    using b.old_value;
    get diagnostics v_one = row_count;

    if v_one = 1 then
      update private.media_url_rewrite_backup
        set restored_at = now(), reverse_skipped_at = null, reverse_skip_reason = null
        where id = b.id;
      v_n := v_n + 1;
    else
      execute format('select count(*) from public.%I t where t.id::text = %L', b.table_name, b.row_pk ->> 'id')
        into v_one;
      v_reason := case when v_one = 0 then 'row missing' else 'value changed since the rewrite' end;
      v_skipped := v_skipped || format('%s.%s id=%s: %s', b.table_name, b.column_name, b.row_pk ->> 'id', v_reason);
      if v_mode = 'partial' then
        update private.media_url_rewrite_backup
          set reverse_skipped_at = now(), reverse_skip_reason = v_reason
          where id = b.id;
      end if;
    end if;
  end loop;

  if v_rows = 0 then
    raise exception 'reverse: run % has no rows left to restore', v_run;
  end if;

  if v_mode = 'strict' and cardinality(v_skipped) > 0 then
    raise exception 'reverse (strict): % value(s) changed since the rewrite, nothing restored (run reverse-media-urls-partial.sql to restore the others): %',
      cardinality(v_skipped), array_to_string(v_skipped, '; ');
  end if;

  for g in select * from (values
      ('app_config', 'set_updated_at'),
      ('shows', 'set_updated_at'),
      ('profiles', 'set_updated_at'),
      ('shorts', 'shorts_updated_at')) as v(tbl, trg)
  loop
    execute format('alter table public.%I enable trigger %I', g.tbl, g.trg);
  end loop;

  raise notice 'reverse (%): run_id % restored % value(s), skipped %: %',
    v_mode, v_run, v_n, cardinality(v_skipped), coalesce(nullif(array_to_string(v_skipped, '; '), ''), 'none');
end $reverse$;
