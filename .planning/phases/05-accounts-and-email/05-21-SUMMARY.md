---
phase: 05-accounts-and-email
plan: 21
subsystem: auth
tags: [auth, otp, password, hibp, turnstile, rate-limit, welcome, outbox, server-actions, tdd]
requires: ["05-02", "05-03", "05-15", "05-16"]
provides: [mapAuthErrorKey, buildEmailRedirect, pickEmailOrigin, destinationAfterSignIn, passwordPolicyCheck, emailSubject, isLockedOut, afterSignInCore, afterSignIn, createRateLimitStore, sendCode, verifyCode, signInWithPasswordAction, signUpWithPasswordAction, requestPasswordReset]
affects: [05-22, 05-23, 05-24, 05-26, 05-28]
tech-stack:
  added: []
  patterns: ["pure core over ports plus thin server-only wrapper", "captchaToken straight to Supabase, no siteverify", "fail-closed limiter on every action that sends an email", "read-only failure lock, a row recorded per wrong code"]
key-files:
  created:
    - src/server/auth/sign-in-core.ts
    - src/server/auth/after-sign-in.ts
    - src/server/rate-limit-store-service.ts
    - tests/unit/sign-in-core.test.ts
    - tests/unit/welcome.test.ts
  modified:
    - src/app/[locale]/(viewer)/auth/actions.ts
key-decisions:
  - "createRateLimitStore lives in a new server-only src/server/rate-limit-store-service.ts; rate-limit-store.ts stays pure because node --test files import it"
  - "afterSignIn finds admins by the user id Supabase just returned (public.admins row) instead of getAdminStatus(): the fresh session cookies may not be readable in the same request, and it saves 3-4 round trips; requireAdmin still gates /admin"
  - "afterSignIn takes the session client that signed the user in (optional supabase option) so the user_metadata.locale mirror uses the in-memory session"
  - "Email-link origin: pickEmailOrigin(siteUrl(), Host): site URL when hosts match, the request host only for localhost, 127.0.0.1, *.workers.dev, else the site URL"
  - "Reset link carries the viewer's safe next (not '/auth/reset-password', which getSafeAuthNextPath rejects); the 05-23 confirm page sends type=recovery to /auth/reset-password?next=..."
  - "Sign-up and reset get the same per-IP (10/10 min) and per-email (3/10 min) limits as sendCode, keys auth_signup_* and auth_reset_*"
  - "A failed profile read is 'unknown': no name step (the name page re-checks); an admin needing the name step continues to /admin"
requirements-completed: []
duration: 50min active (wall clock 2026-10-25 22:23Z to 2026-10-26 07:06Z includes a Mac sleep)
completed: 2026-10-26
---

# Phase 5 Plan 21: Server side of signing in and joining Summary

**Five server actions (`sendCode`, `verifyCode`, `signInWithPasswordAction`, `signUpWithPasswordAction`, `requestPasswordReset`) over one pure, tested sign-in core. The Turnstile token goes to Supabase as `captchaToken`. Clickit's fail-closed limiter wraps every action that sends an email. HIBP and the 8-character minimum run before sign-up. `afterSignIn` creates the profile, mirrors the locale, records `password_set_at`, claims the welcome email once through `claim_welcome` and the queue, and returns the destination.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 RED | Failing tests for the core and the welcome claim | `e9dd4dc0` |
| 1 GREEN | `src/server/auth/sign-in-core.ts` | `7e44849b` |
| 2 | `actions.ts`, `after-sign-in.ts`, `rate-limit-store-service.ts` | `40bba4d0` |

## What was built

- **`sign-in-core.ts`** (pure; relative imports of `auth-navigation.ts`, `password-rules.ts` and a type from `rate-limit-policy.ts`). It contains:
  - `mapAuthErrorKey(err, fallback)`
  - `buildEmailRedirect(origin, locale, next)`, with an unsafe next becoming `/browse`
  - `pickEmailOrigin(siteUrl, host)`
  - `destinationAfterSignIn`
  - `passwordPolicyCheck`: min 8, then HIBP; null or a throw fails open with one `[auth/hibp] unavailable` warning
  - `emailSubject`: SHA-256 hex of the lowercased address
  - `isLockedOut`: read-only and fails closed
  - `afterSignInCore(input, ports)`: every port failure is logged by step name and skipped, so sign-in never fails after Supabase has said yes
