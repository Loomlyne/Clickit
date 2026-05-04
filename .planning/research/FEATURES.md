# Feature Research

**Domain:** Fullscreen immersive video player with gesture-driven episode tray
**Researched:** 2026-05-05
**Confidence:** HIGH

## Reference Pattern

**HBO Max / Apple TV iOS** — not TikTok/Reels. Episodes are 15–80 min; swipe-to-next-episode is hostile UX. The pattern: fullscreen player with a swipe-up sheet that reveals an episode list while playback continues underneath.

**YouTube ToS constraint:** Embeds must not obscure any part of the player. Tray must SQUEEZE the player (push up), not stack over it.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Player fills 100vw × 100dvh | Core milestone goal | LOW | `h-dvh` + `min-h-svh` fallback |
| Auto-hide chrome (3s idle) | Universal — YouTube, Netflix, HBO Max | LOW | `useIdleTimer` hook + motion fade |
| Persistent peek handle at bottom | Discoverability — without affordance, tray is invisible | LOW | 24px pill with show name + ep count |
| Swipe-up to open tray | Core interaction | MEDIUM | Vaul bottom sheet |
| Show title + season selector + full episode list in tray | Confirmed scope | MEDIUM | Port existing SeasonSelector + episode components |
| Currently-playing episode highlighted | Universal streaming pattern | LOW | Existing `currentEpisodeId` plumbing |
| Continue-watching progress per episode row | Already in v1.0; users expect | LOW | Existing `watch_progress` reads |
| Tap episode → navigate | Obvious | LOW | Existing `router.push` |
| Player keeps playing while tray open | Netflix/HBO Max both do this | LOW | Player is sibling DOM node, never remounts |
| Prev/next episode edge arrows | v1.0 feature; users rely on it | LOW | Relocate to left/right edge, fade with chrome |
| Back button to series page | Browser/OS expectation | LOW | Locale-aware Link |

### Differentiators

| Feature | Value | Complexity |
|---|---|---|
| 3 snap points (peek/half/full) | Feels native | LOW (vaul handles) |
| Player squeezed (not covered) by tray | ToS-compliant + player stays visible | LOW (CSS transform) |
| Autoplay countdown persists in new layout | Existing feature preserved | LOW |

### Anti-Features (Avoid)

| Feature | Why Tempting | Why Bad | Alternative |
|---|---|---|---|
| Tray covers player | Easy to implement | YouTube ToS violation | Squeeze pattern |
| Hide YouTube controls | "Cleaner" | ToS violation; need to rebuild seek/volume/captions | Keep `controls=1` |
| Swipe-left/right for next episode | "TikTok-like" | Collides with iOS swipe-back; wrong UX for long-form | Edge arrows + autoplay |
| Comments/reviews in tray | Platform engagement | Out of scope per PROJECT.md | Reviews stay on series page |
| Vertical swipe between episodes (full-bleed) | Modern UX | Hostile for 15–80min content | Current autoplay countdown model |

## Existing Feature Relocation (v1.0 → v2.2)

| Feature | Old Location | New Location |
|---|---|---|
| Episode title + S/E badge | Title row above player | Top of tray peek strip + auto-hide top bar |
| Watchlist toggle | Action row | Auto-hide top bar |
| Like | Action row | Auto-hide top bar |
| Share | Action row | Auto-hide top bar |
| Prev / Next episode | Action row + sidebar | Left/right edge arrows (50% Y), fade with chrome |
| Season selector | Sidebar | Tray header tabs |
| Episode list | Sidebar | Tray body (vertical scroll) |
| Autoplay countdown | Bottom-right | Unchanged position; suppress when tray fully open |
| Continue-watching writes | Background | Unchanged |

## MVP Definition

### Launch With (v2.2)

- [x] Player fills 100dvh, no chrome on load (WATCH-01, WATCH-02, WATCH-03)
- [x] YouTube controls=1, stable iframe, progress tracking (WATCH-04, WATCH-05, WATCH-06)
- [x] Auto-hide top bar with back, title, actions, prev/next (CHROME-01, CHROME-02)
- [x] Peek handle always visible (TRAY-01)
- [x] Vaul tray with 3 snap points (TRAY-02, TRAY-03)
- [x] Season tabs + episode list with progress bars (TRAY-04, TRAY-05)
- [x] Currently-playing highlighted, tap to navigate (TRAY-06, TRAY-07)

### Add After Validation (v2.3)

- [ ] Ambient brand-color glow behind player
- [ ] Picture-in-picture (desktop)
- [ ] Theater Mode button (requestFullscreen, desktop only)
- [ ] Tray snap-point session persistence

## Competitor Feature Analysis

| Feature | Netflix Mobile | HBO Max | Apple TV iOS | Our Approach |
|---|---|---|---|---|
| Episode list access | "Episodes" button in chrome → modal | Bottom sheet swipe-up | Swipe-up sheet | Swipe-up Vaul tray (3 snap points) |
| Player chrome | Auto-hide, tap to show | Auto-hide, tap to show | Auto-hide | Same (3s idle, tap/move to show) |
| Playback while browsing | Pauses | Keeps playing | Keeps playing | Keeps playing (sibling DOM) |
| Tray covers player? | Yes (modal) | No (sheet beside) | No (sheet beside) | No — squeeze pattern |

## Sources

- Features researcher output (2026-05-05) — HIGH confidence
- NN/g Bottom Sheets UX guidelines
- YouTube IFrame API Required Minimum Functionality (ToS)
- HBO Max / Apple TV iOS episode list UX patterns
- Material Design 3 Bottom Sheets guidelines

---
*Feature research for: v2.2 fullscreen immersive watch page + swipe-up episode tray*
*Researched: 2026-05-05*
