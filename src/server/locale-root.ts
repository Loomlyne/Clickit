// Locale root -> portfolio landing (plan 02-21 CPU work). Pure: no imports.
// The proxy answers a real HTTP 308 for /<locale> so the Worker renders nothing.
// The page's permanentRedirect() stays as the fallback, but it fires after the
// layout has started streaming: a 200 with the full layout plus a meta refresh,
// then a second render of /portfolio.
export function localeRootTarget(pathWithoutLocale: string, locale: string): string | null {
  return pathWithoutLocale === '/' ? `/${locale}/portfolio` : null
}
