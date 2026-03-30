# Project Research Summary

**Project:** Clickit Story (CIT) — Cinematic Streaming Platform
**Domain:** YouTube-embedded streaming platform with admin CMS, bilingual support, and viewer personalization
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

Clickit Story is a cinematic streaming platform that wraps CIT's YouTube-hosted original content in a premium Netflix-style experience. The platform solves a real product gap: 15 shows and ~294 episodes exist on YouTube but are scattered and lack the branded, discoverable, engagement-driving presentation of a proper streaming service. The recommended approach is a Next.js 16 (App Router) + Supabase stack deployed on Vercel, with YouTube embedded as the video layer via a hybrid strategy: lightweight facade embeds for catalog browsing and the full YouTube IFrame API on the dedicated watch page. This choice is optimal because it avoids the massive infrastructure cost of self-hosted video while still enabling the key streaming-service behaviors (continue watching, autoplay next episode, progress tracking) that make the experience feel premium rather than like a YouTube playlist.

The biggest architectural win is the server-first data model: Server Components fetch all catalog data (shows, seasons, episodes) without client JavaScript waterfalls, delivering SEO-ready HTML instantly. Supabase handles auth, Postgres data, full-text search, and media storage in one service, eliminating the need for external search, separate auth providers, or a blob storage solution. The admin panel is a single-admin CRUD tool — not a second polished product — scoped strictly to the content management needs of each phase.

The two highest-risk areas are YouTube-specific: (1) YouTube's end-of-episode suggested video bleed that destroys the streaming platform illusion and (2) YouTube ToS violations from overlaying the player. Both must be addressed on the watch page from day one. Security risk is managed through strict Supabase RLS on every table plus server-only use of the service role key. Brand color accessibility is a non-obvious but high-priority concern — three of the six CIT brand colors fail WCAG AA on dark backgrounds and must be handled before any components are built.

## Key Findings

### Recommended Stack

The stack is deliberately minimal and server-heavy. Next.js 16 with Turbopack handles routing, SSR/ISR, and Server Actions. Supabase provides everything backend: Postgres with RLS, Auth with SSR cookie handling via `@supabase/ssr`, Storage for show artwork, and built-in full-text search sufficient for 294 episodes. Tailwind CSS v4 (CSS-first, no JS config) with shadcn/ui components forms the design system. The video layer is intentionally split: `react-lite-youtube-embed` for catalog thumbnails (prevents loading 20 iframes on a single page) and the raw YouTube IFrame API on the watch page for progress tracking and autoplay control. See `STACK.md` for full rationale and alternatives considered.

**Core technologies:**
- **Next.js 16 + React 19**: Full-stack framework — App Router, Server Components, Server Actions, Turbopack default bundler
- **Supabase**: Auth + Postgres + Storage + Full-Text Search — single BaaS eliminates external services
- **@supabase/ssr**: Cookie-based session management — replaces deprecated auth-helpers, required for Next.js App Router
- **Tailwind CSS v4 + shadcn/ui**: Design system — CSS-first config, full code ownership, Radix UI accessibility primitives
- **YouTube IFrame API (vanilla)**: Watch page player — `getCurrentTime()`, `getDuration()`, `onStateChange` for progress and autoplay
- **react-lite-youtube-embed**: Catalog thumbnails — ~3KB per video vs ~1.3MB for real iframe, prevents catalog page destruction
- **next-intl**: Bilingual i18n — Server Component native, middleware locale routing for `/en/` and `/ar/`
- **motion v12**: UI animation — React 19 compatible, hero transitions, card effects, content rail reveals
- **embla-carousel-react**: Content rails — 4KB, hook-based, touch/swipe support for Netflix-style horizontal rails
- **zustand v5 + nuqs v2**: Client state — zustand for player/UI state, nuqs for URL-synced search/filter params
- **react-hook-form + zod v4**: Admin forms — minimal re-renders, shared validation schemas client + server

### Expected Features

**Must have (table stakes):**
- Show catalog with hero banner and horizontal content rails — Netflix trained every user to expect this
- Series detail page with season tabs and episode list — standard streaming navigation pattern
- Episode watch page with YouTube player — the core value proposition of the platform
- User authentication — required gate for watchlist and continue watching
- Responsive design — 40-60% of streaming traffic is mobile; video aspect ratio handling is critical
- Search — Postgres FTS is sufficient for 294 episodes; no external service needed
- Content status management (draft / coming soon / published) — content is still in production
- Admin CRUD for shows, seasons, episodes — single admin needs to populate and manage the platform
- Dark cinematic UI — streaming platforms are universally dark; a light UI would feel fundamentally wrong

