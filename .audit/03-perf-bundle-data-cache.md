# Audit 03 — Bundle, Data Fetching, Caching

_Audited: 2026-05-30 | Stack: Next.js 16.2.1 / React 19 / Supabase JS / Tailwind v4 / Turbopack_

---

## Summary

- **`three` + `@react-three/fiber` ship as production deps (26 MB + 2.2 MB on disk) but `Silk.jsx` is not imported anywhere in the current committed tree** — the packages bloat `node_modules`, risk being tree-shaken incorrectly, and must be removed immediately.
- **`@base-ui/react` (13 MB) and `shadcn` (CLI tool) live in `dependencies`** — neither is imported in any source file; they should be removed or moved to `devDependencies`.
- **`sharp` is absent from `dependencies`** — required by Next.js for production image optimization on custom/non-Vercel deploys; omitting it silently falls back to a slower codec.
- **`next.config.ts` is missing `reactCompiler`, `ppr`, `images.formats`, and `images.minimumCacheTTL`** — no React Compiler auto-memoization, no Partial Prerendering, no AVIF/WebP selection, and no long-lived image CDN cache.
- **`getAppConfig()` is called twice in the same RSC render** (`src/app/[locale]/layout.tsx` lines 50 and 102) — the `cache(unstable_cache(...))` wrapper dedupes these within one request, but the double destructure is a maintenance hazard and signals a refactor is due.
- **`createAdminClient()` is instantiated per-Server-Action call (48 separate `const admin = createAdminClient()` in `actions.ts`)** — each call allocates a new `@supabase/supabase-js` client; should be hoisted to a module-level singleton since the client is stateless (no cookie dependency).
- **`select('*')` on `shows` table is acceptable** (mapShow uses all 24 columns), but `getStreamingShows`, `getComingSoonShows`, and `getFeaturedShows` each issue their own separate DB round-trips that resolve identical or overlapping show sets on the same `/watch` render.

---

## Findings

