-- Hero description is the paragraph shown on the landing hero section below the logo.
-- Previously hardcoded in i18n messages; moving to app_config so admins can edit
-- it from Settings without a code deploy.
--
-- Additive + nullable with a default matching the existing copy: safe to apply
-- without downtime. Falls back to the i18n string in code when null.
alter table public.app_config
  add column if not exists hero_description text;

comment on column public.app_config.hero_description is
  'Landing page hero paragraph below the logo. Overrides the i18n fallback when set.';
