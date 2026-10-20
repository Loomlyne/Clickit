# Hand-over: job C, Cloudflare move (Phase 2 execution, Phase 3 plan draft)

Session: work session C. Branch `claude/phase-02-execute-19d86a` (worktree `.claude/worktrees/phase-02-execute-19d86a`), pushed to origin. Final commit: __FINAL__.
PR: none yet. Plan: one PR for the whole phase after 02-22 (the remaining four plans are owner/controller-gated). The controller may open a PR earlier for review of 02-01..02-19; the diff against main is code-complete for the Worker.

## Done (18 of 22 Phase 2 plans, plus extras)

| Plan | What | SUMMARY |
|------|------|---------|
| 02-01 | Next 16.4.2 + OpenNext 1.20.12 (exact pins, Koss approved), wrangler.jsonc, wrangler guard, preview spike | 02-01-SUMMARY.md, 02-SPIKE.md |
| 02-02 | R2 CORS builder, runbook review | 02-02 |
| 02-03 | Job D's media Worker extended (variants, 412, cache, SVG); ONE media Worker | 02-03 |
| 02-04 | cron auth, cron map, client IP, rate-limit policy, Turnstile siteverify helpers | 02-04 |
| 02-05 | (done before this session) pictures + roadmap edits signed | 02-05 |
| 02-06 | build targets, stamp, deploy guard, cf:* scripts | 02-06 |
| 02-07 | scheduled() → cron routes (crons stay OFF), bindings, _headers, site-url without Vercel | 02-07 |
| 02-08 | media copy script (dry-run default, guarded --execute), variants, faststart, checksum + verify | 02-08 |
| 02-09 | custom next/image loader to the media Worker | 02-09 |
| 02-11 | Turnstile server side, fail-closed limiter, captchaToken on auth, BotID out of server/proxy | 02-11 |
| 02-12 | upload infra: kinds, magic bytes, aws4fetch presign, finalize with delete-on-failure | 02-12 |
| 02-13 | Turnstile widgets on 5 forms (signed placement), deploy guard refuses missing/test site key | 02-13 |
| 02-14 | Vercel code removed (vercel.json, botid, @vercel/*), CSP builder, Web Analytics beacon | 02-14 |
| 02-15 | image finalize core + 5 actions | 02-15 |
| 02-16 | video finalize on R2 (fast-start, audio) | 02-16 |
| 02-17 | browser → R2 image uploads, signed UploadStatus | 02-17 |
| 02-18 | browser → R2 video uploads | 02-18 |
| 02-19 | old upload actions, sharp, @aws-sdk out of request paths; admin works on the Worker | 02-19 |

Extras: shared-key and live-key guards for images and video (c0c4cbf..9bf2faf); deferred items 21-23 left (remove actions and cross-scope sharing, see deferred-items.md); unknown-route 500 → 404 (`src/app/[locale]/[...rest]`, locale not-found); merge of origin/main (Phase 1, B4 admin restyle, perf, job D) with resolution log in the merge commit; media deploy guard follows main's `supabase-only`/`r2` env split; video and image finalize refuse an already-live key; replaced key kept while another live value uses it; runbook fixes (Turnstile widget before first deploy, Step 4b enable R2, Step 28 production stop); Phase 3 cutover draft v2 (`.planning/phases/03-production-cutover/03-CUTOVER-DRAFT.md`) after an independent review.
CI: Phase 1's `pr-gate.yml` / `apply-live-migrations.yml` (on main) replace the CI items in the job brief; this branch's own `ci.yml` was dropped in the merge. Note for the controller: `pr-gate.yml` runs on `[opened, synchronize, reopened]` with no `paths-ignore` (by design, required checks); Koss's rule 4 says once on open with paths-ignore. That is Phase 1's file: decide there.

## Gates (final tree)

- `npm run gate:local` (lint, typecheck, unit, guard:migrations, next build, cf:build) under the heavy lock: exit=0 on 9bf2faf (`/Users/koss/clickit-phase02-logs/shared-key-gate.log`).
- `npm run test:unit`: 1003/1003 pass. Lint 0 errors (24 warnings, known). `tsc --noEmit` clean.
- Worker preview smoke after the main merge: `/en` 200, `/en/auth` 200 with the Turnstile widget in #21's slot, `/en/auth/sign-in` 404; admin settings save 200 on the Worker (02-19).

## Not verified

- Anything remote: no deploy, no R2 (not enabled), no real presigned PUT, no Worker secrets, no Turnstile real keys, no Web Analytics token, no CPU numbers (02-10, 02-20, 02-21, 02-22).
- Real Safari playback, Arabic/RTL layout of the new upload zone and Turnstile placement, a file near 50 MB.
- Contact/newsletter against Cloudflare's real siteverify.
- `check-revalidate` (needs a signed-in cookie).

## Remaining plans (owner/controller-gated)

- 02-10: RUNBOOK Steps 1-24 (login, subdomain, enable R2 [4b], buckets, CORS, D1, env file incl. Turnstile widget [20 before 12], first workers.dev deploy [12], secrets, Web Analytics, Supabase redirect URL), then CPU sample.
- 02-20: code-complete deploy, media Worker deploy (Step 28 production stop), copy, verify, flag-on build.
- 02-21: per-route CPU on Workers Free, stop rule with the priced question.
- 02-22: gate, coverage, UAT, teardown.

## Pending Koss signatures (copy)

- Arabic for: `turnstile.checkFailed` ("Security check failed. Please try again."), the 02-11 rate-limit and "temporarily unavailable" lines, the 02-17/02-18 upload texts (progress, Retry, refused, Safari note, "Saving…", "Upload an MP4 video.", not-fast-start sentence, "Checking fast-start…", "MP4, fast-start, under 50MB").
- Wording for the hero ">8 MB" warning that still mentions Supabase egress (deferred item 13).

## UAT (numbered, after 02-10..02-20 owner steps; on workers.dev)

1. Open `https://clickit.<SUB>.workers.dev/en` → home renders, images load from the media origin.
2. Open `/en/auth`, sign in with a real account → Turnstile widget above the button, button enabled after the check, signed in.
3. Open a show, pick an episode → YouTube player plays; progress saved after reload.
4. Admin: `/en/admin/settings`, change the tagline, Save → toast "Site metadata saved"; reload shows it.
5. Admin: upload a PNG artwork to a draft show → yellow progress zone, then the image shows from the media origin; Save.
6. Admin: upload an SVG → refused toast, nothing saved.
7. Admin: upload a fast-start MP4 hero to a draft show → progress, plays; a non-fast-start MP4 → refused, nothing saved.
8. `/en/auth/sign-in` → 404 page. `/` → redirects to `/en`.
9. Cron: `curl -s -o /dev/null -w "%{http_code}" https://clickit.<SUB>.workers.dev/api/cron/publish-scheduled` → 401 (no secret).
