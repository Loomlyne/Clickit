---
phase: 1
slug: project-scaffolding-design-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (Phase 1 — no test framework installed yet) |
| **Config file** | none — Phase 1 scaffolding |
| **Quick run command** | `npx next build` |
| **Full suite command** | `npx next build && npx eslint .` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Run `npx next build && npx eslint .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Scaffolding | 01 | 1 | FOUN-01 | build | `npx next build` | ❌ W0 | ⬜ pending |
| Design tokens | 01 | 1 | FOUN-04 | build + grep | `npx next build && grep '@theme' src/styles/globals.css` | ❌ W0 | ⬜ pending |
| Typography | 01 | 1 | FOUN-04 | build | `npx next build` | ❌ W0 | ⬜ pending |
| Test page | 01 | 1 | FOUN-04 | build + manual | `npx next build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Next.js project initialized — `npx next build` must succeed
- [ ] ESLint configured — `npx eslint .` must run without config errors

*Phase 1 IS the scaffolding — Wave 0 and Wave 1 are effectively the same.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual brand fidelity | FOUN-04 | Color rendering and typography hierarchy require visual inspection | Open /design-system/colors and /design-system/typography in browser, compare against CIT brand guideline |
| WCAG AA contrast | FOUN-04 | Contrast ratios need visual/tool verification | Check computed tint colors against dark backgrounds using browser devtools or axe |
| Interactive states | FOUN-04 | Hover/focus states require interaction | Manually hover/focus buttons on /design-system/components, verify visual feedback |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
