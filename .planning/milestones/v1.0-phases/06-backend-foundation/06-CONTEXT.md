# Phase 6: Backend Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure the Supabase backend — database schema (series, seasons, episodes, users, watch_progress, watchlist), Row Level Security policies, auth client setup (server + browser), storage bucket for artwork, and seed data with real CIT content. Delivers a fully secured, ready-to-use backend that the admin dashboard (Phase 7) and data integration (Phase 8) build on top of.

</domain>

<decisions>
## Implementation Decisions

### Database Schema
- **D-01:** UUIDs as primary keys (Supabase default `gen_random_uuid()`). Slugs stored as separate unique columns for URL routing (e.g., `/series/last-call`).
- **D-02:** Schema includes all 15 CIT programs from PROJECT.md seeded from the start. Platform looks complete from day one, admin fills in episodes over time.
- **D-03:** Episodes store `youtube_video_id` only (11-character ID). Embed URLs constructed in frontend code. No full YouTube URL column needed.
- **D-04:** Episode ordering by `episode_number` column only. No separate `sort_order` column. Admin reordering (ADMN-08) renumbers `episode_number`.
- **D-05:** Broadcast schedule stored as columns on the `shows` table: `broadcast_day` (text) and `broadcast_time` (time). Simple for 15 shows with fixed schedules.
- **D-06:** Bilingual fields added now: nullable `title_ar`, `description_ar` columns on shows, seasons, and episodes. Stay null until Arabic content is entered. Avoids future migration.
- **D-07:** `brand_color` stored as text column with CHECK constraint limiting to 5 brand color values (`brand-blue`, `brand-purple`, `brand-green`, `brand-red`, `brand-orange`). Easier to extend than Postgres enums.
- **D-08:** All user-facing tables created now: shows, seasons, episodes, profiles, watch_progress, watchlist. Complete schema in one migration pass. watch_progress and watchlist sit empty until Phase 9.

### RLS Policies & Auth Strategy
- **D-09:** Admin identified by environment variable (`ADMIN_USER_ID` containing Supabase user UUID). RLS policies check `auth.uid() = current_setting('app.admin_user_id')`. Admin can be changed without a migration.
- **D-10:** Both server-side and browser-side Supabase clients set up using `@supabase/ssr`. `createServerClient()` for Server Components/Actions, `createBrowserClient()` for Client Components. Cookie-based session sharing.
- **D-11:** Published content readable via anon key + RLS. RLS policies grant SELECT on published content to the anon role. Frontend queries Supabase directly. No API proxy layer for reads.
- **D-12:** RLS policy structure: public SELECT on published content (anon + authenticated), INSERT/UPDATE/DELETE restricted to admin only (via env var check). Unauthenticated browsing works out of the box (AUTH-04).

### Seed Data Strategy
- **D-13:** Seed data as SQL migration file in `supabase/migrations/`. Runs automatically with `supabase db reset`. Version-controlled and reproducible.
- **D-14:** Real CIT content from PROJECT.md — actual show names, descriptions, genres, broadcast schedules. Episode titles can be placeholder since real ones aren't available. Platform looks authentic during development.
- **D-15:** 3-5 episodes per season. Enough to demonstrate the UI (season selector, episode list, prev/next nav) without excessive placeholder data. Admin adds real episodes through Phase 7 dashboard.

### Storage Setup
- **D-16:** Supabase Storage bucket created in this phase (not deferred to Phase 7). Bucket, RLS policies, and path conventions all part of the backend foundation.
- **D-17:** Public bucket for show artwork. Images served directly via Supabase CDN URL — no auth needed to view show marketing material. Simpler frontend code.
- **D-18:** Three image slots per show: `poster` (vertical card art for ShowCard), `hero` (wide banner for SeriesDetailHero), `logo` (show wordmark/icon for hero overlay). Path convention: `shows/{show_id}/poster.webp`, `shows/{show_id}/hero.webp`, `shows/{show_id}/logo.png`.

