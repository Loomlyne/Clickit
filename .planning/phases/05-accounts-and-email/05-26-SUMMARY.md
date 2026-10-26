---
phase: 05-accounts-and-email
plan: 26
subsystem: auth
tags: [profile, password, reauthentication, email-change, notifications, locale, server-actions, tdd]
requires: ["05-12", "05-21", "05-40"]
provides: [passwordUpdateOutcome, passwordLabelState, shouldMirrorLocale, isProfileLocale, savePassword, changeEmail, resendEmailChange, setNotifyNewEpisodes, syncLocale, LocaleSync, shouldSyncLocale, LOCALE_SYNC_KEY]
affects: [05-24, 05-31, 05-33, 05-35]
tech-stack:
  added: []
  patterns: ["pure core plus thin 'use server' wrapper", "optimistic switch with rollback and a polite status", "module-level in-flight guard for a once-per-change client effect", "server-rendered countdown that waits for the first client tick (no hydration mismatch)"]
key-files:
  created:
    - src/server/auth/profile-core.ts
    - tests/unit/password-set.test.ts
    - src/lib/locale-sync-core.ts
    - tests/unit/locale-sync.test.ts
    - src/components/layout/locale-sync.tsx
  modified:
    - src/app/[locale]/(viewer)/profile/actions.ts
    - src/app/[locale]/(viewer)/profile/page.tsx
    - src/components/profile/account-settings.tsx
    - src/components/layout/viewer-shell.tsx
key-decisions:
  - "Resend of a needed reauthentication code = savePassword again without a nonce (Supabase asks again and mails a new code); no extra action"
  - "resendEmailChange passes the account's CURRENT address: GoTrue /resend finds the user by the email column and answers 200 without sending for new_email (found in the local run)"
  - "Per-account limits on the profile actions that send mail: profile_reauth 5/10 min, profile_email_change 3/10 min (change + resend share it), fail closed"
  - "password_set_at is written with the service client on every successful set or change (the M1a trigger blocks it for the user's JWT); wasSet is read before the update"
  - "LocaleSync renders only for a signed-in viewer (initialUser from the layout), so signed-out visitors never call the action"
  - "Pending email card: during the 60 s window 'Resend links' stays visible but disabled with the bare clock; auth.resendIn says 'Resend code in', which names a code"
  - "Profile uses requireViewer's returned user (email, new_email, email_change_sent_at): no second getUser"
requirements-completed: []
duration: 18min (clock 2026-10-26 16:35:28Z to 16:52:56Z)
completed: 2026-10-26
---

# Phase 5 Plan 26: Profile additions Summary

**Profile now sets or changes the password through a server action (min 8, HIBP, `password_set_at`, and an in-place reauthentication code step when Supabase asks for one), changes the email on the server with a pending card that survives reloads and resends both links after 60 s, has a working "New episode emails" switch, and silently mirrors the site language to `profiles.locale` and `user_metadata.locale`. No browser-side `auth.updateUser` and no `app_config` read remain in Profile.**

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 RED | Failing tests for the profile core | `3bbab0b9` |
| 1 GREEN | `src/server/auth/profile-core.ts` | `f4415390` |
| 1 | Profile server actions | `1492389d` |
| 2 | AccountSettings rows, profile page, LocaleSync | `3a0ca74d` |
| fix | Resend by current address, one sync per switch, links countdown | `d2b7a914` |

## What was built

- **`profile-core.ts`** (pure, no imports):
  - `passwordUpdateOutcome`: `saved`, `needs_nonce` (reauthentication_needed), `codeWrong` (reauthentication_not_valid), `passwordMin` (weak_password), `samePassword`, `tooManyTries` (429 and rate-limit codes), else `authGeneric`.
  - `passwordLabelState` (`set` / `change`).
  - `shouldMirrorLocale`: flags only the copies that differ; an invalid locale writes nothing.
- **`profile/actions.ts`** (`'use server'`; `updateProfile` and `finalizeAvatarUpload` unchanged):
  - `savePassword({ password, confirm, nonce? })`: session required, mismatch, `passwordPolicyCheck(password, isPwned)`, a 6-digit `normalizeCode` nonce, `updateUser({ password, nonce })`. On `needs_nonce` it runs the per-account limit and `auth.reauthenticate()`, then returns `{ ok: false, state: 'needs_nonce' }`. On success it writes `password_set_at` with the service client and returns `{ ok: true, wasSet }`.
  - `changeEmail({ email, locale })`: zod email, same address is a no-op, origin from `pickEmailOrigin(siteUrl(), Host)` (05-21 rule), per-account limit, then `updateUser({ email }, { emailRedirectTo: buildEmailRedirect(origin, locale, '/profile') })`. Returns the pending address and the send time.
  - `resendEmailChange({ locale })`: no-op without `new_email`; otherwise `auth.resend({ type: 'email_change', email: <current address> })` with the same redirect and limit.
  - `setNotifyNewEpisodes(on)`: own-row update, `.select()` proves one row changed.
  - `syncLocale(locale)`: no-op signed out or invalid. Otherwise it reads the profile locale and writes only what differs (profile row via the session client, metadata via `updateUser({ data: { locale } })`).
  - Logs: tag, step, Supabase error code. No address, password, code or user id.
