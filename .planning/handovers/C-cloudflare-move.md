# Hand-over: job C, Cloudflare move (Phase 2 execution, Phase 3 plan draft)

Session: work session C. Branch `claude/phase-02-execute-19d86a` (worktree `.claude/worktrees/phase-02-execute-19d86a`), pushed to origin, contains origin/main c0da1d8. Updated 2026-10-21.
PR: draft "Phase 2: Cloudflare Workers and R2" against main, opened 2026-10-21 for review while the owner runbook steps are still open. Do not merge until the steps below are closed and Koss says Ship.
Live today: app Worker `clickit` on https://clickit.clickitstory.workers.dev at d7b59d6 (version 0c24ae10, 2026-10-20 23:29 CET, media flag off). c9bdde8 (Arabic prompt fix) and later commits wait for the next redeploy (Koss's own "deploy workers.dev" each time). www stays on Vercel.

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

Extras since the first hand-over (2026-10-20):
- Deferred items 21-23 fixed: media deletes check every live reference across all tables and fail safe; compare-and-swap on media writes (f77ff68, 1d6ce5b).
- Admin form saves check `updated_at` (shows, every app_config settings section, settings-page media; reorder/featured CAS on previous values) with a shared row-version provider (9a953f9, b73b30c).
- Admin Arabic fill on Workers AI (`AI` binding, `@cf/google/gemma-4-26b-a4b-it`), fail closed, 60 calls per admin per 10 min, warning toast with the signed ticker copy; Google Translate path, key and RUNBOOK Step 19 removed (a24d365, d7b59d6). Live model check without DB writes, prompt fixed to translate places, months and times (c9bdde8).
- DOQueueHandler deploy warning: not a bug (OpenNext's local populate-cache proxy); the deployed Worker exports the class. No change.
- RUNBOOK: pre-cutover check that live PostgREST max_rows >= 1000 (Phase 6 readAllPages); youtube-recheck cron note at P3-8 (858e427).

Earlier extras: shared-key and live-key guards for images and video (c0c4cbf..9bf2faf); unknown-route 500 → 404 (`src/app/[locale]/[...rest]`, locale not-found); merge of origin/main (Phase 1, B4 admin restyle, perf, job D) with resolution log in the merge commit; media deploy guard follows main's `supabase-only`/`r2` env split; video and image finalize refuse an already-live key; replaced key kept while another live value uses it; runbook fixes (Turnstile widget before first deploy, Step 4b enable R2, Step 28 production stop); Phase 3 cutover draft v2 (`.planning/phases/03-production-cutover/03-CUTOVER-DRAFT.md`) after an independent review.
CI: Phase 1's `pr-gate.yml` / `apply-live-migrations.yml` (on main) replace the CI items in the job brief; this branch's own `ci.yml` was dropped in the merge. Note for the controller: `pr-gate.yml` runs on `[opened, synchronize, reopened]` with no `paths-ignore` (by design, required checks); Koss's rule 4 says once on open with paths-ignore. That is Phase 1's file: decide there.

## PR #29 review, items 6-10 and 12 (app code, 2026-10-21 12:5x CET)

| Item | Result | Commits (test, fix) |
|------|--------|---------------------|
| 6/10 public /ar never blocks on AI | Dropped the public AI call: `localizedField` (now in `src/lib/locale.ts`) renders the stored `*_ar` or the English; `translateEnToAr`, `translateToArabic`, `translateBatchToArabic` and their 30-day cache removed from `src/lib/translate.ts` (strict admin API kept). Behaviour test with a fake Worker AI binding: 0 calls. | 8b32dc7, 74c1d69 |
| 7 AI fill length and Arabic share | Fill obeys each field's zod max (read from the schema, `src/lib/admin/arabic-limits.ts`): longer → null, counted missing. `acceptArabicTranslation` also needs >= 50% Arabic letters (digits, punctuation, URLs, emails, @handles and capitalised Latin words kept verbatim from the source not counted), >= 2 Arabic letters, and not every source word left untranslated. The literal rule ("ignore every source-verbatim Latin token") would have accepted "Season 2 ي", hence the last two conditions. | 4776ae0, 86a3a4e |
| 8 updated_at CAS | Done for updateCategory, updateShort, upsertFaq (update), upsertLegalPage (update), updateSeason, updateEpisode; every table already had updated_at + trigger (no migration). reorderCategories now returns the new versions (also fixes a stale sort_order write-back after a reorder). Nothing moved here. The coverage test's scanner table set (shows, app_config, show_cast) is unchanged, so its exception list did not shrink; the six actions joined VERSIONED_ACTIONS and `tests/unit/admin-row-cas.test.ts` checks their writes. | dda9128, aa411d4 (legal: 8e78e9a, 42470f6) |
| 9 rate_limits pruning | `/api/cron/cleanup-media` (weekly, Mon 04:00 UTC) first runs one DELETE of rows older than 24 h (longest window in use: 1 h), fail-soft, reported as `rateLimitsPruned`. No new cron trigger. | 5053756, 6bcb2d1 |
| 11 Turnstile blocked | Note only: Turnstile blocked → sign-in/sign-up dead; no server siteverify on auth until Supabase CAPTCHA (RUNBOOK P3-7). `ar.json` `turnstile.checkFailed` is still English: no signed Arabic wording exists (checked `mockups/DECISIONS.md` and `turnstile-placement.html`: English only), left for Koss's signature. | none |
| 12 legal Arabic "AI draft, admin approves" | Below. | 8e78e9a, 42470f6 |

Item 12 (Koss 2026-10-21, question form):
- Migration `supabase/migrations/20261021120000_legal_pages_arabic_review.sql` (additive): `title_ar_draft text`, `content_ar_draft text`, `ar_reviewed boolean not null default false`; rows with a non-blank `content_ar` are set `ar_reviewed = true` (Arabic already live stays live), with the `set_updated_at` trigger paused for that one UPDATE so the public "last updated" date does not move. Passes `npm run guard:migrations`; dry-run on the local stack inside a rolled-back transaction (heavy lock) OK. It reaches live only through `apply-live-migrations.yml` with Koss's approval. Not applied anywhere.
- Koss check before approving it: `scripts/backfill-translations.mjs` (DeepL) used to write `legal_pages.content_ar` directly, so live legal Arabic may be machine text; the migration keeps whatever is live published. Read the two live rows (read-only) and untick "Arabic reviewed" for any page that is machine text. The script now writes the draft columns only.
- Save rules (`src/lib/admin/legal-pages.ts`): blank Arabic → AI into the draft columns; ticked → the form's Arabic is published, drafts cleared; unticked → the form's Arabic stays a draft, the published Arabic is left (hidden); English edited while its Arabic is untouched → that Arabic is dropped, re-drafted by the AI, and the review resets to false even if ticked; ticked with an empty Arabic body (English non-empty) → refused. Update is CAS on updated_at.
- Public `/legal/[slug]`, `/privacy`, `/terms`: title and body in Arabic only when `ar_reviewed`; the public query never selects the drafts (they are still readable through the anon select policy on the table: not secret, never rendered).

## Gates (final tree)

- `npm run gate:local` (lint, typecheck, unit, guard:migrations, next build, cf:build) under the heavy lock on the PR head: see `/Users/koss/clickit-phase02-logs/pr-gate.log` (exit line recorded in the PR body). Previous: exit=0 on c9bdde8 (`prompt-gate.log`), exit=0 on d7b59d6 (`translate-ai-gate.log`).
- Unit tests 1124/1124. Lint 0 errors (24 known warnings). `tsc --noEmit` clean.
- Controller clean-clone checks: prp2 at d7b59d6 exit=0; c9bdde8 check run by the controller.
- workers.dev after deploy (controller, 2026-10-20 23:29 CET): `/en`, `/ar`, `/en/auth` 200; `/` 307 → `/en`; bindings list includes env.AI and env.NEXT_CACHE_DO_QUEUE.

## Not verified

- A real admin save on workers.dev (would write a live row + rate_limits + audit rows: needs Koss's word; Step 32 covers the one approved write).
- Media Worker on R2 (Step 28 production stop), copy run and verify (Steps 25-29), flag-on build (Step 30).
- CPU per route on Workers Free (Task 4 / 02-21), real presigned PUT, real Turnstile siteverify on contact/newsletter.
- Real Safari playback, Arabic/RTL layout of the upload zone and Turnstile placement, a file near 50 MB.
- `check-revalidate` (needs a signed-in cookie).

## Remaining runbook steps and owners

| Step | What | Owner | State |
|------|------|-------|-------|
| 1-12, 13-18, 20, 21 | login, subdomain, R2, buckets, CORS, D1, env file, Turnstile widget, first deploy, secrets | Koss / controller | done (2026-10-20) |
| 19 | Google key | — | removed (Workers AI) |
| 22 | Web Analytics site | Koss | optional, skipped unless Koss asks |
| 23 | Supabase redirect allow-list for `https://clickit.clickitstory.workers.dev/**` | Koss (dashboard) | done 2026-10-21: Redirect URLs exactly www/**, apex/**, workers.dev/**; 12 Vercel URLs removed; Site URL stays www |
| P3-pre-max-rows | live PostgREST Max rows ≥ 1000 | Koss | done 2026-10-21: 1000 |
| 24 | secret names read-back | controller | done (2026-10-21 12:3x CET): CRON_SECRET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY; no Google key |
| Task 4 (02-10) | wrangler tail + CPU sample on /en, /ar, /en/auth | C | done 2026-10-21 on d7b59d6: EARLY STOP, p95 CPU 940 / 117 / 386 ms (Free limit 10 ms); numbers in 02-SPIKE.md; Step 33 now due |
| 25-27 | copy credentials, dry-run, execute copy (reads Supabase Storage, writes R2) | Koss | open (R2 already holds a verified copy from #24; re-sync only with `npm run r2:media -- --refresh` then `--execute`) |
| 28 | deploy media Worker (`--env r2` flips production media: stop first) | controller, Koss's word | open |
| 29 | verify every object on the media host | Koss or controller | open |
| 30 | workers.dev build with media on R2 ("flag on workers.dev") | controller, Koss's word | open |
| 31 | name the draft test show (read only) | Koss | open |
| 32 | approve the single live write of Phase 2 (draft show poster) | Koss | open |
| 33 | Workers plan decision (priced question) | Koss | DECIDED 2026-10-21: "Stay Free, do the rebuild" (signed-out 02-21 pass failed every route, 02-CPU-REPORT.md). The caching rebuild belongs to session "Clickit /en CPU" on its own branch, PR to main after #29 |
| 34 | approve the measurement sign-ins (before 31-32) | Koss | WAITS for the rebuild to land (measuring now would measure code about to change) |
| 02-21 rest | signed-in rows, media Worker rows, local cron estimate | C or the rebuild session | WAITS for the rebuild to land |
| 02-22 | gate, coverage, UAT (below), teardown | C + Koss (UAT) | open |
| P3-8b | R2 upload sweep (uploads never finalised, Koss Option B): weekly `cleanup-media` dry run, then `R2_UPLOAD_SWEEP_DELETE` "off" → "on" | Koss's word, controller deploys with `--allow-upload-sweep-delete` | built 2026-10-21, ships "off" (dry run); flip after P3-8 and one read dry-run report (runbook P3-8b) |

Notes:
- CPU / cache / layout code belongs to the "Clickit /en CPU" session from 2026-10-21; this session (C) does not edit it. d43fd90 (locale-root 308) stays as it is. The Phase 3 cutover is gated on every public route measuring under 10 ms CPU (Workers Free) after the rebuild.
- Cron placeholder (controller, 2026-10-20): PR #27 (Phase 6) adds `/api/cron/youtube-recheck`, which needs a daily Worker cron trigger. Whichever of Phase 2 / Phase 6 lands second wires it: one entry in `src/server/cron-schedule.ts` (cron map) plus the trigger in `wrangler.jsonc` `triggers.crons` at the Phase 3 cutover (crons stay `[]` until then). Phase 2 does not edit Phase 6 files.
- PRs #27 (Phase 6) and #28 (Phase 4) landed on main (6d748ff, 9225d04) and are merged into this branch (f767ae7, 2026-10-21).
- Phase 6 hand-offs to Phase 2: (b) the `youtube-recheck` route uses `cronAuthOk` and (c) `30 1 * * *` is in `CRON_ROUTES` (2026-10-21; `triggers.crons` stays `[]` until P3-8, which now lists all three). (a) done 2026-10-21 (Koss: go): `src/server/youtube/rate-limit.ts` now runs on `decideRateLimit` with the shared store, same keys and limits, fail closed (the four admin YouTube limits were fail open before); TODO removed. `src/server/youtube/bearer.ts` is now unused by the route (kept with its test).
- Uploads never finalised (Koss chose Option B, 2026-10-21): swept by the weekly `cleanup-media` cron, after the rate_limits prune and before the Supabase sweep, fail-soft, reported as `r2UploadSweep` in every response. Minted upload keys only, older than 24 h (object `uploaded` and the key's mint time), no live reference (a failed reference read deletes nothing); variants go with their original, `_v/` variants of copied Supabase objects are never touched. Dry run unless `R2_UPLOAD_SWEEP_DELETE` is exactly "on"; deletes through `deleteIfUnreferenced` (references re-read right before). Runbook P3-8b.
- Open decisions: pr-gate.yml triggers vs rule 4 (Phase 1 file); Phase 3 Q1-Q4 in `03-CUTOVER-DRAFT.md`.

## Pending Koss signatures (copy)

- Arabic for: `turnstile.checkFailed` ("Security check failed. Please try again."), the 02-11 rate-limit and "temporarily unavailable" lines, the 02-17/02-18 upload texts (progress, Retry, refused, Safari note, "Saving…", "Upload an MP4 video.", not-fast-start sentence, "Checking fast-start…", "MP4, fast-start, under 50MB").
- Arabic for the conflict line ("This item changed while you were saving. Reload and try again."), "Missing or invalid updated_at.", "Could not read every media reference".
- Wording for the hero ">8 MB" warning that still mentions Supabase egress (deferred item 13).
- Arabic for `admin.settings.legalArReviewedLabel` "Arabic reviewed" (legal editor checkbox, item 12): `ar.json` holds the English until signed, as with `turnstile.checkFailed`.
- Admin server error (English, like the other admin action errors): 'Add the Arabic text before ticking "Arabic reviewed".'
- Wording: `admin.settings.legalContentArHint` / `legalTitleArHint` still say "Leave blank to fall back to English"; with item 12 a blank Arabic field gets an AI draft and /ar shows English until reviewed. New EN + AR wording needs Koss.

## UAT (numbered, after 02-10..02-20 owner steps; on workers.dev)

1. Open `https://clickit.clickitstory.workers.dev/en` → home renders, images load from the media origin.
2. Open `/en/auth`, sign in with a real account → Turnstile widget above the button, button enabled after the check, signed in.
3. Open a show, pick an episode → YouTube player plays; progress saved after reload.
4. Admin: `/en/admin/settings`, change the tagline, Save → toast "Site metadata saved"; reload shows it.
5. Admin: upload a PNG artwork to a draft show → yellow progress zone, then the image shows from the media origin; Save.
6. Admin: upload an SVG → refused toast, nothing saved.
7. Admin: upload a fast-start MP4 hero to a draft show → progress, plays; a non-fast-start MP4 → refused, nothing saved.
8. `/en/auth/sign-in` → 404 page. `/` → redirects to `/en`.
9. Admin: save a show with an empty Arabic title/description → saved; Arabic description filled; if any field could not be filled, warning toast "Saved. N Arabic field(s) could not be translated automatically; fill them in by hand."
10. Cron: `curl -s -o /dev/null -w "%{http_code}" https://clickit.clickitstory.workers.dev/api/cron/publish-scheduled` → 401 (no secret).
11. (after the item 12 migration is applied) Admin: Settings → Legal pages → edit "Terms of Use", empty both Arabic fields, leave "Arabic reviewed" unticked, Save → saved; reopen: the Arabic fields hold an AI draft. Open `/ar/terms` → English text.
12. Same page: correct the Arabic draft, tick "Arabic reviewed", Save; open `/ar/terms` → the Arabic text. Change one English word only, Save; reopen → box unticked, Arabic re-drafted; `/ar/terms` → English.
13. Two tabs on Admin → Categories, edit the same category in both, Save tab 1, then Save tab 2 → tab 2 shows "This item changed while you were saving. Reload and try again." and nothing is written.
