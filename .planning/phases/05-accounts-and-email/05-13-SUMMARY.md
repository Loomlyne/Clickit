---
phase: 05-accounts-and-email
plan: 13
subsystem: database
tags: [supabase, migration, m1b, outbox, queue, digest, ledger, rls, db-proof, types]
requires: ["05-09", "05-11"]
provides: [M1b migration 20261021151843_phase5_m1b_email_outbox.sql, public.email_outbox, public.notification_sends, public.digest_runs, public.enqueue_email, public.claim_welcome, public.claim_outbox, public.finish_outbox, public.sweep_outbox, public.build_digest, M1a+M1b types in src/lib/database.types.ts]
affects: [05-16, 05-19, 05-20, 05-21, 05-28, 05-35, 05-37, 05-39]
tech-stack:
  added: []
  patterns: ["set-based RPCs with data-modifying CTEs (outbox insert + ledger insert in one statement)", "advisory transaction lock to serialise cron re-delivery and per-address caps", "scratch-DB types merged into the checked-in file as additions only"]
key-files:
  created:
    - supabase/migrations/20261021151843_phase5_m1b_email_outbox.sql
    - supabase/tests/m1b_outbox.sql
    - supabase/tests/m1b_welcome.sql
    - supabase/tests/m1b_digest.sql
  modified:
    - src/lib/database.types.ts
key-decisions:
  - "M1b = supabase/migrations/20261021151843_phase5_m1b_email_outbox.sql (sorts after M1a 20261021142458)"
  - "enqueue_email returns id null for duplicate and capped; admin_all returns one row per admin (queued or duplicate), zero rows when admins is empty"
  - "sweep_outbox also returns 'sending' rows whose lease expired (consumer crash with a lost queue message), besides pending > 15 min and retrying past next_attempt_at"
  - "finish_outbox mirror: any sent support_admin copy makes the message 'sent' and is never downgraded; failed or skipped copies make it 'failed' with notification_error = the reason code"
  - "build_digest and capped enqueue_email take pg_advisory_xact_lock, so concurrent cron or form calls run one after the other"
  - "Digest payload: shows ordered by newest live_at, episodes by season then episode, image_url = card_image_url else hero_url, total_shows = all shows; the model caps to 3 x 3"
  - "Types: generated from the scratch DB, merged into the existing file as additions only (live-only tables email_notifications, user_favorites, watch_history and the __InternalSupabase block kept)"
  - "MAIL-03..07 stay Pending: this plan lands their SQL only"
