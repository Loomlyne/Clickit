-- MEDIA-08 local proof (plan 03-05 Task 2). LOCAL STACK ONLY, never live.
--
-- Run by scripts/cutover/sql/test-local.sh under the heavy lock:
--   docker exec -i supabase_db_Clickit psql -U postgres -v ON_ERROR_STOP=1 \
--     -f /tmp/clickit-cutover-sql/test-local.sql
-- test-local.sh copies scripts/cutover/sql/*.sql and the backup-table
-- migration (as migration_media_url_rewrite_backup.sql) into
-- /tmp/clickit-cutover-sql/ inside the container first.
--
-- Everything runs inside ONE transaction that ends with rollback: the
-- migration, fixtures (UPDATEs of existing local rows, plus one auth audit row
-- when no local user exists), preflight, rewrite, scan, report, reverse and a
-- byte-identical before/after compare of every row of the driver tables.
-- Then a second rewrite is reversed through the "single open run" path, and
-- the "more than one open run" refusal is checked.

\set ON_ERROR_STOP 1
\echo test-local: start
begin;

-- The real files, read as text so the assertions run the shipped SQL.
\set scan_sql `cat /tmp/clickit-cutover-sql/scan-old-hosts.sql`
\set preflight_sql `cat /tmp/clickit-cutover-sql/preflight.sql`
select set_config('test.scan_sql', :'scan_sql', true) is not null as scan_loaded,
       set_config('test.preflight_sql', :'preflight_sql', true) is not null as preflight_loaded;

-- 1. Migration (inside the transaction; rolled back at the end).
\ir migration_media_url_rewrite_backup.sql
\ir check-backup-table.sql

-- 2. Preconditions on the local data.
do $pre$
declare
  v_scan text := regexp_replace(current_setting('test.scan_sql'), ';\s*$', '');
  v_hits text;
begin
  if (select count(*) from public.shows) = 0 then
    raise exception 'local stack has no shows rows: run supabase db reset --local first';
  end if;
  if (select count(*) from public.shows) < 2 then
    raise exception 'local stack has fewer than 2 shows rows: run supabase db reset --local first';
  end if;
  if not exists (select 1 from public.app_config where id = 1) then
    raise exception 'local stack has no app_config row 1: run supabase db reset --local first';
  end if;
  if not exists (select 1 from public.show_cast) then
    raise exception 'local stack has no show_cast rows: run supabase db reset --local first';
  end if;
  execute format('select string_agg(format(''%%s.%%s.%%s=%%s'', table_schema, table_name, column_name, hits), '','' order by table_schema, table_name, column_name) from (%s
) s', v_scan) into v_hits;
  if v_hits is not null then
    raise exception 'local stack already holds old-host values (%): the planted counts would be wrong', v_hits;
  end if;
end $pre$;

-- 3. Fixtures: UPDATEs of existing rows.
create temp table fx as
select (select id from public.shows order by slug limit 1) as show_a,
       (select id from public.shows order by slug offset 1 limit 1) as show_b,
       (select id from public.show_cast order by id limit 1) as cast_a;

-- show A: Supabase Storage URLs with ?v=, one clickit-media and one
-- clickit-media-r2 (Phase 2 option A test host) Worker URL (5 values)
update public.shows s set
  hero_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/show-artwork/fx/hero.webp?v=11',
  card_image_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/show-artwork/fx/card.webp?v=12',
  poster_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/show-artwork/fx/poster.webp?v=13',
  hero_image_mobile_url = 'https://clickit-media.clickitstory.workers.dev/show-artwork/fx/hero-m.webp?v=14',
  hero_video_url = 'https://clickit-media-r2.clickitstory.workers.dev/show-artwork/fx/hero.mp4?v=15'
from fx where s.id = fx.show_a;

-- show B: picsum poster (D-10, left alone), a bucket the rewrite does not know
-- and a clickit-media-r2 host on another subdomain (both not rewritable)
update public.shows s set
  poster_url = 'https://picsum.photos/seed/clickit-fx/400/600',
  card_image_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/other-bucket/fx/card.webp',
  logo_url = 'https://clickit-media-r2.other-sub.workers.dev/show-artwork/fx/logo.png'
from fx where s.id = fx.show_b;

-- one cast image (1 value)
update public.show_cast c set
  image_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/avatars/fx/cast.png'
from fx where c.id = fx.cast_a;

-- app_config: two text columns and the footer legal links (3 values)
update public.app_config set
  favicon_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/fx/favicon.png?v=2',
  og_image_url = 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/fx/og.jpg',
  footer_content = jsonb_set(jsonb_set(jsonb_set(footer_content,
    '{legal,privacy}', '"https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/legal/privacy.pdf"'),
    '{legal,terms}', '"https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/legal/terms.pdf?v=3"'),
    '{legal,cookies}', '"https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/site-assets/legal/cookies.pdf"')
where id = 1;

-- auth: a value that contains workers.dev but is NOT media (the scan must ignore it)
do $auth$
begin
  if exists (select 1 from auth.users) then
    update auth.users set raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb) || '{"site": "https://some-app.someone.workers.dev/x"}'::jsonb
    where id = (select id from auth.users order by id limit 1);
  else
    insert into auth.audit_log_entries (id, payload, created_at)
    values (gen_random_uuid(), '{"site": "https://some-app.someone.workers.dev/x"}'::json, now());
  end if;
end $auth$;

-- 4. Snapshot of every row of the driver tables.
create temp view cur as
  select 'app_config' as tbl, t.id::text as id, to_jsonb(t) as doc from public.app_config t
  union all select 'shows', t.id::text, to_jsonb(t) from public.shows t
  union all select 'show_cast', t.id::text, to_jsonb(t) from public.show_cast t
  union all select 'profiles', t.id::text, to_jsonb(t) from public.profiles t
  union all select 'shorts', t.id::text, to_jsonb(t) from public.shorts t;
create temp table snap as select * from cur;

-- 5. Preflight: the whole file runs, then its not-rewritable and outside-driver
--    blocks are asserted.
\ir preflight.sql

do $preflight$
declare
  v_pf text := current_setting('test.preflight_sql');
  v_nr text := regexp_replace(substring(v_pf from '-- \[not-rewritable:begin\](.*)-- \[not-rewritable:end\]'), ';\s*$', '');
  v_od text := regexp_replace(substring(v_pf from '-- \[outside-driver:begin\](.*)-- \[outside-driver:end\]'), ';\s*$', '');
  v_nr_cols text;
  v_nr_total bigint;
  v_rewritable bigint;
  v_od_hits text;
begin
  if v_nr is null or v_od is null then
    raise exception 'test-local: preflight markers not found';
  end if;
  execute format('select string_agg(format(''%%s.%%s=%%s'', table_name, column_name, not_rewritable), '','' order by table_name, column_name) filter (where not_rewritable > 0),
                         sum(not_rewritable), sum(rewritable) from (%s
) s', v_nr) into v_nr_cols, v_nr_total, v_rewritable;
  if v_nr_cols is distinct from 'shows.card_image_url=1,shows.logo_url=1' or v_nr_total <> 2 then
    raise exception 'test-local: preflight not rewritable = % (total %), expected shows.card_image_url=1,shows.logo_url=1', v_nr_cols, v_nr_total;
  end if;
  if v_rewritable <> 9 then
    raise exception 'test-local: preflight rewritable = %, expected 9', v_rewritable;
  end if;
  execute format('select string_agg(format(''%%s.%%s.%%s=%%s'', table_schema, table_name, column_name, hits), '','' order by table_schema, table_name, column_name) from (%s
) s', v_od) into v_od_hits;
  if v_od_hits is not null then
    raise exception 'test-local: preflight outside-driver hits %, expected none', v_od_hits;
  end if;
  raise notice 'test-local: preflight ok (not rewritable shows.card_image_url=1 and shows.logo_url=1, rewritable 9, outside-driver 0)';
end $preflight$;

-- 6. Rewrite (run 1).
\ir rewrite-media-urls.sql

do $after_rewrite$
declare
  v_run uuid := current_setting('clickit.rewrite_run_id')::uuid;
  v_scan text := regexp_replace(current_setting('test.scan_sql'), ';\s*$', '');
  v_cnt bigint;
  v_hits text;
  a record;
  b record;
  f jsonb;
  f0 jsonb;
begin
  select count(*) into v_cnt from private.media_url_rewrite_backup where run_id = v_run;
  if v_cnt <> 9 then
    raise exception 'test-local: backup rows % for run %, expected 9 planted values', v_cnt, v_run;
  end if;

  select s.* into a from public.shows s join fx on s.id = fx.show_a;
  if a.hero_url <> 'https://media.clickitstory.ae/show-artwork/fx/hero.webp?v=11'
     or a.card_image_url <> 'https://media.clickitstory.ae/show-artwork/fx/card.webp?v=12'
     or a.poster_url <> 'https://media.clickitstory.ae/show-artwork/fx/poster.webp?v=13'
     or a.hero_image_mobile_url <> 'https://media.clickitstory.ae/show-artwork/fx/hero-m.webp?v=14'
     or a.hero_video_url <> 'https://media.clickitstory.ae/show-artwork/fx/hero.mp4?v=15' then
    raise exception 'test-local: show A not rewritten as expected (?v= kept): %', to_jsonb(a);
  end if;

  select s.* into b from public.shows s join fx on s.id = fx.show_b;
  if b.poster_url <> 'https://picsum.photos/seed/clickit-fx/400/600'
     or b.card_image_url <> 'https://lajguozmtissnnfccmej.supabase.co/storage/v1/object/public/other-bucket/fx/card.webp'
     or b.logo_url <> 'https://clickit-media-r2.other-sub.workers.dev/show-artwork/fx/logo.png' then
    raise exception 'test-local: picsum, other-bucket or other-subdomain value was touched: %', to_jsonb(b);
  end if;

  if (select image_url from public.show_cast c join fx on c.id = fx.cast_a)
     <> 'https://media.clickitstory.ae/avatars/fx/cast.png' then
    raise exception 'test-local: show_cast image not rewritten';
  end if;

  select footer_content into f from public.app_config where id = 1;
  select s.doc -> 'footer_content' into f0 from snap s where s.tbl = 'app_config' and s.id = '1';
  if f #>> '{legal,terms}' <> 'https://media.clickitstory.ae/site-assets/legal/terms.pdf?v=3'
     or f #>> '{legal,privacy}' <> 'https://media.clickitstory.ae/site-assets/legal/privacy.pdf'
     or not (f ? 'tagline' and f ? 'social' and f ? 'legal')
     or (select count(*) from jsonb_path_query(f, 'strict $.**'))
        <> (select count(*) from jsonb_path_query(f0, 'strict $.**')) then
    raise exception 'test-local: footer_content not rewritten or shape changed: %', f;
  end if;
  if (select favicon_url from public.app_config where id = 1)
     <> 'https://media.clickitstory.ae/site-assets/fx/favicon.png?v=2' then
    raise exception 'test-local: favicon_url not rewritten';
  end if;

  if (select count(*) from public.shorts where thumbnail_url ~ 'media\.clickitstory\.ae') > 0 then
    raise exception 'test-local: shorts thumbnails were touched';
  end if;

  -- scan: exactly the two planted not-rewritable columns; the auth workers.dev value is ignored
  execute format('select string_agg(format(''%%s.%%s.%%s=%%s'', table_schema, table_name, column_name, hits), '','' order by table_schema, table_name, column_name) from (%s
) s', v_scan) into v_hits;
  if v_hits is distinct from 'public.shows.card_image_url=1,public.shows.logo_url=1' then
    raise exception 'test-local: scan after rewrite = %, expected public.shows.card_image_url=1,public.shows.logo_url=1', v_hits;
  end if;
  if (select count(*) from auth.audit_log_entries where payload::text ~ 'workers\.dev')
     + (select count(*) from auth.users where raw_user_meta_data::text ~ 'workers\.dev') = 0 then
    raise exception 'test-local: the non-media workers.dev fixture is missing';
  end if;
  raise notice 'test-local: rewrite ok (9 backup rows incl. clickit-media-r2, ?v= kept, picsum, other-bucket and other-subdomain untouched, footer leaves equal, scan = shows.card_image_url and shows.logo_url)';
end $after_rewrite$;

\ir scan-old-hosts.sql
\ir report.sql
\ir check-backup-table.sql

-- 7. Reverse run 1 (run id from the setting the rewrite left).
\ir reverse-media-urls.sql

do $after_reverse$
declare
  v_run uuid := current_setting('clickit.rewrite_run_id')::uuid;
  v_diff bigint;
  v_open bigint;
  v_rows bigint;
begin
  select count(*) into v_rows from snap;
  select count(*) into v_diff
  from snap s full join cur c on c.tbl = s.tbl and c.id = s.id
  where c.doc is distinct from s.doc;
  if v_diff <> 0 then
    raise exception 'test-local: % row(s) differ from the snapshot after reverse', v_diff;
  end if;
  select count(*) into v_open from private.media_url_rewrite_backup where run_id = v_run and restored_at is null;
  if v_open <> 0 then
    raise exception 'test-local: % backup row(s) without restored_at', v_open;
  end if;
  raise notice 'test-local: reverse ok (% snapshot rows byte-identical, every backup row restored)', v_rows;
end $after_reverse$;

-- 8. Run 2: reverse through the "single open run" path (setting cleared), and
--    the refusal when more than one run is open.
\ir rewrite-media-urls.sql

select set_config('test.run2', current_setting('clickit.rewrite_run_id'), true) is not null as run2_kept,
       set_config('clickit.rewrite_run_id', '', true) = '' as run_id_cleared;

-- a second open run (test only, rolled back) so the reverse must refuse
insert into private.media_url_rewrite_backup (run_id, table_name, column_name, row_pk, old_value, new_value)
values (gen_random_uuid(), 'shows', 'logo_url', '{"id": "00000000-0000-0000-0000-000000000000"}', '"x"', '"y"');

\echo test-local: the next ERROR (two open runs) is expected
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
\ir reverse-media-urls.sql
\set ON_ERROR_ROLLBACK off
\set ON_ERROR_STOP 1
select set_config('test.last_error', :'LAST_ERROR_MESSAGE', true) is not null as error_kept;

do $refusal$
begin
  if current_setting('test.last_error') not like 'reverse: 2 open runs%' then
    raise exception 'test-local: reverse did not refuse two open runs (last error: %)', current_setting('test.last_error');
  end if;
  raise notice 'test-local: two open runs refused ok';
end $refusal$;

update private.media_url_rewrite_backup set restored_at = now()
where run_id <> current_setting('test.run2')::uuid and restored_at is null;

\ir reverse-media-urls.sql

do $after_reverse2$
declare
  v_run uuid := current_setting('test.run2')::uuid;
  v_diff bigint;
  v_cnt bigint;
  v_open bigint;
begin
  select count(*), count(*) filter (where restored_at is null) into v_cnt, v_open
  from private.media_url_rewrite_backup where run_id = v_run;
  if v_cnt <> 9 or v_open <> 0 then
    raise exception 'test-local: run 2 has % rows, % open; expected 9 and 0', v_cnt, v_open;
  end if;
  select count(*) into v_diff
  from snap s full join cur c on c.tbl = s.tbl and c.id = s.id
  where c.doc is distinct from s.doc;
  if v_diff <> 0 then
    raise exception 'test-local: % row(s) differ from the snapshot after the single-open-run reverse', v_diff;
  end if;
  raise notice 'test-local: single-open-run reverse ok (run 2, 9 values, byte-identical)';
  raise notice 'test-local: PASS';
end $after_reverse2$;

rollback;
\echo test-local: rolled back
