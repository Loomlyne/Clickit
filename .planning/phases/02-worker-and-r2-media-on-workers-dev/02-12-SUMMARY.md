---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 12
subsystem: infra
tags: [r2, presign, aws4fetch, uploads, magic-bytes, svg, server-actions, security, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: getWorkerEnv() and the app Worker MEDIA binding (02-07); media Worker key layout and variant widths (02-03); Phase 01.1 media guards (SVG refused, caps, messages)
provides:
  - src/server/upload-kinds.ts (UPLOAD_KINDS, checkUploadRequest, mintUploadKey, keyMatchesKind, isVariantKeyFor, variantKeyFor, VARIANT_WIDTHS)
  - src/server/magic-bytes.ts (sniffMediaType)
  - src/server/r2-presign.ts (presignPut)
  - src/server/upload-finalize.ts (finalizeUploadedObject)
  - src/server/dev-upload-shim.ts (mintShimToken, checkShimRequest) and the PUT-only route /api/dev/r2-put/[...key]
  - src/server/auth-guards.ts (requireAdminUser, requireSignedInUser)
  - src/app/actions/media-upload.ts (requestMediaUpload)
affects: [02-14, 02-15, 02-16, 02-17, 02-18, 02-22]

tech-stack:
  added: []
  patterns:
    - "Pure modules with injected I/O (bucket, AwsClient constructor, clock, random); no '@/' imports so node --test loads them"
    - "Only keys proven to be ours are ever deleted: a key failing the kind/owner shape check is refused and left alone"
    - "Presigned PUT signs Content-Type (aws4fetch allHeaders), so the browser must repeat the exact type"

key-files:
  created:
    - src/server/upload-kinds.ts
    - src/server/magic-bytes.ts
    - src/server/r2-presign.ts
    - src/server/upload-finalize.ts
    - src/server/dev-upload-shim.ts
    - src/server/auth-guards.ts
    - src/app/actions/media-upload.ts
    - src/app/api/dev/r2-put/[...key]/route.ts
    - tests/unit/upload-kinds.test.ts
    - tests/unit/magic-bytes.test.ts
    - tests/unit/presign.test.ts
    - tests/unit/upload-finalize.test.ts
    - tests/unit/dev-upload-shim.test.ts
    - tests/unit/media-upload-source.test.ts
  modified:
    - src/server/cloudflare.ts
    - .dev.vars.example

key-decisions:
  - "Presign passes allHeaders: true. aws4fetch leaves content-type out of X-Amz-SignedHeaders by default, so the plan's Pattern 4.2 call would have signed no Content-Type; now R2 returns 403 unless the PUT repeats the signed type"
  - "finalize never deletes a key that fails the kind/owner shape check, and never deletes a variant key that is not exactly _v/<640|1280|1920>/webp/<verified key>. The plan said wrong prefix and bad variant keys are deleted; that would let a signed-in user delete another user's avatar by passing it as a key"
  - "Object keys carry a timestamp plus 8 random hex chars (poster-<ts>-<rand>.<ext>); the filename never reaches a key"
  - "Shim route checks the Host header only; request.url reports localhost under OpenNext preview"

patterns-established:
  - "Local upload test: preview with LOCAL_DEV=1 and LOCAL_UPLOAD_SHIM_SECRET in the gitignored .dev.vars; mint a token with mintShimToken and PUT to /api/dev/r2-put/<key>?t=<token>; read back with wrangler r2 object get --local"

requirements-completed: []

duration: 100min
completed: 2026-10-20
---

# Phase 2 Plan 12: Upload infrastructure Summary

**Direct-to-R2 upload plumbing is in place and tested without network: a kind table with the existing caps and SVG refusal, magic-byte sniffing, aws4fetch presign with Content-Type signed, a finalize gate that deletes refused objects, an admin/user-guarded `requestMediaUpload` action, and a local-only HMAC upload shim proven on `opennextjs-cloudflare preview`.**

Requirements MEDIA-01 and MEDIA-06 are NOT ticked: this plan delivers the shared infrastructure only. The per-kind finalize actions and DB writes are 02-15/02-16, the browser PUT code is 02-17/02-18, and the one real presigned round trip is plan 02-22.

## Accomplishments

- `UPLOAD_KINDS`: artwork (poster, card, hero, hero-mobile, logo), site-image (og, favicon, favicon-dark, auth), social-icon, cast-image, avatar, hero-video (desktop, mobile), preloader-video, show-video. Each has bucket, actor (admin or user), slots, allowlist, cap, over-cap message, bad-type message, and whether WebP variants are allowed.
- `checkUploadRequest` refuses SVG (case and parameters do not slip past) with the exact 01.1 message on every image kind, any type outside the kind's list, an unknown slot, and a missing, zero, fractional or oversize size.
- `mintUploadKey` returns the full object key `<bucket>/<path>`; ids must be UUIDs (lowercased), the extension comes from the validated content type, the charset is `[a-z0-9/_.-]`, and it throws instead of minting a partial key.
- `keyMatchesKind` is the exact inverse shape check used by finalize (kind, slot, show id, and for avatars the caller's own id).
- `sniffMediaType`: JPEG, PNG, WebP (RIFF+WEBP only), AVIF, GIF, ICO, MP4 brands (isom, iso2-iso6, mp41, mp42, avc1, mmp4, M4V), and `text/markup` for anything starting with `<` (after whitespace or a UTF-8 BOM). Unknown ftyp brands (heic, qt) are not accepted.
- `presignPut`: `https://<account>.r2.cloudflarestorage.com/clickit-media/<key>?X-Amz-Expires=300`, signed with `signQuery` and `allHeaders`. Account id must be 32 hex (no host injection), the key is charset-checked, missing credentials throw errors that name the variable only.
- `finalizeUploadedObject`: key shape and owner check, HEAD (size), 64 byte ranged GET (magic bytes), bytes must agree with the extension minted from the declared type; on any refusal it deletes the original and the three possible variant keys; a delete failure returns `cleanupFailed: true`. Variants are kept only as `_v/<640|1280|1920>/webp/<key>` with WebP bytes under the kind's cap; ICO and video kinds take none.
- `requestMediaUpload`: zod-validated input, session first (admin via `requireAdminUser`, avatar via `requireSignedInUser`, owner id always from the session), then `checkUploadRequest`, then `mintUploadKey`, then URLs. At most 3 variant URLs. No file bytes, no credentials in the response. In local preview with `LOCAL_DEV=1` and no R2 credentials it returns shim URLs on the request's own 127.0.0.1 host.
- Shim route (PUT only, `force-dynamic`): 404 unless `LOCAL_DEV=1`, Host is `127.0.0.1[:port]` and `LOCAL_UPLOAD_SHIM_SECRET` (gitignored `.dev.vars`, 32+ chars) exists; 403 for a missing, expired (over 300 s), future, tampered, wrong-key or wrong-type token; writes through the app Worker's `MEDIA` binding.

## Caps and messages (compare with the sources)

| Kind | Allowed types | Cap | Over-cap message | Source of the value |
|------|---------------|-----|------------------|---------------------|
| artwork poster, card, hero, hero-mobile | webp, png, jpeg | 10 MB | Image must be under 10MB | `uploadArtwork`, `artwork-upload-zone.tsx` |
| artwork logo | webp, png, jpeg | 2 MB | Image must be under 2MB | `artwork-upload-zone.tsx` |
| site-image og, auth | png, jpeg, webp, avif | 5 MB | Image must be under 5MB | `uploadSiteImage`, `SITE_IMAGE_MIME_EXT` |
| site-image favicon, favicon-dark | the above plus x-icon | 5 MB | Image must be under 5MB | same |
| social-icon | png, jpeg, webp, avif | 2 MB | Icon must be under 2MB | `uploadSocialIcon`, `SOCIAL_ICON_MIME_EXT` |
| cast-image | png, jpeg, webp | 2 MB | Image must be under 2MB | `uploadCastImage` |
| avatar | webp, png, jpeg | 2 MB | File must be under 2MB | `uploadAvatar` |
| hero-video, show-video | video/mp4 | 50 MB | Video must be under 50MB | `HERO_VIDEO_MAX_BYTES`, `createShowVideoUpload` |
| preloader-video | video/mp4 | 20 MB | Video must be under 20MB | `createPreloaderVideoUpload` |

No new cap value was introduced. SVG message is `SVG_REJECTED_MESSAGE` from `src/lib/admin/media-guards.ts` (imported, not copied).

Object key layouts (match what the current actions write, plus `-<rand>`): `show-artwork/shows/<showId>/<slot>-<ts>-<rand>.<ext>`, `show-artwork/shows/<showId>/cast/<ts>-<rand>.<ext>`, `site-assets/settings/<slot>-<ts>-<rand>.<ext>`, `site-assets/settings/social-icons/<ts>-<rand>.<ext>`, `avatars/<userId>/avatar-<ts>-<rand>.<ext>`, `site-assets/hero/video[-mobile]-<ts>-<rand>.mp4`, `site-assets/preloader/video-<ts>-<rand>.mp4`, `site-assets/shows/<showId>/hero-<slot>-<ts>-<rand>.mp4`. Variants: `_v/<640|1280|1920>/webp/<key>`.

## Task Commits

1. **Task 1 RED:** `f773dac` (test) - kinds, magic bytes, presign
2. **Task 1 GREEN:** `fb05d28` (feat)
3. **Task 2 RED:** `6986711` (test) - finalize and shim
4. **Task 2 GREEN:** `0b55e5e` (feat)
5. **Task 3:** `5c1da17` (feat) - action, guards, route, source-invariant test
6. **Task 3 fix:** `14c2852` (fix) - shim route Host check and body buffering, found in preview

## Verification

| Check | Result |
|-------|--------|
| New tests | 73: upload-kinds 17, magic-bytes 8, presign 9, upload-finalize 24, dev-upload-shim 10, media-upload-source 5 |
| `npm run test:unit` | 701 tests, 701 pass |
| `npm run lint` | 0 errors, 26 warnings (unchanged) |
| `npx tsc --noEmit` | clean |
| `npm run gate:local` (detached, under the heavy lock, `~/clickit-phase02-logs/02-12-gate.log`) | `exit=0`: lint, unit tests, `next build`, `cf:build` |
| Presign with the real `aws4fetch` and fake keys | URL on `<account>.r2.cloudflarestorage.com/clickit-media/<key>`, `X-Amz-Expires=300`, 64 hex `X-Amz-Signature`, `content-type` and `host` in `X-Amz-SignedHeaders`; no network |
| Shim on `opennextjs-cloudflare preview` (127.0.0.1:8793, LOCAL_DEV=1, `~/clickit-phase02-logs/02-12-smoke.log`) | no token 403; Host localhost 404; GET 405; wrong content type 403; token for another key 403; good PUT 200; `wrangler r2 object get --local` returned identical bytes; test object deleted; preview stopped by recorded process group, port free, lock released |

Not verified: `requestMediaUpload` end to end (it needs a signed-in admin session and a session cookie against the local Supabase stack; the guard order is asserted by a source test and the pure parts are unit tested); a real presigned PUT to R2 (R2 not enabled, R2 keys are an owner step; plan 02-22 does the one round trip); bucket CORS and CSP `connect-src` for the R2 S3 host (RUNBOOK step 8 and plan 02-14); that the route returns 404 on workers.dev (plan 02-22); Safari/WebP variant behaviour (browser code is 02-17).

## Deviations from Plan

### Auto-fixed / judgement calls

**1. [Rule 1 - Bug] Content-Type was not signed by the planned presign call**
- **Found during:** Task 1 (writing the "signed headers contain content-type" test against real aws4fetch)
- **Issue:** aws4fetch 1.0.20 puts `content-type` in `UNSIGNABLE_HEADERS`, so `sign(..., { aws: { signQuery: true } })` produced `X-Amz-SignedHeaders=host` only. The browser could PUT any type with the URL, defeating "Content-Type signed" (must_haves truth 1).
- **Fix:** pass `{ aws: { signQuery: true, allHeaders: true } }`. Test asserts `content-type` is in the signed headers and a different type changes the signature.
- **Files modified:** src/server/r2-presign.ts, tests/unit/presign.test.ts
- **Commit:** fb05d28

**2. [Rule 2 - Security] Refused keys are not deleted unless provably ours**
- **Found during:** Task 2 (designing the "wrong prefix -> deleted" behaviour)
- **Issue:** deleting the supplied key on a prefix/owner mismatch, or deleting arbitrary supplied variant keys, would let a signed-in user delete another user's avatar (or an in-use artwork) by passing its key to finalize.
- **Fix:** wrong kind/prefix/owner returns "Invalid upload key" and deletes nothing (no presigned URL can write there, so nothing orphaned exists). Variant keys not exactly `_v/<w>/webp/<verified key>` are dropped with reason `bad-key` and never deleted. Size, magic-byte and mismatch refusals (key already proven ours) still delete the original and its three possible variant keys. Tests cover both.
- **Files modified:** src/server/upload-finalize.ts, tests/unit/upload-finalize.test.ts
- **Commit:** 0b55e5e

**3. [Rule 1 - Bug] Shim route 404 for every request under OpenNext preview**
- **Found during:** Task 3 preview smoke
- **Issue:** the first version also required `request.url` host to equal the Host header; under OpenNext preview `request.url` reports `localhost:<port>` while Host is `127.0.0.1:<port>`.
- **Fix:** check the Host header only (plus LOCAL_DEV, secret and HMAC).
- **Commit:** 14c2852

**4. [Rule 1 - Bug] R2 put refused the request body stream**
- **Found during:** Task 3 preview smoke (500, "Provided readable stream must have a known length")
- **Issue:** Next hands the route a body stream of unknown length, which R2 `put` rejects, so the planned "stream request.body" cannot work.
- **Fix:** local-only route buffers with `request.arrayBuffer()` (60 MB cap, empty refused, content-length required). Production never uses this route; browsers PUT to R2 directly. The action itself still touches no file bytes.
- **Commit:** 14c2852

**5. [Judgement] Minted keys add an 8 hex random part**
- Plan allowed "a random/timestamp component". Keys are `<stem>-<ts>-<rand>.<ext>`. The existing path regexes for hero and preloader videos (`^hero/video-\d+\.mp4$`, `^preloader/video-\d+\.mp4$`, `isHeroVideoUploadPath`) do not match these keys; plan 02-16 replaces those flows and must use `keyMatchesKind` instead.

**6. [Judgement] ICO only on favicon slots**
- Today `uploadSiteImage` allows ICO for every site image kind (og, auth too). The kind table allows `image/x-icon` only for `favicon` and `favicon-dark`, as the plan text describes (ICO for the favicon). Tightening only; no existing flow needs ICO elsewhere.

**7. [Judgement] Videos require `video/mp4` exactly**
- The current `isMp4File` also accepts a `.mp4` name with an empty or `application/octet-stream` type. A presigned PUT must sign a concrete Content-Type, so the new flow asks the client to send `video/mp4`; 02-16/02-18 must set it from the file name when the browser reports none.

### Parallel behaviour left to later plans

- `assertAdmin` in `src/app/[locale]/admin/actions.ts` is unchanged (plan 02-15 switches it to `requireAdminUser`); both copies have the same logic and messages.
- Adding `/api/dev/r2-put` to the no-vercel/no-dev check list in plan 02-14 and the 404-on-workers.dev check in 02-22 are still to do (recorded below).

## Owner / controller items

- Create the R2 S3 API token and set `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` as Worker secrets (RUNBOOK); until then `requestMediaUpload` answers "Uploads are not available right now" on workers.dev.
- Apply the bucket CORS from the 02-02 builder (RUNBOOK step 8), PUT with header `Content-Type`.
- 02-14: add the R2 S3 host (`https://<account>.r2.cloudflarestorage.com`) to CSP `connect-src`; add `/api/dev/r2-put` to the dev-route check list.
- 02-22: confirm `PUT /api/dev/r2-put/<key>` is 404 on workers.dev.
- Preview note: my local `.dev.vars` (gitignored) now has `LOCAL_UPLOAD_SHIM_SECRET`; `LOCAL_DEV=1` must be added by hand to exercise the shim and removed again.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-02-52 (guards per actor, avatar id from session), T-02-53 (finalize), T-02-54 (SVG refused at request and finalize), T-02-55 (key minting and charset test), T-02-56 (shim gates), T-02-57 (names only in errors, test asserts the secret is absent from URL/headers), T-02-58 (3 variant URLs, session required) are all mitigated in code and tests.

## Self-Check: PASSED

- Files: all 14 created and 2 modified files above exist.
- Commits: f773dac, fb05d28, 6986711, 0b55e5e, 5c1da17, 14c2852 present in `git log`.
- Heavy lock free; no preview process left on 8793.
