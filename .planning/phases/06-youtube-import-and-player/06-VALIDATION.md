---
phase: 6
slug: youtube-import-and-player
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `06-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` with `--experimental-strip-types` (no vitest/jest). Playwright e2e is Phase 8 (QA-01). |
| **Config file** | none — `package.json` script `test:unit` |
| **Quick run command** | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/youtube-*.test.ts tests/unit/watch-*.test.ts tests/unit/admin-renumber.test.ts` |
| **Full suite command** | `npm run test:unit`; phase gate `npm run gate:local` under `/Users/koss/.clickit-heavy.lock` |
| **Estimated runtime** | ~20 seconds (unit); gate several minutes |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched module
- **After every plan wave:** `npm run test:unit`
- **Before `/gsd-verify-work`:** `npm run gate:local` green plus the controller's clean-clone check
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled per task by the planner in each PLAN.md (`<automated>` blocks). Requirement-level map:

| Requirement | Behavior proved | Test Type | Test file | File Exists | Status |
|-------------|-----------------|-----------|-----------|-------------|--------|
| YT-01 | Playlist URL parsing; paging past 50; batches of 50; ISO duration; preview writes nothing | unit (fake fetch, fake db) | `tests/unit/youtube-urls.test.ts`, `youtube-client.test.ts`, `youtube-duration.test.ts`, `youtube-import.test.ts` | ❌ W0 | ⬜ pending |
| YT-02 | `classifyVideo` truth table (private, removed, not ready, not embeddable, AE blocked/not allowed, unlisted ok); re-import adds nothing; drafts only; numbering after max incl. archived; script routing + needs-English flag; tampered commit refused; mid-commit failure rolls back | unit | `youtube-status.test.ts`, `youtube-import.test.ts`, `youtube-script.test.ts` | ❌ W0 | ⬜ pending |
| YT-03 | Single id: bad format refused before fetch; missing/private/not embeddable/AE refused with plain message; duplicate mapped to "already on Clickit" | unit | `youtube-verify.test.ts` | ❌ W0 | ⬜ pending |
| YT-04 | Key resolver (Worker secret only; empty = missing); errors never contain the key; `youtube_api_key` gone from schema and Settings source; migration text drops the column with waiver, grants functions to `service_role` only | unit (+ source/SQL scan) | `youtube-key.test.ts`, `youtube-migration.test.ts` | ❌ W0 | ⬜ pending |
| YT-05 | `resumeSecondsFor`; A→B→A positions reducer; completed starts at 0 | unit | `watch-resume.test.ts` | ❌ W0 | ⬜ pending |
| YT-06 | `classifyPlayerError` (153 not reportable); ENDED state machine (advance only when visible; cancel keeps card); no element over the player; `hl`/`cc_lang_pref` set | unit (+ static source scan) | `watch-player-state.test.ts`, `watch-layout-guards.test.ts` | ❌ W0 | ⬜ pending |
| YT-07 | Gap case 1,2,4 → move 4 up; `renumberSeasonCore` closes gaps, no duplicates, audit row, RPC failure leaves rows unchanged | unit (emulator) | `admin-episode-lifecycle.test.ts` (extend), `admin-renumber.test.ts` | partly | ⬜ pending |
| D-17 | Recheck batches, one write RPC, updates status/checked/duration only, never titles; quota error writes nothing; cron path + auth | unit | `youtube-recheck.test.ts`, extend `cron-schedule.test.ts`, `cron-auth.test.ts` | partly | ⬜ pending |
| D-07 | Scheduler `episodeIds` filter; foreign-show ids refused | unit | extend `admin-show-schedule.test.ts` | partly | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test files listed above
- [ ] `tests/unit/helpers/renumber-season-emulator.ts` (mirrors the SQL, header comment like the reorder emulator)
- [ ] JSON fixtures for `playlistItems` / `videos` from the documented response shapes (not recorded from the live API); re-validated against one real playlist at UAT
- [ ] Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Restricted key works from the Worker | YT-04 | Needs Koss's key and secret | Koss sets the secret; Admin › Settings › Test key → "Key works" |
| Real Unlisted playlist preview | YT-01, YT-02 | No live API calls in dev | Paste a real Unlisted playlist with a private, a deleted and a premiere video → statuses match |
| UAE-blocked and non-embeddable videos | YT-06 | Real region rules | Open each → branded card with the right reason |
| Nothing overlaps the iframe | YT-06 | Visual | 375px and desktop; element picker over corners and centre of the player |
| A→B→A resume | YT-05 | Real player | Desktop Chrome and iOS Safari: watch A 1 min, switch to B, back to A → resumes at A's position |
| ENDED card | YT-06 | Real player | Let an episode end → card, countdown only while on screen, Cancel keeps card |
| Captions and player language | YT-06 | Real player | `/en` English captions on when available; `/ar` follows viewer setting; menus in site language |
| Daily recheck cron | D-17 | Worker runtime | `wrangler dev` `/cdn-cgi/local/scheduled?cron=…`; after cutover one real run on Koss's go |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
