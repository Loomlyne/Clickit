# Technology Stack

**Project:** Clickit Story (CIT) -- Cinematic Streaming Platform
**Researched:** 2026-03-30

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 16.2.x | Full-stack React framework | Turbopack default bundler (5-10x faster HMR), stable React Compiler (auto-memoization), `use cache` directive for ISR-like caching, PPR for instant navigations, Vercel-native deployment. Next.js 16 is the current stable release (Oct 2025). | HIGH |
| React | 19.x | UI library | Ships with Next.js 16. Concurrent rendering, Server Components, Server Actions, React Compiler support. | HIGH |
| TypeScript | 5.x | Type safety | Required by Next.js 16 tooling. Catches bugs at compile time, enables Zod schema inference, improves DX with IDE autocompletion. | HIGH |

### Database and Auth

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase (hosted) | Latest | Auth + Postgres DB + Storage | Client requirement. Managed Postgres with built-in auth, RLS, full-text search, and storage for show artwork. Zero ops overhead. | HIGH |
| @supabase/supabase-js | ^2.100.x | JavaScript client | Isomorphic client for browser and server. Handles auth, DB queries, storage, realtime subscriptions. | HIGH |
| @supabase/ssr | ^0.9.x | SSR auth integration | Cookie-based session management for Next.js App Router. Creates server/browser clients. Handles token refresh in middleware. Replaces deprecated @supabase/auth-helpers. | HIGH |

### Styling and UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.2.x | Utility-first CSS | CSS-first config (no JS config file), 5x faster builds, cascade layers, CSS custom properties via @property. v4 is production-stable since Jan 2025. Supports dark mode, RTL via logical properties. | HIGH |
| shadcn/ui | Latest (vendored) | Component primitives | Copy-paste components built on Radix UI + Tailwind. Full ownership of code, no package lock-in. Provides Dialog, DropdownMenu, Select, Table, Tabs -- everything the admin dashboard needs. Tailwind v4 compatible. | HIGH |
| Radix UI | Latest | Accessible primitives | Foundation for shadcn/ui. WAI-ARIA compliant, unstyled, composable. Handles keyboard nav, focus management, screen reader support. | HIGH |
| lucide-react | ^1.7.x | Icons | Tree-shakable SVG icons (1500+ icons). Only imported icons ship to client. TypeScript typed. Default icon set for shadcn/ui. | HIGH |
| next-themes | ^0.4.x | Theme management | Dark mode with zero flash. CIT is dark-first but next-themes handles the `class` attribute on `<html>` cleanly. 2 lines of code setup. | HIGH |

### Video Player

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| react-lite-youtube-embed | ^3.5.x | YouTube embed (browse/catalog) | Renders a static thumbnail (~3KB) until user clicks, then loads full iframe. Saves ~500KB per video on initial load. Critical for catalog pages with multiple video thumbnails. | HIGH |
| YouTube IFrame API (vanilla) | N/A | Watch page player | Direct IFrame API for the watch page where we need `getCurrentTime()`, `getDuration()`, `onStateChange` for continue-watching progress tracking and autoplay-next. react-lite-youtube-embed is too simple for this -- we need the full API. | HIGH |

**Strategy:** Use react-lite-youtube-embed for thumbnails/previews in catalog views. Use the YouTube IFrame API directly (loaded via a custom React wrapper) on the watch page where progress tracking, autoplay, and player control are needed.

### Animation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| motion | ^12.x | UI animations | Renamed from framer-motion. React 19 compatible. Declarative `<motion.div>` API for hero transitions, card hover effects, page transitions, content rail sliding. ~15KB gzipped. | HIGH |

### Carousel / Content Rails

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| embla-carousel-react | ^8.6.x | Content rail carousels | Lightweight (~4KB), dependency-free, hook-based API. Full control over styling. Supports touch/swipe, keyboard nav, autoplay plugin. Perfect for Netflix-style horizontal content rails. | HIGH |

### Forms and Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| react-hook-form | ^7.72.x | Form state management | Minimal re-renders, uncontrolled components by default. Admin dashboard forms for show/season/episode CRUD. ~9KB gzipped. | HIGH |
| @hookform/resolvers | Latest | Schema resolver bridge | Connects Zod schemas to react-hook-form for automatic validation. | HIGH |
| zod | ^4.3.x | Schema validation | TypeScript-first validation. Shared schemas for client-side form validation AND server-side Server Action validation. Infers TypeScript types from schemas -- single source of truth. | HIGH |

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zustand | ^5.x | Client state | ~1.2KB. No Provider wrapper needed. Hook-based API. Use for: watch progress cache, player state, UI state (sidebar open, search modal). Most state lives on the server (Supabase) -- zustand handles the thin client layer. | HIGH |
| nuqs | ^2.x | URL state | Type-safe search params as React state. Use for: search queries, filters, season selector, pagination. Shareable URLs for deep-linking. ~6KB. | MEDIUM |

