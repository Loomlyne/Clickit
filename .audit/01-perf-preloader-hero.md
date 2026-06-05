# Performance Audit — Preloader & Hero First-Paint Jank

**Scope:** Entry preloader, hero animations, Silk WebGL, layout/providers, landing page.
**Date:** 2026-05-30
**Auditor:** Claude Code (Sonnet 4.6)

---

## Summary

- **Silk.jsx is a dead-weight import.** The THREE.js + @react-three/fiber bundle (~600 KB gzipped) ships to every page even though `Silk` is not rendered anywhere in the viewer route tree — it is only referenced in a comment in `(watch)/layout.tsx`. Removing it from dependencies (or code-splitting it) is pure bundle win with zero UX cost.
- **Preloader video fetches a cold Supabase Storage URL with no preload link.** The MP4 at `lajguozmtissnnfccmej.supabase.co` is fetched only after JS hydrates, with `preload="auto"` on the `<video>` but no `<link rel="preload">` in the HTML, so users on mobile or slow connections sit at the image fallback for the full `startupFallbackMs` (3 s) before anything plays — and can be blocked for `hardReleaseMs` (7 s) total.
- **Double PageTransition wrapper.** `(viewer)/layout.tsx` wraps `children` in `<PageTransition>` AND `(viewer)/template.tsx` also wraps `children` in `<PageTransition>`. On every within-locale navigation both fire, producing a stacked opacity: 0→1 from two independent `motion.div` trees. The template one re-mounts on every route change; the layout one does not. Net effect: two concurrent fade-in animations on every page navigation.
- **HeroBanner passes `isActive={true}` to ALL slides.** The carousel renders every `HeroSlide` — including off-screen slides — with `isActive={true}`. Each `HeroSlide` mounts a `CinematicBackdrop` with a YouTube iframe or `<video>` element that autoplay-starts immediately. With N featured shows, N YouTube iframes load in parallel before the user ever sees slide 2+, burning network bandwidth and GPU decoding on hidden content.
- **Infinite motion animations run on the landing hero and scroll indicator without reduced-motion gates.** `landing-hero-animations.tsx:72` runs a bouncing arrow `repeat: Infinity` from first render. `auth/show-collage.tsx:31` runs a 20-second `y: [0, -40]` infinite loop on a 3D-perspective card grid, compositing on main thread without `will-change: transform`.
- **Navbar logo is a 194 KB PNG (2275×2160 px).** `cit-story.png` is loaded `priority` on every page via `next/image` but is a massive source file for what renders at `h-8` (32px tall). next/image will optimize it, but the original is unoptimized on the CDN when `logoUrl` is truthy (dynamic URL) — path hits `unoptimized={!!logoUrl}` and bypasses resizing.

---

## Findings

