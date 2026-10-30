---
phase: 05-accounts-and-email
plan: 27
subsystem: admin
tags: [admin, admins-list, audit-log, d-22, d-23, auth-05, auth-07, read-only, rtl]
requires: ["05-09", "05-12", "05-15", "05-25"]
provides: [auditActorLabel (pure), OWNER_SCRIPT_MARKER, listAdmins, adminNameMap, /{locale}/admin/admins page, Admins nav item, audit Admin column]
affects: [05-31, 05-36, 05-37, phase-05-uat]
tech-stack:
  added: []
  patterns: ["pure label decision in src/server + server-only service-role directory module called only after requireAdmin", "reuse the Phase 6 shared status chip instead of a second chip component"]
key-files:
  created:
    - src/server/admin-names.ts
    - src/server/admin-directory.ts
    - src/app/[locale]/admin/admins/page.tsx
    - tests/unit/admin-audit-names.test.ts
  modified:
    - src/components/admin/admin-header.tsx
    - src/app/[locale]/admin/audit/page.tsx
key-decisions:
  - "Owner script label only for diff.by === 'owner script' (exact marker): 05-25's own enrol-restart rows carry by: 'enrol restart' with the acting admin's id and must stay attributed to that admin"
  - "A blank display_name falls back to Former admin, never an empty cell"
  - "If the admins name lookup fails, the audit Admin column shows a dash, not 'Former admin' for everyone; the log itself still loads"
  - "No new status-chip.tsx: the Phase 6 shared chip (youtube-status-chip.tsx, ok/warn/neutral/bad on status-* tokens) is on main and is reused"
  - "The Admins page re-checks requireAdmin like the layout (needs_enrol/needs_code -> /auth/mfa?next=/admin/admins, else /watch)"
requirements-completed: []
duration: 20min
completed: 2026-10-26
---

# Phase 5 Plan 27: Read-only Admins list and admin names in the audit log Summary

**`/{locale}/admin/admins` lists every admin (name with a "You" chip, email, authenticator set up / not set up, last sign-in in Dubai time, owner note, no write control) behind `requireAdmin`; the audit log has a second column "Admin" that names the acting admin from `public.admins`, says "Former admin" for a removed admin, "System" for rows with no id and "Owner script" for rows written by `scripts/admin-remove-factor.mjs`.**

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Actor label helper and runner audit-id test (TDD) | `0f793f46` (RED), `ceb40bbc` (GREEN) |
| 2 | Admins page, nav item, audit column | `b934e397` |

## What was built

- `src/server/admin-names.ts` (pure, no imports): `auditActorLabel(adminUserId, names, diff?)` -> `{ kind: 'name', text } | { kind: 'former' } | { kind: 'system' } | { kind: 'owner_script' }`; `OWNER_SCRIPT_MARKER = 'owner script'`.
- `src/server/admin-directory.ts` (`server-only`, service role): `listAdmins()` -> `rpc('list_admins')` mapped to `{ userId, displayName, email, hasTotp, lastSignInAt }`; `adminNameMap()` -> `from('admins').select('user_id, display_name')` -> `Map`. Both throw on error; neither writes.
- `src/app/[locale]/admin/admins/page.tsx`: `requireAdmin()` re-check; `AdminPageHeader` (`admins.title`, `admins.description`, no action); `md` and up: `AdminTableShell` table (Name 14px bold in `<bdi>` + neutral "You" chip, Email in a `dir="ltr"` span with `break-all`, Authenticator chip ok/warn, Last sign-in `Intl.DateTimeFormat(ar-AE | en-GB, Asia/Dubai)` in `<time>` with the ISO `title`, "Never" when null); current admin's row `bg-[var(--bg-2)]`; under `md`: one `rounded-card` card per admin with `gap-2`. Footer `AdminPanel` with `ownerNote` (14px `--text-mute`). Load failure: `AdminPanel` with `loadError` (`role="alert"`). `force-dynamic`. No button, form or action.
- `admin-header.tsx`: `{ admins.nav, /admin/admins, ShieldCheck }` in Operations between Settings and Audit.
- `admin/audit/page.tsx`: `adminNameMap()` read once in parallel with the log; second column `adminColumn` (always visible, also under `md`) rendered by `AdminCell` from `auditActorLabel(row.admin_user_id, names, row.diff)`: name in `<bdi>` (`--text`), `formerAdmin` / `system` in `--text-mute`, `actorOwnerScript`. `admin_auth` rows use the shared chip: `neutral`, `mfa_failed` = `bad`. `admin_user_id` typed `string | null`.

