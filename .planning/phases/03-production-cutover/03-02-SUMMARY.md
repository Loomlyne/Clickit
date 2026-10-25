---
phase: 03-production-cutover
plan: 02
subsystem: infra
tags: [cloudflare-workers, opennext, deploy-guard, wrangler, supabase-keys, r2]
requires:
  - phase: 03-production-cutover
    provides: wrangler.jsonc env.production (03-01), PR #30 media env r2-workersdev and guard rules (main 1d11529)
provides:
  - build-target --target production (PRODUCTION_ENV_FILE, classifySupabaseKey, checkProductionBuildArgs, verifyReportSha256 in the stamp)
  - checkProductionDeploy, checkTargetSwitch (D-18), media custom-domain route rule for envs r2 and supabase-only
  - deploy.mjs --target production (deploy-only), clickit.last-deploy.json, --offline dry run for every target
  - npm scripts cf:build:production and cf:deploy:production
affects: [03-06 runbook Steps 25-26, 03-08 media Worker R2-first, 03-09 production env file, 03-10 flip]
tech-stack:
  added: []
  patterns:
    - "Deploy-only production: one stamped build, deploy checks the stamp, HEAD, origin/main and the verify-report sha256"
    - "Fail-closed last-deploy state file outside the repo (D-18)"
    - "Guard results carry notes (account check: skipped (offline)) next to reasons"
key-files:
  created:
    - tests/unit/production-target.test.ts
  modified:
    - scripts/cf/build-target.mjs
    - scripts/cf/deploy-guard.mjs
    - scripts/cf/deploy.mjs
    - package.json
    - .env.example
key-decisions:
  - "Production crons compared as sorted lists: same three schedules in any order pass, duplicates or a fourth fail"
  - "sb_secret_ keys refused in every NEXT_PUBLIC value for every build target (T-03-06), not only the anon key"
  - "Media envs r2 and supabase-only: routes (own, or inherited from the top level as wrangler does) must be exactly media.clickitstory.ae custom domain; r2-workersdev rules from PR #30 unchanged"
  - "An unreadable last-deploy file counts as an unknown target, so workers.dev is refused (fail closed) unless the override reason is given"
  - "--offline skips only the wrangler whoami check; shell env checks (API token, VERCEL) still run"
requirements-completed: []
duration: 8min
completed: 2026-10-21
---

# Phase 3 Plan 02: Production build target and deploy guard Summary

**`cf:build:production` makes the one www build from `clickit.production.env` (publishable key, real Turnstile, beacon token, media verified on media.clickitstory.ae); `cf:deploy:production` deploys only that stamped build with `--env production` and refuses unless the account, HEAD in origin/main, the report hash, the www route and the three crons all check out. After a production deploy, a workers.dev deploy needs a written reason (D-18).**

## Performance

- Clock: first timestamp 14:46:42Z UTC (taken after the plan and code reads), summary written 14:54Z UTC
- Completed: 2026-10-21
- Tasks: 2 of 2
- Files: 1 created, 5 modified

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 RED | Failing tests for production rules | 7465db7 | tests/unit/production-target.test.ts |
| 1 GREEN | Pure production rules | 4229ec6 | scripts/cf/build-target.mjs, scripts/cf/deploy-guard.mjs |
| 1 fix | Lint: typed fixture alias | 7b1c82a | tests/unit/production-target.test.ts |
| 2 | Build, dry run, deploy-only; D-18 state; npm scripts; --offline | 38fe3b2 | scripts/cf/deploy.mjs, scripts/cf/build-target.mjs, package.json, .env.example, tests/unit/production-target.test.ts |

## What was built

- **build-target.mjs**: `PRODUCTION_ENV_FILE` (`/Users/koss/.clickit-cloudflare/clickit.production.env`), `PRODUCTION_SITE_URL`, re-exported `PRODUCTION_MEDIA_ORIGIN`, `classifySupabaseKey` (publishable / secret / legacy-jwt / missing / other), `buildEnvFor('production', …)` (every rule in the plan; all KNOWN_PUBLIC names set explicitly), `makeStamp` now records `supabaseKeyKind`, `beaconToken` (set/missing) and, for production, `verifyReportSha256`. `checkProductionBuildArgs` refuses before any build without `--media-flag verified` and `--verify-report`; `fileSha256` hashes the report bytes. The production build also runs the folded-.env and next-env.mjs checks (as workersdev did).
- **deploy-guard.mjs**: `PRODUCTION_ZONE_ID`, `PRODUCTION_ROUTE`, `PRODUCTION_CRONS` (literal, sorted-equal to `CRON_EXPRESSIONS_FOR_PHASE_3` by test), `checkProductionDeploy` (stamp target, media verified on media.clickitstory.ae, publishable key, beacon, real Turnstile, loopback/local, stamp sha = HEAD, report sha256 = stamp, verify report against the production origin, clean tree, `origin/main` line, account_id, top-level crons `[]`, env.production name `clickit`, the single www route by zone_id, the three crons, real d1 ids, no `LOCAL_DEV` / `CLEANUP_SUPABASE_ORIGINALS`, `R2_UPLOAD_SWEEP_DELETE` rule with `--allow-upload-sweep-delete`), `checkTargetSwitch` (D-18, 15+ character override). `checkDeploy` and `checkMediaDeploy` accept `offline` and return `notes`. `checkMediaDeploy` keeps PR #30's `r2-workersdev` rules unchanged and adds the exact media custom-domain route rule for `r2` and `supabase-only`.
- **deploy.mjs**: `--target production` is deploy-only (never spawns build-target): reads the stamp, prints `deploy-only: using build stamp <sha7> built <createdAt>`, hashes the report passed now, runs `checkProductionDeploy`, then `npx opennextjs-cloudflare deploy --env production`, writes `clickit.last-deploy.json` `{ target, gitSha, deployedAt }` and prints the route and the three crons. `--allow-upload-sweep-delete` is read once before the dry-run branch, so the dry run and the deploy take it alike. `deployWorkersdev` checks D-18 before its build, prints the override reason, and records `workersdev` after a successful deploy. `--offline` works only with `--dry-run` (every target).
- **package.json**: added only `cf:build:production` and `cf:deploy:production`.
- **.env.example**: a commented section naming the production env file and its five NEXT_PUBLIC names (no values).

