import type { MetadataRoute } from 'next'

import { getStreamingShows, getComingSoonShows } from '@/lib/queries'
import { siteUrl } from '@/lib/site-url'
import { routing } from '@/i18n/routing'

/**
 * Sitemap generator. Emits one entry per route with `alternates.languages`
 * pointing at the /en/ and /ar/ variants. Google uses the alternates to
 * treat the two URLs as language variants of the same canonical page
 * instead of competing duplicates.
 *
 * Episode URLs are intentionally omitted — the catalog has ~300 episodes
 * addressed by numeric IDs that won't help crawlers discover content. Show
 * pages already link to every episode via the season tabs, so crawlers
 * reach them via depth-2 traversal. Revisit if organic search becomes a
 * meaningful traffic source.
 */
function languageAlternates(base: string, path: string): Record<string, string> {
  // Build { en: ${base}/en${path}, ar: ${base}/ar${path} } — one entry per
  // locale in routing.locales. Adding a new locale in routing.ts picks up
  // automatically here.
  return Object.fromEntries(
    routing.locales.map((loc) => [loc, `${base}/${loc}${path === '/' ? '' : path}`]),
  )
}

function entry(
  base: string,
  path: string,
  now: Date,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>,
  priority: number,
): MetadataRoute.Sitemap[number] {
  // The `url` field uses the defaultLocale variant as the canonical URL the
  // crawler hits first. Google follows alternates to discover the /ar/ peer.
  const defaultPath = path === '/' ? '' : path
  return {
    url: `${base}/${routing.defaultLocale}${defaultPath}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: {
      languages: languageAlternates(base, path),
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [streaming, comingSoon] = await Promise.all([
    getStreamingShows(),
    getComingSoonShows(),
  ])

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    entry(base, '/', now, 'daily', 1.0),
    entry(base, '/browse', now, 'daily', 0.9),
    entry(base, '/coming-soon', now, 'weekly', 0.5),
  ]

  const showEntries: MetadataRoute.Sitemap = [...streaming, ...comingSoon].map((show) =>
    entry(base, `/series/${show.slug}`, now, 'weekly', 0.8),
  )

  return [...staticEntries, ...showEntries]
}
