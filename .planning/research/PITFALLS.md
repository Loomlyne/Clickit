# i18n Migration Pitfalls: Arabic URL-Prefix Routing

**Domain:** Next.js 16 App Router — cookie-based locale → /[locale]/ URL prefix migration
**Codebase:** Clickit Story, 323 files, 13,259 LOC
**Stack:** Next.js 16.2.1, next-intl 4.9.1 (installed, unwired), Tailwind CSS v4, shadcn/ui, Supabase SSR 0.10.0, React 19
**Researched:** 2026-04-20

---

## Critical — Breaks Auth or Routing

---

### C-1: Password Reset Callback URL Hardcoded Without Locale Segment

**File:** `src/components/auth/login-form.tsx:74`

**What goes wrong:**
The password-reset flow constructs its Supabase `redirectTo` as:
```
`${window.location.origin}/auth/callback?next=/auth/reset-password`
```
After migration, the callback route lives at `/en/auth/callback` (or `/ar/auth/callback`). The hardcoded path `/auth/callback` will 404 — the route file moves to `src/app/[locale]/(viewer)/auth/callback/route.ts` and no longer exists at the bare path.

The fallback error redirect in `src/app/(viewer)/auth/callback/route.ts:34` sends to `/auth?error=...` — same breakage. Post-migration this sends to a 404.

**Prevention:**
Construct the callback URL dynamically by reading the locale from `window.location.pathname`:
```typescript
const locale = window.location.pathname.split('/')[1] || 'en'
redirectTo: `${window.location.origin}/${locale}/auth/callback?next=/${locale}/auth/reset-password`
```
Also update the error fallback in `route.ts` to extract locale from `new URL(request.url).pathname` before constructing the error redirect.

Add a permanent redirect at `/auth/callback` → `/en/auth/callback` to handle password-reset emails already sent before the migration.

---

### C-2: Coming-Soon Allowlist Breaks — Redirect Loop on Admin Login

**File:** `proxy.ts:10-28`

**What goes wrong:**
```typescript
const COMING_SOON_ALLOWLIST = ['/coming-soon', '/admin', '/auth', '/api', '/support']
const isAllowlisted = COMING_SOON_ALLOWLIST.some(
  (p) => pathname === p || pathname.startsWith(`${p}/`)
)
```
After migration, the admin visits `/en/auth` to log in while `comingSoonMode` is active. The pathname `/en/auth` does not match `/auth` and does not start with `/auth/` — the allowlist check fails. The coming-soon gate fires, redirecting to `/coming-soon` (or `/en/coming-soon`), which itself is not allowlisted at the bare path, creating a redirect loop.

**Prevention:**
Strip the locale segment before the allowlist check:
```typescript
const localeMatch = pathname.match(/^\/(en|ar)(\/|$)/)
const strippedPath = localeMatch ? pathname.slice(localeMatch[1].length + 1) || '/' : pathname
const isAllowlisted = COMING_SOON_ALLOWLIST.some(
  (p) => strippedPath === p || strippedPath.startsWith(`${p}/`)
)
```

---

### C-3: Middleware Redirect Loop — Locale Detection Re-Triggers Itself

**File:** `proxy.ts` + new locale middleware

**What goes wrong:**
A bare `/` request → locale middleware redirects to `/en/`. If the matcher pattern is not precise, the `/en/` request triggers the middleware again. The middleware checks for a locale prefix, finds it, does not redirect — but if there is any logic gap (wrong regex, fallthrough case), it loops.

The specific risk here: `withBotId` in `next.config.ts` wraps the app and injects its own edge middleware. If locale middleware and BotID each return `NextResponse.next({ request })` creating a new response, and then the next layer also calls `NextResponse.next({ request })`, cookies set in an earlier layer can be silently dropped because each `NextResponse.next({ request })` creates a fresh response that does not carry forward previous `Set-Cookie` headers unless explicitly copied.

**Prevention:**
- The matcher must exclude already-prefixed paths and static assets:
  ```
  '/((?!en|ar|_next|api|.*\\..*).*)'
  ```
- Add an explicit early return at the top of middleware:
  ```typescript
  if (/^\/(en|ar)(\/|$)/.test(pathname)) {
    return NextResponse.next()
  }
  ```
