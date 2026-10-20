---
phase: 01-safe-ground
reviewed: 2026-10-20T13:30:04Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/migration-guard.mjs
  - tests/unit/migration-guard.test.ts
  - tests/unit/workflows.test.ts
  - tests/unit/migration-neutralisation.test.ts
  - .github/workflows/pr-gate.yml
  - .github/workflows/apply-live-migrations.yml
  - .github/workflows/supabase-migrations.yml
  - supabase/seed.sql
  - supabase/config.toml
  - supabase/migrations/20260401000000_create_schema.sql
  - supabase/migrations/20260401000003_seed_data.sql
  - supabase/migrations/20260425000001_seed_example_shorts.sql
  - supabase/migrations/20260506115421_seed_fake_show_cast.sql
  - supabase/migrations/20260506120139_add_fake_cast_images.sql
  - package.json
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: fixed_partial
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-20T13:30:04Z
**Depth:** standard
**Files Reviewed:** 15 (scope: `git diff origin/main...HEAD -- scripts/ tests/ .github/ supabase/ package.json`; `supabase-migrations.yml` reviewed as a deletion)
**Status:** issues_found

## Summary

These parts hold up. The old `push: main` auto-apply is gone. `--include-all`, `--include-seed` and `--debug` appear nowhere. `apply` is chained with `needs` and `if` so it fails safe when the dry-run fails or prints something unexpected. Seeds cannot reach live through `db push`. The five neutralised migrations scan clean and match the allow-list `to` blobs. The allow-list expires after merge. Checkout depth 2 is correct for `HEAD^1` on the `pull_request` merge commit. All 51 unit tests pass. `node scripts/migration-guard.mjs` exits 0.

There are two blockers:

1. **The SQL scanner can be made to hide a destructive statement.** A `'` or `"` inside a `$$...$$` body flips its quote state. After that, a real string containing `--` or `/*` is treated as a comment and the code after it is blanked. Five probes returned 0 findings for a plain `drop table users`. The file's own comment says this cannot happen. None of the 58 current migrations triggers it, but dollar quotes are used exactly for text with apostrophes.
2. **The approval gate depends on the repo-level secret being deleted first.** While the repo-level `SUPABASE_DB_URL` exists, anyone with write access can bypass both environments. Two ways: dispatch the workflow from a branch that carries an edited copy of it, or open a same-repo PR whose workflow reads the secret. The workflow comment says the main-only step prevents this. It does not.

Warnings cover:
- the PR gate's fail-open paths (renames into `docs/`, git errors)
- a PR can edit the workflow that runs the "base copy" guard
- a missing `live-db` environment is not checked by the workflow
- an expression is interpolated into shell
- one waiver covers every statement on its line
- destructive SQL outside the regex set
- the "read-only" claim for the dry-run secret

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Quote-state desync from dollar-quoted bodies hides destructive SQL from the guard

**File:** `scripts/migration-guard.mjs:159-202` (false claim in the doc comment at `:96-98`)
**Issue:** The scanner skips dollar-quote tags but keeps scanning the body as normal code, so `'` and `"` inside the body open and close "strings". Dollar quoting is used precisely for text with unbalanced apostrophes (`comment on ... is $$Viewer's progress$$`, nested `$q$it's$q$`). One stray quote flips the parity for the rest of the file. From then on, a `--` or `/*` inside a real string literal is treated as a comment and blanked, together with the real code after it. The comment at `:97-98` says "a misread quote can add findings but never hides one". That is false. Reproduced with `scanSql`; every case below returned `findings=0`:

```sql
comment on table t is $$it's$$; select 'x -- '; drop table users;
comment on table t is $$Viewer's progress$$;
select 'a';
insert into x values ('-- ');drop table users;
comment on table t is $$it's$$; select '/*';
drop table users;            -- whole lines hidden until a later '*/'
select '*/';
comment on table t is $$say "hi$$; select 'x'; select "a -- "; drop table users;
```

No current migration has an odd quote count inside a dollar body, so this is latent. It is still a direct bypass of D-04 that someone can trigger by accident, for example in a legal-copy or FAQ migration.
**Fix:** Treat each dollar-quoted body as its own span. Find the matching closing tag, scan the body with fresh quote state (comments inside still stripped, so plpgsql bodies stay covered), then resume after the closing tag. A body desync then cannot leak into the outer file. Also fail closed: a string or dollar quote still open at EOF should be a violation, not silently accepted. Sketch:

```js
if (ch === '$' && !isWordChar(text[i - 1])) {
  const tag = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(text.slice(i, i + 64))
  if (tag) {
    const close = text.indexOf(tag[0], i + tag[0].length)
    if (close === -1) { unterminated.push(lineOf(i)); break }   // -> violation
    scanRegion(i + tag[0].length, close)   // same loop, fresh quote state, writes into `out`/`waivers`
    i = close + tag[0].length
    continue
  }
}
```

