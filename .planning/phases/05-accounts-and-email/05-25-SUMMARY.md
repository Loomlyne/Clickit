---
phase: 05-accounts-and-email
plan: 25
subsystem: auth
tags: [admin, totp, mfa, aal2, supabase-mfa, audit, next-intl, rtl]
requires: ["05-03", "05-12", "05-15", "05-17"]
provides: [/{locale}/auth/mfa page, startEnrol, verifyEnrol, verifyAdminCode, MfaEnrol, MfaVerify, mfaStep, formatManualKey, friendlyNameFor, verifyAcrossFactors, enrolAllowed, MAX_ADMIN_TOTP, AuditEntity admin_auth, AuditAction mfa_enrol/mfa_unenrol/mfa_failed]
affects: [05-27, 05-31, 05-36, 05-37, phase-06-uat]
tech-stack:
  added: []
  patterns: ["pure decision core under src/server/auth + thin 'use server' wiring pinned by source-invariant tests", "client asks the server for the enrolment after mount (never on GET render, so a prefetch cannot create factors)"]
key-files:
  created:
    - src/server/auth/mfa-core.ts
    - tests/unit/mfa-flow.test.ts
    - src/app/[locale]/(viewer)/auth/mfa/page.tsx
    - src/app/[locale]/(viewer)/auth/mfa/actions.ts
    - src/components/auth/mfa-enrol.tsx
    - src/components/auth/mfa-verify.tsx
  modified:
    - src/lib/audit.ts
key-decisions:
  - "enrolAllowed: a session that still owes a code (needs_code) never adds a factor; the first factor only while no verified factor exists; a second only at MFA ok and below MAX_ADMIN_TOTP = 2 (D-20)"
  - "startEnrol runs from the client after mount (ref-guarded for Strict Mode), not during the page render, so a GET or prefetch never creates a factor"
  - "verifyAcrossFactors tries verified factors newest first (created_at), stops at the first success, stops at once on 429/over_request_rate_limit; a thrown check counts as a failure for that factor only; non-6-digit codes never reach Supabase"
  - "Every failed code writes one mfa_failed row (reason wrong_code | wrong_code_enrol | too_many); GoTrue's 15/min verify limit bounds the rows"
  - "Removing leftover unverified factors writes one mfa_unenrol row ({ count, status: unverified, by: enrol restart }) only when something was removed"
  - "Signed-out visitors go to /auth?next=<safe next, default /admin>, not /auth?next=/auth/mfa (getSafeAuthNextPath refuses /auth paths, so that next was dead); the admin layout brings the admin back here"
  - "enroll passes issuer 'Clickit Story' so the authenticator app shows the name the copy uses"
requirements-completed: []
duration: 15min
completed: 2026-10-25
status: code complete; browser check with the seeded local admin not run (controller / Hermes UAT)
---

# Phase 5 Plan 25: Admin authenticator pages Summary

**`/{locale}/auth/mfa` is built: an admin with no verified TOTP factor gets scan (QR in a white frame, grouped key, Copy key), code, an optional second authenticator and "Open admin"; an admin with a factor gets "Enter your authenticator code". All three server actions re-check the admin on every call and run Supabase `mfa.challenge` + `mfa.verify` on the server, so the session cookie becomes aal2. Enrol, leftover-factor removal and failed codes write `admin_auth` audit rows; no secret, QR, URI or code is logged or audited.**

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | MFA core and audit types (TDD) | `96b9ee09` (RED), `91481819` (GREEN) |
| 2 | /auth/mfa page, actions and components | `2962e243` (RED, enrolAllowed), `82f85779` (feat) |

## What was built

