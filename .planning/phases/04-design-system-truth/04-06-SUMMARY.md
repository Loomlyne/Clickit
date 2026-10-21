---
phase: 04-design-system-truth
plan: 06
subsystem: docs
tags: [design-md, design-tokens, email-tokens, requirements-wording, phase-6-addendum, node-test]

requires:
  - phase: 04-design-system-truth
    provides: 04-01 tokens, design-truth.ts and email-tokens.ts; 04-03 one brand map; 04-04 admin design-system page; 04-05 snaps; 04-07 canvas boards
provides:
  - DESIGN.md as written token truth (radius roles, shadows, status tones, exact legacy tokens, brand map note, watch/YouTube rule, RTL, two-scheme email tables)
  - tests/unit/design-doc.test.ts, ten tests pinning DESIGN.md to globals.css, design-truth.ts and email-tokens.ts
  - DS-01 / DS-04 wording and ROADMAP Phase 4 wording corrected (#090909, /admin/design-system, 8px field/base radius, pill controls)
  - 04-P6-ADDENDUM.md, the bracket-to-named-utility and brand-safe-to-status mapping for Phase 6
  - Wave 4 close gate:local green
affects: [04-09, 04-13, phase-05, phase-06]

tech-stack:
  added: []
  patterns:
    - "Markdown tables in DESIGN.md are parsed by a test and compared with globals.css through canonicalCssValue, so a doc edit that disagrees with the CSS fails the unit run"

key-files:
  created:
    - tests/unit/design-doc.test.ts
    - .planning/phases/04-design-system-truth/04-P6-ADDENDUM.md
  modified:
    - DESIGN.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Owner answers Q1, Q2, Q4, Q5 = A and Q7 = C were recorded (gate verify exit 0), so the if_owner_differs branch was not used"
  - "No requirement ticked: DS-01 and DS-04 still need the browser UAT of /admin/design-system (04-04 said so), DS-02 needs the codemod (04-09 to 04-13)"
  - "The guard is described as flagging, not failing, because eslint.config.mjs still has it at warn until 04-13 flips it to error"

patterns-established:
  - "Doc tables carry the same token names as the CSS; the first cell may hold several names and each is checked"

requirements-completed: []  # DS-01 and DS-04 wait for UAT, DS-02 for the codemod; wording is corrected, nothing is ticked

duration: 5min
completed: 2026-10-20
---

# Phase 4 Plan 06: DESIGN.md truth, requirement wording and wave 4 close Summary

**DESIGN.md now states the live tokens (radius roles, named shadows, status tones, exact legacy tokens, both email schemes) and a ten-test parity check fails the unit run if it ever drifts from globals.css or email-tokens.ts; DS-01/DS-04 and ROADMAP Phase 4 say #090909 and /admin/design-system; Phase 6 has an exact identical-value mapping; gate:local is green (622/622 tests, build ok).**

## Accomplishments

- Task 1 (owner gate): the 04-GATE.md verify exited 0 (Q1, Q2, Q4, Q5 = A, Q7 = C), so the plan ran as written. No file changed.
- Task 2 (TDD):
  - RED `f1a71c2`: ten tests, seven failing (no Radius table, no Shadows, no Email section, missing strings).
  - GREEN `fce314c`: DESIGN.md updated in place. New: Source of Truth pointer and guard line, `--destructive` and `--ring` rows, the 11 / 14 / 20 / 24 sentence and the LBC 400/700 line, Radius Roles table (8 roles plus the standard scale), Shadows table (9 utilities), Status tones table, Exact legacy tokens table, brand map note (Desert Sand = `brand-yellow`, category colours are content), Watch page and YouTube rules, Right-to-left, Email (light, dark and button tables generated from the current `EMAIL_TOKENS` keys). Every existing section was kept.
  - The tests: Mode and Color and legacy tables (every name in the first cell is declared in globals.css and equal after normalisation), Radius Roles px against RADIUS_CODEMOD and `--uis-r-*`, Shadows against every SHADOW_CODEMOD target and the CSS value, Status tones against STATUS_TONES, banned literals (`#0a0a0a`, `6073ff`, `7082ff`, `10131a`, `11151d`, `indigo`), required strings, no `claude.ai` link, email tables equal `EMAIL_TOKENS` both ways (role sets identical, every hex in the section belongs to the module). A one-digit change to `--bg-3` in DESIGN.md made the run fail (9 pass / 1 fail), then restored.
- Task 3 `37c5571`: REQUIREMENTS DS-01 and DS-04, ROADMAP Phase 4 Goal and criteria 1 and 4, new 04-P6-ADDENDUM.md (radius table with spec line numbers, status-tone table, shadows, Toaster note, not-flagged list).
- Task 4: gate:local under the heavy lock, w4 gate green (details below).

## Task Commits

1. **Task 2 RED:** `f1a71c2` (test) failing DESIGN.md parity tests
2. **Task 2 GREEN:** `fce314c` (docs) DESIGN.md matches the tokens and new rules
3. **Task 3:** `37c5571` (docs) DS-01/DS-04 wording, roadmap Phase 4 wording, Phase 6 addendum
4. **Follow-up:** `bb9fdf4` (docs) email tables follow the controller's token fix 54e2c79 (light `code` #111111, new dark `rule` #222222)
5. Tasks 1 and 4 change no repo files.

## Verification

- Verified:
  - `tests/unit/design-doc.test.ts` 10/10.
  - `/Users/koss/.clickit-checks/p04-w4-gate.log` (script `p04-w4-gate.sh`, re-run on head bb9fdf4 after the email-token follow-up, detached, waited for the lock held by another session) ends `exit=0`: lint 0 errors (115 warnings, all existing), typecheck clean, `test:unit` 622 tests / 622 pass / 0 fail, `guard:migrations` 0 files and 0 violations, `next build` compiled and generated 57 static pages. The lock was free afterwards. w4 gate green (04-04, 04-05, 04-07 and this plan combined).
  - Acceptance greps: DESIGN.md has 0 of the old literals and 0 `claude.ai`; `rounded-card`, `text-status-success`, `/admin/design-system`, `brand-yellow` each present; REQUIREMENTS has 2 `/admin/design-system` and 0 `#0a0a0a`; the ROADMAP Phase 4 block has 0 `#0a0a0a` and 3 `/admin/design-system`; the addendum has the radius, status, `youtube-status-chip.tsx`, `advanced-tab.tsx` and `cfa99df` strings and no 570 or 605.
  - `npx tsc --noEmit` and `npx eslint tests/unit/design-doc.test.ts` clean.
- Not verified: nothing was opened in a browser (DS-01 and DS-04 UAT on `/en/admin/design-system` and `/ar/admin/design-system` still belong to Koss). No push of main, no deploy, no live write.
- Failed: none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale plan fact] Phase 6 tip and file lines moved**
- **Found during:** Task 3 (re-fetch, as the plan says)
- **Issue:** the plan pinned tip `cfa99df` and said `advanced-tab.tsx` has only a `text-brand-orange-safe` at line 352 and no green use. The tip is now `ffb531a` (Phase 6 wrote its code since): the file has `TEST_OK_ICON` `text-brand-green-safe` at line 279, red at 418, 421, 439 and orange at 607. The spec line numbers are unchanged. Phase 6 also already has `src/components/route-scoped-toaster.tsx` with the OLD indigo-era toast class and a bracket shadow.
- **Fix:** the addendum pins `ffb531a`, still names `cfa99df` as the first pin, lists the current lines, maps green to `text-status-success`, and states that the `RouteScopedToaster` class string must be replaced with Phase 4's when Phase 6 merges (and that `src/app/[locale]/layout.tsx` will conflict on the Toaster lines).
- **Files modified:** `.planning/phases/04-design-system-truth/04-P6-ADDENDUM.md`
- **Commit:** `37c5571`

