---
phase: 06-youtube-import-and-player
plan: 01
subsystem: database
tags: [supabase, migration, vault, youtube, rate-limit]
requires: [06-00]
provides:
  - supabase/migrations/20261020150526_youtube_episode_status_and_order.sql
  - src/server/youtube/key.ts (Vault key resolver, per-request cache)
  - src/server/youtube-key.ts
  - src/server/youtube/rate-limit.ts (TODO(phase-2) seam)
  - Phase 6 entries in src/lib/database.types.ts
affects: [06-03, 06-06, 06-07, 06-08, 06-11, 06-16, 06-21, 06-23]
key-files:
  created:
    - supabase/migrations/20261020150526_youtube_episode_status_and_order.sql
    - src/server/youtube/key.ts
    - src/server/youtube-key.ts
    - src/server/youtube/rate-limit.ts
    - tests/unit/youtube-migration.test.ts
    - tests/unit/youtube-key.test.ts
    - tests/unit/youtube-rate-limit.test.ts
  modified:
    - tests/unit/helpers/fake-supabase.ts (gte filter)
    - supabase/seed.sql (unique episode video ids)
    - src/lib/database.types.ts (Phase 6 entries only)
duration: ~1 day elapsed (Task 3 waited on the controller)
completed: 2026-10-20
---

# Phase 6 Plan 01: Expand migration, Vault key and rate-limit seam

**Migration 1 (expand) adds the YouTube check columns, the catalog-wide unique index on `episodes.youtube_video_id`, `renumber_season`, `record_youtube_checks` and the service-role-only Vault key functions; the app reads the key through a per-request cached resolver.**

## Migration

`supabase/migrations/20261020150526_youtube_episode_status_and_order.sql`. Additive only. A duplicate guard stops the migration with a clear message if duplicate video ids exist (live: the controller clears them first, 06-21, D-22).

## Commits

- 583cf72 test: text-level migration test (RED)
- 53774d9 feat: expand migration
- 8508f6a test: Vault key resolver and rate-limit seam (RED)
- da5f091 feat: key resolver (`src/server/youtube/key.ts`, `src/server/youtube-key.ts`), rate-limit seam
- b9465cc fix: seed episodes get unique video ids
- 3caa6cb chore: Phase 6 entries in database types

## Task 3: local apply, types, Vault round trip (2026-10-20 17:49–17:53 CET)

The controller chose option (a): this session applies to the shared local Clickit stack under `/Users/koss/.clickit-heavy.lock`. The stack stays up (shared, disposable); the lock is released after each step.

1. `supabase migration list --local`: the stack matched main exactly; only 20261020150526 was pending.
2. `supabase migration up --local` failed at the duplicate guard: the local seed reused 3 sample ids (`dQw4w9WgXcQ`, `9bZkp7q19f0`, `jNQXAC9IVRw`) across 68 episodes. The guard worked as designed.
3. Fixed `supabase/seed.sql`: episodes 1–3 of the first show's first season keep the three real ids; the other 65 seed episodes get `seedEp00001`…`seedEp00065` (YouTube reports them as "not found", so the local player shows its error card there). Shorts untouched.
4. `supabase db reset --local` (allowed by the controller, under the lock): exit 0; latest migration 20261020150526; 94 episodes, 68 distinct non-empty ids; index `episodes_youtube_video_id_key` exists; all five functions exist.
5. `supabase gen types typescript --local --schema public` (never `npm run gen-types`, which reads live).
6. Vault round trip, fake key `'AIza' || repeat('A',35)` only:
   - service_role: `set_youtube_key` → true; `right(get_youtube_key(), 4)` → `AAAA`; `youtube_key_meta()` → `true|AAAA`.
   - anon: `public.get_youtube_key()` permission denied; `private.get_youtube_key()` permission denied; `vault.decrypted_secrets` permission denied for schema vault.
   - authenticated: the same three, all permission denied.

**Types came from main + Phase 6 migrations only** (controller note).

## Deviations

1. **Seed fix (Rule 3, blocking):** the new unique index made the local seed fail on every `db reset`. The fix is local data only; no migration changed.
2. **Types: Phase 6 entries only, not a full regeneration.** The committed `database.types.ts` already lags main's own migrations, and a full local regen also switches jsonb columns to `NonNullable<Json>` (newer CLI), which breaks `src/app/actions/contact.ts`. To keep the Phase 6 diff small and avoid conflicts with Phases 2–5, only these were added, copied from the generated output in the committed file's style: episodes `youtube_checked_at`, `youtube_duration_seconds`, `youtube_status`, `player_error_at`, `player_error_code` (Row/Insert/Update; the two `player_error_*` columns were first missed and added after 06-09 found the gap); functions `get_youtube_key`, `set_youtube_key`, `youtube_key_meta`, `renumber_season`, `record_youtube_checks`. Drift left out (follow-up for the controller): `reorder_episode`, `get_public_youtube_video_id`, `app_config` auth/hero/live-stream columns, a `show_categories` foreign key, `__InternalSupabase` header, `NonNullable<Json>`.
3. **Renumber offset formula:** phase A shifts rows by `greatest(max,0) - least(min,0) + count + 1`, not a fixed constant, so the temporary numbers can never collide with existing ones.
4. **`tests/unit/helpers/fake-supabase.ts` gained a `gte` filter** for the rate-limit window query.
5. **`withinRateLimitCore` takes `AdminDb`** (the service-role client type) so the seam can be unit tested with the fake.
6. **A fully archived season:** with no live episodes the in-order check is vacuously true, so `renumber_season` raises P0001 "Already numbered 1 to N" (no-op), rather than returning an empty result.

## Verification

- `tests/unit/youtube-migration.test.ts`, `youtube-key.test.ts`, `youtube-rate-limit.test.ts`: 35 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- Plan checks: `youtube_status`, `renumber_season`, `get_youtube_key` all present in `database.types.ts`; the lock is released.
- Not done: `supabase stop` (the controller says the stack is shared and stays up).

## TODO(phase-N)

- `src/server/youtube/rate-limit.ts`: `// TODO(phase-2)` stands in for Phase 2 `decideRateLimit`.
