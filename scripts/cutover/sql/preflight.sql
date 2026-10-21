-- MEDIA-08 preflight (read-only). Run on live by the controller before
-- rewrite-media-urls.sql (runbook Step 47). Six reads:
--
--   1. the login role: can it write under RLS (rolsuper or rolbypassrls, or
--      it owns the tables)?
--   1b. [role] what the rewrite and the reverse need from the current role,
--      one row with a verdict: USAGE on schema private; SELECT, INSERT and
--      UPDATE on private.media_url_rewrite_backup (the rewrite inserts and
--      reads it, the reverse sets restored_at / reverse_skipped_at); SELECT
--      and UPDATE on every driver table; ownership of every driver table (the
--      rewrite and the reverse pause the updated_at triggers with
--      alter table ... disable trigger inside their own transaction, which
--      needs the owner); RLS bypass (rolsuper, rolbypassrls or owner of the
--      backup table, which has RLS on and no policy). Any false => verdict
--      "stop: role cannot run the rewrite".
--   1c. [triggers] every user trigger on the driver tables. Expected exactly
--      the four updated_at triggers, enabled ('O'): app_config.set_updated_at,
--      shows.set_updated_at, profiles.set_updated_at, shorts.shorts_updated_at
--      (show_cast has none). Any other trigger would fire on the rewrite, a
--      disabled one would be switched on by it => "stop: plan revision".
--   2. the server version (local proof ran on PostgreSQL 17.x).
--   3. per D-09 driver column: values on an old media host (old_host), values
--      the rewrite would change (rewritable) and old-host values the rewrite
--      can NOT convert (not_rewritable): Storage render/image or object/sign
--      paths, a bucket other than show-artwork/site-assets/avatars, a
--      clickit-media or clickit-media-r2 workers.dev host with another
--      subdomain, a URL inside
--      prose. Any not rewritable value => verdict "stop: plan revision".
--   4. the DB-wide old-host scan restricted to columns that are NOT driver
--      columns and not public.admin_audit_log (D-19). Any row here means an
--      old-host value the rewrite would never touch => "stop: plan revision".
--
-- Old media host pattern (same as scan-old-hosts.sql):
--   supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev
-- The rewrite regexes and replacement below are copied from
-- rewrite-media-urls.sql (tests/unit/rewrite-sql.test.ts keeps them equal).
-- The [marker] comments let scripts/cutover/sql/test-local.sql run each block.

select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user;

-- [role:begin]
with drv(tbl) as (values ('app_config'), ('shows'), ('show_cast'), ('profiles'), ('shorts')),
r as (
  select
    current_user::text as login_role,
    (select has_schema_privilege(current_user, n.oid, 'USAGE') from pg_namespace n where n.nspname = 'private') as private_usage,
    has_table_privilege(current_user, to_regclass('private.media_url_rewrite_backup'), 'SELECT') as backup_select,
    has_table_privilege(current_user, to_regclass('private.media_url_rewrite_backup'), 'INSERT') as backup_insert,
    has_table_privilege(current_user, to_regclass('private.media_url_rewrite_backup'), 'UPDATE') as backup_update,
    (select rolsuper or rolbypassrls from pg_roles where rolname = current_user)
      or coalesce((select pg_has_role(current_user, c.relowner, 'USAGE') from pg_class c
                   where c.oid = to_regclass('private.media_url_rewrite_backup')), false) as backup_rls_bypass,
    (select bool_and(coalesce(has_table_privilege(current_user, to_regclass(format('public.%I', d.tbl)), 'SELECT'), false)
                 and coalesce(has_table_privilege(current_user, to_regclass(format('public.%I', d.tbl)), 'UPDATE'), false))
       from drv d) as driver_select_update,
    (select bool_and(coalesce((select pg_has_role(current_user, c.relowner, 'USAGE') from pg_class c
                               where c.oid = to_regclass(format('public.%I', d.tbl))), false))
       from drv d) as driver_owner
)
select r.*,
  case when coalesce(r.private_usage and r.backup_select and r.backup_insert and r.backup_update
                     and r.backup_rls_bypass and r.driver_select_update and r.driver_owner, false)
    then 'ok' else 'stop: role cannot run the rewrite' end as verdict
from r;
-- [role:end]

-- [triggers:begin]
select c.relname::text as table_name, g.tgname::text as trigger_name, g.tgenabled::text as enabled,
  case when (c.relname::text, g.tgname::text) in (values
      ('app_config', 'set_updated_at'),
      ('shows', 'set_updated_at'),
      ('profiles', 'set_updated_at'),
      ('shorts', 'shorts_updated_at'))
    and g.tgenabled = 'O'
    then 'ok (paused inside the rewrite and the reverse)' else 'stop: plan revision' end as verdict
from pg_trigger g
join pg_class c on c.oid = g.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not g.tgisinternal
  and c.relname in ('app_config', 'shows', 'show_cast', 'profiles', 'shorts')
order by 1, 2;
-- [triggers:end]

select version();

-- [not-rewritable:begin]
with rx as (
  select
    'https://lajguozmtissnnfccmej\.supabase\.co/storage/v1/object/public/(show-artwork|site-assets|avatars)/'::text as rx1,
    'https://clickit-media\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/'::text as rx2,
    'https://clickit-media-r2\.clickitstory\.workers\.dev/(show-artwork|site-assets|avatars)/'::text as rx3,
    'https://media.clickitstory.ae/\1/'::text as repl,
    'supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev'::text as old_host
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
        'regexp_replace(regexp_replace(regexp_replace(t.%1$I, %2$L, %5$L), %3$L, %5$L), %4$L, %5$L)',
        d.col, '^' || rx.rx1, '^' || rx.rx2, '^' || rx.rx3, rx.repl)
      else format(
        'regexp_replace(regexp_replace(regexp_replace(t.%1$I::text, %2$L, %5$L, ''g''), %3$L, %5$L, ''g''), %4$L, %5$L, ''g'')::jsonb',
        d.col, '"' || rx.rx1, '"' || rx.rx2, '"' || rx.rx3, '"' || rx.repl) end as expr
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
      'supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev'), false, true, '')))[1]::text::int as hits
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