- **`account-settings.tsx`**: rows Display name, Email, Password, Notifications (UI-SPEC 6.7).
  - Password row closed: either `passwordNotSet` with `passwordSetHint` and `setPassword`, or dots with `changePassword`.
  - Password edit form: two `PasswordField`s (strength on the new one), `savePassword`, `discardChanges`, spinner. Errors under the fields: `errors.passwordMin`, `errors.passwordMismatch`, `auth.pwLeaked`.
  - Reauthentication step: h3 20px `reauthTitle`, `reauthSub` with the email in `<bdi>`, `CodeField` (auto-submit at six digits), `confirmPasswordChange`, `discardChanges`, and `resendCode` after the 60 s window (`resendIn` countdown, not live). A polite `codeSentAnnounce`. Code errors: `codeWrong`, `codeExpired` (after 15 min), `tooManyTries`, `networkError`.
  - Toasts: `passwordAdded` (set) or `passwordChanged` (change); the row flips to "Change password".
  - Email row: `saveEmail` / `discardChanges`, `dir="ltr"`, errors from i18n keys (`profile.emailInvalid`, `errors.authEmailTaken`, `auth.tooManyTries`, `errors.authGeneric`); `mapAuthError` is no longer used here.
  - Email pending card: `rounded-field border-[var(--line-2)] bg-[var(--bg-2)] p-4`, Clock icon, `emailPendingTitle`, `emailPendingBody` (`<bdi>`), `resendLinks` with the clock, toast `linksResent`. The window starts from `user.email_change_sent_at`; "Change" stays enabled.
  - Notifications row: Bell, `notifLabel` bold, `notifHelp`, `Switch` with `aria-labelledby`/`aria-describedby`, `aria-busy` and disabled while saving, optimistic with rollback, polite `notifOn`/`notifOff`, `notifSaveFailed` (`role="alert"`).
- **`profile/page.tsx`**: `requireViewer(locale, '/profile')` (W12), so signed-out visitors return to Profile after sign-in. `getAdminStatus()` replaces the `app_config.admin_user_id` read. The profile select adds `password_set_at, notify_new_episodes`. AccountSettings receives `hasPassword`, `notifyNewEpisodes`, `pendingEmail = user.new_email`, `emailChangeSentAt`, `locale`.
- **`locale-sync-core.ts`** + **`locale-sync.tsx`**: one sessionStorage key `clickit:locale-last-synced`; `shouldSyncLocale(current, lastSynced)`; the effect calls `syncLocale` once per language change, stores on success, and retries on the next mount after a failure. Renders nothing. **`viewer-shell.tsx`** renders `<LocaleSync />` once, for a signed-in viewer only.

## Verification

Verified:
- Task 1 verify (`node --test tests/unit/password-set.test.ts && npx tsc --noEmit`): 10/10, exit 0. RED failed first (`ERR_MODULE_NOT_FOUND`). Acceptance grep `isPwned\|passwordPolicyCheck` in actions.ts: 3.
- Task 2 verify chain (locale-sync test 4/4, tsc, eslint on profile/locale-sync/viewer-shell, no `auth.updateUser|admin_user_id` in account-settings or the page, no raw `type="password"`, `<LocaleSync` in viewer-shell): exit 0. `PasswordField` 3 matches; `Switch` present.
- Detached under the lock (`/Users/koss/.clickit-checks/p5-26-check.log`, `exit=0`, HEAD `d2b7a914`): `npm run test:unit` 2711/2711; `npx tsc --noEmit` 0; eslint 0 errors (3 pre-existing warnings in other files); `cf:build` with the placeholder public env OK; `cf:bundle-budget` below.
- Local end-to-end (`/Users/koss/.clickit-checks/p5-26-e2e.log`, 34/34 PASS). It used `next dev` on port 3126, the shared local stack, Mailpit and headless Chromium:
  - Signed out, `/en/profile` answers 307 to `/en/auth?next=%2Fprofile`.
  - Magic-link user: "Not set", the hint and "Set password"; no Admin badge.
  - Switch: starts on, labelled and described; off and on are written to `notify_new_episodes` and announced.
  - Password: short and mismatch refused; two eye buttons; `password123` refused as leaked (HIBP reachable); set shows "Password added." and records `password_set_at`; change shows "Password changed."; the new password signs in at GoTrue (200).
  - Locale: `/ar/profile` sets `profiles.locale` and `user_metadata.locale` to `ar` with one action call; a reload sends no call; `/en/watch` puts both back to `en` with one call.
  - Email change: two Mailpit messages (old and new address); the pending card shows the new address, survives a reload, "Change" stays enabled, "Resend links" is disabled for 60 s; then "Links sent again" and two more messages; `auth.users.email` is unchanged until the links are opened.
  - No page errors and no hydration errors.
  - The dev server was stopped by its own process group, and `AGENTS.md` was restored.

