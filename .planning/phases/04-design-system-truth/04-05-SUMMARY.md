---
phase: 04-design-system-truth
plan: 05
subsystem: ui
tags: [design-tokens, tailwind, select, sonner, snaps, node-test]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 tokens (rounded-card, rounded-field, shadow-popover, shadow-inset-hairline, shadow-cta-glow, --uis-primary-hover) and extended cn; 04-03 one brand map
provides:
  - The three D-03 snaps (select popover surface, toaster surface and shadow, /portfolio CTA hover and glow) as tokens
  - The D-01 literal snaps (preload cover, avatar ink) as tokens, and the avatar gradient on --chart-5/--chart-2 (identical colours)
  - tests/unit/design-snaps.test.ts, six static pins
affects: [04-06, 04-09]

tech-stack:
  added: []
  patterns:
    - "Opacity modifier on a var() colour (`bg-[var(--bg-1)]/98`) keeps the 98% menu surface while using a token"

key-files:
  created:
    - tests/unit/design-snaps.test.ts
  modified:
    - src/components/ui/select.tsx
    - src/app/[locale]/layout.tsx
    - src/components/landing/landing-hero-animations.tsx
    - src/app/[locale]/(viewer)/layout.tsx
    - src/components/layout/user-avatar.tsx

key-decisions:
  - "Owner answers Q1 and Q3 were both A (gate verify exit 0), so the if_owner_differs branch was not used"
  - "DS-02 is not ticked: this plan delivers only five files; the repo-wide codemod (04-09) and the guard on all files still have to land"

patterns-established:
  - "A snap plan pins the exact after-strings in a readFileSync test, so a later codemod cannot silently revert a visible change"

requirements-completed: []  # DS-02 needs the 04-09 codemod across the rest of the app

duration: 8min
completed: 2026-10-20
---

# Phase 4 Plan 05: Token snaps (D-03) and #0a0a0a literals (D-01) Summary

**The only intended visible changes of Phase 4 are in: the season dropdown and toasts sit on `#101010` with the shared popover shadow, the /portfolio "Browse shows" link hovers to `#D7AD16` with a soft yellow glow, and the preload cover and avatar ink use the `#090909` token; five files now carry no raw hex, bracket radius or bracket shadow.**

## Accomplishments

- Task 1 (owner gate): the 04-GATE.md verify (Q1 and Q3 answered A by Koss) exited 0, so the plan ran as written. No file changed.
- Task 2 (TDD):
  - RED `1bcee0f`: six pins, 5 failing and the token-presence test passing.
  - GREEN `0aaba5d`, the exact before to after edits of UI-SPEC section 2:
    - `select.tsx`: trigger `shadow-inset-hairline`; content `rounded-card ... bg-[var(--bg-1)]/98 shadow-popover`; item `rounded-field`.
    - `[locale]/layout.tsx`: toast `bg-[var(--bg-1)] ... shadow-popover`.
    - `landing-hero-animations.tsx`: `shadow-cta-glow ... hover:bg-[var(--uis-primary-hover)]`.
    - `(viewer)/layout.tsx`: preload cover `background: 'var(--bg-0)'`.
    - `user-avatar.tsx`: `from-[var(--chart-5)] to-[var(--chart-2)]`, `text-[var(--primary-foreground)]`.
  - The test also proves globals.css holds the signed values (`--chart-5` #c8a04a, `--chart-2` #d97757, popover 0.42 shadow, inset hairline, yellow CTA glow 0.18, `--uis-primary-hover` #D7AD16), so the gradient swap is identical and the glow is the signed yellow.

## Task Commits

1. **Task 2 RED:** `1bcee0f` (test) - failing pins for D-03 snaps and D-01 literals
2. **Task 2 GREEN:** `0aaba5d` (fix) - snap blue-era leftovers to tokens and #0a0a0a literals
3. Task 1 changes no files (gate check)

## Verification

- Verified: `tests/unit/design-snaps.test.ts` 6/6; `npm run test:unit` 611/611; `npm run typecheck` clean; `npm run lint` 0 errors (115 warnings, all existing; the only one in these files is the existing `<img>` warning in user-avatar.tsx); eslint on the five files shows 0 `no-raw-design-values` messages; acceptance greps: the seven old literals (`#11151d`, `#10131a`, `7082ff`, `96,115,255`, `#0a0a0a`, `#c8a04a`, `#d97757`) count 0 in every one of the five files, `rounded-[`/`shadow-[` count 0 in select.tsx, `bg-[var(--bg-1)]/98` once in select.tsx, `shadow-cta-glow` once in landing-hero-animations.tsx. origin/main had not moved (0 commits behind), so no merge and no `npm ci` were needed.
- Not verified: no build (04-06 runs the heavy-locked gate:local that closes wave 4); nothing in a browser. Still open for Koss's UAT: (1) open a season dropdown, expect the menu on `#101010` (neutral, no blue tint); (2) on the admin design-system page press the toast button, expect a `#101010` toast; (3) on /portfolio hover "Browse shows", expect darker yellow `#D7AD16` with a soft yellow glow, no indigo; (4) a signed-in avatar still shows the same gold-to-orange gradient with near-black initials.
- Failed: none.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Unit tests and lint are light, so the heavy lock was not taken (no build, no Playwright, no Supabase stack).

## Known Stubs

None.

## Threat Flags

None. Class-name and inline-style changes only; T-04-12 is mitigated by the exact after-string pins in design-snaps.test.ts, with the screenshot UAT above as the second line.

## Self-Check: PASSED

- Files exist: `tests/unit/design-snaps.test.ts`, the five modified source files.
- Commits exist in `git log`: `1bcee0f`, `0aaba5d`.
