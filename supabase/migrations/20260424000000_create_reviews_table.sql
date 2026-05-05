-- v2.0 Phase 22: Reviews table for real-time user reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stars INTEGER CHECK (stars >= 1 AND stars <= 5) NOT NULL,
  body TEXT CHECK (char_length(body) <= 600) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS: anyone can read, auth'd users can insert own, users can delete own
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are visible to everyone"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Index for show page queries
CREATE INDEX idx_reviews_show_id ON reviews(show_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
