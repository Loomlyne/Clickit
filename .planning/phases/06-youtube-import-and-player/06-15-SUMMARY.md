---
phase: 06-youtube-import-and-player
plan: 15
subsystem: ui
tags: [admin, youtube, episode-form, shorts, server-actions, i18n, node-test]

requires:
  - phase: 06-05
    provides: "admin.youtubeErrors.*, admin.youtubeStatus.needsEnglishTitle, admin.episodeForm.needsEnglishTitleHint / notSavedToast, YouTubeStatusChip"
  - phase: 06-13
    provides: "fetchYouTubeMeta, createEpisode/updateEpisode server video check with data.youtubeError"
provides:
  - "Episode form fetches and validates the video through the fetchYouTubeMeta Server Action"
  - "Plain-words refusal under the link field; save refusal scrolls, focuses and toasts"
  - "Needs English title hint under the title (shared needsEnglishTitle rule)"
  - "EpisodeFormDrawer initialFocus='title' prop (for 06-18)"
  - "Shorts form on the same Server Action (forShort); GET /api/youtube-meta deleted"
affects: [06-18, 06-19]

tech-stack:
  added: []
  patterns:
    - "Refusal text is built on the client from code + i18n key table; no server text is shown raw"
    - "Source-scan guard test over the form components and a recursive scan of src for the deleted route"

key-files:
  created:
    - tests/unit/admin-youtube-form-guards.test.ts
  modified:
    - src/components/admin/episode-form-drawer.tsx
    - src/components/admin/short-form-drawer.tsx
    - src/app/[locale]/admin/actions.ts
    - src/server/youtube/duration.ts
  deleted:
    - src/app/api/youtube-meta/route.ts

key-decisions:
  - "fetchYouTubeMeta gained an optional excludeEpisodeId so the edit form does not report an episode's own video as a duplicate"
  - "Quota refusals get {time} from formatQuotaReset(nextQuotaReset(now)) on the client, since the action's data carries only code and duplicate params"
  - "The Sheet's onOpenAutoFocus is used for initialFocus (prevent default, then form.setFocus('title')) so Radix does not steal the focus back"

requirements-completed: [YT-03]

duration: ~25min
completed: 2026-10-20
---

# Phase 6 Plan 15: Episode and shorts forms on the server module Summary

**The single-episode form and the shorts form now check YouTube links through the admin-only `fetchYouTubeMeta` Server Action, every refusal is explained in plain words under the link field, and the old key-reading `GET /api/youtube-meta` route is deleted.**

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Episode form: server action, refusals, needs-English hint, focus prop | 2fce79b |
| 2 | Shorts form switch, delete the GET route, guard test | 0555ba9 |

## What was built

- **Episode form (`episode-form-drawer.tsx`):**
  - `YouTubeFetchButton` is now a `Button variant="outline"` (`mt-2 min-h-11 px-6 py-2 text-sm font-bold`, `Sparkles`/`Loader2 size-4`) calling `fetchYouTubeMeta`.
  - A refusal (`data.code` / `data.params`) sets the link field error from `YOUTUBE_ERROR_MESSAGE_KEYS`; the duplicate message goes through `t.markup` with `bdi` mapped to `isolate()` so the result is a string for `YouTubeUrlInput.error`. Quota messages get `{time}`.
  - Fill rules (D-04, only empty fields): Arabic-dominant title goes to `title_ar` (and to `title` only if `title` is empty), Arabic-dominant description to `description_ar`, otherwise `title`/`description`; length from `durationMinutes`. Title and description are capped with the same limits as the import (`TITLE_MAX`, `DESCRIPTION_MAX`).
  - On save, `result.data.youtubeError` sets the same field error, scrolls to the field, focuses its input, and shows `notSavedToast`. Other fields are untouched. The field error clears when the link changes or a fetch succeeds.
  - Under the title: `YouTubeStatusChip tone="warn"` plus `needsEnglishTitleHint` while `needsEnglishTitle({ title, title_ar })` is true (same rule as import and the admin mark).
  - `initialFocus?: 'title'` prop.
