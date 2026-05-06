# Phase 32: Watch Route Isolation & Fullscreen Shell — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 3 new/modified files (+ 2 deletes, 2 unchanged)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/[locale]/(watch)/layout.tsx` | layout | request-response | `src/app/[locale]/(viewer)/layout.tsx` | role-match (strip providers, keep div wrapper) |
| `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` | page (server component) | request-response | `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` | exact (move verbatim, two surgical edits) |
| `src/components/watch/watch-shell.tsx` | component (client) | event-driven | `src/components/watch/watch-page-content.tsx` | exact (same props interface, same hooks, fullscreen shell replaces YT-style layout) |

**Files deleted (no pattern needed):**
- `src/app/[locale]/(viewer)/watch/` — deleted after migration
- `src/components/watch/watch-page-content.tsx` — deleted after WatchShell confirmed

**Files unchanged (reused as-is):**
- `src/components/watch/youtube-player.tsx`
- `src/hooks/use-progress-tracker.ts`

---

## Pattern Assignments

### `src/app/[locale]/(watch)/layout.tsx` (layout, request-response)

**Analog:** `src/app/[locale]/(viewer)/layout.tsx`

**Key constraint:** `[locale]/layout.tsx` (lines 116–178) already emits `<html>` and `<body>`. The `(watch)/layout.tsx` is a segment layout — it must NOT re-emit `<html>`/`<body>`. Return a plain `<div>` wrapper only.

**What to strip from the (viewer) analog:** Remove all imports and JSX for `ViewerSilkBackground`, `SmoothScroll`, `MarqueeTicker`, `Navbar`, `Footer`, `PageTransition`, and the `createClient` / `getSession` call. The `(watch)` layout has zero providers and zero auth checks.

**Viewer layout structure to NOT copy** (`src/app/[locale]/(viewer)/layout.tsx` lines 1–35):
```tsx
// DO NOT copy these imports into (watch)/layout.tsx:
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { PageTransition } from '@/components/layout/page-transition'
import { ViewerSilkBackground } from '@/components/layout/viewer-silk-background'
import { MarqueeTicker } from '@/components/landing/marquee-ticker'
```

**Correct (watch) layout pattern** (derived from route group escape + RESEARCH.md Pattern 1):
```tsx
// src/app/[locale]/(watch)/layout.tsx
// Server component — no 'use client' directive, no providers
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // [locale]/layout.tsx already provides: html, body, NextIntlClientProvider,
  // Toaster, Analytics. This layout only provides a fullscreen black container.
  // No SmoothScroll, no Navbar, no Footer, no Silk, no MarqueeTicker.
  return (
    <div className="h-dvh min-h-svh overflow-hidden bg-black">
      {children}
    </div>
  )
}
```

---

### `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` (page, request-response)

**Analog:** `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx`

**Copy verbatim:** Entire file. Two surgical changes only.

**Imports pattern** (`src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` lines 1–8):
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WatchPageContent } from '@/components/watch/watch-page-content'
import { getEpisodeById, getEpisodeProgress, mapShow, mapEpisode, mapSeason } from '@/lib/queries'
import { getLocale } from '@/lib/locale'
```

**Change 1 — swap component import** (line 5):
```tsx
// BEFORE:
import { WatchPageContent } from '@/components/watch/watch-page-content'

// AFTER:
import { WatchShell } from '@/components/watch/watch-shell'
```

**Parallel data fetch pattern** (lines 56–60) — copy unchanged:
```tsx
const [data, locale, progressRow] = await Promise.all([
  getEpisodeById(episodeId),
  getLocale(),
  user ? getEpisodeProgress(user.id, episodeId) : Promise.resolve(null),
])
```

**Return pattern** (lines 82–96) — strip the `-mt-16` wrapper div, swap component name:
```tsx
// BEFORE (lines 82–96):
return (
  <div className="watch-page-wrap -mt-16">
    <WatchPageContent
      episode={viewEpisode}
      ...
    />
  </div>
)

