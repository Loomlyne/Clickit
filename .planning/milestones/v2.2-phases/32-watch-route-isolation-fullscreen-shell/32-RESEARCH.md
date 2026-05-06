# Phase 32: Watch Route Isolation & Fullscreen Shell — Research

**Researched:** 2026-05-05
**Domain:** Next.js App Router route groups, YouTube IFrame API, iOS Safari viewport units, Lenis exclusion, next-intl locale routing
**Confidence:** HIGH

---

## Summary

Phase 32 moves the watch route from `[locale]/(viewer)/watch/[episodeId]` into a new `[locale]/(watch)/watch/[episodeId]` route group so it escapes the viewer layout entirely. The `(viewer)/layout.tsx` wraps every viewer page in `SmoothScroll` (Lenis), `ViewerSilkBackground`, `MarqueeTicker`, `Navbar`, and `Footer` — route group escape is the cleanest way to exclude all of them with zero conditional logic.

The fullscreen shell is a single `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black` div. `100vh` is wrong on iOS Safari because it ignores the dynamic browser toolbar; `h-dvh` (dynamic viewport height) + `min-h-svh` (small viewport height as floor) is the correct pair. Episode switching uses `player.loadVideoById({ videoId, startSeconds: 0 })` — the iframe DOM node is never rekeyed, preserving the progress writer interval, iOS autoplay policy, and eliminating the 500KB iframe reload. The `useProgressTracker` hook is reused as-is; `forceFlush()` is called immediately before `loadVideoById()` to save the outgoing episode's position.

The critical i18n concern for `window.history.replaceState` is that this project uses `localePrefix: 'always'`, so every watch URL is `/en/watch/[id]` or `/ar/watch/[id]`. The locale value is read via `useLocale()` (already imported in the current `WatchPageContent`) and prepended manually when constructing the path for `replaceState`.

**Primary recommendation:** Create `src/app/[locale]/(watch)/layout.tsx` as a minimal server component (black bg, `h-dvh overflow-hidden`, no providers), move `page.tsx` verbatim, and write a new `WatchShell` client component that owns `currentEpisode` state, calls `loadVideoById` on switches, and delegates progress tracking to the existing `useProgressTracker` hook unchanged.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Component Architecture**
- Replace `WatchPageContent` entirely with a new `WatchShell` component; old `WatchPageContent` deleted
- Current-episode state (`currentEpisode` + `currentVideoId`) lives inside `WatchShell` via `useState`
- `page.tsx` strips the `-mt-16` hack and renders `<WatchShell>` directly with all data (episode, show, season, seasons, episodesBySeason, prev, next, initialProgressSeconds, userId)
- `YouTubePlayer` renders at the top of the fullscreen div; iframe fills the entire shell; player ref bubbled up via `onReady` callback

**Interim Phase 32 UX**
- A single minimal back `<Link>` anchored top-left — small, low-opacity — so Phase 32 is testable without being stuck; Phase 33 will style and animate it into the full chrome layer
- Keep existing `YouTubePlayer` poster/spinner loading state — no changes to the loading UX
- Missing `youtube_video_id` fallback: redirect to `router.back()` or the series page — do not render a broken player
- Mobile safe area: `padding-bottom: env(safe-area-inset-bottom)` on the shell wrapper to avoid home indicator overlap

**Episode Switching Mechanics**
- URL sync: `window.history.replaceState(null, '', localePath)` — no Next.js re-render, URL stays accurate
- Progress flush: call `forceFlush()` first, then immediately call `loadVideoById(newVideoId)` — saves last position before new video starts
- Resume position on switch: always start at 0 — switching is intentional navigation (resume only applies on page load/refresh)
- Player state during switch: let `loadVideoById()` auto-play; no manual pause before switch

### Claude's Discretion
- Layout.tsx for `(watch)` route group: minimal — just `<html>` structure compatible with `[locale]/layout.tsx`, black bg, no providers
- Lenis exclusion is automatic via route group escape (no `SmoothScroll` provider in `(watch)` layout)
- `data-lenis-prevent` belt-and-suspenders on the watch shell div as defensive measure
- `useProgressTracker` hook reused as-is; `forceFlush` called on episode switch before `loadVideoById`

