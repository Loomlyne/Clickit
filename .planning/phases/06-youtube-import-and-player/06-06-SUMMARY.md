---
phase: 06-youtube-import-and-player
plan: 06
subsystem: api
tags: [youtube, import, compensation, audit, zod, node-test, tdd]

requires:
  - phase: 06-01
    provides: "episodes youtube_* columns, unique index episodes_youtube_video_id_key, Phase 6 DB types"
  - phase: 06-02
    provides: "parsePlaylistId, parseVideoIdStrict, classifyVideo, videoReason, routeYouTubeText, needsEnglishTitle, statusToVideoError"
  - phase: 06-03
    provides: "YouTubeClientLike, YouTubeApiError, YOUTUBE_API_ERROR_CODES"
provides:
  - "buildImportPlan / importStatus (src/server/youtube/plan.ts)"
  - "previewPlaylistPageCore, commitImportCore, findExistingVideos, youtubeFailure, IMPORT_MAX_ITEMS, PreviewRow, PreviewPage (src/lib/admin/youtube-import.ts)"
  - "verifyVideoCore, verifyMessage, VerifyOutcome, YouTubeMeta (src/lib/admin/youtube-verify.ts)"
  - "videoIdSchema, playlistIdSchema, previewPageSchema, commitImportSchema"
  - "createEpisodeCore / updateEpisodeCore optional verifyVideo dep with data.youtubeError"
  - "fake-supabase: catalog-wide unique youtube_video_id, constraint name in 23505 messages"
affects: [06-13, 06-15, 06-08, 06-16]

tech-stack:
  added: []
  patterns:
    - "Preview reads, commit re-fetches: client sends ids only, server re-classifies"
    - "One episodes INSERT per import, compensated by deleting returned ids and the new season"
    - "Typed YouTube code on a CoreResult (YouTubeCoreResult) so the UI translates, plain English in error"

key-files:
  created:
    - src/server/youtube/plan.ts
    - src/lib/admin/youtube-import.ts
    - src/lib/admin/youtube-verify.ts
    - tests/unit/youtube-plan.test.ts
    - tests/unit/youtube-import.test.ts
    - tests/unit/youtube-verify.test.ts
  modified:
    - src/lib/admin/schemas.ts
    - src/lib/admin/season-episode-writes.ts
    - tests/unit/helpers/fake-supabase.ts
    - tests/unit/admin-season-episode-writes.test.ts
    - tests/unit/admin-show-schedule.test.ts

key-decisions:
  - "importStatus = classifyVideo plus 'no usable length (PT0S, missing, malformed) -> not_ready'; used by preview, commit and the planner. verifyVideoCore keeps plain classifyVideo (single add allows a manual length)"
  - "New-season title is mirrored into title_ar when Arabic-dominant (D-04), no fillArabic in the import path"
  - "Description fallback: empty YouTube text -> show description and description_ar; Arabic-only text -> description from the show, description_ar = the Arabic text; English-only -> description_ar null"
  - "Preview drops playlist items without a video id and a second copy of the same video on a page"
  - "verifyVideoCore throws only when the duplicate lookup cannot read the DB; the episode cores return that as a plain error (never treated as ok)"
  - "updateEpisodeCore treats a link that parses to the stored id as unchanged (no verify call, stored as the bare id)"

requirements-completed: [YT-01, YT-02, YT-03]

duration: 11min
completed: 2026-10-20
---

# Phase 6 Plan 06: Import and verify cores Summary

**Server cores for playlist preview (read-only, catalog-wide dedupe), import commit (re-fetch, refuse on any change, one INSERT of drafts, compensation, counts, one audit row) and single-video verify wired into episode create/update, all on the Phase 1.1 helpers and covered by node tests with a fake YouTube client.**

