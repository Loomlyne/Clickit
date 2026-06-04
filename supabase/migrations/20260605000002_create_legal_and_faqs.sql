-- ============================================================
-- Legal pages and FAQs tables
-- Admin-managed content for legal pages and FAQ section
-- ============================================================

-- ============================================================
-- LEGAL_PAGES TABLE
-- ============================================================
create table public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_pages enable row level security;

create policy "Public can read legal pages"
  on public.legal_pages for select
  to anon, authenticated
  using (true);

create policy "Admin can insert legal pages"
  on public.legal_pages for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update legal pages"
  on public.legal_pages for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin can delete legal pages"
  on public.legal_pages for delete
  to authenticated
  using ((select public.is_admin()));

create trigger set_updated_at before update on public.legal_pages
  for each row execute procedure public.update_updated_at();

create index idx_legal_pages_slug on public.legal_pages(slug);
create index idx_legal_pages_sort on public.legal_pages(sort_order);

-- Seed default legal pages
insert into public.legal_pages (slug, title, content, sort_order) values
  ('terms-of-use', 'Terms of Use', '', 1),
  ('privacy-policy', 'Privacy Policy', '', 2)
on conflict (slug) do nothing;

-- ============================================================
-- FAQS TABLE
-- ============================================================
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faqs enable row level security;

create policy "Public can read faqs"
  on public.faqs for select
  to anon, authenticated
  using (true);

create policy "Admin can insert faqs"
  on public.faqs for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update faqs"
  on public.faqs for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin can delete faqs"
  on public.faqs for delete
  to authenticated
  using ((select public.is_admin()));

create trigger set_updated_at before update on public.faqs
  for each row execute procedure public.update_updated_at();

create index idx_faqs_sort on public.faqs(sort_order);
