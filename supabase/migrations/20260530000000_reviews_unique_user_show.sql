-- Security/anti-spam: enforce one review per user per show.
-- Before this, the RLS "Users can create own reviews" policy let any authed
-- user INSERT unlimited rows for the same show (review flooding). We dedup any
-- existing duplicates (keeping the most recent), then add a UNIQUE constraint.

-- 1. Remove older duplicates, keep the latest per (user_id, show_id)
DELETE FROM reviews a
USING reviews b
WHERE a.user_id = b.user_id
  AND a.show_id = b.show_id
  AND a.created_at < b.created_at;

-- 2. Tie-break any rows with identical created_at — keep the lowest id
DELETE FROM reviews a
USING reviews b
WHERE a.user_id = b.user_id
  AND a.show_id = b.show_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

-- 3. Enforce uniqueness going forward.
-- Idempotent: this constraint already exists in production (the original change
-- was applied directly during the repo-cleanup era; see the sibling
-- *_remote_reconcile stubs). Guarded so `supabase db push` can record this
-- version without erroring on the existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_show_unique'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_user_show_unique UNIQUE (user_id, show_id);
  END IF;
END $$;