### Deferred Ideas (OUT OF SCOPE)
- Chrome auto-hide (opacity transitions, idle timer) → Phase 33
- Edge prev/next arrows → Phase 33
- Episode tray (Vaul bottom sheet) → Phase 34
- Ambient glow, PiP, Theater Mode → v2.3
- Swipe-left/right for episode navigation — explicitly excluded (iOS swipe-back collision)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WATCH-01 | Watch route lives in its own route group `(watch)/` — no Navbar, Footer, Silk, MarqueeTicker | Route group escape: `[locale]/(watch)/layout.tsx` with no SmoothScroll/Navbar/Footer/Silk providers |
| WATCH-02 | Video fills 100dvw × 100dvh on load — zero layout chrome visible on entry | `fixed inset-0` shell + `YouTubePlayer` with `absolute inset-0 w-full h-full` fills viewport |
| WATCH-03 | `h-dvh` + `min-h-svh` CSS units used (not `100vh`) to prevent iOS Safari toolbar clipping | Verified: `h-dvh` tracks the dynamic toolbar; `min-h-svh` provides a stable floor |
| WATCH-04 | YouTube `controls=1` — native controls preserved; no custom overlay | `YouTubePlayer` already sets `controls: 1` in `playerVars`; no changes needed |
| WATCH-05 | Episode switches use `player.loadVideoById()` — iframe never remounted; progress tracking stays live | `loadVideoById({ videoId, startSeconds: 0 })` is the official API; does NOT re-fire `onReady`; interval cleared before, restarted after |
| WATCH-06 | Continue-watching 10s progress writes work in the fullscreen layout | `useProgressTracker` is hook-based; reused as-is; `forceFlush()` before switch clears the outgoing episode |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route isolation (no chrome) | Frontend Server (SSR) | — | `(watch)/layout.tsx` is a server component that simply renders children with black bg; providers live in `(viewer)/layout.tsx` which is not reached |
| Fullscreen shell CSS | Browser / Client | — | `fixed inset-0 h-dvh min-h-svh` — purely CSS, no JS; the `WatchShell` client component owns it |
| YouTube player lifecycle | Browser / Client | — | YT IFrame API runs in browser; `loadVideoById` is a browser API call; `YouTubePlayer` component manages the singleton loader |
| Episode state (`currentEpisode`) | Browser / Client | — | `useState` inside `WatchShell`; no server involvement after initial page load |
| Progress tracking | Browser / Client | Database / Storage | `useProgressTracker` writes to Supabase `watch_progress` table every 10s; client hook, DB upsert |
| Initial data fetch | Frontend Server (SSR) | Database / Storage | `page.tsx` server component fetches episode + progress in parallel via `getEpisodeById` + `getEpisodeProgress` |
| URL sync on episode switch | Browser / Client | — | `window.history.replaceState` — no server round-trip; locale prefix constructed client-side |
| iOS safe area | Browser / Client | — | `padding-bottom: env(safe-area-inset-bottom)` — CSS environment variable, client-only |

---

## Standard Stack

All libraries already installed. Zero new dependencies.

### Core
| Library | Installed Version | Purpose | Source |
|---------|------------------|---------|--------|
| Next.js | 16.2.1 | App Router, route groups, layout hierarchy | `package.json` |
| React | 19.2.4 | `useState`, client components | `package.json` |
| next-intl | ^4.9.1 | `useLocale()` for locale-prefixed `replaceState` path | `package.json` |
| Lenis | ^1.3.23 | Smooth scroll — excluded by route group escape; no code changes | `package.json` |
| motion | ^12.38.0 | Available for Phase 33 chrome; not used in Phase 32 | `package.json` |

### Existing Watch Components (reused, not replaced)
| Component/Hook | File | Status |
|----------------|------|--------|
| `YouTubePlayer` | `src/components/watch/youtube-player.tsx` | Reused as-is |
| `useProgressTracker` | `src/hooks/use-progress-tracker.ts` | Reused as-is |
| `AutoplayOverlay` | `src/components/watch/autoplay-overlay.tsx` | Keep; may need minor wiring adjustment |

### No Installation Step
Stack additions: zero.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request: /en/watch/abc123
        │
        ▼
[locale]/layout.tsx       ← sets html lang/dir, NextIntlClientProvider, Toaster, Analytics
        │
        ▼
[locale]/(watch)/layout.tsx   ← NEW: bare layout, black bg, h-dvh overflow-hidden, NO providers
        │
        ▼
[locale]/(watch)/watch/[episodeId]/page.tsx   ← Server Component: fetches episode+progress+locale
        │  (passes props down)
        ▼
WatchShell (client)   ← useState(currentEpisode), useState(playerInstance)
  ├── fixed inset-0 shell div
  ├── YouTubePlayer (existing, no changes)  ← onReady → setPlayerInstance
  ├── useProgressTracker(playerInstance, episode.id, userId)
  ├── back <Link> (minimal, top-left, low-opacity)
  └── episode switch handler:
        forceFlush() → loadVideoById({ videoId, startSeconds: 0 })
        → window.history.replaceState(null, '', `/${locale}/watch/${newEpisodeId}`)
