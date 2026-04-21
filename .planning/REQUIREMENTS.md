# Requirements — Milestone v1.1 Full Bilingual UI (AR/EN)

**Derived from:** `.planning/research/SUMMARY.md` (research pass 2026-04-20)
**Status:** Requirements mapped to phases 12–17 (roadmap 2026-04-20)

---

## v1.1 Requirements

### Translation Infrastructure (`I18N-*`)

Goal: wire `next-intl@4.9.1` (already installed) as the primary i18n system.

- [x] **I18N-01**: `src/i18n/routing.ts` defines `defineRouting({ locales: ['en','ar'], defaultLocale: 'en', localePrefix: 'always' })`
- [x] **I18N-02**: `src/i18n/request.ts` implements `getRequestConfig` that awaits `requestLocale`, validates it, and returns the matching message dictionary
- [x] **I18N-03**: `src/i18n/navigation.ts` re-exports `Link`, `useRouter`, `redirect`, `usePathname` from `createNavigation(routing)` so locale prefix is preserved
- [x] **I18N-04**: `src/messages/en.json` + `src/messages/ar.json` dictionary files created with namespaces (`nav`, `auth`, `home`, `show`, `player`, `search`, `profile`, `myList`, `comingSoon`, `support`, `faq`, `admin`, `errors`, `common`)
- [x] **I18N-05**: `NextIntlClientProvider` wired into `[locale]/layout.tsx` with `setRequestLocale(locale)` called at the top of every page + layout for static rendering support *(Phase 12 delivered prerequisite: getRequestConfig ready; final wiring delivered 2026-04-21 in Phase 13 plan 01)*
- [x] **I18N-06**: `generateStaticParams` exports `[{locale: 'en'}, {locale: 'ar'}]` on `[locale]/layout.tsx` *(Phase 12 delivered prerequisite: staticParams helper exported from routing.ts; final wiring delivered 2026-04-21 in Phase 13 plan 01)*
- [x] **I18N-07**: Existing `dirFor()` and `pickLocalized()` helpers in `src/lib/locale.ts` continue to work unchanged (domain-specific, not replaced)

### Route Restructure + Auth Safety (`RTE-*`)

Goal: move pages under `src/app/[locale]/...` and fix the 6 latent auth/routing breaks atomically in the same PR.