- Test `withBotId` interop: after introducing locale redirect logic, verify that BotID's challenge header is preserved on both the redirect response and the destination request.

---

### C-4: Supabase Session Cookie Dropped by Locale Redirect

**File:** `src/lib/supabase/middleware.ts` + `proxy.ts`

**What goes wrong:**
`updateSession()` creates `NextResponse.next({ request })` and sets refreshed session cookies on that response object. When locale middleware runs and returns a `NextResponse.redirect()` to add the locale prefix, that redirect response is a new object — it does not carry the cookies that `updateSession()` set on the previous response. The session refresh is silently discarded. The user lands on the locale-prefixed page with an expired session and gets logged out.

**Prevention:**
When returning a locale redirect after `updateSession()`, copy all cookies from the Supabase response to the redirect response:
```typescript
const { response: supabaseResponse } = await updateSession(request)
// ... determine locale redirect needed
const localeRedirect = NextResponse.redirect(newUrl)
supabaseResponse.cookies.getAll().forEach(c =>
  localeRedirect.cookies.set(c.name, c.value, { path: c.path })
)
return localeRedirect
```

---

### C-5: Server-Side `redirect()` Calls Drop the Locale Prefix

**Files (all use bare paths):**
- `src/app/(viewer)/my-list/page.tsx:19` — `redirect('/auth?next=/my-list')`
- `src/app/(viewer)/profile/page.tsx:22` — `redirect('/auth')`
- `src/app/admin/layout.tsx:9` — `redirect('/browse')`
- `src/app/admin/layout.tsx:17` — `redirect('/browse')`
- `src/app/(viewer)/browse/page.tsx:37` — `redirect('/')`

**What goes wrong:**
An Arabic-locale user on `/ar/my-list` with an expired session hits `redirect('/auth?next=/my-list')`. They land on `/auth?next=/my-list` — the locale is stripped. After login, the `?next=` value `/my-list` is forwarded to the auth callback, which redirects to `/my-list` (bare path). Middleware detects no locale → redirects to `/en/my-list` defaulting to English. The user signed in from an Arabic page but ends up in English.

The admin redirect pattern (`redirect('/browse')`) is also wrong: an authenticated Arabic admin gets bounced to `/browse` (bare), then normalized to `/en/browse`.

**Prevention:**
In Next.js App Router, `params` in Server Components now provides `locale` when wrapped in `[locale]` segment. Use a small helper:
```typescript
// src/lib/locale-redirect.ts
export function localePath(locale: string, path: string): string {
  return `/${locale}${path}`
}
```
All five call sites need `params` awaited for `locale` then passed through `localePath`.

---

### C-6: Client-Side `router.push()` Strips Locale Prefix

**Files (all push bare paths):**
- `src/components/auth/login-form.tsx:65` — `router.push(result.isAdmin ? '/admin' : '/')`
- `src/components/auth/signup-form.tsx:66` — `router.push('/browse')`
- `src/components/auth/reset-password-form.tsx:54` — `router.push('/')`
- `src/components/layout/auth-section.tsx:95` — `router.push('/browse')` (after sign-out)
- `src/components/layout/user-dropdown.tsx:34` — `router.push('/profile')`
- `src/components/layout/user-dropdown.tsx:41` — `router.push('/admin')`
- `src/components/watch/watch-page-content.tsx:92` — `` router.push(`/watch/${nextEpisode.id}`) ``

**What goes wrong:**
After login on `/ar/auth`, `router.push('/')` navigates to `/`. The middleware detects no locale prefix and must infer the locale. If the cookie was cleared during the sign-in session exchange (possible with BotID + Supabase double-write), the inference defaults to English. An Arabic user logs in and lands in English.

**Prevention:**
Replace `next/navigation`'s `useRouter` with `next-intl/navigation`'s `useRouter` across all 7 components. next-intl's router transparently prepends the current locale to all `push/replace` calls. This is the single highest-leverage change — one import swap eliminates the issue at all call sites.

```typescript
// Replace in all 7 files:
import { useRouter } from 'next/navigation'
// With:
import { useRouter } from 'next-intl/navigation'
```

---

## High — Breaks Visual Layout or RTL Rendering

---

### H-1: Episode Navigation Chevrons Semantically Inverted in RTL

