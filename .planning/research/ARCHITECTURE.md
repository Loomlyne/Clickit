# Architecture: i18n Migration — Cookie to URL-Prefix Locale Routing

**Project:** Clickit Story
**Scope:** Full i18n migration, Next.js 16.2 App Router, next-intl v4.9.1 already installed
**Researched:** 2026-04-20
**Confidence:** HIGH — verified against next-intl v4 Context7 docs and live codebase

---

## Current State Inventory

Before touching anything, know exactly what exists:

| File | Current role | Changes required |
|------|--------------|-----------------|
| `src/lib/locale.ts` | `getLocale()` reads `NEXT_LOCALE` cookie, `dirFor()`, `pickLocalized()` | Replace `getLocale()` with next-intl server API; keep `dirFor()` and `pickLocalized()` as pure helpers |
| `src/app/locale-actions.ts` | Server Action writes cookie, calls `revalidatePath` | Delete entirely — locale change becomes URL navigation |
| `src/lib/supabase/middleware.ts` | `updateSession()` — refreshes Supabase JWT, returns `userId` + lazy `checkIsAdmin` | No changes to this file |
| `src/middleware.ts` | Does not exist yet — there is currently no root middleware file | Create new file here |
| `src/app/layout.tsx` | Reads locale via `getLocale()`, sets `<html lang dir>` | Becomes thin shell; locale layout moves under `[locale]` |
| `src/app/(viewer)/layout.tsx` | Viewer shell (Navbar + Footer) | Move to `src/app/[locale]/(viewer)/layout.tsx` |
| `src/app/admin/layout.tsx` | Admin auth guard + shell | Move to `src/app/[locale]/admin/layout.tsx` |
| `src/components/layout/locale-switcher.tsx` | Calls `setLocaleAction` server action + `router.refresh()` | Replace with `router.replace(pathname, { locale })` using next-intl navigation |
| `src/components/layout/nav-links.tsx` | `NAV_LINKS` with bare hrefs (`/browse`, etc.) + `usePathname` | Swap imports to `@/i18n/navigation`; hrefs stay unchanged |
| `src/components/layout/user-dropdown.tsx` | `router.push('/profile')`, `router.push('/admin')` | Swap `useRouter` import to `@/i18n/navigation` |
| `src/app/(viewer)/auth/callback/route.ts` | OAuth code exchange, redirects to `${origin}${next}` | `next` param construction sites must produce locale-prefixed paths |
| `src/app/(viewer)/profile/page.tsx` | `redirect('/auth')` on unauthenticated | Use next-intl's `redirect` from server — auto-prefixes |
| `src/app/admin/layout.tsx` | `redirect('/browse')` on unauthorized | Same — use next-intl's `redirect` |

---

## Directory Structure Change

### Before

```
src/app/
├── layout.tsx                        <- root layout (reads locale cookie)
├── locale-actions.ts                 <- server action for locale switching
├── not-found.tsx
├── robots.ts
├── sitemap.ts
├── favicon.ico
├── (viewer)/
│   ├── layout.tsx
│   ├── page.tsx                      <- home (/)
│   ├── auth/
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   ├── callback/route.ts
│   │   └── reset-password/page.tsx
│   ├── browse/page.tsx
│   ├── coming-soon/page.tsx
│   ├── my-list/page.tsx
│   ├── profile/page.tsx
│   ├── search/page.tsx
│   ├── series/[slug]/page.tsx
│   ├── support/page.tsx
│   ├── watch/[episodeId]/page.tsx
│   └── design-system/...
└── admin/
    ├── layout.tsx
    ├── page.tsx
    ├── archive/page.tsx
    ├── audit/page.tsx
    ├── settings/page.tsx
    └── shows/[id]/page.tsx
```

### After

