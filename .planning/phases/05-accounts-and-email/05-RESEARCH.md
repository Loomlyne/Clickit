# Phase 5: Accounts and Email - Research

**Researched:** 2026-10-20
**Domain:** Supabase Auth (email OTP, token-hash links, TOTP MFA, RLS AAL), Resend + React Email, Cloudflare Queues on an OpenNext custom Worker, Postgres outbox, EN/AR email
**Confidence:** MEDIUM-HIGH (GoTrue behaviour read from `supabase/auth` source and Supabase docs; Cloudflare/Resend limits read from official docs; Go-template, Workers-bundle and RTL-email items are flagged for a Wave 0 spike)

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md status: **PROVISIONAL**. Every D-xx tagged `(Qn)` is the recommended option of a question that went to the controller as `NEEDS KOSS:`. Plans are written against them; nothing executes before Koss signs. A different answer replaces that D-xx and the plans named in `05-DISCUSS-QUESTIONS.md`.

### Locked Decisions (copied from CONTEXT.md `<decisions>`)

**The wall (AUTH-01)**
- **D-01 (Q2):** Open without an account: the landing page (`/` forwards to `/portfolio`), `/privacy`, `/terms`, `/legal/*`, every `/auth/*` page and route, `/support`, and `/coming-soon` while coming-soon mode is on. Everything else (Browse, series, watch, My List, Profile, About, updates, design-system, admin) sends a signed-out visitor to `/{locale}/auth?next=<path>`. `/api/*` keeps its own checks (cron secret, signed links).
- **D-02:** The admin setting "Skip sign-in" (`app_config.auth_allow_skip`, `config.authAllowSkip`, the `/watch` skip branch in `src/proxy.ts`, the skip link on `/auth`) is removed from code and from the Settings screen. The column stays until the Phase 8 contract step (expand/contract; no destructive migration here).
- **D-03 (Q4):** When `next` points at a show (`/series/<slug>`) or an episode, `/auth` shows that show's poster and title ("Sign in to watch <Show>"), and `generateMetadata` on `/auth` emits that show's Open Graph title and poster, so link previews (WhatsApp, X) keep working through the redirect without any user-agent sniffing. No episode data or YouTube ID is exposed.
- **D-04:** `next` stays validated by the existing `getSafeAuthNextPath` / `safeNext`; after any successful sign-in the viewer lands on `next` (admins without `next` land on `/admin`).

