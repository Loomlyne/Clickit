# Phase 33: Auto-Hide Chrome Layer - Research

**Researched:** 2026-05-06
**Domain:** React hooks / CSS transitions / YouTube iframe cross-origin interaction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Idle Timer**
- Custom `useIdleTimer(delay: number)` hook — no external library. `delay = 3000ms`.
- Resets on: `pointermove`, `pointerdown`, `keydown`, `touchstart` events on the document.
- Returns `{ isIdle, resetTimer }` — shell consumes both.
- `onStateChange` state=2 (paused) calls `resetTimer()` to force chrome visible while paused.
- Timer is cleared on unmount via cleanup.

**Top Overlay**
- `fixed top-0 left-0 right-0 z-20` — full-width strip, above player (`z-10`).
- Gradient: `bg-gradient-to-b from-black/70 to-transparent`.
- Padding: `px-4 pt-4 pb-8`.
- Left: back button (`← Back` arrow + show.slug link).
- Center: show title + `S{N} E{N}` badge (from `currentEpisode`).
- Right: watchlist + like + share icon buttons (reuse existing `useWatchlist` / `useLikes` hooks).
- Fade: `transition-opacity duration-200` — `opacity-100` when visible, `opacity-0` when idle.
- `pointer-events: none` when idle; `pointer-events: auto` when visible.

**Edge Arrows (Prev/Next)**
- Two `fixed` buttons: `left-4` (prev) and `right-4` (next), `top-1/2 -translate-y-1/2`.
- Hidden (not rendered) when no prev/next episode exists. Uses `prevEpisode` / `currentNextEpisode`.
- Same fade/pointer-events behavior as top overlay — share `isIdle` state.
- Arrows call `handleEpisodeSwitch` — already in `WatchShell`.
- Size: `size-10 rounded-full bg-black/40 backdrop-blur-sm` with chevron icon from lucide-react.

**Chrome Trigger Boundary**
- Interaction events attach to the `WatchShell` root div (React `onPointerMove`, `onPointerDown`, `onTouchStart`, `onKeyDown`) — NOT on the YouTube iframe.
- On any event: reset idle timer, set chrome visible.

**Component Structure**
- No new component file — overlay JSX added directly inside `WatchShell`.
- New file: `src/hooks/use-idle-timer.ts`.
- Placeholder back link deleted and replaced.

**Paused = Chrome Forced Visible**
- `onStateChange` state=2 → call `resetTimer()` from `useIdleTimer`.
- state=1 (playing) → no forced reset, normal idle timeout resumes.

### Claude's Discretion
- Share button implementation detail (Web Share API vs clipboard copy vs no-op).
- Exact aria-label text on icon buttons.
- Whether the S/E badge sits inline with title or on a second line.
- Touch edge strip strategy (Phase 33 CONTEXT says shell div pointer events are sufficient; thin edge strips are optional).

### Deferred Ideas (OUT OF SCOPE)
- Keyboard shortcut (spacebar to pause, arrow keys to seek).
- Volume control in chrome overlay.
- Subtitle/quality picker in overlay.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHROME-01 | Top overlay (back button, show title, S/E badge, watchlist + like + share) fades in on tap/pointer-move, fades out after 3s idle; uses `pointer-events: none` when hidden so YouTube controls remain tappable | `useIdleTimer` hook + CSS `transition-opacity` + `pointer-events` toggle pattern documented below |
| CHROME-02 | Left/right edge-anchored prev/next episode arrow buttons (positioned at 50% viewport height), fade with chrome, hidden when no prev/next episode exists | Conditional render (`prevEpisode`/`currentNextEpisode` already in state) + same `isIdle` flag as CHROME-01 |
</phase_requirements>

---

## Summary

Phase 33 adds an auto-hiding chrome layer over the fullscreen watch shell built in Phase 32. The work is entirely client-side, contained within one existing component (`WatchShell`) and one new hook (`useIdleTimer`). No new dependencies, no server changes, no new component files.

