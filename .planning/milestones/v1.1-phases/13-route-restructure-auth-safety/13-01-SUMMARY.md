---
phase: 13-route-restructure-auth-safety
plan: 01
subsystem: infra
tags: [i18n, next-intl, app-router, route-restructure, nextjs-16, v1.1]

# Dependency graph
requires:
  - phase: 12-i18n-infrastructure
    provides: "routing.ts (staticParams), request.ts (getRequestConfig), navigation.ts, messages/{en,ar}.json, dirFor()"
provides:
  - "All 22 viewer+admin routes live under [locale]/"
  - "OAuth callback relocated to locale-agnostic src/app/auth/callback/route.ts"
  - "src/app/[locale]/layout.tsx owns <html>/<body>, wraps NextIntlClientProvider, calls setRequestLocale, exports generateStaticParams"
  - "Root src/app/layout.tsx slimmed to 15-line pass-through"
  - "next-intl plugin (createNextIntlPlugin) wired into next.config.ts"
  - "44 static pages prerender across both /en/ and /ar/ variants"
affects:
  - "13-02-PLAN (proxy composition runs against the [locale] tree)"
  - "13-03a-PLAN (useRouter/usePathname/Server-redirect swaps)"
  - "13-03b-PLAN (next/link swaps)"
  - "13-04-PLAN (safeNext locale extension in auth/callback/route.ts)"
  - "13-05-PLAN (sitemap alternates.languages, dead-code deletion)"
  - "14-* (RTL CSS + Cairo polish)"
  - "15-* + 16-* (translation extraction)"

# Tech tracking
tech-stack:
  added:
    - "next-intl plugin (createNextIntlPlugin) registered in next.config.ts"
  patterns:
    - "[locale] dynamic segment wraps every page; root layout is pass-through"
    - "<html>/<body> owned by [locale]/layout.tsx (not root) — single source for lang/dir from URL"
    - "OAuth callback preserved at locale-agnostic path — providers register exact URL"
    - "generateStaticParams in [locale]/layout.tsx re-exports staticParams from @/i18n/routing"

key-files:
  created:
    - "src/app/[locale]/layout.tsx — 164 lines: NextIntlClientProvider + setRequestLocale + generateStaticParams + metadata + analytics"
  modified:
    - "src/app/layout.tsx — slimmed from 148 → 15 lines (pass-through)"
    - "next.config.ts — added createNextIntlPlugin wrapper"
    - "19 component files — import paths repointed from @/app/(admin|viewer)/* to @/app/[locale]/(admin|viewer)/*"
  moved:
    - "src/app/(viewer)/auth/callback/route.ts → src/app/auth/callback/route.ts"
    - "src/app/(viewer)/** → src/app/[locale]/(viewer)/** (31 files)"
    - "src/app/admin/** → src/app/[locale]/admin/** (7 files)"

key-decisions:
  - "2026-04-21: next-intl plugin (createNextIntlPlugin) IS required in next.config.ts — Phase 12's assumption that v4 auto-detects src/i18n/request.ts was incorrect; build fails without the plugin once any layout awaits getMessages()."
  - "2026-04-21: <html>/<body> ownership moved to [locale]/layout.tsx (root layout returns {children} verbatim). Matches next-intl v4 canonical pattern; lets URL segment drive lang/dir without cookie read."
  - "2026-04-21: git mv used for all 39 route moves to preserve blame history. git log --follow confirms 290-line history on (viewer)/browse/page.tsx survives the move."
  - "2026-04-21: generateStaticParams emits both {locale:'en'} and {locale:'ar'} variants at build — both prerender in a single build pass."

patterns-established:
  - "Route-tree restructure: create [locale]/ skeleton → git mv groups under it → create [locale]/layout.tsx → slim root layout → fix stale @/app/* imports"
  - "next-intl plugin wiring: createNextIntlPlugin() wraps withBotId(nextConfig) — order matters (plugins apply left-to-right when chained)"
  - "hasLocale(routing.locales, param) + notFound() guard rejects arbitrary /xx/foo paths before setRequestLocale is called"

requirements-completed: [RTE-01, RTE-02, I18N-05, I18N-06]

# Metrics
duration: ~35min
completed: 2026-04-21
---

# Phase 13 Plan 01: Route Restructure Foundation Summary

**All viewer+admin pages moved under src/app/[locale]/, new [locale]/layout.tsx owns html/body with NextIntlClientProvider + setRequestLocale + generateStaticParams, root layout slimmed to 15-line pass-through, OAuth callback relocated to locale-agnostic /auth/callback, next-intl plugin wired — 44 static pages prerender across /en/ and /ar/ variants.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-21T17:20:00Z (approx)
- **Completed:** 2026-04-21T17:55:00Z (approx)
- **Tasks:** 5/5
- **Commits:** 5 (one per task, atomic)
- **Files changed:** ~62 (39 git-mv renames + 1 created + 1 slimmed + 1 config + 19 import-path fixes)

