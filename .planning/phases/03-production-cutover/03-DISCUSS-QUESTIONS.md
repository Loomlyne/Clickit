# Phase 3 — Production Cutover: questions for Koss

Phase goal (ROADMAP): clickitstory.ae can send mail through Resend; www and the apex are served by the Worker; every media URL in the database points at R2; the old Vercel deployment can no longer write to live data; rollback stays possible until the proof window ends; then the Vercel project is deleted. Requirements DNS-01..04, MAIL-02, MEDIA-02, MEDIA-08, PLAT-11.

**Answered 2026-10-20 ~17:55 CET: Koss signed all recommended (Q1–Q18 = A), relayed by the controller.**

How to answer: reply with the question number and a letter, e.g. `1A 2A 3B …`. "All recommended" is fine. The recommended option is first in each question. Phase 3 changes no screen a viewer or admin sees, so there are no pictures.

Already fixed, not asked again: the zone is on Cloudflare (registry lists only jen/brett, checked 2026-10-20 15:30 CET); `media.clickitstory.ae` is the `clickit-media` Worker; DNS, live-DB, secret and deploy steps are one numbered step each; the controller digs both Cloudflare nameservers for every record before any registrar step; the DB rewrite has a backup table and a read-back; Supabase Storage is emptied only in Phase 8 after your word; Phase 3 starts only after Phase 2 is on main and passed its workers.dev UAT.

## Facts found while preparing these questions (2026-10-20)

1. **Vercel crons do not stop when www moves.** Vercel calls the deployment's own `*.vercel.app` address, not www (vercel.com/docs/cron-jobs). Only the Vercel dashboard ("Disable Cron Jobs") or a redeploy stops them, and you have lost Vercel access.
2. **The weekly Vercel cleanup cron reads only Supabase URLs.** `src/app/api/cron/cleanup-media/route.ts` keeps a Supabase Storage file only if a DB row holds its Supabase URL. After the DB rewrite to `media.clickitstory.ae`, every versioned artwork and hero video older than 24 h looks unused, and a run with a working service-role key would delete them from Supabase Storage (Mondays 04:00 UTC). The frozen Vercel build probably aborts first (its R2 mirror check throws without R2 keys), but that is not proven. So the rewrite must wait until Vercel can no longer use the database.
3. **Supabase legacy keys go off together.** The legacy `anon` and `service_role` keys are switched off as one setting (supabase.com/docs/guides/api/api-keys). Switching them off cuts the Vercel deployment from the database completely (reads, sign-in, writes). The Worker keeps working if it already uses the new keys (`sb_publishable_…` and `sb_secret_…`). Rotating the old JWT secret instead would sign every viewer out; it is not proposed.
4. **Vercel's certificate for www stops renewing once www leaves Vercel** (renewal needs the domain to point at Vercel; Let's Encrypt certificates last 90 days, renewal starts 14–30 days before expiry). A DNS rollback to Vercel is safe only inside that time.
5. **A Worker custom domain cannot be added while a `www` CNAME exists** (developers.cloudflare.com/workers/configuration/routing/custom-domains). Deleting the CNAME first leaves www without a record for a moment, and resolvers that ask in that moment cache "no such name" for up to 30 minutes. So the plan does not use a custom domain for www: the Worker is deployed first with a route `www.clickitstory.ae/*`, which does nothing while the `www` record is grey (DNS only). The flip is one switch on that record, grey → orange (proxied); the rollback is the same switch back. No gap either way.

---

## A. Vercel

### Q1. Vercel access
You have lost access to the Vercel project (team `clickit-s-projects`, owned by `clickitstory@gmail.com`). Two things need it: switching the Vercel crons off before the flip, and deleting the project at the end.
Example: the client signs in to Vercel once, you share the screen, and they press "Disable Cron Jobs" (before the flip) and, after the proof window, "Delete Project".
- **A (recommended).** Get one sign-in from the account owner for those two clicks. Until then the plan works without it (B), and the two clicks are added when access returns.
- **B.** Plan without Vercel access. The Vercel crons stop when the old Supabase keys are switched off (Q2). The Vercel project is not deleted; www and the apex no longer point at it and it cannot reach any data. ROADMAP criterion 2 ("Vercel crons were off before the flip") and PLAT-11 ("Vercel project deleted") are reworded to match.

### Q2. When Vercel loses the database
Cutting Vercel off ends the rollback path (fact 3). Before that, the Worker is moved to the new Supabase keys, so cutting the old keys does not touch it.
Example: flip on day 0; the Worker already runs on the new keys; Vercel still can read and write; on day 7 you close the proof window and the old keys are switched off.
- **A (recommended).** At the end of the proof window, as the step that closes it. Rollback to Vercel works the whole window.
- **B.** Right after the flip. Vercel is dead at once; there is no rollback to Vercel, only fixes on the Worker.

