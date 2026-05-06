---
phase: 32-watch-route-isolation-fullscreen-shell
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/app/[locale]/(watch)/layout.tsx
  - src/app/[locale]/(watch)/watch/[episodeId]/page.tsx
  - src/components/watch/watch-shell.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
---

# Phase 32: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 32 introduces the `(watch)/` route group, `WatchShell` client component, and in-place episode switching via `loadVideoById()`. The route isolation is clean, the `YouTubePlayer` prop-freeze pattern is correctly implemented (passing `episode.youtubeId` — the initial prop — keeps the IFrame from remounting), and the progress-tracker episodeId ordering is sound.

One critical logic bug exists: `nextEpisode` is a fixed server prop and is never updated when `handleEpisodeSwitch` is called. After the first autoplay switch, every subsequent "video ended" event will queue the same (already-watched) episode. Three additional warnings surface around a countdown-reset hazard, a redundant layout wrapper, and a missing locale prefix in the OG/canonical metadata.

---

## Critical Issues

### CR-01: Autoplay loops on the same episode after first switch

**File:** `src/components/watch/watch-shell.tsx:99`

**Issue:** `nextEpisode` is a fixed prop passed from the server. When `handleEpisodeSwitch(nextEpisode)` fires (autoplay or manual), `currentEpisode` in state advances to `nextEpisode` — but `nextEpisode` itself is never recalculated. The player's `onStateChange` callback (line 99) still holds the original prop value.

Concrete failure path:
1. Server renders `/watch/ep1` → `episode=ep1`, `nextEpisode=ep2`
2. `ep1` ends → autoplay fires → `handleEpisodeSwitch(ep2)` → player loads `ep2`, `currentEpisode=ep2`
3. `ep2` ends → `state=0` fires → `if (nextEpisode)` is truthy (still `ep2`) → `setShowAutoplay(true)`
4. AutoplayOverlay renders with `nextEpisode=ep2` → `onPlayNow` calls `handleEpisodeSwitch(ep2)` → `ep2` plays again, indefinitely

`episodesBySeason` is already in props and contains the full episode list needed to compute the real next episode dynamically.

**Fix:** Track next/prev as derived state that updates alongside `currentEpisode`. Add a helper that computes next/prev from `episodesBySeason` at switch time:

```tsx
// At the top of WatchShell, derive next/prev from currentEpisode
const [currentEpisode, setCurrentEpisode] = useState(episode)
const [currentNextEpisode, setCurrentNextEpisode] = useState(nextEpisode)

function findNextEpisode(current: ViewEpisode): ViewEpisode | null {
  const seasonEps = episodesBySeason[current.seasonId] ?? []
  const idx = seasonEps.findIndex((e) => e.id === current.id)
  if (idx !== -1 && idx < seasonEps.length - 1) return seasonEps[idx + 1]
  // Cross-season: find next season by number
  const currentSeason = seasons.find((s) => s.id === current.seasonId)
  if (!currentSeason) return null
  const nextSeason = seasons.find((s) => s.seasonNumber === currentSeason.seasonNumber + 1)
  if (!nextSeason) return null
  const nextSeasonEps = episodesBySeason[nextSeason.id] ?? []
  return nextSeasonEps[0] ?? null
}

function handleEpisodeSwitch(newEpisode: ViewEpisode) {
  if (!playerRef.current || !newEpisode.youtubeId) return
  forceFlush()
  setCurrentEpisode(newEpisode)
  setCurrentNextEpisode(findNextEpisode(newEpisode))
  playerRef.current.loadVideoById({ videoId: newEpisode.youtubeId, startSeconds: 0 })
  window.history.replaceState(null, '', `/${locale}/watch/${newEpisode.id}`)
}
```

Then replace every reference to `nextEpisode` in JSX and callbacks with `currentNextEpisode`.

---

## Warnings

### WR-01: Unstable `onPlayNow` reference resets AutoplayOverlay countdown on every WatchShell render

**File:** `src/components/watch/watch-shell.tsx:129-131`

**Issue:** `onPlayNow` is an inline arrow function created fresh on each render:

```tsx
onPlayNow={() => {
  setShowAutoplay(false)
  handleEpisodeSwitch(nextEpisode)
}}
```

`AutoplayOverlay` has `useEffect(() => { ... }, [onPlayNow])`. Every time `WatchShell` re-renders while the overlay is visible, `onPlayNow` gets a new reference → the effect re-runs → the `setInterval` restarts → the 8-second countdown resets to 8.

