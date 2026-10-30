---
phase: 05-accounts-and-email
plan: 29
subsystem: email-public-links
tags: [unsubscribe, rfc8058, double-opt-in, hmac, public-pages, tdd]
requires: ["05-04", "05-12", "05-13"]
provides: [unsubscribeRequest, newsletterConfirmRequest, previewUnsubscribe, previewNewsletterConfirm, getLinkSecret, POST/GET /api/email/unsubscribe, /{locale}/unsubscribe, /{locale}/newsletter/confirm, LinkActionForm]
affects: [05-28, 05-20, 05-31, 05-40]
tech-stack:
  added: []
  patterns: ["pure decisions with injected store", "GET page reads only, server action writes", "one client state machine for both button pages"]
key-files:
  created:
    - src/server/email/public-links-core.ts
    - src/server/email/link-secret.ts
    - src/server/email/public-links-store.ts
    - src/app/api/email/unsubscribe/route.ts
    - src/app/[locale]/(viewer)/unsubscribe/page.tsx
    - src/app/[locale]/(viewer)/unsubscribe/actions.ts
    - src/app/[locale]/(viewer)/newsletter/confirm/page.tsx
    - src/app/[locale]/(viewer)/newsletter/confirm/actions.ts
    - src/components/email-pages/link-action-form.tsx
    - tests/unit/unsubscribe-route.test.ts
    - tests/unit/newsletter-confirm.test.ts
  modified: []
key-decisions:
  - "Core results add reason/outcome 'error' (store threw) next to the planned invalid/unavailable/expired, so the route can answer 500 (mail clients retry) instead of 400"
  - "GET pages read the current state (notify flag, confirmed_at) with the service role so a repeat visit opens straight on the done/already panel; the read never writes and never returns an address"
  - "A missing secret or unreachable database shows the invalid panel with the common.error title, not 'This link isn't valid'"
  - "POST also accepts the token as a form field t (RFC 8058 clients post List-Unsubscribe=One-Click as a form)"
requirements-completed: []
duration: 25min
completed: 2026-10-25
---

# Phase 5 Plan 29: Login-free email endpoints Summary

**One-click unsubscribe (`POST /api/email/unsubscribe`, RFC 8058) and the newsletter double-opt-in confirm page, both public: tokens are kind-separated HMAC links, GET never changes anything, and only the POST or the button's server action writes.**

## Tasks

1. Pure decisions and secret helper (TDD). RED `e78af142` (module absent), GREEN `9dac2685`. 14 tests: unsub valid / ten-year-old token / forged, other-kind, empty, malformed / blank secret / store failure / repeat; confirm valid / replay -> already / 8 days -> expired with no store call / unsub token and forged token invalid / blank secret / store failure; preview states for both, with no write calls.
2. API route and the two public pages `c9e9e9bd`.
   - Route: POST 200 empty on ok, 400 invalid, 503 secret missing, 500 store error; GET verifies only to choose the locale (`profiles.locale`, else `NEXT_LOCALE` cookie, else en) and answers 303 to `/{locale}/unsubscribe?t=...` with no write. Logs `[email/unsubscribe]` outcome only.
   - Pages: `AuthCardPage` + `LinkActionForm` (BellOff / MailCheck idle, green CheckCircle2 done, AlertCircle expired and invalid), copy from the existing `emailPages` keys, `robots: noindex`, `referrer: no-referrer`.
   - Actions `confirmUnsubscribe(token)` and `confirmNewsletter(token)` run the same core with service-role stores (`profiles.update notify_new_episodes=false`; `newsletter_subscribers.update confirmed_at, status='active' where confirmed_at is null`, 'confirmed' only if a row changed).

## Verification

- `node --test tests/unit/unsubscribe-route.test.ts tests/unit/newsletter-confirm.test.ts`: 14/14 pass; RED seen first.
- Plan verify command (tsc, POST and GET exports, no `notify_new_episodes` in the unsubscribe page, no `confirmed_at` in the confirm page, `303` in the route): exit 0.
- eslint (incl. `clickit/no-raw-design-values` at error) on all new files: clean. `tsc --noEmit`: clean.
- Full `npm run test:unit`: 2281/2281 pass.

## Not verified

- No build, no Playwright, no request against a running app, no real signed link opened in a browser (end-to-end wall and link proof belong to 05-31 / 05-40).
- Service-role stores were not run against a database (shared stack not touched, live not touched).
- RTL layout of the two pages (pictures-only check; the frame is the signed `AuthCardPage`).
- `EMAIL_LINK_SECRET` is an owner step; until it is set both pages show the error panel and the POST answers 503.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Store failure outcome.** A thrown store would otherwise surface as an unhandled 500 with a stack, or be mistaken for a bad token. Added `error` results and a try/catch in the route, actions and previews.

**2. [Rule 3 - Blocking] Extra file `src/server/email/public-links-store.ts`.** The service-role stores, the profile-locale read and the page preview wrappers needed a `server-only` home shared by the route, the actions and the pages. React's purity lint also forbids `Date.now()` in a page component, so the preview wrappers hold the clock call.

**3. [Minor] GET pages read state.** The plan's behaviour "repeat visits show the done state" needs a read; the pages open on the done / already panel when the flag or `confirmed_at` already says so. Reads never write.

## Requirements

MAIL-04 and MAIL-06 stay Pending. This plan delivers the endpoints only. MAIL-04 also needs the digest cron and the profile toggle (05-20 and later); MAIL-06 also needs the newsletter sign-up action to send the confirm link (05-28).

## Known Stubs

None.

## Threat Flags

None. T-05-29-01 to -03 mitigations are implemented (kind-separated HMAC and expiry, GET without writes, no address or token in pages or logs); T-05-29-04 accepted as planned. `/api/email/unsubscribe` is outside the wall by design (`/api/*` keeps its own checks); `/unsubscribe` and `/newsletter/confirm` are on the wall's open list (05-02) and the coming-soon allowlist (05-18).

## Self-Check: PASSED

Files exist (all 11 above), commits found: e78af142, 9dac2685, c9e9e9bd.
