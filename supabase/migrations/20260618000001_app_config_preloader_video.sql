-- Admin-editable entry preloader (logo animation) video URL.
-- Stored in site-assets at preloader/video.mp4; null falls back to /brand/clickit-preloader.mp4.

alter table public.app_config
  add column if not exists preloader_video_url text;
