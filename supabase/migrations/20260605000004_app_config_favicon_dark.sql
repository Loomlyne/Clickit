-- Dark-mode favicon variant.
--
-- A single favicon can disappear against a browser tab/bookmark bar whose chrome
-- matches the icon's own color (e.g. a dark icon on a dark-mode tab strip).
-- Browsers solve this by honoring `media="(prefers-color-scheme: dark)"` on the
-- icon <link>, swapping to an alternate icon when the OS/browser theme flips.
--
-- This column stores the alternate (dark-background) favicon. favicon_url remains
-- the light-mode/default; favicon_dark_url is served when prefers-color-scheme: dark.
-- Additive + nullable: safe to apply without downtime. Falls back to favicon_url
-- (then /favicon.ico) in code when null.
alter table public.app_config
  add column if not exists favicon_dark_url text;

comment on column public.app_config.favicon_dark_url is
  'Dark-mode favicon variant. Served via prefers-color-scheme: dark; falls back to favicon_url when null.';