```
src/
├── middleware.ts                     <- NEW: i18n routing + Supabase session in one file
├── i18n/
│   ├── routing.ts                    <- NEW: defineRouting({ locales, defaultLocale })
│   ├── navigation.ts                 <- NEW: createNavigation(routing) exports
│   └── request.ts                    <- NEW: getRequestConfig (loads messages, resolves locale)
├── messages/
│   ├── en.ts                         <- NEW: TypeScript dict
│   └── ar.ts                         <- NEW: TypeScript dict
└── app/
    ├── layout.tsx                    <- MODIFIED: thin shell, no locale logic
    ├── not-found.tsx                 <- keep
    ├── robots.ts                     <- keep
    ├── sitemap.ts                    <- keep
    ├── [locale]/                     <- NEW segment
    │   ├── layout.tsx                <- NEW: locale layout — validates locale param,
    │   │                                sets html lang/dir, wraps NextIntlClientProvider
    │   ├── (viewer)/
    │   │   ├── layout.tsx            <- MOVED from (viewer)/layout.tsx
    │   │   ├── page.tsx
    │   │   ├── auth/
    │   │   │   ├── page.tsx
    │   │   │   ├── actions.ts        <- unchanged
    │   │   │   ├── callback/route.ts <- needs next param audit
    │   │   │   └── reset-password/page.tsx
    │   │   ├── browse/page.tsx
    │   │   ├── coming-soon/page.tsx
    │   │   ├── my-list/page.tsx
    │   │   ├── profile/page.tsx
    │   │   ├── search/page.tsx
    │   │   ├── series/[slug]/page.tsx
    │   │   ├── support/page.tsx
    │   │   ├── watch/[episodeId]/page.tsx
    │   │   └── design-system/...
    │   └── admin/
    │       ├── layout.tsx            <- MOVED from admin/layout.tsx
    │       ├── page.tsx
    │       ├── archive/page.tsx
    │       ├── audit/page.tsx
    │       ├── settings/page.tsx
    │       └── shows/[id]/page.tsx
    └── api/                          <- stays at root, excluded from middleware matcher
        ├── cron/cleanup-media/route.ts
        └── youtube-meta/route.ts
```

**Critical rule:** `src/app/api/` routes must live outside `[locale]` and must be excluded from the middleware matcher. The `api` path must be explicitly listed in the matcher exclusion. The `_next`, `_vercel`, and `.*\\..*` exclusions handle static files only.

---

## Middleware Changes

This is the most critical integration point. There is currently **no** `src/middleware.ts` in this project. The `src/lib/supabase/middleware.ts` is a helper library, not the Next.js middleware entrypoint. That distinction matters: `updateSession` does not change at all.

### The composition problem

next-intl's `createMiddleware(routing)` returns a `NextResponse` with locale redirects baked in (e.g., `/browse` → `/en/browse`). Supabase's `updateSession` also returns a `NextResponse` with refreshed session cookies. Returning them independently loses one response's cookies and headers.

### The correct pattern: i18n first, then Supabase, merge cookies

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const handleI18nRouting = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Step 1: Run i18n middleware to get locale redirect/rewrite response
  const i18nResponse = handleI18nRouting(request)

  // If i18n issued a redirect (e.g., / -> /en), return immediately.
  // A locale redirect does not need a refreshed Supabase session —
  // middleware runs again on the redirected URL.
  if (i18nResponse.status !== 200) {
    return i18nResponse
  }

  // Step 2: Run Supabase session refresh
  const { response: supabaseResponse } = await updateSession(request)

  // Step 3: Merge both responses into one.
  // The final response must carry Supabase's session cookies or the
  // browser loses auth state on every locale-prefixed navigation.
  const finalResponse = NextResponse.next({
    request: { headers: supabaseResponse.headers },
  })

  // Copy i18n headers (x-next-intl-locale, x-middleware-rewrite, etc.)
  i18nResponse.headers.forEach((value, key) => {
    finalResponse.headers.set(key, value)
  })

  // Copy Supabase session cookies
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  return finalResponse
}

