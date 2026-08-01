/**
 * Public media resolves to R2 when NEXT_PUBLIC_MEDIA_ORIGIN is configured.
 * Before that cutover, Supabase videos retain the range-safe proxy fallback.
 */

const SUPABASE_PUBLIC_OBJECT_PREFIX = '/storage/v1/object/public/'

const DEFAULT_PRELOADER_VIDEO = '/brand/clickit-preloader.mp4'

const PUBLIC_BUCKETS = new Set(['show-artwork', 'site-assets', 'avatars'])

type SupabasePublicObject = {
  bucket: string
  key: string
}
/**
 * Returns a safe public R2 origin. This is intentionally an origin, not a
 * path prefix, so the migration keeps each object at `bucket/key`.
 */
export function getPublicMediaOrigin(
  configuredOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN
): string | null {
  if (!configuredOrigin) return null

  try {
    const origin = new URL(configuredOrigin.trim())
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    ) {
      return null
    }

    return origin.origin
  } catch {
    return null
  }
}

function getSupabasePublicObject(
  rawUrl: string,
  supabaseHost: string | null
): SupabasePublicObject | null {
  if (!supabaseHost) return null

  try {
    const source = new URL(rawUrl)
    if (
      source.host !== supabaseHost ||
      !source.pathname.startsWith(SUPABASE_PUBLIC_OBJECT_PREFIX)
    ) {
      return null
    }

    const objectPath = source.pathname.slice(
      SUPABASE_PUBLIC_OBJECT_PREFIX.length
    )
    const firstSlash = objectPath.indexOf('/')
    if (firstSlash <= 0 || firstSlash === objectPath.length - 1) return null

    return {
      bucket: objectPath.slice(0, firstSlash),
      key: objectPath.slice(firstSlash + 1),
    }
  } catch {
    return null
  }
}

/**
 * Maps a Supabase public object to the equivalent R2 `bucket/key` object.
 * Returns null until a valid public R2 origin is configured.
 */
export function toPublicR2MediaUrl(
  rawUrl: string,
  supabaseHost = getSupabaseProjectHost(),
  configuredOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN
): string | null {
  const mediaOrigin = getPublicMediaOrigin(configuredOrigin)
  const object = getSupabasePublicObject(rawUrl, supabaseHost)
  if (!mediaOrigin || !object || !PUBLIC_BUCKETS.has(object.bucket)) return null

  try {
    const source = new URL(rawUrl)
    const destination = new URL(mediaOrigin)
    destination.pathname = `/${object.bucket}/${object.key}`
    destination.search = source.search
    return destination.toString()
  } catch {
    return null
  }
}

export function isPublicR2MediaUrl(
  rawUrl: string | null | undefined,
  configuredOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN
): boolean {
  const mediaOrigin = getPublicMediaOrigin(configuredOrigin)
  if (!rawUrl || !mediaOrigin) return false

  try {
    return new URL(rawUrl).origin === mediaOrigin
  } catch {
    return false
  }
}

export function getSupabaseProjectHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return !!getSupabasePublicObject(url, getSupabaseProjectHost())
}

export function isAllowedSupabasePublicUrl(url: URL): boolean {
  const parts = url.pathname.split('/')
  const bucketIdx = parts.indexOf('public') + 1
  const bucket = parts[bucketIdx]
  return !!bucket && PUBLIC_BUCKETS.has(bucket)
}

/** Remove admin ?v= cache-bust — filenames already carry timestamps. */
export function stripStorageCacheBust(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined
  if (isPublicR2MediaUrl(url)) return url

  // Fixed-key objects use `?v=` as their cache key. Keep it whenever the
  // object resolves to R2, where dropping it would make an overwrite serve a
  // stale one-year-cached response. The Supabase proxy fallback still removes
  // the admin cache-bust as before.
  const r2Url = toPublicR2MediaUrl(url, getSupabaseProjectHost())
  if (r2Url) return r2Url

  let clean = url
  try {
    if (url.includes('?')) {
      const parsed = new URL(url)
      parsed.searchParams.delete('v')
      const search = parsed.searchParams.toString()
      clean = search
        ? `${parsed.origin}${parsed.pathname}?${search}`
        : `${parsed.origin}${parsed.pathname}`
    }
  } catch {
    clean = url.split('?')[0]
  }

  return clean
}

/**
 * Proxy Supabase public storage through Vercel's edge cache.
 * Use for video `<src>` and other direct browser fetches.
 */
export function toCdnStorageUrl(
  url: string | null | undefined
): string | undefined {
  if (url?.startsWith('/api/cdn/storage?')) return url
  const clean = stripStorageCacheBust(url)
  if (!clean || !isSupabaseStorageUrl(clean)) return clean

  return `/api/cdn/storage?url=${encodeURIComponent(clean)}`
}

/** Entry splash: keep on Vercel static assets, not Supabase storage. */
export function resolvePreloaderVideoUrl(
  configUrl: string | null | undefined
): string {
  if (!configUrl) return DEFAULT_PRELOADER_VIDEO
  const resolved = stripStorageCacheBust(configUrl)
  if (resolved && isPublicR2MediaUrl(resolved)) return resolved
  if (isSupabaseStorageUrl(resolved)) return DEFAULT_PRELOADER_VIDEO
  return resolved ?? DEFAULT_PRELOADER_VIDEO
}

/** MP4 sources hosted on Supabase → edge-cached same-origin proxy. */
export function resolveSupabaseVideoUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null
  if (!isSupabaseStorageUrl(url)) return url
  return toCdnStorageUrl(url) ?? url
}
