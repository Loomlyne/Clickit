# Phase 1: Safe Ground - Context

**Gathered:** 2026-10-20 (answers: Koss, question form via the controller, 13:2x CET)
**Status:** Ready for planning

<domain>
## Phase Boundary

Nothing merged to `main` can damage the live Supabase database, every PR runs a gate (lint, typecheck, unit tests, build, migration guard), and a read-only live audit is on file. Requirements SAFE-01..05. No live write in this phase: the live migration apply, the GitHub ruleset and the `live-db` environment approver are controller/owner steps after the plan is signed. Vercel keeps serving.

Already done before planning (do not redo): SAFE-04 live audit (`01-LIVE-AUDIT.md`, live history = 58/58 files) and SAFE-05 evidence (NS = jen/brett only).

</domain>

<decisions>
## Implementation Decisions

### Live migration path (SAFE-02)
- **D-01:** Remove the `push: main` trigger and the auto `db push` from `.github/workflows/supabase-migrations.yml`. Replace with a hand-started (`workflow_dispatch`, `main` only) "Apply live migrations" workflow: job 1 runs `supabase db push --dry-run` against live and prints the pending list; job 2 `needs` job 1, runs in GitHub environment `live-db` (Koss = required reviewer) and only then applies. No `--include-all` on the apply: an out-of-order pending version must fail and come back to a human.
- **D-02:** The `live-db` environment (required reviewer Koss, deployment branch `main` only) is created by the controller with `gh api` after the plan is signed. The plan gives the exact command; this session does not run it.
- **D-03:** Before every live apply, the controller takes a local `pg_dump` on the Mac (never a CI artifact: the repo is public). Audit shows no backups and PITR off.

### Destructive-SQL guard (SAFE-02)
- **D-04:** Check `migration-guard` fails when an added or changed file under `supabase/migrations/` contains `drop`, `truncate` or `delete` (case-insensitive, SQL comments stripped) on a line that does not carry `-- safe-drop: <reason>`.
- **D-05:** It also fails when a migration file that exists on the base branch is modified, renamed or deleted. Exception: the exact Phase 1 neutralisation list (D-09, D-10) is allowed once, keyed by file path in the guard's allow-list for this PR's base only (or by a marker the planner chooses), so later edits to those files fail again.
- **D-06:** Guard is a Node script in the repo (no new dependency), run locally and in CI, proven by a fixture test under `tests/` (clean migration passes; drop without waiver fails; drop with waiver passes; edit/rename of an applied file fails). The workflow is never run on GitHub to test it.

