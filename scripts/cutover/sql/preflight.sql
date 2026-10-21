-- MEDIA-08 preflight (read-only). Run on live by the controller before
-- rewrite-media-urls.sql (runbook Step 47). Four reads:
--
--   1. the login role: can it write under RLS (rolsuper or rolbypassrls, or
--      it owns the tables)?
--   2. the server version (local proof ran on PostgreSQL 17.x).
--   3. per D-09 driver column: values on an old media host (old_host), values
--      the rewrite would change (rewritable) and old-host values the rewrite
--      can NOT convert (not_rewritable): Storage render/image or object/sign
--      paths, a bucket other than show-artwork/site-assets/avatars, a
--      clickit-media workers.dev host with another subdomain, a URL inside
--      prose. Any not rewritable value => verdict "stop: plan revision".
--   4. the DB-wide old-host scan restricted to columns that are NOT driver
--      columns and not public.admin_audit_log (D-19). Any row here means an
--      old-host value the rewrite would never touch => "stop: plan revision".
--
-- Old media host pattern (same as scan-old-hosts.sql):
--   supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev
-- The rewrite regexes and replacement below are copied from
-- rewrite-media-urls.sql (tests/unit/rewrite-sql.test.ts keeps them equal).
-- The [marker] comments let scripts/cutover/sql/test-local.sql run each block.

select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user;

select version();

-- [not-rewritable:begin]
with rx as (
  select
    'https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/'::text as rx1,
    'https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/'::text as rx2,
    'https://media.clickitstory.ae/\1/'::text as repl,
    'supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev'::text as old_host
),
driver(tbl, col, typ) as (values
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
  ('shorts', 'thumbnail_url', 'text')
),
probe as (
  select d.tbl, d.col, rx.old_host,
    case d.typ
      when 'text' then format(
        'regexp_replace(regexp_replace(t.%1$I, %2$L, %4$L), %3$L, %4$L)',
        d.col, '^' || rx.rx1, '^' || rx.rx2, rx.repl)
      else format(
        'regexp_replace(regexp_replace(t.%1$I::text, %2$L, %4$L, ''g''), %3$L, %4$L, ''g'')::jsonb',
        d.col, '"' || rx.rx1, '"' || rx.rx2, '"' || rx.repl) end as expr
  from driver d cross join rx
),
counted as (
  select p.tbl, p.col, query_to_xml(format(
    'select count(*) filter (where t.%1$I::text ~* %2$L) as old_host,
            count(*) filter (where t.%1$I is not null and (%3$s) is distinct from t.%1$I) as rewritable,
            count(*) filter (where t.%1$I::text ~* %2$L and (%3$s)::text ~* %2$L) as not_rewritable
       from public.%4$I t',
    p.col, p.old_host, p.expr, p.tbl), false, true, '') as x
  from probe p
)
select tbl as table_name, col as column_name,
  (xpath('/row/old_host/text()', x))[1]::text::int as old_host,
  (xpath('/row/rewritable/text()', x))[1]::text::int as rewritable,
  (xpath('/row/not_rewritable/text()', x))[1]::text::int as not_rewritable,
  case when (xpath('/row/not_rewritable/text()', x))[1]::text::int > 0
    then 'stop: plan revision' else 'ok' end as verdict
from counted
order by table_name, column_name;
-- [not-rewritable:end]

-- [outside-driver:begin]
with driver(tbl, col, typ) as (values
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
  ('shorts', 'thumbnail_url', 'text')
)
select table_schema, table_name, column_name, hits, 'stop: plan revision' as verdict from (
  select c.table_schema, c.table_name, c.column_name,
    (xpath('/row/n/text()', query_to_xml(format(
      'select count(*) as n from %I.%I where %I::text ~* %L',
      c.table_schema, c.table_name, c.column_name,
      'supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev'), false, true, '')))[1]::text::int as hits
  from information_schema.columns c
  where c.table_schema in ('public', 'auth')
    and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
    and not (c.table_schema = 'public' and c.table_name = 'admin_audit_log')
    and not (c.table_schema = 'public'
      and (c.table_name::text, c.column_name::text) in (select d.tbl, d.col from driver d))
    and c.table_name in (
      select t.table_name from information_schema.tables t
      where t.table_schema = c.table_schema and t.table_type = 'BASE TABLE')
) s
where hits > 0
order by table_schema, table_name, column_name;
-- [outside-driver:end]