**File:** `src/components/watch/episode-nav.tsx:30-80`

**What goes wrong:**
The "Previous" button uses `<ChevronLeft>` and `justify-start`. In RTL layout, the logical start is the visual right. ChevronLeft (pointing left) in an RTL context visually signals "go forward to later content" — the opposite of intended. The "Next" button has `text-right` on its label div, which in RTL aligns text to the physical right (i.e., the logical start — the wrong side for a trailing element).

**Prevention:**
Swap icons based on current `dir`:
```tsx
const isRtl = dir === 'rtl'
// Previous button:
{isRtl ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
// Next button:
{isRtl ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
```
Replace `text-right` → `text-end`, `justify-start` → `justify-self-start`, `justify-end` → `justify-self-end`.

---

### H-2: Hero Vignette Gradient Hard-Coded Left-to-Right

**Files:**
- `src/components/home/hero-slide.tsx:49` — `bg-gradient-to-r from-black/70 via-transparent to-transparent`
- `src/components/series/series-detail-hero.tsx:102` — same pattern
- `src/styles/globals.css:150` — `--gradient-left-vignette: linear-gradient(90deg, rgba(6,7,10,0.92) 0%, ...)`

**What goes wrong:**
The gradient fades from opaque black on the left to transparent on the right, creating a dark readable zone for the text overlay. In RTL layout, text content is right-aligned — it sits on the transparent side of the gradient, becoming unreadable against the poster image.

**Prevention:**
Tailwind CSS v4 does not have a built-in `bg-gradient-to-e` (logical end) utility. Options:
1. Add to `@theme` in `globals.css`:
   ```css
   [dir='rtl'] .hero-vignette {
     transform: scaleX(-1);
   }
   ```
   Apply class `hero-vignette` to the vignette div and the transform flips the gradient without changing markup.
2. For `--gradient-left-vignette` CSS variable, add `--gradient-right-vignette` and use:
   ```css
   [dir='rtl'] .vignette-overlay {
     background-image: var(--gradient-right-vignette);
   }
   ```

---

### H-3: Sheet and Dialog Close Buttons at Wrong Corner in RTL

**Files:**
- `src/components/ui/sheet.tsx:78` — `absolute top-4 right-4`
- `src/components/ui/dialog.tsx:73` — `absolute top-4 right-4`

**What goes wrong:**
In RTL, physical `right-4` is the top-left corner — where Arabic users expect the *beginning* of content, not a close button. The close button visually collides with or overlaps the panel title/heading.

**Prevention:**
Replace `right-4` with `end-4`. Tailwind v4 supports `end-4` as the `inset-inline-end: 1rem` logical property, which maps to right in LTR and left in RTL.

This is a one-word change per file. Do it during route restructure phase so the base components are correct before RTL testing begins.

---

### H-4: Carousel Navigation Buttons Physically Pinned, Swipe Direction Inverted

**File:** `src/components/ui/carousel.tsx:190,220`

**What goes wrong:**
Previous button: `-left-12 -translate-y-1/2` — physically on the left edge regardless of locale.
Next button: `-right-12 -translate-y-1/2` — physically on the right edge.

In RTL layout, "previous" should be on the right and "next" on the left. Additionally, Embla Carousel's default swipe handler treats left-swipe as "scroll forward (next)" — in Arabic reading direction, rightward swipe should mean forward. Without `direction: 'rtl'` passed to Embla, swipe navigation is semantically inverted for Arabic users.

**Prevention:**
- Replace `-left-12` with `-start-12` and `-right-12` with `-end-12` on the nav button containers.
- Pass `direction: 'rtl'` in Embla options when locale is `ar`:
  ```tsx
  const opts = locale === 'ar' ? { direction: 'rtl' } : {}
  <Carousel opts={opts}>
  ```

---

### H-5: Password Toggle Eye Button Overlaps Cursor in RTL Input

**Files:**
- `src/components/auth/login-form.tsx:180` — `absolute right-3 top-1/2 -translate-y-1/2`
- `src/components/auth/reset-password-form.tsx:83` — same
- `src/components/auth/reset-password-form.tsx:105` — same

**What goes wrong:**
In RTL, password input text flows from the right. The toggle button at physical `right-3` sits at the *text entry start position* — directly where the user is typing. The button overlaps the cursor.

