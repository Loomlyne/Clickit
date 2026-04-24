-- Allow admin to delete any review (moderation)
CREATE POLICY "Admin can delete any review"
  ON reviews FOR DELETE
  USING (public.is_admin());

-- Allow admin to read all reviews (already covered by public SELECT,
-- but explicit for clarity)
CREATE POLICY "Admin can update reviews"
  ON reviews FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
