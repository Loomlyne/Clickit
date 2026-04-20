# Feature Landscape: Arabic i18n — Clickit Story Streaming Platform

**Domain:** Arabic/English bilingual streaming platform (UAE market) — i18n milestone
**Researched:** 2026-04-20
**Confidence:** HIGH (RTL/font/Tailwind verified via official docs; streaming UX patterns verified via Twitch, Shahid precedents)

> NOTE: This file replaces the original FEATURES.md for the Arabic i18n milestone.
> Original platform features (catalog, auth, watch page) are already built — this research scopes only the i18n layer.

---

## Table Stakes

Features users expect in an Arabic UI. Missing any of these = the Arabic experience feels broken or half-done.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `html dir="rtl"` set per locale | Without it, nothing flows correctly — browsers won't reverse layout | Low | Set in root `layout.tsx` from locale param: `dir={locale === 'ar' ? 'rtl' : 'ltr'}` |
| `html lang` set per locale | Triggers correct browser text rendering, screen readers, and Arabic keyboard detection | Low | `lang={locale}` alongside `dir`; `lang="ar"` for Arabic |
| URL-prefix routing `/en/` and `/ar/` | SEO, shareable links, browser back-nav correctness — cookie-only locale doesn't survive link sharing | Medium | Use `next-intl` with `localePrefix: 'always'`; `[locale]` dynamic segment in App Router |
| Central JSON translation files (`en.json`, `ar.json`) | All 130+ UI strings in one place, namespaced by page/section | Medium | Namespaces: `nav`, `auth`, `home`, `show`, `player`, `search`, `profile`, `myList`, `comingSoon`, `support`, `faq`, `admin`, `errors`, `common` |
| All viewer pages translated | Landing, home, series detail, watch, profile, search, coming-soon, my-list, auth, support — untranslated pages break locale immersion | High | 130+ strings; `useTranslations('namespace')` per page |
| All admin pages translated | Dashboard, show editor, settings, archive, audit — admin staff in UAE read Arabic | Medium | Separate `admin.*` namespace |
| All component strings translated | Navbar, footer, content rails, cards, buttons, empty states, error messages — components render on every page; most visible breakage | High | Prioritize navbar and error states first |
| FAQ translated to Arabic | FAQ is text-heavy and visible to all users | Low | Static content; translate once |
| Arabic-capable font loaded globally | Default system fonts render Arabic poorly or fall back to ugly glyphs | Low | **Cairo** (Google Fonts, variable weight 200–900, free, open source) — recommended; fallback: `'Cairo', 'Noto Sans Arabic', sans-serif` |
| Tailwind logical properties throughout | Hardcoded `ml-`, `mr-`, `pl-`, `pr-` break in RTL; logical properties (`ms-`, `me-`, `ps-`, `pe-`) adapt to `dir` automatically | High | Requires auditing every component with directional spacing; Tailwind v3.3+ supports this natively |
| RTL icon mirroring (directional icons only) | Back/forward arrows, breadcrumbs, chevrons point the wrong way in RTL without mirroring | Medium | Mirror direction-of-movement icons; never mirror media controls or time icons — see Arabic UX Notes below |
| "Continue watching" progress bar direction | Card-level progress indicator must advance right-to-left in Arabic | Low | CSS only: `dir="rtl"` on parent handles this if using logical width |
| Text expansion accommodation | Arabic runs 25–40% wider than English — buttons, nav items, and cards must not clip | High | No fixed-width containers for text; use `min-w` not `w-`; test with longest Arabic strings before shipping |

---

## Differentiators