| # | Issue | Severity | Location (file:line) | Impact | Recommended Fix | Effort |
|---|-------|----------|----------------------|--------|-----------------|--------|
| 1 | `three` (26 MB) + `@react-three/fiber` (2.2 MB) in `dependencies`; `Silk.jsx` unused | CRITICAL | `package.json:30-31`, `src/components/Silk.jsx` | ~500–700 KB gzipped added to the JS bundle risk if bundler picks it up via side-effects; `package.json` bloat prevents tree-shaking guarantee | Remove `three` and `@react-three/fiber` from `package.json`; delete `src/components/Silk.jsx` | S |
| 2 | `@base-ui/react` (13 MB) in `dependencies` — zero imports in source | HIGH | `package.json:17` | Adds to install time, `node_modules` size, and potential bundler confusion; no code benefit | `npm uninstall @base-ui/react` | S |
| 3 | `shadcn` CLI tool in runtime `dependencies` | HIGH | `package.json:39` | CLI tool ships into Vercel Lambda bundle unnecessarily; should be `devDependencies` | Move to `devDependencies` | S |
| 4 | `sharp` missing from `dependencies` | HIGH | `package.json` | On any non-Vercel runtime or Docker deploy, Next.js image optimization silently degrades to slower codec; Vercel auto-provides it but it's not declared | Add `"sharp": "latest"` to `dependencies` | S |
| 5 | `reactCompiler: true` absent from `next.config.ts` | HIGH | `next.config.ts` | 106 client components (`'use client'` files) get zero automatic memoization — every prop change re-renders unless manually wrapped in `useMemo/useCallback` | Add `experimental: { reactCompiler: true }` | S |
| 6 | `ppr: true` (Partial Prerendering) not enabled | MEDIUM | `next.config.ts` | `/watch` page awaits auth + 8 parallel DB queries before first byte; with PPR, the static shell can stream instantly while dynamic data (user, personalized rails) resolves | Add `experimental: { ppr: true }`, wrap dynamic sections in `<Suspense>` | M |
| 7 | `images.formats` not set — no explicit AVIF/WebP | MEDIUM | `next.config.ts` | Next.js default serves WebP but does not enable AVIF, which is 30–50 % smaller for show artwork | Add `images: { formats: ['image/avif', 'image/webp'] }` | S |
| 8 | `images.minimumCacheTTL` not set (default: 60 s) | MEDIUM | `next.config.ts` | YouTube thumbnails and Supabase show artwork are re-fetched by the image optimization pipeline every 60 s; they are effectively immutable | Add `images: { minimumCacheTTL: 31536000 }` | S |
| 9 | `getAppConfig()` called twice per locale-layout render | MEDIUM | `src/app/[locale]/layout.tsx:50,102` | Two separate calls in the same RSC; React `cache()` wrapping dedupes them within one pass but only if `unstable_cache` key hits — first call does the full DB round-trip, second is in-memory | Destructure both values from a single `await getAppConfig()` call at line 50, remove the second call at line 102 | S |
| 10 | `createAdminClient()` instantiated per-action (48×) | MEDIUM | `src/app/[locale]/admin/actions.ts:324,406,477,...` | Each Server Action creates a new Supabase client object with a new HTTP agent; no connection sharing within a lambda invocation | Hoist to module-level `const adminSupabase = createAdminClient()` — the client is stateless (no cookies, service-role key is env var) | S |
| 11 | `LBC` font loaded as TTF, 506 KB + 504 KB per weight | MEDIUM | `src/app/[locale]/layout.tsx:25-32`, `src/fonts/lbc-*.ttf` | Two TTF files (1 MB total) served as local fonts with `display: 'swap'`; TTF is uncompressed; no `font-range` subset | Convert to WOFF2 (40–70 % smaller); add `preload: true` on the LBC variable; consider subsetting to Latin+Arabic codepoints only | M |
| 12 | `getStreamingShows` + `getComingSoonShows` + `getCategoryRails` all run on `/watch` — category rails re-fetches show data independently | MEDIUM | `src/app/[locale]/(viewer)/watch/page.tsx:53-58`, `src/lib/queries.ts:266-302` | `getCategoryRails` issues a `show_categories!inner(*)` query that re-fetches full show rows already in `getStreamingShows` result; effective over-fetching with 15 shows | Consolidate: pass the already-fetched streaming+comingSoon show map into `getCategoryRails` as an argument, or merge the category query into the existing streaming query with a join | M |
| 13 | `getCategoryRailBySlug` wraps `getCategoryRails()` in a second `unstable_cache` with duplicate key | LOW | `src/lib/queries.ts:304-311` | Double `unstable_cache` for same data; inner cache already covers it; outer cache for `category-rail-by-slug` with same tags is redundant overhead | Remove `unstable_cache` wrapper from `getCategoryRailBySlug`; make it a plain async function that calls the already-cached `getCategoryRails()` | S |
| 14 | No `Suspense` streaming on `/watch` hero or user-specific rails | MEDIUM | `src/app/[locale]/(viewer)/watch/page.tsx` | Entire page waterfall (auth + 8 queries) blocks TTFB; no streamed shell means users see nothing until all data resolves | Extract `ContinueWatchingRail` and `FeaturedHeroWithWatched` into async RSC wrappers in `<Suspense fallback={<Skeleton/>}>` — static rails can ship first | M |
| 15 | No `loading.tsx` at `/watch` level triggers layout-level skeleton only | LOW | `src/app/[locale]/(viewer)/watch/loading.tsx` | The loading boundary exists but covers the whole page; there is no fine-grained Suspense segmentation below it | See #14 — add inner Suspense boundaries for hero and user rail | M |
| 16 | `lenis` (`ReactLenis`) in viewer layout pulls scroll hijack JS into every viewer page, including auth/profile with no scroll benefit | LOW | `src/app/[locale]/(viewer)/layout.tsx:5`, `src/components/providers/smooth-scroll.tsx` | ~20 KB of Lenis JS ships to pages that don't need smooth scroll (auth forms, profile page) | Gate `SmoothScroll` with a per-route flag, or move it to only content-heavy pages; already reduces-motion-aware but still instantiates | M |
| 17 | `createPublicClient()` creates a new `@supabase/supabase-js` client on every `unstable_cache` miss | LOW | `src/lib/queries.ts:195,224,240,256,...` (all cached queries) | Inside cache closures, a new client is instantiated per cache population; outside the closure there is no singleton | Hoist `createPublicClient()` to module-level singleton in `queries.ts` — client is anon, no session state | S |
| 18 | `imdbRating` and `platformRating` fields in `ViewShow` type but no corresponding DB columns | LOW | `src/lib/queries.ts:27-28` | Dead fields add noise to the type contract and serialization payload for every show | Remove from `ViewShow` until columns exist in DB | S |
| 19 | `select('*')` on `seasons` and `episodes` in `getEpisodeById` (watch page) fetches all columns incl. unused `fts`, `archived`, `description_ar` | LOW | `src/lib/queries.ts:472,480,481` | Minor over-fetch; `getEpisodeById` is React-`cache()`-wrapped so only fires once per request | Specify explicit column lists matching `ViewEpisode`/`ViewSeason`/`ViewShow` fields | S |
| 20 | `Silk.jsx` uses `.jsx` extension with no TypeScript types | LOW | `src/components/Silk.jsx` | Already unused (see #1), but file is JSX-not-TSX, disabling type-checking on the file | Delete file as part of fixing #1 | S |

---

## Top 3 Quick Wins

### 1. Remove dead three.js dependencies + Silk.jsx (Effort: S, ~5 min)

```bash
npm uninstall three @react-three/fiber
rm src/components/Silk.jsx
```

`three` + `@react-three/fiber` are in `dependencies` but `Silk.jsx` has zero imports in the current codebase. The packages exist in the bundle graph and could be picked up by the bundler as a side-effect. Removing them eliminates 28+ MB from `node_modules`, prevents any accidental import from inflating the client bundle by ~500 KB gzipped, and speeds up Vercel build times.

### 2. Enable React Compiler + add AVIF + fix image cache TTL (Effort: S, ~10 min)

In `next.config.ts`:

```ts
experimental: {
  reactCompiler: true,          // auto-memoize all 106 client components
  serverActions: { bodySizeLimit: '55mb' },
  staleTimes: { dynamic: 30, static: 180 },
},
images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 31536000,    // 1 year — YouTube thumbs + Supabase artwork are immutable
  remotePatterns: [ /* existing */ ],
},
```

React Compiler replaces manual `useMemo`/`useCallback` across 106 client components. AVIF cuts image payload 30–50 % vs WebP. TTL fix stops Next.js re-optimizing the same YouTube thumbnails every 60 s.

### 3. Remove `@base-ui/react` + move `shadcn` to devDeps + add `sharp` (Effort: S, ~5 min)

```bash
npm uninstall @base-ui/react         # 13 MB, zero imports
npm install --save-dev shadcn        # CLI tool, not a runtime dep
npm install sharp                    # Required for production image optimization
```

Cleans `node_modules` by 13+ MB and makes the `package.json` accurate.

---

## Bigger Investments

### A. Partial Prerendering on `/watch` (Effort: M, ~1 day)

The `/watch` page currently waterfalls: auth → 8 parallel DB queries → render. With PPR enabled, the static shell (navbar, skeleton rails, category pills) can stream from CDN while the dynamic, user-personalized sections (hero with watch state, `ContinueWatchingRail`) resolve server-side.

Steps:
1. `experimental: { ppr: true }` in `next.config.ts`
2. Extract `FeaturedHeroWithWatched` + `ContinueWatchingRail` into async RSC components wrapped in `<Suspense fallback={<HeroSkeleton/>}>`
3. Move `supabase.auth.getUser()` inside those components (not at page level)
4. Confirm `getFeaturedShows()` (already `unstable_cache`-backed) can pre-populate the static shell without user context

Expected gain: TTFB from Vercel edge drops to <50 ms for the static shell; full paint unblocked from ~400 ms auth round-trip.

### B. Consolidate category-rail show fetching (Effort: M, ~half-day)

`/watch` currently does: `getStreamingShows()` + `getComingSoonShows()` + `getCategoryRails()`. The last one independently queries `show_categories!inner(*)` which re-fetches all show rows from Postgres that `getStreamingShows` already returned. With 15 shows the overhead is trivial today, but the architecture is redundant.

Refactor: pass the already-fetched `Map<showId, DbShow>` into `getCategoryRails` so the join query only fetches `show_categories(show_id, category_id)` and resolves shows from the in-memory map. Reduces DB round-trips on the hot `/watch` path from 3 show-related queries to 2.

### C. Convert LBC fonts from TTF to WOFF2 with Unicode subsetting (Effort: M, ~2 hrs)

Both `lbc-regular.ttf` (504 KB) and `lbc-bold.ttf` (506 KB) are served as-is. Next.js `localFont` will preload them but cannot transcode. Converting to WOFF2 with `pyftsubset` or `fonttools` limited to Latin + Arabic Unicode ranges reduces each file to ~80–150 KB. Add `preload: true` in the `localFont` call so the browser starts fetching before CSS resolves.

```ts
const lbc = localFont({
  src: [
    { path: '../../fonts/lbc-regular.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/lbc-bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-lbc',
  display: 'swap',
  preload: true,               // add this
})
```

### D. Hoist module-level Supabase singletons (Effort: S–M, ~1 hr)

Two patterns need fixing:

1. **`createPublicClient()`** — called inside every `unstable_cache` closure in `queries.ts`. On a cold cache miss, a new client object is allocated per query. Hoist to `const publicSupabase = createPublicClient()` at the top of `queries.ts`; all cached queries share the same instance.

2. **`createAdminClient()`** — called 48 times across `actions.ts` (one per Server Action). Each Server Action invocation is a separate Lambda execution on Vercel, so this is actually fine per-invocation, but the 48 allocations within a single file are an unnecessary code smell and add minor overhead when multiple actions are called in sequence. Hoist to a module-level `const adminClient = createAdminClient()` called lazily.

### E. Add `generateStaticParams` to `/series/[slug]` (Effort: S, ~30 min)

`/series/[slug]` is a dynamic route with no `generateStaticParams`. At build time, Next.js cannot pre-render any series pages, so every first visit hits SSR. With `getStreamingShows()` already `unstable_cache`-backed:

```ts
export async function generateStaticParams() {
  const shows = await getAllShows()
  return shows.map(s => ({ slug: s.slug }))
}
export const revalidate = 3600
```

Pre-renders all 15 show pages at build; ISR keeps them fresh. Eliminates per-user SSR round-trip for the most-visited content pages.
