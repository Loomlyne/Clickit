-- Legal pages Arabic: "AI draft, admin approves" (Koss, 2026-10-21, question form; review
-- item 12, PR #29). Machine Arabic for a legal page is stored as an unpublished draft; the
-- public Arabic page shows the English legal text until an admin ticks "Arabic reviewed"
-- and saves.
--
--   title_ar / content_ar             published Arabic, shown on /ar only when ar_reviewed
--   title_ar_draft / content_ar_draft unreviewed Arabic (AI or an admin edit left unticked)
--   ar_reviewed                       an admin approved the published Arabic
--
-- Additive only: two nullable columns and one boolean with a default; no row is removed and
-- no existing value changes except ar_reviewed below.

alter table public.legal_pages
  add column if not exists title_ar_draft text,
  add column if not exists content_ar_draft text,
  add column if not exists ar_reviewed boolean not null default false;

comment on column public.legal_pages.title_ar_draft is
  'Unreviewed Arabic title (AI draft or an unticked admin edit). Never shown publicly.';
comment on column public.legal_pages.content_ar_draft is
  'Unreviewed Arabic body (AI draft or an unticked admin edit). Never shown publicly.';
comment on column public.legal_pages.ar_reviewed is
  'An admin ticked "Arabic reviewed": title_ar/content_ar are shown on /ar. False: /ar shows the English.';

-- Arabic that is already published before this change stays published: rows with a
-- non-blank content_ar are marked reviewed. The updated_at trigger is paused for this one
-- statement so the public "last updated" date of each legal page does not move.
alter table public.legal_pages disable trigger set_updated_at;

update public.legal_pages
  set ar_reviewed = true
  where content_ar is not null and btrim(content_ar) <> '';

alter table public.legal_pages enable trigger set_updated_at;
