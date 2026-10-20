-- Phase 6, migration 1 of 2 (expand, D-21). Additive only.
--
-- Adds the YouTube check columns on episodes, a catalog-wide unique index on
-- youtube_video_id, public.renumber_season, public.record_youtube_checks and
-- the Supabase Vault functions for the YouTube Data API key (D-20).
--
-- Safety:
-- * Existing rows and existing columns are not changed. New columns are
--   nullable with no backfill.
-- * The new columns are NOT added to the anon/authenticated column grant list
--   or to episodes_view (20260724115941). Viewer roles cannot read them.
-- * Every new function is revoked from public, anon and authenticated and
--   executable by service_role only. Supabase grants execute on new functions
--   to anon and authenticated by default, so the revokes are required.
-- * Nothing is granted on the vault schema. Only three security definer
--   functions in private read or write the one named secret.
-- * The contract step (removing app_config.youtube_api_key) is a separate
--   migration in a separate PR (06-23), applied after the live key test passes.

-- (1) Episode columns ------------------------------------------------------

alter table public.episodes
  add column if not exists youtube_status text
    check (youtube_status in ('ok', 'private', 'removed', 'not_embeddable', 'blocked_ae', 'not_ready')),
  add column if not exists youtube_checked_at timestamptz,
  add column if not exists youtube_duration_seconds integer
    check (youtube_duration_seconds >= 0),
  add column if not exists player_error_code integer
    check (player_error_code in (2, 5, 100, 101, 150)),
  add column if not exists player_error_at timestamptz;

-- (2) Duplicate guard ------------------------------------------------------
-- Last line of defence: the controller clears duplicate ids on live first
-- (06-21, newest updated_at keeps the id). If any remain, stop here with a
-- clear message instead of a bare index error.

do $$
begin
  if exists (
    select 1
    from public.episodes
    where youtube_video_id is not null
      and youtube_video_id <> ''
    group by youtube_video_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Duplicate episodes.youtube_video_id values exist; clear them (owner step) before this migration';
  end if;
end $$;

-- (3) Catalog-wide unique video id -----------------------------------------
-- Covers archived rows too (Pitfall 7): an archived episode keeps its id, so
-- importing the same video again is refused and a later restore cannot
-- collide.

create unique index if not exists episodes_youtube_video_id_key
  on public.episodes (youtube_video_id)
  where youtube_video_id is not null and youtube_video_id <> '';

-- (4) renumber_season ------------------------------------------------------
-- Gives the season's live episodes 1..N in their current order and moves
-- archived episodes to N+1..N+K in their archived order (G3, D-14, D-19).
--
-- Why neither update can trip the immediate unique (season_id,
-- episode_number) check, which Postgres tests row by row:
-- * Phase A adds v_off to every row. v_off is larger than the whole current
--   range plus the row count, so every shifted value is above every old value
--   (no clash with a row not yet shifted) and the shift keeps values distinct.
--   v_off also absorbs a negative minimum, so every shifted value is above
--   the row count.
-- * Phase B assigns 1..count. Every value still held by an unassigned row is
--   above the row count after Phase A, and row_number() values are distinct.
--
-- The advisory lock uses the same key as public.reorder_episode, so reorder
-- and renumber serialise per season. Imports do not take this lock: an import
-- relies on the unique (season_id, episode_number) constraint
-- (episodes_season_id_episode_number_key), and commitImportCore maps a
-- collision with a concurrent renumber or reorder to a "season changed, try
-- again" message after rolling back what it wrote.

create or replace function public.renumber_season(p_season_id uuid)
returns table (
  episode_id uuid,
  old_number integer,
  new_number integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_min bigint;
  v_max bigint;
  v_off bigint;
  v_in_order boolean;
  v_ids uuid[];
  v_before integer[];
begin
  perform 1 from public.seasons s where s.id = p_season_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Season not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_season_id::text, 3071971)
  );

  select count(*)::integer, min(l.episode_number), max(l.episode_number)
  into v_count, v_min, v_max
  from (
    select e.episode_number
    from public.episodes e
    where e.season_id = p_season_id
    for update
  ) l;

  if v_count = 0 then
    raise exception using errcode = 'P0002', message = 'Season has no episodes';
  end if;

  select coalesce(bool_and(a.episode_number = a.seq_no), true)
  into v_in_order
  from (
    select
      e.episode_number,
      row_number() over (order by e.episode_number) as seq_no
    from public.episodes e
    where e.season_id = p_season_id
      and e.archived = false
  ) a;

  if v_in_order then
    raise exception using errcode = 'P0001', message = 'Already numbered 1 to N';
  end if;

  -- Capture the old numbers, in final order, for the returned map.
  select
    array_agg(e.id order by e.archived, e.episode_number),
    array_agg(e.episode_number order by e.archived, e.episode_number)
  into v_ids, v_before
  from public.episodes e
  where e.season_id = p_season_id;

  v_off := greatest(v_max, 0) - least(v_min, 0) + v_count + 1;

  if v_max + v_off > 2147483647 then
    raise exception using
      errcode = '22003',
      message = 'Cannot reserve temporary episode numbers';
  end if;

  -- Phase A: shift every row above the whole range.
  update public.episodes e
  set episode_number = (e.episode_number + v_off)::integer
  where e.season_id = p_season_id;

  -- Phase B: live rows 1..N in old order, then archived rows N+1..N+K.
  update public.episodes e
  set episode_number = r.seq_no
  from (
    select
      x.id,
      (row_number() over (order by x.archived, x.episode_number))::integer as seq_no
    from public.episodes x
    where x.season_id = p_season_id
  ) r
  where e.id = r.id;

  return query
  select o.id, o.before_number, e.episode_number
  from unnest(v_ids, v_before) as o(id, before_number)
  join public.episodes e on e.id = o.id
  where e.episode_number <> o.before_number
  order by e.episode_number;
