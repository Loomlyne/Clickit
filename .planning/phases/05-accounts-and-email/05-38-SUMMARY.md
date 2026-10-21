---
phase: 05-accounts-and-email
plan: 38
subsystem: auth-email
tags: [supabase-local, gotrue, mailpit, go-templates, locale, spike]
requires: ["05-10", "05-13"]
provides: [phase5-local-auth-config-live-on-shared-stack, locale-branch-proof, from-header-proof]
affects: [05-17, 05-31, 05-35]
tech-stack:
  added: []
  patterns: ["probe script in the session scratchpad, not the repo; local-host assertion before any call; results in /Users/koss/.clickit-checks/p5-locale-probe.log ending exit=<rc>"]
key-files:
  created: []
  modified: []
key-decisions:
  - "Go template `eq .Data.locale \"ar\"` is safe on a missing locale on the local GoTrue: a user with no locale gets the English branch (A6 answered, no 05-10 revision needed)"
  - "From header on the local stack is exactly `Clickit Story <no-reply@clickitstory.ae>` for all four mails (A9 answered locally; live still depends on the Resend SMTP settings in 05-35)"
requirements-completed: []
duration: 20min
completed: 2026-10-21
---

# Phase 5 Plan 38: Local-stack spike Summary

**The shared local stack runs the Phase 5 auth config, and a real GoTrue plus Mailpit probe shows the Arabic branch for `locale: ar`, the English branch for no locale, a 6-digit code in every mail, and the From header `Clickit Story <no-reply@clickitstory.ae>`, for both the sign-up confirmation and the sign-in code mails.**

## Task 1: Controller go and stack restart

- Go: the controller approved the restart at about 15:30Z on 2026-10-21 with conditions: take the lock, check `project_id = "Clickit"`, plain `supabase stop` only, do not touch ALMAR, check migrations and row counts. It was relayed to me by the coordinator.
- The coordinator ran the restart itself under those conditions, so this executor did not restart anything. What follows is the coordinator's record, not something I ran:
  - Restart 15:31-15:32Z, log `/Users/koss/.clickit-checks/p5-stack-restart.log` (ends `lock released 2026-10-21T15:32:08Z`, `exit=0`). stop rc=0, start rc=0, status rc=0. shows/episodes/users/profiles were 15/94/0/0 before and after. No other stacks were running.
  - Phase 3 then reset the stack twice. The auth container kept the Phase 5 config, checked by the coordinator at 15:35Z with `docker inspect supabase_auth_Clickit`: `GOTRUE_MAILER_AUTOCONFIRM=false`, MFA TOTP enroll and verify enabled, `MAILER_OTP_EXP=900`, `MAILER_TEMPLATES_*` set.
  - M1a and M1b re-applied with psql at 15:36Z (log `p5-m1-psql-2.log`, `exit=0`).
- Re-checked by this executor before Task 2: only `supabase_db_Clickit` runs; `docker inspect supabase_auth_Clickit` shows `AUTOCONFIRM=false`, `MFA_TOTP_ENROLL/VERIFY_ENABLED=true`, `MAILER_OTP_EXP=900`, the five `MAILER_TEMPLATES_*` URLs and SMTP admin `no-reply@clickitstory.ae`; migrations end `20261021151843, 20261021143410, 20261021142458, 20261021120000`; `public.email_outbox` exists; `/Users/koss/.clickit-heavy.lock` is absent.

## Task 2: Locale branch and From header through Mailpit

Probe script (scratchpad, not in the repo) calls `POST /auth/v1/otp` on `http://127.0.0.1:55321` (host asserted local before any call) for `p5c-ar@clickit.local` with `data.locale = "ar"` and `p5c-none@clickit.local` with no data, reads the mails from Mailpit (`127.0.0.1:55324`), then confirms both users with the emailed code and repeats the request after the 60 s resend window. Final run: 28 PASS, 0 FAIL, log `/Users/koss/.clickit-checks/p5-locale-probe.log` ends `exit=0`.

| Stage / template | User | Subject | Result |
|---|---|---|---|
| sign-up confirmation | ar | أكّد بريدك في Clickit Story | `<html dir="rtl">`, Arabic heading, no English heading, 6-digit code |
| sign-up confirmation | none | Confirm your Clickit Story email | `<html dir="ltr">`, English heading, no Arabic heading, 6-digit code |
| sign-in code (magic_link) | ar | رمز الدخول إلى Clickit Story | rtl, Arabic heading, no English heading, 6-digit code |
| sign-in code (magic_link) | none | Your Clickit Story sign-in code | ltr, English heading, no Arabic heading, 6-digit code |

- AR branch seen: yes. No-locale rendered English: yes (A6: `eq` on a missing `.Data.locale` does not error and is false). Code present: yes, all four. From header: `Clickit Story <no-reply@clickitstory.ae>` on all four, so no A9 gap locally.
- Fact for 05-31: a brand-new user requesting a sign-in code gets the **confirmation** template (with the code and a confirm link), not magic_link. The magic_link template only goes to confirmed users. Specs must expect that.
- Fact: the code sits in the `user-select:all` code cell; the 05-31 helper should read it from there, not take the first 6-digit string (the HTML carries CSS colours such as `#090909`).

## Deviations from Plan

**1. [Rule 1 - probe bug] Two probe runs failed because of the script, not the product.** First run asserted the magic_link headings on a mail that was the confirmation template (new users get the confirmation mail). Second run took the first 6-digit string in the HTML, which was a CSS colour, so verifying the Arabic user failed with 403 and that user stayed unconfirmed, so it got the confirmation mail again. Fixed the script (stage 1 expects confirmation headings, stage 2 magic_link; code read from the code cell), used fresh test addresses, and the third run passed. The two earlier runs left test users `p5-ar`, `p5-none`, `p5b-ar`, `p5b-none` (and `p5c-*`) at `@clickit.local` in the shared local auth.users; they are disposable test data (Phase 6 reads no users; users count was 0 before).

**2. [Controller-run Task 1]** The restart was executed by the coordinator, not this executor (see above). The plan's verify command `tail -1 p5-stack-restart.log | grep -qx exit=0` holds.

Otherwise the plan ran as written. No repo files were changed by this plan.

## Requirements

MAIL-01 and AUTH-02 stay Pending. This plan proves only the local half (templates, locale branch, From header on local Mailpit). MAIL-01 needs the Resend SMTP settings and pasted templates live (05-35); AUTH-02 needs the sign-in flow and its UAT.

## Stubs and threat flags

None. No live Supabase access; probe host asserted local; no keys written to any file or log (the anon key was only passed through the process environment).

## Not verified

- Live GoTrue behaviour (Resend SMTP, pasted templates): 05-35.
- Recovery, email_change and reauthentication mails were not sent in this probe (same locale branch construct; 05-31 covers them).
- Rendering in real mail clients.

## Self-Check: PASSED

- Probe log exists and ends `exit=0`; restart log exists and ends `exit=0`.
- `supabase_db_Clickit` running alone; no heavy lock left behind; migrations still end `20261021151843`; `public.email_outbox` exists.
