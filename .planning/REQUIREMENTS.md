# Requirements: Clickit Story (CIT)

**Defined:** 2026-10-04
**Core Value:** A signed-in viewer opens a show and an episode from YouTube plays immediately, with progress remembered — and the admin can put a whole YouTube season on the platform from one playlist link.

## v1 Requirements

### Safety (SAFE)

- [ ] **SAFE-01**: A pushed migration can never re-run the destructive first migration or seed fake data on the live database (DROP block and seed migrations neutralised in place; live migration history matches the files)
- [ ] **SAFE-02**: Live migrations run only after Koss approves a dry-run in CI; any new `drop`/`truncate`/`delete` in a migration fails CI
- [ ] **SAFE-03**: Every pull request runs lint, typecheck, unit tests and a production build; a red check blocks merge
- [ ] **SAFE-04**: A read-only live audit is recorded: applied migrations vs files, admin check in RLS, every column holding a media URL, Supabase plan and backups
- [ ] **SAFE-05**: Owner of the stray Cloudflare nameservers (ignat/nataly) is found or ruled out before any NS change

### Admin actions (ADMIN)

- [x] **ADMIN-01**: Restore and conflict-restore flows validate episode numbers, scope ids to their show, audit every write and roll back on failure
- [x] **ADMIN-02**: Every admin action parses its input with a schema (UUID ids, enums, season/episode payloads)
- [x] **ADMIN-03**: Permanent deletes require an archived item; every destructive or renumbering write leaves an audit row
- [x] **ADMIN-04**: Multi-step admin writes fail whole or not at all, and no update error is swallowed; counts and cache tags stay correct
- [x] **ADMIN-05**: New SVG uploads are rejected, hero video size is enforced on the server, and untranslated English is never saved into Arabic fields

### Platform (PLAT)

