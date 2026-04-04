---
phase: 8
slug: data-integration-auth-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | AUTH-01 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | AUTH-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | AUTH-03 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 1 | SRCH-01 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 1 | SRCH-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-02-03 | 02 | 1 | SRCH-03 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signup creates account | AUTH-01 | Requires live Supabase | Sign up with test email, verify profile row created |
| Session persists on refresh | AUTH-02 | Requires browser session | Log in, refresh page, verify still logged in |
| Sign out from any page | AUTH-03 | Requires browser session | Navigate to series page, sign out via dropdown, verify redirect to home |
| Search finds shows by title | SRCH-02 | Requires live Supabase FTS | Type show title in search, verify show card in results |
| Search results show thumbnails | SRCH-03 | Requires visual verification | Verify cards display artwork/thumbnails |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
