-- MEDIA-08 report (read-only), run after rewrite-media-urls.sql and
-- scan-old-hosts.sql (runbook Steps 50-52). Three reads:
--   1. backup rows per table/column for the newest run (rows, restored rows);
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
  min(b.created_at) as first_at
from private.media_url_rewrite_backup b
join newest n on n.run_id = b.run_id
group by b.run_id, table_name, column_name
order by table_name, column_name;

select s.id, s.slug, s.poster_url
from public.shows s
where s.poster_url ~* 'picsum\.photos'
order by s.slug;

select count(*) as audit_rows_with_old_host
from public.admin_audit_log a
where to_jsonb(a)::text ~* 'supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev';

select a.id, a.created_at, a.action_type, a.entity_type, a.entity_id
from public.admin_audit_log a
where to_jsonb(a)::text ~* 'supabase\.co/storage/v1/|clickit-media\.[a-z0-9-]+\.workers\.dev'
order by a.created_at;
