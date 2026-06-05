# Performance Audit — Portfolio, Watch & Content Pages

**Scope:** `/portfolio`, `/watch`, `/series/[slug]`, `/watch/[episodeId]`, content rails, shorts, episode tray  
**Date:** 2026-05-30  
**Auditor:** Claude Code (Sonnet 4.6)

---

## Summary

- **Preloader blocks every viewer page by up to 7 s** — `EntryPreload` fetches a video from Supabase storage on cold load, has a hard-release timer of 7 000 ms, sets `overflow:hidden` on `<body>` for the full duration, and runs on _every_ page in the viewer layout even when the user navigates back from /series or /watch. The `hasShownEntryPreloadThisDocument` guard is a module-level `let` that resets on every Vercel SSR edge invocation, so it only deduplicates within a single browser tab's JS lifetime — not across navigations.
- **`ShowCard` and `ContinueWatchingCard` use raw `<img>` tags with unresized Supabase storage URLs** — no WebP conversion, no lazy loading attribute, no `srcset`, and no `loading="lazy"`. Every card in every rail hits the original full-resolution image from Supabase directly on first paint. On the portfolio page this means 10–15 full-res images competing for bandwidth with the landing hero video.
- **`portfolio/page.tsx` has no server-side data: it delegates entirely to child RSCs (`LandingHero`, `ShowsPortfolio`)** which each await Supabase round trips sequentially in the render tree with no Suspense boundary. The hero blocks on `createClient()` + `auth.getUser()` + `getAppConfig()`, then `ShowsPortfolio` blocks on `getFeaturedShorts()` — these are two sequential server-side waterfalls before the browser gets any HTML.
- **`LandingHero` fires an eager autoplay YouTube iframe unconditionally** on every portfolio page visit — `youtube-nocookie.com/embed/...?autoplay=1` with no `loading="lazy"` and no facade pattern. On mobile networks this loads ~500 KB of YouTube player JS before the page renders its own JS bundle.
- **Duplicate YouTube IFrame API loader** — `loadYouTubeAPI()` is defined twice: `src/lib/youtube.ts:62` and `src/components/watch/youtube-player.tsx:17`. Both manage separate module-level singletons (`apiReady`, `apiLoading`, `readyCallbacks`). If both modules load in the same page, the second one inserts a second `<script src="iframe_api">` tag and the `onYouTubeIframeAPIReady` callback is clobbered.
- **`series/[slug]/page.tsx` fetches all streaming shows (`getStreamingShows`) to build a "More Like This" rail** — that query returns every streaming show's full row just to filter by genre client-side at line 134. With 15 shows this is trivial today but the anti-pattern will become a real query cost as the catalog grows.

---

## Findings

