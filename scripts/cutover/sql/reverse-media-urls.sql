-- MEDIA-08 reverse (UPDATE only): put back every value of one rewrite run from
-- private.media_url_rewrite_backup and mark each backup row restored_at.
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
-- One DO block = one atomic statement. Each value is written back only while
-- the row still holds the value the rewrite wrote (to_jsonb(col) = new_value);
-- if an admin changed it since, the whole reverse raises and changes nothing.
do $reverse$
declare
  v_set text := nullif(current_setting('clickit.rewrite_run_id', true), '');
  v_run uuid;
  v_open bigint;
  b record;
  v_typ text;
  v_one bigint;
  v_n bigint := 0;
begin
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

  for b in
    select * from private.media_url_rewrite_backup
    where run_id = v_run and restored_at is null
    order by id
  loop
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
    if v_one <> 1 then
      raise exception 'reverse: row % of %.% is no longer at the rewritten value', b.row_pk, b.table_name, b.column_name;
    end if;

    update private.media_url_rewrite_backup set restored_at = now() where id = b.id;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'reverse: run % has no rows left to restore', v_run;
  end if;
  raise notice 'reverse: run_id % restored % value(s)', v_run, v_n;
end $reverse$;
