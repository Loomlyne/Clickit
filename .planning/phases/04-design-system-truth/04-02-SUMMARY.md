---
phase: 04-design-system-truth
plan: 02
subsystem: ui
tags: [eslint, design-tokens, lint-rule, node-test]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 named radius/shadow/status utilities and design-truth module
provides:
  - Local ESLint plugin clickit/no-raw-design-values (exported PATTERNS, rule, default)
  - Rule registered at warn for src/**/*.{ts,tsx} with a commented allowlist block
  - 26 fixture tests via ESLint Linter (espree)
  - Per-file inventory of raw values for the codemod plans 04-05 and 04-09..04-13
affects: [04-05, 04-09, 04-10, 04-11, 04-12, 04-13, phase-05-email-templates]

tech-stack:
  added: []
  patterns:
    - "Token guard rides npm run lint, so gate:local and pr-gate.yml pick it up with no workflow change"
    - "ESLint rule fixtures linted with the bundled espree parser, no TS parser in committed tests"

key-files:
  created:
    - eslint-rules/clickit-tokens.mjs
    - tests/unit/clickit-tokens-rule.test.ts
  modified:
    - eslint.config.mjs

key-decisions:
  - "Rule is warn in this plan; 04-13 flips it to error after the codemod"
  - "Allowlist: brand-colors.ts, design-truth.ts, email-tokens.ts, src/emails/**, src/lib/mail/templates/**"

patterns-established:
  - "Waivers use eslint-disable-next-line clickit/no-raw-design-values -- <reason> (message shows the form)"

requirements-completed: []  # DS-02 only partly delivered here (guard at warn); stays open until the codemod flips it to error (04-13) and the rest of DS-02 lands

duration: 12min
completed: 2026-10-20
---

# Phase 4 Plan 02: Token guard rule Summary

**Local ESLint rule `clickit/no-raw-design-values` (hex, non-neutral rgb, bracket radius, bracket shadow, raw palette classes) registered at warn with an allowlist, covered by 26 fixture tests, reporting 128 findings in 54 files as the codemod inventory.**

## Accomplishments

- Task 1: RED test file first (failed, module missing), then the rule module from the RESEARCH prototype with the UI-SPEC utility names in HINTS. All 26 tests passed on the first GREEN run (10 flag fixtures, 14 allow fixtures, PATTERNS keys, message content). No regex was changed from the prototype.
- Task 2: `eslint.config.mjs` imports the plugin, adds the `warn` block for `src/**/*.{ts,tsx}` and the `off` allowlist block, each entry commented. `.github/` untouched.
- Verified: `npm run lint` exit 0 (0 errors); `npx eslint src/components/ui/select.tsx` reports 5 `clickit/no-raw-design-values` warnings; rule tests + `workflows.test.ts` 49/49; `npm run typecheck` clean; `git diff --name-only HEAD~3 -- .github` empty.

## Task Commits

1. **Task 1 RED:** `3046f94` (test) - failing fixtures
2. **Task 1 GREEN:** `8ba3d2c` (feat) - rule module
3. **Fix:** `afc7b03` (fix) - header comment fix (below)
4. **Task 2:** `43a1e99` (feat) - register at warn with allowlist

## Baseline inventory (codemod input, at this branch HEAD)