### Internationalization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| next-intl | Latest | i18n framework | ~2KB bundle. Native Server Component support. Built-in middleware for locale routing (`/en/...`, `/ar/...`). TypeScript type-safe message keys. RTL detection helper for Arabic. Most adopted i18n solution for Next.js App Router in 2026. | HIGH |

### Notifications / Toasts

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| sonner | Latest | Toast notifications | ~3KB. Zero-config. Call `toast()` from anywhere. Built-in shadcn/ui integration. Use for: "Added to watchlist", "Episode saved", admin action confirmations. | HIGH |

### Date/Time

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| date-fns | ^4.x | Date formatting/manipulation | Tree-shakable (only import what you use). v4 has first-class timezone support -- needed for UAE broadcast schedule display (Gulf Standard Time). Functional API, no mutable date objects. | HIGH |

### Image Optimization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| next/image | (built-in) | Image optimization | Automatic WebP/AVIF conversion, lazy loading, responsive srcset. Use for all show artwork, hero banners, episode thumbnails. | HIGH |
| sharp | Latest | Production image processing | Required by Next.js for production image optimization. 40-70% file size reduction. Auto-installed on Vercel, must be in dependencies for custom deploys. | HIGH |

### Search

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Postgres Full-Text Search (via Supabase) | N/A | Content search | Built into Supabase Postgres. `to_tsvector` + `to_tsquery` with GIN indexes. Supports `websearch_to_tsquery()` for Google-like search syntax. No external search service needed for 15 shows / 294 episodes. Add generated tsvector columns on shows and episodes tables. | HIGH |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | 9.x | Linting | Flat config format. next/core-web-vitals rules. | HIGH |
| Prettier | 3.x | Code formatting | Consistent style. Tailwind CSS plugin for class sorting. | HIGH |
| prettier-plugin-tailwindcss | Latest | Tailwind class ordering | Auto-sorts Tailwind classes in canonical order. | HIGH |
| Supabase CLI | ^2.84.x | Local development | Local Postgres + Auth for offline dev. Migration management. Type generation for TypeScript. | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 16 | Remix, Astro | Client constraint. Vercel deployment. Next.js 16 is best-in-class for this use case. |
| Database | Supabase Postgres | PlanetScale, Neon | Client constraint. Supabase provides auth + DB + storage in one. |
| Auth | Supabase Auth | NextAuth/Auth.js, Clerk | Client constraint. Supabase Auth is already integrated with the database. |
| CSS | Tailwind CSS v4 | CSS Modules, styled-components | Tailwind is the ecosystem standard for shadcn/ui. CSS-in-JS adds runtime overhead. |
| UI Components | shadcn/ui | MUI, Chakra UI, Ant Design | shadcn/ui gives full code ownership, no package updates to chase, Tailwind-native. MUI brings massive bundle. |
| Video embed | react-lite-youtube-embed + IFrame API | react-player, react-youtube | react-player is 50KB+ and includes support for Vimeo/Twitch we don't need. react-youtube wraps IFrame API but adds abstraction over events we need direct access to. Our hybrid approach (lite for catalog, raw API for watch page) is optimal. |
| Carousel | embla-carousel | Swiper, react-slick | Swiper is 40KB+. react-slick requires jQuery-era patterns. Embla is 4KB, modern hooks API, zero dependencies. |
| Animation | motion (framer-motion) | GSAP, react-spring | motion has the best DX for declarative React animations. GSAP licensing is complex. react-spring is lower-level. |
| State | zustand | Redux Toolkit, Jotai | Redux is overkill -- most state is server-side in Supabase. Zustand is 1.2KB for the thin client state layer. |
| i18n | next-intl | react-i18next, next-i18n-router | next-intl has first-class App Router + Server Component support. react-i18next requires more boilerplate for RSC. |
| Search | Postgres FTS | Algolia, Meilisearch, Typesense | External search service is overkill for 15 shows / 294 episodes. Postgres FTS handles this catalog size trivially. Add external search only if catalog grows 10x+. |
| Date | date-fns | dayjs, luxon | date-fns is tree-shakable (dayjs is not). v4 has timezone support. Functional API aligns with React patterns. |
| Toast | sonner | react-hot-toast, react-toastify | sonner is 3x smaller, zero-config, built into shadcn/ui ecosystem. |
| Forms | react-hook-form + zod | Formik | Formik causes re-renders on every keystroke. react-hook-form uses uncontrolled inputs. Zod provides runtime + type-level validation. |
| Icons | lucide-react | react-icons, heroicons | lucide-react is shadcn/ui's default. Tree-shakable. react-icons bundles all icon sets. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| @supabase/auth-helpers-nextjs | **Deprecated.** Replaced by @supabase/ssr. Will not receive bug fixes. |
| framer-motion (package name) | **Renamed.** Use `motion` package with `motion/react` imports. Same API, new name. |
| Tailwind CSS v3 | **Superseded.** v4 is stable, faster, and uses CSS-first config. No reason to start a new project on v3. |
| Next.js 15 | **Superseded.** Next.js 16 is stable with Turbopack default, React Compiler, better caching. Use 16. |
| Prisma | **Unnecessary.** Supabase JS client handles all DB queries. Adding Prisma means maintaining a separate schema, migrations, and connection pooling. Supabase client + RLS is simpler. |
| NextAuth / Auth.js | **Conflicts.** Supabase Auth handles authentication. Adding NextAuth creates two auth systems fighting over session management. |
| MongoDB / Mongoose | **Wrong tool.** Relational data (shows -> seasons -> episodes) maps naturally to Postgres. Document DB adds complexity with no benefit. |
| Redux Toolkit | **Overkill.** Most state is server-side in Supabase. Client state is thin (player state, UI toggles). Zustand at 1.2KB handles this. |
| Algolia / Meilisearch | **Premature.** 294 episodes is trivial for Postgres FTS. External search adds cost, complexity, and sync requirements. |
| Swiper | **Heavy.** 40KB+ for features you won't use (3D effects, virtual slides). Embla is 4KB. |
| CSS-in-JS (styled-components, emotion) | **Runtime cost.** Adds JS bundle size and runtime style injection. Tailwind is zero-runtime. |
| Moment.js | **Deprecated.** Use date-fns instead. |

