---
phase: 13-route-restructure-auth-safety
plan: 03a
subsystem: i18n / routing
tags: [i18n, navigation, client-components, server-components, v1.1]
requires:
  - 13-01 (route restructure, [locale]/ tree)
  - 13-02 (proxy composition, locale-aware middleware)
provides:
  - locale-preserving client navigation (useRouter/usePathname) in 14 files
  - locale-aware Server Component redirects in 5 files
affects:
  - RTE-04 (navigation-hook half, closed for these files)
  - RTE-05 (Server-redirect half, closed)
tech-stack:
  added: []
  patterns:
    - "next-intl Server `redirect({ href, locale })` signature (object, not string)"
    - "`return redirect(...)` in auth guards for TS narrowing"
    - "getLocale from 'next-intl/server' for URL-driven locale in Server Components"
key-files:
  created: []
  modified:
    - src/hooks/use-likes.ts
    - src/hooks/use-watchlist.ts
    - src/components/layout/auth-section.tsx
    - src/components/layout/user-dropdown.tsx
    - src/components/layout/nav-links.tsx
    - src/components/layout/mobile-nav.tsx
    - src/components/auth/login-form.tsx
    - src/components/auth/signup-form.tsx
    - src/components/auth/reset-password-form.tsx
    - src/components/profile/profile-header.tsx
    - src/components/watch/watch-page-content.tsx
    - src/components/admin/admin-header.tsx
    - src/components/admin/season-tabs.tsx
    - src/app/[locale]/(viewer)/design-system/layout.tsx
    - src/app/[locale]/(viewer)/design-system/page.tsx
    - src/app/[locale]/(viewer)/my-list/page.tsx
    - src/app/[locale]/(viewer)/browse/page.tsx
    - src/app/[locale]/(viewer)/profile/page.tsx
    - src/app/[locale]/admin/layout.tsx
decisions:
  - "Server-side `redirect` from `@/i18n/navigation` takes `{ href, locale }` object (not bare string) — signature difference vs client `useRouter().push`. Locale comes from `getLocale()` of `next-intl/server`, which reads the request's URL-driven locale (after `setRequestLocale` runs in the `[locale]/layout.tsx`)."
  - "Auth guards rewritten to `if (!user) { const locale = await getLocale(); return redirect({ href, locale }) }` — the `return` narrows `user` to non-null for the rest of the function body, resolving TS18047 strictness errors that surfaced once the import swap changed the return-type semantics."
metrics:
  duration: "~10 minutes"
  completed: 2026-04-21
---

# Phase 13 Plan 03a: Navigation Hooks + Server Redirects Summary

**One-liner:** Swapped 10 `useRouter`, 4 `usePathname`, and 5 Server Component `redirect` imports from `next/navigation` to `@/i18n/navigation` so every path-based navigation in the listed files auto-preserves the active locale.

## What Shipped

- **10 useRouter swaps** (Task 1, commit 82c6735) — auth forms, layout, watch page, admin season tabs, watchlist/likes hooks, profile header, user dropdown.
- **4 usePathname swaps** (Task 2, commit b9cb442) — mobile-nav, nav-links, admin-header, design-system layout. Active-link comparisons confirmed to use locale-stripped paths (e.g. `/admin`, `/browse`) which is what `@/i18n/navigation.usePathname` returns.
- **5 Server redirect swaps** (Task 3, commit 2740da6) — browse, profile, my-list, design-system pages + admin layout. All 6 redirect call sites (admin layout has 2) now route through locale-aware helper.
- **Server redirect API adaptation** (Task 4, commit 9b079ba) — call sites converted from `redirect('/path')` to `redirect({ href: '/path', locale })`. `getLocale()` added from `next-intl/server`. `return` prepended to narrow `user` after auth guards.

## Verification

- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0, 44 routes generated.
- Scoped grep (`from 'next/navigation'` outside `notFound` / `auth/callback/route.ts`) returns only `locale-switcher.tsx` and `language-preference.tsx`, both explicitly exempted by the plan (replaced in 13-05).
- `grep -c "from '@/i18n/navigation'"` returns 19 new matches across scope files.
- `notFound` imports preserved in 4 files (`[locale]/layout.tsx`, `series/[slug]/page.tsx`, `watch/[episodeId]/page.tsx`, `admin/shows/[id]/page.tsx`) — correct per plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] next-intl Server `redirect` requires object signature**
- **Found during:** Task 4 (build gate)
- **Issue:** `tsc` rejected `redirect('/auth')` — next-intl's Server-side `redirect` type is `(args: { href, locale, forcePrefix? }) => never`, not `(url: string) => never` as the plan's diff examples implied.
- **Fix:** Each call site now:
  - imports `getLocale` from `next-intl/server`
  - awaits `getLocale()` inside the redirect branch
  - calls `redirect({ href, locale })`
- **Files modified:** browse/page.tsx, my-list/page.tsx, profile/page.tsx, design-system/page.tsx, admin/layout.tsx
- **Commit:** 9b079ba

**2. [Rule 3 - Blocking] `user possibly null` TS narrowing regression**
- **Found during:** Task 4 (build gate) — surfaced as TS18047 on ~9 call sites downstream of auth guards
- **Issue:** Before the swap, `redirect(...)` was a single statement returning `never` (TS narrowed `user` on the fall-through path). Splitting the guard into a brace block with `const locale = await getLocale(); redirect(...)` broke that narrowing because TS control-flow analysis is conservative about multi-statement blocks.
- **Fix:** Added explicit `return` before each `redirect(...)` call in auth guards. `redirect` returns `never`, so `return redirect(...)` keeps the branch unreachable and lets TS narrow `user` for the rest of the function.
- **Files modified:** my-list/page.tsx, profile/page.tsx, admin/layout.tsx (two guards)
- **Commit:** 9b079ba

**3. [Not a deviation — planned exemption] `DesignSystemPage` converted to async**
- The function signature `export default function DesignSystemPage()` became `export default async function DesignSystemPage()` to allow `await getLocale()`. Safe in App Router Server Components.

## Auth Gates

None encountered. No secrets or external credentials involved.

## Known Stubs

None.

## Self-Check: PASSED

- All 19 listed files contain `from '@/i18n/navigation'` — verified via grep.
- None of the 19 files contain the residual `useRouter`/`usePathname`/`redirect` from `next/navigation` — verified.
- All 4 commits exist in git log: 82c6735, b9cb442, 2740da6, 9b079ba.
- Build green, tsc clean.

## Hand-off Notes for 13-03b

- Files shared with 13-03b (will receive `next/link` swap on top of the import added today):
  - `src/components/layout/auth-section.tsx` (already imports `useRouter` from `@/i18n/navigation`; 13-03b will add `Link` to the same import line or a second import)
  - `src/components/layout/nav-links.tsx`
  - `src/components/layout/mobile-nav.tsx`
  - `src/components/watch/watch-page-content.tsx`
- `locale-switcher.tsx` and `language-preference.tsx` remain untouched per plan note — deferred to plan 13-05 (language settings overhaul).
- `src/app/auth/callback/route.ts` still imports `NextResponse.redirect` — that's HTTP-level, plan 13-04 handles safeNext locale awareness.
