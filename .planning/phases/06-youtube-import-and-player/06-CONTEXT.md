# Phase 6: YouTube Import and Player - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning
**Signed:** Koss, 2026-10-20 ("signed continue" on `06-DISCUSS-QUESTIONS.md`): every question answered with its recommended option (A). Pictures: `mockups/06-q*.png`.

<domain>
## Phase Boundary

An admin puts a whole YouTube season on the platform from one playlist link (preview, then commit, drafts only), or adds one episode from one link with server-side validation. The YouTube API key moves to a Cloudflare Worker secret and the database copy is removed. Viewers switching episodes resume each episode's own position, in a watch page where nothing is drawn over the playing YouTube player, with player language and captions following the site locale and branded error states. Episode reorder never leaves gaps or duplicates and reports errors. Requirements YT-01 to YT-07.

Built against main as it will be after Phases 2–5: Cloudflare Workers via OpenNext, R2 media, `requireAdmin` and the two-admin audit from Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Playlist import (YT-01, YT-02)
- **D-01 (Q1):** Import is a side sheet opened from the show's admin page ("Import season from YouTube"). Table, one row per video: tick box, thumbnail, title, length, status chip. Unplayable rows are unticked, greyed and carry the reason. Nothing is saved until "Import N episodes as drafts". Picture: `mockups/06-q1.png` option A.
- **D-02 (Q2):** The admin picks the target: a new season (default; season title prefilled from the playlist title, editable) or an existing season, where new videos are appended after its last episode.
- **D-03 (Q3):** Playlist order sets episode order. Numbers continue after the season's last episode (empty new season starts at 1). No title parsing.
- **D-04 (Q4):** YouTube text goes into the field matching its script: Arabic script → `title_ar`/`description_ar`; otherwise → `title`/`description`. `title` is NOT NULL, so for Arabic-only titles `title` temporarily holds the same text and the draft shows a "Needs English title" mark until an admin edits it. No machine translation.
- **D-05 (Q5):** Re-importing a playlist offers only videos not yet on Clickit, as drafts. Existing episodes are never touched (admin edits stay). Videos removed from the playlist stay on Clickit.
- **D-06 (Q6):** Admins upload not-yet-released episodes as **Unlisted** on YouTube; Clickit's scheduler decides when viewers see them. Private videos are refused with "Set it to Unlisted or Public, then import again".
- **D-07 (Q7):** The import success state has a "Schedule these N episodes" button that opens the existing bulk scheduler with the new drafts selected.

### Player (YT-05, YT-06)
- **D-08 (Q8):** Watch page becomes stacked: solid top bar above the video; the video at 16:9 (letterboxed in black when the screen is wider); a control bar under it (previous, title, next, "Start from the beginning"); episodes under that. Same order on phones. No element overlaps the iframe at any time, including the tray (no hover raise over the player), the prev/next arrows and the top bar. Picture: `mockups/06-q8.png` option A (desktop and 375px).
- **D-09 (Q9):** On ENDED, the iframe is hidden/unmounted and replaced by a Clickit "Up next" card (8-second countdown, "Play now", "Cancel"). YouTube's end screen is never shown. Picture: `mockups/06-q9.png` option A.
- **D-10 (Q10):** Switching episodes resumes silently at the episode's saved position; the control bar shows "Resumed at m:ss · Start from the beginning". Episodes at ≥95% (completed) start at 0:00.
- **D-11 (Q11):** Player errors (100, 101, 150, 5, 2, and the region-blocked case) replace the player with a branded card: "This episode can't play right now", plain reason, "Play next episode", "Back to the show". The episode is flagged for admins (D-17). Picture: `mockups/06-q11.png` option A.
- **D-12 (Q12):** Captions: English site → English captions on when the video has them; Arabic site → captions follow the viewer's YouTube setting. Player UI language (`hl`) follows the site locale on both.

