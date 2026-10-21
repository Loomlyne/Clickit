---
phase: 05-accounts-and-email
plan: 02
subsystem: auth-pure-modules
tags: [wall, otp, normaliser, tdd]
requires: ["05-00"]
provides: [wall-table, code-normaliser, auth-timing-constants]
affects: [05-18, 05-21, 05-22]
tech-stack:
  added: []
  patterns: ["pure module, no imports, fails closed"]
key-files:
  created:
    - src/server/auth/wall.ts
    - src/lib/auth-code.ts
    - tests/unit/wall-policy.test.ts
    - tests/unit/otp-code.test.ts
  modified: []
key-decisions:
  - "isPublicPath is one exact list plus one slash-bounded prefix list; /about is walled (Q2=A); /unsubscribe and /newsletter/confirm are exact-open"
  - "normalizeCode accepts unknown and returns '' for non-strings; server re-normalises (05-21)"
requirements-completed: []
duration: 10min
completed: 2026-10-21
---

# Phase 5 Plan 02: Wall table and code helpers Summary

**Two pure, tested modules: `isPublicPath` (the D-01 sign-in wall as one fail-closed table) and `normalizeCode` plus the shared `AUTH_LINK_MINUTES = 15` / `RESEND_WAIT_SECONDS = 60` constants.**

## Tasks

1. Wall table (TDD). RED `b660da2` (both test files), GREEN `5404c4f`. 12 assertions pass, including look-alikes (`/authx`, `/supportx`, `/portfoliox`, `/legalese`), `/about`, `/newsletter` alone, and empty / non-string input.
2. Code normaliser and constants (TDD). GREEN `9cde807`. 11 assertions pass: spaces, hyphens, Arabic-Indic and Extended Arabic-Indic digits, mixed digits, RLM/LRM, U+202A-202E and U+2066-2069, cap at 6, non-strings, `resendRemaining` rows (60 / 1 / 0 / 0).

## Verification

- Both unit files: all tests pass, RED confirmed first (module not found).
- Acceptance greps: no `'/about'` in `wall.ts`, 0 imports in `wall.ts`, one `AUTH_LINK_MINUTES = 15` line, no `server-only` in `auth-code.ts`.
- eslint on the four files and `tsc --noEmit`: clean.

## Deviations from Plan

None. The two RED test files went into one commit (both fail for the same reason, module absent); each GREEN is its own commit.

## Requirements

AUTH-01 and AUTH-02 stay Pending: this plan adds the tested building blocks only. `src/proxy.ts` still uses its old allowlist until 05-18 wires `isPublicPath`; the sign-in form and server actions (05-21, 05-22) use the normaliser.

## Known Stubs

None.

## Threat Flags

None. T-05-02-01..03 mitigated as planned (slash boundary and look-alike tests; 6-digit ASCII output; bidi controls stripped).

## Self-Check: PASSED
