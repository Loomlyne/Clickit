---
phase: 04-design-system-truth
plan: 09
subsystem: ui
tags: [design-tokens, codemod, eslint, tailwind]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 named utilities and exact-value tokens (rounded-card/media/field, bg-live-dot, shadow-live-dot, --scrim-*, --gradient-nav-fade), 04-06 warn-level guard
provides:
  - UI primitives and layout chrome free of bracket radii, bracket shadows, raw rgba and raw palette classes
  - Post-merge inventory with an owning plan for every remaining finding
  - Gate for waves 5-6 green
affects: [04-10, 04-11, 04-12, 04-13]

key-files:
  modified:
    - src/components/ui/card.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/play-overlay.tsx
    - src/components/ui/sheet.tsx
    - src/components/layout/mobile-nav.tsx
    - src/components/layout/navbar.tsx

key-decisions:
  - "Q1=A and Q2=A (04-GATE.md, Koss 2026-10-20): value-identical replacements only, no visible change"

requirements-completed: [DS-02]

duration: 15min
completed: 2026-10-20
---

# Phase 4 Plan 09: Codemod 1 of 5, UI primitives and chrome Summary

Eight primitive and chrome files now use the named radius, shadow, scrim and live-dot tokens with the same computed values as before; the guard reports 0 findings in them and gate:local is green.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. Owner gate (Q1, Q2) | Verify exit 0 (both A, Koss 2026-10-20), run by the orchestrator and re-run here: ok | none |
| 2. Merge, inventory, tokenise | `git fetch origin && git merge --no-edit origin/main` reported "Already up to date" (origin/main was merged at 705fd02 earlier; `git merge-base --is-ancestor origin/main HEAD` exits 0). 8 files tokenised. | 8f7a275 |
| 3. Heavy-locked gate:local | `/Users/koss/.clickit-checks/p04-w5-w6-gate.log` ends `exit=0` (start 22:31:20Z, end 22:31:47Z, head 8f7a275); lock released afterwards. w5-w6 gate green. | none |

## What changed (8f7a275)

- `rounded-[12px]` to `rounded-card` (card, dialog, dropdown-menu x2), `rounded-[8px]` to `rounded-field` (dropdown-menu x4), `rounded-[10px]` to `rounded-xl` (play-overlay), `rounded-[6px]` to `rounded-md` (checkbox), `rounded-b-[4px]` to `rounded-b-sm` (mobile-nav).
- checkbox: `shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]` to `shadow-inset-hairline`.
- dialog `bg-[rgba(4,6,10,0.82)]` to `bg-[var(--scrim-dialog)]`; sheet `bg-[rgba(4,6,10,0.8)]` to `bg-[var(--scrim-sheet)]`.
- navbar: three `bg-[rgba(10,10,10,0.96)]` to `bg-[var(--scrim-nav)]`; the gradient to `bg-[image:var(--gradient-nav-fade)]`; two ping dots `bg-red-500` to `bg-live-dot`; two core dots to `bg-live-dot shadow-live-dot`.
- No class reordering, no other edits (21 lines changed, 21 replaced).

## Verification

- Guard on the 8 files: 0 `clickit/no-raw-design-values` messages (was 24).
- `npm run typecheck` clean; `npm run lint` 0 errors (91 pre-existing warnings, the guard still at warn until 04-13); `npm run test:unit` 622 pass, 0 fail.
- Acceptance greps: `bg-red-500` in navbar 0; `bg-live-dot` 4; `bg-[image:var(--gradient-nav-fade)]` 1; `rgba(10|4, ...)` in navbar, dialog, sheet 0 each.
- gate:local (lint, typecheck, test:unit, guard:migrations, build with placeholder env) exit=0.
- Not verified: before/after screenshots (controller UAT). Values are identical by construction: tokens `--scrim-*`, `--gradient-nav-fade`, `--shadow-inset-hairline`, `--shadow-live-dot` hold the old literals through `--ink-*-rgb`; `bg-live-dot` is `oklch(63.7% 0.237 25.331)`, the value Tailwind's `red-500` resolves to.

## Post-merge inventory (before this plan's edits)

Baseline: `eslint "src/**/*.{ts,tsx}"` found 97 `clickit/no-raw-design-values` messages in 42 files. This plan took 24 messages in 8 files. Remaining: 73 messages in 34 files, every file owned by a plan (no file new on main outside the plan lists, so no reassignment to 04-12 or 04-13 was needed).

| Plan | Files with findings | Messages |
|------|---------------------|----------|
| 04-10 | 11 | 16 |
| 04-11 | 9 | 20 |
| 04-12 | 9 | 29 |
| 04-13 | 5 | 8 |
| unassigned | 0 | 0 |

Files in the plans' lists with no current finding: 04-10 `landing/featured-shorts-strip.tsx`; 04-12 `series/[slug]/loading.tsx`, `auth/reset-password/page.tsx`; 04-13 `admin/show-form.tsx`, `styles/admin.css`, `eslint.config.mjs`, `design-no-legacy.test.ts` (non-TS-rule files or edits by 04-13 itself).

### 04-10
- `src/components/browse/shorts-rail.tsx` (1)
- `src/components/home/continue-watching-card.tsx` (1)
- `src/components/home/hero-slide.tsx` (1)
- `src/components/series/episode-row.tsx` (4)
- `src/components/series/review-composer.tsx` (3)
- `src/components/series/reviews-section.tsx` (1)
- `src/components/series/series-detail-hero.tsx` (1)
- `src/components/shows/episode-card.tsx` (1)
- `src/components/shows/placeholder-card.tsx` (1)
- `src/components/shows/portrait-show-card.tsx` (1)
- `src/components/shows/show-card.tsx` (1)
### 04-11
- `src/components/coming-soon/coming-soon-splash.tsx` (2)
- `src/components/company/company-page.tsx` (2)
- `src/components/landing/portfolio-skeletons.tsx` (5)
- `src/components/shorts/shorts-overlay.tsx` (2)
- `src/components/support/contact-form.tsx` (1)
- `src/components/watch/episode-tray.tsx` (3)
- `src/components/watch/watch-shell.tsx` (1)
- `src/lib/category-chip.ts` (1)
- `src/lib/cinema.ts` (3)
### 04-12
- `src/app/[locale]/(viewer)/about/loading.tsx` (2)
- `src/app/[locale]/(viewer)/coming-soon/loading.tsx` (1)
- `src/app/[locale]/(viewer)/profile/loading.tsx` (1)
- `src/app/[locale]/(viewer)/support/loading.tsx` (2)
- `src/app/[locale]/(viewer)/support/page.tsx` (2)
- `src/app/[locale]/(viewer)/updates/loading.tsx` (1)
- `src/app/[locale]/(viewer)/updates/page.tsx` (1)
- `src/app/[locale]/(viewer)/watch/page.tsx` (2)
- `src/components/skeletons/viewer-skeletons.tsx` (17)
### 04-13
- `src/app/[locale]/admin/archive/page.tsx` (1)
- `src/components/admin/admin-profile-card.tsx` (1)
- `src/components/admin/admin-shell.tsx` (2)
- `src/components/admin/settings/footer-editor.tsx` (3)
- `src/components/admin/shorts-table.tsx` (1)

## Deviations from Plan

None. Plan executed as written. The merge in Step 0 was a no-op because the branch already contained origin/main.

## Known Stubs

None.

## Threat Flags

None.
