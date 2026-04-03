# Phase 7: Admin Dashboard - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a protected admin dashboard at `/admin` for managing all CIT platform content — creating, editing, archiving, and permanently deleting shows, seasons, and episodes. Includes artwork upload to Supabase Storage, YouTube URL extraction, broadcast schedule management, episode reordering, and an archive section for soft-deleted content. Admin access is controlled by the `ADMIN_USER_ID` environment variable set up in Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Navigation Structure
- **D-01:** Show list at `/admin` — table view listing all active shows. Clicking a show navigates to its detail page (`/admin/shows/[id]`).
- **D-02:** Show detail page organizes seasons using tabs (Season 1, Season 2...). Same tabs pattern used for viewers in Phase 4 — consistent and familiar.
- **D-03:** Show list is a table with columns: show name, genre, status badge, episode count, broadcast day, and per-row actions (Edit, Archive). **No card grid** — functional, not decorative.
- **D-04:** Archive section accessible via a secondary nav link in the dashboard: `Shows | Archive`. Archive table lists soft-deleted shows with Restore and Permanently Delete actions.

### Editing Approach (Forms)
- **D-05:** All create/edit forms use a **slide-out drawer** (shadcn Sheet component). Applies to shows, seasons, and episodes — uniform pattern throughout the dashboard.
- **D-06:** After saving in the drawer — close drawer + sonner toast confirmation ("Show saved", "Episode saved", etc.). List refreshes with updated data.
- **D-07:** Episode and season drawers use the same pattern as show drawers. No modal/inline exceptions.

### Episode Reordering (ADMN-08)
- **D-08:** Up/down arrow buttons (↑↓) on each episode row. Clicking moves the episode up or down, renumbering `episode_number` in the DB accordingly. **No drag-and-drop** — no dnd-kit library needed.

### Artwork Upload UX (ADMN-06)
- **D-09:** Three upload zones inside the show editing drawer: Poster, Hero banner, Logo. Each zone shows the current image (if one exists) with a "Replace" or "Upload" button below it.
- **D-10:** Files upload **immediately on file selection** — file picker opens → image uploads to Supabase Storage instantly → preview appears in the upload zone. The DB record update (storing the storage path) happens on form save.
- **D-11:** Artwork paths follow the Phase 6 convention: `shows/{show_id}/poster.webp`, `shows/{show_id}/hero.webp`, `shows/{show_id}/logo.png`.

### Admin Access & Route Protection (ADMN-10)
- **D-12:** `/admin` route protected via server component check: `auth.uid() === ADMIN_USER_ID` (env var from Phase 6 D-09). If match, render dashboard. If no match (non-admin or unauthenticated), redirect to `/` with no error message.
- **D-13:** "Admin" link added to the nav avatar dropdown in this phase, **conditional on the logged-in user being the admin** (`auth.uid() === ADMIN_USER_ID`). Non-admin users never see this link. This touches the Phase 2 nav component.
- **D-14:** Admin logs in via the existing `/auth` page — no separate admin login page.

### Archive & Delete Flow
- **D-15:** **Archive-first pattern.** The Delete button archives the item (soft delete) — it does NOT permanently delete immediately.
- **D-16:** `archived: boolean DEFAULT false` column added via DB migration to both `shows` and `episodes` tables. Seasons follow their parent show's archive state.
- **D-17:** Archived shows are hidden from all viewer-facing pages automatically (RLS or query filter on `archived = false`).
- **D-18:** Confirmation dialog before archiving: "This will hide the show from viewers. Continue?" with Cancel / Archive buttons.
- **D-19:** From the Archive section, admin can: Restore (unarchive) or Permanently Delete. Permanent delete shows a confirmation dialog: "This will permanently delete the show and all its seasons and episodes. This cannot be undone." — cascade deletes.

### Dashboard Visual Style
- **D-20:** Same dark CIT theme (black/near-black backgrounds, CIT brand color accents) but **table-focused, functional layout**. No cinematic hero banners in the admin. Reuses the Phase 1 design system tokens (colors, typography, spacing).

