# Phase 5: Watch Page UI - Research

**Researched:** 2026-03-31
**Domain:** YouTube IFrame API integration, watch page layout, episode navigation in Next.js App Router
**Confidence:** HIGH

## Summary

Phase 5 builds the watch page at `/watch/[episodeId]` -- the core viewer experience where a user lands after clicking an episode from the series detail page. The primary technical challenge is integrating the YouTube IFrame API (vanilla, not a React wrapper library) into a Next.js client component with proper lifecycle management, TypeScript typing, and YouTube Terms of Service compliance.

The architecture is straightforward: a server component page that resolves episode data from the episode ID, renders metadata via `generateMetadata`, and delegates to a client component that manages the YouTube player and episode navigation state. Existing components (`SeasonSelector`, `EpisodeList`) are reused on the watch page for the episode quick-selector. The `EpisodeRow` component and `SeriesDetailHero` CTA button need their `href="#"` placeholders updated to point to actual `/watch/[id]` routes.

**Primary recommendation:** Build a reusable `YouTubePlayer` client component that loads the IFrame API script once (singleton pattern), creates/destroys `YT.Player` instances via `useEffect` cleanup, and exposes player state via callback props. Install `@types/youtube` for TypeScript safety. Keep all UI elements strictly below the player container -- no overlays during playback (YouTube ToS hard requirement).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Theater mode layout -- full-width YouTube player (16:9) at the top of the page, episode info and navigation below
- **D-02:** YouTube IFrame API (vanilla, not react-lite-youtube-embed) -- need getCurrentTime(), getDuration(), onStateChange for future continue-watching and autoplay features
- **D-03:** YouTube IFrame API loaded via script tag in the component (no npm package needed per CLAUDE.md)
- **D-04:** No UI elements may overlay the YouTube player during playback (YouTube ToS compliance -- WTCH-05)
- **D-05:** Prev/Next buttons below the player -- navigate between episodes within and across seasons
- **D-06:** Cross-season navigation -- "Next" on the last episode of Season 1 goes to the first episode of Season 2. "Previous" on first episode of S2 goes to last episode of S1. Disabled at absolute boundaries (first ep of show, last ep of show).
- **D-07:** Episode quick-selector reuses the existing SeasonSelector + EpisodeList components from the series detail page, placed below the player. Current episode highlighted.
- **D-08:** Route is `/watch/[episodeId]` -- flat, simple, shareable
- **D-09:** Back navigation uses browser history (back button returns to series detail page)
- **D-10:** Show/season context resolved from episode ID (look up via mock data helpers)
- **D-11:** Only CIT (Clickit Story) YouTube content allowed on the platform -- no third-party videos
- **D-12:** Use placeholder YouTube video IDs in mock data for now. User will replace with real CIT video IDs later.
- **D-13:** Even private/unlisted CIT YouTube videos can be embedded -- user controls access on YouTube side
- **D-14:** Below the player: show breadcrumb (Show > Season N > Episode N), episode title, description, duration chip
- **D-15:** Episode metadata matches the existing EpisodeRow pattern for visual consistency

### Claude's Discretion
- Loading state while YouTube player initializes (skeleton, spinner, or brand color fill)
- Exact breadcrumb styling and spacing
- Mobile responsive behavior (player stays 16:9, info stacks below)
- Whether to show "More Like This" rail at the bottom of the watch page