- [x] **RTE-01**: All pages moved under `src/app/[locale]/`. `(viewer)` and `admin` route groups preserved inside the `[locale]` segment *(delivered 2026-04-21 in Phase 13 plan 01; 38 files moved via git mv, blame preserved)*
- [x] **RTE-02**: Root `src/app/layout.tsx` reduced to minimal shell (children + html body); locale-aware `html dir lang` attributes move to `[locale]/layout.tsx` *(delivered 2026-04-21 in Phase 13 plan 01; root slimmed 148 → 15 lines)*
- [x] **RTE-03**: `proxy.ts` composes `createMiddleware(routing)` with existing Supabase `updateSession()` — Supabase auth cookies merged onto the i18n response so locale redirects do not log users out (Pitfall #1) *(delivered 2026-04-21 in Phase 13 plan 02, commit 5503cda)*
- [ ] **RTE-04**: ~7 client components using `useRouter` from `next/navigation` swap to `@/i18n/navigation` so navigation preserves locale prefix (Pitfall #2) *(hook half — 10 useRouter + 4 usePathname — delivered 2026-04-21 in Phase 13 plan 03a, commits 82c6735 / b9cb442; `next/link` half pending in plan 13-03b)*
- [x] **RTE-05**: Hard-coded redirects to `/auth/login` in auth actions and protected routes become locale-aware (`redirect` from `@/i18n/navigation`) (Pitfall #3) *(delivered 2026-04-21 in Phase 13 plan 03a, commits 2740da6 / 9b079ba — 5 Server Component redirect swaps with {href, locale} signature)*
- [x] **RTE-06**: Supabase auth callback `?next=` redirect handling audited and preserved with locale context (Pitfall #4) *(delivered 2026-04-21 in Phase 13 plan 04, commit 8d90206 — locale-aware safeNext(raw, locale), resolveLocale() cookie reader, error redirect lands on /${locale}/auth)*
- [x] **RTE-07**: `coming-soon` redirect in `proxy.ts` becomes locale-aware — preserves `/en/` or `/ar/` prefix (Pitfall #5) *(delivered 2026-04-21 in Phase 13 plan 02, commit 5503cda)*
- [x] **RTE-08**: `src/app/locale-actions.ts`, `src/components/layout/locale-switcher.tsx`, and `src/components/profile/language-preference.tsx` replaced with next-intl navigation-based switcher that writes the URL (old cookie-only switcher becomes dead code) *(delivered 2026-04-21 in Phase 13 plan 05, commit c41c8de — cookie infra deleted, LanguagePreference rewritten to call router.replace(pathname, { locale }))*
- [x] **RTE-09**: `src/lib/site-url.ts` / sitemap / metadata base audited for locale-awareness — no broken absolute URLs after restructure *(delivered 2026-04-21 in Phase 13 plan 05, commit 3266fc7 — sitemap emits alternates.languages for every entry; site-url.ts audit confirmed resolver locale-agnostic, no changes needed)*

### Global Layout + RTL CSS (`RTL-*`)

Goal: `[locale]/layout.tsx` sets direction + Arabic font, and global CSS handles RTL mechanics that logical properties alone can't cover.

- [ ] **RTL-01**: `[locale]/layout.tsx` sets `<html lang={locale} dir={dirFor(locale)}>` from the route segment (not a cookie read)
- [ ] **RTL-02**: Cairo font loaded via `next/font` with `display: 'swap'` to avoid FOIT on Arabic pages
- [ ] **RTL-03**: Font stack falls back cleanly — Cairo for Arabic pages; existing Plus Jakarta Sans remains primary for English; CSS variables route correctly
- [ ] **RTL-04**: Global CSS rule in `globals.css` strips `letter-spacing` (`tracking-[0.2em+]`) for Arabic pages (`html[lang="ar"]` or `html[dir="rtl"]`) — ~20+ components currently use tight tracking that breaks Arabic glyph joining
- [ ] **RTL-05**: Tailwind directional classes migrated across all ~114 components — `ml-` → `ms-`, `mr-` → `me-`, `pl-` → `ps-`, `pr-` → `pe-`, `text-left` → `text-start`, `text-right` → `text-end`, `left-` → `start-`, `right-` → `end-`, `border-l` → `border-s`, `border-r` → `border-e`, `rounded-l-*` → `rounded-s-*`
- [ ] **RTL-06**: Directional icons (chevrons, arrows, skip-forward, back arrows) conditionally mirrored on `dir="rtl"` — media-control icons (play, pause, volume) and time-sensitive icons NOT mirrored
- [ ] **RTL-07**: Content rails (Embla) set `direction: rtl` on Arabic pages so swipe + arrow buttons flow right-to-left
- [ ] **RTL-08**: Video player (YouTube IFrame) controls stay LTR regardless of locale (industry-standard per Shahid, Netflix MENA, YouTube)

### Viewer Pages Translation (`VW-*`)

Goal: every visible string in the viewer surface resolves through `useTranslations()` / `getTranslations()`. No hardcoded English literals remain.

- [ ] **VW-01**: Landing page (`/`) — hero tagline, CTAs, section headings, FAQ entries, footer copy
- [ ] **VW-02**: Auth pages (`/auth`, `/auth/reset-password`, `/auth/callback` feedback) — form labels, buttons, error messages, social sign-in labels, validation copy
- [ ] **VW-03**: Browse page (`/browse`) — section headings, filter labels, empty states, load-more buttons
- [ ] **VW-04**: Series detail page (`/series/[slug]`) — tab labels, season selector, episode card metadata, About/Cast/Details labels, action buttons (Add to List, Play)
- [ ] **VW-05**: Season drawer — mobile-only drawer chrome (title, close button, episode list labels)
- [ ] **VW-06**: Watch page (`/watch/[episodeId]`) — episode title fallback, prev/next labels, autoplay countdown ("Next episode in Ns"), "Cancel autoplay", progress strings, keyboard-shortcut hints
- [ ] **VW-07**: My List (`/my-list`) — page heading, empty state copy, action buttons
- [ ] **VW-08**: Profile page (`/profile`) — section headings (Account Settings, Language, My List, Liked Shows, Recently Watched), form labels, save buttons, admin badge
- [ ] **VW-09**: Search page (`/search`) — search placeholder, result count, empty state, suggestions copy
- [ ] **VW-10**: Coming Soon page (`/coming-soon`) — page heading, show grid metadata, release-date labels
- [ ] **VW-11**: Support page (`/support`) — FAQ entries, contact form labels, help-article copy
- [ ] **VW-12**: Navbar (across all viewer pages) — auth link, profile menu items
- [ ] **VW-13**: Footer (across all viewer pages) — nav links, social links, copyright, legal labels
- [ ] **VW-14**: Design system pages (`/design-system/*`) excluded from translation — internal tooling, EN-only acceptable

### Admin Pages Translation (`ADM-*`)

Goal: admin staff (UAE-based) can operate the dashboard in Arabic.

- [ ] **ADM-01**: Admin dashboard (`/admin`) — section headings, nav tabs, quick-action buttons
- [ ] **ADM-02**: Show editor (`/admin/shows/[id]`) — form fields, validation messages, upload labels, save/delete/archive buttons, artwork slot labels
- [ ] **ADM-03**: Admin settings (`/admin/settings`) — tab labels (General/Branding/Integrations/Advanced), field labels, help text, save confirmations
- [ ] **ADM-04**: Archive view (`/admin/archive`) — page heading, restore/delete-permanent buttons, empty states
- [ ] **ADM-05**: Audit view (`/admin/audit`) — column headings, filter labels, date labels

### Dynamic Content (`DYN-*`)

Goal: strings that aren't visible in static page source — toasts, errors, ARIA, formatted dates/numbers.

- [ ] **DYN-01**: All `toast()` calls pass translated strings (success messages, error messages, watchlist-add confirmations, admin action confirmations)
- [ ] **DYN-02**: All `aria-label` attributes translated — screen-reader copy for buttons, navigation, interactive regions
- [ ] **DYN-03**: Empty states across all pages translated — "No results", "No liked shows yet", "No watch history"
- [ ] **DYN-04**: Form validation error messages (Zod / react-hook-form) translated — email format, required fields, password rules
- [ ] **DYN-05**: Supabase / Postgres error messages surfaced to the user run through a translation map — generic user-facing messages translated; raw technical strings still logged but not shown
- [ ] **DYN-06**: Date formatting via `Intl.DateTimeFormat(locale, …)` — broadcast schedule, release dates, continue-watching timestamps
- [ ] **DYN-07**: Number formatting via `Intl.NumberFormat(locale, …)` returns Western numerals (0-9) on both locales (Western-numerals convention for UAE market confirmed by research)

### Metadata & SEO (`META-*`)

Goal: search engines discover and index Arabic URLs as language variants of their English counterparts.

- [ ] **META-01**: Per-locale `<title>` and `<meta description>` generated via `generateMetadata` with `getTranslations('metadata')` on every page
- [ ] **META-02**: OpenGraph + Twitter card tags per locale (`og:title`, `og:description`, `og:locale`)
- [ ] **META-03**: `alternates.languages` set on every page's metadata so Google understands `/en/...` and `/ar/...` as language variants
- [ ] **META-04**: Sitemap (`src/app/sitemap.ts`) emits both locale versions for every route with `alternates: { languages: { en, ar } }`
- [ ] **META-05**: `robots.txt` unchanged — both locales crawlable
- [ ] **META-06**: `metadataBase` remains canonical (no per-locale host)

### Content & Polish (`POLISH-*`)

Goal: translation-adjacent content quality issues that show up once the mechanical translation work is done.

- [ ] **POLISH-01**: FAQ data (`src/lib/faq-data.ts`) extended with `_ar` fields; FAQ component reads localized fields via `pickLocalized()`
- [ ] **POLISH-02**: All `pickLocalized()` call sites audited — verify show titles, descriptions, genre labels, broadcast-day labels resolve correctly in Arabic
- [ ] **POLISH-03**: Text expansion QA — Arabic runs 25–40% wider than English; no button clipping, no card overflow, no nav wrapping. Captured by visual QA pass on all pages
- [ ] **POLISH-04**: Bidirectional text handled — show titles / brand names / timestamps inside Arabic paragraphs wrapped in `<span dir="ltr">` where needed to prevent punctuation flip
- [ ] **POLISH-05**: Visual regression — the existing English experience is pixel-identical after the migration (no unexpected layout shifts from logical-property rewrites)
- [ ] **POLISH-06**: Final Arabic copy review by human — no LLM-translated strings shipping to prod

---

## Future Requirements (Deferred)

- Additional locales (French, Urdu, Hindi) — add routing entries + dictionary files
- Per-show locale override (e.g., Arabic-only shows hidden from `/en/browse`)
- Language auto-detection from `Accept-Language` header on first visit (respect URL prefix above everything)
- Automated Arabic copy tooling (translation memory, QA pipeline)
- RTL-specific show artwork variants where directional composition matters

---

## Out of Scope

- Hijri calendar — UAE uses Gregorian
- Eastern Arabic-Indic numerals (٠-٩) — Western numerals (0-9) match UAE market convention
- Dialect variants (Emirati, Egyptian Arabic) — MSA only
- Icon mirroring for every icon — only directional icons
- Separate Arabic sitemap — handled via `alternates.languages` in the single sitemap
- LLM-translated Arabic strings shipping to prod — all Arabic copy human-reviewed
- Translation of DB columns without existing `_ar` pairs — admin fills via dashboard
- RTL-specific visual redesign of hero compositions — mirror via logical properties only
- Translating video player internals — YouTube player localizes to browser language already
- IP-geolocation for language detection — 5–15% false-positive rate against UAE's English-preferring residents

---

## Traceability

Mapped by roadmapper 2026-04-20. Coverage: **62/62** v1.1 requirements — no orphans, no duplicates. Phase totals: 12→7, 13→9, 14→8, 15→14, 16→5, 17→19 = 62.

| REQ-ID    | Phase | Status      |
|-----------|-------|-------------|
| I18N-01   | 12    | Complete (2026-04-21, af2ab35) |
| I18N-02   | 12    | Complete (2026-04-21, af2ab35) |
| I18N-03   | 12    | Complete (2026-04-21, af2ab35) |
| I18N-04   | 12    | Complete (2026-04-21, af2ab35) |
| I18N-05   | 12→13 | Complete — final wiring delivered 2026-04-21 (Phase 13 plan 01, commit 888bda9) |
| I18N-06   | 12→13 | Complete — final wiring delivered 2026-04-21 (Phase 13 plan 01, commit 888bda9) |
| I18N-07   | 12    | Complete (2026-04-21, af2ab35) |
| RTE-01    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 01, commit e857d21) |
| RTE-02    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 01, commit b246eba) |
| RTE-03    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 02, commit 5503cda) |
| RTE-04    | 13    | Partial — hook half delivered 2026-04-21 (Phase 13 plan 03a, commits 82c6735 / b9cb442); Link half pending in plan 13-03b |
| RTE-05    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 03a, commits 2740da6 / 9b079ba) |
| RTE-06    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 04, commit 8d90206) |
| RTE-07    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 02, commit 5503cda) |
| RTE-08    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 05, commit c41c8de) |
| RTE-09    | 13    | Complete — delivered 2026-04-21 (Phase 13 plan 05, commit 3266fc7) |
| RTL-01    | 14    | Not started |
| RTL-02    | 14    | Not started |
| RTL-03    | 14    | Not started |
| RTL-04    | 14    | Not started |
| RTL-05    | 14    | Not started |
| RTL-06    | 14    | Not started |
| RTL-07    | 14    | Not started |
| RTL-08    | 14    | Not started |
| VW-01     | 15    | Not started |
| VW-02     | 15    | Not started |
| VW-03     | 15    | Not started |
| VW-04     | 15    | Not started |
| VW-05     | 15    | Not started |
| VW-06     | 15    | Not started |
| VW-07     | 15    | Not started |
| VW-08     | 15    | Not started |
| VW-09     | 15    | Not started |
| VW-10     | 15    | Not started |
| VW-11     | 15    | Not started |
| VW-12     | 15    | Not started |
| VW-13     | 15    | Not started |
| VW-14     | 15    | Not started (scoped as exclusion — no action required) |
| ADM-01    | 16    | Not started |
| ADM-02    | 16    | Not started |
| ADM-03    | 16    | Not started |
| ADM-04    | 16    | Not started |
| ADM-05    | 16    | Not started |
| DYN-01    | 17    | Not started |
| DYN-02    | 17    | Not started |
| DYN-03    | 17    | Not started |
| DYN-04    | 17    | Not started |
| DYN-05    | 17    | Not started |
| DYN-06    | 17    | Not started |
| DYN-07    | 17    | Not started |
| META-01   | 17    | Not started |
| META-02   | 17    | Not started |
| META-03   | 17    | Not started |
| META-04   | 17    | Not started |
| META-05   | 17    | Not started |
| META-06   | 17    | Not started |
| POLISH-01 | 17    | Not started |
| POLISH-02 | 17    | Not started |
| POLISH-03 | 17    | Not started |
| POLISH-04 | 17    | Not started |
| POLISH-05 | 17    | Not started |
| POLISH-06 | 17    | Not started |

