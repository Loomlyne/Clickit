---
phase: 05-accounts-and-email
plan: 09
subsystem: database
tags: [supabase, migration, m1a, rls, admins, profiles, live_at, newsletter, db-proof]
requires: ["05-01"]
provides: [M1a migration 20261021142458_phase5_m1a_accounts.sql, public.admins, public.am_i_admin, public.list_admins, profiles account columns, episodes.live_at, newsletter opt-in columns, pre_* fixture ordering in db-proof]
affects: [05-13, 05-14, 05-35, 05-36]
tech-stack:
  added: []
  patterns: ["service-role-only table with RLS on and no policies", "security-invoker BEFORE UPDATE trigger that pins system columns for API roles", "updated_at trigger paused (if present) around a backfill so optimistic-concurrency versions do not move"]
key-files:
  created:
    - supabase/migrations/20261021142458_phase5_m1a_accounts.sql
    - supabase/tests/pre_phase5_app_config.sql
    - supabase/tests/m1a_admins.sql
    - supabase/tests/m1a_profiles.sql
    - supabase/tests/m1a_episodes_newsletter.sql
  modified:
    - scripts/db-proof.sh
    - supabase/tests/README.md
key-decisions:
  - "M1a = supabase/migrations/20261021142458_phase5_m1a_accounts.sql (later plans refer to it as M1a); sorts after 20261021120000 (main) and 20261020150526 (Phase 6)"
  - "public.admins is created empty; the migration never mentions app_config (D-16)"
  - "Backfills of profiles and episodes do not bump updated_at: the set_updated_at trigger is disabled and re-enabled around each backfill inside the migration transaction, only if it exists (admin saves use updated_at as a version; the sitemap uses it as lastmod)"
  - "db-proof.sh runs pre_*.sql fixtures once, just before the first *_phase5_* migration; without one they still run before supabase/pending"
  - "Requirements AUTH-03, AUTH-05, AUTH-07, MAIL-03, MAIL-04, MAIL-06 stay Pending: this plan lands only their schema"
requirements-completed: []
duration: 8min
completed: 2026-10-21
---

# Phase 5 Plan 09: Migration M1a (additive) Summary

**M1a `20261021142458_phase5_m1a_accounts.sql`: empty service-role-only `public.admins` with `am_i_admin()`/`list_admins()`, five profile account columns backfilled so no existing person is mailed or asked for a password, a trigger-maintained server-only `episodes.live_at`, and newsletter `pending` status plus confirm columns, all proven in a scratch database (exit=0).**

## Final migration filename (M1a)

`supabase/migrations/20261021142458_phase5_m1a_accounts.sql`

## Tasks

