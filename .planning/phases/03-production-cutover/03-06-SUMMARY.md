---
phase: 03-production-cutover
plan: 06
subsystem: infra
tags: [runbook, cutover, dns, resend, r2, supabase-keys, rollback, gate]
requires:
  - phase: 03-production-cutover
    provides: "03-01 env.production; 03-02 cf:build:production / cf:deploy:production; 03-03 dns-check, rollback.mjs; 03-04 proof-check, keys-check, media-health --expect-source, parse-auth-results; 03-05 backup-table migration, ops SQL, with-heavy-lock.sh"
provides:
  - "03-RUNBOOK.md: Steps 0a-0c, 1-56, 36a, 52a with the real commands, flags and output strings; each step has Command or Where, Expected, Rollback, Then wait; trigger words on every changing [CONTROL] step"
  - "03-GATES.md: signed decisions, branch B wording, legacy-key consumer inventory, rollback ceiling, proof-window risks, deviations, rewording for Koss's signature, controller follow-ups, findings"
  - ".planning/handovers/phase-03-production-cutover.md: hand-over and PR checklist"
  - "deferred-items.md: check-gates locale-root 308 finding"
affects: [03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13, controller PR review]
tech-stack:
  added: []
  patterns:
    - "Runbook steps carry the exact log line each ops plan's verify greps for"
    - "Every wrangler line HOME-pinned with a whoami in the same step (awk-checked)"
key-files:
  created:
    - .planning/phases/03-production-cutover/03-RUNBOOK.md
    - .planning/phases/03-production-cutover/03-GATES.md
    - .planning/phases/03-production-cutover/deferred-items.md
    - .planning/handovers/phase-03-production-cutover.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - "Every proof-check call passes --site-path /en/portfolio (the locale root answers 308 on both hosts)"
  - "Step 28 adds proof-check --expect worker on workers.dev, so the production build is proven before the flip even if the grey-record pinned probe still shows Vercel"
  - "Step 40 adds a keys-check --captcha-probe off baseline before CAPTCHA goes on"
  - "Ops log lines in the runbook match the strings the 03-07..03-13 verify blocks grep (e.g. keys-check legacy-off: PASS, captcha-probe on: PASS, which the script prints as ... ALL PASS)"
  - "gate:local ran through with-heavy-lock.sh (orchestrator instruction), not a separate p3-gate.sh; no push and no PR from this executor"
requirements-completed: []
duration: 15min
completed: 2026-10-21
---

# Phase 3 Plan 06: Cutover runbook, gate file and hand-over Summary

**One runbook (Steps 0a-0c, 1-56, 36a, 52a) that the controller and Koss can run from entry to Vercel removal with the real script commands and output strings, a gate file with the signed branch-B wording and inventories, a hand-over, and gate:local exit=0 under the heavy lock. No PR opened (orchestrator opens it).**

## Performance

- Started: 2026-10-21T14:55:07Z (UTC clock)
- Completed: 2026-10-21T15:08Z
- Tasks: 3 of 3 (Task 3 without push and PR, per the orchestrator)
- Files: 4 created; STATE.md and ROADMAP.md updated

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Runbook Parts 0 and A-F (Steps 0a-0c, 1-35) | 82e679f | 03-RUNBOOK.md |
| 2 | Runbook Parts G-I (Steps 36-56, 36a, 52a), 03-GATES.md, deferred items | fc13fc4 | 03-RUNBOOK.md, 03-GATES.md, deferred-items.md |
| 3 | Hand-over (gate ran first) | d64f91a | .planning/handovers/phase-03-production-cutover.md |

## gate:local

- Command: `perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-gate.log -- env NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key NEXT_PUBLIC_SITE_URL=https://www.clickitstory.ae npm run gate:local`
- Log: `/Users/koss/.clickit-checks/p3-gate.log`, head 3bd9cd3, start 2026-10-21T14:55:56Z, end 14:56:48Z, last line `exit=0`.
- lint: 0 errors, 25 warnings (pre-existing); typecheck: clean; test:unit: 2234 pass, 0 fail; guard:migrations: 1 file checked, 0 violations; `next build`: compiled, 57/57 pages; `cf:build` (preview): `build stamp written: target preview, media flag off`.
- The gate ran before the 03-06 documents were written. Every commit after 3bd9cd3 touches only `.planning/` (all tests skip `.planning`, lint does not read Markdown), so the result holds for the final head. Lock released; working tree clean after the build.

## Plan verify results

