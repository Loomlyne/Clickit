# Roadmap: Clickit Story (CIT)

## Milestones

- ✅ **v1.0 CIT Streaming Platform** — Phases 1-10 (shipped 2026-04-16)
- 🚧 **v1.1 Full Bilingual UI (AR/EN)** — Phases 12-17 (started 2026-04-20)
- ⏳ **v1.2 Editorial Feature Parity** — Phases 18-26 (scaffolded 2026-04-22, queued after v1.1)

## Phases

<details>
<summary>✅ v1.0 CIT Streaming Platform (Phases 1-10) — SHIPPED 2026-04-16</summary>

- [x] Phase 1: Project Scaffolding & Design System (2/2 plans) — completed 2026-03-30
- [x] Phase 2: App Shell & Navigation (2/2 plans) — completed 2026-03-31
- [x] Phase 3: Home Page & Catalog UI (3/3 plans) — completed 2026-03-31
- [x] Phase 4: Series Detail & Browse Pages (3/3 plans) — completed 2026-04-01
- [x] Phase 5: Watch Page UI (2/2 plans) — completed 2026-04-01
- [x] Phase 6: Backend Foundation (2/2 plans) — completed 2026-04-02
- [x] Phase 6.1: UI Cinematic Redesign (5/5 plans) — completed 2026-04-03 (INSERTED)
- [x] Phase 7: Admin Dashboard (4/4 plans) — completed 2026-04-04
- [x] Phase 8: Data Integration, Auth & Search (3/3 plans) — completed 2026-04-04
- [x] Phase 9: Personalization & Watch Features (3/3 plans) — completed 2026-04-04
- [x] Phase 10: Empty State Polish (1/1 plan) — completed 2026-04-14

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Full Bilingual UI (AR/EN) — Phases 12-17

- [x] **Phase 12: i18n Infrastructure** — Wire next-intl primitives (routing, request, navigation, messages, provider); zero page edits — completed 2026-04-21 (commit af2ab35)
- [ ] **Phase 13: Route Restructure + Auth Safety** — Move every page under `[locale]/` and fix 6 latent auth/routing breaks atomically in one PR (6/7 plans done)
- [ ] **Phase 14: Global Layout + RTL CSS** — `[locale]/layout.tsx`, Cairo font, letter-spacing fix, logical-property migration across ~114 components, directional icon mirroring
- [ ] **Phase 15: Viewer Pages Translation** — Every string on 13 viewer pages routed through `useTranslations()` / `getTranslations()`
- [ ] **Phase 16: Admin Pages Translation** — All 5 admin views operable in Arabic
- [ ] **Phase 17: Content + Polish** — Dynamic strings (toasts, aria, errors, dates, numbers), metadata, sitemap alternates, text-expansion QA, BiDi guards, final human review

## Phase Details (v1.1)

### Phase 12: i18n Infrastructure
**Goal**: next-intl primitives wired and functional without touching any page code — ships independently
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, I18N-06, I18N-07
**Success Criteria** (what must be TRUE):
  1. Developer importing `Link` / `useRouter` / `redirect` from `@/i18n/navigation` gets working helpers that preserve locale prefix
  2. `src/messages/en.json` and `src/messages/ar.json` exist with the full namespace skeleton (`nav`, `auth`, `home`, `show`, `player`, `search`, `profile`, `myList`, `comingSoon`, `support`, `faq`, `admin`, `errors`, `common`) and load via `getRequestConfig`
  3. `generateStaticParams` on the prepared `[locale]/layout.tsx` returns both `{locale:'en'}` and `{locale:'ar'}` and `setRequestLocale()` is importable and callable
  4. Existing `dirFor()` / `pickLocalized()` in `src/lib/locale.ts` continue to work unchanged — no regression in bilingual DB field rendering on show detail pages
  5. `npm run build` succeeds; no viewer or admin page has been moved yet, so the live site is byte-identical
**Plans**: 1 plan
  - [x] 12-01-PLAN.md — Create next-intl primitives (routing, request, navigation) + bilingual message dictionary skeletons (en.json, ar.json) with 14 namespaces; zero page edits — completed 2026-04-21 (commit af2ab35)

