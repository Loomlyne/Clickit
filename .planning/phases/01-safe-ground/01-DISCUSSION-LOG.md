# Phase 1: Safe Ground - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 01-safe-ground
**Areas discussed:** live migration path, destructive-SQL guard, PR CI triggers, merge blocking, fake-data migrations, live audit read path
**How:** questions written to `01-DISCUSS-QUESTIONS.md` by work session P1; Koss answered in the controller's question form (13:2x CET); relayed by "Clickit controller".

| # | Area | Options | Selected |
|---|------|---------|----------|
| Q1 | Live migration path | A approval-gated hand-started apply in env `live-db` / B controller applies from Mac / C keep push auto-apply with approval | A |
| Q2 | Destructive guard | A any drop/truncate/delete needs `-- safe-drop:`; applied-file edits fail / B only data-losing statements / C no waiver, admin override | A |
| Q3 | PR CI triggers | A open + every push, cancel-in-progress / B open only, manual re-run / C open only, local gate for fixes | A (overrides his "once on open" rule for this public repo) |
| Q4 | Merge blocking | A ruleset `gate` + `migration-guard`, admin bypass / B no bypass / C advisory | A — controller runs the `gh api` after plan signing |
| Q5 | Fake-data migrations | A move to `supabase/seed.sql`, app_config insert-if-missing, legal untouched / B remove fake data / C also neutralise legal | A |
| Q6 | Live audit read | A session runs SELECTs via Management API / B dashboard paste / C owner dashboard for plan | A — already run 13:18 CET via `supabase db query --linked` (SELECT-only) |

## Claude's Discretion
- Guard implementation details, workflow file names, docs-only PR handling for required checks.

## Deferred Ideas
- picsum poster cleanup on live; storage policy inline admin check; nightly drift agent; Jev migration risk score; delete Vercel GitHub environments.
