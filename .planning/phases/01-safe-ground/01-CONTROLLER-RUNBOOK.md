# Phase 1 Controller Runbook: environments, secrets, ruleset, backup, first dry-run

**READ FIRST. The approval gate is only real once the repo-level `SUPABASE_DB_URL` is gone (review CR-02).** `workflow_dispatch` runs the workflow file from the ref the dispatcher picks, so anyone with write access can push a branch with an edited copy (no `environment:`, no "Main only" step) and dispatch it. While a repo-level `SUPABASE_DB_URL` exists, that copy reads it and writes to live with no dry-run and no approval; a same-repo PR workflow can read it too. The "Main only" steps in the workflow are inside the file such a branch controls, so they are diagnostics, not protection. The real protection is: the secret exists ONLY as an environment secret, in `live-db-plan` and `live-db`, and both environments allow deployments from `main` only (deployment-branch policy), with `live-db` requiring Koss as reviewer. A branch copy that names the environments is refused by the branch policy; a copy that drops `environment:` gets no secret.

So BEFORE the Phase 1 PR is squash-merged, in this order: create `live-db` (required reviewer `Loomlyne`, branch policy `main`) and `live-db-plan` (branch policy `main`) (step 3); Koss puts the DB URL in both environment secrets (step 4); Koss DELETES the repo-wide `SUPABASE_DB_URL` (step 4b); the controller reads all of it back (step 5). No squash merge and no `Apply live migrations` dispatch until step 5 passes. GitHub also auto-creates a missing environment with NO reviewers when a workflow references it, which is a second reason the environments must exist first. The plan is signed, so the controller may run these now.

Purpose: these are the repo-settings and live steps the Phase 1 work session may not run itself (no live DB, no `gh api` writes, no workflow runs, no settings change). Every step is tagged `[CONTROLLER before merge]` or `[CONTROLLER after Ship]` (the controller runs it), or `[OWNER]` (one numbered step for Koss in his own terminal or the GitHub UI, then wait). Steps tagged `[CONTROLLER]` only (step 7) are local and read-only against live.

Rules:
- An agent never approves a deployment (RESEARCH Pitfall 11). Approval is Koss clicking in the Actions UI.
- No secret, connection string or password goes into chat, a file, a commit or the PR (the repo is public).
- Heavy local work shares `/Users/koss/.clickit-heavy.lock`.
- Cloudflare is not involved in this runbook. GitHub account is `Loomlyne` (admin).
- Execution order (step numbers are kept stable because other documents cite them):
  1. Before the squash merge: step 2 (approving account), step 3 (environments, branch policy `main`), step 4 (environment secrets), step 4b (delete the repo-level secret), step 5 (read back all of it). Stop at the first mismatch.
  2. Step 1 (check-run names on the PR head), then Koss's Ship, then the squash merge.
  3. After the merge: step 6 (ruleset; step 1 always before it), step 7 (local backup), step 8 (first dry-run), step 9 (approval rule), step 11 (owner backup check), step 12 (CLI reset proof).

## 0. Merge freeze

The Phase 1 squash merge itself waits until steps 2, 3, 4, 4b and 5 have run and read back as expected. After the merge, no other PR merges to `main` until step 6 (the ruleset) is created AND read back. Phase 2 (`claude/phase-02-execute-19d86a`) edits the same `package.json` scripts block: whoever lands second resolves it with base winning, then re-adding `typecheck`, `guard:migrations` and the `gate:local` order.

## 1. `[CONTROLLER after Ship]` Precondition: check names exist

Needs Koss's Ship. The Phase 1 PR head must have shown check runs named exactly `gate` and `migration-guard` from the GitHub Actions app (id 15368), otherwise the ruleset would block every PR forever (Pitfall 7):

```bash
gh api repos/Loomlyne/Clickit/commits/<PR-head-sha>/check-runs --jq '.check_runs[]|[.name,.app.id,.conclusion]'
```

