---
phase: 10
slug: connect-frontend-to-supabase-backend-wire-auth-replace-mock-data-with-real-queries-session-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` + Vercel deploy
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification at each catalog stage
- **Max feedback latency:** 15 seconds (tsc), minutes (Vercel deploy)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | D-04 | unit-like | `npx tsc --noEmit` | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | D-01 | manual | Deploy to Vercel, delete all shows, visit /browse | N/A | ⬜ pending |
| 10-02-01 | 02 | 1 | D-02 | manual | Deploy to Vercel, create show with no seasons, visit /series/[slug] | N/A | ⬜ pending |
| 10-03-01 | 03 | 1 | D-03 | manual | Deploy to Vercel, check CTA at 0/3/6+ shows | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework beyond tsc is used in this project. All verification is manual via Vercel deploy (per project memory: "Always deploy to Vercel for checkpoints/verification, never localhost").

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browse redirects when empty catalog | D-01 | Requires real Supabase state (0 shows) | Deploy to Vercel, delete all shows from admin, visit /browse, verify redirect to / |
| Series page shows text empty state | D-02 | Visual verification of typography/spacing | Deploy to Vercel, create show with no seasons, visit /series/[slug], verify text-only empty state |
| CtaBanner shows stage-appropriate copy | D-03 | Three visual states to verify | Deploy to Vercel, check CTA at 0 shows (zero), 3 shows (growing), 6+ shows (full) |
| getCatalogStage returns correct stage | D-04 | Type-checks only; runtime behavior verified through D-03 | `npx tsc --noEmit` verifies return type matches `{ stage: 'zero' \| 'growing' \| 'full', showCount: number }` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