```

### Recommended Project Structure

```
src/app/[locale]/
├── (viewer)/
│   ├── layout.tsx          # UNCHANGED — Navbar/Footer/Silk/Lenis/MarqueeTicker
│   └── watch/              # DELETE this entire directory after migration
│       └── [episodeId]/
│           └── page.tsx
├── (watch)/                # NEW route group
│   ├── layout.tsx          # NEW — bare, black bg, h-dvh overflow-hidden
│   └── watch/
│       └── [episodeId]/
│           └── page.tsx    # MOVED from (viewer)/watch/[episodeId]/page.tsx
└── layout.tsx              # UNCHANGED — [locale] root layout

src/components/watch/
├── watch-shell.tsx         # NEW — replaces WatchPageContent
├── youtube-player.tsx      # UNCHANGED
├── autoplay-overlay.tsx    # UNCHANGED (minor wiring if needed)
├── episode-nav.tsx         # UNCHANGED (available if WatchShell references it)
└── watch-page-content.tsx  # DELETE after WatchShell confirmed working
```

### Pattern 1: Route Group Layout Escape

**What:** A sibling route group `(watch)/` under `[locale]/` renders its own `layout.tsx`, which is independent of `(viewer)/layout.tsx`. The URL path is unaffected by the group name.

**When to use:** Any time a subset of routes under the same URL segment needs different layout chrome (different providers, different wrapping, no providers at all).

**Key constraint verified:** [VERIFIED: Context7/next.js] Route groups that share the same parent layout segment do NOT trigger a full page reload when navigating between them — only navigating between routes with *different root layouts* (multiple `layout.tsx` at the root level) triggers a full reload. In this project, both `(viewer)` and `(watch)` live under `[locale]/layout.tsx` — the locale root layout is shared, so there is no full-page reload on navigation from `/en/series/foo` → `/en/watch/bar`.

```tsx
// src/app/[locale]/(watch)/layout.tsx
// Source: Next.js App Router route groups docs

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh min-h-svh overflow-hidden bg-black">
      {children}
    </div>
  )
}
```

**Note:** The `[locale]/layout.tsx` already wraps with `<html>` and `<body>` + `NextIntlClientProvider`. The `(watch)/layout.tsx` must NOT re-emit `<html>`/`<body>` — it only provides a div wrapper or `<>` fragment. [VERIFIED: codebase read — `[locale]/layout.tsx` renders `<html>` and `<body>`]

### Pattern 2: iOS Safari Viewport Height

**What:** `100vh` on iOS Safari is computed from the *maximum* viewport (toolbar hidden), so content gets clipped when the toolbar is visible. `h-dvh` uses the *dynamic* viewport height (adjusts as toolbar shows/hides). `min-h-svh` uses the *small* viewport height (toolbar always visible) as a floor to prevent collapse.

**When to use:** Any full-bleed layout that must reach the bottom of the visible screen on mobile. Essential for fullscreen video players.

**CSS pair:**
```css
/* Tailwind classes — use both */
h-dvh          /* height: 100dvh — dynamic, tracks toolbar */
min-h-svh      /* min-height: 100svh — stable floor */
overflow-hidden /* prevents iOS rubber-band scroll on the shell */
```

**Safe area:** `env(safe-area-inset-bottom)` via inline style or Tailwind `pb-safe` provides clearance for the iOS home indicator on notched devices. Apply to the shell wrapper, not the iframe. [ASSUMED — based on CSS spec knowledge; widely documented behavior]

```tsx
// Shell div pattern
<div
  className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
  data-lenis-prevent
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
```

### Pattern 3: YouTube IFrame API — `loadVideoById` for Episode Switches

**What:** `loadVideoById` loads and immediately begins playback of a new video on the existing player instance. The iframe DOM node is never replaced — the YT player object stays alive.

**Verified API signature:** [VERIFIED: Context7/developers.google.youtube]

```javascript
// Object syntax (preferred — supports endSeconds)
player.loadVideoById({
  videoId: 'newVideoId',
  startSeconds: 0,     // always 0 on explicit episode switch (per CONTEXT.md decision)
})

