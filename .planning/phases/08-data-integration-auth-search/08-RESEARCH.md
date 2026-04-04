# Phase 8: Data Integration, Auth & Search - Research

**Researched:** 2026-04-04
**Domain:** Supabase data integration, Supabase Auth client-side flows, Postgres Full-Text Search
**Confidence:** HIGH

## Summary

Phase 8 bridges the gap between the existing Supabase backend (Phases 6-7) and the viewer frontend (Phases 2-5). The backend is complete: schema with FTS columns, RLS policies, admin dashboard, and middleware-based session refresh all work. The viewer frontend is partially wired -- home page, series detail, and watch page already query Supabase via `queries.ts` -- but 23 component files still import types or data from `mock-data.ts`. Auth UI components (login, signup, auth-section) exist and function but display raw Supabase error messages. Search is entirely new: no route, no components, no query functions.

The core work is: (1) extract shared types and brand-color maps out of `mock-data.ts` into standalone modules, (2) migrate remaining mock-dependent components to use `ViewShow`/`ViewEpisode`/`ViewSeason` types from `queries.ts`, (3) build real `/series` and `/coming-soon` pages with Supabase queries, (4) create `/schedule` page, (5) harden auth error UX, (6) build `/search` page with Postgres FTS via `.textSearch()`, (7) delete `mock-data.ts`.

**Primary recommendation:** Work bottom-up: extract types/utilities first (brand-colors, view types), then migrate components page by page, then build new features (schedule, search). Auth hardening can run in parallel since it touches isolated components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Integration -- Mock Cleanup:**
- Complete the ViewShow/ViewEpisode type migration. Move all shared viewer components off `mock-data.ts` imports onto the `ViewShow` type already defined in `queries.ts`. Extract brand-color hex maps into a standalone utility (e.g., `src/lib/brand-colors.ts`), not in mock-data.
- Scope: broad cleanup. Wire `/series` (currently redirects to home), `/coming-soon` (fully mock-backed), and clean all residual mock-backed sections on home (genres grid, reels).
- Genres: derive from DB. Query distinct genres from `shows` table. Hide reels section or replace with "New Episodes" rail -- no `reels` table exists in the schema.
- Introduce `ViewEpisode` and `ViewSeason` types in `queries.ts` alongside existing `ViewShow`. Stop using `as any` casts. Fix the status mismatch: DB uses `draft | coming-soon | published`, mock components expect `locked` -- remove `locked` from component logic entirely.
- Schedule page: Create a simple viewer schedule page at `/schedule` that queries `shows` with `broadcast_day`/`broadcast_time` fields (already in DB schema). This satisfies Success Criterion 1.
- Delete `mock-data.ts` once all imports are migrated. No mock data should remain in the viewer at phase completion.

**Auth Flow:**
- Keep auth client-side. Current browser-client `signInWithPassword`/`signUp` pattern in `login-form.tsx` and `signup-form.tsx` is correct. Session refresh is handled by SSR middleware. No server actions needed.
- Ship email/password only. No email confirmation, no password reset for Phase 8.
- Map auth errors to product copy. Replace raw `error.message` display with mapped user-friendly messages for common Supabase errors.
- Verify the full flow works end-to-end: signup creates account + profile row (trigger exists), login sets session cookie, refresh persists session, sign-out clears state and redirects home.

**Search:**
- Postgres FTS with existing generated columns. The schema already has generated `fts` tsvector columns + GIN indexes on both `shows` and `episodes` tables. Use `.textSearch('fts', query)` via Supabase client. No new migration needed.
- Separate queries, app-level merge. Query shows and episodes separately, return both result sets.
- Header form + dedicated `/search` page. Search icon in navbar opens/routes to `/search?q=...`. No command-palette overlay.
- No live debounce for v1. User types query, submits, sees results page.
- Two-section results layout. "Shows" section with show cards, "Episodes" section with episode cards. Reuse existing card components.

