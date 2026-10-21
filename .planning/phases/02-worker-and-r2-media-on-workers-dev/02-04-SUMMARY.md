---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 04
subsystem: infra
tags: [security, cron, rate-limit, turnstile, cloudflare-workers, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: Next 16.4.2 / OpenNext base config and the node --test unit setup (plan 02-01)
provides:
  - src/server/cron-auth.ts (cronAuthOk, constantTimeDigestEqual)
  - src/server/cron-schedule.ts (CRON_ROUTES, cronPathFor)
  - src/server/client-ip.ts (clientIpFrom)
  - src/server/rate-limit-policy.ts (decideRateLimit)
  - src/server/turnstile.ts (verifyTurnstileToken, TURNSTILE_SITEVERIFY_URL)
  - 45 unit tests over the five helpers
affects: [02-07, 02-11, 02-06]

tech-stack:
  added: []
  patterns: ["pure server helpers with injected comparator/store/fetch, loadable by node --experimental-strip-types (no @/ or extensionless imports)", "refuse on every uncertain path (fail closed)"]

key-files:
  created:
    - src/server/cron-auth.ts
    - src/server/cron-schedule.ts
    - src/server/client-ip.ts
    - src/server/rate-limit-policy.ts
    - src/server/turnstile.ts
    - tests/unit/cron-auth.test.ts
    - tests/unit/cron-schedule.test.ts
    - tests/unit/rate-limit.test.ts
    - tests/unit/turnstile.test.ts

key-decisions:
  - "decideRateLimit also refuses a non-positive limit or window and a non-numeric count (reason store-error), so a misconfigured call can never allow"
  - "Turnstile reasons are fixed codes (missing-secret, missing-token, token-too-long, timeout, network-error, http-<status>, bad-response, rejected[:code]); raw error messages are never copied into them"
  - "cronPathFor uses hasOwnProperty so constructor/__proto__ cannot resolve to an inherited value"

patterns-established:
  - "Tests inject node:crypto timingSafeEqual as the comparator; production relies on crypto.subtle.timingSafeEqual and refuses when it is absent"

requirements-completed: []

duration: 20min
completed: 2026-10-20
---

# Phase 2 Plan 04: Pure security helpers Summary

**Five dependency-free helpers under `src/server/`: SHA-256 hash-then-`timingSafeEqual` cron auth, the cron-string-to-route map, a `cf-connecting-ip`-only client IP reader, a fail-closed rate-limit decision, and a Turnstile siteverify with a 5 s abort. Nothing is wired yet (plans 02-07 and 02-11).**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-20
- **Tasks:** 2 of 2
- **Files created:** 9 (5 modules, 4 test files)

## Accomplishments

- `cronAuthOk(header, secret, compare?)` trims the secret, refuses empty or missing values, hashes the header and `Bearer <secret>` with SHA-256 and compares the two 32-byte digests. The comparator is `crypto.subtle.timingSafeEqual` on workerd; with no comparator available (Node) it returns false rather than falling back to `===`. A comparator that throws also refuses. A spy test proves the comparator only ever sees two 32-byte buffers, even for a 5000-character header.
- `cronPathFor` maps `0 1 * * *` to `/api/cron/publish-scheduled` and `0 4 * * 1` to `/api/cron/cleanup-media` (the vercel.json schedules); anything else, including `constructor` and `__proto__`, is null.
- `clientIpFrom(headers, { allowLocalOverride })` reads only `cf-connecting-ip`, validates IPv4 and IPv6 without `node:net`, caps length at 45, returns null when missing or malformed, and returns `127.0.0.1` only when the explicit override is on and the header is absent.
- `decideRateLimit` returns `{ allowed, reason }` with reasons `ok`, `no-ip`, `store-error`, `limited`; the store is never touched without an IP, `record()` failing after an allow also refuses.
- `verifyTurnstileToken` posts `secret`, `response` and `remoteip` (omitted when unknown) as form data to the siteverify URL; refuses `success:false` (reason carries the first error code), HTTP errors, non-JSON, network errors, timeouts, missing secret, missing, blank or over-2048-character token (none of the last three call fetch). No `console` use.

## Task Commits

1. **Task 1 RED:** `d63be23` (test) - cron auth and cron map tests
2. **Task 1 GREEN:** `294c785` (feat) - cron auth and cron path map
3. **Task 2 RED:** `1e80e4e` (test) - client IP, rate-limit and Turnstile tests
4. **Task 2 GREEN:** `1b6e2d6` (feat) - client IP, rate-limit decision, Turnstile siteverify

**Plan metadata:** the SUMMARY/STATE/ROADMAP commit follows this file.

## Verification

| Check | Result |
|-------|--------|
| cron-auth.test.ts | 11 pass |
| cron-schedule.test.ts | 5 pass |
| rate-limit.test.ts (clientIpFrom 7, decideRateLimit 8) | 15 pass |
| turnstile.test.ts | 14 pass |
| `npm run test:unit` | 430 pass, 0 fail (was 385 after plan 02-02) |
| `npm run lint` | 0 errors, 26 warnings (the pre-existing set, deferred-items.md) |
| `tsc --noEmit` on the new files | no errors |
| `grep "x-forwarded-for\|x-real-ip" src/server/client-ip.ts` | no output |
| `grep "console\." src/server/turnstile.ts` | no output |
| `grep "===" src/server/cron-auth.ts` | only type, emptiness and boolean-result checks; no comparison of the secret or header |

Not run: `npm run gate:local` (plan-end line). These plans add standalone modules that no route imports yet, so the Next build and `cf:build` inputs are unchanged. The controller can run it under the shared heavy lock before the phase PR.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Fail closed on bad configuration and bad counts**
- **Found during:** Task 2
- **Issue:** the plan's fail-closed list covers missing IP, store errors and count at/over limit. A limit or window of 0, negative or NaN, or a store returning NaN, would otherwise let `count >= limit` evaluate false and allow.
- **Fix:** both cases refuse with reason `store-error` (tested).
- **Files modified:** src/server/rate-limit-policy.ts, tests/unit/rate-limit.test.ts
- **Commit:** 1b6e2d6

**2. [Rule 2 - Missing critical functionality] `cronPathFor` guards against inherited keys**
- **Found during:** Task 1
- **Issue:** a plain record lookup resolves `constructor` to a function.
- **Fix:** `hasOwnProperty` check (tested).
- **Commit:** 294c785

Parameter naming: the plan's behavior text says `fetch`, its action text says `fetchImpl`; the module uses `fetchImpl` (the action text), defaulting to the global `fetch`. Plan 02-11 should pass `fetchImpl`.

## Notes for plans 02-07 and 02-11

- `cronAuthOk` is async; cron routes must `await` it. In workerd leave the comparator argument out.
- `decideRateLimit` takes `ip`, `key`, `limit`, `windowMs` in milliseconds (today's `withinRateLimit` uses seconds) and a store with `count(ip, key, sinceIso)` / `record(ip, key)`. The existing `rate_limits` table has only a `key` column, so the Supabase store should fold the ip into the key (for example `support:<ip>`).
- Per research Pattern 7, call `verifyTurnstileToken` after zod validation and before the rate-limit insert.

## Known Stubs

None. The helpers are intentionally not wired yet (stated in the plan).

## Threat Flags

None. The modules do no I/O except the injected fetch in `turnstile.ts`, which targets the fixed Cloudflare siteverify URL.

## Self-Check: PASSED

- All five modules and four test files: found
- Commits d63be23, 294c785, 1e80e4e, 1b6e2d6: found in `git log`
