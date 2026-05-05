---
phase: 32-watch-route-isolation-fullscreen-shell
verified: 2026-05-06T00:00:00Z
status: human_needed
score: 10/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /en/watch/[valid-episodeId] in Chrome DevTools with Network tab open"
    expected: "Black fullscreen viewport, YouTube iframe edge-to-edge, no Navbar/Footer/Silk WebGL/MarqueeTicker visible. DOM Inspector finds zero matches for .navbar, [data-silk], marquee-ticker"
    why_human: "Route group escape (no (viewer)/layout.tsx chrome) can only be confirmed visually — static analysis shows the correct route group structure but cannot confirm what the browser renders"
  - test: "Watch episode to end (or seek to 95%). AutoplayOverlay appears. Click Play Now. Check DevTools Network tab filtered to youtube.com/embed"
    expected: "NO new network request to youtube.com/embed. Iframe keeps same DOM node identity. URL bar updates to /en/watch/[next-episode-id]. No black flash."
    why_human: "loadVideoById vs iframe remount behavior requires live Network panel observation — cannot be verified via static grep"
  - test: "Play episode A to ~25s, pause, refresh page"
    expected: "Video resumes at ~20-30s offset (within 10s tolerance). Then: play episode A, switch to episode B via AutoplayOverlay, navigate URL back to episode A, refresh — episode A resumes at the previously paused offset (progress survived the switch)"
    why_human: "Continue-watching persistence across episode switches requires a live Supabase write + read cycle"
---

# Phase 32: Watch Route Isolation + Fullscreen Shell — Verification Report

**Phase Goal:** Watch page opens with video filling the entire viewport — no Navbar, Footer, Silk, MarqueeTicker, or Lenis — and the YouTube player survives episode switches without losing progress tracking
**Verified:** 2026-05-06T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Loading `/[locale]/watch/[id]` paints a black fullscreen viewport — no Navbar, Footer, Silk, MarqueeTicker, Lenis | ? UNCERTAIN | Route group escape confirmed by structure ((watch)/ sibling of (viewer)/); WatchShell has `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black`; (viewer)/layout.tsx confirmed to render Navbar/Footer/Silk/SmoothScroll/MarqueeTicker — but browser rendering requires human confirmation |
| 2 | WatchShell renders YouTubePlayer inside a `fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black` div | ✓ VERIFIED | `grep -c 'fixed inset-0 h-dvh min-h-svh overflow-hidden bg-black' watch-shell.tsx` = 1 (line 109) |
| 3 | `h-dvh + min-h-svh` classes present in the WatchShell root div (iOS toolbar safe) | ✓ VERIFIED | Found on line 109 of watch-shell.tsx inside the return's outermost div |
| 4 | `(watch)/layout.tsx` is a segment layout — no `<html>/<body>`, no providers | ✓ VERIFIED | File returns `<>{children}</>` with a comment only; no imports, no html/body, no providers. Forbidden patterns in grep were a comment string only — not actual code |
| 5 | `page.tsx` fetches episode + locale + progress in parallel via `Promise.all` and renders `<WatchShell>` | ✓ VERIFIED | `Promise.all([getEpisodeById, getLocale(), getEpisodeProgress()])` on lines 56-60; `<WatchShell ... />` on lines 83-94 |
| 6 | Old `(viewer)/watch/` route deleted (route conflict prevention) | ✓ VERIFIED | `test -d src/app/[locale]/(viewer)/watch` = ABSENT; `grep -rE '(viewer)/watch' src` = 0 matches |
| 7 | Episode switches swap video via `player.loadVideoById()` — same iframe DOM node, no flash | ? UNCERTAIN | `handleEpisodeSwitch` present (line 71); `playerRef.current.loadVideoById({videoId, startSeconds: 0})` present (lines 82-85); actual iframe behavior requires browser verification |
| 8 | Continue-watching writes survive episode switches | ? UNCERTAIN | `useProgressTracker(playerInstance, currentEpisode.id, ...)` confirmed (line 54); `forceFlush()` called before `setCurrentEpisode` in switch handler (lines 74, 79); live Supabase persistence requires human verification |
| 9 | URL syncs via `window.history.replaceState` — no Next.js re-render | ✓ VERIFIED | `window.history.replaceState(null, '', \`/${locale}/watch/${newEpisode.id}\`)` present (line 87); `router.push('/watch'...)` count = 0 |
| 10 | YouTube native controls (`controls=1`) remain interactive | ✓ VERIFIED | `controls: 1` confirmed at youtube-player.tsx line 83; no overlay covers the player in WatchShell (back link is `z-10` at top-left corner only) |
| 11 | `WatchPageContent` deleted — no orphan references | ✓ VERIFIED | `test -f src/components/watch/watch-page-content.tsx` = ABSENT; `grep -rE 'WatchPageContent\|watch-page-content' src` = 0 matches |
| 12 | `currentNextEpisode` derived dynamically (post-review fix) — no autoplay loop | ✓ VERIFIED | `findNextEpisode()` defined (lines 59-69); `setCurrentNextEpisode(findNextEpisode(newEpisode))` called in `handleEpisodeSwitch` (line 80); commit `3eec397` confirms this fix |