- `src/server/auth/mfa-core.ts` (pure, no imports): `mfaStep`, `formatManualKey`, `friendlyNameFor` (random 4-char suffix, walks forward on collision so it is always new), `verifyAcrossFactors`, `enrolAllowed`, `MAX_ADMIN_TOTP`.
- `src/lib/audit.ts`: `'admin_auth'` entity; `'mfa_enrol' | 'mfa_unenrol' | 'mfa_failed'` actions (types only; the DB columns are free text). Doc comment: `admin_auth -> { factor_friendly_name }` (enrol), `{ count }` (unenrol), `{ reason }` (failed); `entityId` = the admin's own user id.
- `actions.ts` (`'use server'`):
  - `startEnrol()`: getAdminStatus, own user id, list TOTP factors, `enrolAllowed`, unenroll every unverified TOTP factor, `mfa.enroll({ factorType: 'totp', friendlyName, issuer: 'Clickit Story' })`. Returns `{ factorId, qr, manualKey }` to the browser only.
  - `verifyEnrol({ factorId, code })`: only the admin's own unverified TOTP factor; server-side normalise; challenge + verify; `mfa_enrol` audit with the friendly name.
  - `verifyAdminCode({ code, next })`: requires `needs_code` (returns the destination at once when MFA is already ok); verified factors newest first; success returns `getSafeAuthNextPath(next, '/admin')`.
  - Errors: `mfaCodeWrong`, `mfaTooMany`, `mfaEnrolFailed`, `unauthorized` (the client reloads, so the page redirects).
- `page.tsx` (server): signed out -> `/auth?next=…`; not admin -> `/watch`; MFA ok -> safe next or `/admin`; `listFactors` -> `mfaStep` -> `<MfaEnrol>` or `<MfaVerify stale staleHours=12>`; `robots: { index: false, follow: false }`. Lives under `(viewer)/auth/`, nothing under `/admin` (F10).
- `mfa-enrol.tsx`: steps scan (StepBar 1/2, QR `mx-auto size-48 rounded-card bg-white p-4`, `<img>` 160px, `mfaQrAlt`, `dir="ltr"`; key `dir="ltr"` `select-all` 14px bold `tracking-[0.12em]` on `--bg-2`; outline Copy key, `keyCopied` for 2 s with a polite status; copies the ungrouped key), code (StepBar 2/2, CodeField autofocus + auto-submit, `mfaVerifyContinue`, `mfaBack`), second (CheckCircle2 green-safe, `mfaSecondAdd` repeats scan/code with heading `mfaSecondTitle`, `mfaSecondSkip`), done (`mfaDoneTitle`, `mfaDoneOpen` -> next). Enrol failure: AuthAlert `mfaEnrolFailed` (or `mfaTooMany`) plus a Reload button. Skeletons in the QR and key slots until the server answers.
- `mfa-verify.tsx`: overline, `mfaVerifyTitle`, `mfaVerifySub` (+ `mfaStaleNote` with `{hours}` when aal2 but stale), CodeField autofocus + auto-submit, `mfaVerifyContinue`, `mfaLostPhone` as plain text, Sign out link-button (browser client `auth.signOut()`, then `/auth`, same as the navbar).

## Local URLs

