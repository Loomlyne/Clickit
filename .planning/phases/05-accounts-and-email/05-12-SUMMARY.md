---
phase: 05-accounts-and-email
plan: 12
subsystem: ui
tags: [react, next-intl, radix-ui, tailwind, otp, rtl, accessibility]

requires:
  - phase: 05-accounts-and-email
    provides: "05-02 normalizeCode and timing constants; 05-06 message keys (stepOf, codeLabel, showPassword)"
  - phase: 04-design-system-truth
    provides: "Viewer board signed 2026-10-21; rounded-panel/rounded-field utilities, shadow-panel, tokens"
provides:
  - "CodeField: one numeric one-time-code input over six cells, emits normalised value, onComplete once per 6-digit value"
  - "AuthCardPage (centered card frame) and StepBar"
  - "PasswordField with the eye on the physical right in both locales, pinned by tests"
  - "AuthAlert spacing fix and StatusLine"
  - "ui/switch (Radix on the installed radix-ui package, 44px hit area, RTL-mirrored travel)"
  - "formatCountdown (re-export of Phase 6 formatClock)"
affects: [05-22, 05-23, 05-24, 05-25, 05-26, 05-27, 05-28, 05-29, 05-31]

tech-stack:
  added: []
  patterns:
    - "Source-level node:test pins for UI contracts (password-field.test.ts)"
    - "Controlled-value display derived from raw typed string without effects (CodeField)"

key-files:
  created:
    - src/components/auth/code-field.tsx
    - src/components/auth/auth-card-page.tsx
    - src/components/auth/step-bar.tsx
    - src/components/ui/switch.tsx
    - tests/unit/password-field.test.ts
  modified:
    - src/components/auth/password-field.tsx
    - src/components/auth/auth-alert.tsx
    - src/lib/auth-code.ts
    - tests/unit/otp-code.test.ts
    - src/styles/globals.css
    - src/messages/en.json
    - src/messages/ar.json
    - tests/unit/messages-parity.test.ts

key-decisions:
  - "formatCountdown re-exports Phase 6 formatClock (present on this branch) instead of a second implementation"
  - "CodeField clears itself and refocuses when error changes to a value; the parent must clear the error only when the user types again"
  - "Eye label flips to hidePassword when the password is shown (new key, EN and AR)"
  - "ui/switch written by hand on radix-ui (the allowed fallback), not via the shadcn CLI"

patterns-established:
  - "Password eye: dir=ltr box holds Input (dir=ltr, pe-11, no fill/border/size override) then the button with right-0"
  - "Caret blink lives in globals.css (.code-caret), static under prefers-reduced-motion"

requirements-completed: []

duration: 35min
completed: 2026-10-21
---

# Phase 5 Plan 12: Shared viewer building blocks Summary

**CodeField, AuthCardPage, StepBar, StatusLine and ui/switch built once, and PasswordField fixed so the show/hide eye stays on the physical right in Arabic, pinned by source-level tests.**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-10-21
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `CodeField` is a single real input (`inputMode="numeric"`, `autoComplete="one-time-code"`, no `maxLength`, `dir="ltr"`) over six `aria-hidden` cells. Cells show digits as typed (Western, Arabic-Indic, Extended); the parent receives `normalizeCode(raw)`. `onComplete` fires once per distinct six-digit value.
- `AuthCardPage` extracts the reset-password frame per UI-SPEC 5.1 (top-aligned on phones, centered from `sm`, `rounded-panel`, `shadow-panel`); `StepBar` per 5.6 with a screen-reader `stepOf` sentence.
- `PasswordField`: eye inside a `dir="ltr"` box with `right-0`, Input keeps `dir="ltr"` and the live `ui/input` unchanged, label 14px/400 with `mt-2`, bars `gap-1`, caption 11px, error 14px `role="alert"`, 16px icons.
- `AuthAlert` spacing `px-4 py-2 gap-2`, 16px icons; new exported `StatusLine`.
- `ui/switch` per 6.9 with token classes, `rtl:` mirrored travel, reduced-motion, 44px wrapper plus stretched root hit area.
- `tests/unit/password-field.test.ts` (5 tests) pins wrapper/DOM order, `right-*` with no `start-/end-/left-/rtl:` on the eye, no `bg-/border-/text-` on the Input, `aria-pressed`, and no `--bg-1`/`--line-2`/`text-[15px]` on any auth input. Mutation check: changing `right-0` to `end-0` fails the test.

