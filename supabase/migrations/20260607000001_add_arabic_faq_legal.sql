-- Arabic counterparts for admin-managed FAQ and legal content. Shown on the
-- public pages when the viewer's locale is Arabic, so the text switches with
-- the language toggle. Falls back to the English value in code when null.
--
-- Additive + nullable: safe to apply without downtime.
--
-- Note: the footer tagline's Arabic variant rides inside the existing
-- app_config.footer_content JSON (key: taglineAr), so it needs no column here.

alter table public.faqs
  add column if not exists question_ar text,
  add column if not exists answer_ar text;

comment on column public.faqs.question_ar is
  'Arabic FAQ question. Shown when locale is ar; falls back to question when null.';
comment on column public.faqs.answer_ar is
  'Arabic FAQ answer. Shown when locale is ar; falls back to answer when null.';

alter table public.legal_pages
  add column if not exists title_ar text,
  add column if not exists content_ar text;

comment on column public.legal_pages.title_ar is
  'Arabic legal page title. Shown when locale is ar; falls back to title when null.';
comment on column public.legal_pages.content_ar is
  'Arabic legal page body. Shown when locale is ar; falls back to content when null.';