### Phase 13: Route Restructure + Auth Safety
**Goal**: All pages live under `src/app/[locale]/...` and the 6 auth/routing pitfalls are fixed atomically so sessions survive locale redirects
**Depends on**: Phase 12
**Requirements**: RTE-01, RTE-02, RTE-03, RTE-04, RTE-05, RTE-06, RTE-07, RTE-08, RTE-09 (plus final-wiring closure of I18N-05 and I18N-06 from Phase 12)
**Success Criteria** (what must be TRUE):
  1. Visiting `/` redirects to `/en` and `/ar` renders the same page; deep links like `/en/series/<slug>` and `/ar/series/<slug>` both resolve correctly
  2. Logging in on `/ar/auth` lands on `/ar/...` (not `/auth/login` or `/en/...`) and the Supabase session cookie survives the locale redirect — the user is NOT silently logged out
  3. Every client-side navigation (navbar, footer, show cards, watch-page prev/next, auth flows, OAuth `?next=` return) preserves the current locale prefix — no `useRouter` from `next/navigation` and no `Link` from `next/link` remain in a viewer client component
  4. The coming-soon gate in `proxy.ts` redirects to `/en/coming-soon` or `/ar/coming-soon` based on the incoming URL — never bare `/coming-soon`
  5. `src/app/locale-actions.ts`, `src/components/layout/locale-switcher.tsx`, and `src/components/profile/language-preference.tsx` are replaced by a next-intl navigation-based switcher that writes the URL; old cookie switcher is removed from the codebase
**Plans**: 7 plans
  - [x] 13-01-PLAN.md — Route restructure: git-mv (viewer)/ and admin/ under [locale]/, relocate OAuth callback to locale-agnostic path, create [locale]/layout.tsx (NextIntlClientProvider + setRequestLocale + generateStaticParams + <html lang dir>), slim root layout.tsx to pass-through — closes RTE-01, RTE-02, I18N-05, I18N-06 — completed 2026-04-21 (commits 733c8f4 → b3234c6)
  - [x] 13-02-PLAN.md — Proxy composition: createMiddleware(routing) + updateSession() + cookie merge, locale-aware coming-soon redirect, /api and /auth/callback short-circuits — closes RTE-03, RTE-07 — completed 2026-04-21 (commit 5503cda)
  - [x] 13-03a-PLAN.md — Navigation-hook + Server-redirect swaps: 10 useRouter + 4 usePathname + 5 Server Component redirect imports swapped to @/i18n/navigation (19 file edits) — closes RTE-04 (hook half) + RTE-05 — completed 2026-04-21 (commits 82c6735 → 9b079ba)
  - [x] 13-03b-PLAN.md — `next/link` swaps: 38 files swap `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'` so every click preserves the active locale prefix — closes RTE-04 (Link half) — completed 2026-04-21 (commit b10a964)
  - [x] 13-04-PLAN.md — OAuth callback safeNext() locale-aware: reads NEXT_LOCALE cookie, prepends locale on plain paths, preserves open-redirect defense, error path lands on /${locale}/auth — closes RTE-06 — completed 2026-04-21 (commit 8d90206)
  - [x] 13-05-PLAN.md — Dead code deletion (locale-actions.ts, locale-switcher.tsx), URL-based LanguagePreference rewrite (router.replace + locale option), sitemap alternates.languages, site-url.ts audit — closes RTE-08, RTE-09 — completed 2026-04-21 (commits c41c8de, 3266fc7)
  - [ ] 13-06-PLAN.md — Full static-analysis gate (11 invariants incl. combined `next/(navigation|link)` zero-residue check) + mandatory Vercel preview 10-item auth-safety smoke test (human checkpoint) — atomic merge gate for Phase 13
**UI hint**: yes