## Accomplishments

- Route tree restructured: 22 routes now live under /[locale]/ prefix (was at root)
- OAuth callback relocated to src/app/auth/callback/route.ts so the Phase-13 tree move does not sweep it into a locale-prefixed path — OAuth providers (Google, etc.) are registered against this exact URL
- [locale]/layout.tsx is now the sole owner of <html>/<body>, with lang={locale} + dir={dirFor(locale)} driven by the URL segment (not a cookie) — canonical next-intl v4 pattern
- Root layout.tsx slimmed from 148 lines to 15 lines; the only purpose is to satisfy Next.js's "root layout must exist" rule
- generateStaticParams returns both {locale:'en'} and {locale:'ar'}; build log confirms 44 static pages prerender
- Blame history preserved across every route move (git mv with rename-detection; verified via git log --follow on (viewer)/browse/page.tsx — 290 lines)
- npx tsc --noEmit: clean
- npm run build: green; all 22 [locale] routes + /auth/callback + /api/** + /robots.txt + /sitemap.xml resolve

## Task Commits

Each task was committed atomically (no --no-verify):

1. **Task 1: Relocate OAuth callback out of (viewer)** — `733c8f4` (refactor)
2. **Task 2: git-mv (viewer)/ + admin/ under [locale]/** — `e857d21` (refactor)
3. **Task 3: Create [locale]/layout.tsx** — `888bda9` (feat)
4. **Task 4: Slim root layout.tsx to pass-through** — `b246eba` (refactor)
5. **Task 5: Wire next-intl plugin + fix 19 stale import paths** — `b3234c6` (fix)

## Files Created/Modified

### Created
- `src/app/[locale]/layout.tsx` — 164 lines. NextIntlClientProvider, setRequestLocale, generateStaticParams, Metadata/Viewport, Analytics/SpeedInsights/Toaster, GA/Meta Pixel scripts, skip-link, Cairo + Plus Jakarta Sans activation.

### Modified
- `src/app/layout.tsx` — 148 → 15 lines. Returns `{children}` with JSDoc explaining split.
- `next.config.ts` — imports `createNextIntlPlugin`, wraps the default export as `withBotId(withNextIntl(nextConfig))`.
- 19 component files repoint imports:
  - `src/components/admin/*` (15 files): `@/app/admin/actions` → `@/app/[locale]/admin/actions`
  - `src/components/auth/login-form.tsx`, `signup-form.tsx`: `@/app/(viewer)/auth/actions` → `@/app/[locale]/(viewer)/auth/actions`
  - `src/components/profile/avatar-upload.tsx`, `profile-form.tsx`: `@/app/(viewer)/profile/actions` → `@/app/[locale]/(viewer)/profile/actions`

### Moved (git mv, blame preserved)
- `src/app/(viewer)/auth/callback/route.ts` → `src/app/auth/callback/route.ts` (out of route group to stay locale-agnostic)
- `src/app/(viewer)/**` (31 files) → `src/app/[locale]/(viewer)/**`
- `src/app/admin/**` (7 files) → `src/app/[locale]/admin/**`

### Left untouched at src/app/ root (intentionally locale-agnostic)
- `api/` (API routes — locale-agnostic by convention)
- `auth/callback/route.ts` (moved here in Task 1)
- `locale-actions.ts` (deleted in 13-05)
- `not-found.tsx` (root 404 handler)
- `robots.ts`, `sitemap.ts`, `favicon.ico`

## Decisions Made

- **next-intl plugin IS required:** Phase 12 STATE.md noted "v4 auto-detects src/i18n/request.ts". The Task 5 build gate proved this wrong: without `createNextIntlPlugin()` in next.config.ts, the build fails with `Couldn't find next-intl config file` at prerender time (error surfaces when `[locale]/layout.tsx` awaits `getMessages()`). Added the plugin (3 LOC addition to next.config.ts) — documented as a Rule 3 deviation.
- **Plugin composition order:** `withBotId(withNextIntl(nextConfig))` — next-intl wraps the raw config, then BotID wraps that. Tested: build green.
- **Import-path sweep approach:** Used a `sed` one-liner across 19 files to rewrite the three stale import-path prefixes in a single pass, rather than 19 separate Edits. Commit shows the batch as a single logical change alongside the plugin wiring.
- **Did NOT delete empty (viewer)/auth/callback/ directory via `git rm`:** git mv left it empty; `rmdir` removed the local directory. Git had already recorded the rename from the Task 1 move so no additional git action was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] next-intl plugin missing from next.config.ts**
- **Found during:** Task 5 (build gate)
- **Issue:** `npm run build` failed at prerender: `Error: Couldn't find next-intl config file. Please follow the instructions at https://next-intl.dev/docs/getting-started/app-router`. Phase 12's handoff said v4 auto-detects `src/i18n/request.ts`; the build gate disproved this.
- **Fix:** Verified via Context7 (`/amannn/next-intl` docs) that `createNextIntlPlugin()` MUST wrap `nextConfig`. Added import + wrapper composition: `withBotId(withNextIntl(nextConfig))`.
- **Files modified:** `next.config.ts`
- **Verification:** `npm run build` exits 0; 44 static pages prerender across /en/ and /ar/ variants.
- **Committed in:** `b3234c6` (Task 5 commit)

**2. [Rule 3 - Blocking] 19 component files import from stale @/app/* paths**
- **Found during:** Task 5 (tsc)
- **Issue:** Task 2's `git mv` moved `admin/actions.ts` and `(viewer)/{auth,profile}/actions.ts` under `[locale]/`. 19 component files still imported from the old paths:
  - `@/app/admin/actions` (15 admin component files)
  - `@/app/(viewer)/auth/actions` (login-form, signup-form)
  - `@/app/(viewer)/profile/actions` (avatar-upload, profile-form)
  - Plan did not enumerate this remediation — the plan narrative treated Tasks 2-4 as "one atomic unit" but the three action files are referenced from outside the moved tree.
- **Fix:** Single `sed -i ''` sweep across the 19 files rewriting all three path prefixes to `@/app/[locale]/...`. No behavior change; purely mechanical path update.
- **Files modified:** 19 component files (listed above)
- **Verification:** `grep -rE '@/app/(admin|\(viewer\))/' src` → zero matches. tsc clean. Build green.
- **Committed in:** `b3234c6` (Task 5 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking). Both necessary for Task 5's build gate to pass. No scope creep — plugin wiring + import-path fix are both minimum-needed work to satisfy the plan's own success criteria (`npm run build` exits 0).

**Impact on plan:** Plan success criteria hold unchanged. The plugin wiring retroactively patches a Phase 12 oversight (STATE.md decision "No `createNextIntlPlugin()` added to `next.config.ts`" is now invalidated — see note in Next Phase Readiness).

## Issues Encountered

- **Stale `.next/types/validator.ts` from the pre-move build:** The initial `tsc --noEmit` run after Task 4 surfaced 23 errors against stale `.next/types/validator.ts` entries referencing the old paths (e.g., `../../src/app/(viewer)/browse/page.js`). These were build-artifact cache errors, not real code errors. Resolved by `rm -rf .next` before the re-check. Not a deviation — purely a build-artifact invalidation.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes beyond those enumerated in the plan's `<threat_model>`. The `hasLocale` + `notFound()` guard (T-13-01) is present in `[locale]/layout.tsx`. OAuth callback path (T-13-02) is preserved verbatim at `src/app/auth/callback/route.ts`.

## User Setup Required

None — no external service configuration required for this plan. Phase 13-02 through 13-06 build on this restructure; final Vercel preview smoke-test happens at 13-06.

## Next Phase Readiness

Ready for plan **13-02 (Proxy composition)**. Foundation is in place:

- All routes resolve under /[locale]/ at build time (confirmed by build log)
- next-intl plugin is wired; `getMessages()` + `setRequestLocale()` resolve correctly
- OAuth callback is at the locale-agnostic path — proxy.ts must short-circuit `/auth/callback` AND `/api/**` without wrapping them in locale redirects
- `src/app/locale-actions.ts` + `src/components/layout/locale-switcher.tsx` + `src/components/profile/language-preference.tsx` remain as dead code (deleted in 13-05 per plan)

**Correction for STATE.md:** Phase 12's decision "No `createNextIntlPlugin()` added to `next.config.ts`; next-intl v4 auto-detects `src/i18n/request.ts`" is invalidated by this plan. The plugin IS required; Phase 12's layout was just never exercised (no page called `getMessages()`). STATE.md Decision log should be updated accordingly.

**Dev-server note:** Running `npm run dev` after this plan will show ALL pages under `/[locale]/...`. The bare root `/` will 404 until plan 13-02 adds the next-intl middleware to redirect `/` → `/en/`. This is expected intermediate state.

## Self-Check: PASSED

- `src/app/[locale]/layout.tsx` exists (164 lines, contains NextIntlClientProvider + setRequestLocale + generateStaticParams + `<html lang={locale} dir={dir}>`) — confirmed
- `src/app/auth/callback/route.ts` exists at locale-agnostic path — confirmed
- `src/app/(viewer)/` and `src/app/admin/` no longer exist at old paths — confirmed
- `src/app/layout.tsx` wc -l = 16 (< 25 threshold) — confirmed
- Commits 733c8f4, e857d21, 888bda9, b246eba, b3234c6 all present in `git log` — confirmed
- `npx tsc --noEmit` clean — confirmed
- `npm run build` exits 0 with 22 routes under /[locale] + /auth/callback + /api/** + robots + sitemap — confirmed

---
*Phase: 13-route-restructure-auth-safety*
*Completed: 2026-04-21*
