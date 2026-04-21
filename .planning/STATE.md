---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Full Bilingual UI (AR/EN)
status: in-progress
stopped_at: Completed Phase 13 plan 02 (proxy composition — next-intl + Supabase cookie merge, locale-aware coming-soon) — next = Phase 13 plans 13-03a + 13-03b (nav + Link swaps, parallel wave)
last_updated: "2026-04-21T18:10:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 8
  completed_plans: 3
  percent: 37
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Viewers enter, discover a show, pick an episode, watch immediately — premium streaming experience for CIT originals.
**Current focus:** v1.1 Full Bilingual UI (AR/EN) — URL-prefix routing, full translation coverage of every visible string, RTL layout.

## Current Position

Phase: 13 IN PROGRESS — plans 01 + 02 of 7 complete
Plan: 13-02-PLAN.md shipped (commit 5503cda) — proxy.ts composes createMiddleware(routing) + updateSession(); Supabase cookies merged onto intlResponse; /api + /auth/callback short-circuit; coming-soon redirect now locale-aware (/en/coming-soon or /ar/coming-soon).
Status: RTE-01, RTE-02, RTE-03, RTE-07, I18N-05, I18N-06 closed. tsc clean; `npm run build` green with 44 static pages. Next: plans 13-03a (nav hooks + Server redirects, 19 files) and 13-03b (next/link, ~38 files) — parallel-eligible in wave 3.
Last activity: 2026-04-21 — Phase 13 plan 02 proxy composition.

## Roadmap Summary (v1.1)

| Phase | Goal | Requirements | Criteria |
|-------|------|--------------|----------|
| 12. i18n Infrastructure | next-intl primitives wired with zero page edits | 7 | 5 |
| 13. Route Restructure + Auth Safety | All pages under `[locale]/`, 6 auth pitfalls fixed atomically | 9 | 5 |
| 14. Global Layout + RTL CSS | Arabic dir, Cairo font, logical properties, directional icons | 8 | 5 |
| 15. Viewer Pages Translation | 13 viewer pages fully translated | 14 | 5 |
| 16. Admin Pages Translation | 5 admin views fully translated | 5 | 5 |
| 17. Content + Polish | Dynamic strings, metadata, QA, human review | 19 | 5 |

**Coverage:** 55/55 v1.1 requirements mapped. No orphans. No duplicates. Phases 15/16 parallel-eligible after 14.

## Accumulated Context

### v1.0 shipped (2026-04-16)
- 11 phases, 27 plans, 60/60 requirements, 13,259 LOC
- Next.js 16.2 + Supabase + Tailwind CSS v4 + shadcn/ui
- Cookie-based locale infrastructure exists but mostly unwired
- `next-intl@4.9.1` already installed (unwired)
- `proxy.ts` already exists with Next.js 16 naming convention
- Supabase session helper in `src/lib/supabase/middleware.ts` (library, not middleware entrypoint)

### v1.1 research findings (see .planning/research/SUMMARY.md)
- Zero new dependencies required
- Migration is mechanical once Phase 12-13 (infrastructure + auth-safe route restructure) land
- 6 latent auth/routing breaks identified — must fix atomically in Phase 13
- Existing `dirFor()` and `pickLocalized()` helpers stay
- `locale-actions.ts` + cookie switcher + profile `LanguagePreference` become dead code

### v1.1 risk profile
- **Highest risk:** Phase 13 (route restructure + 6 auth fixes atomic). Must deploy + smoke-test auth flows on preview before merge.
- **Medium risk:** Phase 14 logical-property migration across ~114 components — potential for visual regression on English.
- **Low risk:** Phase 12 (additive, safe), Phase 15/16 (mechanical string extraction), Phase 17 (additive polish).

## Session Continuity

Last session: 2026-04-21
Stopped at: Completed Phase 13 plan 02 (commit 5503cda — proxy composition); next = plans 13-03a + 13-03b (parallel wave 3)
Resume file: `.planning/phases/13-route-restructure-auth-safety/13-02-SUMMARY.md`

## Decisions Made

- **2026-04-21 (Phase 12):** `localePrefix: 'always'` — both /en/ and /ar/ URL segments required; no bare-root exception for the default locale.
- **2026-04-21 (Phase 12):** Arabic dictionary values remain empty objects (not English placeholders) so missing keys surface as next-intl MISSING_MESSAGE warnings — prevents silent English fallback on /ar/ pages during later translation phases.
- **2026-04-21 (Phase 12):** ~~No `createNextIntlPlugin()` added to `next.config.ts`; next-intl v4 auto-detects `src/i18n/request.ts`~~ **Invalidated in Phase 13 plan 01.** The plugin IS required — build failed with "Couldn't find next-intl config file" once `[locale]/layout.tsx` awaited `getMessages()`. Plugin wired in commit b3234c6 as `withBotId(withNextIntl(nextConfig))`.
- **2026-04-21 (Phase 12):** `src/lib/locale.ts` kept byte-identical (dirFor / pickLocalized / getLocale) — remains canonical for bilingual DB field rendering in existing viewer code.
- **2026-04-21 (Phase 13 plan 01):** `<html>` and `<body>` ownership lives on `src/app/[locale]/layout.tsx`, not the root. Root layout returns `{children}` (15 lines). Matches next-intl v4 canonical pattern and lets URL segment drive `lang`/`dir` without a cookie read.
- **2026-04-21 (Phase 13 plan 01):** OAuth callback relocated to `src/app/auth/callback/route.ts` (out of `(viewer)` route group). Stays at exact URL registered with OAuth providers even after the `[locale]/` restructure. safeNext() locale-awareness deferred to plan 13-04.
- **2026-04-21 (Phase 13 plan 01):** All 39 route moves executed via `git mv` with rename detection (R in git status), blame history preserved (`git log --follow` confirms).
- **2026-04-21 (Phase 13 plan 02):** proxy.ts composition order is `handleI18nRouting(request)` first, `updateSession(request)` second, then merge `supabaseResponse.cookies.getAll().forEach(c => intlResponse.cookies.set(c.name, c.value, c))`. This merge MUST run in every code path (pass-through, 3xx redirect, coming-soon redirect) or the `/` → `/en/` redirect silently drops the Supabase auth cookie.
- **2026-04-21 (Phase 13 plan 02):** `/api/*` and `/auth/callback` short-circuit above the i18n layer — both are locale-agnostic by requirement (API convention + OAuth provider URL registration). Session refresh still runs on the short-circuit branches so API routes get fresh cookies.
- **2026-04-21 (Phase 13 plan 02):** Coming-soon redirect uses `` `/${locale}/coming-soon` `` built from `stripLocale(pathname).locale` — preserves /en/ or /ar/ prefix. Falls back to `routing.defaultLocale` for pre-redirect bare paths (shouldn't happen in practice because the 3xx short-circuit returns first).

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Commit |
|-------|------|----------|-------|-------|--------|
| 12 | 01 | auto | 6 | 5 | af2ab35 |
| 13 | 01 | ~35min | 5 | 62 | 733c8f4..b3234c6 |
| 13 | 02 | ~8min | 2 | 1 | 5503cda |
