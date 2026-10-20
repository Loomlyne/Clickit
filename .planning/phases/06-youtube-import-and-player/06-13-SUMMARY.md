---
phase: 06-youtube-import-and-player
plan: 13
subsystem: api
tags: [server-actions, youtube, import, renumber, scheduler, admin, node-test]

requires:
  - phase: 06-06
    provides: "previewPlaylistPageCore, commitImportCore, verifyVideoCore, verifyMessage, episode cores' optional verifyVideo dep"
  - phase: 06-07
    provides: "renumberSeasonCore, planShowScheduleCore(db, showId, now, episodeIds?), applyShowScheduleCore deps.planOverride"
  - phase: 06-08
    provides: "getServerYouTubeClient() (Vault key, server-only)"
provides:
  - "requireAdminForYouTube seam + youtubeAdminEnv (TODO(phase-5)) in actions.ts"
  - "previewPlaylistPage, commitImport, fetchYouTubeMeta, renumberSeason server actions"
  - "previewShowSchedule / applyShowSchedule with optional episodeIds"
  - "createEpisode / updateEpisode always pass the server video check"
  - "YouTubeActionResult<T> (data on success, data.code / data.params on refusal)"
affects: [06-15, 06-16, 06-17, 06-18]

tech-stack:
  added: []
  patterns:
    - "One admin seam for every YouTube action; Phase 5 swaps one function"
    - "Core top-level YouTube code moved to data.code by toYouTubeResult for the UI"
    - "Vault key read lazily inside the verifier, only when a link needs checking"

key-files:
  created:
    - tests/unit/admin-actions-youtube-wrappers.test.ts
  modified:
    - src/app/[locale]/admin/actions.ts

key-decisions:
  - "Refusals carry data: { code, params? } (YouTubeActionResult); the cores' top-level code is moved there, so the UI reads one place"
  - "previewShowSchedule and applyShowSchedule keep adminEnv / assertAdmin (scheduling is not a YouTube action); renumberSeason uses youtubeAdminEnv as the plan says"
  - "An episodeIds selection that is not an array of strings, is empty, or has more than 200 ids is refused before any read (empty never means 'schedule everything')"
  - "updateEpisode passes its raw id as the fallback excludeEpisodeId; the core's parsed id wins"

requirements-completed: [YT-01, YT-02, YT-03, YT-07]

duration: 7min (18:42-18:49 CET)
completed: 2026-10-20
---

# Phase 6 Plan 13: Admin action wrappers Summary

**Thin admin server actions over the Phase 6 cores: playlist preview and metadata fetch (read-only), import commit and renumber through `runAdminAction(youtubeAdminEnv)`, the scheduler limited to chosen episodes via `planOverride`, and the Vault-backed video check on every episode save, all behind one `requireAdminForYouTube` seam and locked by a source-scan test.**

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Import preview/commit, metadata fetch, video check on save | 561ec1d |
| 2 | Renumber and scheduler-with-selection wrappers | d518e59 |
| 3 | Source-scan test for the new wrappers | 14b156d |
| fix | youtubeAdminEnv on the `runAdminAction(` line (06-16 grep) | 0e91dff |

## What was built

- **Seam (G8):** `// TODO(phase-5): swap this for requireAdmin() (admins table + TOTP); every YouTube action uses only this function`, then `requireAdminForYouTube = () => assertAdmin()` and `youtubeAdminEnv = { ...adminEnv, assertAdmin: requireAdminForYouTube }`.
- **`previewPlaylistPage(input)`**: `await requireAdminForYouTube()`, `getServerYouTubeClient()`; missing key gives `{ success: false, data: { code: 'key_missing' } }`; otherwise `previewPlaylistPageCore(createAdminClient(), client, input)`. Catch logs `[admin/actions] playlist preview failed` with the error only, never the input link.
- **`commitImport(input)`**: `runAdminAction(youtubeAdminEnv, …)`, key check inside the run, `commitImportCore(ctx.db, { audit, adminUserId, youtube, now }, input)`; revalidates the show page (stored id first, client id only as a parsed fallback), `episodes`, `shows`.
- **`fetchYouTubeMeta(url, { forShort? })`**: read-only `verifyVideoCore(createAdminClient(), client | null, url, { checkDuplicate: !forShort })`; success `data: YouTubeMeta`, refusal `error: verifyMessage(...)`, `data: { code, params? }`.
- **`createEpisode` / `updateEpisode`**: deps gain `verifyVideo: serverVideoVerifier(ctx.db[, id])`, which reads the key only when called and passes a null client when it is missing (core answers `key_missing`, fail closed).
- **`renumberSeason(showId, seasonId)`**: `runAdminAction(youtubeAdminEnv, ctx => renumberSeasonCore(...))`, fallback `Failed to renumber episodes`, revalidate show page or catalog, `episodes`.
- **Scheduler:** `previewShowSchedule(showId, episodeIds?)` passes the selection to `planShowScheduleCore`; `applyShowSchedule(showId, episodeIds?)` without ids is unchanged, with ids it plans inside the run and calls `applyShowScheduleCore(..., { ...deps, planOverride })` (changed-row and slot checks still run in the core). `schedule-episodes-button.tsx` compiles unchanged.
- **Test** `tests/unit/admin-actions-youtube-wrappers.test.ts` (11 tests, same `blocks()` parser as the id-coverage test): seam defined once right after the TODO line; read-only actions check the admin before any core call and before the key read, no `runAdminAction`; writes use `runAdminAction(youtubeAdminEnv` and their core; no Phase 6 block calls `assertAdmin(`; episode saves contain `verifyVideo`; new blocks and the seam helpers have no `apiKey`, `YOUTUBE_API_KEY`, `console.log` or `getYouTubeApiKey(`; scheduler actions take `episodeIds?` and use `planOverride`.

