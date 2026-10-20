---
phase: 01-safe-ground
plan: 01
subsystem: infra
tags: [migration-guard, sql-scanner, git, node-test, supabase-migrations]

requires: []
provides:
  - "scripts/migration-guard.mjs: scanSql, classifyChanges, runGuard, PATTERNS, PHASE1_NEUTRALISATION, CLI (exit 0/1/2)"
  - "tests/unit/migration-guard.test.ts: 20 tests (scanner fixtures 1-11, classifier, git fixtures 12-16, destructive-through-git, ordering warning, CLI)"
  - "package.json scripts: typecheck, guard:migrations; gate:local = lint, typecheck, unit tests, guard, build"
affects: [01-02 pr-gate workflow, 01-03 seed relocation (fills PHASE1_NEUTRALISATION.to)]

tech-stack:
  added: []
  patterns:
    - "Dependency-free single-file Node guard (node: imports only) so CI can run a lone copy of the base branch's version"
    - "git via execFileSync argument arrays, never a shell"
    - "Temp-git-repo fixtures with explicit GIT_AUTHOR/COMMITTER env (no reliance on global git config)"

key-files:
  created:
    - scripts/migration-guard.mjs
    - tests/unit/migration-guard.test.ts
  modified:
    - package.json

key-decisions:
  - "Comments inside $tag$ dollar-quoted bodies are stripped (research behaviour), not preserved; this lets a same-line safe-drop waiver work inside function bodies"
  - "Strings and dollar bodies are scanned, so a string such as '-- safe-drop: x' also yields a finding for the word drop inside it; a misread quote can add findings but never hide one"
  - "Copy status (C*) is treated like an addition; applied-file rule applies to M, D, R*, T, U"

patterns-established:
  - "Waiver: -- safe-drop: <reason> on the same line as the destructive keyword"
  - "Allow-list entry is exact path + from blob + to blob; to: null never matches"

requirements-completed: [SAFE-02, SAFE-03, SAFE-01]

duration: 20min
completed: 2026-10-20
---

# Phase 1 Plan 01: Migration Guard Summary

**Dependency-free destructive-SQL and applied-migration guard (`npm run guard:migrations`) with a 20-test fixture suite, plus `typecheck` and an extended `gate:local`.**

## Accomplishments

- `scanSql` single-pass scanner: nested block and line comments blanked, strings, quoted identifiers and dollar bodies scanned, same-line `-- safe-drop: <reason>` waivers (empty reason, other-line and in-string waivers rejected). Flags every `drop` except `drop not null/default/identity/expression`, `truncate`, `delete from`, `then delete`.
- `runGuard` through real git (`git diff --name-status -z --find-renames base...head`): name rule for additions, D-05 immutability for M/D/R/T/U with exact from/to blob allow-list, D-04 destructive scan on A/M `.sql`, non-failing warning for versions that sort before applied ones.
- CLI: `--base` (default `origin/main`), `--head` (default `HEAD`), `--dir`; prints `path:line: reason`, GitHub `::error`/`::warning` annotations under `GITHUB_ACTIONS`, a summary line; exit 0/1/2.
- `PHASE1_NEUTRALISATION` holds the five paths and `from` blob SHAs with `to: null` (plan 03 fills `to`).

## Task Commits

1. Task 1 RED: `ab38d75` test(01-01) failing scanner fixtures
2. Task 1 GREEN: `10b0e1f` feat(01-01) scanner and classifier
3. Task 2 RED: `ea638fb` test(01-01) failing git-rule and CLI fixtures
4. Task 2 GREEN: `aaa6eba` feat(01-01) git rules, CLI, package scripts

## Verification

- `node --experimental-strip-types --test tests/unit/migration-guard.test.ts`: 20 pass, 0 fail
- `npm run test:unit`: 131 pass, 0 fail (all prior tests intact)
- `npm run typecheck`: exit 0
- `node scripts/migration-guard.mjs --base origin/main --head HEAD`: exit 0, "0 files checked, 0 violations, 0 warnings"
- `eslint` on the two new files: 0 errors, 0 warnings
- Acceptance greps: 4 required exports present, `execFileSync('git'` present, no `execSync(`/`shell: true`, no non-`node:` imports, `package-lock.json` unchanged, package-script equality check exits 0
- Not run (out of scope for this plan): `npm run build` / `gate:local` end to end

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Conflict resolution] Comments inside dollar-quoted bodies**
- **Found during:** Task 1
- **Issue:** The plan action says comment markers inside `$tag$` bodies are not comments, while RESEARCH (the prototyped design) says dollar bodies are code context with comments stripped. A literal reading would make `-- safe-drop:` waivers unusable inside function bodies and flag commented-out statements in bodies.
- **Fix:** Followed RESEARCH. Fixture 10 asserts a commented-out drop inside a `$$` body passes. Bodies are still scanned (fixture 10 findings unchanged).
- **Commit:** 10b0e1f

**2. [Rule 1 - Test expectation] Fixture 6, waiver text inside a string**
- **Issue:** `select '-- safe-drop: x'; drop table t;` yields two findings (the word `drop` inside the string literal is scanned too, by design), not one.
- **Fix:** Test asserts at least one finding and zero waived entries rather than exactly one.
- **Commit:** 10b0e1f

None otherwise. `runGuard` additionally returns a `checked` count (used for the CLI summary line); the documented return fields are unchanged.

## Known Stubs

`PHASE1_NEUTRALISATION[*].to` is `null` for all five entries by design; plan 03 sets them after the final edit of each migration.

## Threat Flags

None. Mitigations T-01-01 to T-01-03 are implemented and covered by fixtures; T-01-04 (CI runs the base copy) belongs to plan 02.

## Self-Check: PASSED

- scripts/migration-guard.mjs, tests/unit/migration-guard.test.ts, package.json present
- Commits ab38d75, 10b0e1f, ea638fb, aaa6eba present in git log