1. **Write M1a** (`2636034`). Contents in order: `public.admins` (RLS on, no policies, revoked from public/anon/authenticated, CRUD to service_role); `public.am_i_admin()` (security definer, `search_path = ''`, execute for authenticated and service_role only, commented as a routing hint); `public.list_admins()` (name, email, verified-TOTP yes/no, last sign-in; service_role only); profiles `locale` (en/ar), `onboarded_at`, `password_set_at`, `welcome_sent_at`, `notify_new_episodes` (default true, Q15 = A), missing-profile insert, backfill (`welcome_sent_at = now()`, `password_set_at = auth.users.created_at`, `onboarded_at = now()` only where a display name exists); `profiles_protect_system_columns` trigger (`private.protect_profile_system_columns()`, security invoker) pinning `welcome_sent_at` and `password_set_at` when `current_user` is `authenticated` or `anon`; `episodes.live_at` + `episodes_set_live_at` trigger (BEFORE INSERT OR UPDATE OF status, publish_at; visible = `published` or `coming-soon` with `publish_at <= now()`, matching the real `episodes_status_check`), backfill `least(coalesce(publish_at, created_at), now())`, partial index `idx_episodes_live_at`; `live_at` NOT added to the anon/authenticated column grants; `newsletter_subscribers_status_check` (real name confirmed on the local stack) dropped with a same-line waiver and re-added with `pending`; `confirmed_at`, `confirm_sent_at`, `locale` (default `en`, en/ar). No existing newsletter row updated (D-33).
2. **Prove M1a** (`2ebf293`). `db-proof.sh` now runs `supabase/tests/pre_*.sql` just before the first `_phase5_` migration. Fixture `pre_phase5_app_config.sql` sets `app_config.admin_user_id` to a test account, leaves one account without a profile (live shape: 3 users, 2 profiles) and one with a display name. Three assertion files: `m1a_admins` (fixture ran and admins still empty; RLS on, no policies; anon and authenticated denied; `am_i_admin` true/false; `list_admins` denied for authenticated and anon, `has_totp` false, false for an unverified factor, true for a verified one), `m1a_profiles` (every user has a profile, backfill values, onboarded only where named, defaults, locale check, service_role can set system columns, the user cannot but can still change display name, notify flag and locale), `m1a_episodes_newsletter` (seeded visible episodes have `live_at`, hidden do not, `live_at` not selectable by browser roles, insert/update cases, `live_at` does not move later, `pending` accepted, `bogus` and locale `fr` rejected, old `active` still accepted, columns and defaults).

## Verification

- `node scripts/migration-guard.mjs --base origin/main --head HEAD`: 1 file checked, 0 violations. `ls supabase/migrations | tail -1` is the M1a file.
- No unwaived drop/delete/truncate; no UUIDs; no `@` outside comments; no `app_config` in the migration.
- Detached proof `/Users/koss/.clickit-checks/p5-db-proof.log`: `pre_fixtures=1` (printed before `migrations_applied=ok`), `ok 00_smoke`, `ok m1a_admins`, `ok m1a_episodes_newsletter`, `ok m1a_profiles`, `scratch_db_left=0`, `shared_db_unchanged=yes`, `lock_released=1`, `exit=0`. Plan verify command: PASS.
- Negative runs (migration triggers removed in the working copy only, restored with `git checkout --` afterwards): `FAIL visible episodes have live_at: 68 without` and `FAIL user cannot change system columns: welcome ... -> <NULL>`, both `exit=1`, shared DB unchanged. The tests catch the regressions they claim to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Backfills keep updated_at**
- **Found during:** Task 1
- **Issue:** the backfill UPDATEs would fire `set_updated_at` and bump `updated_at` on every visible episode and every profile on live; admin saves use `updated_at` as an optimistic-concurrency version (an open editor would get a save conflict) and the sitemap uses it as lastmod.
- **Fix:** each backfill is wrapped in a `do $$` block that disables `set_updated_at` (only if the trigger exists, so a live schema difference cannot abort the migration) and re-enables it right after, inside the migration transaction.
- **Commit:** 2636034

**2. [Rule 2 - Test coverage] Fixture covers the missing-profile and named-profile cases**
- **Found during:** Task 2
- **Issue:** the plan's fixture only set `app_config.admin_user_id`; without an account lacking a profile, "every auth user has a profile after backfill" would pass trivially (the signup trigger creates profiles).
- **Fix:** the same fixture file also creates an account whose profile is removed and one with a display name. Still one file (`pre_fixtures=1`).
- **Commit:** 2ebf293

**3. [Rule 2] Extra hardening in M1a**
- `revoke all ... from public, anon, authenticated` on the two private trigger functions; partial index on `episodes.live_at` for the digest window query (05-13).
- **Commit:** 2636034

## Not proven here

- The `episodes.live_at` backfill statement ran on an empty `episodes` table: the scratch seed runs after all migrations and refuses to run if shows exist, so the fixture cannot create pre-M1a episodes. Seeded episodes got `live_at` from the trigger. The backfill's row effect on live data is checked when M1 is applied (05-35).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-05-09-01..07 mitigated and tested).

## Self-Check: PASSED
