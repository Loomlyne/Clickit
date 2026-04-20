---
phase: 13-route-restructure-auth-safety
plan: 03a
type: execute
wave: 3
depends_on:
  - 13-01
  - 13-02
files_modified:
  - src/hooks/use-likes.ts
  - src/hooks/use-watchlist.ts
  - src/components/layout/auth-section.tsx
  - src/components/layout/user-dropdown.tsx
  - src/components/layout/nav-links.tsx
  - src/components/layout/mobile-nav.tsx
  - src/components/auth/login-form.tsx
  - src/components/auth/signup-form.tsx
  - src/components/auth/reset-password-form.tsx
  - src/components/profile/profile-header.tsx
  - src/components/watch/watch-page-content.tsx
  - src/components/admin/admin-header.tsx
  - src/components/admin/season-tabs.tsx
  - src/app/[locale]/(viewer)/design-system/layout.tsx
  - src/app/[locale]/(viewer)/design-system/page.tsx
  - src/app/[locale]/(viewer)/my-list/page.tsx
  - src/app/[locale]/(viewer)/browse/page.tsx
  - src/app/[locale]/(viewer)/profile/page.tsx
  - src/app/[locale]/admin/layout.tsx
autonomous: true
requirements:
  - RTE-04
  - RTE-05
tags: [i18n, navigation, client-components, server-components, v1.1]
user_setup: []

must_haves:
  truths:
    - "Every useRouter / usePathname / Server-redirect call in the listed files preserves the active locale prefix"
    - "grep for `from 'next/navigation'` in the listed files returns ZERO matches for useRouter, usePathname, redirect, permanentRedirect (notFound stays — not path-based)"
    - "grep for hardcoded `/auth` paths in router.push / redirect returns only calls through @/i18n/navigation"
    - "No client component in this plan's scope strips the locale prefix during a navigation"
  artifacts:
    - path: "src/hooks/use-likes.ts"
      provides: "Locale-preserving likes hook (useRouter swap)"
    - path: "src/hooks/use-watchlist.ts"
      provides: "Locale-preserving watchlist hook (useRouter swap)"
    - path: "src/components/auth/login-form.tsx"
      provides: "Login form with locale-preserving router and /auth/callback URL (callback itself is locale-agnostic)"
  key_links:
    - from: "every swapped file"
      to: "src/i18n/navigation"
      via: "import { useRouter/redirect/usePathname } from '@/i18n/navigation'"
      pattern: "from ['\\\"]@/i18n/navigation['\\\"]"
---

<objective>
Swap every client-component import of `useRouter`, `usePathname`, `redirect`, or `permanentRedirect` from `next/navigation` to `@/i18n/navigation`. Swap Server Component `redirect` imports that target user-facing paths (`/auth`, `/browse`, `/design-system/...`, `/`) to `@/i18n/navigation` so the redirect URL carries the active locale prefix.

**Scope note:** This plan (13-03a) handles `useRouter`/`usePathname`/Server-`redirect` only. The `Link` → `@/i18n/navigation` swap across ~38 `next/link`-importing files lives in sibling plan 13-03b (parallel-eligible in the same wave).

Keep `notFound` imports on `next/navigation` — `notFound()` is not a path-based navigation and has no locale concern.

Purpose: Closes pitfalls 2 (RTE-04, navigation-hook half) and 3 (RTE-05, Server-redirect half) for this plan's file subset. Without these swaps, `router.push('/admin')` from `/ar/admin/shows/[id]` strips the locale and triggers a full re-auth round-trip; `redirect('/auth')` in a Server Component sends the user to bare `/auth` and drops their locale.

Output: 10 useRouter swaps + 4 usePathname swaps + 5 Server Component redirect swaps = 19 file edits; build clean. The `next/link` swap for ~38 files is delivered by sibling plan 13-03b.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md
@.planning/phases/13-route-restructure-auth-safety/13-01-PLAN.md

@src/i18n/navigation.ts

<interfaces>
<!-- The locale-preserving primitives consumed by every swapped file -->