**Session & State:**
- No global auth context. Only navbar/profile/admin need live auth awareness. The existing `AuthSection` component with `onAuthStateChange` listener is sufficient.
- Hydrate initial navbar state from server. Pass the user from the server layout to navbar for instant render, then let the client listener keep it fresh.
- Session persistence via existing infrastructure. Supabase SSR cookies + middleware refresh is already working.

### Claude's Discretion
- File organization for new search components
- Exact search results page layout and empty-state design
- Error/loading states for search
- Whether to add `nuqs` for search query URL state or use plain `searchParams`
- Exact error message copy for auth error mapping

### Deferred Ideas (OUT OF SCOPE)
- Email confirmation flow
- Password reset flow
- Live search typeahead / command-palette overlay
- Postgres RPC for unified ranked search results
- Reels feature (no DB table exists)
- Social auth providers (Google, Apple)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password via Supabase Auth | Auth components exist (`signup-form.tsx`), uses `supabase.auth.signUp()`. Profile trigger auto-creates row. Needs error mapping hardening. |
| AUTH-02 | User can log in and session persists across browser refresh | Login component exists (`login-form.tsx`), uses `signInWithPassword()`. Middleware refreshes session cookies. Needs server-side user hydration in navbar to avoid flash. |
| AUTH-03 | User can log out from any page | `AuthSection` + `UserDropdown` already implement sign-out with `supabase.auth.signOut()` + redirect. Functional as-is. |
| SRCH-01 | Search bar accessible from all pages (header) | Navbar needs search icon/form. Route to `/search?q=...`. No existing search UI. |
| SRCH-02 | Search finds shows and episodes by title | FTS columns + GIN indexes exist in DB. Use `.textSearch('fts', query, { type: 'websearch', config: 'english' })`. New query functions needed in `queries.ts`. |
| SRCH-03 | Search results display show cards and episode cards with thumbnails | Reuse existing `ShowCard` and `EpisodeRow` components (after migration to ViewShow/ViewEpisode types). Build results page layout. |
</phase_requirements>

## Standard Stack

### Core (already installed, no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.101.0 | DB queries + auth | Already installed. Provides `.textSearch()` for FTS. |
| @supabase/ssr | ^0.10.0 | SSR session management | Already installed. Cookie-based auth in middleware. |
| react-hook-form | ^7.72.0 | Form handling | Already installed. Used in auth forms. |
| zod | ^4.3.6 | Validation | Already installed. Used in auth form schemas. |
| sonner | (installed) | Toast notifications | Already installed. Auth success/error feedback. |
| lucide-react | (installed) | Icons | Already installed. Search icon for navbar. |

### Discretionary
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | ^2.x | URL search param state | For `/search?q=...` param management. Alternative: plain `searchParams` prop. Recommendation: use plain `searchParams` for v1 simplicity -- nuqs adds a dependency for a single query param. |

### No New Dependencies Needed
Phase 8 requires zero new `npm install` commands. All libraries are already in the project. The work is wiring existing tools together.

## Architecture Patterns

### New File Structure
```
src/
├── lib/
│   ├── brand-colors.ts          # NEW: extracted from mock-data.ts
│   ├── queries.ts               # MODIFIED: add ViewEpisode, ViewSeason, search queries, schedule queries, genres query
│   ├── auth-errors.ts           # NEW: Supabase error -> user-friendly message map
│   └── mock-data.ts             # DELETED at end of phase
├── app/(viewer)/
│   ├── search/
│   │   └── page.tsx             # NEW: search results page
│   ├── schedule/
│   │   └── page.tsx             # NEW: broadcast schedule page
│   ├── series/
│   │   └── page.tsx             # REWRITE: real data instead of redirect
│   └── coming-soon/
│       └── page.tsx             # REWRITE: Supabase queries instead of mock
├── components/
│   ├── layout/
│   │   ├── navbar.tsx           # MODIFIED: accept user prop from server, add search icon
│   │   └── auth-section.tsx     # MODIFIED: accept initial user prop
│   └── search/
│       └── search-results.tsx   # NEW: two-section results layout (discretion)
```