### PR CI (SAFE-03)
- **D-07:** New workflow on `pull_request` (opened, synchronize, reopened) to `main`: Linux only (`ubuntu-latest`), `concurrency` per PR with `cancel-in-progress: true`, `timeout-minutes` on every job, `paths-ignore` for `**.md`, `docs/**`, `.planning/**`. Jobs named exactly `gate` and `migration-guard`. `gate` runs `npm ci`, lint, typecheck (`tsc --noEmit`), unit tests, `next build` with placeholder public env (see CLAUDE.local.md gate facts). It calls the steps, not `npm run gate:local` (Phase 2's branch adds Mac-only `cf:build` to `gate:local`). Actions pinned to SHAs, `permissions: contents: read`, no secrets. Note: `paths-ignore` on a required check leaves docs-only PRs "expected"; the planner handles this (e.g. guard job always runs and is cheap, or a no-op pass).
- **D-08 (ruleset):** Ruleset on `main` requiring checks `gate` and `migration-guard`, admin bypass kept. Plan carries the exact `gh api repos/Loomlyne/Clickit/rulesets` command; the controller runs it after signing.
- `npm run gate:local` stays the local gate; add a `typecheck` script and include it.

### Seed and destructive migrations (SAFE-01)
- **D-09:** `20260401000000_create_schema.sql`: DROP block becomes a no-op in place (comment out / remove the drop statements, keep file name and version, header note why). Fresh databases are unaffected (all were `if exists`).
- **D-10:** Fake data moves to `supabase/seed.sql` (local `db reset` only): shows/seasons/episodes from `20260401000003_seed_data.sql`, `20260425000001_seed_example_shorts.sql`, `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql`. Those migration bodies become no-ops, except the `app_config` row insert, which stays in `20260401000003` as insert-if-missing (`on conflict (id) do nothing`). `20260605000003_seed_legal_and_faqs.sql` (real copy) untouched. `20260418000000_expand_app_config.sql` (flagged in PITFALLS) checked: no inserts, only an `update storage.buckets`; untouched.
- **D-11:** Prove on the local stack `supabase_db_Clickit` (port 55322, already running; never a second stack): `supabase db reset` applies all migrations + seed.sql cleanly, and the app's tables/`app_config` row exist. Live history is unaffected (files keep versions; live already has all 58).

### Claude's Discretion
- Guard regex details, comment stripping, script language (Node `.mjs` to match `scripts/`).
- Workflow file names; whether the old `supabase-migrations.yml` is rewritten in place or replaced.
- How docs-only PRs satisfy required checks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and rules
- `.planning/ROADMAP.md` §"Phase 1: Safe Ground" — goal, success criteria, owner gates
- `.planning/REQUIREMENTS.md` SAFE-01..05
- `.planning/prompts/00-common-rules.md` — work-session rules, heavy-step lock, hand-over format
- `/Users/koss/Developer/Clickit/CLAUDE.local.md` — controller facts, CI rule 4, clean-clone build env
- `.planning/research/PITFALLS.md` §"Pitfall 1" and the CI/deploy pitfall (actions pinned, no HOME login in CI)

### Evidence already gathered
- `.planning/phases/01-safe-ground/01-LIVE-AUDIT.md` — live history 58/58, `private.is_admin()`, media columns, backups
- `.planning/phases/01-safe-ground/01-DISCUSS-QUESTIONS.md` — the six questions and facts

### Files changed
- `.github/workflows/supabase-migrations.yml`
- `supabase/migrations/20260401000000_create_schema.sql`, `20260401000003_seed_data.sql`, `20260425000001_seed_example_shorts.sql`, `20260506115421_seed_fake_show_cast.sql`, `20260506120139_add_fake_cast_images.sql`
- `supabase/config.toml` (`db.seed.sql_paths = ["./seed.sql"]`, file missing today)
- `package.json` scripts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/*.mjs`: Node script style for the guard.
- `tests/unit/*.test.ts` run by `node --test` with strip-types: fixture test for the guard fits here.
- `supabase-migrations.yml` already pins `actions/checkout` and `supabase/setup-cli` to SHAs with CLI 2.102.0: reuse the pins.

### Established Patterns
- Build in CI needs placeholder `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SITE_URL` (clean-clone build fails otherwise).
- Heavy steps (build, gate) under `/Users/koss/.clickit-heavy.lock`, detached, logs in `/Users/koss/.clickit-checks/p1-*.log` with `exit=`.

### Integration Points
- Phase 2 branch `claude/phase-02-execute-19d86a` edits `package.json` scripts (`gate:local` + `cf:*`): expect a small merge conflict; base wins, re-add `typecheck`.
- Phase 3 URL rewrite must include `app_config.footer_content` jsonb (audit §3).

</code_context>

<specifics>
## Specific Ideas

- Koss's Q3 answer overrides his general "CI once on PR open" rule for this repo only, because it is public (free Linux minutes).

</specifics>

<deferred>
## Deferred Ideas

- Remove the 3 picsum posters on live (live write) — Phase 7/8 placeholder purge.
- Move the inline admin check in storage policy `Admin manage site-assets` to `private.is_admin()` — with Phase 5's `admins` table.
- Nightly read-only drift check (live `schema_migrations` vs files) as an automation agent — proposal only.
- Jev risk score on migration diffs (allow/confirm/block) beside the guard — proposal only.
- Delete unused GitHub environments `Preview`/`Production` (Vercel leftovers) — Phase 8.

</deferred>

---

*Phase: 01-safe-ground*
*Context gathered: 2026-10-20*
