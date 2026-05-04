# Architecture Research

**Domain:** Fullscreen immersive watch page — Next.js 16.2 App Router integration
**Researched:** 2026-05-05
**Confidence:** HIGH

## Recommended Architecture

```
src/app/[locale]/
├── (viewer)/                    ← UNCHANGED (Navbar + Footer + Silk + Ticker + Lenis)
│   └── layout.tsx
└── (watch)/                     ← NEW route group
    └── watch/[id]/
        ├── layout.tsx           ← NEW: bare wrapper (no Navbar/Footer/Silk/Ticker)
        └── page.tsx             ← MOVED + render swap to FullscreenWatchPage
```

### New Component Boundaries

| Component | Responsibility | Status |
|---|---|---|
| `(watch)/layout.tsx` | Bare wrapper — no viewer chrome, no Lenis | NEW |
| `(watch)/watch/[id]/page.tsx` | Server data fetch (unchanged) + swap to FullscreenWatchPage | MOVED + modified |
| `FullscreenWatchPage` (client) | Top-level orchestrator: fixed shell, player, overlay, tray | NEW |
| `WatchOverlay` (client) | Auto-hide top bar, edge arrows, actions | NEW |
| `EpisodeTray` (client) | Vaul bottom sheet: season selector + episode list | NEW |
| `useIdleTimer` (hook) | Auto-hide timer (3s silence → hidden) | NEW |
| `YouTubePlayer` | IFrame API wrapper | UNCHANGED |
| `useProgressTracker` | 10s progress writes to Supabase | UNCHANGED |
| AutoplayOverlay | End-of-episode countdown | UNCHANGED |

### Data Flow

```
page.tsx (server)
  ├─ fetch episode + show + season + seasons + episodesBySeason (existing parallel — no changes)
  └─ pass to <FullscreenWatchPage>
       ├─ <YouTubePlayer />          (fixed inset-0, sibling)
       ├─ <WatchOverlay />           (auto-hide, pointer-events: none when hidden)
       └─ <EpisodeTray />            (Vaul drawer, tray state via useState)
```

## Q&A

### Q1: Layout Conflict — Suppress Navbar/Footer

**Answer: Route Group escape.** Create `[locale]/(watch)/` as a sibling to `(viewer)/`. Next.js route groups don't appear in URLs. The `(viewer)/layout.tsx` with Navbar/Footer/Silk/Lenis never runs for `(watch)/` routes.

**Why not conditional pathname sniffing in `(viewer)/layout.tsx`?** Couples viewer layout to specific child routes, harder to extend for future chromeless routes (e.g., Shorts overlay).

### Q2: YouTube Iframe Fullscreen Strategy

**Answer: CSS `fixed inset-0 h-dvh` — not Fullscreen API.**

- `element.requestFullscreen()` on iOS Safari: silently rejected on iframes (only works on `<video>`)
- CSS fill gives visually identical immersion without API quirks
- YouTube's native fullscreen button still works as escape hatch
- For desktop-only Theater Mode: `requestFullscreen()` with feature detect + non-iOS guard (v2.3)

**`100dvh` units:** Dynamic viewport height — accounts for mobile browser toolbar collapse/expand. `100vh` clips on iOS Safari. Use `h-dvh` with `min-h-svh` as fallback.

### Q3: Tray State Architecture

**Answer: Local `useState` on `FullscreenWatchPage`.**

- Ephemeral UI state — doesn't deep-link, doesn't need to survive navigation
- Zero cross-component consumers — no reason to go to zustand
- nuqs would pollute share URLs

```tsx
// in FullscreenWatchPage
const [trayOpen, setTrayOpen] = useState(false)
```

**Scroll/overflow:** Root element is `fixed inset-0 overflow-hidden` — page never scrolls. Tray has its own `overflow-y-auto` for the episode list. No body scroll lock needed.

### Q4: Gesture Detection Around YouTube Iframe

