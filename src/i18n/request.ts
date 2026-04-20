import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

/**
 * next-intl request config for Clickit Story.
 *
 * Contract (next-intl v4):
 *   - `requestLocale` is a Promise resolving to the locale segment parsed
 *     from the URL by createMiddleware(routing). It's undefined until Phase 13
 *     composes the middleware, which is fine — we fall back to routing.defaultLocale.
 *   - Validates against routing.locales using hasLocale(); falls back to
 *     routing.defaultLocale on invalid/missing values.
 *   - Returns { locale, messages } so Server Components and the
 *     NextIntlClientProvider (wired in Phase 13) can resolve translations.
 *
 * Auto-detected by next-intl v4 when placed at `src/i18n/request.ts` —
 * no `createNextIntlPlugin()` hook needed in next.config.ts.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
