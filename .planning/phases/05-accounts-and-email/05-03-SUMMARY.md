---
phase: 05-accounts-and-email
plan: 03
subsystem: auth-pure-modules
tags: [hibp, admin-mfa, tdd, security]
requires: ["05-00"]
provides: [isPwned, decideAdminMfa, ADMIN_MFA_MAX_AGE_HOURS]
affects: [05-15, 05-18, 05-21, 05-24, 05-26]
tech-stack:
  added: []
  patterns: ["pure module, no imports", "HIBP fails open, admin MFA fails closed"]
key-files:
  created:
    - src/server/auth/hibp.ts
    - src/server/admin-access.ts
    - tests/unit/hibp.test.ts
    - tests/unit/admin-mfa.test.ts
  modified: []
key-decisions:
  - "isPwned races the fetch against its own timer, so a fetch that ignores AbortSignal still returns null at 3 s"
  - "decideAdminMfa accepts method 'totp' and 'mfa/totp', requires numeric finite timestamps, age 0..12 h inclusive"
requirements-completed: []
duration: 10min
completed: 2026-10-21
---

# Phase 5 Plan 03: HIBP check and admin MFA decision Summary

**Two pure, tested security modules: `isPwned` (k-anonymity HIBP range check, fails open on outage) and `decideAdminMfa` (aal2 plus a TOTP verification no older than 12 hours, fails closed on any other claim shape).**

## Tasks

1. HIBP check (TDD). RED `fff2ff1` (both test files), GREEN `405563f`. 10 tests: hit, case-insensitive hit, miss, padded count-0 row, late fetch, fetch that ignores abort, reject, 503, prefix-only on the wire (distinctive password never appears in URL or headers).
2. Admin MFA decision (TDD). GREEN `9ffbef6`. 10 tests: 11h59 ok, 12h01 needs_code, exactly 12h ok, `mfa/totp`, newer password entry does not refresh old totp, aal1 / missing / non-string aal, string[] amr, missing / null / empty / junk amr, future timestamp, non-finite timestamps, custom max age.

## Verification

- Both unit files pass (10/10 each); RED confirmed first (module not found).
- Acceptance greps: one `Add-Padding` line, 0 imports in `hibp.ts`, one `ADMIN_MFA_MAX_AGE_HOURS = 12` line, no `server-only` in `admin-access.ts`.
- eslint on the four files and `tsc --noEmit`: clean.

## Deviations from Plan

**1. [Rule 1 - Bug, test] Prefix-only assertion matched the API host name.** The first draft asserted the URL did not contain `password`, but the host is `api.pwnedpasswords.com`. The assertion now checks the path and headers, plus a second call with a distinctive password. Folded into commit `405563f`.

**2. Timeout hardening beyond the RESEARCH snippet.** The reference relied on AbortController alone; `isPwned` also races the whole lookup (including the body read) against a timer, so a fetch that ignores the signal still yields null after `timeoutMs`. Same contract, stricter.

## Requirements

AUTH-03, AUTH-06 and AUTH-08 stay Pending: this plan adds the tested decision modules only. Wiring lands in 05-15 (admin guard), 05-18 (proxy) and 05-21/05-24/05-26 (password actions).

## Known Stubs

None.

## Threat Flags

None. T-05-03-01 (only a 5-char prefix leaves, padding on, nothing logged) and T-05-03-03 (fail closed on every odd shape, future and stale timestamps) are mitigated and tested. T-05-03-02 (HIBP outage) accepted as planned: callers log and allow.

## Self-Check: PASSED
