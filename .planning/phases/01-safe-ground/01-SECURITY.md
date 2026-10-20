---
phase: 01
slug: safe-ground
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_head: 670e0fb
created: 2026-10-20
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit of branch `claude/phase-01-safe-ground-dc6bbe` at HEAD 670e0fb, 2026-10-20 (13:44Z read of GitHub/DNS state).

**Merge precondition (transfer threats T-01-10, T-01-12, T-01-21, T-01-26; also the real protection behind T-01-08):** these are closed as *transfer to the controller runbook*, because the runbook carries the exact commands and a stop-condition readback ordered before the squash merge. They are NOT yet executed. Read-only state at 2026-10-20T13:44Z: environments = `Preview`, `Production` only (no `live-db`, no `live-db-plan`); repo-level secret `SUPABASE_DB_URL` still present; rulesets `[]`. The Phase 1 squash merge must not happen until runbook step 5 reads back as expected.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| PR author → guard | Migration SQL and file names in a PR are untrusted text the guard parses | SQL text, file paths |
| guard → git | Revision and path strings reach `git` as process arguments | rev / path strings |
| PR branch code → GitHub runner | Untrusted PR code runs in `pull_request` jobs of a public repo | source code, read-only token |
| Apply workflow → live Postgres | DB URL secret crosses into a runner that writes live schema | `SUPABASE_DB_URL` (full-privilege, high) |
| Dispatcher → approver | Whoever dispatches must not be able to self-approve as an agent | environment approval |
| Migration files → live Postgres | Any file content can reach live if history is ever rewritten | DDL / DML |
| seed.sql → any database | Seed text could insert fake rows into a real database | fake content rows |
| Executor → shared local Postgres | Another session's local stack and data live on the same server | local dev data |
| Work session → GitHub | Push and PR creation with Koss's admin `gh` token | admin token |
| Runbook text → controller/owner terminal | Commands that change repo settings and touch live | settings, secrets (typed by owner only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | migration SQL hiding a drop in a comment or string | mitigate | Only comments are blanked (`scripts/migration-guard.mjs:150-179`); strings, identifiers and `$tag$` bodies stay in the scanned text (`:181-243`), each dollar body scanned as its own region so a stray quote cannot leak (CR-01 fix, `:224-243`); anything open at EOF is a violation (`:136-141`, `:416-422`). Waiver = same-line `-- safe-drop:` with non-empty reason (`:89`, `:154-155`, `:264-266`). Tests: fixtures 6, 10, 11, 17, 18, 19 (`tests/unit/migration-guard.test.ts:134`, `:178`, `:195`, `:207`, `:246`, `:262`). Residual WR-05 accepted (AR-03). | closed |
| T-01-02 | Tampering | applied migration silently edited/renamed/deleted | mitigate | D-05 on every non-added status (`migration-guard.mjs:391-408`): any M/D/R/T of a base file fails unless status M AND base blob == `from` AND head blob == `to` (`:395-400`). Fixtures 13, 14, 15 (`migration-guard.test.ts:321`, `:340`, `:363`), incl. second-edit-after-merge fails (`:398-412`). | closed |
| T-01-03 | Elevation of privilege | shell injection via file names or `--base` | mitigate | All git calls are `execFileSync('git', [args])`, no shell option (`migration-guard.mjs:306-318`, `:320-330`); grep finds no `eval`, `execSync`, `spawn` or `shell:`; revisions starting with `-` rejected (`:355-357`); paths passed after `--` (`:367-368`). | closed |
| T-01-04 | Tampering | PR edits the guard itself to pass | mitigate | CI runs the BASE copy via `git show HEAD^1:scripts/migration-guard.mjs > "$RUNNER_TEMP/guard.mjs"` (`.github/workflows/pr-gate.yml:53-65`); test `workflows.test.ts:189-199`. Declared residual (Phase 1 PR itself; PRs editing `pr-gate.yml`) recorded in hand-over `:50`, `:73` and runbook `:217`; widened by review WR-01 (AR-01). | closed |
| T-01-05 | Denial of service | obfuscated SQL (`'dr'\|\|'op'`) evades the guard | accept | Accepted at plan time (RESEARCH `:304`, `:503`; plan signed, CONTEXT `:116`); stated in guard header `migration-guard.mjs:33-35`. Logged as AR-02. | closed |
| T-01-06 | Information disclosure | pr-gate.yml | mitigate | `pull_request` only, no `_target` (`pr-gate.yml:26-29`); `permissions: contents: read` (`:31-32`); no `secrets.` anywhere (grep: 0 matches in pr-gate.yml); `persist-credentials: false` in both jobs (`:47`, `:75`). Tests `workflows.test.ts:41-57`, `:85-92`. | closed |
| T-01-07 | Tampering | third-party actions | mitigate | Every `uses:` pinned to 40-hex SHA with version comment (`pr-gate.yml:44,49,72,94`; `apply-live-migrations.yml:85,89,171,175`); test `workflows.test.ts:31-35`, `:79-83`, `:385-389`. SHAs resolved read-only via GitHub API 2026-10-20: checkout v4.2.2 = 11bd7190…, setup-node v7.1.0 = 949feb24…, setup-cli v3.0.1 = 45a513f8… — all match. No new action beyond these three. | closed |
| T-01-08 | Tampering | unreviewed live DDL | mitigate | `workflow_dispatch` only (`apply-live-migrations.yml:41-48`); dry-run first, `apply` gated by `needs` + `pending == 'true'` (`:119-120`); `environment: live-db` (`:123`); `pg_dump_taken` checked via env in both jobs before any DB command (`:76-83`, `:162-169`); "Main only" steps (`:66-71`, `:129-134`) are diagnostics per CR-02 comment (`:21-33`); no include-all / include-seed / debug (grep clean; test `workflows.test.ts:218-223`). Real branch protection = environment branch policy + no repo-level secret (runbook steps 3, 4b, 5; see T-01-10). Residual WR-06 (approver sees names, not SQL) accepted (AR-04). | closed |
| T-01-09 | Information disclosure | DB URL in logs | mitigate | Secret only through step `env:` (`apply-live-migrations.yml:96`, `:182`), never echoed; no `--debug` (test `workflows.test.ts:218-223`); `tee` writes CLI output only (`:100`); inputs never interpolated in `run:` (test `:307-321`). Residual IN-03 (pooler host/role on connection error) accepted (AR-08). | closed |
| T-01-10 | Elevation of privilege | apply runs if `live-db` missing (auto-created without reviewer) | mitigate → transfer (controller runbook) | Runbook step 3 exact `gh api --method PUT …/environments/live-db` with reviewer id 223640340 + `main` branch policy (`01-CONTROLLER-RUNBOOK.md:51-67`); step 5 readback with expected values and stop condition (`:88-100`); both ordered before the squash merge (`:5`, `:15`, `:33`). Workflow header states it (`apply-live-migrations.yml:31-33`). In-code backstop (WR-03): `apply` reads `live-db` via API and exits 1 without a `required_reviewers` rule, before the secret-bearing step (`:139-157`); tested with fake curl (`workflows.test.ts:332-383`). Not yet executed (13:44Z: `live-db` absent) — merge precondition. | closed |
| T-01-11 | Denial of service | required check never reports on docs-only PRs | mitigate | No workflow-level `paths`/`paths-ignore` (`pr-gate.yml:26-29`; test `workflows.test.ts:46-47`); `scope` step + step-level `if` (`pr-gate.yml:77-116`), fail-closed after WR-02 (`:83-88`); test `workflows.test.ts:94-109`, `:127-187` (bash run). | closed |
| T-01-12 | Elevation of privilege | agent approving its own gate | mitigate → transfer (procedure) | Runbook rule "an agent never approves" (`01-CONTROLLER-RUNBOOK.md:10`) and step 9 "controller never calls `POST .../pending_deployments`" (`:180-182`); hand-over "Approval gate is procedural" (`handovers/phase-01-safe-ground.md:83-85`). No technical control is possible (same `Loomlyne` account dispatches and approves, `prevent_self_review: false` by design); residual logged as AR-10. | closed |
| T-01-13 | Tampering | 20260401000000 drop block re-run on live | mitigate | All ten drop statements are comments (`supabase/migrations/20260401000000_create_schema.sql:16-25`); guard run `--base origin/main --head HEAD` today: `5 files checked, 0 violations` exit 0; allow-list pinned to exact blobs (`migration-guard.mjs:66-87`), `git hash-object` matches all five `to` SHAs (rerun 2026-10-20). | closed |
| T-01-14 | Tampering | fake data seeded into live | mitigate | Seed bodies moved to `supabase/seed.sql`; self-guard raises when `public.shows` has rows (`seed.sql:15-20`); refusal proven by rerun (`/Users/koss/.clickit-checks/p1-scratch-proof.log`: `refusal_message=yes`, `exit=0`); remaining seed migration keeps only `app_config` (`20260401000003_seed_data.sql`; test `migration-neutralisation.test.ts:60-64`); three others are `select 1;`; no include-seed in any workflow (grep + test `workflows.test.ts:218-223`). Residual IN-01 accepted (AR-06). | closed |
| T-01-15 | Denial of service | Phase 1.1 session's local data destroyed by a reset | mitigate | Proof script `/Users/koss/.clickit-checks/p1-scratch-proof.sh` contains no `supabase` CLI call and no `db reset` (grep rc=1); fixed scratch DB `p1_scratch_safe_ground` (`:6`), read-only `pg_dump --schema-only` of the shared DB (`:29`), before/after fingerprint (`:23-25`, `:72`); log: `after=58\|17\|94`, `shared_db_unchanged=yes`, `scratch_db_left=0`, `exit=0`. | closed |
| T-01-16 | Tampering | later edit of a neutralised file slips through the allow-list | mitigate | Allow-list keyed by status M + from + to blob (`migration-guard.mjs:394-400`), inert once base == `to` (fixture 15 second-edit case, `migration-guard.test.ts:398-412`); regression test compares `git hash-object` to `to` (`migration-neutralisation.test.ts:32-40`), passing today. | closed |
| T-01-17 | Information disclosure | live credentials used in the proof | mitigate | Proof script uses only `docker exec supabase_db_Clickit` (`p1-scratch-proof.sh:5`, all DB calls); grep for `SUPABASE_DB_URL`, project ref `lajguozmtissnnfccmej`, `--linked`, `db push` returns nothing. | closed |
| T-01-18 | Elevation of privilege | admin `gh` token in the work session | mitigate | Read-only check 2026-10-20T13:44Z: rulesets `[]`, environments unchanged (`Preview`, `Production`), repo secret list unchanged — no settings written by the work session. Hand-over states no merge, no settings, no dispatch (`handovers/phase-01-safe-ground.md:5`). | closed |
| T-01-19 | Information disclosure | DB URL or backups leaking via runbook/hand-over/PR (public repo) | mitigate | Secrets set by Koss with interactive `gh secret set … --env …` (`01-CONTROLLER-RUNBOOK.md:73-78`), rule "no secret … into chat, a file, a commit or the PR" (`:11`); `git grep` for credentialed `postgres://user:pass@`, `sb_secret_`, JWTs across tracked files: no secret (one hit is a plan line describing that grep); backups only to `/Users/koss/.clickit-backups/` outside the repo (`:152-166`); no `upload-artifact` in any workflow. | closed |
| T-01-20 | Tampering | ruleset created before checks exist blocks every PR | mitigate → transfer (controller runbook) | Step 1 exact `gh api …/commits/<sha>/check-runs` with expected `["gate",15368,"success"]`, `["migration-guard",15368,"success"]` and stop (`01-CONTROLLER-RUNBOOK.md:23-31`); step 6 "Only after step 1 passed" (`:104`) with readback (`:134-139`); order also at `:16-17`. | closed |
| T-01-21 | Elevation of privilege | `live-db` missing at dispatch | mitigate → transfer (controller runbook) | Step 5 readback is an explicit stop condition: "no squash merge and no dispatch until this passes" (`01-CONTROLLER-RUNBOOK.md:100`); step 8 dispatch comes after (`:168-171`); WR-03 in-code backstop (`apply-live-migrations.yml:139-157`). | closed |
| T-01-22 | Repudiation | approvals and live applies without record | mitigate | Approval only in the Actions UI by Koss (runbook step 9, `:180-182`; recorded by GitHub); dry-run output + `pg_dump_taken` written to `$GITHUB_STEP_SUMMARY` (`apply-live-migrations.yml:101-109`); backups timestamped `live-$TS-*.sql` (`01-CONTROLLER-RUNBOOK.md:159-161`). | closed |
| T-01-23 | Denial of service | heavy gate run colliding with other sessions | mitigate | Heavy lock `/Users/koss/.clickit-heavy.lock` in `p1-gate.sh` and `p1-scratch-proof.sh:4,17-18` (released `:14`); detached logs end with `exit=0` (`p1-gate.log`, `p1-scratch-proof.log`); runbook rule `:12`. | closed |
| T-01-25 | Spoofing | stray nameservers regain delegation before Phase 3 NS work | mitigate | Hand-over recheck 2026-10-20T13:22:50Z (`handovers/phase-01-safe-ground.md:19-23`); re-run by this audit 2026-10-20T13:44:23Z: `dig +norec NS clickitstory.ae @ns1.aedns.ae` → exactly `brett.ns.cloudflare.com.`, `jen.ns.cloudflare.com.`. | closed |
| T-01-26 | Tampering | another PR lands on main before the ruleset/environments exist | mitigate → transfer (controller runbook) | Merge freeze step 0 (`01-CONTROLLER-RUNBOOK.md:19-21`) and hand-over (`handovers/phase-01-safe-ground.md:63-67`); freeze lifts only after step 6 ruleset readback (`:134-139`). | closed |
| T-01-24 | Tampering | PR weakens the guard that judges it | mitigate | `migration-guard` job runs `git show HEAD^1:scripts/migration-guard.mjs` into `$RUNNER_TEMP` (`pr-gate.yml:53-65`), PR copy only when base has none, with `::warning::` (`:59-62`); test `workflows.test.ts:189-199`. Residual WR-01 / IN-05 accepted (AR-01, AR-09). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party / controller runbook)*

