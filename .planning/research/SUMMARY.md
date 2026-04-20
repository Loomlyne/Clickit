# Research Summary — Milestone v1.1 Arabic i18n

**Project:** Clickit Story — Full Arabic + English i18n migration
**Researched:** 2026-04-20
**Confidence:** HIGH across all 4 dimensions

## TL;DR

- `next-intl@4.9.1` is **already installed** and **completely unwired**. Zero new dependencies.
- `proxy.ts` **already exists** and already uses the Next.js 16 middleware naming convention — additive change only.
- The migration is **mechanical** once Phase 1 (infrastructure) and Phase 2 (middleware + auth) land safely.
- **6 latent auth/routing breaks** must be fixed atomically in the same PR as the route restructure.
- The existing `dirFor()` and `pickLocalized()` helpers **stay** — they're domain-specific.
- `locale-actions.ts` + the cookie-based switcher become **dead code** after migration.

## Stack Additions

**Nothing to install.** Everything needed is already in `package.json`:
- `next-intl@^4.9.1` — routing, middleware, provider, getTranslations, setRequestLocale
- `next@16.2.x` — App Router with `proxy.ts` convention

**Keep:**
- `src/lib/locale.ts` — `dirFor()`, `pickLocalized()` remain. Domain-specific helpers for RTL direction and DB field selection.

**Delete after migration:**
- `src/app/locale-actions.ts` — replaced by `router.replace(pathname, { locale })`
- `src/components/layout/locale-switcher.tsx` — replaced by next-intl navigation-based switcher
- Cookie-based `getLocale()` reads — replaced by next-intl `getLocale()` from URL

## Feature Table Stakes

1. URL-prefix routing: `/en/...` and `/ar/...`
2. RTL globally via `<html dir={dirFor(locale)}>` on `[locale]/layout.tsx`
3. Cairo font (variable weight 200-900, harmonizes with Latin glyphs)
4. All UI strings translated — all viewer pages, all admin pages, all components
5. Translation dictionaries in `src/messages/en.json` + `src/messages/ar.json`
6. Language switcher writes the URL (not a cookie)
7. Static rendering preserved — `setRequestLocale(locale)` in every layout and page

## Feature Differentiators

- Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) auditing across 114 components
- Letter-spacing audit: 20+ components use `tracking-[0.2em+]` which breaks Arabic glyph joining
- Number formatting: `Intl.NumberFormat('ar-AE')` returns Western numerals (0-9), matching UAE market
- Video player controls stay LTR even in Arabic mode (industry standard — Netflix MENA, Shahid, YouTube)
- Text expansion QA pass: Arabic runs 25-40% wider than English

## Anti-Features (Do NOT Build)

- Hijri calendar — UAE uses Gregorian
- Eastern Arabic-Indic numerals (٠-٩) — Shahid and Netflix MENA use Western numerals (0-9)
- Dialect variants (Emirati, Egyptian) — MSA only
- Icon mirroring for every icon — only directional icons (arrows, chevrons, skip-forward)
- Separate Arabic sitemap — use `alternates.languages` in existing sitemap

## Architecture: Migration Blueprint

### Directory Structure

**Before:**
```
src/app/
  (viewer)/
    page.tsx
    auth/page.tsx
    ...
  admin/
    page.tsx
    ...
```

**After:**
```
src/app/
  [locale]/
    (viewer)/
      page.tsx
      auth/page.tsx
      ...
    admin/
      page.tsx
      ...
    layout.tsx           ← NextIntlClientProvider + setRequestLocale + <html dir lang>
  layout.tsx             ← Minimal shell
```

### New Files

| File | Purpose |
|------|---------|
| `src/i18n/routing.ts` | `defineRouting({ locales: ['en','ar'], defaultLocale: 'en', localePrefix: 'always' })` |
| `src/i18n/request.ts` | `getRequestConfig` — awaits requestLocale, returns messages |
| `src/i18n/navigation.ts` | `createNavigation(routing)` — Link, useRouter, redirect, usePathname |
| `src/messages/en.json` | English dictionary |
| `src/messages/ar.json` | Arabic dictionary |
| `src/app/[locale]/layout.tsx` | Provider wrapper, setRequestLocale, generateStaticParams |

### Modified Files