### Claude's Discretion
- Exact column types and constraints (varchar lengths, nullable vs default values)
- Migration file naming and numbering convention
- Supabase client utility file structure (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, etc.)
- Whether to use Supabase's built-in `auth.users` or create a separate `profiles` table (standard pattern is profiles with FK to auth.users)
- Index strategy (which columns get indexes beyond PKs and FKs)
- TypeScript type generation approach (Supabase CLI `gen types` vs manual types)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Full CIT context: 15 programs with names, descriptions, genres, durations, broadcast schedules. Design system colors. Constraints.
- `.planning/REQUIREMENTS.md` — FOUN-02 (DB schema), FOUN-03 (RLS), AUTH-04 (unauthenticated browsing), AUTH-05 (admin by ID check)

### Technology Stack
- `CLAUDE.md` §Technology Stack — Supabase client versions (`@supabase/supabase-js ^2.101.x`, `@supabase/ssr ^0.10.x`), Supabase CLI `^2.84.x` for local dev and type generation

### Existing Mock Data (schema blueprint)
- `src/lib/mock-data.ts` — Current Show, Season, Episode TypeScript interfaces and mock data. Schema must support all fields in these types plus the additions decided above (bilingual, broadcast_schedule, artwork URLs).

### Prior Phase Context
- `.planning/phases/01-project-scaffolding-design-system/01-CONTEXT.md` — D-08 (dark-only mode), D-01 (src/ directory structure)
- `.planning/phases/02-app-shell-navigation/02-CONTEXT.md` — D-06/D-07 (auth states: Sign In button vs avatar dropdown — informs profiles table)
- `.planning/phases/03-home-page-catalog-ui/03-CONTEXT.md` — Brand color mapping pattern (brandColorBgMap) — informs brand_color CHECK constraint values
- `.planning/phases/05-watch-page-ui/05-CONTEXT.md` — YouTube IFrame API pattern, youtubeId field usage — informs youtube_video_id column design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@supabase/supabase-js` and `@supabase/ssr` already in package.json — no install needed
- `src/lib/mock-data.ts` — Show, Season, Episode interfaces define the data model the schema must match. Helper functions (getShowBySlug, getSeasonsByShowId, etc.) show the query patterns the Supabase client will need to support.
- `src/lib/utils.ts` — cn() utility (clsx + tailwind-merge), standard shadcn pattern

### Established Patterns
- `src/lib/` is where utility modules live (mock-data.ts, utils.ts). Supabase client files should go here (e.g., `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`)
- Static brand color maps in mock-data.ts use the 5 brand color keys that must match the DB CHECK constraint values
- Server/client component boundary: server components for data fetching, client components only for interactivity. Supabase server client will be used in Server Components and Server Actions.

### Integration Points
- `src/app/layout.tsx` — Root layout. May need Supabase auth provider or middleware for session management.
- `src/app/series/[slug]/page.tsx` — Currently uses mock data via getShowBySlug(). Phase 8 will swap to Supabase queries.
- `src/app/watch/[id]/page.tsx` — Currently uses getEpisodeById(). Phase 8 will swap to Supabase queries.
- `public/brand/` — CIT logo SVGs already placed. Show artwork will come from Supabase Storage URLs instead.

</code_context>

<specifics>
## Specific Ideas

- All 15 CIT program names and details are in PROJECT.md — seed data should use exact names: Last Call, Review Documentary, Doctor Care, Saturn Podcast, Poets Platform, Kids Area, InFocus, Break Fast Daily, Meta Talk, 360, Music Hub, Laugh or Leave, Island Cooke, 60 Questions Challenge, NextHub
- Break Fast Daily has a Mon-Fri broadcast schedule — the broadcast_day column needs to handle multiple days (consider comma-separated or array)
- Show statuses from ADMN-04: draft, coming-soon, now-streaming
- Episode statuses from ADMN-05: draft, coming-soon, published
- The existing mock Episode type also has 'locked' status — decide if this maps to 'draft' or is a separate status

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-backend-foundation*
*Context gathered: 2026-04-01*
