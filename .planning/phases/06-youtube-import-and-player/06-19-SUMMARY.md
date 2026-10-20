---
phase: 06-youtube-import-and-player
plan: 19
subsystem: cleanup
tags: [youtube, vault, i18n, roadmap, scan-test]
requires: [06-14, 06-15, 06-16]
provides:
  - "No hand-written code under src/ can read or mention the old app_config key column or getYouTubeApiKey"
  - "Message keys left unused by this phase removed from en and ar"
  - "ROADMAP Phase 8 drift fixed; seven Phase 6 hand-offs recorded in Phases 2, 4 and 5"
affects: [06-23 (contract PR removes the scan exclusion), Phase 2, Phase 4, Phase 5, Phase 8]
tech-stack:
  added: []
  patterns: ["repo scan test with a one-path exclusion list"]
key-files:
  created: [tests/unit/youtube-key-removed.test.ts]
  modified: [src/lib/config.ts, src/server/youtube/key.ts, src/messages/en.json, src/messages/ar.json, .planning/ROADMAP.md]
decisions:
  - "Scan test excludes only src/lib/database.types.ts; 06-23 removes the exclusion after regenerating types"
  - "Only items matching the plan intent were folded in; other 06-14 leftovers are listed as follow-ups"
metrics:
  tasks: 3
  completed: 2026-10-20
---

# Phase 6 Plan 19: Remove the key copy traces, unused messages, ROADMAP drift Summary

Deleted `getYouTubeApiKey` and every literal `youtube_api_key` mention from hand-written code, locked it out with a recursive scan test, removed 14 unused message keys per locale, and fixed ROADMAP Phase 8 plus the seven `TODO(phase-N)` hand-offs.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 RED | 2444702 | `test(06-19)`: scan test (failed on `src/lib/config.ts`) |
| 1 GREEN | 0569eb2 | `feat(06-19)`: `getYouTubeApiKey` deleted; comments point to Vault (D-20) |
| 2 | 040c886 | `chore(06-19)`: unused message keys removed from en and ar |
| 3 | 8c713a3 | `docs(06-19)`: ROADMAP Phase 8 line fixed, 7 hand-off lines added |

## What changed

- **Task 1.** `getYouTubeApiKey` (config.ts) removed; the two comments there now say the key lives in Supabase Vault and only the service role reads it. No other caller existed, so no switch to `readYouTubeApiKey()` / `hasYouTubeApiKey()` was needed. `tests/unit/youtube-key-removed.test.ts` scans `src/**/*.{ts,tsx,json}` for `youtube_api_key`, `getYouTubeApiKey(` and `api/youtube-meta`; `SCAN_EXCLUDE` is exactly `['src/lib/database.types.ts']` and a test fails if it grows. The column itself is NOT dropped here (06-23, own PR).
- **Task 2.** Removed in both locales after an empty grep over src and tests: `player.{autoplayCountdown, autoplayCancelButton, errorVideoUnavailableRetry, errorVideoNotFound, errorPlayerRefresh}`, `watch.{raiseTray, lowerTray, nowPlayingBadge}`, `admin.settings.{getKey, apiKeyLabel, apiKeyPlaceholder, apiKeyHint, youtubeApiDescription, replace}`. All 14 per locale; no key kept. Key `replace` was the 06-16 leftover; the only `'replace'` hits are `String.replace` calls and a negative assertion in a test.
- **Task 3.** Phase 8 Owner-gated line now reads "approve the contract migration (drop `admin_user_id`; `youtube_api_key` is dropped in Phase 6)". `Phase 6 hand-off:` lines added: Phase 2 (rate-limit, cronAuthOk, `30 1 * * *` trigger), Phase 4 (two token stand-ins), Phase 5 (`requireAdmin` swap, UAT admin TOTP). `origin/main` had no new commits, so no merge was needed.

## Deviations from Plan

- **[Rule 1 - path fix]** The plan names `src/server/youtube-key.ts` as the home of the reader and the scan failed on `src/server/youtube/key.ts`, whose header mentioned the literal `youtube_api_key`. Reworded to "the one named Vault secret (see the migration)". Comment-only change.
- Plan said Phase 5 hand-off for the UAT admin script; that file is outside the repo, so the line names its absolute path.

## Follow-ups (not done here, reported by earlier plans)

- 06-14: `src/hooks/use-idle-timer.ts` has no caller (only a negative assertion in `tests/unit/watch-layout-guards.test.ts`); delete in Phase 8 dead-code pass.
- 06-14: `getEpisodeProgress` in `src/lib/queries.ts` has zero callers in src and tests; delete in Phase 8.
- 06-14: stale comment in `src/app/[locale]/(watch)/layout.tsx` not touched (does not concern the key copy or messages).
- 06-14: `vaul` dependency has no import in src; package left alone (`package.json` / lockfile untouched), remove in Phase 8.
- 06-23: remove `SCAN_EXCLUDE` entry after the contract migration and regenerated types.

## Known Stubs

None.

## Verification

- Verified: `youtube-key-removed.test.ts`, `youtube-messages.test.ts`, `admin-settings-key-guards.test.ts`, `admin-actions-youtube-wrappers.test.ts`, `youtube-key*.test.ts`, `i18n-format.test.ts` pass; `npx tsc --noEmit` clean; eslint clean on touched files; `grep -rn --exclude=database.types.ts "youtube_api_key\|getYouTubeApiKey(" src` prints 0; both JSON files parse; ROADMAP greps: new Phase 8 text 1, old text 0, `Phase 6 hand-off` 7.
- Not verified: full unit suite, `npm run gate:local`, build (heavy, run under the lock at PR time).
- Failed: nothing.

STATE.md was not touched.

## Self-Check: PASSED

Files exist (test, summary, edited files); commits 2444702, 0569eb2, 040c886, 8c713a3 present in `git log`.
