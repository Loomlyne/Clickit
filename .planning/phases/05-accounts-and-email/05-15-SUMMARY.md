---
phase: 05-accounts-and-email
plan: 15
subsystem: auth
tags: [admin, requireAdmin, totp, mfa, aal2, admins-table, server-only, phase-6-contract]
requires: ["05-03", "05-13"]
provides: [resolveAdminAccess (pure), requireAdmin, requireAdminUser (wrapper), getAdminStatus, AdminAccessError, assertAdmin = requireAdmin, requireAdminForYouTube = requireAdmin, admin layout /auth/mfa redirect, navbar am_i_admin]
affects: [05-17, 05-18, 05-21, 05-22, 05-25, 05-26, 05-27, 05-32]
tech-stack:
  added: []
  patterns: ["pure decision over ports + thin server-only wrapper (node:test covers the decision, source invariants cover the wrapper)", "typed error code drives redirects; messages stay generic"]
key-files:
  created:
    - tests/unit/admin-access.test.ts
  modified:
    - src/server/admin-access.ts
    - src/server/auth-guards.ts
    - src/app/[locale]/admin/actions.ts
    - src/app/[locale]/admin/layout.tsx
    - src/components/layout/auth-section.tsx
    - tests/unit/media-upload-source.test.ts
    - tests/unit/admin-actions-youtube-wrappers.test.ts
    - tests/unit/design-system-page.test.ts
key-decisions:
  - "resolveAdminAccess order: claims (sub required) -> getUser (throw or null or id mismatch = not_signed_in) -> admins row (every call) -> decideAdminMfa -> listFactors only when MFA is not ok"
  - "findAdmin / hasVerifiedTotp errors propagate (fail closed): requireAdmin throws a plain Error, so the admin layout sends the user to /watch and actions return { success: false }"
  - "AdminAccessError messages: 'Unauthorized' (not_signed_in, not_admin), 'Admin verification required' (needs_enrol, needs_code)"
  - "getAdminStatus: non-throwing; a lookup error reports isAdmin false and signedIn from a separate getUser"
  - "Admin layout redirects needs_enrol / needs_code to /{locale}/auth/mfa?next=/admin; the page itself comes in a later plan"
  - "/api/youtube-meta no longer exists (Phase 6 06-15 deleted it; fetchYouTubeMeta server action replaced it and already goes through requireAdminForYouTube)"
  - "AUTH-05/06/07 stay Pending: admins is empty, /auth/mfa is not built and audit names are not mapped yet"
requirements-completed: []
duration: 4min
completed: 2026-10-21
---

# Phase 5 Plan 15: One admin gate (requireAdmin) Summary

**Every admin decision now goes through one server-only `requireAdmin()`: signed in (getClaims + getUser with matching ids), a `public.admins` row looked up on every call, and aal2 with a TOTP no older than 12 h; it returns `{ id, email, displayName }` or throws `AdminAccessError` with `not_signed_in | not_admin | needs_enrol | needs_code`. `app_config.admin_user_id` no longer grants admin anywhere in the admin area.**

## What changed

