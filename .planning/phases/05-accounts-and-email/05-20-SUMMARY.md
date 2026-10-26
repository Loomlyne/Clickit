---
phase: 05-accounts-and-email
plan: 20
subsystem: email-cron
tags: [cron, outbox, sweep, digest, queue, workers]
requires: ["05-13", "05-16", "05-19"]
provides: [runEmailCron (pure), isDigestEnabled, QUEUE_BATCH_MAX, GET /api/cron/email-digest]
affects: [05-35, 05-37, 05-39, 03 cutover crons]
tech-stack:
  added: []
  patterns: ["pure cron core over ports plus a thin route", "sweep always, digest behind an exact 'on' flag", "queue batch failure counted, never thrown (rows stay pending)"]
key-files:
  created:
    - src/server/email/cron-core.ts
    - src/app/api/cron/email-digest/route.ts
    - tests/unit/outbox-sweep.test.ts
  modified: []
key-decisions:
  - "Sweep and digest ids are deduped and sent together in batches of at most 100"
  - "A build_digest error is rethrown only after the swept ids are sent, so a digest failure never holds back the resends"
  - "Each failed queue batch adds 1 to queueErrors and the remaining batches still go out"
  - "The route calls getEmailQueue().sendBatch as a method (the EMAIL_QUEUE binding needs its own this)"
  - "Cron map entry and wrangler trigger NOT done: they conflict with Phase 3 A-3 / G8 (production schedules exactly three crons); NEEDS CONTROLLER"
requirements-completed: []
duration: 15min
completed: 2026-10-26
status: partial (cron core and route done; cron map entry and trigger wait for NEEDS CONTROLLER)
---

# Phase 5 Plan 20: Email cron (outbox sweep + digest) Summary

**`runEmailCron` (pure) runs the outbox sweep every time and the My List digest only when `EMAIL_DIGEST_ENABLED` is exactly `on`, and sends `{ outboxId }` messages in batches of at most 100. `GET /api/cron/email-digest` wraps it behind the constant-time `cronAuthOk` check and returns counts only. The `CRON_ROUTES` entry `0 16 * * *` and the wrangler trigger are not added: on main they would change the three production crons Koss signed for Phase 3 (A-3 / G8). That part waits for the controller.**

## Tasks

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 (RED) | Failing tests for the cron core | `5e41948e` | done |
| 1 (GREEN) | `cron-core.ts` | `6be0e166` | done |
| 1 | `CRON_ROUTES` entry, wrangler trigger, update cron-schedule/scheduled tests | - | **stopped: NEEDS CONTROLLER** |
| 2 | `/api/cron/email-digest` route | `109e8cc6` | done |

## What was built

- `src/server/email/cron-core.ts` (pure, no imports):
  - `runEmailCron(ports)`: sweep → digest (only when `digestEnabled`) → dedupe → send in chunks of `QUEUE_BATCH_MAX = 100`.
  - A sweep error throws. A digest error is rethrown after the swept ids are sent.
  - Each failed `sendBatch` call is logged as `[cron/email-digest] queue send failed, sweep will retry size=N` (no error text) and counted in `queueErrors`. Those rows stay pending.
  - Returns `{ swept, digest: number | 'disabled', queueErrors }`. Logs `[cron/email-digest] swept=N digest=M queueErrors=K`, never ids.
  - `isDigestEnabled(v)` is true only for exactly `on` (T-05-20-02).
- `src/app/api/cron/email-digest/route.ts`:
  - `dynamic = 'force-dynamic'`. `cronAuthOk(authorization, CRON_SECRET)`, else 401 `{ error: 'Unauthorized' }`.
  - `EMAIL_DIGEST_ENABLED` comes from `getWorkerEnv()`, else `process.env`.
  - Ports: `sweep_outbox({ p_limit: 500 })`, `build_digest({})`, and `(await getEmailQueue()).sendBatch(msgs)` called as a method. If the binding is missing, that becomes a counted queue error, not a 500.
  - Responds `{ ok: true, swept, digest, queueErrors }`. On error it logs `[cron/email-digest] failed <message>` and returns 500 `{ ok: false }`. No addresses or payloads.
  - It imports only `queue.ts` from the email pipeline. No consumer, deps, render-app or queue-local import (bundle rule).

## Wrangler case (plan Task 1)

Neither case of the plan applies cleanly. On main, top-level `triggers.crons` is `[]` (workers.dev). But `env.production.triggers.crons` already lists the three Phase 3 crons, and the cutover deploys that list. `CRON_EXPRESSIONS_FOR_PHASE_3` is `Object.keys(CRON_ROUTES)`, and three things pin it to exactly three:

- `tests/unit/cutover-config.test.ts` checks that env.production crons equal it and also equal the literal three.
- `scripts/cf/deploy-guard.mjs` holds `PRODUCTION_CRONS`, a literal three. `tests/unit/production-target.test.ts` checks it is the literal three and equals `CRON_EXPRESSIONS_FOR_PHASE_3`.
- `03-CONTEXT.md` A-3 (G8, signed by Koss 2026-10-21) says production schedules exactly those three. Runbook Step 26 expects the three schedules listed.

