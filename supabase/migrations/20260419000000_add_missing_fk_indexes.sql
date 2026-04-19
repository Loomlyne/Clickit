-- Add missing indexes on foreign-key columns used by viewer join queries.
--
-- Why these columns:
-- * watch_progress.episode_id — every "continue watching" fetch joins on this.
--   Without the index, Postgres scans the whole watch_progress table per user
--   on each page load.
-- * watchlist.show_id — show-detail pages check "is this in my watchlist?"
--   and admin dashboards count watchlist entries per show.
-- * likes.show_id — same access pattern as watchlist.
--
-- The original schema indexed seasons.show_id and episodes.show_id but missed
-- these three. They matter more than you'd think because they sit behind
-- per-user RLS policies — the planner still has to evaluate the filter before
-- RLS can prune rows, so a sequential scan here hits every row in the table
-- even if the user only owns 3 of them.
--
-- IF NOT EXISTS makes this migration safe to re-run against any environment.

CREATE INDEX IF NOT EXISTS idx_watch_progress_episode_id
  ON public.watch_progress (episode_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_show_id
  ON public.watchlist (show_id);

CREATE INDEX IF NOT EXISTS idx_likes_show_id
  ON public.likes (show_id);