- Enrol and code page (same URL; which one renders depends on the admin's factors): `http://localhost:3000/en/auth/mfa?next=/admin` and `http://localhost:3000/ar/auth/mfa?next=/admin` (`npm run dev`). The admin layout sends an admin who needs a code to exactly this URL.
- The seeded local admin (`uat-admin@clickit.local`, 05-17) already has a verified factor, so it sees the code page. The enrol page shows for an admin with no verified factor (for example after `admin-remove-factor`, or a new admins row).

## Verification

- Task 1 verify: `node --test tests/unit/mfa-flow.test.ts` pass, `grep -q "'admin_auth'" src/lib/audit.ts` pass.
- Task 2 verify: `npx tsc --noEmit` exit 0; `npx eslint src/components/auth "src/app/[locale]/(viewer)/auth/mfa"` 0 errors (1 pre-existing warning in login-form.tsx); no console line with secret/qr/uri/code; `getAdminStatus` present; `test ! -d "src/app/[locale]/admin/mfa"` pass.
- `tests/unit/mfa-flow.test.ts`: 17 pass (core behaviour, enrolAllowed, plus source invariants: each action calls getAdminStatus and refuses with unauthorized, enroll/challenge/verify/unenroll present, no console line or audit diff carries secret/qr/uri/code, page redirects and noindex, no `/admin/mfa`).
- `npm run test:unit`: 2577 pass, 0 fail. (The run picked up another session's untracked `tests/unit/email-cpu-probe.test.ts`; it passed too.)

## Not verified

- Browser run: signing in as the seeded admin, entering a code, reaching `/admin`; enrol QR scan with a real app; the second-factor path; Arabic layout of `/ar/auth/mfa`. Needs a dev server and the TOTP secret from `/Users/koss/.clickit-checks/local-admin.env` (script-only); left for the controller / Hermes UAT and 05-31 e2e.
- Supabase's real error shape for a wrong code and the 15/min limit (mapped from `status 429` / `over_request_rate_limit`; anything else is "code wrong").
- `npm run build` / `cf:build` (not in this plan's verify).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Factor add needs the right MFA state (`enrolAllowed`).** The plan's `startEnrol` only refused non-admins. An admin session that still owes a code (`needs_code`) could otherwise add its own factor and skip the code; and an MFA-ok admin could add factors without limit. `enrolAllowed` allows the first factor only at `needs_enrol` with none verified, a second only at MFA ok with one verified (`MAX_ADMIN_TOTP = 2`, D-20). `verifyEnrol` also refuses `needs_code` and only accepts the admin's own unverified TOTP factor. Tested. Commits `2962e243`, `82f85779`.

**2. [Rule 1 - Bug] Signed-out redirect target.** The plan says `/auth?next=/auth/mfa`, but `getSafeAuthNextPath` refuses any `/auth` path, so that `next` would always fall back. The page sends `/auth?next=<safe next, default /admin>`; after sign-in the admin layout sends the admin back to `/auth/mfa`. Commit `82f85779`.

**3. [Rule 2 - Correctness] Enrolment starts after mount, not on render.** Creating a factor while rendering a GET page would let a prefetch or crawler create factors. `MfaEnrol` calls `startEnrol()` once after mount (ref guard for Strict Mode). Commit `82f85779`.

**4. Source-invariant tests for the server wiring** were added to `mfa-flow.test.ts` (the actions and page cannot be imported under node:test). Commit `82f85779`.

### Copy

- The Reload button under `mfaEnrolFailed` uses the existing `common.retry` ("Try again" / existing Arabic) and reloads the page. No new key was invented; the alert above it already says "Reload the page and try again".
- All MFA strings come from the 05-06 keys (UI-SPEC copy table); the Arabic is the UI-SPEC draft awaiting Koss's review.

### TDD gate

RED `96b9ee09` -> GREEN `91481819` for Task 1. For `enrolAllowed`, RED `2962e243`; its GREEN is part of the Task 2 feat commit `82f85779` (implemented together with the actions that use it).

## Needs Koss

- UI-SPEC item 5: "Lost your phone? Ask Koss to reset your authenticator." is used as written (plain text, names Koss on an admin-only screen); final wording at UAT.
- Arabic MFA copy is the UI-SPEC draft (item 8).

## Known Stubs

None. Every control on both pages is wired to a server action or the existing sign-out.

## Threat Flags

None beyond the register. T-05-25-01 (getAdminStatus + enrolAllowed on every action, verify on the server, aal2 cookie set by Supabase), T-05-25-02 (QR/secret returned to the enrolling browser only; tests pin no logging or audit of them), T-05-25-03 (Supabase verify limit; failures audited), T-05-25-04 (unverified factors removed before enrol; unique friendly name), T-05-25-05 (admin_auth rows) are in place.

## Self-Check: PASSED

- FOUND: src/server/auth/mfa-core.ts, tests/unit/mfa-flow.test.ts, src/lib/audit.ts, src/app/[locale]/(viewer)/auth/mfa/page.tsx, src/app/[locale]/(viewer)/auth/mfa/actions.ts, src/components/auth/mfa-enrol.tsx, src/components/auth/mfa-verify.tsx
- FOUND commits: 96b9ee09, 91481819, 2962e243, 82f85779
