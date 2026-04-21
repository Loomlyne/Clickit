# Roadmap: Clickit Story (CIT)

## Milestones

- ✅ **v1.0 CIT Streaming Platform** — Phases 1-10 (shipped 2026-04-16)
- 🚧 **v1.1 Full Bilingual UI (AR/EN)** — Phases 12-17 (started 2026-04-20)

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
- [ ] **Phase 13: Route Restructure + Auth Safety** — Move every page under `[locale]/` and fix 6 latent auth/routing breaks atomically in one PR (1/7 plans done)
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
  - [ ] 13-02-PLAN.md — Proxy composition: createMiddleware(routing) + updateSession() + cookie merge, locale-aware coming-soon redirect, /api and /auth/callback short-circuits — closes RTE-03, RTE-07
  - [ ] 13-03a-PLAN.md — Navigation-hook + Server-redirect swaps: 10 useRouter + 4 usePathname + 5 Server Component redirect imports swapped to @/i18n/navigation (19 file edits) — closes RTE-04 (hook half) + RTE-05
  - [ ] 13-03b-PLAN.md — `next/link` swaps: ~38 files swap `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'` so every click preserves the active locale prefix — closes RTE-04 (Link half); parallel with 13-03a in Wave 3
  - [ ] 13-04-PLAN.md — OAuth callback safeNext() locale-aware: reads NEXT_LOCALE cookie, prepends locale on plain paths, preserves open-redirect defense, error path lands on /${locale}/auth — closes RTE-06
  - [ ] 13-05-PLAN.md — Dead code deletion (locale-actions.ts, locale-switcher.tsx), URL-based LanguagePreference rewrite (router.replace + locale option), sitemap alternates.languages, site-url.ts audit — closes RTE-08, RTE-09
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
| 13. Route Restructure + Auth Safety | v1.1 | 0/7 | Planned | - |
| 14. Global Layout + RTL CSS | v1.1 | 0/0 | Not started | - |
| 15. Viewer Pages Translation | v1.1 | 0/0 | Not started | - |
| 16. Admin Pages Translation | v1.1 | 0/0 | Not started | - |
| 17. Content + Polish | v1.1 | 0/0 | Not started | - |
