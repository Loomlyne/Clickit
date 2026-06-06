-- ============================================================
-- Episode scheduling: publish_at + time-based auto-publish
-- ============================================================
-- Adds a per-episode scheduled publish time and the data-layer
-- machinery to keep a scheduled episode FULLY HIDDEN until its
-- time:
--   1. publish_at column on episodes
--   2. base-table public RLS tightened to 'published' only, so a
--      pre-loaded coming-soon YouTube id is NOT reachable via the
--      anon REST API
--   3. episodes_view — a masking view that still surfaces
--      coming-soon teasers (title, number, etc.) but returns
--      youtube_video_id ONLY when the episode is "effectively live"
--      (status published, OR coming-soon whose publish_at has passed)
--
-- "Effectively live" is also evaluated lazily in app code so an
-- episode becomes watchable at the exact scheduled minute; the daily
-- cron (/api/cron/publish-scheduled) persists the status flip and the
-- parent-show coming-soon -> now-streaming transition.
-- ============================================================

-- 1. Scheduled publish time (UTC). Null = not scheduled.
alter table public.episodes
  add column if not exists publish_at timestamptz;

create index if not exists idx_episodes_publish_at
  on public.episodes(publish_at)
  where publish_at is not null;

-- 2. Tighten the public read policy: coming-soon episodes (and their
-- youtube_video_id) are no longer readable via the base table. Teasers
-- are served exclusively through episodes_view below.
drop policy if exists "Public can view published episodes" on public.episodes;
create policy "Public can view published episodes"
  on public.episodes for select
  to anon, authenticated
  using (
    status = 'published'
    and archived = false
    and exists (
      select 1 from public.shows
      where shows.id = episodes.show_id
        and shows.status in ('now-streaming', 'coming-soon')
        and shows.archived = false
    )
  );

-- 3. Masking view. SECURITY DEFINER semantics (security_invoker off,
-- the Postgres default) so it bypasses the tightened base RLS; the
-- WHERE clause re-implements public visibility. Show columns are
-- denormalised to avoid PostgREST view-embedding limitations.
drop view if exists public.episodes_view;
create view public.episodes_view as
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
  case
    when e.status = 'published'
      or (e.status = 'coming-soon'
          and e.publish_at is not null
          and e.publish_at <= now())
    then e.youtube_video_id
    else null
  end as youtube_video_id,
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
