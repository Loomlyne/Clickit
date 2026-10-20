select json_build_object(
 'admin_funcs', (select json_agg(json_build_object('fn', n.nspname||'.'||p.proname, 'secdef', p.prosecdef, 'body', p.prosrc)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname ilike '%admin%' and n.nspname in ('public','private')),
 'policies_by_check', (select json_agg(x) from (select case when coalesce(qual,'')||coalesce(with_check,'') ilike '%private.is_admin%' then 'private.is_admin()' when coalesce(qual,'')||coalesce(with_check,'') ilike '%is_admin%' then 'other is_admin' when coalesce(qual,'')||coalesce(with_check,'') ilike '%admin%' then 'other admin ref' else 'no admin ref' end as admin_check, schemaname, count(*) n from pg_policies group by 1,2 order by 2,1) x),
 'admin_policy_list', (select json_agg(schemaname||'.'||tablename||' :: '||policyname order by 1) from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ilike '%admin%'),
 'app_config_admin', (select count(*) filter (where admin_user_id is not null) from public.app_config),
 'url_columns', (select json_agg(table_schema||'.'||table_name||'.'||column_name||' '||data_type order by 1) from information_schema.columns where table_schema in ('public') and (column_name ~* '(url|image|avatar|poster|thumbnail|video|logo|favicon|banner|cover|photo|media|og_|icon)')),
 'jsonb_columns', (select json_agg(table_schema||'.'||table_name||'.'||column_name order by 1) from information_schema.columns where table_schema='public' and data_type in ('jsonb','json')),
 'storage_buckets', (select json_agg(json_build_object('id',b.id,'public',b.public,'objects',(select count(*) from storage.objects o where o.bucket_id=b.id))) from storage.buckets b),
 'auth_users', (select count(*) from auth.users),
 'pg_version', version()
) as audit
