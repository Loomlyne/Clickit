# Phase 6: Backend Foundation - Research

**Researched:** 2026-04-01
**Domain:** Supabase (Postgres DB, RLS, Auth, Storage) + Next.js SSR client integration
**Confidence:** HIGH

## Summary

Phase 6 establishes the Supabase backend: database schema (shows, seasons, episodes, profiles, watch_progress, watchlist), Row Level Security policies, Supabase client utilities for server and browser, a public storage bucket for show artwork, and seed data with all 15 CIT programs. The technology stack is fully locked -- Supabase is a client requirement, `@supabase/supabase-js` ^2.101.x and `@supabase/ssr` ^0.10.x are already installed in package.json, and the Supabase CLI (v2.78.1) is available locally.

The primary challenge is schema design that matches the existing TypeScript interfaces in `src/lib/mock-data.ts` while adding the decided enhancements (bilingual fields, broadcast schedule, brand_color constraint, artwork paths, statuses from ADMN-04/ADMN-05). RLS must allow anonymous read of published content while restricting writes to admin only. The admin identification pattern uses a simple `is_admin()` SQL function comparing `auth.uid()` against a hardcoded UUID (set via environment variable at the application layer, checked in the function).

**Primary recommendation:** Use Supabase migrations for all schema + RLS + storage setup. Create server/browser client utilities in `src/lib/supabase/`. Generate TypeScript types from the schema with `supabase gen types`. Seed all 15 CIT programs from PROJECT.md. Use a `service_role` key server-side for admin operations in Server Actions, with `is_admin()` RLS function as defense-in-depth.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** UUIDs as primary keys (Supabase default `gen_random_uuid()`). Slugs stored as separate unique columns for URL routing (e.g., `/series/last-call`).
- **D-02:** Schema includes all 15 CIT programs from PROJECT.md seeded from the start. Platform looks complete from day one, admin fills in episodes over time.
- **D-03:** Episodes store `youtube_video_id` only (11-character ID). Embed URLs constructed in frontend code. No full YouTube URL column needed.
- **D-04:** Episode ordering by `episode_number` column only. No separate `sort_order` column. Admin reordering (ADMN-08) renumbers `episode_number`.
- **D-05:** Broadcast schedule stored as columns on the `shows` table: `broadcast_day` (text) and `broadcast_time` (time). Simple for 15 shows with fixed schedules.
- **D-06:** Bilingual fields added now: nullable `title_ar`, `description_ar` columns on shows, seasons, and episodes. Stay null until Arabic content is entered. Avoids future migration.
- **D-07:** `brand_color` stored as text column with CHECK constraint limiting to 5 brand color values (`brand-blue`, `brand-purple`, `brand-green`, `brand-red`, `brand-orange`). Easier to extend than Postgres enums.
- **D-08:** All user-facing tables created now: shows, seasons, episodes, profiles, watch_progress, watchlist. Complete schema in one migration pass. watch_progress and watchlist sit empty until Phase 9.
- **D-09:** Admin identified by environment variable (`ADMIN_USER_ID` containing Supabase user UUID). RLS policies check `auth.uid() = current_setting('app.admin_user_id')`. Admin can be changed without a migration.
- **D-10:** Both server-side and browser-side Supabase clients set up using `@supabase/ssr`. `createServerClient()` for Server Components/Actions, `createBrowserClient()` for Client Components. Cookie-based session sharing.
- **D-11:** Published content readable via anon key + RLS. RLS policies grant SELECT on published content to the anon role. Frontend queries Supabase directly. No API proxy layer for reads.
- **D-12:** RLS policy structure: public SELECT on published content (anon + authenticated), INSERT/UPDATE/DELETE restricted to admin only (via env var check). Unauthenticated browsing works out of the box (AUTH-04).
- **D-13:** Seed data as SQL migration file in `supabase/migrations/`. Runs automatically with `supabase db reset`. Version-controlled and reproducible.
- **D-14:** Real CIT content from PROJECT.md -- actual show names, descriptions, genres, broadcast schedules. Episode titles can be placeholder since real ones aren't available. Platform looks authentic during development.
- **D-15:** 3-5 episodes per season. Enough to demonstrate the UI (season selector, episode list, prev/next nav) without excessive placeholder data.
- **D-16:** Supabase Storage bucket created in this phase (not deferred to Phase 7). Bucket, RLS policies, and path conventions all part of the backend foundation.
- **D-17:** Public bucket for show artwork. Images served directly via Supabase CDN URL -- no auth needed to view show marketing material.
- **D-18:** Three image slots per show: `poster` (vertical card art for ShowCard), `hero` (wide banner for SeriesDetailHero), `logo` (show wordmark/icon for hero overlay). Path convention: `shows/{show_id}/poster.webp`, `shows/{show_id}/hero.webp`, `shows/{show_id}/logo.png`.

