---
phase: 12-i18n-infrastructure
plan: 01
subsystem: i18n
tags: [i18n, next-intl, infrastructure, v1.1, zero-page-edits]
dependency_graph:
  requires:
    - next-intl@^4.9.1 (already installed in package.json)
    - src/lib/locale.ts (existing domain helpers, untouched)
  provides:
    - src/i18n/routing (routing config + staticParams helper + Locale type)
    - src/i18n/request (getRequestConfig default export)
    - src/i18n/navigation (Link, useRouter, redirect, usePathname, getPathname, permanentRedirect)
    - src/messages/en.json (14-namespace skeleton)
    - src/messages/ar.json (14-namespace skeleton, mirror structure)
  affects: []
tech_stack:
  added:
    - next-intl wiring (package was pre-installed; now importable as @/i18n/*)
  patterns:
    - URL-segment-aware routing (localePrefix 'always')
    - Server-Component-safe getRequestConfig with locale validation + fallback
    - Locale-preserving navigation primitives via createNavigation(routing)
    - Dictionary-per-locale JSON under src/messages/ loaded via dynamic import
key_files:
  created:
    - src/i18n/routing.ts
    - src/i18n/request.ts
    - src/i18n/navigation.ts
    - src/messages/en.json
    - src/messages/ar.json
  modified: []
decisions:
  - "localePrefix: 'always' — both /en/ and /ar/ get prefixes, no bare-root exception for default locale"
  - "staticParams helper exported from routing.ts so Phase 13's generateStaticParams is a pure re-export"
  - "Arabic dictionary values are empty objects in Phase 12 so missing-key warnings surface visibly later (not silent English fallback)"
  - "No createNextIntlPlugin() added to next.config.ts — v4 auto-detects src/i18n/request.ts"
  - "src/lib/locale.ts kept byte-identical — dirFor/pickLocalized/getLocale remain canonical for existing viewer code"
metrics:
  duration: "≈ Tasks 1–5 verified pre-existing byte-identical to plan spec; Task 6 verification took most of the time (tsc + production build)"
  completed_date: "2026-04-21"
  tasks_total: 6
  tasks_completed: 6
  files_created: 5
  lines_added: 112
  commit: af2ab35
---

# Phase 12 Plan 01: i18n Infrastructure Summary

**One-liner:** Wired `next-intl@4.9.1` primitives — routing config, getRequestConfig, createNavigation helpers, and bilingual 14-namespace JSON dictionary skeletons — without touching a single page or component. Foundation is importable but unused; live site is byte-identical to pre-phase.

## What shipped

Five new files (112 total lines), single atomic commit `af2ab35`:

| File | Lines | Purpose |
| --- | --- | --- |
| `src/i18n/routing.ts` | 32 | `defineRouting({ locales: ['en','ar'], defaultLocale: 'en', localePrefix: 'always' })` + `staticParams` helper for Phase 13's `generateStaticParams` + `Locale` type |
| `src/i18n/request.ts` | 30 | Default `getRequestConfig` export: awaits `requestLocale`, validates via `hasLocale(routing.locales, ...)`, falls back to `routing.defaultLocale`, dynamic-imports `../messages/${locale}.json` |
| `src/i18n/navigation.ts` | 18 | Destructured re-export of `Link`, `useRouter`, `redirect`, `usePathname`, `getPathname`, `permanentRedirect` from `createNavigation(routing)` |
| `src/messages/en.json` | 16 | 14 namespaces, empty objects: `nav`, `auth`, `home`, `show`, `player`, `search`, `profile`, `myList`, `comingSoon`, `support`, `faq`, `admin`, `errors`, `common` |
| `src/messages/ar.json` | 16 | Mirror structure of en.json; empty values (Phases 15–17 populate with human-reviewed Arabic) |

## Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 — no type errors |
| `npm run build` | Exit 0 — Next.js 16.2.1 Turbopack build succeeded, 25 static pages generated (identical route list to pre-phase) |
| `grep -rE "from ['\"](next-intl\|@/i18n)" src/app src/components` | 0 matches — no page or component consumes the new infrastructure |
| `git diff --name-only` (at commit) | Lists only paths under `src/i18n/**` and `src/messages/**` — scope boundary held |
| `git diff src/lib/locale.ts` | Empty — I18N-07 non-regression invariant preserved |
| `src/messages/{en,ar}.json` key count | Both 14 keys with sorted-key equality — `getRequestConfig` will load either locale without runtime error |

## Requirements status

**Fully closed by Phase 12:**

| REQ-ID | Description |
| --- | --- |
| I18N-01 | `routing.ts` exports `routing` with locales `['en','ar']`, defaultLocale `'en'`, localePrefix `'always'` |
| I18N-02 | `request.ts` exports `getRequestConfig` that validates locale and loads the dictionary JSON by locale |
| I18N-03 | `navigation.ts` re-exports all 6 locale-aware helpers from `createNavigation(routing)` |
| I18N-04 | `src/messages/en.json` and `src/messages/ar.json` exist with all 14 namespace keys in both files |
| I18N-07 | `src/lib/locale.ts` byte-identical — `dirFor()`, `pickLocalized()`, `getLocale()` continue to work for bilingual DB field rendering |

**Partial (infrastructure prerequisite delivered; final wiring in Phase 13):**

| REQ-ID | Delivered now | Wiring in Phase 13 |
| --- | --- | --- |
| I18N-05 | `getRequestConfig` available for `NextIntlClientProvider` | Provider wrapping + `setRequestLocale(locale)` calls land in `[locale]/layout.tsx` |
| I18N-06 | `staticParams` helper exported from `routing.ts` | `export const generateStaticParams = () => staticParams` on the new `[locale]/layout.tsx` |

## Deviations from plan

None. All five files were already present on disk (untracked from the pre-session staging area shown in `git status`) with byte-identical content to the plan's verbatim `<action>` blocks — verified via Read before committing. No edits were needed; only verification (tsc + build + grep + diff boundary) and the atomic commit.

No Rule 1/2/3 auto-fixes triggered. No Rule 4 architectural decisions surfaced. Zero deviations.

## Phase-12 → Phase-13 handoff

Phase 13's risky route-restructure + auth-safety atomic migration now has a stable substrate to consume. Specifically:

1. **`createMiddleware(routing)` ready for `proxy.ts` composition.** Phase 13 will wrap the existing Supabase session updater + proxy logic around (or inside) `createMiddleware(routing)` to enable URL-segment locale routing.
2. **`staticParams` ready for the new `[locale]/layout.tsx`.** Phase 13 writes `export const generateStaticParams = () => staticParams` (imported from `@/i18n/routing`) so `/en/*` and `/ar/*` both pre-render.
3. **`getRequestConfig` ready for `NextIntlClientProvider` + `setRequestLocale(locale)`.** Phase 13's `[locale]/layout.tsx` will call `setRequestLocale(locale)` at the top of every page + layout and wrap children in `<NextIntlClientProvider>`.
4. **`Link` / `useRouter` / `redirect` / `usePathname` / `getPathname` / `permanentRedirect` ready for import-swap.** Phase 13 will swap the ~16 call sites across `src/app/` and `src/components/` from `next/navigation` / `next/link` to `@/i18n/navigation` — so a click in the `/ar/` segment stays in the `/ar/` segment.
5. **Arabic dictionary is an empty-object schema.** Phases 15–17 populate real keys; Phase 12's empty objects ensure `getRequestConfig` loads without runtime errors and missing-key warnings surface visibly (not as silent English fallback) during translation work.

## Byte-identical live site confirmation

Nothing consumes the new code. `grep -rE "from ['\"](next-intl|@/i18n)" src/app src/components` returns zero matches. The production build's route list (25 pages) is identical to the pre-phase route list. Deployment of this commit to Vercel produces the same rendered HTML for every current URL. The live site is, in the strictest sense, byte-identical to pre-Phase-12.

## Self-Check: PASSED

- `src/i18n/routing.ts` — FOUND (32 lines)
- `src/i18n/request.ts` — FOUND (30 lines)
- `src/i18n/navigation.ts` — FOUND (18 lines)
- `src/messages/en.json` — FOUND (16 lines, 14 keys)
- `src/messages/ar.json` — FOUND (16 lines, 14 keys)
- Commit `af2ab35` — FOUND in `git log --oneline`
- `src/lib/locale.ts` — unchanged (empty `git diff`)
- Scope boundary — only `src/i18n/**` and `src/messages/**` touched

## TDD Gate Compliance

Not applicable. Plan 12-01 `type: execute` (not `type: tdd`). Infrastructure wiring is validated by build-safety checks (tsc + next build + grep + scope diff), not by runtime tests. Runtime test coverage begins when Phase 13 wires the first consumer.