**Prevention:**
Replace `right-3` with `end-3` in all three occurrences. In RTL, `end-3` resolves to `left: 0.75rem` — the trailing edge of the field, which is visually correct.

---

### H-6: `ml-auto` on Dropdown Shortcut and Submenu Chevron Does Not Flip

**File:** `src/components/ui/dropdown-menu.tsx:187,220`

**What goes wrong:**
```tsx
"ml-auto text-xs tracking-widest text-muted-foreground"  // keyboard shortcut
<ChevronRightIcon className="ml-auto size-4" />           // submenu indicator
```
`ml-auto` is a physical margin — pushes content to the right regardless of locale. In RTL menus, shortcuts and submenu arrows should appear on the *left* (logical start). They appear on the wrong side.

`ChevronRightIcon` pointing right in RTL means "expand toward the right" — but in RTL, submenus open leftward. The arrow direction is semantically wrong.

**Prevention:**
- Replace `ml-auto` → `ms-auto` (margin-inline-start: auto).
- Apply `[dir='rtl'] .submenu-chevron { transform: scaleX(-1) }` or render `ChevronLeftIcon` conditionally.

---

### H-7: Excessive `tracking-[0.2em+]` on Arabic Text Breaks Glyph Joining

**Files:** 20+ components — concentrated in `src/components/home/`, `src/components/landing/`, `src/components/layout/footer.tsx`, `src/components/series/series-detail-hero.tsx`

Examples:
- `tracking-[0.28em]` — `hero-slide.tsx`, `landing-hero-animations.tsx`, auth page
- `tracking-[0.32em]` — `cta-banner.tsx`, `landing-faq.tsx`
- `tracking-[0.35em]` — `brand-stats.tsx`, `genre-pills.tsx`

**What goes wrong:**
Arabic glyphs depend on contextual joining — letters change shape based on their neighbors and must visually connect. Positive letter-spacing above ~0.05em physically separates the glyphs, breaking these joins. The result looks like disconnected, isolated letter forms — not broken exactly, but clearly wrong to any Arabic reader. It reads like someone typed every letter with a space between them.

**Prevention:**
Add a global CSS override to `globals.css`:
```css
[dir='rtl'] [class*='tracking-'] {
  letter-spacing: 0 !important;
}
```
Or apply a utility class `.tracking-wide-label` to all 20+ label patterns and target it specifically:
```css
[dir='rtl'] .tracking-wide-label { letter-spacing: 0; }
```
The second approach is more precise and avoids `!important`. The first is faster to implement during the translation phase.

---

### H-8: `.font-display` Negative Letter-Spacing Deforms Arabic Glyphs

**File:** `src/styles/globals.css:196-199`

```css
.font-display {
  font-family: var(--font-display);   /* = var(--font-jakarta) */
  letter-spacing: -0.025em;
}
```

**What goes wrong:**
`--font-display` resolves to Jakarta Sans. When `.font-display` is applied to a heading that contains Arabic text, Cairo font-family correctly overrides (via `[dir='rtl']` rule in globals). But `letter-spacing: -0.025em` from `.font-display` is inherited and still applied. Negative letter-spacing on Arabic causes glyphs to overlap — worse than positive spacing. Ligatures deform. Headlines look broken.

**Prevention:**
```css
[dir='rtl'] .font-display {
  letter-spacing: 0;
  font-family: var(--font-cairo), sans-serif;
}
```
Add to `globals.css` immediately after the `.font-display` rule.

---

### H-9: YouTube IFrame Player Must Stay in `dir='ltr'` Container

**File:** `src/components/watch/youtube-player.tsx`

**What goes wrong:**
The YouTube IFrame is a cross-origin document and ignores the parent page's `dir`. The iframe itself renders correctly. However, the loading/error overlays (`absolute inset-0`) that appear over the player do inherit RTL from the parent `<html dir='rtl'>`. For the loading/error overlays this is acceptable — they contain centered icons/text.

The real risk: any wrapper div above `YouTubePlayer` that uses physical `left:`/`right:` CSS to position or size the player region could shift its layout under RTL. More practically: if a future developer adds `ml-` or `mr-` margin to the watch page's player column assuming LTR, RTL will mirror it.