| # | Issue | Severity | Location (file:line) | Impact | Recommended fix | Effort |
|---|-------|----------|----------------------|--------|-----------------|--------|
| 1 | `EntryPreload` hard-releases after 7 000 ms max, sets `overflow:hidden` on body the entire time, blocks scroll and interaction across every viewer page | Critical | `src/components/layout/entry-preload.tsx:76–79` | ~7 s interaction block on slow networks; perceived lag on every page load | Reduce `hardReleaseMs` to 3 500 ms; add `sessionStorage` flag so preloader only runs once per browser session (not just per-document); consider moving it outside the layout entirely for in-app navigations | S |
| 2 | `ShowCard` uses raw `<img src={show.heroImageUrl}>` with no `next/image`, no lazy loading, no srcset — Supabase storage URLs served at original resolution | High | `src/components/shows/show-card.tsx:21` | Every rail card downloads full-res image; no browser-native lazy loading; layout shift when images load | Replace `<img>` with `next/image` with `sizes="var(--landscape-w)"`, `loading="lazy"`, no `priority` | S |
| 3 | `ContinueWatchingCard` uses raw `<img src={thumbnailUrl}>` for YouTube hqdefault thumbnails | High | `src/components/home/continue-watching-card.tsx:22` | Same as #2 — unoptimized thumbnails, no lazy loading | Replace with `next/image`, `sizes="var(--landscape-w)"`, `loading="lazy"` | S |
| 4 | `EpisodeCard` uses raw `<img>` for YouTube hqdefault thumbnails in the New Episodes rail | High | `src/components/shows/episode-card.tsx:23` | Same as #2 | Replace with `next/image`, `sizes="var(--landscape-w)"`, `loading="lazy"` | S |
| 5 | `LandingHero` mounts a YouTube `iframe` with `autoplay=1` unconditionally on every `/portfolio` visit — no facade, no `loading="lazy"` | High | `src/components/landing/landing-hero.tsx:52–64` | Loads ~500 KB YouTube player JS + network stream before page is interactive; blocks LCP on mobile | Use `react-lite-youtube-embed` with `noCookie` flag as facade, or add `loading="lazy"` attribute to the iframe; only autoplay after `IntersectionObserver` fires | M |
| 6 | `portfolio/page.tsx` has no Suspense boundaries — `LandingHero` and `ShowsPortfolio` are sequential RSCs with sequential Supabase awaits | High | `src/app/[locale]/(viewer)/portfolio/page.tsx:1–15` | No streaming SSR; browser receives no HTML until all three awaits resolve (auth, config, shorts); TTFB dominated by Supabase chain | Wrap `ShowsPortfolio` and `LandingFaq` in `<Suspense>` with the skeleton from `loading.tsx` as fallback; `LandingHero` can stay blocking but decouple `ShowsPortfolio` | S |
| 7 | Duplicate `loadYouTubeAPI` singleton — identical function defined in `youtube.ts` and `youtube-player.tsx` with separate module-level state | Medium | `src/lib/youtube.ts:62` and `src/components/watch/youtube-player.tsx:17` | Double script injection risk; `onYouTubeIframeAPIReady` clobbered if both modules activate in same page | Delete the copy in `youtube-player.tsx`, import `loadYouTubeAPI` from `@/lib/youtube` | S |
| 8 | `EpisodeTray` renders ALL episodes for the active season as horizontal card buttons, all mounted at once, all fetching YouTube thumbnails via `ShowArt` + `next/image` | Medium | `src/components/watch/episode-tray.tsx:129–210` | For a 30-episode season, 30 `<Image>` mounts on tray open, 30 thumbnail requests fire simultaneously; scroll jank on tray raise | Add windowed rendering (render visible cards ± 3) or defer thumbnail load until tray is raised (`activeSnapPoint === 0.5`) | M |
| 9 | `series/[slug]/page.tsx` fetches ALL streaming shows to power a genre-filtered "More Like This" rail at the bottom | Medium | `src/app/[locale]/(viewer)/series/[slug]/page.tsx:88, 134` | Fetches full show rows for every streaming show on every series page render; wasted bandwidth grows with catalog | Add `getShowsByGenre(genre, excludeId)` query cached with `unstable_cache`; returns only matching shows directly | S |
| 10 | `ShortsOverlay` pre-warms prev/next YouTube iframes in hidden `1×1px` divs that are always mounted while overlay is open | Medium | `src/components/shorts/shorts-overlay.tsx:142–158` | Each adjacent iframe loads full YouTube player JS (~300 KB) + initial video segments; 3 concurrent YouTube iframes on first overlay open | Pre-warm only on first hover/swipe gesture, not on overlay open; or use `link rel=prefetch` instead of live iframes | S |
| 11 | `ShowArt` component uses `sizes="(max-width: 768px) 100vw, 400px"` for episode thumbnails that are actually 120–180 px wide in episode rows | Medium | `src/components/primitives/show-art.tsx:38` | Browser requests 400 px image for a 120 px slot; 3× oversized on desktop | Set `sizes="(max-width: 640px) 120px, 180px"` matching the CSS widths in `episode-row.tsx:45` | S |
| 12 | `HeroBanner` (`/watch` page) mounts all `n+1` hero slides (including clone) simultaneously — each `HeroSlide` renders a `CinematicBackdrop` which mounts a `<video>` or YouTube `iframe` per slide | Medium | `src/components/home/hero-banner.tsx:73–93` | With 5 featured shows + clone = 6 `CinematicBackdrop` instances; if any have YouTube hero videos, 6 iframes load on watch page mount | Lazy-mount `CinematicBackdrop` only for active slide ± 1; all others render a static image fallback | M |
| 13 | `CinematicBackdrop` falls back to the legacy CSS-responsive two-branch path for the `/watch` hero because `isMobile` is not threaded through `HeroBanner` → `HeroSlide` → `CinematicBackdrop` | Low | `src/components/primitives/cinematic-backdrop.tsx:105–115` | Both desktop and mobile video/image branches mount in DOM, CSS hides one; doubles media download on responsive breakpoint boundary | Thread `isMobile` from `WatchPage` through `HeroBanner` and `HeroSlide` to `CinematicBackdrop` (same pattern already used in `FeaturedHeroWithWatched`) | S |
| 14 | `EpisodeRow` calls `useTranslations` three times (`episode`, `show`, `admin.common`) for every row in the episode list | Low | `src/components/series/episode-row.tsx:28–30` | `useTranslations` is a hook with React context lookup cost; at 20–294 rows rendered, ~3× per row = 60–882 redundant context reads on series page mount | Hoist translations to `EpisodeList` parent and pass as props; eliminates repeated context reads | S |
| 15 | `SeriesDetailHero` scroll listener runs `requestAnimationFrame` + `setScrolled` on every scroll event; the animation chain (5 `motion.div` with staggered delays up to 0.75 s) fires on every series page mount | Low | `src/components/series/series-detail-hero.tsx:38–50, 104–191` | RAF + setState on scroll can jank at 60 fps if Lenis + the RAF callback compete; 0.75 s animation delay means CTA buttons aren't interactive for ~750 ms | Throttle with `passive: true` (already done) — no issue there. Reduce animation delays: stagger is 0.4/0.55/0.65/0.75, collapse to 0.2/0.3/0.4/0.5 | S |
| 16 | `portrait-show-card.tsx` and `show-card.tsx` use raw `<img>` pointing at Supabase storage `poster_url`/`hero_url` — these are not in the `remotePatterns` allowlist in `next.config.ts` | Low | `src/components/shows/portrait-show-card.tsx:43`, `src/components/shows/show-card.tsx:21` | `next/image` would be blocked by `remotePatterns` unless Supabase hostname is added (it is listed at `lajguozmtissnnfccmej.supabase.co`) — actually it is allowed, so switching to `next/image` works immediately | Switch to `next/image` (see #2); `sizes` should be `"var(--landscape-w)"` | S |
| 17 | `loadYouTubeAPI` in `youtube.ts` checks `typeof window === 'undefined'` but returns `Promise.resolve()` — the `youtube-player.tsx` copy does not have this guard | Low | `src/lib/youtube.ts:63` | No SSR crash, but if watch page somehow SSRs the player the browser copy would throw; minor inconsistency | Moot once #7 is fixed (single copy) | S |

---

## Top 3 Quick Wins

### 1. Cut preloader hard-release from 7 s to 3.5 s + add `sessionStorage` dedup (Effort: S)
**File:** `src/components/layout/entry-preload.tsx`  
Change `const hardReleaseMs = 7000` to `3500`. Add before the `shouldShowRef` assignment:
```ts
const alreadyShown = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cit-preload') === '1'
if (!alreadyShown) sessionStorage.setItem('cit-preload', '1')
const shouldShowRef = useRef(!alreadyShown && !hasShownEntryPreloadThisDocument)
```
Effect: first tab visit shows preloader ≤3.5 s; every navigation after that (including back/forward) skips it entirely. Removes the biggest perceived-lag source.

### 2. Replace `<img>` with `next/image` in `ShowCard`, `ContinueWatchingCard`, `EpisodeCard` (Effort: S each)
Three files, three one-line changes. Add `loading="lazy"` + `sizes="var(--landscape-w)"`. YouTube `hqdefault` URLs are already in `remotePatterns`. Supabase poster/hero URLs are already in `remotePatterns`. Immediate benefit: browser-native lazy loading means off-screen rail cards don't request images at all on initial load.

### 3. Delete duplicate `loadYouTubeAPI` in `youtube-player.tsx`, import from `lib/youtube` (Effort: S)
`src/components/watch/youtube-player.tsx` lines 13–38: delete local `apiReady`, `apiLoading`, `readyCallbacks`, and `loadYouTubeAPI` function. Add `import { loadYouTubeAPI } from '@/lib/youtube'` at top. Eliminates double `<script>` injection risk and keeps a single truth-of-state for the YouTube API.

---

## Bigger Investments

### A. Stream portfolio page with Suspense (Effort: M)

`portfolio/page.tsx` currently renders as a single blocking RSC tree. The fix is:

```tsx
// portfolio/page.tsx
import { Suspense } from 'react'
import { PortfolioHeroSkeleton, PortfolioGridSkeleton } from './loading-parts'

export default async function LandingPage() {
  return (
    <div>
      <Suspense fallback={<PortfolioHeroSkeleton />}>
        <LandingHero />  {/* blocks on auth + config — keep but isolate */}
      </Suspense>
      <Suspense fallback={<PortfolioGridSkeleton />}>
        <ShowsPortfolio />  {/* blocks on getFeaturedShorts */}
      </Suspense>
      <Suspense>
        <GenrePills />
      </Suspense>
      <LandingFaq />  {/* static, no Supabase */}
    </div>
  )
}
```

Next.js App Router will stream each boundary independently. The hero skeleton paints at `~50 ms` TTI from the Vercel edge; the grid and pills resolve as their data arrives. This converts the page from "blank until all three data fetches resolve" to progressive disclosure. Pair with `loading.tsx` sections split to match boundaries.

### B. Lazy-load hero slide media — only active ± 1 (Effort: M)

`HeroBanner` mounts `n+1` slides with `CinematicBackdrop` at `position: absolute`. All are in the DOM and all fire their `<video autoPlay>` or YouTube iframe on mount. With 5 featured shows = 5 video elements competing for bandwidth while the user is looking at slide 0.

Strategy: accept an `isActive` prop (already threaded into `HeroSlide` but unused by `CinematicBackdrop`) and only render the full media stack for `activeIndex - 1`, `activeIndex`, `activeIndex + 1`. All other slides render a static `<Image>` placeholder. Implementation: add `loadMedia: boolean` prop to `CinematicBackdrop`; when `false`, render only the image layer, suppress `VideoLayer`. Estimated save: 3–4 video elements / iframes not loading in parallel.

### C. Virtual / paginated episode tray (Effort: L)

`EpisodeTray` renders all episodes as horizontal cards inside a CSS `overflow-x: auto` container. At 30 episodes this is 30 `next/image` mounts + 30 DOM nodes that are mostly off-screen. The pattern that works for this layout is **on-demand mounting**: render only `currentEpisodeIndex ± 5` cards on tray open, then append more as the user scrolls toward the edge (IntersectionObserver sentinel). Since this is a horizontal scroll, a proper virtualizer (like `@tanstack/react-virtual` in horizontal mode) adds a dependency but cuts initial mount cost from O(n) to O(visible-window). For 294-episode shows this is the difference between 50 ms and 500 ms tray open time.

### D. Server-side `getShowsByGenre` to replace full-catalog fetch on series pages (Effort: S–M)

`series/[slug]/page.tsx` calls `getStreamingShows()` (all streaming shows, full rows) to build a genre-filtered rail. Instead, add:

```ts
export const getShowsByGenre = unstable_cache(
  async (genre: string, excludeId: string): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('genre', genre)
      .neq('id', excludeId)
      .eq('status', 'now-streaming')
      .eq('archived', false)
    return (data ?? []).map((s) => mapShow(s))
  },
  ['shows-by-genre'],
  { revalidate: 3600, tags: ['shows'] }
)
```

Replaces full-table scan filtered in JS with a WHERE-clause query. Each genre gets its own cache key. Series page no longer pays to download rows for unrelated genres.
