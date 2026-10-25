-- MEDIA-08 reverse, PARTIAL mode (UPDATE only). Run only on Koss's word
-- "reverse rewrite partial", after the strict reverse-media-urls.sql refused
-- and listed the values an admin changed since the rewrite (runbook Step 52).
--
-- Restores every value of the run that still holds the value the rewrite
-- wrote and sets restored_at on its backup row. A value that was changed
-- since the rewrite (or whose row is gone) is left as it is: its backup row
-- keeps restored_at empty and gets reverse_skipped_at and reverse_skip_reason
-- ('value changed since the rewrite' or 'row missing'). The notice lists them:
--   reverse (partial): run_id <uuid> restored <n> value(s), skipped <k>: <table>.<column> id=<id>: <reason>; ...
-- report.sql lists them too. The run stays open while a skipped row is open;
-- a later strict run of the same run refuses on the same rows again.
--
-- Run choice, trigger pause and updated_at: as reverse-media-urls.sql. The DO
-- block below is a copy of the one in reverse-media-urls.sql (the mode comes
-- from the setting on the next line; tests/unit/rewrite-sql.test.ts keeps the
-- two blocks equal).
select set_config('clickit.reverse_mode', 'partial', false) as reverse_mode;

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