The core problem is straightforward: a timer resets on user interaction, and two opacity classes (`opacity-0`/`opacity-100`) plus `pointer-events-none` toggle on the chrome elements based on the timer's idle state. The YouTube cross-origin constraint — iframe pointer events don't bubble to the parent — is the only architectural wrinkle, and the decision already accounts for it: events attach to the shell root div, which surrounds the iframe as a sibling, not a child.

The one non-obvious gap uncovered during research: the watch page (`page.tsx`) currently does NOT fetch `initialSaved`/`initialLiked` state for the show. The series page has this pattern (parallel `getShowWatchlistState` + `getShowLikeState` calls). Phase 33 must either add those queries to `page.tsx` (preferred — SSR-correct initial state) or accept `false` defaults (hooks start unchecked, user sees wrong state on first paint). The planner must account for this.

**Primary recommendation:** Two-task phase. Task 1: create `useIdleTimer` hook. Task 2: delete placeholder back link, add full overlay JSX + wire idle timer + wire watchlist/likes (requires `page.tsx` prop additions + `WatchShell` prop expansion).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Idle timer logic | Browser / Client | — | DOM event listeners, setTimeout — runs only in the browser; hook lives in `src/hooks/` |
| Chrome fade (opacity toggle) | Browser / Client | — | CSS classes driven by React state; no server involvement |
| `pointer-events` gating | Browser / Client | — | CSS property toggled via class; must stay off so YouTube iframe receives native clicks |
| Watchlist / likes state | Browser / Client (optimistic) + DB | API / Backend | Hooks manage optimistic state; mutations hit Supabase via client |
| Initial watchlist/likes state | API / Backend (Server Component) | — | `getShowWatchlistState` / `getShowLikeState` called in `page.tsx` server component, passed as props |
| Share action | Browser / Client | — | Web Share API or clipboard — no server |
| Episode prev/next data | API / Backend (Server Component) | — | Already fetched in `page.tsx`, passed as `prevEpisode` / `nextEpisode` props |

---

## Standard Stack

### Core — Already Installed
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (hooks) | 19.x | `useEffect`, `useRef`, `useState`, `useCallback` | Built-in; hook pattern already established by `useProgressTracker` |
| Tailwind CSS | 4.2.x | `transition-opacity duration-200`, `pointer-events-none`, `fixed`, `opacity-0`/`opacity-100` | Zero-runtime, project standard |
| motion | ^12.38.0 | Available but NOT needed for this phase | CSS transitions are sufficient at 200ms; motion would add `'use client'` budget with no benefit here |
| lucide-react | ^1.7.x | `ChevronLeft`, `ChevronRight`, `Heart`, `Bookmark`, `Share2`, `ArrowLeft` | All icons verified present in installed package |

### Supporting — Already Installed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useWatchlist` hook | (internal) | Watchlist toggle state | Right-side action button in overlay |
| `useLikes` hook | (internal) | Like toggle state | Right-side action button in overlay |
| `LikeButton` component | (internal) | Animated like button | Can reuse directly in overlay OR call `useLikes` raw for simpler inline button |
| `WatchlistToggleButton` component | (internal) | Animated watchlist button | Can reuse directly in overlay OR call `useWatchlist` raw |

**Installation:** Zero new packages required.

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction (pointermove / pointerdown / touchstart / keydown)
        │
        ▼
[WatchShell root div — onPointerMove / onPointerDown / onTouchStart / onKeyDown]
        │
        ▼
[useIdleTimer(3000)]
   ├─ resetTimer() called → clears + restarts 3s timeout
   ├─ isIdle = false → chrome visible (opacity-100, pointer-events-auto)
   └─ after 3000ms inactivity → isIdle = true → chrome hidden (opacity-0, pointer-events-none)
        │
        │  also triggered by:
        ▼
[WatchShell onStateChange]
   └─ state=2 (paused) → resetTimer() → chrome stays visible
        │
        ▼
