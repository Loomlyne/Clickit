# Phase 5 landed partly (PR #32, Koss's Ship, 2026-10-30)

30 of 42 plans are on `main`. Still to build: 05-24, 05-30 to 05-37, 05-39, 05-41.

`vercel.json` turns off Vercel Git deploys, because www followed `main` and this code needs live steps first. Koss chose this on 2026-10-30. Delete the file at the Worker cutover (standing rule: no Vercel).

## Do not deploy this code until
- Migrations M1a and M1b are live (apply-live-migrations.yml, Koss's approval), then M2 and M3 in plan order.
- Queues `clickit-email` and `clickit-email-dlq` exist and the Worker secrets are set (05-35).
- `/auth/welcome` exists (05-24): `destinationAfterSignIn` sends every new viewer there.

## Open decisions
- Bundle headroom is 5.10 KiB. Before 05-24: A `zod/mini` in the auth and profile actions (saving not measured), or B 05-24 route option A with no new route.
- 05-20 cron map, 05-26 wording, 05-22 UAT copy, 05-19 workers.dev CPU run.
- Koss: Inbox "Notification receiver" panel, picture at `.planning/phases/05-accounts-and-email/mockups/05-28-inbox-receiver-options.html` (A remove, B keep as footer email).

## Review follow-ups (Sonnet, PR #32), before any deploy
1. Suspected pre-hijack: `auth/actions.ts:331` stamps `password_set_at` before the email is confirmed. Stamp it on the first password sign-in, and test on the local stack whether code confirmation keeps a password set at sign-up.
2. A `finish_outbox` failure leaves a delivered row in `sending` until the daily sweep, which can mark it failed. Decide with the 05-20 cron map; fix the "15-minute sweep" comments.
3. Call `requireAdmin()` on the admin pages that use the service-role client (audit, admin, settings, shows/[id]).
4. Code lockout has no CAPTCHA or per-IP gate, and password sign-in has no limiter. Turnstile is not enforced until Supabase CAPTCHA is on (hard deploy gate).
5. Recovery links still go to the old `/auth/reset-password` form, which skips the server password policy.
6. Add a runbook line for the window between the code deploy and M2: real admins pass the app gate, but RLS still reads `app_config.admin_user_id`.
7. Low: `build_digest` `failed` marker rolls back; read back the `newsletter_subscribers` count before M1a; support form says "sent" with no admins; newsletter answer reveals membership.

## Spike
Phase 2.1 spike failed on Workers Free. Code stays on `claude/phase-02-cpu-en-f3ef3f` and tag `archive/phase-02-1-spike-at-f24c5ea`. Route decision is open with Koss.