// Positional syntax (also valid, no endSeconds)
player.loadVideoById('newVideoId', 0)
```

**Critical behavior facts:** [VERIFIED: Context7/developers.google.youtube]
- `loadVideoById` does NOT re-fire `onReady`. The player is already initialized; `onReady` only fires once on initial `new YT.Player(...)` construction.
- `loadVideoById` immediately begins buffering and playback. `onStateChange` fires with state `3` (buffering) then `1` (playing) as the new video loads.
- `onStateChange` state values: `-1` unstarted, `0` ended, `1` playing, `2` paused, `3` buffering, `5` cued.
- When switching episodes, `setIsReady(true)` in `YouTubePlayer` never flips back to `false` — the loading overlay will not reappear. This is correct behavior for `loadVideoById`.

**Progress writer race fix:** [VERIFIED: memory/feedback_fullscreen_watch_arch_patterns.md]

The `useProgressTracker` hook manages its interval via `useEffect([player, userId, flush])`. Because `player` reference does not change across episode switches (same instance), the interval does NOT auto-reset. The race condition: the old episode's interval writes the new episode's timestamp to the old `episodeId`. Fix:

```tsx
// In WatchShell episode switch handler:
function handleEpisodeSwitch(newEpisode: ViewEpisode) {
  if (!playerRef.current || !newEpisode.youtubeId) return

  // 1. Flush last position of outgoing episode FIRST
  forceFlush()

  // 2. Update state — this causes useProgressTracker to pick up new episodeId
  //    on its next save because episodeId is a prop that flows through useState
  setCurrentEpisode(newEpisode)

  // 3. Load new video (auto-plays)
  playerRef.current.loadVideoById({ videoId: newEpisode.youtubeId, startSeconds: 0 })

  // 4. Sync URL without re-render
  const localePath = `/${locale}/watch/${newEpisode.id}`
  window.history.replaceState(null, '', localePath)
}
```

**Key insight on episodeId prop:** `useProgressTracker(playerInstance, episode.id, userId)` takes `episodeId` as a parameter. In `WatchShell`, the current episode ID must be derived from `currentEpisode` state (not the initial prop) so that after a switch the hook writes to the new episode's row. This means `useProgressTracker` is called with `currentEpisode.id`, not `episode.id` (the initial prop).

### Pattern 4: `useProgressTracker` Reuse in WatchShell

**Current hook signature:**
```ts
useProgressTracker(
  player: YT.Player | null,
  episodeId: string,
  userId: string | null
) → { flush, forceFlush }
```

**Hook behavior relevant to episode switching:**
- Interval: `setInterval(flush, 10_000)` — runs as long as `player` and `userId` are non-null
- `flush` is `save()` — checks 10s delta, skips if too soon
- `forceFlush` is `save({ force: true })` — bypasses delta check, always writes

**Hook does NOT need changes.** The `episodeId` it receives is reactive — when `WatchShell` updates `currentEpisode` state after a switch, React re-renders and the hook's `save` callback (stabilized by `useCallback([player, episodeId, userId, supabase])`) picks up the new `episodeId`. The interval references the `flush` callback which closes over the current `episodeId`. [VERIFIED: codebase read of `use-progress-tracker.ts`]

**One nuance:** The `save` callback is memoized with `useCallback` over `[player, episodeId, userId, supabase]`. When `episodeId` changes (via `setCurrentEpisode`), React rebuilds `save` → `flush` → the `setInterval` in the `useEffect([player, userId, flush])` dependency array re-runs, clearing the old interval and starting a fresh one. This is correct — no stale closure risk.

### Pattern 5: `window.history.replaceState` with next-intl Locale Prefix

**Context:** `localePrefix: 'always'` in `routing.ts` means every URL is `/en/watch/[id]` or `/ar/watch/[id]`. There is no bare `/watch/[id]` URL.

**Getting the locale in a client component:**

```tsx
import { useLocale } from 'next-intl'

const locale = useLocale()  // returns 'en' or 'ar'

