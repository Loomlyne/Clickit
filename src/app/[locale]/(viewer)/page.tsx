import { getLocale } from 'next-intl/server'
import { permanentRedirect } from '@/i18n/navigation'

// The locale root forwards to the canonical landing at /portfolio. Using a
// permanent (308) redirect lets the browser and CDN cache the hop, so repeat
// bare-domain visits jump straight to /portfolio instead of round-tripping
// through this server render every time.
export default async function LocaleRootPage() {
  const locale = await getLocale()
  permanentRedirect({ href: '/portfolio', locale })
}
