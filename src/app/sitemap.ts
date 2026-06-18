import type { MetadataRoute } from 'next'

import { getSitemapEntries } from '@/lib/queries'
import { siteUrl } from '@/lib/site-url'
import { routing } from '@/i18n/routing'

/**
 * Sitemap generator. Emits one entry per route with `alternates.languages`
 * pointing at the /en/ and /ar/ variants. Google + AI crawlers use the
 * alternates to treat the two URLs as language variants of one canonical page
 * instead of competing duplicates.
 *
 * Fully data-driven: shows AND published episodes come from the DB, so new
 * content appears automatically with no code change. <lastmod> is the row's
 * real `updated_at` so crawlers re-fetch only what actually changed.
 */
function languageAlternates(
  base: string,
  path: string
): Record<string, string> {
  // Build { en: ${base}/en${path}, ar: ${base}/ar${path} } — one entry per
  // locale in routing.locales. Adding a new locale in routing.ts picks up
  // automatically here.
  return Object.fromEntries(
    routing.locales.map((loc) => [
      loc,
      `${base}/${loc}${path === '/' ? '' : path}`,
    ])
  )
}

function entry(
  base: string,
  path: string,
  lastModified: Date | string,
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]['changeFrequency']
  >,
  priority: number
): MetadataRoute.Sitemap[number] {
  // The `url` field uses the defaultLocale variant as the canonical URL the
  // crawler hits first. Google follows alternates to discover the /ar/ peer.
  const defaultPath = path === '/' ? '' : path
  return {
    url: `${base}/${routing.defaultLocale}${defaultPath}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: languageAlternates(base, path),
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const { shows, episodes } = await getSitemapEntries()

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    entry(base, '/portfolio', now, 'daily', 1.0),
    entry(base, '/watch', now, 'daily', 0.9),
    entry(base, '/updates', now, 'weekly', 0.5),
    entry(base, '/about', now, 'monthly', 0.4),
    entry(base, '/support', now, 'weekly', 0.5),
  ]

  const showEntries: MetadataRoute.Sitemap = shows.map((s) =>
    entry(base, s.path, s.lastmod ?? now, 'weekly', 0.8)
  )

  // Episode watch pages carry VideoObject structured data — worth indexing for
  // Google video results and AI retrieval. Real lastmod keeps them fresh.
  const episodeEntries: MetadataRoute.Sitemap = episodes.map((e) =>
    entry(base, e.path, e.lastmod ?? now, 'monthly', 0.6)
  )

  return [...staticEntries, ...showEntries, ...episodeEntries]
}
