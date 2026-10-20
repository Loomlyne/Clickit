---
phase: 06-youtube-import-and-player
plan: 08
subsystem: api
tags: [youtube, cron, recheck, health, vault, node-test, tdd]

requires:
  - phase: 06-01
    provides: "record_youtube_checks(p_rows jsonb), readYouTubeApiKey (Vault), Phase 6 episode columns"
  - phase: 06-02
    provides: "classifyVideo, parseIsoDuration, YouTubeStatus"
  - phase: 06-03
    provides: "createYouTubeClient, YouTubeApiError, YouTubeClientLike"
provides:
  - "recheckVideosCore(db, youtube, now) in src/lib/admin/youtube-check.ts"
  - "cantPlayReason, summarizeYouTubeHealth, CHECK_OVERDUE_HOURS in src/lib/admin/youtube-health.ts"
  - "getServerYouTubeClient() in src/server/youtube-service.ts"
  - "GET /api/cron/youtube-recheck (CRON_SECRET Bearer, run by hand until Phase 2)"
  - "tests/unit/helpers/record-youtube-checks-emulator.ts"
affects: [06-13, 06-16, 06-18, 06-20, 06-22]

tech-stack:
  added: []
  patterns:
    - "One read, one batched YouTube call, one RPC write per cron run (about 8 subrequests for 300 episodes)"
    - "YouTube failures answer 200 with a reason (no retry storm); database failures answer 500"
    - "Source-scan guard tests for route handlers that import next/* and @/ paths"

key-files:
  created:
    - src/lib/admin/youtube-check.ts
    - src/lib/admin/youtube-health.ts
    - src/server/youtube-service.ts
    - src/app/api/cron/youtube-recheck/route.ts
    - tests/unit/helpers/record-youtube-checks-emulator.ts
    - tests/unit/youtube-recheck.test.ts
    - tests/unit/youtube-health.test.ts
    - tests/unit/youtube-recheck-route-guards.test.ts
  modified: []

key-decisions:
  - "Re-check rows send duration_seconds null when YouTube gives no usable length (removed or malformed); the SQL keeps the stored length for null and 0 alike"
  - "recheckVideosCore returns checkedAt (the injected now) on success so the route can report the run time; the database stamps its own now()"
  - "Database failures return detail (the database message) for the route to log; the HTTP answer carries only the reason code"
  - "summarizeYouTubeHealth excludes archived rows from every figure, lastCheckedAt included; never checked is not overdue"
  - "cantPlayReason: a stored not-ok status wins over a viewer report"

requirements-completed: [YT-02, YT-06]

duration: 7min (17:13-17:20 UTC)
completed: 2026-10-20
---

# Phase 6 Plan 08: Daily YouTube re-check, Can't-play rule and server client Summary

**Daily re-check core (one read, videos.list in 50-id batches, one `record_youtube_checks` write), the shared "Can't play" rule with the dashboard summary, the Vault-backed server YouTube client factory, and `GET /api/cron/youtube-recheck` behind main's CRON_SECRET check, with the Phase 2 wiring left as two TODO markers.**

## Task Commits

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | recheckVideosCore with a record_youtube_checks emulator | cf73c75 | 948bb46 |
| 2 | Shared Can't-play rule and dashboard summary | 99d9a56 | 98b8e37 |
| 3 | Server client factory and the cron route | 062f69e | 604740b |

No refactor commits.

## What was built

- **`youtube-check.ts`**: `recheckVideosCore(db, youtube, now)` selects `id, youtube_video_id` from episodes with `.not('youtube_video_id', 'is', null)` and no archived filter, drops blank ids, calls `getVideos` once with the unique ids (the 06-03 client splits into 50-id requests), builds `{ id, status: classifyVideo(item), duration_seconds: parseIsoDuration(...) }` and makes ONE `rpc('record_youtube_checks', { p_rows })` (cast pattern from `callReorderEpisodeRpc`). Results: `{ ok: true, checked, notOk, checkedAt }` or `{ ok: false, reason, detail? }` with reasons `quota | key_rejected | api_not_allowed | network | read_failed | write_failed`. A YouTube failure returns before any write. The file never names a text column (grep `title|description` = 0).
- **Emulator** mirrors migration 20261020150526 section 5: array and 5000-row checks (22023), status check (23514), `checked_at = now()`, seconds `coalesce(nullif(x,0), stored)`, minutes follow only while they equal `greatest(1, round(stored/60))`, `player_error_*` cleared only on `ok`, returns the updated row count.
- **`youtube-health.ts`** (pure, client-safe, type-only import): `CHECK_OVERDUE_HOURS = 36`; `cantPlayReason(row)` returns the stored not-ok status, else `viewer_report` when `player_error_at` is newer than `youtube_checked_at` (or there is no check yet), else null; `summarizeYouTubeHealth(rows, now)` returns `lastCheckedAt`, `neverChecked`, `overdue` (strictly over 36 h), the first 5 broken entries sorted by show title, season, episode, and `cantPlayTotal`. Archived rows are excluded.
- **`youtube-service.ts`**: line 1 `import 'server-only'`; `getServerYouTubeClient()` returns `{ client }` from `createYouTubeClient({ apiKey })` with the key from `readYouTubeApiKey()`, or `{ missing: true }`. For 06-13 and 06-16 to reuse.
- **Route `GET /api/cron/youtube-recheck`**: the publish-scheduled auth block copied as is, with the `cronAuthOk` TODO above it; the `'30 1 * * *'` TODO is line 1. Missing key: 503 `{ ok: false, reason: 'key_missing' }`. YouTube failures: 200 `{ ok: false, reason }`. Read/write failures: 500 `{ ok: false, reason }`, database message logged only. Success: 200 with the core result. Logs use `[cron/youtube-recheck]` and carry reason codes, database messages or an error name only. No `updateTag`/`revalidate*`, no Phase 2 import, no Vercel cron.

