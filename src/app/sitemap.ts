import type { MetadataRoute } from 'next'

import { getStreamingShows, getComingSoonShows } from '@/lib/queries'
import { siteUrl } from '@/lib/site-url'

/**
 * Sitemap generator. Emits:
 *   - Static landing pages (home, browse, coming-soon)
 *   - One entry per show (streaming + coming-soon)
 *
 * Episode URLs are intentionally omitted — the catalog has ~300 episodes and
 * their URLs are just numeric IDs that won't help crawlers discover content.
 * Show pages already link to every episode via the season tabs, so crawlers
 * reach them via depth-2 traversal. Revisit if organic search becomes a
 * meaningful traffic source.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [streaming, comingSoon] = await Promise.all([
    getStreamingShows(),
    getComingSoonShows(),
  ])

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/coming-soon`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
  ]

  const showEntries: MetadataRoute.Sitemap = [...streaming, ...comingSoon].map((show) => ({
    url: `${base}/series/${show.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticEntries, ...showEntries]
}