[Chrome elements — fixed positioned, above player]
   ├─ Top overlay (z-20): back | title + badge | watchlist + like + share
   └─ Edge arrows (z-20): prev (left-4) | next (right-4) — only rendered when episode exists
        │
        ▼
[YouTube iframe — absolute inset-0, z-10]
   └─ pointer events reach iframe ONLY when chrome is hidden (pointer-events-none on chrome)
```

### Recommended Project Structure
```
src/
├── hooks/
│   ├── use-idle-timer.ts       ← NEW (Phase 33)
│   ├── use-progress-tracker.ts
│   ├── use-watchlist.ts
│   └── use-likes.ts
└── components/
    └── watch/
        └── watch-shell.tsx     ← MODIFIED (Phase 33)
```

No new component files. Overlay JSX lives inside `WatchShell` to keep idle state and episode state co-located.

### Pattern 1: useIdleTimer Hook

**What:** Custom hook that tracks user inactivity and returns `{ isIdle, resetTimer }`.
**When to use:** Any fullscreen surface where chrome must auto-hide after inactivity.

```typescript
// Source: [VERIFIED: codebase — useProgressTracker pattern + React docs]
// File: src/hooks/use-idle-timer.ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useIdleTimer(delay: number) {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsIdle(true), delay)
  }, [delay])

  useEffect(() => {
    // Start timer on mount
    resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return { isIdle, resetTimer }
}
```

**Key decisions:**
- Uses bare `setTimeout` / `clearTimeout` (not `window.setTimeout`) — avoids TypeScript narrowing to `never` after `typeof window !== 'undefined'` guard. This is a confirmed project pitfall (see MEMORY.md: `window.setTimeout narrows to never after requestIdleCallback guard`).
- `ReturnType<typeof setTimeout>` for cross-env-safe timer typing.
- `resetTimer` is `useCallback`-wrapped so it is stable across renders — safe to pass as dep.
- Starts idle timer on mount so chrome is visible from the first frame (state=false initially).

### Pattern 2: Chrome Visibility via CSS Toggle

**What:** Toggle `opacity-0`/`opacity-100` and `pointer-events-none`/`pointer-events-auto` via `isIdle`.
**When to use:** Preferred over `motion/animate` for simple binary fades — no `'use client'` overhead beyond what WatchShell already has.

```tsx
// Source: [VERIFIED: codebase — play-overlay.tsx + Tailwind v4 docs]
// Applies inside WatchShell JSX

const chromeClass = isIdle
  ? 'opacity-0 pointer-events-none'
  : 'opacity-100 pointer-events-auto'

// Top overlay
<div className={`fixed top-0 left-0 right-0 z-20 transition-opacity duration-200 ${chromeClass}`}>
  {/* ... */}
</div>

// Edge arrows — only rendered when episode exists
{prevEpisode && (
  <button
    onClick={() => handleEpisodeSwitch(prevEpisode)}
    className={`fixed left-4 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${chromeClass}`}
    aria-label="Previous episode"
  >
    <ChevronLeft className="size-5 text-white" />
  </button>
)}
```

**Why CSS over motion:** 200ms opacity fade is below the threshold where motion's spring physics add value. CSS `transition-opacity` is zero-JS, works in Server Components, and is the existing pattern in `play-overlay.tsx`. [VERIFIED: codebase]

### Pattern 3: Event Attachment on Shell Root Div

**What:** React synthetic events on the shell root div capture all pointer/touch/keyboard interactions.
**Why not on the iframe:** YouTube iframe is cross-origin — events inside it do NOT bubble to parent DOM. This is a hard browser security boundary.

```tsx
// Source: [VERIFIED: codebase — watch-shell.tsx existing structure]
<div
  className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
  data-lenis-prevent
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  onPointerMove={resetTimer}
  onPointerDown={resetTimer}
  onTouchStart={resetTimer}
  onKeyDown={resetTimer}
>
```

React synthetic events on the root div catch interactions on all siblings (overlay buttons, edge arrows). Interactions on the YouTube iframe itself are undetectable — this is acceptable because:
1. When the user taps the iframe to play/pause, they can first reveal chrome by tapping the shell div edge strips around it.
2. The `onStateChange` callback (state=2 paused) forces chrome visible, covering the most important case.

### Pattern 4: Watchlist/Likes in the Overlay

**What:** Reuse `useWatchlist` and `useLikes` hooks directly inside `WatchShell` (not the pre-built button components).
**Why raw hooks over components:** `LikeButton` and `WatchlistToggleButton` are designed for card/hero contexts. The overlay wants compact `size-8` icon buttons matching a dark scrim. Wiring the raw hooks and building inline buttons is simpler.

**Gap identified — initial state:** `WatchShell` currently receives no `initialSaved`/`initialLiked` props. The watch `page.tsx` must add:

```typescript
// Source: [VERIFIED: codebase — series page.tsx pattern]
// In src/app/[locale]/(watch)/watch/[episodeId]/page.tsx
const [data, locale, progressRow, inWatchlist, isLiked] = await Promise.all([
  getEpisodeById(episodeId),
  getLocale(),
  user ? getEpisodeProgress(user.id, episodeId) : Promise.resolve(null),
  user ? getShowWatchlistState(user.id, /* need showId */) : Promise.resolve(false),
  user ? getShowLikeState(user.id, /* need showId */) : Promise.resolve(false),
])
```

**Note:** `getEpisodeById` returns `{ show }` which has `show.id`. The `showId` is available after the episode query resolves. Either:
- (A) Run watchlist/likes in a **second wave** after episode query: `await Promise.all([getShowWatchlistState..., getShowLikeState...])` — adds one serial round-trip.
- (B) If `getEpisodeById` can be restructured to return `showId` inline with the first wave — avoids waterfall. [VERIFIED: codebase — `getEpisodeById` does return `show.id` via `data.show.id`]

Preferred approach: run watchlist/likes queries **after** `getEpisodeById` resolves, in a second `Promise.all`. The cost is one extra server RTT (~5ms Supabase in-region) but the pattern is clean and matches how other pages do it. The data is not blocking render — defaults of `false` are safe, just visually incorrect on first paint.

Alternatively, pass `false` defaults and accept the minor UX trade-off (watchlist/likes state won't reflect server until first hook update — which never happens without a toggle). This means returning visitors who already saved the show will see "not saved" until they interact. This is a product decision, not a technical blocker.

**Recommendation:** Add the server queries. The series page pattern is established and takes 3 lines.

### Pattern 5: Paused State Forcing Chrome Visible

**What:** `onStateChange` in `WatchShell` already handles state=2. Add `resetTimer()` call.

```typescript
// Source: [VERIFIED: codebase — watch-shell.tsx lines 125-135]
onStateChange={(state) => {
  if (state === 0) {
    forceFlush()
    if (currentNextEpisode) setShowAutoplay(true)
  }
  if (state === 2) {
    forceFlush()
    resetTimer()  // ← Phase 33 addition: pause forces chrome visible
  }
}}
```

`resetTimer()` sets `isIdle = false` and restarts the 3s countdown. While the video is paused, the user is not moving — after 3s the countdown fires and chrome hides again. If the intent is "chrome stays visible for the entire duration of pause", the hook needs a `"keep alive while paused"` mode. The CONTEXT.md says "pausing forces chrome visible" but does not say it should stay visible indefinitely while paused. Planner should confirm interpretation: `resetTimer()` (shows chrome, starts 3s countdown from pause event) is the simplest correct implementation.

### Anti-Patterns to Avoid

- **Attaching events to the YouTube iframe element directly:** Cross-origin — events won't fire. The iframe DOM node is created by the YT IFrame API inside `YouTubePlayer`; nothing in the shell can intercept events that occur inside it. [VERIFIED: browser security model]
- **Using `motion/animate` for the 200ms fade:** Overkill for binary opacity. Adds JavaScript to what is already a client component with significant state. CSS `transition-opacity` is zero-cost. [VERIFIED: codebase — existing pattern in play-overlay.tsx]
- **`window.setTimeout` / `window.clearTimeout`:** TypeScript narrows `window` to `never` in some guard patterns. Use bare `setTimeout`/`clearTimeout`. [VERIFIED: project MEMORY.md — confirmed pitfall]
- **Using `display: none` or conditional rendering for the fade:** `display: none` removes from paint and cannot animate opacity. Conditional render causes layout thrash on each show/hide. Use `opacity-0 pointer-events-none` to keep element in DOM but invisible and non-interactive. [VERIFIED: codebase — tabs.tsx and dialog.tsx use this pattern]
- **Rendering arrow buttons when no prev/next episode exists:** CONTEXT.md says "hidden (not rendered, not just opacity-0) when no prev/next". Use conditional `{prevEpisode && <button>}` — the button is not in the DOM at all. [VERIFIED: CONTEXT.md decision]
- **Adding `'use client'` to a new overlay component file:** The overlay JSX lives inside `WatchShell` which is already `'use client'`. A separate overlay file would be a Server Component by default and would fail (accesses `isIdle` state). Adding `'use client'` to every file in the watch component tree is unnecessary noise — co-location in WatchShell is the correct pattern here. [VERIFIED: CONTEXT.md decision — "no new component file"]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idle timer | Custom debounce from scratch | `useIdleTimer` (the hook being built, following `useProgressTracker` pattern) | The pattern is established; just follow it |
| Watchlist state | Inline Supabase mutation | `useWatchlist` hook | Already handles optimistic update, RLS error handling, auth redirect, loading state |
| Like state | Inline Supabase mutation | `useLikes` hook | Same as above |
| Cross-env timer types | `NodeJS.Timeout` or `number` | `ReturnType<typeof setTimeout>` | Works in both browser and Node without explicit env check |

**Key insight:** This phase is ~80% wiring existing pieces and ~20% new code (the hook + overlay JSX). The biggest risk is the `window.setTimeout` typing trap and the initial state gap for watchlist/likes — both addressable in < 5 lines.

---

## Common Pitfalls

### Pitfall 1: `window.setTimeout` TypeScript Narrowing
**What goes wrong:** `const t = window.setTimeout(...)` compiles fine but if any TypeScript narrowing guard (`if (typeof window !== 'undefined')`) precedes it, the type narrows to `never` inside the block.
**Why it happens:** TypeScript's control flow analysis. Documented in this project's MEMORY.md.
**How to avoid:** Always use bare `setTimeout` / `clearTimeout`. `ReturnType<typeof setTimeout>` for the ref type.
**Warning signs:** TS error `Type 'Timeout' is not assignable to type 'never'` inside conditionals.

### Pitfall 2: Chrome Blocking YouTube Controls
**What goes wrong:** `pointer-events-none` is omitted when `isIdle=true`, so the overlay div sits invisibly over the iframe and blocks all YouTube native controls.
**Why it happens:** Forgetting that `opacity-0` does NOT remove hit-testing. An invisible `fixed inset-x-0 top-0` div still intercepts pointer events.
**How to avoid:** The `pointer-events-none` Tailwind class MUST be applied whenever `isIdle=true`. The toggle must be atomic: `opacity-0 pointer-events-none` together, `opacity-100 pointer-events-auto` together.
**Warning signs:** YouTube controls (seek bar, play button) don't respond to clicks after chrome auto-hides.

### Pitfall 3: YouTube iframe Events Don't Bubble
**What goes wrong:** Attaching `onPointerMove` to the `YouTubePlayer` wrapper div and expecting it to catch interactions inside the iframe.
**Why it happens:** Cross-origin iframe events are sandboxed — the browser will not dispatch them to the parent frame.
**How to avoid:** All interaction handlers must be on the shell root div, NOT on the player div.
**Warning signs:** Chrome never re-appears after fading out when user interacts inside the player.

### Pitfall 4: Timer Leak on Unmount / Episode Switch
**What goes wrong:** `timerRef.current` is not cleared in the `useEffect` cleanup, leaving a dangling timeout that calls `setIsIdle(true)` on an unmounted component.
**Why it happens:** Missing return in `useEffect`.
**How to avoid:** The cleanup function in `useIdleTimer`'s mount effect MUST clear the timer: `return () => { if (timerRef.current) clearTimeout(timerRef.current) }`.
**Warning signs:** React "Can't perform a state update on an unmounted component" warning in console after navigating away from watch page.

### Pitfall 5: Initial State Flash — Watch/Like Shows "Not Saved" on First Paint
**What goes wrong:** `useWatchlist(showId, false, userId)` and `useLikes(showId, false, userId)` are called with `false` as default because `page.tsx` doesn't fetch initial state. Users who saved the show see the bookmark/heart as empty until they toggle.
**Why it happens:** Watch page currently only fetches episode progress for the initial SSR data, not watchlist/likes.
**How to avoid:** Add `getShowWatchlistState` + `getShowLikeState` calls to `page.tsx` and thread `initialSaved`/`initialLiked` through `WatchShell` props.
**Warning signs:** Returning users who already saved the show see the watchlist icon as "not saved" on page load.

### Pitfall 6: `currentNextEpisode` vs `nextEpisode` Prop for Arrow Button
**What goes wrong:** Using the initial `nextEpisode` prop (from server) for the "next episode" arrow instead of `currentNextEpisode` state. After an in-session episode switch, the prop is stale.
**Why it happens:** The prop reflects the initial server-fetched episode; `currentNextEpisode` is the live state pointer. The arrow must use `currentNextEpisode` to stay correct across episode switches.
**How to avoid:** Arrow button `onClick` and conditional render must use `currentNextEpisode` (state), not `nextEpisode` (prop). Similarly for prev: `prevEpisode` prop is only correct for the initial episode. After a switch, prev is not tracked in WatchShell state — a gap Phase 33 must address or accept (see Open Questions).

---

## Code Examples

### useIdleTimer — Complete Implementation

```typescript
// Source: [VERIFIED: codebase — useProgressTracker pattern + React 19 hooks]
// File: src/hooks/use-idle-timer.ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseIdleTimerReturn {
  isIdle: boolean
  resetTimer: () => void
}

