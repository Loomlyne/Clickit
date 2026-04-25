-- Cast members for shows (name + image)
CREATE TABLE show_cast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,                        -- e.g. "Host", "Director", "Actor"
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_show_cast_show_id ON show_cast(show_id);

ALTER TABLE show_cast ENABLE ROW LEVEL SECURITY;

-- Anyone can read cast
CREATE POLICY "show_cast_select_public" ON show_cast
  FOR SELECT USING (true);

-- Admin full access
CREATE POLICY "show_cast_admin_all" ON show_cast
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
