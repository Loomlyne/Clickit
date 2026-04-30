---
phase: 3
slug: home-page-catalog-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | DESG-02 | lint | `npx tsc --noEmit` | ✅ / ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | CATL-01 | lint | `npx tsc --noEmit` | ✅ / ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | CATL-02 | lint | `npx tsc --noEmit` | ✅ / ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | DESG-03 | lint | `npx tsc --noEmit` | ✅ / ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | DESG-04 | lint | `npx tsc --noEmit` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx vitest run` exits 0 on empty test suite (no test runner errors)
- [ ] `npx tsc --noEmit` exits 0 (TypeScript baseline clean)
- [ ] `motion` and `embla-carousel-react` installed (`package.json` contains both)
- [ ] shadcn `Card` and `Carousel` components added via CLI

*Phase 3 is primarily visual/UI — automated tests validate TypeScript correctness and build health; visual behaviors require manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero auto-rotation at 6s interval | CATL-01 | CSS/JS timing, no DOM assertion | Load `/`, observe slide transitions every 6s |
| Card hover scale (1.05) + overlay | DESG-04 | Visual CSS transform | Hover a show card, verify scale and overlay appear |
| Horizontal scroll drag on mobile | CATL-02 | Touch gesture | DevTools mobile mode, drag rail left/right |
| Brand color ribbon per show | DESG-03 | Per-show color accuracy | Verify each card ribbon matches show's brand color |
| Hero ambient glow matches show color | DESG-05 | Radial gradient accuracy | Verify glow color matches current slide's brand color |
| Reduced motion compliance | DESG-09 | Requires OS prefers-reduced-motion | Enable OS reduced motion, verify animations are minimal |
| Empty state renders | CATL-10 | Requires 0-show data state | Mock empty show array, verify empty state component |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
