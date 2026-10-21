---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 17
subsystem: media
tags: [r2, uploads, browser, webp, xhr, sonner, admin-ui, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: requestMediaUpload, upload kind table, shim route (02-12); finalizeArtworkUpload, finalizeSiteImageUpload, finalizeSocialIconUpload, finalizeCastImageUpload, finalizeAvatarUpload (02-15); signed upload picture, option M (02-05)
provides:
  - src/lib/browser-variants.ts (planBrowserVariants, isRealWebp, scaledSize, progressPercent, uploadProgressLine, formatBytes)
  - src/lib/browser-upload.ts (uploadImageDirect, UPLOAD_MESSAGES, typed UploadError)
  - src/components/admin/upload-status.tsx (UploadStatus zone, notifyUploadError with Retry, notifyUploaded with the Safari note)
  - six components switched to browser -> R2 -> finalize
affects: [02-18, 02-19, 02-22]

tech-stack:
  added: []
  patterns:
    - "One client path for every image kind: check -> make WebP copies only if canvas really encodes WebP -> requestMediaUpload -> XHR PUT (signed Content-Type) -> fetch PUT copies -> finalize callback"
    - "Messages are sonner toasts; the zone only ever shows progress (signed option M)"
    - "Pure helper has no '@/' imports so node --test loads it"

key-files:
  created:
    - src/lib/browser-variants.ts
    - src/lib/browser-upload.ts
    - src/components/admin/upload-status.tsx
    - tests/unit/browser-variants.test.ts
    - tests/unit/browser-upload-source.test.ts
    - tests/unit/upload-components-source.test.ts
  modified:
    - src/components/admin/artwork-upload-zone.tsx
    - src/components/admin/hero-media-picker.tsx
    - src/components/admin/cast-editor.tsx
    - src/components/admin/settings/image-upload-field.tsx
    - src/components/admin/settings/footer-editor.tsx
    - src/components/profile/avatar-upload.tsx
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/deferred-items.md

key-decisions:
  - "Artwork finalize is called with commit:false from the artwork drawer and from the hero image picker, so behaviour stays upload then Save (Cancel leaves the row untouched). The plan did not ask for write-at-upload, so none was added."
  - "The existing localized 'too large' texts stay (artwork fileTooLarge, imageTooLarge, avatarTooLarge, castEditor toastImageTooLarge): same cap, same wording, Arabic already exists. All other signed messages are English constants."
  - "A smaller copy that fails to PUT is left out of variantKeys (the original always works) and logged with console.warn; only the original failing gives the Retry toast."
  - "Copies are made before the request so requestMediaUpload names only widths the browser really produced; the Safari note shows only when a copy that should exist could not be made (or the file could not be decoded)."
  - "Icons and GIFs never get copies and never show the Safari note."

patterns-established:
  - "Local upload round trip: preview with LOCAL_DEV=1 (shim), local media Worker on 127.0.0.1:8789 with --var SUPABASE_URL:http://127.0.0.1:55321 so it never falls back to the live project, same .wrangler/state"

requirements-completed: []

duration: 215min
completed: 2026-10-20
---

# Phase 2 Plan 17: Browser image uploads direct to R2 Summary

**Every image upload in the UI now goes browser -> R2 -> finalize: a pure variant planner, one `uploadImageDirect` helper (XHR with progress, signed Content-Type, WebP copies only when the canvas really produces WebP), and the signed option-M progress zone and toasts. Artwork, hero image, cast, site image, social icon and avatar are switched; no component sends file bytes to a server action.**

MEDIA-01 and MEDIA-04 are NOT ticked in REQUIREMENTS.md: the image half is done and proven on the local preview, but videos (02-18), removal of the old actions (02-19) and the one real presigned round trip against R2 (02-22) are still open.

## Task Commits

1. **Task 1 RED:** `2df4772` (test) - browser-variants test, module missing
2. **Task 1 GREEN:** `eba6ce3` (feat) - variants helper, upload helper, status component, source test
3. **Task 2:** `8da52b6` (feat) - six components switched, source test for all of them
4. **Deferred items:** `2563090` (docs)

## What was built

- `planBrowserVariants(width, type)`: 2400 -> 640/1280/1920, 1500 -> 640/1280, 640 -> none; ico/gif/svg -> none. `isRealWebp(blob)` is true only for `image/webp`. `scaledSize`, `progressPercent`, `formatBytes`, `uploadProgressLine` (signed text for 3 copies; honest count for 1 or 2).
- `uploadImageDirect({ file, kind, slot, showId, finalize, onProgress, signal })`: client check with `checkUploadRequest` (same caps and messages as the server, SVG text included), `createImageBitmap(file, { imageOrientation: 'from-image' })`, canvas `toBlob('image/webp', 0.8)` per width (a non-WebP blob stops copy making, nothing is uploaded under a WebP key), `requestMediaUpload` with the real widths, XHR PUT of the original with the returned `Content-Type` only, fetch PUT of each copy, `finalize({ key, variantKeys })`. Returns `{ ok: true, url, key, safariFallback }` or a typed error (`too-large`, `wrong-type`, `network`, `refused`, `unavailable`).
- `UploadStatus`: file name, size, percent; animated #ffcc00 bar (flowing gradient, moving stripes, glow), pulsing yellow border, off under `prefers-reduced-motion`; line "Uploading… then N smaller copies", "Saving…" at 100 percent. `notifyUploadError` (Retry action 44px high for network errors), `notifyUploaded` (Uploaded toast plus the Safari note).
- Switched: artwork zone (`finalizeArtworkUpload`, commit:false), hero image picker (same, see deviations), cast editor (`finalizeCastImageUpload`, no castId, URL saved by `addCastMember`), site image field (`finalizeSiteImageUpload`), footer social icon (`finalizeSocialIconUpload`, URL kept in form state), avatar (`finalizeAvatarUpload`).

## Verification

| Check | Result |
|-------|--------|
| New unit tests | 7 variants + 3 upload source + 8 components source = 18 new |
| `npm run test:unit` | 826 tests, 826 pass |
| `npm run lint` | 0 errors, 26 warnings (unchanged) |
| `npx tsc --noEmit` | clean |
| `npm run gate:local` (detached, heavy lock, `~/clickit-phase02-logs/02-17-gate.log`) | `exit=0`: lint, unit, `next build`, `cf:build` |

Preview round trip (cf:preview on 127.0.0.1:8797, LOCAL_DEV shim, local media Worker on 127.0.0.1:8789, same `.wrangler/state`, local Supabase only, Playwright via `playwright-core` with the cached chromium, one browser at a time; scripts in `~/clickit-phase02-logs/02-17-*.mjs`, not committed). Every line below printed PASS:

- Artwork card PNG 2400x1500 (1.8 MB): progress bar visible with `poster-2400.png · 1.8 MB`, percent and "Uploading… then 3 smaller copies"; 4 PUTs (`image/png`, then three `image/webp`); keys `_v/640|1280|1920/webp/show-artwork/shows/<id>/card-<ts>-<rand>.png`; "Uploaded" toast; preview image served from `http://127.0.0.1:8789/show-artwork/...`; the media Worker returns the original (200 image/png) and `?w=640|1280|1920` with `Accept: image/webp` as real WebP (RIFF/WEBP bytes); `shows.card_image_url` unchanged in the local db (commit:false); the biggest server-action body was 500 bytes (no file bytes through any action).
- Computed style on the live zone: animation names `cs-upload-flow` and `cs-upload-pulse`, gradient contains #ffcc00, smallest font 12px, text contrast 8.31 to 13.09 against #0a0a0a, all animation `none` under reduced motion.
- Too large (19.6 MB PNG): error toast "File too large, max 10MB for card.", no PUT, zone not red. SVG: error toast with the 01.1 text, no PUT. Dropped connection (first PUT aborted): error toast "Upload stopped: the connection dropped or the upload link expired. Nothing was saved." with a Retry button 49x44 px; Retry uploads and ends with "Uploaded". Refused after upload (5 KB random bytes named .png): toast "The file did not match its type and was removed. Nothing was saved."
- Safari simulation (toBlob forced to return PNG): only the original is PUT, toast shows "Uploaded" plus "This browser cannot make WebP copies; the original will be used."
- Site image OG JPEG 1600x840: Uploaded toast; `app_config.og_image_url` = `http://127.0.0.1:8789/site-assets/settings/og-<ts>-<rand>.jpg`; PUTs `image/jpeg`, `image/webp`, `image/webp`; copies 640 and 1280 are real WebP and 1920 falls back to the original (source is narrower). Value reset to NULL afterwards.
- Avatar JPEG 800x800: "Profile picture updated"; `profiles.avatar_url` = `http://127.0.0.1:8789/avatars/<own id>/avatar-<ts>-<rand>.jpg`; original plus one 640 copy; served 200.
- Hero image picker: "Desktop Hero image uploaded", 4 PUTs. Cast image (300 px PNG): member added, `show_cast.image_url` = media-origin URL under `show-artwork/shows/<id>/cast/`, one PUT, no note. Social icon: Uploaded toast, one PUT, the form shows the media-origin URL.
- Cleanup: preview and media Worker stopped by recorded process group, ports 8797/8789/3199 free, `.dev.vars` and `.env.preview.local` restored byte for byte, local `app_config.admin_user_id` restored to its original value, the throw-away test user and cast row deleted from the local db, heavy lock free.

Not verified: a real presigned PUT to R2 (R2 not enabled; CORS and the R2 S3 key are owner steps; plan 02-22); real Safari (simulated by forcing `toBlob` to return PNG); the Arabic layout of the new zone (RTL not exercised); Save after an artwork upload (the drawer's own save path was not re-run; only that no db write happens before Save); a CMYK/16-bit or animated source image.

## Deviations from Plan

### Auto-fixed / judgement calls

**1. [Rule 2 - correctness] `hero-media-picker.tsx` image upload switched (not one of the five named files)**
- **Found during:** Task 2 verify (`grep` for the old action names under `src/components`)
- **Issue:** the show drawer's hero image (desktop and mobile) still called `uploadArtwork` with a FormData. Plan 02-18 only names the picker's video path; plan 02-19 deletes `uploadArtwork` ("nothing imports them"). Left alone, hero images would have broken in 02-19, and the plan's first truth ("no component sends the file to a server action") was false.
- **Fix:** the picker's image path uses `uploadImageDirect` and `finalizeArtworkUpload({ ..., commit: false })`; progress is shown inside the picker's existing overlay; the video path is untouched for 02-18.
- **Commit:** 8da52b6

**2. [Rule 3 - blocked check] Worker preview 500 on every admin server action and on `/en/admin/settings`**
- **Found during:** Task 2 preview check
- **Issue:** `import sharp from 'sharp'` at the top of `src/app/[locale]/admin/actions.ts` cannot load in workerd, so any request that loads that module returns a plain 500 with no stack. The cause was only visible in the local explorer logs (`observability/query`, table `logs`). `next start` is fine. This is plan 02-19's removal.
- **Fix for the check only:** a throw-away, uncommitted stub of that one import for the preview build; restored before any commit (`git status` clean, `grep TEMP-02-17 src` empty). Recorded as deferred item 10 so 02-19 and 02-22 re-check an admin action on the Worker.
- **Commit:** 2563090 (note only)

**3. [Judgement] Compact controls keep their spinner**
- The social icon (36 px square) and the avatar (80 px circle) have no zone, so the signed in-zone bar cannot be drawn. They keep today's spinner and use the signed toasts (deferred item 11). The cast editor shows the signed zone above the Add button. The settings image field and artwork zone show it in place of the empty or preview state; the hero picker shows it in its overlay.

**4. [Judgement] Variant failure is not a user-visible error**
- A smaller copy that cannot be PUT is dropped from `variantKeys` and logged; the original is always served. Plan text said "maps 403/expired/network to the retry state" for the original, which is how it works.

**5. [Judgement] Success toasts**
- The signed picture has an "Uploaded" toast for success. Components that already had their own success text (settings "Uploaded", avatar "Profile picture updated", hero "uploaded") keep it; artwork zone and social icon, which had none, now use the existing `admin.settings.uploaded` key. The cast editor shows no extra toast (its "Cast member added" follows); only the Safari note would appear there.

### Parallel behaviour left to later plans

- Orphaned R2 objects when a drawer upload is abandoned or `addCastMember` fails (deferred item 12).

## Owner / controller items

- **Arabic pending Koss signature** (no Arabic invented; English constants only): "Uploading… then N smaller copies", "Saving…", "Upload stopped: the connection dropped or the upload link expired. Nothing was saved.", "Retry", "The file did not match its type and was removed. Nothing was saved.", "This browser cannot make WebP copies; the original will be used.", "Uploaded" for the artwork zone (the existing Arabic `admin.settings.uploaded` is reused there). SVG and size texts already exist in Arabic only where the old components had them.
- The bucket CORS (PUT with `Content-Type`) and the R2 S3 API token are required before any of this works on workers.dev (RUNBOOK; 02-02, 02-12). Without them `requestMediaUpload` answers "Uploads are not available right now" and the user sees an error toast.
- Plan 02-19: keep the guard against `sharp` and re-run an admin action on the Worker preview (deferred item 10). Plan 02-18 should reuse `UploadStatus`, `notifyUploadError` and `notifyUploaded` (pass `kind="video"` for the "Uploading…" line); the helper's `putWithProgress` is not exported yet and may need to be.
- Heavy lock is free.

## Known Stubs

None. The social icon and cast flows keep returned URLs in form state by design (02-15).

## Threat Flags

None beyond the plan's register. T-02-78 (client checks are UX only; finalize is the gate), T-02-79 (`isRealWebp` check before every copy; refused-after-upload tested with a non-image file), T-02-80 (presigned URLs are never logged or shown; the only `console.warn` has no URL), T-02-81 (every failure is a toast; network errors have Retry) are met.

## Self-Check: PASSED

- Files exist: `src/lib/browser-variants.ts`, `src/lib/browser-upload.ts`, `src/components/admin/upload-status.tsx`, `tests/unit/browser-variants.test.ts`, `tests/unit/browser-upload-source.test.ts`, `tests/unit/upload-components-source.test.ts`.
- Commits `2df4772`, `eba6ce3`, `8da52b6`, `2563090` present on `claude/phase-02-execute-19d86a`.
