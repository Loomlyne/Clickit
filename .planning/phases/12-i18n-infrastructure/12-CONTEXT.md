# Phase 12: i18n Infrastructure - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Source:** Approved execution plan at `/Users/koss/.claude/plans/do-you-those-in-snuggly-pinwheel.md` + ROADMAP.md + REQUIREMENTS.md

<domain>
## Phase Boundary

Wire `next-intl@4.9.1` (already installed in `package.json`) as the primary i18n system for Clickit Story. Create the routing, request config, navigation helpers, and empty message dictionaries. **Zero page edits.** After this phase merges, the live site is byte-identical to before — no user-visible change. Phase 13 will restructure routes on top of this foundation.

The goal is to land a safe, additive, independently-shippable foundation before the riskier Phase 13 route restructure.

</domain>

<decisions>
## Implementation Decisions

### Infrastructure files (locked)
- **`src/i18n/routing.ts`** exports a `routing` object via `defineRouting({ locales: ['en','ar'], defaultLocale: 'en', localePrefix: 'always' })`. `localePrefix: 'always'` means both locales get a prefix — no default-locale exception. The `Locale` type from `src/lib/locale.ts` remains the canonical locale type; the next-intl `routing.locales` re-affirms it.
- **`src/i18n/request.ts`** exports the default `getRequestConfig` per next-intl v4 contract. It awaits `requestLocale`, validates it against `routing.locales`, falls back to `routing.defaultLocale` if invalid, and returns `{ messages: (await import(\`../messages/${locale}.json\`)).default }`. No more, no less.
- **`src/i18n/navigation.ts`** calls `createNavigation(routing)` from `next-intl/navigation` and re-exports `Link`, `useRouter`, `redirect`, `usePathname`, `getPathname`, `permanentRedirect`. Phase 13 will swap 16 call sites to import from this module.

### Message dictionaries (locked)
- **`src/messages/en.json`** — skeleton only in Phase 12. Namespaces present, values are empty strings or placeholder keys. Full population happens in Phases 15/16/17.
- **`src/messages/ar.json`** — mirror structure of en.json. Values are human-reviewed Arabic in later phases. In Phase 12, values are empty strings (or English placeholders) so the schema is complete and `getRequestConfig` can load without runtime errors.
- **Namespaces** (from research FEATURES.md): `nav`, `auth`, `home`, `show`, `player`, `search`, `profile`, `myList`, `comingSoon`, `support`, `faq`, `admin`, `errors`, `common`.

### Kept unchanged (locked — do NOT modify in this phase)
- **`src/lib/locale.ts`** — `dirFor(locale)` and `pickLocalized(locale, en, ar)` stay. These are domain-specific helpers used across the existing viewer code for DB field selection. They remain the source of truth for RTL direction and bilingual DB column selection. Research SUMMARY.md line 22-23 confirms: "The existing `dirFor()` and `pickLocalized()` helpers **stay** — they're domain-specific."
- **`src/app/locale-actions.ts`** — UNCHANGED in Phase 12 (Phase 13 deletes it).
- **`src/components/layout/locale-switcher.tsx`** — UNCHANGED in Phase 12 (Phase 13 deletes it).
- **`src/components/profile/language-preference.tsx`** — UNCHANGED in Phase 12 (Phase 13 deletes it when URL-based switcher replaces it).
- **`proxy.ts`** — UNCHANGED in Phase 12. Phase 13 composes `createMiddleware(routing)` here.
- **`src/app/layout.tsx`** — UNCHANGED in Phase 12. Phase 13 trims it to a minimal shell; Phase 14 moves Cairo font activation to `[locale]/layout.tsx`.

### What Phase 12 is NOT (explicit non-scope)
- No `[locale]/layout.tsx` created yet — Phase 13 creates it
- No page moves under `src/app/[locale]/` — Phase 13 does this
- No proxy.ts composition — Phase 13 does this
- No `useRouter` / `Link` import swaps — Phase 13 does this
- No `setRequestLocale` calls in pages — Phase 13 does this
- No RTL CSS, no Cairo activation — Phase 14 does this
- No string extraction from pages — Phase 15/16 does this

### Claude's Discretion
- Exact indentation, comment density, and field ordering in the new TypeScript and JSON files
- Whether to inline-document the `createNavigation` call with a one-line pointer to `src/i18n/routing.ts`
- Whether the `ar.json` placeholder values are empty strings (`""`) or mirror the English text until Phase 15 — either works because no page reads them yet. Recommend **empty strings** so a forgotten translation key surfaces visibly later.

