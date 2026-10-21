---
phase: 04-design-system-truth
plan: 03
subsystem: ui
tags: [brand-colors, design-tokens, node-test, refactor]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 design-truth pins and @theme static brand tokens; 04-02 token guard rule
provides:
  - BRAND_PALETTE (6 CIT colours with safe tints) as the single brand map in src/lib/brand-colors.ts
  - Picker and default constants (NEUTRAL_ACCENT_HEX, DEFAULT_GENRE_HEX, DEFAULT_CATEGORY_PILL_HEX, COLOR_PICKER_RAINBOW, COLOR_INPUT_EMPTY_HEX, CATEGORY_HEX_PLACEHOLDER)
  - Parity test against globals.css plus a source scan that forbids a second hex map under src/
affects: [04-05, 04-13]

tech-stack:
  added: []
  patterns:
    - "BRAND_COLOR_HEX derived from the palette (showSelectable filter), keeping the 5-key show type"

key-files:
  created:
    - tests/unit/brand-colors.test.ts
  modified:
    - src/lib/brand-colors.ts
    - src/app/[locale]/admin/shows/[id]/edit/page.tsx
    - src/components/admin/settings/genre-color-editor.tsx
    - src/components/admin/categories-manager.tsx
    - src/components/home/genres-grid.tsx
    - src/components/landing/genre-pills.tsx
    - src/components/profile/profile-history-row.tsx

key-decisions:
  - "Q4=A (Koss, recorded in 04-GATE.md): category colours stay free content; picker, hex input and live colours unchanged"
  - "Desert Sand keeps class name brand-yellow and is showSelectable=false: genre/category defaults only, shows keep 5 values"

patterns-established:
  - "Any new brand hex lives in brand-colors.ts; the source scan in brand-colors.test.ts fails otherwise (design-truth.ts pins are the only other allowed holder)"

requirements-completed: []  # DS-02 is only partly delivered here (one brand map); the radius/shadow codemod and the guard flip to error (04-13) remain

duration: 15min
completed: 2026-10-20
---

# Phase 4 Plan 03: One brand map Summary

**`src/lib/brand-colors.ts` is now the single brand-colour map (6 CIT colours + safe tints, pinned to the globals.css `@theme` tokens), and all six consumers import from it with identical rendered values.**

## Accomplishments

- Task 1 (owner gate): the 04-GATE.md Q4 row verify exited 0 (Q4 = A, Koss), so the plan ran as written.
- Task 2 (TDD): RED test first (failed on missing exports), then `BRAND_PALETTE`, derived `BRAND_COLOR_HEX` (same 5 values, same type), unchanged `BRAND_COLOR_BG/TEXT`, and the six picker/default constants. Parity test compares each palette hex and safe tint with `--color-brand-*` in globals.css.
- Task 3: edit page, genre-color-editor, categories-manager, genres-grid, genre-pills and profile-history-row no longer hold a brand or picker hex. Class names and labels untouched. `glow-badge.tsx` has its hex only in a doc comment, so it needed no change; ESLint reports nothing there.
- Task 4: `gate:local` ran detached under the heavy lock, log `/Users/koss/.clickit-checks/p04-w1-w3-gate.log`, head `7b302bf`, ended `exit=0`. Lint 0 errors (128 warnings, all `clickit/no-raw-design-values` inventory for the codemod plans plus 2 pre-existing), typecheck clean, 588/588 unit tests, guard:migrations and build passed. Lock released afterwards. Waves 1-3 gate green.

## Task Commits

1. **Task 2 RED:** `26f39e9` (test) - failing brand map parity tests
2. **Task 2 GREEN:** `7e8cc16` (feat) - single brand palette export
3. **Task 3:** `7b302bf` (refactor) - one brand map for every consumer
4. Task 1 and Task 4 change no repo files (gate check; gate run outside the repo)

## Verification

- Verified: brand-colors test 5/5; `npm run typecheck`; eslint on the six consumers, glow-badge and brand-colors.ts (0 messages); no brand/picker hex or `conic-gradient` left in the six files; `gate:local` exit=0.
- Not verified: visual pass in a browser (values are identical by construction and by test; no UAT in this plan).
- Failed: none.

## Deviations from Plan

None - plan executed as written. The plan's own wording says the source scan "goes green in Task 2"; it went green in Task 3 as the behavior bullets imply.

## Issues Encountered

- The shared heavy lock was free when the gate started, so no queue wait. The gate script both removes the lock explicitly and via an exit trap (harmless double remove when no other session grabs the lock in between).

## Known Stubs

None.

## Self-Check: PASSED

- tests/unit/brand-colors.test.ts and src/lib/brand-colors.ts present; commits 26f39e9, 7e8cc16, 7b302bf exist; gate log ends `exit=0`.
