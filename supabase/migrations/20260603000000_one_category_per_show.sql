-- Enforce exactly one category per show at the database level.
--
-- The admin category picker is single-select and existing rows were cleaned to
-- at most one category per show. This unique index makes >1 physically
-- impossible: a second show_categories row for the same show_id is rejected by
-- Postgres, regardless of which code path tries to write it.
--
-- Safe to apply: every show currently has 0 or 1 category, so no duplicate
-- show_id values exist for the index to choke on. Idempotent via IF NOT EXISTS.
create unique index if not exists show_categories_one_per_show
  on public.show_categories (show_id);
