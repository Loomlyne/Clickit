---
phase: 2
slug: app-shell-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E visual + interaction testing for Next.js) |
| **Config file** | `playwright.config.ts` (Wave 0 installs) |
| **Quick run command** | `npx playwright test --reporter=line` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --reporter=line`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | setup | 0 | infra | install | `npx playwright test --version` | ✅ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | NAVG-01 | e2e | `npx playwright test --grep "nav renders"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | NAVG-02 | e2e | `npx playwright test --grep "logo"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | NAVG-03 | e2e | `npx playwright test --grep "glass"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | NAVG-04, NAVG-05 | e2e | `npx playwright test --grep "responsive"` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | DESG-01 | e2e | `npx playwright test --grep "dark background"` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | DESG-06, DESG-10 | e2e | `npx playwright test --grep "spacing|glass"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/nav.spec.ts` — stubs for NAVG-01 through NAVG-05 (nav renders, logo visible, glass classes present, responsive viewport tests)
- [ ] `tests/e2e/layout.spec.ts` — stubs for DESG-01, DESG-06, DESG-10 (dark background, spacing, glass effect)
- [ ] `playwright.config.ts` — config with baseURL `http://localhost:3000`, single chromium project for speed
- [ ] `@playwright/test` install — if not detected in devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glass blur visual quality on real display | NAVG-03, DESG-10 | `backdrop-filter` rendering varies by GPU/browser; automated screenshot comparison is flaky for blur effects | Open localhost:3000, scroll content behind nav, verify blur and translucency look premium |
| Safari `backdrop-filter` compatibility | NAVG-03 | Playwright chromium-only suite won't catch Safari-specific backdrop-filter issues | Open in Safari (or use BrowserStack), verify glass effect renders — Safari requires `-webkit-backdrop-filter` |
| CIT logo SVG crispness at 32px | NAVG-02 | Pixel-level SVG rendering quality is display-dependent | Zoom to 200%, verify logo is sharp with no blur or aliasing on dark background |
| Auth state dropdown interaction feel | NAVG-05 | Dropdown animation timing and feel is subjective | Click avatar, verify dropdown opens with smooth 150ms fade+slide, verify items are readable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
