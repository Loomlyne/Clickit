# Phase 5 Accounts and Email: plan gate

42 plans (05-00 to 05-41) in 15 waves (0 to 14). G1 to G19 carry Koss's signed discuss answers (2026-10-20 ~18:05 CET, relayed by the controller; `05-CONTEXT.md` status line), and the plans were revised to match them (revisions 1-3). **Plan gate SIGNED by Koss 2026-10-20 ~19:45 CET (relayed by the controller): every row has its answer.** Execution waits only for G20 (Phase 2 on main) and the upstream preconditions below. An answer other than the recommended one names the plans that change; those plans get a revision pass (`/gsd-plan-phase 5 --revision`) before execution.

How to answer the open rows: row number and letter, for example `G20 A, G23 A`. "All recommended" is fine.

## Decisions (G1 to G19 are Q1 to Q19 of 05-DISCUSS-QUESTIONS.md)

| # | Question | Planned as | Plans that carry it | Koss |
|---|----------|------------|---------------------|------|
| G1 | Sign-in screen: code first, "Use a password instead" swaps in the password field | A | 05-22 | A, 2026-10-20 ~18:05 CET |
| G2 | Open without an account: landing, legal, sign-in, Support (About walled) | A | 05-02, 05-31, 05-40 | A, 2026-10-20 ~18:05 CET |
| G3 | New viewer after the first code: one "What should we call you?" step | A | 05-21, 05-24 | A, 2026-10-20 ~18:05 CET |
| G4 | Shared show link | B: plain sign-in page, no poster/title/per-show Open Graph on /auth; validated same-origin next returns her to the show (D-03) | 05-22 (show preview removed), 05-06 (keys signInToWatch/showChip not added), 05-33 step 3 | B, 2026-10-20 ~18:05 CET |
| G5 | Code and email-link lifetime: 15 minutes, resend after 60 s | A | 05-02, 05-10, 05-35 | A, 2026-10-20 ~18:05 CET |
| G6 | Email language = the site language last used | A | 05-09, 05-21, 05-26 | A, 2026-10-20 ~18:05 CET |
| G7 | Admin authenticator step: a full page before any admin screen | A | 05-25 | A, 2026-10-20 ~18:05 CET |
| G8 | Admin code again after 12 hours | A | 05-03 | A, 2026-10-20 ~18:05 CET |
| G9 | Lost phone: second authenticator at setup plus Koss's remove-factor step | A | 05-17, 05-25, 05-37 | A, 2026-10-20 ~18:05 CET |
| G10 | Live admins: exactly Issam and Nejib | A | 05-36 (accounts and two owner inserts), 05-37 (enrolment) | A, 2026-10-20 ~18:05 CET |
| G11 | Adding/removing admins: Koss's numbered owner step; read-only Admins list | A | 05-27, 05-36 | A, 2026-10-20 ~18:05 CET |
| G12 | Email look | C: scheme-adaptive (light inline default, dark under `@media (prefers-color-scheme: dark)`, both color-scheme meta tags, logo on its own #090909 plate, solid bgcolor button, footer inside the card #767676 on white); colours imported from Phase 4 `src/lib/email-tokens.ts` (D-27). Q12 picture `mockups/05-q12-schemes.png` signed by Koss 2026-10-20 ~19:00 CET: the reference look | 05-07 (shell on EMAIL_TOKENS), 05-10, 05-11 (render checks) | C, 2026-10-20 ~18:05 CET; picture signed ~19:00 CET |
| G13 | Support admin copy to both admins with Reply-To = viewer | A | 05-28 | A, 2026-10-20 ~18:05 CET |
| G14 | Digest at 20:00 Dubai (16:00 UTC) | A | 05-20, 05-37 | A, 2026-10-20 ~18:05 CET |
| G15 | Digest on by default for anyone with a My List show | A | 05-09 | A, 2026-10-20 ~18:05 CET |
| G16 | Legacy newsletter rows | Not applicable: live has 0 rows (D-33); confirmed_at column kept, no marking work | 05-09 | n/a, 2026-10-20 ~18:05 CET |
| G17 | Leaked passwords: the app checks Have I Been Pwned | A, plus owner step 05-35 #1 (Koss reads the plan tier; Pro adds Supabase's own check, app check kept) | 05-03, 05-21, 05-24, 05-26, 05-35 | A, 2026-10-20 ~18:05 CET |
| G18 | Supabase auth limits: emails 200/h, code requests and sign-ins 150/5 min, code checks 150/5 min | A | 05-35, 05-17 | A, 2026-10-20 ~18:05 CET |
| G19 | Postal line | B: exactly "Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates"; footer line 1 "Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates" | 05-07 (POSTAL_LINE, FOOTER_LINE_1), 05-11 tests | B, 2026-10-20 ~18:05 CET |

Live fact applied (D-16, controller read 2026-10-20): live `app_config.admin_user_id` is `admin@test.com`, a test account. M1 (05-09) creates `admins` empty and never copies it (tested on a scratch DB with app_config set). Live order: 05-36 (a) Issam and Nejib create their accounts by first code sign-in, one step each, (b) two owner SQL inserts read back; 05-37 (c) M2, (d) TOTP enrolment. Locally `npm run seed:local-admin` inserts the local seed admin directly; the Phase 6 contract (item 8) uses that local seed, never the live test account.

## Gates added by planning (need Koss's answer)

| # | Question | Recommended | Plans that change | Koss |
|---|----------|-------------|-------------------|------|
| G20 | Execution order. Phase 2 (custom-worker.ts, wrangler.jsonc, auth-guards.ts, form-guard.ts, client-ip.ts, rate-limit-policy.ts, cron-schedule.ts, scheduled.ts, cron-auth.ts, turnstile-field.tsx) is not on main yet. A: execute Phase 5 after Phase 2 merges. B: execute now with stand-ins and rework them later. | A | B: revision pass on 05-00, 05-15, 05-16, 05-18, 05-19, 05-20, 05-21, 05-22, 05-24, 05-28 (TODO(phase-2) stand-ins) || A — execute after Phase 2 merges, 2026-10-20 ~19:45 CET (via controller) |
| G21 | Controller FYI, contract change for Phase 6: the admin MFA page is `/{locale}/auth/mfa` (not under `/admin`, research F10: the admin layout itself redirects there, so a page inside `/admin` would loop). Phase 6 plans that link or test the MFA page use that path; `npm run seed:local-admin` replaces `/Users/koss/.clickit-checks/phase06-uat-admin.cjs` and applies M2 locally (pending, or the migration once PR 2 lands), so local admin pages need the TOTP code first. | Accept | none in Phase 5; Phase 6 UAT re-run after this lands (05-34 hand-over) || Accepted, 2026-10-20 ~19:45 CET (via controller) |
| G22 | Email look conflict with Phase 4 Q7. Settled by G12 = C (one scheme-adaptive answer for both phases; Phase 4 owns the colour values). | Settled (C) | none | C (via G12), 2026-10-20 |
| G23 | Migration order (D-40). Sign exactly: "two PRs; the second (M2+M3) is prepared and reviewed before the first deploy; M2+M3 apply in one approval after the admins rows are read back, then Issam and Nejib enrol; admin pages show nothing from the deploy until enrolment". Why two PRs: `apply-live-migrations.yml` applies every pending file in one approval; M1 must precede the deploy, M3 must follow it (catalog client), and M2 must follow the admins inserts. | A (as quoted) | B (one PR, apply M1+M2+M3 at once before the deploy): 05-14 moves the files into `supabase/migrations`, 05-41 and 05-37 Task 1 are dropped; M3 before the deploy empties the catalog on the old code and M2 before the inserts leaves no admin || A — signed as quoted, 2026-10-20 ~19:45 CET (via controller) |
| G24 | UI-SPEC open items needing your word, each with a picture per option (see "Pictures for G24" below): (3) second authenticator step skippable (A) or required (B); (5) "Lost your phone? Ask Koss to reset your authenticator." as plain text (A) or as a link (B); (7) name step says "Add a password later" as plain text (A) or as a link (B); (12) /auth h1 is the fixed sign-in heading (A) or keeps the admin "auth heading" setting (B; fields stay either way, retire in Phase 8). Item (4), the "Free with an account" chip, is gone with G4 = B. | A for each | (3) 05-25; (5) 05-06, 05-25; (7) 05-24; (12) 05-22 || A for each: (3) skippable, (5) plain text, (7) plain text, (12) fixed "Sign in or join", 2026-10-20 ~19:45 CET (via controller) |
| G25 | Support auto-reply promises a reply "within 48 hours". | A (48 hours) | B (no time stated): 05-11 (SUPPORT_REPLY_HOURS removed from src/lib/email-constants.ts), 05-06 copy, 05-28 || A — "within 48 hours", 2026-10-20 ~19:45 CET (via controller) |

## Pictures for G24 (rendered 2026-10-20, real product tokens; no G24 answer from text alone)

| Item | Picture (A and B side by side) |
|------|--------------------------------|
| (3) second authenticator step: A skippable, B required | `mockups/05-g24-3.png` |
| (5) lost-phone line on /auth/mfa: A plain text, B link | `mockups/05-g24-5.png` |
| (7) name step password note: A plain text, B link | `mockups/05-g24-7.png` |
| (12) /auth heading: A fixed "Sign in or join", B admin setting (today "Sign up below") | `mockups/05-g24-12.png` |

Source: `mockups/05-g24.html` (same token sheet as `05-mockups.html`).

## Plan verification record

- Round 1 (gsd-plan-checker, Opus): 4 blockers, 13 warnings -> revision 1.
- Round 2 (Opus, 7d5e48b): round-1 items all fixed; 3 blockers (email logo, colour roles vs Phase 4 tokens, M2/M3 order), 13 warnings -> revision 2 (05-41 added).
- Round 3 (Opus, df228fa, last full round): round-2 items all fixed; 2 blockers (local seed after PR 2, same-day digest rerun), 5 warnings -> narrow fixes (aaf9b5c).
- Scoped re-check of those fixes (Opus): all confirmed in plan text; 2 blockers (per-run unique e2e addresses; `&amp;` unescape covering the fallback-URL line) and 4 warnings (logo extend background, resolver defaults, seed print lines, Storage `apikey` header), fixed by the orchestrator directly with `verify.plan-structure` passing on 05-07, 05-10, 05-17, 05-32, 05-33, 05-35. Those last edits were not re-checked by a fresh checker run (GSD's 3 rounds are used); they are single-sentence edits in the named plans.
- `frontmatter.validate` / `verify.plan-structure`: 42/42 plans valid; all 14 requirements covered; waves consistent.

## Facts (read by the controller, recorded)

1. Supabase plan tier of `lajguozmtissnnfccmej`: now an owner step (05-35 Task 1 step 1).
2. `app_config.admin_user_id` = admin@test.com, a test account (2026-10-20): never copied (D-16).
3. `newsletter_subscribers` rows: 0 (2026-10-20): G16 not applicable.
4. Live Auth settings today: Confirm email, Secure email change, OTP expiry, SMTP, email rate limit (05-35 sets them, one setting per numbered step).

## Upstream preconditions (recorded by 05-00, not answered here)

- Phase 4 `src/lib/email-tokens.ts` on main: 05-07, 05-10, 05-11 stop with `NEEDS KOSS` until it lands (D-27: Phase 4 owns email colours).
- `email-tokens.ts` carries every signed role value of `mockups/05-q12-schemes.html`, or 05-07 stops with `NEEDS CONTROLLER`: light page #F4F4F4, card #FFFFFF, header #090909, heading #111111, body #333333, hint #555555, code box #F6F6F6, code border #E5E5E5, code digits #111111, rule #E5E5E5, footer #767676; dark page #090909, card #101010, card border #222222, header #101010, header rule #222222, heading #F4F4F4, body #CCCCCC, hint #A1A1A1, code box #191919, code border #2A2A2A, code digits #ffcc00, rule #222222, footer #A1A1A1; button #ffcc00 with ink #090909. Phase 4 added the roles in 30f0d19 (names = Phase 5's role names). Two gaps left there: `light.code` is #090909 but the signed picture draws the light code digits #111111; `dark.rule` (footer top rule, #222222) is absent (05-07 falls back to `dark.headerRule`, same value). Controller asked to align light.code to #111111 and add dark.rule.
- Phase 4 boards signed in `04-GATE.md`: 05-12 (Viewer board; every screen plan after it builds on its components) and 05-27 (Admin board) stop with `NEEDS KOSS` until then.
- Phase 3 cutover (www on the Worker, Resend domain verified, Supabase CAPTCHA on): needed only by the live plans 05-35 to 05-37.
- Phase 6 state: shares `admin/actions.ts`, `database.types.ts`, the message files, the migration order and the local Supabase stack (05-13, 05-17, 05-38 ask the controller before changing the shared stack); base wins on merge.

## Owner steps in order (one numbered step each when they come; all in the controller)

Before execution: answer G20, G21, G23, G24, G25 here. Upstream: Phase 2 on main (G20 A), Phase 4 `email-tokens.ts` with the signed values and the Viewer/Admin boards signed.

1. Local UAT (05-33): 20 numbered type/click steps on the local stack, Koss's pass.
2. Phase 5 PR (05-34): review on the PR, then Koss's Ship (squash to main).
3. 05-35 Task 1 (Supabase Auth): read the plan tier; Resend SMTP key; SMTP settings; OTP length/expiry; resend window; email provider settings; rate limits (G18); URL configuration; Pro-only leaked-password check if Pro; config readback from Koss's terminal. (Confirm email, Secure email change and the five templates are deferred to the pre-deploy sitting.)
4. 05-35 Task 2: Cloudflare queues `clickit-email` + DLQ (controller), Worker secrets `RESEND_API_KEY`, `EMAIL_LINK_SECRET` (Koss's terminal, values never in chat), email logo placed on the media host (controller via R2, or one `NEEDS KOSS` command if the Worker serves Supabase Storage); readback 200 image/png.
5. 05-35 Task 3: M1 applied on live through `apply-live-migrations.yml` on Koss's approval; readback (`admins` = 0, `newsletter_subscribers` = 0).
6. In parallel with 3-5: 05-41 second PR (M2+M3) prepared, gated, reviewed (Grok verdict), left unmerged.
7. 05-36 Task 1, one sitting: P1 Confirm email ON, P2 Secure email change ON, P3 paste the five templates and subjects, P4 config check all OK; then the deploy question (states the 10-15 min break window for old-site email links and the admin outage until enrolment); deploy on Koss's word; live smoke.
8. 05-36 Task 2: first real emails to Koss's own address (code, confirm, reset, welcome, support), logo loads.
9. 05-36 Task 3: Issam signs in by code (account created, real welcome email), Nejib the same; two owner SQL inserts into `admins`, read back (test account not an admin).
10. 05-37 Task 1: migration-guard re-run against main; Ship PR 2; M2+M3 in one approval.
11. 05-37 Task 2: Issam and Nejib enrol TOTP (second authenticator per G24 item 3); admin re-verify.
12. 05-37 Task 3: digest on? A: separate one-line PR with its own Ship; B: stays off.

## Next steps

- GSD: after your answers to G20, G21, G23, G24, G25, `/gsd-execute-phase 5` in this work session (worktree `phase-05-accounts-and-email-61ece8`); it stops at 05-33 (your local UAT) and 05-34 (PR open, not merged); 05-41 (second PR, a new work session) runs right after the Phase 5 PR lands, in parallel with 05-35; 05-35 to 05-37 run in the controller with your numbered steps.
- Jev: proposal only, not in any plan: a Jev triage call on each incoming support message (route to "playback", "account", "billing-question", "other" with a confidence; low confidence goes to both admins unlabelled). Added only on your word.
- Automation: proposal only, not in any plan: a daily unattended email-health check (read-only: `email_outbox` rows stuck in sending or failed, DLQ depth, Resend bounce rate) that posts one line to the controller and alerts only on a threshold. Added only on your word.
