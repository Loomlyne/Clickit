---
phase: 04-design-system-truth
plan: 11
subsystem: ui
tags: [design-tokens, codemod, tailwind, eslint]
requires:
  - phase: 04-09
    provides: RADIUS_CODEMOD / SHADOW_CODEMOD maps, token names in globals.css, no-raw-design-values rule
provides:
  - Watch, shorts, landing skeleton, company, support, coming-soon components and cinema/category-chip helpers free of raw design values
affects: [04-12]
tech-stack:
  patterns: ["rgb(var(--ink-*-rgb) / a) for ink gradients", "named radius/shadow utilities instead of brackets"]
key-files:
  modified:
    - src/components/shorts/shorts-overlay.tsx
    - src/components/watch/episode-tray.tsx
    - src/components/watch/watch-shell.tsx
    - src/components/landing/portfolio-skeletons.tsx
    - src/components/company/company-page.tsx
    - src/components/support/contact-form.tsx
    - src/components/coming-soon/coming-soon-splash.tsx
    - src/lib/cinema.ts
    - src/lib/category-chip.ts
key-decisions:
  - "Value-identical replacements only (Q2 radius answer A: named radii keep their px)"
requirements-completed: [DS-02]
duration: 10min
completed: 2026-10-20
---

# Phase 4 Plan 11: Codemod 3 of 5 Summary

Nine files (20 rule messages) tokenised with identical computed values: radius brackets became rounded-card/media/panel/xl, shadows became shadow-modal/shadow-bar/drop-shadow-splash, and the cinema, coming-soon and category-chip colours now read `--ink-cinema-rgb`, `--primary-rgb` and `--ink-legacy-rgb`.

## Commits

- af26934 refactor(04-11): tokenise watch, shorts and landing components (Task 1)
- 3893445 refactor(04-11): tokenise support, coming-soon and cinema gradients (Task 2)

## Replacements

- shorts-overlay: `rounded-[10px] shadow-[0_40px_120px_rgba(0,0,0,0.6)]` to `rounded-xl shadow-modal`
- watch-shell: bar shadow to `shadow-bar`
- episode-tray: `rounded-t-[16px]` to `rounded-t-panel`, `rounded-[12px]` to `rounded-card`, `rounded-[11px]` to `rounded-media`
- portfolio-skeletons, company-page, contact-form: `rounded-[12px]` to `rounded-card`, `rounded-[11px]` to `rounded-media`
- coming-soon-splash: glow `rgba(255,204,0,0.09)` to `rgb(var(--primary-rgb)/0.09)`; drop shadow to `drop-shadow-splash`
- cinema.ts: nine `rgba(8,8,12,X)` stops to `rgb(var(--ink-cinema-rgb) / X)`
- category-chip.ts: constant dark text colour to `rgb(var(--ink-legacy-rgb) / 0.92)`; the two data-driven `rgba(${rgb.r},...)` lines untouched

Left as is (not flagged by the rule): `rgba(255,255,255,0.04)` in the splash gradient, `rgba(255,255,255,0.45)` in the episode-tray scrollbar-color variant.

## Verification

- eslint on the 9 files: 0 `clickit/no-raw-design-values` messages (guard findings remaining: 0)
- `npm run typecheck`: pass
- `npm run test:unit`: 622 pass, 0 fail
- Acceptance greps: shadow-bar 1, shadow-modal 1, rounded-t-panel 1, `rgba(8,8,12` 0, `var(--ink-cinema-rgb)` x9, data-driven category-chip lines 2, drop-shadow-splash 1
- Not verified: visual screenshots (controller UAT), build (wave gate in 04-12)

## Deviations from Plan

None - plan executed exactly as written. Note: contact-form.tsx still shows a pre-existing `react-hooks/incompatible-library` warning (React Hook Form `watch`), unrelated to this plan.

## Known Stubs

None.

## Self-Check: PASSED

Both commits exist (af26934, 3893445); all nine files modified.