Not verified:
- **Reauthentication step at runtime.** Local `secure_password_change = false` (GoTrue `UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=false`), and changing the shared stack's config needs a restart, which is not allowed. The step renders only if Supabase asks (UI-SPEC item 11); live is an owner step (05-35).
- Arabic Profile visuals and the eye at `/ar` in a browser (pinned by the 05-12 source tests), and a screen reader pass. These go to 05-31 e2e and UAT 05-33.
- Opening the two email-change links end to end from Profile. 05-23 proved that leg.

Failed: none.

## Worker bundle

```
bundle-budget ok gzip=2994.93 KiB total=14710.83 KiB budget=3000 KiB headroom=5.07 KiB
```

+9.14 KiB gzip over the 2,985.79 KiB baseline. No new route was added. The growth has two causes:
- **The profile actions chunk** (`src_app_[locale]_(viewer)_profile_actions_ts_*.js`, 9.6 KB raw / 3.9 KB gzip) now holds this plan's five actions plus sign-in-core, hibp and the rate-limit store.
- **The shared viewer shell now references that module** through `LocaleSync`, so 20 viewer routes now carry it in their server-action wiring. The code itself is deduplicated in one chunk.

Option for the controller: move `syncLocale` into its own small `'use server'` module, so the shell references only that module and not the whole profile actions file. I did not do this, because the plan names `actions.ts` and the brief says not to trim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Email-change resend sent nothing**
- **Found during:** local e2e
- **Issue:** the plan said `resend({ type: 'email_change', email: user.new_email })`. GoTrue looks the account up by its current address, so it answered 200 and sent no mail.
- **Fix:** pass `user.email`, with a comment. After the fix the e2e shows two new Mailpit messages.
- **Commit:** `d2b7a914`

**2. [Rule 1 - Bug] Locale sync sent two calls per language switch in dev**
- **Found during:** local e2e
- **Issue:** StrictMode runs the effect twice, and each run called the action.
- **Fix:** a module-level in-flight guard. The stored value is written only if the viewer is still on that language, so a fast en -> ar switch cannot record the older one. The e2e now counts 1 call per switch and 0 on reload.
- **Commit:** `d2b7a914`

**3. [Rule 2 - Security] Per-account limits on the actions that send mail**
- **Found during:** Task 1
- **Issue:** `changeEmail` can mail any address from a signed-in account, and repeated reauthentication mails the account itself. The project pattern (T-05-21-02) is a fail-closed limiter on every action that sends an email.
- **Fix:** `profile_reauth` 5 per 10 min; `profile_email_change` 3 per 10 min, shared by change and resend.
- **Commit:** `1492389d`

**4. Additions**
- `tooManyTries` outcome in `passwordUpdateOutcome`, tested.
- `isProfileLocale` export.
- `resendEmailChange` takes `{ locale }` for the redirect.
- AccountSettings takes `locale` and `emailChangeSentAt`, so the 60 s window survives a reload.
- The code step also has `discardChanges`, as a way out.
- **Commits:** `f4415390`, `1492389d`, `3a0ca74d`

**5. Plan wording**
- The artifact lists `uploadAvatar`. That function was removed in 02-19; `finalizeAvatarUpload` is the existing avatar action and is unchanged.
- `requireViewer` already returns the user (05-40), so there is no second `getUser`.

**6. Copy**
- The pending card's countdown does not reuse `auth.resendIn` ("Resend code in"). It shows the disabled "Resend links" button with the bare clock instead.
- `samePassword` has no UI-SPEC string, so it shows `errors.authGeneric` under the password field (NEEDS KOSS below).

## Known Stubs

None. Every control on the card calls a server action.

## Threat Flags

None beyond the register:
- **T-05-26-01:** HIBP and length checks on the server; the nonce path is honoured when Supabase asks.
- **T-05-26-02:** the redirect is built on the server from the site URL or allow-listed host; Secure email change is on locally (two mails seen).
- **T-05-26-04:** no address or password is logged.

The new per-account limits reduce risk; they add no new surface.

## Notes for the controller

- Local stack writes, all on the shared `supabase_db_Clickit` stack: three throwaway users (`profile-0526-*@example.test`, one debug user `profile-0526-dbg-*`), their profile rows, `rate_limits` rows, and Mailpit messages. No reset, no stop or start, nothing live.
- AUTH-03, AUTH-04, MAIL-01 and MAIL-04 stay Pending:
  - AUTH-04 waits for the 05-24 reset page and live templates (05-35).
  - MAIL-01 waits for live templates and SMTP.
  - MAIL-04 waits for the digest cron (05-20) and the go-live.
  - AUTH-03 is complete in code. Its UAT is 05-33.

## NEEDS lines

NEEDS CONTROLLER: Worker gzip 2,994.93 KiB after 05-26 (+9.14 KiB, headroom 5.07 KiB under the 3,000 KiB gate:local budget). No new route. The growth is the bigger profile actions chunk plus 20 viewer routes now wiring it through LocaleSync in the shared shell. One option: move syncLocale into its own small 'use server' module. The next Phase 5 page route will cross the budget.

NEEDS KOSS: wording for "new password is the same as the current one" (Supabase same_password) on Profile; it shows the generic "Authentication failed. Please try again." until a string (EN + AR) is given.

## Self-Check: PASSED
