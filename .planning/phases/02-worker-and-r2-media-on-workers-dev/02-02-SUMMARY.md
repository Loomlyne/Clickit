---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 02
subsystem: infra
tags: [cloudflare, r2, cors, runbook, wrangler]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: wrangler account guard and cf:* scripts (plan 02-01)
provides:
  - scripts/cf/r2-cors.mjs with buildR2CorsRules (nested wrangler CORS JSON, https origins only)
  - 8 unit tests for the CORS builder and its CLI
  - 02-RUNBOOK.md reviewed line by line, with a Review log
affects: [02-06, 02-08, 02-10, 02-20, 02-21, 02-22]

tech-stack:
  added: []
  patterns: ["pure builder plus import.meta.url main-guard CLI (same as wrangler-guard.mjs)"]

key-files:
  created:
    - scripts/cf/r2-cors.mjs
    - tests/unit/r2-cors.test.ts
  modified:
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/02-RUNBOOK.md

key-decisions:
  - "CORS builder rejects credentials in an origin as well (not in the plan; one more way to smuggle a non-origin string)"
  - "Runbook Rule 5 now names the four owner-gated live-Supabase exceptions instead of claiming Part A only touches Step 23"

patterns-established:
  - "Runbook edits are checked by a grep recipe (unpinned wrangler Command lines, Phase 3 markers, key patterns) and logged under Review log"

requirements-completed: []

duration: 15min
completed: 2026-10-20
---

# Phase 2 Plan 02: R2 CORS builder and runbook review Summary

**`scripts/cf/r2-cors.mjs` renders the bucket CORS file (PUT only, https origins only, no wildcard) for RUNBOOK Steps 7-9, and `02-RUNBOOK.md` is reviewed against D-01..D-05 and the plans that build its scripts.**

## Performance

- **Duration:** about 15 min
- **Completed:** 2026-10-20
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- `buildR2CorsRules(origins)` returns `{ rules: [{ allowed: { origins, methods: ["PUT"], headers: ["Content-Type"] }, exposeHeaders: ["ETag"], maxAgeSeconds: 3600 }] }`. It throws on http, any `*`, a path, query, hash, credentials, non-URL input and an empty list; it de-duplicates (including a trailing-slash twin) and keeps order. The CLI takes repeated `--app-origin`, prints JSON, exits 1 on bad input. No network, no wrangler call.
- Tests written first and seen failing (module missing), then green: 8 cases (happy path, http, wildcard, path/query/hash, non-URL, empty, de-dup, CLI exit codes).
- Runbook review (six checks, logged at the bottom of the file): one unpinned wrangler command fixed (P3-11), one missing Expected added (Step 33), Rule 5 corrected to match Steps 31, 32 and 34, Step 12's expected guard output extended to the real `checkDeploy` list. Script names and flags for Steps 12, 26-30 match plans 02-06 and 02-08. Part B has P3-1..P3-13, Vercel deletion last, Vercel crons off (P3-6) before Worker crons on (P3-8); cron schedules equal `vercel.json`.

## Task Commits

1. **Task 1 RED:** `dda7c3d` (test) - failing tests for the CORS builder
2. **Task 1 GREEN:** `e5e2884` (feat) - R2 CORS rule builder and CLI
3. **Task 2:** `3d58479` (docs) - runbook review and Review log

**Plan metadata:** the SUMMARY/STATE/ROADMAP commit follows this file.

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/unit/r2-cors.test.ts` | 8 pass, 0 fail |
| CLI with https origin | JSON, `rules[0].allowed.methods[0] == "PUT"` |
| CLI with `http://127.0.0.1:8787` | exit 1, nothing on stdout |
| `npm run test:unit` | 385 pass, 0 fail |
| `npm run lint` | 0 errors, 26 warnings (pre-existing, see deferred-items.md) |
| Runbook grep recipe (plan Task 2 verify) | passes: 0 unpinned `Command` wrangler lines, 15 "Phase 3, not now", 34 steps, Review log present, 0 key patterns |

Not run: `npm run gate:local` (plan-end line). This plan changes one standalone script, one test file and a markdown file; no build input changed. The controller can run it under the shared heavy lock before the phase PR.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] CORS builder also refuses credentials in an origin**
- **Found during:** Task 1
- **Issue:** `https://user:pass@host` parses as a valid https URL; `url.origin` would strip it silently, hiding a malformed input.
- **Fix:** throw on username or password.
- **Files modified:** scripts/cf/r2-cors.mjs
- **Commit:** e5e2884

**2. [Rule 1 - Bug] Runbook Rule 5 contradicted Steps 31, 32 and 34**
- **Found during:** Task 2 check 3
- **Issue:** Rule 5 said Part A writes live Supabase only at Step 23.
- **Fix:** Rule 5 lists the four owner-gated live-Supabase exceptions.
- **Commit:** 3d58479

The other runbook fixes (P3-11 pin, Step 33 Expected, Step 12 guard list) are the review's intended output, not deviations.

## Open items for the owner / controller

- Research assumption A3 (CORS key names `headers`, `exposeHeaders`, `maxAgeSeconds`) is still unconfirmed: RUNBOOK Step 8 is where wrangler accepts or rejects them. If it rejects one, `scripts/cf/r2-cors.mjs` is the one place to change.
- Step 34 (measurement sign-ins) is numbered last but runs before Steps 31-32; the runbook says so in the step text.

## Requirements

PLAT-08 and MEDIA-01 are in the plan frontmatter but are NOT marked complete in REQUIREMENTS.md. This plan delivers the runbook and the CORS file builder only. PLAT-08 closes when the guarded deploy scripts (02-06) have run; MEDIA-01 closes with the presigned-upload path (browser to R2 to finalize). The controller marks them when those plans land.

## State notes

`gsd-sdk query state.*` rewrote the STATE.md progress block (completed_phases 1, total_plans 36, status verifying, Phase complete text). I reverted those fields to the previous values; 01.1 is not claimed complete and Current Position is untouched.

## Known Stubs

None.

## Threat Flags

None. The new script has no network or file access and only prints JSON.

## Self-Check: PASSED

- scripts/cf/r2-cors.mjs, tests/unit/r2-cors.test.ts, 02-RUNBOOK.md: found
- Commits dda7c3d, e5e2884, 3d58479: found in `git log`