**Should have (differentiators):**
- Continue watching with progress tracking — what separates a streaming platform from a YouTube channel
- Watchlist / My List — personal curation, low complexity, high perceived value
- Autoplay next episode — binge experience; episode ends, next begins automatically
- Broadcast schedule display — connects the digital platform to CIT's production calendar
- Coming Soon page — builds anticipation; frames thin catalog as "growing" rather than "incomplete"
- Per-show branded identity — each show maps to one of 5 CIT brand color sets for visual richness
- Bilingual content (Arabic + English) with RTL layout support — UAE audience requires both

**Defer (v2+):**
- Analytics dashboard — no data to analyze at launch; use Vercel Analytics free tier
- Notification system — email/push adds compliance overhead without clear v1 value
- Trailer hover previews — technically complex with YouTube embeds (each hover = iframe load); static hover effects are sufficient
- Mobile native app — responsive web first; React Native is a separate codebase

### Architecture Approach

The architecture is server-first and backend-simple. Next.js App Router Server Components handle all read-heavy data fetching (catalog, episode lists, search) with no client-side waterfalls. Supabase RLS enforces authorization at the database layer — not just application logic. Server Actions handle all mutations (watchlist, progress, admin CRUD). The YouTube player is isolated on the watch page as a client component with full IFrame API control. The admin panel lives under `/admin` with defense-in-depth: middleware AND layout Server Component both verify admin status independently. See `ARCHITECTURE.md` for complete route structure, database schema with RLS policies, and code patterns.

**Major components:**
1. **Next.js App (Vercel)** — SSR/ISR pages, middleware auth refresh, Server Actions for mutations, route structure
2. **Supabase Postgres + Auth + Storage** — all data, sessions, RLS authorization, show artwork
3. **YouTube IFrame API** — video hosting, CDN delivery, playback control (progress, autoplay, events)
4. **Client Components (watch page)** — YouTube player integration, progress polling, zustand player state
5. **Admin Panel (`/admin`)** — single-admin CRUD with shadcn/ui forms, protected by double auth check

### Critical Pitfalls

