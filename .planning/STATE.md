---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-10-25T21:43:18.955Z"
last_activity: 2026-10-25
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 123
  completed_plans: 90
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-04)

**Core value:** A signed-in viewer opens a show and an episode from YouTube plays immediately, with progress remembered — and the admin can put a whole YouTube season on the platform from one playlist link.
**Current focus:** Phase 05 — accounts-and-email

## Current Position

Phase: 05 (accounts-and-email) — EXECUTING
Plan: 21 of 42 (waves 0-3 done; 05-13, 05-15, 05-16, 05-18, 05-38 done; 05-17 code done, seed run waits for controller go)
Status: Ready to execute
Last activity: 2026-10-25
Phase 2 (work branch claude/phase-02-execute-19d86a): 18 of 22 plans complete (02-10, 02-20, 02-21, 02-22 open); origin/main 4271179 (Phase 4 #28, Phase 6 #27) merged in 2026-10-21

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01.1 P05 | 20min | 2 tasks | 3 files |
| Phase 01.1 P07 | 25min | 2 tasks | 2 files |
| Phase 01.1 P08 | 20m | 2 tasks | 3 files |
| Phase 01.1 P09 | 20min | 2 tasks | 2 files |
| Phase 01.1 P10 | 25min | 3 tasks | 4 files |
| Phase 01.1 P11 | 30min | 3 tasks | 3 files |
| Phase 01.1 P12 | 40min | 3 tasks | 5 files |
| Phase 02 P02 | 15min | 2 tasks | 3 files |
| Phase 02 P04 | 20min | 2 tasks | 9 files |
| Phase 02 P08 | 80min | 3 tasks | 9 files |
| Phase 02 P09 | 15min | 2 tasks | 7 files |
| Phase 02 P11 | 35min | 2 tasks | 5 files |
| Phase 02 P12 | 100min | 3 tasks | 16 files |
| Phase 02 P13 | 150min | 2 tasks | 13 files |
| Phase 02 P14 | 70min | 2 tasks | 23 files |
| Phase 02 P15 | 55min | 2 tasks | 11 files |
| Phase 02 P16 | 90min | 2 tasks | 9 files |
| Phase 02 P17 | 215min | 2 tasks | 13 files |
| Phase 02 P18 | 150min | 2 tasks | 8 files |
| Phase 02 P19 | 55min | 2 tasks | 15 files |
| Phase 04 P01 | 25min | 3 tasks | 7 files |
| Phase 04 P02 | 12min | 2 tasks | 3 files |
| Phase 04 P03 | 15min | 4 tasks | 8 files |
| Phase 04 P04 | 15min | 3 tasks | 8 files |
| Phase 04 P05 | 8min | 2 tasks | 6 files |
| Phase 04 P06 | 5min | 4 tasks | 6 files |
| Phase 05 P01 | 25min | 2 tasks | 6 files |
| Phase 05 P02 | 10min | 2 tasks | 4 files |
| Phase 05 P03 | 10min | 2 tasks | 4 files |
| Phase 05 P04 | 15min | 2 tasks | 4 files |
| Phase 05 P05 | 2min | 2 tasks | 3 files |
| Phase 05 P06 | 12min | 2 tasks | 3 files |
| Phase 05 P07 | 14min | 4 tasks | 10 files |
| Phase 05 P08 | 25min | 2 tasks | 4 files |
| Phase 05 P09 | 8min | 2 tasks | 7 files |
| Phase 05 P12 | 35min | 3 tasks | 13 files |
| Phase 05 P10 | 25min | 2 tasks | 16 files |
| Phase 05 P14 | 5min | 2 tasks | 5 files |
| Phase 05 P11 | 28min | 4 tasks | 19 files |
| Phase 05 P15 | 4min | 2 tasks | 8 files |
| Phase 05 P16 | 25min | 2 tasks | 7 files |
| Phase 05 P38 | 20min | 2 tasks | 0 files |
| Phase 05 P17 | 25min | 2 tasks | 6 files |
| Phase 05 P18 | 4min | 2 tasks | 4 files |
| Phase 05 P29 | 25min | 2 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Risk-first order; 12 research phases compressed to 8 (safety + DNS/Resend merged; Workers port + R2 media merged; accounts + app email merged; completeness/search + Arabic merged). Cutover and design system kept as their own phases.
- [Roadmap]: Branded auth emails (MAIL-01) placed in Phase 5, after the signed design canvas, not in Phase 1 — design before code.
- [Roadmap]: PLAT-10 (Vercel removal) completes in Phase 8 because it includes deleting the Vercel project after the proof window; code-side BotID/analytics removal happens in Phase 2 under PLAT-05/PLAT-06.
- [Phase 01.1]: [01.1-05] Archive records previous_slug and archived_episode_ids in the audit log; restore uses newest committed record with legacy fallback
- [Phase ?]: 01.1-08: episode reorder uses atomic public.reorder_episode RPC; swap reversed via opposite direction if audit fails
- [Phase 01.1]: Unschedule trusts only the newest committed bulk_schedule record, validated by bulkScheduleRecordSchema; unreadable record is refused, no fallback
- [Phase 01.1]: runAdminAction revalidates in finally on success/wrote/throw; revalidate errors logged only
- [Phase 01.1]: Plan 11: revalidation show id comes from core result; client id only as UUID-checked fallback
- [Phase 01.1]: Hero cores share one tail: audit row written before staged media deletion commits; audit failure restores config and rolls back
- [Phase 02-01]: proxy.ts runs as the OpenNext Node middleware under local preview; no edge middleware.ts fallback needed
- [Phase 02-01]: Worker gzip bundle is 3079.28 KiB, 7 KiB over 3 MiB; confirm the real Free size limit at the plan 02-10 deploy
- [Phase 02-01]: react-hooks/set-state-in-effect set to warn after the eslint-config-next 16.4.2 bump; refactor deferred (phase 02 deferred-items.md)
- [Phase 02]: 02-02: R2 CORS builder refuses http, wildcard, path/query/hash and credentials; runbook Rule 5 lists the four owner-gated live-Supabase exceptions
- [Phase 02]: 02-08: the copy no longer rewrites the manifest (checksum report holds per-object state), so manifestSha256 stays stable for the deploy guard; write path guarded to the ClickitStory account and bucket clickit-media; sharp reads Buffers because libvips caches by file name
- [Phase 02]: 02-09: loader widths pinned to the Worker's VARIANT_WIDTHS by a drift test; remotePatterns dropped with the custom loader; loopback media origin (127.0.0.1 + ALLOW_LOOPBACK=1) never rewrites Supabase URLs; CSP img-src for loopback preview is left to 02-14
- [Phase 02]: 02-11: contact/newsletter refuse without a valid Turnstile token and a free fail-closed per-IP slot (IP folded into the rate_limits key); auth actions pass captchaToken to Supabase and never call siteverify; token is the last optional action argument (02-13 wires clients); no Arabic copy invented, messages keys deferred to Koss
- [Phase 02]: 02-12: presign uses aws4fetch allHeaders so Content-Type is really signed; finalize deletes only keys proven ours (kind/owner shape check first, variants only as _v/<w>/webp/<verified key>); keys are <stem>-<ts>-<rand>.<ext> so the old hero/preloader path regexes do not match (02-16 uses keyMatchesKind); local shim route checks the Host header and buffers the body, proven on preview
- [Phase 02]: 02-13: Turnstile on the five forms as signed (turnstile-A); token is the last action argument and captchaToken for the reset request; single-use token renewed by remounting the widget (React key, no ref); no site key means no widget and the server still refuses contact/newsletter; deploy guard stamp records the site key class and refuses test or missing keys; Arabic for turnstile.checkFailed pending Koss; BotID client code removed (package.json and next.config left to 02-14)
- [Phase 02]: 02-14: CSP is a pure tested builder (src/lib/csp.ts); loopback Supabase/media origins only for the preview target (CSP_UPGRADE_INSECURE=false); exact R2 S3 host in connect-src; Cloudflare Web Analytics beacon renders only with NEXT_PUBLIC_CF_BEACON_TOKEN (owner step); vercel.json, .vercelignore, check-cron.sh, botid and @vercel/* removed, VERCEL=1 cleanup fallback dropped, no-vercel guard test; storage-range-proxy Vercel header kept until Phase 3
- [Phase 02]: 02-15: image finalize core order is finalize, write one target, strict audit, then delete previous R2 object, with compensation on write and audit failure (tested); only R2 keys on our media origin are ever deleted, Supabase originals never; social icon and cast-without-member write no db row (form state until Save); artwork finalize has optional commit (default true) so 02-17 can keep the drawer's Cancel behaviour; avatar owner comes from the session
- [Phase 02]: 02-16: video finalize reads only the first 4 MiB (min of object size) and checks fast-start and, for hero only, the audio track with the pure box walker (no ffprobe on Workers); non-fast-start, oversize (50MB, preloader 20MB) and no-audio files are refused and deleted; 01.1 order kept (write, strict audit, then delete previous R2 object; Supabase originals never deleted); show finalize has commit (default true) so 02-18 can keep write-on-Save
- [Phase 02]: 02-17: every image upload goes browser -> requestMediaUpload -> XHR PUT with the signed Content-Type -> finalize*Upload; WebP copies (640/1280/1920, narrower than the source) are made in the browser only when canvas toBlob really returns image/webp, otherwise the original goes alone with the signed Safari note; progress zone and toasts as signed (option M); artwork and hero image finalize with commit:false so the drawer still writes on Save; hero-media-picker's image path switched too (02-18 only does its video path); admin actions return 500 on the Worker until 02-19 removes the sharp import (deferred item 10)
- [Phase 02]: 02-18: every video upload (hero desktop/mobile, preloader, show drawer) goes browser -> requestMediaUpload -> XHR PUT (video/mp4, signed Content-Type) -> finalize*VideoUpload through uploadVideoDirect; the show drawer uses commit:false (upload then Save); signed texts verbatim (Upload an MP4 video., the not-fast-start sentence, Checking fast-start…, helper line MP4, fast-start, under 50MB); the signed not-fast-start sentence replaces the server's text on the client; stale 8 MB 'Supabase egress' warning left for Koss's wording (deferred item 13)
- [Phase 02]: 02-19: no file under src/ imports sharp or @aws-sdk/* (guard test worker-request-paths in gate:local); old FormData and signed-upload actions and src/lib/r2-media* deleted; admin media deletion is R2-only (src/server/r2-delete.ts), no admin action or cron removes a Supabase original unless CLEANUP_SUPABASE_ORIGINALS=on; bodySizeLimit 2mb; sharp and S3 SDK are devDependencies; Worker preview serves all admin pages and a saved admin action with no stub; bundle 14,286 KiB raw / 2,936 KiB gzip
- [Phase 02]: 02-04: security helpers are pure with injected I/O; cron auth and rate limiter refuse on every uncertain path; Turnstile reasons are fixed codes that never echo secret or token
- [Phase 04-01]: Named shadows in @theme static (not self-referencing @theme inline); radius scale moved to @theme static with --radius-hairline; shadow-bar added for watch-shell
- [Phase 04]: Phase 04-03: Q4=A, category colours stay free content; Desert Sand (brand-yellow) is genre/category default only, shows keep 5 brand values
- [Phase 4]: Phase 4 Plan 04: admin design-system summary compares canonicalCssValue(live) with resolved signed values; fonts excluded from the count (next/font hashes the family)
- [Phase 05]: 05-01: db-proof.sh scratch bootstrap creates supabase_vault and mirrors default privileges; pre_*.sql fixtures run before supabase/pending
- [Phase 05]: 05-02: isPublicPath is one exact list plus slash-bounded prefixes (fails closed, /about walled); normalizeCode returns at most 6 ASCII digits, shared client/server; AUTH_LINK_MINUTES=15, RESEND_WAIT_SECONDS=60
- [Phase 05]: 05-03: isPwned races fetch against its own 3 s timer (fails open, null); decideAdminMfa accepts totp and mfa/totp, age 0..12 h inclusive, fails closed
- [Phase 05]: 05-04: confirm links must carry an expiry; link signatures must be canonical base64url; Mailer results carry only classification, never bodies or addresses
- [Phase 05]: 05-05: four episodes_view catalog reads use server-only createCatalogClient (service role, null + [] without key); AUTH-08 stays Pending until M3 revoke
- [Phase 05]: 05-06: Phase 5 message keys added once for all UI plans (signInToWatch/showChip absent, G4 B); EN/AR parity test with PHASE5_KEYS list; 0 pre-existing gaps; requirements stay Pending (copy only)
- [Phase 05]: 05-07: react-email 6.11.0 and @react-email/render 2.1.0 installed (planned 6.11.3/2.1.1 are under 14 days old); bump allowed from 2026-10-30
- [Phase 05]: 05-07: spike says pre-render (cold batch 29-41 ms vs 10 ms Free CPU, warm mean ~4.3 ms, gzip 266.56 KiB); controller to revise 05-11/05-19
- [Phase 05]: 05-08: processBatch is pure with ports claimOutbox/finishOutbox/render/mailer/now/log/unsubscribeUrl; DB write before ack; digest without a working unsubscribe link is never sent; not_configured retries are capped by MAX_ATTEMPTS (5) like any transient error
- [Phase 05]: 05-09: M1a = supabase/migrations/20261021142458_phase5_m1a_accounts.sql; admins created empty; backfills pause set_updated_at (if present) so updated_at versions do not move
- [Phase 05]: 05-09: db-proof.sh runs supabase/tests/pre_*.sql once just before the first _phase5_ migration
- [Phase 05]: 05-12: CodeField emits normalised value and clears/refocuses when error changes; password eye is right-0 inside a dir=ltr box (pinned by password-field.test.ts); auth.hidePassword added (Arabic wording for Koss to confirm); formatCountdown re-exports formatClock; ui/switch hand-written on radix-ui
- [Phase 05]: 05-10: auth templates are sentinels swapped for Go actions after render, locale branch wraps whole documents; production and local sets differ only in the logo URL; MAIL-01/AUTH-02/AUTH-04 stay Pending until 05-35/05-38
- [Phase 05]: 05-14: M2 and M3 staged in supabase/pending and proven by db-proof (pending_applied=2); 05-41 copies them byte for byte, 05-37 applies both in one approval
- [Phase 05]: 05-11: app emails pre-rendered at build into src/generated/app-email-templates.json (drift-tested); renderAppEmail fills escaped values in one pass, bundle 7 inputs / 9.1 KiB gzip; HTML byte-identical to the direct React path; MAIL-03..06 stay Pending until producers, queue and sends exist
- [Phase 05]: 05-13: M1b = supabase/migrations/20261021151843_phase5_m1b_email_outbox.sql, proven in db-proof (exit=0, negative runs fail as expected); sweep also re-enqueues expired 'sending' leases; build_digest and capped enqueue_email take advisory locks; support_admin mirror: any sent copy wins, never downgraded
- [Phase 05]: 05-13: src/lib/database.types.ts gets the scratch-DB types merged as additions only (223+/0-; live-only tables and __InternalSupabase kept); the live gen-types script is never run
- [Phase 05]: 05-15: requireAdmin() in src/server/auth-guards.ts is the one admin gate (getClaims+getUser, admins row every call, aal2 TOTP <= 12 h, fail closed); assertAdmin and requireAdminForYouTube call it; navbar uses am_i_admin()
- [Phase 05]: 05-16: enqueueEmail target { userId } | { adminAll: true } | { email } with optional locale en|ar; adminAll with zero admins returns queued with no ids and logs no_recipients; esbuild accepts the JSON template import, so no controller stop
- [Phase 05]: 05-38: local GoTrue renders English for a user with no locale (eq on missing .Data.locale is false, A6); local From is Clickit Story <no-reply@clickitstory.ae> (A9); a new user's sign-in code mail uses the confirmation template, magic_link only for confirmed users; read the code from the user-select:all cell; MAIL-01/AUTH-02 stay Pending until 05-35
- [Phase 05]: 05-17: seed:local-admin applies M2 locally via resolveM2Source (landed migration first, else pending) in one psql transaction through docker exec; first shared-stack run waits for the controller's go
- [Phase 05]: 05-18: proxy Step 5 is decideRoute (src/server/auth/gate.ts): admin path first (auth/watch/mfa/pass), then isPublicPath, then signed out -> auth; isAdmin = rpc am_i_admin only on /admin, fails closed
- [Phase 05]: 05-29: public email pages read state on GET and never write; core adds an 'error' result; MAIL-04 and MAIL-06 stay Pending until digest and newsletter sign-up land

### Pending Todos

None yet.

### Blockers/Concerns

- 05-13 Task 3 step 2 done 2026-10-21 15:29Z: shared supabase_db_Clickit now has M1a + M1b (migration up --local, exit=0).
- No code reaches production until Phase 3 (Vercel deploys are BLOCKED).
- Owner decisions pending (pricing, not assumed): Workers Paid $5/mo if Free CPU fails (Phase 2); Image Transformations stays on the free tier only.
- Stray Cloudflare NS pair (ignat/nataly) must be resolved before any NS change (Phase 1).
- Live migration state and `private.is_admin()` presence unverified — read-only audit in Phase 1 before any schema ship.
- 05-17 NEEDS CONTROLLER: go for npm run seed:local-admin applying supabase/pending/m2_admin_aal2.sql to the shared local stack (local admin pages then need TOTP)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261020-ej8 | Apply UI System ui.config.json tokens to Clickit | 2026-10-20 | 93e3a68 | [261020-ej8-apply-ui-system-ui-config-json-tokens-to](./quick/261020-ej8-apply-ui-system-ui-config-json-tokens-to/) |
| 261020-fnn | Media Worker for media.clickitstory.ae + media-health + DNS plan (job D) | 2026-10-20 | branch claude/media-worker-now-ea54d5 | [261020-fnn-media-worker-for-media-clickitstory-ae](./quick/261020-fnn-media-worker-for-media-clickitstory-ae/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| admin audit | uploadSiteImage / uploadSocialIcon write no audit row (favicon, OG, social icon uploads); found in 1.1 UAT step 14, not one of the 21 findings | open | 2026-10-20 (1.1 UAT) |
| i18n | `admin.seasonForm.addSeason` missing in en.json (raw key on Add Season button) | open | 2026-10-20 (1.1 UAT) |
| i18n | `siteTitleHint` "Shown in <title> ..." fails ICU parsing (INVALID_MESSAGE on Settings) | open | 2026-10-20 (1.1 UAT) |
| routing | /en/admin/shows (no index route) returns 500 "No intl context found" instead of 404 | open | 2026-10-20 (1.1 UAT) |
| local dev | CSP connect-src allows only https://*.supabase.co, so browser uploads to a local Supabase (127.0.0.1:55321) fail | open | 2026-10-20 (1.1 UAT) |
| admin atomicity | reorderCategories and reorderShort are not atomic (multi-row renumber without compensation) | open | 2026-10-20 (PR #23 review) |
| admin validation | youtube_video_id, image_url and expires_at are not validated in the shorts/cast actions | open | 2026-10-20 (PR #23 review) |
| admin media | uploadArtwork and uploadCastImage do not sniff image bytes (declared type only) | open | 2026-10-20 (PR #23 review) |
| admin perf | fillArabic has no cache (repeat translations of unchanged text) | open | 2026-10-20 (PR #23 review) |
| admin errors | raw Supabase error messages reach the admin UI; map them to plain messages | open | 2026-10-20 (PR #23 review) |
| admin tests | no export-level test that every server action calls assertAdmin (only per-action scans) | open | 2026-10-20 (PR #23 review) |
| admin design | app-level compensation instead of DB transactions (D-05): revisit with an RPC per multi-step write | open | 2026-10-20 (PR #23 review) |
| admin deletes | shorts, reviews, FAQs and legal pages still hard-delete with no archive-first rule (shorts already has an `archived` column); only the audit snapshot keeps the content | open | 2026-10-20 (PR #23 fix verification L4) |

## Session Continuity

Last session: 2026-10-25T21:43:15.551Z
Stopped at: Completed 05-29-PLAN.md (public unsubscribe and newsletter-confirm endpoints); 05-17 seed:local-admin run on the shared stack still waits for the controller's go; resume file .planning/phases/05-accounts-and-email/05-29-SUMMARY.md
Phase 2 last session: 2026-10-20T10:45:11.285Z
Phase 2 stopped at: Completed 02-19-PLAN.md (after 02-18) (phase 02 work branch claude/phase-02-execute-19d86a; Current Position above is the controller's)
Resume file: None
