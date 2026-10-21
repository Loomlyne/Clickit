---
phase: 04-design-system-truth
plan: 10
subsystem: ui
tags: [design-tokens, codemod, tailwind, eslint]
requires:
  - phase: 04-09
    provides: RADIUS_CODEMOD map, --ink-legacy-rgb token, post-merge inventory
provides:
  - 12 viewer components (show cards, home, browse, series) with no raw design value
affects: [04-11, 04-12]
tech-stack:
  added: []
  patterns: [named radius utilities, rgb(var(--ink-legacy-rgb) / X) inline gradients]
key-files:
  modified:
    - src/components/shows/episode-card.tsx
    - src/components/shows/placeholder-card.tsx
    - src/components/shows/portrait-show-card.tsx
    - src/components/shows/show-card.tsx
    - src/components/home/continue-watching-card.tsx
    - src/components/landing/featured-shorts-strip.tsx
    - src/components/browse/shorts-rail.tsx
    - src/components/home/hero-slide.tsx
    - src/components/series/episode-row.tsx
    - src/components/series/review-composer.tsx
    - src/components/series/reviews-section.tsx
    - src/components/series/series-detail-hero.tsx
key-decisions:
  - "Value-identical only: rounded-[12px]->rounded-card, [11px]->rounded-media, [8px]->rounded-field, [var(--uis-r-media)]->rounded-media; rgba(10,10,10,X)->rgb(var(--ink-legacy-rgb) / X)"
requirements-completed: [DS-02]
duration: 6min
completed: 2026-10-20
---

# Phase 4 Plan 10: Codemod 2 of 5 Summary

Tokenised 12 viewer components (show cards, continue-watching, featured shorts, browse rail, hero slide, series) with identical computed values: 18 radius/gradient substitutions, no other change.

## Commits

- 8dfc960 refactor(04-10): tokenise show cards (6 files)
- 4af9a1f refactor(04-10): tokenise hero, browse and series components (6 files)

## Verification

- eslint `clickit/no-raw-design-values` on the 12 files: 0 messages.
- `npm run typecheck`: clean. `npm run test:unit`: 622 pass, 0 fail.
- `grep -c "rounded-\["` on all 12 files: 0. `rgba(10,10,10` in hero-slide and series-detail-hero: 0.

## Deviations from Plan

None to the work. Notes:

- Acceptance wording "`grep -c ink-legacy-rgb` in hero-slide.tsx >= 2": the two uses are on one source line (line 63), so a line count is 1 while the occurrence count is 2 (`grep -o | wc -l` = 2). series-detail-hero has 2 lines. Values are as the plan intends.
- eslint still reports one pre-existing `react-hooks/exhaustive-deps` warning in review-composer.tsx:96; not a design-value rule, out of scope.

## Known Stubs

None.

## Self-Check: PASSED

Commits 8dfc960 and 4af9a1f exist; the 12 files are modified; guard findings remaining in these files: 0.