// Construct the locale-prefixed path
const localePath = `/${locale}/watch/${newEpisode.id}`
window.history.replaceState(null, '', localePath)
```

`useLocale()` is already used in the current `WatchPageContent` and works inside client components wrapped by `NextIntlClientProvider` (which lives in `[locale]/layout.tsx` — shared by both route groups). [VERIFIED: codebase read of `watch-page-content.tsx`, `[locale]/layout.tsx`, `navigation.ts`]

**Why not use `router.replace()`:** `router.replace('/watch/${id}')` from `@/i18n/navigation` would trigger a full Next.js navigation (server component re-fetch, loading states). `window.history.replaceState` is intentional — episode switches are client-side state changes, not page navigations. [VERIFIED: CONTEXT.md decision]

### Pattern 6: `fixed inset-0` vs `absolute` for the Shell

**Use `fixed inset-0`.** Rationale:

- `fixed` positions relative to the viewport — unaffected by any ancestor scroll position or transform. Since the `(watch)/layout.tsx` has no scroll context (no Lenis, no `overflow-auto` parent), either would work, but `fixed` is defensive.
- `absolute` would require the parent `<body>` or layout div to be `position: relative` and have explicit height — fragile if any ancestor changes.
- `fixed inset-0` + `h-dvh min-h-svh` is the established pattern from STATE.md and the memory feedback file. [VERIFIED: memory/feedback_fullscreen_watch_arch_patterns.md]

**z-index:** The `fixed` shell sits in the stacking context of the `(watch)/layout.tsx`. Since no Silk (z-1), no Navbar (z-20), no Lenis exist in this route group, there is no z-index conflict. The shell can stay at default z-index (auto). The back link inside the shell needs `relative` positioning or an explicit z-index only if it's layered over the player — use `z-10` for the back link div so it sits above the iframe.

**YouTube iframe cross-origin pointer events:** [VERIFIED: memory/feedback_fullscreen_watch_arch_patterns.md] The YouTube iframe is a cross-origin boundary — it captures all pointer events. To place interactive UI (back button, future chrome) over the player, the UI elements must be siblings of the iframe container at the same level, not children of the iframe. Use thin overlay strips positioned absolutely inside the shell (not on the iframe). The back link in Phase 32 should be absolutely positioned inside the shell div, above the player via z-index.

### Anti-Patterns to Avoid

- **`100vh` for mobile full-bleed:** Clips behind iOS Safari toolbar. Use `h-dvh min-h-svh`.
- **Rekeying `YouTubePlayer` on episode switch:** Changing the `key` prop or unmounting/remounting `YouTubePlayer` destroys the YT.Player instance, resets iOS autoplay policy, re-downloads ~500KB, and breaks the progress interval. Use `loadVideoById()` instead.
- **Calling `router.push('/watch/${id}')` for episode switches:** Triggers a full server round-trip. Use `window.history.replaceState` — the URL updates, the player keeps playing.
- **Nesting `(watch)/layout.tsx` inside `(viewer)/layout.tsx`:** Cannot be done — they are sibling route groups. The escape works only because `(watch)/` is a sibling, not a child.
- **Emitting `<html>`/`<body>` in `(watch)/layout.tsx`:** The locale root layout already emits these. The `(watch)/layout.tsx` is an intermediate layout — no `<html>` or `<body>` tags.
- **Wrapping the iframe div with `pointer-events: none`:** Kills YouTube native controls. Only put `pointer-events: none` on overlay elements when chrome is hidden (Phase 33 concern, not Phase 32).
- **Putting `data-lenis-prevent` only and skipping the route group escape:** Route group escape is the primary exclusion. `data-lenis-prevent` is belt-and-suspenders for any edge case where Lenis somehow persists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Episode state on switch | Custom event bus, context provider, Redux slice | `useState` inside `WatchShell` | Simple — two values (`currentEpisode`, `playerInstance`); no cross-component sharing needed in Phase 32 |
| Progress interval management | Custom debounce/throttle | `useProgressTracker` as-is | Already handles 10s delta, force flush, visibility, unmount flush, single Supabase client |
| iOS viewport height | JS-calculated `window.innerHeight` updates | `h-dvh min-h-svh` CSS | Browser-native; no JS resize handlers; no layout thrashing |
| Locale prefix in URL | Manually parsing `window.location.pathname` | `useLocale()` from next-intl | Returns the active locale from the nearest `NextIntlClientProvider` context |
| YouTube API singleton | Multiple script tags | Existing `loadYouTubeAPI()` singleton in `youtube-player.tsx` | Already handles the race between concurrent component mounts |

**Key insight:** The existing `useProgressTracker` hook is precisely designed for the episode-switch scenario (`forceFlush` exists for this purpose). The existing `YouTubePlayer` already sets `controls: 1`, `playsinline: 1`, `enablejsapi: 1` — all required for iOS IFrame API compliance.

---

## Common Pitfalls

### Pitfall 1: `(watch)/layout.tsx` Accidentally Emitting `<html>`/`<body>`

**What goes wrong:** If `(watch)/layout.tsx` emits `<html lang={locale}>`, Next.js will error or hydrate incorrectly because the locale root `[locale]/layout.tsx` already emits `<html>`. Two `<html>` tags = malformed document.

**Why it happens:** Copying the pattern from `[locale]/layout.tsx` (which is a root layout) into an intermediate group layout.

**How to avoid:** `(watch)/layout.tsx` is a *segment layout*, not a root layout. It receives `children` and wraps them in a div or fragment only.

**Warning signs:** TypeScript errors about duplicate HTML elements; Next.js build warning about multiple root layouts.

### Pitfall 2: `useProgressTracker` Writing to Old Episode After Switch

**What goes wrong:** After calling `setCurrentEpisode(newEpisode)`, if the render hasn't flushed yet, a 10s interval tick fires and writes `currentTime` to the *old* `episodeId`.

**Why it happens:** React `setState` is async — the old `flush` callback (with old `episodeId` in its closure) may still be scheduled via the interval before the re-render rebuilds `flush`.

**How to avoid:** Call `forceFlush()` synchronously *before* `setCurrentEpisode` and `loadVideoById`. This ensures the outgoing episode's final position is saved with the correct ID. The interval will briefly use the stale ID but will have just fired; the next tick fires after React rebuilds `flush` with the new ID. The minimum interval is 10s — the re-render happens in milliseconds.

**Warning signs:** Continue-watching progress shows the previous episode's position on the newly switched episode.

### Pitfall 3: `loadVideoById` Triggering `setIsReady(false)` in `YouTubePlayer`

**What goes wrong:** If someone modifies `YouTubePlayer` to reset `isReady` to `false` on a new `videoId` prop (to show the loading overlay), the overlay covers the player during the `loadVideoById` load. This is a regression — `loadVideoById` is a seamless swap, not an iframe reload.

**Why it happens:** The current `YouTubePlayer` has `useEffect([videoId])` which calls `playerRef.current?.destroy()` and creates a new `YT.Player` on every `videoId` change. This means **if `videoId` prop is passed to `YouTubePlayer` as a prop and changes, it will destroy and recreate the player** — exactly the anti-pattern to avoid.

**Critical finding:** The current `YouTubePlayer` component remounts the player on `videoId` prop change (the `useEffect` dep array is `[videoId]`). For `WatchShell`, the `YouTubePlayer` must be rendered with the **initial** `videoId` only and must NOT receive the updated `videoId` as a prop on episode switch. Episode switching is driven by `playerRef.current.loadVideoById(...)` called externally — `YouTubePlayer` stays rendered with the original `videoId` prop. `WatchShell` bubbles the player instance up via `onReady`, then holds it in a ref and calls `loadVideoById` directly. [VERIFIED: codebase read of `youtube-player.tsx` — `useEffect([videoId])` destroys and recreates on prop change]

**How to avoid:** `WatchShell` holds `playerRef` (bubbled from `YouTubePlayer.onReady`). On episode switch, call `playerRef.current.loadVideoById(...)` directly. Do NOT update the `videoId` prop passed to `YouTubePlayer`.

**Warning signs:** Black flash between episodes; `onReady` firing a second time; loading overlay reappearing on switch.

### Pitfall 4: `(watch)/layout.tsx` Middleware / Routing Gaps

**What goes wrong:** The `proxy.ts` coming-soon gate strips locale and checks `COMING_SOON_ALLOWLIST`. `/watch` is not on the allowlist, so when coming-soon mode is active, `/en/watch/[id]` will be redirected to `/en/coming-soon`.

**Why it happens:** This is the existing behavior and is intentional — if the platform is in coming-soon mode, the watch page should also be gated.

**How to avoid:** No action needed. The behavior is correct and unchanged from the current `(viewer)/watch/` route.

**Warning signs:** This would only surface if someone expected watch to bypass coming-soon mode, which is not a requirement.

### Pitfall 5: iOS `playsinline` Requirements

**What goes wrong:** On iOS, the IFrame API state machine breaks if `playsinline` is not set in all three places. Missing any one causes the player to fullscreen on play, break state events, or prevent API control.

**How to avoid:** [VERIFIED: memory/feedback_fullscreen_watch_arch_patterns.md] The existing `YouTubePlayer` already sets `playerVars.playsinline: 1`. The iframe itself needs `playsInline` + `allow` attribute. These are set by the YT API when it constructs the iframe — `enablejsapi: 1` and `origin` are already in `playerVars`. No changes needed to `YouTubePlayer`.

---

## Code Examples

### `(watch)/layout.tsx` — Bare Layout

```tsx
// src/app/[locale]/(watch)/layout.tsx
// Source: codebase analysis + Next.js route groups docs

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // No SmoothScroll, no Navbar, no Footer, no Silk, no MarqueeTicker.
  // [locale]/layout.tsx (root) still provides: html, body, NextIntlClientProvider,
  // Toaster, Analytics. We only need to wrap content in a fullscreen black container.
  return (
    <div className="h-dvh min-h-svh overflow-hidden bg-black">
      {children}
    </div>
  )
}
```

### `WatchShell` — Episode Switch Core

```tsx
// src/components/watch/watch-shell.tsx (sketch — planner refines)
'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { YouTubePlayer } from '@/components/watch/youtube-player'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import type { ViewEpisode, ViewShow, ViewSeason } from '@/lib/queries'

