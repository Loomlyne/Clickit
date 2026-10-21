---
phase: 04-design-system-truth
plan: 01
subsystem: ui
tags: [tailwind-v4, design-tokens, tailwind-merge, node-test, email-tokens]

requires:
  - phase: 03-media-r2
    provides: origin/main (#25 skeletons, globals.css .skeleton-bone) merged into this branch
provides:
  - Named radius, shadow and status utilities in globals.css that resolve to today's exact values
  - Exact-value tokens (ink/scrim rgb channels, live-dot, nav scrim and fade) for the Phase 4 codemod
  - src/lib/design-truth.ts (signed values, codemod maps, normalizeCssValue, contrastRatio)
  - cn() that merges the named utilities with the standard scale
  - src/lib/email-tokens.ts (light and dark literal-hex email schemes, Q7 = C)
  - Pin tests that fail on a silent change to any signed value
affects: [04-02, 04-03, 04-04, phase-05-email-templates, phase-06-admin-chips]

tech-stack:
  added: []
  patterns:
    - "@theme static for tokens that must always be emitted to :root (radius scale, brand, shadows)"
    - "@theme inline keys that reference :root vars (radius roles, status tones, surface/text)"
    - "Token pin tests parse globals.css blocks with readFileSync, no CSS toolchain"

key-files:
  created:
    - src/lib/design-truth.ts
    - src/lib/email-tokens.ts
    - tests/unit/design-tokens.test.ts
    - tests/unit/email-tokens.test.ts
    - tests/unit/helpers/ui-system-radius.ts
  modified:
    - src/styles/globals.css
    - src/lib/utils.ts

key-decisions:
  - "Shadows go in a new @theme static block, not the UI-SPEC self-referencing @theme inline form (it emitted a self-referencing variable)"
  - "Radius scale (sm..2xl) moved out of @theme inline into @theme static with --radius-hairline so var(--radius-md) exists at runtime for admin.css"
  - "Added shadow-bar for watch-shell.tsx:270 (exact value) instead of an allowlist waiver"
  - "Light email footer text is #767676 (4.54:1 on white) not Phase 5's pictured #777777 (4.48:1, under AA); Phase 5 confirms"

patterns-established:
  - "Signed values live in globals.css and in design-truth.ts; design-tokens.test.ts fails when they diverge"
  - "Codemod maps are data with a test that checks each target resolves to the same px/value as its source"

requirements-completed: []  # DS-01 and DS-02 only partly delivered here (tokens); left unchecked in REQUIREMENTS.md until DESIGN.md, the codemod and the admin page land in later plans

duration: 25min
completed: 2026-10-20
---

# Phase 4 Plan 01: Token foundation Summary

**Named radius/shadow/status utilities and exact-value tokens in globals.css, a pure design-truth module, a cn() that merges the new names, and 30 pin tests; no component changed, live look untouched.**

## Performance

- **Tasks:** 3 of 3 (Task 1 was the owner-gate check)
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Task 1: gate verify exited 0 (Q1, Q2, Q3 answered A by Koss); no file changed.
- Task 2: `origin/main` was already an ancestor of the branch (merge 705fd02, includes #25); no new merge needed. globals.css now has the seven `--radius-<role>` keys referencing `--uis-r-*`, a static radius scale plus `--radius-hairline`, the nine named shadows, brand colours as `@theme static`, status tones, and the exact legacy tokens. `--color-surface-*` and `--color-text-*` now reference the base palette instead of duplicating hex.
- Task 3: `design-truth.ts` (no imports), `cn()` on `extendTailwindMerge`, `email-tokens.ts` (no imports, no custom properties). The `tailwind-merge` 3.5.0 theme keys `radius`, `shadow`, `drop-shadow` were accepted as written; no rename needed.
- Verified: design-tokens + email-tokens tests 30/30, full `npm run test:unit` 557/557, `npm run typecheck` clean, eslint clean on the three new/changed lib files, `npm run lint` 0 errors (17 pre-existing warnings, none in these files). `git diff --stat origin/main...HEAD -- src/components src/app` is empty.

## Task Commits

1. **Task 1: owner answers Q1-Q3** - no commit (verify only, exit 0)
2. **Task 2 RED:** `614e75a` (test) - failing token pin tests, vendored `buildRadius`
3. **Task 2 GREEN:** `d0224c7` (feat) - named radius, shadow, status and exact-value tokens
4. **Task 3 RED:** `2e8c225` (test) - failing tests for design-truth, cn, email tokens
5. **Task 3 GREEN:** `68a88c5` (feat) - design-truth module, twMerge theme names, email tokens
6. **Fix:** `b33a8d8` (fix) - email-tokens header comment contained the text `var(` (acceptance check wants 0)

## Verbatim --live-dot

`--live-dot: oklch(63.7% 0.237 25.331);` (copied from `node_modules/tailwindcss/theme.css` `--color-red-500`, tailwindcss 4.2.2).

## Compile proof (Tailwind 4.2.2 `compile` on globals.css, throwaway script, not committed)

All 18 candidates generate a rule. `rounded-card` reads `var(--uis-r-card)`.

```
rounded-card            border-radius: var(--uis-r-card)
rounded-t-panel         border-top-left-radius / border-top-right-radius: var(--uis-r-panel)
rounded-hairline        border-radius: var(--radius-hairline)
rounded-field           border-radius: var(--uis-r-field)
md:rounded-card         @media (width >= 48rem) { border-radius: var(--uis-r-card) }
shadow-popover          --tw-shadow: 0 24px 80px var(--tw-shadow-color, rgba(0, 0, 0, 0.42))
shadow-inset-hairline   --tw-shadow: inset 0 1px 0 var(--tw-shadow-color, rgba(255, 255, 255, 0.04))
shadow-live-dot         --tw-shadow: 0 0 6px var(--tw-shadow-color, rgba(239, 68, 68, 0.9))
shadow-cta-glow         --tw-shadow: 0 16px 40px var(--tw-shadow-color, rgba(255, 204, 0, 0.18))
shadow-bar              --tw-shadow: 0 8px 32px -8px var(--tw-shadow-color, rgba(0, 0, 0, 0.65))
shadow-modal            --tw-shadow: 0 40px 120px var(--tw-shadow-color, rgba(0, 0, 0, 0.6))
drop-shadow-splash      --tw-drop-shadow-size: drop-shadow(0 24px 80px var(--tw-drop-shadow-color, rgba(0, 0, 0, 0.55)))
                        --tw-drop-shadow: drop-shadow(var(--drop-shadow-splash))
bg-live-dot             background-color: var(--live-dot)
text-status-success     color: var(--status-success)
border-status-success/35  border-color: var(--status-success); color-mix(in oklab, var(--status-success) 35%, transparent)
bg-status-success/8     background-color: var(--status-success); color-mix(in oklab, var(--status-success) 8%, transparent)
border-status-neutral-line  border-color: var(--status-neutral-line)
text-status-neutral     color: var(--status-neutral)
```

Note: `drop-shadow-splash` also emits a second line `--tw-drop-shadow: drop-shadow(var(--drop-shadow-splash))`, which is why the `--drop-shadow-splash` token must (and does) exist in `@theme static`.

## Acceptance checks

- `--radius-<role>: var(--uis-r-<role>)` count = 1 for card (and tests pin all seven); `--radius-hairline: 1px` = 1
- `@theme static` count = 3; `--shadow-soft:` count = 1; `--color-surface-[1-4]: #` count = 0; `--status-neutral-line: var(--line-2)` = 1; `--live-dot: oklch` = 1
- `extendTailwindMerge` count in utils.ts = 2; `^import` count in design-truth.ts and email-tokens.ts = 0; `var(` in email-tokens.ts = 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test value parser did not collapse whitespace inside parentheses**
- **Found during:** Task 2 GREEN
- **Issue:** `--gradient-nav-fade` is written multi-line like the existing gradients, so the collapsed value read `linear-gradient( 180deg, ...` and the exact-value test failed.
- **Fix:** `decl()` in the test now also removes whitespace after `(` and before `)`. CSS kept in the existing multi-line style.
- **Files modified:** tests/unit/design-tokens.test.ts
- **Commit:** d0224c7

**2. [Rule 1 - Bug] Header comment in email-tokens.ts failed its own acceptance check**
- **Found during:** Task 3 verification
- **Issue:** the comment mentioned `var()`, so `grep -c "var(" src/lib/email-tokens.ts` was 1, not 0.
- **Fix:** reworded to "custom properties".
- **Commit:** b33a8d8

**3. [Rule 3 - Blocking] npm ci needed**
- `package-lock.json` differed from the installed node_modules (Lenis removal from #25 arrived with the main merge). Ran `npm ci` under the heavy lock, detached, `exit=0` (log `/Users/koss/.clickit-checks/p04-01-npmci.log`). No package added or changed.

**4. Step 0 (merge origin/main) was a no-op**
- `git merge-base --is-ancestor origin/main HEAD` exits 0 at start (merge 705fd02 already on the branch), so no new merge commit.

**5. Worktree branch-name check**
- The pre-commit allow-list in the executor protocol expects `worktree-agent-*`; this phase branch is `claude/phase-04-design-system-truth-26dcc6` by orchestrator rule. Deny-list (main/master/etc.) respected; all commits are on the named phase branch.

Otherwise the plan ran as written. Q1-Q3 were all A, so no `if_owner_differs` branch applied.

## Known Stubs

None. The new utilities are intentionally unused until 04-02 onward.

## Threat Flags

None. Token values are public CSS already shipped; no new endpoints, auth or file access. T-04-01 mitigated (pin tests), T-04-02 mitigated (vendored helper cites repo, path and commit 0404be9).

## Self-Check: PASSED

All five created files exist; all five commit hashes found in git log.
