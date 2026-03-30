# Architecture Patterns

**Domain:** Cinematic streaming platform (YouTube-embed based)
**Researched:** 2026-03-30

## Recommended Architecture

### High-Level Overview

```
Browser (Client)
  |
  v
Next.js 16 App Router (Vercel Edge Network)
  |
  |--> Server Components: Fetch show/episode data via Supabase client
  |--> Server Actions: Admin CRUD, watchlist mutations, progress saves
  |--> Route Handlers: YouTube URL validation, image upload presign
  |
  v
Supabase (Backend-as-a-Service)
  |--> Postgres DB: Shows, seasons, episodes, profiles, watchlists, progress
  |--> Auth: Email/password, social login, JWT sessions
  |--> Storage: Show artwork, hero banners, episode thumbnails
  |--> Row Level Security: Authorization at the database layer
  |
  v
YouTube (External)
  |--> Video hosting + CDN + adaptive bitrate
  |--> IFrame Player API: Playback control, progress tracking
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js App (Vercel)** | SSR/SSG pages, routing, auth middleware, API routes, Server Actions | Supabase, YouTube IFrame API |
| **Supabase Postgres** | Data storage, full-text search, RLS authorization | Next.js (via PostgREST) |
| **Supabase Auth** | User registration, login, session management, JWT tokens | Next.js middleware, Supabase client |
| **Supabase Storage** | Image assets (show artwork, banners, thumbnails) | Next.js (via storage API), next/image |
| **YouTube** | Video hosting, playback, transcoding, CDN delivery | Browser (via IFrame embed) |
| **Vercel** | Hosting, edge functions, image optimization, CDN, analytics | Next.js (deployment target) |

### Data Flow

**Viewer browsing shows:**
1. Browser requests `/` or `/shows/[slug]`
2. Next.js Server Component fetches show data from Supabase (server-side, no client JS)
3. RLS policy filters: only `status = 'published'` or `status = 'coming_soon'` rows returned
4. HTML streamed to browser with show catalog pre-rendered
5. Embla carousel and motion animations hydrate client-side

**Viewer watching an episode:**
1. Browser requests `/watch/[episodeId]`
2. Server Component fetches episode metadata + YouTube video ID from Supabase
3. Page renders with YouTube IFrame API player
4. Client-side: `onPlayerReady` seeks to saved progress (if continue-watching)
5. Client-side: `setInterval` saves `getCurrentTime()` to Supabase every 15 seconds
6. Client-side: `onStateChange(ENDED)` triggers autoplay-next countdown

**Admin creating an episode:**
1. Admin navigates to `/admin/episodes/new`
2. Middleware checks auth, verifies admin role
3. Admin fills form (react-hook-form + zod validation)
4. Server Action validates input, extracts YouTube video ID from URL
5. Server Action inserts episode row into Supabase (using service role key, bypasses RLS)
6. On-demand revalidation clears cached pages for the affected show

## Route Structure

```
app/
  (public)/
    page.tsx                          # Home: hero + content rails
    shows/
      page.tsx                        # All shows catalog
      [slug]/
        page.tsx                      # Series detail: seasons + episodes
    watch/
      [episodeId]/
        page.tsx                      # Watch page: YouTube player + metadata
    search/
      page.tsx                        # Search results
    schedule/
      page.tsx                        # Broadcast schedule grid
    coming-soon/
      page.tsx                        # Upcoming shows/episodes
  (auth)/
    login/
      page.tsx                        # Login form
    signup/
      page.tsx                        # Registration form
    callback/
      route.ts                        # Supabase auth callback handler
  (protected)/
    watchlist/
      page.tsx                        # User's saved shows
    continue-watching/
      page.tsx                        # Resume where you left off
  admin/
    layout.tsx                        # Admin layout with sidebar nav
    page.tsx                          # Admin dashboard overview
    shows/
      page.tsx                        # List all shows
      new/
        page.tsx                      # Create show form
      [id]/
        edit/
          page.tsx                    # Edit show form
    seasons/
      [showId]/
        page.tsx                      # Manage seasons for a show
    episodes/
      [seasonId]/
        page.tsx                      # Manage episodes for a season
      new/
        page.tsx                      # Create episode form
      [id]/
        edit/
          page.tsx                    # Edit episode form
  api/
    youtube/
      validate/
        route.ts                      # Validate YouTube URL, extract video ID
  layout.tsx                          # Root layout: providers, fonts, metadata
  not-found.tsx                       # 404 page
  error.tsx                           # Error boundary
  loading.tsx                         # Global loading state