| File | Change |
|------|--------|
| `proxy.ts` | Chain `createMiddleware(routing)` AFTER `updateSession()`, merge Supabase cookies onto i18n response |
| `src/app/layout.tsx` | Remove `getLocale()` + dir attr — moves to `[locale]/layout.tsx` |
| ~7 components using `useRouter` from `next/navigation` | Swap to `@/i18n/navigation` |
| All components using `Link` from `next/link` | Swap to `Link` from `@/i18n/navigation` |

### Proxy.ts Composition Pattern

```ts
// 1. Run next-intl first (handles redirects for missing locale prefix)
const intlResponse = createMiddleware(routing)(request)
if (intlResponse.status !== 200) return intlResponse

// 2. Run Supabase session update
const supabaseResponse = await updateSession(request)

// 3. CRITICAL: merge Supabase auth cookies onto intl response
supabaseResponse.cookies.getAll().forEach(cookie => {
  intlResponse.cookies.set(cookie.name, cookie.value, cookie)
})

return intlResponse
```

## Pitfalls

### Critical (blocks auth/routing — must fix in Phase 1/2 atomically)

1. **Supabase session cookie loss on locale redirect** — when middleware returns `NextResponse.redirect()` after `updateSession()`, refreshed cookies live on the Supabase response, not the redirect. User silently logged out.
2. **`next/navigation` useRouter in 7 client components** — strips the locale prefix on navigation. Swap to `@/i18n/navigation`.
3. **Hard-coded redirects to `/auth/login`** in auth actions and protected routes — must become locale-aware.
4. **Supabase auth callback URL** — `auth/callback/route.ts` constructs `?next=` redirects with bare paths. Audit required.
5. **`coming-soon` redirect in `proxy.ts`** — currently redirects to `/coming-soon` (no locale). Must become locale-aware.
6. **Sitemap has no `alternates.languages`** — Google can't discover Arabic version. Add per route.

### High (breaks visual UI)

7. **`tracking-[0.2em+]` letter-spacing** breaks Arabic glyph joining (20+ components). Fix with one CSS rule in globals.css.
8. **Cairo font-display** — set `display: 'swap'` to prevent FOIT on Arabic pages.
9. **Tailwind directional classes** — audit `ml-`, `mr-`, `pl-`, `pr-` → migrate to `ms-`, `me-`, `ps-`, `pe-` across 114 components.
10. **Directional icons not mirrored** — chevrons, skip-forward/backward, back arrows.

### Medium (translation quality)

11. **Hardcoded strings inside `.map()` callbacks** — easy to miss with grep. AST-based audit needed.
12. **`aria-label` attributes with English** — screen reader labels need translation.
13. **Error messages from Supabase / Zod** — some come back English-only. Decide: translate or accept.
14. **Date formatting** — `toLocaleDateString()` calls must pass the active locale explicitly.

## Build Order (Phase Dependencies)

1. **Phase 12 (i18n Infrastructure)** — Create `src/i18n/` files, empty `src/messages/*.json`, wire `proxy.ts` cookie merge. Zero page changes. Safe.
2. **Phase 13 (Route Restructure + Auth Safety)** — Move pages under `[locale]/`, fix all 6 critical pitfalls, swap `useRouter` imports, verify auth works. HIGHEST RISK.
3. **Phase 14 (Global Layout + RTL CSS)** — `[locale]/layout.tsx`, Cairo font, RTL CSS (letter-spacing rule, logical properties audit, directional icons).
4. **Phase 15 (Viewer Pages Translation)** — Extract strings from 14 viewer pages, replace with `useTranslations()`, translate to Arabic. QA text expansion.
5. **Phase 16 (Admin Pages Translation)** — Same for 6 admin pages.
6. **Phase 17 (Content + Polish)** — FAQ, footer, error/empty states, aria-labels, date/number formatting, sitemap alternates, final RTL audit.

## Open Questions for Requirements Phase

- **Resolved by user:** Admin UI gets translated. Confirmed.
- **Open:** Does the Supabase full-text search cover `title_ar` for Arabic search? (Check in Phase 15.)
- **Open:** Any directionally-asymmetric show artwork that reads strangely in RTL? (Visual QA in Phase 14.)
- **Open:** `coming-soon` redirect behavior — locale-aware or excluded from `[locale]` segment?
