# Phase 5: Accounts and Email - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 48 new or modified (grouped where one analog serves several)
**Analogs found:** 44 / 48

Notation: `[P2]` = file exists only on `origin/claude/phase-02-execute-19d86a`. Read with `git show "origin/claude/phase-02-execute-19d86a:<path>"` (zsh: use `${B}:path`, a bare `$B:path` is parsed as a modifier). `[HERE]` = on this branch. Line numbers are from the version read on 2026-10-20.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/server/auth/wall.ts` (pure `isPublicPath`) | utility | transform | `src/lib/auth-navigation.ts` [HERE] + `PUBLIC_ALLOWLIST` in `src/proxy.ts:34-43` | role-match |
| `src/server/auth/otp.ts` (normaliseCode, resend countdown) | utility | transform | `src/lib/auth-navigation.ts` [HERE] | role-match |
| `src/server/auth/hibp.ts` | utility | request-response | `src/server/turnstile.ts` [P2] (injected `fetch`, fail-closed result) | role-match |
| `src/server/admin-access.ts` (pure `decideAdminMfa`) | utility | transform | `src/server/cron-auth.ts` [P2] (pure, injected comparator) | role-match |
| `src/server/auth-guards.ts` (`requireAdmin`, `requireAdminUser` wrapper) | service/guard | request-response | `src/server/auth-guards.ts` [P2] itself (modify) | exact |
| `src/server/catalog-client.ts` | service | CRUD (read) | `src/lib/supabase/admin.ts` [HERE] | exact |
| `src/lib/queries.ts` (4 queries move to catalog client) | service | CRUD (read) | itself, lines 480-575, 608, 857 | exact |
| `src/server/email/outbox.ts` (`enqueueEmail`) | service | event-driven (producer) | `rateLimitStore()` in `src/app/actions/contact.ts` [P2] (RPC/insert behind a port) | role-match |
| `src/server/email/consumer.ts` (`processBatch`) | service | event-driven (consumer) | `src/server/scheduled.ts` [P2] (pure, injected deps) + `src/lib/admin/action-runner.ts` [HERE] (env of ports) | role-match |
| `src/server/email/links.ts` (HMAC) | utility | transform | `src/server/cron-auth.ts` [P2] (WebCrypto, constant-time) | role-match |
| `src/server/email/transport.ts` (Mailer port, Resend, Local) | service | request-response | `src/lib/resend.ts` [HERE] | exact |
| `src/server/cloudflare.ts` (`WorkerEnv` add bindings) | config | n/a | itself [P2] lines 21-33 | exact |
| `custom-worker.ts` (add `queue()`) | controller (worker entry) | event-driven | `custom-worker.ts` [P2] `scheduled()` | exact |
| `wrangler.jsonc` (queues, vars, cron) | config | n/a | `wrangler.jsonc` [P2] | exact |
| `src/server/cron-schedule.ts`, `scheduled.ts` (new cron `0 16 * * *`) | config/utility | batch | itself [P2] | exact |
| `src/app/api/cron/email-digest/route.ts` | route | batch | `src/app/api/cron/publish-scheduled/route.ts` [HERE] | exact |
| `src/app/api/email/unsubscribe/route.ts` | route | request-response | `src/app/auth/callback/route.ts` [HERE] (GET redirect route, `NextRequest`) | role-match |
| `src/app/auth/confirm/route.ts` (root redirector) | route | request-response | `src/app/auth/callback/route.ts` [HERE] | exact |
| `src/app/[locale]/(viewer)/auth/confirm/page.tsx` | component (page) | request-response | `.../auth/reset-password/page.tsx` [HERE] | role-match |
| `src/app/[locale]/(viewer)/auth/mfa/page.tsx` + client form | component (page) | request-response | `.../auth/reset-password/page.tsx` + `reset-password-form.tsx` [HERE] | role-match |
| onboarding step ("What should we call you?") | component | request-response | `reset-password-form.tsx` [HERE] | role-match |
| `src/app/[locale]/(viewer)/auth/page.tsx` (code-first, poster, OG) | component (page) | request-response | itself [HERE] | exact |
| `src/app/[locale]/(viewer)/auth/actions.ts` (send/verify code, password, reset, onboarding) | controller (server actions) | request-response | itself [HERE] + `guardAction` in `contact.ts` [P2] | exact |
| `src/components/auth/*` (new `code-input`, `auth-flow`; delete `auth-panel`, `login-form`, `signup-form`, `botid-init`) | component | request-response | `password-field.tsx`, `auth-alert.tsx`, `login-form.tsx` [HERE] | role-match |
| `src/components/security/turnstile-field.tsx` consumers | component | request-response | `turnstile-field.tsx` [P2] | exact |
| `src/components/profile/account-settings.tsx` (+ profile actions) | component | request-response | itself, lines 170-310 [HERE] | exact |
| `src/proxy.ts` + `src/lib/supabase/middleware.ts` | middleware | request-response | themselves [HERE] | exact |
| `src/app/[locale]/admin/layout.tsx` | middleware (gate) | request-response | itself [HERE] | exact |
| `src/app/[locale]/admin/actions.ts` (`assertAdmin`) | controller | request-response | itself, lines 174-197 [HERE] | exact |
| admin Admins list + audit name mapping | component | CRUD (read) | `src/app/[locale]/admin/audit/page.tsx` [HERE] | role-match |
| `src/lib/audit.ts` (`admin_auth` entity) | utility | CRUD (write) | itself [HERE] | exact |
| `src/app/actions/contact.ts` (outbox instead of direct send) | controller | request-response | itself [P2] | exact |
| `src/emails/auth/*.tsx`, `src/emails/app/*.tsx`, `src/emails/messages/{en,ar}.ts` | component (email) | transform | none in repo | no analog |
| `scripts/build-auth-templates.mjs` | utility (build script) | batch/file-I/O | `scripts/media-health.mjs` [HERE] (CLI shape) | partial |
| `scripts/auth-config-check.mjs`, `admin-remove-factor.mjs`, `seed-local-admin.mjs` | utility (owner script) | request-response | `scripts/media-health.mjs`, `scripts/fix-archived-show-duplicates.mjs` [HERE] | partial |
| `scripts/lib/totp.mjs` | utility | transform | RESEARCH.md "TOTP helper" (no repo analog) | no analog |
| `scripts/db-proof.sh` + `supabase/tests/*.sql` | test harness | batch | `/Users/koss/.clickit-checks/p1-scratch-proof.sh` (outside repo) | role-match |
| M1/M2/M3 migrations | migration | CRUD | `20260724115941_restrict_public_episode_access.sql`, `20260530000002_rate_limits.sql`, `20260429010000_create_support_and_newsletter.sql` | role-match |
| `supabase/config.toml`, `supabase/templates/*.html` | config | n/a | `supabase/config.toml:156-312` [HERE] | exact |
| `tests/unit/*.test.ts` (wall, otp, hibp, admin-access, links, consumer, templates...) | test | transform | `tests/unit/scheduled.test.ts` [P2], `auth-navigation.test.ts`, `admin-guards.test.ts` [HERE] | exact |
| `tests/unit/helpers/email-world.ts` | test helper | event-driven | `tests/unit/helpers/video-world.ts` [P2] | exact |
| `tests/e2e/auth-*.spec.ts` + Mailpit helper | test | request-response | `tests/e2e/*` (Playwright; not read, see Metadata) | partial |

## Pattern Assignments

### `src/server/auth-guards.ts` (guard, request-response) — `requireAdmin()`

**Analog:** `src/server/auth-guards.ts` [P2] lines 1-37, plus `assertAdmin` at `src/app/[locale]/admin/actions.ts:174-191` [HERE].

Both currently duplicate the same `getUser()` + `app_config.admin_user_id` check. Replace the body with one `requireAdmin()`; keep both existing names as wrappers (D-17).

**Imports and existing shape** (P2 lines 1-27):
```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function requireAdminUser(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  ...
  if (config?.admin_user_id !== user.id) throw new Error('Unauthorized')
  return user.id
}
```

**Error text contract:** existing callers and `runAdminAction` catch the thrown message and return `{ success:false, error: message }` (`src/lib/admin/action-runner.ts:30-37`). Keep `'Unauthorized'` as the message for not-signed-in and not-admin; use a typed error class with `code: 'needs_enrol' | 'needs_code'` for MFA cases so the message stays safe.

**Pure/impure split to copy:** `decideAdminMfa` goes in `src/server/admin-access.ts` with no imports (see Pattern 1 code in RESEARCH.md lines 281-297); `requireAdmin()` is the thin `server-only` wrapper, same split as `cron-auth.ts` (pure) vs the route (impure).

**Seam for the runner** (`src/lib/admin/action-runner.ts:9-14`): `assertAdmin: () => Promise<{ id: string }>`. `requireAdmin()` returns `{ id, email, displayName }` which is a superset; `adminEnv.assertAdmin` in `actions.ts:193-198` points at it. Lines 597, 633, 673, 721 in `actions.ts` call `assertAdmin()` directly and use `user.id`; keep `.id`.

---

### `src/server/admin-access.ts`, `src/server/auth/otp.ts`, `src/server/auth/wall.ts`, `src/server/auth/hibp.ts`, `src/server/email/links.ts` (pure utilities)

**Analog:** `src/server/cron-auth.ts` [P2] (whole file, 49 lines) and `src/server/client-ip.ts` [P2].

**Rules to copy** (header comment of `cron-auth.ts`, lines 1-6): "Pure: no imports." Injected dependencies for anything runtime-specific; refuse (never fall back to `===`) when the secure primitive is missing.

**WebCrypto digest + injected comparator** (`cron-auth.ts` 8-38) is the template for `links.ts` HMAC verify and for the HIBP SHA-1 step:
```typescript
type Bytes = ArrayBuffer | ArrayBufferView
export type DigestComparator = (a: Bytes, b: Bytes) => boolean
const encoder = new TextEncoder()
async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(text))
}
function runtimeComparator(): DigestComparator | null {
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: DigestComparator }
  if (typeof subtle.timingSafeEqual === 'function') {
    return (a, b) => subtle.timingSafeEqual!.call(subtle, a, b)
  }
  return null
}
```
For HMAC use `crypto.subtle.sign`/`verify` (RESEARCH Pattern 5); tests inject node:crypto where needed.

**Import rule that decides whether node:test can load a module** (RESEARCH Validation section): relative imports with explicit `.ts` extension only, no `@/`, no `server-only`, no `next/*`. Example: `src/server/form-guard.ts:8-9` imports `./rate-limit-policy.ts` and `type ... from './turnstile.ts'`.

**`wall.ts`:** table-driven; copy the matching expression from `src/proxy.ts:34-43` and `:196-198`:
```typescript
const isPublic = PUBLIC_ALLOWLIST.some(
  (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
)
```
Exact `/` and `/portfolio` need exact match (a `startsWith('/')` would open everything). New list per D-01; `/about` leaves it (currently public at line 40).

**`otp.ts` / `safeNext` reuse:** keep `getSafeAuthNextPath` from `src/lib/auth-navigation.ts` (whole file, 28 lines) as the only `next` validator (D-04). Do not copy `safeNext` from `src/app/auth/callback/route.ts:21-39` into new code; call the shared helper.

**`hibp.ts`:** full reference implementation in RESEARCH.md lines 487-500. Repo-style wrapper: result is `boolean | null`, caller logs a `console.warn` on `null` and allows (D-11), matches the "uncertain path" discipline of `TurnstileResult` in `src/server/turnstile.ts` [P2] (opposite polarity: Turnstile fails closed, HIBP fails open; note the difference in the file header).

---

### `src/server/catalog-client.ts` (service, read) and `src/lib/queries.ts` (modify four queries)

**Analog:** `src/lib/supabase/admin.ts` [HERE] lines 1-21.

**Copy the whole pattern** (server-only header, loud failure):
```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('[createAdminClient] NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('[createAdminClient] SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient<Database>(url, key)
}
```
Difference required by RESEARCH Pitfall 2: `createCatalogClient()` must not throw at clean-clone `next build` (placeholder env, no service key). Return `null` or a client whose queries return `[]` and `console.error`, so `getNewEpisodes` etc. degrade. Verify with the clean-clone build command in CLAUDE.local.md.

**Exact call sites to change** (replace `createPublicClient()` with the catalog client; leave the other ~14 `createPublicClient()` callers alone):
- `src/lib/queries.ts:482` `getNewEpisodes` (`.from('episodes_view')` at 487)
- `src/lib/queries.ts:558` `getEpisodesByShowId` (`episodes_view` at 562)
- `src/lib/queries.ts:610` `getEpisodesBySeasonId` (`episodes_view` at 612)
- `src/lib/queries.ts:857` `getComingSoonEpisodes`

Pattern at each site (lines 556-571), `unstable_cache` wrapper stays byte for byte; only the first statement changes:
```typescript
export const getEpisodesByShowId = unstable_cache(
  async (showId: string): Promise<DbEpisode[]> => {
    const supabase = createPublicClient()          // <- createCatalogClient()
    const { data } = await supabase.from('episodes_view').select('*')...
  },
  ['episodes-by-show'],
  { revalidate: 1800, tags: ['episodes'] }
)
```
`getEpisodeById` and `getContinueWatchingEpisodes` (lines 641, 746) use the session client and need no change.

**Source test (AUTH-08):** a `node:test` that reads `src/lib/queries.ts` as text and asserts those four blocks contain no `createPublicClient()`. No repo analog for source-text tests; `tests/unit/admin-actions-id-coverage.test.ts` is the nearest "assert on repo source" precedent (not read; planner should skim it).

---

### `custom-worker.ts` (worker entry, event-driven) — add `queue()`

**Analog:** `custom-worker.ts` [P2] lines 1-40.

**Import and type pattern** (lines 1-12):
```typescript
// @ts-ignore generated at build time (npm run cf:build)
import { default as handler } from './.open-next/worker.js'
import { buildCronRequest } from './src/server/scheduled.ts'

type ScheduledEventLike = { cron: string }
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void }
type CronEnv = { CRON_SECRET?: string }
```
Add `import { processBatch } from './src/server/email/consumer.ts'` (relative, explicit `.ts`, pure module only, same as `scheduled.ts`). Add local structural types `MessageBatchLike`/`MessageLike` (do not depend on `@cloudflare/workers-types`; `src/server/cloudflare.ts:4-8` made the same choice for R2).

**Handler shape to extend** (lines 14-39): add `async queue(batch, env, ctx) { await processBatch(batch, buildDeps(env)) }` as a sibling of `fetch` and `scheduled`. `scheduled()` already dispatches in-process via `handler.fetch(request, env, ctx)` and `ctx.waitUntil`, so the new `0 16 * * *` needs only a `CRON_ROUTES` entry, not new Worker code.

**Error logging convention** (lines 32-35): `console.log('cron:', path, 'status', ...)`, `console.error('cron: threw', path, err instanceof Error ? err.message : 'unknown')`. Log message text only, never bodies or addresses.

---

### `wrangler.jsonc`, `src/server/cron-schedule.ts`, `src/server/scheduled.ts`, `src/server/cloudflare.ts`

**Analog:** the Phase 2 versions of the same files.

**wrangler.jsonc** (lines 13-45): add `"queues": { "producers": [...], "consumers": [...] }` (RESEARCH Pattern 4 block) beside `r2_buckets`; add vars `EMAIL_FROM`, `SUPABASE_URL`, `EMAIL_DIGEST_ENABLED` to the existing `vars` object (lines 39-45). Comment style: `//` with a reason on every non-obvious key. **Trap** (lines 13-20 comment, and RESEARCH Pattern 4): `triggers.crons` is authoritative and currently `[]` until the Phase 3 cutover; Phase 5 must add `0 16 * * *` to whatever list Phase 3 has merged, not replace it.

**cron-schedule.ts** (lines 5-8): add one key.
```typescript
export const CRON_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  '0 1 * * *': '/api/cron/publish-scheduled',
  '0 4 * * 1': '/api/cron/cleanup-media',
  '0 16 * * *': '/api/cron/email-digest',
})
```
`CRON_EXPRESSIONS_FOR_PHASE_3` in `scheduled.ts:17-19` is derived from `Object.keys(CRON_ROUTES)`, so it follows. Update `tests/unit/cron-schedule.test.ts` and `tests/unit/scheduled.test.ts` (both [P2]) which assert the two-entry list.

**cloudflare.ts** (lines 21-33): add `EMAIL_QUEUE: QueueLike`, `RESEND_API_KEY?: string`, `EMAIL_LINK_SECRET?: string`, `EMAIL_FROM?: string`, `EMAIL_DIGEST_ENABLED?: string` using the same comment convention ("secrets are optional because they exist only after the owner sets them").

---

### `src/app/api/cron/email-digest/route.ts` (route, batch)

**Analog:** `src/app/api/cron/publish-scheduled/route.ts` [HERE] lines 1-100 (and its Phase 2 form using `cronAuthOk`).

**Auth guard (current, lines 22-29):**
```typescript
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  const expected = `Bearer ${cronSecret}`
  if (!cronSecret || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```
Do not copy the `!==` compare. Use `cronAuthOk(req.headers.get('authorization'), process.env.CRON_SECRET)` from `src/server/cron-auth.ts` [P2] (constant time; check how Phase 2 rewrote `publish-scheduled` on its branch before copying).

**Core pattern and error shape** (lines 31-99): `try { admin = createAdminClient(); ... return NextResponse.json({ ok: true, ... }) } catch (err) { console.error('[cron/<name>] unhandled failure', err); return NextResponse.json({ ok:false, error: err instanceof Error ? err.message : 'Unknown failure' }, { status: 500 }) }`. Keep the `[cron/email-digest]` log prefix. Gate on `EMAIL_DIGEST_ENABLED === 'on'` (owner step 16) and return `{ ok:true, skipped:'disabled' }` otherwise. Work is set-based RPCs (`build_digest`, `sweep_outbox`) then `EMAIL_QUEUE.sendBatch` (F9).

---

### `src/app/auth/confirm/route.ts` (root redirector) and `src/app/api/email/unsubscribe/route.ts`

**Analog:** `src/app/auth/callback/route.ts` [HERE] lines 1-71.

**Locale resolution to copy** (lines 41-50):
```typescript
function resolveLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && (routing.locales as readonly string[]).includes(cookie)) return cookie
  return routing.defaultLocale
}
```
and the redirect form `NextResponse.redirect(\`${origin}/${locale}/auth?error=...\`)` (lines 65-67). `confirm/route.ts` only forwards to `/${locale}/auth/confirm` with the same query string; it never calls `verifyOtp` (F2). Import `LOCALE_COOKIE` from `@/lib/locale` and `routing` from `@/i18n/routing` as the analog does (lines 1-4).

**Proxy bypass to add** (`src/proxy.ts:117-124`, exact-path inline bypass):
```typescript
if (pathname === '/auth/callback') {
  const { response } = await updateSession(request)
  return response
}
```
Add `|| pathname === '/auth/confirm'`. `/api/*` already bypasses i18n (lines 108-111), so the unsubscribe route needs no proxy change; it must verify the HMAC itself and answer POST with 200/empty and GET with 303 to the public page (F6).

---

### `src/app/[locale]/(viewer)/auth/confirm/page.tsx` and `auth/mfa/page.tsx` (+ client forms)

**Analog:** `src/app/[locale]/(viewer)/auth/reset-password/page.tsx` [HERE] lines 1-50 and `src/components/auth/reset-password-form.tsx`.

**Page shell to copy** (lines 1-49): `generateMetadata` via `getTranslations('auth')`, centered card (`max-w-[440px]`, `rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-[var(--shadow-panel)] sm:p-8`), logo `Image src="/brand/cit-story.png"`, eyebrow `<p className="mb-3 text-xs ... uppercase">`, `<h1 className="font-display text-[28px] ...">`, then the client form. For `confirm/page.tsx` add `referrer: 'no-referrer'` to the metadata (F2).

**Client form conventions:** read `reset-password-form.tsx` (not fully read here; it uses react-hook-form + `PasswordField`, and calls `supabase.auth.updateUser` in the browser at line 53, which D-12/RESEARCH Anti-Patterns require moving to a server action). Feedback uses `AuthAlert` (`src/components/auth/auth-alert.tsx:1-30`, `variant: 'error' | 'success'`, `role="alert"` / `role="status"`).

**Password input:** always `PasswordField` (`src/components/auth/password-field.tsx:1-60`; right-side 44x44 eye, `strengthOf` for the meter, logical `end` for RTL). Project standing rule: every password field has the eye.

---

### `src/app/[locale]/(viewer)/auth/actions.ts` (server actions)

**Analog:** itself [HERE] lines 1-110, combined with `guardAction`/`guardRefusal` in `src/app/actions/contact.ts` [P2] lines 33-107.

**Server-action file shape** (current lines 1-5, 14-22):
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { PASSWORD_MIN } from '@/components/auth/password-rules'

type AuthResult =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: string }
```
Keep the discriminated-result convention (`ok` + `error` key that the client maps with `mapAuthError`, see `src/lib/auth-errors.ts`). Keep the server-side minimum-length re-check (lines 78-80) and add HIBP before `signUp` and every `updateUser({ password })`.

**Replace BotID** (lines 24-48 `logBotSignal`) with Turnstile. Do NOT call `guardPublicForm` here (RESEARCH Anti-Patterns): it runs `siteverify`, spending the single-use token before Supabase sees it. Pass `captchaToken` to Supabase and use only `decideRateLimit` + the `rateLimitStore()` pattern below.

**Rate-limit store and IP** (contact.ts [P2] 33-57 and 85-92), copy verbatim into a shared `src/server/rate-limit-store.ts` rather than a third copy:
```typescript
function rateLimitStore(): RateLimitStore {
  const admin = createAdminClient() as any
  return {
    async count(ip, key, sinceIso) {
      const { count, error } = await admin.from('rate_limits')
        .select('id', { count: 'exact', head: true })
        .eq('key', `${key}:${ip}`).gte('created_at', sinceIso)
      if (error) throw new Error('rate_limits count failed')
      ...
```
```typescript
ip = clientIpFrom(await headers(), { allowLocalOverride: process.env.LOCAL_DEV === '1' })
```

**Admin check after sign-in** (current lines 66-73 read `app_config.admin_user_id` directly): replace with the `admins` lookup helper behind `requireAdmin` (non-throwing variant), because after M2 the table is the source of truth. Do not copy the `app_config` read.

**Profile upsert on sign-up** (lines 96-103) is the pattern for the best-effort profile write (log, do not fail the sign-up). New: set `password_set_at`, `locale`, call `claim_welcome` RPC after verified sign-in.

---

### `src/app/[locale]/(viewer)/auth/page.tsx` (page, code-first + show poster + OG)

**Analog:** itself [HERE] lines 1-135.

Keep: `Promise.all([getFeaturedShows(locale), getAppConfig(), getTranslations('auth'), supabase.auth.getUser(), searchParams])` (lines 29-35); the signed-in redirect (lines 36-46) but compute `isAdmin` via the new admin helper, not `app_config`; the left editorial panel (lines 56-86) and right form column (lines 89-110). Remove: `BotIdInit` (line 54), `AuthPanel` (line 100), the `config.authAllowSkip` skip link block (lines 103-112).

`generateMetadata` currently takes no arguments (lines 14-20). For D-03 change to `generateMetadata({ searchParams })`, read `next`, run it through `getSafeAuthNextPath`, match `/series/<slug>`, and fetch the show with the existing `getShowBySlug` (`queries.ts:577`, cached). Emit `openGraph.title` and `images` from the poster; return no episode or video id.

---

### `src/components/profile/account-settings.tsx` (+ new profile server actions)

**Analog:** itself [HERE].

Browser-side `createClient().auth.updateUser(...)` at lines 180-183 (email) and 291-292 (password) must move to server actions (RESEARCH Anti-Patterns). Keep the surrounding UI: local `saving` state, field-level `setError`, `toast.error/success`, `mapAuthError(error.message)` fallback `tCommon('error')` (lines 187-198, 293-305). Keep the validation order (length, then mismatch, lines 280-288) and add the server-side HIBP result as another mapped error key. "Set a password" vs "Change a password" switches on `profiles.password_set_at`.

---

### `src/proxy.ts` and `src/lib/supabase/middleware.ts` (middleware)

**Analog:** themselves [HERE].

**`updateSession` return shape** (middleware.ts 4-16, 78-92): currently `{ response, userId, checkIsAdmin }` where `checkIsAdmin` queries `app_config`. Extend to return `claims` (`aal`, `amr`, `sub`) from the existing `getClaims()` call at line 71 (no extra network call, Pitfall 6); replace `checkIsAdmin` with an `admins` lookup (service-role or an RPC) or drop it in favour of `requireAdmin`. Keep the "supabase not configured" early return (lines 25-31).

**Cookie-preserving redirect helper to reuse** (proxy.ts 90-97):
```typescript
function redirectWithCookies(url: URL, fromResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  fromResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie)
  })
  return redirect
}
```
Use it for the new `/{locale}/auth/mfa?next=...` redirect.

**Auth gate block to rewrite** (proxy.ts 194-239): the signed-out branch builds `url.pathname = \`/${locale}/auth\`; url.search = \`?next=${pathWithoutLocale}\``. Note the existing code does not URL-encode `next`, and drops the query (RESEARCH Code map: "keep"); use `encodeURIComponent(pathWithoutLocale)`. Remove `isAuthRequiredDespiteSkip`, `SKIP_PROTECTED_ALWAYS`, `isWatchPath` (lines 45-80), the `authAllowSkip` read (line 205) and `BOTID_PREFIX` code (lines 82-88, 126-137; Phase 2 removes BotID, check the merged state).

**Admin branch** (lines 220-230): signed-in non-admin goes to `/${locale}/watch`; add before it: admin at `aal1` or stale `amr.totp` goes to `/${locale}/auth/mfa?next=...` using `decideAdminMfa` from `src/server/admin-access.ts` (claims only).

---

### `src/app/[locale]/admin/layout.tsx` and `actions.ts:assertAdmin`

**Analog:** layout lines 1-45 [HERE].

Current pattern: `getUser()`, redirect to `/watch` via `redirect({ href: '/watch', locale })` from `@/i18n/navigation` when unauthenticated or `config?.admin_user_id !== user.id`. Replace the DB read with `requireAdmin()` in a try/catch; map typed errors: not signed in / not admin to `/watch` (same redirect), `needs_enrol`/`needs_code` to `/auth/mfa?next=/admin`. Keep the render tree (`AdminHeader`, `admin-root` wrapper, lines 33-43) unchanged. Do not move admin into a route group (F10).

---

### `src/lib/audit.ts` (utility)

**Analog:** itself [HERE] lines 17-65.

Extend the unions (lines 17-43) with `AuditEntity` `'admin_auth'` and action values such as `'mfa_enrol'`, `'mfa_unenrol'`, `'login_failed'`. Keep the insert shape (`admin_user_id`, `action_type`, `entity_type`, `entity_id`, `diff`) and the "never throws" rule for `logAudit`; `logAuditStrict` is the one `adminEnv.audit` uses. Types only, no migration (columns free-form, per RESEARCH Code map). Failed sign-in has no admin id: log with the user id if known, otherwise skip.

---

### `src/app/actions/contact.ts` (support and newsletter via outbox)

**Analog:** itself [P2] lines 1-334 (the version after Phase 2 guards). Current branch still has the pre-Phase-2 version.

**Keep exactly:** zod validation then `guardAction('support' | 'newsletter', turnstileToken, limit)` then writes (lines 120-127, 211-218). Keep `GUARD_MESSAGES`/`guardRefusal` (62-75) and the `{ ok:false, code:'unknown', message }` result shape.

**Replace:** the `sendTransactionalEmail` blocks (lines 149-191 support, 269-314 newsletter) and the inline `escapeHtml` (327-334) with `enqueueEmail({ kind, idempotencyKey, to, data })`. Support: after the `support_messages` insert returns `inserted.id`, enqueue `support_ack:<id>` (to the sender, static body) and `support_admin:<id>:<adminUserId>` per `admins` row, `Reply-To` = sender with CR/LF stripped. Newsletter: upsert with `status: 'pending'`, `confirmed_at` untouched for legacy rows, then enqueue `newsletter_confirm:<sub>:<n>`; drop the admin "New newsletter signup" mail and `getContactRecipient()` (lines 109-112). Result statuses `sent | saved_email_failed | already_subscribed | updated_preferences` are in `@/lib/contact`; add a `pending_confirmation` style status only if the UI needs it.

---

### `src/server/email/transport.ts` (Mailer port)

**Analog:** `src/lib/resend.ts` [HERE] lines 1-51.

Keep the discriminated result `{ ok: true } | { ok: false; error: string }` and the plain `fetch` to `https://api.resend.com/emails` with `Authorization: Bearer`. Extend: add `Idempotency-Key` header, `Reply-To`, `headers` (List-Unsubscribe pair), return `{ ok:false, status, retryAfter }` so the consumer can classify 429/5xx/409/4xx (RESEARCH "Resend send" block). Key and `from` come from the injected env (`EMAIL_FROM`, `RESEND_API_KEY`), not `process.env`, because this runs inside the Worker `queue()` handler. Default `from` must be `Clickit Story <no-reply@clickitstory.ae>`; the old `onboarding@resend.dev` default (line 14) goes. `LocalMailer` refuses when `CLICKIT_RUNTIME === 'workers'` (RESEARCH structure note).

---

### `src/server/email/consumer.ts` + `tests/unit/helpers/email-world.ts` + `tests/unit/email-consumer.test.ts`

**Analog (consumer):** `src/server/scheduled.ts` [P2] (pure, only relative imports) and `src/server/form-guard.ts` [P2] lines 23-61 (injected `verify`, `store`, `now`; every uncertain path returns a typed refusal).

**Port-injection signature to copy** (form-guard.ts 23-35): one `input` object whose fields are functions/stores, so tests pass an in-memory world:
```typescript
export async function guardPublicForm(input: {
  token: ...; secret: ...; ip: string | null
  verify: VerifyFn
  rateLimit: { key: string; limit: number; windowMs: number; store: RateLimitStore; now?: () => number }
}): Promise<GuardResult>
```
`processBatch(batch, deps)` takes `{ claimOutbox, finishOutbox, render, send, now }`.

**Analog (test world):** `tests/unit/helpers/video-world.ts` [P2] lines 1-70: header "Shared fake world ... Test-only", `WorldOpts` type with failure switches (`deleteFails`, `commitResult`, `finalizeError`), a `videoWorld(opts)` factory returning ports built on `createFakeSupabase`. `email-world.ts` follows the same shape: `emailWorld(opts)` with in-memory outbox, fake Resend with 24 h key semantics and 409s, fake queue, injectable clock. Note from RESEARCH: `fake-supabase.ts` lacks `upsert`, `ignoreDuplicates`, `.or`, `.lt/.lte/.gte`, so go through small ports rather than extending it.

**Analog (test file):** `tests/unit/scheduled.test.ts` [P2] lines 1-40:
```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCronRequest, ... } from '../../src/server/scheduled.ts'

test('buildCronRequest returns null for a missing, empty or blank secret', () => {
  assert.equal(buildCronRequest('0 1 * * *', ''), null)
```
Flat `test(...)` calls, `node:assert/strict`, explicit `.ts` imports, descriptive sentence names. Run one file with the "Quick run command" in RESEARCH Validation section.

---

### `src/emails/**`, `supabase/templates/*.html`, `scripts/build-auth-templates.mjs`

**No repo analog for React Email.** Planner uses RESEARCH Pattern 3 (sentinels, EN/AR assembled around `{{ if eq .Data.locale "ar" }}`), F19 (separate `src/emails/tsconfig.json` with `jsx: react-jsx`), Pitfall 11 (inline styles, tables, hosted PNG logo on `media.clickitstory.ae`, `dir="rtl"`).

**Closest for the build-script CLI shape:** `scripts/media-health.mjs` [HERE] lines 1-40: shebang, header doc listing flags, `fileURLToPath` import, exported constants, `--json` flag. Make the template builder importable and testable the same way (export functions; run only when invoked directly) so `tests/unit/auth-templates.test.ts` can call it.

**Template test analog:** `tests/unit/migration-guard.test.ts` [HERE] imports `../../scripts/migration-guard.mjs` directly (lines 1-20), the precedent for unit-testing an `.mjs` script's exports.

---

### `scripts/auth-config-check.mjs`, `scripts/admin-remove-factor.mjs`, `scripts/seed-local-admin.mjs`, `scripts/lib/totp.mjs`

**Analog:** `scripts/media-health.mjs` [HERE] (CLI doc header, flags, non-zero exit on failure, no secrets in files) and `scripts/fix-archived-show-duplicates.mjs` [HERE] (owner-run, destructive confirmation; not read, planner should skim for the confirm-prompt pattern).

Rules from CONTEXT/RESEARCH: secrets only from the terminal env (`SUPABASE_SERVICE_ROLE_KEY`, access token), refuse non-local URL in `seed-local-admin.mjs`, write credentials to `/Users/koss/.clickit-checks/local-admin.env` only, `admin-remove-factor.mjs` lists then confirms before `auth.admin.mfa.deleteFactor`. `totp.mjs`: take the reference implementation from RESEARCH.md lines 515-525 (no repo analog), with the RFC 6238 vector test.

---

### `scripts/db-proof.sh` + `supabase/tests/*.sql`

**Analog:** `/Users/koss/.clickit-checks/p1-scratch-proof.sh` (outside the repo, Phase 1) lines 1-60.

Copy: heavy lock `mkdir /Users/koss/.clickit-heavy.lock` with `pid` file and `trap cleanup EXIT`; scratch DB `create database $DB owner postgres` inside `supabase_db_Clickit`; bootstrap with `pg_dump --schema-only --schema=auth --schema=storage --schema=extensions`; strip copied policies/triggers on managed schemas; `create publication supabase_realtime`; `schema_migrations` table; apply every `supabase/migrations/*.sql` with `--single-transaction`; `exit=` line at the end; always drop the scratch DB. Then run `supabase/tests/*.sql` assertions under `set role anon|authenticated|service_role` and `set local request.jwt.claims = '{...}'` (RESEARCH Wave 0 gaps). The repo version must use paths relative to the checkout, not the hard-coded `WT=`.

---

### Migrations M1 / M2 / M3

**Analogs:** `supabase/migrations/20260530000002_rate_limits.sql` (service-role-only table), `20260429010000_create_support_and_newsletter.sql` (table + trigger + policy style), `20260724115941_restrict_public_episode_access.sql` (grants, function privilege, `private.is_admin()`).

**Service-role-only table** (rate_limits, lines 5-17): `create table ... ; create index ...; alter table ... enable row level security; -- No policies on purpose: only service_role ...`. Use for `admins`, `email_outbox`, `notification_sends`, `digest_runs`. Add explicit `grant ... to service_role` (Pitfall 13: no auto-expose).

**Function grants** (restrict_public_episode_access 83-90 and the `reorder_episode` tail):
```sql
revoke all on function public.get_public_youtube_video_id(uuid) from public, anon, authenticated;
grant execute on function public.get_public_youtube_video_id(uuid) to anon, authenticated;
...
revoke all on function public.reorder_episode(uuid, text) from public, anon, authenticated;
grant execute on function public.reorder_episode(uuid, text) to service_role;
```
Every new RPC (`claim_welcome`, `enqueue_email`, `claim_outbox`, `finish_outbox`, `sweep_outbox`, `build_digest`) copies the second form. `security definer set search_path = ''` is the established header (also `handle_new_user` in `20260401000000_create_schema.sql:126-136`).

**`private.is_admin()` current body** (lines 100-112 of the same file) to be replaced in M2 by `create or replace` (keeps grants):
```sql
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) = (select admin_user_id from public.app_config where id = 1) $$;
```
New body in RESEARCH.md lines 448-457 (includes the `Admin manage site-assets` policy rewrite). Existing policy style is `using ((select public.is_admin()))`; current policies were rewritten to `private.is_admin()` by the `do $$` block, so the body swap needs no policy edits (F11).

**Constraint widening for newsletter** (`newsletter_subscribers.status check`, create_support_and_newsletter line ~53): drop + re-add; the guard requires a waiver on the same line, see below.

**Guard waiver syntax** (`scripts/migration-guard.mjs:89`, header example line 12):
```sql
drop policy if exists p on t; -- safe-drop: recreated below
```
Every `drop`, `delete from`, `truncate` line needs `-- safe-drop: <reason>` at the end of that same line. New versions must sort after `20260810120000_broadcast_day_array.sql` (live head) and after Phase 6's migration.

**profiles shape for the new columns** (`20260401000000_create_schema.sql:115-122`): `id uuid pk references auth.users`, `display_name`, `avatar_url`, timestamps. Add `locale`, `onboarded_at`, `password_set_at`, `welcome_sent_at`, `notify_new_episodes default true` as `add column if not exists`. `handle_new_user` already inserts the profile row on signup; `claim_welcome` still does `insert ... on conflict do nothing` because live has 3 auth users and 2 profiles.

---

### `supabase/config.toml` (local stack)

**Analog:** itself [HERE] lines 156-312.

Current values to change (RESEARCH F12): `site_url` (160), `additional_redirect_urls` (164), `[auth.rate_limit] email_sent = 2` (200), `[auth.email] enable_confirmations = false` (227), `max_frequency = "1s"` (233), `otp_expiry = 3600` (237), `[auth.mfa.totp] enroll_enabled/verify_enabled = false` (304-305). Template blocks follow the commented example at lines 247-250:
```toml
# [auth.email.template.invite]
# subject = "You have been invited"
# content_path = "./supabase/templates/invite.html"
```
Add five blocks (`confirmation`, `recovery`, `magic_link`, `email_change`, `reauthentication`). `double_confirm_changes = true` (line 224) is already correct. Local-only: never `supabase config push` (F13).

---

### `tests/e2e/auth-*.spec.ts` and Playwright helpers

**Analog:** existing `tests/e2e/*` and `playwright.config.ts` (`testDir ./tests/e2e`, webServer `npm run dev`). Not read in this pass (directory not listed during the scan); the planner should open one existing spec for fixture and baseURL conventions before writing the three-context cross-device fixture. Mailpit helper code is in RESEARCH.md lines 531-537. Run with `--workers=2` at most, one lane at a time, heavy lock first.

---

## Shared Patterns

### Server-only boundary
**Source:** `src/lib/supabase/admin.ts:1-21`, `src/server/auth-guards.ts` [P2] line 1.
**Apply to:** `catalog-client.ts`, `auth-guards.ts`, `email/outbox.ts`, any module touching the service role key.
```typescript
import 'server-only'
```
Pure modules (`admin-access`, `otp`, `wall`, `hibp`, `links`, `consumer`) must NOT import it, so `node --test` can load them.

### Service-role writes for public / unauthenticated actions
**Source:** `createAdminClient()` in `src/lib/supabase/admin.ts`; `rateLimitStore()` in `contact.ts` [P2] 38-57.
**Apply to:** outbox enqueue, `claim_welcome`, newsletter confirm, unsubscribe, support insert.
RLS on with no policies for new tables; all access via service role or SECURITY DEFINER RPCs with `grant execute ... to service_role` only.

### Fail-closed vs fail-open, stated in the file header
**Source:** `src/server/form-guard.ts:1-6`, `rate-limit-policy.ts:1-5`, `client-ip.ts:1-6` [P2].
**Apply to:** every new `src/server/*` pure module. Open with a 3-6 line comment naming the requirement/threat and which way uncertain paths go. HIBP and digest-disabled are the deliberate fail-open exceptions; admin/MFA, rate limit, link verification, cron auth fail closed.

### Turnstile on auth actions
**Source:** `turnstile-field.tsx` [P2] lines 17-56 (`useTurnstileToken`, `consume`, `awaitingToken`), `form-guard.ts:11,63-72` (`TURNSTILE_FIELD`, `readCaptchaToken`).
**Apply to:** the new code-first form, password sign-in/up, reset. Call `consume()` after every submit attempt (single-use token); disable submit while `awaitingToken`; pass the token to Supabase as `captchaToken`; the same code must work with CAPTCHA off (before Phase 3 cutover) and on.

### Safe redirect target
**Source:** `src/lib/auth-navigation.ts` `getSafeAuthNextPath`.
**Apply to:** `/auth` page, confirm page action, MFA page, onboarding, proxy redirects, `emailRedirectTo` construction. Single validator.

### Admin action wrapper
**Source:** `src/lib/admin/action-runner.ts:9-60` (`AdminActionEnv`, `runAdminAction`).
**Apply to:** the Admins list read, `admin_auth` audit writes. New admin server actions go through `runAdminAction(adminEnv, ...)` so `assertAdmin` and `audit` stay uniform.

### Logging
**Source:** `[auth]`, `[audit]`, `[cron/publish-scheduled]` bracket prefixes in current code; `cron:` prefix in `custom-worker.ts` [P2].
**Apply to:** all new code. Prefix per area (`[auth/otp]`, `[email/consumer]`, `[cron/email-digest]`); never log tokens, codes, addresses, TOTP secrets, QR URIs, or message bodies (RESEARCH Security V7/V8).

### Unit-test shape
**Source:** `tests/unit/scheduled.test.ts` [P2], `tests/unit/auth-navigation.test.ts`, `tests/unit/admin-guards.test.ts` [HERE].
**Apply to:** every new `tests/unit/*.test.ts`: `node:test` + `node:assert/strict`, relative `.ts` imports, flat `test('sentence', ...)`. `npm run test:unit` globs `tests/unit/*.test.ts` and `tests/unit/**/*.test.ts`.

### Migration safety
**Source:** `scripts/migration-guard.mjs` waiver rule; Phase 1 runbook `01-CONTROLLER-RUNBOOK.md`.
**Apply to:** M1, M2, M3. Expand-only, `-- safe-drop:` on the few drop lines, scratch-DB proof, `apply-live-migrations.yml` after Koss approves. No UUIDs or emails in migrations (public repo).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/emails/auth/*.tsx`, `src/emails/app/*.tsx`, `src/emails/messages/{en,ar}.ts` | email component | transform | No email or React Email code exists. Use RESEARCH Pattern 3, F19, Pitfall 11; Phase 4 signed Email board decides the look (D-27). |
| `scripts/lib/totp.mjs` | utility | transform | No TOTP code in repo. RESEARCH.md lines 515-525 has the reference implementation and the RFC 6238 vector. |
| Queue producer binding adapter (`EMAIL_QUEUE.send`, in-process fake for dev/tests) | service | event-driven | No Cloudflare Queue code exists; closest structural precedent is `R2BucketLike` in `src/server/cloudflare.ts` [P2] (local structural type instead of `@cloudflare/workers-types`). |
| Source-text assertion test for catalog client | test | transform | Planner should skim `tests/unit/admin-actions-id-coverage.test.ts` (not read) as the nearest precedent. |

