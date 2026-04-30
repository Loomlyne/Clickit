# Phase 13: Route Restructure + Auth Safety - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** Approved execution plan at `/Users/koss/.claude/plans/do-you-those-in-snuggly-pinwheel.md` + ROADMAP.md + REQUIREMENTS.md + Phase 12 SUMMARY handoff

<domain>
## Phase Boundary

**Atomic route restructure.** Move every page in the codebase under `src/app/[locale]/...` and fix all 6 latent auth/routing pitfalls in the same PR. Replace the Phase-12-deleted-code candidates (`src/app/locale-actions.ts`, `src/components/layout/locale-switcher.tsx`, `src/components/profile/language-preference.tsx`) with a next-intl navigation-based URL switcher.

**Highest risk phase of v1.1.** Supabase session loss on locale redirect is a user-visible regression — they get silently logged out. This MUST be tested on a Vercel preview deployment with a real login before merging to main.

**Critical invariant:** The 6 pitfalls fix **atomically**. Never split them into separate PRs. The codebase is broken in between — middleware routes to `[locale]`, pages aren't there yet; or pages move, middleware doesn't redirect; or cookies leak, users get logged out. Full atomic deployment only.

After Phase 13: URLs become `/en/...` and `/ar/...`. Deep links work. Auth works. Locale prefix is preserved across every navigation. The site is still entirely in English strings — translation happens in Phases 15/16.

</domain>

<decisions>
## Implementation Decisions

### Route restructure (locked)

**Page directory moves (preserving route groups):**
- `src/app/(viewer)/**` → `src/app/[locale]/(viewer)/**`
- `src/app/admin/**` → `src/app/[locale]/admin/**`
- `src/app/design-system/**` → `src/app/[locale]/design-system/**` (internal tooling, gets moved for consistency even though its UI stays EN-only per VW-14)
- `src/app/auth/callback/route.ts` — stays at `src/app/auth/callback/route.ts` (OAuth providers are registered at this exact URL; cannot move). The route handler internally handles locale via `safeNext()`.