Total: 26 threats (T-01-01 … T-01-26). Closed 26, open 0.

---

## Accepted Risks Log

Source for AR-01, AR-03 … AR-09: `.planning/phases/01-safe-ground/01-REVIEW.md` Fix log (scope set by the controller, 2026-10-20) and hand-over "Known limits (accepted, from review)" (`.planning/handovers/phase-01-safe-ground.md:69-81`). These were accepted by the controller; Koss countersigns at Ship.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-04, T-01-24 (WR-01) | A PR can edit `pr-gate.yml` itself (runs from the merge commit), so the base-copy guard only stops edits to `migration-guard.mjs`; the PR-copy fallback reopens after any PR that renames/deletes the guard. Backstop: every PR reviewed before Ship, controller clean-clone check. | Plan residual: Koss (plan gate); widening: controller (review Fix log) | 2026-10-20 |
| AR-02 | T-01-05 | Obfuscated SQL (`'dr'\|\|'op'`, `format()` splits) evades the guard; the guard catches mistakes, the CLI dry-run plus Koss's approval is the gate. | Koss (plan gate; RESEARCH `:503`) | 2026-10-20 |
| AR-03 | T-01-01 (WR-05) | One `-- safe-drop:` waiver covers every destructive statement on its line. | Controller (review Fix log) | 2026-10-20 |
| AR-04 | T-01-08, T-01-05 (WR-06) | Damaging SQL outside drop/truncate/delete (`update` without `where`, `disable row level security`, `rename`, `revoke`, redefining `is_admin()`) passes; dry-run summary shows names, not SQL, to the approver. D-04 scope. | Controller (review Fix log) | 2026-10-20 |
| AR-05 | T-01-08, T-01-09 (WR-07) | `live-db-plan` holds the same full-privilege connection string as `live-db`, reachable without approval by a job running `main`'s code. | Controller (review Fix log) | 2026-10-20 |
| AR-06 | T-01-14 (IN-01) | `seed.sql` refuses only when `public.shows` is non-empty; a remote `supabase db reset --linked` wipes first and would still seed live. | Controller (review Fix log) | 2026-10-20 |
| AR-07 | — (IN-02) | Unit test files are not type-checked. Not a security control; logged for completeness. | Controller (review Fix log) | 2026-10-20 |
| AR-08 | T-01-09 (IN-03) | Dry-run tees all CLI output to the public log/summary; a connection error can print pooler host and role (not the password). | Controller (review Fix log) | 2026-10-20 |
| AR-09 | T-01-02, T-01-24 (IN-04, IN-05) | A migration added in a subfolder passes the name check but is never applied; the guard verdict can be stale if `main` moves (controller clean-clone re-check before Ship covers it). | Controller (review Fix log) | 2026-10-20 |
| AR-10 | T-01-12 | Approval gate is procedural: the same `Loomlyne` account dispatches and approves, `prevent_self_review: false` (Pitfall 10), so GitHub cannot tell an agent from Koss. | Koss (plan gate; RESEARCH Pitfalls 10-11, hand-over `:83-85`) | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

