# Phase 5: Accounts and Email - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning, decisions PROVISIONAL
**Signed:** not yet. This work session may not ask Koss directly; the questions went to the controller as `NEEDS KOSS:` items (`05-DISCUSS-QUESTIONS.md`, pictures `mockups/05-q*.png`). Every D-xx tagged `(Qn)` below is the **recommended** option of that question. Plans are written against these. A different answer replaces that D-xx and the plans named in the question; nothing executes before Koss signs.

<domain>
## Phase Boundary

Only signed-in viewers get past the landing and legal pages (plus sign-in and Support, Q2). Viewers join or sign in with a 6-digit email code or with email and password, and can add a password later from Profile. Password reset, email confirmation and email change work when the link is opened on another device. Issam and Nejib each have their own admin account behind an authenticator-app (TOTP) code; the audit log names the admin; leaked passwords are refused; the anon-callable YouTube-ID function is closed. Every auth email (confirm, sign-in code, reset, email change, reauthentication) and every app email (welcome, My List digest, support auto-reply and admin copy, newsletter confirmation) is branded, sent from `Clickit Story <no-reply@clickitstory.ae>` through Resend, in the viewer's language (EN/AR), and app emails go through a queue that never sends twice and retries failures. Requirements AUTH-01..08, MAIL-01, MAIL-03..07.

Built against `main` as it will be after Phases 2, 3 and 4: the app runs on a Cloudflare Worker (OpenNext, `custom-worker.ts` with `scheduled`), Turnstile widget and server guards exist (`src/components/security/turnstile-field.tsx`, `src/server/form-guard.ts`, `src/server/client-ip.ts`, `src/server/auth-guards.ts`), clickitstory.ae is a Cloudflare zone, Resend has the domain verified (MAIL-02, Phase 3), Supabase CAPTCHA is on (Phase 3 cutover), and the Phase 4 canvas has signed the OTP sign-in and email looks.

