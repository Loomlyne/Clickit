---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Full Bilingual UI (AR/EN)
status: in-progress
stopped_at: Completed Phase 13 plan 05 (URL-based locale switcher + sitemap alternates, RTE-08 + RTE-09 closed) — next = Phase 13 plan 13-06 (static-analysis gate + Vercel preview smoke test)
last_updated: "2026-04-21T00:54:18Z"
last_activity: 2026-04-21
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 8
  completed_plans: 7
  percent: 87
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** Viewers enter, discover a show, pick an episode, watch immediately — premium streaming experience for CIT originals.
**Current focus:** v1.1 Full Bilingual UI (AR/EN) — URL-prefix routing, full translation coverage of every visible string, RTL layout.

## Current Position

Phase: 13 IN PROGRESS — plans 01 + 02 + 03a + 03b + 04 + 05 of 7 complete
Plan: 13-05-PLAN.md shipped (commits c41c8de + 3266fc7) — cookie-based locale infrastructure deleted (`src/app/locale-actions.ts`, `src/components/layout/locale-switcher.tsx`); `src/components/profile/language-preference.tsx` rewritten as URL-based switcher using `useRouter` + `usePathname` from `@/i18n/navigation`; `src/app/sitemap.ts` now emits `alternates.languages` for every static + dynamic route; `src/lib/site-url.ts` audit confirmed no changes needed (resolver locale-agnostic by design).
Status: RTE-01, RTE-02, RTE-03, RTE-04 (both halves), RTE-05, RTE-06, RTE-07, RTE-08, RTE-09, I18N-05, I18N-06 closed. All 9 RTE requirements closed. 6 of 6 Phase 13 auth/routing pitfalls fixed. tsc clean; `npm run build` green with 44 routes; `/sitemap.xml` static-prerendered (1h revalidate, 1y expire); `/auth/callback` remains the only locale-agnostic app route. Next: plan 13-06 (static-analysis gate + Vercel preview smoke test — atomic merge gate).
Last activity: 2026-04-21 — Phase 13 plan 05 URL-based locale switcher + sitemap alternates.

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
Stopped at: Completed Phase 13 plan 05 (commits c41c8de + 3266fc7 — URL-based locale switcher + sitemap alternates, RTE-08 + RTE-09 closed); next = plan 13-06 (static-analysis gate + Vercel preview smoke test)
Resume file: `.planning/phases/13-route-restructure-auth-safety/13-05-SUMMARY.md`

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
- **2026-04-21 (Phase 13 plan 03a):** next-intl's Server-side `redirect` requires `{ href, locale }` object signature (not bare string as the plan examples showed). All 5 Server Component redirect call sites adopt `redirect({ href, locale })` after `const locale = await getLocale()` from `next-intl/server`. Plan's `redirect('/auth')` diff examples were wrong — documented the correct signature in the SUMMARY.
- **2026-04-21 (Phase 13 plan 03a):** Auth guards use `if (!user) { ... return redirect(...) }` pattern. Required because multi-statement guards lose TS control-flow narrowing unless `return` precedes the never-returning call.
- **2026-04-21 (Phase 13 plan 03b):** Drift handling for mechanical sweeps uses `comm -23 grep.txt frontmatter.txt` to detect files-in-grep-not-in-frontmatter. Plan's drift rule (accept into scope) applied: `design-system/layout.tsx` added to the 38-file swap list (frontmatter had 37). Single atomic commit for all 38 files — splitting mechanical sweeps into smaller commits adds no reviewable signal. Combined with 13-03a, RTE-04 is fully closed.
- **2026-04-21 (Phase 13 plan 04):** OAuth callback `safeNext(raw, locale)` — open-redirect defense FIRST (reject `//`, `/\\`, non-`/` prefixes), locale short-circuit SECOND (keep `/en/...` and `/ar/...` unchanged), locale prepend LAST. Order matters: prepending before validation would turn `//attacker.com` into `/en//attacker.com` which is still a path but looks sketchy in logs. Reject-first keeps the defense legible.
- **2026-04-21 (Phase 13 plan 04):** `GET(request: NextRequest)` signature — bumped from `Request` to `NextRequest` because the `.cookies` API is only typed on `NextRequest`. Alternative (parse `Cookie` header manually off `Request.headers.get('cookie')`) adds code surface for no benefit.
- **2026-04-21 (Phase 13 plan 04):** `resolveLocale` reads `NEXT_LOCALE` cookie and validates against `routing.locales` tuple. Cookie tampering (e.g., `../en`) fails the `includes` check and falls back to `routing.defaultLocale`. Accept-Language sniffing intentionally skipped — the cookie reflects explicit user intent (set by URL switcher in plan 13-05 and by next-intl middleware on first locale-prefixed request).
- **2026-04-21 (Phase 13 plan 05):** URL is the source of truth for locale, not a cookie. LanguagePreference click handler calls `router.replace(pathname, { locale })` — no server action, no cookie write, no revalidatePath. next-intl middleware persists `NEXT_LOCALE` automatically on the resulting locale-prefixed navigation, which keeps the OAuth callback locale resolver (plan 13-04) working. Retires the Phase-12-era setLocaleAction pattern (cookie + revalidate), which was redundant-at-best / broken-at-worst post-restructure (revalidated unprefixed paths that no longer existed).
- **2026-04-21 (Phase 13 plan 05):** Tasks 1 + 2 committed together (c41c8de) to preserve buildable-tree invariant — deletion of `locale-actions.ts` would break the old `language-preference.tsx` import in between if split into separate commits. Task commit granularity bent one notch to preserve bisectability.
- **2026-04-21 (Phase 13 plan 05):** Sitemap `url` field uses `routing.defaultLocale` as canonical; `alternates.languages` built dynamically from `routing.locales` via `Object.fromEntries` — adding a new locale in routing.ts auto-picks-up in sitemap output without further edits.
- **2026-04-21 (Phase 13 plan 05):** site-url.ts audit outcome: no changes. Resolver is pure env-var precedence (NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL → localhost). All 3 callers (metadataBase in [locale]/layout.tsx, robots.ts, sitemap.ts) correctly handle locale concerns at their own layer. metadataBase intentionally stays canonical per META-06 — per-page `alternates.canonical` / `alternates.languages` deferred to Phase 17 (META-03).

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Commit |
|-------|------|----------|-------|-------|--------|
| 12 | 01 | auto | 6 | 5 | af2ab35 |
| 13 | 01 | ~35min | 5 | 62 | 733c8f4..b3234c6 |
| 13 | 02 | ~8min | 2 | 1 | 5503cda |
| 13 | 03a | ~11min | 4 | 19 | 82c6735..9b079ba |
| 13 | 03b | ~4min | 3 | 38 | b10a964 |
| 13 | 04 | ~3min | 2 | 1 | 8d90206 |
| 13 | 05 | ~5min | 5 | 3 | c41c8de, 3266fc7 |
