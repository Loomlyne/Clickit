---
phase: 05-accounts-and-email
plan: 40
subsystem: auth-wall
tags: [wall, requireViewer, defence-in-depth, server-components, tdd, security]
requires: ["05-02", "05-18"]
provides: [viewerAccess, requireViewer]
affects: [05-26, 05-31]
tech-stack:
  added: []
  patterns: ["pure decision on the one wall table plus a thin server-only helper", "wall check joins the page's first Promise.all wave so it adds no round trip"]
key-files:
  created:
    - src/server/auth/viewer-access.ts
    - src/server/auth/require-viewer.ts
    - tests/unit/viewer-access.test.ts
  modified:
    - src/app/[locale]/(viewer)/about/page.tsx
    - src/app/[locale]/(viewer)/series/[slug]/page.tsx
    - src/app/[locale]/(viewer)/updates/page.tsx
    - src/app/[locale]/(viewer)/my-list/page.tsx
    - src/app/[locale]/(viewer)/watch/page.tsx
    - src/app/[locale]/(watch)/watch/[episodeId]/page.tsx
key-decisions:
  - "viewerAccess(path, userId) is isPublicPath -> pass, signed out -> auth with the raw path as next, else pass; a test proves it agrees with decideRoute for every walled and public path, signed in and out"
  - "requireViewer returns { userId, user } (the plan said { userId }): series needs user.email for the review name fallback and updates needs it for the form default, so no second getUser"
  - "On watch, series and the episode page requireViewer runs inside the existing first Promise.all wave instead of an await before it: a signed-out visitor rejects the wave with the redirect before notFound(), any user read or render; the public catalog reads that start in parallel are never rendered"
  - "Redirect locale is the URL locale (params.locale on series and episode, next-intl getLocale on the others), not the NEXT_LOCALE cookie"
  - "AUTH-01 stays Pending: the end-to-end wall proof is 05-31 and profile is wired by 05-26"
requirements-completed: []
duration: 10min
completed: 2026-10-26
---

# Phase 5 Plan 40: Page-level requireViewer wall Summary

**The proxy is no longer the only wall. Six walled viewer pages call `requireViewer()` on the server: about, series, updates, my-list, watch and the episode page. The helper does a server-verified `getUser()` and sends a signed-out visitor to `/{locale}/auth?next=<encoded own path>`. The decision is one pure function, `viewerAccess`, built on the 05-02 wall table and tested to match the proxy's `decideRoute`.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 RED | Failing tests for viewerAccess and requireViewer | `a04d7dae` |
| 1 GREEN | `viewer-access.ts`, `require-viewer.ts` | `6c0a7a87` |
| 2 | Six walled pages call requireViewer | `b3296dd6` |

## What was built

- **`src/server/auth/viewer-access.ts`**: a pure module whose only import is `./wall.ts`. `viewerAccess(pathWithoutLocale, userId)` returns `{ action: 'pass' }` or `{ action: 'auth', next }`. An empty or non-string user id counts as signed out.
- **`src/server/auth/require-viewer.ts`**: marked `server-only`. `requireViewer(locale, pathWithoutLocale)` works in four steps:
  1. Creates the client with `createClient()` from `@/lib/supabase/server`.
  2. Calls `auth.getUser()`, which is server-verified (not `getClaims()` or `getSession()`).
  3. Runs `viewerAccess`.
  4. If the visitor is signed out, calls the next-intl `redirect({ href: '/auth?next=' + encodeURIComponent(path), locale })`. Otherwise it returns `{ userId, user }`.

  The doc comment repeats the 05-19 rule: any caller that wraps it in try/catch must call `unstable_rethrow(e)` first. None of the six pages wraps it.
- **Page-level check per path.** Each page passes its own static or concrete path, never a value from the query string:

