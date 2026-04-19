import { cookies } from 'next/headers'

export const SUPPORTED_LOCALES = ['en', 'ar'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_COOKIE = 'NEXT_LOCALE'

/**
 * Read the active locale for this request from the NEXT_LOCALE cookie.
 *
 * Why a cookie and not a URL prefix (like /en/, /ar/):
 *   - Zero route restructuring. Every existing page.tsx keeps its path.
 *   - Trade-off: search engines only crawl one locale per URL. Arabic SEO
 *     requires either canonical games or a future migration to /[locale]/
 *     route segments. For v1 (English-first per CLAUDE.md), this is fine.
 *
 * Defaults to 'en' when the cookie is missing or carries an unsupported value.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const raw = store.get(LOCALE_COOKIE)?.value
  if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale
  }
  return DEFAULT_LOCALE
}

/**
 * Direction for a given locale. Used on <html dir>, also on individual blocks
 * that render mixed content (e.g., a show description card that should flip
 * its alignment based on the language of the currently selected locale).
 */
export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

/**
 * Helper for components that have an English field plus an optional `_ar`
 * companion. Returns the locale-appropriate value with English fallback.
 *
 * Example:
 *   pickLocalized(locale, show.title, show.title_ar)
 */
export function pickLocalized(locale: Locale, en: string, ar: string | null | undefined): string {
  if (locale === 'ar' && ar && ar.trim()) return ar
  return en
}
