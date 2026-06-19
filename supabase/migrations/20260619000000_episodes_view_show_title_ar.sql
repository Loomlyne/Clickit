-- Add show_title_ar to episodes_view (queries previously referenced a column
-- that was never created on the view, breaking continue-watching joins).

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
  s.title_ar as show_title_ar,
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
