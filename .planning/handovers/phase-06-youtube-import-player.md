# Hand-over: Phase 6, YouTube Import and Player

- Branch: `phase-06-youtube-import-player` (worktree `.claude/worktrees/phase-06-youtube-import-player-661c18`), based on origin/main c0da1d8, merged up to date.
- Final commit: see the PR head (this file is committed last; the gate ran on b89fd31 (after the review fixes, refresh-unless-edited and the re-review notes); only this hand-over file changed after it).
- PR: https://github.com/Loomlyne/Clickit/pull/27
- Plans: 06-00 … 06-19 executed, each with a SUMMARY in `.planning/phases/06-youtube-import-and-player/`. 06-20 (this hand-over + UAT) is in progress; 06-21 … 06-24 are controller/owner steps.

## Gates

| Gate | Result |
|---|---|
| `npm run gate:local` (lint, typecheck, test:unit, guard:migrations, build), placeholder public env, under the heavy lock, detached | **exit=0** on b89fd31 (2026-10-21 00:17:41–00:18:08 CET): lint 0 errors (warnings pre-existing), tsc clean, 1116/1116 unit tests, migration-guard 1 file 0 violations, `next build` compiled, 55/55 static pages. Earlier run on 0d40b0e (pre-review) also exit=0 with 1022/1022; log `/Users/koss/.clickit-checks/phase06-gate.log` |
| Unit tests | 1116 pass, 0 fail |
| Local migration apply | `supabase db reset --local` on the shared Clickit stack: exit 0, latest version 20261020150526 (2026-10-20 17:51 CET) |
| Local Vault round trip (fake key only) | service_role set/get/meta → `AAAA`, `true|AAAA`; anon and authenticated → permission denied on `public.get_youtube_key`, `private.get_youtube_key`, `vault.decrypted_secrets` |
| e2e `tests/e2e/watch-page.spec.ts` | rewritten for the stacked layout; NOT run (no stack + dev server lane yet). Neither CI nor gate:local runs e2e |
| CI (`pr-gate.yml`) | runs on PR open and every push (Clickit exception) |

## Database

- **Migration 1 (in this PR):** `supabase/migrations/20261020150526_youtube_episode_status_and_order.sql`. Additive: `episodes.youtube_status`, `youtube_checked_at`, `youtube_duration_seconds`, `player_error_code`, `player_error_at`; unique index `episodes_youtube_video_id_key` (non-empty ids); `public.renumber_season`, `public.record_youtube_checks`; Vault key functions `private.*` + `public.get_youtube_key` / `set_youtube_key` / `youtube_key_meta`, granted to `service_role` only. A duplicate guard stops the migration with a clear message if duplicate video ids exist.
- **Contract migration (drop `app_config.youtube_api_key`) is NOT in this PR.** It ships later in its own separate branch and PR (06-23), after Test key passes on live. So `database.types.ts` still lists the column, and `tests/unit/youtube-key-removed.test.ts` excludes the types file until 06-23 regenerates it.
- **Live has duplicate video ids** (D-22 / G5): the controller clears them before migration 1 (06-21). The local seed had the same problem; `supabase/seed.sql` now gives every seed episode a unique id (episodes 1–3 of "Last Call" S1 keep the three real sample videos; the rest are `seedEp00001…`, which play as the error card). Local data only.
- **Types:** `src/lib/database.types.ts` got only the Phase 6 entries, taken from `supabase gen types typescript --local` (main + Phase 6 migrations only). A full regeneration was not used: main's committed types already lag main's own migrations (missing `reorder_episode`, `get_public_youtube_video_id`, `app_config` auth/hero/live-stream columns, a `show_categories` FK), and the newer CLI emits `NonNullable<Json>`, which breaks `src/app/actions/contact.ts`. Follow-up for the controller: one full regen on main after Phases 2–6 land.

## Key storage (D-20, G6)

Supabase Vault through service-role functions; no Worker secret, no plaintext column use. Admin › Settings › Advanced has the editable masked field (eye inside, right side), Save key → `•••• last4`, Test key (one real call, 1 unit). The browser only ever receives `hasKey`, `last4`, updated time. Per-request cache (React `cache()`); the key travels only in the `x-goog-api-key` header. Every save and test writes an audit row without the key.

## Plan-gate decisions as implemented

