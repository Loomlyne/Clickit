# Hand-over: Phase 6, YouTube Import and Player

- Branch: `phase-06-youtube-import-player` (worktree `.claude/worktrees/phase-06-youtube-import-player-661c18`), based on origin/main c0da1d8, merged up to date.
- Final commit: see the PR head (this file is committed last; the gate ran on 0d40b0e; only this hand-over file changed after it).
- PR: https://github.com/Loomlyne/Clickit/pull/27
- Plans: 06-00 … 06-19 executed, each with a SUMMARY in `.planning/phases/06-youtube-import-and-player/`. 06-20 (this hand-over + UAT) is in progress; 06-21 … 06-24 are controller/owner steps.

## Gates

| Gate | Result |
|---|---|
| `npm run gate:local` (lint, typecheck, test:unit, guard:migrations, build), placeholder public env, under the heavy lock, detached | **exit=0** (2026-10-20 23:15:13–23:15:45 CET): lint 0 errors (warnings pre-existing), tsc clean, 1022/1022 unit tests, migration-guard 1 file 0 violations, `next build` compiled, 55/55 static pages; log `/Users/koss/.clickit-checks/phase06-gate.log` |
| Unit tests | 1022 pass, 0 fail |
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
- G2: the daily re-check refreshes status, length, checked-at and clears old player reports; never titles or descriptions; never unpublishes.
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
| 3 | Register the `30 1 * * *` trigger for `/api/cron/youtube-recheck` | Phase 2 | `src/app/api/cron/youtube-recheck/route.ts:1` |
| 4 | `requireAdminForYouTube()` stands in for `requireAdmin()` (admins table + TOTP at `/{locale}/auth/mfa`; accepts both admins, so Nejib can import) | Phase 5 | `src/app/[locale]/admin/actions.ts:223` |
| 5 | UAT admin script → replaced by `npm run seed:local-admin` (Phase 5; also applies M2 locally; TOTP code first after Phase 5 lands) | Phase 5 | outside the repo: `/Users/koss/.clickit-checks/phase06-uat-admin.cjs` (deleted after UAT) |
| 6 | Status chip `brand-*-safe` tone classes | Phase 4 | `src/components/admin/youtube-status-chip.tsx:20` |
| 7 | Advanced tab `text-brand-green-safe` → `var(--safe-green)` | Phase 4 | `src/components/admin/settings/advanced-tab.tsx:278` |

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