1. **YouTube end-of-episode suggested videos** — Use `rel=0` + detect `ENDED` state immediately to display a next-episode overlay before the viewer interacts with YouTube's suggestions. This is the single most important UX detail for the streaming platform illusion.
2. **YouTube ToS: no overlays on the player** — Never place any visual element over the YouTube iframe during playback. Build premium experience around the player (metadata, episode nav), not on top of it.
3. **Brand colors fail WCAG on dark backgrounds** — Innovative Blue (#2C3569), Royal Purple (#9F54A0), and Crimson Red (#DB3F34) all fail WCAG AA for normal text on dark surfaces. Establish approved contrast-safe color pairs before building any components.
4. **Supabase auth race conditions in App Router** — Multiple Server Components refreshing the same token causes "Invalid Refresh Token: Already Used" errors and session leaks between users. Follow the official `@supabase/ssr` middleware pattern exactly: refresh once in middleware, read in Server Components.
5. **RLS disabled by default on every Supabase table** — Enable RLS immediately on table creation with no exceptions. Test via client SDK (not SQL editor). One unprotected table exposes the entire dataset to anyone with the anon key.

## Implications for Roadmap

Based on combined research, the natural phase structure follows the dependency graph in `FEATURES.md` and the architectural boundaries in `ARCHITECTURE.md`:

### Phase 1: Foundation and Design System
**Rationale:** Three high-severity pitfalls (brand color contrast, RTL CSS properties, Supabase auth setup, RLS) must be resolved before any UI or data work begins. Retrofitting these is expensive — fixing color choices across 50+ components after the fact is a full style rewrite. This phase has no external dependencies and unlocks everything else.
**Delivers:** Project scaffolding, design tokens with WCAG-validated colors, Tailwind v4 config, shadcn/ui base components, Supabase client factory, auth middleware, database schema with RLS on every table, TypeScript types generated from schema.
**Addresses:** Show catalog, all auth-dependent features (all require this foundation)
**Avoids:** Pitfall 3 (brand color contrast), Pitfall 4 (auth session race conditions), Pitfall 5 (RLS disabled), Pitfall 9 (RTL layout breaks), Pitfall 12 (service key exposure), Pitfall 15 (ISR on auth pages)

### Phase 2: Public Catalog and Show Browsing
**Rationale:** The show catalog — home page hero, content rails, series detail, episode list — is the public face of the platform and the foundation for all viewer journeys. It has no auth dependencies (public content) and establishes the Server Component data-fetching patterns used everywhere else. Must accommodate sparse content from day one (Pitfall 8).
**Delivers:** Home page with hero and horizontal content rails (Embla), show catalog grid, series detail page with season selector, episode listing, search (Postgres FTS).
**Uses:** Server Components for all data fetching, react-lite-youtube-embed for thumbnails (never real iframes), next/image with priority for hero banners, motion for card animations.
**Avoids:** Pitfall 6 (YouTube iframes destroying Core Web Vitals), Pitfall 8 (empty platform syndrome), Pitfall 13 (unoptimized hero images), Pitfall 14 (views bypassing RLS)

### Phase 3: Admin Content Management
**Rationale:** Without content in the database the public catalog is empty. The admin panel must be built alongside or slightly ahead of the public features it supports. Scoped strictly to what Phase 2 needs: show/season/episode CRUD and status management. Not a polished product — a functional tool.
**Delivers:** Admin layout with sidebar, show create/edit forms, season management, episode create/edit with YouTube URL input and video ID extraction, status toggles (draft/coming soon/published), image upload to Supabase Storage.
**Uses:** shadcn/ui for rapid form development, react-hook-form + zod for validation, Server Actions for mutations, admin Supabase client with service role key (server-only).
**Avoids:** Pitfall 11 (admin complexity creep — scope to phase needs), Pitfall 16 (brittle YouTube URL parsing — robust multi-format parser with oEmbed validation)

### Phase 4: Watch Page and Video Player
**Rationale:** The episode watch experience is the core value proposition and contains the highest-risk YouTube integration work. Isolated to its own phase because it requires both the catalog (Phase 2) and admin content (Phase 3) to be functional. The YouTube ToS and suggested-video pitfalls must be addressed here.
**Delivers:** Watch page with YouTube IFrame API player, episode metadata display, prev/next episode navigation, keyboard shortcuts, player error handling with branded fallback messages, loading states.
**Uses:** YouTube IFrame API directly (not react-lite-youtube-embed), `onStateChange` event handling, client component with zustand player state.
**Avoids:** Pitfall 1 (suggested videos at episode end — `rel=0` + immediate next-episode overlay), Pitfall 2 (ToS violation — no overlays during playback), Pitfall 18 (missing error states for unavailable videos)

### Phase 5: Viewer Authentication and Personalization
**Rationale:** Auth was set up in Phase 1 but personalized features (watchlist, continue watching, autoplay next) are deferred until the core viewing experience is stable. These features depend on a working watch page (Phase 4). The continue-watching progress tracking is the most complex sub-feature.
**Delivers:** Login/signup flows, user profile creation via Supabase Auth trigger, watchlist (add/remove shows, My List page), continue watching (progress tracking via IFrame API polling, resume on watch page), autoplay next episode with countdown overlay.
**Uses:** `@supabase/ssr` server client for auth, Server Actions for watchlist mutations, client component for progress polling with `visibilitychange` save, `onStateChange(ENDED)` for autoplay trigger, mute-first autoplay strategy for browser compatibility.
**Avoids:** Pitfall 7 (autoplay next episode fails — muted autoplay + unmute after start), Pitfall 10 (unreliable progress tracking — 15s debounced polling, 30-second minimum before creating entry, `visibilitychange` for tab close)

### Phase 6: Schedule, Coming Soon, and Polish
**Rationale:** These features are independent of the core viewing loop and can be built once the platform is functionally complete. They round out the "premium streaming service" experience and address content sparsity during early launch. Bilingual support is added incrementally here.
**Delivers:** Broadcast schedule page (weekly grid, timezone-aware display in GST + local time), Coming Soon page with show teasers, per-show branded identity (color sets from CIT brand guide), bilingual support (next-intl locale routing, Arabic translations, RTL layout), dark/light theme toggle (next-themes).
**Avoids:** Pitfall 17 (timezone confusion — store UTC, display local + GST label), Pitfall 9 (RTL CSS — already using logical properties from Phase 1)

### Phase Ordering Rationale

- **Foundation first** because brand color accessibility and Supabase auth patterns are impossible to retrofit efficiently. Every component and page inherits these decisions.
- **Catalog before watch page** because the catalog establishes Server Component patterns and ensures content exists before the complex player integration. The catalog is also the entry point for all user journeys.
- **Admin alongside catalog** because catalog pages are empty without content. Admin is scoped to current phase needs only — not built as a complete tool upfront.
- **Watch page as its own phase** because YouTube ToS compliance and the suggested-video problem require focused attention without parallel complexity.
- **Personalization after watch page** because continue watching and autoplay both depend on the YouTube IFrame API integration being stable and tested.
- **Polish features last** because schedule, Coming Soon, and bilingual support are independent and can ship incrementally without blocking the core experience.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Watch Page):** YouTube IFrame API `onStateChange` timing, `rel=0` behavior, and the end-of-episode overlay interaction pattern need empirical testing. Browser autoplay policy behavior across Safari, Chrome Android, and Firefox is not fully predictable from docs alone.
- **Phase 5 (Personalization):** The `visibilitychange` + progress save strategy on mobile Safari is MEDIUM confidence — needs testing on actual devices. The mute-then-unmute autoplay workaround behavior may vary across browser versions.
- **Phase 6 (Bilingual):** Arabic font loading (Daken Black, Avenir Arabic) and mixed-direction text rendering should be validated early in this phase. RTL + Embla carousel interactions are an untested combination.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Supabase SSR setup, Tailwind v4 config, and shadcn/ui init are all thoroughly documented with official guides. No novel patterns.
- **Phase 2 (Catalog):** Server Component data fetching with Supabase, next/image optimization, and Embla carousel setup follow well-established patterns.
- **Phase 3 (Admin):** shadcn/ui form components + react-hook-form + zod is a documented and widely-used combination. Admin route protection with Supabase is covered in the official SSR guide.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are current stable releases with official docs. Version decisions are grounded in specific release notes (Next.js 16, Tailwind v4, Zustand v5). |
| Features | HIGH | Feature set is grounded in explicit project requirements. Table stakes are industry-standard. Complexity estimates are conservative. |
| Architecture | HIGH | Patterns are sourced from official Supabase SSR docs and Next.js App Router docs. Database schema is complete and production-ready. RLS policies are explicit. |
| Pitfalls | HIGH (critical) / MEDIUM (behavioral) | Critical pitfalls (YouTube ToS, RLS, auth race conditions, brand colors) are HIGH confidence from official sources. Browser autoplay policy behavior and YouTube IFrame API edge cases are MEDIUM — empirical testing required. |