export function useIdleTimer(delay: number): UseIdleTimerReturn {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsIdle(true), delay)
  }, [delay])

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return { isIdle, resetTimer }
}
```

### WatchShell Integration Sketch

```tsx
// Source: [VERIFIED: codebase — watch-shell.tsx + CONTEXT.md decisions]
// Additions to WatchShell (not a full rewrite — only modified sections shown)

const { isIdle, resetTimer } = useIdleTimer(3000)
const { isInList, toggle: toggleWatchlist } = useWatchlist(show.id, initialSaved, userId ?? null)
const { isLiked, toggle: toggleLike } = useLikes(show.id, initialLiked, userId ?? null)

const chromeVisible = !isIdle
const chromeClass = chromeVisible
  ? 'opacity-100 pointer-events-auto'
  : 'opacity-0 pointer-events-none'

// Root div — add event handlers
<div
  className="fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black"
  data-lenis-prevent
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  onPointerMove={resetTimer}
  onPointerDown={resetTimer}
  onTouchStart={resetTimer}
  onKeyDown={resetTimer}
>

// Top overlay (replaces placeholder back link)
<div
  className={`fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-8 transition-opacity duration-200 ${chromeClass}`}
  aria-hidden={isIdle}
>
  {/* Left: back */}
  <Link href={`/series/${show.slug}`} className="...">
    <ArrowLeft className="size-5" /> {show.title}
  </Link>
  {/* Center: title + badge */}
  <span>{currentEpisode.title}</span>
  <span>S{season.seasonNumber} E{currentEpisode.episodeNumber}</span>
  {/* Right: actions */}
  <button onClick={toggleWatchlist} aria-label="Add to watchlist">
    <Bookmark className={isInList ? 'fill-white' : ''} />
  </button>
  <button onClick={toggleLike} aria-label="Like">
    <Heart className={isLiked ? 'fill-pink-400 text-pink-400' : ''} />
  </button>
  <button onClick={handleShare} aria-label="Share">
    <Share2 />
  </button>
