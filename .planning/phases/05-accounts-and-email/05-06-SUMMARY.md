---
phase: 05-accounts-and-email
plan: 06
subsystem: i18n
tags: [next-intl, messages, arabic, parity-test]
requires: ["05-00"]
provides: [phase5-message-keys, messages-parity-test]
affects: [05-12, 05-22, 05-23, 05-24, 05-25, 05-26, 05-27, 05-28, 05-29, 05-30]
tech-stack:
  added: []
  patterns: ["flatten-and-compare catalog parity test with a PHASE5_KEYS prefix list that later phases extend"]
key-files:
  created:
    - tests/unit/messages-parity.test.ts
  modified:
    - src/messages/en.json
    - src/messages/ar.json
key-decisions:
  - "signInToWatch and showChip not added (G4 = B); mfaLostPhone is plain text (G24 item 5); support.sentBody uses {hours, number} so the signed 'within 48 hours' (G25) is supplied by the caller, not typed into the catalog"
  - "Existing keys profile.passwordChanged ('Password updated') and the old auth.resetEmailDescription, newsletter.submitAria, support.savedEmailFailedInline were updated in place to the signed UI-SPEC text; no key was removed"
  - "admin.audit received four keys (adminColumn, formerAdmin, system, actorOwnerScript); the plan text says 'three' but lists four"
requirements-completed: []
duration: 12min
completed: 2026-10-21
---

# Phase 5 Plan 06: Phase 5 message keys and EN/AR parity Summary

**All Phase 5 app-screen strings (auth, profile, admin.admins, admin.audit, emailPages, newsletter, support) now exist in en.json and ar.json, and a parity test enforces identical key paths, ICU placeholders and the no-literal-digit rule.**

## Accomplishments

- Added 81 `auth` keys, 20 `profile` keys, 13 `admin.admins` keys, 4 `admin.audit` keys, the new `emailPages` namespace (18 keys), 2 `newsletter` keys and 3 `support` keys, EN and AR draft copied from the UI-SPEC Copywriting Contract. Paired rows in the spec ("A / B") became separate keys.
- Updated in place: `auth.resetEmailDescription`, `profile.passwordChanged`, `newsletter.submitAria`, `support.savedEmailFailedInline`.
- `tests/unit/messages-parity.test.ts` (6 tests): every Phase 5 path exists in both locales; Phase 5 paths match across locales; any other mismatch must be in `KNOWN_PREEXISTING_GAPS`; every ICU argument and rich tag of EN appears in AR (whole catalog); no ASCII or Arabic-Indic digit outside ICU braces in Phase 5 strings (1Password excepted); `signInToWatch`/`showChip` absent.
- Pre-existing EN/AR gaps found on first run: 0 (`KNOWN_PREEXISTING_GAPS` is empty).

## Task Commits

1. Task 1, Phase 5 keys EN + AR: `c80c78d`
2. Task 2, parity test: `4018d98`

## Verification

- Task 1 verify command prints `ok`; `signInToWatch|showChip` grep finds nothing; both JSON files parse and keep the 2-space format and trailing newline.
- Parity test 6/6 pass. Negative checks: deleting `ar.auth.mfaLostPhone` fails 2 tests (existence and path parity); replacing `{minutes, number}` in `ar.auth.codeHelp` with an Arabic-Indic digit fails the placeholder test and the digit test. Both files restored.
- Full unit suite 2089/2089; eslint clean on the new test; tsc reports nothing for it.

## Deviations from Plan

**1. [Rule 1 - Spec reconciliation] `profile.passwordChanged` already existed** ("Password updated" / "تم تحديث كلمة المرور"). Updated to the signed UI-SPEC text ("Password changed." / "تم تغيير كلمة المرور.") instead of adding a duplicate. Commit `c80c78d`.

**2. [Plan wording] `admin.audit` already exists**, so only the four new keys were added (the plan says three but lists four incl. `actorOwnerScript`).

**3. TDD order.** Task 2 is marked `tdd`, but the plan orders it after the data task, so the test was written against finished data and passed immediately; red behaviour was proven by the two mutation checks above instead of a RED commit.

**4. Placeholders and the spec's ICU form.** `{min, number}` appears in the UI-SPEC as `profile.errors.nameMin`; the existing `errors.nameMin` ("{min}") was kept, as the plan says, and not duplicated.

## Requirements

AUTH-02, AUTH-03, AUTH-04, AUTH-06, MAIL-04, MAIL-05, MAIL-06 stay Pending: this plan supplies only their copy; the behaviour ships in the UI and server plans.

## Not verified

- Arabic wording: draft, reviewed by Koss at UAT (UI-SPEC open item 8).
- ICU parsing by next-intl at render time (no UI reads these keys yet; first readers are 05-12, 05-22..05-29). The rich tags `<bdi>`, `<terms>`, `<privacy>` need call-site mappings there.
- `npm run build` / `gate:local` (heavy; run before the phase PR).

## Known Stubs

None. Keys are unused until the UI plans land; the existing skip-sign-in keys are removed in 05-30.

## Threat Flags

None. Only the three planned rich tags are present (T-05-06-01).

## Self-Check: PASSED

- tests/unit/messages-parity.test.ts, src/messages/en.json, src/messages/ar.json exist; commits c80c78d and 4018d98 exist.
