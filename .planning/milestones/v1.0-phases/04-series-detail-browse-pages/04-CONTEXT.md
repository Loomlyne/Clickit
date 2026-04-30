# Phase 4: Series Detail & Browse Pages - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the series detail page and Coming Soon browse page using mock data — completing the full pre-watch browsing journey. Delivers: (1) a `/series/[slug]` detail page with a cinematic backdrop hero, adaptive season selector, and paginated episode list with a "More Like This" rail, and (2) a `/coming-soon` page with two sections (unreleased shows + upcoming episodes). No Supabase yet — all data is TypeScript mock objects. The broadcast schedule (CATL-11) was reclassified as an admin feature and moved to Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Series Detail Page Route

- **D-01:** Route: `/series/[slug]` — keeps all show-related routes under `/series`. Catalog grid is `/series`, individual series is `/series/[slug]`. Clean hierarchy, consistent with streaming platform conventions.

### Series Detail Hero

- **D-02:** Medium backdrop hero, ~45-55vh height. Tall enough to feel cinematic; short enough that the season selector and first episode are visible without scrolling on most desktops.
- **D-03:** Hero content: show title (large, bold) + tagline (1 line) + metadata chips (genre, episode count, season count) + primary "Watch" CTA button (links to first published episode).
- **D-04:** Ambient brand color glow — same visual pattern as the home hero slides. The show's `brandColor` radiates as a soft background glow behind/around the backdrop artwork. Consistent with the established visual language from Phase 3.
- **D-05:** Dark gradient overlay ensures text legibility over the backdrop. Gradient fades into `--background` (`#0A0A0F`) at the bottom edge — no hard border between hero and content below.

### Season Selector

- **D-06:** Adaptive: tabs for shows with 1–5 seasons, dropdown for 6+ seasons. This ensures the UI remains usable when an admin adds many seasons (e.g., 17 seasons). The component checks `seasons.length` at render time and switches the control type accordingly.
- **D-07:** Uses shadcn Tabs component (already installed) for the tab variant. For the dropdown variant, use shadcn Select.

### Episode Card Design

- **D-08:** Horizontal row layout — thumbnail on the left (16:9 aspect ratio, ~200px wide on desktop) + text on the right. Stacked list of full-width rows. Optimized for sequential scanning.
- **D-09:** Episode row content: episode number + title + 1-line description (truncated with ellipsis) + duration chip + status badge.
- **D-10:** Episode states:
  - `published` → full opacity, play-arrow icon on thumbnail hover
  - `coming-soon` → ~45% opacity on thumbnail + clock icon overlay + "Coming Soon" badge
  - `locked` → ~45% opacity on thumbnail + lock icon overlay + "Locked" badge

### Episode List Scaling

- **D-11:** Paginated by chunks — initial render shows first 20 episodes, "Load More" button appends the next 20. Handles admins uploading 100+ episodes per season without DOM bloat or scroll jank. State managed with `useState` (chunk count), no external library needed.

### Series Detail Page Layout (below hero)

- **D-12:** Page structure below the hero: (1) Season selector, (2) Episode list (paginated), (3) "More Like This" horizontal content rail — shows other series in the same genre. Reuses the `ContentRail` component from Phase 3.

### Coming Soon Page

- **D-13:** Route: `/coming-soon`
- **D-14:** Two sections:
  - "Coming Soon" — shows with `status: 'coming-soon'` displayed as `ShowCard` components with a "Coming Soon" badge overlaid on the artwork and slight opacity reduction (~80%) to signal unavailability.
  - "New Episodes Dropping Soon" — episodes with `status: 'coming-soon'` from shows that are already streaming. Displayed as episode cards (same horizontal row design from D-08/D-09) with the locked/coming-soon treatment from D-10.

### Broadcast Schedule (CATL-11 reclassified)

- **D-15:** CATL-11 (broadcast schedule) is an admin management feature, not a viewer-facing page. Moved to Phase 7 (Admin Dashboard). No `/schedule` page is built in Phase 4. This matches the Netflix/Disney+ model — viewers don't see a TV guide grid.

### Mock Data Extension

- **D-16:** Extend `src/lib/mock-data.ts` with `Season` and `Episode` interfaces designed to match the future Supabase schema shape (makes Phase 8 data integration straightforward).
  - `Season`: `{ id, showId, seasonNumber, title, episodeCount }`
  - `Episode`: `{ id, showId, seasonId, episodeNumber, title, description, duration, status: 'published' | 'coming-soon' | 'locked', youtubeId? }`
- **D-17:** Mock data volume: ~2 seasons for multi-season shows (Saturn Podcast, Doctor Care), ~1 season for others. 4–6 episodes per season with a realistic mix of statuses (mostly published, 1–2 coming-soon per season). Enough to validate all episode states and the season switcher without being tedious to write.
- **D-18:** Architecture must handle large counts gracefully — the paginated episode list (D-11) and adaptive season selector (D-06) are the mechanisms. No additional guards needed beyond those two patterns.

### Claude's Discretion

