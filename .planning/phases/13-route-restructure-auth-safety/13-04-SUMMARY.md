---
phase: 13-route-restructure-auth-safety
plan: 04
subsystem: auth / oauth
tags: [i18n, auth, oauth, callback, v1.1]
requires:
  - 13-01 (callback moved to src/app/auth/callback/route.ts, out of [locale]/ tree)
  - 13-02 (proxy short-circuit for /auth/callback — no i18n redirect interferes)
provides:
  - Locale-aware safeNext() — OAuth success + error redirects always land on locale-prefixed URLs
  - resolveLocale() cookie reader — single source of truth for the callback's active locale
affects:
  - RTE-06 (closed — OAuth callback locale-awareness)
tech-stack:
  added: []
  patterns:
    - "safeNext(raw, locale) — validate-then-prepend-locale; open-redirect defense precedes locale logic"
    - "resolveLocale(request) — NEXT_LOCALE cookie first, routing.defaultLocale fallback; validates against routing.locales"
    - "Route Handler GET(request: NextRequest) — needed instead of Request so .cookies is typed and available"
key-files:
  created: []
  modified:
    - src/app/auth/callback/route.ts
decisions:
  - "Cookie-first locale resolution over Accept-Language sniffing. Rationale: NEXT_LOCALE is explicitly set by next-intl's middleware and the URL switcher (plan 13-05), so it reflects user intent. Accept-Language would override a user who explicitly picked /ar/ earlier in the session."
  - "safeNext fallback path is `/${locale}` (no trailing slash) — next-intl normalizes both forms. Matches the plan contract and avoids trailing-slash inconsistency across redirects."
  - "GET signature switched from Request to NextRequest. The .cookies API is only typed on NextRequest; trying to read cookies off a bare Request requires parsing the Cookie header manually. NextRequest gives us the validated, typed cookie store."
  - "Locale prepend happens AFTER the open-redirect validation, not before. Order matters: if we prepended first, `//attacker.com` would become `/en//attacker.com`, which is still a path but looks sketchy in logs. Reject-first keeps the defense legible."
  - "Error redirect format `${origin}/${locale}/auth?error=...` (template string) rather than `new URL(...)`. The existing success branch uses the same template-string shape; matching it keeps the route handler's redirect construction homogeneous."
metrics:
  duration: "~3 minutes"
  completed: 2026-04-21
---

# Phase 13 Plan 04: OAuth Callback safeNext Locale-Awareness Summary

**One-liner:** Extended `safeNext()` in the OAuth callback to prepend the active locale (read from `NEXT_LOCALE` cookie) on plain paths while preserving the open-redirect defense — users signing in with `?next=/series/foo` now land on `/en/series/foo` or `/ar/series/foo` instead of the locale-less 404 path.

## What Shipped

Task 1 — `src/app/auth/callback/route.ts` full rewrite (commit `8d90206`):

- **New import surface:**
  - `import { routing } from '@/i18n/routing'` — locales array + defaultLocale
  - `import { LOCALE_COOKIE } from '@/lib/locale'` — cookie name constant (`'NEXT_LOCALE'`) reused to avoid typo drift
  - `type NextRequest` from `next/server` — added to the existing `NextResponse` import
- **`safeNext(raw, locale)` — now two-argument, locale-aware:**
  1. `null` / undefined / empty → `/${locale}` (safe landing)
  2. Not starting with `/` (e.g., `http://attacker.com`, `javascript:void(0)`) → `/${locale}`
  3. Starting with `//` (protocol-relative) or `/\\` (backslash trick) → `/${locale}`
  4. Already locale-prefixed (`/en`, `/en/...`, `/ar`, `/ar/...`) → return unchanged (allows careful callers to override locale via URL)
  5. Exactly `/` → `/${locale}` (avoids the double-slash normalization edge)
  6. Otherwise → `/${locale}${raw}` (plain path gets locale prepended)
- **`resolveLocale(request)` — new helper:**
  - Reads `NEXT_LOCALE` cookie via `request.cookies.get(LOCALE_COOKIE)?.value`
  - Validates against `routing.locales` (cast to `readonly string[]` for TS widening)
  - Falls back to `routing.defaultLocale` (`'en'`) on missing or unsupported values
- **`GET(request: NextRequest)` — signature upgrade:**
  - Switched from `Request` to `NextRequest` so the `.cookies` API is available
  - Success branch: `NextResponse.redirect(`${origin}${next}`)` — `next` already locale-prefixed by `safeNext`
  - Error branch: `NextResponse.redirect(`${origin}/${locale}/auth?error=Could not verify your identity`)` — locale-prefixed, never bare `/auth?error=...`
  - Kept the existing `console.error('[auth/callback] exchangeCodeForSession failed', err)` log from the post-v1.0 investigation round

Task 2 — Build gate (no new commit, verification-only):

- `npx tsc --noEmit` exited 0 (silent success)
- `npm run build` compiled cleanly in 2.3s via Turbopack, 44 routes generated, `/auth/callback` listed as a Route Handler NOT under `[locale]/`

