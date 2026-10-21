# Roadmap: Clickit Story (CIT)

## Overview

The live app at www.clickitstory.ae cannot deploy on Vercel, so no code reaches production until a Cloudflare Worker serves the domain. The order is risk-first. First come the changes that can ship while Vercel still serves: migration safety and CI. Next, the Worker and the R2 media path are proved on workers.dev, and every image is copied to R2. Then the cutover happens: the DNS zone and Resend mail domain, the media domain, www, the database URL rewrite, the proof window, and finally the Vercel project is deleted. After the cutover come design (signed before any customer-facing screen is built), accounts and email, YouTube import and the player, product completeness with search and Arabic RTL, and finally hardening and the owner-gated contract cleanup once the proof window ends. Supabase stays the system of record throughout, and the live database is never wiped.

**Owner-gated convention:** a step marked **[OWNER]** is done by Koss himself, as one numbered step, and the work waits for him. Such steps are never autonomous. They cover DNS and registrar changes, secrets and key rotation, live database writes and deletes, the Vercel and Cloudflare dashboards, Supabase dashboard settings, emails to real people, any pricing or plan change, and every Ship.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Safe Ground** - Migrations can't harm live, CI gates every PR, the stray nameservers are explained (all of it ships while Vercel still serves)
- [ ] **Phase 1.1: Admin Actions Hardening (INSERTED)** - Every admin server action validates input, scopes ids, audits destructive writes and fails whole or not at all
- [ ] **Phase 2: Worker and R2 Media on workers.dev** - The full app runs on Cloudflare Workers with gates, cache, crons (off until cutover), Turnstile, analytics and direct-to-R2 uploads, every image copied to R2 optimized, Vercel code removed, proved on workers.dev
- [ ] **Phase 3: Production Cutover** - Zone and Resend DNS on Cloudflare, www and the apex served by the Worker, media URLs rewritten to R2, rollback open through the proof window, then the Vercel project deleted
- [ ] **Phase 4: Design System Truth** - Tokens, DESIGN.md and a Claude Design canvas match the live look and are signed by Koss before any new screen is built
- [ ] **Phase 5: Accounts and Email** - Sign-up wall, email-code sign-in, two TOTP admins, branded auth and app emails through Resend and a queue
- [ ] **Phase 6: YouTube Import and Player** - A whole season imports from one playlist link, and the player resumes each episode and follows YouTube's embed rules
- [ ] **Phase 7: Product Completeness, Search and Arabic** - Every shown control works, search covers EN+AR, and the full viewer UI is correct in Arabic RTL
- [ ] **Phase 8: Hardening and Contract Cleanup** - E2E coverage, dead code gone, no Vercel trace left, CSP tightened, Supabase Storage emptied after the proof window

## Phase Details

### Phase 1: Safe Ground
**Goal**: Nothing pushed to main can damage the live database, every PR is gated, and the owner of the stray Cloudflare nameservers is known before any NS change. No downtime, and Vercel keeps serving. (The zone move and Resend DNS moved to Phase 3, signed by Koss 2026-10-20.)
**Depends on**: Nothing (first phase)
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05
**Success Criteria** (what must be TRUE):
  1. A PR that adds `drop`/`truncate`/`delete` to a migration, or fails lint, typecheck, unit tests or the build, shows a red check and cannot merge. A clean PR shows green.
  2. The live migration history matches the files. The destructive first migration and the seed migrations are no-ops in place. A live push runs only after Koss approves a CI dry-run.
  3. A recorded read-only live audit exists. It covers applied migrations vs files, the `is_admin` source used by RLS, every media-URL column, and the Supabase plan and backups. The owner of the stray `ignat`/`nataly` nameservers is found or ruled out (closed 2026-10-20 by the NS move: registry lists only jen/brett; ignat/nataly serve the same zone — `01-LIVE-AUDIT.md` §6).
**Owner-gated**: [OWNER] Supabase plan/backup check in the dashboard; [OWNER] approve each live migration dry-run.
**Note**: SAFE-01, SAFE-02 and SAFE-04 must close before Phase 3's live migrations; SAFE-05 must close before Phase 3's NS change. SAFE-03 (CI) does not block Phase 2.
**Research flag**: Find who owns the NS pair.
**Plans**: 4 plans (3 waves)