// AFTER — no wrapper div, no -mt-16:
return (
  <WatchShell
    episode={viewEpisode}
    show={viewShow}
    season={viewSeason}
    seasons={viewSeasons}
    episodesBySeason={viewEpisodesBySeason}
    prevEpisode={viewPrev}
    nextEpisode={viewNext}
    initialProgressSeconds={initialProgressSeconds}
    userId={user?.id ?? null}
  />
)
```

**generateMetadata function** (lines 13–44) — copy unchanged, it does not reference `WatchPageContent`.

---

### `src/components/watch/watch-shell.tsx` (component/client, event-driven)

**Analog:** `src/components/watch/watch-page-content.tsx`

**Props interface pattern** (`src/components/watch/watch-page-content.tsx` lines 18–28) — copy exactly:
```tsx
interface WatchShellProps {
  episode: ViewEpisode
  show: ViewShow
  season: ViewSeason
  seasons: ViewSeason[]
  episodesBySeason: Record<string, ViewEpisode[]>
  prevEpisode: ViewEpisode | null
  nextEpisode: ViewEpisode | null
  initialProgressSeconds?: number
  userId?: string | null
}
```

**Imports pattern** (`src/components/watch/watch-page-content.tsx` lines 1–16) — base on these, swap what changes:
```tsx
'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { AutoplayOverlay } from '@/components/watch/autoplay-overlay'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'
```

**State + hook initialization pattern** (`src/components/watch/watch-page-content.tsx` lines 41–49):
```tsx
// Copy these state declarations (WatchShell needs all of them):
const [activeSeasonId, setActiveSeasonId] = useState(season.id)
const currentEpisodes = episodesBySeason[activeSeasonId] ?? []
const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
const [showAutoplay, setShowAutoplay] = useState(false)
const router = useRouter()
const locale = useLocale()

// Add these for WatchShell episode-switch:
const [currentEpisode, setCurrentEpisode] = useState(episode)
const playerRef = useRef<YT.Player | null>(null)

// Hook: use currentEpisode.id (not episode.id) — survives episode switches
const { forceFlush } = useProgressTracker(playerInstance, currentEpisode.id, userId ?? null)
```

**YouTubePlayer integration pattern** (`src/components/watch/watch-page-content.tsx` lines 91–107):
```tsx
// In WatchPageContent, YouTubePlayer sits inside an aspect-video div.
// In WatchShell, wrap it in absolute inset-0 instead — fills the fullscreen shell.
// CRITICAL: Pass episode.youtubeId (the INITIAL value), never currentEpisode.youtubeId.
// Episode switching is done via playerRef.current.loadVideoById(), not prop updates.
<YouTubePlayer
  videoId={episode.youtubeId ?? ''}   // INITIAL only — prop never changes after mount
  brandColor={BRAND_COLOR_BG[show.brandColor]}
  onReady={(player) => {
    playerRef.current = player          // ADD: store in ref for loadVideoById calls
    setPlayerInstance(player)
    if (initialProgressSeconds && initialProgressSeconds > 0) {
      player.seekTo(initialProgressSeconds, true)
    }
  }}
  onStateChange={(state) => {
    if (state === 0) {
      forceFlush()
      if (currentEpisode.id && nextEpisode) setShowAutoplay(true)
    }
    if (state === 2) forceFlush()
  }}
/>
```

**Episode switch handler — new in WatchShell** (from RESEARCH.md Pattern 3):
```tsx
// Episode switch: forceFlush → setState → loadVideoById → replaceState
// Order matters: forceFlush BEFORE setState to avoid stale-closure write on old episodeId
function handleEpisodeSwitch(newEpisode: ViewEpisode) {
  if (!playerRef.current || !newEpisode.youtubeId) return
  forceFlush()                                          // 1. save outgoing position
  setCurrentEpisode(newEpisode)                         // 2. hook picks up new episodeId on next tick
  playerRef.current.loadVideoById({                     // 3. swap video (no iframe remount)
    videoId: newEpisode.youtubeId,
    startSeconds: 0,
  })
  window.history.replaceState(                          // 4. sync URL, no Next.js re-render
    null,
    '',
    `/${locale}/watch/${newEpisode.id}`
  )
}
```

**Fullscreen shell div pattern** (from RESEARCH.md Patterns 2 + 6):
```tsx
// Replace WatchPageContent's <div className="min-h-screen bg-[var(--bg-0)] text-white">
// with the fullscreen shell:
<div
  className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
  data-lenis-prevent
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
  {/* Player fills full shell — wrap in absolute inset-0 container */}
  <div className="absolute inset-0">
    <YouTubePlayer ... />
  </div>

  {/* Back link — Phase 32 placeholder; must be z-10 to sit above iframe */}
  <div className="absolute top-4 left-4 z-10">
    <Link
      href={`/series/${show.slug}`}
      className="text-white/50 hover:text-white text-sm transition-opacity"
      aria-label="Back to show"
    >
      ← Back
    </Link>
  </div>

  {/* AutoplayOverlay: sibling of iframe, not child — cross-origin pointer event boundary */}
  {showAutoplay && nextEpisode && (
    <AutoplayOverlay ... />
  )}
