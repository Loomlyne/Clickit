# Phase 1: Safe Ground — discuss gate (questions for Koss)

Status: waiting for Koss at the discuss gate (2026-10-20). CONTEXT.md is written after his answers.
Session: work session P1, branch `claude/phase-01-safe-ground-dc6bbe` from `origin/main` cfbc8fb.

## What this phase delivers

Nothing merged to `main` can damage the live database, every PR runs a gate, and a read-only audit of live is on file.
Requirements: SAFE-01..05. Vercel keeps serving; no live write happens in this phase.

## Facts found (read-only, 2026-10-20)

1. `.github/workflows/supabase-migrations.yml` runs `supabase db push --include-all` against live on every push to `main` that touches `supabase/migrations/**`. No dry-run, no human approval. Secret `SUPABASE_DB_URL` is set in the repo.
2. There is no PR workflow at all today. `main` has no branch protection (GitHub API: "Branch not protected"). GitHub environments `Preview` and `Production` exist with no protection rules (Vercel leftovers).
3. The repo `Loomlyne/Clickit` is **public**. GitHub Actions on standard Linux runners are free for public repos, so the 3,000-minute private-repo limit does not apply here.
4. `20260401000000_create_schema.sql` starts with `drop table if exists ... cascade` on shows, seasons, episodes, profiles, watch_progress, watchlist, and drops `is_admin()`.
5. Fake-data migrations: `20260401000003_seed_data.sql` (15 shows with seasons/episodes, **also inserts the `app_config` row the app needs**), `20260425000001_seed_example_shorts.sql` (6 shorts, one is a Rick Astley video id), `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql` (Unsplash faces). `20260605000003_seed_legal_and_faqs.sql` holds the real Terms/Privacy copy (update-only).
6. 14 existing migration files contain `drop`/`truncate`/`delete` (mostly `drop policy if exists` before a re-create). `supabase/config.toml` points `db.seed` at `./seed.sql`, which does not exist.
7. `gate:local` = lint + unit tests + `next build` (build includes the TypeScript check).
8. Admin check: `private.is_admin()` is created in `20260724115941_restrict_public_episode_access.sql`, which drops `public.is_admin()`. Whether live has it is unverified.
9. A read-only path to live exists: the Supabase CLI on this Mac is logged in and sees project `lajguozmtissnnfccmej` (Clickit Story, ap-southeast-1, ACTIVE_HEALTHY). The Supabase Management API has a read-only SQL endpoint that runs as a read-only database role. Not used yet.
10. SAFE-05: `dig NS clickitstory.ae` → `jen.ns.cloudflare.com`, `brett.ns.cloudflare.com` only. ignat/nataly are gone; SAFE-05 closes by the NS move with this dig as evidence. No question.

## Questions (one decision each, recommended option first)

### Q1. How does a migration reach the live database after this phase?

- **A (recommended): Approval-gated apply.** Auto-apply on push is removed. A separate "Apply live migrations" workflow is started by hand on `main`; it shows the dry-run list, then waits in a GitHub environment `live-db` where **you** are the required approver; only after your click does it apply. Example: PR adds `20261101_add_admins.sql` → you merge → controller starts the workflow → you see "would apply: 20261101_add_admins" → you approve → applied.
- B: No CI apply at all. CI only dry-runs; the controller applies from the Mac after your word in chat and reads the result back.
- C: Keep auto-apply on push to `main`, but pause it in the `live-db` environment for your approval.

### Q2. What does the destructive-SQL check block, and how is a needed drop allowed?

- **A (recommended):** Any `drop`, `truncate` or `delete` in a **new or changed** migration file fails the check unless that line carries `-- safe-drop: <reason>`, which the PR review must accept. Editing or renaming an already-applied migration file also fails (except the one-time Phase 1 neutralisation). Example: `drop policy "x" on shows;` before re-creating it needs `-- safe-drop: replacing policy x`.
- B: Same, but only data-losing statements are checked (`drop table/column/schema`, `truncate`, `delete`); `drop policy/trigger/index/view/function` pass without a waiver.
- C: No waiver at all: any drop/truncate/delete fails, and you merge it yourself with an admin override.

### Q3. When does PR CI run, given a fix push after the PR opens?

The repo is public, so Linux Actions minutes are free here; your rule "once on PR open" exists to save private-repo minutes.
- **A (recommended):** Runs on PR open and on every later push to that PR (latest run cancels the older one), Linux only, `paths-ignore` docs/.planning, `timeout-minutes`. The merge button always reflects the latest commit. Example: PR opens → green; controller pushes a fix → re-runs once → green again.
- B: Runs once on PR open only (your general rule). After a fix push, the controller re-runs it by hand (`workflow_dispatch` on the branch) so the latest commit gets a check.
- C: Runs on PR open only; fix pushes are not re-checked by CI, only by `npm run gate:local` on the Mac.

### Q4. Should a red check actually block the merge button on `main`?

This needs a GitHub ruleset on `main` (a repo setting: one numbered step for you, or the controller sets it with `gh api` after your word).
- **A (recommended):** Ruleset on `main`: PRs need the checks `gate` and `migration-guard` green. Admin bypass stays on so the controller can still push its "record history" commits. Example: a PR with a lint error shows red and the merge button is disabled for non-admins.
- B: Ruleset without admin bypass: nothing reaches `main` except through a green PR (the controller's history-record pushes would also need a PR).
- C: No ruleset; the check is advisory and the controller never merges red.

### Q5. What happens to the fake-data migrations?

The files stay with their versions (deleting a file that live already applied breaks `db push`); their bodies become no-ops. Live rows are not touched in this phase.
- **A (recommended):** Fake shows, shorts and cast move to `supabase/seed.sql` (runs only on a local `supabase db reset`, never on live). The `app_config` row insert stays in the migration as "insert if missing". The legal/FAQ migration (real copy) is left as is. Example: a fresh local stack still gets 15 demo shows; live can never get them again from a migration.
- B: Fake data is removed from the repo entirely; local stacks start empty except `app_config`.
- C: Also neutralise the legal/FAQ migration (real copy then lives only in the live DB and admin UI).

### Q6. How is the live audit read (SAFE-04)?

- **A (recommended):** This session runs the audit SELECTs itself through the Supabase Management API **read-only** SQL endpoint (read-only database role, cannot write), using the CLI login already on this Mac. Plan and backups are read from the same API (GET only). Output is saved to `01-LIVE-AUDIT.md`. Example: `select version from supabase_migrations.schema_migrations order by 1` → compared to the 58 files.
- B: This session writes the SQL file; the controller or you run it in the Supabase dashboard SQL editor and paste the results back.
- C: You check plan and backups in the dashboard (one numbered step); the SQL part goes as in A.

## Not asked (decided by the plan, within the rules)

- First migration's DROP block becomes a no-op in place (fresh databases are unaffected; the drops were `if exists`).
- Any live-history mismatch is recorded with the exact `supabase migration repair` commands; running them is the controller's, after your word.
- A local `pg_dump` before each live apply is the controller's step on the Mac (never a CI artifact: the repo is public).
- Guard proven by a local script against fixtures; the workflow is not run on GitHub to test it.