**The problem:** YouTube iframe swallows all touch/click events inside its bounds. Cross-origin boundary — `iframe.contentWindow.addEventListener` is blocked.

**Solution: Edge overlay strips.**

```
┌─────────────────────────────┐
│ [top edge strip 48px h-12]  │  ← pointer-events: auto, catches top-edge tap
│─────────────────────────────│
│       YouTube iframe        │  ← z-0, pointer-events: auto (YouTube controls)
│─────────────────────────────│
│ [bottom edge strip 48px]    │  ← pointer-events: auto, catches swipe-up
└─────────────────────────────┘
```

- Thin `h-12` divs at top/bottom edges with `pointer-events-auto z-10`
- Center iframe area left untouched — YouTube controls work normally
- YT `onStateChange` (state 1=playing, 2=paused) used as interaction signal to reset idle timer
- `document.addEventListener('keydown', ...)` catches keyboard even when iframe has focus

### Q5: Watch Page Layout Override

**Same as Q1 — Route Group escape.** New `(watch)/layout.tsx`:

```tsx
export default function WatchGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>  // no Navbar, no Footer, no Silk, no Lenis
}
```

The `[locale]/layout.tsx` (themes, providers, next-intl) still wraps this — locale routing, auth, dark mode all unaffected.

### Q6: Data Fetching for Tray

**Zero new queries needed.** Current `page.tsx` already fetches `episodesBySeason: Record<string, ViewEpisode[]>` which contains every episode for every season. The existing sidebar already renders from this. Tray reuses the same prop — no waterfall risk.

For very long seasons (Break Fast Daily accumulates daily episodes): virtualize with `@tanstack/react-virtual` if needed post-launch. Not needed for v2.2.

## New vs Modified Files

| File | Action | Notes |
|---|---|---|
| `src/app/[locale]/(watch)/layout.tsx` | CREATE | Bare wrapper |
| `src/app/[locale]/(watch)/watch/[id]/page.tsx` | MOVE + modify | Data fetch unchanged; render swap to FullscreenWatchPage |
| `src/components/watch/fullscreen-watch-page.tsx` | CREATE | Top-level client orchestrator |
| `src/components/watch/watch-overlay.tsx` | CREATE | Auto-hide chrome layer |
| `src/components/watch/episode-tray.tsx` | CREATE | Vaul-based bottom sheet |
| `src/hooks/use-idle-timer.ts` | CREATE | 3s idle detection |
| `src/components/watch/watch-page-content.tsx` | RENAME to `-legacy.tsx` | Delete after Phase 32 smoke test |
| `src/app/[locale]/(viewer)/watch/` | DELETE | After move to (watch) |

## Suggested Build Order (phased, each independently deployable)

1. **Phase 32 — Route isolation + fullscreen shell** (plumbing, no visible UI change beyond layout)
2. **Phase 33 — Auto-hide chrome layer** (WatchOverlay + useIdleTimer + edge arrows)
3. **Phase 34 — Episode tray** (EpisodeTray via Vaul + season selector + episode list)

## Conflict Flags

| Conflict | Severity | Resolution |
|---|---|---|
| Lenis smooth-scroll wraps current watch page | Medium | Auto-resolved by route group (Lenis lives in (viewer)/layout.tsx) |
| MarqueeTicker + Silk background on every viewer page | Low | Auto-resolved by route group |
| `pt-16` top-padding in (viewer)/layout.tsx for Navbar | Low | Auto-resolved |
| Locale-aware Links still needed inside FullscreenWatchPage | None | Import from `@/i18n/navigation` as usual |

## Sources

- Architecture researcher output (2026-05-05) — HIGH confidence
- Next.js App Router docs — Route Groups, nested layouts
- MDN — CSS dvh/svh units, pointer-events, overscroll-behavior

---
*Architecture research for: v2.2 fullscreen immersive watch page + swipe-up episode tray*
*Researched: 2026-05-05*