### Pattern 1: Type Extraction and Brand Color Utility
**What:** Extract `brandColorHexMap`, `brandColorBgMap`, `brandColorTextMap` from `mock-data.ts` into `src/lib/brand-colors.ts`. Define them as `Record<ViewShow['brandColor'], string>` using the `ViewShow` type from `queries.ts` (not the mock `Show` type).
**When to use:** Every component that currently imports `brandColorHexMap` from mock-data (23 files).
**Example:**
```typescript
// src/lib/brand-colors.ts
import type { ViewShow } from '@/lib/queries'

export const BRAND_COLOR_HEX: Record<ViewShow['brandColor'], string> = {
  'brand-blue': '#2C3569',
  'brand-purple': '#9F54A0',
  'brand-green': '#50A258',
  'brand-red': '#DB3F34',
  'brand-orange': '#EA8C2E',
}

export const BRAND_COLOR_BG: Record<ViewShow['brandColor'], string> = {
  'brand-blue': 'bg-brand-blue',
  'brand-purple': 'bg-brand-purple',
  'brand-green': 'bg-brand-green',
  'brand-red': 'bg-brand-red',
  'brand-orange': 'bg-brand-orange',
}

export const BRAND_COLOR_TEXT: Record<ViewShow['brandColor'], string> = {
  'brand-blue': 'text-brand-blue',
  'brand-purple': 'text-brand-purple',
  'brand-green': 'text-brand-green',
  'brand-red': 'text-brand-red',
  'brand-orange': 'text-brand-orange',
}
```

### Pattern 2: View Types in queries.ts
**What:** Introduce `ViewEpisode` and `ViewSeason` types alongside existing `ViewShow`, plus mapper functions. Eliminates `as any` casts in watch page and series detail.
**When to use:** Any component that needs episode or season data from the server.
**Example:**
```typescript
// In queries.ts
export type ViewEpisode = {
  id: string
  showId: string
  seasonId: string
  episodeNumber: number
  title: string
  description: string
  duration: number | null
  status: 'published' | 'coming-soon' | 'draft'  // NO 'locked'
  youtubeId: string | null
  publishedAt?: string
}

export type ViewSeason = {
  id: string
  showId: string
  seasonNumber: number
  title: string
  episodeCount: number
}

export function mapEpisode(db: DbEpisode): ViewEpisode {
  return {
    id: db.id,
    showId: db.show_id,
    seasonId: db.season_id,
    episodeNumber: db.episode_number,
    title: db.title,
    description: db.description,
    duration: db.duration,
    status: db.status as ViewEpisode['status'],
    youtubeId: db.youtube_video_id,
    publishedAt: db.created_at,
  }
}

export function mapSeason(db: DbSeason): ViewSeason {
  return {
    id: db.id,
    showId: db.show_id,
    seasonNumber: db.season_number,
    title: db.title,
    episodeCount: db.episode_count,
  }
}
```

### Pattern 3: Supabase textSearch for FTS
**What:** Use the `.textSearch()` method on the pre-built `fts` generated column. The `websearch` type is safest for user input (never throws syntax errors).
**When to use:** Search query functions.
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/textsearch
export async function searchShows(query: string): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .in('status', ['now-streaming', 'coming-soon'])
    .textSearch('fts', query, { type: 'websearch', config: 'english' })
    .limit(20)

  return (data ?? []).map(mapShow)
}