### Claude's Discretion
- Exact column types and constraints (varchar lengths, nullable vs default values)
- Migration file naming and numbering convention
- Supabase client utility file structure (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, etc.)
- Whether to use Supabase's built-in `auth.users` or create a separate `profiles` table (standard pattern is profiles with FK to auth.users)
- Index strategy (which columns get indexes beyond PKs and FKs)
- TypeScript type generation approach (Supabase CLI `gen types` vs manual types)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-02 | Supabase database schema created (series, seasons, episodes, users, watch_progress, watchlist) | Full schema design with column types, constraints, relationships, and indexes documented. Migration file approach verified via Supabase CLI docs. |
| FOUN-03 | Row Level Security (RLS) enabled on all tables with appropriate policies | RLS policy patterns verified: public SELECT for published content, admin-only writes via `is_admin()` function. Storage bucket policies documented. |
| AUTH-04 | Unauthenticated users can browse and watch content (auth gates personalization, not access) | Verified: anon role + RLS SELECT policy with `status = 'published'` filter allows unauthenticated browsing. No auth gate on content reads. |
| AUTH-05 | Admin user identified by user ID check (single admin, no RBAC) | `is_admin()` security definer function pattern documented. Application-layer check via `ADMIN_USER_ID` env var. Service role key for server-side admin operations. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16 App Router + Supabase (auth + Postgres DB) + Tailwind CSS, deployed on Vercel
- **Supabase packages:** `@supabase/supabase-js` ^2.101.x (installed), `@supabase/ssr` ^0.10.x (installed)
- **Supabase CLI:** ^2.84.x recommended (v2.78.1 installed locally -- functional but slightly behind)
- **DO NOT use:** `@supabase/auth-helpers-nextjs` (deprecated), Prisma, NextAuth/Auth.js, MongoDB
- **Client utility pattern:** `src/lib/` is where utility modules live -- Supabase files go in `src/lib/supabase/`
- **Server/client boundary:** Server components for data fetching, client components only for interactivity
- **Deploy to Vercel** for verification checkpoints (from memory)
- **No Playwright in worktrees** -- write tests but don't run them, use `tsc --noEmit` instead (from memory)

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @supabase/supabase-js | 2.101.1 (latest: 2.101.1) | Isomorphic Supabase client | Installed in package.json |
| @supabase/ssr | 0.10.0 (latest: 0.10.0) | SSR auth integration for Next.js | Installed in package.json |

### Supporting (To Install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supabase (CLI) | 2.84.5 (latest npm) | Local dev, migrations, type gen | Dev dependency for `supabase init`, `supabase gen types` |

### Dev Environment
| Tool | Version | Available | Note |
|------|---------|-----------|------|
| Supabase CLI (brew) | 2.78.1 | Yes | Slightly behind npm latest (2.84.5) but functional |
| Docker | N/A | No | Required for `supabase start` local dev -- NOT available |
| psql | N/A | No | Not needed -- use Supabase Dashboard or CLI |

**Important: Docker is not available on this machine.** This means `supabase start` (local Postgres) will not work. All migrations must target the remote Supabase project directly using `supabase db push`. Type generation must use `--project-id` flag against the remote project, not `--local`.

