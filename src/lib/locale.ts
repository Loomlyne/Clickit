export const SUPPORTED_LOCALES = ['en', 'ar'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_COOKIE = 'NEXT_LOCALE'

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

/**
 * Public render path for a field with an `_ar` companion: the stored Arabic on the Arabic
 * locale, otherwise the English. Never translates on a viewer request (review item 6, PR #29):
 * a missing Arabic value is filled by the admin save, not by Workers AI at render time.
 * Async so the existing Promise.all callers in queries.ts keep their shape.
 */
export async function localizedField(
  locale: Locale,
  en: string,
  ar: string | null | undefined
): Promise<string> {
  return pickLocalized(locale, en, ar)
}