export const config = {
  matcher: [
    // Match all paths except: API routes, Next.js internals, static files, brand assets
    '/((?!api|_next/static|_next/image|_vercel|favicon.ico|brand/|.*\\..*).*)',
  ],
}
```

**Why i18n first:** next-intl needs to resolve the locale from the URL before Supabase touches the request. If Supabase runs first and returns its own `NextResponse`, the i18n routing headers are lost.

**Why early return on redirect:** A locale redirect (status 301/302) does not need session cookies. The browser follows the redirect immediately and middleware runs again on the final URL.

**Note on Next.js 16 file naming:** The Next.js 16 changelog renamed `middleware.ts` to `proxy.ts`. Verify the current project's Next.js 16.2.1 release notes before finalizing the filename. The next-intl Context7 docs show both `middleware.ts` and `proxy.ts` as the export file. If v16.2 requires `proxy.ts`, rename accordingly — the logic inside is identical.

---

## Layout Changes

### Root layout after migration (`src/app/layout.tsx`)

Becomes a thin skeleton. Its only jobs are font CSS variable declarations and `generateMetadata`. The `<html>` element it renders has no `lang` or `dir` — those move to `[locale]/layout.tsx`.

```typescript
// src/app/layout.tsx — AFTER
import { Plus_Jakarta_Sans, Cairo } from 'next/font/google'
import '@/styles/globals.css'

const jakarta = Plus_Jakarta_Sans({ ... })  // must stay module-level
const cairo = Cairo({ ... })

export async function generateMetadata() {
  // unchanged — reads from app_config
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No lang, no dir, no Toaster, no Analytics here.
  // Those all live in [locale]/layout.tsx.
  return (
    <html className={`dark ${jakarta.variable} ${cairo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### New locale layout (`src/app/[locale]/layout.tsx`)

Receives `params.locale` from the URL segment. Validates it. Sets `lang` and `dir`. Provides next-intl context to the entire subtree.

```typescript
// src/app/[locale]/layout.tsx — NEW
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { dirFor } from '@/lib/locale'
import { getAppConfig } from '@/lib/config'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Required for static rendering support with next-intl
  setRequestLocale(locale)

  const [messages, { googleAnalyticsId, metaPixelId }] = await Promise.all([
    getMessages(),
    getAppConfig(),
  ])

  const dir = dirFor(locale as 'en' | 'ar')

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-background text-foreground ...">
        <NextIntlClientProvider messages={messages}>
          {/* skip-to-content link, <main>, children */}
          {children}
        </NextIntlClientProvider>
        <Toaster ... />
        <Analytics />
        <SpeedInsights />
        {googleAnalyticsId && ( /* GA scripts */ )}
        {metaPixelId && ( /* Meta Pixel script */ )}
      </body>
    </html>
  )
}
```

**What moves from root layout to locale layout:**
- `<html lang dir>` attributes
- `<body>` with all its className and a11y markup
- `<Toaster>`, `<Analytics>`, `<SpeedInsights>`
- GA and Meta Pixel `<Script>` blocks
- `getAppConfig()` call for analytics IDs

**`generateMetadata` in `[locale]/layout.tsx`:** Add `alternates.languages` here for SEO. This is the primary justification for the migration:

```typescript
export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return {
    alternates: {
      languages: {
        en: '/en',
        ar: '/ar',
      },
    },
  }
}
```

---

## Link and Router Changes

### New file: `src/i18n/navigation.ts`

```typescript
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

### Import swap rule

| Before | After |
|--------|-------|
| `import Link from 'next/link'` | `import { Link } from '@/i18n/navigation'` |
| `import { useRouter } from 'next/navigation'` | `import { useRouter } from '@/i18n/navigation'` |
| `import { usePathname } from 'next/navigation'` | `import { usePathname } from '@/i18n/navigation'` |
| `import { redirect } from 'next/navigation'` (server) | `import { redirect } from 'next-intl/server'` |

**Href values do not change.** `href="/browse"` stays `href="/browse"`. next-intl's `Link` prepends the active locale automatically. This is the key DX benefit — no string construction like `/en/browse` anywhere in the component tree.

### Files requiring import swaps

| File | Current import | Change |
|------|---------------|--------|
| `src/components/layout/nav-links.tsx` | `next/link`, `next/navigation` (usePathname) | Both swaps |
| `src/components/layout/user-dropdown.tsx` | `next/navigation` (useRouter) | useRouter swap |
| `src/components/layout/locale-switcher.tsx` | `next/navigation` (useRouter) | Full replacement (see below) |
| `src/app/(viewer)/profile/page.tsx` | `next/navigation` (redirect) | Server redirect swap |
| `src/app/admin/layout.tsx` | `next/navigation` (redirect) | Server redirect swap |
| Any page file using `<Link href="...">` | `next/link` | Link swap |

### Locale switcher replacement

