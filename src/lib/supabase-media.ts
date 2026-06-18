/**
 * Helpers to keep Supabase Storage egress off the free-tier quota.
 *
 * Videos are streamed directly from storage URLs today — every page view
 * bills cached egress. Images routed through next/image still pull from
 * Supabase on optimizer cache miss; stripping ?v= bust params improves hit rate.
 */

const DEFAULT_PRELOADER_VIDEO = '/brand/clickit-preloader.mp4'

const PUBLIC_BUCKETS = new Set(['show-artwork', 'site-assets', 'avatars'])

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
  const host = getSupabaseProjectHost()
  if (!host) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.host === host &&
      parsed.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
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
  if (!url.includes('?')) return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('v')
    const search = parsed.searchParams.toString()
    return search ? `${parsed.origin}${parsed.pathname}?${search}` : `${parsed.origin}${parsed.pathname}`
  } catch {
    return url.split('?')[0]
  }
}

/**
 * Proxy Supabase public storage through Vercel's edge cache.
 * Use for video `<src>` and other direct browser fetches.
 */
export function toCdnStorageUrl(
  url: string | null | undefined
): string | undefined {
  const clean = stripStorageCacheBust(url)
  if (!clean || !isSupabaseStorageUrl(clean)) return clean

  return `/api/cdn/storage?url=${encodeURIComponent(clean)}`
}

/** Entry splash: keep on Vercel static assets, not Supabase storage. */
export function resolvePreloaderVideoUrl(
  configUrl: string | null | undefined
): string {
  if (!configUrl) return DEFAULT_PRELOADER_VIDEO
  if (isSupabaseStorageUrl(configUrl)) return DEFAULT_PRELOADER_VIDEO
  return configUrl
}

/** MP4 sources hosted on Supabase → edge-cached same-origin proxy. */
export function resolveSupabaseVideoUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null
  if (!isSupabaseStorageUrl(url)) return url
  return toCdnStorageUrl(url) ?? url
}
