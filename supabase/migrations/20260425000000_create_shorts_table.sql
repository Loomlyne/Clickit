-- Quick Bites (YouTube Shorts) table
-- Admin adds YouTube Shorts URLs, metadata is extracted via YouTube Data API,
-- and shorts auto-expire based on expires_at timestamp.

CREATE TABLE IF NOT EXISTS shorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id VARCHAR(11) NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  genre TEXT,
  sort_order INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,          -- null = never expires
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for browse query: non-archived, not expired, ordered
CREATE INDEX idx_shorts_browse ON shorts (archived, expires_at, sort_order);

-- RLS
ALTER TABLE shorts ENABLE ROW LEVEL SECURITY;

-- Viewers can see non-archived, non-expired shorts
CREATE POLICY "shorts_select_public" ON shorts
  FOR SELECT
  USING (
    archived = false
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Admin full access
CREATE POLICY "shorts_admin_all" ON shorts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_shorts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shorts_updated_at
  BEFORE UPDATE ON shorts
  FOR EACH ROW
  EXECUTE FUNCTION update_shorts_updated_at();
