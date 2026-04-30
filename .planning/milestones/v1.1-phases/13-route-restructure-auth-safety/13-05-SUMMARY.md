---
phase: 13-route-restructure-auth-safety
plan: 05
subsystem: i18n + sitemap
tags: [i18n, sitemap, dead-code, url-switcher, v1.1]
requires:
  - 13-01 (route restructure — [locale]/ segment exists)
  - 13-03 (next-intl navigation swaps across components)
provides:
  - URL-based locale switcher on /profile (router.replace with { locale })
  - Sitemap with alternates.languages for every static and dynamic route
affects:
  - src/components/profile/language-preference.tsx (rewritten, URL-based)
  - src/app/sitemap.ts (alternates.languages added)
tech-stack:
  added: []
  patterns:
    - next-intl URL-based locale switcher (router.replace(pathname, { locale }))
    - Dynamic sitemap language alternates built from routing.locales
key-files:
  created: []
  deleted:
    - src/app/locale-actions.ts (cookie-based setLocaleAction server action)
    - src/components/layout/locale-switcher.tsx (cookie-based navbar pill toggle)
  modified:
    - src/components/profile/language-preference.tsx
    - src/app/sitemap.ts
decisions:
  - Tasks 1 and 2 land in a single commit (c41c8de) — deletion of locale-actions.ts would break the old language-preference.tsx in between. Atomic commit preserves buildable-tree invariant.
  - Sitemap `url` field uses routing.defaultLocale ('en') as canonical; alternates.languages.en is identical to url by construction — crawlers tolerate this.
  - languageAlternates built dynamically from routing.locales (not hardcoded) — adding a new locale in routing.ts auto-picks-up in sitemap.
  - src/lib/site-url.ts audit confirms no changes needed. Resolver is locale-agnostic; callers (metadataBase, robots.ts sitemap ref, sitemap.ts) each handle locale concerns explicitly at their own layer.
  - Per-page metadata `alternates.canonical` and `alternates.languages` remain deferred to Phase 17 (META-03). This plan closes RTE-09 sitemap scope only.
metrics:
  duration: ~5min
  tasks: 5
  files_changed: 3
  completed: "2026-04-21T00:54:18Z"
---

# Phase 13 Plan 05: URL-Based Locale Switcher + Sitemap Alternates Summary

URL-based locale switcher replaces cookie-based server action; sitemap emits `alternates.languages` for crawler hreflang. Closes RTE-08 + RTE-09.

## What Was Built

**Cookie infrastructure deleted:**
- `src/app/locale-actions.ts` — the `setLocaleAction` server action that wrote `NEXT_LOCALE` cookie + called `revalidatePath('/', 'layout')`. Both operations are redundant/broken post-restructure: next-intl middleware writes the cookie automatically, and `revalidatePath('/', 'layout')` invalidated the wrong (unprefixed) routes after the `[locale]/` move.
- `src/components/layout/locale-switcher.tsx` — cookie-based navbar pill toggle. Already removed from the navbar in commit beaa644 but the file remained.

**URL-based switcher in place:**
- `src/components/profile/language-preference.tsx` rewritten. Click handler calls `router.replace(pathname, { locale: next })` using primitives from `@/i18n/navigation`. `usePathname()` from the same module returns the locale-stripped path; `router.replace` re-prepends the new locale. No cookie write, no server action. next-intl middleware persists `NEXT_LOCALE` transparently on the resulting locale-prefixed request, which preserves the OAuth callback locale-resolution path from plan 13-04.
- External API unchanged — still exports `LanguagePreference({ current }: { current: Locale })` — so the consuming profile page needs no adjustment.
- `Locale` type now imported from `@/i18n/routing` (source of truth for routing), not `@/lib/locale`.

**Sitemap language alternates:**
- `src/app/sitemap.ts` now emits `alternates.languages.en` and `alternates.languages.ar` for every entry. Canonical `url` uses `routing.defaultLocale` ('en'). Helper `languageAlternates(base, path)` builds `{ en: .../en..., ar: .../ar... }` dynamically from `routing.locales`.
- Root path special-cased so `/` becomes `.../en` (no trailing slash conflict) but other paths stay clean.
- Crawler hreflang output:
  ```xml
  <url>
    <loc>https://clickitstory.com/en/series/foo</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://clickitstory.com/en/series/foo" />
    <xhtml:link rel="alternate" hreflang="ar" href="https://clickitstory.com/ar/series/foo" />
  </url>
  ```

