import { cookies } from 'next/headers'
import { SUPPORTED_LOCALES, LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from './locale'

/**
 * Read the active locale for this request from the NEXT_LOCALE cookie.
 * Server-only — uses next/headers. Client components should read the locale
 * via useLocale() from next-intl instead.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const raw = store.get(LOCALE_COOKIE)?.value
  if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale
  }
  return DEFAULT_LOCALE
}