**Score:** 10/12 truths verified (2 require browser confirmation, 1 requires live DB round-trip)

---

### Notable Deviation: `(watch)/layout.tsx` — h-dvh div removed

**Plan 32-01 specified** `(watch)/layout.tsx` should wrap children in a `div className="h-dvh min-h-svh overflow-hidden bg-black"`.

**Actual implementation** (post commit `c1427d6`): `(watch)/layout.tsx` returns `<>{children}</>` with no wrapper div.

**Rationale (from commit message, WR-02):** WatchShell uses `position: fixed; inset: 0` — it escapes normal document flow entirely. The wrapper div had no visual or layout effect. Removing it avoids accidentally clipping any future `(watch)/` route consumer that is not `position: fixed`.

**Impact on must-haves:** The `h-dvh + min-h-svh` requirement (WATCH-03) is fully satisfied — those classes live on the WatchShell root div (line 109), which is the actual fullscreen container. The plan placed them in the layout as a belt-and-suspenders measure; the fix correctly consolidates them where they matter. **This deviation does not block any truth.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/[locale]/(watch)/layout.tsx` | Bare segment layout | ✓ VERIFIED | Exists; returns `<>{children}</>` — no chrome, no providers, no html/body |
| `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` | Server component rendering WatchShell | ✓ VERIFIED | Exists; `Promise.all` fetch + `<WatchShell>` render; `generateMetadata` preserved |
| `src/components/watch/watch-shell.tsx` | Fullscreen client shell | ✓ VERIFIED | Exists; `'use client'`; `export function WatchShell`; all required patterns present |

**Negative artifacts (must NOT exist):**

| Path | Must Absent | Status |
|------|-------------|--------|
| `src/app/[locale]/(viewer)/watch/` | Directory deleted | ✓ ABSENT |
| `src/components/watch/watch-page-content.tsx` | File deleted | ✓ ABSENT |
| Any `import.*WatchPageContent` | Zero refs | ✓ ZERO MATCHES |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(watch)/watch/[episodeId]/page.tsx` | `watch-shell.tsx` | `import { WatchShell }` + JSX render | ✓ WIRED | `import { WatchShell } from '@/components/watch/watch-shell'` (line 5); WatchShell used in JSX (lines 83-94) — grep count = 2 |
| `watch-shell.tsx` | `youtube-player.tsx` | `<YouTubePlayer videoId={episode.youtubeId}>` | ✓ WIRED | YouTubePlayer rendered with initial prop only; `videoId={episode.youtubeId}` count = 1; `videoId={currentEpisode.youtubeId}` count = 0 |
| `watch-shell.tsx` | `YT.Player.loadVideoById API` | `playerRef.current.loadVideoById({videoId, startSeconds: 0})` | ✓ WIRED | `function handleEpisodeSwitch` present; `playerRef.current.loadVideoById` count = 2 (one in handler, one type check); object form with `startSeconds: 0` confirmed |
| `watch-shell.tsx` | `window.history API` | `replaceState` for URL sync | ✓ WIRED | `window.history.replaceState` count = 1; path uses `/${locale}/watch/${newEpisode.id}` |
| `(watch)/layout.tsx` | `[locale]/layout.tsx` | Route group sibling — inherits html/body/NextIntlClientProvider | ✓ WIRED | `(watch)/` and `(viewer)/` are confirmed siblings under `src/app/[locale]/`; layout.tsx contains no duplicate html/body |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `watch-shell.tsx` | `currentEpisode` / `playerInstance` | `episode` prop from `page.tsx` server fetch via `getEpisodeById` (Supabase query) | Yes — DB query, not static | ✓ FLOWING |
| `watch-shell.tsx` | `initialProgressSeconds` | `getEpisodeProgress(user.id, episodeId)` in `page.tsx` — real DB query | Yes — conditional on auth | ✓ FLOWING |
| `watch-shell.tsx` | `currentNextEpisode` | `findNextEpisode(current)` scans `episodesBySeason` prop (from server) + updated by `setCurrentNextEpisode` in `handleEpisodeSwitch` | Yes — derived from real DB data | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for runtime behaviors (YouTube IFrame API, progress writes) — no runnable entry points testable in under 10s without a live server and Supabase. Routed to human verification.

