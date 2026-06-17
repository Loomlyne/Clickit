-- "Skip sign-in" toggle: when true, signed-out visitors may browse the site
-- (catalog, series pages) but watch routes still require an account.
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS auth_allow_skip BOOLEAN NOT NULL DEFAULT false;

-- OAuth removed entirely — drop the now-unused provider toggle columns. Safe:
-- no shipped code reads or writes them anymore.
ALTER TABLE public.app_config
  DROP COLUMN IF EXISTS auth_google_enabled,
  DROP COLUMN IF EXISTS auth_apple_enabled;