**Overall confidence:** HIGH

### Gaps to Address

- **YouTube IFrame API on mobile**: Autoplay policy behavior on mobile Safari and Chrome Android is documented but unpredictable in practice. Plan explicit mobile testing sessions during Phase 4 and 5.
- **Supabase Storage image transformations**: Available on Pro plan only. If the project uses the Free plan, a pre-generation strategy for multiple image sizes during upload is needed. Confirm Supabase plan before Phase 3 admin image upload work.
- **Arabic font licensing**: Daken Black and Avenir Arabic font availability and licensing for web use needs confirmation before Phase 6. Alternative: system Arabic fonts or Google Fonts Arabic subset as fallback.
- **nuqs v2 compatibility**: MEDIUM confidence in the stack; nuqs is a smaller library with less community validation than the rest of the stack. Validate during Phase 2 search/filter implementation.
- **CIT brand color tints**: The research identifies which colors fail contrast but does not specify exact light-tinted variants. The design system phase must produce an approved color palette with tested contrast ratios before any component work begins.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) — framework version, Turbopack default, React Compiler
- [Next.js 16.1/16.2 Release Blogs](https://nextjs.org/blog/next-16-1) — feature details
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — auth client factory pattern
- [Supabase Next.js Auth Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) — middleware token refresh pattern
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy patterns, security_invoker views
- [Supabase Full-Text Search Docs](https://supabase.com/docs/guides/database/full-text-search) — tsvector, GIN indexes, websearch_to_tsquery
- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) — player events, state constants, parameters
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) — overlay prohibition, ToS constraints
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, logical property utilities
- [WCAG 2.1 Relative Luminance Formula](https://www.w3.org/TR/WCAG21/) — brand color contrast analysis

### Secondary (MEDIUM confidence)
- [Supabase GitHub Issue #18981](https://github.com/supabase/supabase/issues/18981) — refresh token race condition in @supabase/ssr
- [Supabase GitHub Issue #30241](https://github.com/supabase/supabase/issues/30241) — middleware token refresh clarification
- [nuqs Docs](https://nuqs.dev/) — URL state management, App Router compatibility
- [Browser autoplay policy documentation](https://developer.chrome.com/blog/autoplay/) — muted autoplay requirements

### Tertiary (LOW confidence / needs validation)
- Mobile Safari autoplay behavior — empirical testing required during Phase 4-5
- Arabic font web licensing (Daken Black, Avenir Arabic) — needs confirmation before Phase 6

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