Features that make the Arabic experience feel native, not like a translation layer on top of an English UI.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| RTL content rail scroll direction | Carousel arrows and scroll direction reverse in Arabic — content flows right-to-left naturally | Medium | Set `dir="rtl"` on carousel wrapper; flip arrow icons; affects Swiper/Embla/custom carousels |
| Bidirectional text guard for mixed content | Show titles, brand names, timestamps stay LTR inside RTL paragraphs — prevents punctuation flip | Medium | Wrap known LTR strings with `<span dir="ltr">` or apply `unicode-bidi: embed`; Unicode BiDi handles digits inside Arabic text automatically |
| Arabic date formatting (Gregorian, Arabic month names) | "20 أبريل 2026" instead of "April 20, 2026" — localized but familiar calendar | Low | `new Intl.DateTimeFormat('ar-AE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)` |
| Arabic search placeholder and keyboard hint | "ابحث عن مسلسلات، أفلام..." — reinforces locale immersion in the search bar | Low | Part of `search.placeholder` in translation dictionary |
| RTL-aware empty states | "No results" and "My list is empty" illustrations read naturally RTL if figures face correctly | Low–Medium | Use symmetrical illustrations; avoid text baked into images |
| Locale-aware Open Graph metadata | Arabic `og:title`, `og:description` for Arabic URLs — social shares in Arabic look correct | Low | `generateMetadata` per locale using `pickLocalized()` already available |

---

## Anti-Features

Do not build these. They add complexity with no ROI for UAE streaming.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Hijri calendar dates | UAE streaming audience expects Gregorian; Hijri calendar adds a dependency (no native browser support) and never appears on VOD platforms including Shahid and Netflix MENA | Use `Intl.DateTimeFormat('ar-AE')` — returns Gregorian with Arabic month names |
| Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) as default | UAE market — including Arabic speakers — uses Western numerals (0–9) on digital interfaces; Shahid, Anghami, Netflix MENA all use Western numerals | Display Western numerals everywhere; `Intl.NumberFormat('ar-AE')` already returns Western numerals for UAE locale |
| Per-component / lazy-loaded namespace bundles | 130 strings across 2 locales is ~10KB total — splitting adds build complexity with zero measurable benefit at this scale | Single `en.json` and `ar.json`; load full locale file at request time via next-intl |
| RTL-specific Tailwind plugin (tailwindcss-rtl, tailwindcss-vanilla-rtl) | Tailwind v3.3+ logical properties make these plugins redundant; they diverge from Tailwind's own roadmap and add a dependency | Migrate to native logical properties; enforce via linting |
| Machine-translated Arabic (Google Translate API for UI strings) | Arabic MT quality is poor for UI copy; UAE market is sophisticated and notices bad Arabic immediately | Human-translate all 130+ strings once; UI strings are stable, not dynamic content |
| Dialect-specific Arabic variants (Egyptian Arabic, Gulf Arabic) | Adds a third locale, doubles QA surface, risks alienating users from the excluded dialect | Use Modern Standard Arabic (MSA) — universally understood; this is what Shahid, Anghami, and MBC use |
| Separate RTL stylesheet / CSS override file | Inevitably drifts from LTR stylesheet; maintenance nightmare as the platform grows | Implement RTL entirely via logical properties + `dir="rtl"` on `<html>`; single stylesheet |
| IP geolocation for language detection | 5–15% false-positive rate; UAE residents who prefer English get the wrong locale | Detect via `accept-language` header as initial hint; respect explicit URL prefix above everything |
| Translating video player internals | YouTube IFrame player UI is controlled by YouTube — it already localizes to browser language | Leave the YouTube player as-is; only translate the surrounding platform UI |

---

## Arabic UX Notes

Patterns specific to streaming platforms and the UAE market.

### RTL Layout — What Flips, What Does Not

**Always mirror in RTL:**
- Navigation flow (primary nav sits on the right)
- Chevron/arrow icons in breadcrumbs, dropdown menus, back buttons
- Content carousel scroll arrows
- "Continue watching" progress bar on show cards (advances right-to-left)
- Pagination controls (previous/next swap sides)
- Toast/notification popups (appear from right edge, not left)
- Progress indicators for multi-step flows (e.g., profile setup)

