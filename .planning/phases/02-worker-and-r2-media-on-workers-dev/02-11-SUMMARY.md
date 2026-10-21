---
phase: 02-worker-and-r2-media-on-workers-dev
plan: 11
subsystem: security
tags: [turnstile, rate-limit, fail-closed, supabase-auth, captcha, botid-removal, tdd]

requires:
  - phase: 02-worker-and-r2-media-on-workers-dev
    provides: clientIpFrom, decideRateLimit, verifyTurnstileToken (02-04); Turnstile placement signed (02-05)
provides:
  - src/server/form-guard.ts (guardPublicForm, readCaptchaToken, TURNSTILE_FIELD)
  - contact and newsletter actions behind Turnstile siteverify plus a fail-closed limiter on CF-Connecting-IP
  - signInAction/signUpAction pass options.captchaToken to Supabase (no siteverify)
  - BotID server code removed from contact.ts, auth/actions.ts, proxy.ts
affects: [02-13, 02-14, 03]

tech-stack:
  added: []
  patterns:
    - "Public form guard order: secret and token present, siteverify (remoteip), then limiter; a refused request never reaches record()"
    - "rate_limits has only a key column: the IP is folded into the key as <key>:<ip>; the store adapter throws on any Supabase error so decideRateLimit refuses"
    - "Auth token is single-use: auth actions never call siteverify; Supabase CAPTCHA (Phase 3 P3-7) verifies it"

key-files:
  created:
    - src/server/form-guard.ts
    - tests/unit/form-guard.test.ts
  modified:
    - src/app/actions/contact.ts
    - src/app/[locale]/(viewer)/auth/actions.ts
    - src/proxy.ts

key-decisions:
  - "Token plumbing: the actions take typed objects, not FormData, so the token is an optional trailing argument (string, or a FormData carrying cf-turnstile-response); readCaptchaToken handles both. Plan 02-13 passes its token state as that last argument."
  - "Missing or blank TURNSTILE_SECRET_KEY refuses with the captcha error on every target (no production-only branch, no default key). Local runs need a Cloudflare test secret in .dev.vars / .env.local."
  - "Action messages stay plain English strings in the existing result shape (the limiter message was already hard-coded English). No message keys were added to en.json/ar.json."

patterns-established:
  - "Refusals log only fixed reason codes (console.warn '[contact] <ctx> refused <error> <reason>'), never the token, secret or IP"

requirements-completed: []

duration: 35min
completed: 2026-10-20
---

# Phase 02 Plan 11: Turnstile server side, fail-closed limiter, captchaToken on auth Summary

**Contact and newsletter now refuse any request without a valid Turnstile token (siteverify with remoteip) and a free slot in a fail-closed per-IP limiter; sign-in and sign-up hand the token to Supabase as captchaToken; BotID is gone from the server and proxy.**

## Tasks and commits

| Step | Commit | What |
|------|--------|------|
| RED | `61ef98e` | test(02-11): 13 failing tests for guardPublicForm and readCaptchaToken |
| Task 1 | `a051e80` | feat(02-11): form-guard.ts, contact.ts wired for support and newsletter |
| Task 2 | `0d305df` | feat(02-11): auth actions pass captchaToken, BotID removed from auth and proxy |

## What changed

- `guardPublicForm({ token, secret, ip, verify, rateLimit })`: refuses on blank secret, blank token, verifier throw or rejection (error `captcha`, store never called); then `decideRateLimit` (no IP or store error: `unavailable`; limit reached: `rate_limited`); allowed records once. The guard checks secret and token itself, so it never relies on the verifier to refuse.
- `contact.ts`: `getClientIp` (x-forwarded-for, x-real-ip), `withinRateLimit` (failed open), `logBotSignal`, `checkBotId` deleted. `guardAction` runs after zod validation and before any insert. IP comes from `clientIpFrom(await headers(), { allowLocalOverride: LOCAL_DEV === '1' })`. The store adapter uses the same table and columns with key `<support|newsletter>:<ip>` (same format as before), throws on a Supabase error or a missing count. Limits unchanged: support 5/hour, newsletter 10/hour.
- `auth/actions.ts`: `checkBotId`/`logBotSignal` removed; `options.captchaToken` passed to `signInWithPassword` and `signUp` (undefined when empty). Comment explains why there is no siteverify. Everything else unchanged.
- `proxy.ts`: `BOTID_PREFIX`, `isBotIdPath` and the rewrite branch removed. The matcher had no BotID exclusion, so it needed no change. `stripLocale` is still used by the gates.

## Verification