Plans:
- [x] 01-01-PLAN.md — W1: migration guard script (scanner, applied-file rule, blob-SHA allow-list) + fixture tests + typecheck/guard scripts
- [x] 01-02-PLAN.md — W2: PR gate workflow (gate + migration-guard) and hand-started dry-run → approved apply workflow + text tests
- [x] 01-03-PLAN.md — W2: neutralise DROP block and seed migrations, seed.sql + seeding on, scratch-DB proof, allow-list SHAs pinned
- [x] 01-04-PLAN.md — W3: controller runbook (environments, secrets, ruleset, backup, first dry-run), full gate, hand-over, PR

### Phase 1.1: Admin Actions Hardening (INSERTED)
**Goal**: Every admin server action in `src/app/[locale]/admin/actions.ts` validates its input with a schema, scopes ids to their parent, leaves an audit row for each destructive or renumbering write, and fails whole or not at all. Source: two read-only agent audits of all 66 actions (50 confirmed findings: 2 high, 19 medium, 29 low); see `.planning/research/ADMIN-ACTIONS-AUDIT-DRAFT.md`.
**Depends on**: Phase 1
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Decisions locked**: new SVG uploads are rejected (raster only: PNG, WebP, AVIF; JPEG for OG, auth and social images; ICO for the favicon, amended by Koss 2026-10-11; stored SVGs untouched); permanent delete requires archived first; atomicity by app-level ordering and compensation, no migration.
**Success Criteria** (what must be TRUE):
  1. A conflict-restore call with a zero, negative, fractional or NaN episode number, or an episode id from another show, is refused and changes nothing. Every restore and renumber writes an audit row.
  2. `updateSeason` and `updateEpisode` reject malformed payloads, and every action taking an id rejects non-UUIDs; `direction` and hero `variant` reject values outside their enums.
  3. `deleteShowPermanently` and `deleteEpisodePermanently` refuse an item that is not archived; `deleteSeason`, `updateSeason` and `removeHeroVideo` leave an audit row.
  4. A forced failure midway through `updateShow`, `archiveShow`, `restoreShow`, `applyShowSchedule`, `reorderEpisode` or a conflict restore leaves the data as it was before the call, and the error is returned, not swallowed.
  5. An SVG upload is refused; a hero video over 50MB is refused on the server whatever size the client reports; saving the top ticker never stores English text in an Arabic field.
  6. Each failing input above has a unit test that failed before the fix. Lint, typecheck, unit tests and build pass.
**Owner-gated**: [OWNER] UAT; [OWNER] Ship. No live database change and no migration.
**Research flag**: None; findings carry line numbers (they drift).
**Plans**: 13 plans (6 waves)

Plans:
- [x] 01.1-01-PLAN.md — W1: pure schemas and guards (ids, direction, hero variant, fixes, rename, season/episode update, requireArchived)
- [x] 01.1-02-PLAN.md — W1: fake Supabase, ports, compensation runner, strict audit, counts, show namespace helpers
- [x] 01.1-03-PLAN.md — W1: media guards (SVG reject, hero size), strict Arabic translation, ticker fill
- [x] 01.1-04-PLAN.md — W2: UI: delete only on archived items (D-08), SVG-free pickers, ticker warning toast
- [x] 01.1-05-PLAN.md — W2: archive/restore/conflict-restore core with tests
- [x] 01.1-06-PLAN.md — W2: show writes core (category sync, archive-first delete, reorder)
- [x] 01.1-07-PLAN.md — W2: season and episode create/update/delete core
- [x] 01.1-08-PLAN.md — W2: episode archive/restore/delete/reorder core
- [x] 01.1-09-PLAN.md — W2: bulk schedule and unschedule core
- [x] 01.1-10-PLAN.md — W3: wire shows, categories, toggleFeatured into actions.ts
- [x] 01.1-11-PLAN.md — W4: wire seasons, episodes, scheduling into actions.ts
- [x] 01.1-12-PLAN.md — W5: hero video, SVG, ticker, remaining id validation in actions.ts
- [x] 01.1-13-PLAN.md — W6: gate, 21-finding coverage, [OWNER] UAT on a local stack
**Overlap note**: Phase 2 criterion 4 (SVG sanitised or rejected) is met here by rejecting SVG.