**Root layout slimming:**
- `src/app/layout.tsx` — stays (Next.js requires a root layout). Slims to: `<html>` + `<body>` + minimum global providers. No `getLocale()` read, no `dirFor()` call, no Cairo font activation — all of that migrates to `[locale]/layout.tsx`.
- `src/app/[locale]/layout.tsx` — NEW. Sets `<html lang={locale} dir={dirFor(locale)}>`… wait, that's wrong. `<html>` is owned by the root layout. The `[locale]/layout.tsx` can ONLY set `<html>` if the root layout doesn't. **Decision:** Keep `<html>` in root layout (`src/app/layout.tsx`) but defer `lang` and `dir` to the `[locale]/layout.tsx` via React's `setAttribute` — NO. That's wrong too. **Final decision:** Move `<html>` ownership to `[locale]/layout.tsx` by making the root layout return only `{children}` (which Next.js App Router allows — the root layout's `<html>` and `<body>` are not strictly required when a deeper layout provides them, as long as exactly one layout in the tree provides them). Verify this against next-intl's documented pattern for App Router. The next-intl docs explicitly show `<html>` on `[locale]/layout.tsx` — follow that pattern.

**`[locale]/layout.tsx` responsibilities (delivered in Phase 13, NOT Phase 14):**
- Receive `locale` from `params` (awaited — `const { locale } = await params`)
- Validate locale against `routing.locales`; `notFound()` if invalid
- Call `setRequestLocale(locale)` for static rendering support
- Export `generateStaticParams` re-exporting `staticParams` from `src/i18n/routing.ts`
- Wrap children in `<NextIntlClientProvider>` (loads messages for the active locale)
- Set `<html lang={locale} dir={dirFor(locale)}>` at this layout (moved from root)
- Cairo font activation deferred to Phase 14 — Phase 13 keeps the current font setup

### The 6 atomic auth/routing fixes (all in the same PR)

**Pitfall 1 — Supabase session cookie loss on locale redirect (proxy.ts composition)**

In `proxy.ts`, the composition order is: next-intl middleware runs first (handles locale redirects for missing prefix), then Supabase `updateSession` runs on the response. CRITICAL: when next-intl returns a redirect, its cookies live on the redirect response. When `updateSession` refreshes Supabase auth cookies, those live on its own response. Without merging, users redirecting from `/` to `/en/` silently lose their session.

Pattern (from research SUMMARY lines 108-123):
```ts
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const handleI18nRouting = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const intlResponse = handleI18nRouting(request)
  if (intlResponse.status !== 200) {
    // It's a redirect — Supabase cookies need to live on this response
    const { supabaseResponse } = await updateSession(request)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      intlResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return intlResponse
  }
  // Normal request — chain Supabase cookies onto the i18n response
  const { response: supabaseResponse } = await updateSession(request, intlResponse)
  return supabaseResponse
}
```

The actual `updateSession` signature in `src/lib/supabase/middleware.ts` returns `{ response, userId, checkIsAdmin }` per memory. Verify the exact signature; planner may need to adjust the composition call. `updateSession` must either accept the i18n response as a base (preferred) OR be called separately and have its cookies merged onto the i18n response.

Also: the coming-soon redirect path inside `proxy.ts` (currently `url.pathname = '/coming-soon'` at line 41 per earlier verification) must preserve the incoming locale prefix. Parse `/en/...` or `/ar/...` from `request.nextUrl.pathname`, and redirect to `/${locale}/coming-soon`.

**Pitfall 2 — `useRouter` / `Link` from `next/navigation` strips locale (16 files to swap)**

Every client component that imports `Link`, `useRouter`, `usePathname`, `redirect`, or `permanentRedirect` from `next/navigation` must swap to `@/i18n/navigation`. Verified by earlier exploration: 16 files. The planner must enumerate these in the plan. List (from earlier verification):
1. `src/components/auth/login-form.tsx`
2. `src/components/auth/signup-form.tsx`
3. `src/components/auth/reset-password-form.tsx`
4. `src/components/layout/user-dropdown.tsx`
5. `src/components/layout/auth-section.tsx`
6. `src/components/layout/locale-switcher.tsx` **(deleted in RTE-08, no swap needed)**
7. `src/components/layout/mobile-nav.tsx`
8. `src/components/layout/nav-links.tsx`
9. `src/components/layout/user-avatar.tsx`
10. `src/components/profile/profile-header.tsx`
11. `src/components/watch/watch-page-content.tsx`
12. `src/components/series/season-tabs.tsx`
13. `src/components/admin/admin-header.tsx`
14. `src/app/design-system/layout.tsx` (moves to `src/app/[locale]/design-system/layout.tsx`)
15. Hook file (TBD — planner confirms via grep)
16. Hook file (TBD — planner confirms via grep)

**What NOT to swap:** Server Components and Route Handlers. `redirect` from `next/navigation` in Server Components redirecting to an absolute path like `/auth` must instead use `redirect` from `@/i18n/navigation` passing just the path — next-intl prepends the locale.

**Pitfall 3 — Hard-coded `/auth/login` redirects become locale-aware (5+ sites)**

Verified earlier: `router.push('/admin')`, `router.push('/')`, redirect pattern `/auth/callback?next=/auth/reset-password`, `redirect('/auth?error=...')`. All must use `redirect` / `useRouter` from `@/i18n/navigation`. Planner grep for `router\.push\(['"]/auth`, `redirect\(['"]/auth`, `href=['"]/auth` — fix every occurrence.

**Pitfall 4 — `safeNext()` in auth callback preserves locale**

File: `src/app/auth/callback/route.ts` (route handler — stays at this non-localized path because OAuth providers register exact callback URLs).

Current `safeNext()` validates `?next=` is a single-leading-slash path to prevent open redirects. Must be extended to: accept paths starting with `/en/` or `/ar/` AND plain paths. When a plain path comes in (e.g., `/series/last-call`), prepend the active locale (from the referer or a cookie hint; if neither, default to `en`).

Return from the callback: `redirect(safeNext(url, locale))` where locale is derived. Planner must decide the locale-inference strategy — the simplest is "read `NEXT_LOCALE` cookie if set, else `en`". Cookie persistence already exists from v1.0.

**Pitfall 5 — `coming-soon` redirect in `proxy.ts` locale-aware**

Currently in `proxy.ts` line 41 (per earlier verification): `url.pathname = '/coming-soon'`. Change to `url.pathname = \`/${locale}/coming-soon\`` where `locale` is parsed from `request.nextUrl.pathname`. If the path has no locale prefix yet (user hit the root), default to `routing.defaultLocale`.

**Pitfall 6 — Sitemap `alternates.languages`**

`src/app/sitemap.ts` currently emits entries without language alternates. Update every static entry AND every dynamic show entry to include:
```ts
alternates: {
  languages: {
    en: `${siteUrl}/en${path}`,
    ar: `${siteUrl}/ar${path}`,
  },
},
```

This tells Google to index `/en/series/foo` and `/ar/series/foo` as language variants, not duplicates. Also audit `src/app/robots.ts` for language-agnostic rules (no changes needed — both locales are crawlable by default).

### New URL switcher (replaces dead code)

**Delete in Phase 13:**
- `src/app/locale-actions.ts` — the `setLocaleAction` server action (writes cookie + revalidates layout)
- `src/components/layout/locale-switcher.tsx` — cookie-based toggle in navbar (already removed from navbar in commit beaa644, but file still exists)
- `src/components/profile/language-preference.tsx` — cookie-based radio card on profile page (shipped beaa644)

**Create in Phase 13:**
- `src/components/profile/language-preference.tsx` — REPLACED (same filename, new implementation). Uses `useRouter`, `usePathname` from `@/i18n/navigation` to call `router.replace(pathname, { locale: nextLocale })`. The pathname helper strips the current locale, and `replace` re-prepends the new one. No cookie write. No server action. URL is the source of truth.

### site-url.ts locale-awareness audit (RTE-09)

`src/lib/site-url.ts` currently resolves `NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL → localhost`. After Phase 13, verify:
- `metadataBase` in root layout still points to a locale-agnostic base URL (no `/en/` suffix — metadataBase is the canonical root)
- Per-page metadata uses `alternates.canonical` to reference locale-specific canonicals
- Sitemap uses `siteUrl()` + locale prefix explicitly (not `metadataBase`)

No code changes to `site-url.ts` itself expected — audit confirms callers still pass absolute-valid URLs after the restructure.

### Preserve unchanged (locked)
- `src/lib/locale.ts` — `dirFor`, `pickLocalized`, `getLocale`, `Locale` type stay byte-identical
- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `src/messages/*.json` — Phase 12 output stays as-is, now consumed by pages + middleware
- Supabase client files — `src/lib/supabase/{server,browser,middleware}.ts` untouched except if `updateSession` signature needs adjustment for proxy.ts composition (minimal change if any)
- `src/app/auth/callback/route.ts` location — stays at this path (OAuth callback URL is registered with providers)
- `package.json` — no new deps, already has next-intl@^4.9.1

### Claude's Discretion
- Naming of the new URL switcher component (filename stays `language-preference.tsx` for drop-in replacement; internal implementation is novel)
- Exact logic for locale inference in `safeNext()` (cookie read vs referer parse — recommend cookie)
- Whether to split `[locale]/layout.tsx` into multiple nested layouts (recommend: one for the locale wrapper, keep existing viewer/admin route group layouts unchanged)
- How to sequence the route moves (recommend: create `[locale]/` skeleton first, move route groups one at a time, verify after each)

### Build-safety invariants (verification tasks)
- `npx tsc --noEmit` clean
- `npm run build` succeeds; every route renders in both `/en/` and `/ar/` variants
- `grep -rE "from ['\"]next/navigation['\"]" src/components src/app --include="*.tsx"` returns ZERO results for `Link`, `useRouter`, `usePathname`, `redirect`, `permanentRedirect` — only Server Components should import `redirect` from `next/navigation`, and even those should prefer `@/i18n/navigation`
- `grep -rE "router\.push\(['\"]\/auth|redirect\(['\"]\/auth|href=['\"]\/auth" src` shows only hits going through `@/i18n/navigation`
- Manual smoke test on Vercel preview: (1) sign in, land on `/en/profile` — session persists; (2) switch locale — land on `/ar/profile` with same session; (3) hit `/` — redirect to `/en/` with cookies intact; (4) OAuth callback from a `?next=/series/foo` query works and lands on `/en/series/foo` (or `/ar/` if cookie says so)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved scope + upstream decisions
- `/Users/koss/.claude/plans/do-you-those-in-snuggly-pinwheel.md` — the user-approved execution plan; Phase 13 section is the source of truth for this phase's scope
- `/Users/koss/Desktop/Develop/Clickit/.planning/PROJECT.md` — milestone v1.1 goal, scope strategy
- `/Users/koss/Desktop/Develop/Clickit/.planning/REQUIREMENTS.md` — RTE-01..09 this phase must close (I18N-05 and I18N-06 also close here as Phase 12 handed off prerequisites)
- `/Users/koss/Desktop/Develop/Clickit/.planning/ROADMAP.md` — Phase 13 success criteria (5 criteria)
- `/Users/koss/Desktop/Develop/Clickit/.planning/phases/12-i18n-infrastructure/12-01-SUMMARY.md` — Phase 12 handoff: what was built, what's available for Phase 13 to wire

### Architecture research (must read before planning)
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/SUMMARY.md` — sections:
  - "Proxy.ts Composition Pattern" (lines 108-123) — the exact cookie-merge pattern
  - "Pitfalls > Critical" (lines 127-135) — the 6 atomic fixes
  - "New Files" table (lines 88-96)
  - "Modified Files" table (lines 98-105)
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/ARCHITECTURE.md` — detailed blueprints for `[locale]/layout.tsx`, proxy composition, auth-callback locale handling
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/PITFALLS.md` — deeper per-pitfall discussion

### Existing code (must read before planning)
- `/Users/koss/Desktop/Develop/Clickit/proxy.ts` — current shape (Supabase-only, not yet composed with i18n)
- `/Users/koss/Desktop/Develop/Clickit/src/lib/supabase/middleware.ts` — `updateSession` signature, cookie handling
- `/Users/koss/Desktop/Develop/Clickit/src/app/layout.tsx` — current root layout (reads locale from cookie, sets html dir/lang, loads Cairo font — all of this moves to `[locale]/layout.tsx`)
- `/Users/koss/Desktop/Develop/Clickit/src/app/auth/callback/route.ts` — `safeNext()` implementation (must extend for locale)
- `/Users/koss/Desktop/Develop/Clickit/src/app/sitemap.ts` — current sitemap (needs `alternates.languages`)
- `/Users/koss/Desktop/Develop/Clickit/src/lib/locale.ts` — must NOT change
- `/Users/koss/Desktop/Develop/Clickit/src/i18n/routing.ts` — Phase 12 output; source of `routing` + `staticParams` + `Locale`
- `/Users/koss/Desktop/Develop/Clickit/src/i18n/navigation.ts` — Phase 12 output; source of the locale-preserving navigation primitives

### Project conventions
- `/Users/koss/Desktop/Develop/Clickit/CLAUDE.md` — project-level guidelines

</canonical_refs>

<specifics>
## Specific Ideas

### Git move strategy (preserve blame)

Use `git mv` for route directory moves — not `cp + rm`. Blame history must survive the restructure so future archaeology on `/series/[slug]/page.tsx` still works via blame on the new path. Execute moves in one atomic commit on a feature branch (`claude/phase-13-route-restructure-auth-safety` or the GSD default for phase branches), tested on Vercel preview, then merged to main.

### Vercel preview smoke-test checklist (MANDATORY before merge)

Deploy the phase branch to Vercel via `vercel` (non-prod). Hit the preview URL and walk through:
1. Visit `/` → redirects to `/en/` (canonical home)
2. Visit `/ar/` → same content, `<html dir="rtl">` visible in devtools
3. Sign in on `/en/auth` → lands on `/en/` (not `/auth/login`, not `/en/auth/login`)
4. Sign in on `/ar/auth` → lands on `/ar/` (locale preserved)
5. Switch locale from profile page → URL changes from `/en/profile` to `/ar/profile` AND session persists (check `sb-…-auth-token` cookie still present)
6. Click a show card → `/en/series/<slug>` or `/ar/series/<slug>` resolves, locale preserved
7. Watch page prev/next → locale preserved across episode navigation
8. `/coming-soon` (if gate enabled) → redirects with locale preserved based on referer
9. `curl /sitemap.xml | xmllint` — contains `<xhtml:link rel="alternate">` for every route
10. OAuth callback from Google/etc → `?next=/series/foo` lands on `/en/series/foo` (or `/ar/` if cookie says AR)

Only after all 10 pass → merge to main → production deploy.

### Rollback plan

If Phase 13 breaks auth in prod (users report silent logouts): revert the merge commit on main. The revert is a single commit (`git revert -m 1 <merge-sha>`). The restructure is atomic — there's nothing to partially unwind. Phase 12's infrastructure stays in place (still safe, still dormant if Phase 13 is reverted).

### Known complexity: root layout `<html>` ownership

Next.js App Router normally requires a root `layout.tsx` to return `<html>` and `<body>`. When using next-intl's `[locale]/layout.tsx` pattern, the canonical approach is:
- `src/app/layout.tsx` — minimal: returns `{children}` with NO `<html>` / `<body>` wrapping
- `src/app/[locale]/layout.tsx` — wraps: `<html lang={locale} dir={dirFor(locale)}><body>{children}</body></html>`

Next.js docs and next-intl docs both endorse this pattern. Verify by reading the next-intl v4 quickstart in Context7 before implementing.

Alternative: both layouts set `<html>` — Next.js hydration error. Don't do this.

### Dictionary key consumption

Phase 13 doesn't extract strings. But `NextIntlClientProvider` in `[locale]/layout.tsx` loads messages from `src/messages/{locale}.json` — which is empty in Phase 12. This is fine. Pages that call `useTranslations('home')` in Phase 15 will then have messages available. For now, pages still have hardcoded English strings. No change to user-visible text.

</specifics>

<deferred>
## Deferred Ideas

- Arabic font activation (Cairo swap) + RTL CSS — Phase 14
- Logical-property migration (`ms-`, `me-`, `ps-`, `pe-`) across ~70 files — Phase 14
- Extraction of hardcoded strings to `useTranslations()` / `getTranslations()` — Phases 15 (viewer) and 16 (admin)
- Translation of Arabic copy — Phases 15/16/17
- Metadata per-locale (`<title>` + `<meta description>`) — Phase 17
- Dynamic string translation (toasts, errors, aria-labels) — Phase 17

</deferred>

---

*Phase: 13-route-restructure-auth-safety*
*Context gathered: 2026-04-21*
*Depends on: Phase 12 (shipped 2026-04-21 as commit af2ab35 + ef83f56)*
