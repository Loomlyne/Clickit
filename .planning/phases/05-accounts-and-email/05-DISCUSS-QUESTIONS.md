# Phase 5 — Accounts and Email: questions for Koss

Phase goal (ROADMAP): only signed-in viewers get past the landing and legal pages. Viewers join or sign in with a 6-digit email code or a password. Issam and Nejib each work under their own authenticator-protected admin account. Every auth and app email arrives branded from `Clickit Story <no-reply@clickitstory.ae>`, once, in the viewer's language. Requirements AUTH-01..08, MAIL-01, MAIL-03..07.

How to answer: the question number and a letter, e.g. `1A 2A 3B …`. "All recommended" is fine. Pictures: `mockups/05-q*.png` (source `mockups/05-mockups.html`, real product tokens, LBC font).

The plans are written against the recommended answers. A different answer changes only the plans named under that question.

Already fixed by the roadmap, not asked again: a never-seen email can create an account with a code; email and password keep working and a password can be added later in Profile; codes accept paste, phone auto-fill and Arabic-Indic digits; reset, confirm and email-change links work on another device; both admins see every admin function; the audit log names the admin; the anon-callable YouTube-ID function is closed; one welcome email; support auto-reply plus an admin copy; newsletter double opt-in; Dubai-evening digest with a Profile switch and one-click unsubscribe; queued emails never duplicate and are retried. The admin setting "Skip sign-in" is removed, because AUTH-01 makes it a dead control.

---

## A. The wall and signing in