export async function searchEpisodes(query: string): Promise<(ViewEpisode & { showTitle: string; showSlug: string; showBrandColor: ViewShow['brandColor'] })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('*, shows!inner(title, slug, brand_color, status)')
    .eq('archived', false)
    .eq('status', 'published')
    .textSearch('fts', query, { type: 'websearch', config: 'english' })
    .limit(30)

  return (data ?? []).map((e: any) => ({
    ...mapEpisode(e),
    showTitle: e.shows.title,
    showSlug: e.shows.slug,
    showBrandColor: e.shows.brand_color as ViewShow['brandColor'],
  }))
}
```

### Pattern 4: Server-Side User Hydration for Navbar
**What:** Pass the authenticated user from the server layout to the Navbar to prevent the flash of "Sign In" button on page load for logged-in users.
**When to use:** Viewer layout (`src/app/(viewer)/layout.tsx`).
**Example:**
```typescript
// src/app/(viewer)/layout.tsx
import { createClient } from '@/lib/supabase/server'

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Navbar initialUser={user ? { id: user.id, email: user.email ?? '' } : null} />
      <div className="pt-16">{children}</div>
      <Footer />
    </>
  )
}
```

### Pattern 5: Search Page with Server searchParams
**What:** Dedicated `/search` page that reads `q` from `searchParams` (Next.js async prop in v16).
**When to use:** Search results route.
**Example:**
```typescript
// src/app/(viewer)/search/page.tsx
interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  
  if (!q || q.trim().length === 0) {
    return <SearchEmptyState />
  }

  const [shows, episodes] = await Promise.all([
    searchShows(q),
    searchEpisodes(q),
  ])

  return <SearchResults query={q} shows={shows} episodes={episodes} />
}
```

### Anti-Patterns to Avoid
- **Importing `Show` type from mock-data in new code:** Always use `ViewShow` from `queries.ts`
- **Using `as any` casts for DB-to-component mapping:** Use proper `mapEpisode()`/`mapSeason()` functions
- **Building a command-palette for search:** Decision is a dedicated page, not overlay
- **Adding global auth context/provider:** AuthSection's `onAuthStateChange` listener is sufficient
- **Using `getSession()` on the server:** Always use `getUser()` which validates the JWT (already correctly done in middleware)
- **Checking for `locked` status in episode rendering:** DB has `draft | coming-soon | published`. Remove `locked` from all component logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom LIKE/ILIKE queries | Supabase `.textSearch()` with `websearch` type | FTS columns + GIN indexes already exist. `.textSearch()` uses `websearch_to_tsquery` which handles user input safely. |
| Auth session management | Custom cookie/JWT handling | @supabase/ssr middleware | Already working. Handles token refresh, cookie setting, secure validation. |
| Error message mapping | Inline switch statements in each form | Centralized `authErrorMap` utility | Single source of truth, easy to update, consistent UX across login/signup. |
| Brand color lookups | Inline hex values or duplicate maps | `BRAND_COLOR_HEX` from `brand-colors.ts` | Already exists in mock-data, just needs extraction. Single source of truth. |
| Type mapping (DB -> View) | Ad-hoc object spreads with `as any` | `mapShow()`, `mapEpisode()`, `mapSeason()` functions | Type-safe, reusable, centralized. Eliminates scattered `as any` casts. |
| URL search param state | Manual `URLSearchParams` parsing | Next.js `searchParams` async prop | Built-in, type-safe with Next.js 16, zero-dependency. |

**Key insight:** Phase 8 is primarily a wiring/integration phase. Every building block exists -- the risk is not in building new things but in properly connecting what already exists without type-safety regressions.

## Common Pitfalls

### Pitfall 1: Mock Type vs View Type Mismatch
**What goes wrong:** Components import `Show` from mock-data and `ViewShow` from queries -- they are structurally similar but have subtle differences (mock `Show` has `releaseYear`, `cast`, `director`, `viewCount`, `instagramHandle` etc. that `ViewShow` does not). Components that rely on mock-only fields will fail silently or show `undefined`.
**Why it happens:** Gradual migration leaves some components half-migrated.
**How to avoid:** Migrate type imports and data props together as a unit. After extracting brand-colors, update each component's type import from `mock-data` to `queries` and verify it compiles with `tsc --noEmit`. Never mix sources.
**Warning signs:** `tsc` errors about missing properties, runtime `undefined` where data should appear.

### Pitfall 2: Status Value Mismatch (locked vs draft)
**What goes wrong:** Mock data defines episode status as `'published' | 'coming-soon' | 'locked'`. The DB uses `'draft' | 'coming-soon' | 'published'`. Components with `if (status === 'locked')` branches will never trigger on real data; draft episodes will render without any special treatment.
**Why it happens:** `locked` was a UI-only concept for unreleased episodes. The DB schema uses `draft` instead.
**How to avoid:** Remove all `locked` references from component logic. Replace with `draft` handling (visually identical -- dimmed, unclickable). Update the `ViewEpisode` status union to `'published' | 'coming-soon' | 'draft'`.
**Warning signs:** Episode cards showing as fully interactive when they should appear locked/unavailable.

### Pitfall 3: Supabase Email Confirmation Blocking Signup
**What goes wrong:** If Supabase project has email confirmation enabled (default on hosted projects), `signUp()` returns success but the user cannot log in until they confirm their email. The user sees "Invalid login credentials" immediately after signing up.
**Why it happens:** Supabase Auth default settings require email confirmation.
**How to avoid:** Check Supabase dashboard > Authentication > Providers > Email. Either disable "Confirm email" for v1 (decision from CONTEXT.md), or handle the confirmation flow. The CONTEXT.md decision is to disable it for v1.
**Warning signs:** Signup succeeds (no error) but immediate login fails.

### Pitfall 4: Search on Empty/Short Queries
**What goes wrong:** User submits empty string or single character. Postgres FTS with `websearch_to_tsquery('')` returns empty results, but the query still hits the database. Very short queries (1-2 characters) may return unexpected results or be too broad.
**Why it happens:** No input validation before the query.
**How to avoid:** Validate minimum query length (2-3 characters) before calling search functions. Show a message like "Enter at least 2 characters to search" for short queries. Return early from search functions for empty/too-short input.
**Warning signs:** Empty results pages when user accidentally submits empty form.

### Pitfall 5: AuthSection Flash of Unauthenticated State
**What goes wrong:** On page load, `AuthSection` shows "Sign In" button briefly before `getUser()` resolves and `onAuthStateChange` fires. This causes a visible flash for logged-in users.
**Why it happens:** Client-side auth check is asynchronous. The component renders the unauthenticated state first.
**How to avoid:** Pass initial user state from the server layout (Pattern 4 above). The client listener then only handles changes, not initial state.
**Warning signs:** Brief flicker of "Sign In" button on every navigation for logged-in users.

### Pitfall 6: RLS Blocking Search Results
**What goes wrong:** FTS search on `episodes` table returns no results even though matching data exists.
**Why it happens:** The RLS policy for episodes requires `status IN ('published', 'coming-soon') AND show.status IN ('now-streaming', 'coming-soon')`. Draft episodes or episodes of draft shows are invisible to public queries.
**How to avoid:** This is correct behavior. Only search published/visible content. The `.textSearch()` query respects RLS automatically because it runs with the anon/authenticated role. No action needed beyond being aware of it.
**Warning signs:** None -- this is working as intended. Test with published content.

## Code Examples

### Auth Error Mapping
```typescript
// src/lib/auth-errors.ts
const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email or password is incorrect.',
  'Email not confirmed': 'Please check your email and confirm your account.',
  'User already registered': 'An account with this email already exists.',
  'Signup requires a valid password': 'Password must be at least 6 characters.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  'Email rate limit exceeded': 'Too many attempts. Please try again later.',
  'For security purposes, you can only request this once every 60 seconds': 
    'Please wait a moment before trying again.',
}

