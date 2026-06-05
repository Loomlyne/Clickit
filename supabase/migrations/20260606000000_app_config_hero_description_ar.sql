-- Arabic counterpart to hero_description. Shown on the landing hero when the
-- viewer's locale is Arabic, so the paragraph switches with the language.
--
-- Additive + nullable: safe to apply without downtime. Falls back to the i18n
-- Arabic string in code when null.
alter table public.app_config
  add column if not exists hero_description_ar text;

comment on column public.app_config.hero_description_ar is
  'Arabic landing hero paragraph below the logo. Shown when locale is ar; overrides the i18n Arabic fallback when set.';
