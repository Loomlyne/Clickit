-- ============================================================
-- LIKES TABLE — users can like/heart shows
-- ============================================================
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

alter table public.likes enable row level security;

create index idx_likes_user on public.likes(user_id);

-- ============================================================
-- LIKES RLS POLICIES
-- ============================================================
create policy "Users can view own likes"
  on public.likes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can like shows"
  on public.likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can unlike shows"
  on public.likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
