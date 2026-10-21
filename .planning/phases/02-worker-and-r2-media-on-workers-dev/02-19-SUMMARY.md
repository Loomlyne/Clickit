---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 19
subsystem: media
tags: [r2, workers, sharp, aws-sdk, server-actions, guard-test, bundle]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: finalize*Upload actions (02-15, 02-16), browser uploads (02-17, 02-18)
provides:
  - no module under src/ imports sharp or @aws-sdk/*; every admin page and server action works on the Worker preview with no stub
  - src/server/r2-delete.ts, R2-only media deletion for admin actions (no Supabase original is ever removed)
  - tests/unit/worker-request-paths.test.ts, the guard that keeps the old paths from coming back
affects: [02-22]

key-files:
  created:
    - src/server/r2-delete.ts
    - tests/unit/r2-delete.test.ts
    - tests/unit/worker-request-paths.test.ts
  modified:
    - src/app/[locale]/admin/actions.ts
    - src/app/[locale]/(viewer)/profile/actions.ts
    - src/app/api/cron/cleanup-media/route.ts
    - next.config.ts
    - package.json
    - package-lock.json
    - tests/unit/admin-actions-media-wrappers.test.ts
    - tests/unit/admin-image-upload-source.test.ts
    - tests/unit/admin-video-upload.test.ts
    - src/server/upload-kinds.ts
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/deferred-items.md
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/02-EXECUTOR-RULES.md
  deleted:
    - src/lib/r2-media-core.ts
    - src/lib/r2-media.ts
    - tests/unit/r2-media.test.ts

key-decisions:
  - "The three remaining callers of the old Supabase-remove-plus-R2-mirror helpers (removePreloaderVideo, removeSiteImage, deleteCastMember, deleteShowPermanently, plus the cleanup cron) moved to R2-only deletion in src/server/r2-delete.ts, so the mirror module could be deleted and MEDIA-07 (no Supabase original removed before Koss approves) holds for every admin action. Deletion is staged and carried out at commit; rollback is a no-op because nothing is removed earlier."
  - "The guard test scans every shipped source file (src/, workers/media/src, custom-worker.ts, image-loader.ts, open-next.config.ts) and also walks the import graph from every route, action and proxy entry, so a banned import reached through a helper is reported with its path."
  - "Deferred item 7 handled in this plan (it fell out of deleting r2-media); the cleanup cron route keeps its flag gate (CLEANUP_SUPABASE_ORIGINALS=on) and now deletes the R2 mirror by key through the MEDIA binding."

requirements-completed: []

duration: 55min
completed: 2026-10-20
---

# Phase 2 Plan 19: Old upload actions, sharp and S3 SDK out of the request paths Summary

**The ten old FormData/signed-upload actions, sharp, the S3 mirror module and the 55 MB action body limit are gone; the real Worker preview now serves every admin page and a saved admin server action with no sharp stub, and a guard test in gate:local keeps it that way.**

MEDIA-01 and PLAT-01 are NOT ticked in REQUIREMENTS.md: the request-path half is done and proven locally, but one real presigned PUT against R2 plus a range request on workers.dev (02-22) and the deployed Worker are still open.

## Task Commits

1. **Task 1:** `b7f4601` (feat) - guard test (RED first), old actions and `src/lib/r2-media*` deleted, R2-only deletion helper, 01.1 tests moved to the finalize actions
2. **Task 2:** `5cdaf94` (chore) - `bodySizeLimit: '2mb'`, `sharp` and `@aws-sdk/client-s3` to devDependencies (same versions, lockfile diff is 5 lines)
3. **Docs:** SUMMARY, deferred items, executor-rules note, STATE and ROADMAP progress

## What was built

- Deleted from `admin/actions.ts`: `uploadArtwork`, `uploadSiteImage`, `uploadSocialIcon`, `uploadCastImage`, `createHeroVideoUpload`, `saveHeroVideoUpload`, `createPreloaderVideoUpload`, `savePreloaderVideoUpload`, `createShowVideoUpload`, `saveShowVideoUpload`, plus the `sharp` import, `mirrorUploadedPublicMedia`, `cleanupMirroredPublicMedia`, `removeMirroredPublicMedia`, `stageMirroredPublicMediaDeletion`, `isMp4File`, the preloader path helpers and the `SignedVideoUploadTarget` type. Profile: `uploadAvatar`, `getAvatarStoragePath`.
- `src/server/r2-delete.ts` (pure, injected bucket): `withVariantKeys`, `stageR2Deletion` (nothing removed until commit, batches of 500), `stageR2DeletionForUrl` / `deleteMediaForUrl` (only urls on our media origin; Supabase, foreign and empty urls are a no-op), `listKeys` (paginated, fails closed), `stageShowMedia` (lists `<bucket>/shows/<id>/` in R2, id validated against prefix widening).
- `removePreloaderVideo`, `removeSiteImage`, `deleteCastMember` and `deleteShowPermanently` use it; `/api/cron/cleanup-media` removes the Supabase object (flag-gated, off by default) and then the R2 mirror by key.
- `worker-request-paths.test.ts` (6 tests): no banned specifier (`sharp`, `@aws-sdk/`, `@smithy/`) or `r2-media` module in any shipped file; import-graph walk from every route/action/proxy entry; deleted files and the eleven action names are gone; `bodySizeLimit: '2mb'`; sharp and `@aws-sdk/client-s3` only in devDependencies.
- Changed test names (01.1 guards kept): `admin-actions-media-wrappers.test.ts`: "saveHeroVideoUpload path, forced audit failure..." -> "finalizeHeroVideoUpload path, forced audit failure..." (now `saveVideoCore`), "saveHeroVideoUpload path, forged size..." -> "finalizeHeroVideoUpload path, forged size (server 50 MB check)", "source scan: hero actions go through the runner and their core" (now the three finalize video actions plus set/remove), "source scan: image uploads use checkImageUpload and the ticker is strict" -> "source scan: image finalizers run through the runner and the strict audit writer; the ticker is strict", new "source scan: no admin media action takes a Supabase original or the old FormData path". `admin-image-upload-source.test.ts`: "the old FormData actions still exist until plan 02-19" -> "...are gone (plan 02-19)"; "the 01.1 guards stay on the old paths" -> "...live on the finalize path" (SVG refusal in `upload-finalize`, `logAuditStrict` in the ports). `admin-video-upload.test.ts`: "old create*/save* video actions still exist" -> "are gone". SVG refusal, the server 50 MB size check and audit-before-delete ordering also keep their own tests in `upload-finalize.test.ts`, `admin-video-upload.test.ts` and `admin-image-upload.test.ts`.

