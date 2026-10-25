---
phase: 05-accounts-and-email
plan: 18
subsystem: auth-proxy
tags: [wall, admin-mfa, proxy, middleware, tdd, security]
requires: ["05-02", "05-03", "05-13", "05-15"]
provides: [decideRoute, updateSession claims, checkIsAdmin = rpc am_i_admin, /auth/confirm i18n bypass]
affects: [05-21, 05-22, 05-25, 05-30, 05-31, 05-32, 05-40]
tech-stack:
  added: []
  patterns: ["pure routing decision over a lazy isAdmin port; proxy only maps decisions to redirects"]
key-files:
  created:
    - src/server/auth/gate.ts
    - tests/unit/proxy-gate.test.ts
  modified:
    - src/proxy.ts
    - src/lib/supabase/middleware.ts
key-decisions:
  - "decideRoute order: admin path first (signed out -> auth; no admins row -> watch; decideAdminMfa != ok -> mfa; else pass), then isPublicPath -> pass, then signed out -> auth, else pass"
  - "A throwing isAdmin() fails closed to watch inside decideRoute (checkIsAdmin already returns false on RPC errors; the catch covers any other port)"
  - "Null claims on an admin path go to mfa (decideAdminMfa on {} fails closed)"
  - "next stays the path without locale and without query string, as before; the proxy URL-encodes it"
  - "AUTH-01 and AUTH-06 stay Pending: AUTH-01 continues in 05-22/05-30/05-31/05-40; the /{locale}/auth/mfa page is not built yet (05-25)"
requirements-completed: []
duration: 4min
completed: 2026-10-25
---

# Phase 5 Plan 18: Wall and admin MFA redirect in the proxy Summary

**`src/proxy.ts` Step 5 now runs one pure, tested `decideRoute`: signed-out visitors on any non-public page get a 307 to `/{locale}/auth?next=<encoded>`; on `/admin/*` a non-admin goes to `/watch` and an admin without aal2 plus a TOTP from the last 12 hours goes to `/{locale}/auth/mfa?next=<encoded>`. The decision uses only the claims `getClaims()` already verified, plus one `am_i_admin` RPC on admin paths.**

## Tasks

1. decideRoute (TDD). RED `7c4f277a` (module absent), GREEN `96260f43`. 12 tests cover every behaviour row in the plan, plus: `/about` and `/watch` walled, unknown and empty path fail closed, `/administrator` is not an admin path, null claims on `/admin` -> mfa, a rejecting `isAdmin` -> watch, and `isAdmin` never called off `/admin` or while signed out.
2. Proxy and updateSession (`3ac9e942`).
   - `middleware.ts`: `SessionResult` gains `claims: { sub, aal, amr } | null` (from the existing `getClaims()` call; null when unconfigured or signed out); `checkIsAdmin` is `supabase.rpc('am_i_admin')` -> `data === true`, errors and throws -> false, logged `[proxy] am_i_admin failed`. The `app_config.admin_user_id` query is gone.
   - `proxy.ts`: `/auth/confirm` joins the root `/auth/callback` i18n bypass; `/unsubscribe` and `/newsletter` join `COMING_SOON_ALLOWLIST`; `PUBLIC_ALLOWLIST`, `SKIP_PROTECTED_ALWAYS`, `isWatchPath`, `isAuthRequiredDespiteSkip` and the `authAllowSkip` read are deleted; Step 5 maps `auth` / `mfa` / `watch` through `redirectWithCookies`. Steps 1-4 and the locale-root 308 are unchanged. No BotID code was present.

## Verification

- `node --test tests/unit/proxy-gate.test.ts tests/unit/wall-policy.test.ts`: 24/24 pass.
- Task 2 verify command: `tsc --noEmit` clean, the four removed names absent, `decideRoute(`, `/auth/confirm`, `am_i_admin` present, no `admin_user_id` in middleware -> exit 0.
- `grep -n "encodeURIComponent(next)" src/proxy.ts`: two lines (170, 177).
- eslint on the three source files and the test: clean.
- Full `npm run test:unit`: 2267/2267 pass (includes the locale-root source test that checks the 308 stays before `Step 5: Auth gate`).

## Not verified

- No build, no Playwright, no request against a running app (end-to-end wall proof is 05-31).
- `/{locale}/auth/mfa` does not exist yet: until 05-25 lands, an admin without a fresh TOTP is redirected to a page that 404s (the admin layout from 05-15 already redirects there too).
- `/auth/confirm` has no root route yet (05-21/05-23 build it); the bypass is in place for it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] isAdmin rejection fails closed**
- **Found during:** Task 1
- **Issue:** the plan's `decideRoute` signature takes any `isAdmin()` port; a rejecting port would have made the proxy throw (500) instead of denying.
- **Fix:** `decideRoute` catches and treats it as not admin (`watch`); test row added. `checkIsAdmin` also catches throws, not only `{ error }`.
- **Files modified:** src/server/auth/gate.ts, src/lib/supabase/middleware.ts, tests/unit/proxy-gate.test.ts
- **Commit:** 96260f43, 3ac9e942

**2. [Rule 2] Empty-string sub treated as signed out**
- **Found during:** Task 2
- **Issue:** `claims.sub ?? null` would pass `''` through as a user id.
- **Fix:** `userId` is the sub only when it is a non-empty string; `decideRoute` applies the same check.
- **Commit:** 96260f43, 3ac9e942

## Requirements

AUTH-01 and AUTH-06 stay Pending (see key-decisions). This plan enforces both at the edge; the sign-in return path, the skip-setting removal, the end-to-end proof, page-level `requireViewer()` and the `/auth/mfa` page come in later plans.

## Known Stubs

None.

## Threat Flags

None. T-05-18-01..04 mitigated as planned: fail-closed table plus tested decideRoute; aal2 + 12 h freshness in the proxy with requireAdmin re-checking in layout and actions; `next` URL-encoded same-site path (consumers validate with getSafeAuthNextPath); claims only, one RPC only on `/admin` paths.

## Self-Check: PASSED

- FOUND: src/server/auth/gate.ts, tests/unit/proxy-gate.test.ts
- FOUND commits: 7c4f277a, 96260f43, 3ac9e942