Expected: `["gate",15368,"success"]` and `["migration-guard",15368,"success"]`. Stop otherwise.

Then, only if step 5 passed (environments with branch policy `main`, both environment secrets set, NO repo-level `SUPABASE_DB_URL`), squash merge the PR. The squash carries the new workflow without a `push` trigger, so the old auto-apply cannot fire (Pitfall 8; live already holds all 58 versions, nothing would be pending anyway).

## 2. `[OWNER]` Confirm the approving account

Confirm the approving GitHub account is `Loomlyne` (RESEARCH A1, Open Question 2):

```bash
gh api users/Loomlyne --jq .id
```

Expected `223640340`. If that is not the account Koss approves with, stop and tell the controller; steps 3 and 5 change.

## 3. `[CONTROLLER before merge]` Create the environments (D-02)

`live-db-plan` is the planning environment for the dry-run job (no reviewer, `main` only). It is mandatory (review CR-02): the dry-run needs its own environment secret because the repo-level secret is deleted in step 4b. Signed by Koss at plan gate (default = create it, RESEARCH Open Question 1, signed 2026-10-20); the earlier "if Koss declines, use the repo-level secret" fallback is removed because it keeps the CR-02 bypass open.

Both environments MUST use a custom deployment-branch policy with the single branch `main` (`custom_branch_policies: true` plus the `name=main` branch policy below). That policy is what stops a branch copy of the workflow (dispatched with `--ref <branch>`) from getting the environment secrets; the "Main only" step in the workflow does not.

```bash
# 3a) live-db-plan: no reviewer, deployments from main only
gh api --method PUT repos/Loomlyne/Clickit/environments/live-db-plan --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api --method POST repos/Loomlyne/Clickit/environments/live-db-plan/deployment-branch-policies -f name=main -f type=branch

# 3b) live-db: required reviewer Loomlyne, no self-review block, deployments from main only
gh api --method PUT repos/Loomlyne/Clickit/environments/live-db --input - <<'JSON'
{
  "prevent_self_review": false,
  "reviewers": [ { "type": "User", "id": 223640340 } ],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
gh api --method POST repos/Loomlyne/Clickit/environments/live-db/deployment-branch-policies -f name=main -f type=branch
```

Notes: `protected_branches` and `custom_branch_policies` must be opposites (else 422). The branch-policy POST returns 404 unless `custom_branch_policies` is true, so create the environment first. `prevent_self_review` is false on purpose: Koss is the only reviewer and also dispatches (Pitfall 10).

Rollback: `gh api --method DELETE repos/Loomlyne/Clickit/environments/<name>`.

## 4. `[OWNER]` Set the environment secrets from his own terminal (before merge)

Each command prompts for the value (the Supabase Session-pooler connection string). Nothing in chat or in a file. One line, then wait for the controller's readback; then the second line.

1. `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db-plan`
2. `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db`

## 4b. `[OWNER]` Delete the repo-level secret (before merge, review CR-02)

Only after the controller has read back `SUPABASE_DB_URL` in BOTH environment secret lists (step 4). This replaces the old step 10 ("delete after the first good dry-run"): the dry-run reads only the `live-db-plan` environment secret, so nothing needs the repo-level copy, and while it exists any writer can bypass both environments.

1. `gh secret delete SUPABASE_DB_URL --repo Loomlyne/Clickit`

Never re-add a repo-level `SUPABASE_DB_URL` while `apply-live-migrations.yml` is on `main`; it reopens the bypass.

## 5. `[CONTROLLER before merge]` Read back environments, secrets and the absent repo secret (stop condition)