## Task Commits

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | Import planner and input schemas | ffddf78 | 815a027 |
| 2 | Preview page and commit cores with compensation | efe8152 | 96fb152 |
| 3 | Single-video verify core and server check on episode save | 9e6d4ed | c2b65f3 |

No refactor commits.

## What was built

- **`plan.ts`**: `buildImportPlan({ videos, startNumber, showDefaults, now })` sorts by playlist position, skips non-ok rows without using up a number, routes text by script (`routeYouTubeText`), sets `duration` (minutes) and `youtube_duration_seconds`, `status: 'draft'`, `youtube_status: 'ok'`, `youtube_checked_at: now`, and counts `needsEnglishCount` with `needsEnglishTitle`. No `fillArabic` or translation (grep = 0).
- **Schemas**: `previewPageSchema` (page 0..3, url ≤ 2048, strict), `commitImportSchema` (1..200 unique 11-char ids, uuid show/season, `new` title 1..120 trimmed or `existing` seasonId, strict at every level). Existing exports untouched.
- **`previewPlaylistPageCore(db, youtube, input)`**: on page 0 the link is parsed before any fetch (`not_a_playlist_link` / `video_link_in_import`, zero fetch and zero DB calls), then `getPlaylist`; later pages need `playlistId` + `pageToken` and skip `getPlaylist`. One `listPlaylistItemsPage`, one `getVideos`, three flat dedupe reads (episodes `.in('youtube_video_id')` with no archived filter, then seasons, shows). Rows: 1-based global position, thumbnail medium → high → default, length, status or `already` with `{ showTitle, seasonNumber, episodeNumber }`, privacy, Arabic flag, `premieresAt`. `capped` at page 3 with a next token (token then returned as null). `empty_playlist`, `key_missing` (null client), YouTubeApiError codes passed through, any other throw is `network` with a fixed message.
- **`commitImportCore(db, deps, input)`**: schema → `parseId` → show read → existing season read with the show check → `getVideos(videoIds)` re-fetch → dedupe → refuse the whole import with "Some videos changed on YouTube since the preview. Paste the link again." on any non-ok or existing id (zero writes). Start number = max over ALL rows of the season (archived included); new season number = max + 1. Steps: `insert-season` (new only) → `insert-episodes` (ONE `.insert(rows).select('id')`, row count checked) → `recompute-counts` (season then show) → `audit` (`create`/`season`, diff `{ kind: 'youtube_import', playlist_id, episode_count, season_id, target, episode_ids }`). On failure: compensation, one failure audit row via `compensationAuditDiff`, error returned. A 23505 on `episodes_youtube_video_id_key` returns "One or more of these videos is already on Clickit. Paste the link again."
- **`verifyVideoCore(db, youtube, raw, opts)`**: strict parse (no fetch on failure) → `key_missing` → one `getVideos([id])` → `classifyVideo` → `statusToVideoError` → duplicate lookup (skipped with `checkDuplicate: false`; `excludeEpisodeId` is not a duplicate). `meta` has videoId, title, description, channelTitle, thumbnail (maxres → standard → high → medium → default), seconds, minutes. `verifyMessage` gives plain English per code.
- **Episode cores**: optional `verifyVideo` dep. Create verifies when a video id is set; update verifies only when it is present and differs from the stored id. Refusal: `{ success: false, wrote: false, error, data: { showId, youtubeError: { code, params? } } }`, nothing written, normalized 11-char id stored on ok. A 23505 on the video index returns "This video is already on Clickit." with `youtubeError.code = 'video_duplicate'`.

## Verification

