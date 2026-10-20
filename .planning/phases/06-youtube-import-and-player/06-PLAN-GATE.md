# Phase 6 — plan gate for Koss

Plans: `06-00-PLAN.md` … `06-24-PLAN.md` (25 plans, 11 waves). Checked by gsd-plan-checker (Opus) over 3 rounds: 0 blockers left. The 2 last warnings (zsh glob, UAT password in a file) are fixed. UI contract `06-UI-SPEC.md` approved by gsd-ui-checker.

Reply: `G1 yes … G8 yes`, or "all yes". Recommended answer first in each.

## Decisions to sign

**G1. End of episode (D-09).** YouTube's Developer Policies guide lists "blocking Related Video links after the video completes" as a don't. The signed card hides the ended player, so YouTube's end screen never shows.
- **Yes (recommended):** ship the signed card. A fallback is built: one constant (`ENDED_MODE = 'bar'`) keeps the video and YouTube's end screen visible, with the countdown in the bar under it.
- No: ship the fallback from day one.

**G2. Daily check scope (D-17).** It refreshes YouTube status, length and check time, and clears old player reports. It never changes titles or descriptions and never unpublishes. This reads YouTube's 30-day rule as covering API data only, not the titles the admins edit. That is our interpretation, not the policy's wording.
- **Yes (recommended).**
- No: also refresh titles daily (overwrites admin edits).

**G3. Renumber.** "Renumber 1 to N" numbers live episodes 1..N and moves archived ones to N+1, N+2 …
- **Yes (recommended).**

**G4. Two live migrations.** First: new columns, the no-duplicate index and the renumber function. It goes on live before deploy. Second: drop the old key column, in its own PR, only after "Test key" passes on live. That means two approvals instead of one.
- **Yes (recommended).**

**G5. Duplicate video IDs on live.** Before the first migration, the controller checks read-only whether one YouTube video sits on two episodes. If it does, the migration stops and you choose which row to clear (a live write, your word).
- **Yes (recommended).**

**G6. Key timing.** The Worker secret is set after deploy, because setting a secret publishes a new live version of the deployed code. Between deploy and the secret, Settings shows "Key missing" and admins cannot import or add a video link. Playback is not affected.
- **Yes (recommended).**

**G7. UI choices beyond the signed pictures.** These are the 26 items in `06-UI-SPEC.md` § "Owner-visible deviations": 11 that differ from a picture, 15 that are new UI with no picture. The main ones:
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

**G8. Start condition.** Execution starts only after Phases 1.1–5 are on main. 06-00 stops with NEEDS KOSS while any workflow still applies migrations on push to main. Today's `supabase-migrations.yml` does, so Phase 1's gated apply must land first.
- **Yes (recommended).**

## Your owner steps, in order (each one numbered step at its time)

1. Create the API-restricted key in the Clickit Google account (project "clickit-story").
2. UAT on the local stack (06-20): run the local admin script yourself; the test login prints only in your terminal.
3. Ship the Phase 6 PR.
4. Approve the first migration on live after the duplicate check and dry-run.
5. Approve deploy.
6. Set the Worker secret in your terminal; press "Test key" on live.
7. Say go for one real daily check (or let the 01:30 UTC run fire).
8. Ship the second PR (drop the old key column); approve its live apply.
9. Delete the old key in Google Cloud.

GSD: next is `/gsd-execute-phase 6`, after G1–G8 and after Phases 1.1–5 land. Jev: none in Phase 6 (D-18). Automation: the daily check is the unattended agent. Optional later: a weekly "Can't play" email to the two admins, through the Phase 5 email queue (your word).
