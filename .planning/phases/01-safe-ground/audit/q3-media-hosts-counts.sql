select * from (
select 'app_config.hero_video_url' col, coalesce(substring(hero_video_url from '^https?://([^/]+)'), case when hero_video_url is null then '(null)' when hero_video_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.og_image_url' col, coalesce(substring(og_image_url from '^https?://([^/]+)'), case when og_image_url is null then '(null)' when og_image_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.favicon_url' col, coalesce(substring(favicon_url from '^https?://([^/]+)'), case when favicon_url is null then '(null)' when favicon_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.live_stream_url' col, coalesce(substring(live_stream_url from '^https?://([^/]+)'), case when live_stream_url is null then '(null)' when live_stream_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.favicon_dark_url' col, coalesce(substring(favicon_dark_url from '^https?://([^/]+)'), case when favicon_dark_url is null then '(null)' when favicon_dark_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.hero_video_mobile_url' col, coalesce(substring(hero_video_mobile_url from '^https?://([^/]+)'), case when hero_video_mobile_url is null then '(null)' when hero_video_mobile_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.auth_image_url' col, coalesce(substring(auth_image_url from '^https?://([^/]+)'), case when auth_image_url is null then '(null)' when auth_image_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'app_config.preloader_video_url' col, coalesce(substring(preloader_video_url from '^https?://([^/]+)'), case when preloader_video_url is null then '(null)' when preloader_video_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.app_config group by 1,2
union all
select 'shows.poster_url' col, coalesce(substring(poster_url from '^https?://([^/]+)'), case when poster_url is null then '(null)' when poster_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.hero_url' col, coalesce(substring(hero_url from '^https?://([^/]+)'), case when hero_url is null then '(null)' when hero_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.logo_url' col, coalesce(substring(logo_url from '^https?://([^/]+)'), case when logo_url is null then '(null)' when logo_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.hero_image_mobile_url' col, coalesce(substring(hero_image_mobile_url from '^https?://([^/]+)'), case when hero_image_mobile_url is null then '(null)' when hero_image_mobile_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.hero_video_url' col, coalesce(substring(hero_video_url from '^https?://([^/]+)'), case when hero_video_url is null then '(null)' when hero_video_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.hero_video_mobile_url' col, coalesce(substring(hero_video_mobile_url from '^https?://([^/]+)'), case when hero_video_mobile_url is null then '(null)' when hero_video_mobile_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shows.card_image_url' col, coalesce(substring(card_image_url from '^https?://([^/]+)'), case when card_image_url is null then '(null)' when card_image_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shows group by 1,2
union all
select 'shorts.thumbnail_url' col, coalesce(substring(thumbnail_url from '^https?://([^/]+)'), case when thumbnail_url is null then '(null)' when thumbnail_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.shorts group by 1,2
union all
select 'profiles.avatar_url' col, coalesce(substring(avatar_url from '^https?://([^/]+)'), case when avatar_url is null then '(null)' when avatar_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.profiles group by 1,2
union all
select 'show_cast.image_url' col, coalesce(substring(image_url from '^https?://([^/]+)'), case when image_url is null then '(null)' when image_url='' then '(empty)' else '(non-url)' end) host, count(*) n from public.show_cast group by 1,2
union all
select 'categories.icon' col, coalesce(substring(icon from '^https?://([^/]+)'), case when icon is null then '(null)' when icon='' then '(empty)' else '(non-url)' end) host, count(*) n from public.categories group by 1,2
union all
select 'app_config.'||k||' (jsonb)' col, substring(m[1] from '^https?://([^/]+)') host, count(*) from public.app_config, jsonb_each(to_jsonb(app_config) - 'id') e(k,v), regexp_matches(v::text, '(https?://[^"\\ ]+)', 'g') m where jsonb_typeof(v) in ('object','array') group by 1,2
union all
select 'auth.users.raw_user_meta_data.avatar_url' col, coalesce(substring(raw_user_meta_data->>'avatar_url' from '^https?://([^/]+)'),'(none)'), count(*) from auth.users group by 1,2
union all
select 'storage.policy:'||policyname, left(regexp_replace(coalesce(qual,'')||' | '||coalesce(with_check,''),'\s+',' ','g'),200), 0 from pg_policies where schemaname='storage' and coalesce(qual,'')||coalesce(with_check,'') ilike '%admin%' and coalesce(qual,'')||coalesce(with_check,'') not ilike '%private.is_admin%'
union all
select 'fake:shorts dQw4w9WgXcQ', youtube_video_id, count(*) from public.shorts where youtube_video_id in ('RyWAAM7EkCE','dQw4w9WgXcQ','9bZkp7q19f0','kJQP7kiw5Fk','JGwWNGJdvx8','OPf0YbXqDm0') group by 1,2
union all
select 'fake:show_cast seeded names', name, count(*) from public.show_cast where name in ('Amina Rahman','Omar Haddad','Layla Mansour') group by 1,2
union all
select 'count:'||t, '', n from (select 'shows' t, count(*) n from public.shows union all select 'shows active', count(*) from public.shows where not coalesce(archived,false) union all select 'seasons',count(*) from public.seasons union all select 'episodes',count(*) from public.episodes union all select 'shorts',count(*) from public.shorts union all select 'show_cast',count(*) from public.show_cast union all select 'profiles',count(*) from public.profiles) z
) r order by 1,3 desc