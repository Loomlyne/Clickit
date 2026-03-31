---
phase: 05
slug: watch-page-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (chromium-only) + TypeScript compiler |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` (Playwright tests written but run on Vercel deploy) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | WTCH-01 | compile + e2e | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | WTCH-02 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | WTCH-03, WTCH-06 | compile + e2e | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | WTCH-05 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/watch-page.spec.ts` — E2E stubs for watch page
- [ ] Existing `playwright.config.ts` infrastructure reused

*Existing infrastructure covers test framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| YouTube player loads and plays video | WTCH-01 | Requires live YouTube API + browser | Navigate to /watch/[episodeId], verify player loads |
| No overlays on YouTube player | WTCH-05 | Visual inspection needed | Verify no UI covers the player iframe during playback |
| Episode quick-selector switches episodes | WTCH-06 | Requires browser interaction | Use season tabs, click different episode, verify player updates |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