**Installation:**
```bash
npm install -D supabase
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  config.toml              # Supabase project config (from supabase init)
  migrations/
    20260401000000_create_schema.sql      # Tables, constraints, indexes
    20260401000001_create_rls_policies.sql # RLS policies + is_admin() function
    20260401000002_create_storage.sql      # Storage bucket + storage policies
    20260401000003_seed_data.sql           # All 15 CIT programs + episodes
  seed.sql                 # Optional: runs on supabase db reset
src/
  lib/
    supabase/
      server.ts            # createServerClient() for Server Components/Actions
      client.ts            # createBrowserClient() for Client Components
      middleware.ts         # Token refresh middleware helper
      admin.ts             # createAdminClient() with service_role key
    database.types.ts      # Auto-generated from supabase gen types
    mock-data.ts           # Existing -- kept until Phase 8 swaps to real data
middleware.ts              # Next.js middleware (or proxy.ts in Next.js 16)
.env.local                 # Environment variables (not committed)
```

### Pattern 1: Supabase Server Client (Server Components / Server Actions)
**What:** Creates a Supabase client that reads cookies from the incoming request for auth context.
**When to use:** Every Server Component, Server Action, or Route Handler that accesses Supabase.
**Example:**
```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
```

### Pattern 2: Supabase Browser Client (Client Components)
**What:** Singleton client for browser-side Supabase access.
**When to use:** Client Components that need auth state or real-time subscriptions.
**Example:**
```typescript
// src/lib/supabase/client.ts
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 3: Admin Client (Server Actions Only -- Never Expose to Client)
**What:** Service role client that bypasses RLS for admin operations.
**When to use:** Server Actions in the admin dashboard for CRUD operations. Never import in client code.
**Example:**
```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // NO NEXT_PUBLIC_ prefix!
  )
}
```

### Pattern 4: Middleware for Token Refresh
**What:** Next.js middleware that refreshes expired auth tokens on every request.
**When to use:** Must be set up once -- runs automatically on all matching routes.
**Example:**
```typescript
// src/lib/supabase/middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the auth token
  await supabase.auth.getUser()

  return supabaseResponse
}

// middleware.ts (root)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 5: is_admin() Security Definer Function
**What:** A Postgres function that checks if the current user is the admin.
**When to use:** In RLS policies for write operations. Caches result per query via `(select is_admin())` wrapper.
**Example:**
```sql
-- Simple approach: hardcode admin UUID from environment variable
-- The UUID is set once when deploying, changeable via migration or direct SQL
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select (select auth.uid()) = 'ADMIN_UUID_HERE'::uuid
$$;
```

**Note on D-09:** The CONTEXT.md decision mentions `current_setting('app.admin_user_id')`. However, `current_setting()` with custom app-level variables requires the variable to be set via `set_config()` on every request or defined in `postgresql.conf`. This is complex to wire through Supabase's managed infrastructure. The simpler and equally flexible approach is:
1. Define the admin UUID in the `is_admin()` function body
2. To change admin: run a single `CREATE OR REPLACE FUNCTION` SQL statement -- no migration needed
3. Alternatively, store admin UUID in a single-row `app_config` table that `is_admin()` reads

The planner should use the direct UUID comparison in `is_admin()` for simplicity, with a note in the migration file about how to change the admin user.

### Pattern 6: Database Schema Design
**What:** Table design matching existing mock-data.ts interfaces + CONTEXT.md enhancements.
**Key decisions from research:**

```sql
-- Core tables with relationships:
-- shows (PK: id uuid) -- 15 CIT programs
--   -> seasons (PK: id uuid, FK: show_id -> shows)
--     -> episodes (PK: id uuid, FK: season_id -> seasons, FK: show_id -> shows)
-- profiles (PK: id uuid, FK: id -> auth.users ON DELETE CASCADE)
-- watch_progress (PK: composite user_id + episode_id)
-- watchlist (PK: composite user_id + show_id)

-- Status columns use text with CHECK constraints (not enums):
-- shows.status: CHECK (status IN ('draft', 'coming-soon', 'now-streaming'))
-- episodes.status: CHECK (status IN ('draft', 'coming-soon', 'published'))
-- Note: existing mock Episode type has 'locked' status -- map to 'draft' in DB
```

