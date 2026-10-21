---
phase: 04-design-system-truth
plan: 13
subsystem: ui
tags: [design-tokens, codemod, tailwind, eslint, admin]
requires:
  - phase: 04-09
    provides: RADIUS_CODEMOD / SHADOW_CODEMOD maps, named utilities, no-raw-design-values rule
  - phase: 04-12
    provides: viewer routes and skeletons tokenised
provides:
  - Admin files and src/styles/admin.css free of bracket radii, bracket shadows and px radii
  - clickit/no-raw-design-values at error (gate:local and PR CI fail on any new raw design value)
  - tests/unit/design-no-legacy.test.ts (banned literals, admin.css, waiver reasons, severity)
  - Gate for wave 9 green
affects: [phase-02-branch, phase-06-branch]
key-files:
  modified:
    - src/app/[locale]/admin/archive/page.tsx
    - src/components/admin/admin-profile-card.tsx
    - src/components/admin/admin-shell.tsx
    - src/components/admin/settings/footer-editor.tsx
    - src/components/admin/shorts-table.tsx
    - src/components/admin/show-form.tsx
    - src/styles/admin.css
    - eslint.config.mjs
  created:
    - tests/unit/design-no-legacy.test.ts
key-decisions:
  - "Q1/Q2/Q3 = A (Koss, 2026-10-20): admin radii keep their px (rounded-card 12, rounded-field 8, rounded-md 6); no waiver was needed"
requirements-completed: [DS-02]
duration: 12min
completed: 2026-10-20
---

# Phase 4 Plan 13: Codemod 5 of 5 and the lock Summary

The last 8 guard findings in five admin files, plus the three px radii in `admin.css`, are tokenised with identical computed values; the rule is now `error`, a new test pins the banned literals, and gate:local is green. DS-02 closes.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. Owner-gate check (Q1, Q2, Q3) | Verify command exit 0 (all three answered A) | none |
| 2. Tokenise admin files and admin.css | 8 bracket radii, 2 bracket shadows, 3 css radii replaced | ced3eed |
| 3a. RED: design-no-legacy test | 3 pass, severity test fails (rule still warn) | 2860d01 |
| 3b. GREEN: rule to error | 4 pass; `npm run lint` 0 errors | 224d0a2 |
| 4. Heavy-locked gate:local | `/Users/koss/.clickit-checks/p04-w9-gate.log` ends `exit=0` (22:37:43Z to 22:38:07Z, head 224d0a2); lock released. w9 gate green. | none |

`origin/main` (c0da1d8) was already an ancestor of the branch; no merge needed.

## What changed

- `rounded-[12px]` to `rounded-card`: admin/archive/page.tsx:62, admin-profile-card.tsx:21, admin-shell.tsx:9,12 (`adminPanelClass`, `adminTableShellClass`).
- `rounded-[8px]` to `rounded-field`: settings/footer-editor.tsx:284,287,301.
- `rounded-[6px]` to `rounded-md`: shorts-table.tsx:327.
- `shadow-[var(--shadow-soft)]` to `shadow-soft`: show-form.tsx:397,521 (not a guard finding; done per plan).
- admin.css: :316 `border-radius: var(--radius-md)` (6px), :367 and :384 `border-radius: var(--uis-r-field)` (8px). admin.css has 0 hex.
- eslint.config.mjs: `'clickit/no-raw-design-values': 'error'`, comment "Phase 4 DS-02 guard (error since 04-13)". Allowlist block (brand-colors.ts, design-truth.ts, email templates) unchanged.
- No data-driven waiver was needed: zero `eslint-disable` for the rule exists in `src/`.

## Verification

- `npx eslint "src/**/*.{ts,tsx}" -f json`: 0 `clickit/no-raw-design-values` messages in all of src/ (at error level).
- `grep -nE "border-radius: *[0-9]+px" src/styles/admin.css`: none; `var(--radius-md)` 1, `var(--uis-r-field)` 2; `rounded-[` in admin-shell.tsx 0; `shadow-[` in show-form.tsx 0.
- design-no-legacy: banned literals absent from src/ (ts/tsx, excluding design-truth.ts) and DESIGN.md; admin.css no px radius / hex; every rule waiver carries ` -- reason`; severity is error.
- gate:local (lint 0 errors / 18 pre-existing unrelated warnings, typecheck, test:unit 626 pass 0 fail, guard:migrations, build with placeholder env) exit=0.
- Not run here: controller UAT screenshots (before/after of home, a show, watch, admin dashboard, /portfolio) per 04-VALIDATION.md.

