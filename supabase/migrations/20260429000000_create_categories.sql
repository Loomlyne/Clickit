create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  slug text not null unique,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories
  add column if not exists name_en text,
  add column if not exists name_ar text,
  add column if not exists slug text,
  add column if not exists icon text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.categories
set
  name_en = coalesce(nullif(name_en, ''), slug),
  name_ar = coalesce(nullif(name_ar, ''), coalesce(name_en, slug)),
  slug = coalesce(nullif(slug, ''), lower(replace(coalesce(name_en, name_ar, id::text), ' ', '-')))
where name_en is null
   or name_ar is null
   or slug is null;

alter table public.categories
  alter column name_en set not null,
  alter column name_ar set not null,
  alter column slug set not null,
  alter column sort_order set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

create unique index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_sort_order on public.categories(sort_order, created_at);

alter table public.categories enable row level security;

drop trigger if exists set_updated_at_categories on public.categories;
create trigger set_updated_at_categories
  before update on public.categories
  for each row execute procedure public.update_updated_at();

create table if not exists public.show_categories (
  show_id uuid not null references public.shows(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (show_id, category_id)
);

alter table public.show_categories
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_show_categories_category_id on public.show_categories(category_id);
create index if not exists idx_show_categories_show_id on public.show_categories(show_id);

alter table public.show_categories enable row level security;

drop policy if exists "Public can view categories" on public.categories;
create policy "Public can view categories"
  on public.categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can view all categories" on public.categories;
create policy "Admin can view all categories"
  on public.categories for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can insert categories" on public.categories;
create policy "Admin can insert categories"
  on public.categories for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admin can update categories" on public.categories;
create policy "Admin can update categories"
  on public.categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin can delete categories" on public.categories;
create policy "Admin can delete categories"
  on public.categories for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Public can view show categories for public shows" on public.show_categories;
create policy "Public can view show categories for public shows"
  on public.show_categories for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.shows
      where shows.id = show_categories.show_id
        and shows.status in ('now-streaming', 'coming-soon')
    )
  );

drop policy if exists "Admin can view all show categories" on public.show_categories;
create policy "Admin can view all show categories"
  on public.show_categories for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admin can insert show categories" on public.show_categories;
create policy "Admin can insert show categories"
  on public.show_categories for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admin can update show categories" on public.show_categories;
create policy "Admin can update show categories"
  on public.show_categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin can delete show categories" on public.show_categories;
create policy "Admin can delete show categories"
  on public.show_categories for delete
  to authenticated
  using ((select public.is_admin()));