### Phase 2: Worker and R2 Media on workers.dev
**Goal**: The complete app runs on Cloudflare Workers (OpenNext, ClickitStory account, Next 16.4.1+) at its workers.dev URL with the same behaviour viewers and admins have today. Every image and video is copied to R2, optimized, and served by the media Worker. Media uploads go straight to R2, and the Vercel code is gone, so nothing blocks the cutover.
**Depends on**: Phase 1.1 (merged to main)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, PLAT-08, PLAT-09, PLAT-10, MEDIA-01, MEDIA-03, MEDIA-04, MEDIA-05, MEDIA-06
**Success Criteria** (what must be TRUE):
  1. On workers.dev, these route checks pass: a signed-out visitor is sent to sign-in from every gated page, a non-admin is refused `/admin`, and coming-soon mode and locale routing behave as they do on the live site. The gate suite passes (the `proxy.ts` spike runs first; the fallback is edge `middleware.ts`).
  2. An admin edit made on workers.dev is visible to a viewer within 10 seconds. The scheduled-publish and media-cleanup crons run from Cron Triggers when triggered (cleanup stays off for Supabase originals); they are deployed switched off and turned on at the Phase 3 cutover. Rate limits key on `CF-Connecting-IP`, fail closed, and compare the cron secret in constant time.
  3. Sign-in, sign-up, contact and newsletter show Turnstile, and a request without a valid token is refused. Cloudflare Web Analytics records page views. BotID and the Vercel analytics and speed-insights packages are gone.
  4. An admin uploads artwork, an avatar and a site asset, and each goes from the browser straight to R2 and displays from the R2 media origin (the media Worker on workers.dev now; `media.clickitstory.ae` after Phase 3). An SVG upload is rejected. Every existing Supabase Storage object is in R2 with matching checksums and optimized WebP/AVIF copies; a missing copy falls back to the original, never to a broken image. Hero videos play as fast-start MP4 on Safari, Chrome and mobile.
  5. CPU per page is measured on Workers Free and recorded. Deploys run with local wrangler from the control session after `npm run gate:local` passes and Koss says Ship; `wrangler whoami` shows the ClickitStory account first. No Vercel artefact remains in the repo.
**Owner-gated**: [OWNER] create the R2 and D1 resources in the ClickitStory account (never the default wrangler login); [OWNER] set the Worker secrets and the Turnstile keys; [OWNER] run the media copy; [OWNER] if pages fail on Free, decide on Workers Paid ($5/mo); [OWNER] UAT on workers.dev. (Media custom domain and Supabase CAPTCHA moved to Phase 3; Queue to Phase 5; no GitHub Environment; Image Transformations not used. Signed by Koss 2026-10-20.)
**Research flag**: done (02-RESEARCH.md, 2026-10-20).
**Phase 6 hand-off**: `src/server/youtube/rate-limit.ts` — replace the `withinRateLimitCore` stand-in with `decideRateLimit` from `src/server/rate-limit-policy.ts` (used by the viewer error report and the YouTube key save).
**Phase 6 hand-off**: `src/app/api/cron/youtube-recheck/route.ts` — swap the inline `Bearer <CRON_SECRET>` check for `cronAuthOk(header, secret)` from `src/server/cron-auth.ts` (constant time).
**Phase 6 hand-off**: `src/app/api/cron/youtube-recheck/route.ts` — register the `30 1 * * *` trigger for `/api/cron/youtube-recheck` in `CRON_ROUTES` (`src/server/cron-schedule.ts`) and in `wrangler.jsonc` `triggers.crons` (deployed switched off like the other crons).
**Plans**: 22 plans (11 waves; run one plan at a time, never two builds at once). Proposed roadmap/requirement edits 1-9 are in 02-CONTEXT.md, not applied until Koss signs them (plan 02-05).

