---
phase: 05-accounts-and-email
plan: 22
subsystem: auth
tags: [auth, otp, sign-in, turnstile, next-intl, rtl, accessibility, tdd]
requires: ["05-12", "05-21"]
provides: [AuthSignInForm, AuthSignInMode, authInitialMode, AuthInitialMode, resendSignupLink, "TurnstileForm 'resend' (interaction-only)", "/{locale}/auth unified page", "auth loading skeleton (UI-SPEC 6.14)"]
affects: [05-23, 05-24, 05-26, 05-30, 05-31, 05-33]
tech-stack:
  added: []
  patterns: ["one client state machine for every sign-in screen, server actions only", "full-load navigation (window.location.replace(getPathname)) after a session change", "second Turnstile instance (interaction-only) for resend links"]
key-files:
  created:
    - src/components/auth/auth-sign-in-form.tsx
  modified:
    - src/app/[locale]/(viewer)/auth/page.tsx
    - src/app/[locale]/(viewer)/auth/loading.tsx
    - src/app/[locale]/(viewer)/auth/actions.ts
    - src/lib/auth-navigation.ts
    - src/lib/turnstile-widget.ts
    - tests/unit/auth-navigation.test.ts
    - tests/unit/turnstile-widget.test.ts
  deleted:
    - src/components/auth/auth-panel.tsx
    - src/components/auth/login-form.tsx
    - src/components/auth/signup-form.tsx
key-decisions:
  - "The page passes getSafeAuthNextPath(next, '') to the form: '' means no next, so the server action still sends an admin to /admin and a viewer to /browse (the helper's default '/watch' would have counted as a real next)"
  - "Signed-in visitors: getAdminStatus(); admin -> next or /admin, viewer -> next or /browse (sign-in-core constants); no app_config read"
  - "The h1 lives in the form and follows the state (Sign in or join / Sign in / Create your account / Account recovery); the page has no h1 of its own"
  - "After sign-in: window.location.replace(getPathname({ href: destination, locale })), not assign, so /auth leaves the back stack (auth-navigation tests) and the full load meets the 05-25 lesson"
  - "New server action resendSignupLink (auth.resend type signup, sign-up limits, captcha) so 'Resend the link' on the check-your-email panel is a live control"
  - "TurnstileForm gains 'resend' = interaction-only (UI-SPEC 5.5 item 9)"
requirements-completed: []
duration: 5min (clock 2026-10-26 16:18:30Z to 16:23Z)
completed: 2026-10-26
---

# Phase 5 Plan 22: Unified sign-in screen Summary

**`/{locale}/auth` is now one code-first screen: email, Send code, six code boxes on the same screen, Verify (auto-submits at six digits). "Use a password instead" swaps in PasswordField; "Create one with a password" and "Forgot password?" sit behind the password path. The page is the same for every `next` (no show data, D-03), keeps the validated same-origin `next`, has no skip link, and redirects signed-in visitors with `getAdminStatus()`. The two-tab panel, LoginForm, SignupForm and the 05-21 `signInAction`/`signUpAction` aliases are gone.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | AuthSignInForm (five states), `resendSignupLink`, Turnstile `resend` placement | `faf89c57` |
| 2 RED | next-path cases and `authInitialMode` tests | `2ad3e6f9` |
| 2 GREEN | `authInitialMode`, plain page, loading skeleton, old forms and aliases removed | `719152f8` |

## What was built