From src/i18n/navigation.ts:
```typescript
export const { Link, useRouter, redirect, usePathname, getPathname, permanentRedirect } =
  createNavigation(routing)
// useRouter(): { push, replace, back, forward, refresh, prefetch } — prepends active locale
// useRouter().replace(pathname, { locale: 'ar' }): swap to a different locale on the SAME path
// redirect(href, RedirectType): Server Component redirect — prepends active locale
// usePathname(): string — returns path WITHOUT the locale prefix
```

notFound (stays on next/navigation):
```typescript
import { notFound } from 'next/navigation'
// No locale semantics — always triggers the nearest not-found.tsx
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap 10 client-component useRouter imports to @/i18n/navigation</name>
  <files>
    src/components/layout/auth-section.tsx,
    src/components/layout/user-dropdown.tsx,
    src/components/auth/login-form.tsx,
    src/components/auth/signup-form.tsx,
    src/components/auth/reset-password-form.tsx,
    src/components/profile/profile-header.tsx,
    src/components/watch/watch-page-content.tsx,
    src/components/admin/season-tabs.tsx,
    src/hooks/use-likes.ts,
    src/hooks/use-watchlist.ts
  </files>

  <read_first>
    - src/i18n/navigation.ts (confirms the exported primitives)
    - .planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md lines 79-98 (Pitfall 2 — the full swap list)
    - Each target file (one at a time) — only the import line typically changes
  </read_first>

  <action>
Before editing, confirm the current state with a fresh grep (files may shift slightly after plan 13-01 ran):
```bash
grep -rln "useRouter.*from 'next/navigation'\|from 'next/navigation'.*useRouter" src --include='*.tsx' --include='*.ts'
```

This plan owns 10 of those matches. For each file below, change the single import line. This is mechanical — the runtime API is identical to `next/navigation`.

Also inspect whether any file passes a hardcoded absolute path starting with `/auth`, `/admin`, `/browse`, `/`, `/series`, `/watch`, `/profile`, `/my-list`, `/search`, `/support`, `/coming-soon`, or `/design-system` to `router.push` / `router.replace`. Those paths stay exactly as-is — `@/i18n/navigation`'s router prepends the locale automatically.

### src/components/layout/auth-section.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/layout/user-dropdown.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/auth/login-form.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

Additionally, inspect the hardcoded callback URL inside this file — the callback itself is locale-agnostic (Pitfall 4 territory), but the `?next=` value IS locale-sensitive:

```
${window.location.origin}/auth/callback?next=/auth/reset-password
```

**No change needed** to the URL literal here. Rationale: `/auth/callback` is locale-agnostic (the OAuth return URL preserved in plan 13-01). The `?next=` value is `/auth/reset-password` — a path without locale prefix. The updated `safeNext()` in plan 13-04 will prepend the active locale from the `NEXT_LOCALE` cookie when it sees a plain path, landing the user on `/en/auth/reset-password` or `/ar/auth/reset-password` correctly. Leave the URL exactly as-is.

### src/components/auth/signup-form.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/auth/reset-password-form.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/profile/profile-header.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/watch/watch-page-content.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/components/admin/season-tabs.tsx
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/hooks/use-likes.ts
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

### src/hooks/use-watchlist.ts
```diff
-import { useRouter } from 'next/navigation'
+import { useRouter } from '@/i18n/navigation'
```

Do NOT touch `src/components/layout/locale-switcher.tsx` or `src/components/profile/language-preference.tsx` — both are replaced/deleted in plan 13-05.
  </action>

  <verify>
    <automated>for f in src/components/layout/auth-section.tsx src/components/layout/user-dropdown.tsx src/components/auth/login-form.tsx src/components/auth/signup-form.tsx src/components/auth/reset-password-form.tsx src/components/profile/profile-header.tsx src/components/watch/watch-page-content.tsx src/components/admin/season-tabs.tsx src/hooks/use-likes.ts src/hooks/use-watchlist.ts; do grep -q "from '@/i18n/navigation'" "$f" || { echo "MISS: $f"; exit 1; }; grep -q "useRouter.*from 'next/navigation'" "$f" &amp;&amp; { echo "RESIDUE: $f"; exit 1; } || true; done</automated>
  </verify>

  <acceptance_criteria>
    - All 10 files import `useRouter` from `@/i18n/navigation` (not `next/navigation`)
    - All 10 files have NO residual `import { useRouter } from 'next/navigation'`
    - All 10 files still work as client components (the `'use client'` directive is unchanged at the top)
    - The `${window.location.origin}/auth/callback?next=/auth/reset-password` URL in login-form.tsx is left exactly as-is (callback is locale-agnostic, safeNext handles locale)
  </acceptance_criteria>

  <done>
    - 10 useRouter swaps complete
  </done>
</task>

<task type="auto">
  <name>Task 2: Swap 4 client-component usePathname imports to @/i18n/navigation</name>
  <files>
    src/components/layout/mobile-nav.tsx,
    src/components/layout/nav-links.tsx,
    src/components/admin/admin-header.tsx,
    src/app/[locale]/(viewer)/design-system/layout.tsx
  </files>

  <read_first>
    - src/i18n/navigation.ts (usePathname here returns the path WITHOUT the locale prefix — which is what nav-active-state logic typically wants)
    - Each target file — confirm that any string comparison like `pathname === '/browse'` still works after the swap (it should — `usePathname` from `@/i18n/navigation` returns `/browse`, not `/en/browse`)
  </read_first>

  <action>
### src/components/layout/mobile-nav.tsx
```diff
-import { usePathname } from 'next/navigation'
+import { usePathname } from '@/i18n/navigation'
```

### src/components/layout/nav-links.tsx
```diff
-import { usePathname } from 'next/navigation'
+import { usePathname } from '@/i18n/navigation'
```

### src/components/admin/admin-header.tsx
```diff
-import { usePathname } from 'next/navigation'
+import { usePathname } from '@/i18n/navigation'
```

### src/app/[locale]/(viewer)/design-system/layout.tsx

Note the new path — this file was moved under `[locale]/(viewer)/` in plan 13-01.

```diff
-import { usePathname } from 'next/navigation'
+import { usePathname } from '@/i18n/navigation'
```

**Important semantic check:** `usePathname` from `@/i18n/navigation` returns the URL **without** the locale prefix (e.g., `/browse` from `/en/browse`). Every active-link check that compares `pathname === '/browse'` continues to work — that's a feature, not a gotcha. Any code that manually strips a locale prefix after calling `usePathname` can be simplified later (not in this task — mechanical swap only).
  </action>

  <verify>
    <automated>for f in src/components/layout/mobile-nav.tsx src/components/layout/nav-links.tsx src/components/admin/admin-header.tsx "src/app/[locale]/(viewer)/design-system/layout.tsx"; do grep -q "usePathname.*from '@/i18n/navigation'" "$f" || { echo "MISS: $f"; exit 1; }; grep -q "usePathname.*from 'next/navigation'" "$f" &amp;&amp; { echo "RESIDUE: $f"; exit 1; } || true; done</automated>
  </verify>

  <acceptance_criteria>
    - All 4 files import `usePathname` from `@/i18n/navigation`
    - No residual `import { usePathname } from 'next/navigation'` in those files
    - Active-link comparisons continue to work — grep the files for `pathname ===` / `pathname.startsWith` and verify the expected paths do NOT include the locale segment
  </acceptance_criteria>

  <done>
    - 4 usePathname swaps complete
  </done>
</task>

<task type="auto">
  <name>Task 3: Swap Server Component redirect imports for user-facing paths to @/i18n/navigation</name>
  <files>
    src/app/[locale]/(viewer)/browse/page.tsx,
    src/app/[locale]/(viewer)/profile/page.tsx,
    src/app/[locale]/(viewer)/my-list/page.tsx,
    src/app/[locale]/(viewer)/design-system/page.tsx,
    src/app/[locale]/admin/layout.tsx
  </files>

  <read_first>
    - Each target file — confirm the current import line and the redirect target path
    - src/i18n/navigation.ts — confirms redirect is exported from createNavigation
    - .planning/phases/13-route-restructure-auth-safety/13-CONTEXT.md lines 100-102 (Pitfall 3 — hardcoded /auth/login redirects)
  </read_first>

  <action>
Server Components use `redirect` from `next/navigation`. Swap the ones whose target is a user-facing locale-sensitive path (`/auth`, `/browse`, `/`, `/design-system/...`).

### src/app/[locale]/(viewer)/browse/page.tsx (new path after plan 13-01)
```diff
-import { redirect } from 'next/navigation'
+import { redirect } from '@/i18n/navigation'
```

The one call site — `redirect('/')` — stays as-is. `@/i18n/navigation.redirect` prepends the active locale so it lands on `/en/` or `/ar/`.

### src/app/[locale]/(viewer)/profile/page.tsx
```diff
-import { redirect } from 'next/navigation'
+import { redirect } from '@/i18n/navigation'
```

Call site `redirect('/auth')` — unchanged, becomes `/en/auth` or `/ar/auth` at runtime.

### src/app/[locale]/(viewer)/my-list/page.tsx
```diff
-import { redirect } from 'next/navigation'
+import { redirect } from '@/i18n/navigation'
```

Call site `redirect('/auth?next=/my-list')` — unchanged. `@/i18n/navigation.redirect` prepends the locale to the path portion, preserving `?next=/my-list` as-is.

### src/app/[locale]/(viewer)/design-system/page.tsx
```diff
-import { redirect } from 'next/navigation'
+import { redirect } from '@/i18n/navigation'
```

Call site `redirect('/design-system/colors')` — unchanged, becomes `/en/design-system/colors` or `/ar/design-system/colors`.

### src/app/[locale]/admin/layout.tsx
```diff
-import { redirect } from 'next/navigation'
+import { redirect } from '@/i18n/navigation'
```

Two call sites both `redirect('/browse')` — unchanged, become `/en/browse` or `/ar/browse`.

### DO NOT swap:
- `src/app/[locale]/(viewer)/series/[slug]/page.tsx` — uses `notFound()`, not `redirect()`. Leave `import { notFound } from 'next/navigation'`.
- `src/app/[locale]/(viewer)/watch/[episodeId]/page.tsx` — uses `notFound()`. Leave.
- `src/app/[locale]/admin/shows/[id]/page.tsx` — uses `notFound()`. Leave.
- `src/app/auth/callback/route.ts` — uses `NextResponse.redirect` (HTTP-level, not `next/navigation`'s function). Leave — locale handling lands in plan 13-04.
- `src/app/not-found.tsx` (root) — check with grep; it doesn't use `redirect` at all.

Keep `notFound` imports on `next/navigation` — `notFound()` is a 404 signal, not a path navigation, and has no locale concern.
  </action>

  <verify>
    <automated>for f in "src/app/[locale]/(viewer)/browse/page.tsx" "src/app/[locale]/(viewer)/profile/page.tsx" "src/app/[locale]/(viewer)/my-list/page.tsx" "src/app/[locale]/(viewer)/design-system/page.tsx" "src/app/[locale]/admin/layout.tsx"; do grep -q "redirect.*from '@/i18n/navigation'" "$f" || { echo "MISS: $f"; exit 1; }; grep -q "^import.*redirect.*from 'next/navigation'" "$f" &amp;&amp; { echo "RESIDUE: $f"; exit 1; } || true; done</automated>
  </verify>

  <acceptance_criteria>
    - All 5 files import `redirect` from `@/i18n/navigation`
    - No residual `import { redirect } from 'next/navigation'` in those 5 files
    - Call sites unchanged: `redirect('/')`, `redirect('/auth')`, `redirect('/auth?next=/my-list')`, `redirect('/design-system/colors')`, `redirect('/browse')` — the locale prefix is applied by the helper automatically
    - `notFound` imports stay on `next/navigation` — grep `notFound.*from 'next/navigation'` still returns matches (series/[slug]/page.tsx, watch/[episodeId]/page.tsx, admin/shows/[id]/page.tsx)
  </acceptance_criteria>

  <done>
    - 5 Server Component redirect swaps complete
    - RTE-05 (Server-redirect half) closed
  </done>
</task>

<task type="auto">
  <name>Task 4: Build gate — confirm navigation-hook and Server-redirect swaps don't break compilation</name>
  <files>none (verification task)</files>

  <read_first>
    - None (this is a pure verification task)
  </read_first>

  <action>
Run the full verification gate for this plan's scope (useRouter + usePathname + Server redirect). Plan 13-03a is mechanical — the only failure mode is a typo in an import path. The `@/i18n/navigation` helpers have the same runtime API as `next/navigation` so no call-site changes are needed.

Note: this gate does NOT require that all `next/link` imports be swapped — that work ships in sibling plan 13-03b. The combined "zero `next/(navigation|link)` imports outside the allowed list" gate lives in plan 13-06 Task 1.

```bash
npx tsc --noEmit
npm run build
```

Plan-scoped grep invariants (only useRouter/usePathname/redirect — leaves `next/link` alone):

```bash
# No useRouter/usePathname/redirect/permanentRedirect imports from next/navigation
# in src/components, src/app, src/hooks. Only notFound and the OAuth callback route
# handler should still have next/navigation imports.
grep -rE "from ['\"]next/navigation['\"]" src/components src/app src/hooks --include="*.tsx" --include="*.ts" \
  | grep -vE "notFound" \
  | grep -vE "auth/callback/route\.ts"