// WatchShell renders at the TOP of the fixed shell.
// YouTubePlayer is initialized ONCE with the initial videoId.
// Episode switches call playerRef.current.loadVideoById() directly —
// the videoId prop passed to YouTubePlayer never changes.

export function WatchShell({ episode, show, ... initialProgressSeconds, userId }: Props) {
  const [currentEpisode, setCurrentEpisode] = useState(episode)
  const [playerInstance, setPlayerInstance] = useState<YT.Player | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const locale = useLocale()

  const { forceFlush } = useProgressTracker(playerInstance, currentEpisode.id, userId ?? null)

  function switchEpisode(newEpisode: ViewEpisode) {
    if (!playerRef.current || !newEpisode.youtubeId) return
    forceFlush()                                          // save outgoing position
    setCurrentEpisode(newEpisode)                         // update state → hook picks up new episodeId
    playerRef.current.loadVideoById({                    // swap video, no iframe remount
      videoId: newEpisode.youtubeId,
      startSeconds: 0,
    })
    window.history.replaceState(null, '', `/${locale}/watch/${newEpisode.id}`)
  }

  return (
    <div
      className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
      data-lenis-prevent
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Player fills entire shell */}
      <YouTubePlayer
        videoId={episode.youtubeId ?? ''}    // INITIAL only — never updated
        onReady={(player) => {
          playerRef.current = player
          setPlayerInstance(player)
          if (initialProgressSeconds && initialProgressSeconds > 0) {
            player.seekTo(initialProgressSeconds, true)
          }
        }}
        onStateChange={(state) => {
          if (state === 0) forceFlush()   // ended
          if (state === 2) forceFlush()   // paused
        }}
      />

      {/* Minimal back link — Phase 33 will replace this with full chrome */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href={`/series/${show.slug}`}
          className="text-white/50 hover:text-white text-sm"
          aria-label="Back to show"
        >
          ← Back
        </Link>
      </div>
    </div>
  )
}
```

### `page.tsx` — Server Component (moved, minimal changes)

```tsx
// src/app/[locale]/(watch)/watch/[episodeId]/page.tsx
// Key change: remove `<div className="watch-page-wrap -mt-16">` wrapper
// Replace WatchPageContent with WatchShell

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

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `100vh` for fullscreen | `h-dvh` + `min-h-svh` | No iOS toolbar clipping |
| Remount iframe on episode switch | `loadVideoById()` | No flash, no 500KB re-download, progress survives |
| Lenis scroll on watch page | Route group escape | Zero hijack, native scroll feel |
| `-mt-16` hack to account for sticky nav | Bare `(watch)/` layout with no nav | Clean fullscreen, no offset math |
| Watch inside `(viewer)/` layout | `(watch)/` sibling route group | No Navbar/Footer/Silk/MarqueeTicker rendered |