</div>

// Prev arrow
{prevEpisode && (
  <button
    onClick={() => handleEpisodeSwitch(prevEpisode)}
    className={`fixed left-4 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${chromeClass}`}
    aria-label="Previous episode"
  >
    <ChevronLeft className="size-5 text-white" />
  </button>
)}

// Next arrow (currentNextEpisode, not nextEpisode prop)
{currentNextEpisode && (
  <button
    onClick={() => handleEpisodeSwitch(currentNextEpisode)}
    className={`fixed right-4 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${chromeClass}`}
    aria-label="Next episode"
  >
    <ChevronRight className="size-5 text-white" />
  </button>
)}
```

### page.tsx Additions for Initial Watchlist/Likes State

```typescript
// Source: [VERIFIED: codebase — series/[slug]/page.tsx pattern]
// In src/app/[locale]/(watch)/watch/[episodeId]/page.tsx

import { getShowWatchlistState, getShowLikeState } from '@/lib/queries'

// After episode data is fetched:
const [inWatchlist, isLiked] = user
  ? await Promise.all([
      getShowWatchlistState(user.id, data.show.id),
      getShowLikeState(user.id, data.show.id),
    ])
  : [false, false]

// Pass to WatchShell:
<WatchShell
  ...
  initialSaved={inWatchlist}
  initialLiked={isLiked}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---------|