- G1 = B: `ENDED_MODE = 'bar'` (`src/lib/watch/ended-state.ts`); YouTube's end screen stays; up-next strip in the control bar (8 s ring, Play now, Cancel/Esc → "Finished"); reduced motion → no ring, no auto-advance; last episode → "You've finished {show}". `'card'` kept only as the alternative constant.
- G2: the daily re-check refreshes status, length, checked-at and clears old player reports; never unpublishes. CHANGED by Koss 2026-10-20 (PR #27 review item 7): refresh unless edited. It also refreshes episode title/title_ar/description/description_ar and short title/channel_name/thumbnail_url from YouTube, skipping any field whose `*_edited` flag is true (set by admin saves, never cleared). The first check of a row writes no text and only flags fields that differ from YouTube. Migration 1 gained the flags, `shorts.youtube_checked_at` and `record_short_checks`; the local DB check should re-apply it and run one re-check on seeded rows.
- G3: renumber puts live episodes 1..N, archived N+1..N+K.
- G4: two migrations (expand here, contract in its own PR).
- G5: duplicate video ids auto-cleared by the controller, newest `updated_at` keeps the id (06-21).
- G6: Vault key field as pictured.
- G7: UI as pictured (15 screens; screen 15 replaced by the G6 pictures).
- G8: built in parallel with Phases 2–5 against today's main, with TODO(phase-N) stand-ins (below). Live deploy waits for the Phase 2–3 Worker cutover (Vercel is frozen).

## TODO(phase-N) hand-offs

Also recorded as "Phase 6 hand-off" lines in the ROADMAP sections of Phases 2, 4 and 5 (06-19).

| # | Stand-in | Owner | `grep -rn "TODO(phase-" src` |
|---|---|---|---|
| 1 | Rate-limit seam stands in for `decideRateLimit` | Phase 2 | `src/server/youtube/rate-limit.ts:17` |
| 2 | Cron route's inline Bearer check stands in for `cronAuthOk` | Phase 2 | `src/app/api/cron/youtube-recheck/route.ts:29` |
| 3 | Register the `30 1 * * *` trigger for `/api/cron/youtube-recheck` (whichever of Phase 2 / Phase 6 lands second; controller wires it at merge) | Phase 2 | `src/app/api/cron/youtube-recheck/route.ts:1` |
| 4 | `requireAdminForYouTube()` stands in for `requireAdmin()` (admins table + TOTP at `/{locale}/auth/mfa`; accepts both admins, so Nejib can import) | Phase 5 | `src/app/[locale]/admin/actions.ts:223` |
| 5 | UAT admin script → replaced by `npm run seed:local-admin` (Phase 5; also applies M2 locally; TOTP code first after Phase 5 lands) | Phase 5 | outside the repo: `/Users/koss/.clickit-checks/phase06-uat-admin.cjs` (deleted after UAT) |
| 6 | Status chip `brand-*-safe` tone classes | Phase 4 | DONE at the Phase 4 merge: `status-success/warning/danger/neutral` |
| 7 | Advanced tab `text-brand-green-safe` → green token | Phase 4 | DONE at the Phase 4 merge: `text-status-success` |

### Phase 4 merge (main 0cf489f, PR #28)

- Conflicts resolved:
  - `episode-tray.tsx` stays deleted. Phase 4's swaps (`rounded-t-panel`, `rounded-card`, `rounded-media`, `shadow-bar`) are in its replacements, `episode-list.tsx` and `up-next-card.tsx`. The overlay bar that carried `shadow-bar` is gone in the stacked layout.
  - `layout.tsx` keeps `<RouteScopedToaster />`. The toaster now carries Phase 4's class (`bg-[var(--bg-1)] … shadow-popover`).
  - `en.json` and `ar.json` keep both `youtubeImport` and `designSystem`.
  - ROADMAP keeps Phase 4's Plans line, and the two Phase 4 hand-off lines are dropped (done).
- Phase 4's `RADIUS_CODEMOD`, `SHADOW_CODEMOD` and `STATUS_TONES` tables (`src/lib/design-truth.ts`) were applied to the Phase 6 files and to `06-UI-SPEC.md`. All values are identical. Status renames cover only the Phase 6 status uses; `brand-*-safe` lines that came from main are left as they are.
- `clickit/no-raw-design-values`: 0 errors.

## Review fixes (PR #27 review of record, fallback reviewer, REQUEST CHANGES, 2026-10-20)

| # | Finding | Fix | Commit |
|---|---|---|---|
| 1 | Re-check auth not constant-time; no trigger | `src/server/youtube/bearer.ts`: SHA-256 both sides + `timingSafeEqual`; 401 on missing secret/header. **Route only:** the Worker cron trigger is NOT in this PR (see below) | 0c38984 |
| 2 | Import/verify actions unlimited | `withinRateLimitCore` per admin, fail open: `yt-preview` 60, `yt-meta` 60, `yt-import` 10, `yt-key-test` 10 per 10 min; after the admin check, before any key read; code `rate_limited` (EN/AR) | 1cafb58 |
| 3 | Shorts not verified on the server | `createShort` / `updateShort` run `parseVideoIdStrict` + `verifyVideoCore` (`checkDuplicate: false`), store the bare id, `key_missing` when no key; unchanged id not re-checked (`src/lib/admin/short-video.ts`) | 8586294 |
| 4 | One viewer can raise the admin fault | **Chosen: threshold.** Each report is still recorded per user (1/hour, fail closed) in `rate_limits`; the flag is written only when 3 distinct users reported the episode within 24 h (`PLAYER_REPORT_THRESHOLD = 3`). No migration. The daily check clears the flag when the video is fine. Label "Reported by viewers" | bf77d7c |
| 5 | Migration comment wrong; raw 23505 on import race | Comment corrected (import relies on `episodes_season_id_episode_number_key`, no advisory lock); that collision maps to `season_changed` "Season changed while you were importing. Try again." (EN/AR), after a complete rollback | 7d772eb |
| 6 | Episodes reads stop at 1000 rows | `src/lib/admin/read-all-pages.ts` (`.order('id').range()` pages of 1000) in `recheckVideosCore` and the dashboard health read | 9a2b00f |
| 7 | API-data retention (titles/descriptions/thumbnails > 30 days) | **Koss decided "Refresh unless edited" (2026-10-20).** The daily check also refreshes episode `title`, `title_ar`, `description`, `description_ar` (routed by script like the import) and shorts `title`, `channel_name`, `thumbnail_url`, except fields flagged `*_edited` (set when an admin saves a different value; import sets false). Episodes store no thumbnail (built from the video id). Shorts thumbnail has no form field, so it always refreshes (https only). Empty YouTube text never replaces stored text. **First-check safeguard:** a row's first check (`youtube_checked_at` null) writes no text and only flags fields that already differ from YouTube, so titles typed on live before this change are kept. New `shorts.youtube_checked_at`. New `public.record_short_checks` (service_role only) | 8b67f10 … 6970aef |

### Cron trigger: wire at merge (controller)

The Worker cron trigger for `/api/cron/youtube-recheck` (`30 1 * * *`) is added by whichever of Phase 2 (`claude/phase-02-execute-19d86a`, which turns the Vercel crons into Worker cron triggers) and Phase 6 lands second. Phase 6 does not edit Phase 2 files. When both are on main: add `'30 1 * * *' -> /api/cron/youtube-recheck` to `CRON_ROUTES` (`src/server/cron-schedule.ts`) and to `wrangler.jsonc` `triggers.crons`, and swap the inline check for `cronAuthOk` (TODO(phase-2) markers in the route).

### Local database checks (shared stack, under the heavy lock, 2026-10-20 23:43 CET)

- `supabase db reset --local`: exit 0, latest migration 20261020150526.
- `has_function_privilege(..., 'execute')` on `public.renumber_season`, `public.record_youtube_checks`, `public.get_youtube_key`, `public.set_youtube_key`, `public.youtube_key_meta`, `private.get_youtube_key`, `private.set_youtube_key`, `private.youtube_key_meta`: **false** for `anon` and `authenticated` on all 8; true for `service_role`.
- Renumber, in a rolled-back transaction: live −2, 1, 3, 7 and archived 2, 9 → `1:Ep −2 | 2:Ep 1 | 3:Ep 3 | 4:Ep 7 | 5:Ep 2 (archived) | 6:Ep 9 (archived)`; returned map `-2->1, 1->2, 7->4, 2->5, 9->6` (unchanged row 3 not returned); a second call raises `Already numbered 1 to N`; `authenticated` → permission denied.

- Refresh unless edited, rolled-back transaction on the local stack (2026-10-21 00:0x CET), after a fresh `db reset --local` (exit 0): `has_function_privilege` false for anon/authenticated on `record_youtube_checks` and `record_short_checks`, true for service_role. Episode with an admin-typed title and no check yet → run 1 kept "Admin typed title", set `title_edited=true`, left the matching description unflagged, stamped `youtube_checked_at`. Run 2 → title kept; unedited `title_ar` refreshed to the YouTube Arabic text; unedited `description` refreshed; an empty YouTube `description_ar` changed nothing. Short with `title_edited` → title kept, `channel_name` and `thumbnail_url` refreshed.
- Hand-edited `database.types.ts` entries match `supabase gen types --local` for `episodes`, `shorts`, `record_youtube_checks`, `record_short_checks` (only difference: `fts` `unknown` vs `never`, pre-existing CLI drift).

### Re-review notes (APPROVE with 3 low notes, 2026-10-21)

- **Note 2, viewer reports after a clear:** `player-error-report.ts` counts only reports created after both now − 24 h and the episode's last check (`youtube_checked_at`). After the daily check clears the flag, 3 new distinct viewers are needed. Because every daily run stamps `youtube_checked_at`, the 3 reports must fall between two runs. Commit a5c6bc9.
- **Note 1, first-check baseline:** new `episodes.youtube_text_baseline_at`. The baseline runs only when YouTube returned the video (`status = 'ok'`). A field is flagged only when YouTube's text is non-empty and differs. `youtube_checked_at` keeps its health-panel meaning and is still stamped every run. Import and verified single-link create set the baseline. Commit 493368d. **Accepted gap:** a legacy field whose YouTube text is empty at baseline (usually `title_ar` on an English video) is not flagged; if YouTube later gets text there, the next check replaces the stored text.
- Real SQL on the local stack (fresh `db reset --local`, exit 0, 00:17 CET, rolled back): a removed video → checked-at stamped, no flags, baseline null; the next ok run with an empty YouTube description → title flagged and kept, description not flagged, baseline set; the next run with a YouTube description → description refreshed, title kept. The hand-edited types match `gen types --local` (only `fts` drift).
- **Before the cutover, confirm the live PostgREST max_rows is ≥ 1000 (readAllPages).**

### Known limits after the fixes

- `record_youtube_checks` refuses more than 5000 rows per call; with paging the daily check would fail above 5000 episodes (catalog ≈ 300). Batch the write if the catalog ever nears that.
- Shorts save and episode save call YouTube without a rate limit (admin-only, one call per save); the dashboard seasons read is not paged.

## NOT verified

- No browser run of any screen yet (that is the UAT below): stacked watch page, no-overlay hit test, hidden iframe under cards, resume A→B→A, up-next strip, RTL, phone layout, import sheet, scheduler hand-off, key field.
- Real API key on live; header transport on live (A14); Unlisted playlist access (A2); UAE block (A16); iOS autoplay (A10/A11); captions (A15).
- Vault on the hosted project (06-21 pre-check: `vault` extension and `vault.create_secret` available).
- `renumber_season` and `record_youtube_checks` against real Postgres beyond the migration apply (unit tests use emulators; UAT steps 12–13 run them locally).
- The daily schedule (TODO(phase-2)); cron CPU on Workers Free (A17).
- The episode read in the daily check is one select (Supabase default 1000-row cap; catalog ≈ 300 episodes).
- e2e watch spec rewritten but not run.
- Arabic copy transcribed from the UI-SPEC, no native-speaker review.

## Follow-ups (not in this PR)

- `src/hooks/use-idle-timer.ts` and `getEpisodeProgress` (`src/lib/queries.ts`) have no callers; stale comment in `src/app/[locale]/(watch)/layout.tsx`; `vaul` dependency unused.
- Full `database.types.ts` regeneration on main (see Database).
- 06-23 removes the `SCAN_EXCLUDE` entry in `tests/unit/youtube-key-removed.test.ts`.
- Optional automations proposed by executors (Koss's word only): weekly "Can't play" email to the two admins via the Phase 5 queue (`enqueueEmail`, `src/server/email/outbox.ts`); daily unattended Test key with an alert.

## Owner order (each one numbered step at its time)

1. Create the API-restricted key (06-20 Task 2).
2. Local UAT: paste the key into the local Settings field, press Test key, run the UAT below (06-20 Task 3).
3. Ship the Phase 6 PR (06-21).
4. Controller clears duplicate video ids (D-22) after read-only checks and a pg_dump; Koss approves migration 1 on live after the dry-run (06-21).
5. Approve the deploy of the shipped commit, after the Phase 2–3 Worker cutover (06-21).
6. Paste the key into Admin › Settings on live, press Test key (06-22).
7. Say go for one real daily check, run by hand until Phase 2 registers the trigger (06-22).
8. Ship the contract-migration PR; approve its live apply (06-23).
9. Delete the old key in Google Cloud (06-24).

## UAT (06-20 Task 3), on the local stack only

Setup, in Koss's terminal. The YouTube key goes only into the Settings field in step 1. CRON_SECRET stays in his shell. Neither is written to a file.

- S0. `node /Users/koss/.clickit-checks/phase06-uat-admin.cjs`. It prints the local test email and password once; keep them in your terminal scrollback only.
- S1. `cd /Users/koss/Developer/Clickit/.claude/worktrees/phase-06-youtube-import-player-661c18 && set -a && source /Users/koss/.clickit-checks/phase06-uat.env && set +a && read -s CRON_SECRET && export CRON_SECRET && npm run dev`. At the silent prompt type any local CRON_SECRET value and press Enter. Open http://localhost:3000/en/auth and sign in as `uat-admin@clickit.local` with the password from S0 (no TOTP until Phase 5).
- If Phase 5 is on main and merged into this branch before UAT: skip S0 and run `npm run seed:local-admin` instead (it also applies M2 locally); after sign-in, enter the TOTP code at `/en/auth/mfa` before the admin pages open.

Steps on http://localhost:3000:

0. Admin › Shows lists "UAT local only". If it is missing, stop: the app is not on the local database.
1. Admin › Settings › Advanced → "Key missing". Paste the key → the eye inside the field shows and hides it → "Save key" → "•••• <last 4>" and "Key saved. Press Test key to check it." → "Test key" → "Last test: <date> · key works". Reload → still "•••• <last 4>"; the full key is nowhere in the page source.
2. Admin › a show → "Import season from YouTube" → paste a real Unlisted playlist link from the Clickit channel → every video listed with thumbnail, title, time and a chip; private, deleted, premiere or non-embeddable videos unticked and greyed with the reason.
3. Keep "New season" → title is the playlist title → "Import N episodes as drafts" → "N episodes added as drafts"; the season shows them as Draft, numbered 1..N in playlist order.
4. "Schedule these N episodes" → the scheduler lists only those N.
5. Open the sheet again, paste the same link → "Every video in this playlist is already on Clickit."; nothing can be imported.
6. Add episode → paste a link to a private or deleted video → a plain refusal under the link field. Save → "Episode not saved. Check the YouTube link." and the field is focused.
7. Watch episode A about 1 minute, pick B, watch 30 s, pick A again → A resumes near 1:00, the bar says "Resumed at 1:00 · Start from the beginning"; click it → starts at 0:00. Desktop Chrome and an iPhone on the same network.
8. At 375 px and on desktop, element picker on the four corners and centre of the video → only the YouTube iframe; hovering the episode list raises nothing.
9. Up-next strip (G1 = B): let an episode end → video and YouTube end screen stay; the control bar becomes "Up next: <title>" with the season/episode line, an 8-second ring, "Play now", "Cancel"; the iframe is still under the pointer. Scroll until less than half the player shows → countdown pauses; scroll back → continues. Esc → normal bar with "Finished" and Next episode enabled. OS reduced motion on → no ring, only "Play now", nothing advances. Last episode of a show → "You've finished <show>" with "Back to <show>".
10. /en → player menus English, English captions on when available; /ar → menus Arabic, captions follow your YouTube setting.
11. Non-embeddable: in YouTube Studio untick "Allow embedding" on the test video the controller named → publish its local episode and open it → "This episode can't play right now" card with "Play next episode" and "Back to <show>"; element picker on the card → no iframe; console `document.querySelector('iframe')?.offsetParent === null` → true; local admin shows "Can't play · Reported by a viewer". Tick "Allow embedding" again.
12. In a season numbered 1, 2, 4: up on episode 4 → it becomes 2 and the other becomes 4. "Renumber 1 to 3" → dialog lists the changes → confirm → "Episodes renumbered 1 to 3".
13. Second terminal tab: `read -s CRON_SECRET && curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/youtube-recheck` → one JSON line with counts and no key. http://localhost:3000/en/admin → "YouTube check" panel shows "Checked <date>" and "All episodes play" or the broken list.

After UAT the real key's local Vault copy must be erased (T-06-80). The plan says `supabase stop --no-backup`, but the Clickit stack is now shared (CLAUDE.local.md, 2026-10-20). Proposed instead, under the lock: `docker exec supabase_db_Clickit psql -U postgres -c "delete from vault.secrets where name = 'youtube_api_key';"`, then `supabase db reset --local`, then check `select count(*) from vault.secrets where name = 'youtube_api_key'` is 0. Controller decides.
