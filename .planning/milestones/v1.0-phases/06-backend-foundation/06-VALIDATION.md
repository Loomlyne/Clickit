---
phase: 6
slug: backend-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) + Supabase CLI |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && supabase db push --dry-run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && supabase db push --dry-run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | FOUN-02 | schema | `supabase db push --dry-run` | n/a (checkpoint) | ⬜ pending |
| 06-01-02 | 01 | 1 | FOUN-02, FOUN-03, AUTH-05 | schema | `supabase db push --dry-run` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | FOUN-02, FOUN-03 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | AUTH-04, AUTH-05 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase` CLI installed as dev dependency
- [ ] `supabase/config.toml` — project configuration
- [ ] `.env.local` — Supabase project URL and anon key

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anon user can SELECT published shows | AUTH-04 | Requires running Supabase instance | Query shows table with anon key, verify published rows returned |
| Admin UUID check blocks non-admin writes | AUTH-05 | Requires auth context | Attempt INSERT as non-admin user, verify RLS rejection |
| Admin identified via app_config table | AUTH-05 (D-09) | Requires DB query | Verify is_admin() reads from app_config, UPDATE admin_user_id changes admin without migration |
| Storage bucket accepts uploads | FOUN-02 | Requires Storage API | Upload test image to shows/{uuid}/poster.webp, verify public URL works |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** reviewed (post-checker revision)