## Metadata

**Analog search scope:** `src/proxy.ts`, `src/lib/**`, `src/lib/supabase/*`, `src/lib/admin/*`, `src/app/[locale]/(viewer)/auth/**`, `src/app/[locale]/admin/{layout,actions}`, `src/app/auth/callback`, `src/app/api/cron/*`, `src/components/auth/*`, `src/components/profile/*`, `supabase/migrations/*`, `supabase/config.toml`, `scripts/*`, `tests/unit/*`, plus Phase 2 branch (`origin/claude/phase-02-execute-19d86a`) files `custom-worker.ts`, `wrangler.jsonc`, `src/server/*`, `src/components/security/turnstile-field.tsx`, `src/app/actions/contact.ts`, `tests/unit/{scheduled,helpers/video-world}.ts`, and `/Users/koss/.clickit-checks/p1-scratch-proof.sh`.
**Files read in full or in targeted ranges:** about 40. Not read: `tests/e2e/*`, `reset-password-form.tsx`, `login-form.tsx`, `admin/audit/page.tsx` body, `admin-actions-id-coverage.test.ts`, `scripts/fix-archived-show-duplicates.mjs`, Phase 3/4/6 branches (Phase 3 `wrangler.jsonc` cron edit and Phase 4 email board will change inputs; re-check before planning wave 1).
**Cross-phase conflicts to flag to the planner:** Phase 5 rewrites files that Phases 2-4 also change (`contact.ts`, `custom-worker.ts`, `wrangler.jsonc`, `proxy.ts`); execution starts after those merge, so excerpts above for `[P2]` files must be re-diffed against `main` at that time. `src/proxy.ts` here still has the BotID branch and `authAllowSkip`; Phase 2 is expected to remove BotID.
**Pattern extraction date:** 2026-10-20