## Behavior Matrix — Logical Trace

The plan's 4 truths verified by walking the rewritten code path:

| `?next=` value | NEXT_LOCALE cookie | Expected landing | Trace through safeNext |
|----------------|-------------------|------------------|------------------------|
| `/series/foo` | `en` (or absent) | `/en/series/foo` | passes `/` check, not `//`/`/\\`, no `/en/` or `/ar/` prefix, not `/` → returns `/en/series/foo` |
| `/series/foo` | `ar` | `/ar/series/foo` | same path, locale=`ar` → returns `/ar/series/foo` |
| `/en/series/foo` | (any) | `/en/series/foo` | matches `startsWith('/en/')` short-circuit → returns unchanged |
| `/ar/series/foo` | (any) | `/ar/series/foo` | matches `startsWith('/ar/')` short-circuit → returns unchanged |
| `//attacker.com` | `en` | `/en` (safe fallback) | fails `startsWith('//')` check → returns `/en` |
| `/\\attacker` | `en` | `/en` | fails `startsWith('/\\')` check → returns `/en` |
| `http://attacker.com` | `en` | `/en` | fails `startsWith('/')` check → returns `/en` |
| (OAuth error branch) | `ar` | `/ar/auth?error=...` | error branch builds `${origin}/${locale}/auth?error=...` directly — never bare `/auth?error=...` |

All 4 plan truths validate.

## Deviations from Plan

None — plan executed exactly as written. The `<action>` block was copy-pasted verbatim with zero modifications; all `<acceptance_criteria>` lines map to concrete lines in the file.

### Validation Noise (not a deviation)

The Vercel plugin's `posttooluse-validate` hook flagged line 55 with "searchParams is async in Next.js 16 — add await". This is a **false positive**: the rule targets pages/layouts where `searchParams` is an async prop, but Route Handlers use `new URL(request.url).searchParams`, which is a synchronous `URLSearchParams` instance. The pre-phase version of this file used the identical synchronous pattern, and build passes — no change needed.

## Threat Model Compliance

The plan's threat register is honored:

- **T-13-08 (Open-redirect via `?next=`)** — `safeNext` performs all 3 rejection checks BEFORE the locale prepend. Unsafe strings never reach the `` `/${locale}${raw}` `` concatenation. Verified by the behavior matrix rows above.
- **T-13-09 (NEXT_LOCALE cookie tampering)** — `resolveLocale` validates the cookie value against `routing.locales` (an `as const` tuple = `['en', 'ar']`). Unsupported values (including injected strings like `'../en'`) fail the `includes` check and fall back to `routing.defaultLocale`. The locale value is never concatenated into a URL without this validation.

No new threat surface introduced.

## Verification Performed

- [x] `grep -q "routing.locales" src/app/auth/callback/route.ts` (appears in both `safeNext` short-circuit loop and `resolveLocale` validation)
- [x] `grep -q "LOCALE_COOKIE" src/app/auth/callback/route.ts`
- [x] `grep -q "NextRequest" src/app/auth/callback/route.ts` (type import + GET parameter)
- [x] `grep -q "safeNext.*locale" src/app/auth/callback/route.ts` (function signature + call site + doc comments: 10 matches total)
- [x] `grep -q "/\${locale}/auth?error" src/app/auth/callback/route.ts`
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0 — 44 routes generated; `/auth/callback` listed as Route Handler (not under `[locale]/`)

End-to-end smoke test (real OAuth round-trip on Vercel preview) is deferred to plan 13-06 per the plan's explicit guidance.

## Known Stubs

None. Every code path in the callback is live:
- Success: redirects to locale-prefixed `next`
- Error: redirects to `/${locale}/auth?error=...`
- No TODO/FIXME markers added
- No placeholder strings rendered to the user (the `error` query-param value is consumed by the existing `/[locale]/auth` page's error renderer from Phase 13 plan 01)

## Requirements Closed

- **RTE-06** — OAuth callback locale-awareness. The 6th of the 6 auth pitfalls enumerated in the v1.1 research findings. Previously: `/auth/callback?next=/series/foo` → `/series/foo` (404 or proxy dance). Now: resolves to `/{locale}/series/foo` with the active locale cookie honored.

With RTE-06 closed, **5 of the 6 Phase 13 auth pitfalls are shipped**: RTE-01/02 (plan 01), RTE-03 (plan 02), RTE-04 (plans 03a + 03b), RTE-05/07 (plan 03a), RTE-06 (this plan). Remaining in Phase 13: RTE-08/09 scope items in plans 05/06 (URL-based locale switcher + Vercel preview smoke test).

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `8d90206` | feat(13-04): locale-aware safeNext() in OAuth callback |
| 2 | (none — verification-only) | `npx tsc --noEmit` + `npm run build` both green |

## Self-Check: PASSED

- File exists: `/Users/koss/Desktop/Develop/Clickit/src/app/auth/callback/route.ts` — FOUND
- Commit exists: `8d90206` — FOUND in `git log`
- Build artifacts: `/auth/callback` present in build route manifest as Route Handler