Plans:
- [x] 02-01-PLAN.md — W1: Local spike: 01.1 precondition, [OWNER] package check, Next 16.4.2 + OpenNext 1.20.12 upgrade, base wrangler/OpenNext config, account guard, proxy.ts preview check, bundle/startup, cron URL
- [x] 02-02-PLAN.md — W2: Runbook upkeep and the R2 CORS rule builder
- [x] 02-03-PLAN.md — W2: Media Worker clickit-media (Range/206, 304, ETag, AVIF/WebP negotiation, original fallback, allowlist, SVG CSP)
- [x] 02-04-PLAN.md — W2: Pure security helpers: constant-time cron auth, cron map, CF-Connecting-IP, fail-closed rate limit, Turnstile siteverify
- [x] 02-05-PLAN.md — W1: [OWNER] Mockups signed (Turnstile placement, upload states) + roadmap edits 1-9 signed and applied as a planning note
- [x] 02-06-PLAN.md — W3: Build targets, stamp and deploy guard, cf:* scripts, .env.example
- [x] 02-07-PLAN.md — W3: Worker port: scheduled() to cron routes, bindings accessor, _headers, site-url without Vercel fallbacks, check scripts
- [x] 02-08-PLAN.md — W3: Copy script: dry-run report, sharp WebP/AVIF variants, faststart remux, idempotency, checksum reports, verify-every-object script
- [x] 02-09-PLAN.md — W3: Custom next/image loader and media-origin rules, next.config images
- [ ] 02-10-PLAN.md — W4: Remote spike: [OWNER] account resources, [CONTROL] first workers.dev deploy, secrets and dashboards, early CPU sample
- [x] 02-11-PLAN.md — W3: Turnstile server side, fail-closed limiter, captchaToken on auth actions, BotID removed from server and proxy
- [x] 02-12-PLAN.md — W4: Upload infrastructure: kinds, magic bytes, aws4fetch presign, finalize with delete-on-failure
- [x] 02-13-PLAN.md — W4: Turnstile widget on sign-in, sign-up, reset, contact, newsletter as signed; BotID client removed
- [x] 02-14-PLAN.md — W5: Vercel code removal, CSP builder, Cloudflare Web Analytics beacon, no-vercel test
- [x] 02-15-PLAN.md — W5: Image finalize core and actions (artwork, site image, social icon, cast, avatar)
- [x] 02-16-PLAN.md — W6: Video finalize on R2 (hero, preloader, show) with fast-start and audio checks
- [x] 02-17-PLAN.md — W6: Browser image uploads direct to R2 with WebP variants and the signed UI
- [x] 02-18-PLAN.md — W7: Browser video uploads direct to R2 with the signed UI
- [x] 02-19-PLAN.md — W8: Old upload actions, sharp, S3 SDK and r2-media removed from request paths; bodySizeLimit 2mb
- [ ] 02-20-PLAN.md — W9: [OWNER+CONTROL] Code-complete deploy, media Worker deploy, copy, verify, flag-on workers.dev build
- [ ] 02-21-PLAN.md — W10: [OWNER] Per-route CPU on Workers Free, 02-CPU-REPORT.md, stop rule with priced question
- [ ] 02-22-PLAN.md — W11: Gate and coverage, [OWNER] UAT (local preview write paths; workers.dev reads, sign-in, one approved draft write), teardown
**UI hint**: yes

### Phase 3: Production Cutover
**Goal**: clickitstory.ae is a zone in the ClickitStory Cloudflare account that Resend can send from. Viewers at www.clickitstory.ae and the apex are served by the Worker. Every media URL in the database points at R2, the old Vercel deployment can no longer write to live data, rollback stays possible until the proof window ends, and then the Vercel project is deleted.
**Depends on**: Phase 2
**Requirements**: DNS-01, MAIL-02, DNS-02, DNS-03, DNS-04, MEDIA-02, MEDIA-08, PLAT-11
**Success Criteria** (what must be TRUE):
  0. Before the flip: `dig NS clickitstory.ae` against every `.ae` registry server returns only the ClickitStory Cloudflare pair, www stays up throughout the move, and Resend shows clickitstory.ae verified with a test send passing SPF, DKIM and DMARC.
  1. Opening https://www.clickitstory.ae and the apex returns `server: cloudflare` with real HTML. A real account can sign in and play an episode on the live domain.
  2. The Vercel crons were off before the flip, and no Vercel cron runs against live Supabase afterwards. The service-role key in use is the newly rotated one.
  3. Every object copied in Phase 2 still matches its checksum (re-run for any delta). A backup/mapping table exists. A DB-wide search finds zero old-host media URLs, and every image and video on the live site loads from `media.clickitstory.ae`.
  4. A written rollback path to Vercel exists and stays usable until Koss closes the proof window.
  5. After Koss closes the proof window, the Vercel project and its domain are deleted, last, and the live site keeps working.
