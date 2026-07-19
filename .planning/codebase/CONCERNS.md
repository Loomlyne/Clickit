---
last_mapped_commit: de36f69
---
# Codebase Concerns

**Analysis Date:** 2026-07-19

## Tech Debt

**Monolithic admin mutation module:**
- Issue: `src/app/[locale]/admin/actions.ts` is 3,570 lines and owns authorization, validation, database writes, storage upload lifecycle, cache invalidation, translation, and audit logging.
- Files: `src/app/[locale]/admin/actions.ts`, `src/lib/audit.ts`, `src/lib/translate.ts`, `src/lib/supabase/admin.ts`.
- Impact: a change to an unrelated admin capability can break authorization, cache behavior, or storage cleanup; review and unit isolation are difficult.
- Fix approach: split by resource into direct server-only modules, keep `assertAdmin()` at each exported mutation boundary, and preserve the existing typed result contracts.

**Viewer query concentration:**
- Issue: `src/lib/queries.ts` is 1,220 lines and contains read paths for catalog, episodes, progress, watchlist, likes, shorts, FAQs, and legal pages; it currently contains seven lint-blocking explicit `any` uses.
- Files: `src/lib/queries.ts`, `src/lib/database.types.ts`.
- Impact: typed-query regressions can affect unrelated viewer routes and are not blocked by the current red lint command.
- Fix approach: divide queries by domain while retaining server cache tags, replace `any` casts with narrow generated-database types, and add unit tests for each exported query mapping.

## Known Bugs

**Supabase video CDN proxy loses byte-range behavior:**
- Symptoms: a ranged request to `src/app/api/cdn/storage/route.ts` can be returned as a full-object response by the upstream/proxy path instead of a 206 partial response.
- Files: `src/app/api/cdn/storage/route.ts`, `src/lib/supabase-media.ts`, `src/components/landing/hero-background-media.tsx`.
- Trigger: browser progressive playback or a request to `/api/cdn/storage` with a `Range` header for an allowlisted public Supabase video.
- Workaround: serve the direct Supabase public URL until the proxy preserves 206 status, `Content-Range`, and partial-body semantics.

## Security Considerations

**Sensitive configuration is protected only by ineffective column revokes:**
- Risk: public RLS permits full rows from `app_config` and public episode rows. PostgreSQL table-level SELECT can make the later column-only revokes insufficient to hide `youtube_api_key` or embargoed `youtube_video_id` values. The same behavior was live-verified in the 2026-07-19 security audit for this commit.
- Files: `supabase/migrations/20260401000001_create_rls_policies.sql`, `supabase/migrations/20260418000000_expand_app_config.sql`, `supabase/migrations/20260618000000_episodes_view_security_invoker.sql`, `src/lib/config.ts`, `src/app/api/youtube-meta/route.ts`.
- Current mitigation: `src/lib/config.ts` avoids selecting the YouTube key in public application reads, and `episodes_view` masks not-yet-live values, but raw PostgREST requests bypass those application helpers.
- Recommendations: move integration secrets to Vercel server environment variables or an unexposed schema; revoke table SELECT and grant explicit safe columns; add anonymous REST permission tests and rotate any previously stored key.

**Single-admin service-role control has no MFA assurance check:**
- Risk: password or session compromise grants access to all service-role-backed admin mutations.
- Files: `src/app/[locale]/admin/actions.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/middleware.ts`, `supabase/migrations/20260401000001_create_rls_policies.sql`.
- Current mitigation: admin mutations re-check the authenticated user identity through `assertAdmin()` before creating the server-only client.
- Recommendations: require Supabase MFA AAL2 for admin routes and mutations, then require recent reauthentication for permanent deletes and credential changes.

**Public contact processing has unbounded text and non-atomic rate limiting:**
- Risk: public callers can submit oversized text accepted by `supportMessageSchema`; the global Server Action limit is 55 MB. The rate limiter separately counts and inserts, and deliberately fails open on database errors.
- Files: `src/lib/contact.ts`, `src/app/actions/contact.ts`, `next.config.ts`.
- Current mitigation: five requests per IP per hour is intended, BotID signals are logged, and Resend runs only after a database insert.
- Recommendations: set server-side upper bounds, reduce the global body limit after auditing upload paths, replace count-then-insert with an atomic database operation, and fail closed for email-producing actions.

