# Technology Stack

**Project:** Clickit Story (CIT) -- Cinematic Streaming Platform
**Researched:** 2026-03-30
**i18n Migration Addendum:** 2026-04-20

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
| next-intl | ^4.9.1 | i18n framework | ~457 bytes gzipped client impact. Native Server Component support (`getTranslations()` runs server-side, zero JS bundle). Built-in `createMiddleware` for URL-prefix routing (`/en/...`, `/ar/...`). `createNavigation()` exports locale-aware Link, useRouter, usePathname. `setRequestLocale()` enables static rendering for all pages. TypeScript type-safe message keys. Most adopted i18n solution for Next.js App Router in 2026. **Already installed at ^4.9.1.** | HIGH |

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

---

## i18n Migration: Detailed Stack Notes

*Added 2026-04-20. Specific to the Arabic URL-prefix routing milestone.*

### Why next-intl (not alternatives)

**vs react-i18next:** react-i18next requires client-side provider wrappers for Server Components, ~55x larger bundle (~25KB vs ~457 bytes), and has no equivalent native integration with App Router URL-prefix routing. Wrong tool for RSC-first projects.

**vs plain TypeScript dictionary:** A custom dictionary solves only translations. It provides no middleware for URL-prefix routing, no locale-aware `Link` component, no `hreflang` header injection, no `setRequestLocale` for static rendering. At 130 strings it would work functionally but you would be rebuilding half of next-intl from scratch.

**vs next-i18next:** Pages Router library. Does not support App Router at all.

### No New Packages Required

`next-intl@^4.9.1` is already in `package.json`. Zero new dependencies needed for this milestone.

### next-intl 4.x Breaking Changes That Apply to This Migration

1. **`NextIntlClientProvider` is now required** around any Client Component that calls `useTranslations`. The `[locale]/layout.tsx` must wrap `{children}` in `<NextIntlClientProvider messages={messages} locale={locale}>`. Server Components using `getTranslations()` are not affected.

2. **`requestLocale` parameter replaces the old `locale` param** in `getRequestConfig`. The `i18n/request.ts` file must `await requestLocale` (it is a Promise) and validate it with `hasLocale()` before use.

3. **TypeScript 5+ required** — already satisfied.

4. **ESM-only output** — no CJS interop issues, tree-shaking works correctly.

5. **`createNavigation()` supersedes** the old `createSharedPathnamesNavigation` and `createLocalizedPathnamesNavigation` APIs. Use `createNavigation(routing)` exclusively.

### proxy.ts Chaining (Supabase Auth Must Survive)

The existing `proxy.ts` runs Supabase session refresh via `updateSession()` and a coming-soon gate. next-intl's `createMiddleware` must be chained **after** Supabase session refresh, not replace it.

**Pattern — extend proxy.ts, do not replace it:**

```typescript
// proxy.ts
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { getAppConfig } from '@/lib/config'

const handleI18nRouting = createMiddleware(routing)

const COMING_SOON_ALLOWLIST = ['/coming-soon', '/admin', '/auth', '/api', '/support']

export async function proxy(request: NextRequest) {
  // 1. Supabase session refresh first — writes auth cookies
  const { response: supabaseResponse, checkIsAdmin } = await updateSession(request)

  // 2. Coming-soon gate (existing logic unchanged)
  const { pathname } = request.nextUrl
  const isAllowlisted = COMING_SOON_ALLOWLIST.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!isAllowlisted) {
    const { flags } = await getAppConfig()
    if (flags.comingSoonMode) {
      const isAdmin = await checkIsAdmin()
      if (!isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/coming-soon'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  // 3. next-intl handles locale prefix routing
  const i18nResponse = handleI18nRouting(request)

  // 4. Copy Supabase auth cookies onto the i18n response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    i18nResponse.cookies.set(cookie)
  })

  return i18nResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Why this order:** Supabase must run first to refresh tokens. next-intl response is returned last to control URL rewrite/redirect (locale prefix). Auth cookies are copied from Supabase response to i18n response so the browser receives both sets of cookies.

### New Files to Create

```
src/
  i18n/
    routing.ts          # defineRouting({ locales: ['en','ar'], defaultLocale: 'en', localePrefix: 'always' })
    request.ts          # getRequestConfig — loads messages JSON, validates requestLocale
    navigation.ts       # createNavigation(routing) — exports Link, useRouter, usePathname, redirect
  messages/
    en.json             # All English strings, grouped by page namespace
    ar.json             # All Arabic strings, mirroring en.json structure exactly
```

### Route Restructuring Required

All 14 viewer pages + 6 admin pages move under a `[locale]` dynamic segment:

```
Before:
src/app/
  (viewer)/
    layout.tsx, page.tsx, browse/, watch/, my-list/, search/, series/, profile/, support/, ...
  admin/
    layout.tsx, page.tsx, archive/, audit/, settings/, shows/
  layout.tsx              ← root layout (lang/dir, fonts, analytics)

After:
src/app/
  [locale]/
    (viewer)/
      layout.tsx, page.tsx, browse/, watch/, my-list/, search/, series/, profile/, support/, ...
    admin/
      layout.tsx, page.tsx, archive/, audit/, settings/, shows/
    layout.tsx            ← NEW: validates locale, calls setRequestLocale, wraps NextIntlClientProvider
  layout.tsx              ← root layout (pure shell: html/body/fonts/analytics — no locale reads)