| # | Issue | Severity | Location (file:line) | Impact | Recommended Fix | Effort |
|---|-------|----------|----------------------|--------|-----------------|--------|
| 1 | THREE.js + @react-three/fiber in bundle despite Silk never being rendered | Critical | `src/components/Silk.jsx:1`, `package.json:19,42` | ~600 KB extra JS parsed on every page load; delays TTI and preloader hydration | Remove `@react-three/fiber` and `three` from `dependencies` (move to `devDependencies` or delete); delete `Silk.jsx` if unused. If Silk is wanted later, `next/dynamic` with `ssr:false`. | S |
| 2 | No `<link rel="preload">` for preloader MP4; cold Supabase CDN fetch starts after hydration | Critical | `src/components/layout/entry-preload.tsx:12-13` | On mobile/slow networks, video never starts before `startupFallbackMs` (3 s); user sees static logo for 3–7 s | Add `<link rel="preload" as="video" href={src} crossOrigin="anonymous" />` inside the RSC layout before `<EntryPreload />`, or move asset to Vercel Edge CDN / public folder so it can be served with proper Cache-Control and preloaded in the document head | M |
| 3 | `hardReleaseMs = 7000` — preloader can block page for 7 full seconds | Critical | `src/components/layout/entry-preload.tsx:23,79` | Even when video plays fine, the hard release only fires as a failsafe; but the real concern is worst-case: slow video + no ended event = 7 s black screen before content appears | Reduce to 5 s max and audit video `onEnded` fallback; consider a content-visibility reveal after video is visually done even if `onEnded` hasn't fired | S |
| 4 | Double PageTransition: both `layout.tsx:45` and `template.tsx:8` wrap children in `<PageTransition>` | High | `src/app/[locale]/(viewer)/layout.tsx:45`, `src/app/[locale]/(viewer)/template.tsx:8` | Two concurrent opacity 0→1 fades on every navigation. On first load both animate simultaneously, doubling JS work and compounding visual fade delay. | Remove `<PageTransition>` from `layout.tsx:45` — keep only in `template.tsx` (template re-mounts per route, layout does not, so template is the correct placement for route-change animation) | S |
| 5 | HeroBanner passes `isActive={true}` to every slide; all N YouTube iframes/videos autoplay simultaneously | High | `src/components/home/hero-banner.tsx:88` | N simultaneous iframe loads (network, GPU decode, IFrame API init) on the /watch page behind the preloader. Degrades LCP and causes audio/decode contention. | Pass `isActive={i === activeIndex}` and gate video autoplay in `CinematicBackdrop` / `VideoLayer` on `isActive`. Off-screen slides should render a placeholder or poster image only. | M |
| 6 | Silk.jsx `Canvas` uses `frameloop="always"` with no pause-when-hidden logic | High | `src/components/Silk.jsx:119,80-82` | Even if Silk were rendered, the rAF loop in `useFrame` runs at 60fps permanently — no `visibilitychange` listener, no `document.hidden` check, no `frameloop="demand"`. Wastes GPU on tab switch. | If kept: use `frameloop="demand"` + invalidate only when visible; add `document.addEventListener('visibilitychange', ...)` to pause/resume. Or just delete (see #1). | S |
| 7 | `ShowCollage` (auth page) runs a 20 s infinite 3D perspective animation with no `prefers-reduced-motion` guard | High | `src/components/auth/show-collage.tsx:28-33` | Continuous compositor work on a 3D-perspective div with 8 card images. No `useReducedMotion()` check. Hurts users with vestibular disorders and wastes GPU on every auth page visit. | Wrap animate with `useReducedMotion()` — skip the infinite animation when true; add `will-change: transform` to the `motion.div` | S |
| 8 | `LandingHeroAnimations` scroll-indicator arrow runs `repeat: Infinity` from first paint with no reduced-motion gate | High | `src/components/landing/landing-hero-animations.tsx:71-74` | Perpetual rAF-backed JS animation on every landing page visit. Also fires even while preloader is covering the screen. | Add `useReducedMotion()` from `motion/react`; skip `repeat: Infinity` when true. Preloader phase can also suppress mount until preloader exits. | S |
| 9 | `entry-preload.tsx` plays video with `setInterval` at 250 ms retrying `video.play()` while also setting state on every retry attempt | Medium | `src/components/layout/entry-preload.tsx:137, 127-134` | 250 ms polling loop (`retryTimer`) causes multiple React state updates and re-renders during preloader phase; `setVideoStarted(true)` inside `onPlaying` and `onTimeUpdate` also double-fires | Remove the `setInterval` retry loop entirely; rely on `autoPlay` attribute + `onPlaying` event. The browser handles play retry internally. If needed, a single delayed retry suffices. | S |
| 10 | Full i18n message bundle (61 KB EN / 79 KB AR) shipped to client via `NextIntlClientProvider` with `messages={messages}` | Medium | `src/app/[locale]/layout.tsx:100,120` | Both language JSON files are sent to the browser on every page load. Most client components use only a subset of namespaces. | Use next-intl's `useMessages()` with namespace filtering, or split message files by namespace and only pass required namespaces per page/layout. | M |
| 11 | Navbar logo `cit-story.png` is 2275×2160 px / 194 KB PNG loaded `priority` on every page | Medium | `src/components/layout/navbar.tsx:85-91`, `public/brand/cit-story.png` | When `logoUrl` is null (static path), next/image optimizes it — but the source is still a 194 KB decode. When `logoUrl` is set (dynamic CDN URL), `unoptimized={true}` bypasses all optimization entirely, sending the full file to mobile. | Convert `cit-story.png` to WebP at 512×512 max. If the admin-supplied logo via `config.faviconUrl` is used, proxy it through next/image (add the domain to `remotePatterns`) instead of `unoptimized={true}`. | S |
| 12 | Navbar has two copies of the Live pill render logic (mobile + desktop) with duplicated `animate-ping` elements always running | Medium | `src/components/layout/navbar.tsx:105-126, 139-161` | Two `animate-ping` CSS animations run simultaneously on every non-landing page — one visible, one hidden via `md:hidden`. Both are in the DOM and composited. | Extract a single `LivePill` component; render it once in each position. The hidden one still costs compositor layers. | S |
| 13 | `preload="auto"` on preloader `<video>` triggers immediate full download of MP4 before play is gated | Medium | `src/components/layout/entry-preload.tsx:199` | `preload="auto"` tells the browser to buffer the entire video immediately. Combined with the cold CDN URL, this competes for bandwidth with LCP image/fonts during the critical first 3 seconds. | Change to `preload="metadata"` on the `<video>` element; let the preload hint (fix #2) handle the actual download priority. | S |
| 14 | `HeroBanner` carousel interval is 2,500 ms — very aggressive for a carousel that loads YouTube iframes | Medium | `src/components/home/hero-banner.tsx:10` | Slides transition before the background video/iframe of the previous slide has even loaded (YouTube iframes take 2–4 s), creating perceived jank as the next slide's blank backdrop flashes in. | Increase `INTERVAL` to at least 5,000 ms, or gate advance until the next slide's media has signalled readiness. | S |
| 15 | `LandingHeroAnimations` is a `'use client'` component that loads immediately with cascaded staggered delays (0.1→0.9 s) — all motion happens before preloader exits | Low | `src/components/landing/landing-hero-animations.tsx:15-82` | 5 `motion.div` elements begin animating at mount, including while the preloader z-[1000] covers them. Wasted JS animation work running invisibly. | Delay mounting `LandingHeroAnimations` until preloader `phase === 'done'` (expose via context or prop), or set `initial={false}` and use `useInView` to trigger entrance only when visible. | M |
| 16 | Lenis smooth scroll runs rAF on main thread at 60fps even during preloader phase when scroll is locked | Low | `src/components/providers/smooth-scroll.tsx:16-28` | Lenis starts its own rAF loop on mount, before scroll is ever possible (body overflow hidden). Wastes CPU during the 2–7 s preloader window. | Wrap `ReactLenis` mount in a state that waits for `phase === 'done'` from the preloader, or at minimum call `lenis.stop()` while overflow is locked. | M |
| 17 | `cit-story.png` navbar logo decoded at runtime is 2275×2160 — massive decode for a 32px tall render target | Low | `public/brand/cit-story.png` | Even with next/image serving correct sizes, the decode step for a 2275×2160 source is expensive on low-end devices. | Replace source with a pre-cropped 200×54 px WebP. This is independent of CDN optimization. | S |
| 18 | `MarqueeTicker` injects a `<style>` block inside a client component on every render | Low | `src/components/landing/marquee-ticker.tsx:53-68` | `<style>` injection from JS is not statically extracted by Tailwind/Next and re-evaluated on re-renders. Already uses `will-change-transform` via `backface-visibility: hidden` which is correct, but the `@keyframes` block should move to `globals.css`. | Move keyframes and `.marquee-track` animation to `globals.css`. Remove inline `<style>`. | S |

---

## Top 3 Quick Wins

### 1. Remove or de-bundle Silk/THREE.js (Critical, S)
`Silk.jsx` is imported nowhere in the viewer route tree — the only reference is a comment. But `@react-three/fiber` and `three` are production `dependencies`, so Webpack/Turbopack pulls them into the shared chunk. Three.js alone is ~600 KB parsed JS. Removing these two packages from `dependencies` in `package.json` is a one-line change that eliminates a massive parse cost and speeds up every page's TTI including the preloader.

**Files:** `package.json:19,42`, `src/components/Silk.jsx`

### 2. Fix Double PageTransition — remove from layout, keep in template (High, S)
`src/app/[locale]/(viewer)/layout.tsx:45` wraps `{children}` in `<PageTransition>`. `src/app/[locale]/(viewer)/template.tsx:8` does the same. Delete the `<PageTransition>` wrapper in `layout.tsx` and the bare `<div className="pt-16">` can wrap `{children}` directly. The template is the correct location for route-change animations (it re-mounts on navigation; the layout does not). This eliminates the double-fade jank on every page transition with a one-line deletion.

**Files:** `src/app/[locale]/(viewer)/layout.tsx:44-46`

### 3. Add `<link rel="preload">` for the preloader MP4 + reduce hardReleaseMs (Critical, S+S)
The preloader video is fetched only after JS hydrates and `useEffect` runs. Adding a `<link rel="preload" as="video" href="...clickit-preloader.mp4..." />` in the RSC layout before `<EntryPreload />` tells the browser to start fetching during HTML parse, before any JS runs. Pair this with reducing `hardReleaseMs` from 7,000 ms to 5,000 ms. These two changes together cut worst-case preloader blocking from 7 s to ~3–4 s on average connections.

**Files:** `src/app/[locale]/(viewer)/layout.tsx`, `src/components/layout/entry-preload.tsx:23`

---

## Bigger Investments

### A. Gate HeroBanner slides on `isActive` — lazy-load off-screen backdrops (High, M)
Currently all `extShows` (N+1) slides are mounted with `isActive={true}`, causing every YouTube iframe to autoplay simultaneously. The fix requires:
1. Pass `isActive={i === activeIndex}` from `hero-banner.tsx:88`.
2. In `HeroSlide`, only mount `<CinematicBackdrop>` when `isActive`, or render a static `<Image>` poster for inactive slides.
3. In `CinematicBackdrop`/`VideoLayer`, skip `autoPlay` / omit iframe `autoplay=1` when `!isActive`.

This eliminates N-1 concurrent network + GPU decode operations on the /watch landing, dramatically improving LCP and reducing perceived jank after the preloader exits.

**Files:** `src/components/home/hero-banner.tsx:84-94`, `src/components/home/hero-slide.tsx:38-51`, `src/components/primitives/cinematic-backdrop.tsx:131-142`

### B. Split i18n message bundles by namespace (Medium, M)
The root layout ships the full `messages` object (61–79 KB) to every page via `NextIntlClientProvider`. next-intl supports passing only a subset of messages using `pick` from `use-intl/core`. Audit which namespaces each client component uses and pass only those. The server-rendered components need no message hydration at all. This reduces the JS payload on every page and speeds up `NextIntlClientProvider` hydration.

**Files:** `src/app/[locale]/layout.tsx:100,120`, `src/messages/en.json`, `src/messages/ar.json`

### C. Suspend `LandingHeroAnimations` until preloader exits (Medium, M)
Five `motion.div` staggered entrance animations begin running immediately on mount — while the preloader at `z-[1000]` covers them. The animations complete before the user ever sees them. Expose the preloader's `done` state via a React context (or Zustand slice) and delay mounting `LandingHeroAnimations` until `phase === 'done'`. This also means `initial={{ opacity: 0 }}` animations will be visible and will replay on first reveal, delivering the intended cinematic effect.

**Files:** `src/components/landing/landing-hero-animations.tsx`, `src/components/layout/entry-preload.tsx`, `src/app/[locale]/(viewer)/portfolio/page.tsx`

### D. Move preloader MP4 to `public/` or Vercel Blob for edge-cached delivery (Medium, L)
The preloader video is hosted on Supabase Storage (`lajguozmtissnnfccmej.supabase.co`). Supabase Storage is a Postgres-backed object store — not a CDN-optimized edge network like Vercel's. It has no automatic regional edge caching, meaning every cold user fetches the video from a single origin. Moving the MP4 to `public/brand/` (served via Vercel Edge CDN with immutable cache headers already configured in `next.config.ts:headers`) would make it globally cached and served <50ms from edge nodes. The file must be small enough for `public/` — check the MP4 duration and encode at H.264 baseline, target <500 KB.

**Files:** `src/components/layout/entry-preload.tsx:12`, `next.config.ts:43-49`
