---
phase: 13-route-restructure-auth-safety
plan: 02
subsystem: infra
tags: [i18n, proxy, middleware, supabase, auth, v1.1]

# Dependency graph
requires:
  - phase: 13-route-restructure-auth-safety
    plan: 01
    provides: "All viewer+admin pages under [locale]/, OAuth callback at /auth/callback, next-intl plugin wired, src/i18n/routing.ts exporting routing + staticParams"
provides:
  - "proxy.ts composes createMiddleware(routing) + updateSession() with cookie merge"
  - "Locale-aware coming-soon redirect (/en/coming-soon or /ar/coming-soon, never bare)"
  - "Short-circuit for /api/* and /auth/callback — no i18n processing on OAuth or API paths"
  - "Lazy checkIsAdmin() preserved — admin_user_id query runs only when comingSoonMode is on"
affects:
  - "13-03a-PLAN / 13-03b-PLAN — with proxy redirecting / → /en/, navigation-hook and Link swaps are the next closer of RTE-04"
  - "13-04-PLAN — safeNext() locale-awareness in /auth/callback is now the last open auth-safety hole"
  - "13-06-PLAN — full 10-item Vercel smoke test can now cover / → /en/, /ar/ session persistence, coming-soon locale preservation"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next-intl + Supabase proxy composition: intlResponse is the outgoing response; Supabase cookies merged onto it via supabaseResponse.cookies.getAll().forEach(c => intlResponse.cookies.set(c.name, c.value, c))"
    - "Locale-strip helper: iterate routing.locales, match /{loc} and /{loc}/... paths; fall back to routing.defaultLocale for pre-redirect paths"
    - "Redirect short-circuit: if intlResponse.status 3xx, merge cookies and return early — coming-soon gate only applies on resolved paths"

key-files:
  modified:
    - "proxy.ts — 63 → 146 lines. Adds createMiddleware(routing), stripLocale helper, /api + /auth/callback short-circuits, cookie merge, locale-aware coming-soon redirect"
  created: []
  moved: []

key-decisions:
  - "2026-04-21: Composition order is next-intl first, then Supabase session refresh. intlResponse is the outgoing response (carries redirect status for missing-prefix paths). Supabase cookies are merged onto it in all code paths (pass-through AND 3xx redirect)."
  - "2026-04-21: /auth/callback short-circuits i18n entirely — OAuth providers register this exact URL and next-intl would otherwise redirect to /en/auth/callback, breaking the OAuth handshake. /api/* short-circuits for the same locale-agnostic reason."
  - "2026-04-21: stripLocale returns routing.defaultLocale when no prefix is present — so a pre-redirect hit to / that somehow reaches the gate builds /en/coming-soon (never bare /coming-soon). In practice the 3xx short-circuit above returns before this fallback is exercised."
  - "2026-04-21: Coming-soon allowlist removed /api — /api/* now short-circuits above the gate. The allowlist is matched against pathWithoutLocale so /en/admin, /ar/admin, /en/auth, /ar/auth all bypass without duplicating entries."
  - "2026-04-21: Lazy checkIsAdmin preserved — memory confirms the ~100ms TTFB savings from deferring admin_user_id lookup to the coming-soon gate branch only. No regression."

patterns-established:
  - "Proxy composition: handleI18nRouting(request) → updateSession(request) → merge cookies → 3xx-early-return → gate → return"
  - "stripLocale(pathname) returns {locale, pathWithoutLocale} for locale-aware allowlist matching and redirect-target construction"

requirements-completed: [RTE-03, RTE-07]

# Metrics
duration: ~8min
completed: 2026-04-21
---

# Phase 13 Plan 02: Proxy Composition Summary

**proxy.ts now composes createMiddleware(routing) from next-intl with the existing Supabase updateSession(), merging cookies so / → /en/ preserves the Supabase auth cookie, and redirecting the coming-soon gate to /{locale}/coming-soon instead of bare /coming-soon — closes RTE-03 and RTE-07 in one file edit.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2/2
- **Commits:** 1 (Task 2 was a verification-only gate, no file changes)
- **Files changed:** 1 (proxy.ts rewritten)

## Accomplishments

- `createMiddleware(routing)` instantiated at module scope as `handleI18nRouting` — single allocation, per-request invocation is cheap
- `/api/*` short-circuits before any i18n work; session refresh still runs so API routes see fresh Supabase cookies
- `/auth/callback` short-circuits with the same pattern; OAuth provider callback URL is preserved byte-for-byte
- `intlResponse` is the single outgoing response; `supabaseResponse.cookies.getAll().forEach(...)` merges refreshed auth cookies onto it in EVERY code path (pass-through, 3xx redirect, coming-soon redirect)
- `stripLocale()` produces `{locale, pathWithoutLocale}` — used for allowlist matching (so `/ar/admin` passes like `/en/admin`) and for building `url.pathname = \`/${locale}/coming-soon\`` on gate redirects
- Lazy admin check preserved: `checkIsAdmin()` runs ONLY when `flags.comingSoonMode` is on — no TTFB regression for the 99% of requests where the flag is off
- `npx tsc --noEmit` exits 0
- `npm run build` green: 44 static pages (22 routes × 2 locales) prerender, `/auth/callback` + `/api/*` + `/robots.txt` + `/sitemap.xml` all emitted, no middleware/proxy errors

