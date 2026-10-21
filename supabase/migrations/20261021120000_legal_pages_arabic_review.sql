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
-- no existing value changes except ar_reviewed below. The browser roles lose read access to
-- the two draft columns only (column grant below); every other column stays readable.

-- One explicit transaction (PR #29 re-review item 3): the trigger is never left disabled and
-- no half of the file lands alone, also when the file is run by hand with psql (autocommit).
-- The Supabase CLI (db push / migration up) already sends each file as one implicit
-- transaction; an explicit begin/commit inside it is honoured, so the file still applies as
-- one unit. Only the CLI's own history row (supabase_migrations.schema_migrations) is then
-- written just after this commit, in its own implicit transaction.
begin;

alter table public.legal_pages
  add column if not exists title_ar_draft text,
  add column if not exists content_ar_draft text,
  add column if not exists ar_reviewed boolean not null default false;

comment on column public.legal_pages.title_ar_draft is
  'Unreviewed Arabic title (AI draft or an unticked admin edit). Not readable by anon or authenticated (column grant); the admin reads it with the service role.';
comment on column public.legal_pages.content_ar_draft is
  'Unreviewed Arabic body (AI draft or an unticked admin edit). Not readable by anon or authenticated (column grant); the admin reads it with the service role.';
comment on column public.legal_pages.ar_reviewed is
  'An admin ticked "Arabic reviewed": title_ar/content_ar are shown on /ar. False: /ar shows the English.';

-- Draft privacy (PR #29 re-review item 1). anon and authenticated held a table-wide SELECT
-- grant, so the drafts were readable with the public anon key. A column REVOKE does nothing
-- while that table grant exists, so the table grant is replaced by a column grant listing
-- every column except the two drafts. The RLS read policy (using true) is unchanged.
-- INSERT/UPDATE/DELETE grants are unchanged (RLS keeps them admin-only). A column added to
-- legal_pages later is NOT readable by anon/authenticated until it is added to this list.
revoke select on table public.legal_pages from anon, authenticated;
grant select (id, slug, title, content, sort_order, created_at, updated_at, title_ar, content_ar, ar_reviewed)
  on table public.legal_pages to anon, authenticated;

-- Arabic that is already published before this change stays published: rows with a
-- non-blank content_ar are marked reviewed. The updated_at trigger is paused for this one
-- statement so the public "last updated" date of each legal page does not move.
alter table public.legal_pages disable trigger set_updated_at;

update public.legal_pages
  set ar_reviewed = true
  where content_ar is not null and btrim(content_ar) <> '';

alter table public.legal_pages enable trigger set_updated_at;

commit;
