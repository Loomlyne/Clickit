# Phase 3 — plan gate for Koss

Plans: `03-01-PLAN.md` … `03-13-PLAN.md` (13 plans, run one at a time, waves 1–13). 03-01 … 03-06 are code and the runbook, written by a work session and landed through one PR. 03-07 … 03-13 are the live steps the controller and you run after Ship, in the order of `03-RUNBOOK.md` Steps 1–56 (written by 03-06). Checked by gsd-plan-checker (Opus): round 1 found 3 blockers and 9 warnings, round 2 one blocker, round 3 one blocker (ops logs inside the repo would make the deploy guard refuse); a targeted 4th check after that fix: **VERIFICATION PASSED**. Its last non-blocking warning (push the planning notes before Step 25) is applied in 03-10. One warning kept by choice: 03-04 touches 12 files (runs alone, serial waves).

Discuss is signed: Q1–Q18 = A (2026-10-20 ~17:55 CET), recorded in `03-CONTEXT.md` D-01..D-19. The proof-window watchdog and the Jev rollback advisor stay proposals and are not in the plans.

Reply: `G1 yes … G7 yes`, or "all yes". Recommended answer first in each.

## Decisions to sign

**G1. Start condition.** Execution starts only when Phase 2 is on main, its workers.dev UAT passed, the media verify report shows 0 failures, and the CPU report says Workers Free passes (or you approved Workers Paid). 03-01 checks this first and stops with NEEDS KOSS if any item is missing. Today Phase 2 is not on main, so it would stop.
- **Yes (recommended).**

**G2. Criterion 1 and DNS-02 wording (from Q5 A, apex keeps its redirect).** Today they say the apex "returns real HTML". The apex redirects to www instead.
New wording: "Opening https://www.clickitstory.ae returns `server: cloudflare` with real HTML from the Worker; https://clickitstory.ae redirects (301) to www. A real account can sign in and play an episode on www."
- **Yes (recommended):** 03-13 writes this into ROADMAP and REQUIREMENTS.
- No: keep the old wording (the phase then cannot pass criterion 1 as written).

**G3. MEDIA-02 wording (from Q9 A, the three picsum posters stay).** Today: "the database holds only R2 URLs".
New wording: "Every stored photo and video is served from media.clickitstory.ae; the database holds only R2 URLs for stored media (external placeholder images are not stored media)."
- **Yes (recommended).**

**G4. "Rotate the service-role key" (DNS-03).** Supabase no longer lets you rotate the old keys. In the plans it means: the Worker gets a new `sb_secret_` key (and the build a new `sb_publishable_` key) before the flip; at the close the old `anon` + `service_role` keys are switched off together (Step 41, reversible). `keys-check` proves the old key gets 401 after that.
- **Yes (recommended).**

**G5. Owner line for www (from D-07).** The ROADMAP owner line "attach the Worker custom domain to www and the apex" is replaced by "deploy the Worker with the `www.clickitstory.ae/*` route, then switch the `www` record to proxied (the flip); rollback = switch it back to DNS only". A custom domain would need the record deleted first and could leave www unreachable for up to 30 minutes for some visitors.
- **Yes (recommended).**

**G6. Media order and freeze (Q7 A).** The media Worker is switched to R2-first and then verified straight after on `media.clickitstory.ae`. Only the R2 Worker can serve the image variants and the fast-start videos; the Supabase fallback keeps every image working in between, and going back is one deploy. From the re-sync until the first Monday 04:00 UTC inside the proof window, admins change no image or video (you tell Issam and Nejib yourself); the frozen Vercel cleanup cron could otherwise delete replaced Supabase originals.
- **Yes (recommended).**

**G7. Fix in your local file (controller does it, not the work session).** `/Users/koss/Developer/Clickit/CLAUDE.local.md` line 32 says to re-sync media with `npm run r2:copy`. That tool would overwrite the fast-start videos. Proposed: replace it with `npm run r2:media -- --refresh`, then `--execute`, and mark `.planning/handovers/r2-media-copy.md` as superseded for re-sync.
- **Yes (recommended).**

## Your owner steps, in order (each one numbered step at its time, runbook step in brackets)

Before flip day:
1. Name the Resend account that owns the current `RESEND_API_KEY` and the DMARC report address, words only (Step 3; Q12, Q14).
2. In that Resend account: add `clickitstory.ae`, region Ireland (Step 4).
3. Add the Resend records in Cloudflare DNS, all DNS only (Step 5). The controller digs both Cloudflare nameservers and the `.ae` registry first (Step 6).
4. Press Verify in Resend (Step 7), then one test send from your terminal (Step 8).
5. Approve the backup-table migration in GitHub Actions after reading the dry run (Step 11).
6. Tell Issam and Nejib: no image or video changes in the admin until you lift it (Step 13).
7. Run the media re-sync in your terminal: `r2:media --refresh`, then `--execute` twice (Steps 14–15).
8. Supabase: create the new publishable and secret keys (Step 18); put the secret key on the Worker with `wrangler secret put` (Step 19).
9. Web Analytics: add `www.clickitstory.ae` (Step 20); write the production env file (Step 21); read the Turnstile hostnames (Step 22).
10. Create the Cloudflare DNS-edit token for `clickitstory.ae` only and store it in Keychain (Step 23; Q16).
11. Read the zone settings (Step 24).

Flip day (Tue–Thu, 10:00 Dubai):
12. Say "build production" (one build, then the account-checked dry run), then "deploy production" (deploys that same build) (Steps 25–26).
13. The Vercel account owner signs in once and presses "Disable Cron Jobs" (Step 27; Q1). Without that sign-in, the signed fallback applies.
14. UAT on workers.dev: admin audit page loads (Step 29).
15. Set the www route to "Fail open" (Step 30; Q18).
16. Say "flip www" and switch the `www` record to Proxied (Step 32).
17. UAT on www: sign in, play an episode, resume, apex lands on www, contact mail arrives from no-reply@ (Step 34).

Proof window (7 days, close by the date Step 31 writes, never after 2026-12-15):
18. Read the daily line; the controller rolls back at once only on the signed triggers (Steps 36–37).
19. Lift the media freeze after the first Monday 04:00 UTC inside the window.
20. Say "close proof window" after 7 green days (Step 39).

Close:
21. Supabase: deactivate the legacy API keys (Step 41); reload www while signed in, still signed in (Step 43).
22. Supabase: CAPTCHA on with Turnstile (Step 44); sign out and back in on www (Step 45).
23. Set the www route back to the default failure mode (Step 46).
24. Say "rewrite media urls" after the preflight and dumps (Step 49).
25. Say "retarget www" and point the `www` record at the apex, proxied (Step 53).
26. The Vercel account owner signs in once more and deletes the project (Step 55; Q1). Without that sign-in, the signed fallback applies.
27. Sign G2, G3, G5 if not yet signed (03-13 writes the wording).

GSD: next is `/gsd-execute-phase 3` for 03-01 … 03-06 once Phase 2 is on main. Jev: proposal only (proof-window "hold or propose rollback" call). Automation: proposal only (proof-window watchdog).
