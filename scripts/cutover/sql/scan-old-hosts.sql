-- MEDIA-08 read-back (read-only, one statement): every text, varchar, json,
-- jsonb and array column of every base table in public and auth that still
-- holds an old media host. Expect zero rows after rewrite-media-urls.sql.
--
-- Old media host = a Supabase Storage path or a Phase 2 media Worker host
-- (clickit-media, and clickit-media-r2 = the Phase 2 option A test host):
--   supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev
-- Other workers.dev values and a bare project ref elsewhere are not media and
-- are not counted. public.admin_audit_log is excluded (D-19: audit history is
-- not rewritten); report.sql counts its old-host rows separately. The private
-- schema (the backup table) and views are not scanned.
select table_schema, table_name, column_name, hits from (
  select c.table_schema, c.table_name, c.column_name,
    (xpath('/row/n/text()', query_to_xml(format(
      'select count(*) as n from %I.%I where %I::text ~* %L',
      c.table_schema, c.table_name, c.column_name,
      'supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev'), false, true, '')))[1]::text::int as hits
  from information_schema.columns c
  where c.table_schema in ('public', 'auth')
    and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
    and not (c.table_schema = 'public' and c.table_name = 'admin_audit_log')
    and c.table_name in (
      select t.table_name from information_schema.tables t
      where t.table_schema = c.table_schema and t.table_type = 'BASE TABLE')
) s
where hits > 0
order by table_schema, table_name, column_name;