---

*Last updated: 2026-04-22 — v1.2 requirements appended below as queued next milestone*

---

# Requirements — Milestone v1.2 Editorial Feature Parity

**Derived from:** `/Users/koss/.claude/plans/1-everythin-in-editorial-binary-raccoon.md`
**Status:** SCAFFOLDED 2026-04-22 — Queued. Starts after v1.1 ships (Phase 13-06 + Phases 14-17 complete).
**Scope:** English-only (Arabic/RTL deferred to v1.3). Admin stays on default chrome.

---

## v1.2 Requirements

### Flag Infrastructure (`EPI-*`)

Goal: merge Editorial branch into main behind the `NEXT_PUBLIC_DESIGN` build flag; both Vercel projects deploy from main with different env vars.

- [ ] **EPI-01**: `src/lib/design.ts` exports `isEditorial` as a build-time constant (`NEXT_PUBLIC_DESIGN === 'editorial'`); dead-code-elim removes unused branch in each build mode
- [ ] **EPI-02**: Root `src/app/layout.tsx` conditionally attaches editorial next/font variables (`Space_Grotesk`, `Newsreader`, `JetBrains_Mono`) and sets `data-design="editorial"` on `<html>` when flag is set; viewer layout short-circuits with `{children}` so Editorial pages own their chrome
- [ ] **EPI-03**: `src/app/[locale]/admin/layout.tsx` NEVER branches on `isEditorial` — admin always renders default chrome regardless of build flag (accepted design decision for v1.2)

