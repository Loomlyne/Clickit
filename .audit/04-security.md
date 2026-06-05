# Security Audit — Clickit Story (CIT) Platform

**Date:** 2026-05-30  
**Scope:** RLS, Auth/Authz, Server Actions, Service Role, Secrets/Env, Abuse, Storage  
**Auditor:** Senior Application Security Engineer (automated review)

---

## Summary

- **BotID is wired but deliberately non-blocking** — when it detects a bot (or throws), the code explicitly returns `null` and passes the request through. Sign-up and sign-in are unprotected against credential stuffing and account-creation spam in practice.
- **GA/Meta pixel IDs admin-editable are injected raw into `<Script>` tags** without regex validation, creating a stored XSS vector: a malicious string injected into `googleAnalyticsId` or `metaPixelId` executes as JavaScript for every visitor.
- **Reviews have no unique constraint on `(user_id, show_id)`** and are inserted directly from the browser client via anon RLS — a logged-in user can flood any show with hundreds of reviews with zero server-side rate limiting.
- **No HTTP security headers** (CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are set globally in `next.config.ts`; the app is susceptible to clickjacking and MIME sniffing attacks.
- `admin_user_id` on `app_config` is nullable with no NOT NULL constraint; if it were ever set to NULL (or if the row were deleted), `is_admin()` would return NULL (falsy in Postgres boolean context), effectively locking the admin out but this also means the is_admin function silently returns false rather than erroring — a subtle footgun.
- **SVG uploads accepted for favicon and social icons** (`uploadSiteImage`, `uploadSocialIcon`) — SVGs are stored in a public bucket and served as-is; inline SVG `<script>` payloads are not sanitized.

---

## Findings

| # | Issue | Severity | Location (file:line) | Risk / Impact | Recommended Fix | Effort |
|---|-------|----------|----------------------|---------------|-----------------|--------|
| 1 | **BotID non-blocking** — when `result.isHuman` is false, `gateAgainstBots()` logs a warning and returns `null` (allow). The comment says "BotID has produced false negatives" but the current code means bots are **never blocked** at the signIn/signUp gate. | High | `src/app/[locale]/(viewer)/auth/actions.ts:36-44` | Credential stuffing, mass account creation, brute-force login — auth rate limiting is entirely absent | Return `{ ok: false, error: 'bot_detected' }` when `!result.isHuman`. Consider Supabase Auth's built-in rate limits as a fallback. | S |
| 2 | **Stored XSS via GA/Pixel ID injection** — `googleAnalyticsId` and `metaPixelId` (admin-editable, max 40 chars, no format regex) are interpolated raw into `<Script>` tag bodies in `layout.tsx:151` and `layout.tsx:168`. A malicious value like `'; alert(1); //` executes for every viewer. Admin is trusted but this is still a stored XSS risk if admin account is compromised. | High | `src/app/[locale]/layout.tsx:151,168` + `src/app/[locale]/admin/actions.ts:1899-1900` | Full client-side JavaScript execution for all visitors | Add regex validation in `integrationsSchema`: GA IDs must match `G-[A-Z0-9]+` or `UA-\d+-\d+`; Meta Pixel IDs must match `\d{15,16}`. Never interpolate user-controlled strings into script bodies. | S |
| 3 | **No UNIQUE constraint on reviews `(user_id, show_id)`** — the DB schema has no constraint preventing a user from submitting unlimited reviews per show. The insert goes directly from browser to Supabase (no Server Action). Combine with real-time subscriptions and you get easy review-bombing. | High | `supabase/migrations/20260424000000_create_reviews_table.sql:1-31`, `src/components/series/review-composer.tsx:91-96` | Any authenticated user can post hundreds of reviews on a show, polluting ratings and flooding the real-time channel | Add `UNIQUE (user_id, show_id)` constraint to `reviews` table. Also move the insert to a Server Action so server-side validation (rate limiting, profanity filter) can be applied. | S |
| 4 | **No HTTP security headers globally** — `next.config.ts:headers()` only sets `Cache-Control` on `/brand/*`. No CSP, no `X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy`, no `Permissions-Policy`, no `Strict-Transport-Security`. | High | `next.config.ts:37-46` | Clickjacking of the admin panel, MIME sniffing, information leakage via Referer, absence of HSTS in case TLS is misconfigured | Add a global headers block with at minimum: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=()`. For CSP, start in report-only mode. | M |
| 5 | **SVG uploads stored in public bucket without sanitization** — `uploadSiteImage` (favicon) and `uploadSocialIcon` both accept `image/svg+xml` and store the raw file bytes in the public `site-assets` bucket. Supabase serves them with the original `Content-Type: image/svg+xml`. An SVG with embedded `<script>` tags executes in any browser that opens the file URL directly. Since the admin is a single trusted user this is lower probability, but the surface exists. | Medium | `src/app/[locale]/admin/actions.ts:2236`, `src/app/[locale]/admin/actions.ts:2323` | XSS via direct navigation to a stored SVG URL; relevant if SVG URLs are ever used as `<img src>` attributes with inline rendering or if the admin account is phished | Strip SVG uploads server-side before storage (use a library like `dompurify` server-side or `svg-sanitizer`), or reject SVG entirely for favicon/social icons (PNG/WebP suffice). | M |
| 6 | **`admin_user_id` is nullable with no enforcement** — column is defined as `uuid` (no `NOT NULL`). The seed inserts `NULL`. If the admin UUID row were ever cleared, `is_admin()` returns `NULL` in Postgres boolean context, which silently fails admin checks without any alert. There is no migration that enforces `NOT NULL` or that sets a default admin. | Medium | `supabase/migrations/20260401000000_create_schema.sql:33`, `supabase/migrations/20260401000001_create_rls_policies.sql:16-24` | If `admin_user_id` is set to NULL accidentally (e.g., via Supabase Studio), admin route is locked out silently; no alerting mechanism | Add `NOT NULL` constraint to `admin_user_id` after the admin UUID is set in production. Add an `assertAdmin()` guard that throws loudly if `config` is null (currently it would throw only on the `!== user.id` comparison). | S |
| 7 | **Contact form and newsletter signup have no rate limiting or bot protection** — `submitSupportMessage` and `subscribeToNewsletter` in `src/app/actions/contact.ts` are plain Server Actions with only Zod validation. No BotID check (unlike auth actions), no IP-based throttle, no honeypot field. | Medium | `src/app/actions/contact.ts:33,120` | Spam flood of support@, Resend API quota exhaustion, storage of junk in `support_messages` and `newsletter_subscribers` | Add BotID check (reuse `gateAgainstBots()` pattern from auth) or add a Cloudflare Turnstile/hCaptcha token to these forms. At minimum add a server-side check on Resend send frequency per email address. | M |
| 8 | **`server-only` package not imported in `src/lib/supabase/admin.ts`** — the file has a comment warning it must never be imported in client components, but does not use `import 'server-only'` to enforce this at build time. A developer could accidentally import it in a Client Component, causing `SUPABASE_SERVICE_ROLE_KEY` to be bundled into the client bundle. | Medium | `src/lib/supabase/admin.ts:1-18` | `SUPABASE_SERVICE_ROLE_KEY` leakage to browser if accidentally imported in a client boundary | Add `import 'server-only'` as the first line of `admin.ts`. This causes a build-time error if the module is ever imported into a client-side bundle. | S |
| 9 | **Supabase project hostname hardcoded in client component** — `lajguozmtissnnfccmej.supabase.co` is hardcoded in `src/components/layout/entry-preload.tsx:12`. This is not a secret (it's the same value as `NEXT_PUBLIC_SUPABASE_URL`) but hardcoding it means if the project changes it must be found manually. | Low | `src/components/layout/entry-preload.tsx:12` | Information exposure of project ID; no security impact if the URL is already public | Replace with `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/...` | S |
| 10 | **CRON_SECRET: empty-string bypass** — `cleanup-media/route.ts:54` checks `!process.env.CRON_SECRET` before comparing the header. If `CRON_SECRET` is set to an empty string, the check passes the guard because `!''` is `true`, effectively disabling auth. | Low | `src/app/api/cron/cleanup-media/route.ts:54` | Unauthenticated trigger of the cleanup cron if env var is misconfigured as empty string | Change check to `if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16 || ...)` or use `CRON_SECRET?.length` check. | S |
| 11 | **No `server-only` on `src/lib/config.ts`** — `getYouTubeApiKey()` reads the server-side-only YouTube API key via `createAdminClient()`. If `config.ts` were ever imported into a client boundary, the function call would fail but could still leak the import path. | Low | `src/lib/config.ts:351-366` | Low risk currently; belt-and-suspenders: `getYouTubeApiKey` should be in a server-only module | Add `import 'server-only'` to `config.ts` or split `getYouTubeApiKey` into a separate server-only utility. | S |
| 12 | **GA/Pixel IDs exposed to all users via `getAppConfig()` cache** — `googleAnalyticsId` and `metaPixelId` are included in the public cache (15min, `anon` role readable). While these IDs are technically "public" tracking codes, they are stored alongside more sensitive config and the cache key `['app-config-v2']` is not namespaced. | Low | `src/lib/config.ts:184-186` | Minor: tracking IDs visible to anyone who inspects rendered HTML anyway | No immediate action needed. Note for future: separate sensitive config from public config. | L |

---

## Top 3 Must-Fix

### 1. Fix BotID to actually block bots (`src/app/[locale]/(viewer)/auth/actions.ts:36-44`)

Currently `gateAgainstBots()` returns `null` (allow) on both failure and bot detection. Change the bot-detected branch:

```typescript
if (!result.isHuman) {
  return { ok: false, error: 'Request blocked. Please try again.' }
}
```

Keep the error-catch branch as allow-through (availability priority) but the `!isHuman` branch must block.

### 2. Validate GA/Pixel IDs with strict regex before storing (`src/app/[locale]/admin/actions.ts:1898-1901`)

```typescript
const integrationsSchema = z.object({
  google_analytics_id: z.string().trim().max(40)
    .regex(/^(G-[A-Z0-9]+|UA-\d+-\d+|AW-\d+)?$/, 'Invalid GA ID format')
    .nullable(),
  meta_pixel_id: z.string().trim().max(20)
    .regex(/^\d{10,20}$|^$/, 'Invalid Pixel ID format')
    .nullable(),
  youtube_api_key: z.string().trim().max(100).nullable(),
})
```

This prevents injection of arbitrary strings into `<Script>` tag bodies.

### 3. Add `UNIQUE (user_id, show_id)` to reviews table

```sql
ALTER TABLE reviews ADD CONSTRAINT reviews_user_show_unique UNIQUE (user_id, show_id);
```

Deploy this as a new migration. Also move review submission to a Server Action with auth verification.

---

## Hardening Backlog

| Priority | Task | Notes |
|----------|------|-------|
| P1 | Add `import 'server-only'` to `src/lib/supabase/admin.ts` | Build-time guarantee service role key stays server-side |
| P1 | Add global HTTP security headers in `next.config.ts` | X-Frame-Options, X-Content-Type-Options, Referrer-Policy minimum; CSP report-only to start |
| P1 | Add rate limiting to contact/newsletter Server Actions | BotID check or Upstash Redis rate limiter by IP |
| P2 | Strip/reject SVG in `uploadSiteImage` and `uploadSocialIcon` | Use `svg-sanitizer` or whitelist PNG/WebP/ICO only |
| P2 | Add `NOT NULL` to `app_config.admin_user_id` after prod setup | Prevents accidental lockout/null-admin confusion |
| P2 | Add `import 'server-only'` to `src/lib/config.ts` or split `getYouTubeApiKey` | Belt-and-suspenders for API key containment |
| P3 | Move review insert to Server Action | Enables server-side rate limiting, profanity filter, one-review-per-user enforcement |
| P3 | Fix CRON_SECRET empty-string bypass | `if (!process.env.CRON_SECRET?.trim())` |
| P3 | Replace hardcoded Supabase project hostname in `entry-preload.tsx` | Use env var for maintainability |
| P4 | Evaluate Supabase Auth built-in rate limiting | Currently no fallback if BotID is down; Supabase has built-in email OTP rate limits but not password login |
| P4 | Content Security Policy (enforce mode) | After CSP report-only baseline is established — YouTube embed requires `frame-src youtube.com` |