### Q3. Length of the proof window
The rollback to Vercel stays possible until you close it. Hard limit: Vercel's certificate for www expires **2026-12-29 02:45 UTC** (read 2026-10-20) and cannot renew once www leaves Vercel, and Supabase retires the old keys at the end of 2026. So the window closes by **2026-12-15** at the latest, whatever you pick.
Example: flip on a Tuesday; the controller sends you a short daily health line; the next Tuesday it asks "close the proof window?".
- **A (recommended).** 7 days, closed by your word after the controller's checks are green each day.
- **B.** 14 days.
- **C.** 3 days.

### Q4. Who may roll back
A rollback is one DNS switch: the `www` record goes back from orange (proxied, Worker) to grey (DNS only, Vercel) (fact 5). Visitors move within about 5 minutes (record TTL).
Example: at 23:10 Dubai time www returns errors for 10 minutes; the controller runs the rollback and tells you after.
- **A (recommended).** You approve the rollback now, for the proof window only, for these triggers: www or the apex down or erroring for 10 minutes, sign-in broken, or playback broken. The controller rolls back first and reports right after. Anything else waits for your word.
- **B.** Every rollback is your own numbered step; the controller asks first, even at night.

### Q16. Who can press the rollback switch
The rollback switch is in the Cloudflare DNS page. The controller's wrangler login most likely cannot edit DNS.
Example: at night the controller runs `scripts/cutover/rollback.mjs`, which reads a DNS-only token from your Mac's Keychain and sets the `www` record to grey.
- **A (recommended).** Before the flip, one owner step: you create a Cloudflare API token limited to "Zone → DNS → Edit" on `clickitstory.ae` only and store it in Keychain (never in chat or a file). The controller uses it only for the rollback and the flip read-back.
- **B.** No token. You press the switch yourself every time (Q4 then becomes "the controller calls you").

## B. Domain

### Q5. The apex `clickitstory.ae`
Today a Cloudflare redirect rule sends the apex to www (301).
Example: someone types `clickitstory.ae/en/series/x` and lands on `https://www.clickitstory.ae/en/series/x`.
- **A (recommended).** Keep the redirect. One address for the site (www); sign-in cookies and search engines see one host. ROADMAP criterion 1 is read as "the apex redirects to www, which serves real HTML".
- **B.** The Worker serves the apex too, as a second custom domain, with its own copy of every page.

### Q6. Time of the flip
Example: Wednesday 10:00 Dubai time, you available for two hours after.
- **A (recommended).** A weekday morning, Tuesday to Thursday, 10:00 Dubai time, with you available for two hours. Not near Monday 04:00 UTC (Vercel cleanup run) or 01:00 UTC (scheduled publish).
- **B.** Late night Dubai time (lowest traffic), with you available.

## C. Media

### Q7. Media from R2 first
`media.clickitstory.ae` serves files from Supabase today (`--env supabase-only`). R2 already holds a verified copy of all 86 files.
Example: an admin replaces the favicon on the Worker site; the new file goes to R2; `media.clickitstory.ae` must show the new one, not the old Supabase one.
- **A (recommended).** Switch the media Worker to R2-first (Supabase only as fallback) as the first Phase 3 step, before the www flip: re-sync the copy, verify every file, then deploy. Rollback is one redeploy.
- **B.** Switch it at the same time as the www flip.

### Q8. The database URL rewrite (MEDIA-08)
Every `…supabase.co/storage/v1/object/public/<bucket>/<key>` and every Phase 2 `clickit-media.<sub>.workers.dev/<bucket>/<key>` in the database becomes `https://media.clickitstory.ae/<bucket>/<key>`, including the four links inside `app_config.footer_content`. A backup table keeps every old value; a read-back must find zero old-host URLs.
Example: `shows.hero_url` for one show changes from the Supabase address to `https://media.clickitstory.ae/show-artwork/shows/<id>/hero-1712345678.webp`.
- **A (recommended).** Run it right after the old keys are switched off (Q2), so the Vercel cleanup cron can never act on it (fact 2). Until then the site already shows R2 media, because the app maps Supabase addresses to `media.clickitstory.ae` when it renders.
- **B.** Run it during the proof window, after first proving with a read-only check that the Vercel cleanup cron is not deleting anything.

