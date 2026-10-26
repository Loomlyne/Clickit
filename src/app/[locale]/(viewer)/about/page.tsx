import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { CompanyPage } from '@/components/company/company-page'
import { requireViewer } from '@/server/auth/require-viewer'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function AboutPage() {
  await requireViewer(await getLocale(), '/about')
  const t = await getTranslations('about')

  return (
    <CompanyPage
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={[
        { heading: t('section1Heading'), body: t('section1Body') },
        { heading: t('section2Heading'), body: t('section2Body') },
        { heading: t('section3Heading'), body: t('section3Body') },
      ]}
      ctaLabel={t('ctaLabel')}
      ctaHref="/support"
    />
  )
}