### Phase 14: Global Layout + RTL CSS
**Goal**: Arabic pages render with correct direction, font, glyph joining, and visual polish; English experience is visually unchanged
**Depends on**: Phase 13
**Requirements**: RTL-01, RTL-02, RTL-03, RTL-04, RTL-05, RTL-06, RTL-07, RTL-08
**Success Criteria** (what must be TRUE):
  1. On `/ar/...` the `<html>` tag has `lang="ar" dir="rtl"` and Cairo renders without FOIT; on `/en/...` Plus Jakarta Sans renders unchanged
  2. Arabic headings with previously-tight `tracking-[0.2em+]` classes render with correctly joined glyphs (no broken letter connections) while English headings retain their tracking
  3. Tailwind directional classes across all ~114 components use logical properties (`ms-`/`me-`/`ps-`/`pe-`/`text-start`/`text-end`/`start-`/`end-`/`border-s`/`border-e`/`rounded-s-*`/`rounded-e-*`) — layout mirrors cleanly on Arabic pages
  4. Directional icons (chevrons, arrows, skip-forward, back) visually mirror on Arabic pages while media-control icons (play/pause/volume) and the YouTube player chrome stay LTR
  5. Content rails swipe right-to-left on Arabic pages (Embla `direction: rtl`) and left-to-right on English pages
**Plans**: TBD
**UI hint**: yes

### Phase 15: Viewer Pages Translation
**Goal**: Every visible string on the viewer surface resolves through `useTranslations()` / `getTranslations()` in both locales
**Depends on**: Phase 14
**Requirements**: VW-01, VW-02, VW-03, VW-04, VW-05, VW-06, VW-07, VW-08, VW-09, VW-10, VW-11, VW-12, VW-13, VW-14
**Success Criteria** (what must be TRUE):
  1. Switching locale on landing, browse, series detail, season drawer, watch, my-list, profile, search, coming-soon, support, navbar, and footer swaps every visible string to Arabic (and back to English) — no English literal visible on an Arabic viewer page
  2. Autoplay countdown on `/ar/watch/[id]` reads an Arabic template (e.g., "الحلقة التالية خلال N ثانية"), not "Next episode in Ns"
  3. Auth form field labels, placeholders, submit buttons, social sign-in labels, and validation-error copy render in the active locale on `/en/auth` and `/ar/auth`
  4. `/design-system/*` pages remain English-only by design and are intentionally excluded from `[locale]/` translation scope (documented as such)
  5. `npm run build` succeeds with all viewer pages statically renderable under both locales
**Plans**: TBD
**UI hint**: yes

### Phase 16: Admin Pages Translation
**Goal**: UAE-based admin staff can operate the full dashboard in Arabic
**Depends on**: Phase 14
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05
**Success Criteria** (what must be TRUE):
  1. Admin dashboard landing (`/ar/admin`) renders all section headings, nav tabs, and quick-action buttons in Arabic
  2. Show editor (`/ar/admin/shows/[id]`) renders every field label, artwork slot label, validation message, and CTA (save, delete, archive) in Arabic
  3. Admin settings tabs (General / Branding / Integrations / Advanced) and their field labels + help text render in Arabic on `/ar/admin/settings`
  4. Archive view (`/ar/admin/archive`) and audit view (`/ar/admin/audit`) render page chrome, column headings, filter labels, and action buttons in Arabic
  5. Every admin save action produces a toast confirmation in the active locale using the same translation mechanism as viewer toasts
**Plans**: TBD
**UI hint**: yes

### Phase 17: Content + Polish
**Goal**: Dynamic strings, metadata, sitemap alternates, text-expansion QA, and BiDi correctness close the milestone with a final human-reviewed Arabic pass
**Depends on**: Phase 15, Phase 16
**Requirements**: DYN-01, DYN-02, DYN-03, DYN-04, DYN-05, DYN-06, DYN-07, META-01, META-02, META-03, META-04, META-05, META-06, POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06
**Success Criteria** (what must be TRUE):
  1. Every `toast()` call, `aria-label`, empty state, and form-validation error renders in the active locale; dates and numbers format via `Intl.DateTimeFormat` / `Intl.NumberFormat` with the active locale (Western numerals 0-9 on both)
  2. `view-source` shows per-locale `<title>`, `<meta description>`, OpenGraph + Twitter tags, and `<link rel="alternate" hreflang>` pairs on every page; `sitemap.xml` lists both locale versions with `alternates.languages`
  3. Visual QA pass on all pages at mobile + desktop breakpoints confirms no button clipping, no card overflow, and no nav wrapping when Arabic runs 25-40% wider than English
  4. Show titles, brand names, and timestamps embedded inside Arabic paragraphs are wrapped in `<span dir="ltr">` where needed — punctuation does not flip at string boundaries
  5. Full Arabic copy has been reviewed by a human reviewer before merge — no LLM-generated strings ship to prod; English experience is pixel-identical to pre-migration baseline (visual regression check)