### Q1. Sign-in screen: how code and password sit together — picture `mockups/05-q1.png`
Example: Sara types her email.
- **A (recommended).** Code first. "Send code", then six boxes on the same screen. "Use a password instead" swaps in the password field (with the show/hide eye). One screen for sign-in and sign-up.
- **B.** Two tabs at the top: "Email code" and "Password".
- **C.** Password first (today's layout); "Email me a code instead" is a link under it.

Changes if not A: plan 05-05 (sign-in screen).

### Q2. Which pages a signed-out visitor can still open
Today `/support` and `/about` are open; `/legal/*` is not on the open list.
Example: Ahmed cannot sign in and wants to write to Clickit.
- **A (recommended).** The landing page (`/portfolio`, which `/` forwards to), every legal page (`/privacy`, `/terms`, `/legal/*`), the sign-in pages and **Support**, so someone locked out can still reach you. Everything else, About included, needs an account.
- **B.** Only the landing page, the legal pages and sign-in. Support needs an account.
- **C.** As A, plus About.

Changes if not A: plan 05-04 (wall list and its tests).

### Q3. A brand-new viewer right after their first code — picture `mockups/05-q3.png`
Example: Omar enters a never-seen email and the code.
- **A (recommended).** One short screen: "What should we call you?" (the name shows on reviews) and the line "By continuing you agree to the Terms and Privacy Policy". Then Browse.
- **B.** Straight to Browse. His name is taken from the email ("omar.haddad") until he edits Profile.

Changes if not A: plan 05-05.

### Q4. A signed-out visitor opens a shared show link — picture `mockups/05-q4.png`
Example: Lina gets a WhatsApp link to "Sample Show".
- **A (recommended).** The sign-in page shows that show's poster and title ("Sign in to watch Sample Show"). After the code she lands on the show. Link previews in WhatsApp and X still show the title and poster; no episode is reachable.
- **B.** The plain sign-in page; after sign-in she still lands on the show.

Changes if not A: plans 05-04 and 05-05.

### Q5. How long a code or email link works
Supabase uses one setting for sign-in codes and for the confirm, reset and email-change links. Today it is 60 minutes.
Example: Sara asks for a code at 20:00.
- **A (recommended).** 15 minutes (until 20:15). A new code can be asked for after 60 seconds.
- **B.** 60 minutes, as today.
- **C.** 5 minutes.

Owner step either way (Supabase Auth setting). Changes if not A: the number in the templates (05-08) and in the owner runbook (05-14).

### Q6. Which language an email comes in
Example: Omar uses the site in Arabic, then switches to English once on a laptop.
- **A (recommended).** The language he last used on the site. Switching language on the site updates it; nothing else to set.
- **B.** A separate "Email language" choice in Profile (starts as the site language).

Changes if not A: plans 05-02 and 05-11.

## B. Admins

### Q7. The authenticator step for admins — picture `mockups/05-q7.png`
Example: Nejib signs in and opens `/admin`.
- **A (recommended).** A full page before any admin screen loads. First visit: scan the QR code with an authenticator app, then type the code. Every later admin sign-in: type the 6-digit code.
- **B.** The admin page loads blurred behind a pop-up that asks for the code.

Changes if not A: plan 05-07.

### Q8. How often an admin types the authenticator code
Supabase keeps a session open until sign-out, so "once per sign-in" can mean weeks on one laptop.
Example: Issam enters his code at 09:00 Monday.
- **A (recommended).** At every admin sign-in, and again after 12 hours (so about once a working day).
- **B.** Only at sign-in on a new device or after sign-out.

Changes if not A: one constant in `requireAdmin` (05-06).

### Q9. An admin loses their phone
Supabase has no built-in recovery codes.
Example: Nejib's phone is stolen.
- **A (recommended).** At setup each admin adds a second authenticator (for example 1Password next to the phone app). If both are lost, you remove his factor with one numbered owner step and he sets up again on his next sign-in.
- **B.** Clickit shows 10 one-time recovery codes at setup and accepts one instead of the app code (more code, more to keep safe).

Changes if not A: one extra plan for recovery codes.

### Q10. Who has a live admin account
Example: the admin list after this phase.
- **A (recommended).** Exactly two: Issam and Nejib, each with an authenticator. You keep owner access through Supabase and Cloudflare, not through `/admin`.
- **B.** Three: Issam, Nejib and you, all with an authenticator.

Fact needed from the controller (read-only): which account `app_config.admin_user_id` holds today, so the move to the new admins list keeps the right person.

### Q11. Adding or removing an admin later
- **A (recommended).** Only through one numbered owner step from you (a reviewed database change). `/admin` shows a read-only "Admins" list with each admin's authenticator status.
- **B.** An "Add admin" screen inside `/admin` that any admin can use.

Changes if not A: an extra admin screen plan.

## C. Emails

### Q12. The look of every Clickit email — picture `mockups/05-q12.png`
Example: the sign-in code email (Arabic version shown too).
- **A (recommended).** Black header with the logo, white body, yellow button, black text. Reads well in every mail app, including phones in dark mode.
- **B.** Fully black like the site, yellow code and button.

If the Phase 4 design canvas signs an email look first, the canvas wins and this question is skipped. Changes if not A: plan 05-08.

### Q13. Where the admin copy of a support message goes
Example: a viewer writes "Episode 4 won't play".
- **A (recommended).** To both admins' sign-in emails, with Reply-To set to the viewer, so pressing Reply answers the viewer directly.
- **B.** To one shared address you name (for example `support@clickitstory.ae`; it needs a mailbox, e.g. Zoho).

Changes if not A: one setting in plan 05-12.

### Q14. Digest time (Dubai)
Example: two new episodes of a My List show publish on Thursday.
- **A (recommended).** 20:00 Dubai (16:00 UTC), one email listing both.
- **B.** 18:00 Dubai.
- **C.** 21:00 Dubai.

Changes if not A: the cron time in plan 05-13.

### Q15. Is the digest on for a viewer who never touched the setting
- **A (recommended).** On for anyone with a show on My List. Off any time from Profile or one click in the email.
- **B.** Off until the viewer turns it on in Profile.

Changes if not A: one default in the migration (05-01).

### Q16. People already on the newsletter list (signed up before double opt-in)
Example: 12 addresses signed up last month without a confirm link.
- **A (recommended).** Keep them, marked "not confirmed". Nothing is sent now. Any future newsletter goes only to confirmed addresses.
- **B.** Send each one a single "Please confirm" email (an owner-approved send to real people).
- **C.** Delete them.

Fact needed from the controller (read-only): the live row count by status.

### Q17. Leaked-password protection (AUTH-08)
Supabase's own check needs the Pro plan ("Leaked password protection is available on the Pro Plan and above", supabase.com/docs/guides/auth/password-security). The Phase 1 live audit found no backups and PITR off, which suggests the project is on Free (the controller confirms in the dashboard).
Example: Omar tries the password `Password123`, which is in public breach lists.
- **A (recommended).** Clickit checks every new or changed password against the free Have I Been Pwned list on its own server (only the first 5 characters of a hash leave the server) and refuses a leaked one: "This password appeared in a data breach. Choose another." No Supabase upgrade. Limit: someone calling Supabase's sign-up API directly, outside the site, skips the check; it only weakens their own account.
- **B.** Upgrade Supabase to Pro and switch on Supabase's own check (also gives daily backups). Price: supabase.com/pricing; a pricing decision for you, not assumed here.
- **C.** Both.

Changes if not A: B drops the app check from plan 05-03 and adds an owner step.

---

## Facts the controller reads (read-only), not decisions
1. Supabase plan of `lajguozmtissnnfccmej` (Free or Pro), from the dashboard.
2. Which user `app_config.admin_user_id` is (email only, not pasted into the repo).
3. `newsletter_subscribers` row count by `status`.
4. Live Auth settings today: Confirm email on/off, Secure email change, OTP expiry, SMTP (built-in or custom), email rate limit.
