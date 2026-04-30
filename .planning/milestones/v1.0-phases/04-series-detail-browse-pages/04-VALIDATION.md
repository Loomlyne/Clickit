---
phase: 4
slug: series-detail-browse-pages
status: active
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | `playwright.config.ts` (exists, chromium-only project) |
| **Quick run command** | `npx playwright test tests/e2e/series-detail.spec.ts tests/e2e/coming-soon.spec.ts --project=chromium` |
| **Full suite command** | `npx playwright test --project=chromium` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/e2e/series-detail.spec.ts tests/e2e/coming-soon.spec.ts --project=chromium`
- **After every plan wave:** Run `npx playwright test --project=chromium`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CATL-03 (data) | unit-ish | `npx tsx -e "require('./src/lib/mock-data')"` | n/a (inline) | ⬜ pending |
| 04-01-02 | 01 | 1 | CATL-03 (hero) | typecheck | `npx tsc --noEmit src/components/series/series-detail-hero.tsx` | n/a | ⬜ pending |
| 04-01-03 | 01 | 1 | CATL-05, CATL-06 | typecheck | `npx tsc --noEmit src/components/series/episode-row.tsx` | n/a | ⬜ pending |
| 04-02-01 | 02 | 2 | CATL-03, CATL-04, CATL-05, CATL-06 | e2e | `npx playwright test tests/e2e/series-detail.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CATL-03, CATL-04, CATL-05, CATL-06 | e2e | `npx playwright test tests/e2e/series-detail.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | CATL-07 | e2e | `npx playwright test tests/e2e/coming-soon.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | CATL-07 | e2e | `npx playwright test tests/e2e/coming-soon.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/series-detail.spec.ts` — stubs for CATL-03, CATL-04, CATL-05, CATL-06 (created in Plan 02 Task 2)
- [ ] `tests/e2e/coming-soon.spec.ts` — stubs for CATL-07 (created in Plan 03 Task 2)

No framework install needed -- Playwright already configured and working (tests exist for Phase 2 and 3).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero ambient glow matches home page hero glow visually | CATL-03 | Visual comparison of gradient quality | Deploy to Vercel, compare /series/last-call hero glow with home page hero glow side-by-side |
| Episode row hover states feel responsive and cinematic | CATL-05 | Subjective interaction quality | Hover over published episode rows, verify smooth bg transition and play overlay fade-in |
| Season selector adaptive switch renders correctly | CATL-04 | Visual weight of tabs vs dropdown | Verify tabs for 2-season shows look balanced; would need 6+ season show to test dropdown (Saturn Podcast has 3) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