- Task 1 automated verify: PASS (Steps 0a, 0b, 0c, 1-35 present; 61 "Then wait" (>= 38); the three `P3-pre-*: PASS` strings; `youtube_key_meta`; the p3-ops path; no key or JWT shape; every wrangler line HOME-pinned; every step with an `npx wrangler@4` command also has a whoami).
- Task 2 automated verify: PASS (Steps 36-56, 36a, 52a; "sweep deletes on"; `--allow-upload-sweep-delete`; "Branch B" and "2026-12-15" in 03-GATES.md; every pre-flip/post-flip/rollback/final dns-check line carries `--with-resend`; "(7) Rewording"; "CLAUDE.local.md line 32").
- Acceptance: `dns-check.mjs --phase` occurs 10 times (ns, resend, pre-flip, post-flip, rollback, final); `r2:copy` only on the Step 14 "never" line; Steps 40-55 and 52a each start with "Precondition: Step 39 recorded"; Step 50 comes after 47, 48, 49; Step 53 says Edit and contains no "delete"; 03-GATES.md has sections (1)-(8) plus (9) findings.
- Task 3 verify (`gh pr list ... | grep -q 1`): not run by design; the orchestrator opens the PR. `grep -q "^exit=0" /Users/koss/.clickit-checks/p3-gate.log` passes; `git status --porcelain` is empty.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Orchestrator instruction] Task 3 without push and PR**
- The plan's Task 3 pushes the branch and runs `gh pr create`. The orchestrator said: do not push, do not open the PR. Both left to it. The plan's `/Users/koss/.clickit-checks/p3-gate.sh` wrapper was replaced by the shipped `scripts/cutover/with-heavy-lock.sh` (same lock, start/end/exit lines), with the log at the path the plan's verify greps (`p3-gate.log`). No `npm ci` (node_modules was current; the gate passed).

**2. [Rule 1 - Bug, documentation] `--site-path /en/portfolio` on every proof-check call**
- The plan text writes `proof-check --expect worker|vercel` without a path; the default `/en` answers 308 on both the frozen site and the Worker (`src/server/locale-root.ts`), and the site judge requires 200 (03-04 added the flag). Rule 7 of the runbook and every call carry the path.

**3. [Rule 2 - Missing check] Step 28 workers.dev marker proof and Step 40 captcha-off baseline**
- Added `proof-check --expect worker --site https://clickit.clickitstory.workers.dev` (proves the production build and the marker header before the flip) and `keys-check --captcha-probe off` (baseline for Step 45). Both read-only. Recorded in 03-GATES.md section 6.

**4. [Rule 1 - Bug, documentation] `make-session-cookie.mjs` does not exist**
- The 02 runbook names `scripts/cf/make-session-cookie.mjs`; it is not in the repo. Step 44 names "the 02-21 measurement sign-ins" instead.

### Found, not fixed (out of scope)

**5. check-gates cannot print ALL PASS against the Worker**
- `scripts/cf/check-gates.mjs` (Phase 2) requires `GET /en` and `GET /ar` to answer 200 with `redirect: 'manual'`; the app answers 308 to `/<locale>/portfolio`. Runbook Steps 28, 33, 36, 42, 54, 56 expect `ALL PASS`. Logged in `deferred-items.md`, 03-GATES.md section 9 item 1 and the hand-over: a small reviewed fix on its own branch before Step 28. Not done here (writing-only plan; Phase 2 file).

### Readings of the orchestrator notes

- G7 is already applied in CLAUDE.local.md (the r2:media rule sits in the Gate facts line about #24); 03-GATES.md section 8 keeps the plan's "line 32" item, says so, and leaves only the header line for `.planning/handovers/r2-media-copy.md`.
- G2/G3/G5 were signed as meanings at the plan gate; section 7 lists the exact lines 03-13 writes, each with a signature placeholder, and shows the signed G-text next to the plan's variant where they differ (03-13 greps "apex redirects 301 to www").

## Known Stubs

None. The signature placeholders in 03-GATES.md section 7 are intentional (Koss signs the exact lines; 03-13 applies only signed ones).

## Threat Flags

None. Documents only; no key, token or JWT value in any file (grep in the verify blocks); every secret step uses a prompt (T-03-28); G-ROLLBACK preconditions on Steps 40-55 and G-REWRITE order 47-49 before 50 (T-03-29); Step 11 approval is Koss's (T-03-30); Step 31 time check and G-DNS (T-03-31); every step logs with the clock time (T-03-32).

## Self-Check: PASSED

- FOUND: .planning/phases/03-production-cutover/03-RUNBOOK.md, 03-GATES.md, deferred-items.md, .planning/handovers/phase-03-production-cutover.md
- FOUND commits: 82e679f, fc13fc4, d64f91a
- FOUND: `/Users/koss/.clickit-checks/p3-gate.log` last line `exit=0`
