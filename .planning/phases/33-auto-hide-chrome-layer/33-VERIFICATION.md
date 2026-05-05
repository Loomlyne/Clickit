---
phase: 33-auto-hide-chrome-layer
verified: 2026-05-06T10:30:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Confirm SC4 pause behavior is acceptable — chrome hides after 3s while paused"
    expected: "ROADMAP SC4 says chrome ignores idle timer until playback resumes; implementation calls resetTimer() on pause which starts a fresh 3s countdown — after 3s without pointer/touch, chrome hides even while paused"
    why_human: "ROADMAP SC4 and UI-SPEC state machine conflict. UI-SPEC (approved design contract) shows resetTimer on state=2, not timer suppression. Developer must decide: accept resetTimer approach (close SC4 with override) or add isPaused guard to useIdleTimer"
  - test: "SC1 — verify 3s grace on entry is acceptable user experience"
    expected: "SC1 says 'on entry, chrome hidden' but isIdle starts false so chrome is visible for ~3s then fades. This is the explicit plan design (UI-SPEC: isIdle=false on mount). Confirm the 3s grace period matches user expectation or if SC1 needs reinterpretation"
    why_human: "ROADMAP SC1 says chrome hidden on entry; implementation shows it for 3s first. UI-SPEC deliberately chooses visible-on-mount. Developer confirmation needed to close SC1 gap or add override"
---

# Phase 33: Auto-Hide Chrome Layer Verification Report

**Phase Goal:** Provide accessible, non-intrusive chrome over the fullscreen player — top overlay and edge prev/next arrows appear on interaction and disappear after 3s idle, with strict no-overlap of YouTube's native control bar
**Verified:** 2026-05-06T10:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On entry, player is fully visible with chrome hidden — no top bar, no edge arrows | ? UNCERTAIN | `isIdle` starts `false` so chrome is visible on mount for ~3s before hiding. UI-SPEC explicitly approves this (isIdle=false on mount). ROADMAP SC1 says "chrome hidden." Conflict between SC and UI-SPEC. |
| 2 | Tapping/moving/key press fades chrome in within ~200ms — all elements reachable | ✓ VERIFIED | Root div wires `onPointerMove`, `onPointerDown`, `onTouchStart`, `onKeyDown` all to `resetTimer`. `chromeClass` uses `transition-opacity duration-200 ease-in-out`. Back link, title, badge, Bookmark, Heart, Share2, prev/next arrows all present in overlay. |
| 3 | After 3s no interaction, overlay and arrows fade out; hidden regions pass through | ✓ VERIFIED | `useIdleTimer(3000)` — `isIdle` flips true after 3000ms. `chromeClass` = `'opacity-0 pointer-events-none'` when idle — both classes always applied together, never split. |
| 4 | When paused (state=2), chrome stays visible and ignores idle timer until resume | ? UNCERTAIN | `onStateChange` state=2 calls `resetTimer()` which starts a fresh 3s countdown. After 3s of no pointer/touch interaction while paused, chrome hides. `useIdleTimer` has no isPaused guard. ROADMAP SC4 says "ignores the idle timer until playback resumes" — this is not satisfied. UI-SPEC state machine shows `state=2 → VISIBLE (resetTimer called)` which matches implementation but not SC4 wording. |
| 5 | Edge arrows at 50% viewport height, fade with overlay, disappear when no prev/next | ✓ VERIFIED | Prev: `fixed left-3 top-1/2 -translate-y-1/2 z-20`, conditional `{currentPrevEpisode && ...}`. Next: `fixed right-3 top-1/2 -translate-y-1/2 z-20`, conditional `{currentNextEpisode && ...}`. Both apply same `chromeClass`. |
| 6 | Prev/next taps swap episodes via `loadVideoById()`, same iframe, progress continues | ✓ VERIFIED | `handleEpisodeSwitch` calls `playerRef.current.loadVideoById(...)` at line 128. Same `playerRef` used, no iframe remount. `useProgressTracker` uses `currentEpisode.id` (state), updated before `loadVideoById` call. |