- `node --test tests/unit/youtube-plan.test.ts tests/unit/admin-schemas.test.ts`: 62 pass.
- `node --test tests/unit/youtube-import.test.ts tests/unit/fake-supabase.test.ts`: 41 pass.
- `node --test tests/unit/youtube-verify.test.ts tests/unit/admin-season-episode-writes.test.ts`: 45 pass (all earlier writes tests unchanged and green).
- `npm run test:unit`: 754 tests, 754 pass, 0 fail.
- `npx eslint` on every changed source and test file: clean. `npx tsc --noEmit`: clean.
- Acceptance greps: `fillArabic|translate` in plan.ts = 0; `'insert-episodes'` in youtube-import.ts = 1; one `.from('episodes').insert(` in youtube-import.ts; `from '@/|server-only|next/` in youtube-import.ts = 0; `verifyVideo` in season-episode-writes.ts = 5.
- Not run: build, `gate:local`, Playwright (heavy, left to the PR gate). No live YouTube call, no key, no Supabase stack command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Schedule test fixture broke on the new fake uniqueness**
- **Found during:** Task 2 (adding `['youtube_video_id']` to the fake's UNIQUE map)
- **Issue:** `tests/unit/admin-show-schedule.test.ts` gave every episode `youtube_video_id: 'abc'`, which the real index (06-01) and now the fake refuse; 5 schedule tests failed.
- **Fix:** each fixture episode gets a unique id (`yt-${eid}`). The core only reads `Boolean(youtube_video_id)`, so test meaning is unchanged.
- **Files modified:** tests/unit/admin-show-schedule.test.ts (not in the plan's file list)
- **Commit:** efe8152

**2. [Rule 2 - Correctness] Fake 23505 message names the constraint**
- **Issue:** the plan maps a 23505 by the constraint name `episodes_youtube_video_id_key`, but the fake's message had no name, so that path could not be tested.
- **Fix:** the fake returns `duplicate key value violates unique constraint "<table>_<cols>_key" on <table>` (Postgres default naming; the video index is named exactly that in 06-01). Codes and existing tests unchanged.
- **Commit:** efe8152

**3. [Rule 1 - Bug] `recompute-counts` step has a no-op undo in the import**
- **Issue:** without an undo, a later failure (audit) listed `recompute-counts` under "could not undo" although the insert undos recount after removing rows.
- **Fix:** a no-op undo with a comment; the failure message stays truthful.
- **Commit:** 96fb152

**4. Additions inside the plan's intent**
- `importStatus` (PT0S / no length → not_ready) so "PT0S never reaches the plan" holds and preview shows the same status the commit uses.
- `findExistingVideos` and `youtubeFailure` are exported from youtube-import.ts and reused by youtube-verify.ts (one dedupe lookup, one error mapping).
- `verifyMessage` exported for the plain-English error the episode cores return.
- `YouTubeCoreResult<T>` (CoreResult plus optional `code`) for preview and commit results.
- `channelTitle` is read through a narrow local type: the 06-03 client type does not list it (`database.types.ts` untouched).

## TDD Gate Compliance

All three tasks have a `test(06-06)` commit before the `feat(06-06)` commit. RED was confirmed each time (module not found, or 9 failing tests for Task 3).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-06-22..T-06-27 are mitigated as planned: strict schemas and server re-fetch (tested with a private-since-preview id and tampered payloads), catalog-wide dedupe including archived plus 23505 mapping, page cap 0..3, success and failure audit rows, one INSERT with compensation, results carry codes and metadata only (tests assert no `AIza`/`googleapis` text).

## Not verified

- Behaviour against real Postgres: the single INSERT's atomicity and the exact 23505 message text come from Postgres semantics and the 06-01 index name, exercised here only through the fake.
- No action wrappers yet (06-13); `verifyVideo` is optional in the core and nothing enforces it is supplied until then.

## Self-Check: PASSED

- FOUND: src/server/youtube/plan.ts, src/lib/admin/youtube-import.ts, src/lib/admin/youtube-verify.ts, tests/unit/youtube-plan.test.ts, tests/unit/youtube-import.test.ts, tests/unit/youtube-verify.test.ts
- FOUND commits: ffddf78, 815a027, efe8152, 96fb152, 9e6d4ed, c2b65f3
- STATE.md and ROADMAP.md untouched.