## Verification

| Check | Result |
|-------|--------|
| Guard test RED on the old tree | 5 of 6 failed (sharp and `@/lib/r2-media` imports, 3 other assertions); GREEN after task 2 |
| `npm run test:unit` | 837 pass, 0 fail (r2-media.test.ts deleted; r2-delete (9) and worker-request-paths (6) added) |
| `npm run lint` | 0 errors, 26 warnings (the known `set-state-in-effect` and unused-var warnings) |
| `npx tsc --noEmit` | clean |
| `npm run gate:local` (heavy lock, detached, log `~/clickit-phase02-logs/02-19-gate.log`) | `exit=0` (lint, unit, `next build`, `cf:build`) |
| Bundle (`wrangler deploy --dry-run --outdir`, local, pinned HOME) | 14,629,499 B raw (14,286 KiB), 3,006,642 B gzip (2,936 KiB); was 15,473,476 / 3,152,773 (02-01): -844 KB raw, -146 KB gzip, now under 3 MiB gzip |
| `grep -c sharp .open-next/server-functions/default/handler.mjs` | 0 |
| Worker preview built with NO stub (`cf:build:preview`, local Supabase, port 8797) | `/en/admin`, `/en/admin/shows/new`, `/en/admin/shorts`, `/en/admin/reviews`, `/en/admin/inbox`, `/en/admin/audit`, `/en/admin/archive`, `/en/admin/categories`, `/en/admin/settings`: all 200 (settings was 500 before) |
| One admin server action on the Worker | Signed in as a local admin, changed the site tagline on `/en/admin/settings`, Save: toast "Site metadata saved", server action POST 200, `app_config.site_tagline` written; restored afterwards. 0 new `sharp` errors in the Worker log |
| Restored | `.env.preview.local`, `.dev.vars`, `app_config.admin_user_id` back (same id as before), tagline back, `git status` clean, heavy lock free, port 8797 closed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The mirror module could not be deleted while four admin actions and the cleanup cron still used it**
- **Found during:** Task 1
- **Issue:** `removePreloaderVideo`, `removeSiteImage`, `deleteCastMember`, `deleteShowPermanently` (via `stageShowMedia`) and `/api/cron/cleanup-media` called `stageMirroredPublicMediaDeletion` / `prepareMirroredPublicMediaDeletion`, which delete the Supabase original and need the S3 SDK (the plan only named the upload actions).
- **Fix:** New `src/server/r2-delete.ts` with R2-only deletion through the MEDIA binding; the actions and the cron use it. This also resolves deferred item 7 (Supabase original deleted by `removePreloaderVideo`). Supabase originals are no longer deleted by these actions (MEDIA-07); noted as deferred item 18.
- **Files modified:** `src/server/r2-delete.ts`, `src/app/[locale]/admin/actions.ts`, `src/app/api/cron/cleanup-media/route.ts`, `tests/unit/r2-delete.test.ts`
- **Commit:** `b7f4601`

**2. [Rule 1 - Bug] Check-script route typo**
- `/en/admin/shows` has no page and returns the known unknown-route 500 (deferred item 1/20); the check uses `/en/admin/shows/new` instead. Not a product change.

No other deviations. `/api/cdn/storage` and `src/lib/storage-range-proxy.ts` were kept (plan default; Koss did not choose delete-in-Phase-2 in anything I was given).

## Owner / controller items

- None new for Koss. For the controller: items 16-20 in `deferred-items.md` (sign-up RLS log line, dead 01.1 library code, Supabase originals left behind by show/cast delete, sharp still installed through next/miniflare, `/en/admin/shows` has no page). 02-22 must not skip an admin page on workers.dev and should repeat one admin save there.

## Known Stubs

None.

## Threat Flags

None. T-02-85 (body limit 2 MB), T-02-86 (sharp out of src) and T-02-87 (guard test in gate:local) are mitigated as planned.

## Self-Check: PASSED

- Files exist: `src/server/r2-delete.ts`, `tests/unit/r2-delete.test.ts`, `tests/unit/worker-request-paths.test.ts`; `src/lib/r2-media.ts`, `src/lib/r2-media-core.ts`, `tests/unit/r2-media.test.ts` absent.
- Commits `b7f4601` and `5cdaf94` present in `git log`.