### Episode order (YT-07)
- **D-13 (Q13):** Keep up/down arrows, saved on each click. Picture: `mockups/06-q13.png` option A.
- **D-14 (Q14):** Up/down swaps with the nearest episode in the season, whatever its number. Archive/delete does not renumber. A "Renumber 1 to N" action closes gaps on purpose, with a confirm and an audit row.
- **D-19 (Q19):** Reorder and renumber run as one all-or-nothing database function (`reorder_episodes` / `renumber_season` or equivalent), shipped in the same reviewed Phase 6 migration. This is a deliberate exception to Phase 1.1 D-05 (app-level compensation), for these two operations only.

### YouTube key and checks (YT-04)
- **D-15 (Q15):** Admin › Settings YouTube key field becomes read-only status: "Key set / Key missing", "Stored in Cloudflare", "Test key" button (one `videos.list` call, 1 unit), last test time and result. The input and the `youtube_api_key` write path are removed. Picture: `mockups/06-q15.png` option A.
- **D-16 (Q16):** New key is created in the Clickit Google account (owner of the YouTube channel), Google Cloud project "clickit-story", restricted by API to YouTube Data API v3 only. Old key deleted. Both are Koss's numbered owner steps; the key never appears in chat or a file.
- **D-17 (Q17):** Daily Cloudflare Cron Trigger re-checks every stored episode video (batched `videos.list`, ≤50 ids per call, about 6 units/day for ~300 episodes), refreshes stored YouTube status and length (meets the 30-day Developer Policies refresh), and marks broken episodes with a red "Can't play" badge in admin plus a dashboard count. Viewer player-error reports (D-11) feed the same flag. Nothing is unpublished automatically.

### Jev
- **D-18 (Q18):** No Jev call in Phase 6. Idea kept in Deferred.

### Claude's Discretion (listed in the questions file, not objected to)
- Thumbnails stay on `i.ytimg.com` (`unoptimized`, maxres → standard → high fallback), not copied to R2.
- Dedupe across the whole catalog: a video already on any show/season is "Already on Clickit" and not imported again. Database uniqueness on `youtube_video_id` (or equivalent) backs this; exact constraint chosen in planning.
- Paging past 50 via `nextPageToken`; `videos.list` batched with `part=snippet,contentDetails,status`; `search.list` never used.
- Status rules: `privacyStatus=private` → Private; missing item → Removed; `status.embeddable=false` → Not embeddable; `contentDetails.regionRestriction` blocks `AE` (blocked list contains AE, or allowed list lacks AE) → Blocked in UAE; `uploadStatus≠processed` or live/upcoming broadcast → Not ready.
- The playlist must be Public or Unlisted; a private playlist error is shown in the sheet.
- Every import and single add writes an audit row (admin, playlist id, episode count).
- Single-link add keeps today's episode form: paste → title/description/length fill in; save re-validates on the server (`^[A-Za-z0-9_-]{11}$`, then API existence, privacy, embeddable, AE region) and refuses with a plain message.
- Keep `Referrer-Policy: strict-origin-when-cross-origin` (error 153 otherwise), one playing YouTube player per page, player ≥200×200.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and decisions
- `.planning/ROADMAP.md` §"Phase 6: YouTube Import and Player" — goal, success criteria, owner gates
- `.planning/REQUIREMENTS.md` — YT-01 … YT-07
- `.planning/phases/06-youtube-import-and-player/06-DISCUSS-QUESTIONS.md` — the signed questions, with examples
- `.planning/phases/06-youtube-import-and-player/mockups/06-mockups.html` and `06-q1.png`, `06-q8.png`, `06-q9.png`, `06-q11.png`, `06-q13.png`, `06-q15.png` — signed pictures (option A in each)
- `.planning/phases/01.1-admin-actions-hardening-inserted/01.1-CONTEXT.md` — D-05 app-level compensation (Phase 6 D-19 is the reorder exception), D-07 never swallow errors, D-09 unit-test pattern
- `.planning/prompts/00-common-rules.md` — work-session rules, heavy-step lock

### Research already done (project level)
- `.planning/research/PITFALLS.md` §Pitfall 12 (playlist edge cases, quota, key restriction) and §Pitfall 13 (RMF overlays, error 153)
- `.planning/research/ARCHITECTURE.md` §Pattern 6 (preview-then-commit), `src/server/youtube/` layout, secrets table
- `.planning/research/SUMMARY.md` — YouTube RMF, thumbnail decision, contract migration dropping `youtube_api_key`