### Claude's Discretion
- Exact table column widths and responsive breakpoints for admin tables
- Form field order within each drawer (beyond what ADMN-01 through ADMN-07 specify)
- Toast message copy ("Show saved" vs "Changes saved" etc.)
- Drawer width (standard shadcn Sheet sizing)
- Whether to add `form.tsx` and `dialog.tsx` shadcn components or use native HTML elements
- Middleware-level admin route protection vs server component check (either approach achieves D-12)
- Pagination or scroll on the show list (unlikely needed for 15 shows)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Full CIT context: 15 programs with names, descriptions, genres, durations, broadcast schedules. Brand colors. Constraints.
- `.planning/REQUIREMENTS.md` — ADMN-01 through ADMN-10 (all admin requirements for this phase)

### Backend Foundation (Phase 6 — critical for this phase)
- `.planning/phases/06-backend-foundation/06-CONTEXT.md` — All DB decisions: admin identification (D-09), youtube_video_id column (D-03), episode_number ordering (D-04), Supabase Storage bucket and path conventions (D-16, D-17, D-18), RLS policy structure (D-11, D-12). Read this before any DB or auth work.

### Supabase Clients
- `src/lib/supabase/admin.ts` — Service role client (`createAdminClient()`). Use this in Server Actions for all admin write operations (bypasses RLS). NEVER import in client-side code.
- `src/lib/supabase/server.ts` — Standard server client for read operations.
- `src/lib/database.types.ts` — Generated TypeScript types for all tables (shows, seasons, episodes, profiles, etc.)

### Existing UI Patterns
- `src/components/ui/tabs.tsx` — Tabs component (already used in Phase 4 for season selector on series detail page). Reuse for admin season tabs.
- `src/components/ui/badge.tsx` — Badge component for status display on show list.
- `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx` — Form building blocks already in the design system.
- `src/components/auth/` — Auth components (auth-panel.tsx, login-form.tsx) — reference for how auth is handled in this codebase.

### Technology Stack
- `CLAUDE.md` §Technology Stack — react-hook-form ^7.72.x + @hookform/resolvers + zod ^4.3.x for forms, sonner for toasts, shadcn/ui (Sheet component needed for drawers, Dialog for confirmations)

### Nav Component (will be modified in this phase)
- Locate the nav component in `src/components/layout/` — needs the conditional "Admin" link added (D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `react-hook-form` + `@hookform/resolvers` + `zod` already installed — use for all admin forms
- `sonner` already installed — use for all save/delete/error toast notifications
- `shadcn/ui` components: `input`, `button`, `badge`, `select`, `tabs`, `textarea`, `checkbox`, `dropdown-menu` all present. `Sheet` (drawer), `Dialog` (confirmation), and `Form` need to be added via shadcn CLI.
- `createAdminClient()` in `src/lib/supabase/admin.ts` — ready-to-use service role client for mutations
- `src/lib/database.types.ts` — generated types for all tables; use `Database['public']['Tables']['shows']['Row']` etc. for type-safe queries

### Established Patterns
- Server Actions pattern: admin write operations should be Server Actions (`.../actions.ts`) that import `createAdminClient()` — consistent with Phase 6 architecture
- `src/lib/` is where utility modules live — YouTube URL extraction utility goes here (e.g., `src/lib/youtube.ts`)
- Component files follow kebab-case naming in `src/components/`

### Integration Points
- `src/middleware.ts` — Currently only refreshes sessions. Admin route protection (D-12) can be added here or in the `/admin/layout.tsx` server component. Both are valid.
- Nav component in `src/components/layout/` — Add conditional "Admin" link in the avatar dropdown (D-13). Needs to check if current user's UID matches `ADMIN_USER_ID` env var.
- No `/admin` route exists yet — create `src/app/admin/` directory structure from scratch.

</code_context>

<specifics>
## Specific Ideas

- **Archive-first delete** is the admin's stated preference: archive first → go to Archive section → permanently delete. This pattern is more cautious than standard CRUD and protects against accidental data loss given the small team.
- **DB migration required**: Add `archived boolean DEFAULT false` to `shows` table and `episodes` table. This is a new migration on top of Phase 6's schema.
- **Upload-then-save artwork flow**: Image files upload to Supabase Storage immediately on file selection (instant preview), but the storage path is written to the DB record on form save. This means partial uploads are possible if admin abandons the form — acceptable trade-off for better UX.
- **YouTube URL extraction** (ADMN-09): Admin pastes a full YouTube URL (various formats: `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/embed/ID`). The platform extracts the 11-character video ID and stores only that. Extraction should happen client-side on input `onChange` with immediate visual feedback (show thumbnail preview after extraction).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-admin-dashboard*
*Context gathered: 2026-04-03*