**Never mirror in RTL:**
- Video player transport controls (play, pause, skip forward/back, scrubber timeline) — these represent tape/time direction, which is universally LTR per industry convention (Twitch, YouTube, Netflix all maintain LTR playback controls in RTL modes)
- Clock and timer icons
- Volume slider
- Logos and brand marks
- Phone numbers and email addresses
- Episode numbers, timestamps

**Conditionally handled:**
- Show card thumbnails — do not mirror image content; only reverse their horizontal position in the grid layout
- Star/rating icons — direction is ambiguous; pick one direction and be consistent across the platform

### Episode and Season Label Conventions

Arabic streaming platforms (Shahid, Starzplay, OSN+) display labels as:
- "الموسم ١ — الحلقة ٣" or more commonly "الموسم 1 - الحلقة 3"
- UAE market accepts and prefers Western numerals (1, 2, 3) in episode labels
- Labels should be right-aligned on episode cards in Arabic

### Typography

**Recommended font: Cairo** (Google Fonts)
- Variable weight (200–900) in a single font file — optimal for a streaming platform where heading, body, and metadata use different weights
- Rounded Naskh/Grotesque style; legible at 12px and above; doesn't feel decorative or heavy
- Designed to harmonize with Latin glyphs at the same optical size — crucial for mixed Arabic/English content (show titles, metadata)
- Free, open source, served via Google Fonts CDN or self-hostable via Fontsource

**Fallback chain:** `'Cairo', 'Noto Sans Arabic', 'Arial', sans-serif`

**Size rule:** Arabic body text needs to be 2–4px larger than the English equivalent to maintain visual parity. If English body is `text-sm` (14px), Arabic body should use `text-base` (16px).

**Line height:** Use `leading-relaxed` (1.625) or higher for Arabic body text — diacritical marks and connected letterforms need vertical breathing room or they collide between lines.

**Letter spacing:** Set `tracking-normal` or slightly wider for Arabic headings. Never use tight/negative tracking (`tracking-tight`) — Arabic letterforms become unreadable.

### Number and Date Formatting (UAE market)

- **Episode/season numbers:** Western numerals (0–9). `Intl.NumberFormat('ar-AE')` returns Western numerals by default for the UAE locale.
- **Dates:** Gregorian with Arabic month names: "20 أبريل 2026". Implementation:
  ```js
  new Intl.DateTimeFormat('ar-AE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  ```
- **Duration:** "45 دقيقة" — use the number directly (Western), translate the unit string via the dictionary key `common.minutes`.

### Text Expansion Budget

Arabic strings run 25–40% longer than English. These components require explicit attention:

| Component | Risk | Mitigation |
|-----------|------|------------|
| Navbar links | Overflow, wrapping | Allow wrapping or use shorter Arabic equivalents |
| Buttons (primary/secondary) | Text clips or pushes layout | Use `min-w`, let horizontal padding expand |
| Genre/rating badges on cards | Overflow | Allow multi-line or truncate with `...` |
| Error messages | Breaks layout if fixed height | Allow multi-line, no max-height clip |
| Player overlay text | Overlaps controls | Test with longest Arabic error string |

### Bidirectional Text in Mixed Content

Show titles stored in Supabase as `title_ar` are Arabic text. Episode numbers, timestamps, and some metadata are always LTR. In RTL mode:
- Episode numbers inside Arabic sentences ("الحلقة 3") — Unicode BiDi algorithm handles the digit automatically; no manual wrapper needed
- English show titles displayed in the Arabic UI — wrap in `<span dir="ltr" className="inline-block">` to prevent punctuation and number flip
- URLs always wrap in `<span dir="ltr">`

### Translation Dictionary Structure

Recommended namespace layout for `messages/en.json` and `messages/ar.json`:

```
{
  "nav": {},          // ~10 strings — links, menu labels
  "auth": {},         // ~15 strings — login, register, reset, error states
  "home": {},         // ~8 strings  — hero CTA, section headers
  "show": {},         // ~20 strings — series detail, episode list, ratings, genres
  "player": {},       // ~12 strings — player labels, quality, subtitles, next episode
  "search": {},       // ~8 strings  — placeholder, no results, filters
  "profile": {},      // ~10 strings — settings, language, history
  "myList": {},       // ~5 strings  — empty state, add/remove
  "comingSoon": {},   // ~6 strings  — release date, remind me
  "support": {},      // ~8 strings  — contact, form labels
  "faq": {},          // ~15 strings — questions and answers
  "admin": {},        // ~20 strings — dashboard labels, form fields, status values
  "errors": {},       // ~10 strings — 404, 500, empty states, auth errors
  "common": {}        // ~8 strings  — loading, save, cancel, minutes, episodes
}
```

Access pattern: `const t = useTranslations('show')` loads only that namespace. Key collisions across pages are impossible. Server Components and Client Components both supported via next-intl's `getTranslations` (server) and `useTranslations` (client) split.

---

## Feature Dependencies

```
URL-prefix routing (/ar/, /en/)
  → must be implemented first — unblocks everything below
  → requires next-intl middleware + [locale] dynamic segment

html dir + html lang + Cairo font in root layout
  → requires URL routing (locale known at layout render time)
  → triggers Tailwind logical property cascade for all children

Central en.json / ar.json translation files
  → requires routing (locale available server-side for getTranslations)
  → feeds all page and component translations

Tailwind logical properties audit
  → independent — can run in parallel with routing setup
  → must complete before RTL layout QA pass

Viewer page translations
  → requires translation files to exist (even with stub strings)
  → order: landing → home → series detail → watch → auth → profile → search

Admin page translations
  → requires translation files; lower priority than viewer pages

Component translations (navbar, footer, cards, errors)
  → highest user-facing impact; tackle alongside or before viewer pages
```

---

## MVP Recommendation

Prioritize strictly in this order:

1. URL-prefix routing + next-intl middleware (unblocks everything)
2. `html dir` + `html lang` + Cairo font in root layout
3. Central `en.json` / `ar.json` with all 130+ strings (stubs acceptable at first)
4. Tailwind logical properties audit across all shared components
5. Viewer pages translated: landing → home → series detail → watch → auth
6. Component strings: navbar, footer, cards, empty states, error messages
7. Admin pages translated
8. FAQ and support pages

Defer indefinitely: Hijri calendar, Eastern Arabic-Indic numerals, dialect variants.

---

## Sources

- [next-intl routing configuration](https://next-intl.dev/docs/routing/configuration) — HIGH confidence (Context7 verified)
- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router) — HIGH confidence (Context7 verified)
- [Tailwind CSS RTL logical properties — Flowbite](https://flowbite.com/docs/customize/rtl/) — HIGH confidence
- [Cairo — Google Fonts](https://fonts.google.com/specimen/Cairo) — HIGH confidence
- [Twitch Arabic RTL launch](https://www.broadcastprome.com/news/twitch-launches-arabic-rtl-interface-to-expand-accessibility/) — MEDIUM confidence (industry precedent)
- [Arabic interface design — CodeGuru](https://codeguru.ae/blog/designing-arabic-interfaces-right-to-left-ux-done-right/) — MEDIUM confidence
- [6 Arabic localization challenges — Localazy](https://localazy.com/blog/6-challenges-of-localizing-your-app-to-arabic-and-how-to-solve-them) — MEDIUM confidence
- [10 Arabic fonts for UX — Ahmed Elramlawy](https://ahmedelramlawy.com/10-arabic-fonts-every-ux-designer-should-know-in-2025/) — MEDIUM confidence
- [RTL localization — POEditor](https://poeditor.com/blog/rtl-localization/) — MEDIUM confidence
- [RTL design — Omar Al-Masry](https://omaralmasry.com/blog/building%20scalable%20rtl%20design%20systems%20for%20arabic%20websites:%20strategies%20for%20enterprise%20success/) — MEDIUM confidence
- [Noto Sans Arabic — Fontsource](https://fontsource.org/fonts/noto-sans-arabic) — HIGH confidence (fallback font verification)