### Auth + User State (`EPA-*`)

Goal: Editorial surfaces get the same auth state wiring as primary — no placeholder email, no broken sign-in CTA.

- [ ] **EPA-01**: `EditorialHeader` accepts `initialUser` prop (same pattern as [src/components/layout/navbar.tsx](src/components/layout/navbar.tsx)); renders "Sign in" button when signed out, avatar dropdown with sign-out when signed in
- [ ] **EPA-02**: New `src/components/editorial/primitives/auth-section.tsx` — editorial-styled copy of [src/components/layout/auth-section.tsx](src/components/layout/auth-section.tsx) using `.btn-primary` and editorial colors; subscribes to `supabase.auth.onAuthStateChange`
- [ ] **EPA-03**: Every Editorial page.tsx short-circuit receives `userId` (from `getSession()` server-side) and threads it into the Editorial component; `EditorialProfile` displays real email + display name + avatar (not placeholder)

### Watchlist + Likes Wiring (`EPL-*`)

Goal: the `onToggleList` callbacks on Editorial primitives become real Supabase mutations.

- [ ] **EPL-01**: `EditorialPoster` accepts `initialSaved` + `userId` props; calls [src/hooks/use-watchlist.ts](src/hooks/use-watchlist.ts) internally; toggle state drives the heart/check icon
- [ ] **EPL-02**: `EditorialSeries` adds `LikeButton` slot in hero meta card (editorial-styled); wires [src/hooks/use-likes.ts](src/hooks/use-likes.ts)
- [ ] **EPL-03**: `EditorialRail` propagates batched `initialSavedMap` from server-computed state via existing `getShowWatchlistState()` in [src/lib/queries.ts](src/lib/queries.ts) — no per-poster roundtrip on page load
- [ ] **EPL-04**: `src/app/[locale]/(viewer)/my-list/page.tsx` threads real watchlist shows into `EditorialMyList`; toggle removes from list and updates UI optimistically