</div>
```

**AutoplayOverlay wiring pattern** (`src/components/watch/watch-page-content.tsx` lines 108–121):
```tsx
// Copy from WatchPageContent, update onPlayNow to call handleEpisodeSwitch:
{showAutoplay && nextEpisode && (
  <AutoplayOverlay
    nextEpisode={{
      id: nextEpisode.id,
      title: nextEpisode.title,
      seasonNumber: seasons.find(s => s.id === nextEpisode.seasonId)?.seasonNumber ?? 1,
      episodeNumber: nextEpisode.episodeNumber,
    }}
    onPlayNow={() => {
      setShowAutoplay(false)
      handleEpisodeSwitch(nextEpisode)   // use handleEpisodeSwitch, not router.push
    }}
    onCancel={() => setShowAutoplay(false)}
  />
)}
```

---

## Shared Patterns

### Async params (Next.js 16)
**Source:** `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` lines 9–11
**Apply to:** new `(watch)/watch/[episodeId]/page.tsx`
```tsx
interface Props {
  params: Promise<{ episodeId: string }>
}
// Usage:
const { episodeId } = await params
```

### Supabase session read (viewer pattern)
**Source:** `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` lines 52–54
**Apply to:** new `page.tsx` — copy unchanged
```tsx
// proxy.ts already validated the JWT — getSession() reads cookie locally (~5ms)
const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user ?? null
```

### useLocale for locale-prefixed replaceState
**Source:** `src/components/watch/watch-page-content.tsx` line 6 + RESEARCH.md Pattern 5
**Apply to:** `watch-shell.tsx`
```tsx
import { useLocale } from 'next-intl'
const locale = useLocale()  // returns 'en' | 'ar'
// localePrefix: 'always' → must construct full path:
`/${locale}/watch/${newEpisode.id}`
```

### useProgressTracker hook signature
**Source:** `src/hooks/use-progress-tracker.ts` lines 6–10, 52–53
**Apply to:** `watch-shell.tsx`
```ts
// Signature:
useProgressTracker(
  player: YT.Player | null,
  episodeId: string,         // must be currentEpisode.id, not initial episode.id
  userId: string | null
) → { flush, forceFlush }

// forceFlush bypasses 10s delta check — call before loadVideoById
const forceFlush = useCallback(() => save({ force: true }), [save])
```

---

## Critical Pitfall Summary (for planner)

| Pitfall | Guard |
|---------|-------|
| `(watch)/layout.tsx` emitting `<html>`/`<body>` | It's a segment layout, not root — div wrapper only |
| Passing `currentEpisode.youtubeId` as `videoId` prop to `YouTubePlayer` | Pass `episode.youtubeId` (initial) only; switches via `playerRef.current.loadVideoById()` |
| Calling `router.push` for episode switches | Use `window.history.replaceState` — no server round-trip |
| `useProgressTracker` called with `episode.id` (initial) instead of `currentEpisode.id` | Use `currentEpisode.id` from state so hook tracks the active episode after switches |
| `forceFlush` called after `setCurrentEpisode` | Must call `forceFlush()` BEFORE `setCurrentEpisode` to write to outgoing episode's row |
| `100vh` on iOS Safari | Use `h-dvh min-h-svh` — dynamic + small viewport pair |
| Interactive UI inside the YouTube iframe subtree | Back link and AutoplayOverlay must be siblings of the player container, not children of it |

---

## No Analog Found

All three new files have direct analogs in the codebase. No files require falling back to RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `src/app/[locale]/`, `src/components/watch/`, `src/hooks/`
**Files read:** 6 (viewer layout, locale layout, watch page, watch-page-content, youtube-player, use-progress-tracker)
**Pattern extraction date:** 2026-05-05
