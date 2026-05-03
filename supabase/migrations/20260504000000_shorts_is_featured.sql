ALTER TABLE shorts ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
COMMENT ON COLUMN shorts.is_featured IS 'Pinned to the landing-page Featured Shorts strip';