Add the four probes above to `tests/unit/migration-guard.test.ts` as must-fail fixtures.

### CR-02: The repo-level `SUPABASE_DB_URL` lets anyone with write access bypass both environments; the workflow says the main-only step prevents this

**File:** `.github/workflows/apply-live-migrations.yml:21-26`, `:59-64`, `:106-111`
**Issue:** `workflow_dispatch` runs the workflow file from the ref you choose. Once the file is on `main`, a writer can push branch `x` with an edited copy (main-only step removed, `environment:` removed, `--include-all` added) and dispatch it with `ref: x`. Without `environment:`, the job reads the repo-level secret. It writes to live with no dry-run and no approval. The same applies to any same-repo `pull_request` (unlike fork PRs, these get repo secrets) or any `push` workflow on a branch. Collaborator `clickitstory` has push access (RESEARCH). The comment at `:24-26` ("the job reads the repo-level SUPABASE_DB_URL, and the main-only step still limits it to main") is wrong: the "Main only" steps are inside the file the attacker controls. Only an environment deployment-branch policy, with no repo-level copy of the secret, makes main-only real. The runbook deletes the repo-level secret only after the first good dry-run (step 10), and keeps it forever if Koss declines `live-db-plan`. So the gate this phase builds is open from merge until step 10.
**Fix:**
1. Change the runbook order: set both environment secrets (step 4), read back (step 5), then delete the repo-level secret before the Phase 1 squash merge, not after the first dry-run. The dry-run needs only the `live-db-plan` secret.
2. Make `live-db-plan` mandatory. Remove the "if it is not created" fallback.
3. Rewrite the comment at `:21-26` to say: the main-only steps are diagnostics only; the controls are the environment branch policies plus the absence of a repo-level secret.

## Warnings

### WR-01: "A PR cannot weaken the check that judges it" is false; the PR-copy fallback stays open after Phase 1

**File:** `.github/workflows/pr-gate.yml:18-21`, `:53-62`
**Issue:** On `pull_request`, GitHub runs the workflow YAML from the merge commit, which is the PR's own version. A PR can change `Select guard copy` to `cp scripts/...`, or simply `exit 0`, and the base guard never runs. The base-copy step only stops someone weakening `migration-guard.mjs` itself. The `else` branch also trusts the PR copy whenever the base has no `scripts/migration-guard.mjs`. The comment says that is "true only for the Phase 1 PR", but it will be true again after any PR that renames or deletes the guard.
**Fix:**
- Correct the comment.
- Make the fallback fail closed after Phase 1, e.g. allow it only when `git rev-parse HEAD^1` equals the recorded pre-Phase-1 base SHA (`d517ddc...`), otherwise `exit 1`.
- For a backstop the PR cannot control, also run main's guard in the `dry-run` job of `apply-live-migrations.yml`, against the SHA of the last applied commit (e.g. a `live-applied` tag the controller moves after each apply).

### WR-02: Docs-only scope step fails open on renames and on git errors

**File:** `.github/workflows/pr-gate.yml:77-85`
**Issue:**
- (a) `git diff --name-only` has rename detection on by default and lists only the destination path. Moving `src/a.ts` to `docs/a.md` gives `code=false`, so lint, typecheck, tests and build are skipped while code is deleted. Reproduced in a scratch repo.
- (b) The default `run` shell is `bash -e {0}` without `pipefail`, and the pipe is inside an `if`. If `git diff` fails (for example `HEAD^1` is missing because a later edit checks out `head.sha`), grep gets empty input and the result is `code=false`: a green gate on an error.

**Fix:**
```yaml
run: |
  set -euo pipefail
  changed="$(git diff --no-renames --name-only HEAD^1 HEAD)"
  if printf '%s\n' "$changed" | grep -qvE '(\.md$|^docs/|^\.planning/)'; then
    echo "code=true" >> "$GITHUB_OUTPUT"
  else
    echo "code=false" >> "$GITHUB_OUTPUT"
  fi
```

### WR-03: A missing or misconfigured `live-db` environment lets `apply` run unapproved; the workflow does not check

**File:** `.github/workflows/apply-live-migrations.yml:21-23`, `:104`
**Issue:** The workflow's own comment admits that GitHub auto-creates a missing environment with no reviewers. The only protection is the runbook order. One mis-ordered dispatch, or a deleted or renamed environment later, gives a live write with no approval.
**Fix:** Add a fail-closed preflight to `dry-run`, before the plan step. Give the job `permissions: { contents: read, actions: read }`, and confirm that `actions: read` is enough to read environments on the first run.
```yaml
- name: live-db must require a reviewer
  env: { GH_TOKEN: "${{ github.token }}" }
  run: |
    n=$(gh api "repos/$GITHUB_REPOSITORY/environments/live-db" \
         --jq '[.protection_rules[]?|select(.type=="required_reviewers")]|length')
    [ "$n" -ge 1 ] || { echo "::error::live-db has no required reviewer"; exit 1; }
```

