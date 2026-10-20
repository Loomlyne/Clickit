# Phase 1: Safe Ground - Research

**Researched:** 2026-10-20
**Domain:** GitHub Actions CI/CD hardening, GitHub rulesets/environments REST API, Supabase CLI migration safety, destructive-SQL static guard (Node), seed relocation
**Confidence:** HIGH (CLI behaviour read from the installed 2.119.0 binary; GitHub API shapes from official docs; two items MEDIUM/ASSUMED, listed in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live migration path (SAFE-02)**
- **D-01:** Remove the `push: main` trigger and the auto `db push` from `.github/workflows/supabase-migrations.yml`. Replace with a hand-started (`workflow_dispatch`, `main` only) "Apply live migrations" workflow: job 1 runs `supabase db push --dry-run` against live and prints the pending list; job 2 `needs` job 1, runs in GitHub environment `live-db` (Koss = required reviewer) and only then applies. No `--include-all` on the apply: an out-of-order pending version must fail and come back to a human.
- **D-02:** The `live-db` environment (required reviewer Koss, deployment branch `main` only) is created by the controller with `gh api` after the plan is signed. The plan gives the exact command; this session does not run it.
- **D-03:** Before every live apply, the controller takes a local `pg_dump` on the Mac (never a CI artifact: the repo is public). Audit shows no backups and PITR off.

**Destructive-SQL guard (SAFE-02)**
- **D-04:** Check `migration-guard` fails when an added or changed file under `supabase/migrations/` contains `drop`, `truncate` or `delete` (case-insensitive, SQL comments stripped) on a line that does not carry `-- safe-drop: <reason>`.
- **D-05:** It also fails when a migration file that exists on the base branch is modified, renamed or deleted. Exception: the exact Phase 1 neutralisation list (D-09, D-10) is allowed once, keyed by file path in the guard's allow-list for this PR's base only (or by a marker the planner chooses), so later edits to those files fail again.
- **D-06:** Guard is a Node script in the repo (no new dependency), run locally and in CI, proven by a fixture test under `tests/` (clean migration passes; drop without waiver fails; drop with waiver passes; edit/rename of an applied file fails). The workflow is never run on GitHub to test it.

**PR CI (SAFE-03)**
- **D-07:** New workflow on `pull_request` (opened, synchronize, reopened) to `main`: Linux only (`ubuntu-latest`), `concurrency` per PR with `cancel-in-progress: true`, `timeout-minutes` on every job, `paths-ignore` for `**.md`, `docs/**`, `.planning/**`. Jobs named exactly `gate` and `migration-guard`. `gate` runs `npm ci`, lint, typecheck (`tsc --noEmit`), unit tests, `next build` with placeholder public env (see CLAUDE.local.md gate facts). It calls the steps, not `npm run gate:local` (Phase 2's branch adds Mac-only `cf:build` to `gate:local`). Actions pinned to SHAs, `permissions: contents: read`, no secrets. Note: `paths-ignore` on a required check leaves docs-only PRs "expected"; the planner handles this (e.g. guard job always runs and is cheap, or a no-op pass).
- **D-08 (ruleset):** Ruleset on `main` requiring checks `gate` and `migration-guard`, admin bypass kept. Plan carries the exact `gh api repos/Loomlyne/Clickit/rulesets` command; the controller runs it after signing.
- `npm run gate:local` stays the local gate; add a `typecheck` script and include it.

**Seed and destructive migrations (SAFE-01)**
- **D-09:** `20260401000000_create_schema.sql`: DROP block becomes a no-op in place (comment out / remove the drop statements, keep file name and version, header note why). Fresh databases are unaffected (all were `if exists`).
- **D-10:** Fake data moves to `supabase/seed.sql` (local `db reset` only): shows/seasons/episodes from `20260401000003_seed_data.sql`, `20260425000001_seed_example_shorts.sql`, `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql`. Those migration bodies become no-ops, except the `app_config` row insert, which stays in `20260401000003` as insert-if-missing (`on conflict (id) do nothing`). `20260605000003_seed_legal_and_faqs.sql` (real copy) untouched. `20260418000000_expand_app_config.sql` (flagged in PITFALLS) checked: no inserts, only an `update storage.buckets`; untouched.
- **D-11:** Prove on the local stack `supabase_db_Clickit` (port 55322, already running; never a second stack): `supabase db reset` applies all migrations + seed.sql cleanly, and the app's tables/`app_config` row exist. Live history is unaffected (files keep versions; live already has all 58).

### Claude's Discretion
- Guard regex details, comment stripping, script language (Node `.mjs` to match `scripts/`).
- Workflow file names; whether the old `supabase-migrations.yml` is rewritten in place or replaced.
- How docs-only PRs satisfy required checks.

### Deferred Ideas (OUT OF SCOPE)
- Remove the 3 picsum posters on live (live write) — Phase 7/8 placeholder purge.
- Move the inline admin check in storage policy `Admin manage site-assets` to `private.is_admin()` — with Phase 5's `admins` table.
- Nightly read-only drift check (live `schema_migrations` vs files) as an automation agent — proposal only.
- Jev risk score on migration diffs (allow/confirm/block) beside the guard — proposal only.
- Delete unused GitHub environments `Preview`/`Production` (Vercel leftovers) — Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | A pushed migration can never re-run the destructive first migration or seed fake data on the live database | Section "Seed relocation" (what stays, what moves, broadcast_day array fix, seed self-guard, config.toml `enabled = true`); "Supabase CLI facts" (push compares versions only, never seeds without `--include-seed`); neutralisation allow-list by git blob SHA |
| SAFE-02 | Live migrations run only after Koss approves a dry-run in CI; any new `drop`/`truncate`/`delete` fails CI | "Apply workflow" (two jobs, `live-db` environment, exact `gh api` commands); "Guard design" (tokenizer, regex set, fixtures) |
| SAFE-03 | Every PR runs lint, typecheck, unit tests, production build; red check blocks merge | "PR gate workflow", "Docs-only PRs and required checks", "Ruleset command"; baseline measured: tsc 7.6 s exit 0, lint 0 errors (15 warnings), 83 unit tests pass |
| SAFE-04 | Read-only live audit recorded | Already done: `01-LIVE-AUDIT.md` (referenced only) |
| SAFE-05 | Stray Cloudflare NS (ignat/nataly) resolved | Already done: `01-LIVE-AUDIT.md` section 6 (referenced only) |
</phase_requirements>

## Project Constraints (from CLAUDE.md and CLAUDE.local.md)

- GSD workflow only for file changes; this phase is run through `/gsd-plan-phase` then `/gsd-execute-phase`. Work only in the worktree `phase-01-safe-ground-dc6bbe` on branch `claude/phase-01-safe-ground-dc6bbe`; never commit or push `main`, never deploy.
- Data safety: never wipe live Supabase (`lajguozmtissnnfccmej`); live DB writes, DNS, secrets, emails to real people are owner-gated, one numbered step each. The apply workflow, the ruleset and the environments are controller/owner steps after the plan is signed.
- No Vercel anything; Cloudflare only in the ClickitStory account (not relevant to this phase's files; do not touch `workers/`, wrangler/open-next config, `next.config`, auth/upload code).
- CI rule: Linux only, `concurrency` cancel-in-progress, `timeout-minutes`. D-07 overrides "once on PR open" for this repo only because it is public.
- Heavy steps (`npm run build`, `gate:local`, Playwright) take the lock `/Users/koss/.clickit-heavy.lock`, run detached with an `exit=` log line outside `/tmp`. One local Supabase stack only (`supabase_db_Clickit`).
- Clean-clone build needs placeholder public env (see Standard Stack).
- Commits conventional, end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; merge the base branch in before hand-over (base wins).
- Secrets stay in Koss's terminal. Never type a DB URL into chat or a file.
- Reviews: Grok via subscription only; fallback the local `reviewer` agent, said on the PR. No Codex/CodeRabbit/Cursor/API-key reviewers and never an AI reviewer as a GitHub Action.

## Summary

The existing risk is real but the primary defence is small: the Supabase CLI decides what is pending by comparing **versions only** (sorted merge of remote versions against local file versions). Without `--include-all`, an out-of-order local file makes `db push` (and `db push --dry-run`) exit with an error instead of applying anything; with `--include-all` it applies it. So removing `--include-all` and the auto `push: main` trigger (D-01) is the main fix; neutralising the DROP block and seeds (D-09/D-10) and the guard (D-04/D-05) are belt and braces. `db push` never runs seeds unless `--include-seed` is passed. This was read from the installed CLI 2.119.0 binary and matches the official flag descriptions.

Four findings change how the plan must be written. (1) `supabase/config.toml` has `[db.seed] enabled = false` today: `db reset` will NOT load `seed.sql` until it is set to `true`. (2) The seed cannot be moved verbatim: `shows.broadcast_day` became `text[]` in `20260810120000`, so the relocated INSERTs must write `'{Sunday}'`-style array literals (verified in a scratch database: 15 shows, 21 seasons, 94 episodes, 6 shorts, 45 cast rows insert cleanly). (3) A `paths-ignore` workflow leaves required checks "Pending" and blocks docs-only PRs (GitHub docs): use no workflow-level filter, a first step in `gate` that classifies the diff, and step-level `if`s so the job always reports its true result. (4) The `gh` token on this Mac is Koss's own admin account, so the `live-db` approval is a procedural gate for agents (an agent could technically approve with that token); the controller must never approve its own dry-run.

A guard prototype (tokenizer that strips comments but keeps string and `$$` bodies, 4 regexes, same-line `-- safe-drop: <reason>` waiver) passed 33 edge-case fixtures and, run over the 58 existing migrations, flagged 38 findings in 12 files, all genuine (`drop policy/trigger/view/constraint/column`, and two real `delete from` statements in `20260530000000_reviews_unique_user_show.sql`), with zero false positives on `on delete cascade`, `for delete` policies, `deleted_at`, `drop_cover_url`, `date_trunc`.

**Primary recommendation:** Rewrite `supabase-migrations.yml` as a two-job `workflow_dispatch` workflow using two main-only environments (`live-db-plan`, `live-db`) holding the DB URL as environment secrets; add a no-filter `pull_request` workflow whose `gate` and `migration-guard` jobs always run; implement the guard as `scripts/migration-guard.mjs` with a blob-SHA allow-list for the five Phase 1 edits; move seed data to `supabase/seed.sql` (array-literal fix plus self-guard) and flip `[db.seed] enabled = true`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Block destructive SQL / edits of applied migrations | Repo script (`scripts/migration-guard.mjs`) run by CI | Local (`npm run guard:migrations`) | Deterministic static check on the diff; same code locally and in CI |
| Required-check enforcement on `main` | GitHub platform (ruleset) | — | Only the platform can block merges; created by controller via REST |
| Human approval before live apply | GitHub platform (environment `live-db` required reviewer) | Controller procedure (pg_dump first, D-03) | Platform gates secrets and the job; procedure covers backup |
| Dry-run of pending live migrations | CI runner (Supabase CLI, read-only connection) | Live Postgres (reads `supabase_migrations.schema_migrations`) | Prints what would apply; no writes |
| Live apply | CI runner after approval | Live Postgres | Only job with `live-db` secrets, `main` only |
| Seed data (fake shows) | Local DB (`supabase/seed.sql`, `db reset` only) | — | Never reachable from `db push` without an explicit flag |
| Lint/typecheck/unit/build gate | CI runner | Local (`gate:local`) | Ephemeral, no secrets, placeholder public env |
| Docs-only PR handling | CI job logic (diff classification inside `gate`) | — | Keeps the required check reporting |

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `actions/checkout` | v4.2.2 `11bd71901bbe5b1630ceea73d27597364c9af683` (already pinned in repo; latest is v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`) | Checkout | Reuse the known pin (CONTEXT: reuse pins); bump is optional and deliberate [VERIFIED: gh api repos/actions/checkout tags, 2026-10-20] |
| `actions/setup-node` | v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1` (published 2026-10-08; v6.5.0 `249970729cb0ef3589644e2896645e5dc5ba9c38` if a seasoned release is preferred) | Pin Node in `gate` and `migration-guard` | Official action; no `cache:` input (see pitfalls) [VERIFIED: gh api repos/actions/setup-node] |
| `supabase/setup-cli` | v3.0.1 `45a513f8c64c0bc8e0e3dfe572b5c95be85f6359` (current pin v1.4.0 `fe52e8551e5e65c2c6a20121b1c0998d6c5e3e1f` is also valid) | Install Supabase CLI in the apply workflow | Official action; `version:` accepts an exact version [CITED: github.com/supabase/setup-cli README] |
| Supabase CLI | pin **2.119.0** (current workflow pin 2.102.0; lockfile devDependency 2.107.0; latest 2.121.0) | `db push --dry-run` / `db push` | 2.119.0 is the version whose behaviour was read in this research; Linux amd64 tarball exists for it [VERIFIED: gh api repos/supabase/cli/releases/tags/v2.119.0] |
| Node | `24` in CI (Next 16.2.9 needs >=20.9; unit tests use `--experimental-strip-types`, which needs >=22.6) | Runtime for gate and guard | LTS line; local Mac runs 26.7.0, so Node 24 is first proven by the first CI run (see Assumptions A3) |
| Node core only | — | Guard script and fixture test (`node:fs`, `node:child_process`, `node:test`) | D-06: no new dependency |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `actionlint` | 1.7.12 (brew bottle exists; GitHub repo rhysd/actionlint, 4.3k stars) | Workflow lint | Optional validation; not installed today. `brew install actionlint` is Koss's call; fallback below [VERIFIED: brew info, gh api] |
| Ruby `YAML.load_file` | system ruby | Syntax-only YAML parse fallback | When actionlint is absent (note: YAML 1.1 reads `on:` as key `true`) [VERIFIED: ran locally] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| No-filter workflow + in-job diff classification | `paths-ignore` + a mirror "no-op" workflow with same job names | Two workflows to keep in sync; GitHub docs warn path-filtered required workflows stay Pending |
| Two environments (`live-db-plan`, `live-db`) | Repo-level secret for the dry-run job | Repo secret is readable by any workflow on any branch in the repo (collaborator `clickitstory` has push access); environment secrets limited to `main` |
| `dorny/paths-filter` | `git diff` in a shell step | User preference: no new third-party action |

**Installation:** none (no npm packages are added by this phase).

**Version verification:**
```bash
gh api repos/supabase/cli/releases/latest --jq .tag_name     # v2.121.0 (2026-10-14)
gh api repos/actions/setup-node/releases/latest --jq .tag_name   # v7.1.0
gh api apps/github-actions --jq .id                          # 15368
```

## Package Legitimacy Audit

No npm/PyPI/crates packages are installed by this phase (guard and tests use Node core). GitHub Actions used are all already trusted or official and pinned by full SHA:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| actions/checkout | GitHub Actions | years | n/a | github.com/actions/checkout | n/a (not a package registry) | Approved, SHA resolved via GitHub API |
| actions/setup-node | GitHub Actions | years | n/a | github.com/actions/setup-node | n/a | Approved, SHA resolved via GitHub API |
| supabase/setup-cli | GitHub Actions | years | n/a | github.com/supabase/setup-cli | n/a | Approved (already used in repo) |
| actionlint (optional local tool) | Homebrew / Docker Hub | 5 yrs | n/a | github.com/rhysd/actionlint | n/a | Optional; image/formula name from search + `brew info`, tag `[ASSUMED]` for the Docker image |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was not run: no external language packages are recommended.*

## Architecture Patterns

### System Architecture Diagram

```
PR opened/synced (to main) ----> workflow "PR gate" (pull_request, no path filter, contents:read, no secrets)
                                   |
                                   +--> job migration-guard (always, ~1 min)
                                   |      checkout depth 2 -> node scripts/migration-guard.mjs --base HEAD^1 --head HEAD
                                   |      git diff --name-status -z --find-renames HEAD^1...HEAD -- supabase/migrations
                                   |        A/M/R/D/T per file
                                   |        base file changed/renamed/deleted?  -> fail (unless blob-SHA allow-list entry)
                                   |        added/changed .sql -> tokenize (strip comments, keep strings+$$) -> 4 regexes
                                   |        match on a line without "-- safe-drop: <reason>" -> fail
                                   |
                                   +--> job gate (always starts, reports true result)
                                          step 1: classify diff (docs-only? .md, docs/, .planning/)
                                          if code changed: setup-node 24 -> npm ci -> lint -> tsc --noEmit -> test:unit -> next build (placeholder env)
                                          if docs-only: heavy steps skipped, job still succeeds
                                   |
Ruleset on main requires "gate" + "migration-guard" (source: GitHub Actions app 15368); repo-admin bypass always
                                   |
                              squash merge by Koss's Ship  (controller may push history commits via bypass)

Koss/controller: Actions tab -> "Apply live migrations" (workflow_dispatch, ref main)
   job dry-run  (environment live-db-plan: main only, no reviewer, secret SUPABASE_DB_URL)
       supabase db push --dry-run --db-url ... -> stderr "Would push these migrations:" list -> job summary
       error if a local file sorts before the last remote version (no --include-all) or a remote version is missing locally
   job apply (needs dry-run; if pending; environment live-db: main only, required reviewer Koss, secret SUPABASE_DB_URL)
       PAUSES until Koss approves in the Actions UI -> supabase db push --db-url ... --yes   (no --include-all, no --include-seed)
   Before dispatch: controller pg_dump on the Mac (D-03)

Local only: supabase db reset --local -> all migrations (neutralised) -> seed.sql (array-literal fix, refuses to run if shows not empty)
```

### Recommended Project Structure
```
.github/workflows/
├── pr-gate.yml                    # NEW: jobs gate + migration-guard
└── apply-live-migrations.yml      # REPLACES supabase-migrations.yml (git mv, rewrite)
scripts/
└── migration-guard.mjs            # NEW: CLI + exported pure functions
supabase/
├── seed.sql                       # NEW: relocated fake data (local only)
└── config.toml                    # [db.seed] enabled = true
tests/unit/
├── migration-guard.test.ts        # NEW: scanner + git fixture tests
└── workflows.test.ts              # NEW (recommended): text assertions on the two workflow files
package.json                       # + typecheck, + guard:migrations, gate:local includes typecheck
```

### Pattern 1: Docs-only PRs without breaking required checks
**What:** No `paths`/`paths-ignore` at workflow level. `gate` always starts, step 1 classifies the diff, later steps carry `if: steps.scope.outputs.code == 'true'`.
**When to use:** Any job that is a required check.
**Why not a separate `changes` job + job-level `if`:** a job skipped by `if` reports Success (GitHub docs), but a job skipped because its `needs:` job failed also shows as skipped/success. Keeping the logic inside one job means a failing classifier fails `gate` itself.
**Example:**
```yaml
# Source: GitHub docs "Troubleshooting required status checks" (paths-filtered required workflows stay Pending;
# a job skipped by a conditional reports Success); pull_request merge-commit semantics from
# docs.github.com events-that-trigger-workflows#pull_request
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
    with:
      fetch-depth: 2            # merge commit + both parents -> HEAD^1 is the base tip
      persist-credentials: false
  - name: Classify change set
    id: scope
    run: |
      if [ -n "$(git diff --name-only HEAD^1 HEAD | grep -Ev '(\.md$|^docs/|^\.planning/)')" ]; then
        echo "code=true" >> "$GITHUB_OUTPUT"
      else
        echo "code=false" >> "$GITHUB_OUTPUT"
        echo "Docs-only change: heavy steps skipped."
      fi
  - if: steps.scope.outputs.code == 'true'
    uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
    with:
      node-version: '24'
  - if: steps.scope.outputs.code == 'true'
    run: npm ci
  # ... lint, typecheck, test:unit, build all with the same if
```
`.github/**`, `supabase/**`, `scripts/**`, `package*.json` all count as code (they do not match the docs pattern).

### Pattern 2: Two-job apply with a human approval
**What:** `workflow_dispatch` only; job `dry-run` (environment `live-db-plan`), job `apply` (`needs: dry-run`, environment `live-db`).
**Example:**
```yaml
# apply-live-migrations.yml (full file shape; replaces supabase-migrations.yml)
name: Apply live migrations
on:
  workflow_dispatch: {}
permissions:
  contents: read
concurrency:
  group: live-migrations
  cancel-in-progress: false
jobs:
  dry-run:
    name: dry-run
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: live-db-plan
    outputs:
      pending: ${{ steps.plan.outputs.pending }}
    steps:
      - name: main only
        run: |
          if [ "$GITHUB_REF" != "refs/heads/main" ]; then echo "::error::Run this workflow from main only"; exit 1; fi
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: supabase/setup-cli@45a513f8c64c0bc8e0e3dfe572b5c95be85f6359 # v3.0.1
        with:
          version: 2.119.0
      - name: Dry run against live (read-only)
        id: plan
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          set -o pipefail
          supabase db push --dry-run --db-url "$SUPABASE_DB_URL" 2>&1 | tee dry-run.txt
          { echo '### Pending live migrations (dry run, nothing applied)'; echo '```'; cat dry-run.txt; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
          if grep -q 'Remote database is up to date' dry-run.txt; then echo "pending=false" >> "$GITHUB_OUTPUT"; else echo "pending=true" >> "$GITHUB_OUTPUT"; fi
  apply:
    name: apply
    needs: dry-run
    if: needs.dry-run.outputs.pending == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: live-db
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: supabase/setup-cli@45a513f8c64c0bc8e0e3dfe572b5c95be85f6359 # v3.0.1
        with:
          version: 2.119.0
      - name: Apply (no --include-all, no --include-seed)
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: supabase db push --db-url "$SUPABASE_DB_URL" --yes
```
Notes: both jobs check out `github.sha` of the dispatched `main`, so the file set the reviewer saw is the file set applied; if the remote changed in between, `db push` only applies what is still pending from the same files. No debug flag (`--debug` could print connection details). Optional extra (Claude's discretion): a `workflow_dispatch` boolean input `backup_taken` that the dry-run job requires to be `true`, enforcing D-03 in the UI.

### Anti-Patterns to Avoid
- **`paths-ignore` on a required workflow:** blocks docs-only PRs (Pending forever).
- **`--include-all` anywhere in apply:** turns an out-of-order file into a silent apply; D-01 forbids it.
- **`pull_request_target` or secrets in the PR workflow:** PR code would run with secrets. The PR workflow has `contents: read` and no `secrets.*`.
- **Putting the DB URL in a repo-level secret and also giving PR workflows access:** same-repo PR branches can read repo secrets.
- **npm cache in the gate (`cache: npm`):** setup-node v7 docs added cache-poisoning guidance; install takes about a minute on a free public-repo runner, so skip the cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration pending/ordering logic | A custom "which migrations are pending" script | `supabase db push --dry-run` | CLI already compares versions and errors on out-of-order |
| Docs-only detection | A third-party paths-filter action | `git diff --name-only HEAD^1 HEAD` in a step | User prefers no new action; 3 lines |
| Parsing `git diff` output | Splitting on spaces/newlines | `git diff --name-status -z` | Paths with spaces/renames (`R100\0old\0new\0`) parse safely |
| Fixture repos | Hand-crafted `.git` dirs | `git init` in `os.tmpdir()` with env `GIT_AUTHOR_*`/`GIT_COMMITTER_*` | Real git semantics (renames, blobs) |
| Approval gate | A custom "type CONFIRM" step as the only gate | Environment required reviewer | Platform-enforced and gates secret access |

**Key insight:** the guard is a safety net for human error, not a security boundary: a PR can edit the guard itself (see Pitfall 9). Do not over-invest in obfuscation cases (`'dr'||'op'`).

## Runtime State Inventory

> This is a migration-content change (edit applied files, relocate seeds), not a rename. Inventory of state that outlives the file edits:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live `supabase_migrations.schema_migrations`: 58 versions, names match the 58 files (`01-LIVE-AUDIT.md` section 1). `db push` compares versions only (read from CLI 2.119.0), so editing file bodies does not change what is pending. The `statements` column on live keeps the old text; harmless. | None (code edit only, no data migration) |
| Live service config | GitHub: no rulesets today (`gh api .../rulesets` = `[]`); environments `Preview` and `Production` exist with no rules (Vercel leftovers, deferred to Phase 8); repo secret `SUPABASE_DB_URL` exists (name confirmed via API); a stale "App Quality" workflow registration exists with no file on `main` (harmless) | Create `live-db-plan`, `live-db`, ruleset (owner/controller steps); move secret to both environments; delete repo-level secret after first good dry-run |
| OS-registered state | None: no cron/launchd/pm2 involved. Local Supabase stack `supabase_db_Clickit` (port 55322) holds 17 shows, 94 episodes, 58 migrations from the old seed chain | `db reset` replaces it (D-11); take a local `pg_dump` first because other sessions may use that data |
| Secrets/env vars | `SUPABASE_DB_URL` (Session-pooler URL, repo secret). New environment secrets with the same name keep the workflow text unchanged. Local `.env*` untouched | Koss sets env secrets from his terminal (`gh secret set SUPABASE_DB_URL --env <name>` prompts for the value); never in chat |
| Build artifacts / installed packages | `.next` and `next-env.d.ts` absent in this worktree (gitignored); tsc passes without them. No egg-info or global installs involved | None |

## Common Pitfalls

### Pitfall 1: `[db.seed] enabled = false` makes the relocated seed dead
**What goes wrong:** `supabase db reset` finishes green but `seed.sql` never loads, so D-11's "tables exist" passes while the dev DB is empty.
**Why:** `supabase/config.toml` line 69 has `enabled = false` (the CLI default is true). [VERIFIED: repo file; CLI source shows `db.seed.enabled` read from config with default true]
**How to avoid:** set `enabled = true` in the same task that creates `seed.sql`; verify with row counts after reset (shows 15, seasons 21, episodes 94, shorts 6, show_cast 45).
**Warning signs:** `Seeding data from supabase/seed.sql...` line missing in reset output.

### Pitfall 2: Seed moved verbatim fails on `broadcast_day`
**What goes wrong:** Relocated `INSERT INTO public.shows (... broadcast_day ...) VALUES (..., 'Sunday', ...)` errors (`malformed array literal`) because `20260810120000_broadcast_day_array.sql` changed the column to `text[]` and seed.sql runs after all migrations.
**How to avoid:** write array literals: `'{Sunday}'`. Fourteen of 15 shows carry a day; Poets Platform has NULL. `Break Fast Daily` is `'Mon-Fri'`: use `'{Monday,Tuesday,Wednesday,Thursday,Friday}'` (the column comment says weekday names; see Open Question 3). Verified in a scratch DB (created and dropped; shared stack untouched): with the array fix the four seed bodies insert 15 shows, 21 seasons, 94 episodes, 6 shorts, 45 cast rows and the image UPDATE touches 45 rows.

### Pitfall 3: Seed run against a real database
**What goes wrong:** `supabase db push --include-seed` (or `db reset --linked`/`--db-url`, which exist in 2.119.0) with `enabled = true` would insert fake shorts (no unique key, so duplicates) into a populated DB.
**How to avoid:** first statement of `seed.sql` raises if `public.shows` is not empty. Neither workflow passes `--include-seed`. Never run `db reset --linked`/`--db-url`; plan tasks must use `--local` explicitly.

### Pitfall 4: Out-of-order and missing-version errors are the intended behaviour
**What goes wrong:** Someone "fixes" a red dry-run by adding `--include-all`.
**Facts (CLI 2.119.0):** local file sorting before the last remote version and not on remote: error `Found local migration files to be inserted before the last migration on remote database.` with suggestion `Rerun the command with --include-all flag to apply these migrations:` plus the list. Remote version with no local file: error `Remote migration versions not found in local migrations directory.` Both checks run before the dry-run branch, so `--dry-run` fails the same way. Resolution is always a human decision (rename the new file to a later timestamp, or `migration repair` by the controller).

### Pitfall 5: First CI run of the new workflows is the only proof of Node 24, setup-cli v3 and CLI 2.119.0
**What goes wrong:** D-06 forbids running workflows on GitHub to test the guard; the Supabase part of the apply workflow cannot be exercised before merge anyway (workflow_dispatch needs the file on `main`).
**How to avoid:** the first dispatch after merge is a read-only dry-run (job 1) before any approval; if install or flags fail it fails before anything touches data. Tests prove the guard and the workflow text locally; PR gate proves itself on the Phase 1 PR.

### Pitfall 6: `main` moved while Phase 1 was discussed
`origin/main` is `f217d9c` (PR #19 media worker); this branch's merge base is `cfbc8fb`. #19 changed `package.json` (adds `media:health` on the line after `gate:local`), adds `workers/` and `tests/unit/media-worker.test.ts`. Merge `origin/main` into the branch before editing `package.json`; expect a trivial conflict at the scripts block (base wins, re-add `typecheck`, `guard:migrations`). Blob SHAs for the five neutralised files are unchanged between `main` and this branch.

### Pitfall 7: Required checks added before the workflow has produced them
The ruleset accepts any context string, but a check that never reports blocks every PR. Create the ruleset only after the Phase 1 PR has shown check runs named exactly `gate` and `migration-guard` (`gh api repos/Loomlyne/Clickit/commits/<sha>/check-runs --jq '.check_runs[]|[.name,.app.id,.conclusion]'`). Set `name:` on each job equal to its id so the context cannot drift.

### Pitfall 8: Squash commit touches `supabase/migrations/**` and the old workflow still has `push: main`
GitHub runs the workflow file from the pushed commit. The Phase 1 squash contains the new workflow (no `push` trigger), so the old auto-apply does not fire. Keep the workflow rewrite and the migration edits in the same PR. Even if it did fire, live has all 58 versions and nothing is pending.

### Pitfall 9: The guard can be weakened by the PR that is being guarded
`pull_request` runs the PR's own copy of `scripts/migration-guard.mjs` and the workflow. Accepted limitation (solo owner plus controller, all PRs reviewed before Ship). Cheap hardening if wanted later: run the guard from the base checkout (`git show HEAD^1:scripts/migration-guard.mjs`), or add CODEOWNERS. Not required for this phase; state it in the hand-over.

### Pitfall 10: Self-review deadlock on the `live-db` environment
With Koss as the only reviewer and also the person who dispatches the run, `prevent_self_review: true` would block his own approval. Set `prevent_self_review: false` explicitly. [CITED: docs.github.com REST environments]

### Pitfall 11: An agent can approve its own gate
The `gh` login on this Mac is `Loomlyne` with admin. Environment approval via API (`POST .../pending_deployments`) works with that token. Procedure: the controller dispatches and reads the dry-run summary; Koss clicks approve in the Actions UI (or his own terminal). An agent must never approve.

## Code Examples

### Ruleset on `main` (controller runs after signing and after Pitfall 7 check)
```bash
# Source: docs.github.com/en/rest/repos/rules#create-a-repository-ruleset
# actor_id 5 = repository role "admin" (terraform-provider-github docs: maintain=2, write=4, admin=5)
# integration_id 15368 = GitHub Actions app (gh api apps/github-actions --jq .id)
gh api --method POST repos/Loomlyne/Clickit/rulesets --input - <<'JSON'
{
  "name": "main: required checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "gate", "integration_id": 15368 },
          { "context": "migration-guard", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
# Read back and confirm in the UI (Settings > Rules > Rulesets): bypass list must read "Repository admin"
gh api repos/Loomlyne/Clickit/rulesets --jq '.[]|{id,name,enforcement}'
gh api repos/Loomlyne/Clickit/rulesets/<ID>
# Rollback: gh api --method DELETE repos/Loomlyne/Clickit/rulesets/<ID>
```
Decisions:
- `integration_id` is optional (`context` required); include 15368 so a commit status named `gate` from another token cannot satisfy it. [CITED: docs.github.com + terraform provider docs: "GitHub App ID"; "you can select an app as the expected source"]
- `strict_required_status_checks_policy: false`: with several phase PRs open in parallel, "branch must be up to date" would force constant rebases; the controller squash-merges and re-checks anyway.
- **Do not add a `pull_request` rule.** Admin bypass is `always` (controller must push history commits), so the rule would be cosmetic for the owner; reviews happen via Grok/`reviewer` outside GitHub. With only `required_status_checks`, non-admin writers (collaborator `clickitstory`) cannot update `main` unless checks pass on another ref [ASSUMED, A2 — GitHub UI wording]. Optional extras for Koss's signature (beyond the literal D-08): `{"type":"non_fast_forward"}` and `{"type":"deletion"}` (no force-push or delete of `main` by non-admins).
- Rulesets work on this public personal-account repo: the list endpoint returned `[]`, not a plan error [VERIFIED].

### Environments `live-db-plan` and `live-db` (controller runs after signing)
```bash
# Source: docs.github.com/en/rest/deployments/environments, .../branch-policies
gh api users/Loomlyne --jq '.id'          # 223640340 (read 2026-10-20); confirm this is Koss's approving account

# 1) Read-only planning environment: no reviewer, main only
gh api --method PUT repos/Loomlyne/Clickit/environments/live-db-plan --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api --method POST repos/Loomlyne/Clickit/environments/live-db-plan/deployment-branch-policies -f name=main -f type=branch

# 2) Apply environment: required reviewer Koss, no self-review block, main only
gh api --method PUT repos/Loomlyne/Clickit/environments/live-db --input - <<'JSON'
{
  "prevent_self_review": false,
  "reviewers": [ { "type": "User", "id": 223640340 } ],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
gh api --method POST repos/Loomlyne/Clickit/environments/live-db/deployment-branch-policies -f name=main -f type=branch

# 3) Secrets: Koss in his own terminal (prompts for the value; nothing in chat or files), once per environment
gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db-plan
gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db

# 4) Read back
gh api repos/Loomlyne/Clickit/environments/live-db --jq '{name,reviewers:[.protection_rules[]|select(.type=="required_reviewers")|.reviewers[].reviewer.login],bp:.deployment_branch_policy}'
gh api repos/Loomlyne/Clickit/environments/live-db/deployment-branch-policies --jq '.branch_policies[]|[.name,.type]'

# 5) After the first good dry-run on main: delete the repo-level secret (owner step)
gh secret delete SUPABASE_DB_URL --repo Loomlyne/Clickit
```
Notes: `deployment_branch_policy.protected_branches` and `custom_branch_policies` must be opposites (else 422); the branch-policy POST returns 404 unless `custom_branch_policies` is true (create the environment first). Required reviewers (up to 6) and environment secrets are available on public repos on all current plans; private repos need Pro/Team [CITED: docs.github.com]. A job that references an environment with required reviewers cannot read its secrets until a reviewer approves [CITED: docs.github.com deployments-and-environments]. Environments (`live-db-plan`) naming is the planner's choice; `live-db` is fixed by D-01.

### Supabase CLI facts used above (read from the installed 2.119.0 binary, 2026-10-20)
```text
db push --dry-run prints (stderr):
  DRY RUN: migrations will *not* be pushed to the database.
  Connecting to remote database...
  Would push these migrations:
   • 20260901000000_example.sql
or, with nothing pending (stdout):  Remote database is up to date.
no --include-all + out-of-order file:  Found local migration files to be inserted before the last migration on remote database.
remote version missing locally:        Remote migration versions not found in local migrations directory.
seed files: only when --include-seed is passed (and [db.seed] enabled = true); default off
pending detection: sorted merge of remote versions vs local file versions only (file content is not compared)
```
`supabase db push --help` (2.119.0) lists `--include-all`, `--include-seed`, `--dry-run`, `--db-url` (percent-encoded), `--skip-vault`; global `--yes` answers prompts. [CITED: supabase.com/docs/reference/cli/supabase-db-push flag descriptions; behaviour VERIFIED in binary]. Use the Session-pooler URL (existing secret note): GitHub runners have no IPv6 for the direct host [ASSUMED, matches the old workflow comment]. `config.toml` has no `[db.vault]` block (commented out), so vault update is a no-op.

### Guard design (`scripts/migration-guard.mjs`)

**CLI:** `node scripts/migration-guard.mjs [--base <rev>] [--head <rev>] [--dir supabase/migrations]`. Defaults `--base origin/main --head HEAD`. CI passes `--base HEAD^1 --head HEAD` (merge-commit checkout, `fetch-depth: 2`). Exit 1 on any violation; print `path:line: reason`; when `GITHUB_ACTIONS` is set also print `::error file=...,line=...::reason`. Export pure functions for the test: `scanSql(sql)`, `classifyChanges(nameStatusZ)`, `runGuard({cwd, base, head})`. Local run needs committed changes (optional: `--head WORKTREE` reads files from disk and adds `git ls-files --others --exclude-standard`).

**Changed-file discovery:**
```js
// git diff --name-status -z --find-renames <base>...<head> -- supabase/migrations
// -z output: STATUS\0path\0   and for renames/copies  R100\0old\0new\0
// statuses to handle: A (scan), M (applied-file edit rule + scan), D, R*, C*, T, U (all fail unless allow-listed)
```
Three-dot is correct in both contexts: in CI `HEAD^1` is an ancestor of the merge `HEAD` so the merge base is `HEAD^1`; locally it is `merge-base(origin/main, HEAD)`. Merge conflicts mean GitHub creates no merge commit and the workflow does not run (checks stay Pending: acceptable, the PR cannot merge anyway).

**Rules, in order:**
1. Name check (cheap): every added file under the directory must match `^\d{14}_[a-z0-9_]+\.sql$` (CLI regex is `^([0-9]+)_(.*)\.sql$`; a misnamed file is silently never applied). Non-`.sql` additions fail.
2. Applied-file rule (D-05): any path with status M/D/R/C/T/U whose old path exists on base fails, unless the allow-list matches (below). Rename detection can degrade to D plus A when content changed; both fail.
3. Destructive-SQL rule (D-04): for every A and M `.sql` file, read the head blob (`git show <head>:<path>`), tokenize, run the four regexes, fail each match whose line has no waiver.
4. Warning only (recommended, not failing): added version <= highest base version prints `::warning::` because the apply workflow will refuse it later.

**Allow-list for the five Phase 1 edits (self-expiring, keyed by git blob SHA):**
```js
// path -> { from: blob SHA on the base main (before Phase 1), to: blob SHA of the neutralised file }
const PHASE1_NEUTRALISATION = {
  'supabase/migrations/20260401000000_create_schema.sql':      { from: '6155411336273554b90dc4ac784a011520815879', to: '<fill after edit>' },
  'supabase/migrations/20260401000003_seed_data.sql':          { from: '8d09bdfd3edea72a8a6a37a7016cab248fdae71d', to: '<fill after edit>' },
  'supabase/migrations/20260425000001_seed_example_shorts.sql':{ from: 'd3ce94e3fe5520f2341953f586cc17e3db734e3a', to: '<fill after edit>' },
  'supabase/migrations/20260506115421_seed_fake_show_cast.sql':{ from: '79cac51acb7b1b7caec86e76d54f5e0c77923f68', to: '<fill after edit>' },
  'supabase/migrations/20260506120139_add_fake_cast_images.sql':{ from: '37be8e857084ae1243570657ce46276edcd185b0', to: '<fill after edit>' },
}
// allowed iff status === 'M' && `git rev-parse <base>:<path>` === from && `git rev-parse <head>:<path>` === to
```
`from` values read with `git rev-parse origin/main:<path>` on 2026-10-20 (identical on this branch). Compute `to` with `git rev-parse HEAD:<path>` after the final edit of each file; the allow-list edit is the last change before the PR (any later tweak to a neutralised file must update `to`). After the PR merges, `base` blob equals `to`, never `from`, so the entry is inert and any later edit fails D-05 again. A fixture test must prove: edit with matching hashes passes; same path with different content fails; second edit after merge fails.

**SQL scanner (comment stripping, strings, dollar quotes):** single pass state machine over the file text:
- `--` to end of line: blank it (keep newline). If the comment text matches `/^\s*safe-drop:\s*(\S.*)$/i` record a waiver for that line. A waiver inside a string literal is not a comment and does not count; empty reason does not count; a waiver on a different line does not count.
- `/* ... */`: Postgres block comments nest; track depth; blank content, keep newlines.
- `'...'` strings (with `''` escape; `E'...'` also honours backslash escapes) and `"..."` identifiers: **keep their text for scanning** (dynamic SQL such as `execute 'drop table x'` lives in strings) but do not treat `--` or `/*` inside as comments.
- `$tag$ ... $tag$` dollar quotes: do not skip; emit as normal code (function bodies can run `delete from`), comments inside still stripped. Policy: flag them, waiver required (`-- safe-drop: reason`).
- Compute the line number from the offset in the blanked text; the waiver must be on the same line as the matched keyword (D-04).

**Regex set (applied to comment-stripped text, case-insensitive, global):**
```js
const PATTERNS = [
  ['drop',        /\bdrop\b(?!\s+(?:not\s+null|default|identity|expression)\b)/gi],
  ['truncate',    /\btruncate\b/gi],
  ['delete-from', /\bdelete\s+from\b/gi],
  ['then-delete', /\bthen\s+delete\b/gi],   // MERGE ... WHEN MATCHED THEN DELETE
]
```
Decisions (inside the Claude's-discretion area; D-04/SAFE-02 wording "drop/truncate/delete" is honoured for every destructive form):
- Flag **every** `drop` except the four non-destructive column-attribute forms (`drop not null`, `drop default`, `drop identity`, `drop expression`). `drop policy|trigger|view|function|constraint ... if exists` therefore need a waiver (`-- safe-drop: recreated below`): strict by design, RLS policy drops are security-relevant. 12 existing migration files contain such drops; they are not re-scanned, only added or changed files are.
- Flag `delete` only as DML (`delete from`, `then delete`) so `on delete cascade|set null|set default|restrict|no action`, `create policy ... for delete`, `grant ... delete on`, `before/after delete` triggers, `deleted_at` need no waiver. `\b` plus underscore handling also leaves `drop_cover_url` and `date_trunc` alone.
- `truncate` anywhere is flagged (keyword; no legitimate non-destructive use).
- Known, accepted gaps: string concatenation obfuscation (`'dr'||'op'`), `DO` blocks built from `format()` with a keyword split across arguments. The guard catches mistakes, not malice.

**Fixture list for `tests/unit/migration-guard.test.ts`** (scanner tests are pure strings; git tests build temp repos with `git init`, a base commit holding 2 applied migrations, then a head commit):
| # | Fixture | Expected |
|---|---------|----------|
| 1 | `create table` / `alter table add column` | pass |
| 2 | `on delete cascade`, `on delete set null`, `for delete` policy, `grant ... delete on`, `deleted_at`, `drop_cover_url`, `date_trunc` | pass |
| 3 | `alter column drop not null`, `drop default`, `drop identity` | pass |
| 4 | `DROP TABLE t;` / `drop policy if exists ...` / `alter table drop column` / `drop constraint` | fail |
| 5 | same with `-- safe-drop: reason` on that line | pass |
| 6 | waiver with empty reason; waiver on previous line; waiver text inside a string | fail |
| 7 | keyword only inside `--` comment, `/* */`, nested `/* /* */ */` | pass |
| 8 | `truncate t;` / `TRUNCATE TABLE t restart identity` | fail |
| 9 | `delete from t`, `delete\n from t`, `delete /* c */ from t`, `merge ... then delete` | fail |
| 10 | `$$ ... delete from ... $$` and `$f$ ... drop table ... $f$` bodies; `execute 'drop table t'` | fail |
| 11 | `'a--b'` string followed by `drop table t;` on same line | fail (string must not hide the rest of line) |
| 12 | Git: new file with later timestamp, clean | pass |
| 13 | Git: edit (M) of a base migration | fail |
| 14 | Git: rename and delete of a base migration | fail |
| 15 | Git: allow-listed edit (from/to hashes match) | pass; same path other content | fail |
| 16 | Git: new file misnamed (`foo.sql`, 12-digit version) | fail |
| 17 | Regression: run `scanSql` on `20260401000000_create_schema.sql` after neutralisation and on the other four | pass (no unwaived findings) |

Prototype status: scanner and 33 edge cases ran green in a scratch copy (`/private/tmp/claude-501/.../scratchpad/scan-proto.mjs`, not repo code); over the 58 current migrations it reports 38 unwaived findings in 12 files (all genuine), so the guard will not flag the neutralised files if their drops are commented out.

### Seed relocation (SAFE-01)

**Stays in migrations**
- `20260401000003_seed_data.sql`: keep only header comment and
  ```sql
  INSERT INTO public.app_config (id, admin_user_id) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
  ```
  (already insert-if-missing). The `DO $$ ... $$` block with the 15 shows/seasons/episodes moves out.
- `20260401000000_create_schema.sql`: comment out lines 17-26 (the ten `drop` statements) and replace the cleanup header with a note (neutralised in Phase 1 SAFE-01: it must never run `drop table ... cascade` against a populated database). Everything else unchanged. The remaining `on delete cascade` clauses need no waiver under the regex set.
- `20260425000001_seed_example_shorts.sql`, `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql`: header comment plus a harmless `select 1;` (an empty file is untested; keep one statement).
- Untouched: `20260605000003_seed_legal_and_faqs.sql`, `20260605000002_create_legal_and_faqs.sql` (inserts real `legal_pages` skeleton), `20260418000000_expand_app_config.sql`, bucket inserts in storage migrations (real config, not fake data).

**Goes to `supabase/seed.sql`, in this order**
1. Self-guard (refuse on a populated database):
   ```sql
   do $$ begin
     if exists (select 1 from public.shows) then
       raise exception 'seed.sql refuses to run: public.shows is not empty (never seed a real database)';
     end if;
   end $$;
   ```
2. The `DO $$` block from `20260401000003` (15 shows, 21 seasons, 94 episodes) with every `broadcast_day` literal converted to an array literal (`'{Sunday}'`, ..., Break Fast Daily expanded to weekdays, Poets Platform stays NULL).
3. The 6 example shorts INSERT from `20260425000001`.
4. The fake cast INSERT from `20260506115421` (it selects from `public.shows`, so it must come after step 2).
5. The cast-image UPDATE from `20260506120139` (needs the rows from step 4).

**Dependencies:** no later migration reads seeded rows. All `insert into`/`update` statements in the 58 migrations were listed: only the four seed files, bucket inserts, `profiles` backfill (`create_schema` trigger function, `fix_reviews_profile_fk`), `legal_pages` insert, a `categories` update on its own table, `shows.sort_order` backfill (no-op on empty), and the episode swap function. On a fresh DB all are no-ops or independent of shows. D-11's `db reset` still must run the full chain once to prove it.

**Config:** `supabase/config.toml` line 69 `enabled = true` (path `sql_paths = ["./seed.sql"]` already set). Seeding runs after all migrations on `supabase start` first run and every `db reset` [CITED: supabase.com/docs/guides/local-development/seeding-your-database].

**D-11 command shape (executor, under the heavy lock, detached, log with `exit=`):**
```bash
# 0) back up local data first (other sessions may rely on it)
docker exec supabase_db_Clickit pg_dump -U postgres -Fc postgres > /Users/koss/.clickit-checks/p1-local-before-reset.dump
# 1) reset the LOCAL stack explicitly (never --linked or --db-url)
supabase db reset --local
# 2) read back
docker exec supabase_db_Clickit psql -U postgres -At -c "select (select count(*) from public.app_config),(select count(*) from public.shows),(select count(*) from public.seasons),(select count(*) from public.episodes),(select count(*) from public.shorts),(select count(*) from public.show_cast),(select count(*) from supabase_migrations.schema_migrations)"
# expected: 1|15|21|94|6|45|58
```

### Package scripts
```json
"typecheck": "tsc --noEmit",
"guard:migrations": "node scripts/migration-guard.mjs",
"gate:local": "npm run lint && npm run typecheck && npm run test:unit && npm run guard:migrations && npm run build"
```
(`guard:migrations` locally uses defaults `origin/main...HEAD`; the CI gate calls steps, not `gate:local`, per D-07.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Branch protection API | Repository rulesets (`/rulesets`, bypass actors, `integration_id`) | 2023 onward | Admin bypass and app-sourced checks are first-class |
| Go Supabase CLI (<= ~2.10x) | Rewritten in TypeScript, shipped as compiled binary (2.119.0) | between 2.102 and 2.119 [observed from binary] | Same messages/flags for push; verify the first dispatch |
| Auto-apply on push to main | Dry-run + environment approval | this phase | No unreviewed live DDL |

**Deprecated/outdated:** the old workflow's `--include-all` comment ("every committed migration is meant for prod") is exactly the behaviour D-01 removes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Loomlyne` (id 223640340) is the GitHub account Koss approves with | Environments command | Wrong reviewer; environment would wait on the wrong person. Confirm before running |
| A2 | With only a `required_status_checks` rule, non-bypass users cannot push straight to `main` ("commits must first be pushed to another ref where the checks pass") | Ruleset decisions | If wrong, collaborator `clickitstory` could push to `main`; then add a `pull_request` rule (0 approvals) |
| A3 | Node 24 runs the unit tests and `next build` like local Node 26.7 does | Standard Stack | First CI run fails on Node features; fall back to Node 22 (>=22.18) or 26 |
| A4 | Session-pooler URL is required because GitHub runners lack IPv6 for the direct DB host | Supabase CLI facts | Dry-run connection error; use the pooler string already stored |
| A5 | Supabase CLI 2.119.0 installs through `supabase/setup-cli` v3.0.1 on ubuntu-latest and keeps these messages in CI text mode | Apply workflow | Dry-run job fails before any live access; adjust pin. `grep 'Remote database is up to date'` fails safe (treated as pending) |
| A6 | `rhysd/actionlint:1.7.12` Docker image exists (brew bottle verified instead) | Validation | Use `brew install actionlint` or the Ruby YAML fallback |
| A7 | An empty migration file might not be accepted by the CLI (not tested) | Seed relocation | Reason for the `select 1;` no-op bodies; if wrong, no harm |
| A8 | Approval prompt appears on the workflow run page ("Review deployments") and notifies the reviewer | Apply workflow | Koss must open the run manually; behaviour of the pause itself is documented |

## Open Questions

1. **Second environment (`live-db-plan`) versus D-02's single `live-db`** (RESOLVED — Koss chose the default, 2026-10-20)
   - What we know: the dry-run needs the DB URL; an environment secret is only readable by jobs that reference that environment; a reviewer on `live-db` would prompt twice if both jobs used it; a repo-level secret is readable from any branch workflow by anyone with push access (`clickitstory` is a collaborator).
   - Unclear: Koss's appetite for one more environment.
   - Recommendation: create both (commands above). Fallback if Koss refuses: dry-run job uses the existing repo secret and no environment; document the exposure.
2. **Reviewer account for `live-db`.** Recommendation: `Loomlyne` (id 223640340); confirm (A1). (RESOLVED — Koss chose the default, 2026-10-20)
3. **`Break Fast Daily` `'Mon-Fri'`.** Recommendation: expand to the five weekday names to match the column comment; this only affects local seed data. (RESOLVED — Koss chose the default, 2026-10-20)
4. **Ruleset extras** (`non_fast_forward`, `deletion`) and a `pull_request` rule: recommendation is literal D-08 plus the two optional extras only on Koss's signature. (RESOLVED — Koss chose the default, 2026-10-20)
5. **Waiver strictness for `drop policy|trigger|view ... if exists`.** Recommendation: strict (waiver with reason). If Koss finds it noisy, a later one-line change to the `drop` regex can exempt `if exists` forms; not done now because it weakens SAFE-02 wording. (RESOLVED — Koss chose the default, 2026-10-20)
6. **CLI pin bump 2.102.0 to 2.119.0** is a change to the tool that touches live data; first proof is the read-only dry-run after merge. (RESOLVED — Koss chose the default, 2026-10-20)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | guard, tests, tsc, lint | yes | 26.7.0 local (CI will use 24) | — |
| npm | scripts | yes | 11.19.0 | — |
| git | guard fixtures | yes | system | — |
| Docker + local Supabase stack | D-11 `db reset` | yes | stack `supabase_db_Clickit` healthy (up 5 h); 17 shows, 94 episodes, 58 migrations | — |
| Supabase CLI | `db reset --local`, flag facts | yes | 2.119.0 (latest 2.121.0) | — |
| `gh` | ruleset/environment commands (controller) | yes | 2.98.0, logged in as Loomlyne with admin | api.github.com showed intermittent TLS timeouts; retry |
| actionlint | workflow lint | no | — | `brew install actionlint` (Koss's call), or Ruby `YAML.load_file` plus the text test |
| Ruby | YAML syntax check | yes | system | — |
| Python `yaml` | — | no | — | not needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** actionlint.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via `npm run test:unit` (`node --experimental-strip-types ... --test 'tests/unit/*.test.ts' 'tests/unit/**/*.test.ts'`); 83 tests pass today (0.4 s) |
| Config file | none (flags in `package.json`) |
| Quick run command | `npm run typecheck && npm run lint && npm run test:unit` (measured: tsc 7.6 s exit 0, lint 7 s 0 errors/15 warnings, tests 1 s) |
| Full suite command | `npm run gate:local` under the heavy lock (includes `next build`; do not run during research) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | DROP block and seeds neutralised; scanner finds no unwaived destructive SQL in the five edited files | unit | `node --experimental-strip-types --test tests/unit/migration-guard.test.ts` (fixture 17) | no, Wave 0 |
| SAFE-01 | Fresh DB: all migrations + seed.sql apply; counts `1\|15\|21\|94\|6\|45\|58` | integration (local stack, heavy lock) | the three D-11 commands above | no, executor step |
| SAFE-01 | seed.sql refuses a populated DB | integration (local) | `docker exec -i supabase_db_Clickit psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql` must fail with the guard message (run after reset, expect non-zero) | no, executor step |
| SAFE-02 | Guard: clean passes, drop/truncate/delete fail, waiver passes, edit/rename/delete of applied file fails, allow-list once | unit | `node --experimental-strip-types --test tests/unit/migration-guard.test.ts` | no, Wave 0 |
| SAFE-02 | Apply workflow shape: only `workflow_dispatch`, no `push:`/`pull_request`, no `--include-all`/`--include-seed` in non-comment lines, jobs `dry-run` and `apply`, `environment: live-db`, `needs: dry-run`, all `uses:` pinned to 40-hex SHA, `permissions: contents: read`, `timeout-minutes` on every job | unit (text assertions) | `node --experimental-strip-types --test tests/unit/workflows.test.ts` | no, Wave 0 |
| SAFE-02 | Workflow YAML syntax | lint | `actionlint` if installed, else `ruby -ryaml -e 'ARGV.each{\|f\| YAML.load_file(f)}' .github/workflows/*.yml` | tool optional |
| SAFE-03 | PR workflow shape: trigger types, `branches: [main]`, no `paths`/`paths-ignore`, job names exactly `gate` and `migration-guard`, concurrency cancel-in-progress, no `secrets.`, SHA pins | unit (text) | same `workflows.test.ts` | no, Wave 0 |
| SAFE-03 | Each gate step is green on the branch | local | `npm run lint && npm run typecheck && npm run test:unit` then `npm run build` with placeholder env under the lock | scripts exist except `typecheck` (Wave 0) |
| SAFE-03 | Required checks enforced | post-merge, controller | readback of ruleset (`gh api .../rulesets`) plus check-run names on the Phase 1 PR | owner step, after signing |
| SAFE-04 | Evidence file exists | doc | `test -f .planning/phases/01-safe-ground/01-LIVE-AUDIT.md` | yes |
| SAFE-05 | Evidence recorded | doc | `grep -q 'SAFE-05' .planning/phases/01-safe-ground/01-LIVE-AUDIT.md` | yes |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run test:unit` (about 10 s)
- **Per wave merge:** add `npm run lint`, the ruby/actionlint YAML check, and the guard against `origin/main...HEAD`
- **Phase gate:** `gate:local` green under the heavy lock (detached, log with `exit=` in `/Users/koss/.clickit-checks/p1-*.log`), D-11 reset counts, clean-clone check via `/Users/koss/.clickit-checks/pr-check.sh <pr> <branch>` before Ship

### Wave 0 Gaps
- [ ] `scripts/migration-guard.mjs` plus `tests/unit/migration-guard.test.ts` — SAFE-01, SAFE-02
- [ ] `tests/unit/workflows.test.ts` — SAFE-02, SAFE-03 (text assertions; no YAML dependency)
- [ ] `typecheck` and `guard:migrations` scripts in `package.json`, `gate:local` updated — SAFE-03
- [ ] Framework install: none (node:test already in use)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not changed (admin login untouched) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Environment required reviewer, main-only deployment branch policy, ruleset required checks, repo-admin bypass limited to one role |
| V5 Input Validation | yes | Guard treats migration SQL as untrusted text: tokenizer, no `eval`; git output parsed with `-z`; arguments passed to `git` via `execFileSync` argument arrays, never a shell string |
| V6 Cryptography | no | No crypto written; blob SHAs from git |
| V14 Configuration / build | yes | Actions pinned to SHAs, `permissions: contents: read`, no secrets in PR workflow, `persist-credentials: false`, CLI pinned to exact version, `timeout-minutes` |

### Known Threat Patterns for GitHub Actions + Supabase CLI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret exfiltration via a PR/branch workflow | Information disclosure | DB URL only as environment secrets on `main`-only environments; delete repo-level secret; PR workflow has no `secrets.*` and uses `pull_request` (not `_target`) |
| Moved action tag injecting code | Tampering | Full-SHA pins with version comment |
| Unreviewed live DDL | Tampering | Dry-run job, reviewer approval, pg_dump first (D-03), no `--include-all`/`--include-seed` |
| Out-of-order or re-timestamped migration applied silently | Tampering | CLI error without `--include-all`; guard rules 2 and 4 |
| Agent self-approving the gate | Elevation of privilege | Procedure: Koss approves in the Actions UI; controller never calls the pending_deployments API |
| DB URL echoed in logs | Information disclosure | GitHub masks the stored secret; no `--debug`; `2>&1 | tee` writes only CLI output |
| Guard weakened by the PR it checks | Tampering | Accepted limitation (Pitfall 9); optional base-ref copy of the script |

## Sources

### Primary (HIGH confidence)
- Installed Supabase CLI 2.119.0 binary (`/opt/homebrew/Cellar/supabase/2.119.0/libexec/supabase`, read with `strings`) — push/dry-run messages, version-only comparison, seed gating, `db reset` flags
- `supabase db push --help`, `supabase db reset --help` (local 2.119.0)
- https://docs.github.com/en/rest/repos/rules (create a repository ruleset: bypass_actors, required_status_checks, pull_request params)
- https://docs.github.com/en/rest/deployments/environments and /branch-policies (reviewers, prevent_self_review, deployment_branch_policy, branch policy POST)
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments (required reviewers, secrets only after approval)
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request (merge commit SHA, default activity types)
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets (app source for status checks)
- https://github.com/integrations/terraform-provider-github `docs/resources/repository_ruleset.md` (RepositoryRole ids: maintain 2, write 4, admin 5; integration_id = GitHub App id), read via `gh api`
- https://supabase.com/docs/guides/local-development/seeding-your-database; https://supabase.com/docs/reference/cli/supabase-db-push
- https://github.com/supabase/setup-cli README (version input)
- GitHub API reads on Loomlyne/Clickit (visibility public, rulesets `[]`, environments, secret name, `apps/github-actions` id 15368, action release SHAs)

### Secondary (MEDIUM confidence)
- GitHub docs "Troubleshooting required status checks" statements (path-filtered workflows leave checks Pending; skipped-by-conditional job reports Success), confirmed through search results quoting the page and its Enterprise Server mirrors (the github.com URL returned 404 to fetch)
- Local experiments: `tsc --noEmit` (exit 0, 7.6 s), `npm run lint` (0 errors), `npm run test:unit` (83 pass), scratch-DB seed insert test, guard prototype

### Tertiary (LOW confidence)
- GitHub UI wording for required status checks ("commits must first be pushed to another ref where the checks pass"), recalled not fetched (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SHAs and versions resolved through the GitHub API; CLI behaviour read from the binary
- Architecture: HIGH — workflows and ruleset follow documented semantics; two assumptions (A2, A5) listed
- Pitfalls: HIGH — seed/array/config findings verified against the repo and a scratch DB; GitHub path-filter behaviour from docs

**Research date:** 2026-10-20
**Valid until:** 2026-11-03 (actions and Supabase CLI move fast; re-check pins before the first dispatch)
