-- ============================================================
-- Public episode/config least privilege and atomic episode ordering
--
-- `youtube_api_key` is a server-only value. Keep the legacy column during the
-- application cutover so the current server-side YouTube metadata route keeps
-- working. It is removed only after YOUTUBE_API_KEY is configured everywhere.
--
-- Verification after applying:
--   select has_column_privilege('anon', 'public.episodes',
--     'youtube_video_id', 'select'); -- false
--   select has_column_privilege('authenticated', 'public.episodes',
--     'youtube_video_id', 'select'); -- false
--   select has_table_privilege('anon', 'public.episodes_view', 'select');
--     -- true
--   select to_regprocedure('public.is_admin()') is null; -- true
--   select has_function_privilege('anon', 'public.reorder_episode(uuid,text)',
--     'execute'); -- false
--   select has_function_privilege('service_role',
--     'public.reorder_episode(uuid,text)', 'execute'); -- true
--
-- The legacy key may have been exposed through the Data API. Revoke and rotate
-- it in Google Cloud, then set the replacement YOUTUBE_API_KEY in every server
-- deployment. This migration revokes browser-role access but deliberately does
-- not drop the column, because the current production app still reads it with
-- the service-role client. A later expand/contract migration can drop it after
-- the environment cutover is verified.
-- ============================================================

-- Keep youtube_api_key out of all browser-role grants below. The service-role
-- client used by the server-only YouTube helper is not affected by these
-- revokes, so existing metadata lookups continue to work during the cutover.
grant select (youtube_api_key) on table public.app_config to service_role;

-- app_config has a public row for site rendering, but that does not justify
-- broad table privileges. Future sensitive columns are fail-closed until a
-- migration explicitly approves them below.
revoke all on table public.app_config from public, anon, authenticated;
grant select (
  id,
  created_at,
  updated_at,
  hero_video_url,
  hero_video_type,
  site_title,
  site_description,
  site_tagline,
  og_image_url,
  favicon_url,
  footer_content,
  cta_copy,
  genre_config,
  google_analytics_id,
  meta_pixel_id,
  feature_flags,
  top_ticker,
  live_stream_url,
  hero_description,
  favicon_dark_url,
  hero_description_ar,
  portfolio_heading,
  portfolio_heading_ar,
  site_tagline_ar,
  site_description_ar,
  hero_video_muted,
  hero_video_mobile_url,
  hero_video_mobile_type,
  auth_image_url,
  auth_heading,
  auth_heading_ar,
  auth_subheading,
  auth_subheading_ar,
  auth_quote,
  auth_quote_ar,
  auth_quote_attribution,
  auth_quote_attribution_ar,
  auth_allow_skip,
  live_stream_label,
  live_stream_label_ar,
  preloader_video_url
) on table public.app_config to anon, authenticated;

-- Server-side admin guards read this identifier through an authenticated
-- Supabase client. Keep it unavailable to anon while preserving that check.
grant select (admin_user_id) on table public.app_config to authenticated;

-- The base table remains available for the public queries that need published
-- metadata, but neither the unlisted FTS vector nor the playback identifier
-- can be selected directly. episodes_view owns public playback disclosure.
revoke all on table public.episodes from public, anon, authenticated;
grant select (
  id,
  show_id,
  season_id,
  episode_number,
  title,
  title_ar,
  description,
  description_ar,
  duration,
  status,
  publish_at,
  archived,
  created_at,
  updated_at
) on table public.episodes to anon, authenticated;

-- Preserve the existing protected playback boundary. security_invoker means
-- the view continues to obey episode RLS, while its protected function is the
-- sole way public callers can receive an effectively-live YouTube identifier.
alter view public.episodes_view set (security_invoker = true);
revoke all on table public.episodes_view from public, anon, authenticated;
grant select on table public.episodes_view to anon, authenticated;

