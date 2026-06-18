-- ============================================================
-- Fix Supabase linter: Security Definer View (episodes_view)
--
-- The masking view previously relied on default SECURITY DEFINER
-- semantics to bypass tightened episodes RLS while hiding
-- youtube_video_id for not-yet-live coming-soon rows.
--
-- New approach:
--   1. security_invoker view — RLS of the querying user applies
--   2. Separate RLS policy for coming-soon teaser rows
--   3. Column revoke on episodes.youtube_video_id for anon/auth
--      (forces video ids through the audited helper below)
--   4. Small SECURITY DEFINER function that returns youtube_video_id
--      only when the episode is effectively live
-- ============================================================

-- 1. Masked youtube_video_id lookup (SECURITY DEFINER — scoped function,
--    not a view). Replicates the CASE logic from the old view definition.
create or replace function public.get_public_youtube_video_id(p_episode_id uuid)
returns text
language sql
stable
security definer
set search_path = public
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

revoke all on function public.get_public_youtube_video_id(uuid) from public;
grant execute on function public.get_public_youtube_video_id(uuid) to anon, authenticated;

-- 2. Allow anon/authenticated to read coming-soon teaser metadata via RLS
--    (published rows remain covered by the existing policy).
drop policy if exists "Public can view coming-soon episode teasers" on public.episodes;
create policy "Public can view coming-soon episode teasers"
  on public.episodes for select
  to anon, authenticated
  using (
    status = 'coming-soon'
    and archived = false
    and exists (
      select 1 from public.shows
      where shows.id = episodes.show_id
        and shows.status in ('now-streaming', 'coming-soon')
        and shows.archived = false
    )
  );

-- 3. Block direct reads of youtube_video_id on the base table for viewers.
--    Admin server actions use the service-role client and are unaffected.
revoke select (youtube_video_id) on public.episodes from anon, authenticated;

-- 4. Recreate the view as security invoker (Postgres 15+).
drop view if exists public.episodes_view;
create view public.episodes_view
with (security_invoker = true)
as
select
  e.id,
  e.show_id,
  e.season_id,
  e.episode_number,
  e.title,
  e.title_ar,
  e.description,
  e.description_ar,
  e.duration,
  e.status,
  e.publish_at,
  e.archived,
  e.created_at,
  e.updated_at,
  public.get_public_youtube_video_id(e.id) as youtube_video_id,
  s.title as show_title,
  s.slug as show_slug,
  s.brand_color as show_brand_color,
  s.status as show_status,
  s.poster_url as show_poster_url
from public.episodes e
join public.shows s on s.id = e.show_id
where e.archived = false
  and e.status in ('published', 'coming-soon')
  and s.archived = false
  and s.status in ('now-streaming', 'coming-soon');

grant select on public.episodes_view to anon, authenticated;
