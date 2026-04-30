# Phase 6: Backend Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 06-backend-foundation
**Areas discussed:** Database schema design, RLS policies & auth strategy, Seed data strategy, Storage setup for artwork

---

## Database Schema Design

### Primary Key Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| UUIDs (Recommended) | Supabase default gen_random_uuid(). Slugs as separate unique column for URL routing. | ✓ |
| Human-readable IDs | Slugs or custom IDs as PKs. Simpler URLs but uniqueness/reordering harder. | |
| You decide | Claude picks. | |

**User's choice:** UUIDs
**Notes:** Standard Supabase approach. Slugs for URL routing stored separately.

### Show Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 15 programs (Recommended) | Seed all 15 CIT shows from PROJECT.md. Admin fills in episodes later. | ✓ |
| Match mock data (5 shows) | Only seed the 5 shows with existing mock data. | |
| You decide | Claude picks. | |

**User's choice:** All 15 programs
**Notes:** Platform looks fuller from day one.

### YouTube Data Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Video ID only (Recommended) | Store 11-character YouTube ID. Embed URL constructed in code. | ✓ |
| Both URL and ID | Store original URL and extracted ID. | |
| You decide | Claude picks. | |

**User's choice:** Video ID only
**Notes:** Matches existing mock data pattern.

### Episode Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| episode_number only (Recommended) | Simpler. Admin reordering renumbers episode_number. | ✓ |
| Separate sort_order | Float/integer sort column for drag-and-drop. | |
| You decide | Claude picks. | |

**User's choice:** episode_number only

### Broadcast Schedule Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Columns on shows table (Recommended) | broadcast_day (text) and broadcast_time (time) directly on shows. | ✓ |
| Separate schedule table | Normalized show_schedules table. | |
| You decide | Claude picks. | |

**User's choice:** Columns on shows table

### Bilingual Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Add columns now (Recommended) | Nullable title_ar, description_ar on shows/seasons/episodes. Avoids future migration. | ✓ |
| Defer to v2 | English-only schema. Arabic columns added later. | |

**User's choice:** Add columns now

### Brand Color Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Text + CHECK constraint (Recommended) | Text column with CHECK limiting to 5 values. Easier to extend than enum. | ✓ |
| Postgres enum type | Stricter but harder to modify. | |
| Plain text, no constraint | Validation in app code only. | |
| You decide | Claude picks. | |

**User's choice:** Text column with check constraint

### User Tables Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Create now (Recommended) | All tables in one migration. watch_progress/watchlist sit empty until Phase 9. | ✓ |
| Defer to Phase 9 | Only content tables now. User tables later. | |

**User's choice:** Create now

---

## RLS Policies & Auth Strategy

### Admin Identification

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variable (Recommended) | Admin UUID in env var. RLS checks current_setting('app.admin_user_id'). Changeable without migration. | ✓ |
| Hardcoded UUID in policies | UUID written directly into SQL. Requires migration to change. | |
| is_admin column on profiles | Boolean on profiles table. Extensible but overkill for single admin. | |
| You decide | Claude picks. | |

**User's choice:** Environment variable

### Supabase Client Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Both clients (Recommended) | Server + browser clients via @supabase/ssr. Cookie-based session sharing. | ✓ |
| Server client only | Browser client deferred to Phase 8. | |
| You decide | Claude picks. | |

**User's choice:** Both clients

### Read Access Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Anon key + RLS (Recommended) | RLS grants SELECT to anon role. Frontend queries Supabase directly. | ✓ |
| Server-side API routes | All reads through Next.js. Supabase only server-side. | |

**User's choice:** Anon key + RLS

---

## Seed Data Strategy

### Seed Format

| Option | Description | Selected |
|--------|-------------|----------|
| SQL migration file (Recommended) | .sql in supabase/migrations/. Runs with db reset. Version-controlled. | ✓ |
| Supabase seed.sql | Built-in seed.sql file. Runs after migrations. | |
| TypeScript seed script | .ts script using Supabase client. Requires separate execution. | |
| You decide | Claude picks. | |

**User's choice:** SQL migration file

### Seed Content

| Option | Description | Selected |
|--------|-------------|----------|
| Real CIT content (Recommended) | Actual show names, descriptions, genres from PROJECT.md. Episode titles placeholder. | ✓ |
| Generic placeholders | Lorem ipsum-style. | |
| Copy from mock-data.ts | Mirror existing 5 mock shows, add 10 more with minimal content. | |

**User's choice:** Real CIT content

### Episode Count

| Option | Description | Selected |
|--------|-------------|----------|
| 3-5 per season (Recommended) | Enough for UI demo. Admin adds real episodes in Phase 7. | ✓ |
| Match PROJECT.md counts | Full episode counts. Lots of placeholder data. | |
| You decide | Claude picks. | |

**User's choice:** 3-5 per season

---

## Storage Setup for Artwork

### Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Set up now (Recommended) | Bucket, RLS, path conventions in Phase 6. Phase 7 just adds upload UI. | ✓ |
| Defer to Phase 7 | Storage created when admin upload is built. | |

**User's choice:** Set up now

### Bucket Access

| Option | Description | Selected |
|--------|-------------|----------|
| Public bucket (Recommended) | Images via CDN URL. No auth needed for show artwork. | ✓ |
| Private with signed URLs | Requires signed URL per image. Overkill for public marketing material. | |
| You decide | Claude picks. | |

**User's choice:** Public bucket

### Image Types

| Option | Description | Selected |
|--------|-------------|----------|
| Poster + Hero + Logo (Recommended) | Three slots: poster (card), hero (banner), logo (overlay). Matches existing UI. | ✓ |
| Single artwork image | One image everywhere. Doesn't fit different UI contexts. | |
| You decide | Claude picks. | |

**User's choice:** Poster + Hero + Logo

---

## Claude's Discretion

- Exact column types and constraints
- Migration file naming convention
- Supabase client file structure
- Profiles table design
- Index strategy
- TypeScript type generation approach

## Deferred Ideas

None — discussion stayed within phase scope
