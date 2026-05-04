# Research Summary — Milestone v2.2 Immersive Watch

**Project:** Clickit Story — Fullscreen Watch Page + Swipe-Up Episode Tray
**Researched:** 2026-05-05
**Confidence:** HIGH across all 4 dimensions

---

## Stack Additions

**Zero new libraries.** All capabilities exist in the installed stack:

| Needed For | Library | Already Installed |
|---|---|---|
| Tray gesture + animation | `motion` ^12.38.0 | ✓ |
| Bottom sheet with snap points | `vaul` via shadcn/ui Drawer | ✓ |
| Fullscreen layout | CSS `fixed inset-0 h-dvh` | ✓ (no library) |
| Tray state | React `useState` | ✓ |
| Smooth-scroll bypass | `data-lenis-prevent` attribute | ✓ (no library) |

---

## Feature Table Stakes

The reference pattern is **HBO Max / Apple TV iOS**, not TikTok/Reels.

| Feature | Status |
|---|---|
| Player fills 100dvw × 100dvh on load, zero chrome | Required (WATCH-01, WATCH-02) |
| Auto-hide chrome (top bar + edge arrows), 3s idle | Required (CHROME-01, CHROME-02) |
| Peek handle always visible at bottom | Required (TRAY-01) |
| Swipe-up tray with 3 snap points | Required (TRAY-02, TRAY-03) |
| Season selector + full episode list in tray | Required (TRAY-04, TRAY-05) |
| Currently-playing ep highlighted, tap to navigate | Required (TRAY-06, TRAY-07) |
| Player keeps playing while tray open | Mandatory (YouTube ToS + UX) |

**YouTube ToS hard constraint:** Tray must SQUEEZE the player, not cover it. No overlays on player controls.

---

## Architecture

**Route Group escape is the cleanest solution.** Move watch into `[locale]/(watch)/` — Navbar/Footer/Silk/Lenis never run for this route. Zero changes to `(viewer)/layout.tsx`.

```
[locale]/(viewer)/  ← unchanged (Navbar + Footer + Silk + Lenis)
[locale]/(watch)/   ← NEW: bare layout, fullscreen shell
    watch/[id]/     ← MOVED from (viewer)/watch/[id]/
```

**Data:** `episodesBySeason` is already fetched in `page.tsx`. Tray needs zero new queries.

**Player stability:** `loadVideoById()` for episode switches — never rekey the iframe.

---

## Watch Out For

1. **Iframe swallows touch** — edge overlay strips (`z-10 pointer-events-auto h-12`) at top/bottom
2. **`100vh` clips on iOS** — use `h-dvh min-h-svh` belt-and-suspenders
3. **Never remount iframe** — `loadVideoById()` only; rekey destroys progress tracking
4. **Progress writer race** — cancel interval before episode switch, restart in `onReady`
5. **Lenis wheel hijack** — `data-lenis-prevent` on shell (moot after route group escape)
6. **Back button** — `window.history.pushState` + `popstate` for tray dismiss, not `router.push`
7. **`playsinline` in 3 places** — URL param + HTML attribute + `allow` attribute

---

## Suggested Phase Order

| Phase | Scope | Requirements |
|---|---|---|
| 32 | Route isolation + fullscreen shell + player stability | WATCH-01–06 |
| 33 | Auto-hide chrome + edge arrows | CHROME-01–02 |
| 34 | Episode tray (Vaul, snap points, season selector, episode list) | TRAY-01–07 |