## Final visible-change ledger

1. D-03 select popover #11151d to #101010.
2. D-03 toast #10131a to #101010, shadow alpha 0.45 to 0.42.
3. D-03 /portfolio "Browse shows" hover #7082ff to #D7AD16 and indigo glow to yellow glow 0 16px 40px rgba(255,204,0,0.18).
4. D-01 preload cover and avatar initials #0a0a0a to #090909 (one step).
5. The new admin-only page `/admin/design-system` and its "Design system" link in the admin sidebar (Operations, after Audit).

Nothing else changes visibly.

## Files Phase 4 touched (for the Phase 2 and Phase 6 branch owners, who rebase after this lands)

Diff of `c0da1d8` (origin/main) to branch tip, excluding `.planning/`. Added (A) files cannot conflict; expect conflicts only in the modified ones.

Added: `eslint-rules/clickit-tokens.mjs`, `src/app/[locale]/admin/design-system/page.tsx`, `src/components/admin/design-system/design-system-view.tsx`, `src/components/admin/design-system/token-groups.ts`, `src/lib/design-truth.ts`, `src/lib/email-tokens.ts`, `tests/unit/{brand-colors,clickit-tokens-rule,design-doc,design-no-legacy,design-snaps,design-system-page,design-tokens,email-tokens}.test.ts`, `tests/unit/helpers/ui-system-radius.ts`.

Modified:
- Root/config: `DESIGN.md`, `eslint.config.mjs`, `src/styles/globals.css`, `src/styles/admin.css`, `src/messages/en.json`, `src/messages/ar.json`.
- Lib: `src/lib/brand-colors.ts`, `src/lib/category-chip.ts`, `src/lib/cinema.ts`, `src/lib/utils.ts`.
- App routes: `src/app/[locale]/layout.tsx`, `(viewer)/layout.tsx`, `(viewer)/about/loading.tsx`, `(viewer)/auth/reset-password/page.tsx`, `(viewer)/coming-soon/loading.tsx`, `(viewer)/profile/loading.tsx`, `(viewer)/support/{loading,page}.tsx`, `(viewer)/updates/{loading,page}.tsx`, `(viewer)/watch/page.tsx`, `admin/archive/page.tsx`, `admin/shows/[id]/edit/page.tsx`.
- Admin components: `admin-header`, `admin-profile-card`, `admin-shell`, `categories-manager`, `settings/footer-editor`, `settings/genre-color-editor`, `shorts-table`, `show-form`.
- Other components: `browse/shorts-rail`, `coming-soon/coming-soon-splash`, `company/company-page`, `home/{continue-watching-card,genres-grid,hero-slide}`, `landing/{featured-shorts-strip,genre-pills,landing-hero-animations,portfolio-skeletons}`, `layout/{mobile-nav,navbar,user-avatar}`, `profile/profile-history-row`, `series/{episode-row,review-composer,reviews-section,series-detail-hero}`, `shorts/shorts-overlay`, `shows/{episode-card,placeholder-card,portrait-show-card,show-card}`, `skeletons/viewer-skeletons`, `support/contact-form`, `ui/{card,checkbox,dialog,dropdown-menu,play-overlay,select,sheet}`, `watch/{episode-tray,watch-shell}` (all under `src/components/`).

Rule for Phase 2 and Phase 6 after rebase: new code under `src/` must pass `npm run lint` at error level; use the named utilities (`rounded-card|field|media|panel|control|shell|chip|hairline`, `shadow-soft|panel|popover|modal|bar|inset-hairline|live-dot|cta-glow`, `status-*`). `04-P6-ADDENDUM.md` maps the brackets and status classes for Phase 6.

## Deviations from Plan

None. Plan executed as written; Task 1 was pre-approved by the orchestrator (verify exit 0).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
