---
phase: 6
slug: youtube-import-and-player
status: planned
nyquist_compliant: true
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
| **Quick run command** | per task: the targeted files in its `<automated>` block plus `npx eslint <touched files>`; per area: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/youtube-*.test.ts tests/unit/watch-*.test.ts tests/unit/import-*.test.ts tests/unit/admin-*.test.ts` |
| **Full suite command** | `npm run test:unit`; phase gate `npm run gate:local` under `/Users/koss/.clickit-heavy.lock` |
| **Estimated runtime** | ~20 seconds (unit); gate several minutes |

---

## Sampling Rate

- **After every task commit:** that task's `<automated>` block (targeted `node --test` files + per-file `eslint`)
- **After every plan wave:** `npm run test:unit`
- **Before `/gsd-verify-work`:** `npm run gate:local` green plus the controller's clean-clone check
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Built from the final plans (revision 3: Vault key, bar default, parallel execution). Every auto task runs its targeted `node --test` files plus per-file `eslint` (fast, under 30 s); `npx tsc --noEmit` runs at plan level and in `gate:local`. Quick command prefix: `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`.

| Task ID | Plan | Wave | Requirement | Task | Test Type | Automated check | Status |
|---------|------|------|-------------|------|-----------|-----------------|--------|
| 06-00-01 | 00 | 0 | YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07 | [BLOCKING] Merge origin/main; Phase 1 and 1.1 present; record Phases 2-5 | script/grep | shell check in verify | ⬜ pending |
| 06-00-02 | 00 | 0 | YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07 | [BLOCKING] No workflow applies migrations on push; record the waiver syntax | script/grep | shell check in verify | ⬜ pending |
| 06-01-01 | 01 | 1 | YT-02, YT-04, YT-07 | Expand migration with a text-level test | unit | `youtube-migration.test.ts` | ⬜ pending |
| 06-01-02 | 01 | 1 | YT-02, YT-04, YT-07 | Vault key resolver, admin-guard-free key cores, and the rate-limit seam | unit + eslint | `youtube-key.test.ts`, `youtube-rate-limit.test.ts` | ⬜ pending |
| 06-01-03 | 01 | 1 | YT-02, YT-04, YT-07 | [BLOCKING] Controller applies the expand migration locally and regenerates types | owner/controller checkpoint | controller check: log/grep in verify | ⬜ pending |
| 06-02-01 | 02 | 1 | YT-01, YT-02, YT-03 | Error codes, URL/id parsing and ISO duration | unit + eslint | `youtube-duration.test.ts`, `youtube-urls.test.ts` | ⬜ pending |
| 06-02-02 | 02 | 1 | YT-01, YT-02, YT-03 | Status classifier, script routing and the needs-English rule | unit + eslint | `youtube-script.test.ts`, `youtube-status.test.ts`, `youtube-urls.test.ts` | ⬜ pending |
| 06-03-01 | 03 | 1 | YT-01, YT-02, YT-03, YT-04 | Fixtures in the documented shapes | unit | `youtube-client.test.ts` | ⬜ pending |
| 06-03-02 | 03 | 1 | YT-01, YT-02, YT-03, YT-04 | Client with paging, batching, header transport and error mapping | unit + eslint | `youtube-client.test.ts` | ⬜ pending |
| 06-04-01 | 04 | 1 | YT-05, YT-06 | Resume and save rules with a positions reducer | unit + eslint | `watch-resume.test.ts` | ⬜ pending |
| 06-04-02 | 04 | 1 | YT-05, YT-06 | Player errors, ENDED state machine and player vars | unit + eslint | `watch-player-state.test.ts` | ⬜ pending |
| 06-04-03 | 04 | 1 | YT-05, YT-06 | Clock, isolate, number lists and quota reset time | unit + eslint | `i18n-format.test.ts`, `youtube-quota.test.ts` | ⬜ pending |
| 06-05-01 | 05 | 1 | YT-01, YT-02, YT-03, YT-04, YT-06, YT-07 | Add every new EN and AR key from the copywriting contract | script/grep | shell check in verify | ⬜ pending |
| 06-05-02 | 05 | 1 | YT-01, YT-02, YT-03, YT-04, YT-06, YT-07 | YouTubeStatusChip and a message parity test | unit + eslint | `youtube-messages.test.ts` | ⬜ pending |
| 06-06-01 | 06 | 2 | YT-01, YT-02, YT-03 | Import planner and input schemas | unit + eslint | `admin-schemas.test.ts`, `youtube-plan.test.ts` | ⬜ pending |
| 06-06-02 | 06 | 2 | YT-01, YT-02, YT-03 | Preview page and commit cores with compensation | unit + eslint | `fake-supabase.test.ts`, `youtube-import.test.ts` | ⬜ pending |
| 06-06-03 | 06 | 2 | YT-01, YT-02, YT-03 | Single-video verify core and server check on episode save | unit + eslint | `admin-season-episode-writes.test.ts`, `youtube-verify.test.ts` | ⬜ pending |
| 06-07-01 | 07 | 2 | YT-07, YT-01 | renumberSeasonCore, emulator, and the reorder gap case | unit + eslint | `admin-episode-lifecycle.test.ts`, `admin-renumber.test.ts` | ⬜ pending |
| 06-07-02 | 07 | 2 | YT-07, YT-01 | Scheduler episode filter and warnings | unit + eslint | `admin-show-schedule.test.ts` | ⬜ pending |
| 06-08-01 | 08 | 2 | YT-02, YT-06 | recheckVideosCore with a record_youtube_checks emulator | unit + eslint | `youtube-recheck.test.ts` | ⬜ pending |
| 06-08-02 | 08 | 2 | YT-02, YT-06 | Shared Can't-play rule and dashboard summary | unit + eslint | `youtube-health.test.ts` | ⬜ pending |
| 06-08-03 | 08 | 2 | YT-02, YT-06 | Server client factory and the cron route on main's guard (Phase 2 wiring left as TODOs) | unit + eslint | `youtube-recheck-route-guards.test.ts`, `youtube-recheck.test.ts` | ⬜ pending |
| 06-09-01 | 09 | 2 | YT-05, YT-06 | Overlay-free player with a React-owned hidden wrapper; tracker race fix | unit + eslint | `watch-player-source.test.ts`, `watch-player-state.test.ts`, `watch-resume.test.ts` | ⬜ pending |
| 06-09-02 | 09 | 2 | YT-05, YT-06 | Watch-page reads: progress seconds and stored non-ok statuses | unit + eslint | `watch-status-map.test.ts` | ⬜ pending |
| 06-09-03 | 09 | 2 | YT-05, YT-06 | Viewer player-error report (core, action, test) | unit + eslint | `player-error-report.test.ts` | ⬜ pending |
| 06-10-01 | 10 | 2 | YT-06 | `classifyPlayerError` (153 not reportable); ENDED state machine for the shipped `'bar'` mode (not hidden, not stopped on ENDED; countdown only while at least 50% in view; Esc/cancel returns the normal bar with Finished; reduced motion: no ring, no auto-advance, only Play now; series end) and the `'card'` alternative; `endedEffects`, `barView`, `isVisibleEnough`; `playerIframeHidden` for the error and blocked_ae cards; hidden on a React-owned wrapper; stored non-ok status picks the error reason; nothing over the player; no Tooltip/Popover/DropdownMenu/HoverCard in watch files; Watchlist/Like revert + live region; `hl`/`cc_lang_pref` set | unit (+ static source scan) | `watch-player-state.test.ts`, `watch-player-source.test.ts`, `watch-status-map.test.ts`, `watch-layout-guards.test.ts`, `watch-cards-guards.test.ts`, `watch-list-guards.test.ts` | ❌ created in task | ⬜ pending |
| 06-10-02 | 10 | 2 | YT-06 | Branded error card and a source guard test for both cards | unit + eslint | `watch-cards-guards.test.ts` | ⬜ pending |
| 06-11-01 | 11 | 2 | YT-05, YT-06 | Hooks accept onError; WatchActions with inline feedback | unit + eslint | `watch-list-guards.test.ts` | ⬜ pending |
| 06-11-02 | 11 | 2 | YT-05, YT-06 | Static EpisodeList (replaces the tray content) | unit + eslint | `watch-list-guards.test.ts` | ⬜ pending |
| 06-12-01 | 12 | 2 | YT-01, YT-02 | Pure row view mapping | unit + eslint | `import-row-view.test.ts` | ⬜ pending |
| 06-12-02 | 12 | 2 | YT-01, YT-02 | ImportPlaylistTable component and guard test | unit + eslint | `admin-import-table-guards.test.ts`, `import-row-view.test.ts` | ⬜ pending |
| 06-13-01 | 13 | 3 | YT-01, YT-02, YT-03, YT-07 | Import preview/commit and metadata fetch; video check on episode save | unit + eslint | `admin-actions-id-coverage.test.ts`, `admin-actions-season-episode-wrappers.test.ts` | ⬜ pending |
| 06-13-02 | 13 | 3 | YT-01, YT-02, YT-03, YT-07 | Renumber and scheduler-with-selection wrappers | unit + eslint | `admin-actions-id-coverage.test.ts`, `admin-actions-season-episode-wrappers.test.ts` | ⬜ pending |
| 06-13-03 | 13 | 3 | YT-01, YT-02, YT-03, YT-07 | Source-scan test for the new wrappers | unit | `admin-actions-id-coverage.test.ts`, `admin-actions-youtube-wrappers.test.ts` | ⬜ pending |
| 06-14-01 | 14 | 3 | YT-05, YT-06 | Stacked layout, control bar and resume on switch; remove the tray | unit + eslint | `watch-layout-guards.test.ts`, `watch-resume.test.ts` | ⬜ pending |
| 06-14-02 | 14 | 3 | YT-05, YT-06 | ENDED and error wiring, stored-status reasons, blocked preflight, page props | unit + eslint | `watch-cards-guards.test.ts`, `watch-layout-guards.test.ts`, `watch-player-state.test.ts` | ⬜ pending |
| 06-14-03 | 14 | 3 | YT-05, YT-06 | Route-scoped Toaster and the remaining guards | unit + eslint | `watch-layout-guards.test.ts` | ⬜ pending |
| 06-15-01 | 15 | 4 | YT-03 | Episode form uses the server action, shows refusals, needs-English hint, focus prop | unit + eslint | `admin-youtube-form-guards.test.ts`, `youtube-script.test.ts` | ⬜ pending |
| 06-15-02 | 15 | 4 | YT-03 | Shorts form switch, delete the GET route, guard test | unit + eslint | `admin-youtube-form-guards.test.ts` | ⬜ pending |
| 06-16-01 | 16 | 4 | YT-04 | Vault key: migration 1 defines `private.get/set_youtube_key`, `youtube_key_meta` (security definer, `search_path = ''`) and `public` wrappers, each revoked from public/anon/authenticated and granted to service_role only, with no grant on `vault.*`; resolver reads by service-role RPC, per-request `cache()`, null on error, no logging; save core: format check before any RPC, rate limit, last 4 only in result and audit, non-admin refused through `runAdminAction`; Settings source never reads the key; old plaintext column absent from app source (generated types excepted until the contract PR); contract migration (06-23) nulls then drops it with the waiver | unit (+ source/SQL scan) + local Vault round trip (06-01 Task 3) | `youtube-migration.test.ts`, `youtube-key.test.ts`, `youtube-rate-limit.test.ts`, `youtube-key-save.test.ts`, `youtube-key-status.test.ts`, `admin-settings-key-guards.test.ts`, `youtube-key-removed.test.ts`, `youtube-contract-migration.test.ts` | ❌ created in task | ⬜ pending |
| 06-16-02 | 16 | 4 | YT-04 | saveYouTubeApiKey and testYouTubeKey actions; remove the old write path | unit + eslint | `admin-actions-id-coverage.test.ts`, `admin-actions-youtube-wrappers.test.ts`, `admin-settings-key-guards.test.ts` | ⬜ pending |
| 06-16-03 | 16 | 4 | YT-04 | Editable key field (SecretField update, advanced tab, settings page) | unit + eslint | `admin-settings-key-guards.test.ts` | ⬜ pending |
| 06-17-01 | 17 | 4 | YT-01, YT-02 | Pure sheet state, then the sheet core (frame, link, target, reading loop, commit) | unit + eslint | `import-sheet-state.test.ts` | ⬜ pending |
| 06-17-02 | 17 | 4 | YT-01, YT-02 | Sheet states, error banners and the success state | unit + eslint | `admin-import-sheet-guards.test.ts`, `import-sheet-state.test.ts` | ⬜ pending |
| 06-17-03 | 17 | 4 | YT-01, YT-02 | Scheduler controlled mode with an episode filter, and the show page entry point | unit + eslint | `admin-import-sheet-guards.test.ts` | ⬜ pending |
| 06-18-01 | 18 | 5 | YT-07, YT-02 | Episodes table arrows, failure handling and flags | unit + eslint | `admin-order-ui-guards.test.ts`, `youtube-health.test.ts` | ⬜ pending |
| 06-18-02 | 18 | 5 | YT-07, YT-02 | Renumber dialog, gap hint and the empty-state import entry | unit + eslint | `admin-order-ui-guards.test.ts` | ⬜ pending |
| 06-18-03 | 18 | 5 | YT-07, YT-02 | Dashboard YouTube check panel and UI guard test | unit + eslint | `admin-order-ui-guards.test.ts` | ⬜ pending |
| 06-19-01 | 19 | 5 | YT-04, YT-06 | Remove the old key reader and lock it out with a scan test | unit + eslint | `youtube-key-removed.test.ts` | ⬜ pending |
| 06-19-02 | 19 | 5 | YT-04, YT-06 | Delete message keys made unused by this phase (grep-gated) | unit | `youtube-messages.test.ts` | ⬜ pending |
| 06-19-03 | 19 | 5 | YT-04, YT-06 | Fix ROADMAP Phase 8 drift | script/grep | shell check in verify | ⬜ pending |
| 06-20-01 | 20 | 6 | YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07 | Gate, hand-over file and PR | script/grep | shell check in verify | ⬜ pending |
| 06-20-02 | 20 | 6 | YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07 | [OWNER] Create the API-restricted YouTube key | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-20-03 | 20 | 6 | YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07 | [OWNER] UAT on the local stack | owner/controller checkpoint | controller check: log/grep in verify | ⬜ pending |
| 06-21-01 | 21 | 7 | YT-01, YT-02, YT-04, YT-06, YT-07 | [OWNER] Ship | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-21-02 | 21 | 7 | YT-01, YT-02, YT-04, YT-06, YT-07 | [CONTROLLER] Clear duplicate video ids (D-22), then [OWNER] approve migration 1 on live | owner/controller checkpoint | controller check: log/grep in verify | ⬜ pending |
| 06-21-03 | 21 | 7 | YT-01, YT-02, YT-04, YT-06, YT-07 | [OWNER] Approve deploy of the shipped commit (after the Worker cutover); controller deploys | owner/controller checkpoint | controller check: log/grep in verify | ⬜ pending |
| 06-22-01 | 22 | 8 | YT-01, YT-02, YT-04, YT-06 | [OWNER] Paste the key in live Settings and press Test key | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-22-02 | 22 | 8 | YT-01, YT-02, YT-04, YT-06 | [OWNER] Go for one real re-check run on live | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-23-01 | 23 | 9 | YT-04 | New branch, contract migration and its static test | unit + eslint | `youtube-contract-migration.test.ts`, `youtube-migration.test.ts` | ⬜ pending |
| 06-23-02 | 23 | 9 | YT-04 | [CONTROLLER] Local apply and type regeneration under the heavy lock | owner/controller checkpoint | controller check: log/grep in verify | ⬜ pending |
| 06-23-03 | 23 | 9 | YT-04 | Remove the scan exclusion, gate, hand-over and PR | unit | `youtube-key-removed.test.ts` | ⬜ pending |
| 06-24-01 | 24 | 10 | YT-04 | [OWNER] Ship the contract PR | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-24-02 | 24 | 10 | YT-04 | [OWNER] Approve the contract migration on live | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |
| 06-24-03 | 24 | 10 | YT-04 | [OWNER] Delete the old key in Google Cloud | owner/controller checkpoint | controller check: Koss reply + controller read-back | ⬜ pending |

### Requirement-level map

| Requirement | Behavior proved | Test Type | Test file | File Exists | Status |
|-------------|-----------------|-----------|-----------|-------------|--------|
| YT-01 | Playlist URL parsing; paging past 50; batches of 50; ISO duration; preview writes nothing | unit (fake fetch, fake db) | `tests/unit/youtube-urls.test.ts`, `youtube-client.test.ts`, `youtube-duration.test.ts`, `youtube-import.test.ts` | ❌ created in task | ⬜ pending |
| YT-02 | `classifyVideo` truth table (private, removed, not ready, not embeddable, AE blocked/not allowed, unlisted ok); re-import adds nothing; drafts only; numbering after max incl. archived; script routing + needs-English flag; tampered commit refused; mid-commit failure rolls back | unit | `youtube-status.test.ts`, `youtube-import.test.ts`, `youtube-script.test.ts` | ❌ created in task | ⬜ pending |
| YT-03 | Single id: bad format refused before fetch; missing/private/not embeddable/AE refused with plain message; duplicate mapped to "already on Clickit" | unit | `youtube-verify.test.ts` | ❌ created in task | ⬜ pending |
| YT-04 | Key resolver (Worker env first, then process.env; empty = missing); errors never contain the key; `youtube_api_key` gone from Settings and app source (scan excludes only generated types until the contract PR); expand migration grants functions to `service_role` only; contract migration (own PR, 06-23) nulls then drops the column with the waiver | unit (+ source/SQL scan) | `youtube-key.test.ts`, `youtube-migration.test.ts`, `admin-settings-key-guards.test.ts`, `youtube-key-removed.test.ts`, `youtube-contract-migration.test.ts` | ❌ created in task | ⬜ pending |
| YT-05 | `resumeSecondsFor`; A→B→A positions reducer; completed starts at 0; saves gated until `getVideoData().video_id` matches or PLAYING after a switch (`videoMatchesFor`) | unit | `watch-resume.test.ts`, `watch-player-source.test.ts` | ❌ created in task | ⬜ pending |
| YT-06 | `classifyPlayerError` (153 not reportable); ENDED state machine (advance only when visible; cancel keeps card); `playerIframeHidden` predicate; hidden on a React-owned wrapper; stored non-ok status picks the error reason; no element over the player; no Tooltip/Popover/DropdownMenu/HoverCard in watch files; Watchlist/Like revert + live region; `hl`/`cc_lang_pref` set | unit (+ static source scan) | `watch-player-state.test.ts`, `watch-player-source.test.ts`, `watch-status-map.test.ts`, `watch-layout-guards.test.ts`, `watch-cards-guards.test.ts`, `watch-list-guards.test.ts` | ❌ created in task | ⬜ pending |
| YT-07 | Gap case 1,2,4 → move 4 up; `renumberSeasonCore` closes gaps, no duplicates, audit row, RPC failure leaves rows unchanged | unit (emulator) | `admin-episode-lifecycle.test.ts` (extend), `admin-renumber.test.ts` | partly | ⬜ pending |
| D-17 | Recheck batches, one write RPC each for episodes and shorts, updates status/checked/duration and refreshes text unless edited (G2 CHANGED by Koss 2026-10-20, PR #27 review item 7); quota error writes nothing; route uses main's cron-secret check with two `TODO(phase-2)` markers; no wrangler/CRON_ROUTES edits (G8) | unit (+ source scan) | `youtube-recheck.test.ts`, `youtube-health.test.ts`, `youtube-recheck-route-guards.test.ts` | ❌ created in task | ⬜ pending |
| D-07 | Scheduler `episodeIds` filter; foreign-show ids refused | unit | extend `admin-show-schedule.test.ts` | partly | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Plan 06-00 (Wave 0) is the precondition gate: origin/main merged, upstream modules present, migrations workflow has no push-to-main apply, Worker name, crons and waiver syntax recorded
- [x] Every new test file is written first inside the task that needs it (TDD, `tdd="true"` tasks); no `<automated>` block points at a file that no earlier step creates, so no MISSING references remain
- [x] `tests/unit/helpers/renumber-season-emulator.ts` is created in 06-07 Task 1, before `renumberSeasonCore` (mirrors the SQL, header comment like the reorder emulator)
- [x] JSON fixtures for `playlists` / `playlistItems` / `videos` / errors are hand-written from the documented shapes in 06-03 Task 1 (not recorded from the live API); re-validated against one real playlist at UAT
- [x] Framework install: none (no new npm packages)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Key saved in Settings works at once | YT-04 | Needs Koss's real key | Local: Koss pastes the key into Settings, Save, Test key (06-20 step 1). Live: after the deploy, the same on live (06-22) → "•••• last4" and "key works" |
| Real Unlisted playlist preview | YT-01, YT-02 | No live API calls in dev | Paste a real Unlisted playlist with a private, a deleted and a premiere video → statuses match |
| UAE-blocked and non-embeddable videos | YT-06 | Real region rules | Open each → branded card with the right reason |
| Nothing overlaps the iframe | YT-06 | Visual | 375px and desktop; element picker over corners and centre of the player |
| Up-next bar (shipped default) | YT-06 | Real player | On ENDED the video and YouTube's end screen stay visible; the strip replaces the control bar; countdown pauses below 50% in view; Esc returns the normal bar with Finished; reduced motion shows only Play now; series end shows Back to show (06-20 UAT step 9) |
| Hidden iframe under the error card | YT-06 | Real DOM | While the error card shows, the element picker finds no iframe under it; console `document.querySelector('iframe')?.offsetParent === null` is true (06-20 UAT step 11) |
| Non-embeddable episode | YT-06 | Needs a real video setting | Untick "Allow embedding" on a test video on no live episode, open its local episode → error card, then re-enable (06-20 UAT step 11) |
| A→B→A resume | YT-05 | Real player | Desktop Chrome and iOS Safari: watch A 1 min, switch to B, back to A → resumes at A's position |
| ENDED card | YT-06 | Real player | Let an episode end → card, countdown only while on screen, Cancel keeps card |
| Captions and player language | YT-06 | Real player | `/en` English captions on when available; `/ar` follows viewer setting; menus in site language |
| Re-check run | D-17 | Real API and database | Local: curl with Koss's local CRON_SECRET against `npm run dev` (06-20 step 13; main's guard works on Node). Live: one run on Koss's go (06-22). The daily schedule arrives with Phase 2 (TODO(phase-2)) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (owner/controller checkpoints carry the controller's check in `<how-to-verify>`; they are gates, not code tasks)
- [x] Sampling continuity: no 3 consecutive code tasks without automated verify (the only runs of 3 non-unit tasks are the owner landing plans 06-21, 06-22 and 06-24, which contain no code)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (targeted files + per-file eslint per task; tsc and the full suite at plan and phase level)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off (revision 3). Plan gate answered (G1 = B, G2-G4 as recommended, G5, G6 and G8 changed, G7 accepted); open: Koss's signature on the G6 key-field pictures
