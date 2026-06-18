-- ============================================================
-- CIT Platform Database Schema
-- Phase 6: Backend Foundation
-- ============================================================
-- Creates all 7 tables: app_config, shows, seasons, episodes,
-- profiles, watch_progress, watchlist
-- ============================================================

-- ============================================================
-- CLEANUP: Drop pre-existing objects from prior migrations
-- Tables dropped with CASCADE will also drop their triggers/policies
-- NOTE: app_config is intentionally NOT dropped here — it holds
-- admin settings (hero video, branding, etc.) that must survive
-- re-applies. All other tables are safe to recreate from data
-- that is managed via the admin panel.
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.watchlist cascade;
drop table if exists public.watch_progress cascade;
drop table if exists public.profiles cascade;
drop table if exists public.episodes cascade;
drop table if exists public.seasons cascade;
drop table if exists public.shows cascade;
drop function if exists public.handle_new_user();
drop function if exists public.update_updated_at();
drop function if exists public.is_admin();

-- ============================================================
-- APP_CONFIG TABLE (single-row config, per D-09)
-- Admin is identified by app_config.admin_user_id lookup.
-- To change admin: UPDATE public.app_config SET admin_user_id = 'new-uuid' WHERE id = 1;
-- No migration required to change admin.
-- ============================================================
create table if not exists public.app_config (
  id integer primary key default 1 check (id = 1),
  admin_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- ============================================================
-- SHOWS TABLE
-- ============================================================
create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ar text,                          -- D-06: bilingual
  slug text not null unique,              -- D-01: URL routing
  tagline text,
  tagline_ar text,
  description text not null default '',
  description_ar text,                    -- D-06: bilingual
  genre text not null,
  status text not null default 'draft'
    check (status in ('draft', 'coming-soon', 'now-streaming')),  -- ADMN-04
  brand_color text not null default 'brand-blue'
    check (brand_color in ('brand-blue', 'brand-purple', 'brand-green', 'brand-red', 'brand-orange')),  -- D-07
  broadcast_day text,                     -- D-05: e.g., 'Sunday' or 'Mon-Fri'
  broadcast_time time,                    -- D-05: e.g., '19:00:00'
  episode_count integer not null default 0,
  season_count integer not null default 0,
  poster_url text,                        -- D-18: ShowCard vertical art
  hero_url text,                          -- D-18: SeriesDetailHero banner
  logo_url text,                          -- D-18: Hero overlay wordmark
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shows enable row level security;

-- ============================================================
-- SEASONS TABLE
-- ============================================================
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  season_number integer not null,
  title text not null,
  title_ar text,
  episode_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, season_number)
);

alter table public.seasons enable row level security;

-- ============================================================
-- EPISODES TABLE
-- ============================================================
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  episode_number integer not null,         -- D-04: ordering column
  title text not null,
  title_ar text,
  description text not null default '',
  description_ar text,
  duration integer,                        -- minutes
  status text not null default 'draft'
    check (status in ('draft', 'coming-soon', 'published')),  -- ADMN-05
  youtube_video_id text,                   -- D-03: 11-char YouTube ID
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

alter table public.episodes enable row level security;

-- ============================================================
-- PROFILES TABLE (FK to auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- WATCH_PROGRESS TABLE (Phase 9 -- created now, used later)
-- ============================================================
create table if not exists public.watch_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  progress_seconds integer not null default 0,
  duration_seconds integer,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

alter table public.watch_progress enable row level security;

-- ============================================================
-- WATCHLIST TABLE (Phase 9 -- created now, used later)
-- ============================================================
create table if not exists public.watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

alter table public.watchlist enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_shows_slug on public.shows(slug);
create index if not exists idx_shows_status on public.shows(status);
create index if not exists idx_shows_genre on public.shows(genre);
create index if not exists idx_seasons_show_id on public.seasons(show_id);
create index if not exists idx_episodes_show_id on public.episodes(show_id);
create index if not exists idx_episodes_season_id on public.episodes(season_id);
create index if not exists idx_episodes_status on public.episodes(status);
create index if not exists idx_watch_progress_user on public.watch_progress(user_id);
create index if not exists idx_watchlist_user on public.watchlist(user_id);

-- ============================================================
-- FULL TEXT SEARCH (for Phase 8 search feature)
-- ============================================================
alter table public.shows add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'C')
  ) stored;

create index if not exists idx_shows_fts on public.shows using gin(fts);

alter table public.episodes add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists idx_episodes_fts on public.episodes using gin(fts);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger set_updated_at before update on public.app_config
  for each row execute procedure public.update_updated_at();
create or replace trigger set_updated_at before update on public.shows
  for each row execute procedure public.update_updated_at();
create or replace trigger set_updated_at before update on public.seasons
  for each row execute procedure public.update_updated_at();
create or replace trigger set_updated_at before update on public.episodes
  for each row execute procedure public.update_updated_at();
create or replace trigger set_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create or replace trigger set_updated_at before update on public.watch_progress
  for each row execute procedure public.update_updated_at();
