// Which R2 objects sit behind a stored media URL (plan 02-15). Used to delete the
// PREVIOUS image after a new one is committed. Only URLs on our own media origin
// qualify: Supabase Storage URLs, empty values and foreign hosts return [] so a
// Supabase original is never deleted (MEDIA-07: Supabase is emptied only after
// Koss approves). Pure: no '@/' or server-only imports.
import { VARIANT_WIDTHS } from './upload-kinds.ts'

const KEY_RE = /^(?:show-artwork|site-assets|avatars)\/[A-Za-z0-9/_.-]+$/

/** The R2 key for a url on `origin`, or null. Query string and fragment are ignored. */
export function r2KeyFromUrl(url: string | null | undefined, origin: string | null): string | null {
  if (!url || !origin) return null
  const prefix = `${origin}/`
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length).split(/[?#]/)[0] ?? ''
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) return null
  return key
}

/** The original key plus every variant the browser or the copy script may have made. */
export function r2KeysForUrl(url: string | null | undefined, origin: string | null): string[] {
  const key = r2KeyFromUrl(url, origin)
  if (!key) return []
  const variants = VARIANT_WIDTHS.flatMap((w) => [`_v/${w}/webp/${key}`, `_v/${w}/avif/${key}`])
  return [key, ...variants]
}
