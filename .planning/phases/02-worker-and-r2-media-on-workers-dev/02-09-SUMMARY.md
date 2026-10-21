---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 09
subsystem: media
tags: [next-image, custom-loader, r2, media-worker, cloudflare, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: media Worker variant widths 640/1280/1920 and `?w=` negotiation (02-03); build targets and the media-flag stamp (02-06)
provides:
  - src/lib/image-loader.ts (LOADER_WIDTHS, pickVariantWidth, buildImageUrl), pure, no imports
  - image-loader.ts at the repo root (next/image loaderFile, 'use client')
  - getPublicMediaOrigin / toPublicR2MediaUrl / isPublicR2MediaUrl with a last optional loopback parameter
  - next.config.ts images switched from the Vercel optimizer to the custom loader
affects: [02-10, 02-14, 02-17, 02-20]

tech-stack:
  added: []
  patterns:
    - "Loader appends ?w= only for URLs whose origin equals the active media origin exactly; everything else is returned unchanged"
    - "Loader widths are pinned to workers/media/src/handler.ts VARIANT_WIDTHS by a drift test"
    - "http media origin only as http://127.0.0.1 with NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK=1, and it never rewrites Supabase URLs"

key-files:
  created:
    - src/lib/image-loader.ts
    - image-loader.ts
    - tests/unit/image-loader.test.ts
    - tests/unit/supabase-media.test.ts
  modified:
    - src/lib/supabase-media.ts
    - next.config.ts
    - src/components/layout/footer.tsx

key-decisions:
  - "Width mapping: nearest supported width >= requested, capped at 1920, so the loader can only ever emit a ?w= the Worker honours (no silent full-size original); invalid or non-positive input maps to 640"
  - "remotePatterns removed together with formats and minimumCacheTTL: they configure only the built-in loader, and the custom loader returns URLs itself. The build is green and images-manifest.json reports loader: custom"
  - "Supabase originals stay unoptimized and un-rewritten while the flag is unset (the loader returns them as-is), as the plan requires"

patterns-established:
  - "Loopback origin is rejected on any path, credentials, query, hash, any host except the literal 127.0.0.1 (localhost, ::1, 0.0.0.0 and LAN IPs are refused)"

requirements-completed: []

duration: 15min
completed: 2026-10-20
---

# Phase 02 Plan 09: Custom image loader and media-origin rules Summary

**next/image now goes through a pure custom loader that appends `?w=640|1280|1920` to media-origin URLs only, with a tested local-only loopback origin and no Vercel image optimizer left in the config.**

## Performance

- **Tasks:** 2 of 2
- **Files:** 7 (4 created, 3 modified)

## Accomplishments

- `buildImageUrl` rewrites only URLs on exactly the media origin (scheme, host and port): `?v=` is kept (order `v` then `w`), an existing `w` is replaced. YouTube, Unsplash, Picsum, Supabase, `data:`, `blob:`, local paths, look-alike hosts and unparsable strings come back unchanged; a null media origin changes nothing.
- Drift test imports `VARIANT_WIDTHS` from `workers/media/src/handler.ts` and fails if `LOADER_WIDTHS` differs; a second test checks that `pickVariantWidth` returns only Worker-supported widths across the Next `deviceSizes`/`imageSizes` values.
- `getPublicMediaOrigin` gets a third optional parameter (`NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK`). https still needs `verified`. `http://127.0.0.1[:port]` is accepted only with the allow flag; it is not accepted with `verified` alone. `toPublicR2MediaUrl` returns null for any non-https origin, so loopback never rewrites Supabase URLs. `isPublicR2MediaUrl` gets the same optional parameter.
- `next.config.ts` images block is now `loader: 'custom'`, `loaderFile: './image-loader.ts'`. Nothing else in the file was changed except removing the now-unused `mediaImagePattern` constant (it fed only `remotePatterns`).
- `footer.tsx`: removed the single `unoptimized` line, nothing else (minimal diff for the design sessions B1-B4).
- `NEXT_PUBLIC_MEDIA_CUTOVER_READY` is not set anywhere by this plan. With it unset the built app emits Supabase originals exactly as before.

## Task Commits

1. **RED** `f1bd286` test(02-09): failing tests for the loader and loopback origin
2. **Task 1** `370f107` feat(02-09): pure image loader and loopback-only media origin rule
3. **Task 2** `b68efcd` feat(02-09): switch next/image to the R2 variant loader

## Verification

- `node --test` on the two new files: 18 tests, 18 pass.
- `npm run test:unit`: 615 tests, 615 pass, 0 fail.
- `npm run lint`: 0 errors, 26 warnings (the known warnings, unchanged class).
- `npm run build` and `npm run cf:build`: exit 0 (also inside `npm run gate:local`, exit 0). `.next/images-manifest.json` reports `"loader": "custom"` with the loader file path; no `/_next/image` URL appears in prerendered HTML.
- Plan greps: `loaderFile` present; `minimumCacheTTL` absent; `use client` in `image-loader.ts`; `unoptimized` absent from `footer.tsx`; `src/lib/image-loader.ts` has no import.

## Fill images without a `sizes` prop

A parse of all 25 files importing `next/image` found three `fill` images without `sizes`, all admin previews that stay `unoptimized` (so they never reach the loader):

- `src/components/admin/cast-editor.tsx` lines 165 and 259
- `src/components/admin/settings/image-upload-field.tsx` line 90

No visitor-facing or home-page hero/card image lacks `sizes`, so none were changed. Non-`fill` images with a fixed `width` (for example the 32 px footer icons) request the 640 variant, the smallest the Worker serves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's `toPublicR2MediaUrl` test call does not match the real signature**
- **Found during:** Task 1
- **Issue:** The behavior bullet calls `toPublicR2MediaUrl(supabaseUrl, "http://127.0.0.1:8789", undefined, "1")`, but the real signature is `(rawUrl, supabaseHost, configuredOrigin, configuredReady)`, so those arguments would land in the wrong slots.
- **Fix:** Added the loopback allow parameter last (`configuredAllowLoopback`), as the plan's action text says, and wrote the test as `toPublicR2MediaUrl(url, host, 'http://127.0.0.1:8789', undefined, '1') === null` (also with `'verified'`).
- **Files modified:** `src/lib/supabase-media.ts`, `tests/unit/supabase-media.test.ts`
- **Commit:** 370f107

**2. [Rule 3 - Blocking] `mediaImagePattern` removed from `next.config.ts`**
- **Found during:** Task 2
- **Issue:** Removing `remotePatterns` left `mediaImagePattern` unused (lint warning), and it also hard-coded `protocol: 'https'` for what can now be a loopback origin.
- **Fix:** Deleted the constant. `publicMediaOrigin` stays (CSP `media-src` uses it).
- **Commit:** b68efcd

### Decisions recorded

- `remotePatterns` were removed rather than kept: the build passes without them and they do not apply to a custom loader.
- The new `tests/unit/supabase-media.test.ts` is a new file (none existed); existing supabase-media callers (`r2-media-migration`, `storage-range-proxy` tests) still pass unchanged.

## Owner / controller items

- **CSP for loopback preview (hand to plan 02-14):** `img-src` is `'self' data: blob: https:`, which does not match `http://127.0.0.1`. A local preview run with `NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK=1` and an http loopback media origin will have images blocked by CSP until 02-14 adds the loopback origin to `img-src` (only when that mode is on). The plan forbids touching CSP here, so it was not changed. `media-src` already includes the active media origin.
- **Deploy guard (02-06):** confirm it refuses any stamp that contains `NEXT_PUBLIC_MEDIA_ALLOW_LOOPBACK` or an http media origin (T-02-39). Not re-checked in this plan.
- **Open decision, default applied:** `src/app/api/cdn/storage/route.ts` and `src/lib/storage-range-proxy.ts` are kept (delete in Phase 3 unless Koss chose otherwise at sign-off).
- Heavy lock `/Users/koss/.clickit-heavy.lock` is free.

## Known Stubs

None.

## Threat Flags

None. T-02-37 (exact-origin match, covered by look-alike host/port/scheme tests), T-02-38 (flag untouched, https still needs `verified`), T-02-39 (loopback needs the allow flag and the literal 127.0.0.1) and T-02-40 (optimizer no longer used) are covered.

## Requirements

MEDIA-04 and PLAT-01 left unticked in REQUIREMENTS.md: the loader is wired and tested, but MEDIA-04 is only delivered once variants exist in R2 and the flag is verified on (02-08 run, 02-20), and PLAT-01 once the Worker is deployed and proven (02-10 onward).

## Self-Check: PASSED

Files exist: `src/lib/image-loader.ts`, `image-loader.ts`, `tests/unit/image-loader.test.ts`, `tests/unit/supabase-media.test.ts`. Commits f1bd286, 370f107, b68efcd present in `git log`.