All copy comes from existing message keys (05-06): `admin.admins.*`, `admin.audit.adminColumn`, `formerAdmin`, `system`, `actorOwnerScript`. No new keys, no invented wording.

## Verification

- Task 1 verify `node --test tests/unit/admin-audit-names.test.ts`: RED failed (module missing), GREEN 8/8 pass (name, former, system for null/undefined/empty, owner script, diff without or with empty `by`, enrol-restart row stays the admin's, blank name, runner passes `u1` to `env.audit` when `assertAdmin` resolves `{ id: 'u1', email: 'x', displayName: 'Nejib' }`).
- Task 2 verify (exact command): `npx tsc --noEmit && npx eslint admins audit admin-header.tsx && grep requireAdmin && grep auditActorLabel && ! grep insert|delete|update(` -> exit 0. eslint: 0 errors; 1 warning `react-hooks/exhaustive-deps` at admin-header.tsx `useEffect` (pre-existing on main, line moved by one).
- `grep -n "admins" src/components/admin/admin-header.tsx` prints the nav entry (line 78).
- `npm run test:unit`: 2628 tests, 2628 pass, 0 fail.
- `npx tsc --noEmit`: exit 0.
- Not run: `cf:build` / bundle budget (per the controller brief: 15 KiB headroom, trim decision pending; this plan adds no dependency), browser check of the page with the seeded local admin (needs M2 + TOTP on the shared stack; controller / Hermes UAT).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Owner-script label limited to the exact marker**
- **Found during:** Task 1
- **Issue:** The plan's behaviour reads as "a diff with a non-empty `by` is the owner script". 05-25 writes `mfa_unenrol` rows with `by: 'enrol restart'` and the acting admin's own id; a non-empty-`by` rule would relabel those as "Owner script" and hide which admin acted (AUTH-07).
- **Fix:** `owner_script` only when `diff.by` (trimmed) equals `'owner script'`, the value `scripts/admin-remove-factor.mjs` writes. Every plan behaviour row still holds; one extra test pins the enrol-restart case.
- **Files:** src/server/admin-names.ts, tests/unit/admin-audit-names.test.ts
- **Commit:** ceb40bbc

**2. [Rule 2 - Correctness] Name lookup failure does not mislabel every row**
- **Found during:** Task 2
- **Issue:** If `adminNameMap()` failed, an empty map would show "Former admin" on every row.
- **Fix:** the audit page catches the lookup error (logged) and shows a dash in the Admin column; the log itself still renders.
- **Commit:** b934e397

**3. [Plan instruction] No `status-chip.tsx` created**
- The plan creates it only if no shared chip exists on main. Phase 6's `src/components/admin/youtube-status-chip.tsx` is on main with ok/warn/neutral/bad tones on the Phase 4 `status-*` tokens, so it is reused (imported as `StatusChip`). Its base uses `px-3` (UI-SPEC 6.8 lists `px-2`); kept as the shared component is.

## Known Stubs

None.

## Threat Flags

None. T-05-27-01 (page and layout both call `requireAdmin`; `list_admins` is service_role only), T-05-27-02 (no write control; verify's negative grep passes), T-05-27-03 (names from `admins`; removed admins shown as "Former admin", ids kept in the rows) are all mitigated.

## Requirements

AUTH-05 and AUTH-07 stay Pending: the list and the names are built, but `admins` is empty on live until the owner inserts both admins and M2 is applied (05-37), and the browser check is part of Phase 5 UAT.

## Self-Check: PASSED

- FOUND: src/server/admin-names.ts, src/server/admin-directory.ts, src/app/[locale]/admin/admins/page.tsx, tests/unit/admin-audit-names.test.ts
- FOUND commits: 0f793f46, ceb40bbc, b934e397