### Deferred Ideas (OUT OF SCOPE)
- **Autoplay next episode** (WTCH-04) -- Phase 9 scope, needs continue-watching backend
- **Continue watching progress tracking** -- needs Supabase backend (Phase 6+), zustand store can be scaffolded
- **Player quality selector** -- YouTube handles this natively
- **Fullscreen toggle** -- YouTube player has built-in fullscreen
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WTCH-01 | Watch page displays embedded YouTube player (full IFrame API) | YouTube IFrame API integration pattern with `YT.Player`, script loading singleton, `@types/youtube` for TypeScript. Player created in `useEffect` with `destroy()` cleanup. |
| WTCH-02 | Watch page shows episode metadata (title, description, show name, season/episode number) | Server component resolves episode + show + season from `episodeId`. Breadcrumb pattern: Show > Season N > Episode N. Metadata chips reuse Badge component. |
| WTCH-03 | Previous/next episode navigation buttons on watch page | New `getEpisodeById` helper resolves episode context. Navigation computation traverses seasons for cross-season boundary handling. `ChevronLeft`/`ChevronRight` icons from lucide-react. |
| WTCH-05 | YouTube IFrame API compliance -- no overlays on the player (YouTube ToS) | YouTube Required Minimum Functionality: "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls." All UI must be below the player div, never positioned over it. |
| WTCH-06 | Episode quick selector on watch page (season + episode picker without leaving player) | Reuse `SeasonSelector` and `EpisodeList` components. `EpisodeList` needs to accept optional `currentEpisodeId` prop for highlighting. `EpisodeRow` `href` must point to `/watch/[id]`. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | Framework | Already installed. Dynamic route `/watch/[episodeId]` with `generateStaticParams` and `generateMetadata`. |
| React | 19.2.4 | UI | Already installed. `useEffect` + `useRef` + `useCallback` for player lifecycle. |
| TypeScript | ^5 | Types | Already installed. Combined with `@types/youtube` for YT namespace. |
| motion | ^12.38.0 | Animation | Already installed. Subtle page entrance animations consistent with series detail page. |
| lucide-react | ^1.7.0 | Icons | Already installed. `ChevronLeft`, `ChevronRight` for prev/next; `Play` icon for loading state. |

### New Dependencies
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @types/youtube | 0.1.2 | TypeScript types for YT namespace | Provides `YT.Player`, `YT.PlayerState`, `YT.Events`, `YT.PlayerOptions` types. Dev dependency only. No runtime cost. |

### No npm package for YouTube IFrame API
Per D-03 and CLAUDE.md: The YouTube IFrame API is loaded via a `<script>` tag at runtime (`https://www.youtube.com/iframe_api`). There is no npm package to install. The `@types/youtube` package provides only TypeScript type declarations.

**Installation:**
```bash
npm install -D @types/youtube
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── watch/
│       └── [episodeId]/
│           ├── page.tsx           # Server component: resolve episode, metadata, render layout
│           └── not-found.tsx      # 404 for invalid episode IDs
├── components/
│   ├── watch/
│   │   ├── youtube-player.tsx     # Client component: YT.Player lifecycle management
│   │   ├── watch-page-content.tsx # Client component: manages navigation + quick-selector state
│   │   ├── episode-nav.tsx        # Client component: prev/next navigation buttons
│   │   └── episode-breadcrumb.tsx # Server-compatible: show > season > episode breadcrumb
│   └── series/
│       ├── episode-row.tsx        # UPDATE: href="#" → href="/watch/${episode.id}"
│       ├── episode-list.tsx       # UPDATE: add optional currentEpisodeId prop for highlighting
│       ├── season-selector.tsx    # REUSE: unchanged
│       └── series-detail-hero.tsx # UPDATE: CTA button href="#" → href="/watch/${firstEpisode.id}"
├── lib/
│   └── mock-data.ts              # UPDATE: add getEpisodeById() helper, add youtubeId to episodes
```

### Pattern 1: YouTube IFrame API Script Loading (Singleton)
**What:** Load the YouTube IFrame API script exactly once across the app, even if multiple components mount/unmount.
**When to use:** Any component that needs the `YT.Player` constructor.
**Example:**
```typescript
// Source: YouTube IFrame API Reference
// https://developers.google.com/youtube/iframe_api_reference

let apiReady = false
let apiLoading = false
const readyCallbacks: (() => void)[] = []

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) { resolve(); return }
    readyCallbacks.push(resolve)
    if (apiLoading) return
    apiLoading = true

    // Global callback that YouTube API invokes when ready
    ;(window as any).onYouTubeIframeAPIReady = () => {
      apiReady = true
      readyCallbacks.forEach((cb) => cb())
      readyCallbacks.length = 0
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
}
```

### Pattern 2: YT.Player Lifecycle in useEffect
**What:** Create and destroy `YT.Player` instances tied to React component lifecycle.
**When to use:** The `YouTubePlayer` component.
**Example:**
```typescript
// Source: YouTube IFrame API Reference + React cleanup pattern
'use client'

import { useEffect, useRef, useCallback } from 'react'

interface YouTubePlayerProps {
  videoId: string
  onReady?: (player: YT.Player) => void
  onStateChange?: (state: number) => void
}

export function YouTubePlayer({ videoId, onReady, onStateChange }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      await loadYouTubeAPI()
      if (cancelled || !containerRef.current) return

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,          // Show same-channel videos only
          playsinline: 1,  // Inline playback on iOS
          enablejsapi: 1,  // Required for API control
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => onReady?.(event.target),
          onStateChange: (event) => onStateChange?.(event.data),
        },
      })
    }

    init()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId]) // Re-create player when videoId changes

  return (
    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}
```