## Task Commits

Task 1: `5503cda` — `feat(13-02): compose next-intl middleware + Supabase session in proxy.ts`
Task 2: no commit (verification-only gate — `npx tsc --noEmit && npm run build`, both green against commit 5503cda)

## Files Created/Modified

### Modified
- `proxy.ts` — rewritten to compose next-intl + Supabase. Adds imports (`createMiddleware`, `routing`), module-scope `handleI18nRouting`, `stripLocale` helper, `/api/*` and `/auth/callback` short-circuits, cookie merge after `updateSession`, 3xx early-return, locale-aware coming-soon redirect with cookie copy to the redirect response.

## Decisions Made

- **Composition order (next-intl first, Supabase second):** next-intl owns the outgoing response shape (status, headers, and the `/ → /{defaultLocale}` redirect). Supabase cookies are merged onto it AFTER. This matches the canonical pattern in `.planning/research/SUMMARY.md` lines 108-123.
- **Cookie copy to every response, including the coming-soon redirect:** Prevents the admin's session from being silently invalidated at the moment they get redirected to the splash. `intlResponse.cookies.getAll().forEach(c => redirect.cookies.set(c.name, c.value, c))`.
- **Allowlist trimmed — removed `/api`:** The `/api/*` prefix is handled above the gate via an explicit short-circuit, so it doesn't need to be in the coming-soon allowlist. Simpler: one place for locale-agnostic paths.
- **Matcher unchanged:** The existing matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and common static asset extensions. No change needed — next-intl's internal matching narrows further via `routing.locales`.

## Deviations from Plan

None — plan executed exactly as written. The spec in `<action>` included the complete new file contents; implementation matched byte-for-byte except for standard formatting preserved on write.

## Threat Flags

None — no new network endpoints or trust-boundary changes beyond those enumerated in the plan's `<threat_model>`:
- T-13-03 (session spoofing): mitigated — `updateSession()` still uses `getUser()` which validates the JWT; cookie merge preserves the validated cookie on every response.
- T-13-04 (locale tampering): mitigated — `stripLocale()` only matches against `routing.locales` ('en'|'ar'). Invalid segments fall through to `routing.defaultLocale`.
- T-13-05 (coming-soon bypass): accepted — allowlist semantics identical to pre-phase, just matched against pathWithoutLocale.
- T-13-06 (DoS via middleware instantiation): mitigated — `createMiddleware(routing)` called once at module scope.

## User Setup Required

None — no environment variable changes, no external service configuration. Composition is entirely in-code.

## Next Phase Readiness

Ready for plans **13-03a** (navigation-hook + Server-redirect swaps) and **13-03b** (next/link swaps). Foundation is in place:

- `/ → /en/` redirect works correctly with session cookies intact (verified by code audit; Vercel preview smoke test in 13-06)
- `/ar/` paths resolve with session cookies refreshed
- `/auth/callback` preserved at its OAuth-registered URL
- Coming-soon gate preserves locale on redirect — admin hitting `/en/browse` while gated lands on `/en/coming-soon`, not bare `/coming-soon`

**Dev-server note:** `npm run dev` now resolves `/` → `/en/` and `/ar/...` paths work end-to-end. Client-side navigation via `next/link` and `useRouter` from `next/navigation` still strips the locale (fixed in 13-03a + 13-03b). OAuth `?next=/series/foo` still ignores locale (fixed in 13-04). Dead cookie-switcher files still exist (removed in 13-05). The atomic auth-safety unit closes at 13-06 after the Vercel preview smoke test.

## Verification Evidence

```
$ grep -q "createMiddleware(routing)" proxy.ts && echo OK
OK
$ grep -q "supabaseResponse.cookies.getAll" proxy.ts && echo OK
OK
$ grep -q '/${locale}/coming-soon' proxy.ts && echo OK
OK
$ grep -q "handleI18nRouting = createMiddleware" proxy.ts && echo OK
OK
$ grep -q "pathname === '/auth/callback'" proxy.ts && echo OK
OK
$ npx tsc --noEmit
(exit 0, silent)
$ npm run build
✓ Compiled successfully in 12.7s
✓ Generating static pages using 9 workers (44/44) in 160ms
```

Route listing from build output confirms:
- `ƒ /[locale]/*` — 22 dynamic locale-wrapped routes
- `ƒ /auth/callback` — still at root (OAuth URL preserved)
- `ƒ /api/cron/cleanup-media`, `ƒ /api/youtube-meta` — API routes intact
- `○ /robots.txt`, `○ /sitemap.xml` — static emission intact

## Self-Check: PASSED

- `proxy.ts` contains `createMiddleware(routing)` — confirmed
- `proxy.ts` contains `supabaseResponse.cookies.getAll().forEach` — confirmed
- `proxy.ts` contains `/${locale}/coming-soon` template literal — confirmed
- `proxy.ts` contains `pathname === '/auth/callback'` short-circuit — confirmed
- `proxy.ts` contains `pathname.startsWith('/api/')` short-circuit — confirmed
- Commit `5503cda` present in `git log` — confirmed
- `npx tsc --noEmit` exit 0 — confirmed
- `npm run build` exit 0 with 44 static pages — confirmed

---
*Phase: 13-route-restructure-auth-safety*
*Completed: 2026-04-21*