**Plans**: TBD
**UI hint**: yes

### ⏳ v1.2 Editorial Feature Parity — Phases 18-26 (QUEUED — starts after v1.1 ships)

**Strategic decision:** Converge Editorial branch (`claude/angry-tharp-d39d9e`) into `main` behind the `NEXT_PUBLIC_DESIGN` build flag. One codebase, two Vercel projects. Primary project: flag unset → default chrome. Editorial project: flag set → editorial chrome. Eliminates branch drift; every future fix flows to both.

**Scope:** English-only for Editorial (Arabic/RTL deferred to v1.3). Admin stays on default chrome regardless of flag.

- [ ] **Phase 18: Branch Reconciliation & Flag Infrastructure** — Rebase Editorial onto post-v1.1 main; wire `NEXT_PUBLIC_DESIGN` flag in `src/lib/design.ts`; conditional next/font + `data-design` in root layout; viewer layout short-circuit; admin layout never branches; import `src/components/editorial/**`, `src/styles/editorial.css`, `src/lib/editorial/adapter.ts` — closes EPI-01, EPI-02, EPI-03
- [ ] **Phase 19: Auth + User State Wiring in Editorial** — `EditorialHeader` accepts `initialUser` + renders sign-in vs avatar dropdown; new `src/components/editorial/primitives/auth-section.tsx` (editorial-styled copy of [src/components/layout/auth-section.tsx](src/components/layout/auth-section.tsx)); thread `userId` through all page.tsx short-circuits; `EditorialProfile` receives real user + profile props — closes EPA-01, EPA-02, EPA-03
- [ ] **Phase 20: Watchlist + Likes Wiring** — `EditorialPoster` calls [src/hooks/use-watchlist.ts](src/hooks/use-watchlist.ts); `EditorialSeries` adds `LikeButton` slot using [src/hooks/use-likes.ts](src/hooks/use-likes.ts); `EditorialRail` propagates batched `initialSavedMap` via existing `getShowWatchlistState()`; `my-list` page.tsx threads real watchlist into `EditorialMyList` — closes EPL-01, EPL-02, EPL-03, EPL-04
- [ ] **Phase 21: Watch Page — Full YouTube IFrame API Port** — `EditorialWatch` drops `playerSlot: ReactNode` prop; imports [src/components/watch/youtube-player.tsx](src/components/watch/youtube-player.tsx) directly; manages `playerInstance` state; calls [src/hooks/use-progress-tracker.ts](src/hooks/use-progress-tracker.ts); wires [src/components/watch/autoplay-overlay.tsx](src/components/watch/autoplay-overlay.tsx); accepts `initialProgressSeconds` + `nextEpisode`; preserves Editorial visual structure (`.yt-watch` / `.yt-main` / `.yt-side`); watch page.tsx drops simple-iframe short-circuit — closes EPW-01, EPW-02, EPW-03, EPW-04, EPW-05
- [ ] **Phase 22: Continue Watching + Recently Watched Rails** — Browse page.tsx calls `getRecentlyWatched(userId)`; `EditorialBrowse` renders Continue Watching rail above "Now Streaming" when non-empty; profile page threads history; `EditorialProfile` renders history section with thumbnails + `date-fns formatDistanceToNow` — closes EPC-01, EPC-02
- [ ] **Phase 23: Search + ComingSoon + Support + Auth Parity** — `EditorialSearch` drops client-side filter, renders server-provided Postgres FTS results from existing `searchShows` + `searchEpisodes`; `EditorialComingSoon` adds episodes-by-show section from real data; new `EditorialSupport` with `<ContactForm>` + FAQ accordion (reuse [src/lib/faq-data.ts](src/lib/faq-data.ts)); new `<EditorialAuth>` that wraps existing `<AuthPanel>` in editorial chrome — closes EPR-01, EPR-02, EPR-03, EPR-04
- [ ] **Phase 24: Coming-Soon Gate + Feature Flags** — `flags.comingSoonMode` check runs BEFORE the `isEditorial` short-circuit in viewer layout; Editorial viewer routes redirect to `/coming-soon` when gate is on; admin layout doesn't gate — closes EPF-01
- [ ] **Phase 25: Performance + Polish Pass** — `EditorialPoster` swaps raw `<img>` for `next/image`; Editorial respects server-side mobile detection from [src/lib/device.ts](src/lib/device.ts); hero carousel auto-rotate pauses on `prefers-reduced-motion`; heavy rails lazy-mount below fold; verify CSS still scoped under `html[data-design="editorial"]` — closes EPP-01, EPP-02, EPP-03, EPP-04
- [ ] **Phase 26: Deploy + E2E Verification** — Merge `feat/editorial-parity-v1.2` → main; confirm `clickit-editorial` prod branch = main + `NEXT_PUBLIC_DESIGN=editorial`; trigger deploy + alias; confirm `clickit-cit` flag UNSET + redeploy; 10-item smoke test on `clickit-editorial.vercel.app`; spot-check `clickitstory.com` unchanged; tag `v1.2` — closes EPD-01, EPD-02

