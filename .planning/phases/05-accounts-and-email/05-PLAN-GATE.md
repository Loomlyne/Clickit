# Phase 5 Accounts and Email: plan gate

41 plans (05-00 to 05-40) in 14 waves (0 to 13). G1 to G19 carry Koss's signed discuss answers (2026-10-20 ~18:05 CET, relayed by the controller; `05-CONTEXT.md` status line), and the plans were revised to match them (revision 1). Rows G20 to G25 still need Koss's answer in the "Koss" column; nothing executes until every row has one (05-00 Task 1 stops otherwise). An answer other than the recommended one names the plans that change; those plans get a revision pass (`/gsd-plan-phase 5 --revision`) before execution.

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
| G20 | Execution order. Phase 2 (custom-worker.ts, wrangler.jsonc, auth-guards.ts, form-guard.ts, client-ip.ts, rate-limit-policy.ts, cron-schedule.ts, scheduled.ts, cron-auth.ts, turnstile-field.tsx) is not on main yet. A: execute Phase 5 after Phase 2 merges. B: execute now with stand-ins and rework them later. | A | B: revision pass on 05-00, 05-15, 05-16, 05-18, 05-19, 05-20, 05-21, 05-22, 05-24, 05-28 (TODO(phase-2) stand-ins) | |
| G21 | Controller FYI, contract change for Phase 6: the admin MFA page is `/{locale}/auth/mfa` (not under `/admin`, research F10: the admin layout itself redirects there, so a page inside `/admin` would loop). Phase 6 plans that link or test the MFA page use that path; `npm run seed:local-admin` replaces `/Users/koss/.clickit-checks/phase06-uat-admin.cjs` and applies M2 to the local stack, so local admin pages need the TOTP code first. | Accept | none in Phase 5; Phase 6 UAT re-run after this lands (05-34 hand-over) | |
| G22 | Email look conflict with Phase 4 Q7. Settled by G12 = C (one scheme-adaptive answer for both phases; Phase 4 owns the colour values). | Settled (C) | none | C (via G12), 2026-10-20 |
| G23 | Migrations in two PRs: PR 1 carries M1a and M1b (additive); M2 (is_admin requires an admins row + AAL2) and M3 (anon revoke) are proven in PR 1 under `supabase/pending/` and shipped in a second PR, because `apply-live-migrations.yml` applies every pending file in one approval: M3 must follow the catalog-client deploy and M2 must follow the two admins inserts (D-16 order). | A (two PRs) | B (one PR, apply all at once): 05-14 moves the files into `supabase/migrations`, 05-37 is dropped; M3 before the deploy would empty the catalog on the old code, and M2 before the inserts leaves no admin | |
| G24 | UI-SPEC open items needing your word: (3) second authenticator skippable; (5) "Lost your phone? Ask Koss to reset your authenticator." as plain text; (7) name step says "Add a password later" as text; (12) /auth no longer uses the admin "auth heading" setting (fields stay, retire in Phase 8). Item (4), the "Free with an account" chip, is gone with G4 = B. | All as listed | (3) 05-25; (5) 05-06, 05-25; (7) 05-24; (12) 05-22 | |
| G25 | Support auto-reply promises a reply "within 48 hours". | A (48 hours) | B (no time stated): 05-11 (SUPPORT_REPLY_HOURS removed from src/lib/email-constants.ts), 05-06 copy, 05-28 | |

## Facts (read by the controller, recorded)

1. Supabase plan tier of `lajguozmtissnnfccmej`: now an owner step (05-35 Task 1 step 1).
2. `app_config.admin_user_id` = admin@test.com, a test account (2026-10-20): never copied (D-16).
3. `newsletter_subscribers` rows: 0 (2026-10-20): G16 not applicable.
4. Live Auth settings today: Confirm email, Secure email change, OTP expiry, SMTP, email rate limit (05-35 sets them, one setting per numbered step).

## Upstream preconditions (recorded by 05-00, not answered here)

- Phase 4 `src/lib/email-tokens.ts` on main: 05-07, 05-10, 05-11 stop with `NEEDS KOSS` until it lands (D-27: Phase 4 owns email colours).
- Phase 4 boards signed in `04-GATE.md`: 05-12 (Viewer board; every screen plan after it builds on its components) and 05-27 (Admin board) stop with `NEEDS KOSS` until then.
- Phase 3 cutover (www on the Worker, Resend domain verified, Supabase CAPTCHA on): needed only by the live plans 05-35 to 05-37.
- Phase 6 state: shares `admin/actions.ts`, `database.types.ts`, the message files, the migration order and the local Supabase stack (05-13, 05-17, 05-38 ask the controller before changing the shared stack); base wins on merge.

## Next steps

- GSD: after your answers to G20, G21, G23, G24, G25, `/gsd-execute-phase 5` in this work session (worktree `phase-05-accounts-and-email-61ece8`); it stops at 05-33 (your local UAT) and 05-34 (PR open, not merged); 05-35 to 05-37 run in the controller with your numbered steps.
- Jev: proposal only, not in any plan: a Jev triage call on each incoming support message (route to "playback", "account", "billing-question", "other" with a confidence; low confidence goes to both admins unlabelled). Added only on your word.
- Automation: proposal only, not in any plan: a daily unattended email-health check (read-only: `email_outbox` rows stuck in sending or failed, DLQ depth, Resend bounce rate) that posts one line to the controller and alerts only on a threshold. Added only on your word.