- **Shorts form:** `fetchMeta` uses `fetchYouTubeMeta(url, { forShort: true })`, maps `videoId`, `title`, `channelTitle`, `thumbnailUrl`, `durationSeconds`; a refusal toasts the translated message, anything else `toastMetaFailed`.
- **Route removed:** `src/app/api/youtube-meta/route.ts` (and folder) deleted; two comments that named the route were reworded so `grep -rn "api/youtube-meta" src` is empty.
- **Tests:** `tests/unit/admin-youtube-form-guards.test.ts`, 11 source guards (no old route string in the episode form, action import and call, code-to-message table, scroll and focus, `needsEnglishTitle(` and hint, D-04 routing, `initialFocus`/`setFocus('title')`, fetch button `px-6`, recursive scan of `src`, route folder absent, shorts call with `forShort: true`).

## Verification

Verified:
- `admin-youtube-form-guards.test.ts`: 11 pass. Task 1 RED shown first (the fetch-button guard failed against the old file before the edit).
- `npm run test:unit`: 930 pass, 0 fail (includes `admin-actions-youtube-wrappers` and `admin-actions-id-coverage` after the `fetchYouTubeMeta` signature change).
- `npx tsc --noEmit`: clean. `npx eslint` on both forms, the test and actions.ts: 0 errors (the warnings are pre-existing: React Compiler on `form.watch`, `<img>` in the shorts preview).
- Acceptance greps: `api/youtube-meta` in the episode form 0; `fetchYouTubeMeta` 3; `initialFocus` 3; `needsEnglishTitleHint` 1; `px-6` 4; `grep -rn "api/youtube-meta" src` 0; `src/app/api/youtube-meta` absent.

Not verified:
- No browser or UI run: the refusal text, scroll-and-focus on save, the focus-on-open behaviour of `initialFocus` and the chip layout were not seen on screen (they rest on the source guards and typecheck).
- No live YouTube call (no key), no Supabase command, no build, `gate:local` or Playwright (heavy, left to the PR gate).
- The Arabic text of `admin.youtubeErrors.*` with `<bdi>` was not rendered; parity is covered by the 06-05 message test.

Failed: nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Edit form would report an episode's own video as a duplicate**
- **Found during:** Task 1
- **Issue:** `fetchYouTubeMeta(url, { forShort? })` always runs the duplicate check without an excluded episode, so pressing the fetch button in edit mode on an episode's own video returns `video_duplicate`.
- **Fix:** added optional `excludeEpisodeId` (string only, used for a comparison in `verifyVideoCore`, read-only admin action); the edit form passes `episode.id`.
- **Files modified:** `src/app/[locale]/admin/actions.ts`
- **Commit:** 2fce79b

**2. [Rule 1 - Bug] Comments naming the deleted route**
- **Issue:** acceptance requires zero `api/youtube-meta` strings in `src`; two comments (`actions.ts`, `server/youtube/duration.ts`) mentioned it.
- **Fix:** reworded. **Commit:** 0555ba9

**3. Task 2 TDD order**
- The Task 2 guard tests were written after the code in the same commit, so no separate RED commit for the recursive scan, route-absent and shorts guards (the git stash stack is shared, so the pre-change tree was not recreated). The guards were run green and are source scans of the final state.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-06-58: save still re-validates on the server (06-13), the client result is only advisory. T-06-59: route deleted. T-06-60: refusal text comes from i18n keys and the code; duplicate params (show title, numbers) come from the database and are rendered as text with `isolate()`.

## TODO(phase-N)

None added in this plan.

## Self-Check: PASSED

- FOUND: tests/unit/admin-youtube-form-guards.test.ts, src/components/admin/episode-form-drawer.tsx, src/components/admin/short-form-drawer.tsx
- Removed as planned: src/app/api/youtube-meta/route.ts
- Commits 2fce79b and 0555ba9 present on phase-06-youtube-import-player.