**2. [Rule 1 - Accuracy] Guard described as flagging, not failing**
- **Found during:** Task 2
- **Issue:** the plan text says the rule "fails lint", but `eslint.config.mjs` has `clickit/no-raw-design-values` at `warn` until 04-13 flips it. Saying it fails lint today would be wrong.
- **Fix:** DESIGN.md says it flags and becomes an error once the codemod has landed. The addendum says "at error level from plan 04-13".
- **Commit:** `fce314c`

**3. [Rule 2 - Truthful content] Exact legacy tokens: "used for" column**
- **Issue:** the plan asks for where each legacy token is used, but no source file reads these tokens yet (only the design-system page lists them); the codemod plans 04-09 to 04-11 introduce the uses.
- **Fix:** the column states the planned uses taken from plans 04-09, 04-10 and 04-11 (navbar scrims, hero gradients, dialog and sheet scrims, cinema gradients, splash glow), not invented ones.
- **Commit:** `fce314c`

**4. [Rule 1 - Lock hygiene] Gate script releases the lock only when it owns it**
- The earlier gate scripts run `rm -rf` on the lock both explicitly and in a trap, which could delete another session's lock acquired in between. `p04-w4-gate.sh` removes the lock only when its pid file equals its own pid, once.

Otherwise the plan ran as written. No requirement was ticked (see key-decisions).

## Issues Encountered

Mid-run the orchestrator changed `src/lib/email-tokens.ts` (54e2c79: light `code` #111111, new dark `rule` #222222). The parity test would have caught the drift; the DESIGN.md tables were regenerated from the current keys and the whole gate was re-run green (first run kept as `p04-w4-gate-first.log`).

None. `origin/main` was an ancestor of the branch (0 commits behind, `package-lock.json` identical), so no merge and no `npm ci` were needed. The heavy lock was held by a Phase 2 gate for about half a minute; the script waited for it.

## Known Stubs

None.

## Threat Flags

None. DESIGN.md and the addendum carry only public CSS values, class names and the public sender domain `media.clickitstory.ae`; no key, token, private link or person's email (T-04-13). Drift is pinned by `design-doc.test.ts`, which runs in `gate:local` (T-04-14).

## Self-Check: PASSED

- Files exist: `DESIGN.md`, `tests/unit/design-doc.test.ts`, `.planning/phases/04-design-system-truth/04-P6-ADDENDUM.md`, `/Users/koss/.clickit-checks/p04-w4-gate.log` (last line `exit=0`).
- Commits exist in `git log`: `f1a71c2`, `fce314c`, `37c5571`, `bb9fdf4`.
