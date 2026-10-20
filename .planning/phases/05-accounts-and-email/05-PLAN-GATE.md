# Phase 5 Accounts and Email: plan gate

38 plans (05-00 to 05-37) in 14 waves are written against the recommended answer in every row. Nothing executes until every row below has Koss's answer in the "Koss" column (05-00 Task 1 stops otherwise). An answer other than the recommended one names the plans that change; those plans get a revision pass (`/gsd-plan-phase 5 --revision`) before execution.

How to answer: row number and letter, for example `G1 A, G2 A, G12 B`. "All recommended" is fine. Pictures for G1, G3, G4, G7, G12: `mockups/05-q*.png`.

## Decisions (G1 to G19 are Q1 to Q19 of 05-DISCUSS-QUESTIONS.md)

| # | Question | Recommended | Plans that change if not recommended | Koss |
|---|----------|-------------|--------------------------------------|------|
| G1 | Sign-in screen: code first, "Use a password instead" swaps in the password field | A | 05-22 (AuthSignInForm states and layout) | |
| G2 | Open without an account: landing, legal, sign-in, Support (About walled) | A | 05-02 (wall list and unit test), 05-31 (auth-wall spec) | |
| G3 | New viewer after the first code: one "What should we call you?" step | A | 05-21 (after-sign-in routing), 05-24 (/auth/welcome) | |
| G4 | Shared show link: sign-in page shows that show's poster and title | A | 05-22 (show preview and metadata) | |
| G5 | Code and email-link lifetime: 15 minutes, resend after 60 s | A | 05-02 (AUTH_LINK_MINUTES), 05-10 (template text, config.toml otp_expiry), 05-35 (owner step value) | |
| G6 | Email language = the site language last used | A | 05-09 (profiles.locale), 05-21 (locale write at sign-in), 05-26 (LocaleSync / Profile setting) | |
| G7 | Admin authenticator step: a full page before any admin screen | A | 05-25 (/auth/mfa pages) | |
| G8 | Admin code again after 12 hours | A | 05-03 (ADMIN_MFA_MAX_AGE_HOURS) | |
| G9 | Lost phone: second authenticator at setup plus Koss's remove-factor step | A | one extra plan (recovery codes) plus 05-25 | |
| G10 | Live admins: exactly Issam and Nejib | A | 05-36 Task 2 (a third admins row for Koss and his enrolment); no code change | |
| G11 | Adding/removing admins: Koss's numbered owner step; read-only Admins list | A | one extra plan (admin manager screen) plus 05-27 | |
| G12 | Email look: black header, white body, yellow button (same question as Phase 4 Q7, see G22) | A | 05-07 (EMAIL_COLORS); 05-10 and 05-11 re-run their render checks | |
| G13 | Support admin copy to both admins with Reply-To = viewer | A | 05-28 (recipient setting) | |
| G14 | Digest at 20:00 Dubai (16:00 UTC) | A | 05-20 (cron string), 05-37 (stated send time) | |
| G15 | Digest on by default for anyone with a My List show | A | 05-09 (notify_new_episodes default) | |
| G16 | Legacy newsletter rows kept as "not confirmed", nothing sent | A | A keeps 05-09 and 05-28 as written; B adds one owner-approved send step to 05-36; C adds one owner SQL delete step to 05-36 | |
| G17 | Leaked passwords: the app checks Have I Been Pwned (no Supabase upgrade) | A | B: the HIBP part of 05-03 is dropped and its callers 05-21, 05-24, 05-26 lose the check, owner step added to 05-35; C: 05-35 owner step added, code stays | |
| G18 | Supabase auth limits: emails 200/h, code requests and sign-ins 150/5 min, code checks 150/5 min | A | 05-35 (owner step numbers), 05-17 (expected values in auth-config-check) | |
| G19 | Postal line in digest and newsletter footers: Koss gives the exact line | A (until given, plans use B: "Spacelight Studios FZ LLC, Abu Dhabi, United Arab Emirates") | 05-07 (POSTAL_LINE) | |

## Gates added by planning

