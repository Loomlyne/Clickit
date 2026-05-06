---
status: partial
phase: 33-auto-hide-chrome-layer
source: [33-VERIFICATION.md]
started: "2026-05-06T10:30:00Z"
updated: "2026-05-06T10:30:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC4 — Pause behavior: chrome hides after 3s while paused
expected: ROADMAP says chrome "ignores idle timer until playback resumes." Implementation calls `resetTimer()` on `state=2`, starting a fresh 3s countdown — after 3s without pointer/touch while paused, chrome hides. UI-SPEC explicitly documents `state=2 → VISIBLE (resetTimer called)` (not timer suppression). Developer confirms this tradeoff is acceptable (UI-SPEC wins) or requests `isPaused` guard added to `useIdleTimer`.
result: [pending]

### 2. SC1 — Entry state: chrome visible for ~3s on load
expected: ROADMAP SC1 says "on entry, chrome hidden." `isIdle` starts `false` so chrome is visible ~3s on load then fades. UI-SPEC deliberately chose `isIdle=false` on mount as UX decision (user sees episode context on load). Developer confirms 3s grace period is acceptable.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