### Pattern 3: Cross-Season Episode Navigation
**What:** Compute previous/next episodes that work across season boundaries.
**When to use:** Episode navigation buttons and keyboard shortcuts.
**Example:**
```typescript
// Flatten all episodes across seasons in order, then find prev/next
interface NavigationResult {
  prev: Episode | null
  next: Episode | null
}

function getEpisodeNavigation(
  episodeId: string,
  seasons: Season[],
  episodesBySeason: Record<string, Episode[]>
): NavigationResult {
  // Build flat ordered list of all published episodes
  const allEpisodes = seasons.flatMap(
    (season) => (episodesBySeason[season.id] ?? [])
      .filter((ep) => ep.status === 'published')
  )

  const currentIndex = allEpisodes.findIndex((ep) => ep.id === episodeId)
  if (currentIndex === -1) return { prev: null, next: null }

  return {
    prev: currentIndex > 0 ? allEpisodes[currentIndex - 1] : null,
    next: currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null,
  }
}
```

### Pattern 4: Server Component Page with Client Islands
**What:** Page-level server component fetches data, passes serializable props to client components.
**When to use:** The watch page `/watch/[episodeId]/page.tsx`.
**Example:**
```typescript
// Follows exact pattern from src/app/series/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params // Next.js 16 async params
  const episode = getEpisodeById(episodeId)
  if (!episode) return { title: 'Episode Not Found | Clickit Story' }
  return {
    title: `${episode.title} | ${episode.show.title} | Clickit Story`,
    description: episode.description,
  }
}

export function generateStaticParams() {
  return MOCK_EPISODES
    .filter((ep) => ep.status === 'published')
    .map((ep) => ({ episodeId: ep.id }))
}
```

### Anti-Patterns to Avoid
- **Overlaying UI on YouTube player:** YouTube ToS violation. "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls." All UI goes below, never on top.
- **Using react-youtube or react-player:** Per CLAUDE.md and D-02, use vanilla YouTube IFrame API directly. Wrapping libraries add abstraction over events we need direct access to.
- **Loading IFrame API script via next/script:** The `onYouTubeIframeAPIReady` global callback pattern does not integrate cleanly with Next.js `<Script>` component's `onLoad` callback. Use a manual `document.createElement('script')` approach inside the component.
- **Not destroying the player:** Memory leak. Always call `player.destroy()` in `useEffect` cleanup.
- **Constructing Tailwind classes dynamically:** Per Phase 03 decision, always use static brand color maps (`brandColorBgMap`, `brandColorTextMap`).
- **Making the page component a client component:** Keep `page.tsx` as a server component. Only interactive parts (player, navigation) are client components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube IFrame type safety | Manual `declare global` types | `@types/youtube` (0.1.2) | Comprehensive, maintained types for `YT.Player`, `YT.PlayerState`, all events and methods |
| 16:9 responsive container | Custom JS resize logic | CSS `padding-bottom: 56.25%` with `position: absolute` child | Pure CSS, zero JS, works everywhere. The standard 16:9 aspect-ratio trick. Alternatively `aspect-ratio: 16/9` with modern browsers. |
| Season/episode selection UI | New selector component | Existing `SeasonSelector` + `EpisodeList` | Already built, tested, and reviewed in Phase 4. Reuse directly. |
| Loading skeleton | Custom shimmer animation | shadcn/ui Skeleton component (`npx shadcn@latest add skeleton`) | Standard pattern, already used across the project's UI library |
| Episode navigation | Manual index math | Flat array approach from Pattern 3 | Flattening seasons into a single array makes cross-season navigation trivial |

**Key insight:** The watch page is primarily an integration and layout task. Almost all complex UI components (season selector, episode list, episode rows) already exist from Phase 4. The new technical work is the YouTube IFrame API wrapper component and the navigation logic.

## Common Pitfalls

### Pitfall 1: YouTube IFrame API Script Loaded Multiple Times
**What goes wrong:** If the script loading logic is inside the component without a singleton guard, navigating between episodes or re-mounting the component loads the script tag multiple times. The `onYouTubeIframeAPIReady` callback fires for each load, but only the last-registered callback runs.
**Why it happens:** React Strict Mode double-mounts components in development. Client-side navigation re-mounts page components.
**How to avoid:** Use a module-level singleton pattern (see Pattern 1). The `apiLoading` flag prevents duplicate script tags. The `readyCallbacks` array handles multiple components waiting for the API.
**Warning signs:** Console errors about `YT` being undefined, or the player not initializing on the second episode you visit.