Total 128 findings in 54 files: radius 77, hex 24, rgb 13, shadow 10, palette 4. (RESEARCH predicted 117 at 8794fc8; the extra come from `viewer-skeletons.tsx` and `portfolio-skeletons.tsx` after the #25 merge. Counts are one finding per string node and kind.) Raw JSON: scratchpad `p04-02-baseline.json` (not committed).

| Findings | File |
|---------:|------|
| 17 | src/components/skeletons/viewer-skeletons.tsx |
| 10 | src/components/layout/navbar.tsx |
| 6 | src/components/ui/dropdown-menu.tsx |
| 6 | src/components/admin/settings/genre-color-editor.tsx |
| 6 | src/app/[locale]/admin/shows/[id]/edit/page.tsx |
| 5 | src/components/ui/select.tsx |
| 5 | src/components/landing/portfolio-skeletons.tsx |
| 4 | src/components/series/episode-row.tsx |
| 3 | src/lib/cinema.ts |
| 3 | src/components/watch/episode-tray.tsx |
| 3 | src/components/series/review-composer.tsx |
| 3 | src/components/admin/settings/footer-editor.tsx |
| 3 | src/components/admin/categories-manager.tsx |
| 2 | src/components/ui/dialog.tsx |
| 2 | src/components/ui/checkbox.tsx |
| 2 | src/components/shorts/shorts-overlay.tsx |
| 2 | src/components/layout/user-avatar.tsx |
| 2 | src/components/landing/landing-hero-animations.tsx |
| 2 | src/components/company/company-page.tsx |
| 2 | src/components/coming-soon/coming-soon-splash.tsx |
| 2 | src/components/admin/admin-shell.tsx |
| 2 | src/app/[locale]/layout.tsx |
| 2 | src/app/[locale]/(viewer)/watch/page.tsx |
| 2 | src/app/[locale]/(viewer)/support/page.tsx |
| 2 | src/app/[locale]/(viewer)/support/loading.tsx |
| 2 | src/app/[locale]/(viewer)/about/loading.tsx |
| 1 | src/lib/category-chip.ts |
| 1 | src/components/watch/watch-shell.tsx |
| 1 | src/components/ui/sheet.tsx |
| 1 | src/components/ui/play-overlay.tsx |
| 1 | src/components/ui/card.tsx |
| 1 | src/components/support/contact-form.tsx |
| 1 | src/components/shows/show-card.tsx |
| 1 | src/components/shows/portrait-show-card.tsx |
| 1 | src/components/shows/placeholder-card.tsx |
| 1 | src/components/shows/episode-card.tsx |
| 1 | src/components/series/series-detail-hero.tsx |
| 1 | src/components/series/reviews-section.tsx |
| 1 | src/components/profile/profile-history-row.tsx |
| 1 | src/components/layout/mobile-nav.tsx |
| 1 | src/components/landing/genre-pills.tsx |
| 1 | src/components/home/hero-slide.tsx |
| 1 | src/components/home/genres-grid.tsx |
| 1 | src/components/home/continue-watching-card.tsx |
| 1 | src/components/browse/shorts-rail.tsx |
| 1 | src/components/admin/shorts-table.tsx |
| 1 | src/components/admin/admin-profile-card.tsx |
| 1 | src/components/admin/admin-header.tsx |
| 1 | src/app/[locale]/admin/archive/page.tsx |
| 1 | src/app/[locale]/(viewer)/updates/page.tsx |
| 1 | src/app/[locale]/(viewer)/updates/loading.tsx |
| 1 | src/app/[locale]/(viewer)/profile/loading.tsx |
| 1 | src/app/[locale]/(viewer)/layout.tsx |
| 1 | src/app/[locale]/(viewer)/coming-soon/loading.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule header comment was parsed as an ESLint directive**
- **Found during:** Task 2 (`npm run lint` exit 1)
- **Issue:** the module header contained the literal text `eslint-disable-next-line clickit/no-raw-design-values -- <reason>`; ESLint treated it as a real directive in `eslint-rules/clickit-tokens.mjs`, which is outside the `src/` registration, and reported "Definition for rule not found".
- **Fix:** reworded the header comment to describe the waiver form without the directive keyword. The report message (which is a string, not a comment) is unchanged.
- **Files modified:** eslint-rules/clickit-tokens.mjs
- **Commit:** afc7b03

**2. Baseline count differs from the plan estimate** (128 vs about 117), explained above; not a defect.

**3. Worktree branch-name check:** the executor allow-list expects `worktree-agent-*`; this phase branch is `claude/phase-04-design-system-truth-26dcc6` by orchestrator rule. Deny-list respected; all commits are on the phase branch.

Otherwise the plan ran as written. Q4 was not an input here (the `if_owner_differs` branch does not apply).

## Known Stubs

None.

## Threat Flags

None. Dev-time lint tooling only. T-04-04 (waiver bypass) is partly mitigated: the message requires a `-- <reason>` form; the unit test that enforces it is 04-13. T-04-05 mitigated: the allowlist is one commented config block.

## Self-Check: PASSED

Files exist: eslint-rules/clickit-tokens.mjs, tests/unit/clickit-tokens-rule.test.ts, eslint.config.mjs (modified). Commits 3046f94, 8ba3d2c, afc7b03, 43a1e99 in git log.
