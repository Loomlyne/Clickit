---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 15
subsystem: media
tags: [r2, uploads, finalize, server-actions, admin, audit, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: finalizeUploadedObject, keyMatchesKind, requireSignedInUser, getWorkerEnv().MEDIA (02-12); getPublicMediaOrigin (02-09); Phase 01.1 runAdminAction, logAuditStrict, hero-video core pattern
provides:
  - src/lib/admin/image-upload.ts (finalizeImageUploadCore, ImageUploadPorts, ImageTarget)
  - src/lib/admin/image-db.ts (adminImageDb: one column or row per target)
  - src/server/r2-keys.ts (r2KeyFromUrl, r2KeysForUrl)
  - finalizeArtworkUpload, finalizeSiteImageUpload, finalizeSocialIconUpload, finalizeCastImageUpload (admin/actions.ts)
  - finalizeAvatarUpload (profile/actions.ts)
affects: [02-17, 02-19, 02-22]

key-decisions:
  - "Core order is finalize, read current, write ONE target, strict audit, then delete the previous object. Audit failure restores the previous value and deletes the new key and variants; a write failure deletes the new key and variants. Tested with forced failures."
  - "Previous objects are deleted only when their URL is on our verified media origin and the key is in show-artwork, site-assets or avatars (r2KeysForUrl). Supabase Storage URLs, empty values and foreign hosts yield no keys, so Supabase originals are never deleted (MEDIA-07)."
  - "Social icon and cast-without-member have no database target: today's flow keeps the url in form state until Save, and an index into the footer array could point at the wrong entry if the form was reordered. They finalize, audit and return the url. A cast image with castId writes that member's image_url (show id must match)."
  - "finalizeArtworkUpload writes shows.<slot column> as the plan says, and takes an optional commit (default true). The artwork drawer today holds the new url in form state and commits on Save, so 02-17 should pass commit:false to keep Cancel semantics unless Koss wants the drawer to write at upload time."
  - "No ?v= cache-bust: every minted key carries -<ts>-<rand>, so a url never repeats."
  - "assertAdmin was kept, not replaced by requireAdminUser: the logic and messages are identical but assertAdmin returns the user object that dozens of actions read (user.id), so swapping adds an adapter for no gain."

requirements-completed: []

duration: 55min
completed: 2026-10-20
---

# Phase 2 Plan 15: Image finalize core and actions Summary

**Every image kind (artwork, site image, social icon, cast image, avatar) can now be finalized from an R2 key: finalize checks size, prefix/owner and magic bytes, writes one database target, writes the strict audit row, and only then deletes the previous R2 object, with compensation if the write or audit fails. The old FormData actions are untouched.**

MEDIA-01 and MEDIA-06 are NOT ticked: the server half is done, but no UI sends keys yet (02-17) and the old body-carrying actions still exist (02-19).

## Task Commits

1. **Task 1 RED:** `190f877` (test) - 18 failing tests, module missing
2. **Task 1 GREEN:** `86dcfb2` (feat) - `finalizeImageUploadCore`
3. **Task 2:** `5de2594` (feat) - five finalize actions, db port, R2 key helper, tests

## What was built

- `finalizeImageUploadCore(ports, input)`: refuses with `Media host is not ready` before finalize when there is no media origin; refused finalize returns its error with no db call; db write error deletes the new key and variants; audit failure restores the previous value (and reports a failed restore) and deletes the new objects; previous-object cleanup failure returns `success: true, mediaCleanupFailed: true` and is logged. A null target (social icon, cast member not yet created) skips the database but still audits. A null `audit` port (avatar) skips the admin audit row.
- Admin actions validate with zod (uuid ids, slot and kind enums, key at most 300 chars, at most 3 variant keys), run through `runAdminAction` (admin guard first, same `adminEnv` and `logAuditStrict` as 01.1), and revalidate only when something was written (`bumpCatalogCache` for artwork and cast, `bumpSiteConfigCache` for site images).
- `finalizeAvatarUpload({ key, variantKeys })`: `requireSignedInUser()` first; the owner id is the session user, never input; finalize refuses a key not under `avatars/<that id>/`; only that user's `profiles` row is written, through the user's own Supabase client (RLS applies).
- Artwork columns: poster `poster_url`, card `card_image_url`, hero `hero_url`, hero-mobile `hero_image_mobile_url`, logo `logo_url`. Site image columns reuse `SITE_IMAGE_COLUMN`.
- 01.1 guards: SVG refusal and the JPEG/ICO/size rules come from `finalizeUploadedObject` (02-12 imports `SVG_REJECTED_MESSAGE` and the existing caps); `checkImageUpload` stays on the old paths. `finalize*` take no `File`, `FormData` or `Blob` (source test).

## Verification

| Check | Result |
|-------|--------|
| New tests | 32 (file breakdown below); suite went from 701 to 767 with the other plans' tests |
| `npm run test:unit` | 767 tests, 767 pass |
| `npm run lint` | 0 errors, 26 warnings (unchanged) |
| `npx tsc --noEmit` | clean |
| `npm run gate:local` (detached, heavy lock, `~/clickit-phase02-logs/02-15-gate.log`) | `exit=0`: lint, unit, `next build`, `cf:build`; lock released |

New test files: `admin-image-upload` (18, core with forced failures), `admin-image-db` (5, real db port against the fake Supabase recording every write: one show column plus one audit row, one app_config column, cast of another show not found, audit failure restores the column, unknown show writes nothing), `r2-keys` (4), `admin-image-upload-source` (5). Total new: 32.

Not verified: a real finalize against the local Supabase stack with a signed-in admin session and a live local R2 object (needs the 02-17 browser path or a session cookie; no local stack was started and nothing touched the live project); the avatar action end to end (its pieces are unit tested; the action itself needs a signed-in user); a real R2 delete of previous variants.

## Deviations from Plan

- **[Rule 2 - correctness] `commit` option on `finalizeArtworkUpload`.** The plan input is `{ showId, slot, key, variantKeys }` with a column write. The existing artwork flow deliberately does not write until Save. Added `commit` (default true, plan behaviour) so 02-17 can keep the drawer's Cancel behaviour. Owner decision for 02-17 if the drawer should write at upload.
- **Social icon and cast without `castId` write no database row** (see key-decisions). The plan said "social icon index/key"; today's flow has no stable index.
- **Port shape:** the plan's `isR2Key(url)` became `previousR2Keys(url): string[]` (it must return the keys to delete, including derived webp and avif variants). The `db` port is built in `src/lib/admin/image-db.ts` (not the 'use server' file) so it is unit tested.
- **`assertAdmin` kept** (see key-decisions).
- Task 1 RED commit contains only the test file, so the RED run failed because the module was missing.

## Owner / controller items

- 02-17: pass `commit: false` for the artwork drawer unless Koss wants write-at-upload. Social icon and cast flows save the returned url with the form as today.
- None of the finalize actions has been exercised against a signed-in session yet; 02-17's preview check and 02-22 cover that.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-02-68 (guard per action, finalize prefix/owner), T-02-69 (magic bytes and size, delete on refusal), T-02-70 (restore on audit failure, tested), T-02-71 (Supabase URLs never deleted, tested in r2-keys and the core), T-02-72 (strict audit before deleting the previous object) are mitigated and tested.

## Self-Check: PASSED

Files exist: `src/lib/admin/image-upload.ts`, `src/lib/admin/image-db.ts`, `src/server/r2-keys.ts`, `tests/unit/admin-image-upload.test.ts`, `tests/unit/admin-image-db.test.ts`, `tests/unit/r2-keys.test.ts`, `tests/unit/admin-image-upload-source.test.ts`. Commits `190f877`, `86dcfb2`, `5de2594` exist on `claude/phase-02-execute-19d86a`.