**Deprecated in this phase:**
- `WatchPageContent` (`src/components/watch/watch-page-content.tsx`) — deleted after `WatchShell` is confirmed working
- `(viewer)/watch/[episodeId]/` directory — deleted after migration

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `env(safe-area-inset-bottom)` provides correct iOS home indicator clearance when applied to the shell wrapper | Pitfall / CSS pattern | Minimal — worst case is home indicator overlapping the very bottom of the player frame; easy to fix |
| A2 | Navigation from `(viewer)` pages to `(watch)` pages does not trigger a full page reload (both under `[locale]/layout.tsx`) | Architecture Patterns | If wrong, watch URL navigations would full-reload; functional but jarring. The Next.js docs confirm this is only a risk with multiple *root* layouts, not group layouts under the same root. |

**All other claims verified against codebase, Context7 (YouTube IFrame API, next-intl, Next.js docs), or project memory files.**

---

## Open Questions

1. **`YouTubePlayer` wrapper CSS in fullscreen context**
   - What we know: Current `YouTubePlayer` has `relative w-full aspect-video min-h-[200px] bg-black` as the outer div. In a fullscreen context, `aspect-video` constrains the player to 16:9 with letterboxing — not edge-to-edge fill.
   - What's unclear: Should `YouTubePlayer` receive a `className` override prop, or should `WatchShell` wrap it in an `absolute inset-0` container?
   - Recommendation: Wrap `YouTubePlayer` in a `<div className="absolute inset-0">` inside `WatchShell`. The player's inner `div` (`absolute inset-0 w-full h-full`) then fills that container. No changes to `YouTubePlayer` component needed.

2. **`AutoplayOverlay` in fullscreen layout**
   - What we know: `AutoplayOverlay` is positioned as an absolute overlay over the player. In the current `WatchPageContent`, it overlays the `aspect-video` div. In `WatchShell`, it needs to overlay the fullscreen shell.
   - What's unclear: Whether `AutoplayOverlay` triggers from within `WatchShell` directly, or is deferred.
   - Recommendation: Phase 32 CONTEXT.md says to keep it; wire it inside `WatchShell` using `useState(showAutoplay)`. It already renders as an absolute overlay — in the fullscreen context it should overlay the entire shell (position it inside the `fixed inset-0` shell div at the same z-level as the back link).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 32 is a pure code migration/refactor with no external tool dependencies beyond the already-installed npm packages. No new CLIs, services, databases, or runtimes required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual smoke test (no automated unit tests for this phase — UI/browser interaction) |