## Phase Details (v1.2)

### Phase 18: Branch Reconciliation & Flag Infrastructure
**Goal**: Editorial codebase lives in main behind `NEXT_PUBLIC_DESIGN` build flag; both Vercel projects deploy from main with different env vars
**Depends on**: v1.1 Phase 17 (full bilingual UI shipped so the merged state is stable)
**Requirements**: EPI-01, EPI-02, EPI-03
**Success Criteria**:
  1. `npm run build` succeeds in both modes (flag unset → default chrome bundled; `NEXT_PUBLIC_DESIGN=editorial` → editorial chrome bundled); dead-code-elim removes the unused design branch in each build
  2. Setting `data-design="editorial"` on `<html>` + loading `src/styles/editorial.css` produces the editorial visual shell on all viewer routes; unset leaves the primary chrome unchanged
  3. `/admin/*` renders default admin chrome regardless of `isEditorial` value (admin layout never branches on the flag)
  4. Deploy `main` to `clickit-editorial` with `NEXT_PUBLIC_DESIGN=editorial` → landing/browse render Editorial chrome; primary project at `clickitstory.com` is byte-identical to pre-reconciliation
  5. `tsc --noEmit` clean; existing node:test suite (14/14) passes
**UI hint**: yes

### Phase 19: Auth + User State Wiring in Editorial
**Goal**: Every Editorial route that needs the signed-in user has real auth state threaded end-to-end — no placeholder email, no broken sign-in CTA
**Depends on**: Phase 18
**Requirements**: EPA-01, EPA-02, EPA-03
**Success Criteria**:
  1. Signed-out user on Editorial sees "Sign in" CTA in header; signed-in user sees avatar dropdown with sign-out option
  2. `/my-list` and `/profile` on Editorial redirect to `/auth` when signed out; render correctly when signed in
  3. `EditorialProfile` displays real email + display name + avatar (not placeholder)
  4. `supabase.auth.onAuthStateChange` listener works on Editorial pages — signing in/out in one tab updates the header in other tabs
**UI hint**: yes

### Phase 20: Watchlist + Likes Wiring
**Goal**: The `onToggleList` callbacks that Editorial exposes become real Supabase mutations; watchlist + likes state persists correctly
**Depends on**: Phase 19
**Requirements**: EPL-01, EPL-02, EPL-03, EPL-04
**Success Criteria**:
  1. Clicking "+" on an Editorial poster adds the show to `watchlist`; icon swaps to checkmark; navigating to `/my-list` shows it
  2. Clicking checkmark removes from watchlist; `/my-list` updates
  3. Clicking "Like" on Editorial series detail adds to `likes`; reverses on second click
  4. Batched initial-saved state for rails comes from server (`getShowWatchlistState`) — no per-poster roundtrip on page load
**UI hint**: yes