**Score:** 4/6 truths fully verified (2 uncertain pending human decision)

### Deferred Items

None — all items are within Phase 33 scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/use-idle-timer.ts` | useIdleTimer hook | ✓ VERIFIED | 28 lines, exports `useIdleTimer`, bare `setTimeout`/`clearTimeout`, `ReturnType<typeof setTimeout>`, `useCallback([delay])`, `isIdle` starts false, cleanup in useEffect. Commits c10c0e8 and f854d05 confirmed. |
| `src/components/watch/watch-shell.tsx` | Full chrome overlay with idle wiring | ✓ VERIFIED | useIdleTimer(3000) called, chromeClass derived, currentPrevEpisode state, findPrevEpisode(), interaction handlers on root div, top overlay, prev/next arrows, useWatchlist, useLikes, handleShare. |
| `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` | SSR initial watchlist/likes state | ✓ VERIFIED | Two-wave fetch: getShowWatchlistState + getShowLikeState in second wave. `initialSaved={inWatchlist}` and `initialLiked={isLiked}` passed to WatchShell. Commits ececf4d and d409b51 confirmed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `watch-shell.tsx` | `use-idle-timer.ts` | `useIdleTimer(3000)` | ✓ WIRED | Import + call confirmed; `{ isIdle, resetTimer }` destructured and both consumed |
| `watch-shell.tsx` | `use-watchlist.ts` | `useWatchlist(show.id, initialSaved, userId ?? null)` | ✓ WIRED | Import + call + `isInList`/`toggleWatchlist` consumed in Bookmark button |
| `watch-shell.tsx` | `use-likes.ts` | `useLikes(show.id, initialLiked, userId ?? null)` | ✓ WIRED | Import + call + `isShowLiked`/`toggleLike` consumed in Heart button |
| `page.tsx` | `watch-shell.tsx` | `initialSaved + initialLiked props` | ✓ WIRED | Both props threaded from server-fetched values to WatchShell JSX |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `watch-shell.tsx` (Bookmark) | `isInList` | `useWatchlist` → Supabase `getShowWatchlistState` via `initialSaved` SSR seed | Yes — SSR-seeded from DB, mutations go to Supabase via existing hook | ✓ FLOWING |
| `watch-shell.tsx` (Heart) | `isShowLiked` | `useLikes` → Supabase `getShowLikeState` via `initialLiked` SSR seed | Yes — SSR-seeded from DB, mutations go to Supabase via existing hook | ✓ FLOWING |
| `watch-shell.tsx` (episode title/badge) | `currentEpisode`, `seasonNumber` | `useState(episode)` seeded from SSR prop + updated by `handleEpisodeSwitch` | Yes — live state updates on episode switch | ✓ FLOWING |
| `watch-shell.tsx` (prev/next arrows) | `currentPrevEpisode`, `currentNextEpisode` | State recalculated via `findPrevEpisode`/`findNextEpisode` on every `handleEpisodeSwitch` | Yes — derived from real `episodesBySeason` data | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — watch page requires a live browser with YouTube IFrame API. Cannot test idle timer fade behavior, episode switch, or player state callbacks without running a browser session.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHROME-01 | 33-01, 33-02 | Top overlay fades in on tap/pointer-move, fades out after 3s idle; pointer-events:none when hidden | ✓ SATISFIED | Overlay at `fixed top-0 left-0 right-0 z-20`, `chromeClass` applies opacity+pointer-events together, `transition-opacity duration-200`. All interactive elements present with correct tabIndex guard. |
| CHROME-02 | 33-01, 33-02 | Left/right edge arrows at 50% viewport height, fade with chrome, hidden when no prev/next | ✓ SATISFIED | Prev: `fixed left-3 top-1/2 -translate-y-1/2 z-20` conditional on `currentPrevEpisode`. Next: `fixed right-3 top-1/2 -translate-y-1/2 z-20` conditional on `currentNextEpisode`. Both use `chromeClass`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `watch-shell.tsx` | 76 | `navigator.share({ url: window.location.href })` — `window.` access inside function body | Info | `handleShare` is only called from onClick (client event), never on SSR render. Safe pattern — no SSR risk. |

No placeholder text, no hardcoded empty returns, no TODO/FIXME, no `← Back` placeholder. Accent color `#ffcc00` absent from all overlay classes.

