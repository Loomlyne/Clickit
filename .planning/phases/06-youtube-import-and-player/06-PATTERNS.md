# Phase 6: YouTube Import and Player - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 41 new or modified
**Analogs found:** 38 / 41 (3 have no direct analog; see "No Analog Found")

## How to read the analog paths

- **main** = exists on this branch today, read from the worktree.
- **UPSTREAM** = "upstream (not on main yet)". Lives on `origin/claude/phase-02-execute-19d86a`. Read with `git show origin/claude/phase-02-execute-19d86a:<path>`. Line numbers below are from that ref (read 2026-10-20, tip `c2e57a6`). Phase 6 ships after Phases 1.1/2/5 are merged, so plan against these files as if they were on main.
- Zsh note for anyone re-reading: write `${U}:path`, not `$U:path` (zsh treats `:s...` as a modifier).
- Pure-module rule (all UPSTREAM cores follow it, new pure modules must too): no `next/*`, no `server-only`, no `@/` alias, sibling imports end in `.ts`, type-only imports from `./ports` are extensionless. This is what lets `node --test --experimental-strip-types` load them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/youtube/urls.ts` (new) | utility | transform | `src/lib/youtube.ts` `validateYouTubeUrl` (main) | exact |
| `src/server/youtube/duration.ts` (new) | utility | transform | `src/app/api/youtube-meta/route.ts` `parseIsoDuration` (main, lines 238-243) | exact (extend) |
| `src/server/youtube/status.ts` (new) | utility | transform | `src/lib/admin/guards.ts` (UPSTREAM, pure result type) | role-match |
| `src/server/youtube/client.ts` (new) | service | request-response | `src/lib/arabic-text.ts` `translateBatchStrictCore` (UPSTREAM, injected `fetchImpl`) | exact |
| `src/server/youtube/script.ts` (new) | utility | transform | `src/lib/arabic-text.ts` `hasArabicScript` (UPSTREAM) | exact |
| `src/server/youtube/plan.ts` (new) | utility | transform | `src/lib/admin/show-schedule.ts` `planShowScheduleCore` (UPSTREAM) | role-match |
| `src/server/youtube/key.ts` (new) + thin wrapper | utility/config | request-response | `src/server/cloudflare.ts` `getWorkerEnv` (UPSTREAM) | exact |
| `src/lib/admin/youtube-import.ts` (new) | service (core) | CRUD + batch | `src/lib/admin/season-episode-writes.ts` `createSeasonCore` (UPSTREAM) | exact |
| `src/lib/admin/youtube-check.ts` (new) | service (core) | batch | `src/lib/admin/season-episode-writes.ts` + `publish-scheduled/route.ts` | role-match |
| `src/lib/admin/episode-lifecycle.ts` + `renumberSeasonCore` (modify) | service (core) | CRUD (RPC) | `reorderEpisodeCore` same file (UPSTREAM 254-407) | exact |
| `src/lib/admin/schemas.ts` (modify: playlist/video/commit schemas) | model | transform | same file (UPSTREAM 1-81) | exact |
| `src/lib/admin/show-schedule.ts` (modify: `episodeIds` filter) | service (core) | CRUD | same file (UPSTREAM 34-91) | exact |
| `src/lib/audit.ts` (modify: allow `renumber`/key-test diff only; types unchanged) | utility | event-driven | itself (UPSTREAM 19-55) | exact |
| `src/app/[locale]/admin/actions.ts` (modify: 6 wrappers, remove `youtube_api_key`) | controller | request-response | UPSTREAM `reorderEpisode` wrapper 955-980 + `runAdminAction` | exact |
| `src/app/api/cron/youtube-recheck/route.ts` (new) | route | batch | `src/app/api/cron/publish-scheduled/route.ts` (UPSTREAM) | exact |
| `src/server/cron-schedule.ts` (modify) | config | event-driven | itself (UPSTREAM 5-8) | exact |
| `wrangler.jsonc` (modify: comment/list only) | config | event-driven | itself (UPSTREAM 13-20) | exact |
| `src/server/cloudflare.ts` (modify: `WorkerEnv.YOUTUBE_API_KEY?`) | config | request-response | itself (UPSTREAM 21-33) | exact |
| `supabase/migrations/<ts>_youtube_import_and_status.sql` (new) | migration | CRUD | `20260724115941_restrict_public_episode_access.sql` lines 291-410 (main) | exact |
| `src/lib/watch/resume.ts` (new) | utility | transform | `use-progress-tracker.ts` `save` (main 22-60) | role-match |
| `src/lib/watch/player-errors.ts` (new) | utility | transform | `youtube-player.tsx` `getErrorMessage` (main 101-109) | exact |
| `src/lib/queries.ts` `getEpisodesProgress` (modify) | service | CRUD (read) | itself (main 1011-1034) | exact |
| `src/hooks/use-progress-tracker.ts` (modify) | hook | event-driven | itself (main) | exact |
| `src/components/watch/youtube-player.tsx` (modify) | component | event-driven | itself (main) | exact |
| `src/components/watch/watch-shell.tsx` (rewrite layout) | component | event-driven | itself (main) | exact |
| `src/components/watch/autoplay-overlay.tsx` (becomes up-next card) | component | event-driven | itself (main) | exact |
| `src/components/watch/episode-tray.tsx` (static list, no Vaul) | component | request-response | itself (main) | exact |
| `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` (modify) | route (RSC) | request-response | itself (main) | exact |
| `src/components/admin/import-playlist-sheet.tsx` (new) | component | request-response | `schedule-episodes-button.tsx` (preview-then-commit) + `ui/sheet.tsx` | role-match |
| `src/components/admin/schedule-episodes-button.tsx` (modify: `episodeIds`, controlled open) | component | request-response | itself (main) | exact |
| `src/components/admin/episodes-table.tsx` (modify: badges, Renumber, error toast) | component | CRUD | itself (main) | exact |
| `src/app/[locale]/admin/shows/[id]/page.tsx` (modify) | route (RSC) | request-response | itself (main) | exact |
| `src/components/admin/episode-form-drawer.tsx` `YouTubeFetchButton` (modify) | component | request-response | itself (main 478-548) | exact |
| `src/components/admin/settings/advanced-tab.tsx` (key field to status) | component | request-response | itself (main 215-250) | exact |
| `src/app/[locale]/admin/settings/page.tsx` (modify) | route (RSC) | request-response | itself | exact |
| `src/lib/config.ts` (remove `getYouTubeApiKey`) | config | CRUD | itself (main 467-478) | exact |
| `src/app/api/youtube-meta/route.ts` (delete) | route | request-response | n/a, replaced by Server Action | n/a |
| `src/messages/en.json`, `ar.json` (modify) | config | transform | existing `player` / `watch` namespaces (main en.json 216-235) | exact |
| `tests/unit/youtube-*.test.ts`, `watch-*.test.ts`, `admin-renumber*.test.ts` (new) | test | request-response | `tests/unit/admin-episode-lifecycle.test.ts` (UPSTREAM) | exact |
| `tests/unit/helpers/renumber-season-emulator.ts` (new) | test helper | transform | `tests/unit/helpers/reorder-episode-emulator.ts` (UPSTREAM) | exact |
| `tests/unit/youtube-migration.test.ts`, `watch-layout-guards.test.ts` (new) | test | transform | `tests/unit/admin-ui-guards.test.ts` + `admin-actions-id-coverage.test.ts` (UPSTREAM source-scan style) | role-match |

## Pattern Assignments

### `src/lib/admin/youtube-import.ts` (service core, CRUD + batch) - UPSTREAM analog

**Analog:** `src/lib/admin/season-episode-writes.ts` (UPSTREAM) for the step list + compensation + audit shape; `src/lib/admin/episode-lifecycle.ts` for `Deps`/`CoreResult`/`failMessage`.

**Imports + Deps** (episode-lifecycle.ts UPSTREAM 5-22):
```typescript
import {
  compensationAuditDiff,
  runWithCompensation,
  type CompensationResult,
  type WriteStep,
} from './compensation.ts'
import { recomputeSeasonEpisodeCount, recomputeShowCounts } from './counts.ts'
import { parseId } from './schemas.ts'
import type { AdminDb, AuditWriter, CoreResult } from './ports'

