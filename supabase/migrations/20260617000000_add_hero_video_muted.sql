ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS hero_video_muted boolean DEFAULT true NOT NULL;