### Phase 21: Watch Page — Full YouTube IFrame API Port
**Goal**: Editorial watch page uses the real YouTube IFrame API with resume, progress tracking, and autoplay-next — visual structure unchanged
**Depends on**: Phase 19
**Requirements**: EPW-01, EPW-02, EPW-03, EPW-04, EPW-05
**Success Criteria**:
  1. Watch an episode on Editorial, close tab, return → player seeks to within 10s of last saved position
  2. Watch to end → autoplay countdown overlay appears → next episode loads (cross-season handled)
  3. Pause during playback → `watch_progress` row updates within 10s (verify in Supabase)
  4. Editorial visual structure (`.yt-watch`, `.yt-main`, `.yt-side`, season tabs, episode list) renders identically to pre-port — the port is functional, not visual
  5. Error states (video unavailable, private, region-locked) render editorial-styled error overlay
**UI hint**: yes

### Phase 22: Continue Watching + Recently Watched Rails
**Goal**: Editorial browse shows user's in-progress episodes; Editorial profile shows recently-watched history
**Depends on**: Phase 21
**Requirements**: EPC-01, EPC-02
**Success Criteria**:
  1. Watch 2+ episodes on Editorial → return to `/browse` → Continue Watching rail renders above "Now Streaming" with progress bars
  2. `/profile` on Editorial shows Recently Watched section with thumbnails + show title + relative-time labels (e.g., "2 hours ago")
  3. Finished episodes (≥95% progress) don't appear in Continue Watching (they appear in Recently Watched)

### Phase 23: Search + ComingSoon + Support + Auth Parity
**Goal**: All remaining viewer routes have functional Editorial variants — no dead placeholders
**Depends on**: Phase 19
**Requirements**: EPR-01, EPR-02, EPR-03, EPR-04
**Success Criteria**:
  1. Search on Editorial uses Postgres FTS (server-side); "music" returns ranked show + episode results
  2. Coming Soon on Editorial shows upcoming shows grid + episodes-by-show section with real DB data
  3. Support page on Editorial submits a real contact form (toast confirms) + renders FAQ accordion
  4. `/auth` on Editorial uses editorial-styled wrapper around the existing `<AuthPanel>` — sign-in, sign-up, OAuth, reset-password all work

### Phase 24: Coming-Soon Gate + Feature Flags
**Goal**: Admin's `flags.comingSoonMode` splash gate applies equally to Editorial and primary
**Depends on**: Phase 23
**Requirements**: EPF-01
**Success Criteria**:
  1. Admin toggles coming-soon mode on → Editorial viewer routes (landing, browse, series, watch) redirect to `/coming-soon`
  2. `/admin/*` on Editorial build remains accessible even when gate is on (admin layout never gates)
  3. Toggle off → Editorial viewer routes render normally

### Phase 25: Performance + Polish Pass
**Goal**: Editorial's Lighthouse scores match primary's; mobile 3G throttle passes; no animation thrash for reduced-motion users
**Depends on**: Phase 23
**Requirements**: EPP-01, EPP-02, EPP-03, EPP-04
**Success Criteria**:
  1. Lighthouse on `clickit-editorial.vercel.app` browse + watch: LCP < 2.5s, TBT < 200ms, CLS < 0.1
  2. `EditorialPoster` serves via `next/image` with responsive srcset; no raw `<img>` remain in editorial render tree
  3. Hero carousel auto-rotate pauses when `matchMedia('(prefers-reduced-motion: reduce)')` matches
  4. Mobile 3G throttled test on Editorial watch passes; server-side mobile detection picks mobile hero variant
**UI hint**: yes

### Phase 26: Deploy + E2E Verification
**Goal**: Editorial v1.2 live on production Vercel project with feature parity; primary unchanged; milestone tagged
**Depends on**: Phase 25
**Requirements**: EPD-01, EPD-02
**Success Criteria**:
  1. `clickit-editorial.vercel.app` passes the 10-item smoke test (see plan: landing, sign-in, browse rails, series detail + season tabs, watch + progress + autoplay, watchlist toggle, like toggle, search FTS, support form)
  2. `clickitstory.com` spot-check (landing, browse, a watch page) confirms primary chrome unchanged; no regression from merge
  3. Supabase logs monitored 24h post-deploy — no new error patterns attributable to Editorial project
  4. Git tag `v1.2` created on the merged commit

