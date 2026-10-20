# Phase 1 Controller Runbook: environments, secrets, ruleset, backup, first dry-run

**READ FIRST. GitHub auto-creates a missing environment with NO reviewers when a workflow references it.** The controller must create `live-db` (required reviewer `Loomlyne`) and `live-db-plan`, and the ruleset, and read them back BEFORE the Phase 1 PR is squash-merged. The plan is signed, so the controller may do this now. No `Apply live migrations` dispatch happens before that readback (steps 3, 5, 6). Dispatching while `live-db` is missing would let `apply` run unapproved.

Purpose: these are the repo-settings and live steps the Phase 1 work session may not run itself (no live DB, no `gh api` writes, no workflow runs, no settings change). Every step is tagged either `[CONTROLLER after Ship]` (the controller runs it) or `[OWNER]` (one numbered step for Koss in his own terminal or the GitHub UI, then wait). Steps tagged `[CONTROLLER]` only (step 7) are local and read-only against live.

Rules:
- An agent never approves a deployment (RESEARCH Pitfall 11). Approval is Koss clicking in the Actions UI.
- No secret, connection string or password goes into chat, a file, a commit or the PR (the repo is public).
- Heavy local work shares `/Users/koss/.clickit-heavy.lock`.
- Cloudflare is not involved in this runbook. GitHub account is `Loomlyne` (admin).
- Scheduling note: steps 3 to 6 may run before the squash merge (the plan is signed) and must be read back before it. Step 1 (check-run readback) comes first for the ruleset, never the other way round.

## 0. Merge freeze

After the Phase 1 squash merge, no other PR merges to `main` until steps 3 to 6 (environments `live-db` and `live-db-plan`, their secrets, the ruleset) are created AND read back as expected. Phase 2 (`claude/phase-02-execute-19d86a`) edits the same `package.json` scripts block: whoever lands second resolves it with base winning, then re-adding `typecheck`, `guard:migrations` and the `gate:local` order.

## 1. `[CONTROLLER after Ship]` Precondition: check names exist

Needs Koss's Ship. The Phase 1 PR head must have shown check runs named exactly `gate` and `migration-guard` from the GitHub Actions app (id 15368), otherwise the ruleset would block every PR forever (Pitfall 7):

```bash
gh api repos/Loomlyne/Clickit/commits/<PR-head-sha>/check-runs --jq '.check_runs[]|[.name,.app.id,.conclusion]'
```

Expected: `["gate",15368,"success"]` and `["migration-guard",15368,"success"]`. Stop otherwise.

Then squash merge the PR. The squash carries the new workflow without a `push` trigger, so the old auto-apply cannot fire (Pitfall 8; live already holds all 58 versions, nothing would be pending anyway).

## 2. `[OWNER]` Confirm the approving account

Confirm the approving GitHub account is `Loomlyne` (RESEARCH A1, Open Question 2):

```bash
gh api users/Loomlyne --jq .id
```

Expected `223640340`. If that is not the account Koss approves with, stop and tell the controller; steps 3 and 5 change.

## 3. `[CONTROLLER after Ship]` Create the environments (D-02)

`live-db-plan` is the read-only planning environment (no reviewer, `main` only). Signed by Koss at plan gate (was: pending Koss at plan gate); default = create it (RESEARCH Open Question 1), signed 2026-10-20. If Koss declines: skip the `live-db-plan` commands; the dry-run job then reads the repo-level secret and step 10 is skipped.

```bash
# 3a) live-db-plan: no reviewer, main only
gh api --method PUT repos/Loomlyne/Clickit/environments/live-db-plan --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api --method POST repos/Loomlyne/Clickit/environments/live-db-plan/deployment-branch-policies -f name=main -f type=branch

# 3b) live-db: required reviewer Loomlyne, no self-review block, main only
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

## 4. `[OWNER]` Set the environment secrets from his own terminal

Each command prompts for the value (the Supabase Session-pooler connection string). Nothing in chat or in a file. One line, then wait for the controller's readback; then the second line.

1. `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db-plan`
2. `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit --env live-db`

## 5. `[CONTROLLER after Ship]` Read back both environments (stop condition)

```bash
gh api repos/Loomlyne/Clickit/environments/live-db --jq '{name,reviewers:[.protection_rules[]|select(.type=="required_reviewers")|.reviewers[].reviewer.login],prevent_self_review:([.protection_rules[]|select(.type=="required_reviewers")|.prevent_self_review]|first),bp:.deployment_branch_policy}'
gh api repos/Loomlyne/Clickit/environments/live-db/deployment-branch-policies --jq '.branch_policies[]|[.name,.type]'
gh api repos/Loomlyne/Clickit/environments/live-db-plan --jq '{name,reviewers:[.protection_rules[]|select(.type=="required_reviewers")],bp:.deployment_branch_policy}'
gh api repos/Loomlyne/Clickit/environments/live-db-plan/deployment-branch-policies --jq '.branch_policies[]|[.name,.type]'
gh secret list --repo Loomlyne/Clickit --env live-db
gh secret list --repo Loomlyne/Clickit --env live-db-plan
```

Expected: `live-db` reviewer login `Loomlyne`, `prevent_self_review` false, branch policy `["main","branch"]`; `live-db-plan` no reviewers, branch policy `["main","branch"]`; `SUPABASE_DB_URL` listed in both secret lists. Stop if anything differs. Do not dispatch while `live-db` is missing or has no reviewer.

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

## 10. `[OWNER]` Delete the repo-level secret after the first good dry-run

Signed by Koss at plan gate (was: pending Koss at plan gate); default = delete (signed 2026-10-20), only if `live-db-plan` exists with its own secret and step 8 passed:

1. `gh secret delete SUPABASE_DB_URL --repo Loomlyne/Clickit`

Rollback: `[OWNER]` re-adds it with `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit` (prompts for the value).

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
| Repo secret | `[OWNER]` `gh secret set SUPABASE_DB_URL --repo Loomlyne/Clickit` |
| Workflows and guard | A PR reverting the Phase 1 squash commit (also restores the old push-apply, so only with Koss's word) |

## 14. Notes

- The guard in CI is the base branch copy (`git show HEAD^1`), so a PR cannot weaken the guard that judges it. Residual (Pitfall 9, accepted): the Phase 1 PR itself and PRs that edit `pr-gate.yml` are judged by their own text.
- Allow-list `to` SHAs in `scripts/migration-guard.mjs` must be refreshed after any later edit of the five neutralised migrations.
- Deferred, not in this runbook: the leftover `Preview` and `Production` environments (Phase 8), picsum poster URLs, the storage policy inline admin check.