## Performance Bottlenecks

**Large hero media can multiply transfer costs:**
- Problem: the CDN proxy's range failure causes full media streams for small byte-range requests, which harms mobile startup and can consume Supabase and Vercel transfer quotas.
- Files: `src/app/api/cdn/storage/route.ts`, `src/lib/supabase-media.ts`, `vercel.json`.
- Cause: ranged upstream fetches are marked `no-store`, then the route streams the upstream body and status without independently validating that a partial response was received.
- Improvement path: remove the proxy for public video until correct range behavior is proved, store compact immutable media on a range-capable CDN, and verify `206`, `Content-Length`, and `Content-Range` in automated HTTP checks.

## Fragile Areas

**React Compiler is enabled while lint reports React correctness violations:**
- Files: `next.config.ts`, `src/components/likes/like-button.tsx`, `src/components/watchlist/watchlist-toggle-button.tsx`, `src/components/watch/youtube-player.tsx`, `src/components/providers/viewer-scroll-persistence.tsx`.
- Why fragile: `npm run lint` currently fails with 28 errors, including refs accessed during render and synchronous state updates in effects. Several React Hook Form consumers are skipped by the compiler as incompatible.
- Safe modification: restore a zero-error lint baseline before relying on compiler optimization; use state for render-driving animation flags and synchronize refs in effects or event handlers.
- Test coverage: `tests/unit/` and `tests/e2e/` do not cover these compiler/lint contracts.

**Browser test path is non-deterministic:**
- Files: `playwright.config.ts`, `tests/e2e/`, `package.json`, `.github/workflows/supabase-migrations.yml`.
- Why fragile: 60 Playwright tests are present, but no package script or GitHub workflow runs them; configuration always reuses any existing local server and runs only desktop Chromium.
- Safe modification: add explicit local and CI test commands, disable server reuse in CI, install browser dependencies, retain traces on failure, and add a mobile project before relying on E2E as a release gate.
- Test coverage: unit tests exist in `tests/unit/`, but no CI quality workflow executes lint, unit tests, build, or E2E tests for normal application changes.

## Scaling Limits

**Cron media sweep lists Storage objects serially:**
- Current capacity: `src/app/api/cron/cleanup-media/route.ts` recursively lists the `shows/` subtree and compares it against database references on a weekly schedule.
- Limit: work scales with every show folder and object, and Vercel cron failure prevents orphan cleanup.
- Scaling path: keep per-show asset counts bounded, record upload ownership/expiry in the database, and paginate or batch storage listing/deletion with observable failure reporting.

## Dependencies at Risk

**React Hook Form and React Compiler interaction:**
- Risk: forms that call `watch()` are skipped by React Compiler optimization, producing lint warnings and making optimization coverage uneven.
- Impact: admin and auth forms in `src/components/admin/`, `src/components/auth/`, and `src/components/support/` retain manual runtime behavior while the rest of the tree is compiler-optimized.
- Migration plan: use `useWatch` or isolate incompatible form logic before treating React Compiler warnings as non-blocking.

## Missing Critical Features

**Account privacy lifecycle:**
- Problem: no account deletion or export flow is implemented, while profiles, avatars, progress, watchlist, likes, reviews, support messages, and newsletter data are persisted.
- Blocks: users cannot self-serve deletion or data export, and operational deletion requires coordinated database and Storage cleanup.
- Files: `src/app/[locale]/(viewer)/profile/actions.ts`, `src/app/actions/contact.ts`, `supabase/migrations/20260429010000_create_support_and_newsletter.sql`, `vercel.json`.

## Test Coverage Gaps

**Authorization and production integration boundaries:**
- What's not tested: anonymous PostgREST column access, service-role admin mutation rejection, cron bearer authentication, Resend failures, Google/YouTube API failures, and CDN byte-range response semantics.
- Files: `supabase/migrations/20260401000001_create_rls_policies.sql`, `src/app/api/cdn/storage/route.ts`, `src/app/api/cron/`, `src/app/api/youtube-meta/route.ts`, `src/app/actions/contact.ts`.
- Risk: the most consequential failures occur outside component rendering and can pass the existing unit/E2E suite.
- Priority: High.

---

*Concerns audit: 2026-07-19*
