---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 16
subsystem: infra
tags: [r2, video, mp4, faststart, finalize, server-actions, audit, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: finalizeUploadedObject, keyMatchesKind and the video upload kinds (02-12); r2KeysForUrl and the finalize-core pattern (02-15); faststart box walker algorithm (02-08)
provides:
  - src/server/mp4-boxes.ts (topLevelBoxes, isFaststart, moovBytes)
  - src/lib/admin/hero-video.ts saveVideoCore (targets hero-desktop, hero-mobile, preloader, show) on R2 ports
  - finalizeHeroVideoUpload, finalizePreloaderVideoUpload, finalizeShowVideoUpload in src/app/[locale]/admin/actions.ts
affects: [02-18, 02-19, 02-22]

tech-stack:
  added: []
  patterns:
    - "Video finalize order: finalize (key shape, size, magic bytes) then head() size, then 4 MiB range read for fast-start and audio, then write target, strict audit, then delete the previous R2 object"
    - "Core ports are R2 head / readHead / delete; stageDeletion deletes nothing before commit, so rollback is a no-op"

key-files:
  created:
    - src/server/mp4-boxes.ts
    - tests/unit/mp4-boxes.test.ts
    - tests/unit/admin-video-upload.test.ts
    - tests/unit/helpers/video-world.ts
  modified:
    - src/lib/admin/hero-video.ts
    - src/app/[locale]/admin/actions.ts
    - tests/unit/admin-hero-video.test.ts
    - tests/unit/admin-actions-media-wrappers.test.ts
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/deferred-items.md

key-decisions:
  - "No ffprobe at request time: fast-start and audio are read from the first 4 MiB with the pure box walker plus mp4BytesHasAudioTrack on the moov slice. This is the Worker-safe path the research allows (finalize cannot repair fast-start, only refuse)"
  - "Audio is required for hero desktop and mobile only (01.1 behaviour). Preloader and show videos never had an audio check, so none was added"
  - "Fast-start that cannot be proven (neither moov nor mdat in the first 4 MiB) is refused like a non-fast-start file"
  - "readHead asks for min(object size, 4 MiB) so a small file never triggers a range longer than the object"
  - "finalizeShowVideoUpload has commit (default true) like finalizeArtworkUpload; 02-18 passes false while the show drawer holds the url until Save"
  - "Stored video url is <media origin>/<key> with no ?v= suffix (keys are unique per upload)"
  - "The new object is deleted on every refusal and failure after finalize; the previous object only after the audit row is written, and only if its url is on our media origin"

patterns-established:
  - "Per-target Slot (read, write) lets one tail (stage, write, audit, commit, compensate) serve hero, preloader and show"

requirements-completed: []

duration: 90min
completed: 2026-10-20
---

# Phase 2 Plan 16: Video finalize on R2 Summary

**Hero, preloader and show videos uploaded straight to R2 are now finalized by three admin actions that read only the first 4 MiB to prove MP4 type, fast-start and (for hero) the audio track, then keep the Phase 01.1 write, strict audit, delete-previous order with full compensation.**

Requirements MEDIA-01 and MEDIA-05 are NOT ticked: this plan is the server side only. The browser PUT is 02-18, the old actions go in 02-19, and the real R2 round trip is 02-22.

## Accomplishments

- `src/server/mp4-boxes.ts`: pure TypeScript box walker (same algorithm and same synthetic test buffers as the 02-08 script, with a test that both walkers agree). Stops on a box under 8 bytes, a truncated header, an unusable 64-bit size, a box that runs to the end, and after 64 boxes (T-02-74). `moovBytes` returns the moov slice, or what is inside the window when it runs past it.
- `saveVideoCore(ports, deps, { key, target, showId?, variant?, commit? })`:
  - order: media origin ready, `finalize` port (key shape and owner, size cap, magic bytes), `head()` size (50 MB hero/show with the 01.1 message `Video must be under 50MB`; 20 MB preloader), 4 MiB `readHead`, fast-start, audio (hero only), then stage previous deletion, write target, strict audit, commit deletion.
  - refusals after finalize delete the new object; if the delete fails the message gains `; The uploaded file could not be removed.`
  - not fast-start: `Video is not fast-start. Export it with fast start (moov at the beginning) and upload again.`
  - audit failure restores the previous value, rolls back the staged deletion, deletes the new object, returns the 01.1 error; same for a config write failure.
  - a Supabase Storage previous url yields no keys, so nothing is staged or deleted; an R2 previous key is deleted after the audit row exists.
  - show target refuses a non-uuid id and a missing variant before anything runs; `commit: false` writes no row and deletes no previous object but still audits the upload.
- `saveHeroVideoCore` is a thin wrapper (hero-desktop or hero-mobile); `setHeroVideoUrlCore` and `removeHeroVideoCore` keep their 01.1 behaviour on the same tail.
- Actions: `finalizeHeroVideoUpload({ variant, key })`, `finalizePreloaderVideoUpload({ key })`, `finalizeShowVideoUpload({ showId, variant, key, commit? })`. Zod input (key at most 300 chars), admin guard through `runAdminAction`, ports from `getWorkerEnv().MEDIA`, same revalidation as the old save actions (hero: site-config, `/`, `/portfolio`; preloader: site-config, root layout; show: catalog cache). None reads a File or FormData.
- `videoPorts` (new, replaces `heroPorts`): `finalizeUploadedObject`, `bucket.head`, `bucket.get(range)`, `bucket.delete`. `setHeroVideoUrl` and `removeHeroVideo` use it, so they delete a previous R2 key and never a Supabase original.

## Task Commits

1. Task 1 (mp4 box helper and video core, tests first)
   - `59107e6` feat: Worker-side MP4 box walker
   - `05c0c21` test: failing tests for the R2-backed video core (RED)
   - `a79102b` feat: video core on R2 (GREEN), wrappers test and minimal action port switch
2. Task 2 (finalize actions)
   - `b10758f` feat: three finalize actions plus source-scan tests
3. Follow-up
   - `7121520` fix: readHead length is min(size, 4 MiB)

## Test names changed in tests/unit/admin-hero-video.test.ts

Every other 01.1 test name is unchanged with its assertions. Two names changed because the thing they named no longer exists:

| Was | Now | Why |
|-----|-----|-----|
| `saveHeroVideoCore oversize downloaded blob refused after ok info` | `saveHeroVideoCore oversize head refused even when finalize said ok` | there is no download; the second size proof is head() after finalize |
| `saveHeroVideoCore success: info, download, mirror, stage, update, audit, commit` | `saveHeroVideoCore success: finalize, head, readHead, stage, update, audit, commit` | the ports are R2 now; the order assertion is the new sequence |

Adapted assertions (same meaning): audit diff `path` and `previous_path` now hold the R2 key (`site-assets/hero/video-<ts>-<rand>.mp4`); "forged size" asserts no range read at all instead of no download; "bad path" asserts a non-string key gives `Invalid upload path` and a wrongly shaped key gives `Invalid upload key` with nothing deleted. `admin-actions-media-wrappers.test.ts` now builds its ports from the shared `tests/unit/helpers/video-world.ts`; its assertions are unchanged.

## Verification

| Check | Result |
|-------|--------|
| `node --test` mp4-boxes, admin-hero-video, admin-video-upload, admin-actions-media-wrappers | 12 + 17 + 29 + 7 pass |
| `npm run gate:local` under the heavy lock (lint, test:unit, build, cf:build), final tree | exit=0; 808 unit tests, 0 fail; lint 0 errors, 26 warnings (the deferred set-state-in-effect warnings and test unused-vars, none new) |
| `tsc --noEmit` | clean |
| hero-video.ts has no `download(` call and no import of next/, server-only or `@/` | yes (grep) |

Not verified: a real presigned PUT then finalize against R2 (02-22, owner); R2 `get` with `range` on a real Worker binding (the code now never asks for more than the object size; the Miniflare check I tried would not start with this miniflare version, so it was not run); fast-start/audio on the real hero MP4s; Safari playback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched `heroPorts` to `videoPorts` inside Task 1's commit**
- **Found during:** Task 1
- **Issue:** the port shape changed, so the three existing hero actions would not compile with the old `heroPorts`.
- **Fix:** replaced it with `videoPorts` (R2 binding) in the same commit; Task 2 added the new actions on top.
- **Files modified:** `src/app/[locale]/admin/actions.ts`
- **Commit:** `a79102b`

**2. [Rule 2 - Correctness] Audio check limited to hero targets**
- **Issue:** the plan text lists the audio track for finalize in general, but only the 01.1 hero core ever required audio; preloader and show uploads had no such rule. Requiring it would refuse files the admin can upload today.
- **Fix:** hero-desktop and hero-mobile require audio; preloader and show do not. If Koss wants audio on those, it is one flag in `saveVideoCore`.

**3. [Rule 2 - Correctness] `readHead` length is min(size, 4 MiB)**
- **Commit:** `7121520`

### Plan assumptions that did not hold

- The plan lists `ports.readHead(key, 4 MiB)` and `ports.head`; I also kept a `finalize` port (as 02-15 does) so the key shape/owner check, magic bytes and delete-on-refusal of 02-12 run first. `head()` is then a second, cheap size proof, which is what the 01.1 forged-size test now exercises.
- The plan says a show target "writes its own columns" while the old `saveShowVideoUpload` never wrote the row (the form saved it). Handled with `commit` (default true) as in 02-15.
- ffprobe at request time is not possible on Workers and is not used.

## Owner / Controller Items

- Decide with 02-18 whether the show drawer writes at upload (`commit: true`) or on Save (`commit: false`, today's behaviour). Not blocking this plan.
- `deferred-items.md` items 7 to 9 (all recorded, none fixed): `removePreloaderVideo` still deletes a Supabase original; the legacy admin hero upload button fails until 02-18 switches the client (branch is not deployed); a moov box over 4 MiB is only partly scanned.
- Heavy lock is free (released by the gate script).

## Known Stubs

None.

## Threat Flags

None. All five threats in the plan register are mitigated and tested (T-02-73 4 MiB read; T-02-74 box cap; T-02-75 head() size with delete; T-02-76 audit order and forced-audit tests; T-02-77 fast-start refusal).

## Self-Check: PASSED

Files exist: src/server/mp4-boxes.ts, tests/unit/mp4-boxes.test.ts, tests/unit/admin-video-upload.test.ts, tests/unit/helpers/video-world.ts. Commits 59107e6, 05c0c21, a79102b, b10758f, 7121520 are in `git log`.
