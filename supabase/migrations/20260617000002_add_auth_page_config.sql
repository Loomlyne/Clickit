-- Admin-configurable sign-in page: custom side image, editable copy (EN + AR),
-- and per-provider OAuth button toggles. All optional — the app falls back to
-- the bundled i18n strings / featured-show backdrop when a column is null.
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS auth_image_url            TEXT,
  ADD COLUMN IF NOT EXISTS auth_heading              TEXT,
  ADD COLUMN IF NOT EXISTS auth_heading_ar           TEXT,
  ADD COLUMN IF NOT EXISTS auth_subheading           TEXT,
  ADD COLUMN IF NOT EXISTS auth_subheading_ar        TEXT,
  ADD COLUMN IF NOT EXISTS auth_quote                TEXT,
  ADD COLUMN IF NOT EXISTS auth_quote_ar             TEXT,
  ADD COLUMN IF NOT EXISTS auth_quote_attribution    TEXT,
  ADD COLUMN IF NOT EXISTS auth_quote_attribution_ar TEXT,
  ADD COLUMN IF NOT EXISTS auth_google_enabled       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_apple_enabled        BOOLEAN NOT NULL DEFAULT false;
