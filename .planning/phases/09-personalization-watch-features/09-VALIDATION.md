---
phase: 9
slug: personalization-watch-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 9 — Validation Strategy

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
| 09-01-01 | 01 | 1 | USER-01, USER-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | USER-04, USER-06 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | USER-03, USER-05, USER-07 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 2 | WTCH-04 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Watchlist add/remove persists | USER-01 | Requires live Supabase + auth | Log in, add show to list, refresh, verify still in list |
| Watchlist button on cards | USER-02 | Requires visual verification | Check show cards and series detail hero have toggle button |
| My List shows watchlisted shows | USER-03 | Requires live data | Add shows, visit /my-list, verify grid |
| Progress saves every 10-15s | USER-04 | Requires YouTube playback | Play episode, wait 15s, navigate away, check watch_progress table |
| Continue watching rail | USER-05 | Requires playback history | Play episode partially, go home, verify rail shows episode with progress |
| Resume from saved position | USER-06 | Requires YouTube player | Click continue watching card, verify player seeks to saved time |
| Profile shows history | USER-07 | Requires playback history | Visit /profile, verify watchlist and recently watched sections |
| Autoplay next episode | WTCH-04 | Requires YouTube playback | Watch episode to end, verify countdown overlay, verify auto-navigation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