- `src/server/admin-access.ts` (still pure, no imports): `AdminAccessPorts`, `AdminAccessResult`, `AdminIdentity`, `resolveAdminAccess(ports)`.
- `src/server/auth-guards.ts` (`server-only`): `AdminAccessError`, `requireAdmin()` (session client for getClaims/getUser/listFactors, service-role client for `admins`), `requireAdminUser()` = `(await requireAdmin()).id`, `getAdminStatus()`, `requireSignedInUser()` unchanged.
- `src/app/[locale]/admin/actions.ts`: `assertAdmin` body is `return requireAdmin()` (same name and position; callers keep `user.id`); `requireAdminForYouTube = () => requireAdmin()`, `TODO(phase-5)` marker removed (hand-off #4). `createClient` import kept (getFaqs and others use it). `auth_allow_skip` untouched.
- `src/app/[locale]/admin/layout.tsx`: try `requireAdmin()`; needs_enrol/needs_code -> `/auth/mfa?next=/admin`; anything else -> `/watch`. Render tree unchanged, no route group.
- `src/components/layout/auth-section.tsx`: Admin link from `supabase.rpc('am_i_admin')` (UI hint only).

## Phase 6 contract

- Item 1: `requireAdmin()` exists with the agreed shape and typed codes; `requireAdminUser()` returns the id.
- Item 7: `requireAdminForYouTube` keeps its name and every call site, calls `requireAdmin()`; both admins can run YouTube imports once they have rows.

## Remaining `admin_user_id` readers

`src/lib/database.types.ts`, `admin/audit/page.tsx` and `src/lib/audit.ts` (audit column, stays), `(viewer)/auth/actions.ts` and `auth/page.tsx` (05-21/05-22), `(viewer)/profile/page.tsx` (05-26), `src/lib/supabase/middleware.ts` (05-18). Matches the plan's list exactly.

## Verification

- `node --test tests/unit/admin-access.test.ts tests/unit/admin-mfa.test.ts`: pass (16 new tests: every code, sub mismatch, getUser throw, fail closed on both lookups, per-call admins lookup, wrapper source invariants).
- `npx tsc --noEmit`: exit 0.
- Full unit suite `tests/unit/*.test.ts` + `tests/unit/**/*.test.ts`: 2214/2214 pass.
- eslint on all touched files: exit 0.
- `grep -n "admin_user_id" src/server/auth-guards.ts`: nothing; `grep -n "export async function requireAdmin()"`: one line.
- `grep -n "requireAdmin()" src/app/[locale]/admin/actions.ts`: lines 158, 169. `admin_user_id` absent from actions.ts, layout.tsx, auth-section.tsx.
- Not run: build, gate:local, Playwright, any DB step (not required by this plan's verify; no live or shared-stack access).

## Task Commits

1. Task 1 RED: `ae6731f` test(05-15): add failing test for resolveAdminAccess and requireAdmin
2. Task 1 GREEN: `2316b1c` feat(05-15): one admin decision (resolveAdminAccess + server-only requireAdmin)
3. Task 2: `33739ba` feat(05-15): swap every admin gate onto requireAdmin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `/api/youtube-meta` route does not exist**
- **Found during:** Task 2
- **Issue:** Phase 6 plan 06-15 (commit 0555ba9) deleted `src/app/api/youtube-meta/route.ts`; its replacement `fetchYouTubeMeta` is a server action that already calls `requireAdminForYouTube()`, which now calls `requireAdmin()`.
- **Fix:** No file created; the 401/403 mapping is not needed. The plan's must-have about the route is met by the server action path.
- **Files modified:** none

**2. [Rule 1 - Bug] Source tests pinned the old app_config admin check**
- **Found during:** Tasks 1 and 2
- **Issue:** `media-upload-source.test.ts` asserted `config?.admin_user_id !== user.id` in auth-guards; `admin-actions-youtube-wrappers.test.ts` asserted the `TODO(phase-5)` marker; `design-system-page.test.ts` (DS-04) asserted `admin_user_id !== user.id` in the admin layout. All three pin exactly what this plan replaces.
- **Fix:** Each now pins the new contract (requireAdmin wrapper, admins lookup, marker gone, `/watch` and `/auth/mfa` redirects, no `admin_user_id`).
- **Commits:** 2316b1c, 33739ba

## Known Stubs

- Admin layout redirects to `/{locale}/auth/mfa`, which is not built yet (later Phase 5 plan). Until then an admin with an admins row but no fresh TOTP lands on a 404. With `admins` empty no one is affected today.

## Threat Flags

None. No new endpoint, schema or trust boundary; T-05-15-01..04 mitigations are in place as planned (getUser + per-call admins lookup + aal2/12 h + fail closed; generic messages; navbar link is a hint only).

## Self-Check: PASSED

- FOUND: tests/unit/admin-access.test.ts, src/server/admin-access.ts, src/server/auth-guards.ts
- FOUND commits: ae6731f, 2316b1c, 33739ba