### Design
- `DESIGN.md`, `ui.config.json`, `src/styles/globals.css` — tokens, radius roles, 44px targets, nothing under 11px

### External (verify in research)
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/v3/determine_quota_cost
- https://developers.google.com/youtube/v3/docs/playlistItems/list and /videos
- https://developers.google.com/youtube/iframe_api_reference and /player_parameters

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/youtube.ts`: `validateYouTubeUrl` (host allow-list + ID), `extractYouTubeId`, `loadYouTubeAPI`. Add playlist-URL parsing (`list=`) here or in `src/server/youtube/`.
- `src/app/api/youtube-meta/route.ts`: `parseIsoDuration`, thumbnail fallback; to be replaced by a server module reading the Worker secret and `requireAdmin`.
- `src/hooks/use-progress-tracker.ts`: upserts `watch_progress (user_id, episode_id)` every 10 s, on pause, hide and unmount; 95% = completed.
- `src/components/watch/youtube-player.tsx`: single `YT.Player`, error state, playerVars (no `hl`/`cc_lang_pref`/`cc_load_policy` yet).
- `src/components/admin/episode-form-drawer.tsx` (`YouTubeFetchButton`) and `youtube-url-input.tsx`: single-link add flow.
- Existing bulk scheduler (`applyShowSchedule`, `PlannedEpisodeSlot` in `admin/actions.ts`) for D-07.

### Established Patterns
- Episodes: `unique (season_id, episode_number)`, `status in (draft, coming-soon, published)`, `youtube_video_id text`, `duration` in minutes. Seasons: `unique (show_id, season_number)`, `title` NOT NULL, `episode_count`.
- Admin writes go through server actions in `src/app/[locale]/admin/actions.ts` with the service-role client; Phase 1.1 adds zod schemas, id guards and audit rows.
- `app_config.youtube_api_key` read via `getYouTubeApiKey()` in `src/lib/config.ts`; column privilege revoked for anon/authenticated (migration `20260724115941`).

### Defects found (root causes for this phase)
- `watch-shell.tsx` `handleEpisodeSwitch` calls `loadVideoById({ startSeconds: 0 })` → YT-05. `progressMap` holds only percent/completed, not seconds.
- `watch-shell.tsx`: top chrome strip (`fixed top-0 z-20`), prev/next arrows (`fixed top-1/2`) and `AutoplayOverlay` (`absolute inset-0`) render over the iframe; `episode-tray.tsx` raises to 50% on hover over the player → RMF.
- `reorderEpisode` swaps only with `episode_number ± 1` and ignores update errors → fails on gaps (YT-07).
- `/api/youtube-meta` checks `app_config.admin_user_id` (single admin) and reads the key from the database.

### Integration Points
- Admin show page `src/app/[locale]/admin/shows/[id]/page.tsx` + `episodes-table.tsx` (import button, reorder, "Can't play" badge, "Needs English title" mark).
- Watch page `src/app/[locale]/(watch)/watch/[episodeId]/page.tsx` + `watch-shell.tsx`, `episode-tray.tsx`, `autoplay-overlay.tsx`.
- Settings `src/components/admin/settings/advanced-tab.tsx` (key field → status).
- Cron: Worker `scheduled` handler from Phase 2 (Cron Triggers) for D-17.
- Messages `src/messages/en.json` / `ar.json` for every new string.

</code_context>

<specifics>
## Specific Ideas

- Import sheet copy: "Nothing is saved until you press Import. Episodes land as drafts." Summary chips: Ready / Can't play / Already on Clickit.
- Error card copy: "This episode can't play right now" + "Play next episode" + "Back to <show>".
- Control bar copy: "Resumed at 9:12 · Start from the beginning".

</specifics>

<deferred>
## Deferred Ideas

- Jev pre-unticking trailers/teasers/shorts in the import preview (Q18) — later, advisory only, on Koss's word.
- Refreshing titles/descriptions of existing episodes from YouTube on re-import (Q5 B) — not wanted.
- Auto-hiding broken episodes (Q17 B) — not wanted; flag only.

</deferred>

---

*Phase: 06-youtube-import-and-player*
*Context gathered: 2026-10-20*