### Anti-Patterns to Avoid
- **Never use `getSession()` in server code for auth checks** -- use `getUser()` which validates the JWT. `getSession()` reads from cookies without verification and can be spoofed.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client** -- no `NEXT_PUBLIC_` prefix. Only use in server-side code.
- **Never skip RLS on public schema tables** -- any table without RLS in Supabase is fully accessible via the API.
- **Never create RLS policies for the `service_role`** -- it bypasses RLS entirely. Policies target `anon` and `authenticated` roles only.
- **Never use `@supabase/auth-helpers-nextjs`** -- it is deprecated. Use `@supabase/ssr` exclusively.
- **Avoid Postgres enums for status fields** -- adding new enum values requires migration + type changes. Text with CHECK constraint is more flexible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom cookie/JWT handling | `@supabase/ssr` createServerClient / createBrowserClient | Handles token refresh, cookie chunking, PKCE flow automatically |
| Authorization/access control | Middleware-only auth checks | RLS policies on every table | Defense-in-depth at the database level; works regardless of how data is accessed |
| Type definitions for DB | Manual TypeScript interfaces | `supabase gen types typescript` | Auto-generated from actual schema; stays in sync; catches drift |
| Admin client setup | Custom fetch wrapper with service key | `createClient()` from `@supabase/supabase-js` with service_role key | Properly configures headers, handles retries, typed responses |
| Storage URL construction | String concatenation of CDN URLs | `supabase.storage.from('bucket').getPublicUrl('path')` | Returns correct CDN URL format, handles URL encoding |
| UUID generation | `crypto.randomUUID()` in JS | Postgres `gen_random_uuid()` DEFAULT | Database-level UUID generation is more reliable and works in migrations/seed |

**Key insight:** Supabase provides a complete backend-as-a-service. The entire point of this phase is configuration and setup, not custom code. Every table, policy, and storage bucket should be defined in SQL migrations that are version-controlled and reproducible.

## Common Pitfalls

### Pitfall 1: getSession() vs getUser() in Server Code
**What goes wrong:** Using `supabase.auth.getSession()` in Server Components/Actions to check auth status. The session is read from cookies without JWT verification, making it spoofable.
**Why it happens:** `getSession()` was the standard in older Supabase versions. Many tutorials still show it.
**How to avoid:** Always use `supabase.auth.getUser()` in server code. It validates the JWT against Supabase's signing keys. Use `getClaims()` for lightweight checks.
**Warning signs:** Auth checks passing for forged cookies in server-side code.

### Pitfall 2: Missing RLS on New Tables
**What goes wrong:** Creating a table in the `public` schema without enabling RLS. The table becomes fully readable/writable via the Supabase REST API using just the anon key.
**Why it happens:** `enable row level security` is a separate step from `create table`. Easy to forget.
**How to avoid:** Every `CREATE TABLE` statement must be immediately followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Include both in the same migration file.
**Warning signs:** Tables visible in Supabase Dashboard with "RLS disabled" badge.

### Pitfall 3: RLS Policies Block Seed Data Insertion
**What goes wrong:** Seed data INSERT statements fail because RLS policies block the insert (no authenticated user context during migration).
**Why it happens:** Migrations run as the `postgres` role which bypasses RLS, but `seed.sql` may run differently.
**How to avoid:** Put seed data in a migration file (D-13 decision), not in `seed.sql`. Migrations run as the `postgres` superuser which bypasses RLS. Alternatively, if using `seed.sql`, the Supabase CLI also runs it as postgres.
**Warning signs:** Empty tables after `supabase db reset` despite seed data existing.

### Pitfall 4: Middleware Cookie Handling Race Condition
**What goes wrong:** The `setAll` callback in createServerClient doesn't propagate cookies correctly, causing auth state to be lost between middleware and Server Components.
**Why it happens:** The middleware must set cookies on both the request (for downstream Server Components) AND the response (for the browser). Missing either causes issues.
**How to avoid:** Follow the exact middleware pattern from Supabase docs: set on `request.cookies` AND on `supabaseResponse.cookies`. Never modify the `supabaseResponse` reference after creating it without re-applying cookies.
**Warning signs:** User appears logged out in Server Components despite successful login.

