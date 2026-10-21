---
phase: 06-youtube-import-and-player
plan: 03
subsystem: api
tags: [youtube, data-api-v3, fetch-client, fixtures, node-test]

requires:
  - phase: 06-youtube-import-and-player
    provides: "06-00 gate (branch has Phase 1/1.1; Phase 2-5 absent, G8)"
provides:
  - "createYouTubeClient({ apiKey, fetchImpl }): getPlaylist, listPlaylistItemsPage, getVideos"
  - "YouTubeApiError with fixed per-code messages; YOUTUBE_API_ERROR_CODES; YouTubeClientLike"
  - "Six hand-written API fixtures in the documented shapes"
affects: [06-04, 06-05, 06-06, 06-08]

tech-stack:
  added: []
  patterns:
    - "Pure client under src/server/youtube: injected fetchImpl, no next/*, no server-only, no @/ alias"
    - "Key in x-goog-api-key header only; cache no-store; errors carry fixed text plus an allow-listed reason"

key-files:
  created:
    - src/server/youtube/client.ts
    - tests/unit/youtube-client.test.ts
    - tests/unit/fixtures/youtube/playlists-ok.json
    - tests/unit/fixtures/youtube/playlist-items-page1.json
    - tests/unit/fixtures/youtube/playlist-items-page2.json
    - tests/unit/fixtures/youtube/videos-mixed.json
    - tests/unit/fixtures/youtube/error-quota.json
    - tests/unit/fixtures/youtube/error-key-invalid.json
  modified: []

key-decisions:
  - "YouTubeApiError stores `reason` only when it is in a fixed allow-list; response text never reaches an error"
  - "Quota also covers dailyLimitExceeded and rateLimitExceeded (documented Google quota reasons); any other unknown reason is 'network'"
  - "An empty apiKey fails as key_rejected before any request is made"
  - "Playlist item videoId falls back from contentDetails.videoId to snippet.resourceId.videoId (kind youtube#video), else null"

patterns-established:
  - "Fake fetch helper (records URL/headers/init, serves fixtures by path and page token) reusable by later plans' tests"

requirements-completed: [YT-01, YT-02, YT-03, YT-04]

duration: 12min
completed: 2026-10-20
---

# Phase 6 Plan 03: YouTube Data API client Summary

**Key-safe YouTube Data API v3 client with 50-item paging, 50-id videos.list batching, header-only key transport (no-store) and status-then-reason error mapping to five fixed codes, tested against six hand-written fixtures with no live call.**

## Task Commits

1. **Task 1: Fixtures in the documented shapes** - `8174328` (test)
2. **Task 2: Client with paging, batching, header transport and error mapping**
   - RED `e466552` (test), GREEN `0e50623` (feat)

No refactor commit was needed.

## What was built

- `src/server/youtube/client.ts`: `getPlaylist` (empty items -> `playlist_private`), `listPlaylistItemsPage` (items with `videoId` or null, `nextPageToken`, `totalResults`), `getVideos` (chunks of 50, returns a Map; ids absent from the response are absent from the Map; `[]` makes no call; 404 `videoNotFound` yields no items).
- Every request: `https://www.googleapis.com/youtube/v3/...`, no `key` parameter, `x-goog-api-key` header, `cache: 'no-store'`, no `next` init. The client accepts no transport option.
- Errors: HTTP status first, then an allow-list of `errors[0].reason` values (A8); 5xx, thrown fetch, unparseable body or unknown reason -> `network`. A message containing "API key not valid" maps to `key_rejected`.
- Fixtures carry `"_source": "documented shape, not recorded"`. `videos-mixed.json` has public, unlisted, private, uploaded, upcoming premiere, not embeddable, blocked AE, allowed-without-AE and Arabic-title videos, plus a `_requestedIds` list with one id (`removedVid1`) the response omits.

## Verification

- `node --experimental-strip-types ... --test tests/unit/youtube-client.test.ts`: 31 tests, 31 pass.
- `npx eslint src/server/youtube/client.ts tests/unit/youtube-client.test.ts`: clean. `npx tsc --noEmit`: no errors in these files.
- Acceptance greps on `client.ts`: `key=|keyTransport|'query'` 0, `search` 0, `no-store` 1, `revalidate` 0, `@/|server-only|next/` 0. `grep -l '"_source"' tests/unit/fixtures/youtube/*.json | wc -l` = 6.
- Every `YouTubeApiErrorCode` is a key of `YOUTUBE_ERROR_MESSAGE_KEYS` in `src/lib/youtube-errors.ts` (06-02); 06-06 will assert this in its own test.
- Not run: build, gate:local, full `test:unit` (heavy; left to the PR gate). No live YouTube call, no API key used.

## Deviations from Plan

None - plan executed as written. Two small additions inside the plan's intent: `dailyLimitExceeded` / `rateLimitExceeded` count as quota, and an empty key fails fast as `key_rejected`.

## Known Stubs

None.

## Threat Flags

None. T-06-14, T-06-15 and T-06-16 are mitigated as planned (tests assert the key and `googleapis.com` never appear in message, `String(err)` or `JSON.stringify(err)`; no-store; 50-id batches, no search endpoint).

## Self-Check: PASSED

- Files found: `src/server/youtube/client.ts`, `tests/unit/youtube-client.test.ts`, six fixtures.
- Commits found: `8174328`, `e466552`, `0e50623`.
