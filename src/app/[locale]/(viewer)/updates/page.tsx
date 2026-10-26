import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { PageEyebrow, PageTitle } from '@/components/info/page-header'
import { NewsletterSignupForm } from '@/components/layout/newsletter-signup-form'
import { requireViewer } from '@/server/auth/require-viewer'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('updates')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>
}) {
  const { user } = await requireViewer(await getLocale(), '/updates')
  const t = await getTranslations('updates')
  const params = await searchParams
  const showSlug = params?.show?.trim() || undefined
  const showTitle = showSlug ? showSlug.replace(/-/g, ' ') : undefined

  const defaultEmail = user.email ?? ''

  return (
    <div className="px-4 pt-8 pb-16 sm:px-6 md:px-12">
      <div className="mx-auto max-w-3xl rounded-card border border-[var(--line)] bg-[var(--bg-1)] p-6 sm:p-10">
        <PageEyebrow>{t('eyebrow')}</PageEyebrow>
        <PageTitle size="card">{t('heading')}</PageTitle>
        <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[var(--text-dim)]">
          {showTitle
            ? t('descriptionForShow', { showTitle })
            : t('descriptionGeneric')}
        </p>
        <div className="mt-8">
          <NewsletterSignupForm
            source={showSlug ? 'coming-soon' : 'updates-page'}
            interestSlug={showSlug}
            interestTitle={showTitle}
            defaultEmail={defaultEmail}
            buttonLabel={t('buttonLabel')}
            compact={false}
          />
        </div>
      </div>
    </div>
  )
}