requirements-completed: []
duration: 12min
completed: 2026-10-21
status: partial (Task 3 step 2 waits for the controller's go)
---

# Phase 5 Plan 13: Migration M1b (outbox, RPCs, digest) Summary

**M1b `20261021151843_phase5_m1b_email_outbox.sql` adds the email outbox, the digest ledger and run table, and six service-role-only RPCs (enqueue with caps and admin fan-out, atomic welcome claim, leased claim, finish with support mirror, sweep, Dubai-dated digest); all proven in a scratch database (exit=0) and typed. The shared local stack is not migrated yet: that step waits for the controller's go.**

## Migration filename (M1b)

`supabase/migrations/20261021151843_phase5_m1b_email_outbox.sql`

## Tasks

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Write M1b (tables and RPCs) | `2a4075a` | done |
| 2 | Prove M1b in the scratch database | `6bfe36d` | done |
| 3 | Step 1: types from the scratch DB | `59c9ef8` | done |
| 3 | Step 2: `supabase migration up --local` on the shared stack | - | **waiting: NEEDS CONTROLLER** |

## What M1b contains

- `email_outbox` (columns, checks and three indexes as planned, plus a partial index on `to_user` for the auth-user cascade and a `char_length(idempotency_key) between 1 and 300` check), `set_updated_at` trigger on the existing `public.update_updated_at()`.
- `notification_sends` (PK user, episode, kind; index on `episode_id` for the episode cascade), `digest_runs` (index on status, window_end).
- All three: RLS on, no policies, `revoke all from public, anon, authenticated`, `grant all to service_role`.
- `enqueue_email(p_kind, p_key, p_to_user, p_to_email, p_admin_all, p_payload, p_locale, p_reply_to)`: everything after `p_key` has a default. Address `lower(btrim())`; reply-to has CR/LF stripped; payload must be a JSON object; no recipient raises; whitespace/control/`<>,;` in the address raises. Existing key gives `duplicate`; support_ack 3 per address per 24 h and newsletter_confirm 1 per 10 min give `capped`; admin_all inserts one row per `admins` row with key `p_key:<admin id>` and that admin's `profiles.locale` (else `en`).
- `claim_welcome(p_user, p_locale default 'en')`: inserts the profile (with the locale) when missing, conditional update on `welcome_sent_at is null`, outbox row `welcome:<user>` on conflict do nothing. Unknown locale becomes `en`.
- `claim_outbox(p_ids)` (SQL function): one `update ... returning`, then joins `auth.users` (address only when `email_confirmed_at is not null`) and `profiles.locale` (fallback row locale). Returns exactly the 05-08 `ClaimedRow` fields.
- `finish_outbox(p_results)`: `jsonb_to_recordset`, one entry per id, statuses sent/retrying/failed/skipped only, rows still `sending` only; sent sets `sent_at` and `provider_id`; retrying keeps `next_attempt_at` (now() when missing); lease cleared; `left(error, 200)`. Mirror into `support_messages` as described in the decisions. Returns the number of outbox rows updated; null or `[]` returns 0.
- `sweep_outbox(p_limit default 100)`: fails stale rows (`stale_over_23h`), then returns ids oldest first; limit clamped to 1..1000.
- `build_digest(p_now default now())`: advisory lock; same-Dubai-date success run returns at once (no run row); `lower = coalesce(max(window_end) of success runs, p_now - 24 h)`; a `running` row with window_start/window_end; candidates = live, visible, unarchived episodes of visible unarchived shows with `live_at in (lower, p_now]` x My List x notify on x confirmed, not deleted users, minus ledger pairs; one outbox row per viewer with key `digest:<user>:<Dubai date>`; ledger pairs only for inserted rows; run marked `success` with the email count; on error marked `failed` and re-raised.
- Every function: `security definer`, `set search_path = ''`, fully qualified names, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.

## Verification

- Task 1: `node scripts/migration-guard.mjs --base origin/main --head HEAD`: 2 files, 0 violations; newest migration is the M1b file. `security definer` 6, `set search_path = ''` 6, `to service_role` 9; no grant to anon/authenticated; no UUIDs, no `@`.
- Task 2: `/Users/koss/.clickit-checks/p5-db-proof.log`: `pre_fixtures=1`, `ok 00_smoke`, `ok m1a_admins`, `ok m1a_episodes_newsletter`, `ok m1a_profiles`, `ok m1b_digest`, `ok m1b_outbox`, `ok m1b_welcome`, `pending_applied=2`, `ok pending_admin_aal2`, `ok pending_anon_revoke`, `scratch_db_left=0`, `shared_db_unchanged=yes`, `lock_released=1`, `exit=0`; `grep -c FAIL` = 0. Plan verify: PASS. `max(window_end)` appears once; `3 days` absent.
- Negative runs (working copy only, restored with `git checkout --`, diff empty afterwards): ledger exclusion disabled gave `FAIL D+1 includes B only (not A again, not C from the ledger)`, exit=1 (`p5-db-proof-neg-ledger.log`); support_ack cap loosened to 30 gave `FAIL support_ack 4th capped: outcome queued`, exit=1 (`p5-db-proof-neg-cap.log`). Both: scratch DB dropped, shared DB unchanged, lock released.
- Task 3 step 1: `/Users/koss/.clickit-checks/p5-db-types.log`: all tests ok, `types_written=src/lib/database.types.ts`, `exit=0`. The CLI's `--db-url` output is unformatted and differs from the live-generated file (no `__InternalSupabase`, `NonNullable<Json>`, `Args: Record<PropertyKey, never>`, no live-only tables, some main columns the old file lacks). I merged only this branch's objects into the existing file in its own style: `git diff --stat` = **223 insertions, 0 deletions**. Prettier check clean; `npx tsc --noEmit` clean.
- Supabase commands used: only `supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:<port>/p5_proof_<pid>` inside db-proof.sh. The package.json `gen-types` script (live project id) was not run. No `link`, no `db push`, no live contact.
- Shared stack read-only check (15:27Z): head `20261021120000 legal_pages_arabic_review`, `email_outbox` and `admins` absent. No Phase 6 migration missing from this branch, so `migration up --local` should apply M1a and M1b without the psql fallback.

## Proof coverage (beyond the plan's list)

- Function-level checks: `prosecdef`, `proconfig = search_path=""`, no EXECUTE for anon, authenticated or PUBLIC, EXECUTE for service_role, for all six.
- Outbox: caps reset after their window; address normalisation (mixed case, spaces); non-object payload raises; admin_all repeat returns two `duplicate`; reply_to CR/LF stripped; finish ignores rows no longer `sending` and unknown statuses; retry keeps the support message `pending`; a later failed copy never downgrades `sent`; sweep skips fresh pending, not-yet-due retrying and leased rows, and honours the limit.
- Welcome: real caller `service_role`; unknown locale `en`; every pre-Phase-5 fixture account gets nothing.
- Digest: archived and draft episodes in the window excluded; image falls back to `hero_url`; shows ordered by newest `live_at`; ledger row inserted by hand excludes that episode; `service_role` repeat on the same date returns nothing.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 2 - Correctness] Sweep also returns expired `sending` rows.** A consumer crash after claim, with the queue message then exhausted to the DLQ, would leave the row `sending` forever (the sweep only listed pending and retrying). `claim_outbox` already reclaims expired leases, so the sweep now re-enqueues them; the 23 h rule still fails old ones first. Tested (`m1b:sw:crash`). Commit `2a4075a`.