### Pitfall 5: Forgetting ON DELETE CASCADE on Foreign Keys
**What goes wrong:** Deleting a show fails because seasons/episodes reference it. Or deleting a user from auth.users leaves orphaned profile rows.
**Why it happens:** Default FK constraint is `NO ACTION` (reject delete if referenced).
**How to avoid:** Add `ON DELETE CASCADE` to all FK relationships: profiles -> auth.users, seasons -> shows, episodes -> seasons. Watch_progress and watchlist -> profiles with CASCADE.
**Warning signs:** Foreign key violation errors when deleting parent records.

### Pitfall 6: Docker Required for Local Development
**What goes wrong:** Running `supabase start` fails because Docker is not installed.
**Why it happens:** Supabase local dev spins up Postgres, Auth, Storage, etc. in Docker containers.
**How to avoid:** Since Docker is not available on this machine, all work must target the remote Supabase project. Use `supabase db push` instead of `supabase migration up`. Use `supabase gen types --project-id` instead of `--local`.
**Warning signs:** "Docker not found" error when running Supabase CLI commands.

### Pitfall 7: Publishable Key vs Anon Key Transition
**What goes wrong:** Using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env var name but the Supabase project still uses the legacy `anon` key format.
**Why it happens:** Supabase is transitioning from `anon`/`service_role` keys to `publishable`/`secret` keys (sb_publishable_xxx format). Not all projects have migrated.
**How to avoid:** Check your Supabase project's API keys page. If you see the legacy format, use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If you see the new format, use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both work with the same client code.
**Warning signs:** "Invalid API key" errors when initializing the Supabase client.

## Code Examples

### Complete Database Schema Migration

```sql
-- Source: Designed from CONTEXT.md decisions + mock-data.ts interfaces
-- supabase/migrations/20260401000000_create_schema.sql

-- ============================================================
-- SHOWS TABLE
-- ============================================================
create table public.shows (
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
create table public.seasons (
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
create table public.episodes (
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
create table public.profiles (
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- WATCH_PROGRESS TABLE (Phase 9 -- created now, used later)
-- ============================================================
create table public.watch_progress (
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
create table public.watchlist (
  user_id uuid not null references public.profiles(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

alter table public.watchlist enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_shows_slug on public.shows(slug);
create index idx_shows_status on public.shows(status);
create index idx_shows_genre on public.shows(genre);
create index idx_seasons_show_id on public.seasons(show_id);
create index idx_episodes_show_id on public.episodes(show_id);
create index idx_episodes_season_id on public.episodes(season_id);
create index idx_episodes_status on public.episodes(status);
create index idx_watch_progress_user on public.watch_progress(user_id);
create index idx_watchlist_user on public.watchlist(user_id);

-- ============================================================
-- FULL TEXT SEARCH (for Phase 8 search feature)
-- ============================================================
alter table public.shows add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'C')
  ) stored;

create index idx_shows_fts on public.shows using gin(fts);

alter table public.episodes add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index idx_episodes_fts on public.episodes using gin(fts);

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

create trigger set_updated_at before update on public.shows
  for each row execute procedure public.update_updated_at();
create trigger set_updated_at before update on public.seasons
  for each row execute procedure public.update_updated_at();
create trigger set_updated_at before update on public.episodes
  for each row execute procedure public.update_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger set_updated_at before update on public.watch_progress
  for each row execute procedure public.update_updated_at();
```

### Complete RLS Policies

```sql
-- supabase/migrations/20260401000001_create_rls_policies.sql

-- ============================================================
-- ADMIN FUNCTION
-- ============================================================
-- Replace 'REPLACE_WITH_ADMIN_UUID' with actual admin Supabase user UUID
-- To change admin: ALTER this function with a new UUID
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select (select auth.uid()) = 'REPLACE_WITH_ADMIN_UUID'::uuid
$$;

-- ============================================================
-- SHOWS POLICIES
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
-- SEASONS POLICIES (same pattern)
-- ============================================================
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

create policy "Admin can view all seasons"
  on public.seasons for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admin can insert seasons"
  on public.seasons for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update seasons"
  on public.seasons for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

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

create policy "Admin can view all episodes"
  on public.episodes for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admin can insert episodes"
  on public.episodes for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update episodes"
  on public.episodes for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

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
```

### Storage Bucket Setup