### Watch Page IFrame API (`EPW-*`)

Goal: replace Editorial's simple iframe with the full YouTube IFrame API integration, preserving editorial visual structure.

- [ ] **EPW-01**: `EditorialWatch` drops `playerSlot: ReactNode` prop; imports [src/components/watch/youtube-player.tsx](src/components/watch/youtube-player.tsx) directly; manages `playerInstance` state internally
- [ ] **EPW-02**: `EditorialWatch` calls [src/hooks/use-progress-tracker.ts](src/hooks/use-progress-tracker.ts) — 10s interval polling; force-flush on visibility change + unmount; `watch_progress` upsert
- [ ] **EPW-03**: `EditorialWatch` accepts `initialProgressSeconds` + `nextEpisode`; on player ready, calls `player.seekTo(initialProgressSeconds)` for resume; on `YT.PlayerState.ENDED`, shows autoplay overlay with countdown
- [ ] **EPW-04**: Editorial visual structure (`.yt-watch`, `.yt-main`, `.yt-side`, season tabs, episode list) renders identically to pre-port — the port is functional only, no visual change
- [ ] **EPW-05**: Error states (video unavailable, private, region-locked) render editorial-styled error overlay using the existing error codes from [src/components/watch/youtube-player.tsx](src/components/watch/youtube-player.tsx) (100/101/150)

