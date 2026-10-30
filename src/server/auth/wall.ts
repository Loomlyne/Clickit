// AUTH-01 / D-01: the sign-in wall as one table. Fails closed: any path not
// listed here is walled. `/api/*` is not decided here (routes keep their own
// checks), and coming-soon is decided by the proxy before the wall.
// Input is the path without the locale prefix.

export const PUBLIC_EXACT = [
  '/',
  '/portfolio',
  '/newsletter/confirm',
  '/unsubscribe',
] as const

export const PUBLIC_PREFIXES = [
  '/portfolio',
  '/privacy',
  '/terms',
  '/legal',
  '/auth',
  '/support',
  '/coming-soon',
] as const

export function isPublicPath(pathWithoutLocale: string): boolean {
  if (typeof pathWithoutLocale !== 'string' || pathWithoutLocale === '') {
    return false
  }
  if ((PUBLIC_EXACT as readonly string[]).includes(pathWithoutLocale)) {
    return true
  }
  return PUBLIC_PREFIXES.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`)
  )
}