### Pitfall 2: Player Not Destroyed on Route Change
**What goes wrong:** When navigating from one episode to another via Next.js client navigation, the old `YT.Player` instance is not destroyed, causing memory leaks and the old player to keep running in the background.
**Why it happens:** Client-side navigation in Next.js does not trigger a full page reload. The component unmounts and remounts, but the YouTube iframe persists if `destroy()` is not called.
**How to avoid:** Always call `playerRef.current?.destroy()` in the `useEffect` cleanup function. Set `playerRef.current = null` after destroying.
**Warning signs:** Audio from previous video continuing after navigation. Multiple iframes in the DOM.

### Pitfall 3: `modestbranding` PlayerVar Does Nothing
**What goes wrong:** Setting `modestbranding: 1` in `playerVars` has no effect. Developers expect it to hide the YouTube logo.
**Why it happens:** YouTube deprecated `modestbranding` as of August 2023. The parameter is now ignored.
**How to avoid:** Do not set `modestbranding` in playerVars. It is not a valid option anymore.
**Warning signs:** YouTube logo still appearing despite setting the param.

### Pitfall 4: Player Minimum Size Violation
**What goes wrong:** On very small mobile screens, the YouTube player shrinks below 200x200px and controls become unusable or the player fails to render.
**Why it happens:** YouTube requires a minimum viewport of 200x200px for the player. The recommended 16:9 minimum is 480x270px.
**How to avoid:** Set `min-h-[200px]` on the player container. On mobile, let the player be full-width (which at any reasonable phone width exceeds 200px).
**Warning signs:** Player controls overlapping or disappearing on small screens.

### Pitfall 5: useEffect Dependency on Callback Props
**What goes wrong:** Including `onReady` or `onStateChange` in the `useEffect` dependency array causes the player to be destroyed and recreated on every parent re-render (because function props get new references).
**Why it happens:** React creates new function references on each render unless the parent uses `useCallback`.
**How to avoid:** Use `useRef` to store the latest callback values and reference those refs inside the `useEffect`, while only depending on `videoId`. Or use `useCallback` on the parent side.
**Warning signs:** Player flickering or reloading when interacting with other parts of the page.

