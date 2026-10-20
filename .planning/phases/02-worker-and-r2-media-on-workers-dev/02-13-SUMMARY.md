---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 13
subsystem: security
tags: [turnstile, captcha, client, supabase-auth, botid-removal, deploy-guard, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: Turnstile placement signed (02-05); server actions take the token as last argument (02-11)
provides:
  - src/lib/turnstile-widget.ts (turnstileWidgetOptions, isTurnstileConfigured, isCaptchaFailure, CAPTCHA_FAILED_MESSAGE)
  - src/components/security/turnstile-field.tsx (TurnstileField, useTurnstileToken, isTurnstileEnabled)
  - Turnstile on sign-in, sign-up, reset request, contact, newsletter, placed as signed (turnstile-A)
  - deploy guard refuses a workersdev stamp with a Cloudflare test site key or no site key
affects: [02-14, 02-22, 03]

tech-stack:
  added: []
  patterns:
    - "Single-use token: every submit calls captcha.consume(); the widget is remounted through a React key, so no ref is read during render"
    - "Build stamp records the site key class (missing | test | real), never the key"

key-files:
  created:
    - src/lib/turnstile-widget.ts
    - src/components/security/turnstile-field.tsx
    - tests/unit/turnstile-widget.test.ts
  modified:
    - src/components/auth/login-form.tsx
    - src/components/auth/signup-form.tsx
    - src/components/support/contact-form.tsx
    - src/components/layout/newsletter-signup-form.tsx
    - src/app/[locale]/(viewer)/auth/page.tsx
    - src/messages/en.json
    - src/messages/ar.json
    - scripts/cf/build-target.mjs
    - scripts/cf/deploy-guard.mjs
    - tests/unit/deploy-guard.test.ts
    - .planning/phases/02-worker-and-r2-media-on-workers-dev/deferred-items.md
  deleted:
    - src/components/auth/botid-init.tsx

key-decisions:
  - "Token hand-off follows 02-11: last optional argument (signInAction, signUpAction, submitSupportMessage, subscribeToNewsletter); reset request passes options.captchaToken to resetPasswordForEmail"
  - "Without a site key the widget is not drawn and submit is not blocked; contact and newsletter are refused by the server (02-11), sign-in and sign-up go to Supabase with no token. No dead control, no fake widget"
  - "The captcha refusal line sits under the widget (signed); the same message is not shown a second time as a toast or status line when the widget is drawn"

patterns-established:
  - "Deploy guard stamps classify, never store, public keys"

requirements-completed: []

duration: 150min
completed: 2026-10-20
---

# Phase 02 Plan 13: Turnstile widget on the five forms, BotID client removed

**Sign-in, sign-up, reset request, contact and newsletter now carry the Turnstile widget exactly as Koss signed (box above the button, newsletter interaction-only), submit stays disabled until a token exists, the single-use token is renewed after every submit, and the BotID client code is gone. The deploy guard now refuses a Cloudflare test or missing site key.**

## Tasks and commits

| Step | Commit | What |
|------|--------|------|
| RED | `229c7c5` | test(02-13): 6 failing tests for the widget options helper |
| Task 1 | `35286c4` | feat(02-13): `turnstile-widget.ts`, `TurnstileField`, `useTurnstileToken`, `turnstile.checkFailed` key |
| Guard | `92bc4bd` | feat(02-13): stamp records `turnstileSiteKey`, `checkDeploy` refuses test or missing key, 4 new tests |
| Task 2 | `098fbe2` | feat(02-13): five forms wired, `botid-init.tsx` deleted, `BotIdInit` removed from the auth page |
| Docs | (this commit) | deferred-items 4-6, this summary |

## What changed

- `turnstileWidgetOptions({ form, locale })`: dark theme, `size: flexible` (full form width), `appearance: always` for sign-in, sign-up, reset and contact, `interaction-only` for the newsletter; language `ar` for the Arabic locale, `en` otherwise. Only the signed option is encoded.
- `TurnstileField` draws `@marsidev/react-turnstile` with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; nothing at all when the key is blank. The signed line "Security check failed. Please try again." (role=alert, 12px, existing red-safe token) shows under the widget when the widget errors or the form says the server/Supabase refused the check.
- `useTurnstileToken()`: token, failed flag and a widget key. `consume(refused)` clears the token and remounts the widget. `awaitingToken` is true only when a site key is configured, so submit is never blocked by a widget that does not exist.
- login-form: sign-in passes the token to `signInAction`; the reset request calls `resetPasswordForEmail(email, { redirectTo, captchaToken })`, then renews the widget. Switching between sign-in and reset clears the token. Password eyes untouched.
- signup-form, contact-form, newsletter-signup-form: token as last action argument, submit disabled while waiting, widget renewed after every attempt.
- Deploy guard: `makeStamp` adds `turnstileSiteKey: 'missing' | 'test' | 'real'` (Cloudflare test keys `[0-9]x` + 20 zeros + two letters); `checkDeploy` refuses anything but `real`, including an older stamp without the field. 02-06 did not cover this. Test fixture site key changed to a made-up non-test value.
- `botid-init.tsx` deleted; `BotIdInit` import and render removed from `auth/page.tsx`; comment mentioning BotID in signup-form rewritten. `grep -ri botid src` is empty.

## Verification

- `npm run test:unit`: 711 tests, 711 pass (6 new widget tests, 4 new deploy-guard tests; 701 before this plan).
- `npm run lint`: 0 errors, 26 warnings (the known set). `tsc --noEmit`: clean.
- `npm run gate:local` (lint, unit, build, cf:build) run detached under the heavy lock: `~/clickit-phase02-logs/02-13-gate.log`, `exit=0`.
- Plan greps: no `botid` under `src`; `TurnstileField` in all four form files; `captchaToken` in login-form; Eye/EyeOff imports still in login-form and signup-form.
- Local preview, local Supabase (`supabase_*_Clickit` stack already running, not started by me), Cloudflare test site key `1x00000000000000000000AA`, headless Chromium, port 8796, lock held, processes stopped by recorded PID, port free, lock released. The preview build only differed from the repo by an uncommitted, reverted `next.config.ts` CSP patch (see Deviations). Logs: `~/clickit-phase02-logs/02-13-run.log`.

Pass secret (`1x0000000000000000000000000000000AA`):

| Check | Result |
|-------|--------|
| Sign-in: submit disabled before token, widget drawn, enabled after token, box sits above the button | PASS |
| Sign-in end to end (fresh browser, test user, token to Supabase via action) lands on /watch | PASS |
| Reset: disabled after switching, widget drawn above the button, enabled after token, request accepted by local Supabase with `captchaToken` | PASS |
| Sign-up: same widget checks, both password eyes present, account created, lands on /watch | PASS |
| Contact: disabled before token, widget above button, enabled after token, message saved, success toast | PASS |
| Newsletter (`/en/updates?show=...`): disabled before token, enabled after token, no visible box (interaction-only, height 0), status "signup saved" shown | PASS |
| Mobile 390px /en/auth and /en/support: no horizontal overflow, widget 350 and 308 px wide | PASS |
| Arabic /ar/support: widget renders | PASS |

Fail secret (`2x0000000000000000000000000000000AA`), contact:

| Check | Result |
|-------|--------|
| Signed line "Security check failed. Please try again." appears under the widget | PASS |
| No duplicate toast | PASS |
| Widget remounted (old widget gone) and submit enabled again with a new token | PASS |

## Not verified

- Newsletter with the always-fail secret (same code path as contact; only contact was run).
- Reset / sign-in / sign-up when Supabase CAPTCHA is enabled and rejects a token (Phase 3 step P3-7); local Supabase has CAPTCHA off, so the token was sent but not enforced.
- The widget under the real CSP: the shipped CSP does not allow `challenges.cloudflare.com` yet (see Owner / controller items).
- Appearance of the widget and the error line against the signed PNG (no PNGs read by work sessions); geometry (above the button, full width, no overflow) was measured instead.
- Whether Cloudflare actually draws `language: ar` (only that the widget renders in the Arabic page).
- A real (non-test) site key: none exists; owner step.
- The "footer newsletter": on this branch no footer renders `NewsletterSignupForm`; the only user is `/en/updates` (signed-in only, see deferred-items 5). The signed behaviour is applied through the shared form component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No imperative `reset()` handle**
- **Found during:** Task 2 (lint)
- **Issue:** a `forwardRef` handle read inside the submit handlers tripped `react-hooks/refs` ("Cannot access refs during render", 3 errors) because `handleSubmit(onSubmit)` is called during render.
- **Fix:** `useTurnstileToken().consume()` clears the token and bumps a React `key`, which remounts the widget (a fresh single-use token). Same behaviour, no ref. The plan allowed "forwardRef or a callback ref"; this is neither, and it is simpler.
- **Commit:** 098fbe2 (component rewritten before the commit)

**2. [Rule 2 - Missing critical] Deploy guard did not cover the Turnstile site key**
- **Found during:** Task 1 (checked scripts/cf)
- **Issue:** the brief requires the guard to refuse a workersdev stamp with a Cloudflare test site key or no site key; `checkDeploy` had no such rule and the stamp held only hashes.
- **Fix:** stamp field `turnstileSiteKey` (class only), `checkDeploy` reasons, fixture update, 4 tests.
- **Commit:** 92bc4bd

**3. [Rule 3] Plan text says hidden `cf-turnstile-response` input / formData**
- The actions take typed arguments (02-11), so the token goes as the last argument. The widget still renders its own hidden `cf-turnstile-response` input in the DOM (confirmed on preview), unused by the code.

**4. Helper signature**
- The plan's behaviour list had a `signed` argument. After Koss signed A the unsigned branches are deleted (as the plan says), so the helper takes `{ form, locale }` only and the tests cover the signed option.

**5. Missing site key behaviour**
- Brief: "clear, honest disabled/unavailable state (as signed)". The signed picture has no such state and no copy exists for one, so none was invented. Behaviour is as in the plan: no widget, form not blocked, the server refuses contact and newsletter (the user sees the existing English refusal line as toast or status), auth goes to Supabase. This is the open question for Koss below.

### Temporary, reverted

- For the preview run only, `next.config.ts` was patched in the working tree (never committed, restored with `git checkout -- next.config.ts` by the script) to allow `challenges.cloudflare.com` in `script-src`, `frame-src`, `connect-src` and `http://127.0.0.1:55321` in `connect-src`. `.env.preview.local` and `.dev.vars` got the test site key and test secrets and were restored from backups. `git status` is clean apart from the committed work.

### Left alone on purpose

- `botid` stays in `package.json` and `next.config.ts` is untouched: only the client code in `src/` was named by this plan (02-14 removes the rest).
- No `package.json` / lock change.

## Arabic pending Koss signature

Only English wording is signed. `src/messages/ar.json` carries the key with the English text so nothing breaks; do not treat it as final Arabic.

| Key (namespace `turnstile`) | English text now in both en.json and ar.json | Status |
|---|---|---|
| `checkFailed` | Security check failed. Please try again. | Arabic pending Koss signature |

Also still English-only (from 02-11, not keys yet, shown as `result.message`): "Too many requests. Please try again in a little while." and "This service is temporarily unavailable. Please try again later." Arabic pending Koss signature if they should be localised. The widget itself speaks Arabic through Cloudflare's own `language: ar`.

## Owner / controller items

1. **Site key and secret (owner):** create the real Turnstile widget; `NEXT_PUBLIC_TURNSTILE_SITE_KEY` into the workersdev env file before building, `TURNSTILE_SECRET_KEY` as a Worker secret (RUNBOOK Step 20). The deploy guard now refuses a build without the key or with a Cloudflare test key.
2. **02-14 (CSP):** the shipped CSP blocks the widget. Add `https://challenges.cloudflare.com` to `script-src`, `frame-src` and `connect-src`. For preview builds only, also allow the local Supabase origin in `connect-src` / `img-src` (deferred-items 6).
3. **Koss decision:** should a build without a site key show a visible "protection unavailable" state on the forms? It needs signed wording (and Arabic), so none was added.
4. **Koss signature:** the Arabic line above.
5. **Deferred bug (not mine, found while testing):** `NewsletterSignupForm` never submits without `?show=` (empty hidden inputs fail the schema silently). deferred-items 4.
6. Supabase CAPTCHA enforcement for the auth forms is Phase 3 P3-7; until then the auth token is sent but not enforced.
7. Heavy lock `/Users/koss/.clickit-heavy.lock` is free (checked after the gate run). Local test data created in the local Supabase only: two `captcha-*@example.com` users, one support message and one newsletter row.

## Threat coverage

T-02-59 (client sends the token the server verifies; no widget means the server still refuses contact/newsletter), T-02-60 (token cleared and widget remounted after every submit, confirmed on preview), T-02-61 (widget not drawn without a key, forms still work; deploy guard now blocks a keyless workers.dev build), T-02-62 (only the Turnstile script is loaded by the new code; CSP allow-list is 02-14).

## Known Stubs

None. (`ar.json` holds English text for `turnstile.checkFailed`, listed above, pending signature.)

## Threat Flags

None.

## Self-Check: PASSED

- Files present: `src/lib/turnstile-widget.ts`, `src/components/security/turnstile-field.tsx`, `tests/unit/turnstile-widget.test.ts`; `src/components/auth/botid-init.tsx` absent.
- Commits `229c7c5`, `35286c4`, `92bc4bd`, `098fbe2` present in `git log`.