SUMMARY.md `## Threat Flags` (plans 01–04): none raised. Review findings that do not map cleanly to a registered threat ID (warning, not blocking; both already accepted above):

- WR-07 — full-privilege DB credential in an environment with no reviewer (`live-db-plan`). Nearest IDs T-01-08/T-01-09; no register entry covers "credential privilege of the dry-run secret". Logged as AR-05.
- IN-04 — migrations in a subfolder of `supabase/migrations/` are never applied, but pass the guard. Integrity/availability gap, no register entry. Logged in AR-09.

Informational: runbook step 1 heading says `[CONTROLLER after Ship]` and "Needs Koss's Ship" (`01-CONTROLLER-RUNBOOK.md:23-25`), while the execution order (`:16`) lists step 1 before Ship. Either reading keeps step 1 before step 6 and before the squash merge, so T-01-20 is unaffected.

---

## Verification Commands Run (2026-10-20, read-only)

- `node --experimental-strip-types --test tests/unit/migration-guard.test.ts tests/unit/workflows.test.ts tests/unit/migration-neutralisation.test.ts` → 61 tests, 61 pass, 0 fail (Node v26.7.0, jq present so the WR-03 fake-curl test ran).
- `node scripts/migration-guard.mjs --base origin/main --head HEAD` → `5 files checked, 0 violations, 0 warnings`, exit 0.
- `git hash-object` on the five neutralised migrations → all equal the allow-list `to` SHAs.
- `gh api repos/<action>/git/ref/tags/<tag>` (read) → all three pinned SHAs match their tags.
- `gh api repos/Loomlyne/Clickit/rulesets`, `/environments`, `gh secret list` (read) → `[]`; `Preview`, `Production`; `SUPABASE_DB_URL` (repo-level, still present).
- `dig +norec NS clickitstory.ae @ns1.aedns.ae` → `brett`, `jen` only.
- No build, no live DB, no workflow run, no `gh api` write. No implementation file modified.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 26 | 26 | 0 | gsd-security-auditor (Opus 5.5), HEAD 670e0fb |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter (audit verdict, not Ship)
- [ ] Runbook pre-merge block (steps 2, 3, 4, 4b, 5) executed and read back — required before the squash merge (transfer threats T-01-10, T-01-12, T-01-21, T-01-26)

**Approval:** pending — Koss at Ship