export function mapAuthError(rawMessage: string): string {
  return AUTH_ERROR_MAP[rawMessage] ?? 'Something went wrong. Please try again.'
}
```

### Genres Query (Derived from DB)
```typescript
// In queries.ts
export async function getDistinctGenres(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('genre')
    .eq('archived', false)
    .in('status', ['now-streaming', 'coming-soon'])

  if (!data) return []
  return [...new Set(data.map((row) => row.genre))].sort()
}
```

### Schedule Query
```typescript
// In queries.ts
export async function getScheduleShows(): Promise<(ViewShow & { broadcastDay: string | null; broadcastTime: string | null })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .eq('status', 'now-streaming')
    .not('broadcast_day', 'is', null)
    .order('broadcast_day')

  return (data ?? []).map((s) => ({
    ...mapShow(s),
    broadcastDay: s.broadcast_day,
    broadcastTime: s.broadcast_time,
  }))
}
```

### Coming Soon Query (Episodes)
```typescript
// In queries.ts
export async function getComingSoonEpisodes(): Promise<(ViewEpisode & { showTitle: string; showSlug: string; showBrandColor: ViewShow['brandColor'] })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('*, shows!inner(title, slug, brand_color, status)')
    .eq('status', 'coming-soon')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []).map((e: any) => ({
    ...mapEpisode(e),
    showTitle: e.shows.title,
    showSlug: e.shows.slug,
    showBrandColor: e.shows.brand_color as ViewShow['brandColor'],
  }))
}
```

## Mock-Data Import Inventory

Complete list of files importing from `mock-data.ts` that must be migrated:

| File | What it imports | Migration action |
|------|----------------|------------------|
| `src/app/(viewer)/page.tsx` | `MOCK_REELS` | Remove reels section entirely (no DB table) or replace with "New Episodes" rail |
| `src/app/(viewer)/coming-soon/page.tsx` | `COMING_SOON_SHOWS`, `getComingSoonEpisodesFromStreamingShows`, `brandColorHexMap`, `Show` | Rewrite with Supabase queries |
| `src/components/home/genres-grid.tsx` | `MOCK_SHOWS` | Query distinct genres from DB |
| `src/components/home/hero-banner.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/home/hero-slide.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/home/content-rail.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/shows/show-card.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/shows/portrait-show-card.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/shows/coming-soon-show-card.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/shows/episode-art-card.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/shows/reel-card.tsx` | `Reel`, `Show`, `MOCK_SHOWS`, `brandColorBgMap`, `isReelFresh` | Remove with reels section, or rewrite |
| `src/components/auth/show-collage.tsx` | `Show`, `brandColorHexMap` | Change to `ViewShow`, `BRAND_COLOR_HEX`. Still needs show data -- pass as prop from server. |
| `src/components/watch/watch-page-content.tsx` | `Episode`, `Show`, `Season`, `brandColorBgMap` | Change to `ViewEpisode`, `ViewShow`, `ViewSeason`, `BRAND_COLOR_BG` |
| `src/components/watch/episode-nav.tsx` | `Episode` | Change to `ViewEpisode` (or a minimal nav type) |
| `src/components/series/season-selector.tsx` | `Season` | Change to `ViewSeason` |
| `src/components/series/series-detail-hero.tsx` | `Show`, `Season`, `brandColorHexMap` | Change to `ViewShow`, `ViewSeason`, `BRAND_COLOR_HEX` |
| `src/components/series/series-detail-content.tsx` | `Season`, `Episode`, `Show`, `brandColorHexMap` | Change to view types + `BRAND_COLOR_HEX` |
| `src/components/series/episode-row.tsx` | `Episode`, `Show`, `brandColorHexMap` | Change to `ViewEpisode`, `ViewShow`, `BRAND_COLOR_HEX` |
| `src/components/series/episode-list.tsx` | `Episode`, `Show` | Change to `ViewEpisode`, `ViewShow` |
| `src/components/series/metadata-card.tsx` | `Show` | Change to `ViewShow` |
| `src/components/series/shows-carousel.tsx` | `Show` | Change to `ViewShow` |
| `src/components/series/reviews-section.tsx` | `ShowReview` | Likely remove or stub -- no reviews table in DB |

**Total: 23 files** importing from `mock-data.ts`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSession()` for server auth checks | `getUser()` validates JWT against Supabase keys | Supabase SSR v0.5+ (2024) | Security: `getSession()` can return tampered data. `getUser()` validates. Already correct in middleware.ts. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Already using correct package. |
| `plainto_tsquery` for search | `websearch_to_tsquery` via `{ type: 'websearch' }` | Available since Postgres 11 | Never raises syntax errors on user input. Safer for raw user queries. |