Adding `0 16 * * *` to `CRON_ROUTES`, as the plan's must-have requires, would therefore fail two Phase 3 tests. It could only pass by also changing env.production crons, the `PRODUCTION_CRONS` literal and the signed cutover set. wrangler.jsonc was not touched. `cron-schedule.ts`, `cron-schedule.test.ts` and `scheduled.test.ts` were not touched either.

## Verification

Verified:
- `node --test tests/unit/outbox-sweep.test.ts`: RED first (`ERR_MODULE_NOT_FOUND` for cron-core.ts), then 11/11 pass.
- Plan Task 1 verify command (cron-schedule, scheduled, outbox-sweep), plus cutover-config and production-target: 100 pass, 0 fail.
- Plan Task 2 verify: `npx tsc --noEmit` exit 0, and the three greps (`cronAuthOk`, `runEmailCron`, `[cron/email-digest]`) found. The plain-compare grep (`!== expected|=== expected`) prints nothing.
- `git diff origin/main -- wrangler.jsonc | grep -E '^-.*"[0-9*/ ,-]+ \* \*"'` prints nothing (no cron removed).
- `npm run test:unit`: 2672 pass, 0 fail. `npx tsc --noEmit`: exit 0. eslint on the three files: clean.
- `cf:build` + `cf:bundle-budget` (detached under heavy-run, HEAD 109e8cc6, placeholder public env): log `/Users/koss/.clickit-checks/p5-20-build.log` ends `exit=0`. It lists `ƒ /api/cron/email-digest` and prints `bundle-budget ok gzip=2976.39 KiB total=14567.79 KiB budget=3000 KiB headroom=23.61 KiB`. That is +1.28 KiB gzip over the 2,975.11 KiB baseline.

Not verified:
- The route against the shared local stack (real `sweep_outbox` / `build_digest`) and a real queue. No `next dev` run: the RPCs are proven in 05-13's scratch DB, and the route is thin glue over the tested core.
- Scheduled dispatch of `0 16 * * *` through `scheduled()`: this depends on the cron map entry, which waits for the controller.

Failed: none.

## Deviations from Plan

**1. [Rule 4 - stop] Cron map entry and trigger not added.** The plan assumed one `triggers.crons` list that is either empty or set after cutover. Main has two lists and a signed three-cron production set (see "Wrangler case"). The orchestrator's brief says to stop when the plan and main disagree, so this stops with NEEDS CONTROLLER below. The pure core and the route do not depend on the decision, so they were built and committed.

**2. [Rule 2 - Correctness] Digest error does not hold back resends.** The plan specifies the sweep error path only. If `build_digest` throws, the swept ids are sent first and then the error is rethrown, so the route still answers 500. Tested.

**3. [Rule 2 - Correctness] Partial queue failures.** One failed chunk does not stop later chunks. `queueErrors` counts failed chunks. Ids from sweep and digest are deduped. Tested.

## NEEDS CONTROLLER

`NEEDS CONTROLLER: 05-20 wants CRON_ROUTES['0 16 * * *'] = '/api/cron/email-digest' with CRON_EXPRESSIONS_FOR_PHASE_3 including it, but on main CRON_EXPRESSIONS_FOR_PHASE_3 = Object.keys(CRON_ROUTES) is pinned to exactly three by Phase 3 (cutover-config.test.ts, production-target.test.ts, deploy-guard.mjs PRODUCTION_CRONS, 03-CONTEXT A-3 / G8 signed by Koss, runbook Step 26). Pick one. (B, recommended) Keep Phase 3's signed three: CRON_EXPRESSIONS_FOR_PHASE_3 becomes an explicit literal of the three, CRON_ROUTES gains the digest entry (dispatch ready, nothing scheduled), a new CRON_EXPRESSIONS_FOR_PHASE_5 = ['0 16 * * *'], and Phase 5's go-live plan (05-35/05-37) adds it to env.production and PRODUCTION_CRONS after the cutover, on Koss's word; Phase 3 tests unchanged. (A) Add it to the cutover set now: CRON_ROUTES + env.production crons + PRODUCTION_CRONS become four, Phase 3 tests and runbook Step 26 say four; the cutover then runs the sweep daily (digest stays off by EMAIL_DIGEST_ENABLED=off); this changes Koss's signed G8, so it needs his signature. Either way the top-level workers.dev crons stay [] and 4 of 5 Free triggers are used once it is on.`

The next executor finishes Task 1 for the chosen option: the `cron-schedule.ts` entry and comment, the test updates, and the wrangler/deploy-guard edits for A only. Then it re-runs the Task 1 verify plus `cutover-config.test.ts` and `production-target.test.ts`.

## Known Stubs

None. Until the cron map entry lands, the route exists but nothing schedules it.

## Threat Flags

None beyond the plan's register:
- T-05-20-01 is mitigated: `cronAuthOk` constant-time Bearer check, no plain compare.
- T-05-20-02 is mitigated: the digest runs only on exactly `on`, and the wrangler var is `off`.
- T-05-20-03 is not changed: no trigger was added.

## Self-Check: PASSED

- FOUND: src/server/email/cron-core.ts, src/app/api/cron/email-digest/route.ts, tests/unit/outbox-sweep.test.ts
- FOUND: 5e41948e, 6be0e166, 109e8cc6
