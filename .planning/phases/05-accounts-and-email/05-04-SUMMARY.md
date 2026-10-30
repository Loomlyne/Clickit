---
phase: 05-accounts-and-email
plan: 04
subsystem: email-pure-modules
tags: [hmac, resend, mailpit, idempotency, tdd]
requires: ["05-00"]
provides: [signLinkToken, verifyLinkToken, LINK_KINDS, NEWSLETTER_CONFIRM_TTL_DAYS, Mailer, createResendMailer, createLocalMailer, classifyResendResponse, EMAIL_FROM_DEFAULT]
affects: [05-08, 05-28, 05-29]
tech-stack:
  added: []
  patterns: ["pure module, injected fetch", "kind-separated HMAC links", "classified send results, no bodies"]
key-files:
  created:
    - src/server/email/links.ts
    - src/server/email/transport.ts
    - tests/unit/unsub-link.test.ts
    - tests/unit/email-transport.test.ts
  modified: []
key-decisions:
  - "Signature is verified over the base64url payload string and decoded signatures must be canonical base64url, so a token cannot be malleated by stray trailing bits"
  - "newsletter_confirm tokens must carry an expiry (sign throws without one, verify rejects exp 0); unsub_digest tokens may carry none"
  - "SendResult variants: sent, already_sent, retry (reason, optional retryAfterSec), permanent (status); reasons are fixed strings, never provider text"
  - "A 2xx without a provider id is a retry (no_provider_id), safe because the Idempotency-Key makes the repeat a no-op"
requirements-completed: []
duration: 15min
completed: 2026-10-21
---

# Phase 5 Plan 04: Signed links and Mailer port Summary

**Two pure, tested email building blocks: HMAC-SHA256 link tokens that are kind-separated and constant-time verified (confirm expires in 7 days, unsubscribe never), and a Mailer port with a plain-fetch Resend transport (Idempotency-Key, classified results) and a Mailpit transport that refuses to build on Workers.**

## Tasks

1. HMAC link tokens (TDD). RED `6347a1d`, GREEN `048917f`. 9 tests: unsub round-trip with no expiry even after ten years, confirm valid at expiry and `expired` at expiry+1 s, cross-kind replay invalid both directions, flipped characters at six positions, wrong secret and seven malformed shapes, non-UUID id rejected on sign and on a correctly signed foreign payload, empty / blank / undefined secret (sign throws, verify `unavailable`), URL-safe charset with no `=` or `+` over 20 random tokens.
2. Mailer port (TDD). RED `3dad640`, GREEN `b778581`. 12 tests: request shape (URL, Bearer, Idempotency-Key, body incl. `reply_to` and `headers`, optional fields omitted), full status table (200, 429 with and without Retry-After, 500/502/503, both 409 names, 400/403/422), junk bodies and Retry-After values, real `Response` objects, non-JSON error body, fetch throwing, missing key (3 variants, fetch never called), Workers refusal, Mailpit request shape, Mailpit failure and network error. A leak assertion checks every result for the recipient, subject, html, text and API key.

## Verification

- Both unit files pass (9/9 and 12/12); RED confirmed first (module not found); links test run 3 times, stable.
- Acceptance greps: `crypto.subtle.verify` one line, no `===` on signatures; `no-reply@clickitstory.ae` one line, `onboarding@resend.dev` none, `Idempotency-Key` one line.
- eslint on `src/server/email` and both tests, and `tsc --noEmit`: clean.
- `src/lib/resend.ts` untouched, as the plan requires (05-28 deletes it).

## Deviations from Plan

**1. [Rule 2 - Security] Canonical signature encoding and mandatory confirm expiry.** The plan asks for HMAC verify and an optional expiry. Added: signature bytes must re-encode to the identical base64url string (stops trailing-bit malleability and made the flipped-character test deterministic), and a `newsletter_confirm` token with exp 0 is refused on sign and verify so a confirm link can never be minted without the 7-day limit (T-05-04-01). Same exported signatures.

**2. [Minor] Optional `from` on `createLocalMailer`.** Defaults to `EMAIL_FROM_DEFAULT`; lets 05-08 pass the configured sender without a second code path.

## Requirements

MAIL-04, MAIL-06 and MAIL-07 stay Pending: this plan adds the tested primitives only. They complete when the consumer (05-08), unsubscribe and confirm routes (05-29) and support/newsletter actions (05-28) use them.

## Not verified

- Real Resend and real Mailpit round-trips (unit tests use injected fetch; no key exists yet and no network call was made).
- Behaviour inside workerd (uses only `crypto.subtle`, `TextEncoder`, `btoa`/`atob`, `fetch`; no Node APIs in `src/`).

## Known Stubs

None.

## Threat Flags

None. No new endpoint or file access; T-05-04-01 to T-05-04-04 mitigations are implemented and tested.

## Self-Check: PASSED

Files exist: links.ts, transport.ts, both tests. Commits found: 6347a1d, 048917f, 3dad640, b778581.
