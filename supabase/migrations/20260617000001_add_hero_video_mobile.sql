-- Global landing hero gains a vertical (mobile/portrait) video variant, so the
-- admin can serve a 9:16 clip on phones and the existing 16:9 clip on desktop.
-- Mirrors the per-show hero_video_mobile_* columns on the shows table.
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS hero_video_mobile_url  TEXT,
  ADD COLUMN IF NOT EXISTS hero_video_mobile_type TEXT
    CHECK (hero_video_mobile_type IN ('mp4', 'youtube'));