```bash
gh api repos/Loomlyne/Clickit/environments/live-db --jq '{name,reviewers:[.protection_rules[]|select(.type=="required_reviewers")|.reviewers[].reviewer.login],prevent_self_review:([.protection_rules[]|select(.type=="required_reviewers")|.prevent_self_review]|first),bp:.deployment_branch_policy}'
gh api repos/Loomlyne/Clickit/environments/live-db/deployment-branch-policies --jq '.branch_policies[]|[.name,.type]'
gh api repos/Loomlyne/Clickit/environments/live-db-plan --jq '{name,reviewers:[.protection_rules[]|select(.type=="required_reviewers")],bp:.deployment_branch_policy}'
gh api repos/Loomlyne/Clickit/environments/live-db-plan/deployment-branch-policies --jq '.branch_policies[]|[.name,.type]'
gh secret list --repo Loomlyne/Clickit --env live-db
gh secret list --repo Loomlyne/Clickit --env live-db-plan
gh secret list --repo Loomlyne/Clickit
```

Expected: `live-db` reviewer login `Loomlyne`, `prevent_self_review` false, `bp` = `{"protected_branches":false,"custom_branch_policies":true}`, branch policies exactly `["main","branch"]`; `live-db-plan` no reviewers, same `bp`, branch policies exactly `["main","branch"]`; `SUPABASE_DB_URL` listed in both environment secret lists; `SUPABASE_DB_URL` NOT listed by the last command (repo-level secrets). Stop if anything differs: no squash merge and no dispatch until this passes. Do not dispatch while `live-db` is missing or has no reviewer.

## 6. `[CONTROLLER after Ship]` Create the ruleset on `main` (D-08)

Only after step 1 passed. Literal D-08: required checks `gate` and `migration-guard` only, repository-admin bypass `always` (the controller must push history commits), `strict_required_status_checks_policy: false` (parallel phase PRs would otherwise force constant rebases).

```bash
# actor_id 5 = repository role "admin"; integration_id 15368 = GitHub Actions app
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
```

Readback (also confirm in Settings > Rules > Rulesets that the bypass list reads "Repository admin"):

```bash
gh api repos/Loomlyne/Clickit/rulesets --jq '.[]|{id,name,enforcement}'
gh api repos/Loomlyne/Clickit/rulesets/<ID>
```

Rollback: `gh api --method DELETE repos/Loomlyne/Clickit/rulesets/<ID>`

Variant, NOT used by default. Signed by Koss at plan gate (was: pending Koss at plan gate); default = NOT included (literal D-08, RESEARCH Open Question 4, signed 2026-10-20): add these two objects to the `rules` array to also block force-push and deletion of `main` by non-admins:

```json
{ "type": "non_fast_forward" },
{ "type": "deletion" }
```

No `pull_request` rule is added: admin bypass is `always`, so it would be cosmetic for the owner; reviews happen outside GitHub (Grok / `reviewer`). RESEARCH A2 (assumed, not verified): with only `required_status_checks`, a non-admin writer (collaborator `clickitstory`) cannot update `main` unless the checks pass on another ref.

## 7. `[CONTROLLER]` Local backup of live before every dispatch (D-03)

`supabase db dump --linked` runs `pg_dump` locally on the Mac against live (read-only) and writes the file there. This is D-03's local `pg_dump`; it is not a CI artifact and is never committed. Output goes only to `/Users/koss/.clickit-backups/`, outside every repo.

```bash
mkdir -p /Users/koss/.clickit-backups
supabase db dump --help   # confirm the flags on CLI 2.119.0 before first use
TS=$(date -u +%Y%m%dT%H%M%SZ)
supabase db dump --linked -f /Users/koss/.clickit-backups/live-$TS-schema.sql
supabase db dump --linked --data-only -f /Users/koss/.clickit-backups/live-$TS-data.sql
```

Uses the Supabase CLI login for project `lajguozmtissnnfccmej`. If it asks for the database password, that is an `[OWNER]` step typed in Koss's own terminal.

Readback: both files non-empty (`test -s`), and `grep -c 'CREATE TABLE' /Users/koss/.clickit-backups/live-$TS-schema.sql` is greater than 0.

