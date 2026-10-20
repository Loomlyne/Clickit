---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 07
subsystem: infra
tags: [cloudflare-workers, opennext, cron, scheduled, headers, site-url, check-scripts, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: base Worker, wrangler.jsonc and custom-worker.ts (02-01); cronAuthOk and cronPathFor (02-04); deploy guard (02-06)
provides:
  - custom-worker.ts scheduled() that calls the mapped /api/cron/* route in-process through handler.fetch
  - src/server/scheduled.ts (buildCronRequest, supabaseCleanupEnabled, CRON_EXPRESSIONS_FOR_PHASE_3)
  - src/server/cloudflare.ts (getWorkerEnv, WorkerEnv, R2BucketLike)
  - both cron routes on constant-time cronAuthOk; cleanup-media skips Supabase deletes on the Worker
  - siteUrl() without VERCEL_* fallbacks; public/_headers; scripts/cf/check-gates.mjs and check-revalidate.mjs
affects: [02-08, 02-10, 02-11, 02-14, 02-22, 03-cutover]

tech-stack:
  added: []
  patterns:
    - "Cron expressions live in code (CRON_ROUTES, CRON_EXPRESSIONS_FOR_PHASE_3) and in a wrangler.jsonc comment; triggers.crons stays []"
    - "Deletion gates fail closed: no declared runtime means no Supabase delete"
    - "Check scripts export pure functions and only run main when invoked directly"

key-files:
  created:
    - src/server/scheduled.ts
    - src/server/cloudflare.ts
    - public/_headers
    - scripts/cf/check-gates.mjs
    - scripts/cf/check-revalidate.mjs
    - tests/unit/scheduled.test.ts
    - tests/unit/site-url.test.ts
    - tests/unit/cf-check-scripts.test.ts
  modified:
    - custom-worker.ts
    - wrangler.jsonc
    - src/lib/site-url.ts
    - src/app/api/cron/publish-scheduled/route.ts
    - src/app/api/cron/cleanup-media/route.ts

key-decisions:
  - "supabaseCleanupEnabled({}) is false (fail closed). Workers: only CLEANUP_SUPABASE_ORIGINALS=on enables it. Vercel (VERCEL=1) and CLICKIT_RUNTIME=node keep today's behaviour"
  - "Crons not added to wrangler.jsonc (Koss rule); the two schedules are documented in CRON_EXPRESSIONS_FOR_PHASE_3 and a wrangler comment"
  - "scheduled() passes the Worker env straight to handler.fetch; the route reads process.env.CRON_SECRET, which OpenNext fills from the same env"
  - "check-gates also asserts both cron routes answer 401 without the secret (GET, no write)"

patterns-established:
  - "Local cron test: npm run cf:preview -- --port <p>, then GET /cdn-cgi/local/scheduled?cron=0+1+*+*+*; logs via POST /cdn-cgi/local/explorer/api/local/observability/query (wrangler does not print console output to a non-TTY log)"
  - "Preview needs .dev.vars (gitignored) with CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL for server-side runtime values; .env.preview.local only feeds the build"

requirements-completed: []

duration: 55min
completed: 2026-10-20
---

# Phase 2 Plan 07: Worker port finish Summary

**The Worker now dispatches cron strings to the two cron routes in-process (off until Phase 3), both routes check the secret in constant time, cleanup cannot delete Supabase originals on the Worker, the site URL has no Vercel fallback, and `check-gates` / `check-revalidate` exist and run against any base URL.**

## Accomplishments

- `custom-worker.ts` exports `fetch`, `scheduled` and `DOQueueHandler`. `scheduled()` builds `GET https://self.invalid/api/cron/<route>` with `Bearer <CRON_SECRET>`, runs `handler.fetch` inside `ctx.waitUntil`, logs `cron: <path> status <n>` (error level when not ok), and for an unknown cron or empty secret logs `cron: no route <cron>` and returns.
- Both cron routes use `await cronAuthOk(...)`; the `authHeader !== expected` comparison is gone.
- `cleanup-media` computes the candidate list as before, then if `supabaseCleanupEnabled(process.env)` is false returns `{ ok: true, skipped: "supabase-originals", candidates }` before any R2 or storage write.
- `wrangler.jsonc`: `CLICKIT_RUNTIME: "workers"` added; `"crons": []` unchanged.
- `src/server/cloudflare.ts`: `getWorkerEnv()` via `getCloudflareContext({ async: true })`, `WorkerEnv` with the app Worker's `MEDIA` binding (a local structural `R2BucketLike`; no `@cloudflare/workers-types` in the repo, so `cf-typegen` was not run and no `cloudflare-env.d.ts` committed).
- `siteUrl()`: `NEXT_PUBLIC_SITE_URL` (http/https only, trailing slashes removed), else `https://www.clickitstory.ae` in production, `http://127.0.0.1:3000` otherwise. No `VERCEL` string left in the file.
- `public/_headers` (immutable cache for `/_next/static/*` and `/brand/*`, nosniff on `/*`); wrangler reported "Parsed 3 valid header rules" and `.open-next/assets/_headers` exists after the build.
- `scripts/cf/check-gates.mjs` and `scripts/cf/check-revalidate.mjs` (REST mode locked to `http://127.0.0.1:55321`, plus `--via-admin-action` read-only mode with `--path`, `--expect`, `--cookie-file`).

## Task Commits

1. **Task 1 RED:** `52976b3` (test) - scheduled dispatch and cleanup gate tests
2. **Task 1 GREEN:** `0896d8d` (feat) - scheduled(), cron auth, cleanup gate, bindings accessor, `CLICKIT_RUNTIME`
3. **Task 2 (site URL, headers):** `2a76fdf` (feat)
4. **Task 2 (check scripts and tests):** `b470c6d` (feat)

Note: for the site-URL change the tests and implementation went into one commit (`feat(02-07): drop VERCEL site URL fallbacks...`), so there is no separate RED commit for Task 2; the tests were written first and passed against the new code in the same step.

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/unit/scheduled.test.ts` | 11 pass (plan asked for 7) |
| `node --test tests/unit/site-url.test.ts` | 10 pass |
| `node --test tests/unit/cf-check-scripts.test.ts` | 8 pass |
| `npm run test:unit` | 552 tests, 552 pass (includes the 56 deploy-guard tests, still green with `CLICKIT_RUNTIME` in wrangler.jsonc) |
| `npm run lint` | 0 errors, 26 warnings (same 26 as before) |
| `npx tsc --noEmit` | clean |
| `npm run gate:local` (detached, under the heavy lock, `~/clickit-phase02-logs/02-07-gate.log`) | `exit=0`: lint, unit tests, `next build`, `cf:build` (preview-stamped) |
| `node scripts/cf/check-revalidate.mjs --base http://127.0.0.1:8787 --supabase-url https://lajguozmtissnnfccmej.supabase.co` | refused, exit 2, before any network call (unit test also asserts zero fetch calls) |

### Local scheduled run (preview on 127.0.0.1:8791, local Clickit Supabase at 127.0.0.1:55321, never live)

Used `opennextjs-cloudflare preview` (a wrangler dev session; the scheduled endpoint is available without `--test-scheduled`, per 02-SPIKE) with a gitignored `.dev.vars`.

| Trigger | Result in Worker logs |
|---------|-----------------------|
| `/cdn-cgi/local/scheduled?cron=0+1+*+*+*` | `cron: /api/cron/publish-scheduled status 200` |
| `/cdn-cgi/local/scheduled?cron=0+4+*+*+1` | `[cron/cleanup-media] skipped supabase-originals {candidates:0,...}` then `cron: /api/cron/cleanup-media status 200` |
| `cron=*+*+*+*+*` | `cron: no route * * * * *` |
| `GET /api/cron/cleanup-media` with the local secret | `{"ok":true,"skipped":"supabase-originals","candidates":0}` |
| same route, wrong secret / no header | 401 / 401 |

The first attempt returned 500 on both routes because `.dev.vars` lacked `SUPABASE_SERVICE_ROLE_KEY`; the auth step had already passed (not 401), which showed `CRON_SECRET` reaches `process.env` from the Worker env. After adding the local key, 200 as above.

`check-gates.mjs --base http://127.0.0.1:8791`: 9 PASS, exit 0 (`/en`, `/ar`, `/` to locale, `/en/profile`, `/en/my-list`, `/en/design-system`, `/en/admin` each redirect to `/en/auth`, both cron routes 401). Static asset headers on the same preview: `/_next/static/chunks/*` and `/brand/*` return `Cache-Control: public, max-age=31536000, immutable` and `x-content-type-options: nosniff`.

Preview was started detached under the heavy lock and stopped by recorded PGID (`kill -TERM -- -<pgid>`); port 8791 confirmed free and the lock directory gone, both times.

Not verified: `candidates` was 0 locally (no Supabase Storage orphans on the local stack), so the skip path was exercised but not with a non-empty list; `check-revalidate.mjs` REST mode and `--via-admin-action` mode were not run end to end (the series page is behind sign-in and needs a session cookie; planned for UAT and plan 02-22); `--admin-cookie-file` / `--viewer-cookie-file` / `--expect-coming-soon` paths of `check-gates` were not run (no session files, coming-soon off).

## Deviations from Plan

### Auto-fixed / judgement calls

**1. [Rule 1 - Spec conflict] `supabaseCleanupEnabled({})` returns false, not true**
- **Found during:** Task 1 RED
- **Issue:** The plan says `supabaseCleanupEnabled({})` is false and, in the same list, that "any other runtime (no CLICKIT_RUNTIME)" keeps today's behaviour (true). Both cannot hold for `{}`.
- **Fix:** Fail closed for an empty env (so a dropped `CLICKIT_RUNTIME` var can never turn deletion on on the Worker); true when `VERCEL === "1"` or `CLICKIT_RUNTIME === "node"` so the Vercel deployment's behaviour is unchanged. `CLICKIT_RUNTIME=workers` with `VERCEL=1` is still false.
- **Files:** src/server/scheduled.ts, tests/unit/scheduled.test.ts
- **Commit:** 52976b3, 0896d8d

**2. [Instruction override] Crons stay out of wrangler.jsonc**
- The plan did not require adding the crons to wrangler.jsonc, and Koss's rule keeps them off, so `"crons": []` is unchanged. The two expressions are in `CRON_EXPRESSIONS_FOR_PHASE_3` (src/server/scheduled.ts, unit-tested) and a comment in wrangler.jsonc for Phase 3 P3-8.

**3. [Rule 3 - Blocking] `.dev.vars` needed for the local run**
- Preview did not expose `SUPABASE_SERVICE_ROLE_KEY` to the Worker at runtime from `.env.preview.local`. Created a gitignored `.dev.vars` (values copied from `.env.preview.local` without printing them; the Supabase URL was asserted to be the local one). Nothing committed.

**4. [Rule 2 - Addition] Extra tests and a cron 401 check**
- Added `tests/unit/cf-check-scripts.test.ts` (8 tests, not in the plan's file list) so the local-only refusal and argument parsing are covered, and `check-gates` asserts both cron routes answer 401 without the secret.

**5. [Skipped optional] cf-typegen**
- Not run: the repo has no `@cloudflare/workers-types`, so a local `R2BucketLike` type is used instead. No `cloudflare-env.d.ts` was committed.

**Process note:** the site-URL tests and implementation share one commit (see Task Commits).

## Owner / controller items

- Phase 3 P3-8: copy `CRON_EXPRESSIONS_FOR_PHASE_3` (`0 1 * * *`, `0 4 * * 1`, UTC) into `triggers.crons` only after P3-6 (Vercel crons off), and decide whether `CLEANUP_SUPABASE_ORIGINALS=on` is ever set (not in Phase 2).
- The deploy guard (02-06) still refuses non-empty `triggers.crons`; Phase 3 must change the guard and wrangler.jsonc together.
- PLAT-10 code part is done (VERCEL_* fallbacks removed); it stays pending Koss's signature on proposed roadmap edit 1. Vercel artefacts (vercel.json, Vercel crons, BotID in `proxy.ts`) remain for plan 02-14.
- Remote item for 02-10: confirm on workers.dev that `process.env.CRON_SECRET` is populated from a Worker secret in a real scheduled run (verified locally with a `.dev.vars` value only).

## Known Stubs

None.

## Threat Flags

None. The new cron path is the in-process route call already covered by T-02-25; `scheduled()` adds no network surface.

## Self-Check: PASSED

All created files exist; commits 52976b3, 0896d8d, 2a76fdf, b470c6d are on the branch.
