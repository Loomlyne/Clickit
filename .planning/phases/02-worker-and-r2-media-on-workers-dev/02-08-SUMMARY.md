---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 08
subsystem: infra
tags: [r2, media, sharp, avif, webp, ffmpeg, faststart, checksum, verify, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: sharp 0.35.5 and the node --test setup (02-01); media Worker variant negotiation and key layout (02-03); deploy guard and loadManifestInfo (02-06)
provides:
  - scripts/media/variants.mjs (planVariants, encodeVariant, variantKey, displayWidth, VARIANT_SPEC_VERSION)
  - scripts/media/faststart.mjs (topLevelBoxes, isFaststart)
  - scripts/media/report.mjs (buildDryRunReport, buildCopyReport, renderReportMarkdown, writeReportFiles, manifestFileInfo, extractMediaReferences)
  - scripts/media/verify-media-host.mjs (requestFor, evaluateRow, buildVerifyReport, runVerify, CLI)
  - scripts/migrate-supabase-media-to-r2.mjs extended in place (dry-run report, guarded --execute, variants, faststart remux, idempotency, checksum report)
affects: [02-06, 02-19, 02-20]

tech-stack:
  added: []
  patterns:
    - "Default run is read-only; the only write path is --execute behind assertWriteGuard (ClickitStory account id, bucket clickit-media, no CLOUDFLARE_API_TOKEN)"
    - "Idempotency through R2 customMetadata: variants carry src-sha256 + variant-spec, a remuxed video carries src-sha256 + transform; foreign objects at a key are a conflict, never overwritten"
    - "The copy no longer rewrites the manifest, so manifestSha256 is stable from the dry run through copy, verify and the deploy guard"
    - "Every collaborator is injectable (supabase client, R2 client, ffmpeg/ffprobe runners, report dir, clock, fetch), so all tests use fakes"

key-files:
  created:
    - scripts/media/variants.mjs
    - scripts/media/faststart.mjs
    - scripts/media/report.mjs
    - scripts/media/verify-media-host.mjs
    - tests/unit/variant-plan.test.ts
    - tests/unit/faststart.test.ts
    - tests/unit/verify-media-host.test.ts
  modified:
    - scripts/migrate-supabase-media-to-r2.mjs
    - tests/unit/r2-media-migration.test.ts

key-decisions:
  - "The copy script stops writing per-object copy state into the manifest; the checksum report carries it. Keeps the manifest hash stable (the guard compares it) and makes a re-run truly change nothing"
  - "Write guard requires CLOUDFLARE_ACCOUNT_ID == ClickitStory and CLOUDFLARE_R2_BUCKET == clickit-media (a scratch bucket is not possible without editing the guard)"
  - "Verify accepts only isAllowedMediaOrigin hosts (https clickit-media.<sub>.workers.dev or media.clickitstory.ae), the same rule the deploy guard applies to the report"
  - "Variant width is the post-EXIF-rotation width (displayWidth), so a portrait photo stored landscape is sized on what is displayed"

patterns-established:
  - "Read sharp inputs from Buffers, never from reused temp file names (libvips caches by path)"

requirements-completed: []

duration: 80min
completed: 2026-10-20
---

# Phase 2 Plan 08: Media copy and verify tooling Summary

**`npm run r2:media` is now a dry run that measures every Supabase object and writes a report, and `--execute` copies originals byte-for-byte, writes AVIF/WebP variants at 640/1280/1920, remuxes non-faststart MP4s (original kept in `_orig/`), and writes a checksum report; `scripts/media/verify-media-host.mjs` proves every row on the media Worker and its report passes the deploy guard.**

Nothing was run live: R2 is not enabled and the copy is an owner step. Everything below is proven on fakes, plus one real `ffmpeg` remux of a generated clip.

## Performance

- **Duration:** about 80 min
- **Completed:** 2026-10-20
- **Tasks:** 3 of 3
- **Commits:** 535eef9 (variants + faststart), c37eb22 (copy script + report), 575f107 (verify script + contract test)

## What changed

- **Variants** (`variants.mjs`): `planVariants` returns `{ variants, skipReason }`. Widths 640/1280/1920, only strictly narrower than the original; none for SVG, ICO, GIF, `pages > 1`, video or unknown types. Keys `_v/<w>/<avif|webp>/<bucket>/<key>`, spec `v1;w=<w>;fmt=<fmt>;q=<q>` (webp 80, avif 50, effort 4). `encodeVariant` is `sharp(input).rotate().resize({ width, withoutEnlargement: true })`; the EXIF-orientation-6 fixture comes out portrait (research Assumption A2 proven). A test imports the Worker's `variantCandidates` and `VARIANT_WIDTHS` so the layout cannot drift.
- **Faststart** (`faststart.mjs`): pure walker handling `size==1` (largesize) and `size==0` (to end); `isFaststart` is true/false/null.
- **Copy script** (extended, not forked):
  - Default: lists Supabase, downloads each object to a temp file (read-only), computes type, size, sha256, display width, pages, faststart flag, and ffprobe duration and bitrate, writes the manifest and `.tmp/r2-media-reports/dry-run-<ts>.json` and `.md`. It also scans a fixed list of `app_config` text/JSON columns (select only; `youtube_api_key` and `admin_user_id` are never selected) and lists media URLs not in the manifest. No R2 client is created.
  - `--execute` (guarded): originals through the existing download/compare/put/re-download/hash path, now reporting `skipped (identical)`; variants HEAD-checked first and skipped when `src-sha256` and `variant-spec` match, regenerated when only the spec differs, conflict when the object at a variant key is not ours; a non-faststart MP4 is remuxed with `ffmpeg -c copy -movflags +faststart` (argument array, temp files), the output is checked with `isFaststart`, served at the original key with `transform: ffmpeg:faststart`, and the untouched source is put first at `_orig/<bucket>/<key>`. Checksum report `copy-<ts>.json` and `.md` is written after every run, also after failures. No delete call exists anywhere.
  - The `.vercel/.env.production.local` load is gone; only `.env.local` and process env are read.
- **Verify** (`verify-media-host.mjs`): original rows by HEAD (200, content-length equals `dstSize`, etag), variant rows by GET `?w=` with `Accept: image/<fmt>` (content-type, `Vary: Accept`), video rows by `Range: bytes=0-1023` (206 and exact `content-range`), SVG rows need `sandbox` in the CSP, `_orig/` rows are not requested and counted as `originalsKeptNotRequested`, one negative check (`/not-a-bucket/x` must be 404), at most 4 requests in flight, a changed manifest hash or a short copy report is a failure. Output `{ manifestSha256, manifestObjectCount, originalsChecked, variantsChecked, failures, origin, finishedAt }` plus two informational fields.

## Contract with plan 02-06 (checked, not assumed)

- `manifestSha256` is sha256 of the manifest file bytes and the count is `manifest.objects.length`, exactly `loadManifestInfo` in `scripts/cf/build-target.mjs` (note: it lives there, `deploy-guard.mjs` only has `checkVerifyReport`). A test asserts `manifestFileInfo()` equals `loadManifestInfo()` for the dry run, the copy report and the verify report.
- A test fills a fake R2 with the real `runCopy`, serves it through the real `handleMediaRequest` from `workers/media/src/handler.ts`, runs `runVerify`, and asserts `checkVerifyReport(verifyReport, loadManifestInfo(manifest))` is `{ ok: true }`. A deleted variant is caught (the Worker falls back to the original, so the content-type check flags it).

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/unit/variant-plan.test.ts` | 9 pass |
| `node --test tests/unit/faststart.test.ts` | 8 pass |
| `node --test tests/unit/r2-media-migration.test.ts` | 29 pass (13 existing untouched, 16 new) |
| `node --test tests/unit/verify-media-host.test.ts` | 12 pass |
| `npm run test:unit` | 597 tests, 597 pass |
| `npm run lint` | 0 errors, 26 warnings (the same 26 as before) |
| `npx tsc --noEmit` | clean |
| `! grep "\.vercel/"` on the copy script; no `\b86\b` in the copy script or `scripts/media/`; no `Delete` command | pass (also asserted by a test) |
| `node scripts/media/verify-media-host.mjs --origin http://127.0.0.1:8789 --report /nonexistent.json` | refused, exit 1 |
| real `ffmpeg` remux of a generated mpeg4 clip (test, skipped when ffmpeg is absent) | not faststart before, faststart after |
| `npm run gate:local` (detached, heavy lock, `~/clickit-phase02-logs/02-08-gate.log`) | `exit=0`: lint, unit tests, `next build`, `cf:build` (preview-stamped); lock released |

Not verified: any run against live Supabase or R2 (owner step); real R2 `HEAD` metadata casing for `customMetadata` (the S3 SDK lower-cases keys, and the code only uses lower-case keys); real AVIF encode time for the full set; ffprobe output on the real hero MP4s; the actual number of Supabase objects (read from the manifest at run time, never assumed).

## Deviations from Plan

**1. [Rule 1 - Bug] sharp returned stale metadata for reused temp file names**
- **Found during:** Task 2 GREEN. The 1280 px variant decoded as 640 px.
- **Cause:** libvips caches by file name; the script reuses `source-object` and `destination-object` for every object.
- **Fix:** all sharp reads use Buffers (`sharp(await fs.readFile(path))`). Covered by the fresh-bucket test (decoded width checked per variant).
- **Commit:** c37eb22

**2. [Spec conflict] `planVariants` return shape**
- The behavior bullets say "returns 6 entries" and "returns []", the action says `{ variants, skipReason }`. Implemented the action shape; tests read `.variants`.

**3. [Judgement] Copy no longer writes `object.copy` into the manifest**
- The old `executeManifest` rewrote the manifest after every object. That would change `manifestSha256` between copy and verify and break "re-run changes nothing". The checksum report holds the per-object state instead. `executeManifest` and `copyAndVerifyObject` were internal (not exported), so no existing test changed.

**4. [Rule 2 - Addition] Guard, source-hash check and extras**
- `assertWriteGuard` (ClickitStory account id, bucket `clickit-media`, no API token) on the write path; a source whose sha256 differs from the manifest analysis fails that object ("Source changed since manifest"); variant decode width is re-checked after upload; `displayWidth` sizes variants on the post-rotation width; verify also fails when the copy report's own `failures` is non-empty.

**5. [Process] Tests and implementation for Task 1 landed in one commit**
- RED and GREEN were not committed separately (no `test(...)` commit); the tests were written first and run against the module as it grew.

## Owner / controller items

Nothing here ran against live data. The controller or Koss runs these (RUNBOOK Steps 25-29 already match the output names and flags):

1. **Dry run (reads live Supabase, no R2):** with the Step 25 variables exported in Koss's terminal, `cd <WORKTREE> && npm run r2:media -- --refresh`. It prints `Wrote N objects to .tmp/r2-media-manifest.json` and `Dry-run report: .tmp/r2-media-reports/dry-run-<ts>.md`. Review the `.md` (types, planned variants, skipped types, videos to remux, URLs referenced in `app_config` but missing from the manifest, analysis problems).
2. **Copy (R2 writes):** only after R2 is enabled, the bucket and S3 keys exist, and the dry-run is reviewed: `npm run r2:media -- --execute`; a second run must print only `skipped (identical)`. Needs `ffmpeg` and `ffprobe` on PATH (both present at `/opt/homebrew/bin`).
3. **Verify:** `node scripts/media/verify-media-host.mjs --origin https://clickit-media.<SUB>.workers.dev --report .tmp/r2-media-reports/copy-<ts>.json`. The manifest file must not change between the copy and the verify (or the deploy), or the hash comparison fails by design.
4. Do not run `--refresh` again after a copy: it rewrites the manifest and the old copy report no longer matches.
5. `sharp` is still a normal dependency here; plan 02-19 moves it to devDependencies.
6. If a hero MP4 should be re-encoded smaller (research Pattern 3 mentions `.tmp/hero-compress`), that is a separate decision; this plan only remuxes losslessly.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-02-31 (conflict on differing destination, no delete), T-02-32 (fake Supabase client asserted to receive only `select`, and `youtube_api_key` is never selected), T-02-34 (`spawnSync` with argument arrays) and T-02-35 (reports hold keys, sizes and hashes only; query strings are stripped from referenced URLs) are covered by tests.

## Self-Check: PASSED

All created and modified files exist; commits 535eef9, c37eb22 and 575f107 are on the branch.