- [ ] **PLAT-01**: The app builds and runs on Cloudflare Workers (OpenNext) in the ClickitStory account, on Next 16.3.8+
- [ ] **PLAT-02**: Route gates work on Workers: signed-out viewer is sent to sign-in from every gated page; non-admin is refused /admin; coming-soon mode and locale routing behave as today
- [ ] **PLAT-03**: An admin edit is visible to viewers within 10 seconds (R2 incremental cache + D1 tag cache + revalidation queue)
- [ ] **PLAT-04**: Scheduled episode publishing and media cleanup run from Cloudflare Cron Triggers (built in Phase 2 and deployed switched off; switched on at the Phase 3 cutover after the Vercel crons are off)
- [ ] **PLAT-05**: Sign-in, sign-up, contact and newsletter forms are protected by Turnstile; BotID is gone
- [ ] **PLAT-06**: Page views are measured by Cloudflare Web Analytics; Vercel analytics and speed insights are gone
- [ ] **PLAT-07**: Rate limits use the real visitor IP (`CF-Connecting-IP`) and fail closed; cron secret compared in constant time
- [ ] **PLAT-08**: Deploys to Cloudflare run with local wrangler from the control session after `npm run gate:local` passes and Koss says Ship; `wrangler whoami` shows the ClickitStory account first. No deploy token in GitHub
- [ ] **PLAT-09**: Starts on Workers Free; CPU per page is measured on workers.dev and Workers Paid is proposed to Koss only if pages fail
- [ ] **PLAT-10**: Every Vercel artefact is removed from the repo (vercel.json, @vercel/*, botid, VERCEL_* fallbacks, .vercelignore, check-cron.sh, CSP hosts)
- [ ] **PLAT-11**: The Vercel project and its domain are deleted, last, after Koss closes the proof window

### DNS and cutover (DNS)

- [ ] **DNS-01**: clickitstory.ae is a zone in the ClickitStory account and the .ae registry lists only its two Cloudflare nameservers, with no downtime during the move
- [ ] **DNS-02**: www.clickitstory.ae and the apex are served by the Worker; the live response shows Cloudflare, real HTML and working sign-in
- [ ] **DNS-03**: Vercel crons are switched off before the DNS flip and the Supabase service-role key is rotated after it
- [ ] **DNS-04**: Rollback to Vercel stays possible until the proof window ends

### Media (MEDIA)

- [ ] **MEDIA-01**: Admin uploads artwork, avatars and site assets straight from the browser to R2; no upload passes through a server action body
- [ ] **MEDIA-02**: Every stored photo and video is served from media.clickitstory.ae; the database holds only R2 URLs
- [ ] **MEDIA-03**: Every Supabase Storage object in the reviewed manifest is copied to R2 with checksums, plus optimized WebP/AVIF copies
- [ ] **MEDIA-08**: Database media URLs are rewritten to R2 with a backup table (live DB, Koss's approval); zero old-host URLs remain
- [ ] **MEDIA-04**: Images are pre-optimized when copied or uploaded (WebP/AVIF copies plus the original) and served from R2. No paid image feature. If a copy is missing, the original shows, never a broken image
- [ ] **MEDIA-05**: Hero background videos are compressed fast-start MP4s on R2 and play on Safari, Chrome and mobile
- [ ] **MEDIA-06**: Uploaded SVGs cannot run script (sanitised properly or rejected)
- [ ] **MEDIA-07**: Supabase Storage is emptied only after Koss approves, following the proof window

### Auth (AUTH)

- [ ] **AUTH-01**: Every page except the landing page and legal pages requires a signed-in viewer
- [ ] **AUTH-02**: Viewer can sign in or create an account with a 6-digit email code (no password needed)
- [ ] **AUTH-03**: Viewer can still sign up and sign in with email + password, and add a password later from profile
- [ ] **AUTH-04**: Password reset, email confirmation and email change work when the link is opened on another device
- [ ] **AUTH-05**: Issam and Nejib each have their own admin account; both see all admin functions
- [ ] **AUTH-06**: Admins must pass an authenticator-app code (TOTP) to enter the admin area
- [ ] **AUTH-07**: The audit log shows which admin made each change
- [ ] **AUTH-08**: Leaked-password protection is on; the anon-callable YouTube-ID function is closed

### Email (MAIL)

- [ ] **MAIL-01**: All auth emails (sign-up confirm, sign-in code, reset, email change) come from `Clickit Story <no-reply@clickitstory.ae>` via Resend (Koss's Pro account), branded, in the viewer's language (EN/AR)
- [ ] **MAIL-02**: clickitstory.ae passes SPF, DKIM and DMARC for Resend
- [ ] **MAIL-03**: A new viewer receives one branded welcome email after confirming
- [ ] **MAIL-04**: Viewer receives a daily digest (Dubai evening) of new episodes from shows on their My List, can turn it off in profile, and can unsubscribe with one click from the email
- [ ] **MAIL-05**: Support form sender gets an auto-reply; admins get a copy they can reply to
- [ ] **MAIL-06**: Newsletter sign-up is confirmed by email (double opt-in)
- [ ] **MAIL-07**: App emails are sent through a queue, never sent twice, failures retried

### YouTube (YT)

- [ ] **YT-01**: Admin pastes a YouTube playlist link and sees a preview of every video (title, thumbnail, duration, status) before importing it as a season
- [ ] **YT-02**: Private, deleted, non-embeddable and UAE-blocked videos are flagged and excluded; importing the same playlist again adds no duplicates; imported episodes land as drafts
- [ ] **YT-03**: Admin adds a single episode from a YouTube link; the video ID is validated on the server
- [ ] **YT-04**: The YouTube API key lives in a Worker secret and the old database copy is removed
- [ ] **YT-05**: Switching episodes in the player resumes each episode's own saved position
- [ ] **YT-06**: The player follows YouTube's embed rules: nothing drawn over the video (autoplay-next card moved off the player), player and captions in the site language, branded error states
- [ ] **YT-07**: Episode reorder never leaves gaps or duplicates and reports errors

### Product completeness (PROD)

- [ ] **PROD-01**: Genres grid, CTA banner and FAQ toggles in Settings really show and hide their sections
- [ ] **PROD-02**: CTA copy and genre colour editors are reachable in Settings and change the live site
- [ ] **PROD-03**: Admin can delete a season (with confirmation)
- [ ] **PROD-04**: Admin can mark support messages New / Open / Resolved / Spam
- [ ] **PROD-05**: Viewer can search shows and episodes in English and Arabic
- [ ] **PROD-06**: Reviews show the reviewer's name; a viewer can edit and delete their own review
- [ ] **PROD-07**: Shorts rail and overlay work (one autoplaying player at a time)
- [ ] **PROD-08**: Broadcast days are validated; only real weekdays can be saved
- [ ] **PROD-09**: Placeholder data (picsum posters, test YouTube IDs, fake cast) is removed from production from a list Koss approves

### Arabic (AR)

- [ ] **AR-01**: The full viewer UI works in Arabic at /ar with correct right-to-left layout (rails, carousels, icons, forms)
- [ ] **AR-02**: Numbers in the Arabic UI use Arabic-Indic digits (٠-٩); English UI uses 0-9
- [ ] **AR-03**: New code cannot add left/right-specific styles (lint rule)

### Design system (DS)

- [ ] **DS-01**: DESIGN.md and /admin/design-system describe the live look (LBC, #ffcc00, #090909 surfaces, 8px field/base radius, pill controls)
- [x] **DS-02**: All colours, radii and shadows come from tokens; no hard-coded hex or indigo leftovers; one brand-colour map
- [x] **DS-03**: A Claude Design design-system project shows foundations, viewer screens, admin screens and email templates, signed by Koss before the screens are built
- [ ] **DS-04**: /admin/design-system is admin-only

### Quality (QA)

- [ ] **QA-01**: End-to-end tests cover sign-in (password and code), browse, watch with resume, and admin playlist import
- [ ] **QA-02**: Dead code (unrendered components, unused queries, duplicate files, starter SVGs) is removed
- [ ] **QA-03**: CSP has no `unsafe-inline` for scripts where avoidable and no wildcard image source
- [ ] **QA-04**: Project docs (CLAUDE.md, AGENTS.md, MEMORY.md, .hermes.md) describe Cloudflare + Supabase, not Vercel

## v2 Requirements

- **YT-V2-01**: One-click "check for new episodes" sync of a season's playlist
- **YT-V2-02**: Nightly check that flags episodes whose YouTube video became private or deleted
- **MAIL-V2-01**: Continue-watching reminder emails
- **SRCH-V2-01**: Fuzzy (typo-tolerant) search
- **AUTH-V2-01**: Google / Apple sign-in

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-hosted video / Cloudflare Stream | YouTube embed only (client constraint) |
| Custom player skin over YouTube, hiding YouTube branding | Breaks YouTube embed rules |
| Catalog or auth in D1 | Supabase stays system of record |
| Staging environment | Koss chose a straight cutover |
| Paid Workers / Images overage without Koss's approval | Pricing is decided by Koss |
| Payments / subscriptions | Not part of the product |
| Admin vs editor roles | Two equal admins only |
| Auto-publishing from YouTube sync | Admin decides what goes live |
| Machine-translated titles | Content quality |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAFE-01 | Phase 1 | Code done on phase-01-safe-ground (lands at Ship) |
| SAFE-02 | Phase 1 | Code done; binding after runbook steps 3-5 (before merge) |
| SAFE-03 | Phase 1 | Code done; binding after runbook step 6 (ruleset) |
| SAFE-04 | Phase 1 | Done 2026-10-20 (plan tier: owner dashboard check) |
| SAFE-05 | Phase 1 | Closed 2026-10-20 by NS move (01-LIVE-AUDIT §6) |
| ADMIN-01 | Phase 1.1 | Complete |
| ADMIN-02 | Phase 1.1 | Complete |
| ADMIN-03 | Phase 1.1 | Complete |
| ADMIN-04 | Phase 1.1 | Complete |
| ADMIN-05 | Phase 1.1 | Complete |
| PLAT-01 | Phase 2 | Pending |
| PLAT-02 | Phase 2 | Pending |
| PLAT-03 | Phase 2 | Pending |
| PLAT-04 | Phase 2 | Pending |
| PLAT-05 | Phase 2 | Pending |
| PLAT-06 | Phase 2 | Pending |
| PLAT-07 | Phase 2 | Pending |
| PLAT-08 | Phase 2 | Pending |
| PLAT-09 | Phase 2 | Pending |
| PLAT-10 | Phase 2 | Pending |
| PLAT-11 | Phase 3 | Pending |
| DNS-01 | Phase 3 | Pending |
| DNS-02 | Phase 3 | Pending |
| DNS-03 | Phase 3 | Pending |
| DNS-04 | Phase 3 | Pending |
| MEDIA-01 | Phase 2 | Pending |
| MEDIA-02 | Phase 3 | Pending |
| MEDIA-03 | Phase 2 | Pending |
| MEDIA-04 | Phase 2 | Pending |
| MEDIA-05 | Phase 2 | Pending |
| MEDIA-06 | Phase 2 | Pending |
| MEDIA-07 | Phase 8 | Pending |
| MEDIA-08 | Phase 3 | Pending |
| AUTH-01 | Phase 5 | Pending |
| AUTH-02 | Phase 5 | Pending |
| AUTH-03 | Phase 5 | Pending |
| AUTH-04 | Phase 5 | Pending |
| AUTH-05 | Phase 5 | Pending |
| AUTH-06 | Phase 5 | Pending |
| AUTH-07 | Phase 5 | Pending |
| AUTH-08 | Phase 5 | Pending |
| MAIL-01 | Phase 5 | Pending |
| MAIL-02 | Phase 3 | Pending |
| MAIL-03 | Phase 5 | Pending |
| MAIL-04 | Phase 5 | Pending |
| MAIL-05 | Phase 5 | Pending |
| MAIL-06 | Phase 5 | Pending |
| MAIL-07 | Phase 5 | Pending |
| YT-01 | Phase 6 | Pending |
| YT-02 | Phase 6 | Pending |
| YT-03 | Phase 6 | Pending |
| YT-04 | Phase 6 | Pending |
| YT-05 | Phase 6 | Pending |
| YT-06 | Phase 6 | Pending |
| YT-07 | Phase 6 | Pending |
| PROD-01 | Phase 7 | Pending |
| PROD-02 | Phase 7 | Pending |
| PROD-03 | Phase 7 | Pending |
| PROD-04 | Phase 7 | Pending |
| PROD-05 | Phase 7 | Pending |
| PROD-06 | Phase 7 | Pending |
| PROD-07 | Phase 7 | Pending |
| PROD-08 | Phase 7 | Pending |
| PROD-09 | Phase 7 | Pending |
| AR-01 | Phase 7 | Pending |
| AR-02 | Phase 7 | Pending |
| AR-03 | Phase 7 | Pending |
| DS-01 | Phase 4 | Pending |
| DS-02 | Phase 4 | Complete |
| DS-03 | Phase 4 | Complete |
| DS-04 | Phase 4 | Pending |
| QA-01 | Phase 8 | Pending |
| QA-02 | Phase 8 | Pending |
| QA-03 | Phase 8 | Pending |
| QA-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 75 total
- Mapped to phases: 75
- Unmapped: 0

---
*Requirements defined: 2026-10-04*
*Last updated: 2026-10-20 after Koss signed Phase 2 roadmap edits 1-9 (PLAT-10/11 and MEDIA-03/08 split, DNS-01 and MAIL-02 to Phase 3)*