```

Expected: EMPTY output. Any match means a file still imports path-navigation helpers from `next/navigation` — go fix it before this task passes.

```bash
# Hardcoded /auth redirects must only go through @/i18n/navigation now.
grep -rE "router\.push\(['\"]/auth|redirect\(['\"]/auth|href=['\"]/auth" src --include="*.tsx" --include="*.ts" | grep -v "i18n/navigation"
```

Expected: every remaining hit must be in a file that now imports from `@/i18n/navigation` (the grep pattern doesn't check imports, only literal strings). The two known hardcoded paths that are ALLOWED to stay:
- `src/app/auth/callback/route.ts` — uses `NextResponse.redirect(\`${origin}/auth?error=…\`)` at an HTTP-redirect level. This is locale-handled in plan 13-04, NOT here.
- `src/app/(viewer)/auth/actions.ts` (if it has any redirect) — Server Action; uses Supabase client, not redirect.
  </action>

  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run build &amp;&amp; test -z "$(grep -rE \"from ['\\\"]next/navigation['\\\"]\" src/components src/app src/hooks --include='*.tsx' --include='*.ts' | grep -vE 'notFound' | grep -vE 'auth/callback/route\\.ts')"</automated>
  </verify>

  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
    - `grep -rE "from ['\"]next/navigation['\"]" src/components src/app src/hooks --include="*.tsx" --include="*.ts" | grep -vE "notFound" | grep -vE "auth/callback/route\.ts"` returns EMPTY
    - No useRouter/usePathname/redirect/permanentRedirect imports from `next/navigation` remain in client or server components
    - `notFound` imports from `next/navigation` are preserved in the 3 expected files (series/[slug]/page.tsx, watch/[episodeId]/page.tsx, admin/shows/[id]/page.tsx)
  </acceptance_criteria>

  <done>
    - RTE-04 (navigation-hook half) and RTE-05 (Server-redirect half) closed
    - Every path-based navigation hook and Server-component redirect goes through locale-preserving helpers
    - `next/link` swaps still pending — delivered by sibling plan 13-03b
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Client navigation | router.push values are developer-controlled strings. Swap is mechanical — no new user-input channels. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-07 | T (Tampering) | Navigation targets | accept | All target paths are hardcoded strings in developer-written code. next-intl's `redirect`/`useRouter` helpers are defensive — they only prepend the active locale, never parse or rewrite the path. |
</threat_model>

<verification>
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run build` exit 0
- [ ] `grep -c "from '@/i18n/navigation'" src/components src/app src/hooks -r` returns at least 19 matches added by this plan
- [ ] `grep -rE "from ['\"]next/navigation['\"]" src/components src/app src/hooks --include="*.tsx" --include="*.ts" | grep -vE "notFound|auth/callback/route\.ts"` is EMPTY
</verification>

<success_criteria>
- 10 useRouter swaps, 4 usePathname swaps, 5 redirect swaps — 19 file edits total in this plan
- Build + tsc green
- RTE-04 (navigation-hook half) + RTE-05 (Server-redirect half) closed
- `notFound` imports preserved (correct semantics)
- Locale-switcher (deleted in 13-05) and language-preference (replaced in 13-05) not touched in this plan
- `next/link` swap coverage delivered by sibling plan 13-03b
</success_criteria>

<output>
After completion, create `.planning/phases/13-route-restructure-auth-safety/13-03a-SUMMARY.md`.
</output>
