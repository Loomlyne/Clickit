// AUTH-01 / D-01: the page-level wall decision, the second fence behind the
// proxy's decideRoute (05-18). Pure (relative import of the one wall table
// only) so node:test covers it. Input is the path without the locale prefix;
// `next` is returned raw and the caller URL-encodes it.

import { isPublicPath } from './wall.ts'

export type ViewerAccess = { action: 'pass' } | { action: 'auth'; next: string }

export function viewerAccess(
  pathWithoutLocale: string,
  userId: string | null
): ViewerAccess {
  if (isPublicPath(pathWithoutLocale)) return { action: 'pass' }
  const signedIn = typeof userId === 'string' && userId !== ''
  if (!signedIn) return { action: 'auth', next: pathWithoutLocale }
  return { action: 'pass' }
}