**Prevention:**
Add `dir='ltr'` to the outermost `<div>` in `YouTubePlayer`:
```tsx
<div
  dir="ltr"
  role="region"
  aria-label="Video player"
  className="relative w-full aspect-video min-h-[200px] bg-black"
>
```
This is a one-line change that future-proofs the component unconditionally.

---

### H-10: Logo SVG Placement Flips in RTL Flex Layout — Verify Intentionality

**File:** `src/components/layout/navbar.tsx:47`

**What goes wrong:**
The navbar is `flex justify-between`. In RTL, flex direction reverses: the logo (currently leftmost in LTR) moves to the right, and auth controls move to the left. This is actually the correct RTL convention for a media platform — brand identity on the trailing/right side in RTL contexts.

However, the Clickit logo SVG (`/brand/Clickit_final_logo.svg`) needs visual inspection. If it contains any directional decorative element (arrow, play symbol, trailing text), it will appear mirrored under RTL flex without an explicit `dir='ltr'` wrapper on the `<Image>` parent.

**Prevention:**
Inspect `public/brand/Clickit_final_logo.svg` for directional shapes. If directionally neutral, the RTL flip is acceptable. If it has a directional element:
```tsx
<Link href={...} dir="ltr" aria-label="Clickit Story home">
  <Image src="/brand/Clickit_final_logo.svg" ... />
</Link>
```

---

## Medium — Translation Quality and String Extraction

---

### M-1: Inline String Arrays in `.map()` Callbacks Not Caught by Extraction Tools

**File confirmed:** `src/app/(viewer)/auth/page.tsx:37-39`

```tsx
{['Original programming', 'Progress sync', 'Watchlist ready'].map((item) => (
  <span key={item}>{item}</span>
))}
```