### Q9. The three placeholder posters
Three live shows still have `picsum.photos` posters (seed placeholders, found in the Phase 1 audit). They are not on the old media host, so the rewrite does not touch them.
Example: "Show X" keeps a random stock photo as its poster.
- **A (recommended).** Leave them; list them in the rewrite report; the admins replace them through the admin when they have real art.
- **B.** Set them to empty in the same approved rewrite (the poster then falls back to the card image).

### Q17. Old addresses in the admin history
`admin_audit_log` keeps a record of past admin edits, and those records contain the old Supabase addresses.
Example: an audit row from September says "hero_url changed from <old Supabase address> to <other old Supabase address>".
- **A (recommended).** Leave history as it was; "zero old-host URLs" covers every live content column but not `admin_audit_log`. The report lists how many history rows still mention the old host.
- **B.** Rewrite the history rows too.

### Q18. What happens if the Worker hits the free daily limit (100k requests)
On Workers Free, the site Worker and the media Worker share 100,000 requests a day. Over the limit a route either shows a Cloudflare error (default) or lets the request pass to the record's target, which during the proof window is still Vercel.
Example: a show trends on Instagram, 120,000 requests arrive in a day; with "fail open", www keeps working from Vercel after request 100,000; media files keep failing either way.
- **A (recommended).** "Fail open" on the www route during the proof window (a dashboard setting); after the window, back to the default and the controller brings you the Workers Paid price if traffic gets near the limit.
- **B.** Keep the default (error page over the limit).

## D. Crons and sign-in protection

### Q10. Worker crons at the flip
The Worker has the same two crons as Vercel, deployed off. Vercel's may keep running (Q1, Q2).
Example: an episode set to publish at 01:00 UTC. If Vercel publishes it first, the Worker's run finds nothing to do and today's code then skips the page refresh, so the Worker site shows it late.
- **A (recommended).** Turn on the Worker's scheduled publish at the flip, a few minutes before Vercel's (00:55 UTC), and make it refresh the pages on every run. Keep the Worker's media cleanup off until Phase 8 (it never deletes Supabase originals anyway).
- **B.** Keep both Worker crons off until Vercel's are off.

### Q11. Supabase CAPTCHA (Turnstile on sign-in, sign-up, password reset)
It is one project-wide switch. The Worker sends a Turnstile token; the frozen Vercel site does not, so once it is on, sign-in on Vercel stops working.
Example: a bot posts 500 sign-up requests; with CAPTCHA on, Supabase refuses all of them.
- **A (recommended).** Turn it on when the proof window closes, together with Q2, so a rollback keeps working sign-in.
- **B.** Turn it on at the flip; a rollback to Vercel then has no working sign-in.

## E. Email (MAIL-02)

### Q12. Which Resend account owns clickitstory.ae
The app already reads `RESEND_API_KEY` (contact form). The domain must be added in the account that owns that key.
Example: Resend → Domains → Add `clickitstory.ae` in that account.
- **A (recommended).** The Resend account that the current `RESEND_API_KEY` belongs to; you tell the controller which one it is (name only, never the key).
- **B.** A new Resend account under the client's email, with a new key put on the Worker.

### Q13. Resend region
Resend sends from one region per domain; changing it later means deleting and re-adding the domain.
- **A (recommended).** Ireland (`eu-west-1`), the closest of Resend's regions to the UAE.
- **B.** North Virginia (`us-east-1`), Resend's default.

### Q14. DMARC policy
Example record: `_dmarc.clickitstory.ae TXT "v=DMARC1; p=none; rua=mailto:<address you own>"`.
- **A (recommended).** Start with `p=none` and reports to an address you name, for two weeks; then a separate step moves it to `p=quarantine` (Phase 5, before auth emails go out).
- **B.** `p=quarantine` from day one.

### Q15. Sender address for the contact form now
Today mail goes out as `Clickit Story <onboarding@resend.dev>`. Phase 5 sets the auth and app email senders.
- **A (recommended).** `Clickit Story <no-reply@clickitstory.ae>` once the domain is verified.
- **B.** `Clickit Story <hello@clickitstory.ae>` (only if that inbox exists or will exist).

---

## One-line notes (no answer needed)

- GSD: next is `/gsd-plan-phase 3` (already drafted from the recommended answers; any non-recommended answer is applied as a plan revision).
- Jev: one fit, proposal only: the proof-window watchdog asks Jev "propose rollback or hold?" from its health numbers, logged with confidence; low confidence goes to you. It never rolls back by itself.
- Automation: one unattended agent, proposal only: a proof-window watchdog (scheduled check every 15 minutes) that loads www, the apex redirect, a sign-in page, one episode page and 10 media files, reads the Workers request count against the Free 100k/day, and posts one line to the controller; red twice in a row → the controller acts under Q4.