- **`auth-sign-in-form.tsx`** (`'use client'`), props `{ next, locale, initialMode }`, states `email | code-sent | password | signup-password | forgot`:
  - **email:** h1 `signInOrJoinTitle`, subline `signInOrJoinSub` (`{length}`), Email (`type=email`, `inputMode=email`, `dir=ltr`, `autoComplete=email`, `enterKeyHint=send`), managed Turnstile, Send code (spinner + `sending`), link-button `usePassword`. Email autofocus only when `matchMedia('(hover: hover)')`.
  - **code-sent:** `codeSentTo` with the address in `<bdi dir="ltr">` + `changeEmail`; CodeField (`codeLabel`, helper `codeHelp` with 15 minutes, autofocus, `onComplete` -> `verifyCode`); Verify code (disabled until six digits; spinner + `verifying`); resend row: `resendIn` countdown via `resendRemaining` + `formatCountdown` (not a live region), then the resend link with its own interaction-only Turnstile; `usePassword`. A polite `role="status"` line announces `codeSentAnnounce` once per send and `resendReady` once when the window opens. Errors under the cells: `codeWrong`, `codeExpired` (client knows more than `AUTH_LINK_MINUTES` passed), `tooManyTries`, `errors.networkError`. Success: StatusLine `signedIn` (green CheckCircle2) and a full load to the server's destination.
  - **password:** h1 `signInTitle`, subline `signInPasswordSub`, Email (`autoComplete=username`), PasswordField `current-password`, end-aligned `forgotPassword`, Turnstile, Sign in, `useCode`, `noAccountYet` + `createWithPassword`.
  - **signup-password:** h1 `createAccountTitle`, PasswordField `new-password` with the strength meter, Turnstile, Create account, `termsLine` with `/terms` and `/privacy` links, `switchToSignIn`. Success: AuthAlert `signupCheckEmailTitle` / `signupCheckEmailBody` (address in `<bdi>`, 15 minutes) and `resendConfirmation` on the same 60 s pattern (`resendSignupLink`).
  - **forgot:** back link-button `backToSignIn` (ArrowLeft `rtl:scale-x-[-1]`), h1 `resetHeading`, subline `resetDescription`, Email, Turnstile, `sendResetLink` -> `requestPasswordReset`. Success: AuthAlert `resetEmailSent` + `resetEmailDescription` (15 minutes).
  - Every submit consumes its Turnstile token (`consume(captchaRefused)`); a captcha refusal shows the signed line under the widget. Error routing: `emailInvalid` under the email, `passwordMin`/`pwLeaked` under the PasswordField, the rest in a form AuthAlert.
  - Classes: weights 400/700 only, logical properties only, every control `min-h-11`; link-buttons `--text-dim` underlined (not accent).
- **`page.tsx`:** static `generateMetadata()` (no args, no Open Graph). The page keeps the split layout with the hero image and the quote (quote is now a `<p>`, so the form's h1 is the page's only h1). It reads `getAdminStatus()` in the first `Promise.all`. It renders `<AuthSignInForm next={getSafeAuthNextPath(next, '')} locale initialMode={authInitialMode(mode)} />`. It no longer reads `authAllowSkip`, `authHeading*` or `admin_user_id`.
- **`loading.tsx`:** UI-SPEC 6.14 bars (24px title `w-3/4`, 14px subline, 44px field, 44px pill) in `--bg-2` Skeletons.
- **`auth-navigation.ts`:** `AuthInitialMode` and `authInitialMode(raw)` (`forgot`, `password`, `signup` -> `signup-password`, anything else -> `email`).
- **`actions.ts`:** `resendSignupLink` added; the `// removed in 05-22` legacy block (`LegacyAuthResult`, `LEGACY_MESSAGES`, `signInAction`, `signUpAction`) removed.
- **`turnstile-widget.ts`:** `'resend'` form, `interaction-only`.

## Verification

Verified:
- Task 1 verify (`tsc`, eslint on the form, no raw `type="password"`): exit 0. Acceptance: `PasswordField` 3 matches, `CodeField` present, no `font-medium|semibold`, `ml|mr|pl|pr-N` or `left|right-N`.
- Task 2 RED: `auth-navigation.test.ts` failed (`does not provide an export named 'authInitialMode'`). GREEN: 8 pass. Full Task 2 verify chain (tests, tsc, forbidden-word grep on page.tsx, `generateMetadata()` present, no `show-preview.ts`, eslint on `src/components/auth` and the auth route, three files gone, no `signInAction|signUpAction|AuthPanel` in `src`): exit 0. `getSafeAuthNextPath` appears in page.tsx.
- `turnstile-widget.test.ts`: 7 pass (new `resend` case).
- Detached under the lock (`/Users/koss/.clickit-checks/p5-22-check.log`, `exit=0`):
  - `npm run test:unit`: 2676 pass, 0 fail.
  - `npx tsc --noEmit`: OK.
  - `npm run cf:build` (placeholder public env): OK.
  - `npm run cf:bundle-budget`: shown in the next section.
- Server render under `next dev` on port 3022 against the shared local stack (page GETs only, no submit), checked with curl:
  - `/en/auth?next=/series/sample-show`, `/ar/auth` and `/en/auth?next=//evil.com`: 200, h1 "Sign in or join" (Arabic on `/ar`), buttons Send code and Use a password instead.
  - `?mode=password`: Sign in, `current-password` + `username`, Forgot password?, Email me a code instead, Create one with a password.
  - `?mode=signup`: Create your account, `new-password`.
  - `?mode=forgot`: Account recovery, Send reset link.
  - No tablist and no skip link in the markup.
  - Dev server stopped by PID. It rewrote the tracked `AGENTS.md`; that one file was restored with `git checkout -- AGENTS.md`.

Not verified:
- No browser run of the client flows:
  - send code to Mailpit, type, paste or autofill the code, auto-submit, landing on `next`
  - Arabic-Indic digits in the code field
  - resend after 60 s
  - password sign-in, sign-up check-email, forgot
  - focus moves and screen-reader announcements
  - the eye on the physical right at `/ar`

  These are left for 05-31 e2e and UAT (05-33).