**Signing in and joining (AUTH-02, AUTH-03)**
- **D-05 (Q1):** One screen, code first: email -> "Send code" -> six code boxes on the same screen; "Use a password instead" swaps in the password field (the shared `PasswordField` with its right-side show/hide eye). "Create account" with a password stays available behind the password path. The old two-tab `AuthPanel` goes.
- **D-06:** Code sign-in uses `signInWithOtp({ email, options: { shouldCreateUser: true, data: { locale }, captchaToken } })` and `verifyOtp({ email, token, type: 'email' })` in server actions. The Magic Link and Confirm-signup templates contain `{{ .Token }}` so the email carries a 6-digit code. Code length stays 6.
- **D-07:** The code input accepts paste of the whole code, iOS/Android one-time-code auto-fill (`autocomplete="one-time-code"`, `inputmode="numeric"`), and Arabic-Indic and Extended Arabic-Indic digits, normalised to 0-9 on client and server. Resend is offered after 60 s with a visible countdown (Supabase's own per-user window).
- **D-08 (Q3):** A brand-new viewer (no `profiles.display_name` yet, or `onboarded_at` null) gets one step after the first code: "What should we call you?" plus the line "By continuing you agree to the Terms and Privacy Policy" (links). Saving sets `display_name` and `onboarded_at`, then goes to `next` or Browse.
- **D-09:** "Add a password later": Profile shows "Set a password" when the account has none and "Change password" when it has one. Clickit records `profiles.password_set_at` (set by password sign-up, set, change and reset). Existing accounts are backfilled with `password_set_at = created_at`.
- **D-10 (Q5):** Codes and email links work for 15 minutes (Supabase "Email OTP expiration" = 900 s, one setting for all of them; owner step). Templates and UI copy say "15 minutes".
- **D-11 (Q17):** Leaked passwords are refused by Clickit itself: every server action that sets a password (password sign-up, set, change, reset) checks the Have I Been Pwned range API (k-anonymity, SHA-1 prefix of 5 hex chars, `Add-Padding: true`) before calling Supabase, with a 3 s timeout that fails OPEN with a logged warning. Minimum length stays 8. Supabase's Pro-only check is not assumed.

**Email links that work on another device (AUTH-04)**
- **D-12:** Every auth email link uses the token-hash pattern: `{{ .SiteURL }}/{locale}/auth/confirm?token_hash={{ .TokenHash }}&type=<signup|recovery|email_change|email>&next=<path>` (exact path decided in planning; the route must bypass i18n like `/auth/callback`). A new `/auth/confirm` route calls `verifyOtp({ token_hash, type })` server-side, so no PKCE verifier is needed and the link works in any browser. `/auth/callback` (PKCE `exchangeCodeForSession`) stays for compatibility only.
- **D-13:** Recovery: the confirm route signs the visitor in on the device that opened the link and sends them to `/auth/reset-password`. Email change keeps Supabase "Secure email change" (both addresses confirm); each link works on its own device and the UI says which step is still pending.
- **D-14:** Password sign-up requires email confirmation (owner step: "Confirm email" on). Code sign-up confirms by the code itself.

**Language of emails (MAIL-01)**
- **D-15 (Q6):** An email's language is the language the viewer last used on the site. Clickit stores it as `profiles.locale` ('en'|'ar') and mirrors it to `auth.users.user_metadata.locale` (sign-up/OTP `options.data`, and a server action on every language switch while signed in). Auth templates branch on `{{ .Data.locale }}`; a missing value means English. App emails read `profiles.locale`.

**Admins (AUTH-05, AUTH-06, AUTH-07)**
- **D-16:** New table `public.admins (user_id uuid primary key references auth.users on delete cascade, display_name text not null, added_at timestamptz not null default now(), added_by uuid null references auth.users)`, RLS on, no policies. Seeded from `app_config.admin_user_id`. `private.is_admin()` keeps its name and signature; its body becomes "a row in `admins` for `auth.uid()` AND `(auth.jwt() ->> 'aal') = 'aal2'`". The one storage policy that checks admin inline (`Admin manage site-assets`) is rewritten to call `private.is_admin()`. `app_config.admin_user_id` stays (unused) until the Phase 8 contract.
- **D-17:** One server-only `requireAdmin()` decides admin everywhere (proxy, admin layout, `assertAdmin` in `src/app/[locale]/admin/actions.ts`, `requireAdminUser` in `src/server/auth-guards.ts`, `/api/youtube-meta`). It returns `{ id, email, displayName }` or throws a typed error: not signed in, not an admin, needs TOTP enrolment, needs TOTP code. `requireAdminUser()` stays as a thin wrapper returning the id.
- **D-18 (Q7):** Before any admin screen renders, an admin without a verified TOTP factor goes to a full-page enrol step (QR + manual key, then code); an admin at AAL1 goes to a full-page "Enter your authenticator code" step. Uses `supabase.auth.mfa.enroll / challenge / verify` and `getAuthenticatorAssuranceLevel`.
- **D-19 (Q8):** The admin re-enters the code at every admin sign-in and again when the session's TOTP verification (`amr` entry `totp`, its timestamp) is older than 12 hours. One constant `ADMIN_MFA_MAX_AGE_HOURS = 12`.
- **D-20 (Q9):** Each admin is asked to enrol a second authenticator at setup. If both are lost, Koss removes the factor with one numbered owner step (dashboard: Authentication > Users > factor delete), and the admin enrols again on next sign-in. No in-app recovery codes.
- **D-21 (Q10):** Exactly two live admins: Issam and Nejib. Koss is not an admin on live.
- **D-22 (Q11):** Admins are added or removed only through one numbered owner step (a reviewed SQL statement run by Koss; UUIDs never committed). `/admin` gets a read-only "Admins" list: name, email, authenticator set up yes/no, last sign-in.
- **D-23:** The audit log already stores `admin_user_id`; the admin audit screen shows the admin's `display_name` from `admins`. TOTP enrol/unenrol and admin sign-in failures are audited (new entity `admin_auth`).

**Closing the anon YouTube function (AUTH-08)**
- **D-24:** `revoke execute on function public.get_public_youtube_video_id(uuid) from anon` (and from `public`), keep `authenticated`. Every caller already runs signed in after the wall; planning confirms there is no anon caller (watch pages, shorts).

**Auth emails (MAIL-01)**
- **D-25:** Auth emails go Supabase Auth -> custom SMTP `smtp.resend.com:465` (user `resend`, a Resend API key used only by Supabase) -> viewer. No Send Email Hook. Sender `Clickit Story <no-reply@clickitstory.ae>`. Owner steps: SMTP settings, raise the auth email rate limit from the custom-SMTP default of 30/hour, OTP expiry (D-10), Confirm email on (D-14), Secure email change on.
- **D-26:** The five templates (Confirm signup, Magic Link/OTP, Reset password, Change email, Reauthentication) and their subjects are authored in the repo with React Email (`src/emails/auth/*`), exported to static HTML with Go placeholders kept as literal text, committed under `supabase/templates/`, and wired into `supabase/config.toml` `[auth.email.template.*]` for the local stack. Live: Koss pastes or pushes them (owner step). A unit test fails if a template lacks its required placeholder or the AR branch.
- **D-27 (Q12):** Look of every email: black header band with the Clickit Story logo, white body, yellow (#ffcc00) pill button with black text, code in large monospaced digits, footer "Clickit Story · Spacelight Studios FZ LLC, Abu Dhabi" with the Support link; AR version `dir="rtl"`; plain-text part on every email; no tracking links or pixels. The signed Phase 4 canvas overrides this if it differs.

**App emails and the queue (MAIL-03..07)**
- **D-28:** Outbox in Postgres plus a Cloudflare Queue. Every app email is first inserted into `public.email_outbox` with a unique `idempotency_key`, status `pending`. Then a small message `{ outboxId }` goes to Queue `clickit-email` (binding `EMAIL_QUEUE`, DLQ `clickit-email-dlq`). The consumer (`queue()` in `custom-worker.ts`) loads the row, renders EN/AR, sends through Resend with header `Idempotency-Key = idempotency_key`, marks `sent` with the Resend id, or `retry()`s with backoff on 429/5xx; after max retries the row is `failed` and the message lands in the DLQ. Recipient addresses are read from the database in the consumer, never stored in queue messages.
- **D-29:** A sweep re-enqueues outbox rows still `pending` after 15 minutes or `retrying` past their next-attempt time. It runs inside the single Phase 5 cron (D-34).
- **D-30 (MAIL-03):** Welcome: claimed once with `update profiles set welcome_sent_at = now() where id = $1 and welcome_sent_at is null returning id` on the first verified sign-in (OTP verify, confirm link, or first password sign-in after confirmation), then outboxed. Existing accounts are backfilled `welcome_sent_at = now()`.
- **D-31 (Q13, MAIL-05):** Support: the contact action saves the message, then outboxes an auto-reply to the sender (in the page's language) and one admin copy per row in `admins` to that admin's sign-in email, `Reply-To` = the sender. Replaces the direct `sendTransactionalEmail` call in `src/app/actions/contact.ts`.
- **D-32 (MAIL-06):** Newsletter double opt-in: a sign-up creates or refreshes the row as `pending` with a confirm link (HMAC-signed, 7-day expiry, secret `EMAIL_LINK_SECRET`); clicking it sets `confirmed_at` and `status = 'active'`. The current "New newsletter signup" admin notification is dropped. Rate limit and Turnstile as today.
- **D-33 (Q16):** Existing newsletter rows are kept and marked `confirmed_at = null` (legacy, not confirmed); nothing is sent to them.
- **D-34 (Q14, Q15, MAIL-04):** Digest: one Cron Trigger `0 16 * * *` (20:00 Dubai) runs the digest and the outbox sweep. It selects episodes that became visible to viewers (status `published`, or `coming-soon` with `publish_at <= now()`) since the previous successful digest run (`digest_runs` table; first run looks back 24 h), groups them per viewer whose `watchlist` holds the show, whose `profiles.notify_new_episodes` is true (default true) and whose email is confirmed, and outboxes one email per viewer per Dubai date. No new episodes, no email.
- **D-35 (MAIL-04):** Unsubscribe: every digest carries an HMAC-signed link (`/api/email/unsubscribe?u=<user>&k=digest&t=<sig>`, no sign-in) plus `List-Unsubscribe: <https://...>, <mailto:...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (planning verifies Resend passes the Post header). GET shows a confirm page with one button; POST flips `notify_new_episodes = false`. Profile has the same switch.
- **D-36:** Resend account is Koss's Pro account; the Worker reads `RESEND_API_KEY` and `EMAIL_LINK_SECRET` (Worker secrets). Supabase gets its own Resend key for SMTP. All keys are owner steps in his terminal; none in files.

**Abuse controls**
- **D-37:** Turnstile (Phase 2 widget) guards Send code, password sign-in, password sign-up and reset; the token goes to Supabase as `captchaToken` (Supabase CAPTCHA, enabled at the Phase 3 cutover). Contact and newsletter keep Phase 2's siteverify guard. Supabase rate limits are owner steps; Clickit's own rate limiter (`CF-Connecting-IP`, Phase 2) also wraps send-code and newsletter.

### Claude's Discretion (copied)
- Exact table/column names beyond those fixed above, migration split (expand-only migrations; each one passes the Phase 1 guard and goes through `apply-live-migrations.yml` after Koss approves).
- React Email component structure, copy wording (Koss reviews copy at UAT), plain-text rendering.
- How the producer reaches `EMAIL_QUEUE` in `next dev`/unit tests (an in-process fake consumer behind the same interface).
- Whether the Admins list is its own page or a Settings section (read-only either way).
- Local test harness: local Supabase stack with Mailpit for auth emails, a fake Resend for app emails, a local TOTP helper (`node:crypto`, RFC 6238) for admin tests.

### Deferred Ideas (OUT OF SCOPE) (copied)
- Sending newsletters to confirmed subscribers (a future phase; this phase only collects confirmed sign-ups).
- Supabase Pro (daily backups, Supabase's own leaked-password check): pricing decision for Koss (Q17 B).
- In-app admin manager and recovery codes (Q9 B, Q11 B).
- Jev (proposal only): a support-message triage call before the auto-reply. Not built without Koss's word.
- Automation (proposal only): a daily "email health" check that reads the outbox and DLQ. Not built without Koss's word.
- SMS/WhatsApp codes, passkeys, social sign-in.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Every page except landing and legal requires a signed-in viewer | Wall list + pure `isPublicPath()`; proxy has `getClaims()` already; F1 shows the anon cached-query hole that must be closed with the wall |
| AUTH-02 | Sign in or create account with a 6-digit email code | `signInWithOtp`/`verifyOtp({type:'email'})` verified in types and GoTrue source; both Confirm-signup and Magic-link templates must carry `{{ .Token }}`; `options.data` applies to NEW users only (F3) |
| AUTH-03 | Email + password still work; add a password later | OTP-created users already have a random GoTrue password (`HasPassword()` true), so `profiles.password_set_at` is the only truthful flag; HIBP check in server actions |
| AUTH-04 | Reset / confirm / email-change links work on another device | `/auth/confirm` + `verifyOtp({token_hash,type})` (official SSR pattern); button interstitial to survive link scanners (F2); email-change first link returns no session (F2) |
| AUTH-05 | Two admin accounts, both see everything | `admins` table + `requireAdmin()`; admin writes already use the service-role client, so app-layer check is the real gate and RLS is defence in depth |
| AUTH-06 | Admins pass TOTP to enter `/admin` | `mfa.enroll/challenge/verify` signatures, `amr` shape, 12 h rule, enrol/verify page placement (F10) |
| AUTH-07 | Audit log names the admin | `admin_audit_log.admin_user_id` exists; join `admins.display_name`; add `admin_auth` entity |
| AUTH-08 | Leaked-password protection on; anon YouTube-ID function closed | HIBP range API verified; **revoking anon EXECUTE breaks four cached catalog queries unless they move off the anon client (F1)** |
| MAIL-01 | Branded auth emails from Resend in EN/AR | Resend SMTP; Go-template localisation; export pipeline with sentinels (F18); `RedirectTo` vs `SiteURL` |
| MAIL-03 | One welcome email after confirming | Atomic claim+outbox RPC; profile row may be missing (3 auth users, 2 profiles live) |
| MAIL-04 | Dubai-evening digest, profile switch, one-click unsubscribe | No "became visible" timestamp exists (F5); Resend passes `List-Unsubscribe-Post` via `headers`; drop `mailto:` (F6) |
| MAIL-05 | Support auto-reply + admin copy | Outbox kinds; abuse caps on auto-reply (F17); `Reply-To` |
| MAIL-06 | Newsletter double opt-in | `status` check constraint must be widened (F14); HMAC with WebCrypto |
| MAIL-07 | Queue, never twice, retried | Outbox lease + Resend `Idempotency-Key` (24 h window, 409 semantics, F8); Queue Free limits; per-message `ack()` |
</phase_requirements>

## Summary

The CONTEXT design is sound and buildable on the stack as installed (supabase-js 2.101.0, @supabase/ssr 0.10.0, Next 16.2.9; every API Phase 5 needs exists in these versions). Research found **seventeen points that change or qualify a locked decision**; the three that can break production if planned as written are: **(F1)** D-24's "no anon caller" is false at the client level (four `unstable_cache` catalog queries read `episodes_view` through the anon-key `createPublicClient()`, and a `security_invoker` view requires the *caller* to hold EXECUTE on functions in its select list, so revoking anon breaks the series page, watch sibling list and rails); **(F3)** `signInWithOtp` ignores `options.data` for an existing confirmed user, so D-15's locale mirror needs `updateUser`/admin writes and the first code email of a pre-existing Arabic user is English; **(F10)** the MFA pages cannot live under `/admin/mfa` without a layout recursion unless the whole admin tree is moved into a route group, which would silently un-gate any file Phase 6 adds in parallel.

The email pipeline is feasible on Workers Free. Queues are on Free (10,000 operations/day, 24 h retention), a Cron Trigger fits (Phase 2 uses 2 of 5, Phase 6 plans 1, this phase 1), and Resend passes `List-Unsubscribe-Post` and honours `Idempotency-Key` for 24 h. Free-plan **subrequest (50) and CPU (10 ms) limits** shape the design: set-based Postgres RPCs, consumer `max_batch_size` 5, and no email rendering inside HTTP request handlers.

Live-database sequencing matters: apply the additive migration first, deploy code, have both admins enrol TOTP, and only then apply the migration that makes `private.is_admin()` require AAL2 and the one that revokes anon EXECUTE. Otherwise the admin loses RLS-gated reads, or anonymous catalog reads break, between steps.

**Primary recommendation:** Build three pure, relative-import-only modules first (`src/server/email/outbox-consumer.ts`, `src/server/admin-access.ts`, `src/server/auth/otp.ts`) with injected ports and node:test coverage, put the database behaviour behind set-based SECURITY DEFINER RPCs proven in a scratch database, and split the live migrations into M1 additive, M2 admin/AAL2, M3 anon revoke, applied in that order around the code deploy.

## Findings that change or qualify CONTEXT decisions

| # | Decision | Finding | Recommendation | Confidence |
|---|----------|---------|----------------|------------|
| F1 | D-24, AUTH-08 | `episodes_view` is `security_invoker` and its `youtube_video_id` column is `public.get_public_youtube_video_id(e.id)` (`20260619000000`). PostgreSQL requires the *querying* role to hold EXECUTE on functions a view calls [CITED: postgresql.org/docs/current/sql-createview.html]. `getNewEpisodes`, `getEpisodesByShowId`, `getEpisodesBySeasonId`, `getComingSoonEpisodes` in `src/lib/queries.ts` use `createPublicClient()` (anon key, no session) inside `unstable_cache`, even for signed-in visitors. `getEpisodeById` and `getContinueWatchingEpisodes` use the session client (role `authenticated`) and are fine. Callers of the function itself: none in `src/`. | Add server-only `createCatalogClient()` (service role) and switch only those four queries to it; revoke EXECUTE from `public, anon` and SELECT on `episodes_view` from `anon` in M3; keep `authenticated`. `service_role` keeps its default grant (verify with `has_function_privilege` in the scratch DB). | HIGH (code + PG docs); privilege outcome verified by Wave 0 DB test |
| F2 | D-12, D-13 | Link scanners (e.g. Microsoft Defender Safe Links) pre-fetch GET links and burn the token [CITED: supabase.com/docs/guides/auth/auth-email-templates "Email Prefetching"]. The official `/auth/confirm` GET handler verifies on GET. Also, first click of a double-confirm email change returns HTTP 200 `{msg, code}` with NO session; supabase-js then returns `{user: undefined, session: undefined}` and no error [VERIFIED: auth `verify.go` + installed `GoTrueClient.verifyOtp`]. | `/{locale}/auth/confirm` is a **page** that shows a "Continue" button; a server action does `verifyOtp`. A root `src/app/auth/confirm/route.ts` only 302s to `/{locale}/auth/confirm` with the same query (locale from cookie). Email change: "no error and no session" = "first of two accepted, confirm the other inbox". Set `referrer: 'no-referrer'` metadata on the page. | HIGH |
| F3 | D-15 | For an existing confirmed user `MagicLink` ignores `params.Data`; `Data` is used only in the sign-up path [VERIFIED: auth `magic_link.go`]. Template `.Data` is `user.UserMetaData` [VERIFIED: auth `templatemailer.go`]. | New users: pass `data:{locale}`. Existing users: set `user_metadata.locale` via `updateUser({data})` after every verified sign-in and on language change (see Pattern 7). A pre-existing Arabic user's first code email is English until then; if Koss wants strict behaviour, add a service-role RPC that updates `raw_user_meta_data.locale` by email just before sending (silent, no enumeration signal). `eq` on a missing key is false in modern Go templates [CITED: go.dev issue #45982]; still prove it on the local stack with a no-locale user. | HIGH / MEDIUM |
| F4 | D-20 | Dashboard factor removal is not documented; the documented route is `auth.admin.mfa.deleteFactor({id,userId})` (present, marked experimental, in installed auth-js) [VERIFIED: types.d.ts; CITED: supabase.com/docs/reference/javascript/auth-admin-mfa-deletefactor]. Deleting a verified factor signs the user out of all sessions. `friendly_name` must be unique per user; an abandoned unverified factor blocks re-enrol with the same name until it expires; verifying any factor deletes the user's other unverified factors of that type [VERIFIED: auth `mfa.go`]. | Owner step = `node scripts/admin-remove-factor.mjs <email>` (service-role key from Koss's terminal env, lists then deletes with confirmation). Enrol UI: unenrol leftover unverified factors first and use a unique `friendlyName` (`Authenticator <random4>`). | HIGH |
| F5 | D-34 | No column records when an episode became visible: `publish-scheduled` only flips `status`, `publish_at` is the schedule, `updated_at` moves on any edit. "Since the previous run" cannot be queried. A partial digest run followed by a retry on the next Dubai date would also re-send the same episodes (idempotency key includes the date). | Add `episodes.live_at timestamptz` (trigger-maintained, not in the client column grants, backfilled `least(coalesce(publish_at, created_at), now())`) and a ledger `public.notification_sends(user_id, episode_id, kind)` unique per pair, inserted in the same set-based RPC that creates the outbox rows. Digest = live episodes with `live_at > last_success` and not in ledger. `digest_runs` stays for the window. | HIGH |
| F6 | D-35 | Resend's one-click guidance is https-only; a `mailto:` target needs a mailbox and there is none (no Zoho yet). | Header = `List-Unsubscribe: <https://www.clickitstory.ae/api/email/unsubscribe?...>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Drop the `mailto:`. Endpoint: POST returns 200 with empty body, GET 303s to a public page with one button. [CITED: resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails] | HIGH |
| F7 | D-37 | Supabase auth rate limits are **per IP** (sign-in/up/OTP/recover 30 per 5 min; verify 30 per 5 min; token 150 per 5 min; MFA verify 15/min, not configurable) [CITED: supabase.com/docs/guides/auth/rate-limits]. Every server-action call reaches Supabase from the Worker's egress address, so these become site-wide caps. | Owner step: raise `rate_limit_otp`, `rate_limit_verify`, sign-in and token limits to launch-appropriate numbers (agree the numbers with Koss; do not invent). Keep Clickit's per-IP and per-email limiters in front. Treat "egress IP is shared" as `[ASSUMED]` until observed (`over_request_rate_limit` in Auth logs). | MEDIUM |
| F8 | D-28 | Resend idempotency keys live 24 h; same key + different payload = 409 `invalid_idempotent_request`; in flight = 409 `concurrent_idempotent_requests` [CITED: resend.com/docs/dashboard/emails/idempotency-keys]. Cloudflare Free queue retention is 24 h, non-configurable. | Outbox row is authoritative. Consumer claims with a lease (`status='sending'`, `lease_until`). Never re-send a row whose first attempt is older than 23 h (mark `failed` for a human). 409 invalid_idempotent_request on a retry = treat as already sent (`sent`, `provider_id` null, logged). Mark the row `failed` and `ack()` on the last attempt (DB, not the DLQ, is the record); DLQ catches crashes. | HIGH |
| F9 | D-28 | Workers Free: 50 subrequests and 10 ms CPU per invocation (HTTP and Cron); the Queues page gives consumer CPU 30 s default but the Workers limits page states nothing for consumers [CITED: developers.cloudflare.com/workers/platform/limits, /queues/platform/limits]. | Consumer `max_batch_size: 5`; one `claim_outbox(ids)` RPC (joins `auth.users` for the address) and one `finish_outbox(...)` RPC per batch (about 2 + n subrequests); digest and sweep are single RPCs plus `sendBatch` (≤100). Render emails only in the consumer. Record CPU in the PLAT-09 report; Workers Paid stays Koss's priced call. | MEDIUM |
| F10 | D-18, Phase 6 contract 3 | `admin/layout.tsx` is the gate. A page at `/admin/mfa` would sit under it (aal1 admin -> redirect to `/admin/mfa` -> layout redirects again). Escaping the layout needs a route group `(console)` and moving every admin page, and Phase 6 is adding admin pages under the old paths in parallel: moved layout + unmoved new pages = **new admin pages with no gate**. | Put the pages at `/{locale}/auth/mfa` (inside the already-public `/auth/*` allowlist, in the viewer layout, requires a session). Proxy: signed-in aal1 on `/admin/*` -> redirect `/{locale}/auth/mfa?next=...`. Admin layout and every action call `requireAdmin()`. Nothing in Phase 6 plans depends on the `/admin/mfa` URL (grepped `06-*`). Needs Koss's OK as a contract deviation. | HIGH |
| F11 | D-16 | `private.is_admin()` requiring AAL2 is applied to live RLS and storage policies at once. If it lands before both admins have enrolled TOTP on the deployed Worker, every RLS-gated admin read returns empty. | Split migrations (see Migration plan): M1 additive; code deploy; both admins enrol; M2 `is_admin` + storage policy; M3 anon revoke after the catalog-client code is live. | HIGH |
| F12 | local config | `supabase/config.toml` today: `[auth.rate_limit] email_sent = 2`, `enable_confirmations = false`, `minimum_password_length = 6`, `otp_expiry = 3600`, `[auth.mfa.totp] enroll_enabled = false, verify_enabled = false`, `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]` (https, no wildcard). All of these break local Phase 5 tests. | Set: `email_sent = 1000`, `enable_confirmations = true`, `minimum_password_length = 8`, `otp_expiry = 900`, `max_frequency = "60s"` (or 1s with a unit test for the countdown), `enroll_enabled = true`, `verify_enabled = true`, `site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/**","http://127.0.0.1:3000/**"]`, and the five `[auth.email.template.*]` blocks. A redirect URL whose scheme+host+port equal the Site URL is always valid; otherwise it must match the allow-list *including its query string* [VERIFIED: auth `request.go` `IsRedirectURLValid`]. | HIGH |
| F13 | D-26 | `supabase config push` pushes every property the local `config.toml` declares (site_url, otp_expiry, rate limits...) to the linked project. With the local values above it would overwrite live. | Do NOT use `config push`. Owner pastes the five templates and subjects in the dashboard; ship a read-only `scripts/auth-config-check.mjs` (GET `config/auth` with Koss's access token from his terminal) that diffs live templates, OTP expiry, SMTP host, rate limits, MFA flags against the repo. | HIGH |
| F14 | D-32 | `newsletter_subscribers.status` has `check (status in ('active','paused','unsubscribed'))` (`20260429010000`), so `'pending'` fails. | Widen the constraint in M1: `alter table ... drop constraint if exists newsletter_subscribers_status_check; -- safe-drop: widened with 'pending' on the next line`, then `add constraint ... check (status in ('pending','active','paused','unsubscribed'))`. Legacy rows keep `status='active'`, `confirmed_at null`; any future send selects `confirmed_at is not null`. | HIGH |
| F15 | D-09 | `signInWithOtp` creates new users with a random 33-char password (`magic_link.go`), so GoTrue's `HasPassword()` is true for them; `UpdatePasswordRequireCurrentPassword` (if ever switched on) would then block "Set a password" for OTP users; `UpdatePasswordRequireReauthentication` ("Secure password change") needs a nonce only when the session is older than 24 h [VERIFIED: auth `user.go`]. | Keep "Require current password" OFF (owner readback). Treat `reauthentication_needed` from `updateUser` as the trigger for the Reauthentication email + 6-digit nonce step (this is the only way that fifth template is ever sent). `password_set_at` stays Clickit's own flag. | HIGH |
| F16 | D-26 | Subjects are parsed by the same Go engine as bodies (`html/template`), so `{{ if eq .Data.locale "ar" }}` and `{{ .Token }}` work in subjects; only interpolated values are HTML-escaped, literal text is not [VERIFIED: auth `template.go`]. | Subject text can carry the code and the locale branch. Never interpolate user-chosen strings (display name) into a subject. | MEDIUM-HIGH |
| F17 | D-31 | The support form sends an auto-reply to an address typed by an anonymous visitor: a mail-bombing / backscatter vector. | Auto-reply body is static (no echo of the visitor's message), idempotency key `support_ack:<msg>`, plus a per-recipient cap (≤ 3 per normalised address per 24 h, enforced in the enqueue RPC; over the cap the message is saved and the auto-reply skipped). Same cap for newsletter confirm (one per address per 10 min). Strip CR/LF from any user text used in subject or `Reply-To`. | HIGH |
| F18 | D-12, D-26 | `{{ .RedirectTo }}` is always non-empty (valid `redirect_to`, else an allow-listed Referer, else Site URL) [VERIFIED: auth `GetReferrer`]. `{{ .SiteURL }}` is the production URL only, so it breaks workers.dev UAT and localhost. Reauthentication has only `SiteURL, Email, Token, Data` (no `TokenHash`, no `RedirectTo`) [VERIFIED: `templatemailer.go`]. | Server actions always pass `emailRedirectTo = <site origin>/<locale>/auth/confirm?next=<encoded safe path>`; templates build links as `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=...` (RedirectTo always has `?next=` so `&` is valid; the fallback Site URL case lands on the root redirector which tolerates a missing `next`). Production Site URL must be set (owner step); workers.dev UAT needs an exact allow-list entry removed afterwards. | HIGH |
| F19 | D-26, D-28 | React Email emails are JSX. The consumer lives in `custom-worker.ts`, bundled by wrangler/esbuild, whose JSX handling follows `tsconfig` (`jsx: "preserve"` in a Next app breaks it). Next-intl is unavailable outside Next. | Compile the email components with a dedicated `src/emails/tsconfig.json` (`"jsx": "react-jsx"`) that the Worker build uses, OR pre-render at build (`npm run emails:build` writes `src/emails/generated/*.ts` HTML strings with `{{var}}` slots) so the Worker ships no `react-dom`. Prefer the pre-render route if the Wave 0 bundle/CPU spike shows `render()` over budget. Email strings live in `src/emails/messages/{en,ar}.ts`, not in next-intl catalogs. | MEDIUM |
| F20 | Phase 6 contract | `requireAdmin()` returning `{id,email,displayName}` is a superset of Phase 6's assumed `{ id }` (A13), good. Today `assertAdmin()` returns the whole Supabase user and callers use `user.id`; keep `.id`. `seed:local-admin` and `scripts/lib/totp.mjs` are in the contract and are Wave 0 deliverables. | Match the contract, except the MFA URL (F10). | HIGH |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wall (signed-out redirect) | Frontend Server (`proxy.ts`) | API/Backend (pages re-check) | Cheap claims check in proxy; pages and actions must not rely on proxy alone |
| OTP / password / reset / confirm | API/Backend (server actions + confirm page) | Supabase Auth | Captcha, HIBP, locale, redirect URL all need server context; browser `supabase.auth.*` calls go away |
| Code input UX (paste, autofill, Arabic digits) | Browser | API (re-normalise) | Client convenience, server is the authority |
| Admin decision (`requireAdmin`) | API/Backend | Database (`private.is_admin()` AAL2) | App check is the real gate (actions use service role); RLS is defence in depth |
| TOTP enrol/verify | API/Backend (server actions calling Supabase MFA) | Browser (QR display) | Cookies must be set server-side after `verify` |
| Locale mirror | API/Backend (server action) | Browser (trigger on locale change) | `updateUser` needs the session cookie |
| Outbox + dedupe + welcome claim | Database (SECURITY DEFINER RPCs) | API/Backend | Atomic claim+insert; set-based work keeps Worker CPU and subrequests low |
| Queue producer | API/Backend (Worker binding) | Database (sweep re-enqueues) | Queue is a trigger; Postgres is the record |
| Queue consumer / Resend send | Worker `queue()` | Database (claim/finish RPCs) | Only place that renders and sends app email |
| Digest + sweep | Cron Trigger -> internal route | Database (one RPC) | Reuses Phase 2 cron dispatch and `CRON_SECRET` |
| Auth emails | Supabase Auth -> Resend SMTP | Repo (templates as source) | Keeps sign-in alive if the Worker is down |
| Unsubscribe / newsletter confirm | API route + public page | Database | Signed, login-free, idempotent |
| Catalog reads for cached pages | API/Backend (service-role catalog client) | Database (view + grants) | Anon must not reach YouTube IDs (F1) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.101.0 installed (latest 2.118.0) | Auth OTP, MFA, admin API | All needed APIs exist in the installed version [VERIFIED: node_modules types]. Upgrade is Phase 2's call, not required here |
| `@supabase/ssr` | 0.10.0 installed (latest 0.12.7) | Cookie sessions in actions/proxy | Already wired in `src/lib/supabase/*` [VERIFIED: package.json] |
| `resend` | 6.34.1 (npm, 2026-10-16) | App email from the queue consumer | Fetch-based, `idempotencyKey` option, typed errors; documented Workers use [CITED: resend.com/docs/send-with-cloudflare-workers via STACK.md] |
| `react-email` | 6.11.3 (npm, 2026-10-16) | Templates, `render()`, plain text | Single v6 package; `@react-email/components` is deprecated on npm [VERIFIED: npm view deprecated] |
| `@react-email/render` | 2.1.1 | Lighter `render` entry if `react-email` root drags CLI deps into the Worker bundle | Has a `worker` export condition (browser build) [VERIFIED: npm view exports] |
| `@marsidev/react-turnstile` | 1.6.2 (Phase 2 installs) | Widget | Phase 2 owns it |
| `zod` | 4.3.6 installed | Input schemas | Existing pattern |
| Cloudflare Queues | platform | Email trigger | Free plan: 10,000 ops/day, 24 h retention [CITED: developers.cloudflare.com/queues/platform/pricing] |
| `wrangler` / `@opennextjs/cloudflare` | 4.151.3 / 1.20.12 (Phase 2 pins) | Queue config, custom worker | Phase 2 owns versions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/ui` | 6.11.3 (dev, `-E`) | `email dev` preview | Local preview only, never imported by the app |
| Node `node:crypto` / WebCrypto | built-in | TOTP test helper, SHA-1 for HIBP, HMAC-SHA256 links | No dependency needed |
| `@playwright/test` | 1.58.2 installed | Cross-context e2e | Browsers installed (`chromium-1248`) |
| Supabase CLI | 2.119.0 global (repo devDep 2.107.0) | Local stack, GoTrue v2.197.0, Mailpit v1.31.3 | Local stack is up on the Mac |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend SDK | Hand-rolled `fetch` (current `src/lib/resend.ts`) | Fewer bytes, but loses typed errors/batch; keep behind a `Mailer` port so either works |
| SMTP for auth mail | Send Email Hook | Hook would let auth mail share React components but makes sign-in depend on the Worker (rejected in D-25) |
| Pre-rendered HTML strings | `render()` in the consumer | Pre-render avoids `react-dom` in the Worker; decide after the Wave 0 spike |

**Installation (when plans run, not now):**
```bash
npm install resend@6.34.1 react-email@6.11.3
npm install -D @react-email/ui@6.11.3 -E
```

**Version verification:** `npm view` run 2026-10-20: resend 6.34.1, react-email 6.11.3, @react-email/render 2.1.1, @react-email/ui 6.11.3, @marsidev/react-turnstile 1.6.2, wrangler 4.151.3, @opennextjs/cloudflare 1.20.12, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| resend | npm | since 2017-02 (name) | not queried | github.com/resend/resend-node | [OK] | Approved |
| react-email | npm | since 2016-05 | not queried | github.com/resend/react-email | [OK] | Approved |
| @react-email/render | npm | since 2022-09 | not queried | github.com/resend/react-email | [OK] | Approved |
| @react-email/ui | npm | 2026-04 | not queried | github.com/resend/react-email | [OK] | Approved (dev only) |
| @marsidev/react-turnstile | npm | n/a | n/a | n/a | [OK] | Approved (Phase 2 installs) |
| @opennextjs/cloudflare, wrangler | npm | n/a | n/a | n/a | [OK] | Approved (Phase 2 installs) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
`npm view <pkg> scripts.postinstall` returned nothing for resend, react-email, @react-email/render, @react-email/ui. slopcheck was run as `slopcheck scan` on a probe `package.json` in the scratchpad (nothing installed). Package names come from the project's own STACK.md research and vendor docs, and all matched on the correct (npm) registry. `react-email` has heavy install-time dependencies (socket.io, esbuild, tailwindcss) that must not end up in the Worker bundle; checked in the Wave 0 spike.

## Architecture Patterns

### System Architecture Diagram

```
 Browser (viewer / admin)                           Email clients (any device)
   | HTML, server actions                              ^ link/code             ^ digest, welcome, support, confirm
   v                                                   |                       |
 Worker "clickit"  (custom-worker.ts)             Resend SMTP (smtp.resend.com:465)   Resend REST (Idempotency-Key)
 +-----------------------------------------+            ^                          ^
 | fetch -> OpenNext -> proxy.ts           |            | auth mail                | send
 |   wall: getClaims -> public? / aal2?    |       Supabase Auth (GoTrue)           |
 |   /auth/confirm (root 302) -> page      |<--verifyOtp/enroll/challenge/verify----+
 | server actions:                         |   signInWithOtp / signUp / reset
 |   send-code, verify-code, password,     |        |                  ^
 |   confirm-link, mfa, locale-sync,       |        v                  | JWT: aal, amr, user_metadata
 |   contact, newsletter                   |   Supabase Postgres  <----+
 |     |  enqueue RPC (insert outbox,      |     email_outbox, admins, profiles(+cols),
 |     |  idempotent) --> EMAIL_QUEUE.send |     notification_sends, digest_runs,
 | scheduled(): 0 16 * * * UTC            -+->   RPCs: enqueue_email, claim_welcome,
 |   -> /api/cron/email-digest             |     claim_outbox, finish_outbox, build_digest,
 |      build_digest RPC + sweep RPC       |     sweep_outbox (all service_role only)
 |      -> EMAIL_QUEUE.sendBatch           |
 | queue(batch): max_batch_size 5          |     DLQ clickit-email-dlq (crash/overflow only)
 |   claim_outbox(ids) -> render EN/AR     |
 |   -> Resend send -> finish_outbox       |
 |   per message ack()/retry(delay)        |
 +-----------------------------------------+
```

Primary trace (code sign-in): browser posts email + Turnstile token to the `sendCode` action; the action runs Clickit's per-IP and per-email limiter, calls `signInWithOtp` with `captchaToken` and `emailRedirectTo`; GoTrue sends the Confirm-signup or Magic-link template through Resend SMTP; the viewer types the code; `verifyCode` normalises digits and calls `verifyOtp({email,token,type:'email'})`; the action then runs `afterSignIn` (profile upsert, locale mirror, `claim_welcome` RPC which atomically claims and inserts the outbox row, queue send) and redirects to `next`.

### Recommended Project Structure
```
src/
  server/
    admin-access.ts          # pure: decideAdminAccess(claims, now, maxAge) -> ok|needs_enrol|needs_code
    auth-guards.ts           # requireAdmin() (server-only wrapper), requireAdminUser() thin wrapper
    auth/otp.ts              # pure: normaliseCode, resendRemaining, safeNext helpers
    auth/hibp.ts             # sha1 prefix, range fetch, fail-open
    auth/wall.ts             # pure: isPublicPath(pathWithoutLocale)
    email/outbox.ts          # enqueueEmail({kind,idempotencyKey,to,data}) -> RPC + producer port
    email/consumer.ts        # pure: processBatch(batch, deps) (claim, render, send, finish, ack/retry)
    email/links.ts           # HMAC sign/verify (WebCrypto), unsubscribe + confirm links
    email/transport.ts       # Mailer port; ResendMailer; LocalMailer (refused when CLICKIT_RUNTIME=workers)
    catalog-client.ts        # createCatalogClient() service role, server-only (F1)
  emails/
    messages/{en,ar}.ts      # strings, interpolation
    auth/*.tsx               # 5 auth templates (exported to HTML)
    app/*.tsx                # welcome, support-ack, support-admin, newsletter-confirm, digest
    tsconfig.json            # jsx react-jsx for the Worker bundle (F19)
  app/[locale]/(viewer)/auth/        # page (code-first), confirm/page.tsx, mfa/page.tsx, onboarding
  app/auth/confirm/route.ts          # root redirector only
  app/api/email/unsubscribe/route.ts # GET 303 -> page, POST one-click
  app/api/cron/email-digest/route.ts
supabase/templates/*.html            # generated from src/emails/auth, committed
scripts/build-auth-templates.mjs     # React Email -> HTML with Go placeholders
scripts/auth-config-check.mjs        # read-only live diff (owner token)
scripts/admin-remove-factor.mjs      # owner script
scripts/seed-local-admin.mjs  scripts/lib/totp.mjs
tests/unit/*.test.ts  tests/unit/helpers/email-world.ts  tests/e2e/auth-*.spec.ts  supabase/tests/*.sql
```

### Pattern 1: Admin decision as a pure function plus a thin server wrapper
**What:** `decideAdminAccess({ aal, amr, nowSec, maxAgeSec })` returns `'ok' | 'needs_code'`; the wrapper adds signed-in, `admins` row, and `needs_enrol` (no verified factor). `amr` is an array of `{method, timestamp}` ordered newest first; entries are one per method per session and the `totp` timestamp is refreshed on every successful verify [VERIFIED: auth `amr.go`, `sessions.go`]. Fail closed: `amr` as `string[]` (no timestamps) or no `totp` entry means `needs_code`; accept method `totp` (current GoTrue value) and `mfa/totp` (listed in auth-js types).
**When to use:** proxy (claims only, no DB), admin layout, every admin action.
**Example:**
```ts
// Source: node_modules/@supabase/auth-js types (AMREntry, JwtPayload) + supabase.com/docs/guides/auth/jwt-fields
export const ADMIN_MFA_MAX_AGE_HOURS = 12
type Amr = { method: string; timestamp: number }
export function totpAgeSeconds(amr: unknown, nowSec: number): number | null {
  if (!Array.isArray(amr)) return null
  let newest: number | null = null
  for (const e of amr as Amr[]) {
    if (e && typeof e === 'object' && (e.method === 'totp' || e.method === 'mfa/totp') && Number.isFinite(e.timestamp)) {
      newest = newest === null ? e.timestamp : Math.max(newest, e.timestamp)
    }
  }
  return newest === null ? null : nowSec - newest
}
export function decideAdminMfa(claims: { aal?: string; amr?: unknown }, nowSec: number, maxAgeHours = ADMIN_MFA_MAX_AGE_HOURS) {
  if (claims.aal !== 'aal2') return 'needs_code' as const
  const age = totpAgeSeconds(claims.amr, nowSec)
  return age !== null && age >= 0 && age <= maxAgeHours * 3600 ? ('ok' as const) : ('needs_code' as const)
}
```
`requireAdmin()` order: `getClaims()` (aal/amr, local verify) -> `getUser()` (network; catches revoked or banned sessions for admin actions) -> `admins` lookup with the service-role client -> factor check only when not `ok`. Admin removal from `admins` takes effect immediately.

### Pattern 2: Token-hash confirm page + action
**What:** page renders a button; the action calls `verifyOtp({ token_hash, type })` with `type` whitelisted to `signup | recovery | email_change | email | magiclink` (all valid `EmailOtpType` values [VERIFIED: types.d.ts]); `type: 'email'` finds the user by confirmation OR recovery token hash, so it is the safe universal value for sign-up and code mail [VERIFIED: auth `verifyTokenHash`]. Result mapping: `recovery` -> set password page; `email_change` with no session -> `pending_other`; others -> `afterSignIn` then `next` (validated by `getSafeAuthNextPath`).
**Example:**
```ts
// Source: supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr (adapted: POST, not GET)
'use server'
const TYPES = ['signup', 'recovery', 'email_change', 'email', 'magiclink'] as const
export async function confirmLink(input: { token_hash: string; type: string; next?: string }) {
  if (!TYPES.includes(input.type as (typeof TYPES)[number]) || !/^[A-Za-z0-9_-]{10,200}$/.test(input.token_hash)) return { ok: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: input.token_hash, type: input.type as EmailOtpType })
  if (error) return { ok: false, error: error.code ?? 'expired' }
  if (!data.session) return { ok: true, state: 'pending_other' as const } // double-confirm email change, first link
  /* afterSignIn(user) ... redirect by type */
}
```

### Pattern 3: Template export with sentinels (keeps Go syntax out of React's escaper)
**What:** React escapes `"` and `'` in text, which would corrupt `{{ if eq .Data.locale "ar" }}`. Render the EN and AR bodies separately with sentinel strings (`__TOKEN__`, `__TOKEN_HASH__`, `__REDIRECT__`, `__EMAIL__`, `__NEW_EMAIL__`), then assemble the file as plain text:
```
{{ if eq .Data.locale "ar" }}<AR html>{{ else }}<EN html>{{ end }}
```
and replace sentinels with `{{ .Token }}` etc. Link `href` = `{{ if .RedirectTo }}{{ .RedirectTo }}{{ else }}{{ .SiteURL }}/auth/confirm?next=%2F{{ end }}&token_hash={{ .TokenHash }}&type=signup`. Unit test asserts per template: required placeholders present, both branches present, no unreplaced sentinel, no `<script>`, size < 90 KB, valid balanced `{{ if }}`/`{{ end }}`.
Subject (config.toml and dashboard): `{{ if eq .Data.locale "ar" }}رمز Clickit Story: {{ .Token }}{{ else }}Your Clickit Story code: {{ .Token }}{{ end }}`.

### Pattern 4: Outbox + queue (idempotent, leased, authoritative DB)
**What:** `enqueue_email(kind, idempotency_key, to_user, to_email, payload, locale)` inserts `on conflict (idempotency_key) do nothing returning id` and applies per-recipient caps; the app then sends `{ outboxId }` (UUID only). `claim_outbox(ids uuid[])` atomically moves rows `pending|retrying` (lease free or expired) to `sending`, increments `attempts`, sets `lease_until = now() + interval '5 minutes'`, and returns row + resolved address (`auth.users.email` for user-targeted rows; confirmed only) + `profiles.locale`. `finish_outbox` writes `sent`/`retrying`/`failed`, `provider_id`, `next_attempt_at`, `last_error` (no body). The sweep re-enqueues `pending` older than N minutes and `retrying` past `next_attempt_at`.
Consumer rules: per message `ack()` after the DB write; transient (429, 5xx, network) -> `finish_outbox('retrying')` + `retry({delaySeconds: min(60 * 2^(attempts-1), 3600)})`; honour `retry-after` when present; permanent 4xx -> `failed` + `ack()`; attempts >= 5 -> `failed` + `ack()`; row `sent` or missing -> `ack()`; throw only for infrastructure failure so the batch retries (acked messages are not redelivered [CITED: developers.cloudflare.com/queues/configuration/batching-retries]).
Wrangler:
```jsonc
"queues": {
  "producers": [{ "binding": "EMAIL_QUEUE", "queue": "clickit-email" }],
  "consumers": [{ "queue": "clickit-email", "max_batch_size": 5, "max_batch_timeout": 5,
                  "max_retries": 5, "retry_delay": 60, "dead_letter_queue": "clickit-email-dlq" }]
},
"vars": { "EMAIL_FROM": "Clickit Story <no-reply@clickitstory.ae>", "SUPABASE_URL": "<public project url>", "EMAIL_DIGEST_ENABLED": "off" }
```
`triggers.crons` is an authoritative list: when adding `0 16 * * *`, keep every existing expression (Phase 2's two, Phase 6's one) or the deploy deletes them.
`custom-worker.ts`: add `async queue(batch, env, ctx) { await processBatch(batch, buildDeps(env)) }` next to `fetch` and `scheduled`; import only pure relative `.ts` modules (no `server-only`, no `@/` alias), the pattern `src/server/scheduled.ts` already uses.

### Pattern 5: HMAC links with WebCrypto
Payload `kind.id.exp` base64url, signature `HMAC-SHA256(EMAIL_LINK_SECRET)`, verified with `crypto.subtle.verify` (constant time). Confirm links carry `exp` (7 days); unsubscribe links carry none (RFC 8058). Distinct `kind` prefix per use so a confirm token cannot be replayed as an unsubscribe token.

### Pattern 6: Wall as a table-driven pure function
`isPublicPath(pathWithoutLocale)`: exact `/` and `/portfolio`, prefixes `/auth`, `/privacy`, `/terms`, `/legal`, `/support`, `/coming-soon`, `/unsubscribe`. Remove `/about` and the whole `authAllowSkip` branch. Root-level `/auth/callback` and `/auth/confirm` bypass i18n inline like `/auth/callback` does today (exact-path checks before next-intl).

### Pattern 7: Locale mirror without a switch hook
The language switcher is plain `<Link locale="en|ar">` (navbar, four instances), so there is no event to hook. Mount a small client `LocaleSync` in the viewer shell: when signed in and the server-provided `profiles.locale` differs from `useLocale()`, call one idempotent server action `syncLocale(locale)` (updates `profiles.locale`, then `updateUser({data:{locale}})` only if `user_metadata.locale` differs); guard with `sessionStorage`. Also run the same sync inside `afterSignIn`. `user_metadata` is user-editable: it is cosmetic input to templates only (equality test), never an authorisation input.

### Anti-Patterns to Avoid
- **Verifying a token on GET** (F2) or running `verifyOtp` in `middleware`.
- **Calling Phase 2's `guardPublicForm` on auth actions**: it runs Turnstile `siteverify` first, which spends the single-use token before Supabase sees it. Use the standalone `decideRateLimit` for send-code and pass `captchaToken` to Supabase [CITED: STACK.md Turnstile section; tokens are single-use].
- **Putting recipient addresses in queue messages** (D-28) or the rendered body in the queue (128 KB limit, PII retention).
- **Browser-side `supabase.auth.*` for reset/update** (loses captcha, HIBP, PKCE cross-device): move `resetPasswordForEmail` and every `updateUser` to server actions.
- **Moving the admin pages into a route group** while Phase 6 is open (F10).
- **`supabase config push` against live** (F13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP generation/verification | own TOTP in app | Supabase `mfa.*` (tests use a ~15-line RFC 6238 helper) | Supabase owns secrets, replay and rate limits |
| QR code | QR library | `enroll().totp.qr_code` (SVG data URI), show secret too | Supabase returns it; CSP `img-src data:` already allowed |
| Email HTML | hand-written tables per template | React Email components | Cross-client quirks, plain text via `render({plainText:true})` |
| Idempotent send | own dedupe cache | Outbox unique key + Resend `Idempotency-Key` | Two layers, each simple |
| Link signing | custom crypto | WebCrypto HMAC-SHA256 | Standard, constant-time verify |
| Leaked-password list | own list | HIBP range API (k-anonymity) | Free, no key, no rate limit [CITED: haveibeenpwned.com/API/v3] |
| One-click unsubscribe semantics | invented headers | RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` | Gmail/Yahoo bulk rules |
| Cron + queue plumbing | Durable Object scheduler | Cron Trigger + Queue + outbox sweep | Phase 2 dispatch exists |

**Key insight:** every hard correctness problem here (never twice, not lost, atomic welcome, digest window) is solved by one conditional write in Postgres, not by queue semantics. Treat the queue as a doorbell.

## Common Pitfalls

### Pitfall 1: Revoking anon EXECUTE breaks the catalog (F1)
**What goes wrong:** series page, watch sibling list and rails return empty or error for everyone after M3.
**Why:** `security_invoker` view + function in the select list + anon-key cached client.
**Avoid:** switch the four queries to `createCatalogClient()` before M3; Wave 0 DB test runs `set role anon; select count(*) from public.episodes_view` and expects `permission denied`, and `set role authenticated` expects success.
**Warning signs:** "permission denied for function get_public_youtube_video_id" in Worker logs; empty episode lists.

### Pitfall 2: Catalog client fails a clean-clone build
`next build` in the clean clone uses placeholder public env and no service-role key (CLAUDE.local.md gate facts). `createAdminClient()` throws when the key is missing. The four queries must degrade (log, return `[]`) when the key is absent at build, and the pages are dynamic (they call `getUser()`), so verify with the clean-clone build command from `CLAUDE.local.md`.

### Pitfall 3: Existing user gets the wrong-language or no-code email
Magic Link vs Confirm-signup template split: `signInWithOtp` sends **Magic Link** to existing confirmed users and **Confirm signup** to new users (and to unconfirmed ones). Both must contain `{{ .Token }}`. Locale only applies at sign-up (F3). Test with: new address, existing address, unconfirmed password sign-up, no-locale user.

### Pitfall 4: Prefetching scanners eat links (F2)
Cross-device tests must include a "scanner" step: `fetch(link)` with GET before the user's click and assert the token is still valid.

### Pitfall 5: Enrol UX traps
Orphan unverified factor + same `friendlyName` = `mfa_factor_name_conflict`; second factor needs an AAL2 session (`validateFactors`); enrolling or verifying signs out other lower-AAL sessions; `getAuthenticatorAssuranceLevel().nextLevel` costs a network call, so use it only on the MFA page, never in the proxy. MFA challenge/verify is capped at 15/min per IP and is not configurable.

### Pitfall 6: AAL and freshness placement
Proxy: claims only (`aal`, `amr`, no DB, no `nextLevel`). Layout/actions: `requireAdmin()`. DB: `aal2` only (the 12 h rule is application-level; an optional SQL copy of the rule would duplicate the constant, so do not add it). `getClaims()` already runs on every request (local JWKS verify); do not add a second `getUser()` call to the proxy.

### Pitfall 7: Welcome email races and missing profile
Two near-simultaneous verifies (double click, link + code) must produce one row: `claim_welcome` does the conditional update and the outbox insert in one function. A user may have no `profiles` row (live: 3 auth users, 2 profiles): `claim_welcome` upserts the profile first. Backfill `welcome_sent_at = now()` for all existing profiles in M1 so no existing person is mailed.

### Pitfall 8: Digest timezone and idempotency
Dubai is UTC+4 with no DST; derive the date in SQL as `(now() at time zone 'Asia/Dubai')::date`. Cron `0 16 * * *` is 20:00 Dubai. Cron delivery may repeat; the ledger (F5) makes re-runs no-ops. Cron changes take up to 15 minutes to propagate [CITED: developers.cloudflare.com/workers/configuration/cron-triggers].

### Pitfall 9: OTP input vs iOS autofill
`autocomplete="one-time-code"` on a six-box widget fills only the focused box with the whole code: handle `onChange` with length > 1 by distributing digits. Normalise `[٠-٩]` and `[۰-۹]` to ASCII, strip whitespace, hyphens and bidi marks (U+200E/200F, U+202A-202E, U+2066-2069) on client and server. Keep the email and code fields `dir="ltr"`.

### Pitfall 10: Rate limits and Turnstile
Supabase CAPTCHA is off until the Phase 3 cutover (Phase 2 decision) and on after: the same code path must work both ways (token optional before, required after). A failed submit consumes the token: reset the widget (`useTurnstileToken().consume()`). Supabase `verifyOtp` needs no captcha (param deprecated). Custom SMTP starts at 30 emails/hour [CITED: supabase.com/docs/guides/auth/auth-smtp]; the number to set is a decision for Koss.

### Pitfall 11: Email rendering
Gmail ignores `<style>` in some contexts and clips at about 102 KB: inline styles, no web fonts (system stack incl. Tahoma/Segoe UI for Arabic), PNG logo (SVG is not rendered by Gmail; white logo for the black band must be a hosted PNG on a path the proxy excludes: `.png` is excluded from the matcher). RTL: `dir="rtl"` and `lang="ar"` on `<html>` and on each wrapping `<table>`/`<td>`, inline `direction:rtl;text-align:right`; codes inside a `dir="ltr"` span. `[ASSUMED]` that Gmail/Outlook honour this; verify in the owner render check (EN+AR, Gmail web, Gmail iOS, Outlook, Apple Mail).

### Pitfall 12: Free-plan CPU of the consumer
`render()` pulls `react-dom/server` into the Worker. Measure CPU per message in `wrangler dev`/preview and on workers.dev; if it exceeds budget switch to pre-rendered HTML with string slots (F19). Not a reason to move rendering into HTTP handlers.

### Pitfall 13: Migration ordering and guard
New migration versions must sort after every applied/merged version (live head is `20260810120000`; Phase 6's migration lands in parallel). The guard flags every `drop` (including `drop policy`, `drop constraint`, `drop trigger`) unless the same line ends with `-- safe-drop: <reason>`; `delete from` and `truncate` likewise. Never edit an applied migration. Every new table/function needs explicit `grant ... to service_role` (and `authenticated` only where RLS allows): the cloud and CLI default no longer auto-exposes new objects [CITED: supabase/config.toml comment, `auto_expose_new_tables`].

### Pitfall 14: Public repo
No UUIDs, emails or keys in migrations, seeds, templates or docs. Admin rows are inserted by Koss's reviewed SQL typed in his terminal, selecting by email. `seed:local-admin` writes credentials to `/Users/koss/.clickit-checks/local-admin.env` only and refuses any non-local URL.

## Code Examples

### Local config (supabase/config.toml excerpt, F12)
```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "http://127.0.0.1:3000/**"]
minimum_password_length = 8
[auth.rate_limit]
email_sent = 1000            # local only; live value is an owner step
[auth.email]
enable_confirmations = true
double_confirm_changes = true
otp_expiry = 900
max_frequency = "60s"
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
[auth.email.template.confirmation]
subject = "{{ if eq .Data.locale \"ar\" }}...{{ else }}Your Clickit Story code: {{ .Token }}{{ end }}"
content_path = "./supabase/templates/confirmation.html"
# ... recovery, magic_link, email_change, reauthentication
```
Applying config changes locally needs `supabase stop && supabase start` [CITED: supabase.com/docs/guides/local-development/customizing-email-templates]; take the heavy lock `/Users/koss/.clickit-heavy.lock` first and do not run a second stack.

### `private.is_admin()` and the inline storage policy (M2)
```sql
-- Source: supabase.com/docs/guides/auth/auth-mfa (RLS uses (select auth.jwt()->>'aal') = 'aal2')
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;  -- create or replace keeps the existing grants (anon, authenticated execute)

drop policy if exists "Admin manage site-assets" on storage.objects; -- safe-drop: recreated on the next statement with private.is_admin()
create policy "Admin manage site-assets" on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and (select private.is_admin()))
  with check (bucket_id = 'site-assets' and (select private.is_admin()));
```
Referencing set (live per audit): 35 public + 3 storage policies already call `private.is_admin()` (body swap needs no policy rewrite); one inline policy `Admin manage site-assets` (defined in `20260416000000_add_hero_video.sql`); no function other than `private.is_admin()` references `admin_user_id`. Remaining readers of `app_config.admin_user_id` in code (all replaced by `requireAdmin`): `src/proxy.ts` (`checkIsAdmin` in `src/lib/supabase/middleware.ts`), `auth/page.tsx`, `auth/actions.ts`, `profile/page.tsx`, `admin/layout.tsx`, `admin/actions.ts` `assertAdmin`, `src/server/auth-guards.ts` (Phase 2), `api/youtube-meta/route.ts`.

### M3: close anon (after the catalog client is live)
```sql
revoke execute on function public.get_public_youtube_video_id(uuid) from public, anon;
grant  execute on function public.get_public_youtube_video_id(uuid) to authenticated, service_role;
revoke select on table public.episodes_view from anon;
```

### Atomic welcome claim (M1)
```sql
create or replace function public.claim_welcome(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.profiles(id) values (p_user) on conflict (id) do nothing;
  update public.profiles set welcome_sent_at = now()
   where id = p_user and welcome_sent_at is null returning id into v_id;
  if v_id is null then return null; end if;
  insert into public.email_outbox(kind, idempotency_key, to_user, status)
  values ('welcome', 'welcome:' || p_user, p_user, 'pending') on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.claim_welcome(uuid) from public, anon, authenticated;
grant execute on function public.claim_welcome(uuid) to service_role;
```

### Have I Been Pwned (fail open, 3 s)
```ts
// Source: haveibeenpwned.com/API/v3#PwnedPasswords (no key, no rate limit; padded rows have count 0)
export async function isPwned(password: string, f: typeof fetch = fetch, timeoutMs = 3000): Promise<boolean | null> {
  const bytes = new TextEncoder().encode(password)
  const sha1 = [...new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await f(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: ctl.signal })
    if (!res.ok) return null
    return (await res.text()).split(/\r?\n/).some(l => { const [s, c] = l.split(':'); return s === sha1.slice(5) && Number(c) > 0 })
  } catch { return null } finally { clearTimeout(t) }   // null = unknown: caller logs a warning and allows
}
```

### Resend send with idempotency and one-click headers
```ts
// Source: resend.com/docs/dashboard/emails/idempotency-keys, /add-unsubscribe-to-transactional-emails
const { data, error } = await resend.emails.send(
  { from: env.EMAIL_FROM, to: [addr], subject, html, text, replyTo,
    headers: kind === 'digest' ? { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined },
  { idempotencyKey: row.idempotency_key },
)
// error.statusCode: 429 -> retry (retry-after), 5xx -> retry, 409 concurrent -> retry, 409 invalid_idempotent_request -> treat as sent, other 4xx -> failed
```

### TOTP helper for tests (RFC 6238, node:crypto)
```js
// scripts/lib/totp.mjs - RFC 6238 Appendix B vector: secret "12345678901234567890", T=59s -> 94287082 (8 digits) => 287082 (6 digits)
import { createHmac } from 'node:crypto'
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32Decode(s) { let bits = '', out = []; for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0'); for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out) }
export function totp(secretBase32, nowMs = Date.now(), step = 30, digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / step)))
  const h = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}
```
Supabase accepts one interval of skew; tests should request a code and verify immediately, and never pin the clock across a 30 s boundary.

### Mailpit helper (local stack, port 55324)
```ts
// Source: live probe of mailpit v1.31.3 on the Clickit stack: GET /api/v1/messages, /api/v1/search?query=to:<addr>, DELETE /api/v1/messages
const base = 'http://127.0.0.1:55324/api/v1'
export const clearInbox = () => fetch(`${base}/messages`, { method: 'DELETE' })
export async function latestTo(addr: string) {
  const list = await (await fetch(`${base}/search?query=${encodeURIComponent('to:' + addr)}`)).json()
  const id = list.messages?.[0]?.ID; return id ? (await fetch(`${base}/message/${id}`)).json() : null // { Subject, Text, HTML, From, To }
}
```

## Runtime State Inventory
Not a rename/migration phase. The one source-of-truth switch (`app_config.admin_user_id` -> `admins`) is covered by M1 seed + M2 and the owner steps below. Live external state that code cannot change: Supabase dashboard Auth settings (OTP expiry, Confirm email, SMTP, rate limits, CAPTCHA, redirect URLs, templates) and Resend keys; handled as owner steps with a read-only checker (F13).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cookie PKCE `exchangeCodeForSession` for email links | `verifyOtp({token_hash,type})` server-side | Supabase SSR guide | Links work on any device |
| `getSession()` in server code | `getClaims()` (local JWKS verify) | @supabase/ssr 0.5+ | Already used in the proxy |
| `@react-email/components` | single `react-email` v6 package | v6 | Old package deprecated on npm |
| Vercel BotID | Turnstile | Phase 2 | Supabase CAPTCHA plus own siteverify for forms |

**Deprecated/outdated:** `verifyOtp` `options.captchaToken` (deprecated in types); `auth.admin.mfa.*` is typed `@experimental` (acceptable for an owner script).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Worker subrequests reach Supabase from a shared egress IP, so IP rate limits are effectively site-wide | F7 | Over-raising limits (low) or under-raising and blocking launch bursts |
| A2 | Gmail/Outlook honour `dir="rtl"` plus inline direction styles for these layouts | Pitfall 11 | Mirrored/garbled Arabic emails; caught at owner render check |
| A3 | `react-email` root import tree-shakes out CLI deps in the Worker bundle; `render()` fits Free CPU | F19, Pitfall 12 | Switch to pre-rendered HTML (planned fallback) |
| A4 | Queue consumer invocations on Free are not capped at 10 ms CPU (Queues page says 30 s default; Workers page silent) | F9 | Consumer exceeds CPU; mitigation is pre-render + Workers Paid decision |
| A5 | Cloudflare DLQs work on Free (the Free changelog does not mention them) | Pattern 4 | Remove DLQ config; DB `failed` rows already carry the record |
| A6 | Missing `.Data.locale` evaluates `eq` to false in GoTrue's Go version | F3, F16 | English fallback would error; Wave 0 test on the local stack decides |
| A7 | A single-Worker producer+consumer on the same queue runs under `wrangler dev` / OpenNext preview | Validation | Use the inline adapter for e2e instead |
| A8 | Live project keeps default privileges for `service_role` on existing functions after `revoke ... from public, anon` | F1 | Catalog client would fail; DB test proves it before M3 |
| A9 | Local GoTrue can be pointed at Mailpit with a custom sender via `[auth.email.smtp]` so tests can assert From | Validation MAIL-01 | From assertion moves to the owner test send |
| A10 | Arabic email copy quality | Open question | Koss/Khadija review at UAT |
| A11 | Suggested live `email_sent` rate-limit number (about 100/hour) | Owner steps | Number must be agreed with Koss; do not apply unasked |
| A12 | Dashboard offers no factor-removal control | F4 | If it does, the owner step simplifies; the script still works |

## Open Questions

1. **MFA page URL (F10).** Recommendation `/{locale}/auth/mfa` instead of `/admin/mfa`. Needs Koss's OK (contract item 3). Alternative: move admin into a route group after Phase 6 lands.
2. **Existing Arabic users' first code email (F3).** Accept English-first, or approve the silent service-role locale pre-update RPC?
3. **Support inbox badge.** `support_messages.notification_status` currently means "admin notification email state". After D-31 the source is the outbox; either mirror the admin-copy result into it or relabel in the inbox. Pick one in planning.
4. **Postal address in commercial email footers** (digest, newsletter confirm). CONTEXT footer names Spacelight Studios FZ LLC, Abu Dhabi only; do not invent an address; ask Koss.
5. **Supabase auth email rate-limit number and the IP-limit raises (F7).** Koss's decision.
6. **Whether `live_at` (F5) is acceptable as an extra column.** Required for correctness of MAIL-04 without guessing from `updated_at`.
7. **Phase 4 canvas email look.** CONTEXT D-27 defers to it; its output was not available to this research.
8. **Workers Paid.** If Phase 2's CPU report fails on Free, auth server actions and the consumer are affected; it stays Koss's priced decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker (colima) | local Supabase, scratch DB | yes | 29.8.2 | none |
| Local Clickit Supabase stack | auth/e2e/DB tests | yes (up 8 h) | GoTrue v2.197.0, Postgres 17, Mailpit v1.31.3 on :55324 | none |
| **ALMAR local Supabase stack** | n/a | **also running** | - | Mac rule: one local stack at a time; the controller must stop one before Phase 5 e2e |
| Supabase CLI | stack, `db query` | yes | 2.119.0 (global); repo devDep 2.107.0 | use global |
| Node | tests | yes | v26.7.0 | - |
| Playwright + chromium | e2e | yes | 1.58.2, chromium-1248 | - |
| wrangler (global) | queue/cron local test, owner steps | yes (`~/.local/bin/wrangler`); repo dependency arrives with Phase 2 | - | `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4` |
| Go | proving Go-template `eq` on nil | **no** | - | prove it through the local GoTrue container with a no-locale user (Mailpit) |
| `gh` | PRs | yes (account Loomlyne) | - | - |
| slopcheck | package audit | yes (`/opt/homebrew/bin/slopcheck`) | - | - |
| Resend account / domain | real sends | Koss Pro; domain verification is Phase 3 (MAIL-02) | - | local transport only until then |
| Phase 2 code (custom worker, form guard, cron map, Turnstile) | all server work | **only on branch `origin/claude/phase-02-execute-19d86a`** | - | execution must start after Phases 2-4 merge; this phase touches the same files (`contact.ts`, `custom-worker.ts`, `wrangler.jsonc`, `proxy.ts`) |

**Missing dependencies with no fallback:** none for planning. **Blocking for execution:** Phases 2-4 merged to `main` (Phase 5 rewrites files they change).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via `node --experimental-strip-types` (Node v26.7.0), Playwright 1.58.2 for e2e, `psql` assertions in the local DB container for SQL |
| Config file | `package.json` script `test:unit`; `playwright.config.ts` (`testDir ./tests/e2e`, webServer `npm run dev`); no SQL test runner yet (Wave 0) |
| Quick run command | `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/unit/<file>.test.ts` |
| Full suite command | `npm run gate:local` (lint, typecheck, unit, migration guard, build) |
Constraints: unit tests import with explicit `.ts` extensions and relative paths only (no `@/`, no `server-only`, no `next/*`), so every module under test must be a pure file with injected ports (precedent: `src/server/scheduled.ts`, Phase 2 `src/server/*.ts`). `tests/unit/helpers/fake-supabase.ts` has no `upsert`, `ignoreDuplicates`, `.or`, `.lt/.lte/.gte`, so test the outbox/consumer through small ports with an in-memory world (`tests/unit/helpers/email-world.ts`), as Phase 2 did with `video-world.ts`.
Heavy steps (local stack restarts, e2e, DB scratch) take the lock `/Users/koss/.clickit-heavy.lock` (mkdir lock with a `pid` file, see `/Users/koss/.clickit-checks/p1-scratch-proof.sh`), run detached with an `exit=` line, Playwright `--workers=2` at most, one stack, one build at a time.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signed-out GET of every non-public path 307s to `/{locale}/auth?next=`; public list exact; `/about` walled; `/unsubscribe`, `/auth/confirm` open | unit + e2e | `... --test tests/unit/wall-policy.test.ts`; `npx playwright test tests/e2e/auth-wall.spec.ts --workers=2` | Wave 0 |
| AUTH-02 | code normalisation (Arabic-Indic, paste, bidi), resend countdown, send/verify action state machine, new + existing user get a code | unit + e2e (Mailpit) | `... --test tests/unit/otp-code.test.ts`; `... auth-otp.spec.ts` | Wave 0 |
| AUTH-03 | password sign-up/in, set password in Profile, `password_set_at`, HIBP hit/miss/timeout/non-200 fail-open | unit + e2e | `... --test tests/unit/hibp.test.ts`, `password-set.test.ts` | Wave 0 |
| AUTH-04 | reset, confirm, email-change (two links, two contexts) succeed in a context with no prior cookies; scanner GET does not consume the token; first email-change link = `pending_other` | e2e (3 browser contexts) + unit | `... auth-cross-device.spec.ts`; `... --test tests/unit/confirm-link.test.ts` | Wave 0 |
| AUTH-05 | `admins` seed; `private.is_admin()` truth table (member/non-member x aal1/aal2/null); `requireAdmin` decision table | SQL + unit | `bash scripts/db-proof.sh` (assertions in `supabase/tests/admin.sql`); `... --test tests/unit/admin-access.test.ts` | Wave 0 |
| AUTH-06 | `decideAdminMfa` (11h59 ok, 12h01 stale, string[] amr, no totp, aal1); TOTP helper RFC vector; enrol with second factor; wrong code refused | unit + e2e | `... --test tests/unit/admin-mfa.test.ts`, `totp.test.ts`; `... admin-mfa.spec.ts` | Wave 0 |
| AUTH-07 | every admin action writes the acting admin's id; audit page maps id to `display_name`; `admin_auth` rows for enrol/unenrol/failed code | unit | `... --test tests/unit/admin-audit-names.test.ts` | Wave 0 |
| AUTH-08 | anon cannot `select` `episodes_view` or call the function; authenticated and service_role can; four cached queries use the catalog client (source test) | SQL + unit | `bash scripts/db-proof.sh`; `... --test tests/unit/catalog-client-source.test.ts` | Wave 0 |
| MAIL-01 | each template has required placeholders + AR branch + plain text; subjects; From header on local SMTP; EN and AR render | unit + e2e | `... --test tests/unit/auth-templates.test.ts`; `... auth-mail-brand.spec.ts` | Wave 0 |
| MAIL-03 | double verify yields exactly one outbox row; missing profile row handled; backfill leaves existing users unmailed | SQL + unit | `bash scripts/db-proof.sh`; `... --test tests/unit/welcome.test.ts` | Wave 0 |
| MAIL-04 | digest selection (`live_at` window, ledger, notify flag, confirmed email, Dubai date), HMAC link sign/verify/forgery, headers present, POST one-click flips flag, GET 303 | SQL + unit | `bash scripts/db-proof.sh`; `... --test tests/unit/unsub-link.test.ts`, `digest-headers.test.ts`, `unsubscribe-route.test.ts` | Wave 0 |
| MAIL-05 | one ack + one copy per admin, `Reply-To` = sender, per-recipient cap, CR/LF stripped | unit | `... --test tests/unit/support-mail.test.ts` | Wave 0 |
| MAIL-06 | pending row, confirm link expiry/forgery/replay, legacy rows untouched, per-address resend cap | unit + SQL | `... --test tests/unit/newsletter-confirm.test.ts` | Wave 0 |
| MAIL-07 | consumer matrix: success; 429 w/ retry-after; 5xx; permanent 4xx; duplicate delivery; crash after send (fake Resend with 24 h key semantics + 409); stale lease; >23 h guard; max attempts; sweep re-enqueue; lost queue message | unit | `... --test tests/unit/email-consumer.test.ts`, `outbox-sweep.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant `node --test` file (seconds).
- **Per wave merge:** `npm run gate:local` plus `bash scripts/db-proof.sh` when SQL changed.
- **Phase gate:** gate:local, db-proof, the e2e lane (`auth-*.spec.ts`, one lane, `--workers=2`), clean-clone check (`/Users/koss/.clickit-checks/pr-check.sh`), then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/db-proof.sh` + `supabase/tests/*.sql`: generalise the Phase 1 scratch-database pattern (apply all migrations in a scratch DB inside `supabase_db_Clickit`, then run assertions with `set role anon|authenticated|service_role` and `set local request.jwt.claims = '{...}'`).
- [ ] `tests/unit/helpers/email-world.ts` (in-memory outbox, fake Resend with idempotency and 409, fake queue, clock).
- [ ] Pure modules listed under "Recommended Project Structure" (they define the unit-test seams).
- [ ] `scripts/lib/totp.mjs`, `scripts/seed-local-admin.mjs` (creates user via admin API, signs in, `mfa.enroll`, verifies with the helper, inserts `admins` row; writes env file outside the repo; refuses non-local URL).
- [ ] Playwright helpers: Mailpit client, three-context cross-device fixture, local-admin fixture.
- [ ] Spike (day 1): (a) GoTrue renders a template with `{{ if eq .Data.locale "ar" }}` for a user with no locale (Mailpit); (b) `wrangler` dry-run bundle of `custom-worker.ts` with `react-email` render: size and CPU; (c) queue producer+consumer under `wrangler dev`/preview; (d) `has_function_privilege('service_role', ...)` after the M3 revoke in the scratch DB.
- [ ] Update `tests/unit/cron-schedule.test.ts` / `scheduled.test.ts` (Phase 2 files) for the new cron expression and route.

### Manual / owner-only verification
- Real-inbox render check EN + AR (Gmail web and iOS, Outlook, Apple Mail), "Show original" SPF/DKIM/DMARC pass.
- Real authenticator-app enrolment by Issam and Nejib (two factors each).
- Live Auth settings readback via `scripts/auth-config-check.mjs`.
- First real queue message on Cloudflare (a test email to Koss's own address) and first digest.
- The 12 h freshness is unit-tested only; a manual 12 h wait is not practical.

## Security Domain

### Applicable ASVS Categories (L1)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (password min 8, HIBP check, email OTP, TOTP for admins), Turnstile via Supabase CAPTCHA, generic errors |
| V3 Session Management | yes | `@supabase/ssr` httpOnly-style cookie session, refresh via proxy, AAL claim, 12 h TOTP freshness, revocation via `getUser()` in admin actions |
| V4 Access Control | yes | Proxy wall + page-level checks, `requireAdmin()`, `private.is_admin()` RLS with AAL2, `admins` RLS with no policies, anon revoke |
| V5 Input Validation | yes | zod on every action; digit normalisation; `next` via `getSafeAuthNextPath`; token_hash regex + type whitelist; header-injection stripping |
| V6 Cryptography | yes | WebCrypto HMAC-SHA256 (constant-time verify), SHA-1 only for HIBP k-anonymity, no custom crypto; TOTP secrets stay in Supabase |
| V7 Errors/Logging | yes | Audit rows (`admin_auth`), structured logs without tokens, codes, secrets, QR/URI |
| V8 Data Protection | yes | No addresses in queue messages; outbox `last_error` stores no body; retention note for old outbox rows |
| V9/V13 Comms/API | yes | SMTP 465 TLS, HTTPS-only links, unsubscribe endpoint idempotent and login-free |
| V14 Configuration | yes | Secrets only as Worker secrets / owner terminal; public repo; CSP `img-src data:` already allows the QR |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email bombing via Send code / newsletter / support auto-reply | DoS, Repudiation | Turnstile, Clickit per-IP and per-email limiter, per-recipient caps in `enqueue_email`, static auto-reply body (F17) |
| 6-digit code brute force | Spoofing | Supabase verify limit (per IP) plus Clickit per-email failure counter (5 wrong codes / 15 min locks the email's verify attempts); 15-minute expiry |
| Account enumeration | Info disclosure | `shouldCreateUser: true` returns the same response for new and existing users; `resetPasswordForEmail` always 200; password sign-in generic error; confirm email on makes `signUp` non-revealing |
| Open redirect via `next` / `redirect_to` | Tampering | `getSafeAuthNextPath`; Supabase allow-list; exact entries for non-production hosts, no `**` on production |
| Link scanner consumes token / referrer leak of token_hash | Tampering, Info | Button interstitial (F2), `no-referrer` |
| Admin MFA bypass with stale session | EoP | `requireAdmin()` on every action, AAL2 + `totp` amr age <= 12 h, fail-closed on unknown `amr` shape; RLS aal2 |
| Admin removal not effective until token expiry | EoP | App-level `admins` lookup every action |
| Forged confirm/unsubscribe link | Spoofing | HMAC kind-separated, expiry on confirm, constant-time verify |
| Stored XSS / HTML injection in admin-copy email | Tampering | React escaping; no raw HTML of user text; plain-text part built from escaped values |
| Header injection via name/subject/`Reply-To` | Tampering | zod email, strip CR/LF, length caps |
| Service-role key misuse in catalog client | EoP | server-only module, read-only helper exposing named queries only, never imported by client code |
| `user_metadata` tampering | Tampering | Used only for template locale equality; never for authorisation |
| Secrets in public repo (UUIDs, emails, TOTP secrets) | Info disclosure | Owner-run SQL by email; local admin env outside repo; QR/secret never logged |
| Queue/outbox tampering | Tampering | Messages carry only a UUID; consumer re-reads state from Postgres; RLS on, service-role-only grants |
| Resend 24 h idempotency expiry duplicate | Repudiation | 23 h guard, lease, `failed` for humans |

## Migration plan (for the planner)

| Mig | Content | Apply when |
|-----|---------|-----------|
| M1 additive | `admins` (+ seed from `app_config.admin_user_id`, `display_name` placeholder to fix via owner SQL), `profiles` + `locale`, `onboarded_at`, `password_set_at` (backfill `created_at`), `welcome_sent_at` (backfill `now()`), `notify_new_episodes` default true; `email_outbox`, `notification_sends`, `digest_runs`; `episodes.live_at` + trigger + backfill; `newsletter_subscribers` + `confirmed_at`, `confirm_sent_at`, status constraint widened (F14); RPCs `enqueue_email`, `claim_welcome`, `claim_outbox`, `finish_outbox`, `sweep_outbox`, `build_digest`; explicit grants to `service_role`; RLS on all new tables | Before code deploy (old code ignores it) |
| code deploy | requireAdmin, catalog client, wall, auth screens, consumer, cron route, templates | After M1 + owner Supabase/Cloudflare steps |
| owner | both admins sign in, enrol two authenticators, confirm in `/admin` | After deploy |
| M2 | `private.is_admin()` AAL2 body; storage policy rewrite | Only after both admins verified |
| M3 | anon revoke + view grant | After deploy of catalog client (can ship with M2) |
Each migration: timestamp after every applied version, `-- safe-drop:` waivers on the few `drop` lines, scratch-DB proof, `pg_dump` per runbook step 7, dry-run + Koss's approval. `app_config.admin_user_id` and `auth_allow_skip` columns stay for Phase 8.

## Owner steps (numbered; each is one human action; secrets only in Koss's terminal; live DB writes only via the gated workflow)

1. **Resend key for Supabase SMTP.** In Resend (Koss Pro account) create an API key limited to sending on `clickitstory.ae`, name it `supabase-smtp`. Prerequisite: domain verified (Phase 3, MAIL-02). Do not paste the key anywhere but the field in step 2.
2. **Supabase SMTP.** Dashboard, project `lajguozmtissnnfccmej`, Authentication, SMTP: host `smtp.resend.com`, port `465`, user `resend`, password = key from step 1, sender name `Clickit Story`, sender `no-reply@clickitstory.ae`.
3. **Supabase Auth settings.** Email OTP expiry `900`; Confirm email ON; Secure email change ON; "Require current password when updating" OFF; minimum password length `8` (already set); read back with `node scripts/auth-config-check.mjs` using an access token exported only in his terminal.
4. **Supabase rate limits.** Authentication, Rate Limits: raise "emails sent per hour" and the per-IP sign-in / OTP / verify / token limits to numbers agreed with Koss (research suggestion, `[ASSUMED]`: about 100 emails/hour; per-IP limits several times the 30-per-5-minutes default). The custom-SMTP default is 30 per hour.
5. **Supabase URL configuration.** Site URL = `https://www.clickitstory.ae` (set at the Phase 3 cutover); Redirect URLs: only exact entries needed (production needs none beyond the Site URL host; for workers.dev UAT add the exact `https://<worker>.workers.dev/**` and delete it afterwards).
6. **Paste the five templates and five subjects** from `supabase/templates/` and the subject lines (Confirm signup, Magic link, Reset password, Change email, Reauthentication) into Authentication, Emails. Read back with the checker.
7. **Create the Cloudflare queues** (ClickitStory account): `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami` must show `e329b099...`, then `... wrangler@4 queues create clickit-email` and `... queues create clickit-email-dlq`.
8. **Worker secret `RESEND_API_KEY`.** Create a second Resend key `worker-send` (sending only), then in his terminal: `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put RESEND_API_KEY`.
9. **Worker secret `EMAIL_LINK_SECRET`.** `openssl rand -base64 32 | HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put EMAIL_LINK_SECRET` (never echoed). Supabase service-role and Turnstile secrets are Phase 2/3 steps.
10. **Approve M1** after the controller's `pg_dump` and dry-run (workflow `apply-live-migrations.yml`, environment `live-db`).
11. **Controller deploys the Worker** after Koss says Ship (adds the queue bindings, vars and the `0 16 * * *` trigger together with the existing cron expressions).
12. **Nejib's admin row.** Nejib signs up or signs in with his email first; then Koss runs the reviewed statement (UUID resolved by email in the statement, never committed): `insert into public.admins(user_id, display_name, added_by) select id, 'Nejib', null from auth.users where email = '<typed in terminal>';` and fixes Issam's `display_name` the same way.
13. **TOTP enrolment, Issam.** Sign in, follow the enrol page, add the first and a second authenticator.
14. **TOTP enrolment, Nejib.** Same.
15. **Approve M2 and M3** (dry-run read first). Gate: steps 13 and 14 done.
16. **Enable the digest.** Set `EMAIL_DIGEST_ENABLED` to `on` in `wrangler.jsonc` vars (controller deploys on Koss's word); first real emails to real viewers are Koss's explicit approval.
17. **Supabase CAPTCHA** (Phase 3 cutover step): confirm it is on before the sign-in UAT; token must be accepted by `signInWithOtp`.
18. **First real emails.** Koss sends himself a sign-in code, a password reset, a support message and a newsletter confirm, checks EN and AR in his inbox and "Show original" authentication results.
19. **On demand: lost authenticator.** `node scripts/admin-remove-factor.mjs <email>` with the service-role key in his terminal env; the admin enrols again at next sign-in.

## Code map (what Phase 5 touches)

| File | Change |
|------|--------|
| `src/proxy.ts`, `src/lib/supabase/middleware.ts` | New public list + pure `isPublicPath`; drop `authAllowSkip`, `/about`, BotID branch (Phase 2 removes BotID); `updateSession` returns `claims` (aal, amr); `/admin/*`: not signed in -> auth, aal1 or stale -> `/{locale}/auth/mfa?next=`; exact-path bypass for `/auth/confirm`; `?next=` currently drops the query string (keep) |
| `src/lib/config.ts`, `auth/page.tsx`, `admin/settings/auth-tab.tsx`, `auth-page-editor.tsx`, `actions.ts` (`auth_allow_skip` zod key, line 1650), `messages/*.json` (`skipSignIn`, `authAllowSkip*`) | Remove skip setting (select list at `config.ts:235` still reads the column; remove it there so the column can be dropped in Phase 8) |
| `src/app/[locale]/(viewer)/auth/{page,actions}.tsx`, `src/components/auth/*` (`auth-panel`, `login-form`, `signup-form`, `reset-password-form`, `botid-init`) | Code-first single screen; server actions for send-code, verify-code, password in/up, reset request, reset set-password, set/change password; Turnstile; HIBP |
| `src/app/auth/callback/route.ts` | Keep; add `src/app/auth/confirm/route.ts` (redirector) and `[locale]/(viewer)/auth/confirm/page.tsx`, `auth/mfa/page.tsx`, onboarding step |
| `src/components/profile/account-settings.tsx`, `profile/actions.ts`, `profile/page.tsx` | Browser `updateUser` calls -> server actions; Set vs Change password via `password_set_at`; digest switch; admin check -> `requireAdmin` helper (non-throwing variant) |
| `src/app/[locale]/admin/layout.tsx`, `actions.ts` (`assertAdmin`), `src/server/auth-guards.ts`, `api/youtube-meta/route.ts` (Phase 6 replaces it) | One `requireAdmin()`; read-only Admins list; audit page maps names |
| `src/lib/audit.ts` | Add entity `admin_auth` and actions for MFA events (types only; columns are free-form) |
| `src/app/actions/contact.ts`, `src/lib/resend.ts` | Support + newsletter through `enqueueEmail`; delete direct sends; `getContactRecipient` stops being the notification target (note: its fallback is `contact@clickitstory.com`, a different domain) |
| `src/lib/queries.ts`, new `src/server/catalog-client.ts` | F1 |
| `custom-worker.ts`, `wrangler.jsonc`, `src/server/cron-schedule.ts`, `scheduled.ts`, `.dev.vars.example`, `src/server/cloudflare.ts` (`WorkerEnv`: `EMAIL_QUEUE`, `RESEND_API_KEY`, `EMAIL_LINK_SECRET`) | Phase 2 files; add `queue()`, bindings, cron route `/api/cron/email-digest` |
| `supabase/config.toml`, `supabase/templates/*`, `supabase/migrations/*` (M1-M3), `supabase/seed.sql` (local admin is created by the script, not seed) | Per F12 and the migration plan |
| `src/messages/{en,ar}.json` | New keys for code UI, onboarding, MFA, Profile; AR parity (49 `auth` keys each today; no parity test exists, add one) |
| Locale switch `navbar.tsx` (4 `<Link locale>`), new `LocaleSync` in `viewer-shell.tsx` | Pattern 7 |

## Sources

### Primary (HIGH confidence)
- Installed packages: `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`, `GoTrueClient.js` (`signInWithOtp`, `verifyOtp`, MFA types, `admin.mfa.deleteFactor`), versions via `package.json` of each package.
- Supabase Auth source (master; local stack runs v2.197.0): `internal/api/{magic_link,otp,verify,mfa,user,mail}.go`, `internal/models/{amr,sessions}.go`, `internal/mailer/templatemailer/*.go`, `internal/utilities/request.go`.
- https://supabase.com/docs/guides/auth/auth-email-templates, /auth/rate-limits, /auth/auth-smtp, /auth/auth-mfa, /auth/auth-mfa/totp, /auth/jwt-fields, /auth/server-side/email-based-auth-with-pkce-flow-for-ssr, /local-development/customizing-email-templates, /reference/javascript/auth-admin-mfa-deletefactor.
- https://www.postgresql.org/docs/current/sql-createview.html (function privileges in views).
- https://developers.cloudflare.com/queues/{platform/limits,platform/pricing,configuration/batching-retries,configuration/javascript-apis,configuration/dead-letter-queues,configuration/local-development,get-started}, /workers/platform/limits, /workers/configuration/cron-triggers, /changelog/post/2026-02-04-queues-free-plan, https://opennext.js.org/cloudflare/howtos/custom-worker, https://developers.cloudflare.com/turnstile/troubleshooting/testing/.
- https://resend.com/docs/dashboard/emails/idempotency-keys, /add-unsubscribe-to-transactional-emails, /api-reference/rate-limit, /pricing.
- https://haveibeenpwned.com/API/v3 (Pwned Passwords).
- Repo: `src/**` files named in the code map, `supabase/migrations/*`, `scripts/migration-guard.mjs`, `.planning/**` (CONTEXT, research, Phase 1 audit and runbook), Phase 2 branch files via `git show`, Phase 6 plans via `git grep`; live probes of the local Mailpit and GoTrue containers (read-only).

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/guides/troubleshooting/customizing-emails-by-language-KZ_38Q (localisation via `.Data`).
- https://react.email/docs/utilities/render; npm registry metadata for `@react-email/render` exports.
- Go issue #45982 (nil interface in `eq`).

### Tertiary (LOW confidence)
- Email-client RTL behaviour (A2); egress-IP sharing (A1); DLQ on Free (A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, versions read from registry and node_modules; no new runtime libraries beyond `resend` and `react-email`.
- Architecture: MEDIUM-HIGH, GoTrue behaviour read from source and docs; Workers-side bundle/CPU is a flagged spike.
- Pitfalls: HIGH for F1-F4, F8, F10-F15 (code or primary docs); MEDIUM for F7, F9, F19.

**Research date:** 2026-10-20
**Valid until:** 2026-11-03 for Cloudflare/Resend limits and package versions (fast-moving); GoTrue behaviours until the project's Supabase version changes.

*GSD / Jev / automation notes for the session:* planning fits `/gsd-plan-phase 5` then `gsd-plan-checker`; a Jev decision fits the deferred support-triage call and a per-attempt "send now / hold" risk gate for first emails to real users (proposal only); an unattended automation agent fits the deferred daily outbox/DLQ health check (proposal only). None is added without Koss's word.