Not in this phase: sending newsletters (only the confirmed sign-up), SMS/WhatsApp codes, social sign-in, passkeys, an in-app admin manager (Q11), YouTube import (Phase 6), Arabic RTL fixes outside the new screens (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### The wall (AUTH-01)
- **D-01 (Q2):** Open without an account: the landing page (`/` forwards to `/portfolio`), `/privacy`, `/terms`, `/legal/*`, every `/auth/*` page and route, `/support`, and `/coming-soon` while coming-soon mode is on. Everything else (Browse, series, watch, My List, Profile, About, updates, design-system, admin) sends a signed-out visitor to `/{locale}/auth?next=<path>`. `/api/*` keeps its own checks (cron secret, signed links).
- **D-02:** The admin setting "Skip sign-in" (`app_config.auth_allow_skip`, `config.authAllowSkip`, the `/watch` skip branch in `src/proxy.ts`, the skip link on `/auth`) is removed from code and from the Settings screen. The column stays until the Phase 8 contract step (expand/contract; no destructive migration here).
- **D-03 (Q4):** When `next` points at a show (`/series/<slug>`) or an episode, `/auth` shows that show's poster and title ("Sign in to watch <Show>"), and `generateMetadata` on `/auth` emits that show's Open Graph title and poster, so link previews (WhatsApp, X) keep working through the redirect without any user-agent sniffing. No episode data or YouTube ID is exposed.
- **D-04:** `next` stays validated by the existing `getSafeAuthNextPath` / `safeNext`; after any successful sign-in the viewer lands on `next` (admins without `next` land on `/admin`).

### Signing in and joining (AUTH-02, AUTH-03)
- **D-05 (Q1):** One screen, code first: email → "Send code" → six code boxes on the same screen; "Use a password instead" swaps in the password field (the shared `PasswordField` with its right-side show/hide eye). "Create account" with a password stays available behind the password path. The old two-tab `AuthPanel` goes.
- **D-06:** Code sign-in uses `signInWithOtp({ email, options: { shouldCreateUser: true, data: { locale }, captchaToken } })` and `verifyOtp({ email, token, type: 'email' })` in server actions. The Magic Link and Confirm-signup templates contain `{{ .Token }}` so the email carries a 6-digit code. Code length stays 6.
- **D-07:** The code input accepts paste of the whole code, iOS/Android one-time-code auto-fill (`autocomplete="one-time-code"`, `inputmode="numeric"`), and Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits, normalised to 0-9 on client and server. Resend is offered after 60 s with a visible countdown (Supabase's own per-user window).
- **D-08 (Q3):** A brand-new viewer (no `profiles.display_name` yet, or `onboarded_at` null) gets one step after the first code: "What should we call you?" plus the line "By continuing you agree to the Terms and Privacy Policy" (links). Saving sets `display_name` and `onboarded_at`, then goes to `next` or Browse.
- **D-09:** "Add a password later": Profile shows "Set a password" when the account has none and "Change password" when it has one. Clickit records `profiles.password_set_at` (set by password sign-up, set, change and reset). Existing accounts are backfilled with `password_set_at = created_at` (all pre-phase accounts were created with a password).
- **D-10 (Q5):** Codes and email links work for 15 minutes (Supabase "Email OTP expiration" = 900 s, one setting for all of them; owner step). Templates and UI copy say "15 minutes".
- **D-11 (Q17):** Leaked passwords are refused by Clickit itself: every server action that sets a password (password sign-up, set, change, reset) checks the Have I Been Pwned range API (k-anonymity, SHA-1 prefix of 5 hex chars, `Add-Padding: true`) before calling Supabase, with a 3 s timeout that fails OPEN with a logged warning (an HIBP outage must not block sign-up). Minimum length stays 8 (live setting, Koss 2026-10-20). Supabase's Pro-only check is not assumed.

### Email links that work on another device (AUTH-04)
- **D-12:** Every auth email link uses the token-hash pattern: `{{ .SiteURL }}/{locale}/auth/confirm?token_hash={{ .TokenHash }}&type=<signup|recovery|email_change|email>&next=<path>` (exact path decided in planning; the route must bypass i18n like `/auth/callback`). A new `/auth/confirm` route calls `verifyOtp({ token_hash, type })` server-side, so no PKCE verifier is needed and the link works in any browser. `/auth/callback` (PKCE `exchangeCodeForSession`) stays for compatibility only.
- **D-13:** Recovery: the confirm route signs the visitor in on the device that opened the link and sends them to `/auth/reset-password`. Email change keeps Supabase "Secure email change" (both addresses confirm); each link works on its own device and the UI says which step is still pending.
- **D-14:** Password sign-up requires email confirmation (owner step: "Confirm email" on). Code sign-up confirms by the code itself.

### Language of emails (MAIL-01)
- **D-15 (Q6):** An email's language is the language the viewer last used on the site. Clickit stores it as `profiles.locale` ('en'|'ar') and mirrors it to `auth.users.user_metadata.locale` (sign-up/OTP `options.data`, and a server action on every language switch while signed in). Auth templates branch on `{{ .Data.locale }}`; a missing value means English. App emails read `profiles.locale`.

### Admins (AUTH-05, AUTH-06, AUTH-07)
- **D-16:** New table `public.admins (user_id uuid primary key references auth.users on delete cascade, display_name text not null, added_at timestamptz not null default now(), added_by uuid null references auth.users)`, RLS on, no policies (read only by service role and SECURITY DEFINER functions). Seeded from `app_config.admin_user_id`. `private.is_admin()` keeps its name and signature; its body becomes "a row in `admins` for `auth.uid()` AND `(auth.jwt() ->> 'aal') = 'aal2'`". The one storage policy that checks admin inline (`Admin manage site-assets`) is rewritten to call `private.is_admin()`. `app_config.admin_user_id` stays (unused) until the Phase 8 contract.
- **D-17:** One server-only `requireAdmin()` decides admin everywhere (proxy, admin layout, `assertAdmin` in `src/app/[locale]/admin/actions.ts`, `requireAdminUser` in `src/server/auth-guards.ts`, `/api/youtube-meta`). It returns `{ id, email, displayName }` or throws a typed error: not signed in, not an admin, needs TOTP enrolment, needs TOTP code. `requireAdminUser()` stays as a thin wrapper returning the id.
- **D-18 (Q7):** Before any admin screen renders, an admin without a verified TOTP factor goes to a full-page enrol step (QR + manual key, then code); an admin at AAL1 goes to a full-page "Enter your authenticator code" step. Uses `supabase.auth.mfa.enroll / challenge / verify` and `getAuthenticatorAssuranceLevel`.
- **D-19 (Q8):** The admin re-enters the code at every admin sign-in and again when the session's TOTP verification (`amr` entry `totp`, its timestamp) is older than 12 hours. One constant `ADMIN_MFA_MAX_AGE_HOURS = 12`.
- **D-20 (Q9):** Each admin is asked to enrol a second authenticator at setup (allowed by Supabase: several TOTP factors). If both are lost, Koss removes the factor with one numbered owner step (dashboard: Authentication > Users > factor delete), and the admin enrols again on next sign-in. No in-app recovery codes.
- **D-21 (Q10):** Exactly two live admins: Issam and Nejib. Koss is not an admin on live.
- **D-22 (Q11):** Admins are added or removed only through one numbered owner step (a reviewed SQL statement run by Koss; UUIDs never committed to the public repo). `/admin` gets a read-only "Admins" list: name, email, authenticator set up yes/no, last sign-in.
- **D-23:** The audit log already stores `admin_user_id`; the admin audit screen shows the admin's `display_name` from `admins`. TOTP enrol/unenrol and admin sign-in failures are audited (new entity `admin_auth`).

### Closing the anon YouTube function (AUTH-08)
- **D-24:** `revoke execute on function public.get_public_youtube_video_id(uuid) from anon` (and from `public`), keep `authenticated`. Every caller already runs signed in after the wall; planning confirms there is no anon caller (watch pages, shorts).

### Auth emails (MAIL-01)
- **D-25:** Auth emails go Supabase Auth → custom SMTP `smtp.resend.com:465` (user `resend`, a Resend API key used only by Supabase) → viewer. No Send Email Hook: sign-in keeps working even if the Worker is down. Sender `Clickit Story <no-reply@clickitstory.ae>`. Owner steps: SMTP settings, raise the auth email rate limit from the custom-SMTP default of 30/hour, OTP expiry (D-10), Confirm email on (D-14), Secure email change on.
- **D-26:** The five templates (Confirm signup, Magic Link/OTP, Reset password, Change email, Reauthentication) and their subjects are authored in the repo with React Email (`src/emails/auth/*`), exported to static HTML with Go placeholders kept as literal text (`{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ if eq .Data.locale "ar" }}…{{ else }}…{{ end }}`), committed under `supabase/templates/`, and wired into `supabase/config.toml` `[auth.email.template.*]` for the local stack. Live: Koss pastes or pushes them (owner step). A unit test fails if a template lacks its required placeholder or the AR branch.
- **D-27 (Q12):** Look of every email: black header band with the Clickit Story logo, white body, yellow (#ffcc00) pill button with black text, code in large monospaced digits, footer "Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi" with the Support link; AR version `dir="rtl"`; plain-text part on every email; no tracking links or pixels. The signed Phase 4 canvas overrides this if it differs.

### App emails and the queue (MAIL-03..07)
- **D-28:** Outbox in Postgres plus a Cloudflare Queue. Every app email is first inserted into `public.email_outbox` with a unique `idempotency_key` (e.g. `welcome:<user>`, `support_ack:<msg>`, `support_admin:<msg>:<admin>`, `newsletter_confirm:<sub>:<n>`, `digest:<user>:<dubai-date>`), status `pending`. The insert wins or the email already exists, so it is never created twice. Then a small message `{ outboxId }` goes to Queue `clickit-email` (binding `EMAIL_QUEUE`, DLQ `clickit-email-dlq`). The consumer (`queue()` in `custom-worker.ts`) loads the row, renders EN/AR, sends through Resend with header `Idempotency-Key = idempotency_key`, marks `sent` with the Resend id, or `retry()`s with backoff on 429/5xx; after max retries the row is `failed` and the message lands in the DLQ. Recipient addresses are read from the database in the consumer, never stored in queue messages.
- **D-29:** A sweep re-enqueues outbox rows still `pending` after 15 minutes or `retrying` past their next-attempt time, so a lost queue message is retried, not dropped. It runs inside the single Phase 5 cron (D-34).
- **D-30 (MAIL-03):** Welcome: claimed once with `update profiles set welcome_sent_at = now() where id = $1 and welcome_sent_at is null returning id` on the first verified sign-in (OTP verify, confirm link, or first password sign-in after confirmation), then outboxed. Existing accounts are backfilled `welcome_sent_at = now()` so no real person gets a surprise email.
- **D-31 (Q13, MAIL-05):** Support: the contact action saves the message, then outboxes an auto-reply to the sender (in the page's language) and one admin copy per row in `admins` to that admin's sign-in email, `Reply-To` = the sender. Replaces the direct `sendTransactionalEmail` call in `src/app/actions/contact.ts`.
- **D-32 (MAIL-06):** Newsletter double opt-in: a sign-up creates or refreshes the row as `pending` with a confirm link (HMAC-signed, 7-day expiry, secret `EMAIL_LINK_SECRET`); clicking it sets `confirmed_at` and `status = 'active'`. The current "New newsletter signup" admin notification is dropped (the admin list shows sign-ups). Rate limit and Turnstile as today.
- **D-33 (Q16):** Existing newsletter rows are kept and marked `confirmed_at = null` (legacy, not confirmed); nothing is sent to them. Future newsletter sends (not in this phase) go only to confirmed rows.
- **D-34 (Q14, Q15, MAIL-04):** Digest: one Cron Trigger `0 16 * * *` (20:00 Dubai) runs the digest and the outbox sweep. It selects episodes that became visible to viewers (status `published`, or `coming-soon` with `publish_at <= now()`, matching the public view) since the previous successful digest run (`digest_runs` table; first run looks back 24 h), groups them per viewer whose `watchlist` holds the show, whose `profiles.notify_new_episodes` is true (default **true**) and whose email is confirmed, and outboxes one email per viewer per Dubai date. No new episodes, no email.
- **D-35 (MAIL-04):** Unsubscribe: every digest carries an HMAC-signed link (`/api/email/unsubscribe?u=<user>&k=digest&t=<sig>`, no sign-in) plus `List-Unsubscribe: <https://…>, <mailto:…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (Resend custom headers; planning verifies Resend passes the Post header). GET shows a confirm page with one button; POST flips `notify_new_episodes = false`. Profile has the same switch.
- **D-36:** Resend account is Koss's Pro account (MAIL-01); the Worker reads `RESEND_API_KEY` (Worker secret) and `EMAIL_LINK_SECRET` (Worker secret). Supabase gets its own Resend key for SMTP. All keys are owner steps in his terminal; none in files.

### Abuse controls
- **D-37:** Turnstile (Phase 2 widget) guards Send code, password sign-in, password sign-up and reset; the token goes to Supabase as `captchaToken` (Supabase CAPTCHA, enabled at the Phase 3 cutover). Contact and newsletter keep Phase 2's siteverify guard. Supabase rate limits (OTP per-user 60 s, auth emails per hour) are owner steps; Clickit's own rate limiter (`CF-Connecting-IP`, Phase 2) also wraps send-code and newsletter.

### Claude's Discretion
- Exact table/column names beyond those fixed above, migration split (expand-only migrations; each one passes the Phase 1 guard and goes through `apply-live-migrations.yml` after Koss approves).
- React Email component structure, copy wording (Koss reviews copy at UAT), plain-text rendering.
- How the producer reaches `EMAIL_QUEUE` in `next dev`/unit tests (an in-process fake consumer behind the same interface).
- Whether the Admins list is its own page or a Settings section (read-only either way).
- Local test harness: local Supabase stack with Mailpit for auth emails, a fake Resend for app emails, a local TOTP helper (`node:crypto`, RFC 6238) for admin tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §Phase 5 — goal, success criteria, owner-gated list
- `.planning/REQUIREMENTS.md` — AUTH-01..08, MAIL-01, MAIL-03..07 (MAIL-02 is Phase 3)
- `.planning/phases/05-accounts-and-email/05-DISCUSS-QUESTIONS.md` — the 17 questions; recommended = provisional D-xx
- `.planning/phases/05-accounts-and-email/mockups/05-mockups.html` and `05-q1/q3/q4/q7/q12.png` — option pictures with real tokens

### Research already done for this milestone
- `.planning/research/ARCHITECTURE.md` — Pattern 3 (queue → Resend), Pattern 4 (Supabase SMTP auth email), Pattern 5 (`admins` + `private.is_admin()`), bindings table
- `.planning/research/STACK.md` §5 (auth email: OTP + password, Resend, EN + AR), Turnstile section, Resend/React Email versions
- `.planning/research/FEATURES.md` §B (email OTP), email section, admin MFA row
- `.planning/research/PITFALLS.md` — auth and email pitfalls

### Live facts
- `.planning/phases/01-safe-ground/01-LIVE-AUDIT.md` §2 — `private.is_admin()` body, 35+3 policies, inline storage policy, single `admin_user_id`; counts (3 auth users, 2 profiles)
- `.planning/phases/01-safe-ground/01-CONTROLLER-RUNBOOK.md` — gated live migrations (`apply-live-migrations.yml`), migration guard

### Upstream phases this builds on
- Phase 2 branch `claude/phase-02-execute-19d86a` (until merged): `custom-worker.ts`, `wrangler.jsonc`, `src/server/auth-guards.ts`, `src/server/form-guard.ts`, `src/server/client-ip.ts`, `src/components/security/turnstile-field.tsx`, `src/server/cron-schedule.ts`, `.planning/phases/02-worker-and-r2-media-on-workers-dev/02-CONTEXT.md` (Supabase CAPTCHA off until cutover; crons off until cutover)
- Phase 1.1: `src/lib/admin/action-runner.ts` (`AdminActionEnv.assertAdmin`), `src/lib/audit.ts` (`logAudit`, `logAuditStrict`)
- Phase 6 branch `phase-06-youtube-import-player`: `06-00-PLAN.md`, `06-20-PLAN.md`, `06-RESEARCH.md` A13 — what Phase 6 expects from Phase 5 (see Phase 6 contract below)

### Official docs (verify at implementation)
- supabase.com/docs/guides/auth/auth-email-passwordless, /auth-email-templates, /auth-smtp, /sessions/pkce-flow, /auth-mfa, /auth-mfa/totp, /password-security, /rate-limits
- developers.cloudflare.com/queues (limits, pricing), /workers/platform/limits (5 Cron Triggers on Free)
- resend.com/docs idempotency keys, batch, custom headers; resend.com/docs/send-with-supabase-smtp

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/auth/password-field.tsx` — shared password input with show/hide eye and strength meter; `password-rules.ts` (`PASSWORD_MIN`).
- `src/lib/resend.ts` `sendTransactionalEmail` — hand-rolled fetch; becomes the consumer's sender (or is replaced by the `resend` SDK).
- `src/lib/audit.ts` `logAudit` / `logAuditStrict`; audit table already stores `admin_user_id`.
- `src/lib/admin/action-runner.ts` `AdminActionEnv.assertAdmin(): Promise<{ id }>` — the seam `requireAdmin` plugs into.
- `src/lib/supabase/middleware.ts` `updateSession` (`getClaims`), `src/proxy.ts` (allowlists, `checkIsAdmin`, redirect helpers).
- `src/lib/scheduling.ts` and `src/app/api/cron/publish-scheduled/route.ts` — publish logic and cron auth pattern.
- `rate_limits` table and `withinRateLimit` in `src/app/actions/contact.ts`.

### Established Patterns
- Server actions with zod schemas; service-role client only on the server.
- `next-intl` with `[locale]`; `/auth/callback` and `/api/*` bypass i18n in `src/proxy.ts:130-142`.
- Unit tests: `node --test` in `tests/unit/*.test.ts` with `tests/unit/helpers/fake-supabase.ts`; e2e Playwright in `tests/e2e`; `npm run gate:local` = lint, typecheck, unit, migration guard, build.
- Migrations: expand-only, guarded by `scripts/migration-guard.mjs`; live only via `apply-live-migrations.yml` after Koss approves.

### Integration Points
- `src/proxy.ts` — wall list and admin gate.
- `src/app/[locale]/(viewer)/auth/*`, `src/components/auth/*`, `src/app/auth/callback/route.ts` (+ new confirm route).
- `src/components/profile/account-settings.tsx` — email change, password set/change, notification switch, language sync.
- `src/app/[locale]/admin/layout.tsx`, `actions.ts` `assertAdmin`, `src/app/api/youtube-meta/route.ts`.
- `src/app/actions/contact.ts` — support and newsletter.
- `custom-worker.ts` — add `queue()`; `wrangler.jsonc` — queue producer/consumer, DLQ, one cron.
- `supabase/config.toml` — `[auth]` OTP, MFA TOTP enroll/verify on, templates, SMTP (local Mailpit), `additional_redirect_urls`.

</code_context>

<specifics>
## Specific Ideas

- Sign-in copy: "Sign in or join" / "Enter your email. We'll send you a 6-digit code." (Q1 picture A).
- Admin code page link: "Lost your phone? Contact Koss" (Q7 picture) — final wording at UAT.
- Code email: subject "Your Clickit Story code: 481523" puts the code in the subject (phones show it in the notification). Planning checks Supabase subjects accept `{{ .Token }}` and conditionals; if not, a neutral bilingual subject.

## Phase 6 contract (Phase 6 is planned in parallel and codes against this)
1. `requireAdmin(): Promise<{ id: string; email: string; displayName: string }>` exported from `src/server/auth-guards.ts` (server-only). It enforces: signed in, row in `public.admins`, AAL2 with a TOTP verification younger than 12 h. `adminEnv.assertAdmin` in `src/app/[locale]/admin/actions.ts` delegates to it; `requireAdminUser()` stays (returns the id).
2. Table `public.admins(user_id uuid pk, display_name text not null, added_at, added_by)`; `private.is_admin()` = admins row AND `aal = 'aal2'`.
3. TOTP enrol/verify pages under `/{locale}/admin/mfa` using `supabase.auth.mfa.enroll`, `challenge`, `verify`.
4. Local admin for UAT: `npm run seed:local-admin` (local stack only; refuses any non-local URL) creates an admin user, its `admins` row and a verified TOTP factor, and writes email, password and TOTP secret to `/Users/koss/.clickit-checks/local-admin.env` (outside the repo). A helper `scripts/lib/totp.mjs` computes the current code.
5. Cron budget: Phase 5 adds exactly one Cron Trigger (`0 16 * * *`). With Phase 2's two and Phase 6's one, the account uses 4 of 5.
6. Email queue for later use (e.g. Phase 6's optional "can't play" admin note): `enqueueEmail({ kind, idempotencyKey, to: { userId } | { adminAll: true }, data })` in `src/lib/email/outbox.ts`.

</specifics>

<deferred>
## Deferred Ideas

- Sending newsletters to confirmed subscribers (a future phase; this phase only collects confirmed sign-ups).
- Supabase Pro (daily backups, Supabase's own leaked-password check): pricing decision for Koss (Q17 B).
- In-app admin manager and recovery codes (Q9 B, Q11 B).
- Jev (proposal only): a support-message triage call (spam / real / urgent) before the auto-reply, logged with its confidence; low confidence goes to the admins unchanged. Not built without Koss's word.
- Automation (proposal only): a daily "email health" check that reads the outbox and DLQ (stuck, failed, bounce rate) and emails the two admins only when something is wrong.
- SMS/WhatsApp codes, passkeys, social sign-in.

</deferred>

---

*Phase: 05-accounts-and-email*
*Context gathered: 2026-10-20 (provisional; awaiting Koss's signature through the controller)*
