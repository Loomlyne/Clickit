---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 14
subsystem: platform
tags: [csp, cloudflare-web-analytics, vercel-removal, turnstile, r2, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: media origin helper (02-09), presign host (02-12), Turnstile widget (02-13), Worker crons (02-07), build targets (02-06)
provides:
  - src/lib/csp.ts (buildCsp, R2_S3_HOST) wired into next.config.ts
  - src/lib/web-analytics.ts (beaconAttributes) and src/components/analytics/cf-web-analytics.tsx
  - tests/unit/no-vercel.test.ts guard
  - /api/dev/r2-put probe in scripts/cf/check-gates.mjs
affects: [02-22, 03]

tech-stack:
  added: []
  patterns:
    - "CSP is a pure function of env; the preview target is the only one that may carry loopback origins"
    - "Cloudflare Web Analytics token comes from NEXT_PUBLIC_CF_BEACON_TOKEN; no token, no script"

key-files:
  created:
    - src/lib/csp.ts
    - src/lib/web-analytics.ts
    - src/components/analytics/cf-web-analytics.tsx
    - tests/unit/csp.test.ts
    - tests/unit/web-analytics.test.ts
    - tests/unit/no-vercel.test.ts
  modified:
    - next.config.ts
    - src/app/[locale]/layout.tsx
    - src/server/scheduled.ts
    - src/server/cron-schedule.ts
    - src/app/api/cron/cleanup-media/route.ts
    - src/app/api/cron/publish-scheduled/route.ts
    - scripts/check-show-hero-video-sizes.mjs
    - scripts/upload-compressed-hero-videos.mjs
    - scripts/cf/check-gates.mjs
    - tests/unit/scheduled.test.ts
    - tests/unit/cron-schedule.test.ts
    - tests/unit/cf-check-scripts.test.ts
    - package.json
    - package-lock.json
  deleted:
    - vercel.json
    - .vercelignore
    - scripts/check-cron.sh

key-decisions:
  - "Target is derived from the existing build switch: CSP_UPGRADE_INSECURE=false (only build-target.mjs preview sets it) means target preview; anything else is production. Loopback Supabase and media origins are emitted for preview only, and only when they really are http 127.0.0.1/localhost"
  - "img-src keeps its existing https: allowance (not tightened here); the media origin is added explicitly"
  - "Beacon token must match [A-Za-z0-9_-]{1,128}; anything else renders nothing"
  - "src/lib/storage-range-proxy.ts keeps Vercel-CDN-Cache-Control until Phase 3 (02-09 open decision, default applied), excluded by name in the guard test"
  - "eslint.config.mjs keeps its .vercel ignore globs (harmless; guard does not scan it); .gitignore keeps .vercel"

patterns-established:
  - "no-vercel guard scans src, scripts (not scripts/cf), next.config.ts, package.json, package-lock.json, wrangler configs and the repo root"

requirements-completed: []

duration: 70min
completed: 2026-10-20
---

# Phase 02 Plan 14: CSP builder, Cloudflare Web Analytics, Vercel code removal

**The CSP is now a tested pure builder that allows Turnstile, Cloudflare Web Analytics, the media origin and the exact R2 S3 host for presigned PUTs; every Vercel and BotID artefact is out of code, config and dependencies, with a guard test so none returns.**

## Tasks and commits

| Step | Commit | What |
|------|--------|------|
| Task 1 | `c5b097d` | `buildCsp`, `beaconAttributes`, `CfWebAnalytics`; next.config.ts uses `buildCsp` and loses `withBotId`; layout renders the beacon instead of the two Vercel components |
| Task 2 | `af19416` | delete `vercel.json`, `.vercelignore`, `scripts/check-cron.sh`; uninstall `botid`, `@vercel/analytics`, `@vercel/speed-insights`; hero scripts stop reading `.env.vercel.production`; `supabaseCleanupEnabled` drops the `VERCEL=1` branch; `no-vercel.test.ts` |
| Extra | `cec992b` | `check-gates.mjs` probes `/api/dev/r2-put` (tokenless PUT, expects 404; 403 tolerated only on a loopback base); 2 new tests |

TDD: tests were written before the modules. `no-vercel.test.ts` was run RED on the old tree (5 of 6 failing: config files, package.json, package-lock, scan of `scheduled.ts`, `check-cron.sh`, both hero scripts, root file names) and GREEN after the cleanup. The csp/web-analytics tests were written first but not run before the modules existed, so there is no recorded RED run for those two files.

## CSP requirements from the cross-plan notes

| Requirement | Where it is met | Test |
|-------------|-----------------|------|
| `https://challenges.cloudflare.com` in `script-src`, `frame-src`, `connect-src` | `csp.ts` | `production CSP allows Turnstile...` |
| `https://static.cloudflareinsights.com` in `script-src`, `https://cloudflareinsights.com` in `connect-src` | `csp.ts` | same |
| R2 S3 host `https://e329b099b6e4272fc0915a99832e47fe.r2.cloudflarestorage.com` in `connect-src` (matches the host `r2-presign.ts` signs: `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`) | `R2_S3_HOST` | `R2 S3 host is the pinned...`, `R2 host is exact, never a wildcard` |
| Media origin in `img-src` and `media-src` | `csp.ts` | same |
| Supabase host (https + wss) from `NEXT_PUBLIC_SUPABASE_URL`, wildcard fallback | `csp.ts` | fallback tests |
| Loopback media origin and local Supabase origin in `connect-src`/`img-src`/`media-src` for preview only | `target: 'preview'` | `preview target adds...`, `loopback origins are never emitted for workersdev or production targets`, non-loopback http refused |
| No Vercel host in any directive | removed | `no directive names Vercel` for all three targets |
| `/api/dev/r2-put` in the dev-route check list | `DEV_ROUTES` in `check-gates.mjs` | 2 tests in `cf-check-scripts.test.ts` |

Checked on the real `cf:build` (preview) output: the routes manifest CSP carries the loopback media and local Supabase origins, Turnstile, Web Analytics and the R2 host, and no Vercel host. Deferred-items 6 (preview CSP blocked local Supabase) is resolved by this plan.

## Verification

- `npm run gate:local` under the shared heavy lock (detached, log `$HOME/clickit-phase02-logs/02-14-gate.log`): **exit=0**. Lint 0 errors / 26 warnings, unit tests 735 / 735 pass, `npm run build` and `npm run cf:build` both complete. The lock was acquired at 13:09:36 after another session's perf run and released by the script.
- Not verified: the browser behaviour of the beacon and of Turnstile under the new CSP (no token and no site key available; no browser run in this plan). Not verified: that workers.dev answers 404 for `/api/dev/r2-put` (02-22).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Removed the `VERCEL=1` env fallback in `supabaseCleanupEnabled`**
- **Found during:** Task 2 (guard test flagged `src/server/scheduled.ts`)
- **Issue:** the cleanup gate still returned true when `VERCEL=1`, a Vercel env fallback Koss's rule 2 removes. The workers runtime already ignored it.
- **Fix:** only `CLICKIT_RUNTIME=node` keeps cleanup on; `VERCEL=1` alone is now false (fail closed). `scheduled.test.ts` updated to assert that.
- **Files modified:** `src/server/scheduled.ts`, `tests/unit/scheduled.test.ts`
- **Commit:** `af19416`

**2. [Rule 1 - Stale references] Comments pointing at the deleted `vercel.json`**
- Rewrote the schedule and auth comments in both cron routes and `cron-schedule.ts` (no behaviour change); renamed one test title.
- **Commit:** `af19416`

**3. Extra scope: dev-route probe in `check-gates.mjs`**
- Required by the 02-12 and 02-14 cross-plan notes, not in the plan file. Probe is a tokenless PUT (cannot write).
- **Commit:** `cec992b`

No other deviations. `.github/workflows/*` untouched (CI rule 4 is tracked separately). CLAUDE.md "Deployment Notes" history left as is. Phase 8 owns the remaining prose mentions of Vercel (comments in `queries.ts`, `config.ts`, `supabase-media.ts`, `api/cdn/storage/route.ts`, `workers/media/DNS-PLAN.md`).

## Owner / controller items

- **Owner step:** to switch the Web Analytics beacon on, create the Cloudflare Web Analytics site in the ClickitStory account and put its token in the workersdev build env file as `NEXT_PUBLIC_CF_BEACON_TOKEN` (it is a public token, but it is Koss's to create). Until then the beacon renders nothing. Not asked for or created here.
- **Controller (Phase 3):** the live Vercel project, its crons and its domain are untouched (P3-6 crons off, P3-13 delete last). Deleting `vercel.json` from the repo does not stop live Vercel crons; deploys are blocked, so the repo change has no live effect.
- **Open decision carried over:** `src/lib/storage-range-proxy.ts` and `/api/cdn/storage` remain until Phase 3 (02-09).
- `npm uninstall` printed npm 11 "install-scripts" warnings (unrs-resolver, workerd, fsevents); they are existing install-script approvals, not caused by this plan (see deferred-items 3).

## Known Stubs

None.

## Threat Flags

None. Mitigations T-02-63 to T-02-66 are implemented (exact hosts, token pattern + `JSON.stringify`, upgrade-insecure-requests unless preview, guard test); T-02-67 accepted as planned.

## Self-Check: PASSED

- Files exist: `src/lib/csp.ts`, `src/lib/web-analytics.ts`, `src/components/analytics/cf-web-analytics.tsx`, `tests/unit/csp.test.ts`, `tests/unit/web-analytics.test.ts`, `tests/unit/no-vercel.test.ts`; `vercel.json`, `.vercelignore`, `scripts/check-cron.sh` absent.
- Commits present: `c5b097d`, `af19416`, `cec992b`.
