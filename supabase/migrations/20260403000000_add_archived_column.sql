-- ============================================================
-- Add archived column to shows and episodes (D-16)
-- Phase 7: Admin Dashboard Foundation
-- ============================================================

-- Add archived column to shows (D-16)
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add archived column to episodes (D-16)
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add index for archived filtering (used on every viewer query)
CREATE INDEX IF NOT EXISTS idx_shows_archived ON public.shows(archived);
CREATE INDEX IF NOT EXISTS idx_episodes_archived ON public.episodes(archived);

-- Update viewer-facing RLS policy to exclude archived shows (D-17)
DROP POLICY IF EXISTS "Public can view published shows" ON public.shows;
CREATE POLICY "Public can view published shows"
  ON public.shows FOR SELECT
  TO anon, authenticated
  USING (status IN ('now-streaming', 'coming-soon') AND archived = false);

-- Update viewer-facing RLS policy to exclude archived episodes (D-17)
DROP POLICY IF EXISTS "Public can view published episodes" ON public.episodes;
CREATE POLICY "Public can view published episodes"
  ON public.episodes FOR SELECT
  TO anon, authenticated
  USING (
    status IN ('published', 'coming-soon')
    AND archived = false
    AND EXISTS (
      SELECT 1 FROM public.shows
      WHERE shows.id = episodes.show_id
      AND shows.status IN ('now-streaming', 'coming-soon')
      AND shows.archived = false
    )
  );
