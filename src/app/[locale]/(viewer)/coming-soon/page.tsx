import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

import { ComingSoonSplash } from '@/components/coming-soon/coming-soon-splash'
import { getAppConfig } from '@/lib/config'
import { getLocale } from '@/lib/locale-server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('comingSoon')
  return {
    title: `${t('gateHeading')} | Clickit Story`,
    description: t('gateDescription'),
  }
}

/**
 * Gate splash — only reachable while coming-soon mode is ON (proxy + page redirect
 * when OFF). No public catalog; the watch page rails cover upcoming shows.
 */
export default async function ComingSoonPage() {
  const [locale, config] = await Promise.all([getLocale(), getAppConfig()])

  if (!config.flags.comingSoonMode) {
    redirect({ href: '/watch', locale })
  }

  return <ComingSoonSplash />
}