| `framer-motion` package name | `motion` package with `motion/react` imports | 2024 | All project imports already use `motion/react` — verified |
| `window.setTimeout` with type `number` | Bare `setTimeout` with `ReturnType<typeof setTimeout>` | Project MEMORY | Avoids TS narrowing bug confirmed in this codebase |
| External idle timer library (e.g. `react-idle-timer`) | Custom hook | PROJECT decision | Zero new deps; 15 lines; sufficient for single use |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Paused state should show chrome for 3s then hide again (not indefinitely) | Pattern 5 | If "chrome stays visible for entire pause duration" is required, `useIdleTimer` needs a `keepAlive` boolean and the hook complexity increases |
| A2 | `prevEpisode` arrow uses the initial prop (no in-session prev tracking) — accepted trade-off | Pitfall 6 | After in-session switch, prev arrow may point to wrong episode; Open Question below |
| A3 | Web Share API is the share implementation (with clipboard fallback) | Claude's Discretion | If navigator.share not available and no fallback is acceptable, Share2 button becomes a no-op |

---

## Open Questions

1. **Chrome stays visible while paused — indefinitely or 3s countdown?**
   - What we know: `resetTimer()` on state=2 resets the 3s countdown from the moment of pause. After 3s of no movement, chrome hides even while paused.
   - What's unclear: Is this the intended UX? Netflix keeps chrome visible for the full pause duration.
   - Recommendation: Implement a `isPaused` state in `WatchShell`, and in `useIdleTimer` add logic: if `isPaused`, do not start the timeout after reset. Alternatively, call `resetTimer()` on an interval while paused. Simplest: skip `clearTimeout` + `setTimeout` in `resetTimer()` when paused — chrome stays permanently visible. Planner should pick an approach.