- Exact hero padding, text positioning, gradient stop values
- Motion timing for episode card hover (should be consistent with ShowCard — ~0.25s ease-out)
- Episode thumbnail placeholder treatment (brand color fill + episode number, consistent with show artwork placeholders)
- `ContentRail` section header wording for "More Like This" rail
- Loading/empty state when a season has no episodes
- Whether episode rows have a hover state beyond cursor change (recommend subtle `bg-surface-2` highlight)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System (Phase 1 output — MANDATORY)
- `.planning/phases/01-project-scaffolding-design-system/01-UI-SPEC.md` — Color token values, WCAG-safe tints, typography scale, spacing tokens
- `src/styles/globals.css` — All CIT design tokens in `@theme` block. Brand color tokens: `brand-blue`, `brand-purple`, `brand-green`, `brand-red`, `brand-orange`. Surface tokens: `surface-1`, `surface-2`, `surface-3`. Text hierarchy: `text-primary`, `text-secondary`, `text-muted`.

### Phase 3 Output — Patterns to Extend
- `.planning/phases/03-home-page-catalog-ui/03-CONTEXT.md` — Established visual decisions: hero ambient glow (D-03), ShowCard design (D-09 to D-13), brand ribbon pattern (D-14), mock data structure (D-19), ContentRail (D-17)
- `src/components/shows/show-card.tsx` — Reuse on Coming Soon page; understand group-hover pattern before creating episode card
- `src/components/home/content-rail.tsx` — Reuse as "More Like This" rail on series detail page
- `src/components/home/hero-banner.tsx` — Reference for ambient glow implementation before creating the detail hero
- `src/lib/mock-data.ts` — Current data shape; Phase 4 extends with Season and Episode types

### App Shell
- `src/app/layout.tsx` — Root layout; new routes inherit Navbar automatically
- `src/app/series/page.tsx` — Existing catalog grid at `/series`; new `[slug]/page.tsx` must coexist under this directory

### Requirements
- `.planning/REQUIREMENTS.md` — CATL-03, CATL-04, CATL-05, CATL-06, CATL-07 (Phase 4 scope). Note: CATL-11 moved to Phase 7.

### Stack Reference
- `CLAUDE.md` §Technology Stack — `motion` (^12.x), shadcn Tabs + Select components, Tailwind v4 static class maps required for any new colored elements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/shows/show-card.tsx` — Reuse on Coming Soon page for `status: 'coming-soon'` shows. Add opacity + badge overlay on top.
- `src/components/home/content-rail.tsx` — Reuse as "More Like This" horizontal rail on series detail page. Accepts a `title` prop and `shows` array.
- `src/components/ui/badge.tsx` — Use for status badges (Published, Coming Soon, Locked) and metadata chips (genre, duration).
- `src/components/ui/button.tsx` — Use for "Watch" CTA on detail hero and "Load More" on episode list.
- `src/components/ui/card.tsx` — Available but the episode row is a custom horizontal layout — no need to wrap in Card.
- `src/lib/mock-data.ts` — Contains `Show` interface, `MOCK_SHOWS`, `COMING_SOON_SHOWS`, and `brandColor*Map` utilities. Extend here — do not create a separate file.

### Established Patterns
- **Ambient glow**: Hero ambient color glow uses the show's `brandColor` hex from `brandColorHexMap`. Applied via inline `style` with CSS box-shadow or radial gradient. Read `hero-banner.tsx` for exact implementation before replicating.
- **Static Tailwind class maps**: Any new color-conditional classes MUST use the existing `brandColorBgMap` / `brandColorTextMap` / `brandColorHexMap` — never construct dynamic class names like `bg-${color}`.
- **Motion**: All interactive hover animations use `<motion.div>` with `whileHover={{ scale: N }}` and `transition={{ duration: 0.25, ease: 'easeOut' }}`. Keep consistent.
- **`'use client'`** only when needed: Phase 3 ShowCard is client for `whileHover`. Season tab switcher (click to switch) and Load More button both need `'use client'`. Hero is static → can be server component.
- **`group-focus-within`** for keyboard accessibility on interactive cards (established in Phase 3 ShowCard).

### Integration Points
- New routes to create:
  - `src/app/series/[slug]/page.tsx` — Series detail page
  - `src/app/coming-soon/page.tsx` — Coming Soon page
- Series detail page links: ShowCard's "Watch" overlay button (in Phase 3) will eventually link to `/series/[slug]`. The `slug` field already exists on `Show`.
- Episode rows will eventually link to `/watch/[episodeId]` — use `#` placeholder links for Phase 4 (Phase 5 adds the watch page).

</code_context>

<specifics>
## Specific Ideas

- Episode card feel: similar to how Netflix shows its episode list on a series page — horizontal row with thumbnail + text, scannable, clear status states
- The "More Like This" rail reuses the exact `ContentRail` component from Phase 3 — filtered to same genre, labeled "More Like This" or "You Might Also Like"
- Season selector adaptive logic: `seasons.length <= 5` → shadcn Tabs; `seasons.length > 6` → shadcn Select dropdown. Keep the same visual weight regardless of which control renders.
- Paginated episode list: chunk size = 20. "Load More" button sits centered below the last episode. On last chunk, button disappears. Simple state: `const [visibleCount, setVisibleCount] = useState(20)`

</specifics>

<deferred>
## Deferred Ideas

- Broadcast schedule viewer page — **reclassified as admin feature**, moved to Phase 7 admin dashboard (CATL-11 reassigned)
- Watchlist button on series detail page — Phase 9 (USER-01, USER-02)
- Trailer preview on the detail hero — explicitly out of scope per PROJECT.md (ENGM-01)
- Episode countdown timers on Coming Soon page — out of scope per PROJECT.md (ENGM-04)
- Genre/status filters on Coming Soon page — defer until more content exists

</deferred>

---

*Phase: 04-series-detail-browse-pages*
*Context gathered: 2026-03-31*