## Verification

- `node --test tests/unit/youtube-recheck.test.ts tests/unit/youtube-health.test.ts tests/unit/youtube-recheck-route-guards.test.ts`: 32 pass, 0 fail.
- `npm run test:unit`: 802 pass, 0 fail.
- `npx tsc --noEmit`: clean. `npx eslint` on all eight files: clean.
- Acceptance greps: `title|description` in youtube-check.ts = 0; `.rpc(` = 1; `CHECK_OVERDUE_HOURS = 36` = 1; `TODO(phase-2)` in route.ts = 2; `console.(log|error)(...key` in route.ts = 0; `git diff --name-only origin/main...HEAD | grep -cE "wrangler.jsonc|vercel.json|cron-schedule.ts|scheduled.ts"` = 0.
- RED confirmed for every task before GREEN (module not found / file not found).

## Not verified

- Behaviour against real Postgres: `record_youtube_checks` is exercised here only through the emulator. Manual runs against the local stack are 06-20 UAT; the live run is 06-22 on Koss's go.
- The route itself was not executed (it needs Next and the `@/` alias); it is covered by source guards plus the core tests. Not run: build, `gate:local`, Playwright (heavy, left to the PR gate).
- No live YouTube call, no real key, no Supabase stack command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `now` parameter tripped eslint**
- **Found during:** Task 1 GREEN
- **Issue:** the plan's signature takes `now: Date`, but the SQL stamps `now()` itself, so the parameter was unused (eslint warning).
- **Fix:** the success result carries `checkedAt: now.toISOString()`; the tests assert it.
- **Commit:** 948bb46

**2. [Rule 1 - Test bug] Two guard assertions matched comments**
- **Found during:** Task 3 GREEN
- **Issue:** "imports no Phase 2 module" matched the required TODO text naming `cron-auth.ts`; "no transport option" matched a service comment.
- **Fix:** the route check looks only at `from '...'` import specifiers; the service check strips `//` comments and asserts the exact `createYouTubeClient({ apiKey })` call.
- **Commit:** 604740b

**3. Additions inside the plan's intent**
- Read and write failures answer 500 (the plan names only the 200 YouTube case and the 503 key case); unhandled throws answer 500 `reason: 'unhandled'` and log only the error name.
- The core also catches a thrown read or RPC (not only `{ error }`), returning `read_failed` / `write_failed`.

## Known limits

- The episode read is a single PostgREST select. Supabase's default `max_rows` (1000) would cap it; the catalog is about 300 episodes today. If it ever nears 1000, the read needs paging (one more subrequest per 1000 rows).

## TODO(phase-N)

- `src/app/api/cron/youtube-recheck/route.ts` line 1: `// TODO(phase-2): register '30 1 * * *' -> /api/cron/youtube-recheck in CRON_ROUTES (src/server/cron-schedule.ts) and wrangler.jsonc triggers.crons`
- Same file, above the auth block: `// TODO(phase-2): swap the inline Bearer check for cronAuthOk(header, secret) from src/server/cron-auth.ts (constant time)`

## TDD Gate Compliance

Each task has a `test(06-08)` commit before its `feat(06-08)` commit.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-06-31 (Bearer check, 401), T-06-32 (one read, 50-id batches, one write, 200 on quota), T-06-33 (service-role-only RPC, no text columns), T-06-34 (logs carry reason codes only) are covered by the tests above; T-06-35 stays accepted (no schedule until Phase 2).

## Self-Check: PASSED

- FOUND: all eight files listed under key-files.
- FOUND commits: cf73c75, 948bb46, 99d9a56, 98b8e37, 062f69e, 604740b.
- STATE.md and ROADMAP.md untouched.