| Config file | N/A |
| Quick run command | `npm run dev` → load `/en/watch/[episodeId]` |
| Full suite command | Visual QA on iOS Safari + Chrome |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WATCH-01 | No Navbar/Footer/Silk/MarqueeTicker on `/watch/[id]` | smoke | `npm run dev` → inspect DOM for `.navbar` absence | ❌ Wave 0 — manual |
| WATCH-02 | Video fills 100dvw × 100dvh | smoke | `npm run dev` → DevTools mobile emulation, check iframe dimensions | ❌ Wave 0 — manual |
| WATCH-03 | `h-dvh` + `min-h-svh` present on shell | smoke | `grep -r "h-dvh" src/components/watch/watch-shell.tsx` | ❌ Wave 0 — file doesn't exist yet |
| WATCH-04 | `controls=1` in playerVars | static grep | `grep -n "controls" src/components/watch/youtube-player.tsx` | ✅ — already set |
| WATCH-05 | `loadVideoById` used on switch (no remount) | smoke | Click episode link in sidebar, verify no network request to YouTube iframe URL | ❌ Wave 0 — manual |
| WATCH-06 | Progress writes fire in fullscreen layout | smoke | Pause video after 15s, refresh page, verify resume position | ❌ Wave 0 — manual |

### Sampling Rate
- Per task commit: `grep -r "loadVideoById\|h-dvh\|min-h-svh" src/components/watch/watch-shell.tsx`
- Per wave merge: Visual QA in iOS Safari (dynamic toolbar visible) + Chrome DevTools mobile emulation
- Phase gate: All 6 WATCH requirements pass manual smoke test before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/app/[locale]/(watch)/layout.tsx` — create bare layout
- [ ] `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — move from `(viewer)/`
- [ ] `src/components/watch/watch-shell.tsx` — new component
- [ ] Delete `src/app/[locale]/(viewer)/watch/` directory
- [ ] Delete `src/components/watch/watch-page-content.tsx` (after WatchShell confirmed)

---

## Security Domain

Phase 32 is a layout migration — no new authentication surfaces, no new data inputs, no new API endpoints. Existing security controls are unchanged:

- Auth: `proxy.ts` validates JWT on every request — unaffected by route group change
- Data: `page.tsx` continues to call `getEpisodeById` and `getEpisodeProgress` via existing Supabase queries with RLS
- Input: No new user inputs introduced
- `window.history.replaceState` path: constructed from `useLocale()` + `newEpisode.id` (a UUID from the DB query result) — no user-controlled string injection

No ASVS categories newly implicated by this phase.

---

## Sources

### Primary (HIGH confidence)
- `/websites/developers_google_youtube` (Context7) — `loadVideoById` signature, `onReady`/`onStateChange` event behavior
- `/amannn/next-intl` (Context7) — `useLocale()` usage in client components
- `/vercel/next.js` (Context7) — route groups, layout hierarchy, segment layout vs root layout
- `src/components/watch/youtube-player.tsx` (codebase) — existing `useEffect([videoId])` behavior, `playerVars`
- `src/hooks/use-progress-tracker.ts` (codebase) — interval management, `forceFlush`, `useCallback` deps
- `src/app/[locale]/(viewer)/layout.tsx` (codebase) — confirmed Silk, Lenis, Navbar, Footer, MarqueeTicker providers
- `src/app/[locale]/layout.tsx` (codebase) — confirmed `NextIntlClientProvider` is in root layout, shared by both route groups
- `src/i18n/routing.ts` (codebase) — confirmed `localePrefix: 'always'`
- `memory/feedback_fullscreen_watch_arch_patterns.md` — 7 patterns: route group escape, h-dvh, loadVideoById, edge strips, data-lenis-prevent, progress race, playsinline×3
- `package.json` (codebase) — confirmed installed versions

### Secondary (MEDIUM confidence)
- `memory/project_v2_2_immersive_watch_2026_05_05.md` — v2.2 architecture decisions confirming zero new libraries

---

## Metadata

**Confidence breakdown:**
- Route group isolation: HIGH — verified against Next.js docs and existing codebase patterns (`(viewer)/`, `admin/`)
- iOS viewport height: HIGH — `h-dvh`/`min-h-svh` CSS units are well-documented; confirmed in memory feedback file
- YouTube IFrame API `loadVideoById`: HIGH — verified via Context7 against official Google developers docs
- Progress tracker reuse: HIGH — verified by reading the hook source; `useCallback` deps confirmed correct behavior
- `replaceState` locale construction: HIGH — `useLocale()` confirmed in codebase; `localePrefix: 'always'` confirmed in routing config
- `fixed inset-0` vs `absolute`: HIGH — confirmed in STATE.md architecture decisions + memory feedback

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable APIs; YouTube IFrame API is very stable)
