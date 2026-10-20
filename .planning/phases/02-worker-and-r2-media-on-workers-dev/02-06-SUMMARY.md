---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 06
subsystem: infra
tags: [cloudflare-workers, wrangler, deploy-guard, build-stamp, media-cutover, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: wrangler account guard and cf:* scripts (02-01); media Worker with MEDIA_BUCKET and supabase-only env (02-03)
provides:
  - scripts/cf/deploy-guard.mjs (checkDeploy, checkMediaDeploy, checkVerifyReport, parseJsonc, isAllowedMediaOrigin)
  - scripts/cf/build-target.mjs (buildEnvFor, makeStamp, parseEnvFile, loadManifestInfo, per-target OpenNext build + stamp)
  - scripts/cf/deploy.mjs (CLI behind cf:deploy:workersdev and cf:deploy:media)
  - package.json scripts cf:build:preview, cf:build:workersdev, cf:deploy:workersdev, cf:deploy:media; cf:build/cf:preview now go through the preview target
  - .env.example (names only, 20 variables) and a .gitignore exception that keeps it tracked
  - 56 named tests in tests/unit/deploy-guard.test.ts
affects: [02-08, 02-09, 02-10, 02-14, 02-20]

tech-stack:
  added: []
  patterns:
    - "Pure guard functions over plain data (git, wrangler and file reads happen only in deploy.mjs)"
    - "Stamp holds sha256 of each NEXT_PUBLIC value, never the value"
    - "Media env is always passed explicitly to wrangler (--env \"\" or --env supabase-only)"

key-files:
  created:
    - scripts/cf/deploy-guard.mjs
    - scripts/cf/build-target.mjs
    - scripts/cf/deploy.mjs
    - tests/unit/deploy-guard.test.ts
    - .env.example
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "checkMediaDeploy accepts exactly one R2 binding MEDIA_BUCKET -> clickit-media plus only the SUPABASE_URL var on the top level, and the supabase-only env with no R2 binding (per 02-03); the plan's 'any binding other than MEDIA' is replaced"
  - "cf:deploy:media passes --env \"\" in the npm script, deploy.mjs refuses when --env is absent, and always hands --env <value> to wrangler; verified locally that wrangler 4.151.2 accepts --env \"\" without the inheritance warning that the bare supabase-only env shows"
  - "The media flag can only come from buildEnvFor('workersdev', ..., verified) and needs https clickit-media.<sub>.workers.dev (or media.clickitstory.ae), the same manifest sha256, report count == manifest count == originalsChecked, 0 failures, and the report origin equal to the origin being set"
  - "Workers.dev builds set every known NEXT_PUBLIC name explicitly (empty when unused), LOCAL_DEV empty and NEXTJS_ENV=production, so no stray .env.local value can be inlined"
  - "The preview target runs without its gitignored .env.preview.local (clean clone / gate:local) and takes NEXT_PUBLIC_* from the shell instead; it is stamped preview either way and the guard refuses it"

patterns-established:
  - "Deploy refusal prints every reason, never a value; dry run (--dry-run) stops after the guard and never builds or deploys"

requirements-completed: []

duration: 35min
completed: 2026-10-20
---

# Phase 2 Plan 06: Deploy guard and build stamp Summary

**The only deploy path now refuses anything but a clean, pushed, stamped workersdev build for the ClickitStory account, and the media cutover flag cannot be set without a verify report that proves every object; the media deploy guard knows 02-03's `MEDIA_BUCKET`, `SUPABASE_URL` and `supabase-only` env.**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-10-20
- **Tasks:** 2 of 2
- **Commits:** 797c0aa (test, RED), 40558e0 (feat, guard and stamp), 8fbe6aa (feat, CLI, scripts, .env.example)

## What changed

- `deploy-guard.mjs`: `checkDeploy` refuses (collecting every reason) a wrong or other account in whoami, `CLOUDFLARE_API_TOKEN`, `VERCEL`/`VERCEL_ENV`, missing stamp, stamp target other than `workersdev`, loopback, local Supabase (port 55321), `LOCAL_DEV`, stamp commit not equal to HEAD, dirty tree, HEAD not on any origin branch, wrangler `account_id` mismatch, all-zero D1 id, `triggers.crons` not an explicit empty array, `LOCAL_DEV` in vars, and `verified` without a passing report. `checkMediaDeploy` is described under decisions. `parseJsonc` handles comments and trailing commas outside strings and reads both real `wrangler.jsonc` files.
- `build-target.mjs`: `buildEnvFor` (preview never sets the cutover flag, adds `NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK=1`, the local media origin `http://127.0.0.1:8789` and `CSP_UPGRADE_INSECURE=false`; workersdev requires site URL, Supabase URL and anon key and an https workers.dev or clickitstory.ae site URL), `makeStamp` (target, gitSha, createdAt, mediaFlag, mediaOrigin, `publicHashes`, `hasLoopback`, `hasLocalSupabase`, `localDev`), and the CLI that spawns the HOME-pinned OpenNext build with a minimal env and writes `.open-next/clickit-build-stamp.json`.
- `deploy.mjs`: `--target workersdev` (whoami, git state, early refusal before the build, build, stamp and wrangler config read, `checkDeploy`, then `opennextjs-cloudflare deploy`) and `--target media` (`checkMediaDeploy`, then `wrangler deploy -c workers/media/wrangler.jsonc --env <explicit>`). Child processes use `spawnSync` with argument arrays. `--dry-run` stops after the guard.
- `package.json`: the four new scripts; `cf:build` is now `cf:build:preview`, so `gate:local` still ends in a preview-stamped build that the guard refuses; `cf:preview` builds the preview target first.
- `.env.example` lists the 20 names with empty values and one comment line each (where the value lives). `.gitignore` had `.env*`, which ignored it, so `!.env.example` was added.

## Verification

- `node --test tests/unit/deploy-guard.test.ts`: 56 tests, 56 pass (plan asked for at least 20).
- `npm run test:unit`: 523 tests, 523 pass.
- `npm run lint`: 0 errors, 26 warnings (the same 26 pre-existing ones).
- `grep -n "console.log(.*process.env" scripts/cf/build-target.mjs`: no output. The stamp in the tests has `publicHashes` and a test asserts the raw anon key, Supabase URL and site URL are absent from it.
- `npm run cf:build` (detached, under the heavy lock, log `~/clickit-phase02-logs/02-06-cfbuild.log`, `exit=0`): wrote a preview stamp. Lock was released and is free.
- Guard dry run on that preview stamp, `node scripts/cf/deploy.mjs --target workersdev --dry-run`, exit 1:

```
deploy-guard REFUSED:
  - stamp target is preview, expected workersdev
  - stamp shows a loopback URL (127.0.0.1, localhost, 0.0.0.0 or ::1) in a NEXT_PUBLIC value
  - stamp shows the local Supabase URL (port 55321) in a NEXT_PUBLIC value
  - stamp shows LOCAL_DEV was set in the build
  - working tree is dirty: commit or remove changes first
  - HEAD is not contained in any origin branch: push the commit first
  - d1 database_id is the all-zero placeholder (write the real id first)
```

  (whoami under the pinned HOME showed ClickitStory only, so no account reason.)
- Media dry runs on a clean tree: `--env ""` and `--env supabase-only` both print `deploy-guard ok (dry run)`; without `--env` it refuses. `wrangler deploy --dry-run --outdir <scratch> --env ""` shows `MEDIA_BUCKET (clickit-media)` and `SUPABASE_URL`, no inheritance warning.
- Not verified: a real deploy (none was run, as required), a workersdev build (needs `clickit.workersdev.env`, RUNBOOK Step 11), the verified-flag path end to end (the verify report and manifest come from plan 02-08; only fixtures were used), `opennextjs-cloudflare deploy` arguments and output format (the `deployed:` URL line is matched with a regex on stdout).

## Deviations from Plan

### Deliberate (instructed in the task message and 02-03 summary)

1. **Media binding is `MEDIA_BUCKET`, with `SUPABASE_URL`.** The plan's "any binding other than MEDIA" is replaced as described above; other binding kinds (kv, d1, services, durable objects and so on) and extra vars are refused at the level being deployed. Cron triggers are checked at the top level for both envs, since `triggers` is inheritable, and also in the env block when it defines its own.
2. **`--env` is explicit.** Added `checkMediaDeploy` input `env` ('' or 'supabase-only'); any other value or an absent one is refused.

### Auto-fixed

**1. [Rule 3 - Blocking] `.env*` in `.gitignore` ignored `.env.example`.** The plan assumed the `.env*.local` rule only. Added `!.env.example`.

**2. [Rule 1 - Bug, found by lint] `any` in a test cast.** Replaced with a typed cast before the commit.

### Additions beyond the plan text

- `cf:build` / `cf:build:preview` must not fail in a clean clone without the gitignored `.env.preview.local`; the preview target reads the env file only if present and otherwise takes `NEXT_PUBLIC_*` from the shell. The workers.dev target still refuses without its file.
- The verify-report origin may also be `https://media.clickitstory.ae` (the future custom domain); everything else, including any other workers.dev name, is refused. Remove this if Koss wants it workers.dev only until Phase 3.
- `manifest` for the verify comparison is `{ manifestSha256, manifestObjectCount }` computed by `loadManifestInfo(.tmp/r2-media-manifest.json)` (sha256 of the file bytes, length of the objects list). Plan 02-08 must write the manifest with a top-level array or an `objects`/`entries`/`items` array and hash the same file bytes in `verify-media-host.mjs`, otherwise the hashes will not match.
- `deploy.mjs` has an extra early refusal (whoami, dirty tree) before the long build, and the dry run defaults the media flag to `off` (a real deploy requires it spelled out).

## Owner / controller items

- RUNBOOK Steps 12, 28 and 30 run these scripts from the control session; no deploy was run here.
- Plan 02-08 should compute `manifestSha256` as the sha256 of the manifest file bytes (see above).
- Plan 02-10 writes the real D1 id; until then the guard refuses every workersdev deploy by design.

## Known Stubs

None.

## Threat Flags

None. T-02-20 to T-02-24 are covered by named tests; no new endpoint, auth path or file access outside the plan.

## Requirements

PLAT-08 and PLAT-01 left unticked in REQUIREMENTS.md: the deploy mechanics are in and tested, but they are only delivered once a real guarded deploy has run (RUNBOOK Step 12, plan 02-10).

## Self-Check: PASSED

Files exist: deploy-guard.mjs, build-target.mjs, deploy.mjs, deploy-guard.test.ts, .env.example. Commits 797c0aa, 40558e0, 8fbe6aa present in `git log`.
