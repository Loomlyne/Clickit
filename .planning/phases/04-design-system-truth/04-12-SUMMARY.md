---
phase: 04-design-system-truth
plan: 12
subsystem: ui
tags: [design-tokens, codemod, tailwind, eslint]
requires:
  - phase: 04-09
    provides: RADIUS_CODEMOD / SHADOW_CODEMOD maps, named utilities, no-raw-design-values rule
provides:
  - Viewer route files and loading skeletons free of bracket radii and bracket shadows
  - Gate for waves 7-8 green
affects: [04-13]
key-files:
  modified:
    - src/app/[locale]/(viewer)/about/loading.tsx
    - src/app/[locale]/(viewer)/coming-soon/loading.tsx
    - src/app/[locale]/(viewer)/profile/loading.tsx
    - src/app/[locale]/(viewer)/support/loading.tsx
    - src/app/[locale]/(viewer)/support/page.tsx
    - src/app/[locale]/(viewer)/updates/loading.tsx
    - src/app/[locale]/(viewer)/updates/page.tsx
    - src/app/[locale]/(viewer)/watch/page.tsx
    - src/app/[locale]/(viewer)/auth/reset-password/page.tsx
    - src/components/skeletons/viewer-skeletons.tsx
key-decisions:
  - "Q2=A: named radii keep their px; support brand bars use rounded-hairline (1px), not rounded-xs (2px)"
requirements-completed: [DS-02]
duration: 8min
completed: 2026-10-20
---

# Phase 4 Plan 12: Codemod 4 of 5, viewer routes and skeletons Summary

Ten viewer route files and the loading skeletons now use named radius and shadow utilities with the same computed values as before; the guard reports 0 findings in them and gate:local is green on the combined waves 7-8.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1. Viewer route files | 9 route files edited (12 radius brackets, 1 shadow) | f8c8d40 |
| 2. Loading skeletons | 17 bracket radii replaced in viewer-skeletons.tsx | 55fb49e |
| 3. Heavy-locked gate:local | `/Users/koss/.clickit-checks/p04-w7-w8-gate.log` ends `exit=0` (22:35:23Z to 22:35:46Z, head 55fb49e); lock released. w7-w8 gate green. | none |

`git fetch origin && git merge --no-edit origin/main` reported "Already up to date" (no conflicts).

## What changed

- `rounded-[12px]` to `rounded-card` (about/loading x2, updates/page, support/loading, support/page, watch/page x2, updates/loading), `rounded-[11px]` to `rounded-media` (coming-soon/loading, profile/loading).
- `support/page.tsx:76` and `support/loading.tsx:25` `rounded-[1px]` to `rounded-hairline` (exact 1px).
- `auth/reset-password/page.tsx:36` `shadow-[var(--shadow-panel)]` to `shadow-panel`.
- `series/[slug]/loading.tsx`: no change; the file holds no `rgba(10,10,10` literal after #25.
- viewer-skeletons: `rounded-[6px]` to `rounded-md` (x6), `[8px]` to `rounded-field` (x3), `[11px]` to `rounded-media` (x3), `[12px]` to `rounded-card` (x5).
- No class reordering, no other edits. No extra viewer file was assigned to this plan by 04-09.

## Verification

- Guard on `src/app/**/*.tsx` under `(viewer)/`: 0 `clickit/no-raw-design-values` messages; same for viewer-skeletons.tsx.
- `npm run typecheck` clean; `npm run test:unit` 622 pass, 0 fail.
- Acceptance greps: `rounded-hairline` 1 in support/page.tsx and 1 in support/loading.tsx; `rgba(10,10,10` in series loading 0; `rounded-[` in viewer-skeletons 0.
- gate:local (lint, typecheck, test:unit, guard:migrations, build with placeholder env) exit=0.
- Repo-wide guard after this plan: 8 messages in 5 files, all admin files owned by 04-13 (admin/archive/page.tsx 1, admin-profile-card.tsx 1, admin-shell.tsx 2, settings/footer-editor.tsx 3, shorts-table.tsx 1).
- Not verified: before/after screenshots (controller UAT). Values are identical by construction (named radii map to the same px; `--shadow-panel` is the token the bracket referenced).

## Deviations from Plan

None. Plan executed as written.

## Self-Check: PASSED