### WR-04: `${{ inputs.pg_dump_taken }}` is interpolated into shell, and the backup check runs only after approval

**File:** `.github/workflows/apply-live-migrations.yml:113-118`
**Issue:** The expression is substituted into the script text. The dry-run step correctly passes the same input through `env`. If a non-boolean value ever gets through a dispatch (API callers send strings), it becomes shell code in a job whose next step holds the DB secret. Injected code could plant a fake `supabase` on `PATH` through `$GITHUB_PATH`. Separately, the check runs after Koss approves. A missing backup is found only after he has been asked to sign, so the approval is wasted and the run has to be re-dispatched.
**Fix:** Pass the input through `env: { PG_DUMP_TAKEN: "${{ inputs.pg_dump_taken }}" }` and test `"$PG_DUMP_TAKEN"`. Move the check into `dry-run`, before the plan step, so an unchecked box fails before any approval request. Keeping a second copy in `apply` is fine.

### WR-05: One waiver covers every destructive statement on its line

**File:** `scripts/migration-guard.mjs:218-223`
**Issue:** Waivers are stored per line, and every hit on that line is waived. `drop table a; drop table users cascade; -- safe-drop: recreated a` gives `findings=0, waived=2` (reproduced). A one-line migration, or a long `do $$ ... $$` written on one line, can carry any number of drops under one reason that only explains the first. That weakens D-04 ("a line that does not carry a waiver" was meant per statement).
**Fix:** On a waived line, allow at most one destructive hit. Report extra hits as `multiple destructive statements on one waived line; split them`. Add a fixture.

### WR-06: Damaging SQL outside the four patterns passes, and the approver sees only file names

**File:** `scripts/migration-guard.mjs:49-54`; `.github/workflows/apply-live-migrations.yml:81-90`
**Issue:** The phase goal is that nothing merged can damage live. These all pass with 0 findings (reproduced):
- `update public.profiles set role = null;` (no `where`)
- `alter table public.profiles disable row level security;`
- `alter table public.shows rename to shows_old;`
- `revoke all on public.shows from authenticated;`

These also pass:
- `alter column ... type ... using`
- `create or replace function public.is_admin() ... return true`
- calls to an existing function that deletes data

D-04 scopes the guard to drop, truncate and delete, so this is accepted scope. But the backstop is the dry-run approval, and the dry-run summary lists migration names only. Koss approves without seeing the SQL.
**Fix:** In the plan step, append the full text of each pending file to the run summary. The files are already public on `main`, so this exposes nothing new; parse the `Would push these migrations:` list and `cat` each file. Optionally add warning-level (non-failing) patterns for `update ... set` with no `where`, `disable row level security`, `rename`, `revoke`, and `create or replace function public.is_admin`.

### WR-07: The dry-run secret is called "read-only" but is the same full-privilege connection string, available without approval

**File:** `.github/workflows/apply-live-migrations.yml:5-6`, `:24`, `:55`, `:77`
**Issue:** The comments call `live-db-plan` "the read-only dry-run secret". The runbook (step 4) sets the same `SUPABASE_DB_URL` (postgres role, Session pooler) in both environments. `live-db-plan` has no reviewer, so any writer can dispatch on `main` and have a write-capable credential in a job. Today that job runs only main's code, but anyone adding a step to `dry-run` later will trust the comment.
**Fix:** Create a dedicated read-only role. It needs `usage` on schema `supabase_migrations` and `select` on `schema_migrations`; confirm `db push --dry-run` 2.119.0 needs nothing more. Put its URL in `live-db-plan`. Or correct the comments to "same credential as apply; the command is read-only, the secret is not".

## Info

### IN-01: The seed self-guard does not protect against the remote command most likely to run it

**File:** `supabase/seed.sql:15-20`
**Issue:** `supabase db reset --linked` and `--db-url` first wipe the target, so `public.shows` is empty when the seed runs and the guard passes. Fake data then lands on a just-wiped live database. The guard also checks only `shows`: shorts and cast are inserted whenever `shows` is empty, even if other tables hold real rows.
**Fix:** Also refuse when `exists (select 1 from auth.users)` (empty on a local reset at seed time; check whether a remote `db reset` keeps `auth.users` before relying on this), or when `inet_server_addr()` is not a loopback or docker address.

### IN-02: Test files are never type-checked