- `supabase.auth.resend({ type: 'signup' })` has not run against GoTrue (local or live).
- Visual match to the signed Viewer board V1/V4: no PNGs were read.

Failed: none.

## Worker bundle

```
bundle-budget ok gzip=2974.77 KiB total=14561.64 KiB budget=3000 KiB headroom=25.23 KiB
```

The bundle shrank 1.62 KiB gzip from the 2,976.39 KiB baseline the controller gave. The three old forms and the legacy aliases are gone, and the new form is smaller than the three files together.

## Deviations from Plan

### Auto-fixed / adjusted

1. **[Rule 2 - Missing critical] "Resend the link" needed a server action.** UI-SPEC 6.1 state 4 shows a resend link after password sign-up. 05-21 had no action for it, and a shown control must work. Added `resendSignupLink` in `actions.ts`:
   - `auth.resend({ type: 'signup' })` with `emailRedirectTo` and `captchaToken`
   - the same per-IP and per-email limits as sign-up
   - the same answer for any address (T-05-21-03)

   Commit `faf89c57`.
2. **[Rule 3 - Blocking] Turnstile had no interaction-only placement for resend.** UI-SPEC 5.5 item 9 needs one, and `turnstileWidgetOptions` only gave `interaction-only` to the newsletter. Added `TurnstileForm 'resend'` and a test. Files: `src/lib/turnstile-widget.ts` and `tests/unit/turnstile-widget.test.ts`, neither in the plan's file list. Commit `faf89c57`.
3. **[Rule 1 - Bug] `getSafeAuthNextPath(next)` would have changed where admins land.**
   - Problem: with no `next`, the helper returns its default `'/watch'`. Passing that to the actions as a real `next` would send an admin to `/watch` instead of `/admin`, and a viewer to `/watch` instead of `/browse` (D-04).
   - Fix: the page calls `getSafeAuthNextPath(next, '')`, and the form sends `null` for `''`.
4. **`window.location.replace` instead of `assign`.** The plan and UI-SPEC say `assign`. The controller's rule asks for a full load with `replace(getPathname(...))`, and the existing auth-navigation tests expect `/auth` to leave the back stack. It is still a full load.
5. **The h1 is in the form, not the page.** The heading changes with the state (UI-SPEC 6.1 states 1 to 5), so the client form renders it. The hero quote changed from `<h2>` to `<p>` so the form's h1 is the only page heading.
6. **Copy reused (no new keys):**
   - sign-up subline = `signInPasswordSub` ("Enter your email and password."). UI-SPEC lists a subline for state 4 but no key.
   - forgot h1 = `resetHeading` ("Account recovery"). UI-SPEC state 5 has no h1, and the page needs one.

   Both are existing EN/AR strings; Koss can confirm them at UAT copy review.

### Left alone (other plans own them)

- The Settings "Skip sign-in" control, `config.authAllowSkip` in `src/lib/config.ts` and the auth heading fields in `auth-page-editor.tsx` / `auth-tab.tsx` stay. 05-30 removes them (D-02); `/auth` no longer reads them.
- Unused message keys (`tabSignIn`, `tabSignUp`, `skipSignIn`, `welcomeBackHeading`, `termsAccept`, `accountCreated`, ...) remain in en/ar.json. Removing them is a messages-plan cleanup.
- `src/lib/auth-errors.ts` is still used by `reset-password-form.tsx` and `account-settings.tsx`.

## Known Stubs

None. Every control on the screen calls a server action or switches state.

## Threat Flags

None beyond the register:
- T-05-22-01: no show data; the grep gate passes.
- T-05-22-02: `getSafeAuthNextPath` on the page, and the server re-validates `next` in every action.
- T-05-22-03: token consumed after every submit; separate interaction-only resend instance.
- T-05-22-04: PasswordField only; `current-password`, `new-password` and `username` hints.

`resendSignupLink` is a new action. It has the same trust boundary as sign-up: rate-limited, captcha, and the same answer for any address.

## NEEDS lines

NEEDS KOSS: UAT copy review for the reused strings: the sign-up subline "Enter your email and password." (`signInPasswordSub`) and the forgot-password h1 "Account recovery" (`resetHeading`), plus the Arabic "Hide password" label (05-12).

## Self-Check: PASSED

- FOUND: src/components/auth/auth-sign-in-form.tsx, src/app/[locale]/(viewer)/auth/page.tsx, src/app/[locale]/(viewer)/auth/loading.tsx, src/lib/auth-navigation.ts, tests/unit/auth-navigation.test.ts
- GONE: src/components/auth/auth-panel.tsx, login-form.tsx, signup-form.tsx
- FOUND commits: faf89c57, 2ad3e6f9, 719152f8