```

### Existing Locale Infrastructure to Migrate

| Existing | Action |
|----------|--------|
| `src/lib/locale.ts` — `getLocale()` reads NEXT_LOCALE cookie | Replace call sites with `getLocale()` from `next-intl/server` (reads from URL segment). Keep the file for `dirFor()` and `pickLocalized()` which are domain-specific. |
| `src/lib/locale.ts` — `dirFor()` | Keep — next-intl does not provide this. Used for `html[dir]` attribute. |
| `src/lib/locale.ts` — `pickLocalized()` | Keep — domain-specific (picks en/ar field from DB rows). next-intl does not replace this. |
| `src/app/locale-actions.ts` — `setLocaleAction()` | Replace with locale switcher that uses `createNavigation()` router to redirect to `/ar/...` or `/en/...` URL. Server Action cookie write is no longer needed. |
| `src/components/layout/locale-switcher.tsx` | Rewrite to use `Link` and `useRouter` from `@/i18n/navigation.ts`. |
| Root `layout.tsx` — `getLocale()` call, `lang`, `dir` attributes | Remove `getLocale()`. Move `lang` and `dir` to `[locale]/layout.tsx` where locale comes from URL params. |

### Static Rendering — Required in Every Page and Layout

Without `setRequestLocale`, next-intl falls back to dynamic rendering for every page:

```typescript
// [locale]/layout.tsx
import { setRequestLocale } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)  // Must be called before any useTranslations/getTranslations
  // ...
}
```

`setRequestLocale` must be called in every page and layout that uses next-intl APIs. `generateStaticParams` on the root locale layout covers all pages nested beneath it — individual pages do not need their own `generateStaticParams` unless they have additional dynamic segments.

### Messages File Structure

Single file per locale (not split by namespace at the filesystem level) is correct for 130 strings:

```json
// messages/en.json
{
  "Common": {
    "loading": "Loading...",
    "error": "Something went wrong"
  },
  "Nav": {
    "browse": "Browse",
    "search": "Search",
    "myList": "My List"
  },
  "Watch": {
    "addToList": "Add to list",
    "episodes": "Episodes"
  }
}
```

```json
// messages/ar.json
{
  "Common": {
    "loading": "جار التحميل...",
    "error": "حدث خطأ ما"
  },
  "Nav": {
    "browse": "تصفح",
    "search": "بحث",
    "myList": "قائمتي"
  },
  "Watch": {
    "addToList": "أضف إلى القائمة",
    "episodes": "الحلقات"
  }
}
```

Namespace keys match the `useTranslations('Nav')` / `getTranslations('Watch')` call argument. Do not use `.` in keys — dots are the nesting separator.

### SEO — hreflang (Automatic)

`localePrefix: 'always'` causes next-intl middleware to automatically inject `link: <url>; rel="alternate"; hreflang="..."` response headers. No sitemap changes needed for hreflang.

### RTL Integration

The existing `dirFor()` helper and the Tailwind logical property classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`) already handle RTL. Only change needed: move the `lang` and `dir` attributes from root `layout.tsx` to `[locale]/layout.tsx` where the locale is available from URL params.

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `react-i18next` / `i18next` | Redundant alongside next-intl. ~55x larger bundle, worse RSC support. Never install both. |
| `next-i18next` | Pages Router only. Does not support App Router. |
| `intl-locale-textinfo-polyfill` | Only needed if `Intl.Locale.prototype.getTextInfo()` is called inside a Client Component. Root layout is a Server Component and `dirFor()` already handles RTL — polyfill is unnecessary. |
| Any translation management SaaS (Phrase, Crowdin, Lokalise) | 130 strings across 2 locales does not justify a paid TMS. Plain JSON files in git are correct at this scale. |
| `next-intl/plugin` webpack plugin | Optional. Enables TypeScript autocompletion for message keys. Add only if the team finds missing key errors are a problem in practice. Not required for functionality. |
| `@formatjs/intl-localematcher` | next-intl bundles its own locale matching. No need to add this separately. |

---

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
| State | zustand | Redux Toolkit, Jotai | Redux is overkill -- most state is server-side in Supabase. Zustand at 1.2KB handles this. |
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
# No new packages needed for i18n migration — next-intl is already installed
# All other packages below are for initial project setup reference

# Core framework
npx create-next-app@latest clickit-story --typescript --tailwind --app --turbopack

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI components (shadcn/ui is added via CLI, not npm)
npx shadcn@latest init
npm install lucide-react next-themes sonner

# Video
npm install react-lite-youtube-embed

# Animation & Carousel
npm install motion embla-carousel-react

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# State Management
npm install zustand nuqs

# Internationalization (already installed)
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

## Sources

- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) -- HIGH confidence
- [next-intl 4.0 Release Blog](https://next-intl.dev/blog/next-intl-4-0) -- HIGH confidence
- [next-intl routing setup docs](https://next-intl.dev/docs/routing/setup) -- HIGH confidence
- [next-intl middleware composition](https://next-intl.dev/docs/routing/middleware) -- HIGH confidence
- [next-intl npm (current version 4.9.1)](https://www.npmjs.com/package/next-intl) -- HIGH confidence
- [Next.js 16 proxy.ts rename docs](https://nextjs.org/docs/messages/middleware-to-proxy) -- HIGH confidence
- [Supabase SSR auth setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [Supabase + next-intl middleware discussion](https://github.com/orgs/supabase/discussions/18747) -- MEDIUM confidence
- [next-intl + Next.js 16 proxy fix](https://www.buildwithmatija.com/blog/next-intl-nextjs-16-proxy-fix) -- MEDIUM confidence
- Context7 verified next-intl routing, request config, and static rendering patterns (library ID: `/amannn/next-intl`) -- HIGH confidence
- [Supabase Full-Text Search Docs](https://supabase.com/docs/guides/database/full-text-search) -- HIGH confidence
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) -- HIGH confidence
- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) -- HIGH confidence
- [next-intl Docs](https://next-intl.dev/docs/getting-started/app-router) -- HIGH confidence
- [shadcn/ui Docs](https://ui.shadcn.com/) -- HIGH confidence
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence
