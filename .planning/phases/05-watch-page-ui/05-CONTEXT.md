# Phase 5: Watch Page UI - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the watch page at `/watch/[episodeId]` — when a viewer clicks an episode from the series detail page, they land on a full-screen theater-mode watch experience with an embedded YouTube player, episode metadata, prev/next navigation, and an episode quick-selector.

</domain>

<decisions>
## Implementation Decisions

### Player Layout
- **D-01:** Theater mode layout — full-width YouTube player (16:9) at the top of the page, episode info and navigation below
- **D-02:** YouTube IFrame API (vanilla, not react-lite-youtube-embed) — need getCurrentTime(), getDuration(), onStateChange for future continue-watching and autoplay features
- **D-03:** YouTube IFrame API loaded via script tag in the component (no npm package needed per CLAUDE.md)
- **D-04:** No UI elements may overlay the YouTube player during playback (YouTube ToS compliance — WTCH-05)

### Episode Navigation
- **D-05:** Prev/Next buttons below the player — navigate between episodes within and across seasons
- **D-06:** Cross-season navigation — "Next" on the last episode of Season 1 goes to the first episode of Season 2. "Previous" on first episode of S2 goes to last episode of S1. Disabled at absolute boundaries (first ep of show, last ep of show).
- **D-07:** Episode quick-selector reuses the existing SeasonSelector + EpisodeList components from the series detail page, placed below the player. Current episode highlighted.

### Watch Page URL
- **D-08:** Route is `/watch/[episodeId]` — flat, simple, shareable. Used by YouTube, Netflix, Prime Video.
- **D-09:** Back navigation uses browser history (back button returns to series detail page)
- **D-10:** Show/season context resolved from episode ID (look up via mock data helpers)

### Mock YouTube Videos
- **D-11:** Only CIT (Clickit Story) YouTube content allowed on the platform — no third-party videos
- **D-12:** Use placeholder YouTube video IDs in mock data for now. User will replace with real CIT video IDs later. Each episode's `youtubeId` field in mock-data.ts is a simple string swap.
- **D-13:** Even private/unlisted CIT YouTube videos can be embedded — user controls access on YouTube side

### Episode Info Display
- **D-14:** Below the player: show breadcrumb (Show › Season N › Episode N), episode title, description, duration chip
- **D-15:** Episode metadata matches the existing EpisodeRow pattern for visual consistency

### Claude's Discretion
- Loading state while YouTube player initializes (skeleton, spinner, or brand color fill)
- Exact breadcrumb styling and spacing
- Mobile responsive behavior (player stays 16:9, info stacks below)
- Whether to show "More Like This" rail at the bottom of the watch page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### YouTube Integration
- `CLAUDE.md` §Video Player — Hybrid YouTube strategy: IFrame API for watch page, lite embed for catalog
- YouTube IFrame API Reference: https://developers.google.com/youtube/iframe_api_reference

### Existing Components to Reuse
- `src/components/series/season-selector.tsx` — Adaptive tabs/select, reuse on watch page
- `src/components/series/episode-list.tsx` — Paginated episode list, reuse on watch page
- `src/components/series/episode-row.tsx` — Episode row with status states, update href from "#" to /watch/[id]
- `src/components/series/series-detail-hero.tsx` — Reference for brand color glow pattern

### Data Layer
- `src/lib/mock-data.ts` — Episode interface (youtubeId field), helper functions (getShowBySlug, getSeasonsByShowId, getEpisodesBySeasonId)

### Existing Pages
- `src/app/series/[slug]/page.tsx` — Series detail page (hero CTA button href needs updating from "#")
- `src/app/series/[slug]/not-found.tsx` — 404 pattern to follow for watch page

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SeasonSelector` component: Adaptive tabs (≤5 seasons) / select (6+) — reuse directly on watch page
- `EpisodeList` component: Paginated with "Load More" — reuse with current episode highlighting
- `EpisodeRow` component: All three states (published/coming-soon/locked) — update href to `/watch/[id]`
- Brand color maps (`brandColorBgMap`, `brandColorHexMap`, `brandColorTextMap`) — for ambient styling
- `CINEMA_EASE` animation timing — reuse for any watch page motion

### Established Patterns
- Server components for page-level data fetching, client components only for interactivity
- Next.js 16 async params: `const { episodeId } = await params`
- `generateStaticParams` for pre-rendering known episodes
- `generateMetadata` for SEO (episode title, description)
- `notFound()` for invalid episode IDs

### Integration Points
- `EpisodeRow` href="#" → must change to `/watch/${episode.id}`
- Series detail hero "Watch S1 E1" button href="#" → must change to `/watch/${firstEpisode.id}`
- New helper needed: `getEpisodeById(id)` to look up episode + parent show + season from ID
- Zustand store for player state (watch progress cache) — not required for Phase 5 but architecture should support it

</code_context>

<specifics>
## Specific Ideas

- CIT-only content policy: the platform must never show non-CIT YouTube videos
- Placeholder video IDs are temporary — user will swap in real CIT video IDs when available
- YouTube ToS compliance is a hard requirement (WTCH-05): no overlays on the player area during playback

</specifics>

<deferred>
## Deferred Ideas

- **Autoplay next episode** (WTCH-04) — Phase 9 scope, needs continue-watching backend
- **Continue watching progress tracking** — needs Supabase backend (Phase 6+), zustand store can be scaffolded
- **Player quality selector** — YouTube handles this natively
- **Fullscreen toggle** — YouTube player has built-in fullscreen

</deferred>

---

*Phase: 05-watch-page-ui*
*Context gathered: 2026-04-01*