## Task Commits

1. Task 1: CodeField and formatCountdown - `2ef494a`
2. Task 2: AuthCardPage, StepBar, PasswordField and AuthAlert fixes, ui/switch - `fd22a8f`
3. Task 3: eye on the physical right, live Input pinned by tests - `a24fcc0`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `auth.hidePassword` did not exist**
- **Found during:** Task 2
- **Issue:** UI-SPEC 5.3 and the plan require a show/hide name, but only `showPassword` existed, so the eye read "Show password" while the password was visible.
- **Fix:** added `auth.hidePassword` ("Hide password" / "إخفاء كلمة المرور", the plain inverse of the existing Arabic `showPassword`), added it to `PHASE5_KEYS` in `messages-parity.test.ts`. **Koss should confirm the Arabic wording.**
- **Files modified:** `src/messages/en.json`, `src/messages/ar.json`, `tests/unit/messages-parity.test.ts`
- **Commit:** `fd22a8f`

**2. [Rule 3 - Blocking] `.code-caret` keyframes needed a home**
- **Issue:** the blinking caret bar (1s steps, static under reduced motion) needs a keyframe; none existed.
- **Fix:** added `@keyframes code-caret` and `.code-caret` to `src/styles/globals.css` (animations section, no new token).
- **Commit:** `2ef494a`

### Plan wording adjusted

- **Arabic digits test row:** the plan asked for `(5, 'ar-AE')` to give Arabic-Indic digits. On this ICU `ar-AE` and `ar` format with Western digits (`ar-EG` does use Arabic-Indic), and Phase 7 owns which numbering the UI uses. The test uses `ar-u-nu-arab` to prove the locale tag drives the digits (`'٠:٠٥'`).
- **`formatCountdown`:** Phase 6 `formatClock` is on this branch, so it is re-exported under the new name as the plan allows.
- **`ui/switch`:** written by hand on `radix-ui` (the plan's stated fallback) rather than running `npx shadcn@latest add switch`; no dependency changed (`package.json` and lockfile identical to HEAD).
- **`text-[15px]` check** applies to input tags only. The existing `src/app/[locale]/(viewer)/auth/page.tsx` subline uses `text-[15px]` on a paragraph (not a field); 05-22 replaces that page.
- **reset-password page** was not switched to `AuthCardPage` (not in this plan's file list); the screen plans adopt it.

### Visual differences vs. the signed board

The Viewer board (V1, V1b, V4) was not re-opened as images in this run (work threads never read PNGs); the implementation follows UI-SPEC 5.1, 5.2, 5.6 and 6.9 as written. No differences were found in text; visual comparison is left for UAT.

## Known Stubs

None.

## Deferred Issues

- Two unit tests in `tests/unit/legal-pages-arabic.test.ts` ("additive draft columns..." and "exactly one expand migration exists and it sorts last") fail on the branch because the newest migration is now the 05-09 M1a migration. Not caused by this plan; the test expectation needs a bar for the Phase 5 migration (05-09 / controller).
- `login-form.tsx` `window.location.assign` lint warning is pre-existing.

## Threat Flags

None. T-05-12-01 (type=password default, local toggle, no logging), T-05-12-02 (no registry add, dependency diff clean), T-05-12-03 (normalizeCode strips bidi marks, used by CodeField) are met.

## Verification

- `otp-code.test.ts` 13/13, `password-field.test.ts` 5/5, `messages-parity.test.ts` 6/6.
- `npx eslint` on all touched files: 0 errors (design guard at error). `npx tsc --noEmit`: clean.
- Full `npm run test:unit`: 2139 pass, 2 fail (the pre-existing migration-order tests above).
- Not verified: browser rendering, iOS/Android autofill, RTL on a real `/ar` page (05-31 e2e carries the eye check), `npm run build`.

## Self-Check: PASSED

Files exist (code-field, auth-card-page, step-bar, switch, password-field.test) and commits `2ef494a`, `fd22a8f`, `a24fcc0` are in `git log`.