## Offline dry run (Task 2 acceptance)

Run in the worktree with `HOME=/Users/koss/.clickit-cloudflare` and a PATH shim that records any `npx`, `wrangler` or `opennextjs-cloudflare` call:

```
$ node scripts/cf/deploy.mjs --target production --dry-run --offline --verify-report /nonexistent.json
account check: skipped (offline)
deploy-guard REFUSED:
  - .open-next/cloudflare/next-env.mjs is missing: cannot prove no .env value is in the bundle
  - no production build: run cf:build:production first (.open-next/clickit-build-stamp.json missing)
  - production media: verify report missing or not an object
  - HEAD is not contained in origin/main: production deploys only from main (PR + Ship)
exit=1
```

The shim recorded no call: no wrangler or opennextjs-cloudflare process was started. Also checked:
- `deploy.mjs --target production --offline --verify-report …` (no `--dry-run`): `--offline is only allowed together with --dry-run`, exit 1.
- `build-target.mjs --target production --media-flag verified` (no report): `refused: the production target needs --verify-report <path> …`, exit 1, no build.
- `--target workersdev --dry-run --offline`: refused (no stamp, no next-env, HEAD not on origin), account skipped. `--target media --env r2 --dry-run --offline`: `deploy-guard ok (dry run)` against the real media config.

`/Users/koss/.clickit-cloudflare/clickit.last-deploy.json` does not exist today, so workers.dev deploys stay allowed until the first production deploy writes it.

## Verification

- `node --test tests/unit/production-target.test.ts tests/unit/deploy-guard.test.ts tests/unit/cutover-config.test.ts`: 136 pass, 0 fail (production-target alone: 52 cases)
- `npm run test:unit`: 2234 pass, 0 fail
- `npm run lint`: exit 0
- `npm run typecheck`: exit 0
- Secret-pattern grep on production-target.test.ts: 0
- No build, no wrangler call, no deploy was run.

## TDD Gate Compliance

- RED: 7465db7 `test(03-02)`, the file failed to import (`checkProductionDeploy` etc. missing).
- GREEN: 4229ec6 `feat(03-02)`, 125 pass across the three test files.
- Task 2 (not tdd) tests were added with the code in 38fe3b2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lint failed on `any` in the new test file**
- Found during: Task 1 commit (eslint ran after the commit in the same chain)
- Fix: one `Loose` alias with a single eslint-disable line, as other test files do
- Files: tests/unit/production-target.test.ts
- Commit: 7b1c82a

**2. [Rule 2 - Critical] sb_secret_ refused in every NEXT_PUBLIC value, every target**
- The plan names `'secret' (never allowed in a build)`; the guard now checks every NEXT_PUBLIC value of preview, workersdev and production, not only the anon key (T-03-06).
- Commit: 4229ec6

**3. [Rule 2 - Critical] Media route rule follows wrangler inheritance**
- The existing test fixtures leave `routes` off the env (inherited from the top level). The new rule checks the env's own routes or, when absent, the top-level ones, so the fixtures stay as they were and an inherited wrong route is still refused. `route` (singular) is refused in r2 and supabase-only.
- Commit: 4229ec6

### Readings of the orchestrator notes
- "checkMediaDeploy refuses any other env name": kept as `supabase-only`, `r2`, `r2-workersdev` (PR #30), no rule weakened.
- Production crons compared as sorted lists against `PRODUCTION_CRONS`; the drift test already pins the order in wrangler.jsonc.

## Known Stubs

None.

## Threat Flags

None. The new state file (`clickit.last-deploy.json`) sits outside the repo and holds a target, a commit sha and a time only; it is in the plan.

## Next

- 03-06 runbook: Step 25 = `npm run cf:build:production -- --verify-report <path>` then `npm run cf:deploy:production -- --dry-run --verify-report <path>`; Step 26 = `npm run cf:deploy:production -- --verify-report <path>` (deploy-only).
- DNS-02, DNS-03, MEDIA-02 are not ticked: they close with the ops plans.

## Self-Check: PASSED

- FOUND: tests/unit/production-target.test.ts, scripts/cf/build-target.mjs, scripts/cf/deploy-guard.mjs, scripts/cf/deploy.mjs
- FOUND commits: 7465db7, 4229ec6, 7b1c82a, 38fe3b2