**Deprecated/outdated:**
- `mock-data.ts`: Being eliminated in this phase. All types and data move to `queries.ts` and `brand-colors.ts`.
- `locked` episode status: Frontend-only concept. DB uses `draft`. Remove from all components.
- `Reel` and `ShowReview` interfaces: No corresponding DB tables. Remove or stub.

## Open Questions

1. **Show collage on auth page**
   - What we know: `ShowCollage` component imports `MOCK_SHOWS` directly. Auth page is a server component.
   - What's unclear: After mock-data deletion, where does the collage get its shows? It needs show data at render time.
   - Recommendation: Fetch shows on the server in the auth page and pass them as props to `ShowCollage`. Since auth page is server component, this is straightforward.

2. **Reviews section on series detail**
   - What we know: `ReviewsSection` uses `ShowReview` type from mock-data. No `reviews` table exists in the DB schema.
   - What's unclear: Is reviews section currently visible on series detail pages?
   - Recommendation: Remove or hide reviews section. It has no data source. If the component is not actively rendered, just update its type import and leave it dormant.

3. **Episode thumbnails in search results**
   - What we know: Episodes have no `thumbnail_url` field in the DB. CONTEXT.md mentions using show artwork or YouTube thumbnail derivation.
   - What's unclear: Exact thumbnail strategy for episode cards in search results.
   - Recommendation: Use `ShowArt` component with the parent show's brand color (already the pattern in `EpisodeRow`). For episodes with a `youtube_video_id`, could use `https://img.youtube.com/vi/{id}/mqdefault.jpg` as thumbnail.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.x (E2E only, no unit test framework) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx tsc --noEmit` (type checking -- per project memory: no dev server in worktrees) |
