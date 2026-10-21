# Phase 6 — plan gate for Koss

Plans: `06-00-PLAN.md` … `06-24-PLAN.md` (25 plans, 11 waves). Checked by gsd-plan-checker (Opus): revision 3 has 0 blockers; its 4 warnings are fixed (ROADMAP hand-off lines, live check/backup before the duplicate clear, UAT read-back order, this page). UI contract `06-UI-SPEC.md` approved by gsd-ui-checker.

All G items signed except the G6 key-field pictures.

## Status (2026-10-20, via controller)

- G2 signed (recommended). G4 signed (two migrations).
- G5 CHANGED: duplicates are cleared automatically, keeping the newest row; the controller logs every affected row first and reads back after (D-22).
- G6 CHANGED: no Worker secret. The key is pasted and changed in Admin › Settings, stored in Supabase Vault, read only by the service role, works on the next request (D-15, D-20). Pictures: `mockups/06-g6-key-missing.png`, `06-g6-key-editing.png`, `06-g6-key-saved.png`, `06-g6-key-test.png`.
- G3 signed (recommended: live 1..N, then archived).
- G8 CHANGED: Phase 6 executes now, in parallel with Phases 2–5. The precondition is only Phases 1 and 1.1 on main. Spots that stand in for Phase 2 (Worker cron), Phase 4 (tokens) and Phase 5 (admin accounts) carry `TODO(phase-N)` markers, listed in 06-00. The live deploy still waits for the Worker cutover (Vercel is frozen).
- G1 signed **B**: shipped default `ENDED_MODE = 'bar'` (YouTube end screen stays, countdown in the bar). Pictures `06-g1-b.png`, `06-g1-b-states.png`. Card kept only as the alternative constant.
- G7 accepted as pictured (15 screens); screen 15 is replaced by the G6 key-field pictures.
- Open: G6 signature on the key-field pictures (`06-g6-key-*.png`).

## Decisions as signed (record)

**G1. End of episode — signed B.** Shipped default `ENDED_MODE = 'bar'`: the ended video and YouTube's own end screen stay visible; the bar under the video becomes the "Up next" strip (8 s countdown, Play now, Cancel). Cancel → "Finished" + Next episode; reduced motion → no countdown; last episode → "You've finished {show}". The card (`'card'`) stays only as an alternative constant. Pictures: `mockups/06-g1-b.png`, `06-g1-b-states.png` (`06-g1-a.png` = not chosen).

**G2. Daily check scope — signed (recommended); CHANGED by Koss 2026-10-20 (PR #27 review item 7): refresh unless edited.** Refreshes YouTube status, length and check time and clears old player reports. ~~Never changes titles or descriptions.~~ It now also refreshes the YouTube text (episode title, Arabic title, description, Arabic description; short title, channel name and picture), but skips any field an admin changed on Clickit. Empty YouTube text never empties a field, and the first check of a row only marks fields that already differ from YouTube as edited. Never unpublishes.

**G3. Renumber — signed (recommended).** Live episodes 1..N, archived after them.

**G4. Two live migrations — signed.** Migration 1 (new columns, no-duplicate index, renumber function, Vault key functions) goes on live before deploy. Migration 2 (drop the old plaintext `app_config.youtube_api_key`) ships in its own PR after Test key passes on live.

**G5. Duplicate video IDs — CHANGED by Koss.** The newest row (latest `updated_at`) keeps the id, older rows are cleared automatically. The controller first runs read-only checks and takes a pg_dump, logs every affected row, clears in one transaction, then reads back zero duplicates (D-22).

**G6. Key storage — CHANGED by Koss; picture signature pending.** No Worker secret. Admins paste or change the key in Admin › Settings. It is stored in Supabase Vault, read only by service-role functions, and works on the next request. The field is masked with the eye inside on the right; after saving it shows `•••• last4`; Test key sits next to it (D-15, D-20). Pictures: `mockups/06-g6-key-missing.png`, `06-g6-key-editing.png`, `06-g6-key-saved.png`, `06-g6-key-test.png`.

**G7. UI beyond the signed pictures — accepted as pictured.** The 15 new screens are `mockups/06-g7-01.png` … `06-g7-15.png`. Screen 15 (key status) is replaced by the G6 pictures. The 11 small differences from earlier pictures are listed in `06-UI-SPEC.md` § "Owner-visible deviations".

**G8. Start condition — CHANGED by Koss.** Phase 6 executes now, in parallel with Phases 2–5. Hard precondition: Phases 1 and 1.1 on main, plus no workflow applying migrations on push. Seven stand-ins carry `TODO(phase-N)` markers (06-00 table) and are recorded in the ROADMAP sections of Phases 2, 4 and 5 by 06-19. Live deploy waits for the Worker cutover (Vercel is frozen).

## Your owner steps, in order (each one numbered step at its time)

1. Create the API-restricted key in the Clickit Google account (project "clickit-story").
2. UAT on the local stack (06-20): run the local admin script yourself (the test login prints only in your terminal); paste the key in local Settings and press Test key.
3. Ship the Phase 6 PR.
4. Approve the first migration on live (the controller first runs the read-only checks, takes a pg_dump, clears duplicates per G5, and dry-runs).
5. Approve deploy (after the Phase 2–3 Worker cutover).
6. Paste the key in Admin › Settings on live; press "Test key".
7. Say go for one real daily check (run by hand until Phase 2 registers the daily trigger).
8. Ship the second PR (drop the old key column); approve its live apply.
9. Delete the old key in Google Cloud.

GSD: next is `/gsd-execute-phase 6`, as soon as the G6 pictures are signed (G8: in parallel with Phases 2–5). Jev: none in Phase 6 (D-18). Automation: the daily check is the unattended agent. Optional later: a weekly "Can't play" email to the two admins, through the Phase 5 email queue (your word).
