# Phase 8: Data Integration, Auth & Search - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Source:** Codex AI analysis (14 decisions surfaced from codebase inspection)

<domain>
## Phase Boundary

Phase 8 wires the viewer frontend to live Supabase data, completes auth flows, and adds search. The backend (schema, RLS, admin dashboard) is already complete from Phases 6-7. Most catalog pages already query Supabase via `src/lib/queries.ts`, but shared components still import types/data from `mock-data.ts`. Auth UI components exist but need verification and UX hardening. Search is entirely new.

**Key finding:** The schedule page referenced in Success Criterion 1 does not exist as a viewer route. The broadcast schedule is admin-only. Phase 8 must either create a viewer schedule page or acknowledge the gap.

</domain>

<decisions>
## Implementation Decisions

### Data Integration — Mock Cleanup

- **Complete the ViewShow/ViewEpisode type migration.** Move all shared viewer components off `mock-data.ts` imports onto the `ViewShow` type already defined in `queries.ts`. Extract brand-color hex maps into a standalone utility (e.g., `src/lib/brand-colors.ts`), not in mock-data.
- **Scope: broad cleanup.** Wire `/series` (currently redirects to home), `/coming-soon` (fully mock-backed), and clean all residual mock-backed sections on home (genres grid, reels).
- **Genres: derive from DB.** Query distinct genres from `shows` table. Hide reels section or replace with "New Episodes" rail — no `reels` table exists in the schema.
- **Introduce `ViewEpisode` and `ViewSeason` types** in `queries.ts` alongside existing `ViewShow`. Stop using `as any` casts. Fix the status mismatch: DB uses `draft | coming-soon | published`, mock components expect `locked` — remove `locked` from component logic entirely.
- **Schedule page:** Create a simple viewer schedule page at `/schedule` that queries `shows` with `broadcast_day`/`broadcast_time` fields (already in DB schema). This satisfies Success Criterion 1.
- **Delete `mock-data.ts`** once all imports are migrated. No mock data should remain in the viewer at phase completion.

### Auth Flow

- **Keep auth client-side.** Current browser-client `signInWithPassword`/`signUp` pattern in `login-form.tsx` and `signup-form.tsx` is correct. Session refresh is handled by SSR middleware. No server actions needed.
- **Ship email/password only.** No email confirmation, no password reset for Phase 8. These are not in the success criteria. If Supabase has email confirmation enabled in the dashboard, disable it for v1 or add a proper confirmation redirect flow.
- **Map auth errors to product copy.** Replace raw `error.message` display with mapped user-friendly messages for common Supabase errors (invalid credentials, email already registered, weak password). Keep raw messages in console for debugging.
- **Verify the full flow works end-to-end:** signup creates account + profile row (trigger exists), login sets session cookie, refresh persists session, sign-out clears state and redirects home.

### Search

- **Postgres FTS with existing generated columns.** The schema already has generated `fts` tsvector columns + GIN indexes on both `shows` and `episodes` tables. Use `.textSearch('fts', query)` via Supabase client. No new migration needed.
- **Separate queries, app-level merge.** Query shows and episodes separately, return both result sets. Don't build a Postgres RPC for v1.
- **Header form + dedicated `/search` page.** Search icon in navbar opens/routes to `/search?q=...`. No command-palette overlay. The app is SSR-heavy and route-based — a dedicated page is the natural fit.
- **No live debounce for v1.** User types query, submits, sees results page. Add typeahead suggestions in a future phase if needed.
- **Two-section results layout.** "Shows" section with show cards, "Episodes" section with episode cards. Reuse existing card components. Episode thumbnails will use show artwork / YouTube thumbnail derivation since there's no episode thumbnail field in the schema.

### Session & State

- **No global auth context.** Only navbar/profile/admin need live auth awareness. The existing `AuthSection` component with `onAuthStateChange` listener is sufficient.
- **Hydrate initial navbar state from server.** Small improvement: pass the user from the server layout to navbar for instant render, then let the client listener keep it fresh. Avoids the flash of "Sign In" button for logged-in users.
- **Session persistence via existing infrastructure.** Supabase SSR cookies + middleware refresh is already working. AUTH-02 is satisfied by fixing UI hydration gaps, not adding new state stores.

### Claude's Discretion

- File organization for new search components
- Exact search results page layout and empty-state design
- Error/loading states for search
- Whether to add `nuqs` for search query URL state or use plain `searchParams`
- Exact error message copy for auth error mapping

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Layer
- `src/lib/queries.ts` — All viewer Supabase queries and ViewShow type definition
- `src/lib/database.types.ts` — Generated DB types (source of truth for column names/types)
- `src/lib/mock-data.ts` — File to be eliminated; current mock types and data
- `src/lib/supabase/server.ts` — Server-side Supabase client factory
- `src/lib/supabase/client.ts` — Browser-side Supabase client factory

### Auth
- `src/components/auth/login-form.tsx` — Current login implementation
- `src/components/auth/signup-form.tsx` — Current signup implementation
- `src/components/auth/auth-panel.tsx` — Tab container for login/signup
- `src/components/layout/auth-section.tsx` — Navbar auth state listener
- `src/lib/supabase/middleware.ts` — Session refresh logic
- `middleware.ts` — Root middleware calling updateSession

### Viewer Pages (data integration targets)
- `src/app/(viewer)/page.tsx` — Home page (partially wired)
- `src/app/(viewer)/series/page.tsx` — Series listing (NOT wired, redirects home)
- `src/app/(viewer)/series/[slug]/page.tsx` — Series detail (wired)
- `src/app/(viewer)/coming-soon/page.tsx` — Coming soon (NOT wired, fully mock)
- `src/app/(viewer)/watch/[episodeId]/page.tsx` — Watch page (wired, has `as any` casts)

### Schema
- `supabase/migrations/20260401000000_create_schema.sql` — DB schema with FTS columns, profile trigger, broadcast fields

</canonical_refs>

<specifics>
## Specific Ideas

- Brand color hex map extraction: `const BRAND_COLOR_HEX: Record<ViewShow['brandColor'], string>` in `src/lib/brand-colors.ts`
- Search query helper: `searchShows(query: string)` and `searchEpisodes(query: string)` in `queries.ts`
- Schedule page: simple grid/table showing shows with their broadcast day/time, grouped by day
- Auth error map: `{ 'Invalid login credentials': 'Email or password is incorrect', 'User already registered': 'An account with this email already exists' }`

</specifics>

<deferred>
## Deferred Ideas

- Email confirmation flow (requires Supabase dashboard config + redirect URL setup)
- Password reset flow
- Live search typeahead / command-palette overlay
- Postgres RPC for unified ranked search results
- Reels feature (no DB table exists)
- Social auth providers (Google, Apple)

</deferred>

---

*Phase: 08-data-integration-auth-search*
*Context gathered: 2026-04-04 via Codex AI analysis*
