---
phase: 05-accounts-and-email
plan: 23
subsystem: auth
tags: [auth, email-links, token-hash, verifyOtp, cross-device, referrer-policy, next-intl, tdd]
requires: ["05-10", "05-12", "05-18", "05-21"]
provides: [CONFIRM_TYPES, parseConfirmParams, confirmOutcome, expiredRetryHref, recoveryDestination, confirmLink, ConfirmLinkForm, ConfirmExpiredCard, "/{locale}/auth/confirm page", "/auth/confirm root redirector"]
affects: [05-24, 05-26, 05-31, 05-33, 05-35]
tech-stack:
  added: []
  patterns: ["button interstitial: GET parses only, a server action spends the token", "useActionState over a client wrapper that turns a thrown action into a retry state", "path-specific next.config header listed after the baseline overrides it"]
key-files:
  created:
    - src/server/auth/confirm-core.ts
    - tests/unit/confirm-link.test.ts
    - src/app/auth/confirm/route.ts
    - src/app/[locale]/(viewer)/auth/confirm/page.tsx
    - src/app/[locale]/(viewer)/auth/confirm/actions.ts
    - src/components/auth/confirm-link-form.tsx
  modified:
    - next.config.ts
key-decisions:
  - "confirmOutcome adds a 'retry' outcome (no answer, 5xx, 429/rate-limit codes): the token is not spent, so the button stays with the network AuthAlert instead of a false 'expired' card (UI-SPEC 6.3 network state)"
  - "An invalid link keeps a known type, so an expired recovery link still offers 'Request a new link' (/auth?mode=forgot); a next other than /browse rides along on the retry link"
  - "The action returns the expired card's retry href, so the client bundle never imports confirm-core"
  - "Navigation after sign-in is window.location.replace(getPathname(...)) (project hard rule), not assign as the plan said: full load into the other layout tree, spent link out of history"
  - "Recovery runs afterSignIn (profile, locale, welcome claim) and ignores its destination: /auth/reset-password?next=<safe next>"
  - "Email change links do not run afterSignIn: the account already exists; first link = pending_other card, second = email updated card"
  - "Referrer-Policy: no-referrer is also sent as an HTTP header on /auth/confirm and /{en,ar}/auth/confirm (next.config path entries after the baseline); the baseline header had replaced the route's own value"
requirements-completed: []
duration: 12min
completed: 2026-10-26
---

# Phase 5 Plan 23: Cross-device email links Summary

**Token-hash email links land on a one-button page; only the `confirmLink` server action calls `verifyOtp({ token_hash, type })`, so mail scanners cannot spend the token, and sign-up, reset and email-change links work in any browser on any device.**

## What was built

- `src/server/auth/confirm-core.ts` (pure, tested):
  - `CONFIRM_TYPES` = signup, recovery, email_change, email, magiclink.
  - `parseConfirmParams`: token_hash `^[A-Za-z0-9_-]{10,200}$`, repeated params refused, next through `getSafeAuthNextPath` (max 512, default `/browse`).
  - `confirmOutcome`: signed_in, recovery, pending_other, email_changed, expired, retry.
  - `expiredRetryHref` and `recoveryDestination`.
- `src/app/auth/confirm/route.ts`: GET only. Redirects 303 to `/{cookie locale}/auth/confirm` with the same query. Sets `no-referrer` and `no-store`. Never touches Supabase.
- `src/app/[locale]/(viewer)/auth/confirm/page.tsx`: the metadata sets `referrer: 'no-referrer'` and `robots: noindex, nofollow`. The page parses the query only. An invalid link shows the expired card with no form; a valid one shows `ConfirmLinkForm`.
- `src/components/auth/confirm-link-form.tsx` (`'use client'`):
  - **Variant cards** (UI-SPEC 6.3 table): MailCheck, KeyRound or Mail icon, with the title, body and button for the link type.
  - **Button:** takes focus on load and on every card swap. While working it shows a spinner and `working`.
  - **Outcome cards:** pending_other (Clock, outline `goToProfile`), email_changed (green CheckCircle2, `goToProfile`), expired (red AlertCircle, `backToSignIn`, or `requestNewLink` for recovery).
  - **Retry:** `errors.networkError` alert above an enabled button.
- `src/app/[locale]/(viewer)/auth/confirm/actions.ts` (`confirmLink`):
  - Re-validates every field (the action can be called on its own), then calls `verifyOtp` and maps the result with `confirmOutcome`.
  - Sign-in links run `afterSignIn(user, { method: 'link', locale, next, supabase })`.
  - Recovery runs `afterSignIn`, then returns `/auth/reset-password?next=`.
  - Logs `[auth/confirm] <outcome> <error code>` only.

## Verification

- Task 1 verify (`node --test tests/unit/confirm-link.test.ts`): 21/21 pass. The RED run failed first (module missing). RED commit `724e61dd`, GREEN commit `3ff1fe9d`.
- Task 2 verify (tsc + the four grep checks): exit 0. `grep "export async function POST\|export async function GET"` on the root route shows GET only.
- `npm run test:unit`: 2,697/2,697 pass. `npx tsc --noEmit`: clean. eslint on every touched file: clean (`clickit/no-raw-design-values` included).
- Local end-to-end run: `next dev` on port 3123, local stack, headless Chromium, real tokens from local GoTrue `generate_link` and from Mailpit. 12/12 checks pass:
  - **Sign-up link:** fetched twice with GET first (scanner simulation, page and root route), then pressed. Lands on `/en/auth/welcome?next=%2Fseries%2Ftest` with a session cookie.
  - **Same link again:** "This link has expired".
  - **Recovery link:** `/en/auth/reset-password?next=%2Fseries%2Ftest`, signed in.
  - **Magic link on `/ar`:** `/ar/auth/welcome?next=%2Fbrowse`.
  - **Secure email change:** `updateUser` sent two real mails to Mailpit, both with `type=email_change`. The first link shows "Confirmed. Now open the link we sent to the other address". The second shows "Your email is updated", and `auth.users.email` is the new address.
  - **Recovery hash posted as `type=signup`:** expired card.
  - **Focus:** after hydration it is on the button (valid link) and on the "Back to sign in" link (invalid link). An early probe run before hydration read null; that was timing, not a bug.
- curl checks:
  - The root route answers 303 with `/ar/...` when the `NEXT_LOCALE=ar` cookie is set, and 405 for POST.
  - The page carries `<meta name="referrer" content="no-referrer">` and robots `noindex, nofollow`. Both routes send the `Referrer-Policy: no-referrer` header; `/en/auth` keeps `strict-origin-when-cross-origin`.
  - An unsafe next (`https://evil.test`) becomes `/browse`. An `invite` type gets the expired card. An invalid Arabic recovery link offers `/ar/auth?mode=forgot&next=%2Fseries%2Fx`.
- Bundle (`cf:build` + `cf:bundle-budget`, detached under the heavy lock, log `/Users/koss/.clickit-checks/05-23-cfbuild.log`, exit=0): **gzip 2,985.79 KiB, headroom 14.21 KiB** (was 2,974.77 / 25.23; +11.02 KiB). The growth is the new page route's per-route server files: its client-reference manifest alone is 37 KB raw. The root route adds a little more.
- `next dev` was stopped by its own process group. It rewrote `AGENTS.md`, which was restored with `git checkout -- AGENTS.md`.

## Commits

| Commit | Message |
|--------|---------|
| 724e61dd | test(05-23): add failing tests for confirm link core |
| 3ff1fe9d | feat(05-23): pure confirm link core |
| 0657acf3 | feat(05-23): email-link confirm page, action and root redirector |
| b7ae7a51 | fix(05-23): no-referrer header on the email-link confirm routes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Referrer-Policy header on the confirm routes**
- **Found during:** Task 2 runtime check.
- **Issue:** the baseline `/:path*` header (`strict-origin-when-cross-origin`) replaced the root route's own `no-referrer`. The page also had only the meta tag, which takes effect only after parsing.
- **Fix:** added two `next.config.ts` header entries after the baseline, for `/auth/confirm` and `/:locale(en|ar)/auth/confirm`, with `Referrer-Policy: no-referrer`. The watch-layout guard that pins the baseline value still passes (23/23).
- **Files modified:** `next.config.ts` (not in the plan's file list).
- **Commit:** b7ae7a51

**2. [Rule 1 - Bug] Network or server trouble is not an expired link**
- **Found during:** Task 1.
- **Issue:** the plan maps "any error" to expired. A Supabase outage, 5xx or 429 would then tell the visitor the link expired even though it is still valid. UI-SPEC 6.3 has a separate network state with a retry.
- **Fix:** `confirmOutcome` returns `retry` for `AuthRetryableFetchError`, status 0, 429, 5xx and the rate-limit codes. A thrown action (server unreachable) is also `retry`. Tested.
- **Commit:** 3ff1fe9d

**3. [Hard rule] `window.location.replace`, not `assign`**
- The plan said `window.location.assign(destination)`. The project rule is a full load with `window.location.replace(getPathname(...))`, which also keeps the spent link page out of history.
- **Commit:** 0657acf3

**4. Small additions to the core:** `expiredRetryHref` and `recoveryDestination` are extra pure exports, tested. The expired card's href is computed on the server (page and action), so the client never imports the core.

## Known Stubs

None. Every button on the page is live. Notes:
- `/auth/welcome` (the name step, 05-24) does not exist yet. A new viewer lands on its URL exactly as after the 05-21/05-22 code sign-in.
- `ResetPasswordForm` still ignores `?next=` and goes to `/` after saving (UI-SPEC 6.4 extension, a later plan). The recovery link already carries next for it.

## Threat Flags

None beyond the plan's register. T-05-23-01 to 04 are implemented and checked at runtime. T-05-23-05 (Secure email change) is on locally (`double_confirm_changes = true`, proven by the two-link run) and is an owner step live (05-35).

## Notes for the controller

- **Local stack writes:** the e2e run created one local user on the shared `supabase_db_Clickit` stack only (`confirm-0523-1793032276990@example.test`, email changed to `confirm-0523-new-1793032276990@example.test`), its profile row and welcome outbox row, and mails in Mailpit. No reset, no stop or start, nothing live.
- **AUTH-04 stays Pending.** It needs the templates live (05-35), the reset page's `next` handling and expired state (6.4), and the Profile email-change form (6.7).
- **Bundle:** each new page route costs about 10 KiB gzip of Worker size. With 14.21 KiB headroom, the next page route in Phase 5 (for example `/auth/welcome`) may break the 3,000 KiB budget.

## NEEDS lines

NEEDS CONTROLLER: Worker gzip 2,985.79 KiB after 05-23 (+11.02 KiB, headroom 14.21 KiB under the 3,000 KiB gate:local budget); the growth is per-route overhead of the new /{locale}/auth/confirm page (client-reference manifest 37 KB raw) plus the root /auth/confirm route, not code; the next Phase 5 page route (e.g. 05-24 /auth/welcome) will likely cross the budget, so decide the budget or a trim before it.

## Self-Check: PASSED