**What goes wrong:**
Most i18n extraction workflows (next-intl's extraction, babel-plugin-react-intl, etc.) scan JSX children and attribute values. They do not scan array literals defined above the JSX. These strings are invisible to automated tools.

The `hero-slide.tsx` `mb-3` label patterns, the `genre-pills.tsx` label patterns, and the landing page feature badges all follow similar inline-array patterns.

**Detection:**
```bash
grep -rn "\['[A-Z]" src/ --include="*.tsx" | grep "\.map\|map("
```

**Prevention:**
Manual audit pass on all `.map()` callbacks before translation begins. Move English strings into translation key arrays in the JSON message files so they can be enumerated.

---

### M-2: `next-intl` Is Installed But Completely Unwired — Half-Wired State Is Dangerous

**File:** `package.json` — `"next-intl": "^4.9.1"` is a dependency

**What goes wrong:**
next-intl 4.x requires a specific setup: `createNavigation()`, a `routing` config, the `NextIntlClientProvider`, and a plugin in `next.config.ts`. None of this exists. The package is installed but dormant.

The danger: if someone partially wires next-intl during the migration (adds middleware but not the provider, or adds the provider but not the routing config), two locale-reading systems operate simultaneously — cookies from the existing `getLocale()` system and URL segments from next-intl. They can disagree. A Server Component reads locale `ar` from the URL. A Client Component reads `en` from the stale cookie. The UI renders bilingual content inconsistently without any error.

**Prevention:**
Make a binary decision before writing a single migration file:

**Option A: Fully adopt next-intl.**
Delete `src/lib/locale.ts` and `src/app/locale-actions.ts`. Replace `getLocale()` with next-intl's server `getLocale()`. Replace `useRouter` with `next-intl/navigation` `useRouter`. Wire `createNavigation()`, `NextIntlClientProvider`, and the next-intl plugin. This is the recommended path for long-term maintainability.

**Option B: Manual URL-prefix routing without next-intl.**
Remove next-intl from `package.json`. Implement locale detection in `proxy.ts`, read locale from `params.locale` in Server Components, pass it as a prop to Client Components. This avoids a dependency but requires more manual wiring.

Do NOT mix approaches. Choose one and complete it atomically.

---

### M-3: `sitemap.ts` Emits No `hreflang` Alternate URLs

**File:** `src/app/sitemap.ts`

**What goes wrong:**
The sitemap emits one entry per URL (e.g., `/series/show-slug`). After migration, Google expects `hreflang` alternate entries pointing to both `/en/series/show-slug` and `/ar/series/show-slug`. Without alternates, Google treats the Arabic version as a duplicate of English and may not index it, defeating the primary SEO rationale for the URL-prefix migration.

The `generateMetadata` functions in `series/[slug]/page.tsx` and `watch/[episodeId]/page.tsx` set `alternates: { canonical: '/series/${show.slug}' }` without locale prefix. These also need updating.

**Prevention:**
After completing route restructure, update `sitemap.ts` to emit locale-paired entries with `alternates.languages`:
```typescript
const locales = ['en', 'ar']
const showEntries = shows.flatMap((show) =>
  locales.map((locale) => ({
    url: `${base}/${locale}/series/${show.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    alternates: {
      languages: Object.fromEntries(
        locales.map(l => [l, `${base}/${l}/series/${show.slug}`])
      )
    }
  }))
)
```

---

### M-4: Cairo Font Does Not Cover All Arabic Characters in Real Content

**What goes wrong:**
Cairo covers the Arabic block (U+0600–U+06FF). It does NOT cover Arabic Extended-A (U+08A0–U+08FF) or Arabic Presentation Forms. For a UAE streaming platform, show titles and episode descriptions sourced from content providers may include characters outside Cairo's range — particularly if any metadata was copy-pasted from Arabic publishing tools or Word documents. These characters fall back to system fonts. On Android, system Arabic fallback is often Noto Naskh Arabic (fine) but can be rendered as replacement squares on some devices.

**Prevention:**
Before translation phase begins, query the Supabase database and check all Arabic text fields (`title_ar`, `description_ar`, etc.) for characters outside U+0600–U+06FF:
```sql
SELECT id, title_ar
FROM shows
WHERE title_ar ~ '[^\u0000-\u06FF\u0020-\u007E]'
```
Correct any out-of-range characters at the content level rather than loading additional font subsets.

---

### M-5: `font-feature-settings: "cv01", "ss03"` Applied to Arabic via `body` Inheritance

**File:** `src/styles/globals.css:171`

```css
body {
  font-feature-settings: "cv01", "ss03";
}
```

**What goes wrong:**
These OpenType features are Jakarta Sans-specific stylistic alternates. They are inherited by all descendants, including Arabic text rendered in Cairo. Cairo silently ignores unknown feature tags — this is not a visible breakage today. The risk is future: if Cairo adds `cv01`/`ss03` variants with different glyph shapes, Arabic text could shift unexpectedly when the font is updated.

**Prevention:**
Scope the feature settings to LTR context:
```css
:root:not([dir='rtl']) body,
[dir='ltr'] {
  font-feature-settings: "cv01", "ss03";
}
```

---

## Prevention Checklist

### Route Restructure Phase — Do These Before Any Translation Work

- [ ] **C-1**: Update `login-form.tsx` password reset `redirectTo` to extract locale from `window.location.pathname`
- [ ] **C-1**: Update `auth/callback/route.ts` error fallback to extract locale from request URL before constructing `/auth?error=...` redirect
- [ ] **C-1**: Add permanent redirect `/auth/callback` → `/en/auth/callback` for existing emails in the wild
- [ ] **C-2**: Update `proxy.ts` COMING_SOON_ALLOWLIST check to strip locale prefix before matching
- [ ] **C-3**: Add early return in middleware: `if (/^\/(en|ar)(\/|$)/.test(pathname)) return NextResponse.next()`
- [ ] **C-3**: Verify matcher pattern excludes already-prefixed paths
- [ ] **C-3**: Test `withBotId` interop — confirm BotID challenge header survives locale redirect
- [ ] **C-4**: Copy Supabase response cookies to locale redirect response — never return a bare `NextResponse.redirect()` after `updateSession()`
- [ ] **C-5**: Create `localePath(locale, path)` helper at `src/lib/locale-redirect.ts`
- [ ] **C-5**: Update all 5 bare server-side `redirect()` calls to use `localePath()`
- [ ] **C-6**: Replace `next/navigation` `useRouter` with `next-intl/navigation` `useRouter` in all 7 client components
- [ ] **H-3**: Replace `right-4` → `end-4` in `sheet.tsx` and `dialog.tsx` close buttons (2 files, 1 change each)
- [ ] **H-9**: Add `dir='ltr'` to outermost div in `youtube-player.tsx`
- [ ] **M-2**: Make the binary decision — full next-intl adoption vs manual routing. Do not leave partially wired.

### Translation Phase — Do These Before Arabic Goes Live

- [ ] **H-1**: Fix episode nav chevrons — swap ChevronLeft/Right by `dir`; replace `text-right` → `text-end`
- [ ] **H-2**: Add `[dir='rtl'] .hero-vignette { transform: scaleX(-1) }` to `globals.css`; apply class to vignette divs in `hero-slide.tsx` and `series-detail-hero.tsx`
- [ ] **H-4**: Add `direction: 'rtl'` Embla option when `locale === 'ar'`; replace `-left-12`/`-right-12` on carousel nav with `-start-12`/`-end-12`
- [ ] **H-5**: Replace `right-3` → `end-3` on all 3 password toggle buttons
- [ ] **H-6**: Replace `ml-auto` → `ms-auto` in `dropdown-menu.tsx`; flip `ChevronRightIcon` for RTL submenus
- [ ] **H-7**: Add `[dir='rtl'] .tracking-wide-label { letter-spacing: 0; }` to `globals.css`; apply `.tracking-wide-label` to all `tracking-[0.2em+]` label patterns (20+ components)
- [ ] **H-8**: Add `[dir='rtl'] .font-display { letter-spacing: 0; font-family: var(--font-cairo), sans-serif; }` to `globals.css`
- [ ] **H-10**: Inspect `public/brand/Clickit_final_logo.svg` for directional shapes; add `dir='ltr'` wrapper if needed
- [ ] **M-1**: Run `grep -rn "\['[A-Z]" src/ --include="*.tsx" | grep "\.map"` and manually convert all inline string arrays to translation keys
- [ ] **M-3**: Update `sitemap.ts` to emit `hreflang` alternate entries for both locales per content URL
- [ ] **M-3**: Update `generateMetadata` in `series/[slug]/page.tsx` and `watch/[episodeId]/page.tsx` to include `alternates.languages`
- [ ] **M-4**: Query Supabase for out-of-range Arabic characters in all `_ar` fields before launch
- [ ] **M-5**: Scope `font-feature-settings: "cv01", "ss03"` to `[dir='ltr']` in `globals.css`

---

## Phase-Specific Warnings Summary

| Phase | File | Pitfall | Priority |
|-------|------|---------|----------|
| Route restructure | `proxy.ts` | COMING_SOON_ALLOWLIST fails on `/en/auth` → admin locked out during coming-soon mode | CRITICAL |
| Route restructure | `proxy.ts` + `supabase/middleware.ts` | Session cookies dropped by locale redirect → users logged out | CRITICAL |
| Route restructure | `auth/callback/route.ts` | Error redirect to `/auth?error=` → 404 post-migration | CRITICAL |
| Route restructure | `login-form.tsx` | Password reset email links break → 404 on callback URL | CRITICAL |
| Route restructure | 7 client components | `router.push('/browse')` strips locale → wrong locale post-login | CRITICAL |
| Route restructure | 5 server pages/layouts | `redirect('/auth')` strips locale → auth loop or wrong locale | CRITICAL |
| Route restructure | `package.json` | next-intl installed but unwired — must decide approach before any migration code | HIGH |
| Translation | `episode-nav.tsx` | ChevronLeft/Right semantically inverted in RTL | HIGH |
| Translation | `hero-slide.tsx`, `series-detail-hero.tsx` | Vignette gradient makes Arabic text unreadable | HIGH |
| Translation | `carousel.tsx` | Swipe direction and button positions inverted for Arabic | HIGH |
| Translation | `sheet.tsx`, `dialog.tsx` | Close buttons at wrong corner in RTL modals | HIGH |
| Translation | 20+ components | Wide letter-spacing breaks Arabic glyph joining | HIGH |
| Translation | `globals.css` | Negative letter-spacing on `.font-display` deforms Arabic headlines | HIGH |
| Translation | `auth/page.tsx` + others | Inline string arrays in `.map()` missed by extraction tools | MEDIUM |
| Translation | `sitemap.ts` | No `hreflang` alternates → Arabic pages not crawled separately | MEDIUM |
| Translation | Supabase content | Out-of-range Arabic Unicode in content fields → rendering squares on Android | MEDIUM |
