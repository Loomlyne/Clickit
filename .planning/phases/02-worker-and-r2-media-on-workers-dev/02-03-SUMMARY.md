---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 03
subsystem: infra
tags: [cloudflare-workers, r2, media, range, etag, avif, webp, svg-csp, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: Next 16.4.2 / OpenNext base config and the node --test unit setup (plan 02-01); media Worker from Job D (PR #19)
provides:
  - workers/media/src/handler.ts extended to the 02-03 spec (variants, 412, cache rule, SVG disposition)
  - exports MEDIA_BUCKETS, VARIANT_WIDTHS, variantCandidates, variantWidth, cacheControlFor(url, variantServed, stored)
  - workers/media/tsconfig.json (standalone)
  - 20 named 02-03 tests on top of Job D's 17 (37 in tests/unit/media-worker.test.ts)
affects: [02-06, 02-08, 02-20]

tech-stack:
  added: []
  patterns: ["ONE media Worker: D's handler extended in place, no second worker or parallel handler", "variants only ever read from R2; the permanent fallback is the original (R2, then Supabase)"]

key-files:
  created:
    - workers/media/tsconfig.json
  modified:
    - workers/media/src/handler.ts
    - workers/media/wrangler.jsonc
    - workers/media/README.md
    - tests/unit/media-worker.test.ts

key-decisions:
  - "Binding stays MEDIA_BUCKET (D's name, may already be deployed); the plan's MEDIA is not used for the media Worker"
  - "D's Supabase fallback and supabase-only env kept; the plan said R2 only"
  - "Variant key layout _v/<width>/<avif|webp>/<bucket>/<key> (shared with 02-08 and 02-17), widths 640/1280/1920"
  - "Stored R2 Cache-Control still wins on unversioned originals (D's behaviour); ?v= or a served variant always forces public, max-age=31536000, immutable"

patterns-established:
  - "Vary: Accept is appended once in handleMediaRequest to every response (200, 206, 304, 404, 502) whose URL has an allowed ?w="

requirements-completed: []

duration: 25min
completed: 2026-10-20
---

# Phase 2 Plan 03: Media Worker (extended) Summary

**Job D's `clickit-media` Worker now meets every 02-03 behavior bullet: `?w=640|1280|1920` negotiates AVIF/WebP from `_v/<w>/<fmt>/<bucket>/<key>` in R2 with `Vary: Accept` and original fallback, 412 vs 304 on failed preconditions, 3600 s default cache with immutable for `?v=`/variants, SVG `Content-Disposition: inline`, all in the same single handler.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-20
- **Tasks:** 2 of 2
- **Commits:** e7cbf3f (test, RED), 0fd9cdf (feat, GREEN), 703ccaa (feat, config/docs)

## What changed

Handler (`workers/media/src/handler.ts`):
- `MEDIA_BUCKETS` is the same Set object as D's `PUBLIC_MEDIA_BUCKETS` (show-artwork, site-assets, avatars). That list equals `PUBLIC_BUCKETS` in `src/lib/supabase-media.ts` exactly, so no private bucket is reachable.
- `VARIANT_WIDTHS` = 640, 1280, 1920. `variantWidth(url)` accepts only a digits-only allowed `?w=`.
- `variantCandidates(objectKey, width, accept)` returns `_v/<w>/avif/...`, `_v/<w>/webp/...`, then the original last. Accept parsing is by token and honours `q=0`.
- `cacheControlFor(url, variantServed, stored)`: `?v=` or variant -> `public, max-age=31536000, immutable`; else stored value; else `public, max-age=3600`.
- Failed R2 `onlyIf`: 304 when `If-None-Match` (or `If-Modified-Since` alone) was sent, otherwise 412.
- SVG (R2 or Supabase path) gets `Content-Disposition: inline`.
- `Vary: Accept` appended to every response when `?w=` is an allowed width.
- Direct `/_v/...` was already a 404 (`_v` is not an allowlisted bucket); now pinned by a test along with `%2e%2e`, `//`, empty key.

Config: `workers/media/tsconfig.json` (standalone, ES2022, Bundler, strict, WebWorker lib). `"triggers": {"crons": []}` added to `wrangler.jsonc`. Root `tsconfig.json` already excludes `workers` and `tests/unit` (verified). README updated.

## Verification

- `node --test tests/unit/media-worker.test.ts`: 37 tests, 37 pass (17 from D, 20 new `02-03 ...`).
- `npm run test:unit`: 467 tests, 467 pass.
- `npx tsc -p workers/media/tsconfig.json --noEmit`: exit 0.
- `npm run lint`: 0 errors (26 pre-existing warnings, none in files touched here).
- `npm run cf:guard:local`: ok. `wrangler deploy --dry-run` (HOME=/Users/koss/.clickit-cloudflare, no remote call): top level shows binding `MEDIA_BUCKET (clickit-media)` + `SUPABASE_URL`; `-e supabase-only` shows `SUPABASE_URL` only (env still works, bindings not inherited as intended).
- Not verified: behaviour on a deployed Worker, real R2 `range`/`onlyIf` semantics (fake bucket mirrors the documented API), variants existing in R2 (copy script is plan 02-08). `npm run gate:local` (build + cf:build) not run in this plan.

## Deviations from Plan

### Deliberate (controller-directed reconciliation with Job D)

1. **Binding name `MEDIA_BUCKET`, not `MEDIA`.** The plan's `"binding": "MEDIA"` acceptance grep does not hold; D's name is kept because the Worker may already be deployed. The Next app Worker's own `MEDIA` binding in root `wrangler.jsonc` is a different Worker and untouched.
2. **Supabase fallback kept** (`vars.SUPABASE_URL`, env `supabase-only`, `fromSupabase`). The plan said "MEDIA binding only, no vars". Consequences: `wrangler.jsonc` has a `vars` block; `?w=` variants are looked up in R2 only, never Supabase.
3. **`index.ts` kept as D wrote it** (typed with `MediaEnv`, no `R2Bucket`).
4. **Bucket list:** no change; D's list is identical to the repo's real public buckets.
5. **Security headers stricter than the plan:** D sets the sandbox CSP, nosniff, CORP, ACAO `*` and Referrer-Policy on every response, not only SVG. Kept.
6. **Stored Cache-Control wins on unversioned originals** (D's behaviour, pinned by D's HEAD test); the plan's rule has no stored-value input.

### D tests changed

None edited. D's tests reference `UNVERSIONED_CACHE_CONTROL` by constant; the constant value changed from `public, max-age=86400, stale-while-revalidate=604800` to `public, max-age=3600` to match the 02-03 spec, so those assertions now check the new value. `cacheControlFor`'s signature changed from `(url, stored)` to `(url, variantServed, stored)`; no other caller exists in the repo.

### Auto-fixed

None.

## Later plans that must say `MEDIA_BUCKET` for the media Worker

- **02-06** line 89 and its test bullets: `checkMediaDeploy` must allow exactly one R2 binding named `MEDIA_BUCKET` (to `clickit-media`) and the `SUPABASE_URL` var, not "any binding other than MEDIA". It should also expect `deploy` to pass `--env ""` (or `-e supabase-only` deliberately) because wrangler warns when the config defines several environments.
- **02-08 / 02-09 / 02-17**: they only share the key layout (`_v/<w>/<avif|webp>/<bucket>/<key>`); no binding name, no change needed.
- **02-20 / 02-22 / RUNBOOK Step 28**: reference URLs only, no binding name; no change needed. Note for 02-20: `?w=` responses always carry `Vary: Accept`, and unversioned cache is now 3600 s.
- **02-12, 02-15, 02-19** mention a `MEDIA` binding: that is the Next app Worker's binding, keep as is.

## Known Stubs

None.

## Threat Flags

None. T-02-09 (allowlist, traversal, direct `_v/`), T-02-10 (SVG CSP + disposition) and T-02-12 (405) are covered by named tests; T-02-11 accepted.

## Requirements

MEDIA-04, MEDIA-05, MEDIA-06 left unticked in REQUIREMENTS.md: the handler is done and tested, but they are only fully delivered once the Worker is deployed and variants and hero MP4s exist in R2 (plans 02-08, 02-20).

## Self-Check: PASSED

Files exist (handler.ts, tsconfig.json, test file); commits e7cbf3f, 0fd9cdf, 703ccaa present in `git log`.