### Build safety invariants
- `npx tsc --noEmit` must be clean after the changes
- `npm run build` must succeed
- The live site (pre-Phase-13) must render byte-identically to before this phase — no viewer or admin page imports from `src/i18n/*` yet
- `src/messages/{en,ar}.json` must parse with `JSON.parse(fs.readFileSync(...))` without errors
- No `from 'next-intl'` or `from 'next-intl/navigation'` imports appear in any file under `src/app/` or `src/components/` in this phase

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved scope
- `/Users/koss/.claude/plans/do-you-those-in-snuggly-pinwheel.md` — the user-approved execution plan for all 6 phases; Phase 12 section is the source of truth for this phase's scope

### Project-level intent
- `/Users/koss/Desktop/Develop/Clickit/.planning/PROJECT.md` — milestone v1.1 goal, scope strategy, exclusions
- `/Users/koss/Desktop/Develop/Clickit/.planning/REQUIREMENTS.md` — REQ-IDs I18N-01..07 for this phase (full list under the "Translation Infrastructure" heading)
- `/Users/koss/Desktop/Develop/Clickit/.planning/ROADMAP.md` — Phase 12 success criteria (5 criteria)

### Architecture research (must read before planning)
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/SUMMARY.md` — sections "Stack Additions", "Architecture: Migration Blueprint", and "New Files" table. Specifically:
  - Lines 88-96 — new file table with exact purposes per file
  - Lines 22-28 — what stays vs. what gets deleted (Phase 12 keeps everything; deletions are in later phases)
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/ARCHITECTURE.md` — detailed blueprints for `routing.ts`, `request.ts`, `navigation.ts`, `[locale]/layout.tsx`
- `/Users/koss/Desktop/Develop/Clickit/.planning/research/FEATURES.md` — line 21 for the 14-namespace dictionary structure

### Existing code (must read before planning)
- `/Users/koss/Desktop/Develop/Clickit/package.json` — confirm `next-intl` version, no new deps needed
- `/Users/koss/Desktop/Develop/Clickit/src/lib/locale.ts` — existing `dirFor()`, `pickLocalized()`, `Locale` type, `NEXT_LOCALE` cookie name. These must remain callable unchanged.
- `/Users/koss/Desktop/Develop/Clickit/tsconfig.json` — confirm `@/*` path alias maps to `./src/*` (the planner needs this for the `@/i18n/navigation` import path to resolve)
- `/Users/koss/Desktop/Develop/Clickit/next.config.ts` — check if `next-intl/plugin` needs to be added; per next-intl v4 with App Router + `request.ts` default location, the plugin is OPTIONAL when the request config is at `src/i18n/request.ts`. If `src/i18n/` is not the default path per the installed version, the planner must confirm the correct hook-up.

### Project conventions
- `/Users/koss/Desktop/Develop/Clickit/CLAUDE.md` — project-level guidelines

</canonical_refs>

<specifics>
## Specific Ideas

### Example file contents (for the planner's reference)

**`src/i18n/routing.ts` — illustrative:**
```ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'ar'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
```

**`src/i18n/request.ts` — illustrative:**
```ts
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

**`src/i18n/navigation.ts` — illustrative:**
```ts
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, useRouter, redirect, usePathname, getPathname, permanentRedirect } =
  createNavigation(routing)
```

**`src/messages/en.json` — illustrative skeleton:**
```json
{
  "nav": {},
  "auth": {},
  "home": {},
  "show": {},
  "player": {},
  "search": {},
  "profile": {},
  "myList": {},
  "comingSoon": {},
  "support": {},
  "faq": {},
  "admin": {},
  "errors": {},
  "common": {}
}
```

**`src/messages/ar.json` — mirror the same structure (empty objects per namespace).**

### Potential gotchas
- If `next.config.ts` uses ESM syntax and the existing `createNextIntlPlugin()` hook is not yet wired, the planner must decide whether to add the plugin or rely on next-intl's default auto-detection of `src/i18n/request.ts`. Next-intl v4 auto-detects when the file is at `src/i18n/request.ts` — this is the expected happy path.
- The `Locale` type already exists in `src/lib/locale.ts` — the new `routing.ts` also exports a `Locale` type. These must be compatible (both should be `'en' | 'ar'`). If they conflict, the planner must pick one canonical definition. Recommend **keeping `src/lib/locale.ts` as source of truth** (it's used in the existing code) and typing `routing.locales` to match.
- Avoid circular imports between `src/i18n/routing.ts` and `src/lib/locale.ts`. `src/lib/locale.ts` should NOT import from `src/i18n/*`.

</specifics>

<deferred>
## Deferred Ideas

- URL-segment routing activation (`/en/`, `/ar/` in URLs) — Phase 13
- `NextIntlClientProvider` wrapped around pages — Phase 13 (at `[locale]/layout.tsx`)
- `setRequestLocale` calls inside pages — Phase 13
- Removing cookie-based `LanguagePreference` switcher — Phase 13
- Populating `ar.json` with real translations — Phases 15, 16, 17
- RTL CSS rules, Cairo font activation — Phase 14

</deferred>

---

*Phase: 12-i18n-infrastructure*
*Context gathered: 2026-04-20 via approved execution plan*
