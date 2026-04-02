-- ============================================================
-- CIT Platform RLS Policies
-- Phase 6: Backend Foundation
-- ============================================================
-- Row Level Security policies for all 7 tables.
-- Admin is identified by app_config table lookup (per D-09).
-- To change admin: UPDATE public.app_config SET admin_user_id = 'new-uuid' WHERE id = 1;
-- No migration or function replacement needed.
-- ============================================================

-- ============================================================
-- ADMIN FUNCTION (D-09: reads from app_config, NOT hardcoded UUID)
-- ============================================================
-- Admin is identified by app_config table lookup (per D-09)
-- To change admin: UPDATE public.app_config SET admin_user_id = 'new-uuid' WHERE id = 1;
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select (select auth.uid()) = (select admin_user_id from public.app_config where id = 1)
$$;

-- ============================================================
-- APP_CONFIG POLICIES
-- ============================================================
-- Anyone can read app_config (admin_user_id is a UUID, not sensitive)
create policy "Anyone can read app_config"
  on public.app_config for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for authenticated role.
-- Only service_role (which bypasses RLS) can modify app_config.
-- This prevents any user from promoting themselves to admin.

-- ============================================================
-- SHOWS POLICIES (FOUN-03, AUTH-04)
-- ============================================================
-- Public can read published + coming-soon shows
create policy "Public can view published shows"
  on public.shows for select
  to anon, authenticated
  using (status in ('now-streaming', 'coming-soon'));

-- Admin can view all shows (including drafts)
create policy "Admin can view all shows"
  on public.shows for select
  to authenticated
  using ((select public.is_admin()));

-- Admin can insert shows
create policy "Admin can insert shows"
  on public.shows for insert
  to authenticated
  with check ((select public.is_admin()));

-- Admin can update shows
create policy "Admin can update shows"
  on public.shows for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admin can delete shows
create policy "Admin can delete shows"
  on public.shows for delete
  to authenticated
  using ((select public.is_admin()));

-- ============================================================
-- SEASONS POLICIES
-- ============================================================
-- Public can view seasons of published shows
create policy "Public can view seasons of published shows"
  on public.seasons for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.shows
      where shows.id = seasons.show_id
      and shows.status in ('now-streaming', 'coming-soon')
    )
  );

-- Admin can view all seasons
create policy "Admin can view all seasons"
  on public.seasons for select
  to authenticated
  using ((select public.is_admin()));

-- Admin can insert seasons
create policy "Admin can insert seasons"
  on public.seasons for insert
  to authenticated
  with check ((select public.is_admin()));

-- Admin can update seasons
create policy "Admin can update seasons"
  on public.seasons for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admin can delete seasons
create policy "Admin can delete seasons"
  on public.seasons for delete
  to authenticated
  using ((select public.is_admin()));

-- ============================================================
-- EPISODES POLICIES
-- ============================================================
-- Public can view published + coming-soon episodes of public shows
create policy "Public can view published episodes"
  on public.episodes for select
  to anon, authenticated
  using (
    status in ('published', 'coming-soon')
    and exists (
      select 1 from public.shows
      where shows.id = episodes.show_id
      and shows.status in ('now-streaming', 'coming-soon')
    )
  );

-- Admin can view all episodes
create policy "Admin can view all episodes"
  on public.episodes for select
  to authenticated
  using ((select public.is_admin()));

-- Admin can insert episodes
create policy "Admin can insert episodes"
  on public.episodes for insert
  to authenticated
  with check ((select public.is_admin()));

-- Admin can update episodes
create policy "Admin can update episodes"
  on public.episodes for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admin can delete episodes
create policy "Admin can delete episodes"
  on public.episodes for delete
  to authenticated
  using ((select public.is_admin()));

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============================================================
-- WATCH_PROGRESS POLICIES
-- ============================================================
create policy "Users can view own progress"
  on public.watch_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can upsert own progress"
  on public.watch_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own progress"
  on public.watch_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- WATCHLIST POLICIES
-- ============================================================
create policy "Users can view own watchlist"
  on public.watchlist for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add to watchlist"
  on public.watchlist for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove from watchlist"
  on public.watchlist for delete
  to authenticated
  using ((select auth.uid()) = user_id);
