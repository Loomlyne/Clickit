import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { ComingSoonSplash } from '@/components/coming-soon/coming-soon-splash'
import { ComingSoonCatalog } from '@/components/coming-soon/coming-soon-catalog'
import { getAppConfig } from '@/lib/config'
import type { Locale } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  const [t, config] = await Promise.all([
    getTranslations('comingSoon'),
    getAppConfig(),
  ])

  if (config.flags.comingSoonMode) {
    return {
      title: `${t('gateHeading')} | Clickit Story`,
      description: t('gateDescription'),
    }
  }

  return {
    title: `${t('pageTitle')} | Clickit Story`,
    description: t('description'),
  }
}

export default async function ComingSoonPage() {
  const [locale, config] = await Promise.all([
    getLocale(),
    getAppConfig(),
  ])

  if (config.flags.comingSoonMode) {
    return <ComingSoonSplash />
  }

  return <ComingSoonCatalog locale={locale as Locale} />
}