**File:** `package.json:16` (`typecheck`), `tsconfig.json` (excludes `tests/unit`)
**Issue:** `tsc --noEmit` skips the new `.test.ts` files, and `node --experimental-strip-types` strips types without checking them. Type errors in tests go unnoticed.
**Fix:** Add a `tsconfig.test.json` that includes `tests/unit` and `scripts/*.mjs` (with `allowJs`), and run it in `typecheck`.

### IN-03: Dry-run output, including connection errors, is published in public logs and the run summary

**File:** `.github/workflows/apply-live-migrations.yml:81-90`
**Issue:** `2>&1 | tee` sends all CLI output to the public Actions log and summary. A pgx connection error prints `host=... user=postgres.<ref> database=...`. GitHub masks the whole secret, not its parts. The password is not printed, but the pooler host and role are.
**Fix:** Write only the `Would push these migrations:` block, or the "up to date" line, into the summary. On failure, print a generic error and keep the raw output unechoed.

### IN-04: Added migrations in subdirectories pass the name check but the CLI never applies them

**File:** `scripts/migration-guard.mjs:337-339`
**Issue:** `NAME_RE` is tested against the basename only, so `supabase/migrations/sub/20270101000000_x.sql` passes. The Supabase CLI reads only the top level of the migrations folder, so that migration is silently never applied.
**Fix:** Add `posix.dirname(change.path) === dir` to the added-file check.

### IN-05: The guard verdict can be stale against `main`

**File:** `.github/workflows/pr-gate.yml:26-29` (with runbook ruleset `strict_required_status_checks_policy: false`)
**Issue:** `migration-guard` judges the merge commit from the last PR event. If `main` gains migrations or a stricter guard afterwards, the PR merges on the old verdict. The ordering warning is the main thing lost; out-of-order versions still fail in the dry-run. So this is a weaker signal, not a bypass.
**Fix:** The controller re-runs `npm run guard:migrations` on the clean-clone merge before every Ship (it already re-checks in a clean clone). State this in the runbook.

---

_Reviewed: 2026-10-20T13:30:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Fix log

Fixed 2026-10-20 (UTC) in the Phase 1 work session on `claude/phase-01-safe-ground-dc6bbe`; not pushed. Scope set by the controller: CR-01, CR-02, WR-02, WR-03, WR-04 fixed; WR-01, WR-05, WR-06, WR-07 and IN-01 to IN-05 accepted and listed in the hand-over under "Known limits (accepted, from review)".

| Finding | Commit | Status |
|---------|--------|--------|
| CR-01 quote desync from dollar bodies | 7cd9674 | fixed: each `$tag$` body is its own region with fresh quote state, clamped to its closing tag; a string, identifier, block comment or dollar quote open at end of file is a violation (exit 1); fixtures 17 to 19 plus a scan of every committed migration |
| CR-02 repo-level secret bypasses both environments | d9ecc5e | fixed (docs + comment): runbook orders create `live-db`/`live-db-plan` with branch policy `main`, set both environment secrets, delete the repo-level secret (new step 4b), read back, all before the squash merge; `live-db-plan` mandatory; workflow comment names the real protection. Takes effect only when the controller and Koss run runbook steps 3, 4, 4b, 5 |
| WR-02 docs-only scope fails open | 6668476 | fixed: `set -euo pipefail`, `--no-renames`, git error or empty list = code, here-string instead of pipe; tests run the step with bash |
| WR-03 missing `live-db` reviewer not checked | e4365e9 | fixed: `apply` reads the environment via the API (job `actions: read`) and exits 1 without a `required_reviewers` rule; needs proof on GitHub that `actions: read` suffices (fails closed otherwise) |
| WR-04 input interpolated into shell; check after approval | 7bd062e | fixed: `PG_DUMP_TAKEN` via env; checked in `dry-run` before the plan and in `apply`; test forbids `${{ inputs.` in any `run:` script |
| WR-01, WR-05, WR-06, WR-07 | 344e0dd (hand-over) | accepted, not changed |
| IN-01 to IN-05 | 344e0dd (hand-over) | accepted, not changed |

Checks after the fixes (2026-10-20T13:40Z, head 7bd062e): `node --experimental-strip-types --test tests/unit/migration-guard.test.ts tests/unit/workflows.test.ts tests/unit/migration-neutralisation.test.ts` 61 pass, 0 fail; `npx tsc --noEmit` exit 0; `npm run lint` 0 errors, 17 pre-existing warnings, none in touched files; `node scripts/migration-guard.mjs --base origin/main --head HEAD` exit 0 (5 files checked, 0 violations); `ruby -ryaml` parses both workflows; allow-list `to` blobs unchanged and matching. No build, no GitHub runs, no `gh api` writes, no live database.