| Path | Page | What changed |
|------|------|--------------|
| `/about` | `(viewer)/about/page.tsx` | one `await requireViewer(await getLocale(), '/about')` before the translations |
| `/series/${slug}` | `(viewer)/series/[slug]/page.tsx` | first wave; `userPromise` gone; user reads always run with `userId`; review name uses `user.email` |
| `/updates` | `(viewer)/updates/page.tsx` | own `getUser` replaced; form default is `user.email` |
| `/my-list` | `(viewer)/my-list/page.tsx` | old `getUser` + `redirect('/auth?next=/my-list')` block replaced |
| `/watch` | `(viewer)/watch/page.tsx` | `getUser()` in the first wave replaced; the signed-out `HeroBanner` branch dropped (always `FeaturedHeroWithWatched` in Suspense) |
| `/watch/${episodeId}` | `(watch)/watch/[episodeId]/page.tsx` | first wave; user reads always run with `userId` |

Public pages (privacy, support, portfolio, legal, auth, unsubscribe, newsletter confirm, coming-soon), every `generateMetadata`, and the browse page are not touched. Profile is wired by 05-26.

## Verification

- Task 1 verify: `node --test tests/unit/viewer-access.test.ts tests/unit/wall-policy.test.ts tests/unit/proxy-gate.test.ts` gave 32 pass and 0 fail. RED was confirmed first (`ERR_MODULE_NOT_FOUND`). `grep -cE "from '(@/|server-only|next)" src/server/auth/viewer-access.ts` printed 0.
- Task 2 verify (`tsc --noEmit`, six pages contain `requireViewer(`, none in privacy/support/portfolio) exited 0.
- `npx eslint` on all 9 files: clean.
- `npm run test:unit`: 2661 pass, 0 fail.
- `npx tsc --noEmit`: exit 0.
- `npm run build && npm run cf:build && npm run cf:bundle-budget` ran detached under the heavy lock (log `/Users/koss/.clickit-checks/p5-0540-build.log`) and exited 0. All six routes build as dynamic (`ƒ`). Worker size is **2,975.11 KiB gzip (+0.77 KiB), 24.89 KiB headroom** under 3,000 KiB.

## Not verified

- No request against a running app and no Playwright run. 05-31's auth-wall spec (run later) is the end-to-end proof that every path above redirects signed out at page level too.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoided] requireViewer also returns the user object**
- **Found during:** Task 2
- **Issue:** the plan returns `{ userId }` and says to fetch the user again if more fields are needed. Series (review name fallback) and updates (email default) both need `user.email`. A second `getUser()` would add an Auth round trip per page.
- **Fix:** the return type is `{ userId: string; user: User }`, a superset of the plan's shape.
- **Commit:** 6c0a7a87

**2. [Rule 1 - Performance kept] The wall check stays in the first wave**
- **Found during:** Task 2
- **Issue:** the plan says to add the call "before any data read". On watch, series and the episode page, the auth check already ran inside the first `Promise.all` on purpose (the #25 speed work). Awaiting it first would put one Supabase Auth round trip in front of every catalog query.
- **Fix:** `requireViewer(...)` replaces `getUser()` inside the same wave. A signed-out request rejects the wave with the redirect. That happens before `notFound()`, before the scheduling redirect, before any user-specific read and before anything renders. Public catalog reads that started in parallel are thrown away. Comments in each page say so.
- **Commit:** b3296dd6

**3. [Rule 1] Redirect uses the URL locale**
- **Found during:** Task 2
- **Issue:** series and the episode page read the content locale from the `NEXT_LOCALE` cookie (`@/lib/locale-server`). The sign-in redirect should stay in the URL's locale.
- **Fix:** both pages add `locale` to their `params` type and pass `params.locale`. The other four use next-intl `getLocale()`, which is the request locale. The cookie-based content locale is unchanged.
- **Commit:** b3296dd6

## Requirements

AUTH-01 stays Pending. This plan adds the page-level fence. The end-to-end proof is 05-31, and profile comes in 05-26.

## Known Stubs

None.

## Threat Flags

None. T-05-40-01..03 are mitigated as planned:
- **T-05-40-01:** server `getUser` on every walled page, using the same table as the proxy (agreement test).
- **T-05-40-02:** `next` is built from the page's own path and URL-encoded, never taken from the query string.
- **T-05-40-03:** every public path passes signed out (test), and the public pages are untouched.

## Self-Check: PASSED

- FOUND: src/server/auth/viewer-access.ts, src/server/auth/require-viewer.ts, tests/unit/viewer-access.test.ts
- FOUND commits: a04d7dae, 6c0a7a87, b3296dd6