## Installation

```bash
# Core framework
npx create-next-app@latest clickit-story --typescript --tailwind --app --turbopack

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI components (shadcn/ui is added via CLI, not npm)
npx shadcn@latest init
npm install lucide-react next-themes sonner

# Video
npm install react-lite-youtube-embed
# YouTube IFrame API is loaded via script tag, no npm package needed

# Animation & Carousel
npm install motion embla-carousel-react

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# State Management
npm install zustand nuqs

# Internationalization
npm install next-intl

# Date/Time
npm install date-fns

# Image Optimization (production)
npm install sharp

# Dev dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D prettier prettier-plugin-tailwindcss
npm install -D supabase
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-only, never expose to client
```

## Key Architecture Decisions

### Why Next.js 16 over 15

Next.js 16 (Oct 2025) is the current stable release. Key advantages over 15:
- **Turbopack is the default bundler** -- no `--turbo` flag needed
- **React Compiler is stable** -- automatic memoization, fewer re-renders
- **`use cache` directive** -- fine-grained caching without `revalidate` config
- **Layout deduplication** -- shared layouts download once across prefetched routes
- **proxy.ts** replaces middleware.ts for network boundary (backward compatible)

### Why Hybrid YouTube Embed Strategy

Two different approaches for two different needs:
1. **Catalog pages** (browse, search, series detail): Use `react-lite-youtube-embed` for lightweight thumbnails. A page showing 20 episodes would otherwise load 20 iframes (~10MB). The lite embed loads ~60KB total.
2. **Watch page** (single episode viewing): Use YouTube IFrame API directly for `getCurrentTime()`, `getDuration()`, `onStateChange` events. These are required for continue-watching progress tracking and autoplay-next-episode.

### Why Supabase Client (not Prisma)

Supabase JS client talks directly to PostgREST (REST API over Postgres). Benefits:
- RLS policies enforce authorization at the database level
- No ORM schema to maintain separately from DB migrations
- Supabase CLI generates TypeScript types from your DB schema
- Real-time subscriptions available if needed later
- One less abstraction layer

### Why Postgres FTS (not external search)

With 15 shows and ~294 episodes, full-text search over Postgres is trivial:
- Add `tsvector` generated columns on `shows` and `episodes`
- Create GIN indexes for instant lookups
- Use `websearch_to_tsquery()` for user-friendly search syntax
- Zero external dependencies, zero cost, zero sync issues

Reassess only if the catalog grows past ~5,000 items or you need typo tolerance / faceted search.

## Sources

- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) -- HIGH confidence
- [Next.js 16.1 Release Blog](https://nextjs.org/blog/next-16-1) -- HIGH confidence
- [Next.js 16.2 Release Blog](https://nextjs.org/blog/next-16-2) -- HIGH confidence
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- HIGH confidence
- [Supabase Next.js Auth Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [Supabase Full-Text Search Docs](https://supabase.com/docs/guides/database/full-text-search) -- HIGH confidence
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) -- HIGH confidence
- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) -- HIGH confidence
- [react-lite-youtube-embed GitHub](https://github.com/ibrahimcesar/react-lite-youtube-embed) -- HIGH confidence
- [motion (framer-motion) GitHub](https://github.com/motiondivision/motion) -- HIGH confidence
- [embla-carousel npm](https://www.npmjs.com/package/embla-carousel-react) -- HIGH confidence
- [next-intl Docs](https://next-intl.dev/docs/getting-started/app-router) -- HIGH confidence
- [nuqs Docs](https://nuqs.dev/) -- MEDIUM confidence
- [shadcn/ui Docs](https://ui.shadcn.com/) -- HIGH confidence
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence
