---
phase: 05-accounts-and-email
plan: 08
subsystem: email-queue-consumer
tags: [queue, outbox, idempotency, resend, rfc-8058, tdd]
requires: ["05-04"]
provides: [processBatch, backoffSeconds, MAX_ATTEMPTS, STALE_AFTER_HOURS, unsubscribeHeaders, ConsumerDeps, ClaimedRow, FinishEntry, emailWorld]
affects: [05-13, 05-19]
tech-stack:
  added: []
  patterns: ["pure module with injected ports", "DB write before ack", "in-memory world instead of extending fake-supabase"]
key-files:
  created:
    - src/server/email/consumer.ts
    - tests/unit/helpers/email-world.ts
    - tests/unit/email-consumer.test.ts
    - tests/unit/digest-headers.test.ts
  modified: []
key-decisions:
  - "Ports: claimOutbox, finishOutbox, render, mailer, now, log, unsubscribeUrl. render stays a port; the module has only a type import from transport.ts (no React Email, no @/, no server-only)"
  - "Message handling order: claim once, process claimed rows one at a time, finishOutbox once, then ack/retry. A throw from claim or finish propagates with nothing acked, so the queue redelivers the batch"
  - "Duplicate outboxIds in a batch: the first message gets the real outcome (ack or retry), duplicates are acked"
  - "A digest row with no to_user is failed (digest_without_user), never sent without an unsubscribe link; if the unsubscribe URL cannot be built the row is retried"
  - "A render throw, an unsubscribe-URL throw or a mailer throw are transient for that row only (retrying, capped by MAX_ATTEMPTS), so one bad row cannot poison the batch"
  - "retry-after is capped at 12 h (Cloudflare Queues delay limit); unsubscribeHeaders refuses whitespace, angle brackets and non-https URLs (loopback http allowed for local Mailpit)"
requirements-completed: []
duration: 25min
completed: 2026-10-21
---

# Phase 5 Plan 08: Queue consumer Summary

**`processBatch` is a pure, fully tested queue consumer: one claim, one send per claimed row with the row's Idempotency-Key, one finish, ack only after the database write, with the whole retry, stale and unsubscribe-header matrix proven against an in-memory outbox and a fake Resend that honours the 24 h key window.**

## Tasks

1. email-world helper, `cfc8b74`. In-memory outbox whose `claimOutbox` copies the 05-13 contract (pending or retrying with a free lease, or sending with an expired lease; attempts + 1; `first_attempt_at` set once; unconfirmed address returned as null), `finishOutbox` that only updates rows still `sending`, fake Resend with 24 h key window (same payload returns the first id, different payload returns the already-sent result), scripted failures, spy queue messages, settable clock, log capture, `deps()` for ports.
2. processBatch (TDD). RED `455ab11` (module not found), GREEN `c72f982`. 31 tests across the two files, each behaviour row a named test.

## What the tests prove

- Success, batch of three (one claim call, one finish call), same id twice in a batch (one send), redelivery after success (zero sends).
- Crash after send (finish throws, lease expires, redelivery): second send carries the same key, the fake Resend returns the first id, `distinctProviderSends` stays 1, row ends sent.
- 429 with retry-after 30 gives `retry({ delaySeconds: 30 })`; 500 gives 60, 120, 240; 409 concurrent retries; 409 invalid_idempotent_request becomes sent with a null provider id and the log line `already sent`; 400 is failed once and acked; the fifth transient attempt is failed and acked.
- 23 h guard (23 h 1 s fails, 22 h 59 min sends); leased-by-another and missing rows are acked with no send; null address is skipped as `no_confirmed_address`; `not_configured` retries with the same MAX_ATTEMPTS cap; claim throwing rethrows with nothing acked; a render failure retries only that row.
- Seven malformed bodies are acked without touching the database; the only queue field is `outboxId`.
- Every log line starts `[email/consumer]` and contains no address, subject, body or token.
- Digest carries `List-Unsubscribe: <https://...>` (a real signed `unsub_digest` token verified by `verifyLinkToken`) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; welcome, support_ack, support_admin and newsletter_confirm carry neither.

## Verification

- Both test files pass (31/31), three consecutive runs stable; full `npm run test:unit` 2134 pass, 0 fail.
- `tsc --noEmit` and eslint on the four files clean; `grep -cE "^import .* from '(@/|server-only|next)" src/server/email/consumer.ts` prints 0; `grep "Test-only"` on the world prints one line.
- No lock-taking steps were needed (no build, no gate:local, no Supabase).

## Deviations from Plan

**1. [Rule 2 - Security] Header-safe unsubscribe URL.** `unsubscribeHeaders` throws on whitespace, `<`, `>`, quotes or a non-https URL (loopback http only for local mail), so a bad URL can never inject a header or a second target. A digest without `to_user` is failed rather than sent link-less. Same exported signature.

**2. [Minor] Row-level isolation.** The plan lists no behaviour for render, unsubscribe-URL or mailer throws; they are handled per row as transient (cap at MAX_ATTEMPTS) so one bad row does not fail the batch.

**3. [Interpretation] `not_configured` and MAX_ATTEMPTS.** The plan says attempts "not counted toward permanent failure beyond MAX_ATTEMPTS rule". Implemented as: same cap as any transient error (the fifth try becomes failed). Consequence for 05-19/05-35: while the Resend key is absent, rows retry on 60, 120, 240, 480 s and then become `failed` for a human, within about 15 minutes. If Koss would rather keep them retrying until the key exists, that is a one-line change plus the sweep rule.

## Contract notes for later plans

- 05-13 `claim_outbox` must return `to_user` and `first_attempt_at` and claim `sending` rows with an expired lease (as its plan already says); the world and consumer rely on it.
- 05-13 `finish_outbox` entries: `{ id, status, provider_id?, error?, next_attempt_at? }`; `error` is a fixed reason string (e.g. `rate_limited`, `http_400`, `stale_over_23h`, `max_attempts:server_error`), never provider text.
- 05-19 wires `buildEmailDeps(env)`; `render` there may be pre-rendered templates (05-07 CPU finding); the consumer does not care.

## Requirements

MAIL-07 and MAIL-04 stay Pending: this plan delivers the tested consumer rules and the digest headers only. They complete when the SQL (05-13), the Worker wiring (05-19), the digest builder and unsubscribe route (05-29) exist.

## Not verified

- Real Resend or Mailpit sends, workerd execution, a real Cloudflare Queue (unit tests use injected ports).
- SQL-side leasing (05-13 proves it).
- Digest header pass-through at Resend (planning note D-35; needs the owner test send).

## Known Stubs

None.

## Threat Flags

None. T-05-08-01 to T-05-08-04 mitigations are implemented and tested.

## Self-Check: PASSED

Files exist: consumer.ts, email-world.ts, email-consumer.test.ts, digest-headers.test.ts. Commits found: cfc8b74, 455ab11, c72f982.