## Verification

Verified:
- `node --test` admin-actions-youtube-wrappers, admin-actions-id-coverage, admin-actions-season-episode-wrappers: 36 pass, 0 fail (after the last commit).
- `npm run test:unit`: 896 pass, 0 fail.
- `npx tsc --noEmit`: clean. `npx eslint` on actions.ts and the new test: clean.
- Acceptance greps: `export async function (previewPlaylistPage|commitImport|fetchYouTubeMeta)(` = 3; `verifyVideo` = 5; `export async function renumberSeason(` = 1 and its block has `renumberSeasonCore(`; `planOverride` = 1; `TODO(phase-5)` = 1; `runAdminAction(youtubeAdminEnv` = 2.
- RED check: the new test run against the pre-plan actions.ts (bd894da) fails 11 of 11.

Not verified:
- The actions were not executed (they need Next, `server-only` and the `@/` alias); behaviour rests on the 06-06/06-07/06-08 core tests plus the source scan.
- No live YouTube call, no key, no Supabase stack command. Build, `gate:local` and Playwright not run (heavy, left to the PR gate).

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Input validation] Episode selection shape check**
- **Issue:** `planShowScheduleCore` iterates `episodeIds` directly; a non-array payload from the client would throw, and an empty list is ambiguous.
- **Fix:** `parseEpisodeSelection` refuses non-arrays, non-string entries, empty lists and more than 200 ids with the core's own message, before any read. Each id is still parsed by the core.
- **Commit:** d518e59

**2. [Rule 1 - Downstream check] `runAdminAction(youtubeAdminEnv` on one line**
- **Issue:** 06-16's acceptance grep counts the literal `runAdminAction(youtubeAdminEnv`; the house multi-line style would give 0 for these two.
- **Fix:** the env sits on the call line. Prettier is a dependency but no script or workflow enforces it.
- **Commit:** 0e91dff

**3. Additions inside the plan's intent**
- `YouTubeActionResult<T>` and `toYouTubeResult`: `ActionResult<T>` cannot hold `data.code` beside `data: T`, and the cores return `code` at the top level; the UI plans (06-15, 06-17) read `data.code`.
- `serverVideoVerifier` helper shared by create and update.
- Re-exported types `PreviewPage`, `PreviewRow`, `ImportData`, `YouTubeMeta` for the UI.

### TDD Gate Compliance

Task 3 is `tdd="true"` but comes last in the plan, after the code it scans, so its `test(06-13)` commit follows the `feat(06-13)` commits. RED was shown instead by running the test against the pre-plan actions.ts (11 of 11 fail).

## Known Stubs

None. `fetchYouTubeMeta`, `previewPlaylistPage`, `commitImport` and `renumberSeason` have no UI callers yet (06-15, 06-17, 06-18). `GET /api/youtube-meta` still exists until 06-15.

## Threat Flags

None beyond the register. T-06-49: every new action goes through `requireAdminForYouTube` first. T-06-50: cores parse ids and payloads; id-coverage test green. T-06-51: results carry codes and metadata; logs carry the error only; the scan bans key references. T-06-52: admin-only, preview page cap enforced by the core schema.

## TODO(phase-N)

- `src/app/[locale]/admin/actions.ts`: `// TODO(phase-5)` above `requireAdminForYouTube`.

## Self-Check: PASSED

- FOUND: src/app/[locale]/admin/actions.ts, tests/unit/admin-actions-youtube-wrappers.test.ts
- FOUND commits: 561ec1d, d518e59, 14b156d, 0e91dff on phase-06-youtube-import-player
- STATE.md and ROADMAP.md untouched.