**2. [Rule 2 - Concurrency] Advisory locks.** `build_digest` takes a transaction advisory lock (cron delivery may repeat: the second call waits, then sees the success row). Capped `enqueue_email` kinds take a per-kind-and-address lock, so two concurrent submits cannot both pass the cap. Commit `2a4075a`.

**3. [Rule 2 - Correctness] Mirror semantics for several admin copies.** The plan maps sent to `sent` and failed to `failed`; with two admins one copy can fail and one succeed. Any sent copy wins and is never downgraded; `skipped` (admin without a confirmed address) counts as `failed`; `notification_error` gets the reason code (cleared on sent), because the admin inbox already shows that column. Tested.

**4. [Rule 2 - Hardening] Input checks and indexes.** Key length check (1..300), payload must be an object, CR/LF stripped from reply_to, address with whitespace/control/`<>,;` refused, `p_limit` clamped, cascade indexes on `email_outbox.to_user` and `notification_sends.episode_id`, `digest_runs (status, window_end)` index, `u.deleted_at is null` in the digest, `v_lower >= p_now` returns without a run row.

**5. [Rule 1 - Test bug] plpgsql `IF` with an inline `CASE`.** First run failed with a syntax error in `m1b_outbox.sql` (the `then` of the CASE ended the IF condition); wrapped in parentheses. Fixed before the test commit.

**6. [Rule 3 - Tooling] Types merged, not overwritten.** See Verification; the alternative (taking the raw scratch output) would have deleted live-only types other code may use and changed the file's style.

## Not verified

- The failed run's `status = 'failed'` row: because the error is re-raised (as planned), the caller's transaction rolls it back, so the row is never visible; the proof shows the effect that matters (no run row, window unchanged, no ledger rows). If a persistent failed row is wanted, the function must swallow the error; that is a change of contract for 05-20.
- Real concurrency (two sessions): `dblink` is not in the scratch DB; recorded in `m1b_welcome.sql` as "concurrency proven by the conditional update", with a structural check on the function body.
- Live: nothing here touches live; 05-35 applies M1 through the gated workflow.
- `claim_outbox` generated return type marks `to_address`, `reply_to`, `first_attempt_at`, `to_user` as non-null strings (the CLI does not infer nullability for RETURNS TABLE); 05-16's `deps.ts` maps them into the 05-08 `ClaimedRow` type, which has the correct nulls.
- Task 3 step 2 and its verify (shared stack has `email_outbox`): waiting for the controller.

## NEEDS CONTROLLER

`NEEDS CONTROLLER: Phase 5 wants to run supabase migration up --local on the shared supabase_db_Clickit stack (adds M1a/M1b objects; additive; Phase 6 shares this stack). Reply go, or name a time.`

After the go, the next executor runs (detached, under the heavy lock):
`caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' bash scripts/heavy-run.sh supabase migration up --local > /Users/koss/.clickit-checks/p5-migration-up.log 2>&1 &`, waits for `exit=`, uses the W8 psql fallback only if it fails because of another branch's migration, records which path ran, then runs the Task 3 verify. Types need no second generation (step 1 printed `types_written=...`).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-13-01 (RLS/grants, tested as anon and authenticated), T-05-13-02 (caps, tested, plus advisory lock), T-05-13-03 (conditional update, unique key, ledger PK; tested), T-05-13-04 (service_role only; unconfirmed address null; tested) are mitigated. T-05-13-05: expand-only, guard-clean, scratch proof; owner approval stays with 05-35.

## Self-Check: PASSED

- FOUND: supabase/migrations/20261021151843_phase5_m1b_email_outbox.sql, supabase/tests/m1b_outbox.sql, supabase/tests/m1b_welcome.sql, supabase/tests/m1b_digest.sql, src/lib/database.types.ts
- FOUND: 2a4075a, 6bfe36d, 59c9ef8
