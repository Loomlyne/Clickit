---
phase: 05-accounts-and-email
plan: 05
subsystem: catalog-reads
tags: [supabase, service-role, rls, server-only, auth-08]
requires: ["05-00"]
provides: [createCatalogClient]
affects: [05-14, 05-37]
tech-stack:
  added: []
  patterns: ["server-only service-role read client that degrades to null without the key"]
key-files:
  created:
    - src/server/catalog-client.ts
    - tests/unit/catalog-client-source.test.ts
  modified:
    - src/lib/queries.ts
key-decisions:
  - "createCatalogClient() returns null (one console.error per process) when NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing; the four queries return [] so a clean-clone build cannot throw"
  - "Only the four episodes_view catalog reads moved; every other createPublicClient() caller is unchanged"
  - "AUTH-08 stays Pending: this plan only removes the catalog's dependence on anon EXECUTE; the revoke itself ships in M3 (05-14/05-37)"
requirements-completed: []
duration: 2min
completed: 2026-10-21
---

# Phase 5 Plan 05: Catalog client for episodes_view Summary

**getNewEpisodes, getEpisodesByShowId, getEpisodesBySeasonId and getComingSoonEpisodes now read `episodes_view` through a server-only service-role client, so the M3 anon EXECUTE revoke on `get_public_youtube_video_id` cannot empty the catalog (F1).**

## Performance

- Start: 2026-10-21T14:02:28Z
- End: 2026-10-21T14:04Z
- Tasks: 2 of 2
- Files: 3 (2 created, 1 modified)

## Accomplishments

- `src/server/catalog-client.ts`: `import 'server-only'`, `createCatalogClient(): SupabaseClient<Database> | null`, `persistSession: false`, `autoRefreshToken: false`; logs `[catalog] service role key missing; catalog episode reads return empty` once and returns null without the key.
- `src/lib/queries.ts`: in exactly the four functions, `const supabase = createPublicClient()` became `const supabase = createCatalogClient()` + `if (!supabase) return []`. `unstable_cache` key arrays, `revalidate` and `tags` unchanged. All four already return arrays, so `[]` is their existing empty value.
- `tests/unit/catalog-client-source.test.ts` (6 tests): each of the four function bodies calls `createCatalogClient()` and never `createPublicClient()`; catalog-client keeps `import 'server-only'`; no file under `src/components` and no `'use client'` file imports `@/server/catalog-client`.

## Task Commits

1. Task 1: createCatalogClient and the four query switches: `776789f`
2. Task 2: source test pinning the switch: `da00a72`

## Verification

- `grep -c "createCatalogClient()" src/lib/queries.ts` = 4; `import 'server-only'` present once in catalog-client.ts.
- `npx tsc --noEmit -p tsconfig.json`: clean (whole project).
- eslint on the three files: clean.
- Source test: 6/6 pass. Negative check: reverting `getEpisodesBySeasonId` to `createPublicClient()` made its test fail (5 pass, 1 fail); the file was restored and the test went back to 6/6.
- Full unit suite: 2083/2083 pass.
- Client components that import `@/lib/queries` use `import type` only (checked), so the new server-only import adds no client bundle risk; queries.ts already imported the server-only admin client.

## Not verified

- Clean-clone `next build` with placeholder env (the no-key path returning [] at build): not run here (heavy step; runs in `gate:local` before the phase PR).
- Behaviour against a database with anon EXECUTE revoked: belongs to M3 (05-14/05-37).

## Deviations from Plan

None - plan executed exactly as written. (Small hardening inside the planned test: the `'use client'` check matches the directive on any line, not only the first, so a leading comment cannot hide it.)

## Threat Flags

None. The service-role client is new surface but it is the planned T-05-05-01 mitigation (server-only, four read queries, source test forbids client imports).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/server/catalog-client.ts
- FOUND: tests/unit/catalog-client-source.test.ts
- FOUND: 776789f
- FOUND: da00a72