## 8. `[CONTROLLER after Ship]` First dispatch: read-only dry-run

```bash
gh workflow run apply-live-migrations.yml --repo Loomlyne/Clickit --ref main -f pg_dump_taken=true
gh run list --repo Loomlyne/Clickit --workflow apply-live-migrations.yml --limit 1
gh run view <id> --repo Loomlyne/Clickit
```

Read the dry-run summary. Expected on the first run: `Remote database is up to date`, job `apply` skipped (live holds all 58 versions; the five edited files kept their versions). This is also the first proof of Node/CLI pins in CI (setup-cli v3.0.1 with CLI 2.119.0).

If the dry-run errors (local file sorting before the last remote version, or a remote version with no local file), stop and bring it to Koss. Never add the include-all flag (Pitfall 4); resolution is a human decision (rename to a later timestamp, or `migration repair`).

## 9. `[OWNER]` Approval rule for any run with pending migrations

Koss reads the dry-run summary, then clicks "Review deployments" and Approve in the Actions UI himself. The controller never calls `POST .../pending_deployments` and never approves. The same GitHub account dispatches and approves, so GitHub cannot tell an agent from Koss: this gate is procedural.

## 10. Moved to step 4b

The repo-level secret is now deleted BEFORE the squash merge (step 4b, review CR-02), not after the first dry-run. Koss signed "delete" at the plan gate (2026-10-20); only the timing moved earlier. Nothing to do here.

## 11. `[OWNER]` SAFE-04 owner gate: plan tier and backups

Supabase dashboard, project `lajguozmtissnnfccmej`: confirm the plan tier and the backup/PITR status (audit section 5 assumes Free with no restorable backup). Record the answer in `.planning/phases/01-safe-ground/01-LIVE-AUDIT.md` section 5.

## 12. `[CONTROLLER after Ship]` CLI reset proof

When a local stack configured from `main` is the only stack. The branch proved the migration chain with psql on a scratch database because the local stack belonged to Phase 1.1; this closes the "CLI reset not run" item. From the main checkout:

```bash
docker exec supabase_db_Clickit pg_dump -U postgres -Fc postgres > /Users/koss/.clickit-checks/p1-local-before-reset.dump
supabase db reset --local
```

Then run the count query used in `/Users/koss/.clickit-checks/p1-scratch-proof.sh` (schema_migrations, shows, seasons, episodes, shorts, cast, migrations). Expected `1|15|21|94|6|45|58`.

## 13. Rollback summary

| What | Rollback |
|------|----------|
| Ruleset | `gh api --method DELETE repos/Loomlyne/Clickit/rulesets/<ID>` |
| Environment | `gh api --method DELETE repos/Loomlyne/Clickit/environments/<name>` |
| Environment secret | `[OWNER]` `gh secret set ... --env <name>` again (overwrites) |
| Repo secret | Do not roll back while `apply-live-migrations.yml` is on `main` (re-adding it reopens the CR-02 bypass). Only together with reverting the workflow, with Koss's word: `[OWNER]` `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit` |
| Workflows and guard | A PR reverting the Phase 1 squash commit (also restores the old push-apply, so only with Koss's word) |

## 14. Notes

- What actually protects live (review CR-02): the DB URL exists only as an environment secret; both environments accept deployments from `main` only; `live-db` requires Koss's approval. The workflow's "Main only" steps are diagnostics.

- The guard in CI is the base branch copy (`git show HEAD^1`), so a PR cannot weaken the guard that judges it. Residual (Pitfall 9, accepted): the Phase 1 PR itself and PRs that edit `pr-gate.yml` are judged by their own text.
- Allow-list `to` SHAs in `scripts/migration-guard.mjs` must be refreshed after any later edit of the five neutralised migrations.
- Deferred, not in this runbook: the leftover `Preview` and `Production` environments (Phase 8), picsum poster URLs, the storage policy inline admin check.
