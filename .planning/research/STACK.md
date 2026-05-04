# Stack Research

**Domain:** Fullscreen immersive video player with gesture-driven episode tray
**Researched:** 2026-05-05
**Confidence:** HIGH

## Recommended Stack

### No New Libraries Required

All capabilities needed for this milestone already exist in the installed stack.

| Capability | Library (already installed) | Version | How Used |
|---|---|---|---|
| Drag/swipe gesture on tray | `motion` | ^12.38.0 | `<motion.div drag="y">` with `PanInfo.velocity.y` threshold |
| Tray slide-up animation | `motion` | ^12.38.0 | `animate={{ y: open ? 0 : '100%' }}` spring transition |
| Tray component | shadcn/ui Drawer (wraps vaul) | already installed | Bottom sheet with snap points `[0, 0.5, 0.95]` |
| Scroll-up reveal (desktop) | native `wheel` event | — | `deltaY < -50` threshold → `setTrayOpen(true)` |
| Tray state | React `useState` | 19.2.4 | Local to FullscreenWatchPage — no zustand store needed |
| Episode list in tray | existing episode components | — | Port from current sidebar |
| Fullscreen layout | CSS `fixed inset-0 h-dvh` | — | No Fullscreen API needed |
| Smooth-scroll bypass | `data-lenis-prevent` attribute | — | On watch shell root element |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|---|---|---|
| CSS `fixed inset-0 h-dvh` | `element.requestFullscreen()` | iOS Safari rejects requestFullscreen on iframes — silently fails. CSS fill is visually identical and universal. |
| `motion` drag API | `react-use-gesture` / `@use-gesture/react` | Duplicates motion's handling. +12KB for zero gain. |
| shadcn/ui Drawer (vaul) | Custom gesture handler | Vaul solves touch-action, scroll-lock, snap-points, history.pushState upstream. Don't reinvent. |
| `useState` (local) | zustand store | Tray state has zero cross-tree consumers. Adding a store is YAGNI. |
| `useState` (local) | nuqs (URL param) | `?tray=open` pollutes share URLs and triggers router events on every toggle. |

## What NOT to Use

| Avoid | Why |
|---|---|
| `100vh` for player height | iOS Safari URL bar collapse causes clipping. Use `h-dvh` + `min-h-svh` fallback. |
| `element.requestFullscreen()` on iframe | iOS Safari only allows fullscreen on `<video>`, not iframes. |
| Remounting iframe on episode switch | Destroys progress tracking, resets iOS autoplay policy. Use `player.loadVideoById()`. |
| `pointer-events: none` on the iframe | Kills YouTube's own controls. Use edge overlay strips instead. |

## Critical Integration Notes

1. **`data-lenis-prevent`** on watch shell root — Lenis global scroll hijacks wheel; this attribute suppresses it for the subtree
2. **`overscroll-behavior: contain`** on tray — prevents iOS pull-to-refresh during tray drag
3. **Route Group escape** — move watch into `(watch)/` sibling group; `(viewer)/layout.tsx` (Lenis, Navbar, Silk) never runs for the watch route
4. **`playsinline` in 3 places**: URL param `playsinline=1`, HTML `playsInline` attribute, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"` on iframe

## Sources

- Stack researcher output (2026-05-05) — HIGH confidence
- motion v12 docs — drag, PanInfo, AnimatePresence
- vaul/shadcn Drawer docs — snap points, touch-action
- MDN — CSS dvh/svh units, pointer-events, overscroll-behavior

---
*Stack research for: v2.2 fullscreen immersive watch page + swipe-up episode tray*
*Researched: 2026-05-05*
