import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/site-url'

/**
 * robots.txt generator. Allow everything except admin + api. Coming-soon gate
 * is enforced in middleware, not here — we don't want to block crawlers from
 * indexing the site when the admin later turns the gate off.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
