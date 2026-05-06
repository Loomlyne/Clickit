---
status: partial
phase: 32-watch-route-isolation-fullscreen-shell
source: [32-VERIFICATION.md]
started: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Fullscreen viewport — no Navbar/Footer/Silk/Ticker chrome
expected: Black fullscreen viewport, YouTube iframe edge-to-edge. Zero matches for `.navbar`, `[data-silk]`, `marquee-ticker` in DOM. No Navbar/Footer/Silk/Ticker visible.
steps: Run `npm run dev`. Navigate to `/en/watch/[any-valid-episodeId]` in Chrome. Open DOM Inspector.
result: [pending]

### 2. In-place episode switch — no iframe remount (WATCH-05)
expected: NO new `youtube.com/embed` network request fires on episode switch. Iframe node keeps same identity in DOM Inspector. URL bar updates to `/en/watch/[next-episode-id]`. No black flash.
steps: Open Chrome DevTools → Network tab, filter to `youtube.com/embed`. Play episode near end (or seek to 95%). Wait for AutoplayOverlay. Click "Play Now".
result: [pending]

### 3. Continue-watching survival across episode switches (WATCH-06)
expected: Episode A resumes at previously saved offset after switch flushed A's progress before swapping to B.
steps: Play episode A to ~25s → pause → wait 10s → refresh (confirm resume at ~20-30s). Then: play A → autoplay to B → navigate URL back to A → refresh (confirm A resumes at saved offset).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