The current `LocaleSwitcher` calls a Server Action to write a cookie then does `router.refresh()`. After migration, locale switching is pure URL navigation — no server action, no cookie write, no revalidation needed.

```typescript
// src/components/layout/locale-switcher.tsx — AFTER
'use client'

import { useRouter, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/lib/locale'

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const pathname = usePathname()

  function flip(next: Locale) {
    if (next === current) return
    router.replace(pathname, { locale: next })
  }

  // ... same button rendering as before
}
```

`setLocaleAction` and `locale-actions.ts` become dead code after this change.

### Auth callback `next` param

The `auth/callback/route.ts` handler redirects to `${origin}${next}` where `next` defaults to `/`. After migration, `/` redirects to `/en/` via middleware, so this is safe as a fallback. However, if any callsite constructs `?next=/profile`, that path will work correctly — middleware will promote `/profile` to `/en/profile` on redirect follow. The `safeNext()` validation in the callback handler does not need to change.

The one case that does need attention: if the login form passes `?next=` with a bare path like `/admin`, verify it gets the locale prefix added. The safest approach is to always let the middleware handle the redirect rather than constructing prefixed `next` params manually.

---

## Build Order

Route restructuring is a hard prerequisite for translation work. `useTranslations` and `getTranslations` only function once `[locale]` params are flowing through the component tree via next-intl's context. Do not start translation wiring until Phase 3 is stable.

### Phase 1 — Infrastructure setup (no user-visible change)

1. Create `src/i18n/routing.ts` — `defineRouting({ locales: ['en', 'ar'], defaultLocale: 'en', localePrefix: 'always' })`
2. Create `src/i18n/navigation.ts` — `createNavigation(routing)` exports
3. Create `src/i18n/request.ts` — `getRequestConfig` with locale validation and message loading
4. Create `src/messages/en.ts` and `src/messages/ar.ts` as stub TypeScript objects (`export default {}`)
5. Update `next.config.ts` — add `createNextIntlPlugin()` wrapper around `withBotId(nextConfig)`

App is unchanged at this point — next-intl is installed but no routes or middleware are active.

### Phase 2 — Middleware (routing changes, redirects activate)

6. Create `src/middleware.ts` using the composition pattern (i18n first, Supabase second, merge cookies)
7. Test: `GET /browse` returns `302` to `/en/browse`, response carries Supabase session cookies

**Verification gate:** Sign in → navigate to `/profile` → confirm redirect to `/en/profile` → session cookie present. Sign out. This gate must pass before Phase 3.

### Phase 3 — Route restructure (directory moves)

8. Create `src/app/[locale]/layout.tsx` — locale shell with `<html lang dir>`, `NextIntlClientProvider`, analytics
9. Move `src/app/(viewer)/` contents to `src/app/[locale]/(viewer)/`
10. Move `src/app/admin/` contents to `src/app/[locale]/admin/`
11. Strip `src/app/layout.tsx` to thin skeleton (fonts + metadata only, no `lang`/`dir`, no Toaster/Analytics)

**Verification gate:** All existing pages render at `/en/browse`, `/en/auth`, `/en/admin`, etc. Auth flow end-to-end.

### Phase 4 — Navigation import swaps

12. Swap all `next/link` → `@/i18n/navigation` in affected components
13. Swap all `useRouter`/`usePathname` from `next/navigation` → `@/i18n/navigation` in client components
14. Swap `redirect` from `next/navigation` → `next-intl/server` in server components and layouts
15. Replace `LocaleSwitcher` implementation — remove server action pattern
16. Delete `src/app/locale-actions.ts`

**Verification gate:** EN/AR toggle in navbar changes URL prefix. `<html dir>` flips on toggle.

### Phase 5 — `getLocale()` replacement in page files

17. In `series/[slug]/page.tsx`, `profile/page.tsx`, `watch/[episodeId]/page.tsx`: replace `getLocale()` from `@/lib/locale` with `getLocale()` from `next-intl/server`
18. Remove `getLocale()` function from `src/lib/locale.ts` and its `cookies()` import
19. Keep `dirFor()` and `pickLocalized()` in `src/lib/locale.ts` — pure helpers, no migration needed

### Phase 6 — Translation wiring (separate milestone work)