end;
$$;

-- (5) record_youtube_checks ------------------------------------------------
-- One write per daily re-check run (D-17): status, check time and duration in
-- seconds for a batch of episodes. episodes.duration (minutes) follows only
-- while it still equals the value derived from the previous stored seconds,
-- so an admin override is kept. A zero duration (not_ready) never replaces a
-- good one. Text columns are never written (D-05).

create or replace function public.record_youtube_checks(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'YouTube checks must be a JSON array';
  end if;

  if jsonb_array_length(p_rows) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'Too many YouTube checks in one call';
  end if;

  update public.episodes e
  set
    youtube_status = r.status,
    youtube_checked_at = now(),
    youtube_duration_seconds = coalesce(
      nullif(r.duration_seconds, 0),
      e.youtube_duration_seconds
    ),
    duration = case
      when r.duration_seconds > 0
        and e.youtube_duration_seconds is not null
        and e.duration = greatest(1, round(e.youtube_duration_seconds / 60.0))::int
      then greatest(1, round(r.duration_seconds / 60.0))::int
      else e.duration
    end,
    player_error_code = case when r.status = 'ok' then null else e.player_error_code end,
    player_error_at = case when r.status = 'ok' then null else e.player_error_at end
  from jsonb_to_recordset(p_rows)
    as r(id uuid, status text, duration_seconds integer)
  where e.id = r.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- (6) Grants for the episode functions -------------------------------------

revoke all on function public.renumber_season(uuid)
  from public, anon, authenticated;
grant execute on function public.renumber_season(uuid) to service_role;

revoke all on function public.record_youtube_checks(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_youtube_checks(jsonb) to service_role;

-- (7) YouTube API key in Supabase Vault (D-20) -----------------------------
-- One named secret, youtube_api_key. private is not exposed by PostgREST, so
-- thin public wrappers (security invoker, same grants) let the service-role
-- client call rpc('get_youtube_key'), rpc('set_youtube_key', { p_key }) and
-- rpc('youtube_key_meta'). The key reaches Postgres only as a function
-- argument and is written inside plpgsql, never as a top-level literal.

do $$
begin
  if to_regprocedure('vault.create_secret(text,text,text,uuid)') is null
    or to_regclass('vault.decrypted_secrets') is null then
    raise exception using
      errcode = '42883',
      message = 'Supabase Vault (supabase_vault) is not installed; enable it before this migration';
  end if;
end $$;

create schema if not exists private;

create or replace function private.get_youtube_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = 'youtube_api_key'
  order by ds.updated_at desc nulls last
  limit 1;
$$;

create or replace function private.set_youtube_key(p_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_key is null or not (p_key ~ '^AIza[0-9A-Za-z_-]{35}$') then
    raise exception using errcode = '22023', message = 'Invalid key format';
  end if;

  select s.id
  into v_id
  from vault.secrets s
  where s.name = 'youtube_api_key'
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      p_key,
      'youtube_api_key',
      'YouTube Data API key (D-20)'
    );
  else
    perform vault.update_secret(v_id, p_key);
  end if;

  return right(p_key, 4);
end;
$$;

create or replace function private.youtube_key_meta()
returns table (
  has_key boolean,
  last4 text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select true, right(ds.decrypted_secret, 4), ds.updated_at
    from vault.decrypted_secrets ds
    where ds.name = 'youtube_api_key'
    order by ds.updated_at desc nulls last
    limit 1
  )
  union all
  select false, null::text, null::timestamptz
  where not exists (
    select 1
    from vault.decrypted_secrets ds
    where ds.name = 'youtube_api_key'
  );
$$;

create or replace function public.get_youtube_key()
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.get_youtube_key();
$$;

create or replace function public.set_youtube_key(p_key text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.set_youtube_key(p_key);
$$;

create or replace function public.youtube_key_meta()
returns table (
  has_key boolean,
  last4 text,
  updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.youtube_key_meta();
$$;

grant usage on schema private to service_role;

revoke all on function private.get_youtube_key()
  from public, anon, authenticated;
grant execute on function private.get_youtube_key() to service_role;

revoke all on function private.set_youtube_key(text)
  from public, anon, authenticated;
grant execute on function private.set_youtube_key(text) to service_role;

revoke all on function private.youtube_key_meta()
  from public, anon, authenticated;
grant execute on function private.youtube_key_meta() to service_role;

revoke all on function public.get_youtube_key()
  from public, anon, authenticated;
grant execute on function public.get_youtube_key() to service_role;

revoke all on function public.set_youtube_key(text)
  from public, anon, authenticated;
grant execute on function public.set_youtube_key(text) to service_role;

revoke all on function public.youtube_key_meta()
  from public, anon, authenticated;
grant execute on function public.youtube_key_meta() to service_role;