type Deps = { audit: AuditWriter; adminUserId: string }
type StepResult = { error: string | null }
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
```
For Phase 6 add to `Deps`: `youtube: ReturnType<typeof createYouTubeClient>` and `now: Date` (inject, as `show-schedule.ts` Deps does with `now`).

**Step list with undo, created row captured in closure** (season-episode-writes.ts UPSTREAM 135-175). Copy this exactly for "create new season" then "bulk insert episodes":
```typescript
let created: Obj | null = null
const steps: WriteStep[] = [
  {
    name: 'insert-season',
    run: async () => {
      const res = await db.from('seasons').insert(parsed as never).select().single()
      if (res.error) return { error: res.error.message }
      created = res.data as unknown as Obj
      return { error: null }
    },
    undo: async () => {
      if (!created) return { error: null }
      const del = await db.from('seasons').delete().eq('id', created.id as string)
      if (del.error) return { error: del.error.message }
      return recomputeShowCounts(db, parsed.show_id)
    },
  },
  { name: 'recompute-counts', run: () => recomputeShowCounts(db, parsed.show_id) },
  auditStep(deps, 'create', 'season', () => (created?.id as string) ?? null, () => ({ data: created })),
]
const result = await runWithCompensation(steps)
if (!result.ok) {
  await recordFailure(deps, 'create', 'season', ..., result, { show_id: parsed.show_id, ... })
  return { success: false, error: failMessage(result), wrote: result.wrote, data: { showId: parsed.show_id } }
}
return { success: true, wrote: true, data: { season: created, showId: parsed.show_id } }
```
Import-specific steps, in order: `insert-season` (only for target=new, undo deletes it), `insert-episodes` (ONE `.insert([...rows]).select('id')`, undo deletes by the returned ids; RESEARCH "Don't Hand-Roll": a single INSERT statement is atomic, so a `23505` fails the whole import), `recompute-counts` (use `recomputeSeasonEpisodeCount` then `recomputeShowCounts`, see `recomputeAll` in episode-lifecycle.ts UPSTREAM 35-45), `audit`.

**Exactly-one-row guard** (season-episode-writes.ts UPSTREAM 43-51): reuse `oneRow()` shape but compare against the number of rows inserted.

**Audit entry**: `action: 'create'`, `entity: 'season'` (new season) or `'show'`/`'episode'`; diff `{ kind: 'youtube_import', playlist_id, episode_count, season_id }` (CONTEXT: "admin, playlist id, episode count"). Failed run records via `compensationAuditDiff(result, context)` (compensation.ts UPSTREAM 86-102).

**Server-side re-validation (Pattern 1):** commit takes `{ playlistId, videoIds, target }`, re-fetches with `youtube.getVideos(ids)`, reclassifies, drops non-`ok` and already-present ids. Never read titles/status from the client. Dedupe lookup must include archived rows (admin client, no `archived` filter).

**Id guards:** `parseId(showId,'show')`, `parseId(seasonId,'season')`; the season must belong to the show (copy the `Season belongs to a different show.` check from `updateSeasonCore`, season-episode-writes.ts UPSTREAM 198-203).

---

### `src/lib/admin/episode-lifecycle.ts` - add `renumberSeasonCore` (service core, CRUD via RPC) - UPSTREAM analog

**Analog:** `reorderEpisodeCore` + `callReorderEpisodeRpc` + `mapRpcError` in the same file (UPSTREAM 254-407).

**RPC call + error mapping** (UPSTREAM 254-301). Copy structure; swap the function name, args (`{ p_season_id }`) and error messages. Codes the SQL must raise (match RESEARCH Pattern 4): `P0002` not found/empty, `P0001` "Already numbered 1 to N", `42883`/`PGRST202` function missing:
```typescript
function mapRpcError(err: { code?: string; message?: string }): RpcError {
  const message = err.message ?? ''
  if (err.code === 'P0002') return { message: 'Episode not found.', refusal: true }
  if (err.code === 'P0001') { ...; return { message, refusal: true } }
  if (err.code === 'PGRST202' || err.code === '42883')
    return { message: 'Episode reordering needs database migration ...', refusal: false, missing: true }
  return { message: message || 'Reorder failed.', refusal: false }
}
export async function callReorderEpisodeRpc(db: AdminDb, episodeId: string, direction: Direction) {
  const client = db as unknown as RpcClient   // cast: database.types.ts does not list functions
  const { data, error } = await client.rpc('reorder_episode', { p_episode_id: episodeId, p_direction: direction })
  if (error) return { row: null, error: mapRpcError(error) }
  return { row: data?.[0] ?? null, error: null }
}
```

**Core flow to mirror** (UPSTREAM 303-407): `parseId` first, then read the row, then `runWithCompensation([{ name: 'renumber', run, undo? }, { name: 'audit', run }])`. A refusal from the function (`swapRefusal` pattern, UPSTREAM 385-386) returns `wrote: false` and writes no audit row. For renumber there is no cheap undo (the RPC is already all-or-nothing, D-19), so omit `undo` on the `renumber` step; if the audit step fails, the failure message must say the renumber stays applied (copy the `leftInPlace` wording in UPSTREAM 395-401).

**Audit** (D-14 "confirm and an audit row"): `writeAudit(deps, { action: 'update', entity: 'season', entityId: seasonId, diff: { kind: 'renumber', map: [{ episode_id, old_number, new_number }] } })`. Use the `RpcRow` return from the SQL function (RESEARCH Pattern 4 step 5).

**Season scoping:** wrapper passes the show the admin is on and the core checks `season.show_id === showId` (pattern: `archiveEpisodeCore` UPSTREAM 110-111, `Episode does not belong to this show.`).

---

### `supabase/migrations/<ts>_youtube_import_and_status.sql` (migration, CRUD) - main analog

**Analog:** `supabase/migrations/20260724115941_restrict_public_episode_access.sql` lines 291-410 (`reorder_episode`). Copy the full hardening shape for `renumber_season` and `record_youtube_checks`.

**Function header + lock + error codes** (lines 291-340):
```sql
create or replace function public.reorder_episode(p_episode_id uuid, p_direction text)
returns table (show_id uuid, season_id uuid, episode_id uuid, episode_number integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
...
  perform pg_advisory_xact_lock(hashtextextended(v_season_id::text, 3071971));  -- SAME key and constant in renumber_season
...
  raise exception using errcode = 'P0002', message = 'Episode not found';
```

**Grants block** (lines 408-410) - reuse verbatim for both new functions:
```sql
revoke all on function public.reorder_episode(uuid, text) from public, anon, authenticated;
grant execute on function public.reorder_episode(uuid, text) to service_role;
```

**Temp-number technique** (lines 391-405) to adapt for Phase A of `renumber_season` (offset above max instead of below min): the unique `(season_id, episode_number)` is immediate, so move every row out of the way first.

**Column privilege model (Pitfall 8):** `episodes` is `revoke all` then an explicit column grant list for anon/authenticated (lines ~90-120). Do NOT add the new `youtube_*`, `needs_english_title`, `player_error_*` columns to the grant list or to `episodes_view`.

**File order** (RESEARCH Pitfall 9): add columns -> unique partial index on `youtube_video_id` (covers archived rows) -> `renumber_season` -> `record_youtube_checks(p_rows jsonb)` -> `update public.app_config set youtube_api_key = null where id = 1;` -> `alter table public.app_config drop column youtube_api_key; -- safe-drop: <reason>`. The latest main migration filename is `20260810120000_broadcast_day_array.sql`; the new timestamp must sort after it (and after Phase 2-5 migrations when they land).

**Test analog:** none for SQL text on main or upstream (`git grep "\.sql"` over upstream `tests/unit` finds only a comment in the emulator). `youtube-migration.test.ts` is new: `readFileSync` the `.sql` and `assert.match` (style from `admin-ui-guards.test.ts`, see Test section).

---

### `src/app/[locale]/admin/actions.ts` - new/changed wrappers (controller, request-response) - UPSTREAM analog

**Analog:** UPSTREAM `actions.ts` lines 168-196 (`assertAdmin` + `adminEnv`) and 955-980 (`reorderEpisode` wrapper). On main today the file has the OLD form (`assertAdmin` at line 132 returns the user and checks `app_config.admin_user_id`; `reorderEpisode` at 1614-1683 is the unsafe three-step swap). The Phase 6 plan must assume the upstream form is merged first.

**Wrapper pattern** (UPSTREAM 955-980), use for `commitImport`, `renumberSeason`, `testYouTubeKey` (audit row), `reportPlayerError` is different (viewer, see below):
```typescript
export async function reorderEpisode(episodeId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return runAdminAction(
    adminEnv,
    (ctx) =>
      reorderEpisodeCore(ctx.db, { audit: ctx.audit, adminUserId: ctx.adminUserId }, episodeId, direction),
    {
      fallbackError: 'Failed to reorder episode',
      revalidate: (result) => {
        if (!revalidateShowPage(result)) bumpCatalogCache()
        updateTag('episodes')
      },
    }
  )
}
```

**Read-only preview pattern** (UPSTREAM `previewShowSchedule`, ~994-1012): `await assertAdmin()`, `parseId`, call a pure core with `createAdminClient()`, return `{ success, data }`, catch + `console.error('[admin/actions] ... failed', err)`. Use for `previewPlaylist` and `verifyYouTubeVideo` (replaces `/api/youtube-meta`). No `runAdminAction` needed because nothing is written (so no revalidate).

**Phase 5 seam:** code against `AdminActionEnv.assertAdmin(): Promise<{ id: string }>` (action-runner.ts UPSTREAM 6-11); when `requireAdmin()` lands it replaces the single `assertAdmin` function.

**Id-coverage test constraint** (`admin-actions-id-coverage.test.ts` UPSTREAM lines 5-36): every exported action whose signature contains `id`, `showId`, `episodeId`, `seasonId` or `categoryId` must contain `parseId(` or a `\w+Core(` call. Name new params to hit this on purpose and call a Core or `parseId`.

**Remove from main version** (lines per main today): `youtube_api_key` in the integrations schema (line 2845) and `cleaned` (3214-3215) of `updateIntegrations`; `import { validateYouTubeUrl }` stays only if still used by `createEpisode`/`updateEpisode`.

**Server-side video verify on save** (YT-03): `createEpisodeCore`/`updateEpisodeCore` (UPSTREAM `season-episode-writes.ts`) get an injected `verifyVideo` dep; call only when `youtube_video_id` is set or changed. Map `23505` on the new unique index to "This video is already on Clickit as ..." (same `dupNumber` style message helper, UPSTREAM 30-31).

---

### `src/lib/admin/show-schedule.ts` - add `episodeIds` filter (D-07) - UPSTREAM analog

**Analog:** itself, `planShowScheduleCore` (UPSTREAM 34-91). Add an optional 4th param `episodeIds?: string[]`; validate each with `parseId`, reject ids outside the show, and filter at the query:
```typescript
db.from('episodes')
  .select('id, title, episode_number, season_id, youtube_video_id')
  .eq('show_id', showId)
  .eq('archived', false)
  .neq('status', 'published'),
// + .in('id', episodeIds) when provided; refuse if any id is not returned
```
`PlannedEpisodeSlot` (UPSTREAM 16-25) gains optional `needsEnglishTitle` / `youtubeStatus` for the scheduler warnings (Pitfall 10). `applyShowScheduleCore(db, deps, showIdRaw)` already accepts `deps.planOverride`; the new `applyShowSchedule(showId, episodeIds?)` wrapper builds the plan with the filter and passes it as `planOverride`, so the slot-conflict checks (UPSTREAM 218-230) stay unchanged.

**Test to extend:** `tests/unit/admin-show-schedule.test.ts` (UPSTREAM): add "only selected ids planned; foreign-show ids refused".

---

### `src/server/youtube/client.ts` (service, request-response) - UPSTREAM analog

**Analog:** `translateBatchStrictCore` in `src/lib/arabic-text.ts` (UPSTREAM 16-47): pure function, dependencies injected (`{ apiKey, fetchImpl }`), never throws a raw network error to the caller, returns a defined "none" result on failure. Adopt the same `deps.fetchImpl` injection so tests pass a fake fetch.

```typescript
export async function translateBatchStrictCore(
  texts: string[],
  deps: { apiKey: string | undefined; fetchImpl: typeof fetch }
): Promise<(string | null)[]> {
  ...
  try {
    const res = await deps.fetchImpl(`https://translation.googleapis.com/...?key=${encodeURIComponent(deps.apiKey)}`, {...})
    if (!res.ok) return none
    ...
  } catch { return none }
}
```
**Differences for Phase 6 (do not copy):** the existing helper puts the key in the query string; the YouTube client uses `x-goog-api-key` header with `?key=` fallback (RESEARCH A14), `cache: 'no-store'` (not `next: { revalidate }`, which the old route used at youtube-meta/route.ts line 181), and error mapping that never includes the key or URL (`mapYouTubeError(status, body)`). It must throw typed errors (preview shows them in the sheet) instead of returning empty.

**Error handling baseline (main):** `src/app/api/youtube-meta/route.ts` 184-210 already maps 400/403 to plain hints. Reuse its wording intent, key off HTTP status first.

**Response shape reference (main):** `route.ts` 219-231 shows which `snippet`/`contentDetails` fields the app already consumes (`title`, `description`, `thumbnails.maxres/high/default`, `contentDetails.duration`).

---

### `src/server/youtube/urls.ts`, `duration.ts`, `script.ts`, `status.ts` (utilities, transform)

- **urls.ts** analog: `src/lib/youtube.ts` lines 1-48 (main). Keep the host allow-list Set and URL parse + protocol check:
```typescript
const YOUTUBE_HOSTS = new Set(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','music.youtube.com'])
export function validateYouTubeUrl(url: string): string | null {
  if (!url) return null
  let parsed: URL
  try { parsed = new URL(url.trim()) } catch { return null }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null
  return extractYouTubeId(url)
}
```
  New `parsePlaylistId(url)` follows the same shape (host Set, then read `searchParams.get('list')` and test a strict regex). Do NOT use the permissive substring regex at `src/lib/youtube.ts:1` for server verification; add `parseVideoIdStrict` that tests `^[A-Za-z0-9_-]{11}$` (CONTEXT discretion list). The new module must be pure (no `@/`), so it re-declares the host Set or `src/lib/youtube.ts` is left alone and only used client-side (it contains `YT.Player` browser code at lines 62-120, so it is NOT loadable by node tests; keep the server logic in `src/server/youtube/urls.ts`).
- **duration.ts** analog: `parseIsoDuration` in `youtube-meta/route.ts` 238-243 (main); regex there drops days, RESEARCH requires `P#DT#H#M#S` and `PT0S`.
- **script.ts** analog: `hasArabicScript` (UPSTREAM `src/lib/arabic-text.ts` 1-5). This file imports nothing; copy the `ARABIC_RE` constant or import via sibling `.ts` path; do not use `@/`.
- **status.ts**: RESEARCH Pattern 3 gives the full `classifyVideo`; no codebase analog beyond `guards.ts` (UPSTREAM) returning a discriminated result. Pure, no imports.

---

### `src/server/youtube/key.ts` + wrapper (config, request-response) - UPSTREAM analog

**Analog:** `src/server/cloudflare.ts` (UPSTREAM 1-38): `import 'server-only'` at the top of the thin wrapper only; the pure resolver takes `env` as argument.
```typescript
export type WorkerEnv = {
  MEDIA: R2BucketLike
  ...
  CRON_SECRET?: string
  TURNSTILE_SECRET_KEY?: string      // add: YOUTUBE_API_KEY?: string
}
export async function getWorkerEnv(): Promise<WorkerEnv> {
  const { env } = await getCloudflareContext({ async: true })
  return env as unknown as WorkerEnv
}
```
Resolver rule (RESEARCH Pattern 5): `(await getWorkerEnv()).YOUTUBE_API_KEY ?? process.env.YOUTUBE_API_KEY`, trimmed, empty = missing, read inside the function at call time. Replaces `getYouTubeApiKey()` in `src/lib/config.ts` lines 467-478 (main), which reads `app_config.youtube_api_key` with the admin client and an `as any` select.

---

### `src/app/api/cron/youtube-recheck/route.ts` (route, batch) - UPSTREAM analog

**Analog:** `src/app/api/cron/publish-scheduled/route.ts` (UPSTREAM 1-94).

**Auth + structure** (lines 24-33, 87-93):
```typescript
import { NextResponse } from 'next/server'
import { cronAuthOk } from '@/server/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  if (!(await cronAuthOk(req.headers.get('authorization'), process.env.CRON_SECRET))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const admin = createAdminClient()
    ...
    return NextResponse.json({ ok: true, ... })
  } catch (err) {
    console.error('[cron/publish-scheduled] unhandled failure', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown failure' }, { status: 500 })
  }
}
```
Keep the route a thin shell; put logic in `recheckVideosCore(db, client)` in `src/lib/admin/youtube-check.ts` so it is unit-testable (the route above has no unit test because logic is inline; do not copy that part). Per-step error logging style: `console.error('[cron/publish-scheduled] episode update failed', epError)`; use `[cron/youtube-recheck]` prefix. No `updateTag` needed (admin pages are dynamic; RESEARCH Pattern 11).

**Cron registration** (cron-schedule.ts UPSTREAM 5-8):
```typescript
export const CRON_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  '0 1 * * *': '/api/cron/publish-scheduled',
  '0 4 * * 1': '/api/cron/cleanup-media',
  // add: '30 1 * * *': '/api/cron/youtube-recheck',
})
```
`scheduled.ts` (UPSTREAM) derives `CRON_EXPRESSIONS_FOR_PHASE_3` from `Object.keys(CRON_ROUTES)` so no edit is needed there beyond the comment. `wrangler.jsonc` (UPSTREAM 13-20) keeps `"crons": []` with the comment listing the schedules; Phase 6 only updates the comment list, it does not switch crons on. Constant-time compare lives in `cron-auth.ts` (UPSTREAM 40-49), reused unchanged.

**Tests to extend:** `tests/unit/cron-schedule.test.ts` (UPSTREAM) currently asserts `Object.keys(CRON_ROUTES).sort()` equals exactly the two strings (line "CRON_ROUTES is frozen and has exactly the two vercel.json crons"); this assertion MUST be updated to three entries or it will fail. `scheduled.test.ts` and `cron-auth.test.ts` also exist upstream.

---

### `src/lib/admin/youtube-check.ts` (service core, batch)

**Analog (shape):** `show-schedule.ts` Deps with injected `now` plus `fake-supabase` `registerRpc` for the one write. Core steps: select `id, youtube_video_id` of every episode with a video (archived included) -> `client.getVideos(ids)` (chunks of 50 inside the client) -> `classifyVideo` -> ONE `db.rpc('record_youtube_checks', { p_rows })`. Call via the same cast trick as `callReorderEpisodeRpc` (episode-lifecycle.ts UPSTREAM 287-301) because `database.types.ts` does not list functions. A quota error (403 `quotaExceeded`) returns without writing.

---

### `src/hooks/use-progress-tracker.ts` (hook, event-driven) - main, modify

**Defects to fix with exact locations:**

1. Unmount flush effect, lines 88-91, re-runs cleanup on every `forceFlush` identity change (i.e. every episode switch):
```typescript
  // Flush on unmount (route change)
  useEffect(() => {
    return () => { forceFlush() }
  }, [forceFlush])
```
   Replace with a ref (`latestForceFlush.current = forceFlush` assigned in an effect) and an unmount-only cleanup with `[]` deps.
2. `lastSavedRef` (line 11) is never reset on switch; reset it to the resume position when `episodeId` changes.
3. Save decision (lines 31-35) becomes the pure `shouldSaveProgress` from `src/lib/watch/resume.ts` (RESEARCH Example 2 gives the body; it is a straight extraction of these four guards):
```typescript
if (!Number.isFinite(currentTime) || currentTime < 0) return
if (!Number.isFinite(duration) || duration <= 0) return
if (currentTime < 2 && lastSavedRef.current > 2) return
if (!opts.force && Math.abs(currentTime - lastSavedRef.current) < 10) return
```
4. Keep the upsert as is (lines 38-49): `onConflict: 'user_id,episode_id'`, payload `{ user_id, episode_id, progress_seconds, duration_seconds, completed }`, `completed = currentTime / duration >= 0.95` (this is the 95% rule referenced by D-10).

---

### `src/components/watch/youtube-player.tsx` (component, event-driven) - main, modify

**Constructor `playerVars`** (lines 61-71) is the single place to add `hl`, caption params and `start`:
```typescript
playerRef.current = new YT.Player(containerRef.current, {
  videoId,
  playerVars: {
    autoplay: 0, controls: 1, rel: 0, playsinline: 1, enablejsapi: 1, iv_load_policy: 3,
    origin: window.location.origin,
    // add: hl: locale, ...(locale === 'en' ? { cc_load_policy: 1, cc_lang_pref: 'en' } : {}), start: resumeSeconds
  },
```
Locale source: `useLocale()` from `next-intl` (as used in `watch-shell.tsx` line 96). Add `onAutoplayBlocked` to `events` (type exists in `@types/youtube`). 

**Callback-ref pattern to keep** (lines 33-42): props stored in refs and synced in a no-deps effect so the player effect `[videoId]` does not re-trigger. Add any new callbacks (`onAutoplayBlocked`) the same way.

**Error state** (lines 44-52, 100-109, 129-139): current error overlay is `absolute inset-0 z-10` over the player box. D-11 replaces the player with a branded card; reuse the `role="alert"` wrapper and `getErrorMessage(code)` switch structure, moved to `src/lib/watch/player-errors.ts` as `classifyPlayerError(code) -> { kind, reportable }` (100, 101/150, 5, 2 reportable; 153 not reportable).

**Loading overlay (lines 117-127) is `absolute inset-0 z-10` too**, shown only before ready; it is drawn over the not-yet-loaded player, which RMF tolerates, but the layout-guard test (below) must be written to allow exactly this one or the overlay should be a sibling that unmounts at ready.

**Unmount cleanup** (lines 93-97): `playerRef.current?.destroy()`. D-09 says hide the iframe on ENDED but keep the instance (RESEARCH Pattern 8); expose a `hidden` prop or CSS class instead of changing `[videoId]` effect deps.

---

### `src/components/watch/watch-shell.tsx` (component, event-driven) - main, rewrite layout

**Keep as is:** dynamic import of `YouTubePlayer` with `ssr: false` (lines 30-44); the derived next/prev helpers `findNextEpisode`/`findPrevEpisode` (lines 146-174); `useWatchlist`/`useLikes` wiring (117-126) and `handleShare` (128-138); `Tr` for `seasonEpisodeShort` (used at 290-296); the replaceState URL sync (194-199).

**Delete (exact blocks):**
- `useIdleTimer` + `chromeClass` (lines 108-115) and the four pointer handlers on the root (226-229).
- Root `fixed inset-0 ... overflow-hidden bg-black` wrapper (222-230) and the absolutely positioned player box (232-235).
- Fixed top chrome strip `fixed top-0 ... z-20 ... backdrop-blur-md` (269-335); rebuild as a static solid bar in normal flow (keep its inner content: back link, title + S/E, bookmark/like/share buttons with `size-11` targets).
- Two `fixed ... top-1/2 z-20` prev/next arrows (337-359); their logic moves into the control bar under the video.
- `AutoplayOverlay` placement as `absolute inset-0` sibling (361-375).

**Bug sites for YT-05:**
```typescript
function handleEpisodeSwitch(newEpisode: ViewEpisode) {
  if (!playerRef.current || !newEpisode.youtubeId) return
  forceFlush()
  ...
  playerRef.current.loadVideoById({ videoId: newEpisode.youtubeId, startSeconds: 0 })   // line 190-193: the defect
```
Fix per RESEARCH Pattern 6: read outgoing `getCurrentTime()/getDuration()` into `positionsRef` BEFORE `forceFlush()`, then `startSeconds: resumeSecondsFor(positionsRef.current[newEpisode.id])`.
`onReady` lines 239-245 call `player.seekTo(initialProgressSeconds, true)`; replace with `start` in `playerVars` (seekTo on a cued player autoplays).
`progressMap` prop type (line 58) widens to include `progressSeconds` and `durationSeconds`.

**ENDED handler** (lines 246-252): `state === 0` -> `forceFlush()` then show the up-next card; add `ENDED_MODE` constant switch (RESEARCH Pattern 8) and mark the episode completed in `positionsRef`.

**Stable callback pattern** (lines 202-208, `handlePlayNow` in `useCallback` so the overlay countdown effect is not restarted by renders): keep this when building the Up Next card.

---

### `src/components/watch/autoplay-overlay.tsx` (component, event-driven) - main, becomes the Up Next card

**Keep:** countdown logic and cleanup (lines 25-43), copy keys `player.nextEpisode`, `autoplayCountdown`, `autoplayPlayNow`, `autoplayCancelButton` (lines 50, 65, 75, 84). Button classes `min-h-11 rounded-full ...` are the existing 44px-target style (lines 73, 82).

**Change:** root div at line 46 is `absolute inset-0 z-20 ... bg-gradient-to-t from-black/90`. It must become an in-flow block occupying the same 16:9 box as the (hidden) player. Countdown auto-advance must be gated on visibility (`IntersectionObserver` + `document.visibilityState`), RESEARCH Pattern 8.

---

### `src/components/watch/episode-tray.tsx` (component) - main, becomes a static list

**Delete:** `import { Drawer } from 'vaul'` (line 4), `WATCH_TRAY_SNAP_POINTS`/`WatchTraySnapPoint` (13-14), `Drawer.Root/Portal/Content` (53-76, 227-229), `onMouseEnter`/`onMouseLeave` raise (73-74), the raise/lower chevron button (110-128), `onSnapPointChange` props (30, 44). `vaul` is imported here; grep for other users before removing the dependency (RESEARCH says only if grep is empty).

**Keep verbatim:** season chip row (80-98), the per-episode card markup (141-222: `ShowArt`, S/E badge, duration pill, progress bar from `progressMap`), `aria-current`, disabled styling for non-published/no-video (149-160). Add disabled + reason chip for ids in the server-provided `unplayable` map.

**Thumbnail** (lines 137-139) uses `https://img.youtube.com/vi/<id>/hqdefault.jpg`; CONTEXT says `i.ytimg.com` with maxres to standard to high fallback; the watch page also uses `img.youtube.com` (page.tsx lines 39, 130). Keep consistent when touching.

**Progress type** (lines 16-19): widen with `progressSeconds`, `durationSeconds`.

---

### `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` and `src/lib/queries.ts` `getEpisodesProgress` - main, modify

`getEpisodesProgress` (queries.ts 1011-1034) already selects `progress_seconds, duration_seconds, completed` but only returns percent + completed:
```typescript
.select('episode_id, progress_seconds, duration_seconds, completed')
...
result[row.episode_id] = {
  progressPercent: Math.min(Math.round((row.progress_seconds / dur) * 100), 100),
  completed: row.completed,
}
```
Add `progressSeconds: row.progress_seconds, durationSeconds: row.duration_seconds` to the result and the return type. In `page.tsx` (lines 91-97) the unplayable preflight is a second admin-client read in the same `Promise.all`; `createAdminClient` import follows `admin/shows/[id]/page.tsx` line 2. Remove the now-redundant `initialProgressSeconds` derivation (lines 115-116) once `progressMap` carries seconds, or keep it only to seed `playerVars.start`.

---

### `src/components/admin/import-playlist-sheet.tsx` (component, request-response) - role-match

**Analog 1 (flow):** `src/components/admin/schedule-episodes-button.tsx` (main). Same preview-then-confirm structure.

**State/flow pattern** (lines 33-83):
```typescript
const [open, setOpen] = useState(false)
const [loading, setLoading] = useState(false)
const [saving, setSaving] = useState(false)
const [plan, setPlan] = useState<PlannedEpisodeSlot[]>([])
const [error, setError] = useState<string | null>(null)

async function openDialog() {
  setOpen(true); setLoading(true); setError(null); setPlan([])
  const result = await previewShowSchedule(showId)
  if (result.success) setPlan(result.data ?? [])
  else setError(result.error ?? t('failed'))
  setLoading(false)
}
async function confirm() {
  setSaving(true)
  const result = await applyShowSchedule(showId)
  setSaving(false)
  if (result.success) { toast.success(t('scheduled', { count: ... })); setOpen(false); router.refresh() }
  else toast.error(result.error ?? t('failed'))
}
```
**Imports** (lines 3-23): `useLocale/useTranslations` from `next-intl`, `toast` from `sonner`, `useRouter` from `@/i18n/navigation`, `Button`, and the actions imported from `@/app/[locale]/admin/actions` with the type re-exported from there.

**Warning banner markup** (lines 122-127) for "first 200 shown" / unplayable counts:
```tsx
<div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
  <span>...</span>
</div>
```
**Analog 2 (container):** `src/components/ui/sheet.tsx` (main) for the side sheet (D-01), instead of `Dialog`. List rows: `li ... flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm` (lines 130-134). Checkbox: `src/components/ui/checkbox.tsx`. Min 11 px text and 44 px targets per DESIGN.md.

**Success state D-07:** "Schedule these N episodes" renders `ScheduleEpisodesButton` in controlled mode with `episodeIds`. Needs `open`/`onOpenChange` props added to `ScheduleEpisodesButton` (currently owns `open` internally, line 39) and `episodeIds?: string[]` passed to `previewShowSchedule`/`applyShowSchedule` (lines 63, 74).

---

### `src/components/admin/episodes-table.tsx` (component, CRUD) - main, modify

- **Reorder error handling (YT-07, line 100-106):** already toasts `result.error`. The optimistic reducer (80-98) swaps `episode_number` with the array neighbour, which matches D-14 "nearest in the season". Keep; ensure the toast text is the mapped message from `reorderEpisodeCore`.
```typescript
function handleReorder(episodeId: string, direction: 'up' | 'down') {
  startTransition(async () => {
    setOptimisticEpisodes({ episodeId, direction })
    const result = await reorderEpisode(episodeId, direction)
    if (!result.success) toast.error(result.error || tCommon('error'))
  })
}
```
- **Renumber button:** new `ConfirmDialog` instance, copy the existing archive confirm (lines 293-306; `ConfirmDialog` props in `confirm-dialog.tsx` 12-21: `open,onOpenChange,title,description,confirmLabel,onConfirm,destructive?,loading?`) and the `archiveTarget`/`archiveLoading` state pair (77-78, 113-124) as the state template.
- **Badges:** "Can't play" and "Needs English title" go in the title cell (158-175) or the status cell (192-199) next to `StatusBadge`. `Episode` type is `Database['public']['Tables']['episodes']['Row']` (line 35), so `database.types.ts` must be regenerated (`npm run gen-types`) after the migration is applied locally.
- **Tap-area rule:** auto-memory "Tap area opt-in": do not add a global 44px `::after` on `Button`; keep the existing `icon-sm` arrows spacing (lines 202-238) and do not make Edit/Delete overlap.

---

### `src/components/admin/episode-form-drawer.tsx` `YouTubeFetchButton` and `advanced-tab.tsx` (components) - main, modify

**Fetch button (lines 493-548):** replace the `fetch('/api/youtube-meta?url=...')` block (lines 508-523) with the `verifyYouTubeVideo`/`fetchYouTubeMeta` Server Action returning `ActionResult<YouTubeMeta>`; drop the `res.status === 503` branch in favor of an error message for "key missing". Keep the toast keys (`toastNoYoutubeKey`, `toastFetchFailed`, `toastFetchSuccess`, `toastFetchDurationSuccess`) and the JSX (533-547). `onFetched` fill-only-if-empty logic at lines 395-424 stays.

**Settings status (D-15):** in `advanced-tab.tsx` remove state at lines 78-82 (`yt`, `savedHasYouTube`, `ytEnabled`), the submit logic at 123-143, and the `IntegrationRow` for YouTube at 221-248 including the `SecretField` import (line 25). Replace with a read-only status row (Key set/missing, "Stored in Cloudflare", "Test key" button calling `testYouTubeKey`, last test time/result). The "Get a key" `<a ... ExternalLink>` markup (228-237) can be dropped. `settings/secret-field.tsx`: check other users before deleting (RESEARCH Change Map).

---

### Test files - UPSTREAM analogs

**Core + fake DB test shape:** `tests/unit/admin-episode-lifecycle.test.ts` (UPSTREAM 1-55): `node:test` + `node:assert/strict`, sibling imports with `.ts`, deterministic ids via `id('a')` helper, `world()` building `createFakeSupabase({ shows, seasons, episodes })`, `f.registerRpc('reorder_episode', emulateReorderEpisode)`, `deps(f) = { audit: f.auditWriter, adminUserId: 'admin-1' }`, assertions on `f.snapshot()`, `f.auditRows()`, `f.calls`.

**Failure injection** (fake-supabase.ts UPSTREAM 349-354): `f.failOn({ table: 'episodes', op: 'insert', nth: 1 })`, `f.throwOn(...)`, and `rpc` rules `{ rpc: 'renumber_season', nth: 1 }`. Used for "insert fails -> new season removed, counts unchanged".

**Fake limits that affect new tests:**
- `UNIQUE` table (fake-supabase.ts UPSTREAM 33-37) lists only `shows.slug`, `episodes (season_id, episode_number)` and `show_categories.show_id`. Add `['youtube_video_id']` to `episodes` (null-skipping is already implemented at line 74) so dedupe/23505 tests work.
- Supported filters: `eq neq gt lt in is not(is,null)` only; no `or`, `like`, `ilike`, `gte`. The import dedupe lookup and cron read must use `in`/`eq`/`not('...','is',null)`.
- Unknown rpc returns `PGRST202` (line 335-339), which `mapRpcError` maps to "function missing"; always `registerRpc` in tests.

**Emulator pattern for `renumber-season-emulator.ts`:** copy `reorder-episode-emulator.ts` (UPSTREAM 1-62): header comment citing the migration file, `fail(code,message)` helper returning `{ data: null, error: { code, message } }`, same error codes as the SQL, apply all number changes together and return the `(episode_id, old_number, new_number)` rows.

**Source-scan guard tests** (`watch-layout-guards.test.ts`): `admin-ui-guards.test.ts` (UPSTREAM 1-50) pattern: `readFileSync(new URL('../../src/...', import.meta.url), 'utf8')`, regex counting helper `count(src, re)`, `assert.match`. Forbidden-token checks for the watch components: no `Drawer`/`vaul`, no `onMouseEnter` on the list, no `fixed`/`absolute inset-0` siblings of the player (allow-list the loading placeholder if kept). `admin-actions-id-coverage.test.ts` (UPSTREAM) is the other scan style: it reads `actions.ts` and parses `export async function` blocks.

**Test command** (package.json line 11): `node --experimental-strip-types ... --test 'tests/unit/*.test.ts' 'tests/unit/**/*.test.ts'`; `gate:local` = lint + test:unit + build (line 16). Tests on main today are only 8 files; all `admin-*`, `helpers/*`, `cron-*` files above exist only upstream, so Phase 6 tests cannot run until Phase 1.1/2 merge.

---

## Shared Patterns

### Admin server action = assertAdmin -> core -> revalidate in finally (UPSTREAM)
**Source:** `src/lib/admin/action-runner.ts` (UPSTREAM 18-57) + `adminEnv` in `actions.ts` (UPSTREAM 187-192)
**Apply to:** `commitImport`, `renumberSeason`, `testYouTubeKey`, scheduler `applyShowSchedule(showId, episodeIds)`.
```typescript
const adminEnv: AdminActionEnv = {
  assertAdmin, createDb: createAdminClient, audit: logAuditStrict,
  logError: (label, err) => console.error(label, err),
}
```
A thrown run still revalidates (`result.wrote`), failed runs with `wrote: false` do not (action-runner.ts UPSTREAM 47-53). Cores must set `wrote` accurately.

### CoreResult and ids as `unknown`
**Source:** `src/lib/admin/ports.ts` (UPSTREAM 7-18) and `schemas.ts` `parseId` (UPSTREAM 7-10)
**Apply to:** every new core in `src/lib/admin/`. Cores take `id: unknown`, call `parseId(id, 'episode')` first, return `{ success:false, error }` on failure. `ActionResult<T> = { success; error?; data? }`, `CoreResult<T>` adds `wrote?`.

### Compensation instead of transactions (except reorder/renumber)
**Source:** `src/lib/admin/compensation.ts` (UPSTREAM 40-73 `runWithCompensation`, 86-102 `compensationAuditDiff`)
**Apply to:** import commit. Exception per D-19: reorder/renumber are single DB functions, no app-level undo.

### Audit rows are strict and never swallowed
**Source:** `src/lib/audit.ts` `logAuditStrict` (UPSTREAM 93-120). `AuditAction` includes `create|update|archive|restore|delete|config_update|upload|remove_media`; `AuditEntity` includes `show|category|season|episode|short|review|cast|app_config|storage|feature_flags`. No new enum members needed: import = `create`/`season`, renumber = `update`/`season`, key test = `config_update`/`app_config`.
Phase 1.1 D-07: never swallow errors; `writeAudit` wraps the call in try/catch and returns `{ error }` (episode-lifecycle.ts UPSTREAM 24-33).

### Checked counts after any episode add/remove
**Source:** `src/lib/admin/counts.ts` (UPSTREAM 4-47). Counts exclude archived rows; every error is returned. Call `recomputeSeasonEpisodeCount` then `recomputeShowCounts` after import.

### Cron auth
**Source:** `src/server/cron-auth.ts` `cronAuthOk` (UPSTREAM 40-49) used as in `publish-scheduled/route.ts` lines 26-29. Apply to `youtube-recheck/route.ts`.

### Worker secret read
**Source:** `src/server/cloudflare.ts` `getWorkerEnv` (UPSTREAM 35-38). Apply to `key.ts` only; never read the key at module load.

### Supabase RPC not in generated types
**Source:** `callReorderEpisodeRpc` cast (episode-lifecycle.ts UPSTREAM 287-301). Apply to `renumber_season`, `record_youtube_checks`.

### i18n strings
**Source:** `src/messages/en.json` namespaces `player` (lines 216-235) and `watch` (236+); admin namespaces `admin.scheduleEpisodes`, `admin.episodesTable`, `admin.episodeForm`, `admin.confirmDialog`. Every new string needs both `en.json` and `ar.json`. Components use `useTranslations('<namespace>')` and `Tr` (`@/components/i18n/tr`) for the S/E badge. Remove unused `raiseTray`/`lowerTray` when the Drawer goes. New code uses logical classes (`start-*`, `end-*`, `me-*`) like existing code (`end-3`, `me-1`, `rtl:rotate-180`).

### UI tokens
**Source:** `DESIGN.md`, `ui.config.json`, `src/styles/globals.css`; existing components use `var(--bg-0)`, `var(--line)`, `var(--primary)`, `var(--text-dim)`; 44px targets as `size-11`/`min-h-11`.

### Keep Referrer-Policy
**Source:** `next.config.ts` line 95: `{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }`. Do not change; re-check when Phase 2/3 moves headers to Workers.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/server/youtube/status.ts` `classifyVideo` | utility | transform | No existing status-classifier; use RESEARCH Pattern 3 verbatim (pure precedence function) |
| `src/lib/watch/player-errors.ts` ENDED/visibility state machine (`watch-player-state`) | utility | event-driven | No existing player state reducer or IntersectionObserver gate in the codebase; use RESEARCH Pattern 8 and test as a pure state machine |
| Per-user per-episode rate limit for `reportPlayerError` | service | request-response | The `rate_limits` helper (`src/server/rate-limit-policy.ts`, UPSTREAM) exists but was not read for this map; planner must read it (and `src/server/form-guard.ts`, UPSTREAM) before writing the action, and follow the fail-closed rule from RESEARCH Pattern 10 |

Partial: `reportPlayerError` is a signed-in-viewer (non-admin) Server Action. The only existing action pattern is admin (`assertAdmin`). The viewer auth model to copy is the Supabase session check in `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` lines 67-72 (`createClient()` + `supabase.auth.getUser()`), then the service-role write via `createAdminClient()`.

## Metadata

**Analog search scope:** worktree `src/components/{watch,admin}`, `src/hooks`, `src/lib`, `src/app/api`, `src/app/[locale]/{admin,(watch)}`, `supabase/migrations`, `tests/unit`, `next.config.ts`, `package.json`; upstream ref `origin/claude/phase-02-execute-19d86a` (`src/lib/admin/*`, `src/server/*`, `src/lib/{audit,arabic-text}.ts`, `src/app/api/cron/*`, `tests/unit/*`, `tests/unit/helpers/*`, `wrangler.jsonc`, `custom-worker.ts`, `actions.ts` wrappers).
**Files scanned:** about 45 read in full or in targeted ranges; upstream tree listed (about 70 relevant paths).
**Not read (planner should open before writing the affected plan):** UPSTREAM `src/server/rate-limit-policy.ts`, `src/server/form-guard.ts`, `custom-worker.ts`, `tests/unit/admin-show-schedule.test.ts`, `tests/unit/admin-season-episode-writes.test.ts`, `src/lib/admin/show-schedule.ts` lines 230+ (apply/unschedule), `src/components/admin/youtube-url-input.tsx`, `src/components/admin/settings/secret-field.tsx`, `src/app/[locale]/admin/settings/page.tsx`, `ar.json`.
**Pattern extraction date:** 2026-10-20
