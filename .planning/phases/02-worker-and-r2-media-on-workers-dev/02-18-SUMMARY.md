---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 18
subsystem: media
tags: [r2, uploads, video, browser, xhr, sonner, admin-ui, fast-start]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: requestMediaUpload and upload kinds (02-12); finalizeHeroVideoUpload, finalizePreloaderVideoUpload, finalizeShowVideoUpload (02-16); uploadImageDirect, UploadStatus, notify helpers (02-17); signed upload picture, option M (02-05)
provides:
  - src/lib/browser-upload.ts uploadVideoDirect (one client path for hero desktop/mobile, preloader and per-show hero videos)
  - three video components switched to browser -> R2 -> finalize
affects: [02-19, 02-22]

key-files:
  modified:
    - src/lib/browser-upload.ts
    - src/components/admin/upload-status.tsx
    - src/components/admin/hero-video-manager.tsx
    - src/components/admin/hero-media-picker.tsx
    - src/components/admin/settings/preloader-video-field.tsx
    - tests/unit/browser-upload-source.test.ts
    - tests/unit/upload-components-source.test.ts
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/deferred-items.md

key-decisions:
  - "uploadVideoDirect shares putWithProgress (module-private, so not exported) and the error mapping with uploadImageDirect; no copies, nothing decoded in the browser."
  - "The show drawer passes commit:false to finalizeShowVideoUpload, so it stays upload then Save, as the image path does (02-17)."
  - "Signed video texts from mockups/upload-states.html (option M) are used verbatim: 'Upload an MP4 video.', the not-fast-start sentence, 'Checking fast-start…' at 100%, and the helper line 'MP4, fast-start, under 50MB'."

requirements-completed: []

duration: 150min
completed: 2026-10-20
---

# Phase 2 Plan 18: Browser video uploads direct to R2 Summary

**Hero (desktop and mobile), preloader and per-show hero videos now go browser -> presigned PUT -> R2 -> `finalize*VideoUpload` through one `uploadVideoDirect` helper, with the signed option-M progress zone, toasts, Retry and the fast-start helper line. No component requests a Supabase signed-upload URL for video any more.**

MEDIA-01 and MEDIA-05 are NOT ticked in REQUIREMENTS.md: the video client half is done and proven on the local preview, but removal of the old actions (02-19) and one real presigned round trip against R2 (02-22) are still open.

## Task Commits

1. **Task 1:** `4a5162f` (feat) - `uploadVideoDirect`, signed video texts, "Checking fast-start…" line
2. **Task 2:** `988b839` (feat) - three components switched, source tests
3. **Deferred items:** recorded in `deferred-items.md` (items 13-15, item 8 resolved for clients) with the SUMMARY commit

## What was built

- `uploadVideoDirect({ file, kind, slot, showId, finalize, onProgress, signal })`: client check with `checkUploadRequest` (video/mp4 only, 50 MB, preloader 20 MB; same caps as the server) with the signed "Upload an MP4 video." for a wrong type; `requestMediaUpload` with `variantWidths: []`; XHR PUT with progress and the signed `Content-Type`; `finalize({ key })`; typed result. A finalize refusal that mentions fast-start shows the signed sentence; "does not match" shows the signed refused sentence; any other server text (no audio track, too large) passes through. Some systems report an empty type for `.mp4`; that is treated as `video/mp4`.
- `UploadStatus kind="video"`: at 100 percent the line is "Checking fast-start…" (signed; images still say "Saving…").
- `hero-video-manager.tsx`: `finalizeHeroVideoUpload({ variant, key })`; the client 50 MB check and the audio probe stay; YouTube set/remove untouched.
- `settings/preloader-video-field.tsx`: `finalizePreloaderVideoUpload({ key })`.
- `hero-media-picker.tsx` (video path only): `finalizeShowVideoUpload({ showId, variant, key, commit: false })`; the existing overlay shows `UploadStatus`.
- All three show the helper line "MP4, fast-start, under 50MB" under the existing localized hint.

## Verification

| Check | Result |
|-------|--------|
| New unit tests | 2 in `browser-upload-source.test.ts`, 4 in `upload-components-source.test.ts` (6 new) |
| `npm run test:unit` | 832 tests, 832 pass |
| `npm run lint` | 0 errors, 26 warnings (unchanged) |
| `npx tsc --noEmit` | clean |
| No old action names under `src/components` | grep empty |
| `npm run gate:local` (detached, heavy lock, `~/clickit-phase02-logs/02-18-gate.log`) | `exit=0`: lint, unit, `next build`, `cf:build` |

Preview round trip (cf:preview on 127.0.0.1:8797, LOCAL_DEV shim, local media Worker on 127.0.0.1:8789 with `SUPABASE_URL` pointed at the local stack, same `.wrangler/state`, local Supabase only, Playwright via `playwright-core` with the cached chromium, one browser at a time; scripts in `~/clickit-phase02-logs/02-18-*.mjs`, not committed; fixtures in `~/clickit-uat-02`). Every line printed PASS:

- Hero desktop, fast-start MP4 with audio (ffmpeg `+faststart`, 28 KB): signed zone with `video-faststart.mp4 · 28 KB`, percent, bar, line "Uploading…" (no "smaller copies" text); one PUT, `video/mp4`; largest server-action body 153 B (no file bytes through an action); toasts "Desktop Hero video uploaded" and the hero-audio note; `app_config.hero_video_url` = `http://127.0.0.1:8789/site-assets/hero/video-<ts>-<rand>.mp4` with no `?v=`, type `mp4`; `curl -r 0-1023` on that URL printed **206** (`content-range: bytes 0-1023/28298`, `video/mp4`); a media-origin `<video>` loaded with readyState 4, duration 2 s, no error.
- Non-fast-start MP4 (moov at the end, hero mobile): error toast with the signed not-fast-start sentence; exactly one PUT happened (the server is the gate); `hero_video_mobile_url` unchanged; the refused object returns 404 from the media Worker (finalize deleted it); the progress zone is gone (the zone never turns red).
- Random bytes named `.mp4` on the preloader (no client probe): toast "The file did not match its type and was removed. Nothing was saved."; value unchanged; object 404. On the hero the client audio probe stops the same file first ("This MP4 has no audio track…") before any upload.
- Hero with no audio track: client toast, no PUT.
- Dropped connection (first PUT aborted, hero mobile): toast "Upload stopped: the connection dropped or the upload link expired. Nothing was saved." with a Retry button 49x44 px; Retry uploaded and ended with "Mobile Hero video uploaded"; `hero_video_mobile_url` set to a media-origin URL; range request 206.
- Preloader: "Preloader video updated", one PUT `video/mp4`, `preloader_video_url` on the media origin, range 206; a second, non-fast-start upload refused with the signed sentence and the value unchanged.
- Show drawer (`/en/admin/shows/<id>/edit`, MP4 mode): helper line shown, progress bar, "Desktop Hero video uploaded", one PUT, 189 B largest action body, `shows.hero_video_url` and `hero_video_mobile_url` still empty (commit:false), the drawer previews the media-origin video (readyState 4), range 206.
- Cleanup: preview and media Worker stopped by recorded process group (ports free), `.dev.vars` and `.env.preview.local` restored byte for byte, local `app_config` restored (admin id, all video columns null, `hero_video_muted` true), the throw-away test user deleted from the local db, `git status` clean before this commit, `grep TEMP-02-18 src` empty, heavy lock released by my scripts.

Not verified: a real presigned PUT to R2 (R2 not enabled; CORS and the R2 S3 key are owner steps; plan 02-22); real Safari; the Arabic layout of the zone (RTL not exercised); a 50 MB-class file (fixtures are 28 KB; the cap is the same code as before); Save after a drawer video upload (only that nothing is written before Save); that the finalize "no audio track" refusal reaches the toast on the hero (the client probe catches the fixture first).

## Deviations from Plan

### Judgement calls

**1. Signed not-fast-start sentence instead of the server's text**
- The plan acceptance says "refused with the finalize message". Option M (signed 2026-10-20) has its own sentence ("This video is not fast-start. Re-export it with "fast start" (web optimised) on, then upload again. Nothing was saved."), which differs from the server constant `VIDEO_NOT_FASTSTART` (02-16). The client maps any finalize refusal that mentions fast-start to the signed sentence; the server text is unchanged and still used for other callers. The signed text wins ("build exactly what is signed").

**2. Helper line added, existing hint kept**
- The mockup shows one hint, "MP4, fast-start, under 50MB". The existing localized hints (dimensions, 8 MB target; Arabic exists) carry other information, so the signed line is shown as a second line instead of replacing them.

**3. `putWithProgress` not exported**
- 02-17 expected it might need exporting; `uploadVideoDirect` lives in the same file, so it did not.

**4. Preview check with a temporary `sharp` stub (Rule 3, deferred item 10)**
- `admin/actions.ts` imports `sharp`, so admin server actions 500 on the Worker preview until 02-19. For the preview build only, the up-script replaced that import with a throw-away stub and restored it with `git checkout` in its cleanup trap; nothing was committed with it.

### Other
- Task 2's verify line also runs `npm run build`; it ran inside `gate:local`, not separately.
- The hero 8 MB warning toast still talks about "Supabase cached egress" (stale, deferred item 13).

## Owner / controller items

- **Arabic pending Koss signature** (English constants only; no Arabic invented): "Upload an MP4 video.", "This video is not fast-start. Re-export it with "fast start" (web optimised) on, then upload again. Nothing was saved.", "Checking fast-start…", "MP4, fast-start, under 50MB", plus the 02-17 list ("Uploading…", "Retry", the dropped-connection and refused sentences). Existing Arabic for "video too large", "no audio track" and the hints is reused.
- Koss to decide the replacement text for the stale 8 MB "Supabase egress" warning (deferred item 13).
- The bucket CORS (PUT with `Content-Type`) and the R2 S3 API token are still required before this works on workers.dev (RUNBOOK; 02-02, 02-12).
- Plan 02-19: delete the now caller-less `create*VideoUpload` / `save*VideoUpload` actions, remove `sharp`, then re-run an admin action on the Worker preview without a stub (deferred item 10). Move `removePreloaderVideo` onto the R2 ports (deferred item 7).
- Heavy lock: free from this session (other Clickit sessions may hold it).

## Known Stubs

None. (The `sharp` stub was preview-only and is not in any commit.)

## Threat Flags

None beyond the plan's register. T-02-82 (client bypass of the 50 MB check): finalize `head()` size check deletes and refuses, unchanged from 02-16; T-02-83 (broken hero on Safari): non-fast-start refused at finalize and the signed sentence plus helper line tell the admin the export setting, proven on the preview; T-02-84 (presigned URL in logs): `uploadVideoDirect` logs nothing.

## Self-Check: PASSED

- Files exist: `src/lib/browser-upload.ts` (contains `export async function uploadVideoDirect`), `src/components/admin/hero-video-manager.tsx`, `src/components/admin/hero-media-picker.tsx`, `src/components/admin/settings/preloader-video-field.tsx`, `tests/unit/upload-components-source.test.ts`.
- Commits `4a5162f` and `988b839` present on `claude/phase-02-execute-19d86a`.