## Dependency Graph (v1.2)

```
17 (v1.1 close — Polish + Metadata + QA) [must ship first]
 └─> 18 (Branch Reconciliation + Flag)
      └─> 19 (Auth + User State)
           ├─> 20 (Watchlist + Likes)
           ├─> 21 (Watch Page IFrame API)    ─┐
           │                                   ├─> 22 (Continue Watching + Recently Watched)
           │                                   │
           └─> 23 (Search + ComingSoon + Support + Auth)
                └─> 24 (Coming-Soon Gate)
                └─> 25 (Perf + Polish)
                     └─> 26 (Deploy + E2E)
```

Phases 20 + 21 + 23 may run in parallel after Phase 19 lands (independent component surfaces). Phase 22 blocks on 21 (needs progress tracking). Phase 24 + 25 block on 23 (need all routes complete). Phase 26 is serial after 25.

## Dependency Graph (v1.1)

```
12 (Infra — safe, zero page edits)
 └─> 13 (Route Restructure + Auth Safety — HIGHEST RISK, atomic)
      └─> 14 (Global Layout + RTL CSS)
           ├─> 15 (Viewer Translation)   ┐
           └─> 16 (Admin Translation)    ├─> 17 (Polish + Metadata + QA)
                                         ┘
```

- Phases 15 and 16 MAY run in parallel after Phase 14 lands (independent page surfaces; shared dictionary file co-edits manageable via namespace separation — viewer uses `home`/`show`/`player`/etc., admin uses `admin`)
- Phase 17 requires both translation phases complete (text-expansion QA and final human review can only run on a fully translated surface)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffolding & Design System | v1.0 | 2/2 | Complete | 2026-03-30 |
| 2. App Shell & Navigation | v1.0 | 2/2 | Complete | 2026-03-31 |
| 3. Home Page & Catalog UI | v1.0 | 3/3 | Complete | 2026-03-31 |
| 4. Series Detail & Browse Pages | v1.0 | 3/3 | Complete | 2026-04-01 |
| 5. Watch Page UI | v1.0 | 2/2 | Complete | 2026-04-01 |
| 6. Backend Foundation | v1.0 | 2/2 | Complete | 2026-04-02 |
| 6.1. UI Cinematic Redesign | v1.0 | 5/5 | Complete | 2026-04-03 |
| 7. Admin Dashboard | v1.0 | 4/4 | Complete | 2026-04-04 |
| 8. Data Integration, Auth & Search | v1.0 | 3/3 | Complete | 2026-04-04 |
| 9. Personalization & Watch Features | v1.0 | 3/3 | Complete | 2026-04-04 |
| 10. Empty State Polish | v1.0 | 1/1 | Complete | 2026-04-14 |
| 12. i18n Infrastructure | v1.1 | 1/1 | Complete | 2026-04-21 |
| 13. Route Restructure + Auth Safety | v1.1 | 6/7 | In progress | - |
| 14. Global Layout + RTL CSS | v1.1 | 0/0 | Not started | - |
| 15. Viewer Pages Translation | v1.1 | 0/0 | Not started | - |
| 16. Admin Pages Translation | v1.1 | 0/0 | Not started | - |
| 17. Content + Polish | v1.1 | 0/0 | Not started | - |
| 18. Branch Reconciliation & Flag Infrastructure | v1.2 | 0/0 | Queued | - |
| 19. Auth + User State Wiring in Editorial | v1.2 | 0/0 | Queued | - |
| 20. Watchlist + Likes Wiring | v1.2 | 0/0 | Queued | - |
| 21. Watch Page — Full YouTube IFrame API Port | v1.2 | 0/0 | Queued | - |
| 22. Continue Watching + Recently Watched Rails | v1.2 | 0/0 | Queued | - |
| 23. Search + ComingSoon + Support + Auth Parity | v1.2 | 0/0 | Queued | - |
| 24. Coming-Soon Gate + Feature Flags | v1.2 | 0/0 | Queued | - |
| 25. Performance + Polish Pass | v1.2 | 0/0 | Queued | - |
| 26. Deploy + E2E Verification | v1.2 | 0/0 | Queued | - |
