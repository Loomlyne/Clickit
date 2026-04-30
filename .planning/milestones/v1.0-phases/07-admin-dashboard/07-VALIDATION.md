---
phase: 7
slug: admin-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright ^1.58.2 (E2E only) + `npx tsc --noEmit` (type checking) |
| **Config file** | Not present — Wave 0 runs type checking only |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && next build` |
| **Estimated runtime** | ~30 seconds (tsc) / ~90 seconds (tsc + build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && next build`
- **Before `/gsd:verify-work`:** Full suite must be green + Vercel deploy + manual admin CRUD walkthrough
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-??-01 | 01 | 0 | ADMN-01 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 7-??-02 | 01 | 0 | ADMN-02 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 7-??-03 | 01 | 0 | ADMN-03 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 7-??-04 | 01 | 0 | ADMN-04 | type-check | Zod enum coverage via tsc | ❌ W0 | ⬜ pending |
| 7-??-05 | 01 | 0 | ADMN-05 | type-check | Zod enum coverage via tsc | ❌ W0 | ⬜ pending |
| 7-??-06 | 01 | 0 | ADMN-06 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 7-??-07 | 01 | 0 | ADMN-07 | type-check | Zod schema coverage via tsc | ❌ W0 | ⬜ pending |
| 7-??-08 | 01 | 0 | ADMN-08 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 7-??-09 | 01 | 0 | ADMN-09 | unit | `npx tsc --noEmit` (utility function type safety) | ❌ W0 | ⬜ pending |
| 7-??-10 | 01 | 0 | ADMN-10 | type-check | `npx tsc --noEmit` (layout type safety) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install shadcn components: `npx shadcn@latest add sheet dialog table field`
- [ ] DB migration: add `archived boolean DEFAULT false` to `shows` and `episodes` tables
- [ ] `src/lib/youtube.ts` — `extractYouTubeId(url: string): string | null` utility (unit-testable)
- [ ] Route group restructure: move viewer pages into `(viewer)` group so admin layout can have its own shell without Navbar/Footer

*These Wave 0 items are prerequisites — plans cannot be executed until they are complete.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create/edit/delete show | ADMN-01 | No E2E runner in agents; requires Vercel deploy | Log in as admin, create show, verify appears in list; edit title, verify updated; archive, verify moves to archive table |
| Create/edit/delete season | ADMN-02 | Requires Vercel deploy | Navigate to show detail, add season, verify tab appears; edit season title, verify updated |
| Create/edit/delete episode | ADMN-03 | Requires Vercel deploy | Add episode to a season, verify in episode list; edit YouTube URL, verify extracted ID updates |
| Artwork upload to Storage | ADMN-06 | Requires Supabase Storage + Vercel deploy | Upload poster/hero/logo images, verify public URLs resolve in browser, verify reflected on viewer-facing show page |
| Episode reorder | ADMN-08 | Requires Vercel deploy | Add 3 episodes, use up/down arrows to change order, verify `episode_number` changes persist after page reload |
| Admin route protection | ADMN-10 | Auth flow requires browser session | Log in as non-admin user, navigate to `/admin`, verify redirect to `/`; log in as admin, verify access granted |
| Broadcast schedule display | ADMN-07 | Requires Vercel deploy | Set broadcast day and time for a show, verify stored correctly and displayed correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