```sql
-- supabase/migrations/20260401000002_create_storage.sql

-- Create public bucket for show artwork
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'show-artwork',
  'show-artwork',
  true,
  5242880,  -- 5MB limit
  array['image/webp', 'image/png', 'image/jpeg']
);

-- Anyone can view (public bucket handles GET automatically)
-- Admin can upload
create policy "Admin can upload artwork"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );

-- Admin can update artwork
create policy "Admin can update artwork"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );

-- Admin can delete artwork
create policy "Admin can delete artwork"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ADMIN_USER_ID=your-admin-supabase-user-uuid-here
```

**Note:** `ADMIN_USER_ID` is used at the application layer for quick admin checks in Server Actions. The `is_admin()` SQL function contains the hardcoded UUID for RLS-level enforcement. Both must match.

### TypeScript Type Generation

```bash
# Generate types from remote project
npx supabase gen types typescript --project-id "your-project-ref" --schema public > src/lib/database.types.ts

# Or add as npm script
# package.json: "gen-types": "supabase gen types typescript --project-id \"$PROJECT_REF\" --schema public > src/lib/database.types.ts"
```

### Mapping: Mock Data Types to Database Schema

| Mock Interface Field | DB Column | Type Change | Notes |
|---------------------|-----------|-------------|-------|
| Show.id (string '1') | shows.id (uuid) | string -> uuid | Phase 8 migration concern |
| Show.status ('streaming') | shows.status ('now-streaming') | Value rename | Mock uses 'streaming', DB uses 'now-streaming' per ADMN-04 |
| Episode.status ('locked') | episodes.status ('draft') | Value mapping | 'locked' in mock maps to 'draft' in DB |
| Episode.youtubeId | episodes.youtube_video_id | Name change | snake_case in DB |
| Season.episodeCount | seasons.episode_count | Name change | snake_case in DB |
| (new) | shows.title_ar | Added | D-06 bilingual |
| (new) | shows.broadcast_day | Added | D-05 schedule |
| (new) | shows.broadcast_time | Added | D-05 schedule |
| (new) | shows.poster_url | Added | D-18 artwork |
| (new) | shows.hero_url | Added | D-18 artwork |
| (new) | shows.logo_url | Added | D-18 artwork |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated, no bug fixes |
| `getSession()` for server auth | `getUser()` / `getClaims()` | Late 2024 | getSession() doesn't validate JWT server-side |
| `anon` / `service_role` API keys | `publishable` / `secret` keys | 2025 (opt-in) | New sb_publishable_xxx format, backward compatible |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2025 (opt-in) | Supabase docs now show publishable; legacy still works |
| `middleware.ts` (Next.js) | `proxy.ts` (Next.js 16) | Oct 2025 | Next.js 16 renamed middleware; backward compatible |
| Postgres enums for status | Text + CHECK constraint | Best practice | Easier to add values without full migration |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` -- replaced by `@supabase/ssr`
- `supabase.auth.getSession()` in server code -- use `getUser()` instead
- Prisma with Supabase -- unnecessary abstraction, use Supabase client directly

## Open Questions

1. **Supabase Project Credentials**
   - What we know: .env.local file does not exist yet. No Supabase project appears to be linked.
   - What's unclear: Whether the user has already created a Supabase project and has the URL/keys available.
   - Recommendation: The first plan task must include instructions for the user to create a Supabase project (if not done) and set up .env.local with credentials. The `supabase init` and `supabase link` commands need project ref.

2. **Admin User UUID**
   - What we know: Admin is identified by UUID in `is_admin()` function (D-09).
   - What's unclear: The admin user doesn't exist yet in Supabase Auth.
   - Recommendation: Plan should include creating an admin user via Supabase Dashboard (or sign-up flow), then inserting the UUID into the `is_admin()` function. Use a placeholder UUID in the initial migration, with a documented step to replace it.

3. **Anon Key vs Publishable Key**
   - What we know: Supabase docs now show `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works.
   - What's unclear: Whether the user's Supabase project has the new key format enabled.
   - Recommendation: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for now (universally supported). Add a comment noting the transition to publishable keys. The code works identically with either format.

