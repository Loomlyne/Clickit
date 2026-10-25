-- MEDIA-08 report (read-only), run after rewrite-media-urls.sql and
-- scan-old-hosts.sql (runbook Steps 50-52). Four reads:
--   1. backup rows per table/column for the newest run (rows, restored rows,
--      rows a partial reverse skipped);
--   1b. the skipped rows of the newest run with the reason (a value an admin
--      changed after the rewrite, or a row that is gone), empty unless
--      reverse-media-urls-partial.sql ran;
--   2. shows still on picsum.photos posters (D-10: left as they are, listed);
--   3. public.admin_audit_log rows that mention an old media host (D-19: audit
--      history is not rewritten and not part of "zero old-host URLs").

with newest as (
  select run_id from private.media_url_rewrite_backup
  group by run_id
  order by max(created_at) desc
  limit 1
)
select b.run_id, table_name, column_name,
  count(*) as backed_up, count(b.restored_at) as restored,
  count(b.reverse_skipped_at) as skipped,
  min(b.created_at) as first_at
from private.media_url_rewrite_backup b
join newest n on n.run_id = b.run_id
group by b.run_id, table_name, column_name
order by table_name, column_name;

with newest as (
  select run_id from private.media_url_rewrite_backup
  group by run_id
  order by max(created_at) desc
  limit 1
)
select b.table_name, b.column_name, b.row_pk ->> 'id' as row_id,
  b.reverse_skip_reason, b.reverse_skipped_at
from private.media_url_rewrite_backup b
join newest n on n.run_id = b.run_id
where b.reverse_skipped_at is not null and b.restored_at is null
order by b.table_name, b.column_name, row_id;

select s.id, s.slug, s.poster_url
from public.shows s
where s.poster_url ~* 'picsum\.photos'
order by s.slug;

select count(*) as audit_rows_with_old_host
from public.admin_audit_log a
where to_jsonb(a)::text ~* 'supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev';

select a.id, a.created_at, a.action_type, a.entity_type, a.entity_id
from public.admin_audit_log a
where to_jsonb(a)::text ~* 'supabase\.co/storage/v1/|clickit-media(-r2)?\.[a-z0-9-]+\.workers\.dev'
order by a.created_at;