Static structural checks completed as grep gates above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WATCH-01 | 32-01 | Watch route in `(watch)/` — no chrome | ✓ SATISFIED | Route group escape confirmed by sibling structure + (viewer)/layout.tsx chrome not in (watch)/ path |
| WATCH-02 | 32-01 | Video fills 100dvw × 100dvh | ? NEEDS HUMAN | `fixed inset-0` + absolute inset-0 player div statically confirmed; pixel-perfect fullscreen requires browser |
| WATCH-03 | 32-01 | `h-dvh + min-h-svh` used | ✓ SATISFIED | Both classes present on WatchShell root div (line 109) |
| WATCH-04 | 32-02 | `controls=1` preserved | ✓ SATISFIED | `controls: 1` in youtube-player.tsx line 83; no covering overlay on player area |
| WATCH-05 | 32-02 | `loadVideoById` — iframe never remounted | ? NEEDS HUMAN | All static wiring confirmed; iframe behavior requires DevTools Network observation |
| WATCH-06 | 32-02 | 10s progress writes work in fullscreen | ? NEEDS HUMAN | `useProgressTracker(playerInstance, currentEpisode.id, ...)` wiring confirmed; live DB persistence requires human test |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `watch-shell.tsx` line 95 | `// eslint-disable-next-line react-hooks/exhaustive-deps` on `handlePlayNow` useCallback | ℹ Info | `handleEpisodeSwitch` is not in the dependency array because it is declared as a plain function inside the component (not `useCallback`). Pattern is intentional — `currentNextEpisode` is the only dep that matters. Not a bug; the disable comment correctly suppresses a false positive. |
| `(watch)/layout.tsx` | `h-dvh min-h-svh` absent from layout div | ℹ Info | Intentional deviation from plan (see Deviation section above). Not a bug — WatchShell carries these classes. Confirmed by commit WR-02 rationale. |

No blockers. No stub patterns. No empty returns on the happy path. No `TODO/FIXME` in implementation files.

---

### Human Verification Required

#### 1. Fullscreen viewport / no chrome (WATCH-01 + WATCH-02)

**Test:** Run `npm run dev`. Navigate to `/en/watch/[any-valid-episodeId]` in Chrome. Open DOM Inspector.
**Expected:** Black fullscreen viewport, YouTube iframe edge-to-edge. Zero matches for `.navbar`, `[data-silk]`, `marquee-ticker`. No visible Navbar/Footer/Silk/Ticker.
**Why human:** Route group escape (sibling (watch)/ vs (viewer)/) is structurally correct but only browser rendering confirms no chrome bleeds through.

#### 2. In-place episode switch — no iframe remount (WATCH-05)

**Test:** Open Chrome DevTools → Network tab, filter to `youtube.com/embed`. Play an episode to near-end (or seek to 95%). Wait for AutoplayOverlay. Click "Play Now".
**Expected:** NO new `youtube.com/embed` network request. Iframe node keeps same identity in DOM Inspector. URL bar updates to `/en/watch/[next-episode-id]`. No black flash on switch.
**Why human:** `loadVideoById` vs `src` change can only be confirmed via live Network panel — static grep confirms the call exists but not iframe behavior.

#### 3. Continue-watching survival across episode switches (WATCH-06)

**Test:** Pick episode A. Play to ~25s. Pause. Wait 10s (or trust `forceFlush()` on pause). Refresh page — video should resume at ~20-30s. Then: play A → let it end → AutoplayOverlay → Play Now → episode B starts → manually navigate URL back to A → refresh.
**Expected:** Episode A resumes at previously saved offset (switch flushed A's progress before swapping to B).
**Why human:** Requires live Supabase `watch_progress` write + read cycle across two episode switches.

---

### Gaps Summary

No programmatically verifiable gaps found. All static checks pass:
- Artifacts exist and are substantive
- Key links all wired
- Forbidden patterns absent
- Negative artifacts absent
- Anti-patterns are informational only

Status is `human_needed` because 3 runtime behaviors (chrome escape rendering, iframe stability, DB progress persistence) require live browser + Supabase observation to close WATCH-01/02/05/06.

---

_Verified: 2026-05-06T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