**Owner-gated**: [OWNER] add the zone and re-create the records DNS-only; [OWNER] change the NS at tasjeel.ae (after SAFE-05); [OWNER] add the domain in Resend (on his Pro account) and set the DNS records; [OWNER] attach media.clickitstory.ae; [OWNER] run the expand migrations on live after a dry-run; [OWNER] switch off the Vercel crons and env in the Vercel dashboard; [OWNER] enable Supabase CAPTCHA; [OWNER] switch on the Worker crons; [OWNER] attach the Worker custom domain to www and the apex; [OWNER] approve the live URL rewrite; [OWNER] rotate the Supabase service-role key; [OWNER] close the proof window; [OWNER] delete the Vercel project and domain (last); [OWNER] Ship.
**Plans**: TBD

### Phase 4: Design System Truth
**Goal**: One signed design truth (LBC, #ffcc00, #090909, 8px field/base radius, pill controls) exists in tokens, docs and a Claude Design canvas before any new viewer, admin or email screen is coded.
**Depends on**: Phase 3 (the design work itself can start in parallel with Phases 2-3; code ships after the cutover)
**Requirements**: DS-01, DS-02, DS-03, DS-04
**Success Criteria** (what must be TRUE):
  1. DESIGN.md and `/admin/design-system` show the live look: LBC, #ffcc00 accent, #090909 surfaces, an 8px field/base radius and pill controls. No indigo-era values remain.
  2. A search of `src/` finds no hard-coded hex colours or arbitrary radii outside the token files, and one brand-colour map serves the whole app. The live site looks unchanged.
  3. The Claude Design canvas shows foundations, viewer screens (including the OTP sign-in, the RTL treatment and an RMF-compliant player), admin screens (playlist import preview, inbox) and the email templates. Koss has signed it.
  4. A signed-out visitor or a non-admin viewer opening `/admin/design-system` is refused.
**Owner-gated**: [OWNER] sign the canvas (it blocks UI build in Phases 5-7); [OWNER] Ship.
**Plans**: 14 plans (10 waves). Owner-visible and codemod plans open with a 04-GATE.md answer check (stop on any B; Q7 must read C); 04-09 and 04-13 carry the codemod answer check and 04-10 to 04-12 inherit it through depends_on. Same-wave plans run one after another in this one branch. Every wave closes with a heavy-locked gate:local.
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md — W1: [Q1/Q2/Q3] merge main; named radius/shadow/status + exact-value tokens; design-truth.ts; email-tokens.ts (Q7 = C); cn(); pin tests
- [x] 04-02-PLAN.md — W2: ESLint rule clickit/no-raw-design-values (warn) + fixtures + baseline inventory
- [x] 04-03-PLAN.md — W3: [Q4] one brand map (D-04); consumers; parity test; gate (W1-W3)
- [x] 04-04-PLAN.md — W4: [Q1/Q2/Q5] admin-only /admin/design-system page, sidebar link, EN+AR copy, access pins
- [x] 04-05-PLAN.md — W4: [Q1/Q3] D-03 snaps (select at /98, toaster, /portfolio CTA) + D-01 literals
- [x] 04-07-PLAN.md — W4: [Q1/Q2/Q6/Q8, Q7=C, Q9=yes; orchestrator] canvas spike + Foundations + Viewer boards
- [x] 04-06-PLAN.md — W5: [Q1/Q2/Q4/Q5, Q7=C] DESIGN.md (+ two-scheme email tokens) + parity test; wording; 04-P6-ADDENDUM.md; gate (W4)
- [x] 04-08-PLAN.md — W5: [orchestrator] canvas Admin boards + Email boards from Phase 5's signed picture (both schemes)
- [x] 04-09-PLAN.md — W6: [Q1/Q2] merge main; codemod 1/5 (UI primitives, chrome); gate (W5-W6)
- [x] 04-10-PLAN.md — W7: codemod 2/5 (show cards, home, browse, series)
- [x] 04-11-PLAN.md — W7: codemod 3/5 (watch, shorts, landing, support, coming-soon, lib gradients)
- [x] 04-12-PLAN.md — W8: codemod 4/5 (viewer routes, loading skeletons); gate (W7-W8)
- [x] 04-13-PLAN.md — W9: [Q1/Q2/Q3] codemod 5/5 (admin + admin.css), rule to error, banned-literal tests, ledger; gate
- [x] 04-14-PLAN.md — W10: [orchestrator] reviewer pass on board legends, [OWNER] four signatures (D-08); final gate

Deferred (not a Phase 4 plan): After Phases 5–6 ship, a separate job moves the proven Clickit patterns into Loomlyne/ui-system as general components, its own repo PR (Koss, 2026-10-20 18:45 CET): playlist import preview, 6-digit code boxes, up-next bar, key field with the right-side eye, status chips, skeletons, the admin TOTP page. Not a Phase 4 plan; the UI System repo is not changed in Phase 4.

### Phase 5: Accounts and Email
**Goal**: Only signed-in viewers get past the landing and legal pages. Viewers can join or sign in with a 6-digit email code or a password. Both admins work under their own TOTP-protected accounts, and every auth and app email arrives branded from `Clickit Story <no-reply@clickitstory.ae>`, once, in the viewer's language.
**Depends on**: Phase 4
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, MAIL-01, MAIL-03, MAIL-04, MAIL-05, MAIL-06, MAIL-07
**Success Criteria** (what must be TRUE):
  1. A signed-out visitor can open only the landing page and the legal pages, and every other page sends them to sign-in. A never-seen email address can create an account and sign in with a 6-digit code (pasted, auto-filled, or typed as Arabic-Indic digits). Email and password still work, and a password can be added later from the profile.
  2. Password reset, email confirmation and email change all succeed when the link is opened on a different device from the one that asked for it. Every auth email arrives from `Clickit Story <no-reply@clickitstory.ae>`, branded, in EN or AR to match the viewer.
  3. Issam and Nejib each sign in to their own admin account, pass an authenticator-app code to enter `/admin`, and see every admin function. The audit log names which admin made each change. Leaked-password protection is on, and the anon-callable YouTube-ID function no longer answers anonymous calls.
  4. A new viewer gets exactly one welcome email. A support message produces an auto-reply to the sender and an admin copy they can reply to. A newsletter sign-up is active only after the confirmation link is clicked.
  5. A viewer with a show on My List gets one Dubai-evening digest when new episodes publish, can turn it off in the profile, and can unsubscribe with one click from the email. A retried or failed send never duplicates and is retried from the queue.
**Owner-gated**: [OWNER] set Supabase custom SMTP to Resend, the email templates (Confirm signup and Magic Link included), the OTP expiry and the auth email rate limit; [OWNER] turn on leaked-password protection; [OWNER] insert Nejib's admin row and enrol both TOTP devices; [OWNER] approve each live migration; [OWNER] approve the first emails to real users; [OWNER] Ship.
**Phase 6 hand-off**: `src/app/[locale]/admin/actions.ts` — swap `requireAdminForYouTube` for `requireAdmin()` (admins table + TOTP at `/{locale}/auth/mfa`; it accepts both admins, so Nejib can import); every YouTube action goes through that one function.
**Phase 6 hand-off**: `/Users/koss/.clickit-checks/phase06-uat-admin.cjs` (outside the repo) — replaced by `npm run seed:local-admin` (Phase 5), which also applies M2 locally; after Phase 5 lands, local admin pages ask for the TOTP code first.
**Plans**: TBD
**UI hint**: yes

### Phase 6: YouTube Import and Player
**Goal**: An admin puts a whole YouTube season on the platform from one playlist link, or adds one episode from one video link. Viewers switching episodes resume where they left off, in a player that follows YouTube's embed rules.
**Depends on**: Phase 1 and Phase 1.1 only, for execution. Plan gate G8 (Koss, 2026-10-20): Phase 6 runs in parallel with Phases 2-5, with `TODO(phase-N)` seams for the Phase 2 cron/rate-limit pieces, the Phase 4 tokens and the Phase 5 `requireAdmin` (table in 06-00). The live deploy (06-21 on) still waits for the Phase 2-3 Worker, because Vercel is frozen
**Requirements**: YT-01, YT-02, YT-03, YT-04, YT-05, YT-06, YT-07
**Success Criteria** (what must be TRUE):
  1. An admin pastes a playlist link and sees every video with its title, thumbnail, duration and status before importing. Private, deleted, non-embeddable and UAE-blocked videos are flagged and excluded. Imported episodes land as drafts. Importing the same playlist again adds nothing.
  2. An admin adds a single episode from a YouTube link, and an invalid or fake ID is refused by the server. The YouTube API key is stored only in Supabase Vault (service-role read), an admin can paste or change it in Settings and it works on the next request, and the old plaintext column is gone.
  3. A viewer watches part of episode A, switches to B, then back to A, and each resumes at its own saved position.
  4. Nothing is drawn over the playing video (the autoplay-next card sits off the player). Player chrome and captions follow the site language. A removed or blocked video shows a branded error state.
  5. Reordering episodes never leaves a gap or a duplicate, and a failed reorder shows an error.
**Owner-gated**: [OWNER] create the restricted YouTube API key and paste it in Admin › Settings on live, then Test key; [OWNER] rotate the old key; [OWNER] approve the migration that removes the DB key column copy; [OWNER] Ship.
**Plans**: 25 plans (11 waves, W0-W10)

Plans:
- [ ] 06-00-PLAN.md — W0: [BLOCKING] merge origin/main; Phase 1/1.1 present; no workflow applies migrations on push; record Phase 2-5 presence, admin mechanism, waiver; TODO(phase-N) table
- [ ] 06-01-PLAN.md — W1: migration 1 (expand + Vault key functions); Vault key resolver; rate-limit seam; controller local apply, Vault round trip + types under the lock
- [ ] 06-02-PLAN.md — W1: pure classifiers (error codes, urls, duration, status, script / needsEnglishTitle)
- [ ] 06-03-PLAN.md — W1: YouTube API client (header-only key, paging, batching, error mapping) with documented-shape fixtures
- [ ] 06-04-PLAN.md — W1: pure watch logic (resume, progress gate, ENDED_MODE 'bar' default, player errors, hidden-iframe predicate) and quota/clock helpers
- [ ] 06-05-PLAN.md — W1: every EN/AR string and the shared YouTubeStatusChip
- [ ] 06-06-PLAN.md — W2: playlist preview, import commit and single-video verify cores
- [ ] 06-07-PLAN.md — W2: renumber core and scheduler episode filter
- [ ] 06-08-PLAN.md — W2: re-check core, Can't-play rule, cron route on main's secret check (schedule: TODO(phase-2))
- [ ] 06-09-PLAN.md — W2: player plumbing (React-owned hidden wrapper, tracker gated on video id, status map read, viewer error report)
- [ ] 06-10-PLAN.md — W2: up-next bar (shipped default) and card alternative; branded error card
- [ ] 06-11-PLAN.md — W2: watch actions without toasts (revert + live region) and static episode list
- [ ] 06-12-PLAN.md — W2: import preview table and its pure row view
- [ ] 06-13-PLAN.md — W3: admin Server Action wrappers behind the requireAdminForYouTube seam (import, meta, verify on save, renumber, filtered schedule)
- [ ] 06-14-PLAN.md — W3: stacked watch shell, resume on switch, up-next bar / error wiring, no Toaster on /watch
- [ ] 06-15-PLAN.md — W4: single-link add via server action; shorts switch; delete /api/youtube-meta
- [ ] 06-16-PLAN.md — W4: editable Vault key field (save, •••• last4, Test key); remove the youtube_api_key write path
- [ ] 06-17-PLAN.md — W4: import side sheet (core, states, success), show-page entry, scheduler for the new drafts
- [ ] 06-18-PLAN.md — W5: admin arrows, Renumber 1 to N dialog, Can't play / Needs English marks, dashboard panel
- [ ] 06-19-PLAN.md — W5: remove old key reader and unused strings; ROADMAP Phase 8 drift
- [ ] 06-20-PLAN.md — W6: gate, hand-over, PR; [OWNER] create key; [OWNER] UAT on the local stack (key pasted in local Settings)
- [ ] 06-21-PLAN.md — W7: [OWNER] Ship; controller duplicate clear (D-22) then [OWNER] migration 1 on live; [OWNER] approve deploy after the Worker cutover
- [ ] 06-22-PLAN.md — W8: [OWNER] paste the key in live Settings + Test key; [OWNER] go for one real re-check
- [ ] 06-23-PLAN.md — W9: contract migration (drop youtube_api_key) in its own branch and PR
- [ ] 06-24-PLAN.md — W10: [OWNER] Ship the contract PR; [OWNER] approve the live apply; [OWNER] delete the old key
**UI hint**: yes

### Phase 7: Product Completeness, Search and Arabic
**Goal**: Every control shown in the app does what it says, viewers find any show or episode in English or Arabic, and the whole viewer UI is correct at `/ar` in right-to-left.
**Depends on**: Phase 6
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08, PROD-09, AR-01, AR-02, AR-03
**Success Criteria** (what must be TRUE):
  1. In Settings, turning the genres-grid, CTA or FAQ toggle on or off shows or hides that section on the live site. CTA copy and genre colours edited in Settings change the live site. An admin can delete a season after confirming, and can set a support message to New, Open, Resolved or Spam. Only real weekdays can be saved as broadcast days.
  2. Searching an English title, an Arabic title (with or without tashkeel or alef variants), or an episode name returns the right published shows and episodes.
  3. Reviews show the reviewer's name, and a viewer can edit and delete their own review. The shorts rail and overlay work with only one autoplaying player at a time.
  4. At `/ar`, rails, carousels, icons and forms mirror correctly and numbers show as ٠-٩, while the English UI shows 0-9. Lint fails on any new left/right-specific style.
  5. Production holds no picsum posters, test YouTube IDs or fake cast from Koss's approved list.
**Owner-gated**: [OWNER] approve the placeholder list, then the live delete (backed up, never a CI migration); [OWNER] approve the search migration on live; [OWNER] UAT the Arabic screens; [OWNER] Ship.
**Research flag**: Arabic Snowball stemmer and normalization against real titles.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Hardening and Contract Cleanup
**Goal**: The core journeys are protected by end-to-end tests, the codebase carries no dead code and no trace of Vercel, the CSP is tight, and after the proof window the old storage and the old host are gone.
**Depends on**: Phase 7, plus the end of the Phase 3 proof window
**Requirements**: QA-01, QA-02, QA-03, QA-04, MEDIA-07
**Success Criteria** (what must be TRUE):
  1. CI runs end-to-end tests for sign-in (password and code), browse, watch with resume, and admin playlist import, and they pass against a build of main.
  2. The repo has no unrendered components, unused queries, duplicate files, starter SVGs or stale Playwright specs. It also has no Vercel artefact: no `vercel.json`, `@vercel/*`, `botid`, `VERCEL_*` fallbacks, `.vercelignore` or `check-cron.sh`. CLAUDE.md, AGENTS.md, MEMORY.md and .hermes.md describe Cloudflare + Supabase.
  3. The live CSP has no wildcard image source, no `supabase.co`, `picsum` or `unsplash` hosts, and no script `unsafe-inline` where it can be avoided. The site still renders and plays.
  4. After Koss approves, Supabase Storage is empty. The live site keeps working, with every media URL on R2.
**Owner-gated**: [OWNER] close the proof window; [OWNER] approve the contract migration (drop `admin_user_id`; `youtube_api_key` is dropped in Phase 6); [OWNER] empty Supabase Storage; [OWNER] Ship.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Design work in Phase 4 may run in a worktree during Phases 2-3. Its code ships after the cutover.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safe Ground | 0/TBD | Not started | - |
| 1.1. Admin Actions Hardening (INSERTED) | 13/13 | UAT passed, PR open | - |
| 2. Worker and R2 Media on workers.dev | 18/22 | In Progress|  |
| 3. Production Cutover | 0/TBD | Not started | - |
| 4. Design System Truth | 14/14 | UAT pending (PR) |  |
| 5. Accounts and Email | 15/42 | In Progress|  |
| 6. YouTube Import and Player | 0/25 | Planned | - |
| 7. Product Completeness, Search and Arabic | 0/TBD | Not started | - |
| 8. Hardening and Contract Cleanup | 0/TBD | Not started | - |