### Pitfall 6: YouTube Error Codes 101/150 on Embed
**What goes wrong:** Player throws error 101 or 150 for certain videos.
**Why it happens:** The video owner has disabled embedding, or the video is restricted. Per D-13, CIT controls their own YouTube videos, so this should not happen with real CIT content. But placeholder video IDs during development might trigger this.
**How to avoid:** Use well-known public YouTube video IDs as placeholders (e.g., `dQw4w9WgXcQ` -- Rick Astley "Never Gonna Give You Up" is always embeddable, or use YouTube's official test video). Handle the `onError` event gracefully with a fallback message.
**Warning signs:** Player shows black screen with an error icon.

### Pitfall 7: `href="#"` Links Still Present After Phase 5
**What goes wrong:** Some episode links or CTA buttons still point to `#` instead of `/watch/[id]`, breaking the watch page entry flow.
**Why it happens:** The `EpisodeRow` and `SeriesDetailHero` components were built in Phase 4 with placeholder `href="#"` because the watch page did not exist yet.
**How to avoid:** Phase 5 must update both `episode-row.tsx` (published episodes link to `/watch/${episode.id}`) and `series-detail-hero.tsx` (CTA button links to `/watch/${firstEpisodeId}`).
**Warning signs:** Clicking an episode or "Watch" button does not navigate to the watch page.

## Code Examples

### YouTube IFrame API playerVars (Verified)
```typescript
// Source: https://developers.google.com/youtube/player_parameters
// Verified 2026-03-31

const PLAYER_VARS: YT.PlayerVars = {
  autoplay: 0,        // Don't autoplay (user clicks to play)
  controls: 1,        // Show player controls
  rel: 0,             // Related videos from same channel only (post-Sept 2018)
  playsinline: 1,     // Inline playback on iOS
  enablejsapi: 1,     // Required for IFrame API access
  iv_load_policy: 3,  // Hide video annotations
  // origin: set dynamically to window.location.origin
  // NOTE: modestbranding is DEPRECATED (Aug 2023) -- do NOT include
  // NOTE: showinfo is DEPRECATED (2018) -- do NOT include
}
```

### YouTube Player States (Verified)
```typescript
// Source: https://developers.google.com/youtube/iframe_api_reference
// Access via YT.PlayerState enum

YT.PlayerState.UNSTARTED  // -1
YT.PlayerState.ENDED      // 0
YT.PlayerState.PLAYING    // 1
YT.PlayerState.PAUSED     // 2
YT.PlayerState.BUFFERING  // 3
YT.PlayerState.CUED       // 5
```

### YouTube Error Codes
```typescript
// Source: https://developers.google.com/youtube/iframe_api_reference

// Error 2: Invalid parameter
// Error 5: HTML5 player error
// Error 100: Video not found (removed or private)
// Error 101: Embedding disabled by video owner
// Error 150: Same as 101
// Error 153: Missing HTTP Referer header
```

### getEpisodeById Helper Function
```typescript
// New helper needed for Phase 5 -- resolves full episode context from ID
export function getEpisodeById(episodeId: string): {
  episode: Episode
  show: Show
  season: Season
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
} | undefined {
  const episode = MOCK_EPISODES.find((e) => e.id === episodeId)
  if (!episode) return undefined

  const show = MOCK_SHOWS.find((s) => s.id === episode.showId)
  if (!show) return undefined

  const season = MOCK_SEASONS.find((s) => s.id === episode.seasonId)
  if (!season) return undefined

  const seasons = getSeasonsByShowId(show.id)
  const episodesBySeason: Record<string, Episode[]> = {}
  for (const s of seasons) {
    episodesBySeason[s.id] = getEpisodesBySeasonId(s.id)
  }

  return { episode, show, season, seasons, episodesBySeason }
}
```

### Responsive 16:9 Player Container
```typescript
// Two approaches -- both work:

// Approach 1: Modern CSS (aspect-ratio)
<div className="w-full aspect-video bg-black">
  <div ref={containerRef} className="w-full h-full" />
</div>

// Approach 2: Classic padding trick (wider browser support)
<div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
  <div ref={containerRef} className="absolute inset-0" />
</div>

// Recommendation: Use aspect-video (Tailwind utility for aspect-ratio: 16/9)
// All modern browsers support it. The project already uses it in EpisodeRow.
```

### Loading Skeleton for Player
```typescript
// Recommendation: Brand color fill matching the show's brand color
// Consistent with EpisodeRow thumbnail pattern

<div className="w-full aspect-video bg-surface-1 flex items-center justify-center">
  <Play className="size-12 text-white/20" />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `modestbranding: 1` | Parameter deprecated, no replacement | August 2023 | YouTube logo always shows. Do not attempt to hide it. |
| `showinfo: 0` | Parameter deprecated | September 2018 | Video title always shows during initial buffering. |
| `rel: 0` hides all related | `rel: 0` shows same-channel related | September 2018 | Cannot fully hide related videos anymore; `rel: 0` limits to same channel. |
| `theme: 'dark'` | Parameter deprecated | HTML5 player | YouTube controls always use modern theme. |
| `framer-motion` package | `motion` package with `motion/react` imports | 2024 | Project already uses `motion`. |

**Deprecated/outdated:**
- `modestbranding`: Deprecated August 2023. Has no effect.
- `showinfo`: Deprecated September 2018. Ignored.
- `autohide`: Deprecated for HTML5 player. Ignored.
- `theme`: Deprecated for HTML5 player. Ignored.
- `react-youtube` / `react-player`: Not used per project architecture decisions. Vanilla API gives direct event access.

## Open Questions

1. **Placeholder YouTube Video IDs**
   - What we know: Mock episodes need `youtubeId` fields. Any publicly embeddable YouTube video works for development.
   - What's unclear: The user may want to provide real CIT video IDs immediately, or accept placeholder public video IDs.
   - Recommendation: Use well-known public video IDs (e.g., `dQw4w9WgXcQ`) as placeholders. The `youtubeId` field is a simple string swap when real IDs are available. Document this in mock data comments.

2. **"More Like This" Rail on Watch Page**
   - What we know: Claude's discretion. Series detail page already has a "More Like This" rail.
   - What's unclear: Whether it adds value on the watch page or clutters the experience.
   - Recommendation: Skip for Phase 5 to keep focus on the core watch experience. Can be added later with minimal effort since the `ContentRail` component already exists.

3. **Skeleton Component Availability**
   - What we know: shadcn/ui `Skeleton` is not yet installed in the project (not in `src/components/ui/`).
   - What's unclear: Whether the loading state needs a formal Skeleton or a simpler approach.
   - Recommendation: Use a simple brand-color fill with a centered play icon for the player loading state (matches existing EpisodeRow pattern). Add shadcn Skeleton only if needed for more complex loading UIs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/e2e/watch.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WTCH-01 | YouTube player iframe renders on watch page | e2e | `npx playwright test tests/e2e/watch.spec.ts -g "youtube player" --project=chromium` | Wave 0 |
| WTCH-02 | Episode metadata (title, description, breadcrumb) visible | e2e | `npx playwright test tests/e2e/watch.spec.ts -g "metadata" --project=chromium` | Wave 0 |
| WTCH-03 | Prev/next navigation buttons visible and functional | e2e | `npx playwright test tests/e2e/watch.spec.ts -g "navigation" --project=chromium` | Wave 0 |
| WTCH-05 | No overlays on YouTube player | e2e (structural) | `npx playwright test tests/e2e/watch.spec.ts -g "no overlay" --project=chromium` | Wave 0 |
| WTCH-06 | Season selector and episode list visible on watch page | e2e | `npx playwright test tests/e2e/watch.spec.ts -g "episode selector" --project=chromium` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/e2e/watch.spec.ts --project=chromium`
- **Per wave merge:** `npx playwright test --project=chromium`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/watch.spec.ts` -- covers WTCH-01, WTCH-02, WTCH-03, WTCH-05, WTCH-06
- Note: YouTube iframe content is cross-origin and cannot be tested directly via Playwright. Tests should verify: (1) iframe element exists with correct src, (2) metadata renders, (3) navigation links work, (4) no z-index overlays above player container.

### Testing YouTube IFrame in E2E
YouTube iframes are cross-origin -- Playwright cannot interact with content inside them. The test strategy is:
- Verify an `<iframe>` element with `src` containing `youtube.com/embed/` exists in the DOM
- Verify the iframe has expected dimensions (16:9 aspect ratio container)
- Verify no sibling/child elements are positioned over the iframe (WTCH-05)
- Verify episode metadata renders correctly alongside the player
- Verify navigation buttons link to correct episode IDs
- Do NOT attempt to control playback inside the iframe

## Project Constraints (from CLAUDE.md)

- **Stack**: Next.js App Router + Supabase + Tailwind CSS, deployed on Vercel
- **Video**: YouTube embed only -- YouTube IFrame API for watch page, react-lite-youtube-embed for catalog
- **Brand**: Follow CIT Branding Guideline for colors, typography
- **React patterns**: Server components for page-level data, client components only for interactivity
- **Tailwind v4**: Static brand color maps, no dynamic class construction
- **Next.js 16**: Async `params` in page components (`const { episodeId } = await params`)
- **motion package**: Use `motion/react` imports, not `framer-motion`
- **Testing**: Playwright with chromium-only project
- **Deployment**: Deploy to Vercel for verification (per memory)

## Sources

### Primary (HIGH confidence)
- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) - Player construction, methods, events, states, error codes
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters) - All playerVars, deprecated params (modestbranding, showinfo)
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) - Overlay restrictions, minimum size, autoplay rules
- [Next.js Video Guide](https://nextjs.org/docs/app/guides/videos) - iframe embedding patterns for Next.js
- Existing codebase: `src/components/series/*.tsx`, `src/lib/mock-data.ts`, `src/app/series/[slug]/page.tsx` - Established patterns for server/client component split, episode data structures

### Secondary (MEDIUM confidence)
- [@types/youtube on npm](https://www.npmjs.com/package/@types/youtube) - v0.1.2, TypeScript types for YT namespace
- [DefinitelyTyped YouTube types](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts) - Source of @types/youtube

### Tertiary (LOW confidence)
- None. All findings verified against official YouTube API documentation and existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed except `@types/youtube` (dev dependency, verified on npm)
- Architecture: HIGH - Follows exact patterns established in Phases 3-4 (server page + client islands)
- YouTube IFrame API: HIGH - Verified against official Google developer documentation
- Pitfalls: HIGH - Deprecated params verified against official docs, lifecycle patterns verified against React docs
- Navigation logic: HIGH - Mock data structure fully inspected, cross-season traversal is straightforward with flat array approach

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- YouTube IFrame API changes infrequently)