### Continue Watching + Recently Watched (`EPC-*`)

Goal: Editorial browse surfaces user's in-progress episodes; profile surfaces history.

- [ ] **EPC-01**: `EditorialBrowse` renders Continue Watching rail above "Now Streaming" when non-empty; data from `getRecentlyWatched(userId)` (uses DB filter pushdown via `!inner` join — don't rebuild)
- [ ] **EPC-02**: `EditorialProfile` renders Recently Watched section with thumbnails + show title + relative-time labels (via `date-fns formatDistanceToNow`); finished episodes (≥95% progress) don't appear in Continue Watching but do appear in Recently Watched

### Remaining Routes (`EPR-*`)

Goal: Search, Coming Soon, Support, Auth all have functional Editorial variants.

- [ ] **EPR-01**: `EditorialSearch` drops client-side substring filter; renders server-provided FTS results from existing `searchShows(q)` + `searchEpisodes(q)` in [src/lib/queries.ts](src/lib/queries.ts); `.rail` scroll-snap preserved
- [ ] **EPR-02**: `EditorialComingSoon` renders upcoming shows grid + episodes-by-show section from real DB data; empty states match primary's tone
- [ ] **EPR-03**: New `EditorialSupport` renders `<ContactForm>` (real submission, toast confirms) + FAQ accordion using [src/lib/faq-data.ts](src/lib/faq-data.ts)
- [ ] **EPR-04**: New `<EditorialAuth>` wraps existing `<AuthPanel>` in editorial chrome; email/password, OAuth, reset-password all work; short-circuits from `src/app/[locale]/(viewer)/auth/page.tsx` when `isEditorial`

### Feature Flags (`EPF-*`)

Goal: the coming-soon gate applies equally to Editorial and primary.

- [ ] **EPF-01**: `flags.comingSoonMode` check runs BEFORE the `isEditorial` short-circuit in `src/app/[locale]/(viewer)/layout.tsx`; Editorial viewer routes redirect to `/coming-soon` when gate is on; admin layout never gates

### Performance (`EPP-*`)

Goal: Editorial's Lighthouse scores match primary's.

- [ ] **EPP-01**: `EditorialPoster` swaps raw `<img>` for `next/image` for all poster/backdrop/landscape variants; responsive srcset generated automatically
- [ ] **EPP-02**: Editorial respects server-side mobile detection from [src/lib/device.ts](src/lib/device.ts) — mobile hero variant downloaded on mobile builds, desktop variant on desktop
- [ ] **EPP-03**: Hero carousel auto-rotate (`setInterval` 7s in `EditorialBrowse`) pauses when `matchMedia('(prefers-reduced-motion: reduce)')` matches
- [ ] **EPP-04**: Heavy rails below the fold lazy-mount (dynamic import or IntersectionObserver); Editorial CSS remains scoped under `html[data-design="editorial"]` — no leakage to default builds (~6KB gzip ships in both)

### Deploy + Verification (`EPD-*`)

Goal: Editorial v1.2 live; primary unchanged.

- [ ] **EPD-01**: `clickit-editorial.vercel.app` passes the 10-item smoke test: (1) landing renders editorial chrome, (2) sign in from editorial auth page, (3) browse rails (Continue Watching + Now Streaming + Coming Soon), (4) series detail + season tabs play episode, (5) watch page progress-tracks (verify Supabase `watch_progress`), (6) autoplay-next countdown + advance, (7) watchlist toggle + `/my-list` roundtrip, (8) like toggle + Supabase `likes`, (9) search FTS, (10) support form submits
- [ ] **EPD-02**: `clickitstory.com` spot-check (landing + browse + one watch page) confirms primary chrome unchanged; no regression from merge; git tag `v1.2` created on the merged commit

---

## v1.2 Out of Scope

- Arabic / RTL for Editorial — deferred to v1.3
- Redesigning Editorial visuals — this milestone is logic-porting only, no CSS/font/component visual changes
- Admin Editorial theming — `/admin/*` stays on default chrome forever
- Editorial-exclusive features — if a feature exists on primary it must exist on Editorial, no new features gated to Editorial only
- Modifying primary behavior — primary stays untouched, validated by Phase 26 smoke test

---

## v1.2 Traceability

Phase totals: 18→3, 19→3, 20→4, 21→5, 22→2, 23→4, 24→1, 25→4, 26→2 = 28

| REQ-ID | Phase | Status |
|--------|-------|--------|
| EPI-01 | 18 | Queued |
| EPI-02 | 18 | Queued |
| EPI-03 | 18 | Queued |
| EPA-01 | 19 | Queued |
| EPA-02 | 19 | Queued |
| EPA-03 | 19 | Queued |
| EPL-01 | 20 | Queued |
| EPL-02 | 20 | Queued |
| EPL-03 | 20 | Queued |
| EPL-04 | 20 | Queued |
| EPW-01 | 21 | Queued |
| EPW-02 | 21 | Queued |
| EPW-03 | 21 | Queued |
| EPW-04 | 21 | Queued |
| EPW-05 | 21 | Queued |
| EPC-01 | 22 | Queued |
| EPC-02 | 22 | Queued |
| EPR-01 | 23 | Queued |
| EPR-02 | 23 | Queued |
| EPR-03 | 23 | Queued |
| EPR-04 | 23 | Queued |
| EPF-01 | 24 | Queued |
| EPP-01 | 25 | Queued |
| EPP-02 | 25 | Queued |
| EPP-03 | 25 | Queued |
| EPP-04 | 25 | Queued |
| EPD-01 | 26 | Queued |
| EPD-02 | 26 | Queued |

Coverage: **28/28** v1.2 requirements mapped — no orphans, no duplicates.
