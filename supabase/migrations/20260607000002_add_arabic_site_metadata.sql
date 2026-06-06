-- Arabic counterparts for the admin-managed site metadata. site_description is
-- emitted in the page <meta description>, OpenGraph, and Twitter cards; the
-- Arabic value is used when the viewer's locale is ar.
--
-- Additive + nullable: safe to apply without downtime. Falls back to the
-- English value in code when null.
--
-- Note: the top ticker's Arabic strings ride inside the existing
-- app_config.top_ticker JSON (per-item keys: tag_ar, text_ar, tag2_ar), so
-- they need no column here. CTA banner and brand stats already render through
-- next-intl (messages/{en,ar}.json), so they need no admin AR fields.

alter table public.app_config
  add column if not exists site_tagline_ar text,
  add column if not exists site_description_ar text;

comment on column public.app_config.site_tagline_ar is
  'Arabic site tagline. Shown when locale is ar; falls back to site_tagline when null.';
comment on column public.app_config.site_description_ar is
  'Arabic SEO/meta description. Shown when locale is ar; falls back to site_description when null.';