- **`after-sign-in.ts`** (`server-only`). It wires the ports:
  - `profiles` through the service client: upsert with `ignoreDuplicates`, a read, a locale update, and `password_set_at` only where it is null
  - `rpc('claim_welcome', { p_user, p_locale })`
  - `getEmailQueue().sendBatch([{ body: { outboxId } }])`
  - `auth.updateUser({ data: { locale } })` on the session client
  - an `admins` row lookup
- **`actions.ts`** (`'use server'`). Inputs are checked with zod: email trimmed, lowercased and max 254; locale `en|ar`; next max 512.
  - `sendCode`: limits `auth_code_ip` (10/10 min) and `auth_code_email` (3/10 min, keyed by the email hash), then `signInWithOtp` with `shouldCreateUser: true`, `data: { locale }`, `captchaToken` and `emailRedirectTo`. Returns `{ ok, sentAt }`.
  - `verifyCode`: `normalizeCode` must give 6 digits. Locked after 5 failures in 15 min (`auth_verify_fail`, one row recorded per failure). Calls `verifyOtp({ email, token, type: 'email' })`, then `afterSignIn` with method `otp`.
  - Password sign-in: the password must be non-empty; then `afterSignIn` with method `password`.
  - Sign-up: policy check, then limits, then `signUp` with captcha, locale and redirect. `password_set_at` is written only for a real user (identities not empty). The answer is `check_email` whether or not the address already existed.
  - Reset: limits, then `resetPasswordForEmail` with `redirectTo` and `captchaToken`. It always answers ok unless the limiter or the captcha refuses.
  - Deprecated `signInAction` and `signUpAction` keep the old forms compiling (`// removed in 05-22`).
  - Logs carry the tag, the step and the Supabase error code only.
- **`rate-limit-store-service.ts`** (`server-only`): `createRateLimitStore()` = `supabaseRateLimitStore(createAdminClient())`. `contact.ts` is untouched and moves onto it in 05-28.

## Verification

Verified:
- Task 1 verify (`node --test` on `sign-in-core.test.ts` and `welcome.test.ts`): 34 pass, 0 fail. The RED run failed first (module not found).
- Task 2 verify chain (tsc, then the `admin_user_id|guardPublicForm|botid` grep is empty, then `shouldCreateUser: true`, `type: 'email'` and `isPwned` are all present): exit 0.
- Log acceptance grep `console\.(log|warn|error)\(.*(email|token|code)\b` on actions.ts: 0 lines.
- `npm run test:unit`: 2620 pass, 0 fail. `npx tsc --noEmit`: exit 0. eslint on all six files: clean.
- Build, run detached under the lock with the placeholder public env: `npm run cf:build && npm run cf:bundle-budget`. The log `/Users/koss/.clickit-checks/p5-21-build.log` ends `exit=0`.
  - **JSON import stop did not fire.** Turbopack, OpenNext and wrangler all accepted `import ... with { type: 'json' }`, now reached from app code through `after-sign-in.ts` → `queue.ts` → `deps.ts` → `render-app.ts`.
  - `git status` is clean afterwards; `.open-next` and `.next` are gitignored.

Not verified:
- No server action has run against the shared local stack or in a browser: no `next dev` sign-in, no Mailpit code, no real `claim_welcome` call. The 05-22 screen and UAT cover that.
- Supabase CAPTCHA "on" behaviour: it stays off until the Phase 3 cutover.

Failed: none.

## Worker bundle

```
bundle-budget ok gzip=2984.77 KiB total=14702.21 KiB budget=3000 KiB headroom=15.23 KiB
```

The bundle grew by 32.56 KiB gzip over the 05-19 figure (2,952.21 KiB). **Headroom is now only 15.23 KiB.**

This plan's server code sits in one Next chunk, `chunks/ssr/_next-internal_server_app_[locale]_(viewer)_auth_page_actions_*.js`: 131,918 B raw, 15,025 B gzip. Its three biggest additions, by what the chunk holds:

1. **Pre-rendered app-email templates JSON (largest).** `app-email-templates.json` has 129 `__clk_` slot markers in the chunk. It is now a second copy inside the Next server; the consumer copy in `custom-worker.ts` stays. It arrives through `getEmailQueue()` → `queue.ts` (in-process fallback) → `deps.ts` → `render-app.ts`.
2. **Email consumer and deps on the same path:** `processBatch`, `buildEmailDeps`, and the Resend and Mailpit mailers. On Workers this code never runs in the Next handler because the `EMAIL_QUEUE` binding is used.
3. **This plan's own code (small):** `actions.ts`, `sign-in-core.ts`, `after-sign-in.ts`, `hibp.ts`.

The other ~17.5 KiB gzip of the growth is outside that chunk. Without a `--metafile` diff it cannot be attributed; likely Next runtime and manifests for a new server-action module.

## Deviations from Plan

### Auto-fixed / adjusted

1. **[Rule 3 - Blocking] `rate-limit-store.ts` could not take `server-only` or `createAdminClient`.**
   - Problem: the file is pure, and four unit tests import it with `node --test`.
   - Fix: `createRateLimitStore()` lives in the new `src/server/rate-limit-store-service.ts` (`server-only`). Same function, one more file name than the plan listed.
2. **[Rule 1 - Bug] `getAdminStatus()` would read the request cookies right after sign-in.**
   - Problem: the new session may not be visible in that read.
   - Fix: the `isAdmin` port looks up `public.admins` by the returned user id instead (PATTERNS: "the admins lookup helper behind requireAdmin, non-throwing"). It is a destination hint only; the admin layout still runs `requireAdmin()`.
3. **[Rule 1 - Bug] Reset redirect.**
   - Problem: `buildEmailRedirect(origin, locale, '/auth/reset-password')` would always become `next=/browse`, because `getSafeAuthNextPath` refuses `/auth/*`.
   - Fix: reset passes the viewer's safe next. The 05-23 confirm page routes `type=recovery` to `/auth/reset-password?next=...` (05-23 plan, line 102).
4. **[Rule 2 - Security] Sign-up and reset are rate-limited like sendCode** (T-05-21-02: both make Supabase send an email). Reset also returns `captcha` on a captcha refusal; the plan said "always ok unless rate-limited". This leaks no account information, and otherwise the viewer would wait for an email that was never sent.
5. **Small additions to the core:** `pickEmailOrigin`, `emailSubject` and `isLockedOut` are extra pure exports, tested. `mapAuthErrorKey` takes an optional fallback, so a failed send gives `codeSendFailed` (UI-SPEC 6.1 table). `afterSignIn` takes an optional `supabase` session client. Sign-up returns `state: 'signed_in'` with a destination only when Supabase returns a session (Confirm email off; never on live).

## Known Stubs

- The deprecated `signInAction` and `signUpAction` aliases (marked `// removed in 05-22`) return `userId: ''`. The old forms do not read it.

## Threat Flags

None beyond the plan's register. T-05-21-01 to 06 are mitigated as planned:
- 5 wrong codes per 15 min lock
- per-IP and per-email limits and the Supabase captcha
- identical answers for new and existing addresses
- no Host echo in email links
- HIBP before sign-up
- `claim_welcome`, tested for one send

## NEEDS lines

NEEDS CONTROLLER: Worker bundle at 2,984.77 KiB gzip, headroom 15.23 KiB under the 3,000 KiB gate:local budget (+32.56 KiB from 05-21). The biggest single item is a second copy of the pre-rendered email templates and the consumer in the Next server, pulled in by queue.ts's in-process fallback. Options: load the in-process queue path (consumer, deps, render-app) with a dynamic import that is skipped when the EMAIL_QUEUE binding exists, or move the fallback out of the Next graph. 05-22 to 05-28 will add more, so decide before them.

## Self-Check: PASSED

- FOUND: src/server/auth/sign-in-core.ts, src/server/auth/after-sign-in.ts, src/server/rate-limit-store-service.ts, tests/unit/sign-in-core.test.ts, tests/unit/welcome.test.ts
- FOUND commits: e9dd4dc0, 7e44849b, 40bba4d0
