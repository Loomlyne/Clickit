-- ============================================================
-- Phase 5 M1a: accounts and content columns (expand-only)
--
-- First half of the additive M1 step (D-40). M1b (05-13) adds the email
-- outbox and its RPCs. Both are applied on live together, through
-- apply-live-migrations.yml with Koss's approval, BEFORE the Phase 5 code
-- deploy. The current production code ignores everything added here.
--
-- Expand-only: new table, new functions, new columns, one trigger per table,
-- additive backfills and one CHECK constraint widened (newsletter status).
-- Nothing existing is removed or narrowed.
--
-- Public repository: no UUIDs, no email addresses, no secrets in this file.
-- public.admins is created EMPTY (D-16). Real admins are inserted later by
-- owner SQL (05-36); locally by `npm run seed:local-admin`.
-- ============================================================

-- ------------------------------------------------------------
-- (1) public.admins (D-16)
-- ------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 60),
  added_at timestamptz not null default now(),
  added_by uuid null references auth.users(id) on delete set null
);

alter table public.admins enable row level security;
-- No policies on purpose: only service_role (RLS-bypassing) and SECURITY
-- DEFINER functions read or write this table.
comment on table public.admins is
  'Clickit admins. RLS on with no policies on purpose: read only by service_role and SECURITY DEFINER functions.';

revoke all on table public.admins from public, anon, authenticated;
grant select, insert, update, delete on table public.admins to service_role;

-- ------------------------------------------------------------
-- (2) public.am_i_admin(): routing hint only
-- ------------------------------------------------------------
-- Tells a signed-in caller whether they have an admins row, so the proxy can
-- route them to the admin sign-in flow. It is NOT an authorisation decision:
-- requireAdmin (server) decides, with AAL2.
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
  )
$$;

comment on function public.am_i_admin() is
  'Routing hint for the proxy, not authorisation: requireAdmin decides.';

revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated, service_role;

-- ------------------------------------------------------------
-- (3) public.list_admins(): service_role only (admin list screen)
-- ------------------------------------------------------------
create or replace function public.list_admins()
returns table (
  user_id uuid,
  display_name text,
  email text,
  has_totp boolean,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.user_id,
    a.display_name,
    u.email::text,
    exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = a.user_id
        and f.factor_type = 'totp'
        and f.status = 'verified'
    ) as has_totp,
    u.last_sign_in_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  order by a.added_at, a.user_id
$$;

revoke all on function public.list_admins() from public, anon, authenticated;
grant execute on function public.list_admins() to service_role;

-- ------------------------------------------------------------
-- (4) profiles: account columns (D-08, D-09, D-30, Q15 = A)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists locale text check (locale in ('en', 'ar')),
  add column if not exists onboarded_at timestamptz,
  add column if not exists password_set_at timestamptz,
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists notify_new_episodes boolean not null default true;

-- Every existing auth user gets a profile row (live has more auth users than
-- profiles). Additive insert only.
insert into public.profiles (id)
select u.id
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- Existing people are never mailed a welcome nor asked to set a password
-- (D-30, D-09, Pitfall 7). The backfill does not bump profiles.updated_at:
-- the updated_at trigger (if present) is paused for this one statement only,
-- inside this migration's transaction.
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'set_updated_at' and not tgisinternal
  ) then
    execute 'alter table public.profiles disable trigger set_updated_at';
  end if;
end;
$$;

update public.profiles p
set
  welcome_sent_at = coalesce(p.welcome_sent_at, now()),
  password_set_at = coalesce(p.password_set_at, u.created_at),
  onboarded_at = case
    when p.display_name is not null and p.onboarded_at is null then now()
    else p.onboarded_at
  end
from auth.users u
where u.id = p.id;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'set_updated_at' and not tgisinternal
  ) then
    execute 'alter table public.profiles enable trigger set_updated_at';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- (5) profiles: API roles cannot change system columns
-- ------------------------------------------------------------
-- Security invoker on purpose: current_user is the caller's role. Server
-- code sets these columns only through service_role or SECURITY DEFINER RPCs
-- (where current_user is the function owner), never through a user's JWT.
create or replace function private.protect_profile_system_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.welcome_sent_at := old.welcome_sent_at;
    new.password_set_at := old.password_set_at;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_profile_system_columns()
  from public, anon, authenticated;

create or replace trigger profiles_protect_system_columns
  before update on public.profiles
  for each row execute function private.protect_profile_system_columns();

-- ------------------------------------------------------------
-- (6) episodes.live_at (D-34, research F5)
-- ------------------------------------------------------------
-- When an episode became visible to viewers: status 'published', or
-- 'coming-soon' whose publish_at has passed (episodes status check:
-- draft, coming-soon, published). Server-only: deliberately NOT added to the
-- anon/authenticated column SELECT grants on public.episodes.
alter table public.episodes
  add column if not exists live_at timestamptz;

create or replace function private.set_episode_live_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.live_at is null
    and (
      new.status = 'published'
      or (
        new.status = 'coming-soon'
        and new.publish_at is not null
        and new.publish_at <= now()
      )
    )
  then
    new.live_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_episode_live_at()
  from public, anon, authenticated;

create or replace trigger episodes_set_live_at
  before insert or update of status, publish_at on public.episodes
  for each row execute function private.set_episode_live_at();

-- Backfill visible episodes. updated_at is not bumped (admin saves use it as
-- an optimistic-concurrency version and the sitemap as lastmod), so the
-- updated_at trigger (if present) is paused for this one statement only.
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.episodes'::regclass and tgname = 'set_updated_at' and not tgisinternal
  ) then
    execute 'alter table public.episodes disable trigger set_updated_at';
  end if;
end;
$$;

update public.episodes
set live_at = least(coalesce(publish_at, created_at), now())
where live_at is null
  and (
    status = 'published'
    or (
      status = 'coming-soon'
      and publish_at is not null
      and publish_at <= now()
    )
  );

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.episodes'::regclass and tgname = 'set_updated_at' and not tgisinternal
  ) then
    execute 'alter table public.episodes enable trigger set_updated_at';
  end if;
end;
$$;

create index if not exists idx_episodes_live_at
  on public.episodes (live_at)
  where live_at is not null;

-- ------------------------------------------------------------
-- (7) newsletter_subscribers: double opt-in columns (D-32, D-33, F14)
-- ------------------------------------------------------------
-- The original inline CHECK is named newsletter_subscribers_status_check.
-- Widened with 'pending'; no existing row is updated (live has 0 rows, D-33).
alter table public.newsletter_subscribers drop constraint if exists newsletter_subscribers_status_check; -- safe-drop: widened with 'pending' in the next statement
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_status_check
    check (status in ('pending', 'active', 'paused', 'unsubscribed'));

alter table public.newsletter_subscribers
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_sent_at timestamptz,
  add column if not exists locale text not null default 'en'
    check (locale in ('en', 'ar'));
