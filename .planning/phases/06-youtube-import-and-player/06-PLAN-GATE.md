# Phase 6 — plan gate for Koss

Plans: `06-00-PLAN.md` … `06-24-PLAN.md` (25 plans, 11 waves). Checked by gsd-plan-checker (Opus) over 3 rounds: 0 blockers left. The 2 last warnings (zsh glob, UAT password in a file) are fixed. UI contract `06-UI-SPEC.md` approved by gsd-ui-checker.

Reply: `G1 yes … G8 yes`, or "all yes". Recommended answer first in each.

## Status (2026-10-20, via controller)

- G2 signed (recommended). G4 signed (two migrations).
- G5 CHANGED: duplicates are cleared automatically, keeping the newest row; the controller logs every affected row first and reads back after (D-22).
- G6 CHANGED: no Worker secret. The key is pasted and changed in Admin › Settings, stored in Supabase Vault, read only by the service role, works on the next request (D-15, D-20). Pictures: `mockups/06-g6-key-missing.png`, `06-g6-key-editing.png`, `06-g6-key-saved.png`, `06-g6-key-test.png`.
- G3 signed (recommended: live 1..N, then archived).
- G8 CHANGED: Phase 6 executes now, in parallel with Phases 2–5. The precondition is only Phases 1 and 1.1 on main. Spots that stand in for Phase 2 (Worker cron), Phase 4 (tokens) and Phase 5 (admin accounts) carry `TODO(phase-N)` markers, listed in 06-00. The live deploy still waits for the Worker cutover (Vercel is frozen).
- G1 signed **B**: shipped default `ENDED_MODE = 'bar'` (YouTube end screen stays, countdown in the bar). Pictures `06-g1-b.png`, `06-g1-b-states.png`. Card kept only as the alternative constant.
- G7 accepted as pictured (15 screens); screen 15 is replaced by the G6 key-field pictures.
- Open: G6 signature on the key-field pictures (`06-g6-key-*.png`).

## Decisions to sign

**G1. End of episode (D-09).** Pictures: `mockups/06-g1-a.png` (A, card, desktop + phone), `mockups/06-g1-b.png` (B, bar fallback, desktop + phone). YouTube's Developer Policies guide lists "blocking Related Video links after the video completes" as a don't. The signed card hides the ended player, so YouTube's end screen never shows.
- **Yes (recommended):** ship the signed card. A fallback is built: one constant (`ENDED_MODE = 'bar'`) keeps the video and YouTube's end screen visible, with the countdown in the bar under it.
- No: ship the fallback from day one.

**G2. Daily check scope (D-17).** It refreshes YouTube status, length and check time, and clears old player reports. It never changes titles or descriptions and never unpublishes. This reads YouTube's 30-day rule as covering API data only, not the titles the admins edit. That is our interpretation, not the policy's wording.
- **Yes (recommended).**
- No: also refresh titles daily (overwrites admin edits).

**G3. Renumber.** "Renumber 1 to N" numbers live episodes 1..N and moves archived ones to N+1, N+2 …
- **Yes (recommended).**

**G4. Two live migrations.** First: new columns, the no-duplicate index and the renumber function. It goes on live before deploy. Second: drop the old key column, in its own PR, only after "Test key" passes on live. That means two approvals instead of one.
- **Yes (recommended).**

**G5. Duplicate video IDs on live — CHANGED by Koss (see Status).** Newest row keeps the id; older rows are cleared automatically after logging.

**G6. Key storage — CHANGED by Koss (see Status).** Superseded: the key lives in Supabase Vault and is set in Settings; no Worker secret, no deploy window.

**G7. UI choices beyond the signed pictures.** Pictures for the 15 new screens: `mockups/06-g7-01.png` … `06-g7-15.png` (same order as UI-SPEC "New UI with no picture"). These are the 26 items in `06-UI-SPEC.md` § "Owner-visible deviations": 11 that differ from a picture, 15 that are new UI with no picture. The main ones:
- the watch page has no auto-hiding bars, no tooltips and no pop-up toasts;
- on phones, Watchlist and Like move to the season row;
- the "Up next" card stays after Cancel, with "Play now" and "Watch again";
- reduced-motion viewers get no countdown;
- a "You've finished {show}" card;
- UAE-blocked episodes open straight to the branded card;
- quota errors say when the quota resets, in UAE time;
- playlists over 200 videos show the first 200.
- **Yes (recommended):** accept as written.
- No: name the items to picture first.

**G8. Start condition.** Execution starts only after Phases 1.1–5 are on main. 06-00 stops with NEEDS KOSS while any workflow still applies migrations on push to main. Phase 1 landed on main (a8f2487); 06-00 re-runs the check when execution starts.
- **Yes (recommended).**

## Your owner steps, in order (each one numbered step at its time)

1. Create the API-restricted key in the Clickit Google account (project "clickit-story").
2. UAT on the local stack (06-20): run the local admin script yourself (the test login prints only in your terminal); paste the key in local Settings and press Test key.
3. Ship the Phase 6 PR.
4. Approve the first migration on live after the duplicate check and dry-run.
5. Approve deploy.
6. Paste the key in Admin › Settings on live; press "Test key".
7. Say go for one real daily check (or let the 01:30 UTC run fire).
8. Ship the second PR (drop the old key column); approve its live apply.
9. Delete the old key in Google Cloud.

GSD: next is `/gsd-execute-phase 6`, after G1–G8 and after Phases 1.1–5 land. Jev: none in Phase 6 (D-18). Automation: the daily check is the unattended agent. Optional later: a weekly "Can't play" email to the two admins, through the Phase 5 email queue (your word).