2. **`prevEpisode` in-session tracking**
   - What we know: `currentNextEpisode` is tracked in WatchShell state and updated on `handleEpisodeSwitch`. `prevEpisode` is only the initial prop — no state equivalent exists.
   - What's unclear: Should the prev arrow reflect the live "current - 1" episode after a switch?
   - Recommendation: Add `currentPrevEpisode` state to `WatchShell` (parallel to `currentNextEpisode`), computed in `findPrevEpisode()` (inverse of `findNextEpisode`). Without this, the prev arrow will point to the wrong episode after a switch mid-session.

3. **Share button implementation**
   - What we know: `Share2` icon from lucide-react is confirmed available.
   - What's unclear: Should this call `navigator.share()` (Web Share API — mobile native sheet), copy URL to clipboard, or be a no-op?
   - Recommendation: `navigator.share` with `window.location.href` as the URL, fallback to `navigator.clipboard.writeText`. Both are browser-only, safe in `'use client'` component.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 33 is purely client-side code and config changes. No external CLI tools, databases, services, or runtimes beyond the project's existing Next.js + Supabase stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 |
| Config file | `playwright.config.ts` (project root) |
| Quick run command | `npx playwright test tests/e2e/watch-page.spec.ts --project=chromium` |
| Full suite command | `npx playwright test --project=chromium` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHROME-01 | Chrome overlay fades in on pointer move, fades out after 3s idle | e2e | `npx playwright test tests/e2e/watch-chrome.spec.ts -x` | Wave 0 — new file needed |
| CHROME-01 | `pointer-events: none` when chrome is hidden (YouTube controls tappable) | e2e | included in above | Wave 0 — new file needed |
| CHROME-02 | Prev/next arrow buttons visible when episodes exist, absent when not | e2e | included in above | Wave 0 — new file needed |
| CHROME-02 | Arrow click triggers episode switch | e2e | included in above | Wave 0 — new file needed |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/e2e/watch-chrome.spec.ts --project=chromium`
- **Per wave merge:** `npx playwright test --project=chromium`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/watch-chrome.spec.ts` — covers CHROME-01, CHROME-02

