# Phase 6: YouTube Import and Player - Research

**Researched:** 2026-10-20
**Domain:** YouTube Data API v3 import and re-check, YouTube IFrame Player embedding rules, Postgres episode ordering, Cloudflare Workers cron, Next.js 16 watch page
**Confidence:** MEDIUM-HIGH (API shapes, quota, RMF, IFrame API and Postgres semantics are from official docs fetched today; private/deleted playlist-item behaviour, unlisted-playlist access and the Developer Policies reading for D-09 and D-17 are not fully documented and are flagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `.planning/phases/06-youtube-import-and-player/06-CONTEXT.md`. Signed by Koss 2026-10-20 ("signed continue"): every question answered with its recommended option (A).

### Locked Decisions

**Playlist import (YT-01, YT-02)**
- **D-01 (Q1):** Import is a side sheet opened from the show's admin page ("Import season from YouTube"). Table, one row per video: tick box, thumbnail, title, length, status chip. Unplayable rows are unticked, greyed and carry the reason. Nothing is saved until "Import N episodes as drafts". Picture: `mockups/06-q1.png` option A.
- **D-02 (Q2):** The admin picks the target: a new season (default; season title prefilled from the playlist title, editable) or an existing season, where new videos are appended after its last episode.
- **D-03 (Q3):** Playlist order sets episode order. Numbers continue after the season's last episode (empty new season starts at 1). No title parsing.
- **D-04 (Q4):** YouTube text goes into the field matching its script: Arabic script -> `title_ar`/`description_ar`; otherwise -> `title`/`description`. `title` is NOT NULL, so for Arabic-only titles `title` temporarily holds the same text and the draft shows a "Needs English title" mark until an admin edits it. No machine translation.
- **D-05 (Q5):** Re-importing a playlist offers only videos not yet on Clickit, as drafts. Existing episodes are never touched (admin edits stay). Videos removed from the playlist stay on Clickit.
- **D-06 (Q6):** Admins upload not-yet-released episodes as **Unlisted** on YouTube; Clickit's scheduler decides when viewers see them. Private videos are refused with "Set it to Unlisted or Public, then import again".
- **D-07 (Q7):** The import success state has a "Schedule these N episodes" button that opens the existing bulk scheduler with the new drafts selected.

**Player (YT-05, YT-06)**
- **D-08 (Q8):** Watch page becomes stacked: solid top bar above the video; the video at 16:9 (letterboxed in black when the screen is wider); a control bar under it (previous, title, next, "Start from the beginning"); episodes under that. Same order on phones. No element overlaps the iframe at any time, including the tray (no hover raise over the player), the prev/next arrows and the top bar. Picture: `mockups/06-q8.png` option A (desktop and 375px).
- **D-09 (Q9):** On ENDED, the iframe is hidden/unmounted and replaced by a Clickit "Up next" card (8-second countdown, "Play now", "Cancel"). YouTube's end screen is never shown. Picture: `mockups/06-q9.png` option A.
- **D-10 (Q10):** Switching episodes resumes silently at the episode's saved position; the control bar shows "Resumed at m:ss · Start from the beginning". Episodes at >=95% (completed) start at 0:00.
- **D-11 (Q11):** Player errors (100, 101, 150, 5, 2, and the region-blocked case) replace the player with a branded card: "This episode can't play right now", plain reason, "Play next episode", "Back to the show". The episode is flagged for admins (D-17). Picture: `mockups/06-q11.png` option A.
- **D-12 (Q12):** Captions: English site -> English captions on when the video has them; Arabic site -> captions follow the viewer's YouTube setting. Player UI language (`hl`) follows the site locale on both.

**Episode order (YT-07)**
- **D-13 (Q13):** Keep up/down arrows, saved on each click. Picture: `mockups/06-q13.png` option A.
- **D-14 (Q14):** Up/down swaps with the nearest episode in the season, whatever its number. Archive/delete does not renumber. A "Renumber 1 to N" action closes gaps on purpose, with a confirm and an audit row.
- **D-19 (Q19):** Reorder and renumber run as one all-or-nothing database function (`reorder_episodes` / `renumber_season` or equivalent), shipped in the same reviewed Phase 6 migration. This is a deliberate exception to Phase 1.1 D-05 (app-level compensation), for these two operations only.

**YouTube key and checks (YT-04)**
- **D-15 (Q15):** Admin > Settings YouTube key field becomes read-only status: "Key set / Key missing", "Stored in Cloudflare", "Test key" button (one `videos.list` call, 1 unit), last test time and result. The input and the `youtube_api_key` write path are removed. Picture: `mockups/06-q15.png` option A.
- **D-16 (Q16):** New key is created in the Clickit Google account (owner of the YouTube channel), Google Cloud project "clickit-story", restricted by API to YouTube Data API v3 only. Old key deleted. Both are Koss's numbered owner steps; the key never appears in chat or a file.
- **D-17 (Q17):** Daily Cloudflare Cron Trigger re-checks every stored episode video (batched `videos.list`, <=50 ids per call, about 6 units/day for ~300 episodes), refreshes stored YouTube status and length (meets the 30-day Developer Policies refresh), and marks broken episodes with a red "Can't play" badge in admin plus a dashboard count. Viewer player-error reports (D-11) feed the same flag. Nothing is unpublished automatically.

**Jev**
- **D-18 (Q18):** No Jev call in Phase 6. Idea kept in Deferred.

### Claude's Discretion (listed in the questions file, not objected to)
- Thumbnails stay on `i.ytimg.com` (`unoptimized`, maxres -> standard -> high fallback), not copied to R2.
- Dedupe across the whole catalog: a video already on any show/season is "Already on Clickit" and not imported again. Database uniqueness on `youtube_video_id` (or equivalent) backs this; exact constraint chosen in planning.
- Paging past 50 via `nextPageToken`; `videos.list` batched with `part=snippet,contentDetails,status`; `search.list` never used.
- Status rules: `privacyStatus=private` -> Private; missing item -> Removed; `status.embeddable=false` -> Not embeddable; `contentDetails.regionRestriction` blocks `AE` (blocked list contains AE, or allowed list lacks AE) -> Blocked in UAE; `uploadStatus!=processed` or live/upcoming broadcast -> Not ready.
- The playlist must be Public or Unlisted; a private playlist error is shown in the sheet.
- Every import and single add writes an audit row (admin, playlist id, episode count).
- Single-link add keeps today's episode form: paste -> title/description/length fill in; save re-validates on the server (`^[A-Za-z0-9_-]{11}$`, then API existence, privacy, embeddable, AE region) and refuses with a plain message.
- Keep `Referrer-Policy: strict-origin-when-cross-origin` (error 153 otherwise), one playing YouTube player per page, player >=200x200.

### Deferred Ideas (OUT OF SCOPE)
- Jev pre-unticking trailers/teasers/shorts in the import preview (Q18) - later, advisory only, on Koss's word.
- Refreshing titles/descriptions of existing episodes from YouTube on re-import (Q5 B) - not wanted.
- Auto-hiding broken episodes (Q17 B) - not wanted; flag only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| YT-01 | Paste a playlist link, preview every video (title, thumbnail, duration, status) before importing | Import pipeline (playlists.list + playlistItems.list paged + videos.list batched), preview action returns rows and writes nothing; Pattern 1, Code Example 1 |
| YT-02 | Private/deleted/non-embeddable/UAE-blocked flagged and excluded; re-import adds no duplicates; imports land as drafts | Pure `classifyVideo` status rules, region semantics, unique index on `youtube_video_id`, commit re-validates server side; Pattern 1, 2, Pitfalls 1-4 |
| YT-03 | Single episode from a link, video ID validated on the server | `verifyVideo(id)` shared by single add and commit; replaces `/api/youtube-meta`; Pattern 2 |
| YT-04 | API key in a Worker secret; old DB copy removed | `YOUTUBE_API_KEY` Worker secret read via `getCloudflareContext().env`, key test action, contract migration dropping the column, owner step order; Pattern 5, Pitfall 9 |
| YT-05 | Switching episodes resumes each episode's saved position | Per-episode seconds map kept in the shell and refreshed on every switch, `loadVideoById({startSeconds})`, tracker race fix; Pattern 6, Pitfall 5 |
| YT-06 | RMF-compliant player: nothing over the video, site-language player and captions, branded errors | Stacked layout, `hl`/`cc_*` params, error branches incl. 153, ENDED handling and its policy risk; Patterns 7-9, Pitfall 6 |
| YT-07 | Reorder never leaves gaps or duplicates and reports errors | `reorder_episode` already exists and is live; add `renumber_season`; UI error reporting; Pattern 4 |
</phase_requirements>

## Summary

Most of the API-side work is well documented and cheap. `playlists.list`, `playlistItems.list` and `videos.list` each cost 1 unit; a 50-video season is about 3 units, the daily re-check of ~300 episodes about 6 units, against a 10,000 default that resets at midnight Pacific. Live today has only 39 episodes (Phase 1 live audit, 2026-10-20), so the re-check costs 1 unit/day. Everything the status rules need (`privacyStatus`, `embeddable`, `uploadStatus`, `regionRestriction`, `liveBroadcastContent`, `duration`) comes from one `videos.list` call with `part=snippet,contentDetails,status`. The gaps in the official docs are: how private/deleted items look inside `playlistItems.list`, whether `videos.list` silently omits them, and whether an API key can read an Unlisted playlist. The design therefore never trusts playlist-item titles: a video id missing from `videos.list` is "Removed or private", and the first UAT step uses a real Unlisted playlist.

Three findings change or qualify signed decisions. (1) **D-19:** a `public.reorder_episode(uuid,text)` function with advisory lock, nearest-active-neighbour swap and temp-number technique is already in `20260724115941_restrict_public_episode_access.sql`, is applied live (Phase 1 live audit: 58 live versions = 58 files, that migration dropped `public.is_admin()`), and Phase 1.1 already calls it. Phase 6 only needs `renumber_season`. (2) **D-09:** the YouTube Developer Policies Guide lists "Disabling or blocking Related Video links from appearing after the video completes" under things not to do. The Required Minimum Functionality (RMF) page only forbids overlays in front of a visible player and says nothing about end screens. Hiding the iframe on ENDED is RMF-clean but carries a policy-interpretation risk that Koss should accept knowingly; a compliant fallback exists (keep the iframe, put the countdown in the control bar). (3) **D-17:** the 30-day rule applies to API-key ("Non-Authorized") data; the cron's job is to refresh status, length and checked-at. It must not rewrite admin-edited titles (D-05), so the plan should treat title/description as Clickit editorial content after import and say so.

The player work has two root causes beyond `startSeconds: 0`: `progressMap` is a page-load snapshot (a returning to episode A after watching it in the same session would restore a stale position), and `useProgressTracker`'s unmount-flush effect re-runs on every episode switch, calling `getCurrentTime()` after `loadVideoById` has already run. Both need fixing for YT-05 to hold in the A -> B -> A scenario.

**Primary recommendation:** Build the YouTube client, status classifier, import planner, resume logic and progress-save rule as pure `.ts` modules covered by `node:test`; keep the one new migration to the contract drop, five nullable/defaulted episode columns, a unique index on `youtube_video_id` (after a read-only duplicate check on live) and `renumber_season`; do reorder, import commit and cron write-back with no new RPC beyond that; implement D-09 as "hide, do not destroy" with a one-line switch to the bar-below fallback.

## Upstream state this phase depends on (not on main yet)

Phase 6 code ships after Phases 1.1, 2, 3, 4, 5. Plan against that main. What is on `main` today versus not:

| Upstream item | Where it lives now | Phase 6 dependency |
|---------------|--------------------|--------------------|
| Phase 1.1 cores: `src/lib/admin/{action-runner,compensation,counts,schemas,ports,episode-lifecycle,season-episode-writes,show-schedule}.ts`, `src/lib/audit.ts` (`logAuditStrict`) | `origin/phase-01.1-admin-actions-hardening-inserted`, also inside `origin/claude/phase-02-execute-19d86a`. **Not on main.** | Import commit reuses `runWithCompensation`, `recomputeSeasonEpisodeCount`, `recomputeShowCounts`, `parseId`, `AdminDb`, `AuditWriter`, `CoreResult`; renumber core sits beside `reorderEpisodeCore`; scheduler needs an `episodeIds` filter in `planShowScheduleCore` |
| `src/lib/arabic-text.ts` (`hasArabicScript`, `acceptArabicTranslation`) | Phase 2 branch only | D-04 script split reuses `hasArabicScript` |
| `src/server/cloudflare.ts` (`getWorkerEnv`), `wrangler.jsonc`, `custom-worker.ts`, `src/server/{scheduled,cron-schedule,cron-auth}.ts` | Phase 2 branch only | Secret read, third cron trigger, constant-time cron auth for `/api/cron/youtube-recheck` |
| `tests/unit/helpers/{fake-supabase,reorder-episode-emulator}.ts` | Phase 2 branch only | Fake DB with `registerRpc`, used for import/renumber/cron tests |
| `reorder_episode(uuid,text)` SQL function | **On main** (`20260724115941`), applied live | Reused unchanged for D-13/D-19 |
| `requireAdmin()` + `admins` table + two-admin audit | Phase 5, not planned | **ASSUMED interface** (A13). Code against the existing seam `AdminActionEnv.assertAdmin(): Promise<{id: string}>` so the Phase 5 swap is one line |
| Phase 1 migration guard (`-- safe-drop:` waiver, Q2 A in `01-DISCUSS-QUESTIONS.md`) | `origin/phase-01-safe-ground`, discuss questions only | Phase 6's `drop column` and any `drop` need the waiver comment (A12) |

Current `main` has none of the Phase 1.1 cores: `reorderEpisode` in `src/app/[locale]/admin/actions.ts` still does the old three-step swap that ignores update errors (line ~1614). The Phase 6 plan must list "Phase 1.1 + 2 merged" as a hard precondition. If Phase 6 were to start earlier, the YT-07 UI work still applies but the server wrapper differs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Playlist preview, single-video verify | API / Backend (Server Action, admin-only) | - | Key is a Worker secret; never in the browser |
| Import commit (insert drafts, numbering, counts, audit) | API / Backend | Database | Service-role writes, re-validates ids server side, one bulk INSERT statement |
| Video status classification | API / Backend (pure module) | - | Same function used by preview, single add and cron |
| Daily re-check | API / Backend (Cron Trigger -> route) | Database (one RPC for write-back) | 6 YouTube calls + 1 read + 1 write fits the 50-subrequest Free limit |
| Episode reorder / renumber | Database (function) | API / Backend (wrapper, audit) | All-or-nothing under advisory lock; app does validation and audit |
| Key status / key test | API / Backend | Browser (button) | Only a boolean and the last test result reach the client |
| Resume position per episode | Browser / Client (shell state + player) | Database (`watch_progress`) | Player owns the clock; DB is the cross-session source; shell keeps a fresh in-session map |
| Player embed, ENDED card, error card | Browser / Client | - | YouTube IFrame API is client only |
| Player error reports | API / Backend (rate-limited action) | Database | Viewer cannot write `episodes`; service-role writes two report columns |
| Unplayable preflight for viewers | Frontend Server (watch page) | Database | Admin-client read of status for ids already visible; avoids loading a known-dead embed |
| Thumbnails | CDN / Static (`i.ytimg.com`) | - | Not copied to R2 (decided) |

## Standard Stack

### Core (all already in the repo; no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.2 on Phase 2 branch (^16.2.9 on main) | App Router, Server Actions, route handlers | Project stack [VERIFIED: package.json, Phase 2 branch package.json] |
| @opennextjs/cloudflare | 1.20.12 (Phase 2 branch) | Worker runtime, `getCloudflareContext` for secrets | Project stack [VERIFIED: Phase 2 branch package.json] |
| wrangler | 4.151.2 (Phase 2 branch) | Secret put, cron config, local scheduled test | Project stack [VERIFIED: Phase 2 branch package.json] |
| zod | ^4.3.6 | Input schemas (playlist url, video ids, direction) | Already used by `src/lib/admin/schemas.ts` |
| @supabase/supabase-js | ^2.101.0 | Admin (service-role) client, `.rpc()` | Project stack |
| @types/youtube | ^0.1.2 | `YT.Player` types; already declares `onAutoplayBlocked` and `getVideoData()` | [VERIFIED: node_modules/@types/youtube/index.d.ts lines 611, 1035] |
| node:test via `npm run test:unit` | Node v26.7.0 local | Unit tests with `--experimental-strip-types` | Existing runner; no vitest/jest in the repo [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `fetch` YouTube client (about 120 lines) | `googleapis` npm package | `googleapis` is huge for a Worker bundle and its Node auth stack is not Workers-friendly; three GET endpoints do not justify it |
| Two-phase offset renumber (no schema change) | Make `unique (season_id, episode_number)` `DEFERRABLE` | Needs drop + re-add of the constraint (`ALTER CONSTRAINT` only supports foreign keys), an ACCESS EXCLUSIVE lock, and a CI drop waiver [CITED: postgresql.org/docs/17/sql-altertable.html] |
| `x-goog-api-key` header | `?key=` query parameter | Header keeps the key out of URLs and Workers logs. Google documents the header as the recommended method for API keys generally [CITED: docs.cloud.google.com/docs/authentication/api-keys-use]; YouTube-specific acceptance not separately verified (A14), so the client supports both and the key-test action proves it |

**Installation:** none. `npm install` is not needed for this phase.

## Package Legitimacy Audit

No external packages are added or upgraded by Phase 6.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | not run (nothing to check) | n/a |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 ADMIN                                              WORKER (Next via OpenNext)                       EXTERNAL
 ─────                                              ──────────────────────────                       ────────
 paste playlist URL ──► previewPlaylist(url) ──requireAdmin──► parsePlaylistId (strict regex)
                                                    │          playlists.list (title)  ───────────►  YouTube Data API v3
                                                    │          playlistItems.list x pages ◄────────  (key from Worker secret)
                                                    │          videos.list x ceil(n/50) ◄─────────   part=snippet,contentDetails,status
                                                    │          classifyVideo() per id (pure)
                                                    │          lookup youtube_video_id in episodes (admin client, incl. archived)
                                                    ▼
                                     preview rows (NOTHING written) ──► side sheet: tick, thumb, title, length, chip
 "Import N" ──► commitImport({playlistId, videoIds[], target}) ──requireAdmin──►
                                                    │  re-fetch metadata from YouTube by id (never trust client rows)
                                                    │  re-classify; refuse non-ok; drop already-on-Clickit
                                                    │  [new season?] create season ──┐ runWithCompensation
                                                    │  numbering = max(episode_number incl. archived)+1.. ├─ undo = delete the new rows
                                                    │  ONE bulk INSERT (status=draft, youtube_status='ok') ┘
                                                    │  recompute season/show counts, audit row, updateTag('episodes')
                                                    ▼
                                     success state ──► "Schedule these N" ──► previewShowSchedule(showId, episodeIds)

 CRON (daily, UTC) ─► scheduled() ─► /api/cron/youtube-recheck (Bearer CRON_SECRET)
                                       read all (id, youtube_video_id) ─► videos.list x ceil(n/50)  ──► YouTube
                                       classifyVideo() ─► ONE RPC record_youtube_checks(jsonb) ─► episodes.youtube_*

 VIEWER ─► /watch/[episodeId] (server) ─► episode + progress seconds map + unplayable map (admin-client read)
        └► WatchShell (client)
             top bar │ 16:9 YT.Player (nothing over it) │ control bar (prev, title, next, Resumed at…) │ episode list
             switch  : capture outgoing seconds ─► flush ─► loadVideoById({videoId, startSeconds: resumeFor(target)})
             ENDED   : flush(completed) ─► hide iframe ─► "Up next" card ─► (visible + countdown 0) ─► unhide ─► loadVideoById
             onError : branded card ─► reportPlayerError(episodeId, code) (rate-limited action, service-role writes report columns)
```

### Recommended Project Structure

Pure modules take no `next/*`, no `server-only`, no `@/` alias and import siblings with `.ts` extensions, so `node --test` can load them (the pattern Phase 1.1 and 2 established). Put `server-only` only in thin wrappers.

```
src/server/youtube/              # pure (no server-only import); matches ARCHITECTURE.md layout
├── urls.ts          # parsePlaylistId(), parseVideoIdStrict() (host allow-list, list=, 11-char regex)
├── duration.ts      # parseIsoDuration() with days, hours; PT0S handling
├── status.ts        # classifyVideo(item, 'AE') -> { status, reason }; STATUS_PRECEDENCE
├── client.ts        # createYouTubeClient({ apiKey, fetchImpl }): getPlaylist, listPlaylistItems (paged), getVideos (batches of 50), error mapping
├── script.ts        # splitYoutubeText(text) -> 'ar' | 'other' (majority of letters), uses hasArabicScript
├── plan.ts          # buildImportPlan(): dedupe, numbering, title/description field routing, needs_english_title
└── key.ts           # getYouTubeApiKey(env) pure resolver; thin server-only wrapper reads getWorkerEnv()
src/lib/admin/
├── youtube-import.ts          # previewPlaylistCore, commitImportCore (db + audit ports)
├── youtube-check.ts           # recheckVideosCore(db, client) used by the cron route
└── episode-lifecycle.ts       # (Phase 1.1 file) + renumberSeasonCore beside reorderEpisodeCore
src/lib/watch/
├── resume.ts        # resumeSecondsFor(), shouldSaveProgress(), formatClock()
└── player-errors.ts # classifyPlayerError(code) -> { kind, reportable }
src/app/api/cron/youtube-recheck/route.ts
src/app/[locale]/admin/actions.ts   # thin wrappers: previewPlaylist, commitImport, verifyYouTubeVideo, renumberSeason, testYouTubeKey, reportPlayerError
supabase/migrations/<ts>_youtube_import_and_status.sql
tests/unit/youtube-*.test.ts, watch-resume.test.ts, admin-renumber*.test.ts
```

### Pattern 1: Preview then commit, server re-fetches
**What:** Preview returns rows and writes nothing. Commit takes only `{ playlistId, videoIds, target }`, re-fetches and re-classifies every id from YouTube, and never reads titles or statuses from the client.
**When to use:** always for D-01/D-05. A tampered or stale payload then cannot import a private video or inject text.
**Cost:** preview of a 50-video season = playlists.list 1 + playlistItems.list 1 + videos.list 1 = 3 units; commit re-fetch = 2 units more [CITED: developers.google.com/youtube/v3/determine_quota_cost].
**Bounds:** cap at 200 playlist items (4 pages) with a visible "first 200 shown" note; `videoIds` zod `.max(200)`; every id `^[A-Za-z0-9_-]{11}$`; ids unique.

### Pattern 2: One verify function for every entry point
`verifyVideos(ids[]) -> Map<id, {status, meta}>` is used by preview, commit, single add (`createEpisode`/`updateEpisode` when `youtube_video_id` is set or changed), the "fetch metadata" button, and the cron. Replace `GET /api/youtube-meta` with a Server Action (`fetchYouTubeMeta(videoId)`, admin guard, no GET side effect); delete the route and `getYouTubeApiKey()` from `config.ts`. Fetch with `cache: 'no-store'` (not `next: { revalidate }`) so key-bearing requests never reach the OpenNext R2 incremental cache.

### Pattern 3: Status classification as a pure precedence function
```ts
// Source: field semantics from developers.google.com/youtube/v3/docs/videos [CITED]
export type YouTubeStatus = 'ok'|'private'|'removed'|'not_embeddable'|'blocked_ae'|'not_ready'
export function classifyVideo(item: VideoItem | undefined, region = 'AE'): YouTubeStatus {
  if (!item) return 'removed'                                   // absent from videos.list (A3)
  const s = item.status, c = item.contentDetails, sn = item.snippet
  if (s?.privacyStatus === 'private') return 'private'
  if (['deleted','failed','rejected'].includes(s?.uploadStatus ?? '')) return 'removed'
  if (s?.uploadStatus !== 'processed') return 'not_ready'
  if (sn?.liveBroadcastContent === 'upcoming' || sn?.liveBroadcastContent === 'live') return 'not_ready'
  if (s?.embeddable === false) return 'not_embeddable'
  if (blocksRegion(c?.regionRestriction, region)) return 'blocked_ae'
  return 'ok'
}
function blocksRegion(rr: {allowed?: string[]; blocked?: string[]} | undefined, region: string) {
  if (!rr) return false
  if (rr.allowed) return !rr.allowed.includes(region)           // allowed list: everything not listed is blocked; [] = blocked everywhere
  if (rr.blocked) return rr.blocked.includes(region)            // blocked list: everything not listed is viewable
  return false
}
```
Region semantics are from the `videos` resource: `allowed` present means unlisted countries are blocked and an empty list means blocked in all countries; `blocked` present means unlisted countries are viewable [CITED: developers.google.com/youtube/v3/docs/videos]. Order matters: a private video is reported Private, a missing one Removed, before embeddable/region. Status display strings are i18n keys, not stored.

### Pattern 4: Reorder and renumber (YT-07, D-13/D-14/D-19)
**Reorder:** unchanged. Reuse `public.reorder_episode(p_episode_id uuid, p_direction text)` (SECURITY INVOKER, `set search_path = pg_catalog, public`, `pg_advisory_xact_lock(hashtextextended(season_id::text, 3071971))`, swaps with the nearest **non-archived** neighbour whatever its number, three updates through a temp number below the season minimum, `execute` granted to `service_role` only) [VERIFIED: supabase/migrations/20260724115941_restrict_public_episode_access.sql lines 291-410]. It already satisfies D-14's "nearest, whatever its number". Phase 1.1 `reorderEpisodeCore` maps its error codes (`P0001` no neighbour, `P0002` not found, `22023` bad direction, `42883`/`PGRST202` function missing) and audits. So the YT-07 work is: (a) make sure the migration is applied wherever the app runs (it is on live), (b) the admin UI must show the returned error and refresh the list on failure instead of leaving the optimistic swap (`episodes-table.tsx` `useOptimistic` reverts automatically when the transition ends with the server data, but the toast text should be the mapped message), (c) tests.

**Renumber (new):** `public.renumber_season(p_season_id uuid)`, same hardening and grants as `reorder_episode`:
1. `pg_advisory_xact_lock` with the **same key** as `reorder_episode` and the import commit so the three serialise per season.
2. Lock all rows of the season `for update`.
3. Phase A: one `update ... set episode_number = episode_number + v_offset` where `v_offset = greatest(max(episode_number),0) + count(*) + 1`. Every new value exceeds every old value and stays distinct, so the immediate (non-deferrable) unique check cannot trip, even though Postgres checks non-deferrable uniqueness immediately, not at statement end [CITED: postgresql.org/docs/17/sql-set-constraints.html].
4. Phase B: set non-archived rows to `row_number() over (order by old_number)` = 1..N (old number = current - offset); then archived rows to N+1..N+K in their old order (they hold numbers under the same unique constraint and must be moved out of the way; they are hidden, and restoring one already goes through the Phase 1.1 conflict flow).
5. Return `(episode_id, old_number, new_number)` rows so the wrapper writes one audit row with the before/after map (D-14 "audit row").
6. Refuse when there is nothing to change (`P0001 'Already numbered 1 to N'`) so a no-op does not write an audit row.

Wrapper `renumberSeasonCore(db, deps, seasonId)` follows `reorderEpisodeCore`: `parseId`, season scoped to the show the admin is on, audit via `logAuditStrict` (`action: 'update'`, `entity: 'season'`, diff `{ kind: 'renumber', map: [...] }`), UI confirm dialog states the effect ("Episodes will be numbered 1 to 7. Viewers' episode numbers change.").

**Do not** make the unique constraint deferrable: `ALTER TABLE ... ALTER CONSTRAINT` only supports foreign keys [CITED: postgresql.org/docs/17/sql-altertable.html], so it would need `drop constraint` + `add constraint` under an ACCESS EXCLUSIVE lock and a CI waiver.

### Pattern 5: Key, key test, cron secret
- **Secret:** `YOUTUBE_API_KEY` as a Worker secret. Owner step (his terminal only): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put YOUTUBE_API_KEY`. Read it as `(await getWorkerEnv()).YOUTUBE_API_KEY ?? process.env.YOUTUBE_API_KEY` inside the function at call time (never at module load). Add the optional field to `WorkerEnv` in `src/server/cloudflare.ts`. OpenNext documents that variables and secrets are set on the Worker and that local dev uses `.env` files loaded onto `process.env` [CITED: opennext.js.org/cloudflare/howtos/env-vars]; the page does not state whether `process.env` is populated in cron context, which is why the resolver tries the Worker `env` first (A7).
- **Settings status (D-15):** server component passes `{ keySet: boolean, lastTest: { at, ok, summary } | null }`. Remove `youtube_api_key` from `updateIntegrations`'s schema and `cleaned` (actions.ts lines ~2845 and ~3214), from `advanced-tab.tsx`'s `ytEnabled/yt/savedHasYouTube/SecretField` block and `settings/page.tsx`'s `getYouTubeApiKey()`.
- **Key test:** `testYouTubeKey()` Server Action: `videos.list?part=id&id=<id of the first non-archived episode with a video, else any 11-char id>`; HTTP 200 proves key valid, API enabled and restriction compatible with Worker egress. Store the result as an `admin_audit_log` row (`action: 'config_update'`, `entity: 'app_config'`, diff `{ kind: 'youtube_key_test', ok, status, reason }`) and read the latest such row for "last test time and result". No schema change, two admins see who tested. Map outcomes by HTTP status first (200 ok; 400 key rejected; 403 not enabled/blocked or `quotaExceeded`), show a plain message, log the reason string only.
- **Restrict by API only.** Application restrictions on a key are HTTP referrer, IP, Android or iOS [CITED: docs.cloud.google.com/docs/authentication/api-keys]. A Worker sends no browser referrer and has no fixed egress IP, so none of them fit; D-16's "restricted by API to YouTube Data API v3 only" is the only workable restriction and is the one the console requires anyway. The residual risk (key usable from anywhere for that one API) is why the old DB-stored key must be treated as leaked and deleted.

### Pattern 6: Resume per episode (YT-05, D-10)
- Extend `getEpisodesProgress` to return `{ progressPercent, completed, progressSeconds, durationSeconds }` (page.tsx already passes `progressMap`; widen the `progressMap` prop type in `WatchShell`).
- `resumeSecondsFor({ progressSeconds, durationSeconds, completed })`: `completed` -> 0; `progressSeconds < 5` -> 0; `durationSeconds > 0 && progressSeconds >= durationSeconds - 5` -> 0; else `Math.floor(progressSeconds)`. Pure, unit-tested.
- In the shell keep `positionsRef: Record<episodeId, { seconds, duration, completed }>` seeded from the server map. On every switch, **before** `loadVideoById`: read `player.getCurrentTime()/getDuration()` for the outgoing episode, write it into `positionsRef`, then `forceFlush()`. On ENDED write `{ seconds: 0, completed: true }` for that episode. This fixes the stale snapshot: A (watch 10 min) -> B -> A resumes at A's 10 min, not at the page-load value.
- Switch call: `player.loadVideoById({ videoId, startSeconds: resumeFor(target) })`. `startSeconds` starts "from the closest keyframe" [CITED: developers.google.com/youtube/iframe_api_reference], so shown "Resumed at" time can differ by a couple of seconds; display the value that was requested.
- Initial mount: stop calling `player.seekTo(initialProgressSeconds, true)` in `onReady`. Per the IFrame docs `seekTo` on a non-paused state (cued is not paused) plays the video [CITED: iframe_api_reference], i.e. an unrequested autoplay. Pass `playerVars.start = resumeSeconds` (documented, integer, nearest keyframe) [CITED: developers.google.com/youtube/player_parameters] and leave play to the viewer.
- "Start from the beginning": `seekTo(0, true)`, update `positionsRef`, hide the "Resumed at" text. The tracker's rule "skip saves below 2 s when the last save was above 2 s" means the old position survives until the viewer plays 2+ seconds; acceptable.

### Pattern 7: Stacked watch layout without overlap (YT-06, D-08)
Replace the `fixed inset-0` shell with normal flow:
```
<div class="min-h-dvh flex flex-col bg-[var(--bg-0)]">
  <TopBar/>                                   // static, solid, no backdrop-blur, no auto-hide
  <div class="bg-black">                      // letterbox well
    <div class="mx-auto aspect-video min-h-[200px] w-full max-w-[calc((100dvh-var(--chrome-h))*16/9)]"> <YouTubePlayer/> </div>
  </div>
  <ControlBar/>                               // prev, title+S/E, next, "Resumed at…" / "Start from the beginning"
  <EpisodeList/>                              // static horizontal or grid list, no Vaul drawer, no hover raise
</div>
```
Delete: `useIdleTimer` wiring (`chromeClass`, `inert`, `onPointerMove`), the `fixed` top strip, the two `fixed top-1/2` arrows, `AutoplayOverlay`'s `absolute inset-0 z-20`, and the Vaul `Drawer` in `episode-tray.tsx` (`WATCH_TRAY_SNAP_POINTS`, `onMouseEnter` raise). Keep tray content (season chips, episode cards, progress bar) as a static section. Check whether `vaul` remains used elsewhere before removing the dependency (it is only a candidate; do not remove packages in this phase unless the grep is empty).
RMF check for this layout: nothing sits in front of any part of the player (overlay rule), viewport >= 200x200 (`min-h-[200px]`; at 375 px wide the 16:9 player is 375x211), no mouseover or touch action on the player, one player on the page [CITED: developers.google.com/youtube/terms/required-minimum-functionality]. A solid bar adjacent to (not over) the player is fine; the RMF text only forbids elements "in front of any part of" the player.

### Pattern 8: ENDED handling (D-09) and the policy risk
Sequence: `state === 0` -> record completed, `forceFlush()`, set `ended` -> **hide** the iframe container (CSS `hidden`, keep the `YT.Player` instance) -> render the "Up next" card in the same box -> on "Play now" or countdown 0: **unhide first, then** `loadVideoById(...)`.
- *Hide, don't `destroy()`:* reusing the instance keeps `loadVideoById` inside the page's existing user-activation history; a freshly constructed player after a countdown has no gesture and is more likely to hit the browser autoplay block. The IFrame API fires `onAutoplayBlocked` when the browser blocks scripted playback [CITED: iframe_api_reference]; handle it by showing the player with its own play button (A10/A11 for the cross-browser behaviour, UAT on iOS Safari).
- *Visibility gate:* RMF says autoplay must not start "until the player is visible" (more than half on screen) [CITED: required-minimum-functionality]. Gate the countdown's auto-advance on an `IntersectionObserver` (>= 50 % of the player box visible and `document.visibilityState === 'visible'`); if not visible, pause the countdown and wait. "Play now" is a user click and always allowed.
- *Cancel:* spec silent on what remains. Recommend the card stays (no countdown) with "Play now" and "Watch again" (unhide + `seekTo(0)` + `playVideo()`); never leave an empty black box.
- *Policy risk (flag for Koss, MEDIUM):* the Developer Policies Guide, under "Your API service must reflect a user's standard experience on YouTube", lists as a do-not: "Disabling or blocking Related Video links from appearing after the video completes." [CITED: developers.google.com/youtube/terms/developer-policies-guide]. The RMF page has no end-screen rule, and the main Developer Policies page is silent on end-of-video behaviour (it does forbid to "modify, build upon, or block any portion or functionality of a YouTube player", III.I.6) [CITED: developers.google.com/youtube/terms/developer-policies]. D-09 (YouTube's end screen "is never shown") sits on the wrong side of the Guide's wording if read literally. Enforcement against a small catalog site is unlikely (YouTube audits mostly happen at quota-extension requests) but not zero. Provide a one-constant switch `ENDED_MODE = 'card-replaces-player' | 'bar-below-player'`; the fallback keeps the iframe visible (YouTube's own end screen shows, `rel=0` limits suggestions to the same channel [CITED: player_parameters]) and puts the same countdown card in the control bar region beneath the player. Ship D-09 as signed, record the risk in the plan, and ask Koss to confirm acceptance at the plan gate (Open Question 1).

### Pattern 9: Branded errors (D-11)
`classifyPlayerError(code)`:
| Code | Documented meaning | Branded reason | Report to server | Notes |
|------|-------------------|----------------|------------------|-------|
| 100 | not found, removed or private | "This video was removed or made private" | yes | |
| 101 / 150 | owner does not allow embedded playback | "The owner doesn't allow it to be played here" | yes | also what region/Content ID blocks usually look like (A16) |
| 5 | HTML5 player error | "The player had a problem" | yes, low severity | often client-side/transient |
| 2 | invalid parameter (e.g. malformed id) | "This episode's video link is broken" | yes | indicates bad stored id |
| **153** | request lacks Referer / client identification [CITED: iframe_api_reference] | generic card | **no** (not the episode's fault) | site-config problem; `console.error` once. **Addition to D-11** |
| region-blocked | not a distinct client code | from DB preflight status `blocked_ae` | n/a | see Pattern 10 |

Branded card: replaces the iframe box (iframe hidden/destroyed, same "never overlay a visible player" rule), buttons "Play next episode" (hidden when no next) and "Back to <show>". Keep the existing `role="alert"`.

### Pattern 10: Unplayable preflight and viewer reports (D-11 -> D-17)
- Server (watch page): one admin-client query `select id, youtube_status from episodes where id in (<ids already visible>) and youtube_status is not null and youtube_status <> 'ok'` -> `unplayable: Record<id, status>` passed to the shell. The shell renders the branded card without constructing a player for those ids and disables their tray cards. Reason: region blocks and some removals produce an in-iframe message with no `onError` event (A16), so the card would otherwise never show. Staleness is at most the cron interval. The column is not readable by `anon`/`authenticated` (column grants, see Pitfall 8) so this must stay a server read.
- Report action `reportPlayerError({ episodeId, code })`: signed-in viewer, `parseId`, `code` in an allow-list, per-user per-episode rate limit through the Phase 2 Supabase `rate_limits` helper (fail-closed), writes `player_error_code`, `player_error_at` via service role. It does **not** call YouTube (a hostile viewer must not be able to burn quota) and does not change `youtube_status`. Admin badge: "Can't play" when `youtube_status` is not ok, or a viewer report is newer than `youtube_checked_at`; the cron clears `player_error_*` when its own check passes after the report. Nothing is unpublished.

### Pattern 11: Daily re-check cron (D-17)
- Route `GET /api/cron/youtube-recheck`, `cronAuthOk(Authorization, process.env.CRON_SECRET)` like `publish-scheduled`; add `'30 1 * * *': '/api/cron/youtube-recheck'` to `CRON_ROUTES` and the same string to `wrangler.jsonc` `triggers.crons` at the cutover (the file keeps `"crons": []` until Phase 3; Phase 6 adds a string to the future list, it does not switch anything on). 01:30 UTC runs after the 01:00 UTC `publish-scheduled` flip so newly published episodes are checked the same day. Cron expressions are UTC; changes take up to 15 minutes to propagate; local test URL is `/cdn-cgi/local/scheduled?cron=...` [CITED: developers.cloudflare.com/workers/configuration/cron-triggers/].
- Work: read `id, youtube_video_id` of every episode with a video (include archived: stored data is stored data), chunk by 50, `videos.list` with `fields=` trimmed to the needed properties (reduces bytes and parse CPU; documented to reduce bandwidth, cost effect not documented so assume quota is unchanged) [CITED: developers.google.com/youtube/v3/getting-started], classify, then **one** RPC `record_youtube_checks(p_rows jsonb)` (`update public.episodes e set youtube_status=..., youtube_checked_at=now(), youtube_duration_seconds=... from jsonb_to_recordset(p_rows) ...`, INVOKER, service_role only). One write beats 300 PATCHes: Workers Free allows 50 subrequests per invocation and 10 ms CPU per cron run [CITED: developers.cloudflare.com/workers/platform/limits/]. Total ~ 1 read + 6 YouTube + 1 RPC = 8 subrequests.
- Cron CPU is the real Free-plan risk (A17): running through `handler.fetch` boots the Next route. Phase 2's CPU report (PLAT-09) decides; mitigation if it fails is calling the pure check function directly from `scheduled()` (no revalidation is needed: admin pages are dynamic). Do not hand-roll around this before the numbers exist.
- Cron budget: Free allows 5 Cron Triggers per account. Phase 2 uses 2; Phase 5's daily digest likely adds 1; this adds 1 = 4. Do not add more without checking.
- The cron refreshes `youtube_status`, `youtube_checked_at`, `youtube_duration_seconds`, and `episodes.duration` only when it still equals the value derived from the previous stored seconds (admin has not overridden it). It never touches `title*`/`description*` (D-05). A video that comes back `not_ready` with `PT0S` must not overwrite a good duration.
- A shorts table also stores YouTube ids (9 rows) and hero videos can be YouTube; they are out of D-17's wording ("stored episode video"). Adding shorts ids to the same batch costs nothing; flag for Phase 7 (PROD-07) rather than widening Phase 6 (Open Question 4).

### Pattern 12: Import data mapping (D-03, D-04)
| Source (API) | Target | Rule |
|--------------|--------|------|
| `playlists.list` `snippet.title` | new season `title` (editable), `title_ar` null | Arabic title -> `title_ar` and `title` mirrors it (seasons.title is NOT NULL) |
| `playlistItems` order (`snippet.position`, zero-based) | `episode_number` | existing season: `max(episode_number over ALL rows incl. archived) + i`; new season: `1..n`. Skipped (unplayable) rows do not consume numbers |
| `snippet.title` (<= 100 chars) | `title` or `title_ar` | `splitYoutubeText`: Arabic letters >= 50 % of letters -> Arabic. If Arabic: `title_ar = text`, `title = text`, `needs_english_title = true`. Description likewise (cap 1000 chars like the current form) |
| `snippet.description` | `description` / `description_ar` | empty -> fall back to the show description (`episodes.description` has default '' but `episodeSchema` requires min 1 on later edits) |
| `contentDetails.duration` | `duration` (minutes, `Math.max(1, Math.round(s/60))`), `youtube_duration_seconds` | ISO 8601 formats `PT#M#S`, `PT#H#M#S`, `P#DT#H#M#S` [CITED: videos resource]; value can differ ~1 s from playback |
| `snippet.thumbnails` | preview only | live pages derive `https://i.ytimg.com/vi/<id>/hqdefault.jpg`; `maxres` and `standard` exist "for some videos" only [CITED: videos resource] so try maxres only with an `onError` fallback |
| (constant) | `status='draft'`, `youtube_status='ok'`, `youtube_checked_at=now()` | D-06/YT-02: drafts only |

No `fillArabic` (machine translation) in the import path; single add keeps today's `fillArabic`. Do not call `localizations`: admins seldom set them and D-04 says script-based.

### Anti-Patterns to Avoid
- **Trusting client-sent rows in commit** (titles, statuses): re-fetch.
- **Per-video `videos.list` loops or per-row PATCH in the cron**: quota and the 50-subrequest cap.
- **`search.list`**: separate 100/day bucket and 100 units/call in older docs; never needed [CITED: determine_quota_cost].
- **Key in a query string or logged URL**: use the header; log only HTTP status and reason.
- **Overlaying anything on a visible player**, including a "temporary" toast or a hover-raise tray.
- **`player.seekTo()` in `onReady`** for resume (autoplays from cued).
- **Making `episodes` columns viewer-readable** to expose `youtube_status`: leaks nothing sensitive but breaks the column-grant model; read server-side instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| All-or-nothing swap / renumber | App-side three-step updates | `reorder_episode` (exists) + `renumber_season` (new) in Postgres | One transaction under an advisory lock; app compensation cannot undo a crash between steps |
| Atomic multi-row insert | Loop of single INSERTs with undo | One `.insert([...])` (PostgREST: "a single INSERT statement") [CITED: docs.postgrest.org] | One statement is atomic; a unique violation fails the whole import |
| Bulk status write-back | 300 PATCH calls | One `jsonb_to_recordset` RPC | 50-subrequest Free cap |
| Audit rows, compensation, count recompute | New helpers | `logAuditStrict`, `runWithCompensation`, `recomputeSeasonEpisodeCount`, `recomputeShowCounts` (Phase 1.1) | Already tested, already two-admin ready after Phase 5 |
| Cron secret compare | `===` | `cronAuthOk` (Phase 2) | Constant-time |
| Rate limit for report action | New counter | Phase 2 `withinRateLimit` / `rate_limits` table, fail closed | Existing |
| YouTube duration parse | Regex that only handles `PT#M#S` | `parseIsoDuration` handling `P#DT#H#M#S` | Existing `/api/youtube-meta` parser drops days and breaks on `P0D` |
| Arabic detection | New Unicode ranges | `hasArabicScript` from `src/lib/arabic-text.ts` (Phase 2) | Already covers Arabic, Supplement, Extended-A, presentation forms |

**Key insight:** every hard correctness problem in this phase (atomic ordering, atomic import, quota, cron limits) is solved by doing one set-based statement or one batched call instead of many small ones.

## Runtime State Inventory

Phase 6 contains a contract migration (key column removal) and a secret move, so the stored-state question applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `app_config.youtube_api_key` (1 row, id=1) holds the old key. `episodes.youtube_video_id` holds ids; **live may contain duplicate or seed test ids** (PROD-09 mentions test YouTube IDs; Phase 1 audit counted 39 episodes, 9 shorts, no duplicate check was run) | Migration: null the value then drop the column (data migration + schema contract). **Read-only pre-flight on live:** `select youtube_video_id, count(*) from episodes where youtube_video_id is not null group by 1 having count(*) > 1;` must return 0 rows before the unique index is created, otherwise the migration aborts. Controller runs it; this session must not |
| Live service config | Google Cloud: old key (in DB, treat as leaked) and the new "clickit-story" project key | Owner steps: create restricted key, later delete the old key |
| OS-registered state | None - verified: no OS tasks reference the key; Vercel crons are being removed in Phase 2/3 | none |
| Secrets/env vars | `YOUTUBE_API_KEY` Worker secret (new); `CRON_SECRET` already planned in Phase 2 | `wrangler secret put` by Koss; add `YOUTUBE_API_KEY` to `.env.example` placeholder and `WorkerEnv` type; never in a file |
| Build artifacts | `src/lib/database.types.ts` (generated) still lists `youtube_api_key` and lacks new columns; `reorder_episode` is cast by hand because the types do not list functions | Regenerate with `npm run gen-types` after the migration is applied locally; add typed rpc entries or keep the cast helper |

**Order of the owner steps (do not reorder):** (1) create restricted key; (2) `wrangler secret put YOUTUBE_API_KEY`; (3) deploy code that reads the secret; (4) press "Test key" in Settings until it shows success; (5) approve and apply the contract migration; (6) delete the old key in Google Cloud. Deleting the old key before step 3 breaks metadata fetch; dropping the column before step 3 loses the only working key.

## Common Pitfalls

### Pitfall 1: Private/deleted entries inside a playlist
**What goes wrong:** the official `playlistItems.list` page says nothing about how private or deleted videos appear [VERIFIED: page read 2026-10-20]. Community reports describe placeholder titles and missing thumbnails (A1), but that is not documented.
**How to avoid:** never branch on the title text. Take the id from `snippet.resourceId.videoId` (present only when `resourceId.kind` is `youtube#video`) or `contentDetails.videoId`, send all ids to `videos.list`, and classify "not returned" as Removed (A3). Tag the row with "Removed or private" in the UI.
**Warning signs:** preview count of playable rows lower than playlist length; rows titled "Private video".

### Pitfall 2: Unlisted playlist readable with a key? Undocumented
**What goes wrong:** `playlists.list` and `playlistItems.list` pages do not say whether an API key reads Unlisted playlists; `videos` docs only confirm that for an Unlisted video "anyone who knows the video ID can retrieve the metadata" [CITED: videos resource]. If a key cannot read an Unlisted playlist, D-06's Unlisted workflow still works for videos but the playlist-link import fails.
**How to avoid:** UAT step 1 uses a real Unlisted playlist on the Clickit channel. Errors to map: 404 `playlistNotFound`, 403 `playlistForbidden` / `playlistItemsNotAccessible`, 400 `playlistOperationUnsupported` all become "Open the playlist on YouTube and set it to Unlisted or Public" [CITED: playlistItems/playlists list error tables]. Fallback if keys cannot read Unlisted playlists: admin pastes video links one by one (single add).

### Pitfall 3: Quota facts
Default 10,000 units/day, `search.list` and `videos.insert` have separate 100/day buckets, invalid requests still cost at least 1 unit, reset at midnight Pacific (11:00 or 12:00 Dubai depending on DST) [CITED: developers.google.com/youtube/v3/determine_quota_cost]. A hostile or buggy loop on the preview action is the only realistic way to burn quota: admin-only, and cap items per call.

### Pitfall 4: Error shapes
Global error table lists `quotaExceeded` (403), `forbidden` (403), `invalidFilters` (400 badRequest) [CITED: developers.google.com/youtube/v3/docs/errors]. The page does not list `keyInvalid`, `accessNotConfigured` or `ipRefererBlocked`; treat them as MEDIUM (A8) and branch on HTTP status plus a fixed allow-list of reason strings, with an "unknown error" fallback that shows status only. `videos.list` can answer `videoNotFound` (404) for a single missing id, so handle both "200 with fewer items" and "404".

### Pitfall 5: The A -> B -> A resume race (YT-05 root causes)
1. `progressMap` is a page-load snapshot. Fix: `positionsRef` updated on every switch (Pattern 6).
2. `use-progress-tracker.ts` last effect: `useEffect(() => () => { forceFlush() }, [forceFlush])` re-runs its cleanup every time `forceFlush` changes, i.e. when `currentEpisode.id` changes, which happens after `handleEpisodeSwitch` already called `loadVideoById`. The cleanup runs the **old** closure (old `episodeId`) but reads the **new** video's clock. The `currentTime < 2` guard hides the 0:00 case but a resume at 9:12 would be written onto the outgoing episode. Fix: unmount-only cleanup via a ref (`latestFlush.current`), and let the shell's explicit pre-switch flush be the only switch-time save.
3. `lastSavedRef` is never reset on switch, so the first save of the next episode can be suppressed by the `< 10 s` delta rule. Reset it to the resume position on switch.
Extract the save decision into a pure `shouldSaveProgress({ currentTime, duration, lastSaved, force })` and test it.

### Pitfall 6: Error 153 is a site problem, not an episode problem
Keep `Referrer-Policy: strict-origin-when-cross-origin` (currently set in `next.config.ts` line 95; Phase 2 moves headers to Workers, re-check them there). RMF says clients must send an HTTP Referer and YouTube recommends exactly this policy [CITED: required-minimum-functionality]. `YT.Player` builds the iframe itself, so the document-level policy is what applies; do not rely on setting `referrerpolicy` on the iframe. Never flag an episode for 153.

### Pitfall 7: Unique index on `youtube_video_id` can fail the migration
See Runtime State Inventory. Use `create unique index ... on public.episodes (youtube_video_id) where youtube_video_id is not null` covering **archived rows too** (recommended): otherwise archive -> import the same video -> restore the archived one violates the index at restore time and breaks the Phase 1.1 restore flow. Single add and edit must map `23505` on this index to "This video is already on Clickit as <show> S<n> E<m>".

### Pitfall 8: New columns and grants
`episodes` privileges are `revoke all` then an explicit column grant list for `anon`/`authenticated`; new columns stay unreadable to them (fail-closed, good) and `episodes_view` does not need to change [VERIFIED: 20260724115941 lines 90-120]. Admin pages use the service-role client with `select('*')`, so the badge works. Do not add the columns to the grant list or the view.

### Pitfall 9: Migration safety constraints
- CI today is `supabase db push --include-all` on every push to main touching `supabase/migrations/**`; Phase 1 replaces it with approval-gated apply and a guard that fails any new `drop`/`truncate`/`delete` unless the line carries `-- safe-drop: <reason>` (Q2 option A, unshipped; A12). The Phase 6 file needs that waiver on `alter table public.app_config drop column youtube_api_key`.
- Live has no restorable backup (PITR off, empty backup list, Free plan assumed): require a local `pg_dump` before applying [CITED: Phase 1 live audit, branch `origin/phase-01-safe-ground`].
- Order inside the file: add columns, backfill nothing, create unique index (plain, table is tiny: 39 rows), create `renumber_season` and `record_youtube_checks` with `revoke all ... from public, anon, authenticated; grant execute ... to service_role;`, then `update public.app_config set youtube_api_key = null where id = 1;` and `alter table ... drop column`. No `drop` besides the waived one.
- ROADMAP inconsistency: Phase 8 "Owner-gated" still lists "drop `admin_user_id` and `youtube_api_key`" while YT-04 and Phase 6 criterion 2 say the DB copy is gone in Phase 6. Phase 6 does it; ROADMAP Phase 8 text should drop `youtube_api_key` (controller edit, not done here).

### Pitfall 10: Scheduler has no selection (D-07)
`planShowScheduleCore` schedules **every** non-archived, non-published episode of the show, ordered by season then number; `applyShowSchedule(showId)` and `previewShowSchedule(showId)` take only the show id. "Opens the scheduler with the new drafts selected" requires adding an optional `episodeIds: string[]` filter (validated with `parseId` each, scoped to the show) to the core, the two actions and the dialog. Without it a re-import into a show with other drafts would schedule those too. Also surface `needs_english_title` and `youtube_status != ok` rows in the scheduler preview as warnings (the plan already flags `hasVideo: false`).

### Pitfall 11: Cron on Workers Free
10 ms CPU and 50 subrequests per cron run; 15 min wall-clock; 5 cron triggers per account [CITED: developers.cloudflare.com/workers/platform/limits/]. See Pattern 11. Free-plan feasibility is decided by Phase 2's CPU report, not here; Workers Paid is Koss's priced call.

### Pitfall 12: Autoplay on switch and on countdown
`loadVideoById` from a click handler is user-initiated; from a countdown timer it is scripted autoplay, subject to the RMF visibility rule and to browser policy (`onAutoplayBlocked`) [CITED: iframe_api_reference, required-minimum-functionality]. Handle both (Pattern 8).

### Pitfall 13: Captions cannot be verified from code
`cc_load_policy=1` shows captions by default and `cc_lang_pref` takes ISO 639-1 / BCP 47; `hl` "affects tooltips and the default caption track, but YouTube may choose a different caption track" [CITED: player_parameters]. D-12's "when the video has them" cannot be probed from the page; if no English track exists, YouTube decides what to show (A15). English: `hl=en&cc_load_policy=1&cc_lang_pref=en`. Arabic: `hl=ar` only (no `cc_load_policy`, no `cc_lang_pref`), per D-12. Set them in the constructor `playerVars`; they persist across `loadVideoById` on the same instance.

## Code Examples

### 1. Server-side client with header key and batch (sketch)
```ts
// src/server/youtube/client.ts  (pure: fetchImpl injected)
// Source: endpoints/parameters from developers.google.com/youtube/v3/docs/{playlists,playlistItems,videos}/list [CITED]
const BASE = 'https://www.googleapis.com/youtube/v3'
export function createYouTubeClient(opts: { apiKey: string; fetchImpl?: typeof fetch }) {
  const f = opts.fetchImpl ?? fetch
  async function get(path: string, params: Record<string, string>) {
    const res = await f(`${BASE}/${path}?${new URLSearchParams(params)}`, {
      headers: { 'x-goog-api-key': opts.apiKey },   // A14: falls back to ?key= if Google rejects the header
      cache: 'no-store',
    })
    if (!res.ok) throw mapYouTubeError(res.status, await safeJson(res))   // never include the key or URL in the message
    return res.json()
  }
  return {
    getPlaylist: (id: string) => get('playlists', { part: 'snippet,status', id }),
    async listPlaylistItems(playlistId: string, maxItems = 200) {
      const ids: string[] = []; let pageToken: string | undefined
      do {
        const body = await get('playlistItems', { part: 'contentDetails', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) })
        for (const it of body.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId)
        pageToken = body.nextPageToken
      } while (pageToken && ids.length < maxItems)
      return ids.slice(0, maxItems)
    },
    async getVideos(ids: string[]) {                       // 50 per call (A4)
      const out = new Map<string, unknown>()
      for (let i = 0; i < ids.length; i += 50) {
        const body = await get('videos', { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(',') })
        for (const v of body.items ?? []) out.set(v.id, v)
      }
      return out                                           // absent id => classifyVideo(undefined) => 'removed'
    },
  }
}
```
`playlistItems` with `part=contentDetails` gives the id and order; the title/description come from `videos.list`, so unavailable items never inject placeholder text.

### 2. Resume and save rules (pure, unit-tested)
```ts
// src/lib/watch/resume.ts
export function resumeSecondsFor(p?: { progressSeconds: number; durationSeconds: number; completed: boolean }): number {
  if (!p || p.completed) return 0
  if (!Number.isFinite(p.progressSeconds) || p.progressSeconds < 5) return 0
  if (p.durationSeconds > 0 && p.progressSeconds >= p.durationSeconds - 5) return 0
  return Math.floor(p.progressSeconds)
}
export function shouldSaveProgress(i: { currentTime: number; duration: number; lastSaved: number; force: boolean }): boolean {
  if (!Number.isFinite(i.currentTime) || i.currentTime < 0) return false
  if (!Number.isFinite(i.duration) || i.duration <= 0) return false
  if (i.currentTime < 2 && i.lastSaved > 2) return false
  if (!i.force && Math.abs(i.currentTime - i.lastSaved) < 10) return false
  return true
}
```

### 3. Constructor params and switch
```ts
// Source: developers.google.com/youtube/player_parameters, iframe_api_reference [CITED]
playerVars: {
  autoplay: 0, controls: 1, rel: 0, playsinline: 1, enablejsapi: 1, iv_load_policy: 3,
  origin: window.location.origin,
  hl: locale,                                      // 'en' | 'ar'
  ...(locale === 'en' ? { cc_load_policy: 1, cc_lang_pref: 'en' } : {}),
  start: initialResumeSeconds,                     // replaces seekTo-in-onReady
},
events: { onReady, onStateChange, onError, onAutoplayBlocked }
// switch (user click):
positionsRef.current[outgoing.id] = { seconds: p.getCurrentTime(), duration: p.getDuration(), completed: false }
forceFlush()
p.loadVideoById({ videoId: target.youtubeId, startSeconds: resumeSecondsFor(positionsRef.current[target.id]) })
```

### 4. `renumber_season` skeleton (the migration is a plan task; reviewed before apply)
```sql
create or replace function public.renumber_season(p_season_id uuid)
returns table (episode_id uuid, old_number integer, new_number integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_off bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_season_id::text, 3071971));  -- same key as reorder_episode
  perform 1 from public.episodes where season_id = p_season_id for update;
  if not found then raise exception using errcode='P0002', message='Season not found or empty'; end if;
  select greatest(max(e.episode_number),0) + count(*) + 1 into v_off from public.episodes e where e.season_id = p_season_id;
  -- ... capture old numbers, phase A: + v_off, phase B: active rows 1..N by old order, archived N+1..N+K, return rows,
  --     raise P0001 'Already numbered' when nothing changes
end $$;
revoke all on function public.renumber_season(uuid) from public, anon, authenticated;
grant execute on function public.renumber_season(uuid) to service_role;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Related videos disable-able with `rel=0` | `rel=0` only limits suggestions to the same channel | on/after 2018-09-25 [CITED: player_parameters] | End screen cannot be fully suppressed inside the player |
| Error 153 undocumented | Documented in IFrame API: missing Referer / client identification | seen in 2025-12 reports; documented now [CITED: iframe_api_reference] | Add 153 to error handling; keep referrer policy |
| `onAutoplayBlocked` absent | Event exists and `@types/youtube` declares it | current docs | Handle blocked scripted playback |
| Developer Policies 30-day rule | Updated 2026-10-15; API-key data may be stored temporarily, at most 30 days, then deleted or refreshed (III.E.4.d); statistics must not be kept past 30 days if non-authorized (III.E.4.b) [CITED: developer-policies] | current | Daily cron satisfies "refresh"; also means do not store view counts at all |
| `/api/youtube-meta` reading key from DB with single `admin_user_id` | Server Action + Worker secret + `requireAdmin` | this phase | |

**Deprecated/outdated in this repo:** `src/app/api/youtube-meta/route.ts`; `getYouTubeApiKey()` in `config.ts`; `youtube_api_key` in the `updateIntegrations` schema; `GET` Playwright specs that use seed ids (`/watch/e1-1-1`, stale since seed data was neutralised).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Private/deleted playlist items show placeholder titles/no thumbnails | Pitfall 1 | None to design (not relied on) |
| A2 | An API key can read an Unlisted playlist by id | Pitfall 2 | Playlist import unusable for Unlisted playlists; fall back to per-video add; **UAT-1** |
| A3 | `videos.list` omits unavailable ids rather than erroring | Pattern 3 | If it errors on a bad id, batch fails: retry halves the batch; unit-test both shapes |
| A4 | `videos.list` accepts at most 50 ids (third-party source; the official page states no cap) | Pattern 1 | Larger chunks would 400; chunking at 50 is safe either way |
| A5 | JSON may omit an empty `regionRestriction.allowed` array | Pattern 3 | A blocked-everywhere video classified ok; low probability, low impact (player error handles it) |
| A6 | Age-restricted videos are not embeddable and could be detected via `contentDetails.contentRating.ytRating` | not in design; optional extra | Missed pre-flag; the player error path still catches them |
| A7 | `process.env.YOUTUBE_API_KEY` is populated in the OpenNext Worker; `getCloudflareContext().env` is the safe first read | Pattern 5 | Key reads as missing; Settings "Key missing"; found at the first deploy test |
| A8 | Google error reason strings `keyInvalid`, `accessNotConfigured`, `ipRefererBlocked` | Pitfall 4 | Wrong plain-language message; branch on HTTP status keeps correctness |
| A9 | Titles/descriptions admins accept at import become Clickit editorial content, not "API data to refresh" | Summary, D-17 | A strict reading of III.E.4.d/e would require refreshing titles too; conflicts with D-05. Koss to confirm (Open Question 2) |
| A10 | Reusing the same `YT.Player` after hiding keeps scripted-play permission | Pattern 8 | Next episode may need a tap on iOS Safari; `onAutoplayBlocked` handler covers it; UAT |
| A11 | The iframe created by `YT.Player` carries an `allow="autoplay"` policy | Pattern 8 | as A10 |
| A12 | Phase 1's migration guard will use a `-- safe-drop: <reason>` waiver | Pitfall 9 | Waiver syntax differs; CI blocks the Phase 6 migration until fixed |
| A13 | Phase 5 `requireAdmin()` returns `{ id: string }` and is injected through `AdminActionEnv.assertAdmin` | Upstream table | Wrapper signature changes; one-line adaptation |
| A14 | YouTube Data API v3 accepts the `x-goog-api-key` header | Pattern 5 / Example 1 | Client falls back to `?key=`; the key-test action detects it on day one |
| A15 | With `cc_load_policy=1&cc_lang_pref=en` and no English track, YouTube shows nothing or its own default | Pitfall 13 | Cosmetic; D-12 says "when the video has them" |
| A16 | Region/Content ID blocks sometimes show an in-iframe message without firing `onError` | Pattern 10 | If always signalled, preflight is redundant but harmless |
| A17 | A cron run through `handler.fetch` may exceed 10 ms CPU on Workers Free | Pattern 11 | Cron fails on Free; mitigation: direct call from `scheduled()`, or Koss's priced Paid decision |

## Open Questions

1. **D-09 policy risk: accept or use the bar-below fallback?**
   - What we know: RMF allows unmounting/hiding the player when nothing overlays a visible one; the Developer Policies Guide says not to disable or block Related Video links after completion. The earlier project research (PITFALLS 13) judged "unmount or hide the iframe" fine; this session found the Guide line it did not cite.
   - What's unclear: whether YouTube would treat a custom up-next card as "blocking" related links; no enforcement precedent found.
   - Recommendation: implement D-09 as signed behind `ENDED_MODE`, state the risk in the plan, and let Koss confirm at the plan gate. If he prefers zero risk, flip to `bar-below-player` (same countdown, iframe stays visible).
2. **D-17 and D-05: what exactly does the 30-day refresh cover?**
   - Recommendation: the cron refreshes status, length and checked-at; titles/descriptions are treated as Clickit-authored after import (A9). Koss should know this is an interpretation, not a quote from the policy.
3. **Archived rows during `renumber_season`:** recommend moving them to N+1..N+K. Alternative: leave archived numbers untouched and fail if they collide. Planner may pick the alternative if the audit diff should not touch archived rows.
4. **Shorts and hero YouTube ids** are outside D-17's wording. Recommend adding shorts ids to the same batch in Phase 7 (PROD-07).
5. **Player error 5 and 2 as "flags":** recommend reporting all reportable codes but weighting 5 as low severity (transient). Koss's D-11 lists them as flagged; keep, but show the code in the admin badge tooltip so admins can judge.
6. **After the user presses Cancel on the up-next card:** recommend card stays with "Play now" and "Watch again" (Pattern 8).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | unit tests (`--experimental-strip-types`) | yes | v26.7.0 | - |
| wrangler | secret put, local scheduled test (owner/controller) | yes | `/Users/koss/.local/bin/wrangler` (Phase 2 pins 4.151.2) | - |
| supabase CLI | migration authoring, `gen-types`, read-only live queries by the controller | yes | 2.119.0 | - |
| Google Cloud project "clickit-story" + restricted key | live import, key test | not created | - | Unit tests use injected `fetch`; live checks wait for Koss's owner steps |
| Local Supabase stack | e2e/DB-function tests | one at a time machine rule; not needed for unit tests | - | `fake-supabase` + SQL reviewed by the controller; run the real function tests against a local stack only under the heavy lock |
| Live Supabase read access | duplicate-id pre-flight | controller only | - | This research made no live access |

**Missing dependencies with no fallback:** none for planning. The real key, the Unlisted playlist test and error-case videos are required for UAT only.
**Missing dependencies with fallback:** Google key (unit tests with fixtures).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` with `--experimental-strip-types` (no vitest, no jest). Playwright 1.58 exists (`tests/e2e/*.spec.ts`) but its specs use deleted seed data and a dev server; QA-01 (Phase 8) owns e2e |
| Config file | none; `package.json` script |
| Quick run command | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/youtube-*.test.ts tests/unit/watch-*.test.ts` |
| Full suite command | `npm run test:unit` (gate: `npm run gate:local`, run under the heavy lock; not run in this research) |

Test-writing rules from the repo: modules under test import siblings with `.ts` extensions, no `@/`, no `server-only`, no `next/*`; DB logic goes through `AdminDb` with `tests/unit/helpers/fake-supabase.ts` (`registerRpc`, `failOn`); add `emulateRenumberSeason` beside `emulateReorderEpisode`. The existing `admin-actions-id-coverage.test.ts` reads `actions.ts` and requires every exported action that takes an id to call `parseId(` or a `*Core(`; new actions must follow it. `tests/unit/helpers/reorder-episode-emulator.ts` documents that the unit emulator mirrors the SQL; real SQL is exercised only on a local stack (controller) and in the migration review.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| YT-01 | Playlist URL parsing (`list=`, youtu.be, reject non-YouTube hosts, reject malformed ids) | unit | `node ... --test tests/unit/youtube-urls.test.ts` | Wave 0 |
| YT-01 | Paging via `nextPageToken`, cap 200, batches of 50, ISO duration incl. days/hours/PT0S | unit (fake fetch) | `... youtube-client.test.ts`, `youtube-duration.test.ts` | Wave 0 |
| YT-01 | Preview writes nothing | unit (fake db: zero write calls) | `... youtube-import.test.ts` | Wave 0 |
| YT-02 | `classifyVideo` truth table: private, removed (absent), deleted/failed/rejected, not_ready (uploaded, upcoming, live), not_embeddable, AE in blocked, AE missing from allowed, allowed `[]`, unlisted ok | unit | `... youtube-status.test.ts` | Wave 0 |
| YT-02 | Re-import adds nothing (all ids exist); archived-elsewhere id counted "already on Clickit"; drafts only; numbers continue after max incl. archived; new season starts at 1; unplayable rows skipped without consuming numbers | unit (fake db) | `... youtube-import.test.ts` | Wave 0 |
| YT-02 | Arabic/English field routing, `needs_english_title`, mixed script majority rule | unit | `... youtube-script.test.ts` | Wave 0 |
| YT-02 | Commit rejects tampered payload (non-11-char id, duplicate ids, id the server re-check says private) | unit | `... youtube-import.test.ts` | Wave 0 |
| YT-02 | Failure injection: insert fails -> new season removed, counts unchanged, error returned | unit (`failOn`) | `... youtube-import.test.ts` | Wave 0 |
| YT-03 | `verifyVideos` single id: bad format refused before any fetch; missing/private/not embeddable/AE refused with plain message; 23505 mapped to "already on Clickit" | unit | `... youtube-verify.test.ts` | Wave 0 |
| YT-04 | Key resolver: Worker env first, `process.env` fallback, trimmed, empty = missing; error mapping never contains the key; `youtube_api_key` absent from `updateIntegrations` schema and Settings source (source-scan test like `admin-ui-guards.test.ts`) | unit | `... youtube-key.test.ts` | Wave 0 |
| YT-04 | Migration text check: contains `drop column` for `youtube_api_key` with the waiver comment, nulls it first, grants new functions to `service_role` only, creates unique index | unit (read the .sql file) | `... youtube-migration.test.ts` | Wave 0 |
| YT-05 | `resumeSecondsFor` table; `shouldSaveProgress` table; A->B->A sequence on a fake player + positions map (pure reducer `nextPositions(state, event)`) | unit | `... watch-resume.test.ts` | Wave 0 |
| YT-06 | `classifyPlayerError` table incl. 153 not reportable; `ENDED_MODE` card logic (pure state machine: playing -> ended -> countdown -> advance only when visible; cancel keeps card) | unit | `... watch-player-state.test.ts` | Wave 0 |
| YT-06 | Source scan: watch components contain no `fixed`/`absolute inset-0` sibling over the player, no `Drawer`, no `onMouseEnter` on the episode list; `playerVars` include `hl` | unit (static) | `... watch-layout-guards.test.ts` | Wave 0 |
| YT-07 | `reorderEpisodeCore` already tested (Phase 1.1); add gap case (1,2,4 -> move 4 up) with emulator | unit | existing `admin-episode-lifecycle.test.ts` + new case | partly |
| YT-07 | `renumberSeasonCore` + `emulateRenumberSeason`: gaps closed 1..N, archived pushed after N, no duplicates, no-op refused, audit row with map, RPC failure leaves rows unchanged | unit | `... admin-renumber.test.ts` | Wave 0 |
| D-17 | `recheckVideosCore`: batches, one RPC call, updates only status/checked/duration, never title; clears stale player reports; quota error returns without writing | unit | `... youtube-recheck.test.ts` | Wave 0 |
| D-17 | Cron path map includes the new expression; unauthorized request refused | unit | extend `cron-schedule.test.ts`, `cron-auth.test.ts` | partly |
| D-07 | Scheduler `episodeIds` filter: only selected ids planned; foreign-show ids refused | unit | extend `admin-show-schedule.test.ts` | partly |

### Sampling Rate
- **Per task commit:** the quick command for the touched module.
- **Per wave merge:** `npm run test:unit`.
- **Phase gate:** `npm run gate:local` green (under `/Users/koss/.clickit-heavy.lock`) plus the controller's clean-clone check, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Test files listed above (all new).
- [ ] `tests/unit/helpers/renumber-season-emulator.ts` (mirror of the SQL, header comment like the reorder emulator).
- [ ] JSON fixtures for `playlistItems`/`videos` responses written from the documented shapes. They are **not** recorded from the live API (limit: no API calls with a key); mark them as "documented shape" and re-validate against one real playlist at UAT.
- [ ] Framework install: none.

### Manual-only (cannot be proven by unit tests)
1. Owner creates the restricted key and sets the Worker secret; "Test key" returns success (proves A14 and the restriction).
2. Real Unlisted playlist previews with an API key (A2), including a Private video, a deleted video, a premiere and a non-embeddable video if one exists.
3. A video that is blocked in the UAE shows the branded card (A16); error 150/101 card on a known non-embeddable video.
4. Watch page visual check at 375 px and desktop: nothing overlaps the iframe (hand-check with devtools element picker over all four corners and centre), 16:9 letterbox, tray not raising on hover.
5. A -> B -> A resume on desktop Chrome and on iOS Safari (autoplay and `onAutoplayBlocked` behaviour, A10/A11).
6. ENDED: card appears, countdown only advances while the player is on screen, "Cancel" behaviour.
7. English site shows English captions when the video has them; Arabic site follows the viewer's YouTube caption setting; `hl` UI language on both.
8. Daily cron on `wrangler dev` via `/cdn-cgi/local/scheduled?cron=...` and, after cutover, one real run (Koss's go).
9. Import with a duplicate and archived duplicate; renumber on a real show copy (never on live without Koss).

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json`, so this section is included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (admin actions) | `requireAdmin` / `assertAdmin` on every new action; viewer report action needs a signed-in user |
| V3 Session Management | no change | Supabase session via proxy |
| V4 Access Control | yes | Admin-only preview/commit/test/renumber; DB functions `execute` only for `service_role`; new episode columns not readable by `anon`/`authenticated`; ids scoped to the show/season with `parseId` |
| V5 Input Validation | yes | zod: playlist URL host allow-list + `list=` regex, 11-char `^[A-Za-z0-9_-]{11}$` ids, `videoIds.max(200)` unique, `code` allow-list, uuid ids |
| V6 Cryptography | yes (secrets) | Key only in Worker secret, header transport, never logged or sent to client; constant-time cron auth (`cronAuthOk`) |
| V7 Error handling / logging | yes | Errors return plain messages; logs carry status and reason only, never the key or full URL |
| V13 API / SSRF | yes | Only fixed YouTube hosts are fetched; the admin cannot supply a URL that the server fetches (only ids) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Key leakage via URL/log/DB | Information disclosure | Worker secret, `x-goog-api-key` header, no `next` fetch cache, redacted errors; old DB key deleted |
| Tampered import payload (private video, injected HTML in titles) | Tampering | Commit re-fetches from YouTube; titles stored as text and React-escaped; YouTube forbids `<`/`>` in titles but descriptions may contain markup, render as text only |
| Quota exhaustion by loop or by viewers | Denial of service | Admin-only API actions; report action never calls YouTube; item cap; rate limit |
| Viewer spam-flagging episodes | Tampering | Signed-in, rate-limited per user and episode, allow-listed codes, flag is advisory (no unpublish) |
| Admin CSRF / replay on Server Actions | Spoofing | Next Server Action origin checks; admin guard on every call |
| Cron endpoint probing | Spoofing | Bearer secret, constant-time compare, route unreachable otherwise |
| DB function abuse | Elevation of privilege | `security invoker`, fixed `search_path`, `revoke all ... from public, anon, authenticated`, grant to `service_role` only (same as `reorder_episode`) |
| Stale iframe `src` injection via stored id | Tampering | `validateYouTubeUrl` host allow-list and 11-char regex retained; embed built from the id only |

## Codebase Change Map

| Req | Files (main today unless noted) | Change |
|-----|-------------------------------|--------|
| YT-01/02 | NEW `src/server/youtube/*`, `src/lib/admin/youtube-import.ts`; `admin/actions.ts` wrappers; NEW `src/components/admin/import-playlist-sheet.tsx`; `admin/shows/[id]/page.tsx` (button next to `ScheduleEpisodesButton`, pass seasons + nextEpisodeNumber); `src/lib/youtube.ts` (keep `validateYouTubeUrl`; add playlist parsing in the pure module) | preview/commit, sheet UI, i18n |
| YT-02 | migration; `episodes-table.tsx` (badge "Can't play", "Needs English title" chip); `admin/page.tsx` (dashboard count of non-ok); `database.types.ts` regen | status columns, badges |
| YT-03 | `admin/actions.ts` `createEpisode`/`updateEpisode` (Phase 1.1: `createEpisodeCore`/`updateEpisodeCore` in `season-episode-writes.ts`); `episode-form-drawer.tsx` `YouTubeFetchButton` (switch from `fetch('/api/youtube-meta')` to the Server Action; message for refused ids); delete `src/app/api/youtube-meta/route.ts` | server-side verify |
| YT-04 | `src/lib/config.ts` (remove `getYouTubeApiKey`, the `youtube_api_key` comments at 217-230, 462-477); `admin/settings/page.tsx`; `settings/advanced-tab.tsx` (remove `yt` state, `SecretField` usage, `updateIntegrations` field; add status + Test button); `settings/secret-field.tsx` (check other users before deleting); `actions.ts` (schema line ~2845, cleaned ~3214); `src/server/cloudflare.ts` (`WorkerEnv.YOUTUBE_API_KEY?`); migration; `.env.example` | secret move |
| YT-05 | `src/lib/queries.ts` `getEpisodesProgress` (add seconds/duration), `watch/[episodeId]/page.tsx`, `watch-shell.tsx` (`progressMap` type, `positionsRef`, `handleEpisodeSwitch`, remove `onReady` seekTo), `youtube-player.tsx` (`start`, `hl`, `cc_*`, `onAutoplayBlocked`, expose hide), `use-progress-tracker.ts` (unmount-only flush, reset `lastSavedRef`, use `shouldSaveProgress`), NEW `src/lib/watch/resume.ts` | resume |
| YT-06 | `watch-shell.tsx` (stacked layout, control bar, ENDED/error cards, remove idle timer), `autoplay-overlay.tsx` (becomes the up-next card, no `absolute inset-0`), `episode-tray.tsx` (static list, no Vaul drawer, no hover raise), `episode-nav.tsx`/`episode-breadcrumb.tsx` (check whether used), `messages/en.json`+`ar.json` (`player.*`, `watch.*`, `admin.*` new keys; remove unused `raiseTray`/`lowerTray`), `next.config.ts` (no change; confirm Referrer-Policy survives the Workers header move), `queries.ts` unplayable lookup, NEW `reportPlayerError` action | RMF layout, errors |
| YT-07 | `episodes-table.tsx` (toast uses mapped message, "Renumber 1 to N" button with `ConfirmDialog`), Phase 1.1 `episode-lifecycle.ts` (`renumberSeasonCore`), migration (`renumber_season`), emulator + tests; on current main `reorderEpisode` (actions.ts ~1614) is the old unsafe version and is replaced by Phase 1.1's wrapper | renumber |
| D-07 | Phase 1.1 `show-schedule.ts` (`planShowScheduleCore` optional `episodeIds`), `actions.ts` `previewShowSchedule`/`applyShowSchedule` signatures, `schedule-episodes-button.tsx` (accept `episodeIds`, controlled open), import sheet success state | selection |
| D-17 | NEW `src/app/api/cron/youtube-recheck/route.ts`, `src/lib/admin/youtube-check.ts`, `src/server/cron-schedule.ts` (`CRON_ROUTES`), `wrangler.jsonc` triggers list at cutover, `tests/unit/cron-schedule.test.ts` | cron |

Messages: every new string in `en.json` and `ar.json` (admin is bilingual), nothing under 11 px, 44 px targets, tokens from `src/styles/globals.css` / `ui.config.json`; picture-first rule: mockups `06-q1`, `q8`, `q9`, `q11`, `q13`, `q15` are signed, anything not pictured (renumber confirm dialog, up-next after Cancel, scheduler warnings) needs a mockup before code.

## Project Constraints (from CLAUDE.md)

From `CLAUDE.md` (project), `CLAUDE.local.md` and the common rules the planner must honour:
- Stack: Next.js 16 App Router + Supabase + Tailwind v4 on Cloudflare Workers; **YouTube embed only**.
- **Never wipe the live Supabase DB**; live DB writes, DNS, secrets and real-person emails are owner-gated, one numbered step each. This research made no live access; the duplicate-id pre-flight and the migration apply belong to the controller.
- **Cloudflare work only in the ClickitStory account** via `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 ...`; never the default (Vamos) login or the Cloudflare MCP connector.
- Free tiers first; any paid Cloudflare feature (Workers Paid, Images) is priced and agreed with Koss.
- Work session rules: own branch/worktree, no push to `main`, no deploy; Koss signs discuss, plan, UAT and ship; design before code for anything a viewer or admin sees; GSD workflow (`/gsd-execute-phase`) before edits; no new-project init.
- Heavy steps (`npm run build`, `gate:local`, Playwright) one at a time under `/Users/koss/.clickit-heavy.lock`; Playwright `--workers=2` max; detached runs write an `exit=` line.
- Reviews: Grok subscription via `delegate_task`; fallback the local `reviewer` agent, said on the PR. CI Linux only, once on PR open, `paths-ignore` docs and `.planning`, `concurrency` cancel, `timeout-minutes`.
- Reviewed migration before any live apply: dry-run approved by Koss; local `pg_dump` first (no restorable backup on live).
- UI: password fields not involved; 44 px targets, min 11 px text, tokens only, RTL-safe logical classes (`start-*`, `end-*`) in new code (AR-03 arrives in Phase 7 but new code should already comply).
- Jev: none in Phase 6 (D-18); automation-first suggestion for this phase: the daily re-check cron is itself the unattended agent; a possible later addition is a weekly digest to the two admins listing "Can't play" episodes (Phase 5 email queue), propose only.
- Secrets never in chat or files; the key appears only in Koss's terminal.

## Sources

### Primary (HIGH confidence)
- https://developers.google.com/youtube/v3/docs/playlistItems/list - quota 1, maxResults 0-50, `part`, error table
- https://developers.google.com/youtube/v3/docs/playlistItems - resource fields (`position` zero-based, `resourceId.videoId`, `contentDetails.videoId`); silent on private/deleted
- https://developers.google.com/youtube/v3/docs/playlists/list - quota 1, error table; silent on key access to Unlisted
- https://developers.google.com/youtube/v3/docs/videos/list - quota 1, parts, error table
- https://developers.google.com/youtube/v3/docs/videos - `regionRestriction.allowed/blocked`, `uploadStatus`, `privacyStatus`, `embeddable`, `liveBroadcastContent`, `duration` formats, thumbnail keys
- https://developers.google.com/youtube/v3/determine_quota_cost - 10,000/day, invalid requests charged, reset midnight PT, `search.list` separate bucket
- https://developers.google.com/youtube/v3/docs/errors - `quotaExceeded`, `forbidden`, `invalidFilters`
- https://developers.google.com/youtube/v3/getting-started - `fields` partial response syntax
- https://developers.google.com/youtube/terms/required-minimum-functionality - overlays, 200x200, autoplay visibility, one autoplaying player, mouseovers, Referer / `strict-origin-when-cross-origin`
- https://developers.google.com/youtube/terms/developer-policies - III.E.4 (30-day rules, Non-Authorized Data), III.I.4/6 (last updated 2026-10-15)
- https://developers.google.com/youtube/terms/developer-policies-guide - "Related Video links ... after the video completes" do-not; overlay note
- https://developers.google.com/youtube/iframe_api_reference - `loadVideoById`, `cueVideoById`, `seekTo`, error codes incl. 153, `onAutoplayBlocked`, `destroy`
- https://developers.google.com/youtube/player_parameters - `hl`, `cc_load_policy`, `cc_lang_pref`, `rel`, `start`, `origin`, `playsinline`
- https://docs.cloud.google.com/docs/authentication/api-keys and /api-keys-use - application vs API restrictions, `x-goog-api-key` header
- https://developers.cloudflare.com/workers/platform/limits/ - Free/Paid limits (subrequests, CPU per cron, 5 cron triggers/account)
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ - UTC, 15 min propagation, empty array removes, local scheduled URL
- https://opennext.js.org/cloudflare/howtos/env-vars - variables/secrets, `.env` locally
- https://www.postgresql.org/docs/17/sql-altertable.html and /sql-set-constraints.html - `ALTER CONSTRAINT` FK-only; non-deferrable unique checked immediately
- https://docs.postgrest.org/en/stable/references/api/tables_views.html - bulk insert uses a single INSERT statement
- Repo: `supabase/migrations/20260724115941_restrict_public_episode_access.sql`, `src/components/watch/*`, `src/hooks/use-progress-tracker.ts`, `src/lib/queries.ts`, `src/app/[locale]/admin/actions.ts`, `src/lib/config.ts`, `next.config.ts`, `package.json`
- Branches (read via `git show`): `origin/claude/phase-02-execute-19d86a` (wrangler.jsonc, custom-worker.ts, src/server/*, src/lib/admin/*, src/lib/arabic-text.ts, tests/unit/helpers/*), `origin/phase-01-safe-ground` (`01-LIVE-AUDIT.md`, `01-DISCUSS-QUESTIONS.md`)

### Secondary (MEDIUM confidence)
- Third-party write-up: 50-id cap on `videos.list` (technetexperts.com, via search) - A4
- https://simonwillison.net/2025/Dec/1/youtube-embed-153-error/ and university KB articles - error 153 fixes (consistent with official docs)
- Phase 2 `02-RESEARCH.md` statements on `process.env` with OpenNext and cron CPU (cited there to OpenNext/Cloudflare docs)

### Tertiary (LOW confidence)
- Community reports of "Private video"/"Deleted video" placeholder titles (A1; no source fetched)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new; versions read from package.json and the Phase 2 branch
- Architecture: MEDIUM-HIGH - API/Postgres/Cloudflare facts verified; Phase 5 interface and Phase 1 guard syntax are assumptions
- Pitfalls: MEDIUM - policy interpretation (D-09, D-17), Unlisted-playlist access, and `videos.list` omission behaviour are not settled by the docs and are carried as flagged assumptions with UAT steps

**Research date:** 2026-10-20
**Valid until:** 2026-11-03 (14 days: YouTube policies were updated 2026-10-15 and Phase 1/2/5 outputs may change the upstream seams)