| # | Question | Recommended | Plans that change | Koss |
|---|----------|-------------|-------------------|------|
| G20 | Execution order. Phase 2 (custom-worker.ts, wrangler.jsonc, auth-guards.ts, form-guard.ts, client-ip.ts, rate-limit-policy.ts, cron-schedule.ts, scheduled.ts, cron-auth.ts, turnstile-field.tsx) is not on main yet. A: execute Phase 5 after Phase 2 merges. B: execute now with stand-ins and rework them later. | A | B: revision pass on 05-00, 05-15, 05-16, 05-18, 05-19, 05-20, 05-21, 05-22, 05-24, 05-28 (TODO(phase-2) stand-ins) | |
| G21 | Controller FYI, contract change for Phase 6: the admin MFA page is `/{locale}/auth/mfa` (not under `/admin`, research F10: the admin layout itself redirects there, so a page inside `/admin` would loop). Phase 6 plans that link or test the MFA page use that path; `npm run seed:local-admin` replaces `/Users/koss/.clickit-checks/phase06-uat-admin.cjs`. | Accept | none in Phase 5; Phase 6 UAT re-run after this lands (05-34 hand-over) | |
| G22 | Email look conflict: Phase 4 Q7 (D-07) recommends fully dark emails; Phase 5 Q12 recommends black header and white body. One answer for both phases; the signed Phase 4 Email board wins for look. | A (black header, white body) | B: 05-07 colour values only (structure unchanged); Phase 4 Email board drawn to match | |
| G23 | Migrations in two PRs: PR 1 carries M1a and M1b (additive); M2 (is_admin requires AAL2) and M3 (anon revoke) are proven in PR 1 under `supabase/pending/` and shipped in a second PR after both admins enrol, because `apply-live-migrations.yml` applies every pending file in one approval. | A (two PRs) | B (one PR, apply all at once): 05-14 moves the files into `supabase/migrations`, 05-37 is dropped, and the deploy must precede enrolment (admin lockout risk until both enrol) | |
| G24 | UI-SPEC open items needing your word: (3) second authenticator skippable; (4) chip "Free with an account" / "مجاناً مع حساب" kept; (5) "Lost your phone? Ask Koss to reset your authenticator." as plain text; (7) name step says "Add a password later" as text; (12) /auth no longer uses the admin "auth heading" setting (fields stay, retire in Phase 8). | All as listed | (3) 05-25; (4) 05-06, 05-22; (5) 05-06, 05-25; (7) 05-24; (12) 05-22 | |
| G25 | Support auto-reply promises a reply "within 48 hours". | A (48 hours) | B (no time stated): 05-11 (SUPPORT_REPLY_HOURS removed), 05-06 copy | |

## Facts the controller reads before execution (read-only, not decisions)

1. Supabase plan of `lajguozmtissnnfccmej` (Free or Pro), from the dashboard (affects G17 only if B or C).
2. Which account `app_config.admin_user_id` holds (email in chat only, never in the repo); M1a seeds the admins list from it and 05-36 renames it to Issam's row.
3. `newsletter_subscribers` row count by `status` (G16).
4. Live Auth settings today: Confirm email, Secure email change, OTP expiry, SMTP, email rate limit (05-35 changes them).

## Upstream preconditions (recorded by 05-00, not answered here)

- Phase 4 boards signed in `04-GATE.md`: 05-07 (Email board), 05-12 (Viewer board; every screen plan after it builds on its components) and 05-27 (Admin board) stop with `NEEDS KOSS` until then.
- Phase 3 cutover (www on the Worker, Resend domain verified, Supabase CAPTCHA on): needed only by the live plans 05-35 to 05-37.
- Phase 6 state: shares `admin/actions.ts`, `database.types.ts`, the message files and the migration order; base wins on merge.

## Next steps

- GSD: after your answers, `/gsd-execute-phase 5` in this work session (worktree `phase-05-accounts-and-email-61ece8`); it stops at 05-33 (your local UAT) and 05-34 (PR open, not merged); 05-35 to 05-37 run in the controller with your numbered steps.
- Jev: proposal only, not in any plan: a Jev triage call on each incoming support message (route to "playback", "account", "billing-question", "other" with a confidence; low confidence goes to both admins unlabelled). Added only on your word.
- Automation: proposal only, not in any plan: a daily unattended email-health check (read-only: `email_outbox` rows stuck in sending or failed, DLQ depth, Resend bounce rate) that posts one line to the controller and alerts only on a threshold. Added only on your word.