- `form-guard.test.ts`: 13 tests, 13 pass (plan asked for 7 behaviours; extra cases cover null token, blank secret, verifier throw, record failure, ISO since-time, token reader).
- `npm run test:unit`: 628 tests, 628 pass.
- `npm run lint`: 0 errors, 26 warnings (known set). `tsc --noEmit`: clean.
- Plan greps: no `checkBotId|logBotSignal|x-forwarded-for|x-real-ip` in contact.ts; no `checkBotId` in auth/actions.ts; `captchaToken` present; no `BOTID_PREFIX|isBotIdPath` in proxy.ts; no `botid` string in the three files.
- Detached under the heavy lock (`~/clickit-phase02-logs/02-11-build.log`, `exit=0`): `npm run build` green, `npm run cf:preview -- --port 8792` against local config, `node scripts/cf/check-gates.mjs --base http://127.0.0.1:8792`: 9 PASS, ALL PASS (locale redirects, signed-out redirects to `/en/auth`, both cron routes 401). Preview process group stopped by recorded PID; port 8792 free; lock released.

## Not verified

- No end-to-end run of the contact/newsletter actions with a real or test Turnstile secret and the Cloudflare siteverify endpoint: the clients do not send a token until 02-13, and no Turnstile keys exist yet (owner step). Covered by unit tests with fakes only.
- `npm run gate:local` as a single command was not run; its parts (lint, unit, build, cf:build via cf:preview) were run separately, all exit 0.
- Supabase `captchaToken` behaviour with CAPTCHA on: Phase 3 P3-7. Nothing here requires the live project's CAPTCHA setting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Actions do not take FormData**
- **Found during:** Task 1 and 2 (read of current code)
- **Issue:** The plan says `formData.get("cf-turnstile-response")`, but `submitSupportMessage(input)`, `subscribeToNewsletter(input)`, `signInAction(email, password)` and `signUpAction(email, password, name)` take typed arguments, and the plan's interfaces block (`prev, formData`) does not match the code. The four client call sites are unchanged by this plan.
- **Fix:** Added an optional trailing parameter `turnstileToken?: string | FormData` to each action; `readCaptchaToken` reads either form. Existing call sites still compile (the parameter is optional) but are refused by contact/newsletter until 02-13 passes a token.
- **Files modified:** src/server/form-guard.ts, contact.ts, auth/actions.ts
- **Commits:** a051e80, 0d305df

**2. [Rule 2 - Missing critical] Guard checks secret and token itself**
- **Found during:** Task 1 (tests)
- **Issue:** Relying only on the injected verifier to refuse a blank token or secret would let a faulty verifier skip the check.
- **Fix:** `guardPublicForm` refuses blank secret/token before calling the verifier.
- **Commit:** a051e80

### Decisions recorded

- Messages: no `captchaFailed`/`tryLater` keys added to `en.json`/`ar.json`. The only signed wording is the English line "Security check failed. Please try again." (mockups/DECISIONS.md); no Arabic wording is signed anywhere, so I did not invent any. The server returns that English line (and two other fixed English lines) in `message`, the same way the old rate-limit message already worked.

## Owner / controller items

1. **Arabic copy (Koss):** wording for the captcha failure ("Security check failed. Please try again."), the unavailable line ("This service is temporarily unavailable. Please try again later.") and the rate-limit line, if they should show in Arabic. Currently `contact-form`/`newsletter-signup-form` show `result.message` in English for both locales. Needs signed Arabic text and then keys read by 02-13.
2. **Turnstile keys (owner step):** `TURNSTILE_SECRET_KEY` must exist as a Worker secret before workers.dev contact/newsletter can succeed; until then they refuse by design. Local tests can use Cloudflare's documented test secret in the gitignored `.dev.vars` only.
3. **02-13 hand-off:** pass the widget token as the LAST argument: `submitSupportMessage(data, token)`, `subscribeToNewsletter(data, token)`, `signInAction(email, password, token)`, `signUpAction(email, password, name, token)`. The plan 02-13 text "hidden field / formData" should be read this way (or pass a FormData; both work).
4. **LOCAL_DEV=1** is honoured only for the IP override; the 02-06 deploy guard must keep refusing it (T-02-46). Not re-checked here.
5. Heavy lock `/Users/koss/.clickit-heavy.lock` is free.

## Threat coverage

T-02-41 (siteverify with remoteip before any write, missing secret refuses), T-02-42 (CF-Connecting-IP only, fail closed on no IP/store error), T-02-43 (Turnstile before `record()`), T-02-45 (auth actions never call siteverify), T-02-46 (override only via LOCAL_DEV=1). T-02-44 accepted as planned.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- src/server/form-guard.ts, tests/unit/form-guard.test.ts: present.
- Commits 61ef98e, a051e80, 0d305df: present in `git log`.