create or replace function public.get_public_youtube_video_id(p_episode_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when e.status = 'published'
      or (
        e.status = 'coming-soon'
        and e.publish_at is not null
        and e.publish_at <= now()
      )
    then e.youtube_video_id
    else null
  end
  from public.episodes e
  join public.shows s on s.id = e.show_id
  where e.id = p_episode_id
    and e.archived = false
    and e.status in ('published', 'coming-soon')
    and s.archived = false
    and s.status in ('now-streaming', 'coming-soon');
$$;

revoke all on function public.get_public_youtube_video_id(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_youtube_video_id(uuid)
  to anon, authenticated;

-- Keep the admin predicate usable inside existing RLS policies without
-- publishing it as a Data API RPC. At migration authoring time, `private` is
-- not an exposed PostgREST schema. anon/authenticated retain only the
-- schema/function permissions required when their RLS policies evaluate it.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = (
    select admin_user_id
    from public.app_config
    where id = 1
  )
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

-- Every current dependency of public.is_admin() is an RLS policy. Rebuild
-- those expressions with the private predicate before removing the public
-- RPC. Abort instead of dropping the old function if any dependency remains.
do $$
declare
  v_policy record;
  v_statement text;
  v_using text;
  v_with_check text;
begin
  if to_regprocedure('public.is_admin()') is null then
    return;
  end if;

  for v_policy in
    select
      p.oid,
      p.polname,
      n.nspname as schema_name,
      c.relname as table_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_policy'::regclass
        and d.objid = p.oid
        and d.refobjid = 'public.is_admin()'::regprocedure
    )
  loop
    -- Preserve an already-qualified historical expression as well as the
    -- normal pg_get_expr output, which is simply `is_admin()`.
    v_using := replace(
      replace(
        replace(v_policy.using_expression,
          'public.is_admin()', '__clickit_private_is_admin__'),
        'is_admin()', 'private.is_admin()'),
      '__clickit_private_is_admin__', 'private.is_admin()'
    );
    v_with_check := replace(
      replace(
        replace(v_policy.with_check_expression,
          'public.is_admin()', '__clickit_private_is_admin__'),
        'is_admin()', 'private.is_admin()'),
      '__clickit_private_is_admin__', 'private.is_admin()'
    );

    if (v_policy.using_expression is not null
        and v_using not like '%private.is_admin()%')
      or (v_policy.with_check_expression is not null
        and v_with_check not like '%private.is_admin()%') then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Could not safely move policy %I on %I.%I to private.is_admin()',
          v_policy.polname,
          v_policy.schema_name,
          v_policy.table_name
        );
    end if;

    v_statement := format(
      'alter policy %I on %I.%I',
      v_policy.polname,
      v_policy.schema_name,
      v_policy.table_name
    );
    if v_using is not null then
      v_statement := v_statement || format(' using (%s)', v_using);
    end if;
    if v_with_check is not null then
      v_statement := v_statement || format(' with check (%s)', v_with_check);
    end if;
    execute v_statement;
  end loop;

  if exists (
    select 1
    from pg_depend d
    where d.refobjid = 'public.is_admin()'::regprocedure
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'public.is_admin() still has dependencies after policy migration';
  end if;

  execute 'drop function public.is_admin()';
end;
$$;

-- The following functions are invoked only by database triggers or event
-- triggers, never by clients. Remove their direct RPC execution grants. The
-- ordinary updated_at triggers also receive a fixed safe search path.
alter function public.update_updated_at() set search_path = pg_catalog;
alter function public.update_shorts_updated_at() set search_path = pg_catalog;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.update_updated_at()
  from public, anon, authenticated;
revoke all on function public.update_shorts_updated_at()
  from public, anon, authenticated;

-- This event-trigger helper exists on the linked production database but was
-- not introduced through the tracked migration history. Guard it so a fresh
-- or staging database built from this repository remains deployable.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- A server action invokes this with the service_role client after its own
-- session/admin check. The function is security invoker and not callable by
-- browser roles. pg_advisory_xact_lock serializes changes within one season;
-- all statements in an RPC call run in the same transaction.
create or replace function public.reorder_episode(
  p_episode_id uuid,
  p_direction text
)
returns table (
  show_id uuid,
  season_id uuid,
  episode_id uuid,
  episode_number integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_season_id uuid;
  v_current public.episodes%rowtype;
  v_adjacent public.episodes%rowtype;
  v_temporary_number bigint;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception using
      errcode = '22023',
      message = 'Reorder direction must be up or down';
  end if;

  select e.season_id
  into v_season_id
  from public.episodes e
  where e.id = p_episode_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Episode not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_season_id::text, 3071971)
  );

  select e.*
  into v_current
  from public.episodes e
  where e.id = p_episode_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Episode not found';
  end if;

  if v_current.archived then
    raise exception using
      errcode = 'P0001',
      message = 'Archived episodes cannot be reordered';
  end if;

  if p_direction = 'up' then
    select e.*
    into v_adjacent
    from public.episodes e
    where e.season_id = v_current.season_id
      and e.archived = false
      and e.episode_number < v_current.episode_number
    order by e.episode_number desc
    limit 1
    for update;
  else
    select e.*
    into v_adjacent
    from public.episodes e
    where e.season_id = v_current.season_id
      and e.archived = false
      and e.episode_number > v_current.episode_number
    order by e.episode_number asc
    limit 1
    for update;
  end if;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No adjacent active episode to swap with';
  end if;

  -- The unique (season_id, episode_number) constraint is immediate. Reserve a
  -- temporary number outside the complete season range before swapping.
  select min(e.episode_number)::bigint - 1
  into v_temporary_number
  from public.episodes e
  where e.season_id = v_current.season_id;

  if v_temporary_number < -2147483648 then
    raise exception using
      errcode = '22003',
      message = 'Cannot reserve a temporary episode number';
  end if;

  update public.episodes
  set episode_number = v_temporary_number::integer
  where id = v_current.id;

  update public.episodes
  set episode_number = v_current.episode_number
  where id = v_adjacent.id;

  update public.episodes
  set episode_number = v_adjacent.episode_number
  where id = v_current.id;

  return query
  select
    v_current.show_id,
    v_current.season_id,
    v_current.id,
    v_adjacent.episode_number;
end;
$$;

revoke all on function public.reorder_episode(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reorder_episode(uuid, text) to service_role;