```

## Patterns to Follow

### Pattern 1: Supabase Client Factory

Create typed Supabase clients for each context (server component, server action, middleware, browser).

**What:** Separate client creation utilities following Supabase SSR docs.
**When:** Every Supabase interaction.
**Example:**
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// lib/supabase/admin.ts (service role - server only)
import { createClient } from '@supabase/supabase-js'

export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### Pattern 2: Server Components for Data Fetching

**What:** Fetch all read-only data in Server Components. No `useEffect` + `fetch` pattern.
**When:** Catalog pages, series detail, episode metadata, search results.
**Example:**
```typescript
// app/(public)/shows/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: show } = await supabase
    .from('shows')
    .select('*, seasons(*, episodes(*))')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!show) notFound()

  return <ShowDetail show={show} />
}
```

### Pattern 3: Server Actions for Mutations

**What:** Use Server Actions for all data writes. No API route handlers for CRUD.
**When:** Watchlist add/remove, progress save, admin CRUD.
**Example:**
```typescript
// actions/watchlist.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleWatchlist(showId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', user.id)
    .eq('show_id', showId)
    .single()

  if (existing) {
    await supabase.from('watchlist').delete().eq('id', existing.id)
  } else {
    await supabase.from('watchlist').insert({ user_id: user.id, show_id: showId })
  }

  revalidatePath('/watchlist')
}
```

### Pattern 4: Middleware for Auth Session Refresh

**What:** Refresh Supabase auth tokens on every request via middleware (or proxy.ts in Next.js 16).
**When:** Every navigation. Required by @supabase/ssr.
**Example:**
```typescript
// middleware.ts (or proxy.ts in Next.js 16)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
```

### Pattern 5: Admin Route Protection

**What:** Check admin status in layout, redirect non-admins.
**When:** All `/admin/*` routes.
**Example:**
```typescript
// app/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

### Pattern 6: YouTube Video ID Extraction

**What:** Parse YouTube URLs to extract video IDs. Handle multiple URL formats.
**When:** Admin creates/edits an episode.
**Example:**
```typescript
// lib/youtube.ts
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Data Fetching for Catalog Data

**What:** Using `useEffect` + `fetch` or `useSWR` to load show/episode data.
**Why bad:** No SEO (search engines see empty page), waterfall loading (shell -> JS -> fetch -> render), unnecessary client JS bundle.
**Instead:** Use Server Components for all read-only data. The HTML arrives fully rendered.

### Anti-Pattern 2: Storing Supabase Client at Module Level

**What:** `const supabase = createClient()` at the top of a module, shared across requests.
**Why bad:** Sessions leak between users. User A's auth token is used for User B's request.
**Instead:** Create a new Supabase client inside every request handler, Server Component, or Server Action.

### Anti-Pattern 3: Using Service Role Key in Client Code

**What:** Putting `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_*` env var or importing admin client in client components.
**Why bad:** Service role bypasses all RLS. Anyone with the key has full database access.
**Instead:** Service role key is server-only. Use in Server Actions for admin operations. Never prefix with `NEXT_PUBLIC_`.

### Anti-Pattern 4: Skipping RLS Policies

**What:** Disabling Row Level Security on tables and relying on application-level auth checks.
**Why bad:** Any direct Supabase access (API, client library, Postgres connection) bypasses your auth checks. Defense-in-depth requires DB-level enforcement.
**Instead:** Enable RLS on every table. Write policies for each operation. Test from client SDK, not SQL editor (which bypasses RLS).

### Anti-Pattern 5: Saving Watch Progress on Every Frame

**What:** Calling Supabase on every second or every frame of video playback.
**Why bad:** Generates thousands of writes per viewing session. Hits Supabase rate limits. Wastes bandwidth.
**Instead:** Save progress every 15 seconds while video is PLAYING. Also save on PAUSED and ENDED events. Debounce aggressively.

### Anti-Pattern 6: Loading All YouTube Iframes Eagerly

**What:** Rendering full YouTube `<iframe>` for every episode thumbnail in a content rail.
**Why bad:** 20 iframes = ~10MB initial load. Each iframe creates a separate browsing context. Destroys page performance.
**Instead:** Use react-lite-youtube-embed for thumbnails (loads ~3KB per video). Only load full iframe on the watch page.

## Database Schema (Recommended)

```sql
-- Shows
create table shows (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ar text,
  slug text unique not null,
  description_en text,
  description_ar text,
  status text not null default 'draft' check (status in ('draft', 'coming_soon', 'published')),
  category text,
  duration_minutes int,
  broadcast_day text,
  broadcast_time time,
  brand_color text,               -- CIT brand color hex
  hero_image_url text,
  thumbnail_url text,
  logo_url text,
  featured boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Full-text search vector
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description_en, '')), 'B')
  ) stored
);

create index shows_search_idx on shows using gin(search_vector);
create index shows_status_idx on shows(status);
create index shows_slug_idx on shows(slug);

-- Seasons
create table seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references shows(id) on delete cascade not null,
  number int not null,
  title_en text,
  title_ar text,
  created_at timestamptz default now(),
  unique(show_id, number)
);

-- Episodes
create table episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete cascade not null,
  number int not null,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  youtube_video_id text,
  youtube_url text,
  status text not null default 'draft' check (status in ('draft', 'coming_soon', 'published')),
  duration_minutes int,
  thumbnail_url text,
  air_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Full-text search vector
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description_en, '')), 'B')
  ) stored,
  unique(season_id, number)
);

create index episodes_search_idx on episodes using gin(search_vector);
create index episodes_status_idx on episodes(status);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  is_admin boolean default false,
  preferred_language text default 'en',
  created_at timestamptz default now()
);

-- Watchlist
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  show_id uuid references shows(id) on delete cascade not null,
  added_at timestamptz default now(),
  unique(user_id, show_id)
);

create index watchlist_user_idx on watchlist(user_id);

-- Watch progress (continue watching)
create table watch_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  episode_id uuid references episodes(id) on delete cascade not null,
  progress_seconds int not null default 0,
  duration_seconds int,
  completed boolean default false,
  updated_at timestamptz default now(),
  unique(user_id, episode_id)
);

create index watch_progress_user_idx on watch_progress(user_id);
create index watch_progress_updated_idx on watch_progress(updated_at desc);
```

### RLS Policies (Key Examples)

```sql
-- Shows: anyone can read published/coming_soon, admin can read all
alter table shows enable row level security;

create policy "Public can view published shows"
  on shows for select
  using (status in ('published', 'coming_soon'));

create policy "Admin can manage all shows"
  on shows for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- Watchlist: users manage their own
alter table watchlist enable row level security;

create policy "Users manage own watchlist"
  on watchlist for all
  using (auth.uid() = user_id);

-- Watch progress: users manage their own
alter table watch_progress enable row level security;

create policy "Users manage own progress"
  on watch_progress for all
  using (auth.uid() = user_id);
```

## Scalability Considerations

| Concern | At Launch (15 shows) | At 100 shows | At 1000+ shows |
|---------|---------------------|--------------|----------------|
| Database queries | Simple queries, no optimization needed | Add composite indexes, consider materialized views for catalog | Evaluate external search (Meilisearch), read replicas |
| Image delivery | Vercel image optimization + Supabase Storage | Same, consider CDN (already on Vercel) | Dedicated image CDN (Cloudinary, imgix) |
| Search | Postgres FTS is instant | Still fast with GIN indexes | Consider Meilisearch for typo tolerance, facets |
| Watch progress writes | Direct inserts, no contention | Same, upsert handles conflicts | Batch writes, write-behind queue |
| Page caching | `use cache` for catalog pages | Same, revalidate on admin changes | ISR with tag-based revalidation |
| Auth sessions | Supabase Auth handles everything | Same | Same (Supabase scales this) |

## Sources

- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- HIGH confidence
- [Supabase Next.js Auth Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence
- [Supabase Full-Text Search](https://supabase.com/docs/guides/database/full-text-search) -- HIGH confidence
- [Next.js App Router Docs](https://nextjs.org/docs/app) -- HIGH confidence
- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) -- HIGH confidence
- [Next.js 16 Blog](https://nextjs.org/blog/next-16) -- HIGH confidence