### Human Verification Required

#### 1. SC4 — Pause Behavior: Timer Suppression vs. Timer Reset

**Test:** Open watch page, start playing, then pause via YouTube controls. Wait more than 3 seconds without moving pointer or touching screen.
**Expected per ROADMAP SC4:** Chrome (top overlay + arrows) stays visible continuously while paused — timer is suppressed, not restarted.
**Actual behavior:** `resetTimer()` is called on `state=2`, starting a fresh 3s countdown. After 3s of no pointer/touch, chrome hides even while paused.
**Why human:** The UI-SPEC state machine (the approved design contract for this phase) says `state=2 → VISIBLE (resetTimer called)` — matching the implementation, not SC4. ROADMAP and UI-SPEC conflict. Developer must decide:

- **Accept current behavior** (resetTimer on pause = 3s grace, then hides): Add override to close SC4
- **Fix to match SC4 exactly** (timer suppressed while paused): Add `isPaused` ref to `useIdleTimer` that skips the `setIsIdle(true)` callback when paused

If accepting current behavior, add to VERIFICATION.md frontmatter:
```yaml
overrides:
  - must_have: "When YouTube player enters paused state (onStateChange state=2), chrome stays visible and ignores idle timer until playback resumes"
    reason: "UI-SPEC approved resetTimer() on pause (3s grace then hide). ROADMAP wording 'ignores idle timer' was aspirational; design contract chose timer-reset over suppression for simpler UX."
    accepted_by: "koss"
    accepted_at: "2026-05-06T00:00:00Z"
```

#### 2. SC1 — Entry State: Chrome Visible for 3s Then Hidden

**Test:** Navigate directly to a `/watch/[id]` URL and observe chrome state immediately on page load.
**Expected per ROADMAP SC1:** Chrome is hidden on entry — only YouTube controls visible.
**Actual behavior:** `isIdle` starts `false`, so chrome is visible on mount for ~3s then fades. This is explicitly designed in the UI-SPEC ("Initial state: isIdle = false — chrome visible on mount").
**Why human:** The plan deliberately chose chrome-visible-on-entry as a UX accommodation (user needs to see the back button and episode info briefly on load). ROADMAP SC1 says "chrome hidden." Developer must confirm this tradeoff is acceptable.

If accepting current behavior:
```yaml
overrides:
  - must_have: "On entry, player is fully visible with chrome hidden — no top bar, no edge arrows"
    reason: "UI-SPEC chose isIdle=false on mount for UX: user sees episode context for 3s on load, then chrome auto-hides. ROADMAP SC1 was written before UI-SPEC finalized entry behavior."
    accepted_by: "koss"
    accepted_at: "2026-05-06T00:00:00Z"
```

### Gaps Summary

No hard blockers detected. Both gaps are ROADMAP-vs-UI-SPEC conflicts where the approved design contract (UI-SPEC) was written after the ROADMAP success criteria and chose a slightly different behavior. The implementation faithfully follows the UI-SPEC. Human decision needed to either accept with overrides or add an `isPaused` guard to `useIdleTimer`.

The core deliverables — auto-hide chrome, pointer-events:none passthrough, episode navigation via loadVideoById, initial watchlist/likes state from SSR, no accent color, no placeholder back link — are all fully implemented and wired.

---

_Verified: 2026-05-06T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