20. Populate `src/messages/en.ts` and `src/messages/ar.ts` with actual UI string dictionaries
21. Replace hardcoded UI strings with `useTranslations` (client components) and `getTranslations` (async server components)
22. Update `LocaleSwitcher` to read current locale from `useLocale()` hook rather than prop
23. Add `alternates.languages` to `generateMetadata` in series and watch page files

---

## Component Boundary Diagram

```
src/app/layout.tsx  (Root — Server Component)
  Owns: font CSS variables, generateMetadata, global CSS import
  Does NOT own: html lang/dir, Toaster, Analytics, any locale logic

  └── src/app/[locale]/layout.tsx  (Locale Shell — Server Component)
        Owns: <html lang dir>, NextIntlClientProvider + messages,
              Toaster, Analytics, SpeedInsights, GA/Pixel scripts
        Reads: params.locale from URL segment (not cookie)

        ├── src/app/[locale]/(viewer)/layout.tsx  (Viewer Shell — Server Component)
        │     Owns: Navbar (passes user), Footer, pt-24 content padding
        │     Reads: Supabase session
        │
        │     └── [all viewer pages]
        │           Reads locale via: getLocale() from next-intl/server
        │           Client components: useLocale() from next-intl
        │
        └── src/app/[locale]/admin/layout.tsx  (Admin Shell — Server Component)
              Owns: auth guard (redirect if not admin), AdminHeader
              Reads: Supabase session

              └── [all admin pages]

src/app/api/  (Route Handlers — excluded from middleware matcher)
  No locale handling needed
```

---

## Supabase-Specific Integration Notes

### `updateSession` is safe as-is

`updateSession` operates on `request.cookies`, not URL paths. The URL changing from `/browse` to `/en/browse` is invisible to it. No modifications needed.

### Auth redirect paths

When a logged-out user hits `/en/profile`, the layout's `redirect('/auth')` (using next-intl's server redirect) produces `/en/auth` automatically. Correct behavior.

### Supabase dashboard configuration

After the middleware is live, the Supabase Auth dashboard needs:
- **Site URL:** unchanged (domain-level, not path-level)
- **Redirect URLs:** Add `/en/auth/callback` and `/ar/auth/callback`, or use a wildcard pattern. The safest option is to keep the configured redirect as `/auth/callback` (no locale prefix) and let middleware promote it to `/en/auth/callback` — this avoids updating the Supabase dashboard for each locale.

### Supabase OAuth provider callback

If Google/GitHub OAuth is added later, the OAuth provider's authorized callback URI must be the full URL without locale prefix. The middleware promotion chain handles the rest.

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/middleware.ts` | i18n routing + Supabase session composition |
| `src/i18n/routing.ts` | `defineRouting` — single source of truth for locales |
| `src/i18n/navigation.ts` | `createNavigation` — locale-aware Link, useRouter, redirect, usePathname |
| `src/i18n/request.ts` | `getRequestConfig` — per-request locale + message loading |
| `src/messages/en.ts` | English UI strings (TypeScript export, not JSON) |
| `src/messages/ar.ts` | Arabic UI strings (TypeScript export, not JSON) |
| `src/app/[locale]/layout.tsx` | Locale shell with `<html lang dir>` + NextIntlClientProvider |

## Files to Delete

| File | Reason |
|------|--------|
| `src/app/locale-actions.ts` | Cookie-based locale switching replaced by URL navigation |

## Files to Modify

| File | Change summary |
|------|---------------|
| `src/app/layout.tsx` | Strip locale logic; becomes thin skeleton |
| `next.config.ts` | Add `createNextIntlPlugin()` wrapper |
| `src/lib/locale.ts` | Remove `getLocale()` and `cookies()` import; keep `dirFor()` and `pickLocalized()` |
| `src/components/layout/locale-switcher.tsx` | Replace server action pattern with `router.replace(pathname, { locale })` |
| `src/components/layout/nav-links.tsx` | Swap Link and usePathname imports |
| `src/components/layout/user-dropdown.tsx` | Swap useRouter import |
| `src/app/(viewer)/profile/page.tsx` | Swap `redirect` import to next-intl/server |
| `src/app/admin/layout.tsx` | Swap `redirect` import to next-intl/server |
| Any page using `<Link>` from next/link | Swap Link import |
