-- Add per-show responsive hero media columns
ALTER TABLE public.shows
  ADD COLUMN hero_image_mobile_url  TEXT,
  ADD COLUMN hero_video_url         TEXT,
  ADD COLUMN hero_video_type        TEXT CHECK (hero_video_type IN ('mp4', 'youtube')),
  ADD COLUMN hero_video_mobile_url  TEXT,
  ADD COLUMN hero_video_mobile_type TEXT CHECK (hero_video_mobile_type IN ('mp4', 'youtube'));
