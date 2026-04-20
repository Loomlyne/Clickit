import { defineRouting } from 'next-intl/routing'

/**
 * next-intl routing configuration for Clickit Story (Milestone v1.1).
 *
 * - locales: the two supported UI locales
 * - defaultLocale: 'en' — aligns with src/lib/locale.ts DEFAULT_LOCALE
 * - localePrefix: 'always' — both /en/ and /ar/ segments are required
 *                 (no bare-root exception for the default locale).
 *
 * Keep this in sync with src/lib/locale.ts SUPPORTED_LOCALES. The two modules
 * resolve to the same string union ('en' | 'ar') but do not import each other
 * — see src/lib/locale.ts comment for the "domain helper" rationale.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

/**
 * Helper for Phase 13's [locale]/layout.tsx:
 *
 *   export const generateStaticParams = () => staticParams
 *
 * Pre-computing the array once here keeps generateStaticParams a pure
 * re-export in the layout and makes the locale list the single source of
 * truth for static pre-rendering.
 */
export const staticParams = routing.locales.map((locale) => ({ locale }))