**site-url.ts audit (RTE-09 half):**
- Read `src/lib/site-url.ts` — resolver is pure env-var precedence, no locale logic. Confirmed.
- Read callers: `metadataBase` in `[locale]/layout.tsx` uses bare `new URL(siteUrl())` (no locale — correct per META-06); `robots.ts` uses `${siteUrl()}/sitemap.xml` (no locale — correct); `sitemap.ts` prepends `/${locale}` explicitly (correct).
- No code changes needed.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | c41c8de | feat(13-05): URL-based locale switcher, delete cookie infrastructure (Tasks 1 + 2) |
| 2 | 3266fc7 | feat(13-05): sitemap emits alternates.languages for every route (Task 3) |

Tasks 4 (site-url.ts audit) and 5 (build gate) produced no code changes — audit-only / verification-only — so no separate commits.

## Deviations from Plan

**Task commit granularity:** Combined Tasks 1 and 2 into a single commit (c41c8de). The plan specified them as separate tasks, but deletion of `locale-actions.ts` (Task 1) breaks the old `language-preference.tsx` (which still imported `setLocaleAction`) until Task 2's rewrite. Splitting into two commits would leave an un-buildable intermediate commit — violates the buildable-tree invariant. The combined commit's diff is small and single-purpose (swap cookie-based locale mechanism for URL-based). [Rule 3 — blocking issue: buildable-tree invariant]

**Stale `.next/types/` duplicate files:** Before running tsc, deleted two stale duplicate macOS files (`.next/types/routes.d 2.ts`, `.next/types/validator 2.ts`) that reported `TS2300: Duplicate identifier 'LayoutProps'`. Not caused by my changes; preexisting filesystem crud. [Rule 3 — blocking issue, out-of-scope but single-command fix]

## Verification

- [x] `src/app/locale-actions.ts` does NOT exist
- [x] `src/components/layout/locale-switcher.tsx` does NOT exist
- [x] `src/components/profile/language-preference.tsx` exists with URL-based implementation
- [x] `grep "router.replace(pathname" src/components/profile/language-preference.tsx` matches
- [x] `grep "useRouter.*from '@/i18n/navigation'" src/components/profile/language-preference.tsx` matches
- [x] `grep "usePathname.*from '@/i18n/navigation'" src/components/profile/language-preference.tsx` matches
- [x] `! grep "setLocaleAction" src/components/profile/language-preference.tsx` passes
- [x] `grep -rE "locale-actions|locale-switcher" src` returns ZERO matches
- [x] `grep "routing.locales" src/app/sitemap.ts` matches
- [x] `grep "alternates" src/app/sitemap.ts` matches
- [x] `grep "languages" src/app/sitemap.ts` matches
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0 — 44 routes, `/sitemap.xml` static prerendered (1h revalidate, 1y expire)
- [x] `git diff src/lib/locale.ts` is EMPTY (I18N-07 non-regression preserved)
- [x] `src/lib/site-url.ts` contains no `locale`-named symbol (locale-agnostic resolver confirmed)

## Known Stubs

None — all changes are wired and reachable. LanguagePreference is mounted on `/profile` (confirmed via grep — consumer at `src/app/[locale]/(viewer)/profile/page.tsx` imports `LanguagePreference` with the unchanged external API).

## Threat Flags

None introduced. Per threat model:
- T-13-10 (sitemap info disclosure) — accepted; sitemap lists the same public routes as before, now annotated with locale peers.
- T-13-11 (LanguagePreference locale tampering) — mitigated; options array at module scope types `locale: 'en' | 'ar'`, and next-intl's router.replace rejects unknown locales against routing.locales.

## Requirements Closed

- RTE-08 — "Replace dead cookie-based locale infrastructure with URL-based switcher"
- RTE-09 — "Sitemap emits alternates.languages + site-url.ts locale audit"

## Self-Check: PASSED

- FOUND: c41c8de in git log
- FOUND: 3266fc7 in git log
- MISSING (expected): src/app/locale-actions.ts
- MISSING (expected): src/components/layout/locale-switcher.tsx
- FOUND: src/components/profile/language-preference.tsx
- FOUND: src/app/sitemap.ts with routing.locales + alternates + languages

## Next

Plan 13-06 (Vercel preview smoke test) — 10-item manual walkthrough on preview URL covering auth, locale preservation, sitemap XML shape. URL switcher and sitemap are the last code changes before the phase smoke test.
