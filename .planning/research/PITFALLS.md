# Pitfalls Research

**Domain:** Fullscreen immersive watch page — adding to existing Next.js 16 streaming platform
**Researched:** 2026-05-05
**Confidence:** HIGH

## Critical Pitfalls

### P1: YouTube Iframe Swallows Touch Events

**Problem:** YouTube iframe never bubbles `touchmove` to the host window. Cross-origin iframe boundary is opaque. Swipe gestures on the iframe area are lost.

**Symptoms:** Swipe-up on player does nothing. Users can't open tray by swiping the video itself.

**Prevention:** Transparent overlay `<div>` strips with `pointer-events: auto` at the top/bottom edges of the player. The iframe occupies `z-0`; edge strips occupy `z-10`. Never use `pointer-events: none` on the iframe itself — that kills YouTube's controls.

**Phase:** Phase 32 (fullscreen shell setup)

---

### P2: `100vh` Clips on iOS Safari

**Problem:** iOS Safari's collapsible URL bar makes `100vh` taller than the visible viewport. Player overflows behind the toolbar → visual gap at the bottom, layout shift on scroll.

**Symptoms:** Bottom of player invisible on iPhone. Peek handle disappears behind browser chrome.

**Prevention:**
```css
min-height: 100svh;   /* stable viewport — safe fallback */
height: 100dvh;       /* dynamic viewport — correct value on iOS 15.4+ */
```
Tailwind: `className="h-dvh min-h-svh"`. Test on real iOS device (simulator doesn't reproduce).

**iOS 18+ regression:** There are reports of `dvh` gaps on certain iOS 18 Safari versions. Use `min-h-svh` as the floor — it will never be wrong, just potentially slightly short.

**Phase:** Phase 32

---

### P3: Never Remount the Iframe on Episode Switch

**Problem:** Changing the iframe `src` attribute or rekeying the component destroys the YouTube IFrame API instance. Side effects: progress tracking interval fires against old episode, iOS autoplay policy re-evaluated (may refuse to play), 500KB iframe re-downloaded.

**Prevention:** Use `player.loadVideoById({ videoId, startSeconds: 0 })` from the existing IFrame API instance. Never change `key`, `src`, or `videoId` prop directly.

```ts
// CORRECT
playerRef.current.loadVideoById({ videoId: newEpisode.youtube_video_id, startSeconds: 0 })

// WRONG — remounts iframe
<iframe key={episode.id} src={...} />
```

**Phase:** Phase 32

---

### P4: Progress Writer Race on Episode Switch

**Problem:** The existing 10s `setInterval` may fire after `router.push` or `loadVideoById` during an episode switch, writing the old episode's progress position against the new episode ID.

**Prevention:** Cancel the interval immediately before episode switch, restart it in the new episode's `onReady` callback.

```ts
// Before loadVideoById
clearInterval(progressIntervalRef.current)

// After onReady fires for new episode
progressIntervalRef.current = setInterval(saveProgress, 10_000)
```

**Phase:** Phase 32

---

### P5: Lenis Smooth-Scroll Hijacks Wheel Events

**Problem:** The global `<ReactLenis root>` in `(viewer)/layout.tsx` intercepts all wheel events. In the fullscreen shell, wheel events intended to open the tray get swallowed by Lenis before reaching the listener.

**Prevention:** `data-lenis-prevent` attribute on the watch shell root element. Lenis skips wheel handling for elements matching this attribute and their descendants.

```tsx
<div data-lenis-prevent className="fixed inset-0 h-dvh overflow-hidden bg-black">
  {/* fullscreen shell */}
</div>
```

**Better prevention:** Route Group escape (Phase 32) removes Lenis entirely from the watch route. `data-lenis-prevent` is a belt-and-suspenders backup.

**Phase:** Phase 32

---

### P6: Back Button Must Dismiss Tray (Not Navigate Away)

**Problem:** If tray is open and user hits back button or OS swipe-back, expectation is: tray closes first, THEN next back press navigates. If tray uses `router.push` for dismiss, it creates spurious history entries.

**Prevention:** `window.history.pushState` + `popstate` listener pattern:

```ts
// When tray opens
window.history.pushState({ tray: true }, '')

// popstate listener (mounted once on FullscreenWatchPage)
window.addEventListener('popstate', (e) => {
  if (trayOpen) { setTrayOpen(false); e.preventDefault() }
})
```

Do NOT use `router.push` or `router.replace` for tray state — those trigger Next.js navigation events.

**Phase:** Phase 34

---

### P7: `playsinline` Must Be Set in Three Places

**Problem:** On iOS, if any of the three `playsinline` declarations is missing, the IFrame API state machine breaks. Video may open in native full-screen (unexpected), or refuse to autoplay.

**Prevention:** All three must be present:
1. IFrame URL param: `&playsinline=1`
2. HTML attribute: `playsInline={true}` on the `<iframe>` element
3. Allow attribute: `allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"`

Verify in Phase 32 smoke test on real iOS device.

---

### P8: Vaul Tray vs Custom Gesture Handler

**Problem:** Building a custom swipe-up tray with raw touch events requires solving: touch-action conflicts, scroll-vs-drag discrimination, snap-point physics, iOS overscroll rubber-banding, scroll-lock during drag, and history.pushState for dismiss. Each is a separate multi-hour problem.

**Prevention:** Use `vaul` via shadcn/ui Drawer — all of the above are solved upstream. shadcn/ui is already in the project; vaul is its drawer primitive.

```tsx
import { Drawer } from 'vaul'
// or via shadcn: import { Drawer } from '@/components/ui/drawer'
```

Snap points: `snapPoints={[0, 0.5, 0.95]}`. Vaul handles physics, momentum, and keyboard dismiss.

**Phase:** Phase 34

---

## Integration Gotchas

| Gotcha | Detail |
|---|---|
| `bare setTimeout` not `window.setTimeout` | After `requestIdleCallback` guard, TS narrows `window` to `never`. Use bare `setTimeout`/`clearTimeout` in `useIdleTimer`. |
| `usePathname` in `(viewer)/layout.tsx` | Don't add pathname sniffing to suppress chrome for watch route — use route group instead |
| Template.tsx must be plain fragment | Per project memory: template.tsx must NOT be a motion.div — blocks 320ms per navigation. New `(watch)` group doesn't need one. |
| Locale-aware Link still needed | Back button must use locale-aware `Link` from `@/i18n/navigation`, not bare `next/link` |
| No AnimatePresence `mode="wait"` | Per project memory: causes 320ms nav block with Lenis. `(watch)` group bypasses Lenis entirely so this is moot, but don't add it anyway. |

## Performance Traps

| Trap | Impact | Prevention |
|---|---|---|
| Virtualize episode list | Break Fast Daily: accumulates daily episodes | `@tanstack/react-virtual` if list > 100 rows (not needed for v2.2) |
| Poster frames for all episodes | Network cost on tray open | Lazy-load thumbnails with `loading="lazy"` on `<img>` |
| Motion transform on player during tray drag | Repaints every frame | Use `will-change: transform` on the player container; CSS custom property for drag progress |

## QA Checklist (Phase 32 Smoke Test on Vercel Preview)

- [ ] `/en/watch/[id]` shows video full-bleed, no Navbar/Footer
- [ ] Auth session preserved after route group change (locale cookie merge works)
- [ ] Supabase `watch_progress` rows updating every ~10s
- [ ] Episode switch via prev/next: iframe does NOT reload (Network tab shows no new iframe request)
- [ ] iOS Safari real device: no toolbar clipping
- [ ] `playsinline`: video does not open in iOS native player
- [ ] Back button navigates to series page (not app root)

## Sources

- Pitfalls researcher output (2026-05-05) — HIGH confidence
- youtube/iframe_api_reference (Google Developers)
- vaul GitHub (Temzasse/react-modal-sheet, Emil Kowalski)
- slick issue #564 — swipe over iframe (universal limitation)
- iOS 18 Safari dvh regression (Apple Developer Forums thread 803987)
- Next.js Discussion #75454 — back button App Router
- MDN popstate event

---
*Pitfalls research for: v2.2 fullscreen immersive watch page + swipe-up episode tray*
*Researched: 2026-05-05*