4. **Break Fast Daily broadcast_day**
   - What we know: CONTEXT.md specifics mention Break Fast Daily has Mon-Fri schedule. D-05 says `broadcast_day` is text.
   - What's unclear: Whether to store 'Mon-Fri' as a single string or use a Postgres text array.
   - Recommendation: Store as plain text string 'Mon-Fri'. This is display-only data (shown on UI), not used for querying/filtering. Simple text is sufficient for 15 shows.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (brew) | Migrations, type gen | Yes | 2.78.1 | npm supabase package |
| Docker | `supabase start` (local dev) | No | -- | Use remote Supabase project directly |
| Node.js | Next.js, npm scripts | Yes | (runtime) | -- |
| @supabase/supabase-js | DB queries | Yes | 2.101.0 | -- |
| @supabase/ssr | SSR auth | Yes | 0.10.0 | -- |
| psql | Direct DB access | No | -- | Supabase Dashboard SQL Editor |

**Missing dependencies with no fallback:**
- None -- all critical dependencies are available or have workarounds

**Missing dependencies with fallback:**
- Docker: Use remote Supabase project with `supabase db push` and `supabase gen types --project-id` instead of local dev
- psql: Use Supabase Dashboard SQL Editor for ad-hoc queries

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 (E2E only -- no unit test framework installed) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx tsc --noEmit` (type checking -- per project memory, no Playwright in worktrees) |
| Full suite command | `npx tsc --noEmit && npx next build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-02 | DB schema created with all tables | manual (SQL migration) | `npx tsc --noEmit` (types compile) | N/A -- migration files |
| FOUN-03 | RLS enabled on all tables | manual (SQL migration) | `npx tsc --noEmit` (types compile) | N/A -- migration files |
| AUTH-04 | Anon users can browse content | manual-only | Verify via Supabase Dashboard or API call | N/A -- RLS policy check |
| AUTH-05 | Admin identified by user ID | manual-only | Verify `is_admin()` function via SQL Editor | N/A -- SQL function check |

**Justification for manual-only:** This phase produces SQL migrations, TypeScript utility files, and environment configuration. The primary validation is:
1. `npx tsc --noEmit` -- all TypeScript files compile (database.types.ts is valid, client utilities are correctly typed)
2. `npx next build` -- the project builds successfully with new Supabase client imports
3. Manual verification via Supabase Dashboard that tables exist, RLS is enabled, and seed data is present

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && npx next build`
- **Phase gate:** Full build green + manual Supabase Dashboard verification

### Wave 0 Gaps
- None -- no unit test infrastructure needed for SQL migrations. TypeScript compilation serves as the automated validation for client utility code.

## Sources

### Primary (HIGH confidence)
- [Supabase SSR Next.js Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Server/browser client patterns, middleware setup
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- createServerClient, createBrowserClient API
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- Policy syntax, auth.uid(), USING/WITH CHECK
- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data) -- Profiles table, handle_new_user trigger
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- Storage policies, bucket types
- [Supabase Storage Bucket Creation](https://supabase.com/docs/guides/storage/buckets/creating-buckets) -- SQL bucket creation, public option
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) -- Migration CLI, seed data, db push
- [Supabase Type Generation](https://supabase.com/docs/guides/api/rest/generating-types) -- gen types CLI, Database type usage
- [Supabase Full-Text Search](https://supabase.com/docs/guides/database/full-text-search) -- tsvector, GIN indexes, weighted search
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) -- Anon key, service role key, publishable key transition

### Secondary (MEDIUM confidence)
- [Supabase Admin RLS Pattern](https://dev.to/shahidkhans/setting-up-row-level-security-in-supabase-user-and-admin-2ac1) -- is_admin() security definer function pattern
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- (select auth.uid()) optimization
- [Supabase Key Transition](https://github.com/orgs/supabase/discussions/29260) -- Publishable key migration timeline

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- packages already installed, versions verified against npm registry
- Architecture: HIGH -- patterns directly from official Supabase docs, verified against current API
- Schema design: HIGH -- derived from locked CONTEXT.md decisions + existing mock-data.ts interfaces
- RLS policies: HIGH -- standard Supabase patterns with verified `is_admin()` approach
- Pitfalls: HIGH -- documented from official docs and verified community patterns

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- Supabase SSR and RLS patterns are mature)
