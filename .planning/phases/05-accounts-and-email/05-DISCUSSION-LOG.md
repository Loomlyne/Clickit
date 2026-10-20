# Phase 5: Accounts and Email - Discussion Log

> Audit trail only. Planning and execution read 05-CONTEXT.md.

**Date:** 2026-10-20
**Mode:** work session; Koss is not asked directly. The 17 questions went to the controller as `NEEDS KOSS:` items (`05-DISCUSS-QUESTIONS.md`, pictures `mockups/05-q*.png`). CONTEXT records the recommended options as provisional decisions.

| Area | Questions | Provisional (recommended) | Status |
|------|-----------|---------------------------|--------|
| Wall and sign-in | Q1-Q6 | 1A code first, 2A landing+legal+auth+Support open, 3A name step, 4A show-aware sign-in, 5A 15 min, 6A last-used language | awaiting Koss |
| Admins | Q7-Q11 | 7A full-page TOTP, 8A every sign-in + 12 h, 9A second authenticator + owner reset, 10A Issam + Nejib only, 11A owner step only | awaiting Koss |
| Emails | Q12-Q17 | 12A black header/white body, 13A both admins + Reply-To, 14A 20:00 Dubai, 15A digest on by default, 16A keep legacy rows unconfirmed, 17A app-side HIBP check | awaiting Koss |

Facts found while preparing the questions:
- Supabase leaked-password protection is Pro-only (supabase.com/docs/guides/auth/password-security). Live audit suggests Free.
- Today's callback is PKCE-only (`exchangeCodeForSession`), so links opened on another device fail: root cause for AUTH-04.
- `get_public_youtube_video_id(uuid)` is SECURITY DEFINER and granted to anon (migration 20260618000000).
- `profiles` has no locale column; locale lives only in the `NEXT_LOCALE` cookie.
- `newsletter_subscribers` has no confirmed-at column.
- Custom SMTP starts at 30 auth emails/hour; OTP resend window 60 s per user.

Deferred: newsletter sending, Supabase Pro, in-app admin manager, recovery codes, Jev support triage (proposal), email-health automation (proposal).