While no state changes currently happen during overlay display, this is a correctness trap for any future state additions (e.g., a volume indicator, a tooltip) and is structurally wrong.

**Fix:** Stabilize with `useCallback`, including the fix from CR-01 that changes `nextEpisode` to `currentNextEpisode`:

```tsx
const handlePlayNow = useCallback(() => {
  setShowAutoplay(false)
  if (currentNextEpisode) handleEpisodeSwitch(currentNextEpisode)
}, [currentNextEpisode]) // handleEpisodeSwitch can be useCallback'd too

// In JSX:
<AutoplayOverlay onPlayNow={handlePlayNow} onCancel={...} ... />
```

---

### WR-02: WatchLayout wrapper div is structurally redundant

**File:** `src/app/[locale]/(watch)/layout.tsx:6`

**Issue:** The layout renders:

```tsx
<div className="h-dvh min-h-svh overflow-hidden bg-black">
  {children}
</div>
```

But `WatchShell` (the only consumer) is `position: fixed; inset: 0` — it escapes normal document flow entirely. The layout's wrapper div has no visual or layout effect. Any future consumer of the `(watch)` group that is _not_ `position: fixed` will inherit a viewport-locked container, which may cause unexpected clipping or overflow behavior.

**Fix:** Either remove the wrapper and return `{children}` directly (documenting the expectation that all `(watch)` children manage their own full-screen positioning), or document explicitly that the div exists as a fallback container with a code comment explaining why a non-fixed child would need it:

```tsx
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  // Children in this group are expected to use position:fixed and manage
  // their own viewport coverage. This wrapper provides a black background
  // for any brief flash before the fixed layer paints.
  return <>{children}</>
}
```

---

### WR-03: Canonical and OG URL missing locale prefix

**File:** `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx:21`

**Issue:** `const canonical = \`/watch/${episodeId}\`` — the route group uses `localePrefix: 'always'` (confirmed in `src/i18n/routing.ts`), so every real URL in production is `/{locale}/watch/{id}`. The canonical URL published to search engines and social previews is missing the locale segment. Search engines may index non-existent paths.

Note: this same pattern exists on `series/[slug]/page.tsx` (pre-existing), so this is a consistent project-wide omission, not unique to Phase 32.

**Fix:** Include locale in canonical. `getLocale()` is already called on line 15:

```tsx
const canonical = `/${locale}/watch/${episodeId}`
```

Apply the same fix to `series/[slug]/page.tsx` for consistency.

---

## Info

### IN-01: `episodesBySeason` and `prevEpisode` props are dead in WatchShell body

**File:** `src/components/watch/watch-shell.tsx:17-18, 28-29`

**Issue:** Both `episodesBySeason` (type: `Record<string, ViewEpisode[]>`) and `prevEpisode` are accepted in the interface and destructured, but neither appears in any JSX or logic. The only usage of `seasons` is the `find()` lookup on line 126 for `seasonNumber` in the `AutoplayOverlay` call.

This is intentional scaffolding for Phase 33's episode list UI, but it means the server fetches and serializes the full episode map on every watch page load with no current benefit.

**Fix:** Add a comment marking these as Phase 33 scaffolding so they are not mistaken for dead code during future cleanup:

```tsx
// Phase 33: episodesBySeason and prevEpisode will power the episode drawer.
// Accepted here so the server fetch + prop shape is already in place.
```

---

### IN-02: `showAutoplay` not reset when `handleEpisodeSwitch` is called from a non-autoplay path

**File:** `src/components/watch/watch-shell.tsx:53-66`

**Issue:** If Phase 33 adds an episode list that calls `handleEpisodeSwitch` while the AutoplayOverlay is already showing (e.g., user manually picks a different episode while the 8-second countdown runs), `showAutoplay` stays `true`. The overlay remains on screen for the new episode.

**Fix:** Add `setShowAutoplay(false)` inside `handleEpisodeSwitch`:

```tsx
function handleEpisodeSwitch(newEpisode: ViewEpisode) {
  if (!playerRef.current || !newEpisode.youtubeId) return
  forceFlush()
  setShowAutoplay(false) // dismiss overlay if visible
  setCurrentEpisode(newEpisode)
  playerRef.current.loadVideoById({ videoId: newEpisode.youtubeId, startSeconds: 0 })
  window.history.replaceState(null, '', `/${locale}/watch/${newEpisode.id}`)
}
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
