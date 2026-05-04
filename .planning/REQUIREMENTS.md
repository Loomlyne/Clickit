# Requirements — v2.2 Immersive Watch

**Milestone:** v2.2
**Total:** 15 requirements across 3 categories
**Generated:** 2026-05-05

---

## Watch Player

- [ ] **WATCH-01**: Watch route lives in its own route group (`(watch)/`) — no Navbar, Footer, Silk background, or MarqueeTicker rendered
- [ ] **WATCH-02**: Video fills 100dvw × 100dvh on load — zero layout chrome visible on entry
- [ ] **WATCH-03**: `h-dvh` + `min-h-svh` CSS units used (not `100vh`) to prevent iOS Safari toolbar clipping
- [ ] **WATCH-04**: YouTube `controls=1` — native seek, volume, captions, cast preserved; no custom controls overlay
- [ ] **WATCH-05**: Episode switches use `player.loadVideoById()` — iframe is never remounted; progress tracking stays live
- [ ] **WATCH-06**: Continue-watching 10s progress writes work in the fullscreen layout (no regression from existing behavior)

## Auto-Hide Chrome

- [ ] **CHROME-01**: Top overlay (back button, show title, S/E badge, watchlist + like + share) fades in on tap/pointer-move, fades out after 3s idle; uses `pointer-events: none` when hidden so YouTube controls remain tappable
- [ ] **CHROME-02**: Left/right edge-anchored prev/next episode arrow buttons (positioned at 50% viewport height), fade with chrome, hidden when no prev/next episode exists

## Episode Tray

- [ ] **TRAY-01**: Peek handle (24px pill strip) always visible at viewport bottom — shows show name + episode counter (e.g. "Last Call · Ep 3 of 12") — acts as tap target to open tray on desktop
- [ ] **TRAY-02**: Swipe-up gesture (mobile) / clicking peek handle (desktop) opens the episode tray; swipe-down or backdrop tap closes it to peek state
- [ ] **TRAY-03**: Tray has 3 snap points — closed/peek (0%), half (50dvh, 3–4 episode rows visible + player compressed above), full (95dvh, full episode list scrollable)
- [ ] **TRAY-04**: Tray header shows show title + season selector tabs (all seasons); switching season tab updates the episode list below without page navigation
- [ ] **TRAY-05**: Episode list is a scrollable vertical list — each row: 16:9 thumbnail, S/E badge, episode title, duration, mini continue-watching progress bar
- [ ] **TRAY-06**: Currently-playing episode row is visually distinguished (background highlight + indicator)
- [ ] **TRAY-07**: Tapping any episode row navigates to that episode immediately; tray closes after selection on mobile

---

## Future Requirements (Deferred to v2.3)

- Theater Mode button (requestFullscreen, desktop only — iOS doesn't support on iframes)
- Ambient brand-color glow behind player (per-show color)
- Picture-in-picture button (desktop Chrome)
- Tray snap-point persistence per session (zustand + sessionStorage)
- Tray episode search/filter (useful when seasons have 50+ episodes)
- Episode thumbnail prefetch on tray open

---

## Out of Scope

| Item | Reason |
|---|---|
| Custom video scrubber | YouTube ToS: must not obscure player controls; rebuild cost weeks |
| Hiding YouTube native controls (`controls=0`) | ToS violation — required minimum functionality |
| Tray covering the player (overlay pattern) | ToS: any overlay on the iframe is a violation |
| Swipe-left/right for next episode | Collides with iOS system swipe-back gesture |
| Comments / reviews inside tray | Out of scope per PROJECT.md; reviews live on series page |
| Autoplay on page load | YouTube policy — user must initiate first play |
| Screen orientation lock | Breaks user agency and accessibility |

---

## Traceability

| Requirement | Phase |
|---|---|
| WATCH-01 | Phase 32 |
| WATCH-02 | Phase 32 |
| WATCH-03 | Phase 32 |
| WATCH-04 | Phase 32 |
| WATCH-05 | Phase 32 |
| WATCH-06 | Phase 32 |
| CHROME-01 | Phase 33 |
| CHROME-02 | Phase 33 |
| TRAY-01 | Phase 34 |
| TRAY-02 | Phase 34 |
| TRAY-03 | Phase 34 |
| TRAY-04 | Phase 34 |
| TRAY-05 | Phase 34 |
| TRAY-06 | Phase 34 |
| TRAY-07 | Phase 34 |