**Note on testability:** The 3s idle timeout makes fully automated CI testing slow. The spec should override the delay or mock timers. Playwright's `page.clock` API (available in Playwright ^1.45) allows advancing time without real-world waits — the test can advance the clock 3100ms to trigger idle state.

*(Existing `tests/e2e/watch-page.spec.ts` infrastructure covers player render and navigation; Phase 33 tests extend this with chrome-specific assertions.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | — (watchlist/likes already handled by RLS, no new auth gates) |
| V3 Session Management | no | — (no session changes) |
| V4 Access Control | no | — (RLS enforced at DB level via existing hooks) |
| V5 Input Validation | no | — (no user text input in this phase) |
| V6 Cryptography | no | — (no crypto operations) |

**Threat patterns specific to this phase:** None new. Watchlist/likes mutations are guarded by RLS (established pattern). Share button uses `window.location.href` — no user-controlled URL, no XSS vector.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `src/components/watch/watch-shell.tsx` — integration point, all props and callbacks verified
- [VERIFIED: codebase] `src/hooks/use-progress-tracker.ts` — hook cleanup pattern, `ReturnType<typeof setTimeout>` pattern
- [VERIFIED: codebase] `src/hooks/use-watchlist.ts` / `use-likes.ts` — hook API signatures
- [VERIFIED: codebase] `src/components/likes/like-button.tsx` / `watchlist/watchlist-toggle-button.tsx` — reusable component patterns
- [VERIFIED: codebase] `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` — current data fetching; confirms no initial watchlist/likes state
- [VERIFIED: codebase] `src/lib/queries.ts` — `getShowWatchlistState`, `getShowLikeState` function signatures
- [VERIFIED: codebase] `src/components/ui/play-overlay.tsx` — `opacity-0 transition-opacity duration-200 group-hover:opacity-100` pattern
- [VERIFIED: codebase] `package.json` — motion ^12.38.0, lucide-react confirmed installed
- [VERIFIED: npm] lucide-react — ChevronLeft, ChevronRight, Heart, Bookmark, Share2, ArrowLeft all present
- [VERIFIED: project MEMORY.md] `window.setTimeout narrows to never after requestIdleCallback guard` — confirmed pitfall

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md] All implementation decisions — locked by user prior to research

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and codebase
- Architecture: HIGH — all integration points read directly from source files
- Pitfalls: HIGH — two confirmed from project MEMORY.md, others derived from direct code inspection
- Initial state gap: HIGH — confirmed gap by reading watch page.tsx vs series page.tsx

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (stable stack — no expiry concerns within milestone)