| Full suite command | `npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup with email/password | manual (requires Supabase) | Deploy to Vercel, test manually | N/A |
| AUTH-02 | Login + session persistence | manual (requires Supabase) | Deploy to Vercel, test manually | N/A |
| AUTH-03 | Logout from any page | manual (requires Supabase) | Deploy to Vercel, test manually | N/A |
| SRCH-01 | Search bar in header | type-check | `npx tsc --noEmit` | N/A |
| SRCH-02 | Search finds shows/episodes | manual (requires Supabase data) | Deploy to Vercel, test manually | N/A |
| SRCH-03 | Search results with cards | type-check + visual | `npx tsc --noEmit` + Vercel preview | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + deploy to Vercel
- **Phase gate:** Full `tsc --noEmit` green + Vercel deploy + manual verification of all 4 success criteria

### Wave 0 Gaps
None -- existing test infrastructure (type checking) covers compilation. Auth and search require live Supabase instance for functional testing (Vercel deploy per project memory).

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260401000000_create_schema.sql` -- FTS columns, generated tsvector, GIN indexes confirmed
- `supabase/migrations/20260401000001_create_rls_policies.sql` -- RLS policies for shows, episodes, profiles
- `src/lib/queries.ts` -- Existing ViewShow type and query patterns
- `src/lib/mock-data.ts` -- Complete inventory of types and exports to migrate
- `src/components/auth/login-form.tsx`, `signup-form.tsx`, `auth-section.tsx` -- Current auth implementation

### Secondary (MEDIUM confidence)
- [Supabase JS textSearch API](https://supabase.com/docs/reference/javascript/textsearch) -- `.textSearch(column, query, { type: 'websearch', config: 'english' })` syntax
- [Supabase Full-Text Search Guide](https://supabase.com/docs/guides/database/full-text-search) -- FTS patterns, `websearch_to_tsquery` behavior
- [Supabase SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Cookie-based session management pattern

### Tertiary (LOW confidence)
None -- all findings verified against codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use, versions verified from `package.json`
- Architecture: HIGH -- patterns derived from actual codebase analysis of 23 files
- Pitfalls: HIGH -- status mismatch (`locked` vs `draft`) and email confirmation trap confirmed by reading actual code and schema
- Search implementation: HIGH -- FTS columns and indexes confirmed in migration SQL, `.textSearch()` API verified against Supabase docs
- Mock migration scope: HIGH -- complete grep of all 23 importing files documented

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- no fast-moving dependencies)
