---
phase: 03-production-cutover
plan: 01
subsystem: infra
tags: [cloudflare-workers, wrangler, cron, next-cache]
requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: CRON_ROUTES map, custom-worker scheduled handler, top-level wrangler.jsonc bindings, deploy guard parseJsonc
provides:
  - publish-scheduled refreshes episodes/shows tags and / and /coming-soon on every successful sweep
  - wrangler.jsonc env.production target (name clickit, www.clickitstory.ae/* by zone_id, three crons)
  - drift test between env.production and the workers.dev top level
affects: [03-02, 03-03, 03-04, 03-05, runbook Step 26]
tech-stack:
  added: []
  patterns:
    - "Source-text guard test for route ordering"
    - "Config drift test comparing wrangler env block to top level"
key-files:
  created:
    - tests/unit/publish-scheduled-refresh.test.ts
    - tests/unit/cutover-config.test.ts
  modified:
    - src/app/api/cron/publish-scheduled/route.ts
    - src/server/scheduled.ts
    - wrangler.jsonc
key-decisions:
  - "Cron map left exactly as Phase 2 shipped it (amended D-12 / G8); only a comment changed in scheduled.ts"
  - "env.production keeps workers_dev true and preview_urls false, same Worker name so secrets and bindings stay"
  - "env.production has no CLEANUP_SUPABASE_ORIGINALS; R2_UPLOAD_SWEEP_DELETE stays off"
requirements-completed: [DNS-02, DNS-03]
duration: 20min
completed: 2026-10-21
---

# Phase 3 Plan 01: Publish refresh and env.production Summary

**publish-scheduled now refreshes caches on every successful run, and wrangler.jsonc declares an `env.production` target (www route by zone_id, the three Phase 2 crons) guarded by a drift test.**

## Task 1 (run by the orchestrator)

Task 1 (entry check) was run by the orchestrator, not by this executor: `03-ENTRY.md` says `ENTRY: PASS 787ca3a4065f8bb585025c2dc987077b3abc9736` (commits 8335253 and 7ff6124; items 2 and 3 are recorded only per G11, re-read at runbook Step 0c). It was not redone or edited, and origin/main was not merged again.

## Tasks 2 and 3

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 2 | Publish refresh on every run | 63feb76 | route.ts, scheduled.ts, publish-scheduled-refresh.test.ts |
| 3 | env.production + drift test | 99182d0 | wrangler.jsonc, cutover-config.test.ts |

- Task 2: the four refresh calls moved out of `if (episodeIds.length > 0)`; they run after the `epError` early return and before the success JSON, inside the try. Header comment gained the Vercel-cron line. `CRON_EXPRESSIONS_FOR_PHASE_3` comment updated. `cron-schedule.ts`, `cron-schedule.test.ts` and `scheduled.test.ts` are unchanged (`git diff` against the ENTRY sha is empty).
- Task 3: `env.production` repeats services, ai, r2_buckets, d1_databases (real database_id), durable_objects and vars from the top level, plus `RESEND_FROM_EMAIL = "Clickit Story <no-reply@clickitstory.ae>"`. Top-level `triggers.crons` stays `[]`; the `migrations` block stays top level only (as written in the plan).

## TDD record

- RED, Task 2: `publish-scheduled-refresh.test.ts` ran 3 pass / 1 fail before the route change; the failing case was "no episodeIds.length guard wraps the cache refresh" (the ordering cases already held in the old code). GREEN after the change: 26 pass across cron-schedule, scheduled and the new test.
- RED, Task 3: `cutover-config.test.ts` ran 0 pass / 8 fail before wrangler.jsonc changed. GREEN after: 77 pass with deploy-guard.test.ts.
- Tests were committed together with their implementation (one commit per task), so the git log has no separate `test(...)` commit; the RED runs are recorded here instead.

## Verification

- `npm run test:unit`: 2017 tests, 2017 pass, 0 fail.
- `npm run lint`: 0 errors, 25 warnings (pre-existing, none in files touched here).
- `npm run typecheck`: clean.
- Acceptance greps: `"www.clickitstory.ae/*"` 1, zone id 1, sender string 1, secret-shape grep 0 in both files.
- Not run (by design): builds, wrangler, deploy, live database.

## Deviations from Plan

None. The plan text and the code agreed (CRON_ROUTES key order, top-level `ai` binding, `R2_UPLOAD_SWEEP_DELETE` "off").

## Known Stubs

None.

## Threat Flags

None. wrangler.jsonc carries only public ids and the sender address.

## Self-Check: PASSED

Files and commits 63feb76, 99182d0 verified present.
